# AGENTS.md — Notex

Notex es una app privada, local-first, para el negocio de minerales del padre de Anthony.
Se usa en **Windows** (servidor de sincronización) y **Android Honor X6c** (cliente), unidos por Tailscale.
La app debe ser simple para un adulto mayor, en español, con montos en bolivianos (`Bs 1.234,56`).

## Regla de oro

Ningún cambio se considera terminado si no se verificó:

1. **La sincronización** entre las dos instalaciones.
2. **La vista móvil** en el tamaño del teléfono del padre: **360 × 800 px** (Honor X6c).

Si no se puede probar en el teléfono físico, se prueba con el mismo ancho de viewport y se deja constancia.
No alcanza con que compile.

---

## 1. Sincronización obligatoria

Arquitectura:

- Cada dispositivo tiene SQLite (`notex.db`).
- Cada cambio local se registra en `change_log` con `entity`, `entity_id`, `updated_at`, `device_id` y `payload`.
- El servidor (Windows) escucha en el puerto **8787**.
- El teléfono empuja sus cambios y baja los del servidor.
- `sync_store::apply_change` aplica los cambios remotos.
- La comparación es last-write-wins por `updated_at` + `device_id`.

### Antes de tocar una entidad o un campo

Revisar **los cuatro lugares**:

1. El comando local en `src-tauri/src/commands.rs` debe guardar **y** llamar a `log_entity` / `sync_store::log_change`.
2. El `apply_change` de `src-tauri/src/sync_store.rs` debe reconocer la entidad.
3. El `upsert_*` debe incluir **todas** las columnas nuevas, con los placeholders y el orden de `params![]` correctos.
4. El struct del payload (`models.rs`) debe tener el campo con `#[serde(default)]` si es nuevo, para no romper clientes viejos.

Si se agrega una tabla o columna:

- Agregar la migración en `db.rs` y subir `PRAGMA user_version`.
- Actualizar el esquema del servidor y del cliente (es el mismo código).
- Si el dato es derivado (por ejemplo `usage_count`, `last_used`), **no** confiar en sincronizarlo: recalcularlo desde los movimientos.

### Errores que ya pasaron (no repetir)

- `payment_method` y `device_id` estaban cruzados en el `INSERT` local y en el `upsert_transaction` remoto.
  Eso hacía que la sincronización guardara el UUID del dispositivo como medio de pago y que las transacciones normales fallaran por `device_id NULL`.
  Hay una reparación en la migración de esquema v4. **No cambiar el orden de esos placeholders sin correr los tests.**
- Los campos nuevos de `categories` (`monthly`, `due_day`, `reminder_days`) tienen que viajar en el payload y en el upsert.
- Los pendientes puntuales (`planned_payments`) y los saltos de mes (`concept_skips`) son entidades nuevas: deben tener su `log` y su `apply_change`.
- Pagar un pendiente puntual genera **dos** cambios: la transacción y el pendiente actualizado. Registrar ambos.
- Cancelar un pendiente debe sincronizar `status = cancelled` y `deleted_at`.

### Pruebas mínimas

Desde `src-tauri/`:

```bash
cargo test
```

Deben pasar, entre otros:

- `local_save_tests::local_transaction_keeps_payment_method_and_device`
- `sync_store::tests::sync_transaction_keeps_method_device_and_deleted_state`
- `sync_store::tests::sync_category_keeps_monthly_fields`
- `sync_store::tests::sync_planned_payment_keeps_amount_and_method`
- `sync_store::tests::sync_concept_skip_is_applied`
- `concept_tests::create_category_stores_monthly_fields`

### Alta real obligatoria

Antes de publicar, hacer en la app (no solo por tests):

1. Crear un concepto de gasto, uno de ingreso y uno mensual.
2. Editarlo desde Ajustes.
3. Registrar un movimiento Efectivo y uno QR.
4. Crear y pagar un pendiente puntual.

Si un `INSERT` tiene columnas nuevas, su test debe ejecutar el **alta completa**. El error `wrong number of parameters passed to query. Got N need M` es exactamente un placeholder sin su `params![]`; no publicar hasta correr el alta.

### Prueba real de ida y vuelta

Con dos instalaciones (o dos bases separadas):

1. En el teléfono, crear un **concepto**, un **movimiento Efectivo**, uno **QR**, un **pendiente puntual** y **pagarlo**.
2. Esperar el sync; verificar en Windows:
   - el concepto con su estado mensual;
   - el movimiento con `payment_method = cash/qr` y `device_id` correcto;
   - el pendiente con su estado y `transaction_id`;
   - el movimiento generado por el pago.
3. Hacer el camino inverso desde Windows: editar el concepto, archivar otro, saltar un mes.
4. Verificar que en el teléfono se vean los cambios y que **no queden cambios pendientes** en `sync_status`.
5. Revisar que no haya filas con `device_id NULL`, `payment_method NULL` o `deleted_at` con valor `cash`/`qr`.

Si se toca el esquema o los defaults, actualizar **las dos** instalaciones a la misma versión.

---

## 2. Vista móvil obligatoria

El padre usa un **Honor X6c**, Android 15, ~360 × 800 CSS px. La app tiene:

- barra superior con marca y estado de sync;
- navegación inferior fija de 5 ítems: Resumen, Movimientos, Agregar, Pendientes, Ajustes;
- contenido con `padding-bottom` para que la barra no tape botones.

### Checklist de pantallas

Probar en 360 px de ancho y, si se puede, en el teléfono real:

- **Resumen:** banners de recordatorio/pendientes, tarjetas, últimos movimientos, sin desborde horizontal.
- **Movimientos:** filtros, filas, método Efectivo/QR, botón de agregar.
- **Agregar:** monto nativo desde cero, sin concepto precargado, grilla de conceptos, Efectivo/QR, fecha, nota, botón guardar.
- **Ventana de concepto nuevo:** se abre como modal, el teclado no tapa el nombre ni el botón, se puede cerrar.
- **Pendientes:**
  - El botón **“Agregar pendiente”** debe ser **ancho completo en móvil**, estar debajo del título de “Pendientes puntuales” y ser fácil de tocar.
  - El formulario de pendiente puntual: concepto, monto, fecha, medio, nota; botón de guardar visible con el teclado abierto.
  - Fila del pendiente: fecha, monto, “Aviso 1 día antes”, botones Pagar/Cancelar.
  - Los pagos mensuales, si el padre marcó alguno, sin “día de vencimiento” ni días de aviso.
- **Ajustes → Conceptos:** lista, lápiz para editar, ventana de edición, “¿Se paga cada mes?” solo en gastos.
- **Reportes:** panel por medio de pago, sin cuentas.
- **Presupuestos:** conceptos, sin cuentas.

Criterios:

- Sin scroll horizontal.
- Botones principales de al menos **44 px** de alto y texto legible.
- Nada importante tapado por la barra inferior o el teclado.
- Los textos en español rioplatense simple; sin “categoría”, “cuenta” ni “transferencia” en la UI.
- Probar con el teléfono en vertical y, si se puede, con letra grande del sistema.

### Cómo probar

- App de escritorio: `npm run tauri dev`.
- **Verificación móvil automática:** `npm run mobile:check`.
  - Construye el frontend, levanta un servidor local y abre Chromium con **360 × 800**, `deviceScaleFactor: 2`, táctil.
  - Entra a Resumen, Pendientes, Pendientes pagados, formulario de pendiente, Agregar, modal de concepto, Ajustes, modal de concepto, Movimientos, Reportes y Presupuestos.
  - Guarda capturas en `docs/mobile-check/`.
  - Falla si hay desborde horizontal o errores de consola; muestra cuáles.
  - Requiere `CHROME_PATH` si el Chromium no está en la ruta cacheada de Playwright.
- Android: `npm run tauri android build -- --apk --target aarch64` e instalar el APK firmado.
- Si se prueba con mock, el mock debe devolver las mismas formas que los comandos reales (`monthly_concepts`, `planned_payments`, `reminders`, etc.).
- La grilla de “¿Qué estás pagando?” en celular usa **2 columnas** con ícono+nombre; el botón **Nuevo** está arriba, no al final.
- “Pagados y saltados” queda **colapsado** por defecto y sus filas son compactas.
- Reportes y Presupuestos se abren desde Resumen; el ítem Resumen queda activo en la barra inferior.

---

## 3. Datos por defecto y experiencia del padre

- **No dejar pendientes por defecto.** Los conceptos de ejemplo (Alquiler, Luz, Wifi) existen, pero **no** están marcados como mensuales al instalar. El padre los marca cuando corresponde.
- **No agregar conceptos ni movimientos de ejemplo** sin pedirlo.
- Lista curada de conceptos de gasto:
  Compra de mineral, Análisis de ley, Fletes y transporte, Combustible, Alquiler del local, Luz, Wifi, Servicios, Sueldos, Impuestos y regalías, Publicidad, Maquinaria y mantenimiento, Comisiones y bancos, Otros gastos.
- Ingresos: Ventas de mineral, Cobranzas, Otros ingresos.
- No volver a agregar: Proveedores, Viáticos, Empaques e insumos.
- Los medios son solo **Efectivo** y **QR**.
- El alta de movimiento **no precarga** monto ni concepto; el método puede arrancar en Efectivo, pero el padre lo cambia.
- El concepto nuevo se crea en una **ventana**, no en un formulario debajo de la grilla.
- El pendiente puntual tiene **aviso fijo 1 día antes**; no mostrar campos de “días de aviso” ni “día de vencimiento”.

---

## 4. Definición de terminado

Antes de publicar una versión:

1. `npm run build` sin errores.
2. `cargo test` sin fallos.
3. Prueba de sincronización de ida y vuelta con las entidades tocadas.
4. Revisión móvil de las pantallas afectadas en 360 px.
5. APK Android firmado + instalador Windows.
6. Release con notas en español y ambas instalaciones.
7. Verificar que la app abra con la base migrada, sin pendientes por defecto y sin errores en consola.
