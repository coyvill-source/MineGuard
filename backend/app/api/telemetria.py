import asyncio
import io
import random
import unicodedata
import warnings
from datetime import datetime, timedelta
from datetime import time as dt_time
from datetime import timezone
from pathlib import Path
from typing import Annotated

import joblib
import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.core.database import get_db
from app.core.permissions import requiere_rol
from app.models.modelo_ml import ModeloML
from app.models.punto_control import PuntoControl
from app.models.telemetria import EstadoValidacion, NivelAlerta, Telemetria
from app.models.usuario import RolUsuario, Usuario
from app.schemas.telemetria import (
    IngestaAleatoriaRespuesta,
    IngestaAleatoriaSolicitud,
    IngestaArchivoRespuesta,
    TelemetriaResumen,
)

router = APIRouter(tags=["telemetria"])

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent  # .../backend

# Cache en memoria del proceso del ModeloML activo (modelo + scaler ya
# deserializados desde disco), para no releer los .joblib en cada fila ni
# en cada request. Solo se invalida reiniciando el proceso.
_modelo_activo_cache: dict[str, object] = {}
_modelo_activo_lock = asyncio.Lock()


async def _obtener_modelo_activo(db: AsyncSession) -> dict[str, object]:
    if _modelo_activo_cache:
        return _modelo_activo_cache

    async with _modelo_activo_lock:
        if _modelo_activo_cache:  # otro request ya lo cargo mientras esperabamos el lock
            return _modelo_activo_cache

        modelo_ml = await db.scalar(select(ModeloML).where(ModeloML.activo.is_(True)))
        if modelo_ml is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "No hay ningun ModeloML activo registrado. Ejecuta "
                    "'python -m app.scripts.seed_modelo_ml' antes de ingerir telemetria."
                ),
            )

        # NOTA: archivo_scaler del ModeloML activo apunta hoy a un
        # StandardScaler derivado localmente (aproximacion TEMPORAL), no al
        # scaler original de entrenamiento - ver docs/PROJECT_CONTEXT.md.
        modelo = joblib.load(BACKEND_DIR / modelo_ml.archivo_modelo)
        scaler = joblib.load(BACKEND_DIR / modelo_ml.archivo_scaler)

        _modelo_activo_cache.update({"id": modelo_ml.id, "modelo": modelo, "scaler": scaler})
        return _modelo_activo_cache


def _predecir_correccion(
    modelo: object, scaler: object, temperatura: float, humedad: float, bateria: float, gas_crudo: float
) -> tuple[float, float]:
    """Escala (Temp, Humed, Bateria, en ese orden) e infiere el error del
    modelo, aplicando la correccion gas_corregido = gas_crudo + error.
    Compartida por ingesta-archivo e ingesta-aleatoria: un solo lugar para
    el pipeline ML, ver docs/PROJECT_CONTEXT.md."""
    variables_escaladas = scaler.transform([[temperatura, humedad, bateria]])
    error_predicho = float(modelo.predict(variables_escaladas)[0])
    gas_corregido = gas_crudo + error_predicho
    return error_predicho, gas_corregido


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

    modelo_activo = await _obtener_modelo_activo(db)
    modelo = modelo_activo["modelo"]
    scaler = modelo_activo["scaler"]
    modelo_id = modelo_activo["id"]

    for fila, marca_tiempo in zip(filas_validas.itertuples(), marcas_tiempo):
        error_predicho, gas_corregido = _predecir_correccion(
            modelo, scaler, float(fila.temperatura), float(fila.humedad), float(fila.bateria), float(fila.gas_crudo)
        )

        db.add(
            Telemetria(
                punto_id=punto_control_id,
                modelo_id=modelo_id,
                timestamp=marca_tiempo,
                temperatura=float(fila.temperatura),
                humedad=float(fila.humedad),
                bateria=float(fila.bateria),
                gas_crudo=float(fila.gas_crudo),
                error_predicho=error_predicho,
                gas_corregido=gas_corregido,
                # Placeholder: el motor de umbrales/semaforo aun no esta
                # implementado (fuera de alcance de esta tarea).
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


# Rangos de generacion sintetica, tomados de los valores min/max reales
# observados en backend/app/datos_prueba/Datos_despliegue.xlsx (verificado
# con pandas: Temp .29-35.02, Humed .4-58.95, Bateria .17-99.73,
# Ch4/gas_crudo 1923-20475). Distribucion uniforme (no normal): mas simple,
# y evita necesitar media/desviacion estandar reales que no fueron
# entregadas - ver docs/PROJECT_CONTEXT.md.
RANGO_TEMPERATURA = (0.29, 35.02)
RANGO_HUMEDAD = (0.4, 58.95)
RANGO_BATERIA = (0.17, 99.73)
RANGO_GAS_CRUDO = (1923, 20475)

# Espaciado entre timestamps sinteticos, en segundos: en los datos reales la
# moda y la mediana del intervalo entre lecturas consecutivas son ambas 12s
# (con variacion entre 11 y 17s en la mayoria de los casos).
ESPACIADO_SEGUNDOS = (10.0, 16.0)


@router.post("/ingesta-aleatoria", response_model=IngestaAleatoriaRespuesta)
async def ingesta_aleatoria(
    datos: IngestaAleatoriaSolicitud,
    db: Annotated[AsyncSession, Depends(get_db)],
    _usuario_actual: Annotated[Usuario, Depends(get_current_user)],
) -> IngestaAleatoriaRespuesta:
    punto_control = await db.get(PuntoControl, datos.punto_control_id)
    if punto_control is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="El punto de control indicado no existe"
        )

    modelo_activo = await _obtener_modelo_activo(db)
    modelo = modelo_activo["modelo"]
    scaler = modelo_activo["scaler"]
    modelo_id = modelo_activo["id"]

    marca_tiempo = datetime.now(timezone.utc)
    for _ in range(datos.cantidad):
        temperatura = random.uniform(*RANGO_TEMPERATURA)
        humedad = random.uniform(*RANGO_HUMEDAD)
        bateria = random.uniform(*RANGO_BATERIA)
        gas_crudo = float(random.randint(*RANGO_GAS_CRUDO))

        error_predicho, gas_corregido = _predecir_correccion(
            modelo, scaler, temperatura, humedad, bateria, gas_crudo
        )

        db.add(
            Telemetria(
                punto_id=datos.punto_control_id,
                modelo_id=modelo_id,
                timestamp=marca_tiempo,
                temperatura=temperatura,
                humedad=humedad,
                bateria=bateria,
                gas_crudo=gas_crudo,
                error_predicho=error_predicho,
                gas_corregido=gas_corregido,
                # Placeholder: el motor de umbrales/semaforo aun no esta
                # implementado (bloqueado, ver docs/PROJECT_CONTEXT.md).
                nivel_alerta=NivelAlerta.OPTIMO,
                estado_validacion=EstadoValidacion.VALIDO,
            )
        )

        marca_tiempo += timedelta(seconds=random.uniform(*ESPACIADO_SEGUNDOS))

    await db.commit()

    return IngestaAleatoriaRespuesta(
        filas_generadas=datos.cantidad,
        punto_control_id=datos.punto_control_id,
    )


LIMITE_RECIENTES = 10


@router.get("/recientes", response_model=list[TelemetriaResumen])
async def telemetrias_recientes(
    punto_control_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _actor: Annotated[Usuario, Depends(requiere_rol(RolUsuario.TRABAJADOR))],
) -> list[Telemetria]:
    punto_control = await db.get(PuntoControl, punto_control_id)
    if punto_control is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="El punto de control indicado no existe"
        )

    consulta = (
        select(Telemetria)
        .where(Telemetria.punto_id == punto_control_id)
        .order_by(Telemetria.timestamp.desc())
        .limit(LIMITE_RECIENTES)
    )
    resultado = await db.scalars(consulta)
    return list(resultado.all())
