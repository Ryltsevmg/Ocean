<a id="get-started-with-the-python-sdk"></a>

# Primeros pasos con el SDK de Python

<!-- USER_LANGUAGES_START -->
[English](python-sdk.md) | [中文](python-sdk.zh.md) | [Русский](python-sdk.ru.md) | [日本語](python-sdk.ja.md) | Español | [Français](python-sdk.fr.md) | [Deutsch](python-sdk.de.md) | [Português](python-sdk.pt.md) | [한국어](python-sdk.ko.md)
<!-- USER_LANGUAGES_END -->

Este tutorial compila el SDK de Python a partir del código fuente de este repositorio, ejecuta el perfil mínimo independiente incluido y muestra cómo personalizar el mismo perfil `dsh` desde tu programa. Ocean aún no tiene una distribución pública validada de su SDK en npm o PyPI.

<a id="prerequisites"></a>

## Requisitos previos

- Python 3.10 o posterior
- Git
- Linux x64, Linux arm64, macOS 14 o posterior en arm64, o Windows x64
- Un endpoint API compatible con DeepSeek y su credencial
- Un espacio de trabajo aislado y una carpeta de Ocean aislada

<a id="build-the-sdk-from-source"></a>

## Compilar el SDK desde el código fuente

<div>
<a id="linux-and-macos"></a>

<a id="windows-powershell"></a>
</div>

Ningún registro público aloja un SDK de Ocean validado; instalar `deepseek-harness-sdk` desde PyPI descarga el paquete del proyecto original, no Ocean. Compila el ejecutable del entorno de ejecución y ambos paquetes wheel en esta copia del repositorio, e instálalos en un entorno virtual.

::: code-group

```sh [Linux/macOS]
git clone https://github.com/Ryltsevmg/Ocean.git
cd Ocean
pnpm install
pnpm exec tsx scripts/build-exe-for-python-sdk.ts
python -m venv .venv
. .venv/bin/activate
python scripts/build-python-release.py --package sdk --output-dir dist-python
python scripts/build-python-release.py --package runtime --platform linux-x64 --runtime-exe dist-exe/deepseek-harness-sdk-runtime-linux-x64 --output-dir dist-python
pip install dist-python/*.whl
```

```powershell [Windows PowerShell]
git clone https://github.com/Ryltsevmg/Ocean.git
Set-Location Ocean
pnpm install
pnpm exec tsx scripts/build-exe-for-python-sdk.ts
py -3.10 -m venv .venv
.venv\Scripts\Activate.ps1
python scripts/build-python-release.py --package sdk --output-dir dist-python
python scripts/build-python-release.py --package runtime --platform win-x64 --runtime-exe dist-exe/deepseek-harness-sdk-runtime-win-x64.exe --output-dir dist-python
python -m pip install (Get-ChildItem dist-python\*.whl)
```

:::

Elige el valor de `--platform` y el ejecutable correspondiente de `dist-exe/` para tu equipo: `linux-x64`, `linux-arm64`, `macos-arm64`, `macos-x64` o `win-x64`; compila cada destino en su arquitectura nativa. La instalación incluye un wheel del entorno de ejecución nativo correspondiente y el comando `dsh`. El uso normal del SDK no necesita Node.js del sistema. El [flujo de trabajo de contribución en Python](../../../python/development.md) define los nombres exactos de archivos, la validación y las comprobaciones de publicación de estos pasos de compilación.

<a id="run-the-checked-in-example"></a>

## Ejecutar el ejemplo incluido

Exporta la credencial y, cuando sea necesario, un endpoint de proxy compatible:

<div>
<a id="linux-and-macos-1"></a>

<a id="windows-powershell-1"></a>
</div>

::: code-group

```sh [Linux/macOS]
export DEEPSEEK_API_KEY=sk-your-key-here
# export DEEPSEEK_BASE_URL=http://127.0.0.1:8000/v1
```

```powershell [Windows PowerShell]
$env:DEEPSEEK_API_KEY = "sk-your-key-here"
# $env:DEEPSEEK_BASE_URL = "http://127.0.0.1:8000/v1"
```

:::

Ejecuta una tarea con rutas explícitas del espacio de trabajo y de la carpeta de Ocean:

<div>
<a id="linux-and-macos-2"></a>

<a id="windows-powershell-2"></a>
</div>

::: code-group

```sh [Linux/macOS]
python python/sdk/examples/minimal.py \
  --workspace /absolute/path/to/disposable-workspace \
  --dsh-home /absolute/path/to/example-dsh-home \
  --session-id example-001 \
  "Inspect the repository and fix the failing tests."
```

```powershell [Windows PowerShell]
python python/sdk/examples/minimal.py `
  --workspace C:\work\disposable-workspace `
  --dsh-home C:\work\example-dsh-home `
  --session-id example-001 `
  "Inspect the repository and fix the failing tests."
```

:::

El script muestra la respuesta final del asistente o el resultado del comando proporcionado por el perfil seleccionado. La carpeta de Ocean elegida recibe el perfil generado `sdk-minimal`, los plugins instalados y los registros de sesión JSONL sin comprimir en `sessions/`. El ejemplo y el SDK nunca leen `~/.dsh` de forma silenciosa.

<a id="use-the-sdk-in-your-program"></a>

## Usar el SDK en tu programa

```python
from pathlib import Path

from deepseek_harness import DeepSeekHarness

workspace = Path("/absolute/path/to/disposable-workspace").resolve()
dsh_home = Path("/absolute/path/to/example-dsh-home").resolve()
with DeepSeekHarness(
    provider="deepseek-official",
    model="deepseek-v4-flash",
    max_tokens=49_152,
    cwd=str(workspace),
    dsh_home=str(dsh_home),
    profile="sdk-minimal",
) as harness:
    result = harness.run(
        "Inspect the repository and fix the failing tests.",
        session_id="example-001",
    )

print(result.final_response)
```

El SDK inicia el proceso incluido `dsh --profile sdk-minimal` cuando hace falta y lo reutiliza hasta salir del gestor de contexto. El perfil, su parche persistente, el parche de la carpeta de Ocean y cualquier tupla ordenada `patches` forman la configuración de la aplicación. No existe un ejecutable de entorno Python independiente ni una opción de configuración completa.

<a id="install-or-define-plugins"></a>

## Instalar o definir plugins

Usa `dsh plugin` para las dependencias y capas de paquetes que deban persistir en esta carpeta de Ocean:

<div>
<a id="linux-and-macos-3"></a>

<a id="windows-powershell-3"></a>
</div>

::: code-group

```sh [Linux/macOS]
export DSH_HOME=/absolute/path/to/example-dsh-home
dsh --profile sdk-minimal --dump-default-config >/dev/null
dsh plugin --profile sdk-minimal add file:/absolute/path/to/my-plugin-bundle
```

```powershell [Windows PowerShell]
$env:DSH_HOME = "C:\work\example-dsh-home"
dsh --profile sdk-minimal --dump-default-config | Out-Null
dsh plugin --profile sdk-minimal add file:C:/work/my-plugin-bundle
```

:::

El primer comando inicializa el perfil independiente incluido. El segundo delega la gestión de paquetes en `pnpm` y registra cada paquete instalado que exporte una capa `dsh.bundle`. Instala `pnpm` solo para este comando de gestión; no hace falta para iniciar el SDK instalado. Edita `$DSH_HOME/profiles/sdk-minimal/cordis.patch.yml` para cambiar entradas de forma persistente, o pasa archivos de parches desde Python para cambios en cada inicio.

Otro `profile` es válido si incluye `@ocean/ocean-sdk-app` u otra entrada de servidor JSON-RPC. La ausencia de entradas de servidor, los plugins sin resolver y los parches inválidos provocan un fallo al inicio en lugar de recurrir a otra composición.

<a id="opt-in-to-str_replace_editor"></a>
### Activar `str_replace_editor`

El entorno incluido contiene `str_replace_editor`, pero `sdk-minimal` lo omite del árbol Cordis predeterminado. Para usarlo, guarda esta configuración como `editor.patch.yml`; `insert` añade el editor usando el proveedor del sistema de archivos existente:

```yaml
- insert:
    - id: tool-str-replace-editor
      name: '@ocean/ocean-tool-str-replace-editor'
```

Pasa `patches=("/absolute/path/to/editor.patch.yml",)` al construir `DeepSeekHarness(profile="sdk-minimal", ...)`, o coloca el parche en `$DSH_HOME/profiles/sdk-minimal/cordis.patch.yml` para una configuración persistente. En el siguiente inicio del entorno, las solicitudes al modelo incluirán `str_replace_editor` junto a las herramientas predeterminadas. El proveedor del sistema de archivos local usa el directorio de trabajo del entorno para las rutas relativas; como el shell mínimo, no limita el acceso a ese directorio. El mismo parche funciona con el perfil estándar `sdk`.

<a id="enable-team-mode"></a>
### Activar el modo Team

Usa el perfil estándar `sdk` para Agent Teams; `sdk-minimal` no incluye subagentes ni servicios Team. Guarda el [parche Team](../../../apps/cli/config/examples/team-mode.yml) como `team-mode.yml`:

```yaml
- id: agent-team
  config:
    defaultEnabled: true
```

Pasa su ruta absoluta en la opción `patches` del SDK con `profile="sdk"`. Python usa `patches=("/absolute/path/to/team-mode.yml",)`; TypeScript usa `patches: ["/absolute/path/to/team-mode.yml"]`. El parche sustituye toda la configuración de la entrada `agent-team`, por lo que debes incluir cualquier límite personalizado `maxTasks` en el mismo mapeo.

Crea una Session raíz nueva y pídele que cree y enumere una tarea compartida. Su primera solicitud al modelo incluye las herramientas Team y las instrucciones de colaboración. La raíz guarda su modo y los subagentes lo comparten. Reanudar una Session existente conserva su modo, aunque se hubiera desactivado explícitamente o nunca se hubiera activado; cambiar o eliminar este parche no sustituye las selecciones guardadas. Consulta la [referencia del servicio Team](../../../packages/team/agent-team/README.md#use-this-package) para conocer la semántica del modo y de las tareas.

<a id="understand-the-minimal-profile"></a>

## Entender el perfil mínimo

| Propiedad | Valor |
|---|---|
| Prompt del sistema | `DSH_SYSTEM_PROMPT`, con `You are a helpful software engineer assistant.` como alternativa |
| Modelo en `minimal.py` | `--model`, después `DSH_MODEL` y después `deepseek-v4-flash` |
| Herramientas visibles para el modelo | `bash` persistente en Linux/macOS o `pwsh` en Windows, `read_image` y `working_directory` |
| Tiempo de espera del shell | 300 segundos |
| Contexto de ejecución opcional | Ausente |
| Compactación de contexto | Automática; resume el historial anterior mediante una solicitud adicional al modelo |
| Persistencia de sesiones | JSONL sin comprimir en `<dsh_home>/sessions` |

El único paquete del perfil inserta el árbol completo sobre una raíz vacía y no incluye `dsh-base`; por tanto, las herramientas añadidas después al perfil base no pueden aparecer implícitamente. Contiene el protocolo del SDK, un adaptador DeepSeek configurado mediante el entorno, ejecución local y persistencia, pero no herramientas de archivos de texto, ajustes, credenciales gestionadas, telemetría OTel, herramientas web, subagentes ni descubrimiento de instrucciones locales. El [componente de registros de sesión de DeepSeek](../../../packages/session/session-log-deepseek/README.md) envía por defecto los eventos de registro aún no aceptados con las solicitudes DeepSeek, hasta `maxBytes` (8 MiB) por solicitud; configura `session-log-deepseek.enabled: false` en un parche del perfil para desactivarlo. Fija `danger-full-access`, por lo que el shell persistente elegido para la plataforma puede modificar cualquier ruta visible para el entorno; usa una copia desechable del repositorio o un contenedor.

La lectura de imágenes requiere una ruta que admita imágenes. La compactación automática conserva el registro completo de la Session; consulta la [referencia del paquete](../../../packages/bundle/sdk-minimal/README.md) para conocer sus efectos sobre el modelo y el almacenamiento. En esta composición `sdk-minimal`, las entradas con barra no admitidas se mantienen como texto normal del prompt.

El wheel instalado sigue incluyendo el perfil completo `web` y los recursos del frontend. Ejecuta `dsh web` con un `DSH_HOME` explícito cuando un despliegue del SDK de Python también necesite la aplicación de navegador; `web` es una aplicación CLI independiente y no puede servir a un cliente del SDK de Python.

Usa una carpeta de Ocean nueva cuando debas aislar perfiles, plugins, credenciales, ajustes y sesiones. Usa un identificador de sesión nuevo para trabajo independiente; reutiliza un harness, su carpeta y el identificador solo para continuar la misma conversación persistente y los recursos de esa sesión.

La [referencia del paquete](../../../packages/bundle/sdk-minimal/README.md) define el árbol exacto y la [referencia del ejemplo](../../../python/sdk/examples/README.md) define el programa ejecutable. La [referencia del SDK de Python](../../../python/sdk/README.md) explica el ciclo de vida, los resultados, las notificaciones y el comportamiento de bajo nivel; la [referencia de la CLI dsh](../../../apps/cli/reference/README.md) explica las capas de los perfiles.
