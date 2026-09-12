# MINEGUARD

Contexto de referencia rápida para las skills de Claude Code durante el desarrollo.

> Este archivo debe quedarse corto. El detalle completo (reglas de
> negocio, pendientes, convenciones) vive en `docs/PROJECT_CONTEXT.md`
> — es la fuente autoritativa. Si algo aquí y allá no coincide, gana
> `docs/PROJECT_CONTEXT.md` y hay que actualizar este archivo.

## Metodología de trabajo (obligatoria)

1. **Git disciplinado**: cada feature en su propia rama (`feature/nombre-descriptivo`),
   nunca se trabaja directo en `develop` o `master`. Al terminar una feature: commit
   descriptivo → merge a `develop` → merge a `master` solo en hitos estables.
2. **Verificación real, no solo checks automáticos**: tras cada cambio, se verifica
   levantando el stack (`docker compose up`) y probando el flujo real - por curl si es
   backend, o en el navegador si toca frontend. Un `build`/`lint`/`check` limpio NO es
   suficiente por sí solo.
3. **Transparencia sobre efectos colaterales**: si una prueba modifica datos reales,
   crea usuarios de prueba, resetea contraseñas, etc., se reporta explícitamente al
   usuario, y se limpia cuando sea posible.
4. **No placeholders ni datos quemados en código** salvo que se pida explícitamente -
   preferir conectar a datos reales o dejar estados vacíos bien manejados.
5. **Antes de escribir código nuevo**: revisar si ya existe algo similar (modelo,
   endpoint, componente) para reutilizar en vez de duplicar.
6. **Ante ambigüedad de una regla de negocio**: preguntar antes de asumir, especialmente
   si afecta datos, permisos, o dinero.
7. **Commit inmediato al confirmar una tarea**: en cuanto el usuario prueba un cambio y
   confirma que funciona, se comitea antes de pasar al siguiente ajuste o cambiar de
   rama. Nunca dejar trabajo sin commitear mientras se avanza de fase.
8. **Este archivo y `docs/PROJECT_CONTEXT.md` se editan siempre con la herramienta de
   edición de Claude Code**, nunca con `cat >>`/heredocs pegados en la terminal — eso ya
   causó duplicaciones de contenido en `PROJECT_CONTEXT.md`.

## Stack tecnológico
- Backend: Python + FastAPI (async) + SQLAlchemy 2.0 + Alembic.
- Base de datos: PostgreSQL (asyncpg). Hoy solo la DB está dockerizada
  (`docker-compose.yml`, puerto host 5433 para no chocar con un Postgres
  nativo); backend y frontend se corren manualmente (ver abajo).
- Frontend: React + Vite + Tailwind CSS v4 (plugin `@tailwindcss/vite`,
  sin `tailwind.config.js` clásico, sin CLI init).
- ML: scikit-learn + joblib — `RandomForestRegressor` ya entrenado en
  `backend/app/ml_models/`. Falta el `StandardScaler` serializado y la
  fase de inferencia (no implementar sin que se pida explícitamente).
- Autenticación: JWT propio (correo/contraseña, hash bcrypt) implementado;
  Google OAuth 2.0 declarado en el modelo pero sin flujo implementado aún.
- Empaquetado objetivo (futuro): Docker + docker-compose + Nginx para
  todo el stack.

## Estado actual del entorno
- Backend: registro/login/`me` con JWT, forgot-password/reset-password
  (envío de correo simulado por consola, no hay proveedor real), y
  `POST /api/telemetria/ingesta-archivo` (Excel/CSV → Telemetria, con
  normalización flexible de columnas y descarte de filas inválidas).
- Seed de datos: `python -m app.scripts.seed_estacion_chicamocha` crea
  la Estación Chicamocha con sus 7 puntos de control reales (CONTROL
  0-6 — el manual v1.3 asumía 8, dato corregido).
- Frontend: landing page + `/login`, `/registro`, `/dashboard`
  (placeholder), `/olvide-password`, `/reset-password`. `AuthContext`
  guarda el token solo en memoria (nunca localStorage/sessionStorage).
  Cliente API centralizado en `frontend/src/lib/api.js`, URL del
  backend desde `VITE_API_URL` (`frontend/.env`) — nunca hardcodeada
  por componente.
- Migraciones de Alembic al día (`alembic current` == head del código).
- Pendiente (próxima fase): StandardScaler + inferencia del modelo ML
  sobre la telemetría ya ingresada; protección de rutas/endpoints por
  rol; flujo real de Google OAuth.

## Reglas de negocio clave (confirmadas)
- **ML**: variables de entrada al modelo son Temp, Humed, Bateria (en
  ese orden); Ch4 (gas) NO entra al modelo, solo se usa para la
  corrección final: `Gas Corregido = Gas Crudo ± Error Predicho`.
  Umbrales verde/amarillo/rojo aún no definidos — usar placeholders
  configurables, nunca hardcodear.
- **Auth**: dos métodos de login válidos (correo/contraseña y Google
  OAuth); en ambos casos el usuario debe existir en la tabla `Usuario`
  con un rol asignado, y el JWT emitido es el mismo sin importar el
  método usado.
- **Roles**: Trabajador/Operario, Supervisor HSE, Administrador — cada
  uno amplía los permisos del anterior (detalle en PROJECT_CONTEXT.md).
- **Ingesta**: 3 modos intercambiables (archivo, aleatorio, tiempo
  real); toda lectura, sin importar el modo, debe declarar a qué
  PuntoControl pertenece.
- Solo existe una Estación por ahora (Chicamocha, 7 puntos de control
  0-6, confirmado con datos reales), pero el modelo de datos debe
  soportar más de una a futuro.

## Documentación de referencia
- `docs/PROJECT_CONTEXT.md` — contexto completo y autoritativo del
  proyecto (reglas de negocio, pendientes conocidos, convenciones de
  desarrollo, reglas de flujo de git). Consultar siempre antes de
  asumir algo que no esté resumido aquí.
- Manual Técnico WSN_Metano v1.3 — referencia original del proyecto
  (base de las reglas de negocio de ML e ingesta).
