<a id="run-ocean-behind-a-network-proxy"></a>

# Ejecutar OCEAN detrás de un proxy de red

<!-- USER_LANGUAGES_START -->
[English](network-proxy.md) | [中文](network-proxy.zh.md) | [Русский](network-proxy.ru.md) | [日本語](network-proxy.ja.md) | Español | [Français](network-proxy.fr.md) | [Deutsch](network-proxy.de.md) | [Português](network-proxy.pt.md) | [한국어](network-proxy.ko.md)
<!-- USER_LANGUAGES_END -->

OCEAN dirige sus solicitudes salientes —llamadas a modelos, búsquedas web, descarga de páginas y conexiones HTTP a servidores MCP— a través del proxy indicado por las variables de entorno de proxy estándar. Las lee al iniciarse; no hace falta configurar nada más. Algunas rutas permanecen directas por diseño o por limitaciones del entorno de ejecución; se enumeran en «Qué conexiones siguen siendo directas» más abajo.

<a id="export-the-variables"></a>

## Exportar las variables

```sh
export HTTPS_PROXY=http://127.0.0.1:7890
export HTTP_PROXY=http://127.0.0.1:7890
```

Añade ambas líneas a tu perfil de shell para que cada invocación de `ocean` las herede, o a `$OCEAN_HOME/.env` (`~/.ocean/.env` por defecto), junto a tu clave API; una variable exportada siempre tiene prioridad sobre ese archivo. El `.env` del propio proyecto no puede definirlas: llega con `git clone`, y OCEAN se niega a iniciarse antes que permitir que un repositorio decida adónde va tu tráfico.

Si el proxy necesita credenciales, se incluyen en la URL: `http://user:password@proxy.example:8080`. OCEAN nunca vuelve a mostrar la URL: el diagnóstico indica la variable rechazada, de modo que no aparecen ni el nombre de usuario ni la contraseña.

<a id="why-your-browser-is-proxied-but-your-terminal-is-not"></a>

## Por qué el navegador usa el proxy y el terminal no

Es la sorpresa más habitual y no es específica de OCEAN. No existe un único «proxy del sistema» que respete todo el software: hay tres mecanismos independientes:

| Mecanismo | Quién lo utiliza |
|---|---|
| Ajustes de proxy del sistema operativo | Safari, la mayoría de las aplicaciones nativas de macOS, Chrome y Edge |
| Variables de entorno `HTTP_PROXY` / `HTTPS_PROXY` | `curl`, `git`, `npm`, `pip` y OCEAN |
| Modo TUN (una interfaz de red virtual) | Todo, de forma transparente |

El interruptor «proxy del sistema» de una aplicación como Clash solo modifica el primer mecanismo. Los navegadores lo detectan; las herramientas de línea de comandos no lo ven. Por eso exportar las variables es un paso independiente y activar el modo TUN permite que ambos funcionen sin ninguna variable.

OCEAN no lee los ajustes de proxy del sistema operativo. Exporta las variables o usa el modo TUN.

<a id="choose-what-stays-direct"></a>

## Elegir qué conexiones siguen siendo directas

`NO_PROXY` enumera los hosts a los que se accede directamente:

```sh
export NO_PROXY=internal.example.com,.corp.example.com,registry.local
```

Una entrada indica un host y coincide tanto con él como con todos sus subdominios: `NO_PROXY=example.com` también conecta directamente con `api.example.com`. Se admite un prefijo `.` o `*.`, con el mismo significado. Una entrada puede incluir `:port`, y `*` evita el proxy para todo.

**Los rangos CIDR no funcionan.** La lista de excepciones del sistema operativo suele incluir entradas como `10.0.0.0/8` o `192.168.0.0/16`; copiarlas a `NO_PROXY` no tiene efecto. Usa nombres de host o sufijos de dominio.

No necesitas incluir `localhost` ni `127.0.0.1`. OCEAN siempre evita el proxy para loopback, porque, de lo contrario, su propia interfaz web y los servidores locales pasarían por el proxy y formarían un bucle.

<a id="limits-worth-knowing"></a>

## Limitaciones que debes conocer

**No se admiten proxies SOCKS.** Un valor `socks5://` se notifica al inicio y se omite, y OCEAN se conecta directamente para el esquema que lo definió: configurar `HTTPS_PROXY=socks5://…` junto a un `HTTP_PROXY` válido deja `https:` directo, sin reutilizar el proxy HTTP. Apunta las variables al puerto HTTP de tu aplicación de proxy: la mayoría ofrece ambos y el puerto HTTP suele ser contiguo.

**Basta con `ALL_PROXY`.** OCEAN lo usa como alternativa para ambos esquemas, aunque Node y curl difieran en este punto. Definir `HTTPS_PROXY` explícitamente sigue siendo más claro.

**Un proxy corporativo que intercepta TLS necesita su certificado.** Si las solicitudes fallan por un error de certificado cuando el proxy ya es accesible, indica a Node el paquete de certificados CA de tu organización antes de iniciarlo:

```sh
export NODE_EXTRA_CA_CERTS=/path/to/corporate-ca.pem
```

Node solo lee esa variable al iniciar el proceso, así que expórtala antes de ejecutar `ocean`.

**Las herramientas que OCEAN ejecuta para ti usan el mismo proxy.** Los comandos de la herramienta bash, `git`, `gh` y los servidores MCP iniciados como procesos hijos heredan estas variables. Un programa Node hijo usa su propio entorno de ejecución instalado: Node 22.21+ y Node 24+ respetan estas variables; las versiones anteriores se conectan directamente. Si una variable de proxy contiene un valor rechazado por OCEAN —por ejemplo, una URL SOCKS—, las herramientas basadas en Node también conectan directamente en lugar de fallar al inicio, mientras que `curl` y `git` siguen leyendo ese valor.

**Las contraseñas de la URL del proxy también llegan a esas herramientas.** `HTTPS_PROXY=http://alice:s3cret@proxy.example:8080` es una variable de entorno normal, por lo que cualquier comando que ejecute OCEAN —incluidos los escritos por el modelo— puede leerla. Un comando que muestre su entorno incluirá la contraseña en una salida que se conserva. Así se comporta esta variable con el resto de programas de tu shell. Si eso te preocupa, ofrece un punto de acceso al proxy sin credenciales o autentícalo de otra forma que no sea la URL.

<a id="what-stays-direct"></a>

## Qué conexiones siguen siendo directas

No todas las solicitudes de OCEAN pasan por el proxy:

- **Todo lo que está en este equipo.** Loopback siempre es directo: `localhost`, todo el rango `127.0.0.0/8`, `::1` y `0.0.0.0`. Un proxy no puede acceder de forma útil a un servicio que solo escucha localmente.
- **Código escrito por el modelo.** Los workers de flujos de trabajo y los procesos Node de ptc-runtime no reciben ajustes de proxy, para que los scripts escritos por el modelo no puedan leer una URL de proxy que quizá contenga una contraseña. Las solicitudes directas deben configurar por sí mismas el proxy que necesiten y siguen sujetas al aislamiento de ejecución.
- **Telemetría de uso.** El exportador OTLP usa el cliente HTTP propio de Node en lugar del configurado por el proxy, por lo que la telemetría se conecta directamente y simplemente falla cuando se bloquea la salida directa. Ninguna operación que realices en OCEAN depende de ella. Define `OCEAN_TELEMETRY_MODE=DISABLED` para desactivarla por completo.
- **`web_fetch` a una dirección privada literal.** Una URL que indique una dirección como `http://10.0.0.5/` se rechaza en lugar de enviarse al proxy, igual que cuando no hay ningún proxy configurado.

<a id="check-that-it-worked"></a>

## Comprobar que funciona

Pide al agente que descargue una página y observa el registro de conexiones de tu aplicación de proxy:

```sh
ocean --profile headless "fetch https://example.com and tell me the page title"
```

Si la solicitud no aparece, confirma que las variables llegan al entorno del propio OCEAN:

```sh
env | grep -i proxy
```
