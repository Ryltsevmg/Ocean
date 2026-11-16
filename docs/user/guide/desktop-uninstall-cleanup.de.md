<a id="uninstall-ocean-desktop"></a>

# Uninstallieren Ocean Desktop

<!-- USER_LANGUAGES_START -->
[English](desktop-uninstall-cleanup.md) | [中文](desktop-uninstall-cleanup.zh.md) | [Русский](desktop-uninstall-cleanup.ru.md) | [日本語](desktop-uninstall-cleanup.ja.md) | [Español](desktop-uninstall-cleanup.es.md) | [Français](desktop-uninstall-cleanup.fr.md) | Deutsch | [Português](desktop-uninstall-cleanup.pt.md) | [한국어](desktop-uninstall-cleanup.ko.md)
<!-- USER_LANGUAGES_END -->

Verwenden Sie dieses Handbuch, um Ocean Desktop unter macOS, Windows oder Linux zu deinstallieren. Lokale Datenbereinigung ist optional.

<a id="1-uninstall-the-app"></a>

## 1. Deinstallieren Sie die App

Beenden Sie alle Befehle mit der gebündelten CLI von Desktop. Wenn Sie den `dsh` -Befehl über Desktop installiert haben, wählen Sie zuerst **Manage dsh Command... → Entfernen Sie** im Anwendungsmenü. Dadurch wird die Registrierung des Desktop-Befehls entfernt, ohne unabhängige CLI-Programme zu deinstallieren.

Beenden Sie Ocean und deinstallieren Sie es dann mit der Prozedur Ihrer Plattform:

- **macOS:** Löschen Sie die App aus Anwendungen im Finder.
- **Windows:** Deinstallieren Sie es über Einstellungen → Apps → Installierte Apps unter Windows 11 oder Systemsteuerung → Programme → Programme und Funktionen.
- **Linux:** Entfernen Sie die Installation mit der Methode, die sie installiert hat; für ein extrahiertes Verzeichnis entfernen Sie dieses Installationsverzeichnis, nachdem Sie die App beendet haben.

<a id="2-inspect-local-data-before-cleanup"></a>

## 2. Lokale Daten vor der Bereinigung prüfen

Durch das Löschen lokaler Daten können Sitzungen, Anmeldeinformationen, Einstellungen, Plugins, Caches und gemeinsam genutzter CLI-Zustand dauerhaft entfernt werden.

Der aktuelle Standard Ocean Home ist `~/.ocean`oder `.ocean` unter dem Windows-Benutzerprofil. `DSH_HOME` kann einen anderen Standort auswählen; Überprüfen Sie die Einstellung, die zum Starten von Desktop verwendet wird, die vom aktuellen Terminal abweichen kann. Die folgenden Befehle drucken nur Kandidatenstandorte aus und löschen nichts. Sie entdecken nicht das tatsächliche `userData` -Verzeichnis von Electron oder alle installationsspezifischen Caches.

::: Codegruppe

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

Der Updater-Cache-Name wird vom Desktop-Paketnamen und nicht vom Produkttitel abgeleitet. Diese Kandidaten verwenden das aktuelle `@ocean/ocean-desktop` -Paket; ein anderer Build kann abweichen. Unter Windows überprüft der [-Deinstaller](../../../apps/desktop/installer/uninstall.nsh) die Produkt- und Paketnamen-Anwendungsdatenverzeichnisse und den Updater-Cache, bewahrt jedoch das Ocean-Home; Updates und Retained-Data-Neuinstallationen können auch Anwendungsdaten speichern.

Finden Sie die tatsächlichen Electron-Daten und Protokollverzeichnisse für Ihre Installation, bevor Sie sie entfernen; die [-Diagnosereferenz](../../../apps/desktop/docs/diagnostics/README.md#report-contents) beschreibt die Protokollstandorte. macOS-Präferenz, ShipIt, HTTP-Speicher und System-Cache-Namen hängen von der installierten Bündelkennung ab. Die Verpackung erfordert eine explizite `DSH_DESKTOP_APP_ID`; `com.deepseek.dsh` ist keine universelle Ocean-Kennung. Führen Sie keine Platzhalterbereinigung für diese Kennung aus, es sei denn, Sie haben diese Dateien unabhängig als Reste Ihrer vorherigen Installation identifiziert.

`~/.dsh` Es war ein früherer Ausfall, nicht der aktuelle Ausfall. Löschen Sie es, frühere `@deepseek-ai` -Anwendungsdaten oder Spender-Ära-IDCaches nur, wenn Sie diese Reste erkennen und keine andere Installation sie benötigt. Entwicklungs- und Testverzeichnisse erfordern eigene Prüfungen.

<a id="3-remove-verified-data-and-check"></a>

## 3. Verifizierte Daten entfernen und überprüfen

Nachdem Sie jeden genauen Pfad und seinen Besitz bestätigt haben, entfernen Sie nur die Verzeichnisse, die Sie mit Ihrem Dateimanager ausgewählt haben. Lassen Sie unerkannte Pfade unberührt. Bestätigen Sie, dass die ausgewählten Pfade vor der Neuinstallation nicht mehr vorhanden sind. Wenn das Entfernen einen Fehler meldet, prüfen Sie die verbleibenden Dateien und beheben Sie den Fehler, anstatt das Löschziel zu erweitern.
