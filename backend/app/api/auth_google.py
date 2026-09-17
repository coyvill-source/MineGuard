import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from app.core.database import get_db
from app.core.oauth import oauth
from app.core.security import create_access_token, decode_access_token
from app.models.oauth_exchange_code import OAuthExchangeCode, TipoExchangeOAuth
from app.models.usuario import MetodoRegistro, RolUsuario, Usuario
from app.schemas.usuario import (
    CodigoExchange,
    CompletarRegistroGoogle,
    ExchangeRespuesta,
    TokenRespuesta,
)

router = APIRouter(tags=["auth"])

# URLs fijas de entorno local (igual que el link de forgot-password en
# auth.py) - GOOGLE_CALLBACK_URL debe coincidir exactamente con el redirect
# URI ya registrado en Google Cloud Console.
GOOGLE_CALLBACK_URL = "http://localhost:8000/api/auth/google/callback"
FRONTEND_DASHBOARD_URL = "http://localhost:5173/dashboard"
FRONTEND_COMPLETAR_REGISTRO_URL = "http://localhost:5173/completar-registro-google"

# Vida del codigo de intercambio de un solo uso: solo cubre el ida-y-vuelta
# navegador (redirect del callback -> carga de la pagina del frontend que
# llama a POST /api/auth/exchange), por eso es mucho mas corto que el
# `registro_token` (15 min) o el JWT de sesion normal (60 min).
EXCHANGE_CODE_EXPIRE_MINUTES = 5
REGISTRO_TOKEN_EXPIRE_MINUTES = 15
REGISTRO_TOKEN_TIPO = "registro_google_pendiente"

CODIGO_INVALIDO = HTTPException(
    status_code=status.HTTP_400_BAD_REQUEST,
    detail="El codigo de intercambio es invalido, ya se uso, o expiro",
)
REGISTRO_TOKEN_INVALIDO = HTTPException(
    status_code=status.HTTP_400_BAD_REQUEST,
    detail="El token de registro es invalido o expiro - inicia el login con Google de nuevo",
)


@router.get("/google/login")
async def google_login(request: Request):
    return await oauth.google.authorize_redirect(request, GOOGLE_CALLBACK_URL)


@router.get("/google/callback")
async def google_callback(request: Request, db: Annotated[AsyncSession, Depends(get_db)]):
    token = await oauth.google.authorize_access_token(request)
    userinfo = token.get("userinfo") or await oauth.google.parse_id_token(request, token)

    email = userinfo["email"]
    google_id = userinfo["sub"]
    nombre_google = userinfo.get("name", "")

    usuario = await db.scalar(select(Usuario).where(Usuario.email == email))
    codigo = secrets.token_urlsafe(32)
    expiracion = datetime.now(timezone.utc) + timedelta(minutes=EXCHANGE_CODE_EXPIRE_MINUTES)

    if usuario is not None:
        # Cuenta ya existente (registrada antes por correo/contrasena o por
        # un login de Google previo) - se vincula automaticamente, sin
        # pedirle nada al usuario. `metodo_registro` NO se toca: sigue
        # reflejando como se creo la cuenta originalmente, ver DECISION en
        # docs/PROJECT_CONTEXT.md.
        if usuario.google_id is None:
            usuario.google_id = google_id
        usuario.ultimo_acceso = datetime.now(timezone.utc)

        db.add(
            OAuthExchangeCode(
                codigo=codigo,
                tipo=TipoExchangeOAuth.LOGIN,
                usuario_id=usuario.id,
                fecha_expiracion=expiracion,
            )
        )
        await db.commit()
        return RedirectResponse(f"{FRONTEND_DASHBOARD_URL}?code={codigo}")

    # Usuario nuevo por Google: NO se crea el Usuario todavia (faltan
    # apellidos/telefono/tipo_documento/numero_documento, obligatorios en
    # el modelo). Se guardan los datos YA verificados por Google
    # (email/nombre/google_id) en el registro de intercambio, para que
    # POST /api/auth/exchange le entregue al frontend el `registro_token`
    # con el que completar el registro en POST /api/auth/google/completar-registro.
    db.add(
        OAuthExchangeCode(
            codigo=codigo,
            tipo=TipoExchangeOAuth.REGISTRO_PENDIENTE,
            email=email,
            nombre_google=nombre_google,
            google_id=google_id,
            fecha_expiracion=expiracion,
        )
    )
    await db.commit()
    return RedirectResponse(f"{FRONTEND_COMPLETAR_REGISTRO_URL}?code={codigo}")


@router.post("/exchange", response_model=ExchangeRespuesta)
async def exchange(
    datos: CodigoExchange, db: Annotated[AsyncSession, Depends(get_db)]
) -> ExchangeRespuesta:
    registro = await db.scalar(
        select(OAuthExchangeCode).where(OAuthExchangeCode.codigo == datos.codigo)
    )
    if registro is None or registro.usado:
        raise CODIGO_INVALIDO
    if registro.fecha_expiracion < datetime.now(timezone.utc):
        raise CODIGO_INVALIDO

    registro.usado = True
    await db.commit()

    if registro.tipo == TipoExchangeOAuth.LOGIN:
        # El JWT final se genera aqui (no en el callback) para que su
        # ventana de validez de 60 min empiece a contar desde el
        # intercambio real, no desde el momento del redirect.
        access_token = create_access_token(data={"sub": str(registro.usuario_id)})
        return ExchangeRespuesta(resultado="login", access_token=access_token, token_type="bearer")

    registro_token = create_access_token(
        data={"tipo": REGISTRO_TOKEN_TIPO, "email": registro.email, "google_id": registro.google_id},
        expires_delta=timedelta(minutes=REGISTRO_TOKEN_EXPIRE_MINUTES),
    )
    return ExchangeRespuesta(
        resultado="registro_pendiente",
        registro_token=registro_token,
        email=registro.email,
        nombre=registro.nombre_google,
    )


@router.post("/google/completar-registro", response_model=TokenRespuesta)
async def completar_registro_google(
    datos: CompletarRegistroGoogle, db: Annotated[AsyncSession, Depends(get_db)]
) -> TokenRespuesta:
    try:
        payload = decode_access_token(datos.registro_token)
    except ValueError:
        raise REGISTRO_TOKEN_INVALIDO

    if payload.get("tipo") != REGISTRO_TOKEN_TIPO:
        raise REGISTRO_TOKEN_INVALIDO

    email = payload.get("email")
    google_id = payload.get("google_id")
    if not email or not google_id:
        raise REGISTRO_TOKEN_INVALIDO

    existente = await db.scalar(select(Usuario).where(Usuario.email == email))
    if existente is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El email ya esta registrado")

    documento_existente = await db.scalar(
        select(Usuario).where(Usuario.numero_documento == datos.numero_documento)
    )
    if documento_existente is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="El numero de documento ya esta registrado"
        )

    usuario = Usuario(
        email=email,
        nombre=datos.nombre,
        apellidos=datos.apellidos,
        telefono=datos.telefono,
        tipo_documento=datos.tipo_documento,
        numero_documento=datos.numero_documento,
        # El rol nunca se acepta del cliente por seguridad: mismo criterio
        # que el registro por correo/contrasena en auth.py.
        rol=RolUsuario.TRABAJADOR,
        google_id=google_id,
        metodo_registro=MetodoRegistro.GOOGLE,
        ultimo_acceso=datetime.now(timezone.utc),
    )
    db.add(usuario)
    await db.commit()
    await db.refresh(usuario)

    access_token = create_access_token(data={"sub": str(usuario.id)})
    return TokenRespuesta(access_token=access_token)
