<a id="configure-models"></a>

# Configurar modelos

<!-- USER_LANGUAGES_START -->
[English](providers.md) | [中文](providers.zh.md) | [Русский](providers.ru.md) | [日本語](providers.ja.md) | Español | [Français](providers.fr.md) | [Deutsch](providers.de.md) | [Português](providers.pt.md) | [한국어](providers.ko.md)
<!-- USER_LANGUAGES_END -->

Esta guía parte de que ya has iniciado la interfaz web mediante la [guía de desarrollo](../../development.md). Los cambios de modelo se aplican en la siguiente solicitud, sin reiniciar el servidor.

<a id="configure-deepseek"></a>

## Configurar DeepSeek

Abre **Ajustes → Modelos**. La tarjeta de DeepSeek tiene un solo campo para la clave de API. Introduce la clave y guárdala.

![The Models page: the DeepSeek card, with Add model provider below it](providers-models-page.png)

Las claves son de solo escritura. Después de guardar, la página recibe un descriptor con el valor oculto. Nunca recibe el secreto en claro. La clave se guarda en `$DSH_HOME/.credentials.yaml` y los ajustes solo conservan la referencia a esa credencial.

Con una clave guardada y el endpoint predeterminado, DeepSeek usa la lista que publica su API. La carga cuando se necesitan los modelos por primera vez y la actualiza en segundo plano aproximadamente cada diez minutos mientras están en uso. Si no puede cargarla, usa los modelos integrados. Editar **Modelos** en **Configuración personalizada** hace que se use tu lista en lugar de la publicada. **Restaurar valores predeterminados** vuelve a usar y cargar la lista publicada. En ese modo, la tarjeta sigue mostrando los modelos integrados y los nuevos modelos publicados aparecen solo en el selector. La [referencia del proveedor con clave de API](../../../packages/llm/llm-deepseek-api-key/README.md) documenta las reglas de listado, alternativas y requisitos de acceso.

<a id="add-a-third-party-provider"></a>

## Añadir un proveedor de terceros

Elige **Añadir proveedor de modelos**. La tarjeta se abre en **Proveedor externo de modelos**. Selecciona un proveedor incluido en DSH, como `anthropic`, `openai`, `moonshotai` para Kimi o `zai` para GLM. Introduce su clave de API y guarda. El catálogo instalado proporciona el endpoint, el protocolo y la lista de modelos.

El botón **?** explica qué prioridad tienen las credenciales guardadas y qué variables de entorno se usan como alternativa. Deja la clave en blanco para usar una credencial guardada o probar las variables indicadas. Un aviso verde indica que se detectó una variable. Uno amarillo indica que no se detectó ninguna. En ese caso introduce una clave de API o configura la variable indicada. Si el estado no se pudo consultar, el aviso indica que no está confirmado. La detección no valida la credencial ni prueba la conexión. La comprobación no incluye archivos que gestiona el proveedor, como perfiles de AWS o credenciales predeterminadas de aplicaciones de Google. Los proveedores sin autenticación nativa por clave, como `openai-codex`, solo muestran un campo de clave si el perfil especifica una referencia a una credencial.

Cuando hay una credencial guardada, el campo muestra una vista enmascarada y un aviso verde indica que se usará la clave guardada. La vista conserva el identificador anterior al primer guion o guion bajo, los cinco caracteres iniciales y los cuatro finales de la clave, siempre que queden al menos ocho caracteres intermedios ocultos. De lo contrario, el identificador y la clave se sustituyen por puntos. El recuento usa puntos de código Unicode. Las claves guardadas carecen de botón para revelarlas y no se pueden copiar, cortar ni editar parcialmente. Escribir o pegar sustituye toda la clave. Pulsa Retroceso o Suprimir y luego **Aplicar** para quitar la clave guardada y usar la autenticación del entorno. Vaciar una clave de sustitución también deja pendiente la eliminación de la clave guardada. **Cancelar** conserva la clave antes de guardar. Si se rechaza la eliminación, se conservan los ajustes. Si se borra la clave pero falla el guardado de los ajustes, un aviso indica que la eliminación es irreversible. Pulsa **Aplicar** para reintentar el guardado o **Cerrar** para dejar el resultado parcial. Si la credencial se comparte, eliminarla afecta a todas las funciones que usan su referencia. Sin una credencial en el entorno, el proveedor queda sin autenticación. Si el campo está vacío, el formulario indica que se usará el entorno y muestra el estado de detección. Si escribes una clave nueva, el formulario te recuerda que la apliques. Si hay una eliminación pendiente y la ruta declara una variable, se indica cuál se usará al aplicar. Las demás entradas no vacías no muestran estado de autenticación. Las variables de dirección aparecen en **URL base** y quedan fuera de la detección de credenciales.

Si has escrito una clave de sustitución, puedes usar **Mostrar secreto** para comprobarla y **Ocultar secreto** para volver a enmascararla. El campo vuelve a ocultar la clave al editarla. Los campos de contraseña nativos no permiten cortar el texto oculto. Selecciona el borrador y pulsa Retroceso para borrarlo, o muestra el secreto antes de cortarlo. Las credenciales guardadas siguen siendo de solo escritura.

<a id="add-a-custom-model-api"></a>

## Añadir una API de modelos personalizada

Cambia la tarjeta a **API de modelos personalizada** para un intermediario, una pasarela corporativa, un servidor propio o cualquier proveedor que falte en el catálogo instalado. Indica un ID de proveedor en minúsculas, una URL base, el protocolo de API, una credencial y al menos un modelo. El **Protocolo de API** debe coincidir con el de la pasarela. Las cuatro opciones son OpenAI Chat Completions, OpenAI Responses, Anthropic Messages y Gemini API. Se guardan en el `cordis.patch.yml` del perfil activo como `openai-completions`, `openai-responses`, `anthropic-messages` y `google-generative-ai`. La URL base de Gemini API incluye la versión de la API, por ejemplo `https://gateway.example/v1beta`. Cada proveedor usa un solo protocolo. Si una pasarela ofrece dos protocolos, configura dos proveedores.

![The custom model API form: Provider ID, display name, base URL, API protocol, and API key](providers-custom-form.png)

El ID del proveedor es permanente porque lo usan las solicitudes, las sesiones guardadas, las preferencias de modelo y las referencias a credenciales. Para cambiarlo, añade otro proveedor y elimina el anterior. Puedes editar el nombre visible, la URL base, el protocolo, la credencial y los modelos.

<a id="discover-models"></a>

### Buscar modelos

En **Catálogo de modelos**, elige **Obtener modelos disponibles** para consultar los modelos que ofrece el endpoint. La solicitud usa la URL base, el protocolo y la clave del formulario, o la clave guardada del proveedor. La respuesta abre un selector con búsqueda. Los modelos ya presentes aparecen marcados. Marca los que quieras añadir, desmarca los que quieras quitar y elige **Actualizar lista**. Los modelos configurados que el endpoint no enumera se conservan. Los cambios se guardan al guardar o crear el proveedor.

La búsqueda admite los formatos de listado habituales de las pasarelas. Si el endpoint no devuelve modelos o la consulta falla, introduce los ID manualmente. Para los proveedores integrados, la búsqueda siempre devuelve el catálogo instalado, incluso si la URL base apunta a una pasarela. Usa un proveedor personalizado para consultar los modelos que ofrece la pasarela.

<a id="select-a-model"></a>

## Seleccionar un modelo

Los proveedores configurados aparecen en el selector de modelos. La selección de un modelo también lo hace predeterminado para nuevas sesiones. Una sesión que ya ha enviado una solicitud conserva el modelo grabado en su propio registro.

Para reordenar los modelos de un proveedor, edítalo en **Ajustes → Modelos**, abre **Configuración personalizada** y arrastra el control de tres líneas del modelo. También puedes enfocar el control y pulsar Flecha arriba o Flecha abajo. **Aplicar** guarda el orden y **Cancelar** descarta los cambios. El selector respeta el orden guardado para cada proveedor.

Si el modelo predeterminado guardado pertenece a un proveedor eliminado, el cuadro de mensaje muestra **Seleccionar modelo** e impide escribir hasta que elijas otro.

<a id="advanced-configuration"></a>

## Configuración avanzada

El catálogo de configuración del plugin [generado](../../config-catalog.md) lista cada campo soportado y predeterminado para cada plugin; [`dsh-llm-pi-ai`](../../config-catalog.md#oceanocean-llm-pi-ai) es la sección proveedor esta página configura. Las referencias [`dsh-llm-pi-ai`](../../../packages/llm/llm-pi-ai/README.md) y [`dsh-llm-deepseek`](../../../packages/llm/llm-deepseek/README.md) poseen configuración directa `cordis.patch.yml` , resolución de catálogos, controles de razonamiento, credenciales y errores de adaptador.

::: tip Ajustes adicionales
La página Modelos muestra la clave de API, el nombre visible, la URL base y el protocolo de API del proveedor, así como el ID, el nombre visible, la ventana de contexto, el máximo de tokens de salida y los tipos de entrada de cada modelo. En los proveedores con API de modelos personalizada también permite configurar los niveles de razonamiento. Para configurar esos niveles en proveedores integrados, las opciones de compatibilidad de solicitudes, las cabeceras, los tiempos de espera y la política de reintentos, edita `$DSH_HOME/profiles/<profile>/cordis.patch.yml`, el mismo archivo que modifica la página. Si el navegador se ejecuta en el mismo equipo que el servidor, también puedes abrirlo con **Abrir archivo de configuración** en la cabecera de Ajustes. Los adaptadores vuelven a leerlo en la siguiente solicitud, sin reiniciar. Las secciones siguientes describen las opciones más habituales de las pasarelas.

Al iniciar la interfaz web con `dsh web`, `<profile>` es `web` y la ruta es `$DSH_HOME/profiles/web/cordis.patch.yml`. Si inicias un perfil personalizado, usa el nombre seleccionado al arrancar.
:::

<a id="image-input"></a>

### Entrada de imagen

En **Ajustes → Modelos**, edita el proveedor, abre **Configuración personalizada** y despliega **Opciones del modelo**. **Tipos de entrada** aparece debajo de los campos de capacidad. Selecciona **Imagen** si el modelo admite imágenes y guarda. **Texto** aparece seleccionado inicialmente en un modelo personalizado nuevo que no hereda la capacidad de imagen. Debe quedar al menos un tipo seleccionado. Para un modelo que solo acepte imágenes, selecciona **Imagen** antes de desmarcar **Texto**.

Las casillas de verificación guardan `input` para los modelos pi-ai y `inputModalities` para el adaptador directo DeepSeek. También puedes editar el modelo en `$DSH_HOME/profiles/<profile>/cordis.patch.yml`; por ejemplo, este proveedor pi-ai personalizado declara un modelo solo de texto y un modelo de visión:

Los ejemplos usan campos de configuración de un parche de perfil. Cordis reemplaza toda la configuración de la entrada al aplicar una modificación. Conserva los demás proveedores y campos cuando edites una modificación existente.

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

El campo `input` de pi-ai acepta `text` e `image` y se aplica solo a ese modelo. Una selección explícita y no vacía tiene prioridad. Si se omite `input` o se deja vacío, se heredan los tipos del catálogo instalado y, en su defecto, el `defaultInput` de la ruta, cuyo valor predeterminado es `[text]`. Las casillas muestran los valores heredados. Abrir la fila no guarda un valor nuevo.

Si omites `inputModalities`, DeepSeek solo admite texto. Una lista vacía se rechaza. Desmarcar **Imagen** también elimina `imagePixelBudget` e `imageMaxBytes` del modelo porque DeepSeek rechaza los límites de imagen en un modelo que solo admite texto. Si vuelves a activar las imágenes y necesitas límites personalizados, configúralos de nuevo.

Para recuperar los valores heredados después de cambiar las casillas, elimina el campo `input` o `inputModalities` del modelo en `cordis.patch.yml`. **Restaurar valores predeterminados** elimina toda la personalización del catálogo, incluidos otros cambios en los modelos. Úsalo cuando quieras restaurar el catálogo entero.

Si todos los modelos que añadiste a mano aceptan imágenes, puedes indicar los tipos predeterminados una sola vez en la ruta.

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

En la configuración de pi-ai, todas las listas deben declarar al menos una modalidad, salvo el propio `input` de un modelo, que puede estar vacío para heredar los valores. Cualquier modalidad desconocida se rechaza.

Estos campos declaran qué entradas admite el endpoint, sin comprobarlo. Si declaras que un modelo admite imágenes y su endpoint no las acepta, el proveedor rechazará la solicitud.

<a id="deepseek-account-models"></a>

### Modelos de cuenta de DeepSeek

Cuando inicias sesión en una cuenta de DeepSeek, los modelos se obtienen del servicio de cuentas y la página Modelos no ofrece un editor para ellos. Para ajustar un modelo, usa `modelOverrides` en `$DSH_HOME/profiles/<profile>/cordis.patch.yml`. Los campos coinciden con los de una entrada de DeepSeek en `models`. Los campos que omitas conservan los valores del listado.

```yaml
- id: llm-deepseek-account
  config:
    modelOverrides:
      deepseek-flash:
        contextWindow: 524288
        maxTokens: 131072
```

Si un modelo requiere una versión más reciente de Ocean, devuelve `CLIENT_UPGRADE_REQUIRED` con la versión que debes instalar. La [referencia del proveedor de cuentas](../../../packages/llm/llm-deepseek-account/README.md) documenta las reglas de listado, alternativas y requisitos de acceso.

<a id="reasoning-effort"></a>

### Esfuerzo de razonamiento

El selector de modelos ofrece un menú **Esfuerzo** si el modelo declara niveles de razonamiento. Los modelos de proveedores integrados heredan los niveles del catálogo instalado y los modelos de DeepSeek conservan los del adaptador. Si añades un modelo manualmente, **Esfuerzo** aparece al declarar niveles. Hasta entonces, el valor predeterminado del endpoint determina si el modelo razona.

Para declarar niveles en una API de modelos personalizada, edita el proveedor en **Ajustes → Modelos**, abre **Configuración personalizada**, despliega **Opciones del modelo** y activa **Niveles de razonamiento**. Los niveles iniciales son desactivado, bajo, medio y alto. Cada fila vincula un nivel con el **Valor API** que se envía, que por defecto coincide con el nombre del nivel. Cámbialo si la documentación de la API del proveedor especifica otro valor. Añade o elimina filas según lo que admite el endpoint, conserva al menos un nivel además de desactivado y guarda. Desactivar la opción elimina la declaración.

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

Cada clave identifica un nivel del menú y su valor es lo que se envía como `reasoning_effort`. Por ejemplo, `max: xhigh` adapta el valor a una pasarela que espera otro nombre. Solo `off` puede dejarse vacío, porque la mayoría de los endpoints desactivan el razonamiento cuando se omite el parámetro. La ruta usa su valor `reasoning` si la sesión aún no ha elegido un nivel. Al seleccionar un nivel se guarda, junto con el modelo, como valor predeterminado de las sesiones nuevas.

Si dejas `off` vacío, se omite el parámetro y solo dejan de razonar los modelos que lo hacen cuando se les solicita. Un `off` con valor lo envía como `reasoning_effort`. Si un modelo razona de forma predeterminada, como DeepSeek V4 detrás de una pasarela compatible con OpenAI, usa `compat.thinkingFormat: deepseek`. Así, `off` envía `thinking: {type: disabled}` y los demás niveles envían `thinking: {type: enabled}` junto al nivel de esfuerzo.

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

Si la pasarela de un modelo de proveedor integrado no admite razonamiento, desactiva sus niveles con `reasoningEfforts: false` dentro de `modelOverrides`. Si el usuario selecciona un nivel para ese modelo, se devuelve `UNSUPPORTED_REASONING_EFFORT`. Los modelos de la ruta de DeepSeek ya ofrecen `off`, `low`, `high` y `max`. `llm-deepseek.reasoningEffort` establece el valor inicial del selector.

```yaml
- id: llm-deepseek
  config:
    reasoningEffort: max
```

<a id="request-compatibility"></a>

### Compatibilidad de solicitudes

Una pasarela con una dirección accesible y una clave válida puede rechazar todas las solicitudes. pi-ai usa la URL del endpoint para decidir el rol del mensaje del sistema, el campo del límite de salida y cómo se envía el nivel de razonamiento. Si no reconoce la URL, envía la solicitud como si fuera a OpenAI. La mayoría de las pasarelas compatibles con OpenAI rechazan alguna opción que OpenAI acepta.

Hay dos causas frecuentes. Para un modelo que declara razonamiento, pi-ai envía el mensaje del sistema con `role: "developer"`, que muchas pasarelas rechazan. También envía el límite de salida en `max_completion_tokens`, que rechazan los servidores que solo conocen `max_tokens`. El formulario carece de esos campos. Configúralos en la ruta de `$DSH_HOME/profiles/<profile>/cordis.patch.yml`.

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

La configuración `compat` de la ruta se usa de forma predeterminada para sus modelos. Los valores de cada modelo tienen prioridad campo por campo. Puedes ajustar un solo modelo sin repetir la configuración de la ruta.

```yaml
        models:
          - id: my-model
          - id: my-reasoner
            compat:
              thinkingFormat: deepseek
```

Si el modelo y la ruta dejan un campo sin definir, se usa el valor del catálogo instalado. Si tampoco existe allí, pi-ai lo detecta. Toda opción declarada necesita un valor. Una clave vacía, como `supportsDeveloperRole:`, se rechaza porque borraría el valor del catálogo sin sustituirlo. Si ningún protocolo admite el nombre, se rechaza y el mensaje enumera las opciones disponibles.

Cada opción pertenece a los protocolos que la definen. Si una opción válida para un valor de `api` se rechaza en otro, el mensaje indica qué admite ese protocolo. Al igual que `input`, estas opciones describen lo que el endpoint admite sin comprobarlo. Configurar una opción innecesaria cambia la solicitud que se envía.

La [referencia de configuración generada de `dsh-llm-pi-ai`](../../config-catalog.md#oceanocean-llm-pi-ai) enumera en `PiAiCompatProfile` todas las opciones, sus valores y los protocolos compatibles. La referencia se genera a partir del código del adaptador.

<a id="troubleshooting"></a>

## Solución de problemas

- **`MISSING_CREDENTIAL`**. Guarda la clave del proveedor en Modelos o configura la variable de entorno indicada.
- **`UNKNOWN_MODEL`**. Selecciona un modelo configurado o añade el que falta al proveedor personalizado.
- **Obtener modelos disponibles devuelve 401**. Comprueba la clave. La búsqueda llama al endpoint `GET /models` compatible con OpenAI. Añade los modelos manualmente si el endpoint no lo ofrece.
- **La búsqueda no devuelve ni una matriz `data` ni un objeto `models`**. El endpoint usa un formato de listado incompatible. Añade los modelos manualmente.
- **La pasarela rechaza todas las solicitudes aunque la clave y la URL sean correctas**. El formato esperado difiere del de OpenAI. Empieza con `compat.supportsDeveloperRole: false` y `compat.maxTokensField: max_tokens` en la ruta.
- **Solo fallan los modelos con razonamiento**. pi-ai usa el rol `developer` para el mensaje del sistema y la pasarela lo rechaza. Configura `compat.supportsDeveloperRole: false`.
- **El menú Esfuerzo no aparece para un modelo añadido manualmente**. El modelo no declara niveles. Si usas una API de modelos personalizada, activa **Niveles de razonamiento** en **Opciones del modelo**. En los demás casos, añade `reasoningEfforts` al modelo en `cordis.patch.yml`.
- **`off` no desactiva el razonamiento en un modelo DeepSeek**. Si `off` está vacío, no se envía ningún campo de razonamiento y el endpoint sigue usando su valor predeterminado. Configura `compat.thinkingFormat: deepseek` en el modelo o en la ruta.
- **Se rechaza una opción de compatibilidad sin valor**. Añade un valor después de los dos puntos o elimina la clave para conservar el valor del catálogo instalado.
- **Se rechaza una imagen antes de enviar la solicitud**. El modelo no declara la modalidad de imagen. Añade `input: [text, image]` al modelo de un proveedor personalizado. En la ruta de DeepSeek, elige un modelo con capacidad de imagen del catálogo configurado (`deepseek-flash` de forma predeterminada) y comprueba que la pasarela acepte imágenes para ese modelo.
- **El proveedor rechaza una solicitud con una imagen**. El endpoint no admite las imágenes que el modelo declara admitir. Retira `image` de la lista que habilitó ese tipo, ya sea el `input` del modelo o el `defaultInput` de la ruta, e inicia una sesión nueva. La imagen adjunta sigue en el registro de la sesión y la solicitud se repite hasta que la sesión deja atrás la imagen.
