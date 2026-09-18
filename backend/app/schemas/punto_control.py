from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.solicitud_cambio_punto_control import EstadoSolicitudCambio, TipoSolicitudCambio
from app.models.telemetria import NivelAlerta


class PuntoControlCrear(BaseModel):
    estacion_id: int
    nombre_estacion: str = Field(min_length=1)
    coord_x: float
    coord_y: float
    coord_z: float


class PuntoControlActualizar(BaseModel):
    estacion_id: int | None = None
    nombre_estacion: str | None = Field(default=None, min_length=1)
    coord_x: float | None = None
    coord_y: float | None = None
    coord_z: float | None = None


class PuntoControlRespuesta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    estacion_id: int
    nombre_estacion: str
    estacion_nombre: str
    coord_x: float
    coord_y: float
    coord_z: float
    activo: bool


class DatosPropuestosPuntoControl(BaseModel):
    """Campos que puede llevar una solicitud de cambio, segun el tipo
    (ver validacion en SolicitudCambioCrear)."""

    estacion_id: int | None = None
    nombre_estacion: str | None = Field(default=None, min_length=1)
    coord_x: float | None = None
    coord_y: float | None = None
    coord_z: float | None = None


class SolicitudCambioCrear(BaseModel):
    tipo: TipoSolicitudCambio
    punto_control_id: int | None = None
    datos_propuestos: DatosPropuestosPuntoControl = DatosPropuestosPuntoControl()

    @model_validator(mode="after")
    def _validar_segun_tipo(self) -> "SolicitudCambioCrear":
        campos_datos = (
            self.datos_propuestos.estacion_id,
            self.datos_propuestos.nombre_estacion,
            self.datos_propuestos.coord_x,
            self.datos_propuestos.coord_y,
            self.datos_propuestos.coord_z,
        )

        if self.tipo == TipoSolicitudCambio.CREAR:
            if self.punto_control_id is not None:
                raise ValueError("punto_control_id debe ser nulo cuando tipo es 'crear'")
            if any(campo is None for campo in campos_datos):
                raise ValueError(
                    "Para tipo 'crear' se requieren estacion_id, nombre_estacion, coord_x, "
                    "coord_y y coord_z en datos_propuestos"
                )
        else:
            if self.punto_control_id is None:
                raise ValueError(f"punto_control_id es requerido cuando tipo es '{self.tipo.value}'")
            if self.tipo == TipoSolicitudCambio.EDITAR and all(campo is None for campo in campos_datos):
                raise ValueError("Para tipo 'editar' se requiere al menos un campo en datos_propuestos")

        return self


class SolicitudCambioRespuesta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tipo: TipoSolicitudCambio
    punto_control_id: int | None
    datos_propuestos: dict[str, Any]
    estado: EstadoSolicitudCambio
    creado_por_id: int
    revisado_por_id: int | None
    comentario_revision: str | None
    fecha_creacion: datetime
    fecha_revision: datetime | None


class SolicitudCambioRechazo(BaseModel):
    comentario: str = Field(min_length=1)


class UltimaLecturaTelemetria(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    timestamp: datetime
    temperatura: float
    humedad: float
    bateria: float
    gas_crudo: float
    error_predicho: float | None
    gas_corregido: float | None
    # Placeholder mientras el motor de umbrales/semaforo siga bloqueado
    # (ver docs/PROJECT_CONTEXT.md): hoy TODAS las lecturas devuelven
    # 'optimo' aqui, no es un estado real verificado de la mina.
    nivel_alerta: NivelAlerta


class PuntoControlEstadoActual(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    estacion_id: int
    nombre_estacion: str
    estacion_nombre: str
    coord_x: float
    coord_y: float
    coord_z: float
    ultima_lectura: UltimaLecturaTelemetria | None
