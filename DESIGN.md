# Design

<!-- impeccable:design-schema 1 -->

Notex usa el lenguaje visual que el cliente fijó como referencia: el repositorio
`amosblomqvist/learnharness`. No es una interpretación libre: es un mundo ya
elegido, adaptado a una app de gastos para una persona mayor, en bolivianos.

## World

Un libro contable de noche: superficies casi negras, líneas finas, cifras
monoespaciadas y títulos en serif. La interfaz se lee como una planilla bien
impresa, no como un tablero de banco. El color aparece solo en las categorías y
en los estados; el resto es tinta clara sobre carbón.

## Palette

| Token | Hex | Uso |
| --- | --- | --- |
| `canvas` | `#141414` | fondo de la app |
| `panel` | `#1B1B1B` | secciones y filas elevadas |
| `raised` | `#232323` | hover, selección, botones secundarios |
| `sunken` | `#101010` | campos, barras de fondo |
| `line` | `#373737` | bordes de 1 px |
| `line-strong` | `#5A5A5A` | bordes en foco y separadores fuertes |
| `ink` | `#E9E6DF` | texto principal y acción primaria |
| `muted` | `#A29D94` | texto secundario |
| `dim` | `#7B766D` | metadatos y ayudas |
| `positive` | `#9CC4A3` | ingresos y saldo a favor |
| `negative` | `#E09A8C` | gastos por encima del presupuesto |
| `warning` | `#E0B45E` | pendientes y alertas |

Las categorías usan una paleta de nueve colores apagados (ámbar, azul, arcilla,
arena, rojo, lavanda, verde, rosa, gris). El color de categoría se usa en el
ícono, el punto y la barra; nunca como fondo de una fila completa.

## Type

- **Interfaz y cifras:** JetBrains Mono 400/500/600. Las cifras usan
  `font-variant-numeric: tabular-nums` y el cero con punto.
- **Texto:** Source Sans 3 400/600/700.
- **Títulos:** Source Serif 4 600/700. Solo para el título de pantalla y los
  encabezados de sección. Nunca en botones, etiquetas ni datos.
- **Etiquetas:** `micro`: 11 px, mayúsculas, tracking 0.14em, color muted.
- **Escala:** 11 / 12 / 13 / 15 / 16 / 18 / 20 / 24 / 32 / 38 / 50 px.
- El monto principal del mes se compone con el símbolo `Bs` chico, el entero
  grande y los centavos en 0.6em muted. Es el único número que puede superar
  los 32 px.

## Layout

- **Escritorio (≥1024 px):** sidebar fija de 288 px, borde derecho de 1 px.
  Contenido centrado con ancho máximo de 1000 px.
- **Compacto (<1024 px):** barra superior de 56 px y navegación inferior fija de
  68 px, con `safe-area` para Android. El botón central "Agregar" es el único
  elemento claro y elevado.
- **Ritmo:** múltiplos de 4 px. Los paneles llevan 20–24 px de padding; las filas
  de lista, 12–14 px verticales.
- **Radios:** 10 px en paneles, 8 px en botones y campos, 3 px en barras.
- **Sombras:** solo el aviso flotante (`0 10px 30px rgba(0,0,0,.5)`). Nada más
  proyecta sombra.

## Components

- **Panel:** borde `line`, fondo `panel`, radio 10. Es el contenedor de sección;
  nunca se anidan paneles.
- **Botón primario:** fondo `ink`, texto `canvas`, 44 px de alto. Uno por
  pantalla como máximo.
- **Botón secundario:** borde `line`, fondo transparente; hover `raised`.
- **Campo:** fondo `sunken`, borde `line`, 44 px; foco con borde `line-strong`.
- **Segmentado:** una sola caja con borde; la opción activa se invierte a `ink`.
- **Barra de progreso:** 6 px, fondo `raised`; el relleno usa el color de la
  categoría o `ink`. A partir del 80% pasa a `warning`; por encima del 100%, a
  `negative`.
- **Filas de movimiento:** ícono de 32 px con el color de la categoría al 8% de
  opacidad, texto en dos líneas y monto a la derecha. Toda la fila es clickeable.
- **Teclado numérico:** 12 teclas de 48 px, mono, borde `line`. Es el corazón de
  la pantalla Agregar.
- **Estado vacío:** ícono de 40 px en un círculo de borde fino, una frase y una
  acción. Nunca "no hay datos" a secas.

## Motion

- 150–250 ms; `ease-out`. La entrada de pantalla es un fade de 4 px.
- El cambio de mes, el guardado y la sincronización no bloquean la lectura.
- Sin secuencias de carga orquestadas. Los esqueletos usan pulso suave.
- Respeta `prefers-reduced-motion`.

## Accessibility

- Texto de cuerpo ≥16 px; montos ≥18 px; el monto principal ≥40 px.
- Contraste mínimo 4.5:1 para texto. `dim` solo para metadatos no esenciales.
- Objetivos táctiles de 44×44 px como mínimo (48 dp en Android).
- Foco visible de 2 px en todos los controles; nada depende solo del hover.
- Modo "Texto grande" que sube la raíz a 18 px.
- Etiquetas en español, sin jerga contable, sin emoji.

## Bans

- Sin gradientes, sin glassmorphism, sin halos de color.
- Sin tarjetas dentro de tarjetas.
- Sin sombras duras ni `border-left` de color en filas.
- Sin íconos Unicode haciendo de íconos: todo sale de Lucide.
- Sin mono como disfraz "técnico": se usa para cifras, etiquetas y chrome.
- Sin modales para tareas que se resuelven en línea.
