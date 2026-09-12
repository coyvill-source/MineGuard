from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.usuario import RolUsuario


class UsuarioRegistro(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    rol: RolUsuario = RolUsuario.TRABAJADOR


class UsuarioLogin(BaseModel):
    email: EmailStr
    password: str


class UsuarioRespuesta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
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
