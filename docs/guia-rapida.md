# Guía rápida de Notex

Notex sirve para anotar los gastos de la comercializadora y saber cuánto se gastó
en la semana, en el mes y en el año. Todo queda guardado en la laptop y en el
celular.

## Abrir la app

En la laptop, abrir **Notex** desde el menú de programas. Si se cierra la
ventana, la app sigue en la bandeja del sistema para que el celular pueda
sincronizar. Para salir de verdad, usar el menú de la bandeja y elegir **Salir**.

En el celular, abrir **Notex** como cualquier otra app.

## Anotar un gasto

1. Tocar **Agregar** (el botón claro del centro, abajo).
2. Escribir el monto con el teclado. Por ejemplo, `25,50`.
3. Elegir la categoría (Compra de mercadería, Proveedores, Fletes, Combustible, etc.).
4. Revisar la cuenta y la fecha, que ya vienen elegidas.
5. Tocar **Guardar gasto**.

Para un ingreso, elegir **Ingreso** arriba del monto y la categoría (Ventas,
Cobranzas u Otros ingresos). Para pasar dinero del banco a la caja, elegir
**Transferencia**: no cuenta como gasto.

## Ver los totales

La pantalla **Resumen** muestra:

- Lo gastado **hoy**, **esta semana**, **este mes** y **este año**.
- La comparación con el mes anterior.
- El promedio diario.
- Cuánto queda del presupuesto.
- En qué se fue el dinero de la empresa.

## Pagos que se repiten

En **Ajustes → Recurrentes** se pueden crear el alquiler del local, la luz, el
internet, los sueldos o cualquier pago fijo. En **Pendientes** se ve el mes
completo, con el estado de cada pago:

- **Pendiente:** ya venció y falta confirmarlo.
- **Pagado:** ya se registró este mes.
- **Próximo:** todavía no vence, pero se puede pagar antes.
- **Saltado:** este mes no correspondía.

Se puede corregir el monto antes de registrar y elegir **Saltar** si no
corresponde. Nunca se registra solo.

## Presupuestos

En **Presupuestos** se escribe cuánto se quiere gastar en cada categoría del
negocio durante el mes. La barra cambia de color al llegar al 80% y al 100%.

## Sincronizar con el celular

La laptop y el celular se conectan por **Tailscale**, una red privada entre tus
propios equipos. Se configura una sola vez:

1. Instalar Tailscale en la laptop y en el celular, con la misma cuenta.
2. En la laptop: **Ajustes → Sincronización**. Copiar la dirección que empieza
   con `100.` y generar un código de 6 dígitos.
3. En el celular: **Ajustes → Sincronización**. Pegar la dirección y el código.
   Tocar **Conectar**.

Después se sincroniza solo. Si la laptop está apagada, el celular sigue
funcionando y los cambios quedan pendientes con un aviso. Al encender la laptop,
se ponen al día.

## Copias de seguridad

En **Ajustes → Datos y respaldo**:

- **Copia de seguridad** guarda una copia completa de la base.
- **Exportar CSV** genera un archivo con todos los movimientos, que se puede
  abrir en una planilla de cálculo.

El celular también guarda una copia completa. Si se rompe la laptop, los datos
siguen en el teléfono.

## Si algo no anda

- **No sincroniza:** revisar que Tailscale esté encendido en los dos equipos y
  que la laptop esté prendida.
- **El código no sirve:** los códigos vencen a los 10 minutos. Generar uno nuevo.
- **Se ve chico:** en **Ajustes → Preferencias**, activar **Texto grande**.
