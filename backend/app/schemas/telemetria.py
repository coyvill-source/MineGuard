from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.telemetria import NivelAlerta


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


class TelemetriaResumen(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    timestamp: datetime
    temperatura: float
    humedad: float
    bateria: float
    gas_crudo: float
    gas_corregido: float | None
    nivel_alerta: NivelAlerta
