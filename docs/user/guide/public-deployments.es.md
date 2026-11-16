<a id="publish-the-web-ui-behind-a-reverse-proxy"></a>

# Publicar la interfaz web detrás de un proxy inverso

<!-- USER_LANGUAGES_START -->
[English](public-deployments.md) | [中文](public-deployments.zh.md) | [Русский](public-deployments.ru.md) | [日本語](public-deployments.ja.md) | Español | [Français](public-deployments.fr.md) | [Deutsch](public-deployments.de.md) | [Português](public-deployments.pt.md) | [한국어](public-deployments.ko.md)
<!-- USER_LANGUAGES_END -->

`dsh --profile web` sirve la interfaz gráfica en un puerto de la interfaz loopback, por lo que un navegador de otro equipo no puede acceder a ella y el proceso desconoce la dirección que usas. Un proxy inverso delante de ella se encarga de ese tramo externo: el nombre de host público, TLS y el prefijo de ruta que elimina antes de reenviar al servidor. `--public-url` indica a DSH qué dirección usan los navegadores:

```sh
dsh --profile web --public-url https://app.example/ui/ --trusted-host app.example
```

<a id="what---public-url-advertises"></a>

## Qué anuncia `--public-url`

`--public-url` acepta una raíz `http://` o `https://` con un prefijo de montaje opcional y la normaliza para terminar en `/`. Proporciona la URL que se muestra y se abre al inicio, `DSH_WEB_URL` y la URL de la interfaz web en el contexto de ejecución del agente. El servidor web sigue sirviendo rutas desde la raíz del origen y no conoce el punto de montaje. El campo de configuración `publicUrl` publica el mismo anuncio.

<a id="what-the-proxy-must-do"></a>

## Qué debe hacer el proxy

- **Conservar el `Host` visible para el navegador.** La comprobación de acceso compara el `Host` recibido con las autoridades aceptadas, por lo que el proxy debe reenviarlo sin cambios en lugar de sustituirlo por la dirección del servidor.
- **Eliminar el prefijo de montaje.** El servidor responde a rutas desde la raíz del origen, así que una solicitud a `/ui/api/...` debe llegar como `/api/...`.
- **Reenviar los cambios de protocolo.** Todas las solicitudes de la página y los cambios de protocolo a WebSocket deben llegar al servidor con sus cabeceras `Upgrade` y `Connection` intactas; TLS termina en el tramo externo del proxy cuando este sirve HTTPS.
- **Reescribir el ámbito de las cookies.** Un backend que sirve HTTP sin cifrar emite cookies limitadas al host, con `Path=/` y sin `Secure`; el proxy reescribe `Path` al punto de montaje (`/ui/`) y añade `Secure` en su tramo HTTPS. Un servidor backend que usa su propio TLS ya marca la cookie como `Secure`, así que el proxy solo reescribe `Path`.
- **Redirigir el punto de montaje sin barra.** `/ui/` es la única entrada: solo ella intercambia el token de inicio por la cookie de sesión, y ella o `/ui/index.html` sirven el documento a un navegador que ya tiene esa cookie, porque el documento resuelve las URL respecto a su propio directorio. Una solicitud a `/ui` debe llegar como `/ui/`, y el backend sin prefijo no puede reconstruir esa ruta externa.

<a id="trust-the-authority-browsers-use"></a>

## Confiar en la autoridad que usan los navegadores

La comprobación de acceso acepta loopback, la dirección de escucha del propio servidor y todas las autoridades indicadas por `--trusted-host`. Si un navegador llega al despliegue con otra autoridad, recibe 403 en todas las llamadas API, por correcta que sea la configuración del proxy. Por eso debes indicar la autoridad visible para el navegador con `--trusted-host`; anunciarla mediante `--public-url` solo la muestra, no la autoriza. Una entrada sin puerto coincide con cualquier puerto, lo que sirve para un túnel que usa uno distinto cada vez. La comprobación solo admite la solicitud; el token de inicio de la URL mostrada y la cookie de sesión firmada la autentican. TLS, termine donde termine, no cambia esto: el certificado identifica al servidor ante el navegador, no al navegador ante el servidor.

Ni la URL anunciada ni la comprobación protegen el propio puerto de escucha, así que restringe ese puerto al proxy o a la red de confianza.

<a id="secure-the-external-leg"></a>

## Proteger el tramo externo

Termina TLS en el proxy, en el propio servidor o en ambos; `--public-url` sigue siendo un anuncio. Una raíz `http://` visible para el navegador expone el token de inicio sin cifrar. Una raíz `https://` del proxy protege el tramo del navegador al proxy; el cifrado entre el proxy y el servidor depende de la configuración TLS de este último.

Para terminar TLS en el servidor, pasa `--tls-cert` y `--tls-key`, cada uno con una ruta resuelta respecto al directorio de trabajo del proceso: el archivo de certificado contiene la cadena completa y el de clave una clave privada PEM sin cifrar. DSH no obtiene, renueva ni supervisa certificados, y el componente de escucha lee los archivos una sola vez; para cambiarlos, sustitúyelos y recarga el servidor o reinicia el proceso. El inicio falla si falta algún archivo o el par no es válido y nunca recurre a HTTP. El navegador aplica su propio almacén de confianza y sus comprobaciones de nombre, así que el certificado debe cubrir el nombre de host o la dirección IP a la que accedas. El puerto predeterminado sigue siendo 3080. TLS nativo no necesita un proxy, pero los despliegues con proxy y `--public-url` siguen siendo compatibles de forma independiente. Un servidor TLS marca las cookies de sesión como `Secure`; mantén HTTPS en el tramo público hacia el navegador para que este pueda devolverlas.

La URL mostrada contiene una credencial del proceso; compártela solo con los usuarios previstos.

La [referencia de la aplicación web](../../../packages/bundle/web-app/README.md#public-deployments) documenta las opciones de línea de comandos `--public-url`, `--trusted-host` y `--tls-cert`/`--tls-key`. En el perfil Web, `publicUrl` configura la entrada `web-runtime`, `trustedHosts` configura la [entrada Connection](../../../packages/client/connection/README.md) y `tls` configura la [entrada webserver](../../../docs/subsystems/web-server.md#config).
