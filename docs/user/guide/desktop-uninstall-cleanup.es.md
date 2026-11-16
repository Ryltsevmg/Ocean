<a id="uninstall-ocean-desktop"></a>

# Desinstalar Ocean Desktop

<!-- USER_LANGUAGES_START -->
[English](desktop-uninstall-cleanup.md) | [中文](desktop-uninstall-cleanup.zh.md) | [Русский](desktop-uninstall-cleanup.ru.md) | [日本語](desktop-uninstall-cleanup.ja.md) | Español | [Français](desktop-uninstall-cleanup.fr.md) | [Deutsch](desktop-uninstall-cleanup.de.md) | [Português](desktop-uninstall-cleanup.pt.md) | [한국어](desktop-uninstall-cleanup.ko.md)
<!-- USER_LANGUAGES_END -->

Usa esta guía para desinstalar Ocean Desktop en macOS, Windows o Linux. La eliminación de los datos locales es opcional.

<a id="1-uninstall-the-app"></a>

## 1. Desinstalar la aplicación

Finaliza todos los comandos que usen la CLI incluida en Desktop. Si instalaste el comando `dsh` desde Desktop, selecciona primero **Manage dsh Command… → Remove** en el menú de la aplicación. Esto elimina el registro del comando de Desktop sin desinstalar programas CLI independientes.

Cierra Ocean y desinstálalo siguiendo el procedimiento de tu plataforma:

- **macOS:** Elimina la aplicación de Aplicaciones en Finder.
- **Windows:** Desinstálala desde Configuración → Aplicaciones → Aplicaciones instaladas en Windows 11, o desde Panel de control → Programas → Programas y características.
- **Linux:** Elimina la instalación con el método que utilizaste para instalarla; si extrajiste un directorio, cierra la aplicación y elimina ese directorio de instalación.

<a id="2-inspect-local-data-before-cleanup"></a>

## 2. Revisar los datos locales antes de eliminarlos

Eliminar datos locales puede borrar de forma permanente sesiones, credenciales, ajustes, plugins, cachés y estado compartido de la CLI. Haz una copia de seguridad de lo que quieras conservar. No elimines un directorio solo porque su nombre se parezca a Ocean o DSH.

La carpeta de Ocean predeterminada actual es `~/.ocean`, o `.ocean` dentro del perfil de usuario de Windows. `DSH_HOME` permite elegir otra ubicación; revisa el ajuste con el que se inició Desktop, que puede diferir del que usa tu terminal actual. Los comandos siguientes solo muestran ubicaciones posibles y no eliminan nada. No detectan el directorio `userData` real de Electron ni todas las cachés específicas de la instalación.

::: code-group

```sh [macOS]
: "${HOME:?HOME must be set}"
printf '%s\n' \
  "Ocean home candidate: ${DSH_HOME:-$HOME/.ocean}" \
  "Updater cache candidate: $HOME/Library/Caches/@oceanocean-desktop-updater"
# Previous-release ~/.dsh and donor-era appId caches require separate ownership checks.
```

```powershell [Windows]
$ErrorActionPreference = 'Stop'
if (-not $env:USERPROFILE -or -not $env:LOCALAPPDATA) {
    throw 'USERPROFILE and LOCALAPPDATA must be set.'
}
$oceanHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.ocean' }
"Ocean home candidate: $oceanHome"
"Updater cache candidate: $(Join-Path $env:LOCALAPPDATA '@oceanocean-desktop-updater')"
# Previous-release .dsh and @deepseek-ai data are NOT removed.
# Inspect them separately; delete only data you recognize and no longer need.
```

```sh [Linux]
: "${HOME:?HOME must be set}"
printf '%s\n' \
  "Ocean home candidate: ${DSH_HOME:-$HOME/.ocean}" \
  "Updater cache candidate: ${XDG_CACHE_HOME:-$HOME/.cache}/@oceanocean-desktop-updater"
# Previous-release ~/.dsh requires a separate ownership check.
```

:::

El nombre de la caché del actualizador deriva del nombre del paquete Desktop, no del nombre del producto. Estas ubicaciones corresponden al paquete actual `@ocean/ocean-desktop`; otras compilaciones pueden diferir. En Windows, el [desinstalador](../../../apps/desktop/installer/uninstall.nsh) comprueba los directorios de datos de la aplicación basados en el nombre del producto y del paquete, y la caché del actualizador, pero conserva la carpeta de Ocean; las actualizaciones y reinstalaciones que conservan los datos también pueden mantener los datos de la aplicación.

Localiza los directorios reales de datos y registros de Electron de tu instalación antes de eliminarlos; la [referencia de diagnóstico](../../../apps/desktop/docs/diagnostics/README.md#report-contents) describe las ubicaciones de los registros. Los nombres de las preferencias, ShipIt, el almacenamiento HTTP y las cachés del sistema en macOS dependen del identificador del paquete instalado. El empaquetado requiere un `DSH_DESKTOP_APP_ID` explícito; `com.deepseek.dsh` no es un identificador universal de Ocean. No ejecutes una limpieza con comodines para ese identificador a menos que hayas comprobado por separado que esos archivos son restos de tu instalación anterior.

`~/.dsh` era una ubicación predeterminada anterior, no la actual. Elimina esa carpeta, los datos de aplicaciones anteriores de `@deepseek-ai` o las cachés de identificadores del proyecto original solo si reconoces esos restos y ninguna otra instalación los necesita. Los directorios de desarrollo y pruebas requieren comprobaciones propias.

<a id="3-remove-verified-data-and-check"></a>

## 3. Eliminar los datos verificados y comprobar

Tras confirmar cada ruta exacta y a qué instalación pertenece, elimina únicamente los directorios elegidos con tu gestor de archivos. No toques las rutas que no reconozcas. Confirma que las rutas elegidas ya no existen antes de reinstalar. Si la eliminación informa de un error, revisa los archivos restantes y resuélvelo en lugar de ampliar el alcance de la eliminación.
