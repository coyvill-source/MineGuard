from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.bitacora_alertas import BitacoraAlertas


class RolUsuario(str, enum.Enum):
    TRABAJADOR = "trabajador"
    SUPERVISOR = "supervisor"
    ADMIN = "admin"


class MetodoRegistro(str, enum.Enum):
    GOOGLE = "google"
    PASSWORD = "password"


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    rol: Mapped[RolUsuario] = mapped_column(
        Enum(RolUsuario, name="rol_usuario", native_enum=True), nullable=False
    )
    ultimo_acceso: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    google_id: Mapped[str | None] = mapped_column(String(255), unique=True, index=True, nullable=True)
    metodo_registro: Mapped[MetodoRegistro] = mapped_column(
        Enum(MetodoRegistro, name="metodo_registro", native_enum=True), nullable=False
    )
    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    alertas_resueltas: Mapped[list["BitacoraAlertas"]] = relationship(
        back_populates="usuario_resolutor", lazy="selectin"
    )
