<a id="uninstall-ocean-desktop"></a>

# Удаление Ocean Desktop

<!-- USER_LANGUAGES_START -->
[English](desktop-uninstall-cleanup.md) | [中文](desktop-uninstall-cleanup.zh.md) | Русский | [日本語](desktop-uninstall-cleanup.ja.md) | [Español](desktop-uninstall-cleanup.es.md) | [Français](desktop-uninstall-cleanup.fr.md) | [Deutsch](desktop-uninstall-cleanup.de.md) | [Português](desktop-uninstall-cleanup.pt.md) | [한국어](desktop-uninstall-cleanup.ko.md)
<!-- USER_LANGUAGES_END -->

Используйте это руководство для удаления Ocean Desktop на macOS, Windows или Linux.

<a id="1-uninstall-the-app"></a>

## 1.Удалить приложение

Заканчивайте любые команды с помощью CLI Desktop. Если вы установили команду `dsh` через Desktop, сначала выберите команду **Manage dsh Command... → Удалите** в меню приложения. Это устраняет регистрацию команд Desktop без удаления независимых программ CLI.

Бросьте Ocean, а затем удалите его с помощью процедуры вашей платформы:

- **macOS:** Удалить приложение из Приложений в Finder.
- **Windows:** Удалить его через Настройки → Приложения → Установленные приложения на Windows 11, или Панель управления → Программы → Программы и функции.
- **Linux:** Удалить установку с помощью метода, который ее установил; для извлеченного каталога удалить этот каталог установки после выхода из приложения.

<a id="2-inspect-local-data-before-cleanup"></a>

## 2. Проверить местные данные перед очисткой

Удаление локальных данных может навсегда удалить сеансы, учетные данные, настройки, плагины, кэши и общее состояние CLI. Резервное копирование всего, что вы хотите сохранить. Не удаляйте каталог только потому, что его название напоминает Ocean или DSH.

Текущий дом Ocean по умолчанию - `~/.ocean`или `.ocean` под профилем пользователя Windows. `DSH_HOME` может выбрать другое местоположение; проверьте настройки, используемые для запуска рабочего стола, которые могут отличаться от текущего терминала. Приведенные ниже команды только распечатывают местоположение кандидата и ничего не удаляют. Они не обнаруживают фактический каталог `userData` компании Electron или все кэши, предназначенные для установки.

::: Код-группа

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

Название кэша обновления происходит от названия пакета Desktop, а не названия продукта. Эти кандидаты используют текущий пакет `@ocean/ocean-desktop` ; другая сборка может отличаться. В Windows [uninstaller](../../../apps/desktop/installer/uninstall.nsh) проверяет имя продукта и имя пакета каталогов прикладных данных и кэш обновлений, но сохраняет домашнюю информацию Ocean; обновления и переустановка сохраненных данных также могут сохранять данные приложения.

Найдите фактические данные Electron и каталоги журналов для вашей установки, прежде чем удалять их. [диагностический справочник](../../../apps/desktop/docs/diagnostics/README.md#report-contents) Предпочтение macOS, ShipIt, HTTP-хранилище и имена системных кэшей зависят от установленного идентификатора пакета. `DSH_DESKTOP_APP_ID`; `com.deepseek.dsh` Не запускайте очистку wildcard для этого идентификатора, если вы самостоятельно не идентифицировали эти файлы как остатки от вашей предыдущей установки.

`~/.dsh` Это был предыдущий дефолт, а не текущий. Удалите его, предыдущие данные приложения `@deepseek-ai` или кэши идентификаторов эпохи донора, только если вы распознаете эти остатки и никакие другие установки не нуждаются в них. Каталоги разработки и тестирования требуют собственных проверок.

<a id="3-remove-verified-data-and-check"></a>

## 3. Удалить проверенные данные и проверить

После подтверждения каждого точного пути и его владельца, удалите только те каталоги, которые вы выбрали с помощью файлового менеджера. Оставьте непризнанные пути нетронутыми. Подтвердите, что выбранные пути больше не существуют до переустановки. Если удаление сообщает об ошибке, проверьте оставшиеся файлы и устраните ошибку, а не расширьте цель удаления.
