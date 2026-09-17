from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TipoExchangeOAuth(str, enum.Enum):
    LOGIN = "login"
    REGISTRO_PENDIENTE = "registro_pendiente"


class OAuthExchangeCode(Base):
    """
    Codigo de un solo uso y corta vida que el callback de Google OAuth
    entrega al frontend por la URL en vez del JWT/datos reales - el
    frontend lo cambia de inmediato por el payload real via
    POST /api/auth/exchange (fuera de la URL, nunca queda en el
    historial del navegador). Mismo patron que PasswordResetToken.

    LOGIN: `usuario_id` ya existe, el intercambio regenera un JWT final.
    REGISTRO_PENDIENTE: no hay Usuario todavia - se guardan los datos
    verificados por Google (email/nombre/google_id) para que el
    intercambio emita el `registro_token` (JWT temporal de 15 min) que
    el frontend usa en POST /api/auth/google/completar-registro.
    """

    __tablename__ = "oauth_exchange_codes"

    id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    tipo: Mapped[TipoExchangeOAuth] = mapped_column(
        Enum(TipoExchangeOAuth, name="tipo_exchange_oauth", native_enum=True), nullable=False
    )
    usuario_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    nombre_google: Mapped[str | None] = mapped_column(String(150), nullable=True)
    google_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    fecha_expiracion: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    usado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
