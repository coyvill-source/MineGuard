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
- DECISIÓN (2026-09-12, rangos numéricos corregidos el 2026-09-15 —
  ver esa entrada más abajo para la implementación real del motor de
  umbrales): umbrales del gas metano (% CH4), basados en el
  Reglamento de Seguridad Subterránea de Colombia (Decreto 1886):
  - Verde (Óptimo): porcentaje <= 0.9% CH4 - operación normal.
  - Amarillo (Alerta): 0.9% < porcentaje < 1.5% CH4 - prohibido uso
    de explosivos, ajustar ventilación; debe notificar al Supervisor
    HSE.
  - Rojo (Crítico): porcentaje >= 1.5% CH4 - riesgo de explosión;
    debe desenergizar equipos, evacuar personal, y generar registro
    indeleble en la bitácora de alertas.
  Límites continuos, sin huecos entre rangos (la versión original de
  esta nota tenía un hueco sin definir entre 0.9-1.0% y 1.4-1.5%,
  ya corregido). Estos valores son configurables en el sistema (no
  hardcodeados como constantes fijas en el código), pero estos son
  los valores por defecto de fábrica.
- DECISIÓN (2026-09-15, RESUELVE el bloqueo anterior de 2026-09-13):
  el equipo de datos/HSE confirmó la unidad y fórmula de conversión —
  el sensor reporta el gas en **ppm**, y `% CH4 = ppm / 10000`
  (1% = 10 000 ppm). La conversión se aplica sobre `gas_corregido`
  (ya corregido por el modelo ML), no sobre `gas_crudo` directo.
  Rangos exactos (Decreto 1886, límites cerrados/continuos, sin huecos
  como en la nota de fábrica de 2026-09-12 más arriba — ver aclaración
  al final de esta entrada): `ÓPTIMO` si `porcentaje <= 0.9`;
  `ALERTA` si `0.9 < porcentaje < 1.5`; `CRÍTICO` si `porcentaje >= 1.5`.
  - Motor de umbrales implementado en `backend/app/core/umbrales.py`:
    `ppm_a_porcentaje()`, `clasificar_nivel_alerta()`, y las
    constantes `LIMITE_OPTIMO_PORCENTAJE=0.9` /
    `LIMITE_CRITICO_PORCENTAJE=1.5` — siguen siendo **fijas en
    código** por ahora; el módulo deja documentado como PENDIENTE
    (no construido todavía) que deberían volverse configurables desde
    el panel de administrador en una futura tarea.
  - Nueva columna `gas_corregido_porcentaje` (Float, nullable) en
    `Telemetria` — coexiste con `gas_corregido` (ppm), no lo
    reemplaza. Migración `1f707bee2405` generada (autogenerate,
    **sin aplicar aún — pendiente de tu revisión**, ver
    `alembic/versions/1f707bee2405_agregar_gas_corregido_porcentaje_a_.py`).
    Columna `Float` simple, no `Enum`, así que el bug conocido de
    Alembic+Enum no aplica aquí tampoco.
  - `_predecir_correccion` (pipeline ML compartido en
    `app/api/telemetria.py`, usado por `ingesta-archivo` e
    `ingesta-aleatoria`) ahora calcula y devuelve también
    `gas_corregido_porcentaje` y el `nivel_alerta` REAL — se eliminó
    el placeholder `NivelAlerta.OPTIMO` de ambos endpoints.
  - Aplicación retroactiva: `backend/app/scripts/reclasificar_telemetria_historica.py`
    (idempotente, **sin ejecutar aún — pendiente de tu confirmación**)
    recalcula `gas_corregido_porcentaje` y `nivel_alerta` para TODOS
    los registros de `Telemetria` con `gas_corregido` no nulo; los
    históricos con `gas_corregido` NULL (nunca reprocesados por el
    pipeline ML) quedan intactos, no hay nada que calcular para ellos.
  - ACLARACIÓN sobre la nota de fábrica de 2026-09-12 (más arriba en
    este archivo, "Verde 0.0-0.9% / Amarillo 1.0-1.4% / Rojo >=1.5%"):
    tenía huecos entre 0.9-1.0 y 1.4-1.5 sin definir; esta DECISIÓN
    los cierra con límites continuos y es la que gobierna la
    implementación real. No edité esa nota de 2026-09-12 para no
    tocar algo fuera de lo que pediste explícitamente en esta tarea —
    señalado aquí para que la corrijas o confirmes si quieres que la
    actualice en una futura tarea.
  - Frontend: el banner del Dashboard ("pendiente de calibración")
    sigue sin actualizar — es una tarea aparte, explícitamente fuera
    de alcance de esta.
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
- DECISIÓN (2026-09-13): Dashboard real del frontend implementado,
  reemplazando el placeholder de `frontend/src/pages/Dashboard.jsx`.
  Consume `GET /api/puntos-control/estado-actual` (función
  `obtenerEstadoActualPuntosControl` en `src/lib/api.js`) a través del
  hook `useEstadoActual` (`src/hooks/useEstadoActual.js`), que
  refresca cada 20s automáticamente sin parpadear el estado de carga
  en cada poll (solo lo muestra en la carga inicial); si un poll en
  background falla, mantiene los últimos datos visibles y muestra un
  aviso pequeño en vez de vaciar la pantalla.
  - Plano 2D en `src/components/dashboard/PlanoPuntosControl.jsx`:
    SVG con `viewBox` calculado dinámicamente a partir del rango real
    de `coord_x`/`coord_y` de los puntos (con padding), esquemático
    (sin imagen de fondo, sin invertir el eje Y). Marcador por
    `nivel_alerta` de `ultima_lectura` (verde/amarillo/rojo) o gris
    (`slate`, no es color de marca) si `ultima_lectura` es `null`.
    Tooltip con hover Y click/tap (para tablets sin hover) + soporte
    de teclado (focus/Enter/Espacio) mostrando nombre, coordenadas, y
    si hay lectura: temperatura, humedad, batería, gas crudo, gas
    corregido y timestamp — o "Sin datos registrados" si no la hay.
  - Banner informativo (NO en colores de alerta, para no confundirse
    con el semáforo) explicando que la clasificación de niveles está
    pendiente de calibración y que 'óptimo' es un placeholder.
  - Colores de marca (`mg-navy-900` en el header, `mg-accent-*` en
    acentos) ya definidos en `src/index.css`; el semáforo reutiliza
    `mg-safe-500`/`mg-alert-500`/`mg-danger-500` que YA existían ahí
    desde antes de esta tarea (no fue necesario agregar tokens nuevos).
  - Responsivo vía `aspect-[4/3] xl:aspect-[16/9]` (Tailwind v4) para
    verse bien tanto en tablets como en pantallas panorámicas.
  - Fuera de alcance (confirmado, próxima fase aparte): gestión de
    alertas desde el dashboard y CRUD de puntos de control desde el
    frontend.
- DECISIÓN (2026-09-13): menú lateral del Dashboard + corrección de
  navegación del logo.
  - Logo: en `src/components/Header.jsx` (landing) el logo ahora usa
    `useAuth()` para navegar a `/dashboard` si hay sesión activa o a
    `/` si no. En el header del Dashboard (`CabeceraDashboard`, dentro
    de `src/pages/Dashboard.jsx`) el logo va fijo a `/dashboard` sin
    volver a leer `AuthContext` — ese componente solo se renderiza ya
    autenticado (`Dashboard` corta antes con la pantalla de "Sesión no
    iniciada" si no hay token), así que la lógica condicional ahí
    sería código muerto.
  - Menú lateral en `src/components/dashboard/MenuLateral.jsx`:
    "Plano" (activo, único item real hoy, resaltado con `NavLink`) +
    "Puntos de Control" y "Alertas" deshabilitados ("Próximamente",
    `<button disabled>` para que sea imposible navegar a una ruta
    rota — no son `<Link>`). Si `rol` es `supervisor` o `admin` se
    agrega "Aprobaciones" (deshabilitado); solo si `rol` es `admin` se
    agrega además "Gestión de Usuarios" (deshabilitado). El rol viene
    del mismo `me(token)` que ya usaba `Dashboard.jsx` para mostrar
    nombre/rol en la cabecera.
  - Responsivo: `lg` (1024px) es el corte — pantallas panorámicas
    (`lg:` y superior) ven el sidebar fijo a la izquierda siempre
    visible; tablets y angosto (`<lg`) usan un botón hamburguesa en la
    cabecera del Dashboard que abre un drawer con overlay (cierra con
    click afuera, botón X, o tecla Escape; bloquea el scroll del body
    mientras está abierto).
  - Layout de `Dashboard.jsx` ajustado a `flex` (sidebar + `<main>`),
    con el contenido interno limitado a `max-w-[1600px]` centrado
    dentro del espacio disponible — el header ya no está centrado con
    `max-w-7xl`, ahora ocupa todo el ancho (borde a borde), consistente
    con el patrón típico de cabeceras de dashboard (distinto del header
    de la landing, que sí se mantiene centrado).
- DECISIÓN (2026-09-13): pantalla completa de Puntos de Control en el
  frontend (`frontend/src/pages/PuntosControl.jsx`, ruta
  `/puntos-control`), y refactor de layout para soportarla sin duplicar
  código.
  - REFACTOR: `CabeceraDashboard` (antes función local dentro de
    `Dashboard.jsx`) se extrajo a
    `src/components/dashboard/CabeceraDashboard.jsx`, y se creó
    `src/components/dashboard/DashboardLayout.jsx` que centraliza el
    gate de sesión (pantalla "Sesión no iniciada" si no hay token),
    la carga de `usuario` vía `me(token)`, y el armado de
    header + `MenuLateral` + `<main>`. `Dashboard.jsx` ahora es solo
    `<DashboardLayout titulo="...">{contenido del plano}</DashboardLayout>`,
    igual de simple que antes pero sin duplicar el layout.
    `DashboardLayout` acepta `children` como nodo normal o como función
    `(usuario) => nodo` para páginas que necesitan el rol (como esta).
  - `MenuLateral`: el ítem "Puntos de Control" pasó de deshabilitado a
    habilitado, apunta a `/puntos-control`.
  - Nuevo `src/components/Modal.jsx` genérico (backdrop, Escape,
    bloqueo de scroll del body — mismo patrón ya usado en el drawer de
    `MenuLateral`): se monta/desmonta condicionalmente desde quien lo
    usa (nunca con un prop `abierto`), así el formulario que envuelve
    arranca limpio en cada apertura sin necesitar sincronizar estado
    con un efecto.
  - Qué puede hacer cada rol en `/puntos-control` (backend ya existía,
    ver la entrada de "CRUD de puntos de control con flujo de
    aprobación" más arriba):
    - **Todos los roles**: ven la tabla de puntos de control (vía
      `GET /api/puntos-control`, que devuelve activos e inactivos —
      la tabla muestra una columna "Estado").
    - **Trabajador**: además, botón "Proponer cambio" que abre un
      modal (`ModalProponerCambio`) para proponer Crear/Editar/Eliminar
      (`POST /api/puntos-control/solicitudes`). La validación del
      formulario replica exactamente la del backend
      (`SolicitudCambioCrear`): Crear exige estación+nombre+3
      coordenadas; Editar exige seleccionar un punto existente y
      llenar al menos un campo (los campos vacíos se omiten del
      payload — "sin cambio", no se sobreescriben con null); Eliminar
      solo exige seleccionar el punto. Tras enviar, muestra el mensaje
      de éxito "quedó pendiente de aprobación" (no se aplica de
      inmediato).
    - **Supervisor y Administrador**: además, CRUD directo (botón
      "Crear punto", y "Editar"/"Eliminar" por fila —
      `POST`/`PATCH`/`DELETE /api/puntos-control`, sin pasar por
      solicitud; "Eliminar" pide confirmación inline en la misma fila,
      sin modal aparte) vía `ModalPuntoDirecto`, y la sección
      "Solicitudes pendientes" (`GET
      /api/puntos-control/solicitudes?estado=pendiente`) con botones
      Aprobar (`PATCH .../aprobar`) y Rechazar (`PATCH .../rechazar`,
      pide comentario obligatorio antes de habilitar el botón de
      confirmar). Aprobar o rechazar refresca tanto la tabla de puntos
      como la lista de solicitudes.
  - Nuevas funciones en `src/lib/api.js`: `listarPuntosControl`,
    `crearPuntoControl`, `actualizarPuntoControl`,
    `eliminarPuntoControl`, `proponerCambioPuntoControl`,
    `listarSolicitudesCambio`, `aprobarSolicitudCambio`,
    `rechazarSolicitudCambio` — mismo patrón que las funciones ya
    existentes (helper `request` centralizado, header `Authorization`
    manual en cada llamada).
  - Nuevos hooks `src/hooks/usePuntosControl.js` y
    `src/hooks/useSolicitudesPendientes.js` (fetch + `recargar()`,
    sin polling — a diferencia de `useEstadoActual`, aquí se refresca
    explícitamente después de cada acción, no cada N segundos).
  - No existe endpoint para listar Estaciones (fuera de alcance, no se
    pidió); el selector de "Estación" en los formularios deriva las
    opciones de los `estacion_id` ya presentes en la lista de puntos
    cargada — funciona porque hoy solo existe una Estación
    (Chicamocha), pero seguirá funcionando si se agregan más sin
    necesitar un endpoint nuevo, siempre que ya tengan al menos un
    punto de control creado.
- DECISIÓN (2026-09-13): pantalla completa de Alertas en el frontend
  (`frontend/src/pages/Alertas.jsx`, ruta `/alertas`), reutilizando
  `DashboardLayout` (sin duplicar layout) y el componente `Modal.jsx`
  ya existente. `MenuLateral`: el ítem "Alertas" pasó de deshabilitado
  a habilitado, apunta a `/alertas`.
  - **Todos los roles**: ven la tabla de alertas
    (`GET /api/alertas`, filtrable por `?estado=` con un `<select>`
    simple: Activa/Muteada/Resuelta/Todas), y el botón "Reportar
    alerta" (`ModalReportarAlerta`, `POST /api/alertas`).
  - LIMITACIÓN CONOCIDA (a mejorar después, no resuelta en esta tarea):
    no existe ningún endpoint para listar/buscar telemetrías de forma
    amigable, así que el campo `telemetria_id` en "Reportar alerta" es
    un simple input numérico (el usuario debe conocer el ID de
    memoria) — no un selector. Queda advertido explícitamente en el
    propio modal para el usuario final, y aquí para futuras tareas.
  - Los errores 404 (telemetría no existe) y 409 (alerta duplicada)
    del backend se muestran tal cual llegan (`err.message`, ya viene
    del campo `detail` del backend vía el `ApiError` existente en
    `api.js`) — no se reinterpretan ni se reemplazan por un mensaje
    genérico.
  - **Supervisor y Administrador**: además, por cada alerta que NO
    esté `resuelta`, botones inline "Mutear"/"Escalar"/"Resolver"
    (mismo patrón inline-en-la-fila que "Rechazar" en
    `SeccionSolicitudesPendientes`, no un modal aparte): Mutear y
    Escalar llevan un campo de observación opcional; Resolver exige
    observación no vacía antes de habilitar la confirmación, igual
    que ya lo exige el backend (`SolicitudCambioRechazo`/
    `AlertaResolver`). Toda acción refresca la lista de alertas.
  - Paleta de estado de gestión de la alerta (`activa`/`muteada`/
    `resuelta`) deliberadamente DISTINTA a la del semáforo de
    `nivel_alerta` del Dashboard (verde/amarillo/rojo =
    `mg-safe`/`mg-alert`/`mg-danger`), para no mezclar ambos
    conceptos: `activa` usa `mg-accent` (azul de marca), `muteada`
    usa `purple` (Tailwind por defecto, no es color de marca),
    `resuelta` usa `slate` (mismo gris neutro ya usado para "Inactivo"
    en la tabla de Puntos de Control).
  - LIMITACIÓN CONOCIDA: `BitacoraAlertas` (backend) no tiene ninguna
    columna de fecha/timestamp (ni `fecha_creacion` ni
    `fecha_revision`), a diferencia de `SolicitudCambioPuntoControl`
    que sí las tiene. La tarea pedía mostrar una columna "fecha" en la
    tabla, pero no hay ese dato disponible desde el backend — se
    omitió la columna en vez de inventar un valor. Agregar timestamps
    a `BitacoraAlertas` requeriría una migración de Alembic, fuera de
    alcance de esta tarea (frontend-only).
  - Nuevas funciones en `src/lib/api.js`: `listarAlertas`,
    `crearAlerta`, `mutearAlerta`, `escalarAlerta`, `resolverAlerta` —
    mismo patrón que las demás.
  - Nuevo hook `src/hooks/useAlertas.js` (fetch + `recargar()`, sin
    polling, se re-ejecuta también cuando cambia el filtro de estado).
- DECISIÓN (2026-09-15): `GET /api/telemetria/recientes?punto_control_id=X`
  (rol mínimo trabajador, en `app/api/telemetria.py`). Devuelve las
  últimas 10 lecturas (`LIMITE_RECIENTES`) de ese punto de control,
  ordenadas por `timestamp DESC`: `id`, `timestamp`, `temperatura`,
  `humedad`, `bateria`, `gas_crudo`, `gas_corregido` (nullable — los
  1713 registros históricos aún no tienen este campo, ver arriba),
  `nivel_alerta` (schema `TelemetriaResumen` en
  `schemas/telemetria.py`). 404 si el punto de control no existe;
  lista vacía (no error) si existe pero no tiene lecturas todavía.
  Reemplaza en el frontend la LIMITACIÓN CONOCIDA documentada arriba
  (input numérico manual de `telemetria_id` en "Reportar alerta") —
  ver la entrada siguiente.
- DECISIÓN (2026-09-15): "Reportar alerta" (`ModalReportarAlerta.jsx`)
  ya no pide el `telemetria_id` a mano — ahora es una búsqueda guiada
  en dos pasos: 1) el usuario elige un punto de control de un
  `<select>` (reutiliza `listarPuntosControl` ya existente), 2) al
  elegir uno se cargan sus últimas 10 lecturas
  (`GET /api/telemetria/recientes`, nueva función `listarTelemetriasRecientes`
  en `api.js`) como una segunda lista seleccionable, cada opción
  mostrando timestamp + gas corregido (o "sin gas corregido" si es un
  registro histórico sin ese campo) en vez de solo el id crudo. Si el
  punto elegido no tiene lecturas, se muestra el mensaje "Este punto
  de control no tiene lecturas registradas todavía" en vez de una
  lista vacía sin explicación. La LIMITACIÓN CONOCIDA anterior (campo
  numérico manual, sin forma amigable de buscar telemetrías) queda
  resuelta con esta tarea.
- DECISIÓN (2026-09-15): `BitacoraAlertas` gana dos columnas nuevas:
  `fecha_creacion` (`DateTime(timezone=True)`, `server_default=now()`,
  NOT NULL — se llena sola al crear, no requiere cambios en
  `crear_alerta`) y `fecha_actualizacion` (`DateTime(timezone=True)`,
  nullable — `NULL` hasta la primera gestión; `mutear_alerta`,
  `escalar_alerta` y `resolver_alerta` en `app/api/alertas.py` ahora
  la actualizan a `datetime.now(timezone.utc)` en cada llamada).
  Migración `644c76760a40` generada (autogenerate, **sin aplicar aún —
  pendiente de tu revisión**, ver el archivo completo en
  `alembic/versions/644c76760a40_agregar_fecha_creacion_y_fecha_.py`).
  Son columnas `DateTime`, no `Enum`, así que el bug conocido de
  Alembic+Enum (que sí exige el fix manual visto en `9dd2b7ffdaeb`) no
  aplica aquí — el autogenerate no se modificó.
  `AlertaRespuesta` (`schemas/alerta.py`) ahora expone ambos campos.
  Esto resuelve la LIMITACIÓN CONOCIDA documentada arriba sobre
  `BitacoraAlertas` sin columnas de fecha — el frontend
  (`TablaAlertas.jsx`) ya muestra `fecha_creacion` formateada en una
  columna "Fecha" (mismo formato `toLocaleString("es-CO", ...)` usado
  en `ModalReportarAlerta.jsx`).
