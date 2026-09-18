"""
Fixtures compartidas de la suite de pruebas.

AISLAMIENTO DE BASE DE DATOS (requisito no negociable de la tarea): las
pruebas corren SIEMPRE contra una base de datos Postgres separada,
`mineguard_test_db`, en el MISMO servidor Postgres que ya levanta
`docker-compose.yml` (mismo contenedor, mismo puerto 5433) pero como una
base de datos DISTINTA de `mineguard_db` (la real/de desarrollo) - Postgres
aisla bases de datos como espacios completamente separados (no hay forma
de tocar una tabla de otra base por accidente sin un dblink/fdw explícito,
que este proyecto no usa). Se recrea desde cero (DROP + CREATE) al inicio
de cada corrida de la suite, así que siempre empieza vacía.

Se eligió esto en vez de un contenedor Postgres nuevo porque es más
liviano (no hay que declarar un segundo servicio en docker-compose.yml, un
puerto nuevo, ni gestionar su ciclo de vida por separado) y el propio
enunciado de la tarea lo ofrecía como alternativa válida ("un esquema/BD
temporal que se cree y destruya en cada corrida").

CRÍTICO: `os.environ["DATABASE_URL"]` se pisa ANTES de importar cualquier
módulo `app.*` (incluyendo este archivo, que pytest importa primero que
cualquier test). `app/core/config.py` computa `settings = get_settings()`
una sola vez, en el momento del import - si `app.core.config` ya se
hubiera importado antes con la URL real, pisar la variable de entorno
después ya no tendría efecto. Este archivo es el primer lugar de todo el
proceso de pruebas donde se importa código de `app`, así que es seguro.

Esto también es lo que hace que `test_generador_continuo.py` pueda
verificar la tarea de fondo real: esa tarea NO pasa por
`Depends(get_db)` (corre fuera de cualquier request), usa
`AsyncSessionLocal` importado directo de `app/core/database.py` - pero
como ESE módulo también se importa despues de pisar la variable de
entorno, su `engine`/`AsyncSessionLocal` ya quedan apuntando a
`mineguard_test_db` desde que se crean, sin necesitar
`app.dependency_overrides`.
"""

import asyncio
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import AsyncIterator

import asyncpg
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

POSTGRES_HOST = "127.0.0.1"
POSTGRES_PORT = "5433"
POSTGRES_USER = "mineguard"
POSTGRES_PASSWORD = "mineguard_dev_pw"
TEST_DB_NAME = "mineguard_test_db"

TEST_DATABASE_URL = (
    f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{TEST_DB_NAME}"
)

os.environ["DATABASE_URL"] = TEST_DATABASE_URL
# Las pruebas no ejercitan el flujo real de Google OAuth (requiere
# consentimiento humano en el navegador - fuera de alcance de esta suite,
# ver reporte de la tarea), pero `app.core.oauth` registra el cliente al
# importarse y `Settings` exige que estos campos existan; valores
# ficticios (nunca se usan de verdad) para que la app importe sin fallar.
os.environ.setdefault("SECRET_KEY", "clave-de-pruebas-nunca-produccion-0123456789")
os.environ.setdefault("GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com")
os.environ.setdefault("GOOGLE_CLIENT_SECRET", "test-client-secret")

# asyncpg no es compatible con el ProactorEventLoop que asyncio usa por
# defecto en Windows - mismo fix ya usado en alembic/env.py y en los
# scripts de seed.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from app.api import telemetria as telemetria_module  # noqa: E402
from app.core.database import Base, get_db  # noqa: E402
from app.core.security import create_access_token, hash_password  # noqa: E402
from app.main import app  # noqa: E402
from app.models.estacion import Estacion  # noqa: E402
from app.models.modelo_ml import ModeloML  # noqa: E402
from app.models.punto_control import PuntoControl  # noqa: E402
from app.models.usuario import MetodoRegistro, RolUsuario, TipoDocumento, Usuario  # noqa: E402


async def _recrear_base_de_datos_de_pruebas() -> None:
    conexion = await asyncpg.connect(
        host=POSTGRES_HOST, port=POSTGRES_PORT, user=POSTGRES_USER,
        password=POSTGRES_PASSWORD, database="postgres",
    )
    try:
        # WITH (FORCE) (Postgres 13+, el proyecto usa postgres:16) cierra
        # cualquier conexion colgada a la BD de pruebas antes de borrarla -
        # sin esto un DROP DATABASE falla si quedo una conexion abierta de
        # una corrida anterior interrumpida.
        await conexion.execute(f'DROP DATABASE IF EXISTS "{TEST_DB_NAME}" WITH (FORCE)')
        await conexion.execute(f'CREATE DATABASE "{TEST_DB_NAME}"')
    finally:
        await conexion.close()


def _preparar_bd_de_pruebas_sync() -> None:
    """Recrea la BD de pruebas y crea el esquema UNA sola vez por corrida,
    en su PROPIO asyncio.run() aislado - no en el event loop de
    pytest-asyncio. Es una fixture sincrona (no async) a proposito: si
    fuera una fixture async de scope "session", su engine/conexiones
    quedarian atados al primer event loop en el que se creo, pero
    pytest-asyncio en modo "auto" crea un event loop NUEVO por cada test
    (scope "function") - reusar ahi un engine de otro loop revienta con
    "InterfaceError"/"Task attached to a different loop" (exactamente lo
    que paso en el primer intento de correr esta suite, ver DECISION en
    docs/PROJECT_CONTEXT.md). Con esto, en cambio, el esquema ya existe en
    Postgres cuando el primer test arranca, y cada test crea su PROPIO
    engine fresco (ver `_motor_bd_pruebas` mas abajo) dentro de su propio
    event loop - nada async sobrevive entre tests."""

    async def _hacer() -> None:
        await _recrear_base_de_datos_de_pruebas()

        engine = create_async_engine(
            TEST_DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
        )
        async with engine.begin() as conn:
            # Crea el esquema desde los modelos ORM actuales (no via
            # alembic upgrade head): las pruebas verifican que el codigo y
            # los modelos de HOY funcionan juntos, no la cadena de
            # migraciones - un trade-off consciente, documentado en
            # docs/PROJECT_CONTEXT.md.
            await conn.run_sync(Base.metadata.create_all)
        await engine.dispose()

    asyncio.run(_hacer())


@pytest.fixture(scope="session", autouse=True)
def _bd_de_pruebas_lista() -> None:
    _preparar_bd_de_pruebas_sync()


@pytest_asyncio.fixture
async def _motor_bd_pruebas(_bd_de_pruebas_lista: None) -> AsyncIterator[AsyncEngine]:
    """Engine fresco POR PRUEBA (no de sesion) - creado dentro del event
    loop propio de cada test, para no compartir objetos asyncio entre
    loops distintos. Crear un engine es barato (no reabre el esquema, que
    ya existe gracias a `_bd_de_pruebas_lista`)."""
    engine = create_async_engine(TEST_DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1))
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(autouse=True)
async def _bd_limpia_entre_pruebas(_motor_bd_pruebas: AsyncEngine) -> AsyncIterator[None]:
    """Cada prueba arranca con la BD vacia: se trunca TODO al terminar
    (no antes) - asi, si una corrida se interrumpe a mitad de una prueba,
    la BD queda igual de limpia para la siguiente corrida real. RESTART
    IDENTITY para que los ids autoincrementales tambien vuelvan a 1."""
    yield

    tablas = ", ".join(f'"{tabla.name}"' for tabla in Base.metadata.sorted_tables)
    async with _motor_bd_pruebas.begin() as conn:
        await conn.execute(text(f"TRUNCATE TABLE {tablas} RESTART IDENTITY CASCADE"))

    # El cache en memoria del ModeloML activo (app/api/telemetria.py) es a
    # nivel de proceso, no se limpia solo con truncar la BD - sin esto, la
    # primera prueba que registre un ModeloML "contaminaria" a todas las
    # siguientes con un modelo/scaler que ya no corresponde a ninguna fila
    # real de la BD (recien truncada).
    telemetria_module._modelo_activo_cache.clear()


@pytest_asyncio.fixture
async def db_session(_motor_bd_pruebas: AsyncEngine) -> AsyncIterator[AsyncSession]:
    """Sesion de BD directa para que las pruebas siembren datos y verifiquen
    resultados sin pasar por la API (ej. leer un PasswordResetToken para
    completar el ciclo de reset, o contar filas de Telemetria)."""
    Sesion = async_sessionmaker(_motor_bd_pruebas, class_=AsyncSession, expire_on_commit=False)
    async with Sesion() as session:
        yield session


@pytest_asyncio.fixture
async def client(_motor_bd_pruebas: AsyncEngine) -> AsyncIterator[AsyncClient]:
    """Cliente HTTP async contra la app FastAPI en proceso (ASGITransport,
    sin necesitar un servidor uvicorn corriendo) - get_db() se sobreescribe
    para que CADA request de la prueba use la BD de pruebas."""
    Sesion = async_sessionmaker(_motor_bd_pruebas, class_=AsyncSession, expire_on_commit=False)

    async def _get_db_de_pruebas() -> AsyncIterator[AsyncSession]:
        async with Sesion() as session:
            yield session

    app.dependency_overrides[get_db] = _get_db_de_pruebas
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@dataclass
class UsuarioAutenticado:
    usuario: Usuario
    token: str

    @property
    def headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}"}


PASSWORD_PRUEBA = "ClaveDePrueba123"


async def _crear_usuario_autenticado(
    db_session: AsyncSession, *, email: str, rol: RolUsuario, numero_documento: str
) -> UsuarioAutenticado:
    usuario = Usuario(
        email=email,
        nombre="Nombre",
        apellidos="Apellidos",
        telefono="3000000000",
        tipo_documento=TipoDocumento.CC,
        numero_documento=numero_documento,
        rol=rol,
        password_hash=hash_password(PASSWORD_PRUEBA),
        metodo_registro=MetodoRegistro.PASSWORD,
    )
    db_session.add(usuario)
    await db_session.commit()
    await db_session.refresh(usuario)
    token = create_access_token(data={"sub": str(usuario.id)})
    return UsuarioAutenticado(usuario=usuario, token=token)


@pytest_asyncio.fixture
async def usuario_trabajador(db_session: AsyncSession) -> UsuarioAutenticado:
    return await _crear_usuario_autenticado(
        db_session, email="trabajador.test@example.com", rol=RolUsuario.TRABAJADOR,
        numero_documento="TEST-TRAB-0001",
    )


@pytest_asyncio.fixture
async def usuario_supervisor(db_session: AsyncSession) -> UsuarioAutenticado:
    return await _crear_usuario_autenticado(
        db_session, email="supervisor.test@example.com", rol=RolUsuario.SUPERVISOR,
        numero_documento="TEST-SUPER-0001",
    )


@pytest_asyncio.fixture
async def usuario_admin(db_session: AsyncSession) -> UsuarioAutenticado:
    return await _crear_usuario_autenticado(
        db_session, email="admin.test@example.com", rol=RolUsuario.ADMIN,
        numero_documento="TEST-ADMIN-0001",
    )


@dataclass
class EstacionYPunto:
    estacion: Estacion
    punto: PuntoControl


@pytest_asyncio.fixture
async def estacion_y_punto(db_session: AsyncSession) -> EstacionYPunto:
    estacion = Estacion(nombre="Estacion de prueba", activa=True)
    db_session.add(estacion)
    await db_session.flush()

    punto = PuntoControl(
        estacion_id=estacion.id,
        nombre_estacion=estacion.nombre,
        coord_x=1000.0,
        coord_y=1000.0,
        coord_z=2000.0,
        activo=True,
    )
    db_session.add(punto)
    await db_session.commit()
    await db_session.refresh(estacion)
    await db_session.refresh(punto)
    return EstacionYPunto(estacion=estacion, punto=punto)


@pytest_asyncio.fixture
async def modelo_ml_activo(db_session: AsyncSession) -> ModeloML:
    """Registra el ModeloML activo apuntando a los .joblib REALES del
    proyecto (no un mock) - mismas rutas que usa
    app/scripts/seed_modelo_ml.py, relativas a backend/."""
    modelo = ModeloML(
        archivo_modelo="app/ml_models/modelo_prediccion.joblib",
        archivo_scaler="app/ml_models/scaler_temporal.joblib",
        variables_entrada=["Temp", "Humed", "Bateria"],
        activo=True,
    )
    db_session.add(modelo)
    await db_session.commit()
    await db_session.refresh(modelo)

    telemetria_module._modelo_activo_cache.clear()

    return modelo


def ahora() -> datetime:
    return datetime.now(timezone.utc)
