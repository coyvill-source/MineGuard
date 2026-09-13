# MineGuard Web — Contexto del proyecto

> Este archivo es la referencia oficial del proyecto para Claude Code.
> Léelo antes de trabajar en cualquier módulo. Basado en el Manual
> Técnico WSN_Metano v1.3.

## Qué es
Plataforma web de monitoreo predictivo de gas metano en minas
subterráneas mediante una Red de Sensores Inalámbricos (WSN) y un
modelo de Machine Learning (Random Forest) que corrige el error de
lectura del sensor de gas.

## Stack (no cambiar sin autorización)
- Backend: Python + FastAPI (async) + SQLAlchemy 2.0 + Alembic
- ML: scikit-learn + joblib (modelo ya entrenado: RandomForestRegressor)
- Base de datos: PostgreSQL (asyncpg)
- Frontend: React + Vite + Tailwind CSS v4 (plugin @tailwindcss/vite,
  sin tailwind.config.js clásico, sin CLI init)
- Autenticación: Google OAuth 2.0 + JWT
- Empaquetado: Docker + docker-compose + Nginx

## Roles del sistema
- **Trabajador/Operario**: carga datos, ve dashboard/plano, CRUD de
  puntos de control propios, ve bitácora.
- **Supervisor HSE**: todo lo del Operario + gestionar alertas
  (mutear/escalar/resolver) + reportes históricos + aprobar cambios.
- **Administrador**: todo lo del Supervisor + gestión de usuarios/roles
  + actualizar modelo ML y scaler + configurar modo de ingesta +
  gestionar estaciones + parámetros globales (umbrales).

## Modelo de datos (entidades)
- **Estacion**: agrupa puntos de control de una misma mina.
- **Usuario**: email (Google), rol, y datos personales completos
  (nombre, apellidos, telefono, tipo_documento [CC/CE/PASAPORTE],
  numero_documento único) — obligatorios desde el registro.
- **PuntoControl**: pertenece a una Estacion, coordenadas cX, cY, cZ.
- **ModeloML**: registra qué archivo .joblib/scaler está activo.
- **Telemetria**: lectura completa (crudo, escalado, error predicho,
  gas corregido, nivel de alerta) + a qué punto de control y qué
  ModeloML generó la predicción.
- **BitacoraAlertas**: ciclo de vida de una alerta crítica.

## Regla de negocio central (ML)
1. Variables de entrada al modelo: **Temp, Humed, Bateria** (en ese
   orden). El Gas (Ch4) NO entra al modelo, se usa solo para la
   corrección final.
2. Antes de inferir, escalar las 3 variables con **StandardScaler**
   (mismos parámetros usados en el entrenamiento — pendiente que nos
   entreguen el scaler serializado, ver Pendientes).
3. El modelo predice el **error de lectura del gas**.
4. Corrección final: `Gas Corregido = Gas Crudo (Ch4) + Error Predicho`
   (DECISIÓN 2026-09-13: se suma, no se resta - el modelo ya predice
   el error con signo, positivo o negativo, así que sumar aplica la
   corrección correctamente en ambos sentidos).
5. El Gas Corregido se compara contra umbrales (verde/amarillo/rojo)
   — ver la decisión de umbrales en "Pendientes conocidos", deben
   quedar configurables, nunca hardcodeados como constantes fijas.

## Ingesta de datos (3 modos intercambiables)
1. **Archivo** (Excel/CSV): columnas Temp, Humed, Ch4, Bateria,
   hora_insertion.
2. **Aleatorio**: generador sintético con rangos configurables.
3. **Tiempo real** (futuro, aún no hay despliegue físico en mina).

Toda lectura, sin importar el modo, debe declarar a qué PuntoControl
pertenece.

## Pendientes conocidos (no resolver por tu cuenta, preguntar)
- DECISIÓN (2026-09-12): el StandardScaler no fue entregado por el
  equipo de datos. Se re-derivará internamente ajustando un
  StandardScaler sobre las columnas Temp, Humed, Bateria del archivo
  real backend/app/datos_prueba/Datos_despliegue.xlsx, como
  aproximación TEMPORAL. Debe quedar explícitamente marcado en el
  código (comentario y/o en el registro ModeloML) que este scaler es
  una aproximación derivada localmente, no el scaler original de
  entrenamiento del modelo - deberá reemplazarse si el equipo de datos
  entrega el scaler real más adelante.
- DECISIÓN (2026-09-12): umbrales del gas metano (% CH4), basados en
  el Reglamento de Seguridad Subterránea de Colombia (Decreto 1886):
  - Verde (Óptimo): 0.0% a 0.9% CH4 - operación normal.
  - Amarillo (Alerta): 1.0% a 1.4% CH4 - prohibido uso de explosivos,
    ajustar ventilación; debe notificar al Supervisor HSE.
  - Rojo (Crítico): >= 1.5% CH4 - riesgo de explosión; debe
    desenergizar equipos, evacuar personal, y generar registro
    indeleble en la bitácora de alertas.
  Estos valores son configurables en el sistema (no hardcodeados como
  constantes fijas en el código), pero estos son los valores por
  defecto de fábrica.
- BLOQUEANTE (2026-09-13): los umbrales del Decreto 1886 (verde
  0.0-0.9%, amarillo 1.0-1.4%, rojo >=1.5% de CH4) están en % de gas
  metano, pero los valores reales de gas_crudo en la base de datos
  (del archivo Datos_despliegue.xlsx) van de ~1923 a ~20475 - una
  escala totalmente distinta, sin conversión conocida a %. NO SE DEBE
  implementar el motor de umbrales/semáforo (clasificación de
  nivel_alerta según estos rangos) hasta que el equipo de datos/HSE
  confirme la unidad real del sensor y la fórmula de conversión a %
  CH4. El pipeline de ML (escalado, inferencia, corrección matemática
  del gas) ya está implementado y no depende de este bloqueo, pero
  nivel_alerta se mantiene como placeholder ('optimo') hasta resolver
  esto.
- MEJORA PENDIENTE (no bloqueante): el pipeline ML en
  POST /api/telemetria/ingesta-archivo ejecuta el escalado
  (scaler.transform) y la inferencia (model.predict) fila por fila, en
  vez de en lote (batch) sobre todo el DataFrame. Esto generó cientos
  de warnings repetidos de scikit-learn en la ingesta de 1713 filas y
  es ineficiente en archivos grandes. Se debe optimizar para procesar
  las variables de entrada en un solo batch (scaler.transform(df) y
  model.predict(...) sobre el arreglo completo) en una futura tarea de
  refactor, sin cambiar el resultado ni el contrato del endpoint.
- Por ahora solo existe una Estación (Chicamocha, 7 puntos de control
  (0-6), confirmado con datos reales del archivo coordenadas.xlsx),
  pero el modelo de datos debe soportar más de una a futuro.
- DECISIÓN: periodicidad de persistencia del histórico = cada lectura
  se persiste inmediatamente al llegar (no hay muestreo agregado). Así
  quedó implementado desde el endpoint de ingesta-archivo.
- DECISIÓN: esquema de protección por rol = Trabajador (solo
  lectura/carga de sus propios recursos), Supervisor HSE (todo lo del
  Trabajador + gestionar alertas + aprobar cambios), Administrador
  (todo lo del Supervisor + gestión de usuarios/roles + modelo ML +
  configuración global) - tal como ya está descrito en la sección
  "Roles del sistema". Esta jerarquía se aplicará endpoint por
  endpoint cuando se implemente la fase de protección de rutas.
- DECISIÓN (2026-09-12): el registro público (`POST /api/auth/register`)
  siempre crea usuarios con rol='trabajador' fijo en el backend; el
  cliente ya no puede enviar ni influir en el rol (el campo `rol` se
  eliminó del schema `UsuarioRegistro`). Cambiar el rol de un usuario
  después de creado requerirá un endpoint de administración propio,
  protegido por rol, que se construirá en la fase de protección de
  rutas — no existe todavía ninguna forma de crear un Supervisor o
  Administrador vía API.
- DECISIÓN (2026-09-13): mecanismo reutilizable de protección de rutas
  por rol implementado en `backend/app/core/permissions.py`, dependencia
  `requiere_rol(rol_minimo)`. Compara la jerarquía numérica de
  `JERARQUIA_ROLES` (trabajador=0 < supervisor=1 < admin=2) definida en
  ese mismo archivo contra el rol del usuario autenticado (obtenido vía
  `get_current_user`, que sigue viviendo en `app/api/auth.py`); si no
  alcanza el mínimo, responde 403 con detalle claro. Uso en un endpoint
  nuevo:
  ```python
  from app.core.permissions import requiere_rol
  from app.models.usuario import RolUsuario

  @router.patch("/ruta")
  async def handler(
      ...,
      _actor: Annotated[Usuario, Depends(requiere_rol(RolUsuario.SUPERVISOR))],
  ):
      ...
  ```
  Todo endpoint protegido futuro debe reutilizar esta dependencia, no
  reimplementar la validación de rol. Primer endpoint que la usa:
  `PATCH /api/usuarios/{id}/rol` (requiere admin), en el nuevo router
  `backend/app/api/usuarios.py` (prefijo `/api/usuarios`, registrado en
  `main.py`).

## Convenciones de desarrollo
- Todo se construye módulo por módulo, no todo de una vez.
- Paleta de marca: azul institucional oscuro #1F3864, azul acento
  #2E75B6.
- Backend no debe implementar autenticación/negocio hasta que se pida
  explícitamente esa fase.
- Nunca reemplazar Tailwind v4 por v3 ni volver a tailwind.config.js.

## Actualización — Autenticación (v1.4)
El sistema debe soportar DOS métodos de inicio de sesión (no solo
Google OAuth como decía el manual v1.3):
1. **Google OAuth 2.0** (SSO).
2. **Correo y contraseña** (registro/login tradicional), con hash
   seguro de contraseña (ej. bcrypt/argon2).

En ambos casos, el usuario debe existir en la tabla Usuario con un rol
asignado para poder acceder (igual que en el flujo original de SSO).
El JWT emitido es el mismo sin importar el método de login usado.

## Actualizacion - Dato confirmado (coordenadas.xlsx real)
El archivo coordenadas.xlsx entregado tiene 7 puntos de control (CONTROL 0 a 6), no 8 como se asumio inicialmente en el manual v1.3. El seed de la Estacion Chicamocha se creo con estos 7 puntos reales. Pendiente confirmar con el equipo de mineria si falta un punto fisico o si el manual estaba desactualizado.

## Regla de flujo de trabajo (git)
Cada vez que Claude Code termine una tarea y el usuario confirme que
funciona probándola, se hace commit INMEDIATAMENTE en la rama activa,
antes de pedir el siguiente ajuste o cambiar de rama. Nunca dejar
cambios sin commitear mientras se avanza a la siguiente fase.

## Regla de edición de este archivo (PROJECT_CONTEXT.md)
Este archivo se edita SIEMPRE usando la herramienta de edición de
Claude Code, nunca con comandos bash tipo "cat >>" o heredocs pegados
directamente en la terminal de Git Bash del usuario - eso ha causado
duplicaciones y corrupción de contenido en el pasado.

## Estado de ramas y pendientes (actualizado 2026-09-13)
- Rama activa de desarrollo: `feature/crud-puntos-control`, creada
  desde `develop`. Desde la nota anterior (2026-09-12), `develop` ya
  tiene fusionado: el seed de Chicamocha y el endpoint de ingesta por
  archivo, el registro completo con datos personales (rol trabajador
  fijo), la protección de rutas por rol, el pipeline de ML (scaler +
  inferencia) y el generador de datos aleatorio bajo demanda — el
  detalle de cada uno vive en su propia entrada "DECISIÓN" a lo largo
  de este archivo, no se repite aquí.
- `feature/frontend-login` quedó congelada en el commit del login por
  correo/contraseña (b15c372); el trabajo posterior (forgot-password,
  frontend completo de login/registro/dashboard) se hizo directo sobre
  `develop`. Decisión explícita ya tomada: se deja tal cual, como
  referencia histórica de esa etapa — no se renombra ni se borra.
- CORRECCIÓN (2026-09-13): la nota anterior sobre
  `backend/app/ml_models/modelo_prediccion.joblib` estaba desactualizada
  — ese archivo ya fue commiteado en `b32bd2f` (rama `develop`), no
  sigue sin commitear.
- DECISIÓN (2026-09-13): pipeline de ML implementado y activo para
  ingestas nuevas vía `POST /api/telemetria/ingesta-archivo`. El
  `ModeloML` activo se identifica como **id=1** (creado por
  `backend/app/scripts/seed_modelo_ml.py`, idempotente): usa
  `app/ml_models/modelo_prediccion.joblib` (el RandomForest ya
  entrenado, requiere `scikit-learn==1.9.0` exacto para deserializar
  sin warnings de incompatibilidad de versión) y
  `app/ml_models/scaler_temporal.joblib` (StandardScaler ajustado
  localmente sobre `Datos_despliegue.xlsx`, columnas Temp/Humed/Bateria
  en ese orden — sigue siendo la aproximación TEMPORAL ya documentada
  arriba, no el scaler original de entrenamiento). El endpoint
  cachea modelo y scaler en memoria del proceso (`_modelo_activo_cache`
  en `app/api/telemetria.py`) tras la primera carga; si no hay ningún
  `ModeloML` activo en la BD, responde 503 con instrucciones de correr
  el seed. `nivel_alerta` sigue como placeholder `'optimo'` en todas
  las filas nuevas — el motor de umbrales/semáforo NO se implementó en
  esta tarea (alcance explícitamente excluido).
  **Los 1713 registros históricos de telemetría NO fueron
  reprocesados**: permanecen con `error_predicho`/`gas_corregido`/
  `modelo_id` en `NULL`, tal como quedaron de la ingesta original.
  scikit-learn y joblib se agregaron a `backend/requirements.txt`
  (no estaban antes, aunque el .joblib del modelo sí existía en el
  repo).
- DECISIÓN (2026-09-13): segundo modo de ingesta implementado —
  `POST /api/telemetria/ingesta-aleatoria` (generador sintético bajo
  demanda, no continuo; el modo continuo/tiempo real sigue siendo fase
  aparte). Body: `{"punto_control_id": int, "cantidad": int}`, con
  `cantidad` validado por Pydantic (`gt=0, le=5000`) para evitar abuso.
  Reutiliza el mismo pipeline ML de `ingesta-archivo` a través de la
  función compartida `_predecir_correccion` en `app/api/telemetria.py`
  (mismo `_obtener_modelo_activo` cacheado, mismo escalado + inferencia
  + corrección `gas_corregido = gas_crudo + error_predicho`) — no hay
  lógica ML duplicada entre los dos endpoints.
  Rangos de generación sintética (verificados con pandas contra
  `Datos_despliegue.xlsx`, no eran datos ya documentados antes de esta
  tarea): Temp 0.29-35.02, Humed 0.4-58.95, Bateria 0.17-99.73,
  gas_crudo (Ch4) 1923-20475. Distribución **uniforme** (no normal):
  no se entregó media/desviación estándar real, y uniforme es más
  simple sin asumir una forma de distribución no confirmada.
  Timestamps: secuenciales crecientes desde el momento de la petición,
  con espaciado aleatorio uniforme entre 10 y 16 segundos por lectura
  (en los datos reales la moda y la mediana del intervalo entre
  lecturas consecutivas son ambas 12s). `nivel_alerta` se mantiene como
  placeholder `'optimo'`, igual que en `ingesta-archivo` — sigue
  bloqueado por la falta de conversión de unidades del gas (ver arriba).
- DECISIÓN (2026-09-13): CRUD completo de puntos de control con flujo
  de aprobación, implementado en `backend/app/api/puntos_control.py`
  (prefijo `/api/puntos-control`) + modelo nuevo
  `SolicitudCambioPuntoControl` en
  `backend/app/models/solicitud_cambio_punto_control.py` (tabla
  `solicitudes_cambio_punto_control`, migración `5c10ed6fdbf2`
  **generada pero NO aplicada** — pendiente de tu revisión).
  - Trabajador: `GET /api/puntos-control` y `GET /api/puntos-control/{id}`
    (lectura), y `POST /api/puntos-control/solicitudes` (propone
    crear/editar/eliminar, queda en estado `pendiente`, sin aplicarse).
  - Supervisor+: además, CRUD directo (`POST`/`PATCH`/`DELETE` sobre
    `/api/puntos-control/{id}` — `DELETE` es soft-delete, marca
    `activo=false`, reutilizando el campo `activo` que ya existía en
    `PuntoControl`) y gestión de solicitudes: `GET
    /api/puntos-control/solicitudes` (filtrable por `?estado=`),
    `PATCH .../solicitudes/{id}/aprobar` (aplica el cambio real y
    marca `aprobada`) y `.../rechazar` (NO aplica nada, guarda
    `comentario_revision`, marca `rechazada`). Aprobar/rechazar una
    solicitud que ya fue revisada responde 409, no la vuelve a
    procesar.
  - Todos los endpoints protegidos reutilizan `requiere_rol` de
    `app/core/permissions.py` (sin reimplementar validación de rol).
  - Rutas `/solicitudes...` declaradas ANTES de `/{punto_control_id}`
    en el router — si no, Starlette intentaría convertir `"solicitudes"`
    a `int` como si fuera el path param `{punto_control_id}` y
    fallaría con 422 en vez de llegar al handler correcto.
  - Sobre el "bug conocido de Alembic con enums en Postgres": el
    autogenerate de esta migración usa `op.create_table(...)` con los
    2 enums nuevos (`tipo_solicitud_cambio`, `estado_solicitud_cambio`)
    inline — el mismo patrón exacto de la migración inicial
    (`7ebd0107e308`, que ya funciona en producción). El fix explícito
    (`create_type=False` + `.create()` manual antes del `add_column`,
    visto en `9dd2b7ffdaeb`) solo aplica cuando se agrega un enum vía
    `op.add_column` sobre una tabla YA EXISTENTE — no es el caso aquí
    (tabla nueva), así que NO se modificó el autogenerate.
  - Verificación real: no se aplicó la migración a `mineguard_db` (la
    que vas a revisar). En su lugar se probó el flujo completo end-to-
    end (CRUD directo, proponer/aprobar/rechazar, soft-delete, 403/409)
    contra una base de datos Postgres aislada y temporal
    (`mineguard_test_puntos`, mismo contenedor Docker), que se
    eliminó al terminar — `mineguard_db` no fue tocada.
- DECISIÓN (2026-09-13): gestión de la bitácora de alertas +
  **creación manual** de alertas, en `backend/app/api/alertas.py`
  (prefijo `/api/alertas`, schemas en `backend/app/schemas/alerta.py`).
  No requirió modelo ni migración nuevos — reutiliza `BitacoraAlertas`
  y `EstadoAlerta` que ya existían.
  - `POST /api/alertas` (rol mínimo trabajador): crea una alerta
    manual sobre una `telemetria_id` existente (404 si no existe),
    estado inicial `ACTIVA`. Es **manual a propósito**: hoy no existe
    ningún mecanismo automático que genere alertas, porque el motor de
    umbrales/semáforo sigue BLOQUEADO por falta de conversión de
    unidades del gas (ver más arriba) — así HSE puede reportar una
    condición sin depender de ese motor, y también sirve para pruebas.
  - `GET /api/alertas` (filtrable por `?estado=`) y
    `GET /api/alertas/{id}` — rol mínimo trabajador (solo lectura).
  - `PATCH /api/alertas/{id}/mutear|escalar|resolver` — Supervisor+.
    `resolver` exige `observacion_hse` en el body (obligatorio dejar
    constancia); `mutear`/`escalar` lo aceptan opcional. Los tres
    responden 409 si la alerta ya está `RESUELTA` (no se puede
    mutear/escalar/resolver algo ya cerrado). `escalar` reactiva a
    `ACTIVA` si estaba `MUTEADA`, o deja constancia si ya estaba
    `ACTIVA`.
  - NOTA: la tarea original decía "la relación es 1 a 1 [telemetria-
    alerta] según el modelo de datos ya definido" — no es exacto: el
    modelo (`BitacoraAlertas.telemetria_id`) no tiene constraint
    `UNIQUE` a nivel de BD, y `Telemetria.alertas` es una relación
    `list` (uno a muchos), no uno a uno. `POST /api/alertas` sí impone
    "una alerta por telemetría" pero **solo a nivel de aplicación**
    (chequeo antes del insert, no constraint de BD) — bajo
    concurrencia real existe una ventana de carrera teórica para
    duplicados; no se agregó constraint `UNIQUE` porque no fue pedido
    explícitamente y cambiaría el modelo de datos ya definido.
- DECISIÓN (2026-09-13): `GET /api/puntos-control/estado-actual`
  (rol mínimo trabajador) — base de datos para el dashboard del
  frontend (tarea aparte, todavía no construida). Devuelve todos los
  puntos de control **activos** (`activo=true`), cada uno con sus
  datos y su `ultima_lectura` (la telemetría más reciente por
  `timestamp`), o `ultima_lectura: null` si el punto nunca recibió
  datos. Query única (no N+1 por punto): `DISTINCT ON (punto_id)`
  de Postgres ordenado por `timestamp DESC`, unida con `LEFT JOIN`
  contra `puntos_control` — ver `obtener_estado_actual` en
  `app/api/puntos_control.py`. Declarada antes de
  `/{punto_control_id}` en el router por la misma razón que
  `/solicitudes`: si no, Starlette intentaría convertir
  `"estado-actual"` a `int` como path param.
  **`nivel_alerta` sigue siendo el placeholder `'optimo'` en el 100%
  de las lecturas que devuelva este endpoint** — el motor de
  umbrales/semáforo sigue BLOQUEADO (ver arriba); esto NO significa
  que la mina esté verificada como segura, es solo el valor por
  defecto sin lógica real detrás todavía.
