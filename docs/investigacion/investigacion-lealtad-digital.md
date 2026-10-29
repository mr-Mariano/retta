# Investigación de tarjetas de lealtad digitales

Fecha de consulta: 14 de octubre de 2026. Mercado principal: México.

## Conclusión

El modelo existe en México y en otros mercados: software por suscripción vendido al comercio, con acceso gratuito para el consumidor. La tarjeta en Apple/Google Wallet ya es una característica comercial común. La evidencia encontrada confirma oferta, precios y algunos indicadores de adopción; no permite afirmar rentabilidad de los proveedores mexicanos ni retorno causal de los programas.

## Proveedores que comercializan en México

Precios publicados, sin contratar ni probar operativamente los servicios. Promociones, impuestos y condiciones pueden cambiar.

| Proveedor | Precio de entrada publicado | Alcance y observaciones | Fuente |
|---|---|---|---|
| DCards | $300 MXN/mes, lanzamiento | Una sucursal, Wallet, sellos, QR, clientes ilimitados; también anuncia planes de $500 y $700. | https://dcards.mx/ |
| Bexor | $4,499 MXN/año, precio promocional | Una sucursal, hasta 400 tarjetas activas. Equivalente aritmético de $374.92/mes, pero cobrado anualmente. | https://bexor.mx/ |
| Retenia | $999 MXN/mes + IVA | Plan Basic; WhatsApp se cobra aparte en Basic y Growth. | https://retenia.mx/ |
| Bumerang Cards | $1,499 MXN/mes con IVA | Plan Arranque: una promoción, un acceso de personal, tarjetas ilimitadas. Publica descuento por pago anual. | https://bumerangcards.mx/precios-y-planes |

Bexor se identifica como plataforma mexicana y DCards identifica una sociedad y domicilio en Mazatlán. Bumerang comercializa explícitamente en MXN. Estas verificaciones acreditan oferta pública orientada al país; no equivalen a una auditoría de operaciones o clientes.

Bexor declara más de 450 negocios en América Latina y que 63% de clientes registrados vuelve una segunda vez; identifica las cifras como datos internos agregados, actualizados en septiembre de 2026. No informa cuánto habrían regresado sin el programa ni cuántos negocios pagan. Fuente: https://bexor.mx/

DCards publica un caso de El Marino con 1,338 tarjetas activas y 4,842 visitas: 805 tarjetas web y 533 en Wallet. Es un caso del proveedor, sin auditoría independiente; no demuestra que una interfaz cause mayor adopción o ventas adicionales. Fuente: https://dcards.mx/

No se localizaron en las fuentes consultadas ingresos auditados, utilidades, abandono de comercios o costo de adquisición de estos proveedores mexicanos. Precio público no equivale a ventas verificadas.

## Funcionamiento del modelo

1. El comercio configura reglas, diseño y recompensa.
2. El cliente accede mediante un enlace o QR y guarda su tarjeta.
3. Un empleado autorizado valida una compra o visita; el servidor registra el movimiento y actualiza la tarjeta.
4. El comercio entrega la recompensa al cumplir las reglas y registra el canje.
5. El proveedor cobra una suscripción; puede cobrar por sucursal, capacidad o funciones y añadir servicios de instalación, campañas e integraciones.

Este flujo se documenta comercialmente en Bumerang y técnicamente en Apple: https://bumerangcards.mx/bienvenida y https://developer.apple.com/wallet/get-started/

La recompensa normalmente es financiada por el comercio; para un producto nuevo esta sería una decisión explícita del modelo. No hay una comisión de pago inherente a registrar un sello. Cobrar por ventas requeriría capturar transacciones o una integración adicional.

## Evidencia internacional

- Loopy Loyalty publica Starter de US$25/mes o US$250/año, con una ubicación, un diseño, tres accesos de personal y tarjetas/clientes ilimitados. El sitio afirma miles de negocios, sin publicar estados financieros en las páginas consultadas. Fuentes: https://docs.loopyloyalty.com/en/articles/803301-what-are-your-pricing-plans y https://loopyloyalty.com/
- Stamp Me publica Lite US$49/mes y Pro US$79/mes en su selector de precios; también muestra tarifas regionales diferentes. Su sitio declara presencia en más de 50 países. Fuentes: https://www.stampme.com/pricing y https://www.stampme.com/trust
- Stamp Me publica casos de OLAB Coffee Shop (Dubái: más de 600 miembros en seis meses y más de 1,200 sellos mensuales) y Batch Espresso (Australia: más de 125,000 sellos desde 2020 en seis cafeterías). Son métricas de uso de casos seleccionados por el vendedor, no utilidades ni ventas incrementales demostradas. Fuente: https://www.stampme.com/case-studies
- SumUp confirmó la compra de Fivestars por US$317 millones en efectivo y acciones en 2021. Reportó acceso a más de 12,000 negocios y 65 millones de miembros. Fivestars combinaba marketing, lealtad y pagos: no es comparable directamente con un generador sencillo de tarjetas Wallet. Sus US$3,000 millones de ventas anuales anunciadas corresponden a actividad de la red, no ingresos de software del proveedor. Fuente: https://www.sumup.com/en-us/press/fivestarsacquisition/

## Limitaciones técnicas relevantes

Apple permite distribuir pases por web, sin aplicación propia, y requiere certificados para firmarlos. Las actualizaciones involucran servidores y mantenimiento de certificados. Fuentes: https://developer.apple.com/wallet/get-started/ y https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Updating.html

Google permite emisión web y actualizaciones parciales. No se deben prometer avisos idénticos en ambas plataformas sin verificar el mecanismo y restricciones vigentes. Fuentes: https://developers.google.com/wallet/retail/loyalty-cards/web y https://developers.google.com/wallet/retail/loyalty-cards/resources/faq

## Evaluación comercial propia

Las siguientes son inferencias y escenarios, no resultados de mercado:

- Un producto de $399 MXN/mes produciría $39,900 mensuales con 100 sucursales o $399,000 con 1,000, antes de impuestos y todos los gastos. Llegar a esos clientes y retenerlos es la hipótesis difícil.
- Si cada cuenta aportara $300 mensuales después de costos variables y costara $1,500 captarla, recuperaría la adquisición en cinco meses, sin incluir costos fijos. Si el cliente cancela antes, la venta podría destruir valor.
- El resultado económico del comercio debe considerar margen incremental, premios, mensualidad y operación; contar todas las compras de miembros como ventas causadas por el programa exageraría el retorno.
- Un mercado de muchas microempresas no equivale al mercado accesible del producto. Se necesita frecuencia suficiente, margen para premiar, personal que use la herramienta y voluntad de pagar.
- Precio bajo y soporte en español no son diferencias suficientes frente a la oferta encontrada. Las hipótesis más defendibles serían distribución mediante aliados, operación de caja más rápida o especialización por actividad con medición útil.

## Implicación para el proyecto académico

Es viable como sistema de diseño de software: multiempresa, roles, transacciones de sellos, reglas de recompensa, prevención de doble canje y actualización de tarjetas. Su valor académico no depende de afirmar novedad comercial.

Antes de presentarlo como negocio diferenciado convendría comprobar una ventaja concreta en adopción, operación o distribución. La alineación con el ODS 8 debe explicarse como apoyo a productividad de pequeños negocios, sin equiparar automáticamente más consumo con sostenibilidad.
