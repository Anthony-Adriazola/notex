# Configurar la sincronización

Notex sincroniza la laptop (servidor) con el celular (cliente) por una red
privada de Tailscale. No hay cuentas en la nube ni datos en servidores de
terceros.

## 1. Tailscale

1. Crear una cuenta en <https://tailscale.com> (plan personal, gratis).
2. Instalar Tailscale en la laptop y en el celular.
3. Iniciar sesión con la misma cuenta en los dos equipos.
4. En la laptop, comprobar que aparece una dirección `100.x.x.x`.

Tailscale crea una red privada entre los dispositivos. La app no abre puertos a
internet: solo los equipos de esa red pueden conectarse, y el tráfico va
cifrado por WireGuard.

## 2. Emparejar

En la laptop:

1. Abrir **Ajustes → Sincronización**.
2. Copiar la dirección que empieza con `100.` (Tailscale). Si no aparece, usar la
   dirección de la red Wi-Fi mientras los dos equipos estén en la misma casa.
3. Tocar **Generar código**. Aparece un código de 6 dígitos, válido 10 minutos.

En el celular:

1. Abrir **Ajustes → Sincronización**.
2. Pegar la dirección. Ejemplo: `http://100.101.102.103:8787`.
3. Escribir el código.
4. Tocar **Conectar con la laptop**.

El celular recibe un token y lo guarda. El código se borra del servidor después
de usarlo.

## 3. Verificar

- En la laptop, el estado debe decir **Servidor activo**.
- En el celular, debe decir **Conectado** o **Al día**.
- Anotar un gasto en el celular y esperar unos segundos: aparece en la laptop.
- Anotar un gasto en la laptop y sincronizar desde el celular: aparece en el
  teléfono.

## Qué pasa si la laptop está apagada

El celular sigue funcionando. Los cambios se guardan en una cola y se envían
cuando la laptop vuelve a estar prendida y con Tailscale. La app muestra
**Cambios pendientes** o **Sin conexión** hasta que se resuelva.

## Seguridad

- El servidor pide un token `Bearer` en cada pedido.
- El código de emparejamiento es de un solo uso y vence a los 10 minutos.
- El token se guarda en la base privada de cada app.
- No se sincronizan las preferencias locales (por ejemplo, el tamaño de texto).

## Problemas frecuentes

**La laptop no muestra una dirección 100.x**

Tailscale no está conectado. Abrir la app de Tailscale y volver a iniciar sesión.

**El celular no conecta**

- Verificar que la laptop esté prendida y que la app de Notex esté corriendo
  (puede estar en la bandeja).
- Verificar que el firewall de Windows permita Notex en redes privadas.
- Probar primero con la dirección de la red Wi-Fi local; después, con Tailscale.

**El código venció**

Generar uno nuevo en la laptop.

**Cambios que no aparecen**

Tocar **Sincronizar ahora** en el celular. Si el error sigue, revisar el estado
en Ajustes: el mensaje indica si es un problema de red o de autenticación.

## Puerto

El servidor usa el puerto `8787`. Si está ocupado, prueba `8788`, `8789` y
siguientes hasta `8799`. La dirección que muestra Ajustes ya incluye el puerto
correcto.
