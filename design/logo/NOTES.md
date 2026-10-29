# Retta — Exploraciones de wordmark

## 01 · Travesaño compartido
Las dos «t» de Big Shoulders Display ExtraBold 800 se unen mediante un único travesaño continuo, conservando sus astas y terminales originales. El gesto recuerda la estructura de una portería y convierte dos letras individuales en un punto de encuentro: la misma idea de Retta, donde cada persona llega por su cuenta para formar un partido. El ícono extrae exactamente esta ligadura «tt», sin añadir un contenedor. Es la dirección recomendada por su relación directa con el nombre, su legibilidad y la claridad del símbolo pequeño.

## 02 · Línea de cancha
Una sola franja horizontal de espacio negativo atraviesa la parte baja de la «R», como una línea de demarcación pintada sobre una cancha. El resto del nombre conserva sus contornos tipográficos, de modo que el detalle aporta precisión y ritmo sin convertirse en un emblema deportivo. El ícono utiliza la misma «R» intervenida; la abertura mide aproximadamente 1.35 px en el wordmark de 24 px y 1.35 px en el ícono de 32 px, suficiente para conservar la separación a la escala de referencia. Esta propuesta expresa la organización y las reglas claras que hacen fácil entrar a una reta.

## 03 · Guiño al silbato
La terminal superior izquierda de la «a» se prolonga con una pequeña boquilla horizontal, mientras se mantiene su contraforma abierta y su lectura de «a». Es una referencia tipográfica discreta al silbato árbitro que se diseñará como mascota, sin dibujar una segunda mascota dentro del nombre. El ícono aísla esa misma «a» con boquilla y conserva el gesto a 32 px. Esta dirección ofrece la conexión más cercana con el carácter amistoso de Retta y permite que la mascota tenga presencia sin recargar la marca.

## Archivos y uso

- Los seis wordmarks tienen fondo transparente y el mismo encuadre ajustado a los contornos: 1000 unidades de alto. Las alturas del preview corresponden al alto real de la marca.
- `dark` significa uso sobre fondo oscuro: `#ECECEC`. `light` significa uso sobre fondo claro: `#0D0D0D`.
- Los tres íconos tienen `viewBox="0 0 512 512"`, fondo transparente y un símbolo centrado de 384 unidades de alto, con margen de 64 unidades arriba y abajo. Se verificaron a 32 y 180 px.
- Cada SVG contiene un único path compuesto con `fill="currentColor"`, curvas y huecos reales. No contiene texto vivo, trazos, máscaras, imágenes, sombras ni degradados. Las uniones se resolvieron geométricamente; coordenadas redondeadas a una décima de unidad.
- Para cambiar el color de un SVG insertado inline, aplicar `color` al elemento `<svg>`. En un `<img>`, usar el archivo correspondiente al fondo: el color CSS del elemento padre no atraviesa un SVG externo.
- Los íconos independientes cambian entre los dos colores mediante `prefers-color-scheme`; el preview fija explícitamente el color de cada panel. Para uso inline con color propio, retirar la regla de tema del SVG del ícono.
- `preview.html` funciona sin conexión. Los logotipos no dependen de fuentes instaladas. La interfaz del preview solicita Geist y utiliza Arial/sans-serif si no está instalada.

## Base tipográfica y autoría

Contornos derivados del archivo oficial [Big Shoulders Display de Google Fonts](https://github.com/google/fonts/tree/main/ofl/bigshouldersdisplay), instanciado en peso 800. La familia se publica con [SIL Open Font License 1.1](https://github.com/google/fonts/blob/main/ofl/bigshouldersdisplay/OFL.txt). No se distribuye ni se necesita el archivo de fuente. Las tres intervenciones se dibujaron para Retta; no se utilizaron escudos, símbolos de clubes, logotipos de ligas ni recursos de stock. La base tipográfica es compartida y de código abierto; la originalidad del diseño está en las intervenciones, no en atribuirse la autoría de la fuente.
