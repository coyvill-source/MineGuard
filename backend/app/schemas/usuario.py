from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.usuario import RolUsuario, TipoDocumento


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
