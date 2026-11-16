<a id="get-started-with-the-python-sdk"></a>

# Einstieg in das Python-SDK

<!-- USER_LANGUAGES_START -->
[English](python-sdk.md) | [中文](python-sdk.zh.md) | [Русский](python-sdk.ru.md) | [日本語](python-sdk.ja.md) | [Español](python-sdk.es.md) | [Français](python-sdk.fr.md) | Deutsch | [Português](python-sdk.pt.md) | [한국어](python-sdk.ko.md)
<!-- USER_LANGUAGES_END -->

In diesem Tutorial erstellen Sie das Python-SDK aus dem Quellcode dieses Repositorys, führen das mitgelieferte eigenständige Minimalprofil aus und passen dasselbe `dsh`-Profil aus Ihrem eigenen Programm an. Für Ocean gibt es noch keine geprüfte öffentliche SDK-Distribution auf npm oder PyPI.

<a id="prerequisites"></a>

## Voraussetzungen

- Python 3.10 oder neuer
- Git
- Linux x64, Linux arm64, macOS 14 oder neuer unter arm64 oder Windows x64
- Ein DeepSeek-kompatibler API-Endpunkt und passende Anmeldedaten
- Ein isolierter Arbeitsbereich und ein isoliertes Ocean-Datenverzeichnis

<a id="build-the-sdk-from-source"></a>

## Das SDK aus dem Quellcode erstellen

<div>
<a id="linux-and-macos"></a>

<a id="windows-powershell"></a>
</div>

In keiner öffentlichen Registry gibt es ein geprüftes Ocean-SDK. Wenn Sie `deepseek-harness-sdk` von PyPI installieren, erhalten Sie das Paket des Ursprungsprojekts. Erstellen Sie die Laufzeitdatei und beide Wheel-Pakete aus diesem Checkout und installieren Sie sie in einer virtuellen Umgebung.

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

Wählen Sie den `--platform`-Wert und die passende `dist-exe/`-Ausführungsdatei für Ihre Maschine: `linux-x64`, `linux-arm64`, `macos-arm64`, `macos-x64` oder `win-x64`; bauen Sie jedes Ziel auf seiner nativen Architektur auf. Die Installation enthält ein passendes natives Runtime-Rad und den Befehl `dsh` . Normale SDK-Ausführung benötigt kein System Node.js. Der [Python Contributor Workflow](../../../python/development.md) besitzt die genauen Dateinamen, Validierung und Release-Prüfungen für diese Build-Schritte.

<a id="run-the-checked-in-example"></a>

## Das mitgelieferte Beispiel ausführen

Exportieren Sie die Anmeldeinformationen und, wenn nötig, einen kompatiblen Proxy-Endpunkt:

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

Führen Sie eine Aufgabe aus und geben Sie die Pfade zum Arbeitsbereich und zum Datenverzeichnis ausdrücklich an.

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

Das Skript gibt die abschließende Antwort des Assistenten oder das vom gewählten Profil gelieferte Befehlsergebnis aus. Im gewählten Datenverzeichnis speichert es das erzeugte Profil `sdk-minimal`, installierte Plugins und unkomprimierte JSONL-Sitzungsprotokolle unter `sessions/`. Das Beispiel und das SDK greifen niemals implizit auf `~/.dsh` zu.

<a id="use-the-sdk-in-your-program"></a>

## Verwenden Sie das SDK in Ihrem Programm

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

Das SDK startet den mitgelieferten Prozess `dsh --profile sdk-minimal` bei der ersten Verwendung und nutzt ihn bis zum Verlassen des Kontextmanagers weiter. Das Profil, sein dauerhafter Patch, der Patch im Datenverzeichnis und das geordnete Tupel `patches` bilden die Anwendungskonfiguration. Es gibt weder eine separate ausführbare Python-Laufzeitdatei noch eine Option für eine vollständige Konfiguration.

<a id="install-or-define-plugins"></a>

## Installieren oder Definieren von Plugins

Verwenden Sie `dsh plugin` für Abhängigkeiten und Bündelebenen, die in diesem Haus bestehen bleiben sollten:

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

Der erste Befehl initialisiert das mitgelieferte eigenständige Profil. Der zweite delegiert die Paketverwaltung an `pnpm` und registriert jedes installierte Paket, das eine Ebene `dsh.bundle` exportiert. Installieren Sie `pnpm` nur für diesen Verwaltungsbefehl. Das installierte SDK benötigt es beim Start nicht. Bearbeiten Sie `$DSH_HOME/profiles/sdk-minimal/cordis.patch.yml` für dauerhafte Änderungen an den Einträgen oder übergeben Sie beim Start Patchdateien aus Python.

Ein anderes `profile` ist gültig, wenn es `@ocean/ocean-sdk-app` oder eine andere JSON-RPC-Serverzeile enthält. Fehlende Serverzeilen, ungelöste Plugins und ungültige Patches scheitern beim Starten, anstatt auf eine andere Zusammensetzung zurückzugreifen.

<a id="opt-in-to-str_replace_editor"></a>
### `str_replace_editor` aktivieren

Die mitgelieferte Laufzeit enthält `str_replace_editor`. In der Standardkonfiguration von `sdk-minimal` fehlt das Tool im Cordis-Baum. Speichern Sie diese Konfiguration als `editor.patch.yml`, wenn Sie das Tool verwenden möchten. `insert` fügt den Editor mit dem vorhandenen Dateisystemanbieter hinzu.

```yaml
- insert:
    - id: tool-str-replace-editor
      name: '@ocean/ocean-tool-str-replace-editor'
```

Passen Sie `patches=("/absolute/path/to/editor.patch.yml",)` beim Erstellen von `DeepSeekHarness(profile="sdk-minimal", ...)` oder legen Sie den Patch in `$DSH_HOME/profiles/sdk-minimal/cordis.patch.yml` für eine dauerhafte Konfiguration. Beim nächsten Runtime-Start enthalten Modellanforderungen `str_replace_editor` neben den Standard-Tools. Der lokale Dateisystemanbieter verwendet das Arbeitsverzeichnis zur Laufzeit für relative Pfade; wie die Minimal-Shell beschränkt er den Zugriff auf dieses Verzeichnis nicht. Der gleiche Patch funktioniert mit dem Standard- `sdk`-Profil.

<a id="enable-team-mode"></a>
### Teammodus aktivieren

Verwenden Sie das Standardprofil `sdk` für Agententeams. `sdk-minimal` enthält weder Subagenten noch Teamdienste. Speichern Sie den [Patch für den Teammodus](../../../apps/cli/config/examples/team-mode.yml) als `team-mode.yml`.

```yaml
- id: agent-team
  config:
    defaultEnabled: true
```

Geben Sie seinen absoluten Pfad in der `patches`-Option des SDK mit `profile="sdk"`. Python verwendet `patches=("/absolute/path/to/team-mode.yml",)`; TypeScript verwendet `patches: ["/absolute/path/to/team-mode.yml"]`. Der Patch ersetzt die gesamte Konfiguration der `agent-team`-Zeile, also fügen Sie jede benutzerdefinierte `maxTasks`-Grenze in die gleiche Zuordnung ein.

Erstellen Sie eine neue Root-Sitzung und bitten Sie sie, eine gemeinsame Aufgabe zu erstellen und aufzulisten. Die erste Modellanforderung umfasst die Team-Tools und die Anleitung zur Zusammenarbeit. Die Wurzel speichert ihren Modus, und Subagenten teilen ihn. Durch die Wiederaufnahme einer vorhandenen Sitzung bleibt der Modus erhalten, auch wenn er explizit deaktiviert oder nie aktiviert wurde; das Ändern oder Entfernen dieses Patches überschreibt nicht gespeicherte Auswahlen. Siehe [Team Service Referenz](../../../packages/team/agent-team/README.md#use-this-package) für Modus- und Aufgabensemantik.

<a id="understand-the-minimal-profile"></a>

## Verstehen Sie das Minimalprofil

| Eigenschaft | Wert |
|---|---|
| Systemaufforderung | `DSH_SYSTEM_PROMPT`, zurückfallend auf `You are a helpful software engineer assistant.` |
| Modell in `minimal.py` | `--model`, dann `DSH_MODEL`, dann `deepseek-v4-flash` |
| modellorientierte Tools | Persistent `bash` unter Linux/macOS oder `pwsh` unter Windows, `read_image` und `working_directory` |
| Shell Timeout | 300 Sekunden |
| Optionaler Laufzeitkontext | Absent |
| Kontextverdichtung | Automatic; fasst ältere Historie durch eine zusätzliche Modellanforderung zusammen |
| Session Persistenz | Unkomprimierte JSONL unter `<dsh_home>/sessions` |

Das einzige Bundle des Profils fügt den vollständigen Cordis-Baum an einer leeren Wurzel ein. Es enthält kein `dsh-base`, sodass Tools des Basisprofils auch später nicht implizit hinzukommen. Enthalten sind das SDK-Protokoll, ein über die Umgebung konfigurierter DeepSeek-Adapter, lokale Ausführung und dauerhafte Speicherung. Es fehlen Textdatei-Tools, Einstellungen, verwaltete Zugangsdaten, OTel-Telemetrie, Web-Tools, Subagenten und das Einlesen lokaler Anweisungen. Das [DeepSeek-Plugin für das Sitzungsprotokoll](../../../packages/session/session-log-deepseek/README.md) sendet noch nicht bestätigte Protokollereignisse standardmäßig mit DeepSeek-Anfragen, bis zu `maxBytes` (8 MiB) pro Anfrage. Zum Abschalten setzen Sie `session-log-deepseek.enabled: false` in einem Profil-Patch. Das Profil ist auf `danger-full-access` festgelegt. Die von der Plattform gewählte dauerhafte Shell kann daher jeden für die Laufzeit sichtbaren Pfad ändern. Verwenden Sie einen zum Testen vorgesehenen Checkout oder Container.

Das Lesen von Bildern erfordert eine bildfähige Route. Die automatische Verdichtung bewahrt das vollständige Sitzungsprotokoll; siehe [-Bundle-Referenz](../../../packages/bundle/sdk-minimal/README.md) für Modell- und Speichereffekte. In dieser `sdk-minimal`-Zusammensetzung bleibt die nicht unterstützte Slash-Eingabe gewöhnlicher Eingabeaufforderungstext.

Das installierte Rad verpackt weiterhin das vollständige `web`-Profil und die Frontend-Assets. Führen Sie `dsh web` gegen eine explizite `DSH_HOME` aus, wenn eine Python SDK-Bereitstellung auch die Browseranwendung benötigt; `web` ist eine separate CLI-Anwendung und kann keinen Python SDK-Client bedienen.

Verwenden Sie ein neues Datenverzeichnis, wenn Profile, Plugins, Anmeldedaten, Einstellungen und Sitzungen isoliert bleiben sollen. Verwenden Sie für unabhängige Aufgaben eine neue Sitzungs-ID. Verwenden Sie dieselbe SDK-Instanz, dasselbe Datenverzeichnis und dieselbe ID nur, wenn Sie die gespeicherte Unterhaltung mit ihren Sitzungsressourcen fortsetzen möchten.

Die [-Bundle-Referenz](../../../packages/bundle/sdk-minimal/README.md) besitzt den genauen Baum und die [-Beispielreferenz](../../../python/sdk/examples/README.md) besitzt das lauffähige Programm. Die [Python SDK Referenz](../../../python/sdk/README.md) deckt den Lebenszyklus, Ergebnisse, Benachrichtigungen und Verhalten auf niedriger Ebene ab; die [dsh CLI Referenz](../../../apps/cli/reference/README.md) deckt die Profilschichtung ab.
