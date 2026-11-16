<a id="uninstall-ocean-desktop"></a>

# Удаление Ocean Desktop

<!-- USER_LANGUAGES_START -->
[English](desktop-uninstall-cleanup.md) | [中文](desktop-uninstall-cleanup.zh.md) | Русский | [日本語](desktop-uninstall-cleanup.ja.md) | [Español](desktop-uninstall-cleanup.es.md) | [Français](desktop-uninstall-cleanup.fr.md) | [Deutsch](desktop-uninstall-cleanup.de.md) | [Português](desktop-uninstall-cleanup.pt.md) | [한국어](desktop-uninstall-cleanup.ko.md)
<!-- USER_LANGUAGES_END -->

Используйте это руководство для удаления Ocean Desktop на macOS, Windows или Linux.

<a id="1-uninstall-the-app"></a>

## 1. Удалите приложение

Дождитесь завершения команд, запущенных через встроенный CLI Ocean Desktop. Если вы установили команду `dsh` через Desktop, сначала выберите **Manage dsh Command… → Remove** в меню приложения. Это отменит регистрацию команды Desktop, не удаляя независимо установленные программы CLI.

Закройте Ocean и удалите приложение средствами вашей системы:

- **macOS:** Удалить приложение из Приложений в Finder.
- **Windows:** Удалить его через Настройки → Приложения → Установленные приложения на Windows 11, или Панель управления → Программы → Программы и функции.
- **Linux:** Удалить установку с помощью метода, который ее установил; для извлеченного каталога удалить этот каталог установки после выхода из приложения.

<a id="2-inspect-local-data-before-cleanup"></a>

## 2. Проверьте локальные данные перед очисткой

Удаление локальных данных может навсегда удалить сеансы, учетные данные, настройки, плагины, кэши и общее состояние CLI. Сделайте резервную копию данных, которые хотите сохранить. Не удаляйте каталог только потому, что его название напоминает Ocean или DSH.

По умолчанию Ocean хранит данные в `~/.ocean`, а в Windows — в `.ocean` внутри профиля пользователя. Переменная `DSH_HOME` может указывать другой путь. Проверьте значение при запуске Desktop: оно может отличаться от значения в текущем терминале. Команды ниже только выводят возможные пути. Они ничего не удаляют и не определяют фактический каталог Electron `userData` или все кэши конкретной установки.

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

Имя кэша обновлений образовано от имени пакета Desktop. Примеры учитывают текущий пакет `@ocean/ocean-desktop`. У другой сборки пути могут отличаться. В Windows [деинсталлятор](../../../apps/desktop/installer/uninstall.nsh) проверяет каталоги данных по имени продукта и пакета, а также кэш обновлений, но сохраняет домашний каталог Ocean. Обновление и переустановка с сохранением данных могут сохранять и данные приложения.

Перед удалением найдите каталоги данных и журналов Electron для вашей установки. Пути к журналам описаны в [справке по диагностике](../../../apps/desktop/docs/diagnostics/README.md#report-contents). В macOS имена настроек, ShipIt, HTTP-хранилища и системных кэшей зависят от идентификатора установленного пакета. Для сборки указывается явный `DSH_DESKTOP_APP_ID`. Идентификатор `com.deepseek.dsh` не является общим для всех сборок Ocean. Не удаляйте файлы по маске для этого идентификатора, пока не убедитесь, что они остались от вашей прежней установки.

Каталог `~/.dsh` использовался по умолчанию в прежней версии. Удаляйте его, прежние данные `@deepseek-ai` и кэши с идентификаторами исходного проекта только если можете опознать эти остатки и они не нужны другим установкам. Каталоги разработки и тестирования проверяйте отдельно.

<a id="3-remove-verified-data-and-check"></a>

## 3. Удалите проверенные данные и проверьте результат

После подтверждения каждого точного пути и его владельца, удалите только те каталоги, которые вы выбрали с помощью файлового менеджера. Оставьте непризнанные пути нетронутыми. Подтвердите, что выбранные пути больше не существуют до переустановки. Если удаление сообщает об ошибке, проверьте оставшиеся файлы и устраните ошибку, а не расширьте цель удаления.
