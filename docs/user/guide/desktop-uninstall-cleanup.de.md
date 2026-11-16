<a id="uninstall-ocean-desktop"></a>

# Ocean Desktop deinstallieren

<!-- USER_LANGUAGES_START -->
[English](desktop-uninstall-cleanup.md) | [中文](desktop-uninstall-cleanup.zh.md) | [Русский](desktop-uninstall-cleanup.ru.md) | [日本語](desktop-uninstall-cleanup.ja.md) | [Español](desktop-uninstall-cleanup.es.md) | [Français](desktop-uninstall-cleanup.fr.md) | Deutsch | [Português](desktop-uninstall-cleanup.pt.md) | [한국어](desktop-uninstall-cleanup.ko.md)
<!-- USER_LANGUAGES_END -->

Verwenden Sie dieses Handbuch, um Ocean Desktop unter macOS, Windows oder Linux zu deinstallieren. Lokale Datenbereinigung ist optional.

<a id="1-uninstall-the-app"></a>

## 1. Die App deinstallieren

Lassen Sie laufende Befehle der mit Ocean Desktop ausgelieferten CLI zu Ende laufen. Wenn Sie den Befehl `dsh` über die App installiert haben, wählen Sie zuerst **dsh-Befehl verwalten… → Entfernen** im Anwendungsmenü. Dadurch wird die Registrierung des von Ocean Desktop bereitgestellten Befehls entfernt. Unabhängige CLI-Programme bleiben installiert.

Beenden Sie Ocean und deinstallieren Sie es dann mit der Prozedur Ihrer Plattform:

- **macOS:** Löschen Sie die App aus Anwendungen im Finder.
- **Windows:** Deinstallieren Sie es über Einstellungen → Apps → Installierte Apps unter Windows 11 oder Systemsteuerung → Programme → Programme und Funktionen.
- **Linux:** Verwenden Sie zum Entfernen dieselbe Methode wie bei der Installation. Wenn Sie die App in ein Verzeichnis entpackt haben, löschen Sie dieses Verzeichnis nach dem Beenden der App.

<a id="2-inspect-local-data-before-cleanup"></a>

## 2. Lokale Daten vor der Bereinigung prüfen

Beim Löschen lokaler Daten können Sitzungen, Anmeldedaten, Einstellungen, Plugins, Caches und gemeinsam genutzte CLI-Daten dauerhaft verloren gehen. Sichern Sie alle Daten, die Sie behalten möchten. Löschen Sie kein Verzeichnis allein deshalb, weil sein Name an Ocean oder DSH erinnert.

Das aktuelle Standardverzeichnis für Ocean-Daten ist `~/.ocean`, unter Windows `.ocean` im Benutzerprofil. Mit `DSH_HOME` können Sie einen anderen Pfad festlegen. Prüfen Sie den beim Start von Ocean Desktop verwendeten Wert, der von dem im aktuellen Terminal abweichen kann. Die folgenden Befehle geben nur mögliche Pfade aus und löschen nichts. Sie ermitteln weder das tatsächlich von Electron genutzte Verzeichnis `userData` noch alle installationsspezifischen Caches.

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

Der Name des Update-Caches leitet sich vom Desktop-Paketnamen ab. Die hier genannten Pfade gelten für das aktuelle Paket `@ocean/ocean-desktop` und können sich bei einem anderen Build unterscheiden. Unter Windows prüft das [Deinstallationsprogramm](../../../apps/desktop/installer/uninstall.nsh) die nach Produkt und Paket benannten Anwendungsdatenverzeichnisse sowie den Update-Cache, lässt aber das Ocean-Datenverzeichnis bestehen. Auch bei Updates oder bei einer Neuinstallation mit Datenübernahme können Anwendungsdaten erhalten bleiben.

Ermitteln Sie vor dem Löschen die tatsächlichen Electron-Daten- und Protokollverzeichnisse Ihrer Installation. Die [Diagnosereferenz](../../../apps/desktop/docs/diagnostics/README.md#report-contents) nennt die Protokollpfade. Die Namen für macOS-Einstellungen, ShipIt, HTTP-Speicher und Systemcaches hängen von der Bundle-ID der installierten App ab. Zum Erstellen eines Pakets muss `DSH_DESKTOP_APP_ID` ausdrücklich gesetzt sein. `com.deepseek.dsh` ist keine allgemeingültige Ocean-Kennung. Löschen Sie mit einem Platzhalter für diese Kennung nur dann Dateien, wenn Sie sie unabhängig davon als Reste Ihrer früheren Installation erkannt haben.

`~/.dsh` war in früheren Versionen das Standardverzeichnis. Löschen Sie dieses Verzeichnis, frühere Anwendungsdaten von `@deepseek-ai` oder Caches mit Kennungen des Ursprungsprojekts nur, wenn Sie diese Daten zuordnen können und keine andere Installation sie benötigt. Prüfen Sie Entwicklungs- und Testverzeichnisse separat.

<a id="3-remove-verified-data-and-check"></a>

## 3. Verifizierte Daten entfernen und überprüfen

Prüfen Sie für jedes Verzeichnis den genauen Pfad und die zugehörige Installation. Entfernen Sie anschließend nur die ausgewählten Verzeichnisse mit Ihrem Dateimanager. Lassen Sie unbekannte Pfade unangetastet und prüfen Sie vor der Neuinstallation, dass die ausgewählten Pfade nicht mehr existieren. Falls beim Löschen ein Fehler auftritt, prüfen Sie die übrigen Dateien und beheben Sie die Ursache, ohne weitere Pfade zum Löschen hinzuzunehmen.
