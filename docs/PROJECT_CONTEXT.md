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
