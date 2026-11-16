<a id="configure-models"></a>

# Modelos de configuración

<!-- USER_LANGUAGES_START -->
[English](providers.md) | [中文](providers.zh.md) | [Русский](providers.ru.md) | [日本語](providers.ja.md) | Español | [Français](providers.fr.md) | [Deutsch](providers.de.md) | [Português](providers.pt.md) | [한국어](providers.ko.md)
<!-- USER_LANGUAGES_END -->

Esta guía parte de que ya has iniciado la interfaz web mediante la [guía de desarrollo](../../development.md). Los cambios de modelo se aplican en la siguiente solicitud, sin reiniciar el servidor.

## Configure DeepSeek

Abre **Ajustes → Modelos**. La tarjeta de DeepSeek tiene un solo campo para la clave de API. Introduce la clave y guárdala.

![The Models page: the DeepSeek card, with Add model provider below it](providers-models-page.png)

Las claves son de solo escritura. Después de guardar, la página recibe un descriptor con el valor oculto. Nunca recibe el secreto en claro. La clave se guarda en `$DSH_HOME/.credentials.yaml` y los ajustes solo conservan la referencia a esa credencial.

Con una clave guardada y el punto final predeterminado, los modelos de DeepSeek siguen la lista que publica la API DeepSeek. La lista se carga cuando los modelos se necesitan primero, se refresca en el fondo cada diez minutos mientras están en uso, y se vuelve a los modelos incorporados cuando no se puede cargar. Edición de **Modelos** bajo **Ajustes personalizados** mantiene su propia lista en lugar y paradas después de la publicada; **Restaurar predeterminados** la sigue de nuevo y la recarga. Mientras que la lista publicada está en uso, la tarjeta muestra los modelos incorporados, por lo que un modelo recién publicado aparece sólo en el selector modelo. El proveedor de referencia [API-key](../../../packages/llm/llm-deepseek-api-key/README.md) posee las reglas de enumeración, retroceso y juego.

<a id="add-a-third-party-provider"></a>

## Añadir un proveedor de terceros

Elija **Añadir proveedor de modelo**. La tarjeta se abre en **Proveedor de modelos de terceros**: seleccione un proveedor de barcos con — la lista muestra los IDs de proveedor como `anthropic`, `openai`, `moonshotai` para Kimi, o `zai` para GLM — introduzca su clave de API, y ahorre. El catálogo instalado suministra el endpoint, protocolo y lista de modelos.

La autenticación **?** explica la prioridad y los retrocesos del medio ambiente. Deje el blanco clave para usar una credencial guardada o pruebe las variables de entorno enumeradas. Una pista verde identifica una variable de entorno detectada. Una indirecta amarilla significa que no se detectó ninguna variable credencial; ingrese una clave de API o configure la variable lista. Una insinuación no confirmada significa que el estado leído falló. La detección no valida la credencial o prueba la conexión. Los archivos credenciales gestionados por el proveedor, incluidos los perfiles AWS y las credenciales de aplicación por defecto de Google, están fuera de este cheque. Los proveedores sin autenticación de clave nativa, como `openai-codex`, no muestran ningún campo clave a menos que el perfil nombre explícitamente una referencia credencial.

Una credencial salva muestra una vista previa enmascarada en la entrada y una pista verde que la clave guardada será utilizada. La vista previa conserva el identificador antes del primer hifeno o subrayar, luego cinco personajes principales y cuatro caracteres de seguimiento, sólo cuando al menos ocho caracteres medios permanecen ocultos; de lo contrario, toda la llave y el identificador se convierten en puntos. Los condes usan puntos de código Unicode. Las teclas guardadas no tienen un botón ocular y no pueden ser reveladas, copiadas, cortadas o parcialmente editadas; la escritura o el pegado reemplaza toda la llave. Backspace o Eliminar etapas de eliminación de tecla completa. Presione Backspace o Eliminar, luego **Aplicar**, para eliminar la anulación almacenada y utilizar la autenticación del entorno. Emptying a replace also stages deletion of the save key. **Cancelar** preserva la llave guardada antes de guardar. Una eliminación rechazada deja la configuración sin cambios. Si la clave se elimina pero los ajustes fallan, los informes de advertencia de que la eliminación no se puede deshacer; reiniciar **Aplicar** para terminar la configuración, o **Cerrar** para dejar el resultado parcial. Limpiar una credencial compartida afecta cada característica usando la misma referencia. Sin un ambiente credencial, el proveedor no tiene autenticación después de limpiar. Retroceso del medio ambiente utiliza **Deja en blanco para usar env como auth** y una pista de detección mientras la entrada está vacía. Un proyecto de sustitución muestra un recordatorio para aplicar la nueva clave. La eliminación de la espera denomina la variable ambiente utilizada después de la aplicación, cuando la ruta declara una. Otras entradas no vacías no muestran ningún texto de autenticación. Las variables de configuración de direcciones aparecen bajo **Base URL** y no cuentan como credenciales.

Un borrador de tecla editable y no vacío tiene un botón de ojo. Seleccione **Mostrar secreto** para comprobar lo que escriba, y **Ocultar secreto** para enmascararlo de nuevo. Cambiar la entrada lo oculta de nuevo. Los campos de contraseña nativos no ofrecen corte; seleccione el proyecto y presione Backspace para borrarlo, o revelarlo antes de cortar. Las credenciales almacenadas permanecen solos.

<a id="add-a-custom-model-api"></a>

## Agregar un modelo personalizado API

Cambie la tarjeta a **Modelo personalizado API** para un relé, una puerta de entrada de la empresa, un servidor auto hospedado, o cualquier proveedor ausente del catálogo instalado. Suministrar un ID de proveedor de la maleta inferior, URL base, protocolo API, credenciales y al menos un modelo. El protocolo **API** debe ser el que habla su puerta de entrada, y el selector ofrece cuatro: OpenAI Chat Completions, OpenAI Responses, Antroppic Messages, y Gemini API, almacenado en el perfil activo `cordis.patch.yml` como `openai-completions`, `openai-responses`, `anthropic-messages`, y `google-generative-ai`. Una URL base de la API de Gemini incluye la versión de API, como `https://gateway.example/v1beta`. Un proveedor habla un protocolo, por lo que una puerta de entrada que sirve a dos necesita dos proveedores.

![The custom model API form: Provider ID, display name, base URL, API protocol, and API key](providers-custom-form.png)

El ID del proveedor es permanente porque las solicitudes, sesiones guardadas, defectos de modelo y referencias credenciales lo utilizan. Para renombrar a un proveedor, agregue un nuevo proveedor y elimine el antiguo. El nombre de la pantalla, URL base, protocolo, credencial y modelos siguen siendo editables.

<a id="discover-models"></a>

### Descubre modelos

Bajo **Modelo catálogo**, elija **Pie de modelos disponibles** para preguntar el punto final qué modelos sirve. La solicitud utiliza la URL base, el protocolo y la clave actualmente en el formulario, o la clave almacenada de un proveedor guardado, y la respuesta abre un selector de búsqueda: los modelos ya en la lista comienzan marcados, por lo que buscar, marcar los modelos a añadir, desentrañar los que se eliminan, y elegir **Lista de actualización**. Modelos configurados el punto final no lista quedarse. Nada se almacena hasta que se guarda o crea el proveedor.

Discovery lee los formatos de lista que publican las pasarelas comunes, pero no todas las respuestas de endpoint en una de ellas, así que traten como una comodidad en lugar de una garantía: cuando falla o no lista nada, agregue el modelo ids a mano y trabajen igual. Un proveedor incorporado siempre es contestado desde el catálogo instalado, incluso cuando su URL base apunta a una puerta de entrada, por lo que busque a través de un proveedor personalizado para ver lo que la puerta de entrada realmente sirve.

<a id="select-a-model"></a>

## Seleccione un modelo

Los proveedores configurados aparecen en el selector de modelos. La selección de un modelo también lo hace predeterminado para nuevas sesiones. Una sesión que ya ha enviado una solicitud conserva el modelo grabado en su propio registro.

Para cambiar la orden de modelo de un proveedor, edite en **Settings → Modelos**, abra **Ajustes personalizados**, y arrastre el mango de tres líneas de un modelo. También puede enfocar el mango y presionar la tecla de flecha arriba o abajo. **Apply** mantiene el pedido; **Cancelar** lo descarta. El selector modelo sigue el pedido guardado dentro de ese proveedor.

Si un proveedor que fue eliminado, el compositor muestra **Seleccionar modelo** y bloquea la entrada hasta que se seleccione otro modelo.

<a id="advanced-configuration"></a>

## Configuración avanzada

El catálogo de configuración del plugin [generado](../../config-catalog.md) lista cada campo soportado y predeterminado para cada plugin; [`dsh-llm-pi-ai`](../../config-catalog.md#oceanocean-llm-pi-ai) es la sección proveedor esta página configura. Las referencias [`dsh-llm-pi-ai`](../../../packages/llm/llm-pi-ai/README.md) y [`dsh-llm-deepseek`](../../../packages/llm/llm-deepseek/README.md) poseen configuración directa `cordis.patch.yml` , resolución de catálogos, controles de razonamiento, credenciales y errores de adaptador.

::: punta Ajustes adicionales La página Modelos expone la clave de API, nombre de pantalla, URL base, protocolo API, y el id de cada modelo, nombre de pantalla, ventana de contexto, tokens de salida máximo, y tipos de entrada, además de los niveles de razonamiento de un modelo en un proveedor de API de modelo personalizado. Configure los niveles de razonamiento de los modelos de un proveedor integrado, los conmutadores de compatibilidad con solicitudes, los encabezados, los plazos y la política de reingreso en `$DSH_HOME/profiles/<profile>/cordis.patch.yml`, el mismo documento que escribe la página. Editar directamente o, cuando el navegador se ejecuta en la misma máquina que el servidor, abrirlo con **Abrir el archivo de configuración** en el encabezado Ajustes; los adaptadores volver a leerlo en la siguiente solicitud, por lo que nada necesita un reinicio. Las subsecciones a continuación cubren los campos más necesitados.

Para el lanzamiento estándar Web UI con `dsh web`, `<profile>` es `web`, por lo que el camino es `$DSH_HOME/profiles/web/cordis.patch.yml`. Si usted lanza un perfil personalizado, utilice el nombre seleccionado en el arranque en su lugar. :::

<a id="image-input"></a>

### Entrada de imagen

In **Ajustes → Modelos**, editar el proveedor, abrir **Ajustes personalizados**, y expandir el modelo **Opciones de modelo**. **Tipos de entrada** ocupa su propia fila debajo de los campos de capacidad. Seleccione **Imagen** para un modelo que acepta imágenes, y ahorra. **Texto** comienza seleccionado para un nuevo modelo personalizado sin capacidad de imagen heredada. Por lo menos un tipo debe permanecer seleccionado; seleccione Imagen antes de limpiar Texto para un modelo solo de imagen.

Las casillas de verificación guardan `input` para los modelos pi-ai y `inputModalities` para el adaptador directo DeepSeek. También puede editar el modelo en `$DSH_HOME/profiles/<profile>/cordis.patch.yml`; por ejemplo, este proveedor pi-ai personalizado declara un modelo solo de texto y un modelo de visión:

Estos ejemplos muestran campos de config dentro de un parche de perfil. Una anulación de config Cordis reemplaza el config completo de entrada; preservar otros proveedores y campos al editar una anulación existente.

```yaml
- id: llm-pi-ai
  config:
    providers:
      my-gateway:
        apiKeyEnv: GATEWAY_API_KEY
        api: openai-completions
        baseURL: https://gateway.example/v1
        models:
          - id: legacy-chat
          - id: vision-preview
            input: [text, image]
```

El `input` de Pi-ai acepta `text` y `image` y se aplica a ese modelo solo. Una selección explícita no vacía tiene prioridad. Un `input` omitido o vacío hereda los tipos de entrada del catálogo instalado, luego el `defaultInput`de la ruta, que se destina a `[text]`. Las casillas de verificación muestran estos valores heredados sin guardar una anulación cuando simplemente abre la fila.

DeepSeek trata a un `inputModalities` omitido como solo texto y rechaza una lista vacía. Clearing Image también elimina `imagePixelBudget` y `imageMaxBytes`de ese modelo, porque DeepSeek rechaza los límites de imagen en un modelo solo de texto. Establece esos límites de nuevo si luego permite imágenes y necesita límites personalizados.

Para restaurar la herencia después de editar las casillas de verificación, retire el campo `input` del modelo o `inputModalities` de `cordis.patch.yml`. **Restaurar predeterminados** elimina toda la anulación del modelo-catálogo, incluyendo otras ediciones de modelos, así que úsela sólo cuando desee restaurar todo el catálogo.

Si cada modelo que entras a mano toma imágenes, coloca el retroceso una vez en la ruta en lugar de en cada uno de ellos:

```yaml
- id: llm-pi-ai
  config:
    providers:
      vision-gateway:
        apiKeyEnv: GATEWAY_API_KEY
        api: openai-completions
        baseURL: https://vision.example/v1
        defaultInput: [text, image]
        models:
          - id: first-model
          - id: second-model
```

`defaultInput` es un retroceso, no una anulación, y por defecto a `[text]`: en un proveedor incorporado que responde sólo para los modelos que su catálogo no describe, por lo que nunca elimina las imágenes de un modelo de catálogo que las tiene. Reducir uno de esos con `input`de ese modelo. Cuando un proveedor incorporado no tiene una lista explícita `models` , escríbalo bajo `modelOverrides`, clave por modelo id:

```yaml
- id: llm-pi-ai
  config:
    providers:
      anthropic:
        modelOverrides:
          claude-sonnet-4-5:
            input: [text]
```

En la configuración de pi-ai, cada lista debe nombrar al menos una modalidad excepto el propio `input`de un modelo, donde una lista vacía significa lo mismo que omitirlo. Una modalidad desconocida es rechazada donde esté escrita.

Ambos campos declaran una reclamación sobre su punto final en lugar de revisarlo. Un modelo que declara imágenes su punto final no sirve no se ve atrapado aquí; el proveedor rechaza la solicitud en su lugar.

<a id="deepseek-account-models"></a>

### Modelos de cuenta de DeepSeek

Una cuenta firmada en DeepSeek enumera sus modelos del servicio de cuenta, por lo que la página Modelos no ofrece editor de modelo para él. Ajuste un solo modelo con `modelOverrides` en `$DSH_HOME/profiles/<profile>/cordis.patch.yml`; los campos coinciden con una entrada de DeepSeek `models` , y los campos sin par mantienen los valores listados:

```yaml
- id: llm-deepseek-account
  config:
    modelOverrides:
      deepseek-flash:
        contextWindow: 524288
        maxTokens: 131072
```

Un modelo que necesita un nuevo Ocean falla con `CLIENT_UPGRADE_REQUIRED`, que nombra la versión para instalar. El proveedor de cuenta [referencia](../../../packages/llm/llm-deepseek-account/README.md) posee las reglas de listado, desplegable y de gating.

### Reasoning effort

El modelo Picker ofrece un menú **Effort** para un modelo que declara niveles de razonamiento. Los modelos de un proveedor incorporado heredan sus niveles del catálogo instalado, y los modelos de DeepSeek mantienen los niveles del adaptador. Un modelo que entras a mano no declara nada hasta que los agregues, por lo que hasta entonces la entrada de Effort no aparece en el menú y el propio defecto del endpoint decide si el modelo piensa.

En un proveedor de API de modelo personalizado, declarar los niveles en **Ajustes → Modelos**: editar el proveedor, abrir **Ajustes personalizados**, ampliar el modelo **Opciones de modelo**, y encender **Niveles de resonancia**. Las filas comienzan con apagado, bajo, medio y alto. Cada fila empareja un nivel con el **Valor de API** enviado para ello, que se opone al nombre de nivel; cambiarlo sólo cuando la documentación de API del proveedor modelo deletrea el nivel de manera diferente. Agregar o eliminar filas para que coincida con lo que el endpoint soporta, mantener al menos un nivel aparte, y guardar. Apagar el apagado elimina la declaración.

La página escribe `reasoningEfforts` en `$DSH_HOME/profiles/<profile>/cordis.patch.yml`, donde también se pueden declarar los niveles directamente:

```yaml
- id: llm-pi-ai
  config:
    providers:
      my-gateway:
        apiKeyEnv: GATEWAY_API_KEY
        api: openai-completions
        baseURL: https://gateway.example/v1
        reasoning: high
        models:
          - id: my-reasoner
            reasoningEfforts:
              off:
              high: high
              max: max
```

Cada clave es un nivel que ofrece el menú, y su valor es la ortografía enviada en el alambre como `reasoning_effort`, por lo que `max: xhigh` renombra un nivel para una puerta de entrada con su propio vocabulario. Sólo `off` puede permanecer vacío, porque para la mayoría de los puntos finales no pensar es la ausencia del parámetro. El `reasoning` de la ruta es el nivel utilizado mientras que una sesión no ha elegido ninguno; elegir un esfuerzo en el picker lo ahorra, con el modelo, como el predeterminado para nuevas sesiones.

Un `off` dejado vacío no envía nada, lo que sólo detiene un modelo que piensa a petición; un `off` dado un valor envía ese valor como `reasoning_effort` en su lugar. Un modelo que piensa a menos que se le diga que no — DeepSeek V4 detrás de una pasarela compatible con OpenAI, por ejemplo— necesita `compat.thinkingFormat: deepseek`, lo que hace que `off` enviar `thinking: {type: disabled}` y cada otro nivel enviar `thinking: {type: enabled}` al lado del esfuerzo:

```yaml
        models:
          - id: deepseek-v4-pro
            compat:
              thinkingFormat: deepseek
            reasoningEfforts:
              off:
              high: high
              max: max
```

Un modelo de proveedor integrado cuya puerta de entrada no razona perder sus niveles con `reasoningEfforts: false` bajo `modelOverrides`; seleccionar un esfuerzo para él se rechaza luego como `UNSUPPORTED_REASONING_EFFORT`. La ruta propia de DeepSeek no necesita nada de esto: sus modelos ya ofrecen `off`, `low`, `high`, y `max`, y `llm-deepseek.reasoningEffort` establece el por defecto que el picker comienza de:

```yaml
- id: llm-deepseek
  config:
    reasoningEffort: max
```

<a id="request-compatibility"></a>

### Solicitar compatibilidad

Una puerta de entrada puede tener una clave de trabajo en una dirección accesible y aún así rechazar cada petición. pi-ai decide la forma de una solicitud —que papel lleva el impulso del sistema, que campo tapa la salida, cómo un nivel de pensamiento viaja — desde la URL del punto final, y una dirección que no reconoce se aborda como si fuera la propia OpenAI. La mayoría de los portales compatibles con OpenAI rechazan al menos una cosa que OpenAI acepta.

Dos representan la mayor parte. Un modelo que declara razonamiento tiene su sistema de impulso enviado como `role: "developer"`, que muchas puertas rechazan de forma directa, y la tapa de salida se envía como `max_completion_tokens`, que un servidor que sólo conoce `max_tokens` se niega. La forma no tiene campo para ninguno de los dos; corregirlos en la ruta en `$DSH_HOME/profiles/<profile>/cordis.patch.yml`:

```yaml
- id: llm-pi-ai
  config:
    providers:
      my-gateway:
        apiKeyEnv: GATEWAY_API_KEY
        api: openai-completions
        baseURL: https://gateway.example/v1
        compat:
          supportsDeveloperRole: false
          maxTokensField: max_tokens
        models:
          - id: my-model
```

Una ruta `compat` es el predeterminado para sus modelos, y el propio campo de victorias de un modelo por campo, por lo que un modelo puede ser corregido sin reposar la ruta:

```yaml
        models:
          - id: my-model
          - id: my-reasoner
            compat:
              thinkingFormat: deepseek
```

Lo que ninguno mantiene el valor del catálogo instalado para ese modelo, y lo que el catálogo no describe cae a la detección de pi-ai. Dar cada interruptor que nombre un valor: una clave izquierda vacía (`supportsDeveloperRole:`) se niega en lugar de ignorar, porque un valor vacío borraría lo que el catálogo sabe mientras no dice nada en su lugar. Un nombre que ningún protocolo acepta es rechazado también, y el mensaje enumera los que están disponibles.

Cada interruptor pertenece a los protocolos que lo declaran, por lo que un interruptor válido en un `api` puede ser rechazado en otro — el mensaje indica lo que ese protocolo ofrece. Como `input` arriba, un interruptor indica una reclamación sobre su punto final en lugar de comprobarlo: establecer una de su puerta de entrada no necesita simplemente enviar una petición diferente.

Cada interruptor, sus valores aceptados, y los protocolos que lo toman se enumeran bajo `PiAiCompatProfile` en el [generado `dsh-llm-pi-ai` referencia de configuración](../../config-catalog.md#oceanocean-llm-pi-ai) —que se deriva de la fuente, por lo que no puede caer detrás de lo que el adaptador acepta.

<a id="troubleshooting"></a>

## Solución de problemas

- **`MISSING_CREDENTIAL`** — Almacene la clave del proveedor a través de la página Modelos o suministre la variable de entorno referencia.
- **`UNKNOWN_MODEL`** — Seleccione un modelo configurado o agregue el modelo que falta al proveedor personalizado.
- **Los modelos disponibles devuelven 401** — Compruebe la clave. El descubrimiento modelo llama el punto final `GET /models` compatible con OpenAI; introduzca los modelos manualmente para los puntos finales que no lo proporcionan.
- **Buscar modelos disponibles reporta ni un `data` ni un array ni un `models` objeto** — La lista de endpoint está en un descubrimiento de formato no lee. Introduzca los modelos a mano.
- **La puerta de entrada se niega a cada petición, aunque la clave y la URL son derechas** — Su forma de solicitud difiere de OpenAI. Comience con `compat.supportsDeveloperRole: false` y `compat.maxTokensField: max_tokens` en la ruta.
- **Sólo los modelos de razonamiento fallan** — pi-ai envía su sistema rápido como el papel `developer` , que la puerta rechaza. `compat.supportsDeveloperRole: false`.
- **El menú Effort no aparece para un modelo que entró a mano** — Declara que no hay niveles. En un proveedor de API de modelo personalizado, encienda **Niveles de resonancia** en el modelo **Opciones de modelo**; en otros lugares, añadir `reasoningEfforts` al modelo en `cordis.patch.yml`.
- **`off` no detiene un modelo DeepSeek de pensar** — Un `off` vacío no envía ningún campo de razonamiento en absoluto, y un punto final que piensa por defecto sigue pensando. Establecer `compat.thinkingFormat: deepseek` en el modelo o la ruta.
- **Se niega un interruptor de brújula por no tener valor** — Una llave escrita sin nada después del colon. Dale un valor, o quita la llave para mantener el catálogo instalado.
- **Una imagen es rechazada antes de enviar** — El modelo no declara una modalidad de imagen. Dar el modelo de proveedor personalizado `input: [text, image]`; en la ruta propia de DeepSeek, seleccione una entrada de imagen-capítulo del catálogo configurado (`deepseek-flash` por defecto) y confirme que su puerta de entrada sirve a ese modelo con entrada de imagen.
- **El proveedor rechaza una solicitud que lleva una imagen** — El modelo declara que las imágenes no sirven en realidad. Quitar `image` de la lista que se le haya concedido, el `input`del modelo, o el `defaultInput` de la ruta, luego iniciar una nueva sesión: la imagen adjunta permanece en el registro de sesión, por lo que la misma solicitud se repite hasta que la sesión se mueva.
