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
4. Corrección final: `Gas Corregido = Gas Crudo (Ch4) ± Error Predicho`.
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

## Estado de ramas y pendientes (actualizado 2026-09-12)
- Rama activa de desarrollo: `feature/ingesta-datos`, con historial
  propio (ya no apunta al mismo commit que `develop`; incluye el seed
  de Chicamocha, el endpoint de ingesta, la migración de nulos y este
  mismo archivo de contexto).
- `feature/frontend-login` quedó congelada en el commit del login por
  correo/contraseña (b15c372); el trabajo posterior (forgot-password,
  frontend completo de login/registro/dashboard) se hizo directo sobre
  `develop`. Decisión explícita ya tomada: se deja tal cual, como
  referencia histórica de esa etapa — no se renombra ni se borra.
- `backend/app/ml_models/modelo_prediccion.joblib` (el
  RandomForestRegressor ya entrenado) está en el working tree sin
  commitear, a propósito: se comiteará junto con el trabajo de
  StandardScaler + inferencia (la próxima fase de ML), para que ese
  commit tenga el contexto completo en vez de aparecer suelto.
