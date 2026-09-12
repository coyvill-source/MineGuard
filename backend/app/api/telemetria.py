import io
import unicodedata
import warnings
from datetime import datetime
from datetime import time as dt_time
from datetime import timezone
from typing import Annotated

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.core.database import get_db
from app.models.punto_control import PuntoControl
from app.models.telemetria import EstadoValidacion, NivelAlerta, Telemetria
from app.models.usuario import Usuario
from app.schemas.telemetria import IngestaArchivoRespuesta

router = APIRouter(tags=["telemetria"])

COLUMNA_SINONIMOS: dict[str, set[str]] = {
    "temperatura": {"temp", "temperatura"},
    "humedad": {"humed", "humedad"},
    "gas_crudo": {"ch4", "gas"},
    "bateria": {"bateria"},
}
COLUMNAS_REQUERIDAS = set(COLUMNA_SINONIMOS)

TIMESTAMP_SINONIMOS = {"hora_insertion", "fecha_hora", "timestamp", "fecha", "datetime", "hora"}


def _normalizar_encabezado(nombre: object) -> str:
    sin_acentos = unicodedata.normalize("NFKD", str(nombre)).encode("ascii", "ignore").decode("ascii")
    return sin_acentos.strip().lower()


def _normalizar_columnas(df: pd.DataFrame) -> pd.DataFrame:
    sinonimo_a_canonico = {
        sinonimo: canonico for canonico, sinonimos in COLUMNA_SINONIMOS.items() for sinonimo in sinonimos
    }

    nuevas_columnas = {}
    for columna in df.columns:
        normalizada = _normalizar_encabezado(columna)
        if normalizada in sinonimo_a_canonico:
            nuevas_columnas[columna] = sinonimo_a_canonico[normalizada]
        elif normalizada in TIMESTAMP_SINONIMOS:
            nuevas_columnas[columna] = "_timestamp_origen"

    return df.rename(columns=nuevas_columnas)


def _resolver_un_timestamp(valor: object, ahora: datetime, hoy: object) -> datetime:
    if isinstance(valor, datetime):
        return valor if valor.tzinfo is not None else valor.replace(tzinfo=timezone.utc)

    if isinstance(valor, dt_time):
        return datetime.combine(hoy, valor, tzinfo=timezone.utc)

    parseado = pd.to_datetime(valor, errors="coerce")
    if pd.isna(parseado):
        return ahora

    parseado = parseado.to_pydatetime()
    return parseado if parseado.tzinfo is not None else parseado.replace(tzinfo=timezone.utc)


def _resolver_timestamps(df: pd.DataFrame) -> list[datetime]:
    ahora = datetime.now(timezone.utc)

    if "_timestamp_origen" not in df.columns:
        return [ahora] * len(df)

    hoy = ahora.date()

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        return [_resolver_un_timestamp(valor, ahora, hoy) for valor in df["_timestamp_origen"]]


def _leer_archivo(nombre_archivo: str, contenido: bytes) -> pd.DataFrame:
    buffer = io.BytesIO(contenido)
    try:
        if nombre_archivo.lower().endswith(".csv"):
            return pd.read_csv(buffer)
        return pd.read_excel(buffer)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pudo leer el archivo. Verifica que sea un Excel o CSV valido.",
        ) from exc


@router.post("/ingesta-archivo", response_model=IngestaArchivoRespuesta)
async def ingesta_archivo(
    db: Annotated[AsyncSession, Depends(get_db)],
    _usuario_actual: Annotated[Usuario, Depends(get_current_user)],
    archivo: Annotated[UploadFile, File()],
    punto_control_id: Annotated[int, Form()],
) -> IngestaArchivoRespuesta:
    punto_control = await db.get(PuntoControl, punto_control_id)
    if punto_control is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="El punto de control indicado no existe"
        )

    contenido = await archivo.read()
    df = _leer_archivo(archivo.filename or "", contenido)
    df = _normalizar_columnas(df)

    columnas_faltantes = COLUMNAS_REQUERIDAS - set(df.columns)
    if columnas_faltantes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Faltan columnas requeridas en el archivo: {', '.join(sorted(columnas_faltantes))}",
        )

    for columna in COLUMNAS_REQUERIDAS:
        df[columna] = pd.to_numeric(df[columna], errors="coerce")

    total_filas = len(df)
    filas_validas = df.dropna(subset=list(COLUMNAS_REQUERIDAS))
    filas_descartadas = total_filas - len(filas_validas)

    marcas_tiempo = _resolver_timestamps(filas_validas)

    for fila, marca_tiempo in zip(filas_validas.itertuples(), marcas_tiempo):
        db.add(
            Telemetria(
                punto_id=punto_control_id,
                modelo_id=None,
                timestamp=marca_tiempo,
                temperatura=float(fila.temperatura),
                humedad=float(fila.humedad),
                bateria=float(fila.bateria),
                gas_crudo=float(fila.gas_crudo),
                error_predicho=None,
                gas_corregido=None,
                nivel_alerta=NivelAlerta.OPTIMO,
                estado_validacion=EstadoValidacion.VALIDO,
            )
        )

    await db.commit()

    return IngestaArchivoRespuesta(
        filas_procesadas=len(filas_validas),
        filas_descartadas=filas_descartadas,
        punto_control_id=punto_control_id,
    )
