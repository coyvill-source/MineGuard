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
2. **Aleatorio bajo demanda**: generador sintético con rangos
   configurables, un lote fijo por request.
3. **Aleatorio continuo** (simula "tiempo real" mientras no haya
   despliegue físico en mina): mismo generador sintético, pero corre en
   segundo plano a un intervalo configurable, generando una lectura por
   punto de control activo en cada tick, hasta que un admin lo detiene
   — ver DECISIÓN 2026-09-18 más abajo.

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
    se actualizó en una tarea aparte — ver la entrada de 2026-09-16
    más abajo.
- DECISIÓN (2026-09-16): banner del Dashboard actualizado para
  reflejar que el motor de umbrales ya es real (`Dashboard.jsx`,
  componente renombrado de `AvisoCalibracionPendiente` a
  `AvisoModeloTemporal`). Ya no dice "pendiente de calibración" ni
  "todos los puntos muestran Óptimo como placeholder" — ambas
  afirmaciones dejaron de ser ciertas con la DECISIÓN de 2026-09-15.
  El nuevo texto explica que la clasificación óptimo/alerta/crítico
  ya usa los umbrales reales del Decreto 1886 (ppm → % de metano),
  pero mantiene un aviso sobre algo que SÍ sigue siendo cierto: el
  `StandardScaler` sigue siendo la aproximación temporal derivada
  localmente (ver DECISIÓN 2026-09-12 sobre el scaler, más arriba),
  así que la corrección del modelo — y por extensión la
  clasificación, que depende de `gas_corregido` — puede no ser
  perfectamente precisa todavía. La leyenda del semáforo
  (`LeyendaSemaforo`) no necesitó cambios: sus etiquetas
  (Óptimo/Alerta/Crítico/Sin datos) ya eran neutras y no afirmaban
  nada falso.
  Verificado en navegador real contra `mineguard_db` (no se usaron
  datos de prueba): el plano del Dashboard ya muestra colores
  variados de verdad (no todo verde) en los puntos con lecturas,
  consistente con la distribución real de niveles ya reclasificados
  (ver conteos en la DECISIÓN de 2026-09-15).
- DECISIÓN (2026-09-16): rediseño visual de
  `frontend/src/components/dashboard/PlanoPuntosControl.jsx` — de
  scatter plot esquemático plano a un estilo "plano técnico de mina"
  (inspirado en una imagen de referencia que compartió el usuario,
  sin usarla como fondo literal — no hay correspondencia de
  coordenadas confirmada con ningún plano real). Toda la lógica
  existente quedó intacta (cálculo de `viewBox` según
  `coord_x`/`coord_y` reales, marcadores por `nivel_alerta`, tooltip
  por hover/click/teclado); solo se agregaron capas decorativas
  **debajo** de los marcadores, que siguen siendo el elemento más
  prominente:
  - Fondo "papel técnico": un `<rect>` base en `mg-surface-50` +
    un `<pattern>` de grid fino (`stroke-mg-navy-900/5`, casi
    invisible) cuyo paso se recalcula como `escala.lado / 20`, así
    que la densidad visual de la cuadrícula es consistente sin
    importar cuánto se extiendan los puntos reales.
  - Una única curva tipo "galería de túnel" (`construirRutaTunel`),
    generada con `Q` (bezier cuadrática) pasando por todos los puntos
    ordenados por `coord_x`, con un offset perpendicular alternado
    por segmento para que se vea sinuosa en vez de una polilinea
    recta. Se recalcula con `useMemo` a partir de `puntos` — no hay
    coordenadas de túnel hardcodeadas.
  - Rosa de los vientos (N/S/E/O) en la esquina superior derecha del
    `viewBox`, tamaño proporcional a `escala.lado` (no un tamaño en
    píxeles fijo), en `mg-navy-800`/`mg-accent-500` (colores de
    marca).
  - DECISIÓN DE DISEÑO explícita: el túnel decorativo usa
    `emerald-700` (verde de Tailwind por defecto), **no**
    `mg-safe-500` — ese verde ya es el color semántico de "nivel
    Óptimo" en los marcadores; usar el mismo tono para una línea de
    fondo habría creado ambigüedad visual entre "marcador en estado
    óptimo" y "decoración de túnel". Por la misma razón no se usó
    rojo para ningún elemento decorativo (la imagen de referencia
    tenía flechas de inclinación en rojo) — el rojo ya es
    `mg-danger-500` = nivel Crítico en este mismo plano. Tampoco se
    agregaron las cotas de elevación "Z=" en azul de la imagen de
    referencia ni las flechas de ángulo: no estaban en la lista
    explícita de elementos a construir de la tarea, y sumar más
    anotaciones de texto arriesgaba competir visualmente con los
    marcadores reales.
  - **ACLARACIÓN IMPORTANTE**: el túnel y la rosa de los vientos son
    100% decorativos/esquemáticos — no representan geometría real
    medida de la mina (no hay topografía de túneles capturada en el
    sistema todavía). No debe interpretarse como un plano topográfico
    certificado.
  - Sigue siendo responsive: se mantiene `aspect-[4/3] xl:aspect-[16/9]`
    sin cambios; todo el contenido nuevo vive dentro del mismo
    `viewBox` ya existente, así que escala igual que antes.
- DECISIÓN (2026-09-16): estructura real del túnel decorativo
  (`PlanoPuntosControl.jsx`, reemplaza la curva única de la entrada
  anterior) + marca de entrada en el punto "0". Basado en la
  descripción del usuario — **decorativo/esquemático, no topografía
  medida**, igual que el resto del plano (ver aclaración de la
  entrada anterior).
  - Identificación por `nombre_estacion` (los valores reales "0" a
    "6"), nunca por el `id` numérico de la base de datos —
    `construirEstructuraTunel` arma un `Map` `nombre_estacion → punto`
    y resuelve cada tramo con `.get()`, así que si algún
    `nombre_estacion` mencionado no existe en los datos, ese tramo se
    omite en silencio (no crashea).
  - **Túnel principal**: `"0" → "1" → "3" → "5"`, un segmento bezier
    cuadrática por cada par consecutivo presente.
  - **Rama 1**: sale del punto medio de la curva del tramo `"1"-"3"`
    (calculado de verdad sobre la bezier con `puntoEnBezier`, no la
    recta) hasta `"2"`.
  - **Rama 2**: sale del punto medio de la curva del tramo `"3"-"5"`
    hasta `"6"`.
  - **Rama 3**: sale directamente de `"5"` (extensión más allá del
    final del túnel principal) hasta `"4"`.
  - Jerarquía visual: túnel principal `stroke-emerald-700/40`,
    grosor `escala.radio * 0.34`; ramas `stroke-emerald-600/20`,
    grosor `escala.radio * 0.15` (la mitad, mucho más tenues) — las
    ramas se pintan primero y el túnel principal encima, para que
    lea como el eje estructural. Sigue sin usar `mg-safe-500` (ver
    razón ya documentada: ambigüedad con el marcador "Óptimo").
  - **Marca de entrada** en el punto `"0"`: un arco/portal decorativo
    (`MarcaEntrada`) dibujado **detrás** del marcador circular
    (nunca lo tapa — el semáforo de `nivel_alerta` sigue siendo el
    elemento funcional ahí) + etiqueta de texto "Entrada" encima del
    arco, sin chocar con la etiqueta existente del `nombre_estacion`
    (que va debajo del círculo).
  - Todo sigue siendo 100% calculado desde `coord_x`/`coord_y` reales
    vía `useMemo`, cero coordenadas de túnel hardcodeadas. Se
    mantuvieron intactos: tooltip, rosa de los vientos, fondo de
    papel técnico, y la responsividad (`aspect-[4/3] xl:aspect-[16/9]`).
  - **Ajuste post-verificación**: la rosa de los vientos estaba fija en
    la esquina superior-derecha del `viewBox`, y con los datos reales
    de la Estación Chicamocha el punto `"0"` (la entrada) cae
    justamente ahí — la marca "Entrada" y la rosa se solapaban
    visualmente al verificar en navegador. Se corrigió con
    `elegirEsquinaRosa(escala, puntoEntrada)`: evalúa las 4 esquinas
    del `viewBox` y elige la más alejada (distancia euclidiana) del
    punto `"0"`; si no hay punto de entrada en los datos, usa la
    esquina superior-derecha por defecto (comportamiento anterior).
    Verificado en navegador real: sin solape, tooltip y colores
    intactos.
- DECISIÓN (2026-09-16): el Dashboard (plano de puntos de control) usa
  ahora todo el ancho disponible del área de contenido, y el
  componente `PlanoPuntosControl.jsx` recibió un pulido visual
  integral — pedido explícito del usuario ("la parte más importante
  del proyecto" visualmente), caso de uso principal en centros de
  control con monitores panorámicos (ver manual técnico).
  - **Ancho completo, solo en Dashboard**: `DashboardLayout.jsx` tenía
    un único wrapper `mx-auto max-w-[1600px]` aplicado a TODAS las
    páginas (Dashboard, Puntos de Control, Alertas). Se agregó una
    prop `anchoCompleto` (default `false`, sin cambios de
    comportamiento para las demás páginas): cuando es `true`, el
    wrapper usa `w-full` en vez del límite de 1600px. Solo
    `Dashboard.jsx` la activa (`<DashboardLayout anchoCompleto>`) —
    `PuntosControl.jsx` y `Alertas.jsx` no la usan porque son
    tablas/formularios que no se benefician de tanto ancho.
  - **Texto del aviso `AvisoModeloTemporal` acotado**: aunque la
    página ya no tiene límite de ancho, el párrafo del aviso sobre el
    StandardScaler se mantiene con `max-w-3xl` (la caja/fondo del
    aviso sí ocupa el ancho completo) para que la línea de texto no se
    estire a un largo incómodo de leer en monitores muy anchos.
  - **`viewBox` con aspecto dinámico (elimina franjas vacías)**: antes
    el `viewBox` del SVG era siempre cuadrado (`lado x lado`) dentro
    de un contenedor con aspecto `4/3`/`16/9`, lo que dejaba franjas
    vacías a los lados (letterboxing) — un problema que se volvía más
    notorio mientras más ancho fuera el contenedor. Se corrigió
    midiendo el aspecto real del contenedor con `ResizeObserver`
    (estado `aspecto` en `PlanoPuntosControl`) y pasándolo a
    `calcularEscala(puntos, aspecto)`, que ahora calcula `ancho`/`alto`
    del `viewBox` (reemplaza el antiguo `lado` único) coincidiendo con
    ese aspecto real — el SVG llena el panel por completo, sin
    recortes ni espacio vacío, en cualquier tamaño de pantalla. El
    padding y el tamaño de los marcadores (`radio`) se siguen
    calculando sobre la extensión real de los puntos (`extentBase`),
    nunca sobre el ancho extra del aspecto panorámico, para que los
    marcadores no cambien de tamaño solo porque el contenedor se hizo
    más ancho. El paso de la cuadrícula (`pasoGrid = escala.alto / 20`)
    también se ató a `alto` (no afectado por el aspecto) para que el
    tamaño de celda del "papel técnico" se mantenga consistente y
    solo aparezcan más columnas al ensanchar, como en papel
    cuadriculado real.
  - **Aspecto del contenedor progresivo**: `aspect-[4/3]` en angosto →
    `xl:aspect-[16/9]` → `2xl:aspect-[21/9]` en pantallas muy anchas,
    para que la altura del panel no crezca sin control en monitores
    ultrawide (antes se detenía en `16/9`).
  - **Rosa de los vientos y marca de entrada**: sus fórmulas de tamaño
    y margen se migraron de `escala.lado` a `escala.radio` (rosa) y a
    `escala.ancho`/`escala.alto` (márgenes de `elegirEsquinaRosa`),
    preservando el tamaño/posición relativa que ya se había verificado
    - no fue necesario tocar `MarcaEntrada`, que ya usaba `radio`.
  - **Panel más pulido**: contenedor del plano con sombra más marcada
    (`shadow-md` con transición a `shadow-lg` en hover), anillo sutil
    (`ring-1 ring-mg-navy-900/5`) y más padding interno
    (`p-3`/`xl:p-4`), sin cambiar bordes ni radios ya aprobados.
  - **Barra de leyenda**: la leyenda del semáforo y el texto de ayuda
    ("Pasa el mouse...") se agruparon en una barra tipo "toolbar"
    (`BarraPlano`) con el mismo tratamiento de panel (borde, fondo
    blanco, sombra sutil) que el plano, para que se lea como una sola
    pieza cohesiva en vez de texto suelto; los puntos de color de la
    leyenda ganaron un anillo blanco (`ring-2 ring-white`) para verse
    más nítidos.
  - Nada de lo ya verificado cambió de comportamiento: tooltip
    (hover/click/teclado), colores del semáforo, estructura del túnel
    (principal + 3 ramas), marca de entrada, y la paleta de marca
    (mg-navy/mg-accent/mg-safe/alert/danger, más `emerald` para el
    túnel y `slate` para "sin datos" - ya aprobados, no se agregaron
    colores nuevos).
- DECISIÓN (2026-09-16): segunda ronda de pulido visual de
  `PlanoPuntosControl.jsx`, con 6 ajustes específicos aprobados por el
  usuario tras revisar una captura real del plano. Todo sigue dentro
  de la paleta de marca aprobada (mg-navy/mg-accent/mg-safe/alert/
  danger, emerald para el túnel, slate para "sin datos") y sin romper
  tooltip, semáforo, estructura del túnel, ancho completo/aspecto
  dinámico ni responsividad (verificado en navegador real, ancho y
  angosto - ver detalle al final de esta entrada).
  - **1. Sombra y profundidad en los marcadores**: cada marcador
    (`<circle>`) usa un `<filter>` SVG nuevo (`feDropShadow`,
    definido una vez en `<defs>` con `useId`) en vez de un filtro CSS
    (`drop-shadow` de Tailwind), para que la sombra escale junto con
    el resto de la geometría del `viewBox` y no dependa de píxeles de
    pantalla. El `flood-color` se fija vía `style` (no hay clase de
    Tailwind para presentation attributes de un filtro SVG) usando la
    custom property `var(--color-mg-navy-900)`, así sigue tomando el
    color de la paleta en vez de un hex suelto.
  - **1b. Icono en marcadores "sin datos"**: los círculos grises
    (`IconoSinDatos`) ahora muestran 3 barras ascendentes (icono de
    "sensor/señal" minimalista, `fill-slate-600/85`) en vez de verse
    vacíos - se eligió sobre un signo de interrogación porque en un
    panel de monitoreo de seguridad un "sensor esperando datos" se
    lee mejor que un símbolo que sugiere error.
  - **2. Portal de "Entrada" rediseñado**: `MarcaEntrada` reemplaza el
    arco delgado anterior por un portal reforzado - postes + arco
    (trazo más grueso, `radio*0.22`), una viga dintel horizontal en el
    arranque del arco, y 2 riostras diagonales de esquina (refuerzo
    estructural). Sigue dibujado 100% detrás del marcador circular
    (nunca lo tapa) y la etiqueta "Entrada" se reposicionó más cerca
    del arco para no exceder el margen reservado (ver ajuste 4).
  - **3. Chips/badges en las etiquetas de punto**: el número de
    `nombre_estacion` bajo cada punto pasó de texto suelto a una
    píldora (`rx = altoChip/2`) con fondo `fill-mg-surface-100` y
    borde sutil `stroke-mg-navy-900/10`, mejor contraste que el texto
    plano anterior. El tamaño de la píldora es fijo en múltiplos de
    `radio` (pensado para los valores reales de 1 dígito, "0" a "6");
    no se implementó auto-ajuste al ancho del texto (requeriría medir
    con `getBBox` por punto) porque no había necesidad real con los
    datos actuales - si `nombre_estacion` empieza a tener nombres más
    largos, revisar `anchoChip`.
  - **4. Encuadre más ajustado (menos espacio vacío)**: `calcularEscala`
    dejó de usar un `PADDING_RATIO` fijo (22% de la extensión). Ahora
    el margen se calcula punto por punto, sumando exactamente lo que
    cada elemento decorativo necesita para no cortarse: `MARGEN_LATERAL`
    (2.0×radio - marcador agrandado en hover/foco + su stroke, y
    también lo que usa la rosa de los vientos en su esquina),
    `MARGEN_PORTAL` (3.6×radio, solo arriba del punto "0" - alcance
    del portal + su etiqueta) y `MARGEN_CHIP` (2.5×radio, abajo de
    todos los puntos - alcance del chip). El resultado es un ~5-8%
    más ajustado que el margen fijo anterior en los lados que sí
    tienen contenido cerca del borde (verificado con `getBBox()` en
    navegador real: el contenido queda a 2.9-10 unidades del borde del
    `viewBox`, nunca cortado). El margen lateral (`elegirEsquinaRosa`)
    reutiliza la misma constante `MARGEN_LATERAL`, así la rosa siempre
    cabe exactamente en el espacio que el encuadre le reservó.
    **Importante**: en pantallas muy panorámicas (aspecto 21/9) sigue
    habiendo espacio vacío visible en el lado opuesto a la rosa - eso
    es inherente a rellenar el ancho completo sin distorsionar la
    escala real de los puntos (ver DECISIÓN anterior de ancho
    completo/aspecto dinámico), no es el mismo problema que este
    ajuste resuelve (que era el margen alrededor de los puntos, no el
    espacio del aspecto panorámico).
  - **`RADIO_RATIO` recalibrado** (0.032 → 0.039) porque `radio` pasó
    a calcularse sobre la extensión cruda de los puntos (`extentRaw`)
    en vez de sobre el `base` ya con padding aplicado (que ya no
    existe como tal) - el nuevo valor mantiene el tamaño visual de los
    marcadores igual que antes con los datos reales de la Estación
    Chicamocha.
  - **5. Túnel con profundidad (doble línea)**: cada tramo (principal
    y rama) ahora dibuja primero un trazo "sombra" más ancho y oscuro
    (`stroke-emerald-900/30` para el principal, `/15` para las ramas -
    mismo tono ya aprobado, solo más oscuro, no es un color nuevo)
    detrás del trazo emerald existente (que no cambió), dando efecto
    de galería con volumen en vez de una línea plana.
  - **6. Rosa de los vientos pulida**: ganó un halo suave detrás
    (`fill-mg-navy-900/5`), un anillo bisel intermedio, un punto
    central, proporción de estrella más náutica (eje N-S más largo/
    prominente que el eje E-O) y tipografía con `letter-spacing` en la
    "N". Se redujo ligeramente su multiplicador de radio (1.56 → 1.4)
    para que quepa con margen dentro del nuevo encuadre más ajustado
    (ver ajuste 4) sin arriesgar recortarse contra el borde.
  - Verificación en navegador real: ancho (~1536px y una ventana
    panorámica 21:9) y angosto (395px, mismo método de iframe real que
    en la ronda anterior, mismas media queries de Tailwind) - portal,
    chips, iconos "sin datos", túnel con profundidad y rosa pulida se
    ven correctamente proporcionados en ambos extremos, sin recortes
    (confirmado numéricamente con `getBBox()` de todos los elementos
    contra el `viewBox`), tooltip funcional (hover/click), sin errores
    de consola.
- DECISIÓN (2026-09-16): tercera ronda de pulido visual de
  `PlanoPuntosControl.jsx`, con 5 ajustes aprobados tras otra revisión
  de captura real. Sin romper tooltip, semáforo, estructura del
  túnel, ancho completo ni ningún elemento de las rondas 1 y 2
  (chips, ícono de sensor, portal, doble línea del túnel) - verificado
  en navegador real, ancho y angosto (detalle al final).
  - **1. Aspecto del panel calculado del bounding box real (ya no
    breakpoints fijos)**: los puntos reales se distribuyen en diagonal
    (más extensión horizontal que vertical, pero solo levemente:
    extentX/extentY ≈ 1.16 con los datos de la Estación Chicamocha),
    lo que con el aspecto panorámico fijo de la ronda anterior
    (`aspect-[4/3] xl:aspect-[16/9] 2xl:aspect-[21/9]`) dejaba las
    esquinas opuestas a esa diagonal (arriba-izquierda,
    abajo-derecha) visiblemente vacías - el contenido real (ya
    ajustado en la ronda 2) es bastante más cuadrado que un aspecto
    panorámico. `calcularAspectoContenedor(puntos)` calcula
    `extentX/extentY` del bounding box real y lo usa como
    `aspectRatio` CSS del contenedor (reemplaza las clases de
    Tailwind), acotado entre `ASPECTO_CONTENEDOR_MIN=1.4` (piso, para
    que el panel siempre se lea claramente "más ancho que alto" aunque
    el dato bruto sea más cuadrado - con los datos reales el bruto es
    1.16, así que hoy siempre cae en este piso) y
    `ASPECTO_CONTENEDOR_MAX=2.0` (techo, evita que crezca
    desproporcionadamente en pantallas ultra anchas si en el futuro
    los puntos llegan a distribuirse mucho más horizontalmente). El
    `ResizeObserver` de la ronda anterior sigue midiendo el aspecto ya
    renderizado del contenedor como red de seguridad (si el navegador
    no puede honrar el `aspectRatio` exacto), y se lo sigue pasando a
    `calcularEscala` sin cambios - el ajuste de encuadre/margen de la
    ronda 2 (`MARGEN_LATERAL`/`MARGEN_PORTAL`/`MARGEN_CHIP`) se
    mantuvo intacto. Verificado con `getBBox()`: el espacio sobrante
    en el lado sin rosa bajó de 159 unidades (a 21:9) a ~50 unidades
    (a 1.4:1) con los mismos datos reales.
  - **2. Sombra envolvente del panel**: se revisó el resto del sistema
    de diseño - Login/Registro/OlvidePassword/ResetPassword y el gate
    de sesión de `DashboardLayout` usan todos `shadow-lg
    shadow-mg-navy-900/5` (mismo token de color en toda la app, "carta
    elevada" estándar). El panel del plano subió de `shadow-md
    shadow-mg-navy-900/8` a `shadow-xl shadow-mg-navy-900/10` (con
    `hover:shadow-2xl hover:shadow-mg-navy-900/15`) - un escalón más
    marcado que el estándar de la app porque es el elemento visual más
    importante del dashboard, pero usando el mismo token de color
    (`mg-navy-900`), no un color nuevo.
  - **3. Color distintivo del ícono de "Entrada"**: `MarcaEntrada`
    (el portal sobre el punto "0") usaba `stroke-mg-navy-800` a baja
    opacidad, que a simple vista se leía casi igual de gris que los
    marcadores "sin datos" (`slate`). Se cambió a `mg-accent`
    (azul de marca: `accent-600` para el marco/texto, `accent-500`
    para el dintel y las riostras) - el punto "0" es una referencia
    especial, no otro sensor sin lecturas.
  - **4. Sombra de los marcadores más marcada**: el `feDropShadow` de
    la ronda anterior (`dy=radio*0.09`, `stdDeviation=radio*0.11`,
    `floodOpacity=0.35`) era casi imperceptible en pantalla real. Subió
    a `dy=radio*0.14`, `stdDeviation=radio*0.17`,
    `floodOpacity=0.5` - más blur y más opacidad, sin cambiar el color
    (sigue `var(--color-mg-navy-900)`).
  - **5. Rosa de los vientos más prominente**: su multiplicador de
    radio subió de 1.4 a 1.65 (moderado, no compite con los
    marcadores de punto de control) y se reforzó su anillo/borde:
    círculo base `stroke-mg-navy-800/35→/50` con grosor `0.05→0.08`,
    anillo bisel `/20→/30` con grosor `0.03→0.045`, halo de fondo
    `mg-navy-900/5→/8`. Como la rosa creció,
    `MARGEN_LATERAL` (que también fija cuánto se aleja la rosa del
    borde en `elegirEsquinaRosa`, reutilizando la misma lógica de la
    ronda anterior) subió de 2.0 a 2.15 para que siga cabiendo sin
    chocar ni recortarse contra el borde del `viewBox`.
  - Verificación en navegador real: ancho (~1254px) y angosto (395px,
    mismo método de iframe real que en rondas anteriores) - confirmado
    con `getBBox()` que nada se recorta en ninguno de los dos extremos
    (márgenes positivos en los 4 lados), `aspectRatio` computado
    confirmado en ambos (`1.4/1`, el piso, con los datos reales),
    tooltip funcional (hover/click), sin errores de consola.
- DECISIÓN (2026-09-16): cuarta ronda de ajustes sobre el Dashboard -
  problema crítico reportado por el usuario: el aspecto más ancho de
  la ronda 3 (`aspect-ratio` + `w-full`) dejaba que la ALTURA creciera
  libre a partir del ancho completo, y en laptops estándar (1366x768)
  eso obligaba a hacer scroll vertical para ver el plano completo -
  inaceptable para un dashboard de monitoreo ("de un vistazo, sin
  scroll"). Prioridad máxima: que TODO el contenido (banner + leyenda
  + panel) quepa en la altura visible del viewport en desktop/laptop
  estándar, con un pulido tipográfico adicional una vez que el panel
  quedó más compacto.
  - **Tarea 1 - Altura sin scroll**: `PlanoPuntosControl.jsx` dejó de
    usar `w-full` + `aspect-ratio` (CSS puro) y ahora calcula el
    ancho/alto del panel EXPLÍCITAMENTE en JS
    (`calcularDimensiones(anchoDisponible, aspecto)`):
    - `alturaDisponible = max(window.innerHeight - RESERVA_VERTICAL_PX, ALTURA_MINIMA_PX)`.
      `RESERVA_VERTICAL_PX = 380` es el espacio que ocupan header +
      padding del `<main>` + banner + leyenda + márgenes + padding
      inferior de la página - medido de verdad en navegador real
      (`panelTop ≈ 340px` + `~40px` de margen inferior), no adivinado.
    - `ancho = min(anchoDisponible, alturaDisponible * aspecto)` - el
      ancho se recorta si no cabe en el ancho real disponible del
      contenedor padre (medido con `ResizeObserver`, igual que antes),
      y el alto se deriva siempre de ese ancho final para mantener el
      aspecto exacto (`alto = ancho / aspecto`) - así el plano
      SIEMPRE prioriza caber en la altura visible sobre ser lo más
      ancho posible.
    - **Por qué JS explícito y no `aspect-ratio` + `max-height` en
      CSS**: se intentó primero con CSS puro (`max-width:100%` +
      `max-height:calc(100vh - ...)` + `aspect-ratio` dentro de un
      padre flex) - en navegador real, el `<svg>` hijo con
      `w-full h-full` (100% de un padre cuyo tamaño depende a su vez
      de `aspect-ratio`) genera una referencia circular en el cálculo
      de tamaño intrínseco de un flex item: el navegador terminaba
      resolviendo un ancho pequeño arbitrario en vez de respetar
      `max-height` (verificado con capturas y medición real: el panel
      quedaba de 333px de ancho en una ventana con 1000px+
      disponibles). Sacar el SVG del flujo (`position:absolute`) tampoco
      alcanzó (el flex item colapsaba a su tamaño mínimo sin ninguna
      señal de tamaño). Calcular ambas dimensiones explícitamente evita
      por completo la ambigüedad.
    - **`useLayoutEffect`, no `useEffect`**: la primera medida del
      ancho del padre debe ser SÍNCRONA antes de pintar - con
      `useEffect` (asíncrono) el navegador llegaba a pintar primero con
      el ancho de respaldo (el que cabe según la altura, sin recortar
      por ancho), y si ese ancho de respaldo excedía el ancho real
      disponible, el navegador recortaba el ancho renderizado
      (`flex-shrink`) sin volver a derivar el alto - dejando el panel
      con una relación de aspecto incorrecta (verificado en navegador
      real angosto: 395px de ancho quedaba con alto de 515px en vez de
      los ~237px correctos, aspecto 0.64 en vez de 1.4). Corregido
      midiendo y aplicando la primera medida sincrónicamente dentro de
      `useLayoutEffect`, antes del primer pintado.
    - Se mantiene un listener de `resize` en `window` además del
      `ResizeObserver` del padre, porque el `ResizeObserver` no dispara
      si solo cambia el alto del viewport sin que cambie el ancho
      disponible del contenedor.
    - `ALTURA_MINIMA_PX = 340`: piso de altura para no dejar el plano
      ilegible en ventanas muy bajas - por debajo de este piso se
      prioriza un pequeño scroll (aceptado explícitamente por el
      usuario para "pantallas muy pequeñas") antes que seguir
      encogiendo el panel.
    - El estado de carga y el estado "sin puntos" de
      `PlanoPuntosControl`/`Dashboard.jsx` recibieron el mismo
      `max-height: calc(100vh - 21rem)` (ahí sí en CSS puro, sin el
      problema circular porque no tienen un `<svg>` hijo) para
      consistencia, aunque son estados transitorios.
  - **Tarea 2 - Pulido tipográfico**: al medir en navegador real, el
    panel más compacto de la ronda 3 dejaba el texto de los chips en
    ~7px de alto en pantalla y la etiqueta "Entrada" en ~4.5px -
    ilegible. Se subieron las proporciones (relativas a `escala.radio`,
    no valores fijos en px - siguen escalando con el `viewBox`):
    - Chip: fuente `0.78→0.9`, píldora `2.0→2.15` de ancho y
      `1.15→1.3` de alto (para que quepa la fuente más grande con
      margen). `MARGEN_CHIP` subió de `2.5` a `2.65` para cubrir el
      nuevo alcance del chip agrandado (mismo patrón de "si cambia el
      tamaño de un elemento, revisar su margen" ya establecido).
    - Etiqueta "Entrada" del portal: fuente `0.5→0.62`.
    - Resultado medido en navegador real a 1366x768: chip ~10.8px de
      alto en pantalla (antes ~7px con el tamaño de panel de esta
      ronda). El resto de la jerarquía visual (colores, portal en
      acento, sombras, rosa de los vientos) se revisó y se mantuvo sin
      cambios - ya sostenía bien con el panel más compacto.
  - Verificación en navegador real: 1366x768 (sin scroll, confirmado
    `scrollHeight === innerHeight`, chip legible ~10.8px), ventana más
    baja de lo esperado (674px, ventana no maximizada - scroll de solo
    ~38px, aceptado explícitamente por el usuario como caso límite),
    ancho (2200x1000, sin scroll) y angosto (395px, aspecto 1.4
    correcto tras el fix de `useLayoutEffect`) - `getBBox()` confirma
    que nada se recorta en ningún caso, tooltip funcional, sin errores
    de consola.
- DECISIÓN (2026-09-16): quinta ronda - se recuperó el ANCHO COMPLETO
  del panel del plano sin perder el ajuste de ALTO SIN SCROLL de la
  ronda anterior (ambas cosas a la vez). La ronda 4 había introducido
  un `aspectoContenedor` calculado del bounding box de los puntos
  (piso 1.4, techo 2.0) que derivaba el ANCHO del ALTO disponible -
  eso resolvía el scroll, pero como consecuencia dejaba el panel
  angosto y centrado en pantallas donde el ancho "correcto" según ese
  aspecto era menor que el ancho real disponible (confirmado con
  captura real del usuario). La causa raíz: ancho y alto competían
  entre sí a través de un aspecto compartido - solo se podía elegir
  uno como restricción activa.
  - **Arreglo**: ancho y alto del panel dejaron de derivarse el uno
    del otro. Ahora son completamente independientes:
    - **Ancho**: `w-full` (100% del contenedor padre, sin límite) -
      exactamente el mismo mecanismo de "ancho completo" de la
      ronda de `ancho completo` original.
    - **Alto**: explícito en px, `calcularAltoDisponible()` = `max(window.innerHeight - RESERVA_VERTICAL_PX, ALTURA_MINIMA_PX)`
      - el mismo cálculo de la ronda 4 (sin cambios), pero ya no
        alimenta ningún cálculo de ancho.
    - El **aspecto del `viewBox`** (para que el SVG llene la caja sin
      dejar franjas vacías - "letterboxing") se sigue midiendo con
      `ResizeObserver` sobre el contenedor YA renderizado (ancho
      completo x alto fijo), igual que el mecanismo original de la
      ronda de "ancho completo": el SVG se adapta a la caja
      disponible, la caja ya NO se adapta a la forma de los datos.
      `calcularAspectoContenedor` (el bounding box de los puntos,
      piso/techo 1.4-2.0) se eliminó por completo - ya no tiene
      ningún rol en el tamaño del panel.
  - **Simplificación**: al independizar ancho y alto, ya no hace
    falta la lógica de "recortar el ancho si no cabe" ni la
    corrección de `useLayoutEffect` para la condición de carrera
    ancho-vs-alto de la ronda anterior (esos problemas solo existían
    porque ancho y alto competían) - el componente volvió a un
    `ResizeObserver` simple (mide `contentRect.width`/`height` ya
    renderizados, sin ambigüedad de tamaño intrínseco) muy parecido al
    de la ronda de "ancho completo" original, combinado con el alto
    explícito de la ronda 4.
  - **`RESERVA_VERTICAL_PX`/`ALTURA_MINIMA_PX` centralizadas**: vivían
    duplicadas (un valor en rem dentro de Dashboard.jsx, otro en px
    dentro de PlanoPuntosControl.jsx, desincronizados entre sí - un
    bug latente). Se movieron a `frontend/src/lib/layoutPlano.js`
    (junto con `calcularAltoDisponible()`) como fuente única, importada
    por ambos archivos. Esto también evitó un warning nuevo de lint
    (`react(only-export-components)`) por exportar constantes desde un
    archivo de componente.
  - Verificación en navegador real, en las 3 resoluciones pedidas
    explícitamente (método de iframe real embebido, ya usado en rondas
    anteriores, con login real y datos reales de la Estación
    Chicamocha):
    - **1366×768 (laptop estándar)**: `scrollDiff: 0` (sin scroll).
      Ancho del panel = 1041.6px, coincide EXACTO (mismo ancho, mismo
      borde izquierdo) con el ancho del banner informativo - confirma
      ancho completo real, no una franja centrada. `getBBox()`:
      márgenes positivos en los 4 lados (nada recortado). Tooltip
      funcional (hover). Sin errores de consola. Captura visual
      confirma el panel ocupando todo el ancho bajo el sidebar, sin
      espacio vacío a los lados, y todo el contenido (banner + leyenda
      + panel) visible sin scroll.
    - **2560×1080 (pantalla panorámica ancha)**: `scrollDiff: 0` (sin
      scroll). Ancho del panel = 2235.2px, coincide EXACTO con el
      ancho del banner. `getBBox()`: márgenes positivos. Tooltip
      funcional. Sin errores de consola.
    - **1600×900 (ventana intermedia)**: `scrollDiff: 0` (sin scroll).
      Ancho del panel = 1275.2px, coincide EXACTO con el ancho del
      banner. `getBBox()`: márgenes positivos. Tooltip funcional. Sin
      errores de consola. Captura visual confirma ambas condiciones a
      la vez (ancho completo + todo visible sin scroll).
    - Verificación adicional (no pedida explícitamente, pero para
      confirmar que no se rompió lo ya logrado): **395×895 (angosto/
      tablet)** - el panel sigue usando el ancho completo disponible
      (332px, igual al área de contenido menos el padding del
      `<main>`), sin recortes (`getBBox()`), tooltip funcional. Sí
      aparece un scroll de ~284px en este caso - esperado y aceptado
      explícitamente por el usuario para pantallas angostas (el
      banner informativo envuelve a más líneas de texto en un
      contenedor angosto, superando la reserva vertical calibrada
      para layouts anchos) - mismo comportamiento ya aceptado en la
      ronda anterior para este caso límite.
- DECISIÓN (2026-09-16): sexta ronda - el panel ya era ancho completo y
  sin scroll (ronda 5), pero el CONTENIDO (puntos + túnel) quedaba
  chico y centrado dentro de un `viewBox` grande, con mucho espacio
  vacío alrededor - confirmado con captura real del usuario.
  - **Diagnóstico con números reales** (navegador real, `getBBox()` del
    contenido contra el `viewBox`): con el aspecto real de un panel
    panorámico (ej. 3.74:1 a 1536px de ancho), el contenido ocupaba
    solo **26.8% del ancho** del `viewBox` pero **94.8% del alto** - el
    alto ya estaba bien aprovechado (`alto = base`, ligado de cerca a
    la extensión real de los puntos), pero `ancho = base * aspecto`
    estiraba el `viewBox` para igualar el aspecto EXACTO del panel sin
    ningún límite, y como los puntos reales son casi cuadrados
    (~1.05-1.16:1), la mayor parte de ese ancho estirado quedaba vacío
    (grid sin contenido real). Matemáticamente, con un panel mucho más
    ancho que el contenido, esto es inevitable si se insiste en que el
    `viewBox` iguale el aspecto exacto del panel sin distorsionar el
    contenido - hay que elegir entre estirar el `viewBox` (contenido
    chico) o limitarlo (el panel deja de llenarse al 100% con el
    dibujo, aunque el PANEL en sí sigue siendo ancho completo).
  - **Arreglo - `ASPECTO_VIEWBOX_MAX = 1.5`**: se acota el aspecto que
    puede tomar el `viewBox` (no el del panel/contenedor, que sigue
    sin límite - ver ronda 5) a un máximo de 1.5:1, cercano al aspecto
    real de los datos (~1.05-1.16:1) con algo de aire. Cuando el
    aspecto real del panel supera este límite, el `<svg>` deja de
    estirarse hasta ahí; en su lugar se centra dentro del panel vía
    `preserveAspectRatio="xMidYMid meet"` (el default, ahora explícito
    en el código) - el dibujo (papel técnico + túnel + marcadores) pasa
    a verse como una lámina bien proporcionada y centrada, con margen
    del propio fondo blanco del panel a los lados, en vez de una tira
    estirada. El límite se acota simétricamente
    (`[1/ASPECTO_VIEWBOX_MAX, ASPECTO_VIEWBOX_MAX]`) para cubrir también
    el caso opuesto (panel angosto y alto).
  - **`RADIO_RATIO` subido de 0.039 a 0.05**: el límite de aspecto por
    sí solo no agranda los marcadores (la escala real - píxeles de
    pantalla por unidad - sigue determinada por ajustar el alto del
    contenido al alto disponible, que ya estaba cerca del máximo antes
    del cambio); para que "los marcadores, etiquetas y el túnel se vean
    grandes y claros" como pidió la tarea, hacía falta agrandarlos
    también en relación a la extensión real de los puntos. Los
    `MARGEN_*` (multiplos de `radio`) escalan automáticamente con este
    cambio, sin necesitar ajuste aparte.
  - **Resultado medido** (mismo método `getBBox()`, con el aspecto real
    del panel en cada resolución): ocupación del contenido subió de
    ~27%/95% a **81.4% de ancho / 94.7% de alto** del `viewBox` en las
    3 resoluciones de prueba (todas caen en el aspecto acotado a 1.5,
    ya que las 3 superan ese límite) - con el radio de marcador también
    ~28% más grande en píxeles de pantalla que antes del cambio de
    `RADIO_RATIO`.
  - **Nota metodológica sobre la verificación**: la pestaña de pruebas
    de este navegador automatizado corre en segundo plano
    (`document.hidden = true`), y Chrome throttlea `ResizeObserver` en
    pestañas no enfocadas (comportamiento estándar del navegador, no un
    bug) - el `aspecto` medido se queda pegado en el valor de respaldo
    (`ASPECTO_POR_DEFECTO`) en vez de actualizarse al aspecto real. Esto
    NO afecta a un usuario real con la pestaña enfocada. Para verificar
    la lógica de todas formas de manera rigurosa, se recalculó
    manualmente `calcularEscala()` (con las mismas constantes y los
    puntos reales leídos del DOM) para varios valores de aspecto,
    incluyendo el aspecto EXACTO medido en cada una de las 3
    resoluciones de prueba - confirmando que el acotado y la ocupación
    resultante son correctos independientemente de si `ResizeObserver`
    disparó o no en esta pestaña de prueba en particular.
  - Verificación en navegador real, en las mismas 3 resoluciones de la
    ronda anterior (método de iframe real embebido, login real, datos
    reales de la Estación Chicamocha):
    - **1366×768 (laptop estándar)**: sin scroll (`scrollDiff: 0`).
      Ancho del panel = 1041.6px, coincide exacto con el banner (ancho
      completo intacto). `getBBox()`: márgenes positivos en los 4 lados
      (nada recortado). Ocupación del contenido: 81.4% ancho / 94.7%
      alto del `viewBox` (antes ~27%/95%). Tooltip funcional. Sin
      errores de consola. Captura visual confirma el dibujo
      notablemente más grande y centrado, con margen blanco genuino a
      la derecha (antes grid estirado con puntos dispersos).
    - **2560×1080 (panorámica ancha)**: sin scroll. Ancho del panel =
      2235.2px, coincide exacto con el banner. Márgenes positivos.
      Misma ocupación (81.4%/94.7%, el aspecto acotado da el mismo
      resultado en cualquier panel que supere 1.5:1). Tooltip
      funcional. Sin errores de consola. Captura visual confirma el
      panel sigue siendo ancho completo, con el dibujo centrado y un
      margen blanco considerable a los lados - un trade-off deliberado
      e inevitable dado que el contenido real es casi cuadrado y el
      panel es mucho más ancho (ver diagnóstico arriba).
    - **1600×900 (ventana intermedia)**: sin scroll. Ancho del panel =
      1275.2px, coincide exacto con el banner. Márgenes positivos.
      Misma ocupación. Tooltip funcional. Sin errores de consola.
      Captura visual confirma las 3 condiciones a la vez (ancho
      completo + sin scroll + contenido notablemente más grande).
    - Verificación adicional (no pedida explícitamente, para confirmar
      que no se rompió lo ya logrado): **395×895 (angosto)** - sigue a
      ancho completo, sigue con el scroll de ~284px ya aceptado en la
      ronda anterior (sin cambios de esta ronda), sin recortes. Se
      verificó también manualmente la rama simétrica del acotado
      (aspecto de panel < 1, caso de panel angosto y muy alto): el
      aspecto se acota hacia arriba a `1/1.5 ≈ 0.667`, dando 100% de
      ocupación en ancho y 64.5% en alto - correcto y simétrico.
- DECISIÓN (2026-09-16): séptima ronda - la ronda anterior acotó el
  aspecto del `viewBox` (`ASPECTO_VIEWBOX_MAX = 1.5`) para que el
  contenido no quedara diminuto, pero como consecuencia el `<svg>`
  dejaba de estirarse hasta el ancho real del panel en pantallas
  panorámicas, mostrando margen blanco genuino a los lados (letterbox)
  - confirmado con captura real del usuario, quien señaló que ESE
  margen (el mismo que la ronda anterior introdujo a propósito) también
  se sentía como espacio vacío a los lados. El problema de fondo: un
  solo factor de escala ISOTRÓPICO (igual en X y en Y, para no
  deformar los marcadores) obliga a elegir entre "el viewBox llena el
  panel pero el contenido queda chico" o "el contenido llena el viewBox
  pero el viewBox no llena el panel" - nunca ambas cosas con un único
  factor, si el panel y los datos no comparten el mismo aspecto.
  - **Arreglo - dos factores de POSICIÓN independientes**: en
    `calcularEscala` (`PlanoPuntosControl.jsx` - la lógica de escala/
    viewBox vive ahí, no en `frontend/src/lib/layoutPlano.js`, que solo
    tiene el presupuesto de alto disponible; se deja esta aclaración
    explícita para quien busque el archivo por el nombre de la tarea),
    las POSICIONES de los puntos (dónde cae cada uno en el plano) ahora
    se escalan con `escalaX` y `escalaY` INDEPENDIENTES: `escalaY = 1`
    siempre (el alto del `viewBox` es una referencia directa a la
    extensión real de los puntos en Y, sin estirar) y
    `escalaX = ancho_viewBox / ancho_contenido_crudo`, donde
    `ancho_viewBox = alto_viewBox * aspecto_real_del_panel` (ya sin
    acotar - `ASPECTO_VIEWBOX_MAX` se eliminó por completo, quedó
    obsoleto). Esta misma fórmula funciona para paneles angostos
    (`aspecto < 1`, `escalaX` da menor a 1 y comprime en vez de
    estirar) sin necesitar una rama aparte - a diferencia de la lógica
    con ramas explícitas de rondas anteriores.
  - **El TAMAÑO de cada elemento sigue siendo uniforme**: `radio =
    radioRaw * Math.min(escalaX, escalaY)` - un solo factor para el
    radio del marcador, grosor de línea del túnel, tamaño del chip, la
    rosa de los vientos y el portal de "Entrada", para que nada se vea
    estirado ni aplastado. Se usó el MENOR de los dos factores de
    posición (no el promedio) para que un marcador nunca termine más
    grande que el espacio que la propia distribución de puntos le deja
    en su eje más comprimido.
  - **Las posiciones YA transformadas se usan en TODO el resto del
    dibujo** (no solo en los marcadores): `calcularEscala` devuelve
    `puntosTransformados` (cada punto con `coord_x`/`coord_y` en
    espacio de dibujo) y eso es lo que alimenta
    `construirEstructuraTunel`, la búsqueda del punto "0"
    (`puntoEntrada`) y el `.map()` de marcadores - nunca los `puntos`
    crudos que llegan por props. Esto es necesario porque
    `segmentoCurva` (la curva del túnel) calcula un offset
    PERPENDICULAR basado en la distancia entre dos puntos - ese cálculo
    solo da un resultado visualmente correcto si se hace DESPUÉS de
    aplicar el escalado anisotrópico (perpendicular en el espacio ya
    dibujado, que es el que se ve en pantalla), no antes.
  - **Bug encontrado y corregido en el camino**: el tooltip
    (`TooltipContenido`) mostraba `punto.coord_x`/`coord_y` como las
    coordenadas reales de topografía del punto - con el cambio, esos
    campos pasaron a ser posiciones de DIBUJO (ya escaladas
    anisotrópicamente), no datos reales. Se agregaron
    `coordXOriginal`/`coordYOriginal` a `puntosTransformados`
    (preservando los valores originales de `coord_x`/`coord_y` antes de
    transformar) y el tooltip ahora usa esos campos - verificado en
    navegador real que el tooltip del punto "0" sigue mostrando "x:
    1000.0 · y: 1000.0" (las coordenadas reales), no un valor
    transformado sin sentido.
  - **`AIRE_RATIO = 0.04`**: un respiro parejo del 4% en ambos ejes,
    más allá del margen ya calculado por `MARGEN_*` (que sigue
    protegiendo contra recortes de marcadores/chips/portal/rosa igual
    que antes) - sin este respiro el contenido tocaría el borde exacto
    del panel (ocupación 100% por construcción, matemáticamente
    garantizada por cómo se derivan `escalaX`/`escalaY` a partir del
    mismo `ancho`/`alto` que definen), lo cual se sentía demasiado
    ajustado. Con el respiro, la ocupación medida es ~96.2%/96.2% en
    cualquier aspecto de panel - consistente, sin importar qué tan
    panorámica sea la pantalla (a diferencia de rondas anteriores,
    donde la ocupación variaba según el aspecto).
  - Verificación en navegador real, en las mismas 3 resoluciones de
    rondas anteriores (método de iframe real embebido, login real,
    datos reales de la Estación Chicamocha) - se verificaron
    explícitamente las 4 condiciones pedidas en cada una:
    - **1366×768 (laptop estándar)**: (a) contenido bien distribuido -
      ocupación 92.9% ancho / 94.4% alto del `viewBox` medida con
      `getBBox()` (con el aspecto real 2.88 recalculado manualmente:
      96.2%/96.2%, ver nota metodológica abajo); (b) los 7 marcadores
      verificados con `getBoundingClientRect()` dan `ratio: "1.0000"`
      (ancho de pantalla == alto de pantalla, círculos perfectos, no
      óvalos); (c) sin scroll (`scrollDiff: 0`); (d) `getBBox()`:
      márgenes positivos en los 4 lados, nada cortado. Ancho del panel
      = 1041.6px, coincide exacto con el banner (ancho completo
      intacto). Tooltip funcional, mostrando las coordenadas reales
      ("x: 1000.0 · y: 1000.0"). Sin errores de consola. Captura visual
      confirma el contenido distribuido a lo ancho del panel, círculos
      visiblemente redondos.
    - **2560×1080 (panorámica ancha)**: mismas 4 condiciones
      verificadas - los 7 marcadores con `ratio: "1.0000"`; sin scroll;
      ocupación 92.9%/94.4% medida (96.2%/96.2% con el aspecto real
      3.33, recalculado manualmente); panel = 2235.2px, coincide exacto
      con el banner; márgenes positivos; tooltip funcional; sin errores
      de consola.
    - **1600×900 (ventana intermedia)**: mismas 4 condiciones - los 7
      marcadores con `ratio: "1.0000"`; sin scroll; ocupación
      92.9%/94.4% medida (96.2%/96.2% con el aspecto real 2.58,
      recalculado manualmente); panel = 1275.2px, coincide exacto con
      el banner; márgenes positivos; tooltip funcional; sin errores de
      consola. Captura visual confirma las 4 condiciones a la vez.
    - Verificación adicional (no pedida explícitamente, para confirmar
      que no se rompió lo ya logrado): **395×895 (angosto)** - los 7
      marcadores siguen con `ratio: "1.0000"` (círculos perfectos
      también en angosto), sigue a ancho completo, sigue con el scroll
      de ~284px ya aceptado en rondas anteriores (sin relación con este
      cambio), sin recortes.
    - **Nota metodológica sobre la verificación**: igual que en la
      ronda anterior, la pestaña de pruebas de este navegador
      automatizado corre en segundo plano (`document.hidden = true`),
      y Chrome throttlea `ResizeObserver` ahí - el `aspecto` medido por
      la app se queda pegado en el valor de respaldo
      (`ASPECTO_POR_DEFECTO = 16/9 ≈ 1.78`) en vez de actualizarse al
      aspecto real del panel en cada resolución (2.88, 3.33, 2.58).
      Esto NO afecta a un usuario real con la pestaña enfocada. La
      ocupación medida con `getBBox()` en el navegador (92.9%/94.4%) ya
      es una mejora real y contundente sobre la ronda anterior
      (81.4%/94.7%) incluso con el aspecto de respaldo - y para
      confirmar el comportamiento con el aspecto EXACTO de cada
      resolución, se recalculó `calcularEscala()` manualmente (mismas
      constantes, puntos reales leídos del DOM) con cada aspecto real
      medido, dando 96.2%/96.2% de forma consistente en las 3
      resoluciones - la fórmula garantiza esa ocupación
      independientemente del aspecto, por construcción.
- DECISIÓN (2026-09-16): octava ronda - se agregó una textura de fondo
  sutil tipo "papel de plano técnico de ingeniería" (hachurado diagonal)
  al panel de `PlanoPuntosControl.jsx`, para un acabado más "producido"
  sin usar ninguna imagen externa ni literal (decisión ya tomada en
  rondas previas: todo generado por el sistema).
  - **Implementación**: un `<pattern id={idHachura}>` de SVG puro, con
    una sola `<line>` vertical y `patternTransform="rotate(45)"` (tiling
    diagonal sin calcular la diagonal a mano), en una capa `<rect>`
    propia entre el color base del panel (`fill-mg-surface-50`) y la
    capa del grid existente (`idGrid`) - el hachurado va DEBAJO del
    grid para que la cuadrícula siga siendo la referencia visual
    dominante.
  - **Densidad y opacidad probadas** (mínimo 2 variaciones, pedido
    explícito de la tarea): `escala.alto/30` (grueso, se leía casi como
    un segundo grid, descartado), `escala.alto/55` con
    `stroke-mg-navy-900/8` (aceptable pero aún se leía como líneas
    individuales) y `escala.alto/90` con `stroke-mg-navy-900/8` +
    `strokeWidth = escala.alto * 0.0016` (elegida: a esa densidad el
    hachurado se funde con el grano del grid y se lee como textura de
    papel, no como un segundo set de líneas). También se probó
    `stroke-mg-navy-900/4` con stroke más fino (`* 0.0009`): resultó
    prácticamente invisible en pantalla real, descartado.
  - **Lección metodológica**: Tailwind v4 (JIT vía `@tailwindcss/vite`)
    solo genera CSS para clases que existen literalmente en archivos
    fuente al momento del build/dev - una clase inyectada en runtime vía
    `element.className` en el DOM vivo (para probar opacidades
    rápidamente) es un no-op silencioso si esa clase no aparece ya en
    algún `.jsx`. Cualquier ajuste futuro de opacidad/stroke en
    elementos SVG con clases de Tailwind debe probarse editando el
    archivo fuente + recarga real (HMR de Vite), nunca inyectando clases
    por `javascript_tool` en el DOM.
  - Verificado en navegador real (login con usuario de prueba, datos
    reales de la Estación Chicamocha): textura visible de cerca (zoom)
    pero sutil a escala de panel completo; los 7 marcadores, chips,
    túnel, rosa de los vientos y el portal de "Entrada" siguen
    perfectamente legibles; tooltip funcional (click en punto muestra
    datos correctos); sin errores de consola; probado en 1366×768 y con
    la ventana redimensionada a 1920×1080 (el entorno de pruebas no
    permitió una resolución panorámica completa de 2560×1080 por límite
    de espacio visible de pantalla del entorno automatizado - no es una
    limitación de la app).
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
- VERIFICACIÓN (2026-09-18): se reportó como hallazgo de pruebas
  manuales que en `ModalProponerCambio.jsx` el campo para identificar
  el punto de control objetivo en EDITAR/ELIMINAR era texto libre. Al
  revisar el código en la rama `feature/dropdown-editar-punto` (al día
  con `develop`), ese campo **ya era un `<select>`** desde su único
  commit de origen (`7820314`, 2026-09-13) — no texto libre: usa
  `puntos` (poblado vía `listarPuntosControl`), filtra por `activo`, y
  el `value` de cada `<option>` es el `id` real del punto
  (`ModalProponerCambio.jsx` líneas ~121-140). No se requirió ningún
  cambio de código esta sesión — el "hallazgo" ya estaba resuelto en
  el código actual (posible causa: prueba manual contra una versión
  vieja/cacheada del frontend, no se pudo confirmar la causa exacta).
  - Verificado end-to-end en navegador real (usuario trabajador de
    prueba, creado vía API por rechazo de dominios `.test` en la
    validación de email — ver detalle abajo) + consulta directa a
    `mineguard_db`: se propuso una edición del punto id 4
    (`nombre_estacion="3"`) seleccionándolo del dropdown, y la fila
    resultante en `solicitudes_cambio_punto_control` (id 5) mostró
    `punto_control_id=4` — el mismo id del punto seleccionado — con
    `datos_propuestos={"coord_z": 9999.99}`, confirmando el mapeo
    correcto entre la opción elegida en el UI y el id real que espera
    el backend.
  - Efecto colateral de la prueba (reportado según metodología): se
    creó un usuario trabajador temporal
    (`qa.dropdown.temporal@mineguard-qa.example.com`, id 43 — se usó
    `.example.com` porque `POST /api/auth/register` rechaza dominios
    `.test` por validación estricta de email) y la solicitud de
    cambio id 5 ya descrita. Ambos se eliminaron al terminar la
    verificación; limpieza confirmada con `SELECT COUNT(*)` total (no
    solo filtro por patrón) sobre las 3 tablas involucradas:
    `usuarios` (5, igual que antes), `solicitudes_cambio_punto_control`
    (2, igual que antes) y `puntos_control` (8, sin cambios — la
    solicitud nunca se aprobó, así que la tabla de puntos nunca se
    tocó).
  - Nota aparte (resuelta en la tarea siguiente, ver DECISIÓN
    2026-09-18 más abajo): el texto de cada `<option>` del dropdown en
    ese momento era `"{nombre_estacion} (estación #{estacion_id})"`
    (ej. "3 (estación #1)"), no el formato "Punto 3 - Estación
    Chicamocha" pedido originalmente.
- DECISIÓN (2026-09-18): se mejoró la etiqueta del dropdown "Punto de
  control existente" de `ModalProponerCambio.jsx` (nota pendiente de
  la entrada anterior) a `"Punto {nombre_estacion} - {estacion_nombre}"`
  (ej. "Punto 3 - Estación Chicamocha"), usando el nombre real de la
  estación en vez de inventarlo o mostrar solo su id.
  - **Backend**: `GET /api/puntos-control` (y el resto de endpoints
    que devuelven `PuntoControlRespuesta` — crear/actualizar directo)
    no traía el nombre de la `Estacion`, solo su `estacion_id` — no
    existe (y sigue sin existir) un endpoint dedicado a listar
    Estaciones (ver limitación ya documentada). Se extendió el
    `PuntoControl` existente en vez de crear un endpoint nuevo:
    - `backend/app/models/punto_control.py`: la relación `estacion`
      (ya existía, apuntando 1-a-1 al `Estacion` real vía
      `estacion_id`) ganó `lazy="selectin"` — mismo patrón que ya
      usan `PuntoControl.telemetrias`, `Estacion.puntos_control`, etc.
      en este mismo archivo/proyecto para relaciones seguras de leer
      en contexto async (SQLAlchemy con asyncpg no soporta lazy-load
      implícito fuera de un `await`; `selectin` sí, con un query
      adicional propio). Se agregó también una `@property
      estacion_nombre` de solo lectura (`self.estacion.nombre`), sin
      tocar ninguna columna mapeada.
    - `backend/app/schemas/punto_control.py`: `PuntoControlRespuesta`
      ganó el campo `estacion_nombre: str` — Pydantic lo resuelve solo
      vía `from_attributes=True` leyendo la property nueva del ORM,
      sin necesitar un validador manual.
    - Sin migración de Alembic (no se tocó ninguna columna de BD, solo
      lectura de una relación que ya existía) y sin cambios en
      `datos_propuestos`/`SolicitudCambioCrear` (la solicitud sigue
      guardando y aplicando solo `estacion_id`, nunca el nombre).
    - Verificado que no rompe nada existente: `pytest` completo del
      backend, 76/76 pruebas verdes sin tocar ninguna (ninguna hacía
      assert de igualdad exacta de claves en la respuesta, así que
      agregar un campo no las afecta).
  - **Frontend**: `ModalProponerCambio.jsx`, el `<option>` de
    `puntosActivos` ahora arma
    `` `Punto ${p.nombre_estacion} - ${p.estacion_nombre}` `` en vez
    de mostrar el `estacion_id` numérico crudo. Cambio acotado a ese
    único selector (el de "Estación" en `CamposPuntoControl.jsx`, que
    lista estaciones por id porque no hay endpoint para listarlas por
    nombre, y las demás pantallas que muestran `#{estacion_id}`, no se
    tocaron — no fue parte de lo pedido).
  - Verificado en navegador real (usuario trabajador de prueba,
    reutilizando el mismo patrón de la entrada anterior — dominio
    `.example.com`, no `.test`, por la misma validación de email ya
    documentada): el dropdown mostró las 7 opciones como
    "Punto 0 - Estación Chicamocha" .. "Punto 6 - Estación Chicamocha"
    (dato real desde la BD, no texto inventado); se propuso una
    edición sobre el punto "3" (id real 4) y en
    `solicitudes_cambio_punto_control` quedó
    `punto_control_id=4`/`datos_propuestos={"coord_z": 8888.88}` —
    mapeo correcto confirmado de nuevo tras el cambio.
  - Efecto colateral de la prueba (igual que la entrada anterior,
    mismo patrón): usuario trabajador temporal (id 44, mismo correo
    `.example.com` reutilizado tras recrear la cuenta) y la solicitud
    de cambio id 6. Ambos eliminados al terminar; limpieza confirmada
    con `SELECT COUNT(*)` total sobre las 3 tablas: `usuarios` (5),
    `solicitudes_cambio_punto_control` (2) y `puntos_control` (8) —
    todas de vuelta a la línea base previa a ambas tareas de
    verificación de esta rama.

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

- DECISIÓN (2026-09-17): implementado el flujo de Google OAuth 2.0 en
  el backend (frontend queda para la siguiente tarea). Librería:
  **Authlib** (`authlib.integrations.starlette_client.OAuth`, cliente
  registrado en `app/core/oauth.py` vía `server_metadata_url` de Google
  para descubrimiento automático + validación de `id_token`). Nuevas
  dependencias en `requirements.txt`: `authlib`, `httpx` (cliente HTTP
  async que usa Authlib internamente), `itsdangerous` (lo requiere
  `SessionMiddleware` de Starlette, agregado en `main.py`, para guardar
  el `state`/`nonce` anti-CSRF entre `/login` y `/callback` — reutiliza
  `settings.secret_key`, sin env var nueva).
  - Primera versión de esta tarea (mismo día) había implementado un
    RECHAZO simple cuando el `Usuario` no existía. **Esa versión quedó
    reemplazada** por el diseño de abajo (mismo día, después de que el
    usuario resolvió 3 decisiones de negocio pendientes) — se deja esta
    nota para que quien lea el historial no se quede con la versión
    vieja.
  - **Los 4 endpoints** (`app/api/auth_google.py`, registrado con
    prefijo `/api/auth` en `main.py`, junto al router de auth por
    correo/contraseña que sigue intacto):
    1. `GET /api/auth/google/login`: redirige a la pantalla de
       consentimiento de Google (`oauth.google.authorize_redirect`) con
       `redirect_uri` fijo `http://localhost:8000/api/auth/google/callback`
       (ya registrado en Google Cloud Console — hardcodeado como
       constante, mismo patrón que el link de `forgot-password` en
       `auth.py`, no viene de env var).
    2. `GET /api/auth/google/callback`: intercambia el código por el
       perfil (`email`, `name`, `sub` como `google_id`) vía
       `oauth.google.authorize_access_token`. Busca un `Usuario` por
       `email` y NUNCA emite el JWT/token directamente en esta
       respuesta — solo genera un `OAuthExchangeCode` (ver modelo
       abajo) de un solo uso y 5 minutos de vida, y redirige con
       `?code=<codigo_opaco>`:
       - **Si el `Usuario` ya existe** (decisión 2, confirmada por el
         usuario): se vincula automáticamente — `google_id` se asigna
         solo si estaba vacío (no se pisa un `google_id` ya vinculado),
         `ultimo_acceso` se actualiza. `metodo_registro` se deja
         **tal cual estaba** (decisión explícita: refleja cómo se creó
         la cuenta originalmente, no el último método usado para
         entrar — igual que ya no se pisa `google_id`). Se crea un
         `OAuthExchangeCode` tipo `LOGIN` (con `usuario_id`) y redirige
         a `http://localhost:5173/dashboard?code=<codigo>`.
       - **Si el `Usuario` NO existe** (decisión 1, confirmada por el
         usuario): NO se crea nada todavía — se guardan `email`,
         `nombre_google` y `google_id` (ya verificados por Google) en
         un `OAuthExchangeCode` tipo `REGISTRO_PENDIENTE`, y redirige a
         `http://localhost:5173/completar-registro-google?code=<codigo>`
         (ruta de frontend pendiente, ver abajo).
    3. `POST /api/auth/exchange` (decisión 3, confirmada por el
       usuario: mecanismo único de entrega para ambos casos, para que
       el JWT/datos sensibles nunca aparezcan en la URL del navegador
       ni en su historial — la URL del redirect solo lleva un código
       opaco de un solo uso). Recibe `{"codigo": "..."}`, valida que
       exista, no esté usado y no haya expirado (si falla cualquiera
       de las 3 condiciones: 400 genérico "código inválido, ya se usó,
       o expiró" — mismo mensaje para las 3 causas, para no filtrar
       cuál aplica) y lo marca `usado=True` de inmediato (un código
       nunca se puede canjear dos veces). Según el `tipo` guardado:
       - `LOGIN`: genera el JWT final AQUÍ (no en el callback), para
         que su ventana de validez de 60 min empiece a contar desde el
         intercambio real, no desde el redirect. Responde
         `{"resultado": "login", "access_token": "...", "token_type": "bearer"}`.
       - `REGISTRO_PENDIENTE`: genera el `registro_token` (JWT propio,
         15 min, claim `"tipo": "registro_google_pendiente"` + `email`
         + `google_id`, SIN `"sub"` — a propósito, para que jamás pueda
         usarse como Bearer token de sesión: `get_current_user` en
         `auth.py` ahora envuelve el `int(usuario_id)` en
         `try/except (ValueError, TypeError)` porque este token no
         tiene un `sub` numérico y antes eso hubiera sido un 500 sin
         controlar en vez de un 401 limpio). Responde
         `{"resultado": "registro_pendiente", "registro_token": "...", "email": "...", "nombre": "..."}`
         (el `nombre` es el que vino de Google, editable por el
         usuario en el formulario de completar registro).
    4. `POST /api/auth/google/completar-registro`: recibe
       `registro_token` + `apellidos`/`telefono`/`tipo_documento`/
       `numero_documento` (obligatorios, igual que el registro normal)
       + `nombre` (puede ser el mismo que vino de Google o uno editado
       por el usuario). Decodifica y valida el `registro_token`
       (firma + expiración vía `decode_access_token`, y el claim
       `"tipo"` — si no es exactamente `"registro_google_pendiente"`,
       400, para que un JWT de sesión normal no se pueda reusar aquí).
       Revalida unicidad de `email` y `numero_documento` (409 si ya
       existen — cubre la carrera donde alguien completó el registro
       por correo/contraseña con ese mismo email mientras el
       `registro_token` seguía vigente). Crea el `Usuario` con
       `rol=RolUsuario.TRABAJADOR` fijo (mismo criterio de seguridad
       que `auth.py`: el rol nunca se acepta del cliente),
       `metodo_registro=GOOGLE`, `google_id` del token. Responde
       `TokenRespuesta` — **exactamente el mismo shape que
       `POST /api/auth/login`**.
  - **Modelo nuevo**: `OAuthExchangeCode`
    (`app/models/oauth_exchange_code.py`, tabla
    `oauth_exchange_codes`, migración `4ff2deab983b` — aplicada a
    `mineguard_db`) — mismo patrón que `PasswordResetToken` (código
    único indexado, `fecha_expiracion`, `usado`), extendido con `tipo`
    (enum `LOGIN`/`REGISTRO_PENDIENTE`), `usuario_id` nullable (solo
    `LOGIN`) y `email`/`nombre_google`/`google_id` nullable (solo
    `REGISTRO_PENDIENTE`). Es una tabla nueva con enum inline en
    `create_table` — no aplica el bug conocido de Alembic+Enum
    (`create_type=False` manual), que solo afecta `op.add_column`
    sobre tablas ya existentes (ver nota de la migración
    `9dd2b7ffdaeb` más arriba).
  - **Limitación conocida (aceptada para esta fase)**: los
    `OAuthExchangeCode` viven en Postgres (no en memoria), así que
    sobreviven un reinicio del backend — pero no hay un job de
    limpieza de códigos expirados/usados todavía; la tabla crece sin
    límite con el uso. Aceptable mientras el volumen de logins por
    Google sea bajo (fase de desarrollo); pendiente para una fase de
    endurecimiento (ej. un `DELETE` periódico de códigos expirados).
  - **Frontend implementado (2026-09-18)**, cerrando el pendiente de
    arriba:
    - `Login.jsx`: botón "Iniciar sesión con Google" (ícono oficial en
      SVG inline, separador "o continúa con") que navega con
      `window.location.href` (no una ruta de React Router — es
      cross-origin, sale del SPA) a
      `` `${API_BASE_URL}/api/auth/google/login` `` — usa la constante
      ya existente de `config.js`, nunca hardcodeada por componente.
      `Login.jsx` también ahora inicializa su caja de error existente
      desde `location.state?.errorMessage` (antes solo leía
      `successMessage`), reutilizada por el punto siguiente.
    - `App.jsx`: nuevo componente `ConCodigoGoogle` que envuelve la
      ruta `/dashboard`. Si la URL trae `?code=`, lo canjea en
      `POST /api/auth/exchange` (nueva función `exchangeCodigo` en
      `lib/api.js`); si `resultado === "login"`, guarda el
      `access_token` en `AuthContext` y hace
      `navigate("/dashboard", {replace:true})` (limpia el `?code=` de
      la URL sin agregar una entrada nueva al historial); si el
      intercambio falla (código inválido/usado/expirado, o una forma
      de respuesta inesperada), redirige a `/login` con
      `state: {errorMessage: "..."}`. Sin `?code=` en la URL (navegación
      normal a `/dashboard`), el wrapper no hace nada — `Dashboard`
      sigue funcionando exactamente igual que antes.
    - Página nueva `pages/CompletarRegistroGoogle.jsx`
      (`/completar-registro-google`, mismo estilo que `Registro.jsx`):
      al montar, canjea el `?code=` de la URL; sin `code` o si el
      canje falla, muestra una tarjeta de "Enlace inválido" con link a
      `/login` (nunca deja la pantalla en blanco). Si
      `resultado === "registro_pendiente"`, muestra un formulario con
      el email de Google en un campo deshabilitado (de solo lectura —
      el backend tampoco lo acepta del cliente, lo toma del
      `registro_token`) y el nombre prellenado pero editable, más
      apellidos/teléfono/tipo y número de documento (mismos campos y
      estilos que `Registro.jsx`). Al enviarlo, llama a
      `POST /api/auth/google/completar-registro` (nueva función
      `completarRegistroGoogle` en `lib/api.js`), guarda el
      `access_token` resultante en `AuthContext` y navega a
      `/dashboard`.
    - **Verificado end-to-end en navegador real** (no solo visualmente):
      el botón de Google disparó el flujo real completo dos veces en
      esta tarea — como la pestaña ya tenía sesión de Google activa,
      Google redirigió directo de vuelta sin pantalla de consentimiento
      manual. La primera vez confirmó que sin la ruta nueva la pantalla
      quedaba en blanco (el bug que esta tarea resolvía); tras
      implementar `CompletarRegistroGoogle.jsx`, la segunda vez mostró
      el formulario prellenado con el `email` y `nombre` REALES de la
      cuenta de Google usada, se completó con datos de prueba, y el
      envío creó el `Usuario` real, devolvió un JWT funcional y navegó
      a `/dashboard` ya autenticado (header mostrando el nombre y rol
      "Trabajador", plano de puntos de control cargado con datos
      reales). Sin errores de consola. El `Usuario` de prueba creado
      (con el email real de Google pero apellidos/documento
      claramente de prueba) se eliminó después — verificado por
      conteo total (5→4) — para que un login real de esa cuenta no
      quede con datos ficticios de perfil.
    - No se pudo probar con una cuenta de Google que NO tuviera sesión
      activa en el navegador (mostraría la pantalla de consentimiento
      real de Google, que requiere interacción manual humana) — ese
      paso puntual (la pantalla de consentimiento en sí) queda como
      verificación manual, igual que ya se hizo en la tarea del
      backend.
- BUG Y FIX (2026-09-18): el usuario reportó que, con una cuenta de
  Google nueva real, `/completar-registro-google` mostraba "enlace
  inválido/expirado" en el PRIMER intento tras volver de Google, pero
  un segundo intento completo (nuevo login de Google desde cero) sí
  funcionaba. **Causa raíz confirmada con evidencia real** (no
  asumida): se insertó un `OAuthExchangeCode` de prueba directamente
  en la BD (`tipo=REGISTRO_PENDIENTE`, `usado=false`) y se navegó a la
  URL real en el navegador con la pestaña Network abierta.
  - Con el código ANTES del fix: **2 peticiones POST reales** a
    `/api/auth/exchange` para una sola carga de página, ambas
    `200 OK` (evidencia: `read_network_requests` del navegador) — el
    código quedaba `usado=true` en la BD tras la primera, pero la
    segunda petición TAMBIÉN tuvo éxito y generó un segundo
    `registro_token` distinto, porque el endpoint hacía un
    SELECT (leer `usado`) y despues un UPDATE (escribir `usado=True`)
    como dos pasos separados — dos requests casi simultáneas podían
    leer `usado=False` ambas ANTES de que cualquiera confirmara su
    escritura (race condition / TOCTOU clásico). Con timings distintos
    (como probablemente le pasó al usuario) el resultado no es
    determinístico: a veces ambas tienen éxito, a veces la primera
    "gana" y la segunda (la que el usuario realmente ve en pantalla)
    llega tarde y encuentra el código ya usado → error.
  - **Por qué salían 2 peticiones reales**: `App.jsx` (`main.jsx`)
    tiene `<StrictMode>` activo (intencional, de React). En
    desarrollo, StrictMode invoca cada `useEffect` DOS veces (monta →
    limpia → monta de nuevo) para detectar efectos sin limpieza
    correcta. Tanto `CompletarRegistroGoogle.jsx` como el wrapper
    `ConCodigoGoogle` en `App.jsx` disparaban `exchangeCodigo(...)`
    directamente en el cuerpo del efecto, con solo una bandera local
    `cancelado` para IGNORAR el resultado de la invocación fantasma -
    pero esa bandera no cancela el `fetch` real, que ya sale hacia el
    backend y ya consume el código de un solo uso antes de que la
    invocación "real" pueda usarlo.
  - **Fix aplicado en DOS capas** (una sola no bastaba):
    1. **Backend** (`app/api/auth_google.py`,
       `POST /api/auth/exchange`): el SELECT+UPDATE separado se
       reemplazó por un único `UPDATE ... WHERE codigo=:codigo AND
       usado=false AND fecha_expiracion >= now() RETURNING *`. Postgres
       serializa las escrituras concurrentes sobre la misma fila: solo
       UNA puede encontrar `usado=false` y actualizarla; la otra ya no
       hace match (0 filas) y recibe el 400 de "código inválido". Esto
       hace que "de un solo uso" sea una garantía real a nivel de base
       de datos, sin importar la causa de la doble petición (StrictMode,
       doble-click, retry de red, o un intento malicioso de reuso) - es
       la corrección de fondo.
    2. **Frontend** (`CompletarRegistroGoogle.jsx` y `App.jsx`): se
       reemplazó la bandera `cancelado` por un guard `useRef` que
       recuerda qué `codigo` ya disparó la petición real
       (`codigoYaCanjeadoRef.current === codigo`), evitando que la
       segunda invocación de StrictMode dispare un segundo `fetch` -
       deja de desperdiciarse el código y el usuario ya no ve el error
       en el camino feliz. Es un complemento de UX/eficiencia al fix
       del backend, no un sustituto: sin el fix del backend, cualquier
       OTRA causa de doble-submit (no solo StrictMode) seguiría
       pudiendo generar dos tokens válidos de un solo código.
  - **Verificación real de ambos fixes** (no solo lectura de código):
    - Frontend: mismo método de reproducción (código de prueba en BD +
      navegación real + Network tab), con el log de red limpiado
      explícitamente entre cada prueba para evitar falsos positivos
      por acumulación de requests de pruebas anteriores (error
      metodológico propio detectado y corregido en el camino) — tras
      el fix, exactamente **1 petición POST** por carga de página,
      confirmado en una prueba aislada y limpia.
    - Backend: script temporal que disparó 2 peticiones POST
      GENUINAMENTE concurrentes (`asyncio.gather`) al mismo código
      contra el servidor real — resultado: exactamente una `200` y una
      `400`, nunca dos `200`. Script y su resultado no se guardan en
      el repo (temporal, criterio ya establecido en este proyecto).
  - Registro de prueba (`oauth_exchange_codes`, código
    `ronda12_debug_test_codigo_001`) eliminado al terminar — verificado
    por conteo total (6→5 en `oauth_exchange_codes`; `usuarios` se
    mantuvo en 4 todo el tiempo, este código nunca llegó a crear un
    Usuario).
  - **Lección para futuros códigos de un solo uso en este proyecto**:
    cualquier tabla tipo "canjear una vez" (este patrón, o
    `PasswordResetToken` si en el futuro se le agrega concurrencia)
    debe marcar el registro como usado con un UPDATE condicionado
    (`WHERE usado=false ...`) devuelto con `RETURNING`, nunca con un
    SELECT seguido de una escritura separada - el camino
    "leer-después-escribir" no es seguro ante requests concurrentes,
    ni siquiera dentro de un solo navegador (StrictMode ya demuestra
    que "un solo usuario, una sola pestaña" puede producir requests
    concurrentes reales).

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
  - **NOTA (2026-09-18)**: la frase anterior sobre `nivel_alerta` como
    placeholder quedó desactualizada por una tarea posterior — el motor
    de umbrales reales (Decreto 1886) ya está activo desde el
    2026-09-1x (ver el aviso vigente en el Dashboard del frontend); se
    señala aquí en vez de corregir la entrada original, según la regla
    6 de `CLAUDE.md` (no editar retroactivamente sin marcar el punto).
- DECISIÓN (2026-09-18): tercer modo de ingesta — **generador continuo**
  (el "tiempo real" sintético mencionado como fase aparte arriba), 3
  endpoints nuevos en `app/api/telemetria.py`, todos bajo el prefijo ya
  existente `/api/telemetria`:
  - `POST /generador-continuo/iniciar` (rol mínimo admin, dependencia
    `requiere_rol(RolUsuario.ADMIN)` ya existente). Body
    `{"intervalo_segundos": int}` validado por Pydantic con `ge=5`
    (pedido explícito, evita saturar la BD) y `le=3600` (tope de
    sensatez propio, un intervalo mayor a 1h no tiene sentido como modo
    "continuo"). Si ya hay una tarea corriendo: 409 con mensaje
    explícito indicando que hay que detenerla primero — nunca permite
    dos tareas concurrentes.
  - `POST /generador-continuo/detener` (rol mínimo admin). Si no hay
    ninguna tarea corriendo: 409 explícito (nunca un 500 genérico).
    Cancela la tarea (`asyncio.Task.cancel()` + `await` capturando
    `CancelledError`) antes de responder, así que al recibir la
    confirmación ya no va a insertar una lectura más.
  - `GET /generador-continuo/estado` (rol mínimo trabajador — cualquiera
    puede consultar, solo admin puede cambiar el estado). Devuelve
    `{"corriendo": bool, "intervalo_segundos": int|null, "iniciado_en": datetime|null}`.
  - **Diseño técnico** (investigado con context7 la documentación
    vigente de FastAPI antes de implementar): `BackgroundTasks` de
    FastAPI se descartó a propósito — está pensado para una tarea que
    corre UNA VEZ después de responder la request (ej. mandar un
    correo), no para un bucle controlable que sigue vivo entre
    requests y se puede arrancar/detener desde endpoints distintos. Se
    usó `asyncio.create_task(...)` en su lugar, con una referencia al
    `Task` guardada en una variable de módulo
    (`_generador_continuo_task`, mismo patrón ya usado por
    `_modelo_activo_cache` para el cache del modelo ML), protegida por
    un `asyncio.Lock` propio para que dos llamadas a `/iniciar` casi
    simultáneas nunca creen dos tareas.
  - **Reutiliza el pipeline ML compartido sin duplicar lógica**: la
    función nueva `_generar_lote_para_puntos_activos()` llama a
    `_obtener_modelo_activo` y `_predecir_correccion` — las MISMAS
    funciones que ya usan `ingesta-archivo` e `ingesta-aleatoria` — y
    los mismos rangos de generación sintética (`RANGO_TEMPERATURA`,
    etc.) ya documentados arriba. Cada tick genera UNA lectura por cada
    `PuntoControl` con `activo=True` (`estacion_id`/`activo` ya
    existían en el modelo), todas con el mismo `timestamp` (el momento
    de esa pasada) — se interpretó "en paralelo" del diseño aprobado
    como "todos los puntos en la misma pasada/tick", no como
    concurrencia real a nivel de `asyncio.gather` con sesiones de BD
    separadas por punto: una sola `AsyncSession` de SQLAlchemy no es
    segura para usarse concurrentemente, y con ~7 puntos de control
    reales el costo de generarlos secuencialmente dentro de una misma
    pasada es insignificante frente al intervalo (mínimo 5s). Se abre
    una `AsyncSessionLocal()` nueva en cada tick (no una sesión de
    request vía `Depends(get_db)`, porque la tarea corre fuera de
    cualquier request).
  - **LIMITACIÓN DE DESARROLLO, aceptada y documentada explícitamente
    (pedido directo de la tarea)**: el estado del generador (la tarea
    de `asyncio` y las variables de módulo) vive en memoria del
    proceso de `uvicorn`. Con `--reload` activo (como se corre hoy en
    desarrollo), CUALQUIER cambio de código reinicia el proceso y la
    tarea en segundo plano se pierde silenciosamente — sin error
    visible, el generador simplemente deja de insertar lecturas hasta
    que alguien vuelva a llamar `/iniciar`. **Pendiente para la fase de
    despliegue a producción** (sin `--reload`, proceso estable): en ese
    momento sí conviene además registrar un hook de `lifespan` en
    `main.py` que cancele la tarea de forma limpia en un shutdown real
    del proceso (hoy no se agregó — un shutdown/kill del proceso mata
    la tarea igualmente, solo que sin la limpieza ordenada de un
    `cancel()` esperado).
  - Verificación real (navegador/curl + consulta directa a la BD, con
    limpieza de datos de prueba verificada por conteo total): ver
    comandos `curl` exactos entregados al usuario en la respuesta de
    esta tarea.
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
- DECISIÓN (2026-09-18): suite de pruebas automatizadas (`pytest`) en
  `backend/tests/`, pensada para dar confianza antes del despliegue a
  producción. Documentación de pytest/pytest-asyncio consultada vía
  context7 antes de diseñar (nota: la red del entorno estuvo caída
  durante buena parte de esta tarea - ver aviso en el reporte al
  usuario si el resultado de esa consulta no llegó a completarse).
  - **Comando para correr toda la suite** (desde `backend/`, con el
    venv activo y `docker compose up -d` corriendo para tener Postgres
    disponible en el puerto 5433):
    ```
    python -m pytest
    ```
    (usa `backend/pytest.ini`: `testpaths = tests`,
    `asyncio_mode = auto` — ningún test necesita el decorador
    `@pytest.mark.asyncio` a mano).
  - **Aislamiento de base de datos (requisito no negociable de la
    tarea)**: las pruebas NUNCA tocan `mineguard_db`. Corren contra
    `mineguard_test_db`, una base de datos SEPARADA en el MISMO
    contenedor/servidor Postgres que ya levanta `docker-compose.yml`
    (mismo puerto 5433) — Postgres aísla bases de datos como espacios
    completamente independientes. `backend/tests/conftest.py` la
    recrea desde cero (`DROP DATABASE ... WITH (FORCE)` +
    `CREATE DATABASE`) al inicio de cada corrida de la suite, y arma
    el esquema con `Base.metadata.create_all()` a partir de los
    modelos ORM actuales (no vía `alembic upgrade head` — trade-off
    consciente: las pruebas verifican que el código y los modelos de
    HOY funcionan juntos, no la cadena de migraciones en sí). Se eligió
    una base de datos separada en el mismo contenedor, en vez de un
    contenedor Postgres nuevo, por ser más liviano (sin un segundo
    servicio/puerto/volumen que mantener) — el enunciado de la tarea
    ofrecía esta alternativa explícitamente.
  - **Cómo se logra el aislamiento a nivel de código**: `conftest.py`
    pisa `os.environ["DATABASE_URL"]` (apuntando a
    `mineguard_test_db`) ANTES de importar cualquier módulo `app.*` —
    `app/core/config.py` computa `settings = get_settings()` una sola
    vez al importarse (`@lru_cache`), así que si el import real
    ocurriera antes de pisar la variable, la URL de producción ya
    habría quedado fija. `conftest.py` es el primer lugar de todo el
    proceso de pruebas donde se importa código de `app`, así que es
    seguro. El backend real (`uvicorn`, puerto 8000) corre en un
    proceso del SO totalmente separado — las variables de entorno de
    un proceso de pytest nunca afectan a otro proceso ya corriendo.
  - **Aislamiento entre pruebas**: todas las tablas se truncan
    (`TRUNCATE ... RESTART IDENTITY CASCADE`) después de cada prueba
    (fixture `autouse`) — cada prueba empieza con la BD vacía. El
    cache en memoria del `ModeloML` activo
    (`app/api/telemetria.py::_modelo_activo_cache`, ver DECISIÓN
    2026-09-13 más arriba) es a nivel de proceso, no de BD, así que la
    misma fixture lo limpia explícitamente entre pruebas — de lo
    contrario la primera prueba que registrara un `ModeloML`
    "contaminaría" a todas las siguientes con un modelo ya truncado de
    la BD.
  - **Fixtures clave** (`conftest.py`): `client` (httpx.AsyncClient
    sobre la app FastAPI vía `ASGITransport`, sin necesitar un servidor
    uvicorn corriendo — más rápido y no compite por el puerto 8000 con
    el servidor real de desarrollo), `db_session` (para que las
    pruebas siembren/verifiquen datos por fuera de la API, ej. leer un
    `PasswordResetToken`), `usuario_trabajador`/`usuario_supervisor`/
    `usuario_admin` (cada uno ya autenticado, con `.token` y
    `.headers` listos para usar), `estacion_y_punto` (una `Estacion` +
    un `PuntoControl` de prueba), `modelo_ml_activo` (registra el
    `ModeloML` activo apuntando a los `.joblib` REALES del proyecto —
    mismas rutas que usa `app/scripts/seed_modelo_ml.py` — nunca un
    mock del modelo).
  - **Qué cubre cada archivo**:
    - `test_auth.py`: registro (éxito, rol siempre trabajador aunque
      se envíe otro, email duplicado 409, documento duplicado 409),
      login (éxito, password incorrecta 401, email inexistente 401),
      `/me` (con/sin/token inválido), ciclo completo
      forgot-password→reset-password (incluye que el password viejo
      deja de sevir y el nuevo funciona), reset con token
      inexistente/expirado/ya usado.
    - `test_permisos.py`: por cada endpoint protegido por rol (cambio
      de rol, CRUD directo de puntos de control, solicitudes de
      cambio, gestión de alertas, generador continuo) — rol
      insuficiente → 403, rol mínimo requerido → funciona de verdad
      (no solo "no 403").
    - `test_ingesta_y_ml.py`: ingesta por archivo con un CSV pequeño
      de prueba (3 filas válidas + 2 inválidas a propósito, verifica
      el conteo exacto de `filas_descartadas`), ingesta aleatoria
      (verifica que `gas_corregido == gas_crudo + error_predicho` y
      que `nivel_alerta` coincide con volver a correr
      `clasificar_nivel_alerta` sobre el mismo porcentaje — confirma
      que el endpoint usa el motor real, no un valor fijo), y pruebas
      unitarias paramétricas de `app/core/umbrales.py` en los 3
      límites exactos del Decreto 1886 (0.9% y 1.5%, incluyendo los
      valores justo antes/después de cada límite).
    - `test_puntos_control.py`: CRUD directo, soft-delete (la fila NO
      se borra, solo `activo=False`, y desaparece de
      `/estado-actual` pero sigue en `GET /{id}`), flujo completo de
      solicitud para los 3 tipos (crear/editar/eliminar) con
      aprobación real verificando que el cambio se aplicó de verdad
      en la BD, rechazo verificando que el cambio NO se aplicó, y que
      una solicitud ya revisada no se puede volver a aprobar (409).
    - `test_alertas.py`: crear, duplicado (409) para la misma
      telemetría, mutear/escalar/resolver, resolver sin observación
      (422 de Pydantic, `AlertaResolver.observacion_hse` es
      obligatorio), resolver dos veces (409), mutear una ya resuelta
      (409).
    - `test_generador_continuo.py`: iniciar, estado refleja intervalo
      e `iniciado_en`, iniciar dos veces sin detener (409), intervalo
      menor al mínimo (422), detener sin nada corriendo (409), y una
      prueba que de verdad espera un intervalo real (mínimo 5s) y
      confirma en la BD que se insertaron lecturas — no solo el
      estado "corriendo". Fixture propia `autouse` que cancela
      cualquier tarea de fondo huérfana después de cada prueba de este
      archivo (si una prueba falla antes de llamar a `/detener`, la
      tarea de `asyncio` seguiría corriendo en el proceso de pytest y
      podría chocar con la BD ya truncada de la siguiente prueba).
  - **Dependencias**: `pytest` y `pytest-asyncio` en
    `backend/requirements-dev.txt` NUEVO (no en `requirements.txt`) —
    convención elegida: dependencias de solo-desarrollo/pruebas
    separadas de las de producción, para no instalarlas en el
    despliegue real. `httpx` y `asyncpg` (los usan las pruebas
    también) ya estaban en `requirements.txt` desde antes (Authlib),
    así que `requirements-dev.txt` los reutiliza vía
    `-r requirements.txt` en vez de duplicarlos.
  - **Fuera de alcance explícito de esta suite** (no pedido en la
    tarea): el flujo de Google OAuth (`/api/auth/google/*`,
    `/api/auth/exchange`) no tiene pruebas automatizadas — requiere
    consentimiento humano real en el navegador de Google, no se puede
    automatizar de forma segura ni con mocks sin perder buena parte
    del valor de la prueba (ya se verificó manualmente en las tareas
    de esa fase). Tampoco hay pruebas de carga/concurrencia real más
    allá de la lógica de negocio.
  - **Resultado de la corrida completa (verificado, no asumido)**:
    `76 passed, 0 failed` (`python -m pytest -v`, ~46-49s). Corrida dos
    veces seguidas con el mismo resultado exacto (76/76) para confirmar
    que no es un pase casual — ver el output completo en el reporte de
    esta tarea al usuario.
  - **Bug real encontrado y corregido durante esta tarea** (no en el
    código de producción, sino en el diseño inicial de la propia
    suite): el primer intento de correr la suite completa falló casi
    en su totalidad (`9 failed, 132 errors`) con
    `sqlalchemy.exc.InterfaceError` / `Task attached to a different
    loop`. Causa: `_motor_bd_pruebas` (el engine de SQLAlchemy) estaba
    declarado con `scope="session"` como fixture ASYNC — sus
    conexiones quedaban atadas al event loop del PRIMER test que lo
    usó, pero `pytest-asyncio` en modo `auto` crea un event loop NUEVO
    por cada test (scope `function` por defecto); el segundo test en
    adelante intentaba reusar un engine "de otro loop" y reventaba.
    **Fix**: se separó la preparación de la BD (recrear +
    `Base.metadata.create_all()`) en una fixture SÍNCRONA de sesión
    (`_bd_de_pruebas_lista`, `@pytest.fixture` normal, no
    `pytest_asyncio.fixture`) que corre su propio `asyncio.run()`
    aislado una sola vez al inicio - y `_motor_bd_pruebas` pasó a ser
    una fixture async de scope `function` (un engine nuevo y barato
    por prueba, dentro del loop propio de esa prueba). También se fijó
    `asyncio_default_fixture_loop_scope = function` en `pytest.ini`
    (antes quedaba implícito, con un `PytestDeprecationWarning`
    avisando que el comportamiento por defecto cambiará en una futura
    versión de `pytest-asyncio`).
  - **Advertencia benigna conocida, no investigada más a fondo**: en
    ambas corridas apareció una vez (en una prueba distinta cada vez)
    `RuntimeWarning: coroutine 'Connection._cancel' was never
    awaited`, de `asyncpg` - parece timing de garbage collection al
    cerrar conexiones entre pruebas, no causó ningún fallo de
    aserción en ninguna de las dos corridas completas. Pendiente
    investigar si se vuelve más frecuente o empieza a causar fallos
    reales.
