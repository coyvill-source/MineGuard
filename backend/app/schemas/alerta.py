from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.bitacora_alertas import EstadoAlerta


class AlertaCrear(BaseModel):
    telemetria_id: int
    observacion_hse: str = Field(min_length=1)


class AlertaObservacionOpcional(BaseModel):
    observacion_hse: str | None = Field(default=None, min_length=1)


class AlertaResolver(BaseModel):
    observacion_hse: str = Field(min_length=1)


class AlertaRespuesta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    telemetria_id: int
    estado: EstadoAlerta
    observacion_hse: str | None
    usuario_resolutor_id: int | None
    fecha_creacion: datetime
    fecha_actualizacion: datetime | None
