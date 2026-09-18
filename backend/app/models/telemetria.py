from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.bitacora_alertas import BitacoraAlertas
    from app.models.modelo_ml import ModeloML
    from app.models.punto_control import PuntoControl


class NivelAlerta(str, enum.Enum):
    OPTIMO = "optimo"
    ALERTA = "alerta"
    CRITICO = "critico"
    # Lectura manual con datos incompletos (falta alguna de Temp/Humed/
    # Bateria): no corrio el pipeline ML, no hay gas_corregido_porcentaje
    # confiable para clasificar - ver POST /api/telemetria/lectura-manual y
    # DECISION en docs/PROJECT_CONTEXT.md. Deliberadamente NO se reutiliza
    # OPTIMO como placeholder aqui (ya se abandono ese patron en el motor de
    # umbrales real - ver DECISION 2026-09-15/16): mentiria sobre el estado
    # real de la mina en ese punto. El frontend (PlanoPuntosControl) ya cae
    # a su estilo "Sin datos" ante cualquier valor no mapeado explicitamente
    # en ESTILO_POR_NIVEL, que es la lectura semantica correcta para este caso.
    SIN_CLASIFICAR = "sin_clasificar"


class EstadoValidacion(str, enum.Enum):
    VALIDO = "valido"
    DESCARTADO = "descartado"


class OrigenLectura(str, enum.Enum):
    SENSOR = "sensor"
    MANUAL = "manual"


class Telemetria(Base):
    __tablename__ = "telemetrias"

    id: Mapped[int] = mapped_column(primary_key=True)
    punto_id: Mapped[int] = mapped_column(ForeignKey("puntos_control.id"), nullable=False)
    modelo_id: Mapped[int | None] = mapped_column(ForeignKey("modelos_ml.id"), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    # Nullable desde la lectura manual solo-gas (POST /lectura-manual): un
    # Trabajador en campo puede no tener instrumento para Temp/Humed/Bateria,
    # solo el medidor de gas. Las lecturas automaticas (sensor/archivo/
    # aleatorio/generador continuo) siempre siguen llenando las 3.
    temperatura: Mapped[float | None] = mapped_column(Float, nullable=True)
    humedad: Mapped[float | None] = mapped_column(Float, nullable=True)
    bateria: Mapped[float | None] = mapped_column(Float, nullable=True)
    gas_crudo: Mapped[float] = mapped_column(Float, nullable=False)
    error_predicho: Mapped[float | None] = mapped_column(Float, nullable=True)
    gas_corregido: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Porcentaje de metano (gas_corregido en ppm / 10000), NULL si aun no
    # hay gas_corregido - ver app/core/umbrales.py.
    gas_corregido_porcentaje: Mapped[float | None] = mapped_column(Float, nullable=True)
    nivel_alerta: Mapped[NivelAlerta] = mapped_column(
        Enum(NivelAlerta, name="nivel_alerta", native_enum=True), nullable=False
    )
    estado_validacion: Mapped[EstadoValidacion] = mapped_column(
        Enum(EstadoValidacion, name="estado_validacion", native_enum=True), nullable=False
    )
    # default (lado Python/ORM, no solo server_default) para que las
    # ingestas automaticas existentes (ingesta-archivo/aleatoria/generador
    # continuo) no necesiten tocarse - ya no pasan 'origen' explicitamente.
    origen: Mapped[OrigenLectura] = mapped_column(
        Enum(OrigenLectura, name="origen_lectura", native_enum=True),
        nullable=False,
        default=OrigenLectura.SENSOR,
        # SQLAlchemy Enum guarda por defecto el NAME del miembro (SENSOR),
        # no su .value ("sensor") - el server_default debe usar el mismo
        # texto que el tipo nativo de Postgres realmente acepta (confirmado
        # contra nivel_alerta/estado_validacion, que ya se guardan por NAME
        # en mineguard_db: SELECT enumlabel FROM pg_enum -> 'OPTIMO', no
        # 'optimo'). Usar .value aqui rompe el CREATE TABLE/ALTER con
        # "invalid input value for enum origen_lectura: sensor".
        server_default=OrigenLectura.SENSOR.name,
    )

    punto_control: Mapped["PuntoControl"] = relationship(back_populates="telemetrias")
    modelo: Mapped["ModeloML | None"] = relationship(back_populates="telemetrias")
    alertas: Mapped[list["BitacoraAlertas"]] = relationship(
        back_populates="telemetria", lazy="selectin"
    )
