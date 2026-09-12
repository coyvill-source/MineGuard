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
- **Usuario**: email (Google), rol.
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
   — **valores numéricos de los umbrales aún no definidos**, usar
   placeholders configurables, nunca hardcodear.

## Ingesta de datos (3 modos intercambiables)
1. **Archivo** (Excel/CSV): columnas Temp, Humed, Ch4, Bateria,
   hora_insertion.
2. **Aleatorio**: generador sintético con rangos configurables.
3. **Tiempo real** (futuro, aún no hay despliegue físico en mina).

Toda lectura, sin importar el modo, debe declarar a qué PuntoControl
pertenece.

## Pendientes conocidos (no resolver por tu cuenta, preguntar)
- Falta el objeto StandardScaler asociado al modelo (.joblib solo trae
  el RandomForestRegressor).
- No hay unidad de medida ni límites numéricos confirmados para el
  gas (valores de referencia observados: ~1.923 a ~20.475, unidad sin
  confirmar).
- Por ahora solo existe una Estación (Chicamocha, 8 puntos de control
  0-7), pero el modelo de datos debe soportar más de una a futuro.
- Periodicidad exacta de guardado del histórico: aún no definida
  (usar valor configurable, no fijo).

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
EOFcd /c/Users/li_ma/MineGuard
cat >> docs/PROJECT_CONTEXT.md << 'EOF'

## Actualización — Autenticación (v1.4)
El sistema debe soportar DOS métodos de inicio de sesión (no solo
Google OAuth como decía el manual v1.3):
1. **Google OAuth 2.0** (SSO).
2. **Correo y contraseña** (registro/login tradicional), con hash
   seguro de contraseña (ej. bcrypt/argon2).

En ambos casos, el usuario debe existir en la tabla Usuario con un rol
asignado para poder acceder (igual que en el flujo original de SSO).
El JWT emitido es el mismo sin importar el método de login usado.
EOFcd /c/Users/li_ma/MineGuard
cat >> docs/PROJECT_CONTEXT.md << 'EOF'

## Actualización — Autenticación (v1.4)
El sistema debe soportar DOS métodos de inicio de sesión (no solo
Google OAuth como decía el manual v1.3):
1. **Google OAuth 2.0** (SSO).
2. **Correo y contraseña** (registro/login tradicional), con hash
   seguro de contraseña (ej. bcrypt/argon2).

En ambos casos, el usuario debe existir en la tabla Usuario con un rol
asignado para poder acceder (igual que en el flujo original de SSO).
El JWT emitido es el mismo sin importar el método de login usado.
EOFcd /c/Users/li_ma/MineGuard
cat >> docs/PROJECT_CONTEXT.md << 'EOF'

## Actualización — Autenticación (v1.4)
El sistema debe soportar DOS métodos de inicio de sesión (no solo
Google OAuth como decía el manual v1.3):
1. **Google OAuth 2.0** (SSO).
2. **Correo y contraseña** (registro/login tradicional), con hash
   seguro de contraseña (ej. bcrypt/argon2).

En ambos casos, el usuario debe existir en la tabla Usuario con un rol
asignado para poder acceder (igual que en el flujo original de SSO).
El JWT emitido es el mismo sin importar el método de login usado.
EOFcd /c/Users/li_ma/MineGuard
cat >> docs/PROJECT_CONTEXT.md << 'EOF'

## Actualización — Autenticación (v1.4)
El sistema debe soportar DOS métodos de inicio de sesión (no solo
Google OAuth como decía el manual v1.3):
1. **Google OAuth 2.0** (SSO).
2. **Correo y contraseña** (registro/login tradicional), con hash
   seguro de contraseña (ej. bcrypt/argon2).

En ambos casos, el usuario debe existir en la tabla Usuario con un rol
asignado para poder acceder (igual que en el flujo original de SSO).
El JWT emitido es el mismo sin importar el método de login usado.
EOFcd /c/Users/li_ma/MineGuard
cat >> docs/PROJECT_CONTEXT.md << 'EOF'

## Actualización — Autenticación (v1.4)
El sistema debe soportar DOS métodos de inicio de sesión (no solo
Google OAuth como decía el manual v1.3):
1. **Google OAuth 2.0** (SSO).
2. **Correo y contraseña** (registro/login tradicional), con hash
   seguro de contraseña (ej. bcrypt/argon2).

En ambos casos, el usuario debe existir en la tabla Usuario con un rol
asignado para poder acceder (igual que en el flujo original de SSO).
El JWT emitido es el mismo sin importar el método de login usado.
