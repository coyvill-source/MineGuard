from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.usuario import MetodoRegistro, RolUsuario, TipoDocumento


class UsuarioRegistro(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    nombre: str = Field(min_length=1)
    apellidos: str = Field(min_length=1)
    telefono: str = Field(min_length=1)
    tipo_documento: TipoDocumento
    numero_documento: str = Field(min_length=1)


class UsuarioLogin(BaseModel):
    email: EmailStr
    password: str


class UsuarioRespuesta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    nombre: str
    apellidos: str
    telefono: str
    tipo_documento: TipoDocumento
    numero_documento: str
    rol: RolUsuario


class TokenRespuesta(BaseModel):
    access_token: str
    token_type: str = "bearer"


class SolicitudRecuperacion(BaseModel):
    email: EmailStr


class RestablecerPassword(BaseModel):
    token: str
    nueva_password: str = Field(min_length=8)


class MensajeRespuesta(BaseModel):
    mensaje: str


class ActualizarRolUsuario(BaseModel):
    nuevo_rol: RolUsuario


class UsuarioAdminRespuesta(BaseModel):
    """Usado solo por GET /api/usuarios (listado para Gestion de Usuarios,
    rol admin) - deliberadamente NO incluye password_hash, google_id,
    telefono, tipo_documento ni numero_documento: la pantalla de admin solo
    necesita lo pedido explicitamente en la tarea (identificar al usuario,
    su rol, como se registro, cuando), no todo el perfil personal."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    nombre: str
    apellidos: str
    rol: RolUsuario
    metodo_registro: MetodoRegistro
    fecha_creacion: datetime
    ultimo_acceso: datetime | None


class CodigoExchange(BaseModel):
    codigo: str


class ExchangeRespuesta(BaseModel):
    resultado: Literal["login", "registro_pendiente"]
    # Caso "login" (usuario ya existia):
    access_token: str | None = None
    token_type: str | None = None
    # Caso "registro_pendiente" (usuario nuevo por Google, falta completar datos):
    registro_token: str | None = None
    email: EmailStr | None = None
    nombre: str | None = None


class CompletarRegistroGoogle(BaseModel):
    registro_token: str
    nombre: str = Field(min_length=1)
    apellidos: str = Field(min_length=1)
    telefono: str = Field(min_length=1)
    tipo_documento: TipoDocumento
    numero_documento: str = Field(min_length=1)
