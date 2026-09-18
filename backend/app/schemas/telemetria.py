from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.telemetria import NivelAlerta, OrigenLectura


class IngestaArchivoRespuesta(BaseModel):
    filas_procesadas: int
    filas_descartadas: int
    punto_control_id: int


class IngestaAleatoriaSolicitud(BaseModel):
    punto_control_id: int
    cantidad: int = Field(gt=0, le=5000)


class IngestaAleatoriaRespuesta(BaseModel):
    filas_generadas: int
    punto_control_id: int


class GeneradorContinuoIniciarSolicitud(BaseModel):
    # Minimo 5s (pedido explicito, para no saturar la BD); maximo 1h como
    # tope de sensatez (un intervalo mas largo no tiene sentido como modo
    # "continuo" y probablemente es un error de captura).
    intervalo_segundos: int = Field(ge=5, le=3600)


class GeneradorContinuoRespuesta(BaseModel):
    corriendo: bool
    intervalo_segundos: int | None = None
    iniciado_en: datetime | None = None


class TelemetriaResumen(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    timestamp: datetime
    temperatura: float | None
    humedad: float | None
    bateria: float | None
    gas_crudo: float
    gas_corregido: float | None
    nivel_alerta: NivelAlerta
    origen: OrigenLectura


class LecturaManualSolicitud(BaseModel):
    punto_control_id: int
    temperatura: float | None = None
    humedad: float | None = None
    bateria: float | None = None
    gas_crudo: float


class LecturaManualRespuesta(BaseModel):
    id: int
    punto_control_id: int
    timestamp: datetime
    origen: OrigenLectura
    temperatura: float | None
    humedad: float | None
    bateria: float | None
    gas_crudo: float
    error_predicho: float | None
    gas_corregido: float | None
    gas_corregido_porcentaje: float | None
    nivel_alerta: NivelAlerta
    # Indicador explicito pedido por la tarea: False cuando falto alguna de
    # Temp/Humed/Bateria y por lo tanto no corrio el pipeline ML (ver
    # DECISION en docs/PROJECT_CONTEXT.md).
    corregido_por_modelo: bool
