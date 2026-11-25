<a id="run-ocean-behind-a-network-proxy"></a>

# OCEAN hinter einem Netzwerk-Proxy ausführen

<!-- USER_LANGUAGES_START -->
[English](network-proxy.md) | [中文](network-proxy.zh.md) | [Русский](network-proxy.ru.md) | [日本語](network-proxy.ja.md) | [Español](network-proxy.es.md) | [Français](network-proxy.fr.md) | Deutsch | [Português](network-proxy.pt.md) | [한국어](network-proxy.ko.md)
<!-- USER_LANGUAGES_END -->

OCEAN leitet seine ausgehenden Anfragen - Modellaufrufe, Websuche, Seitenabrufe und MCP-Server über HTTP - durch den Proxy, der von den Standard-Proxy-Umgebungsvariablen benannt wird. Es liest sie beim Start; nichts anderes muss konfiguriert werden. Einige Pfade bleiben direkt durch Design oder Laufzeitlimit, aufgeführt unter "Was bleibt direkt" unten.

<a id="export-the-variables"></a>

## Exportieren der Variablen

```sh
export HTTPS_PROXY=http://127.0.0.1:7890
export HTTP_PROXY=http://127.0.0.1:7890
```

Tragen Sie beide Zeilen in Ihr Shell-Profil ein, damit jeder `ocean`-Aufruf sie erbt. Sie können die Zeilen auch in `$OCEAN_HOME/.env` (standardmäßig `~/.ocean/.env`) neben Ihren API-Schlüssel setzen. Exportierte Variablen haben Vorrang vor dieser Datei. Die `.env`-Datei eines Projekts darf diese Variablen nicht setzen. Sie wird durch `git clone` übernommen. OCEAN bricht den Start ab, damit kein Repository den Weg Ihres Datenverkehrs bestimmen kann.

Ein Proxy, der Anmeldeinformationen benötigt, nimmt sie in die URL: `http://user:password@proxy.example:8080`. OCEAN druckt die URL nie zurück: Eine Diagnose benennt die Variable, die sie abgelehnt hat, so dass weder der Benutzername noch das Passwort irgendwo erscheinen.

<a id="why-your-browser-is-proxied-but-your-terminal-is-not"></a>

## Warum Ihr Browser den Proxy verwendet und Ihr Terminal eine eigene Konfiguration braucht

Dies ist die häufigste Überraschung, und es ist nicht spezifisch für OCEAN. Es gibt keinen einzigen "System-Proxy", dem alle Software gehorcht - es gibt drei nicht verwandte Mechanismen:

| Mechanismus | Wer folgt ihm |
|---|---|
| Die Proxy-Einstellungen des Betriebssystems | Safari, die meisten nativen macOS-Apps, Chrome und Edge |
| Die `HTTP_PROXY` / `HTTPS_PROXY` Umgebungsvariablen | `curl`, `git`, `npm`, `pip` und OCEAN |
| TUN-Modus (eine virtuelle Netzwerkschnittstelle) | Alles, transparent |

Der Schalter „System-Proxy“ in einer Proxy-Anwendung wie Clash ändert nur die Proxy-Einstellungen des Betriebssystems. Browser lesen diese Einstellungen. Für Kommandozeilenwerkzeuge müssen Sie die Variablen separat exportieren. Im TUN-Modus funktionieren beide ohne diese Variablen.

OCEAN liest die Proxy-Einstellungen des Betriebssystems nicht. Exportieren Sie die Variablen oder verwenden Sie den TUN-Modus.

<a id="choose-what-stays-direct"></a>

## Wählen Sie, was direkt bleibt

`NO_PROXY` Listen Hosts direkt zu erreichen:

```sh
export NO_PROXY=internal.example.com,.corp.example.com,registry.local
```

Ein Eintrag gilt für den Host und alle seine Subdomains. Mit `NO_PROXY=example.com` wird auch `api.example.com` direkt erreicht. Ein vorangestelltes `.` oder `*.` hat dieselbe Wirkung. Ein Eintrag kann auf `:port` enden. Mit `*` wird der Proxy für alle Hosts umgangen.

**CIDR-Bereiche werden nicht unterstützt.** Ausnahmelisten von Betriebssystemen enthalten oft Einträge wie `10.0.0.0/8` oder `192.168.0.0/16`. Solche Einträge haben in `NO_PROXY` keine Wirkung. Verwenden Sie Hostnamen oder Domainendungen.

Sie müssen `localhost` oder `127.0.0.1` nicht auflisten. OCEAN umgeht immer Loopback, da seine eigene Web-Benutzeroberfläche und lokale Server sonst durch den Proxy und die Schleife geleitet würden.

<a id="limits-worth-knowing"></a>

## Grenzen wissenswert

**SOCKS-Proxys werden nicht unterstützt.** OCEAN meldet einen Wert mit `socks5://` beim Start und ignoriert ihn. Für das betroffene Protokoll stellt OCEAN eine direkte Verbindung her. Wenn `HTTPS_PROXY=socks5://…` gesetzt ist, verwendet OCEAN für `https:` auch dann eine direkte Verbindung, wenn `HTTP_PROXY` gültig ist. Konfigurieren Sie die Variablen für den HTTP-Port Ihrer Proxy-Anwendung. Die meisten Anwendungen bieten beide Protokolle an, meist mit benachbarten Portnummern.

**`ALL_PROXY` genügt.** OCEAN verwendet den Wert als Vorgabe für beide Protokolle. Das Verhalten von Node und curl unterscheidet sich in diesem Punkt. Mit einem ausdrücklich gesetzten `HTTPS_PROXY` ist die Konfiguration eindeutiger.

**Ein Unternehmensproxy, der TLS-Verbindungen überprüft, benötigt sein Zertifikat.** Wenn der Proxy erreichbar ist und Anfragen an einem Zertifikatsfehler scheitern, geben Sie vor dem Start das CA-Bundle Ihres Unternehmens für Node an.

```sh
export NODE_EXTRA_CA_CERTS=/path/to/corporate-ca.pem
```

Node liest diese Variable nur beim Prozessstart, also exportieren Sie sie vor dem Ausführen `ocean`.

**Von OCEAN gestartete Werkzeuge verwenden denselben Proxy.** Befehle im Bash-Tool, `git`, `gh` und als Kindprozesse gestartete MCP-Server erben diese Variablen. Ein Node-Programm als Kindprozess verwendet die dafür installierte Node-Laufzeit. Node 22.21+ und Node 24+ berücksichtigen diese Variablen. Ältere Versionen verbinden sich direkt. Wenn OCEAN einen Proxy-Wert ablehnt, etwa eine SOCKS-URL, starten Node-basierte Werkzeuge und verbinden sich direkt. `curl` und `git` lesen den abgelehnten Wert weiterhin.

**Auch ein Passwort in der Proxy-URL ist für diese Werkzeuge sichtbar.** `HTTPS_PROXY=http://alice:s3cret@proxy.example:8080` ist eine gewöhnliche Umgebungsvariable. Jeder von OCEAN ausgeführte Befehl kann sie lesen, auch wenn das Modell ihn geschrieben hat. Gibt ein Befehl seine Umgebung aus, erscheint das Passwort in der gespeicherten Ausgabe. Die Variable verhält sich damit genauso wie für andere Befehle in Ihrer Shell. Falls nötig, verwenden Sie einen Proxy-Zugang ohne Anmeldedaten oder eine Authentifizierungsmethode, die keine Anmeldedaten in der URL benötigt.

<a id="what-stays-direct"></a>

## Welche Verbindungen direkt bleiben

Nicht jede Anfrage, die OCEAN macht, geht durch den Proxy:

- **Alles an dieser Maschine.** Loopback ist immer direkt: `localhost`, Gesamt `127.0.0.0/8` Reichweite, `::1`, und `0.0.0.0` Ein Proxy kann einen Dienst, der nur lokal zuhört, nicht sinnvoll erreichen.
- **Vom Modell geschriebener Code.** Workflow-Worker und Node-Prozesse von ptc-runtime erhalten keine Proxy-Einstellungen. Vom Modell geschriebene Skripte können daher keine Proxy-URL lesen, die ein Passwort enthalten könnte. Benötigen solche Anfragen einen Proxy, muss das Skript ihn selbst konfigurieren. Die Ausführung bleibt durch die Sandbox beschränkt.
- **Nutzungstelemetrie.** Die mitgelieferten Profile deaktivieren den OTel-Session-Upload, es gibt also keine Telemetrieanfrage zu proxyen. Ein Deployment, das ihn aktiviert, sendet über den eigenen HTTP-Client von Node, den keine Proxy-Einstellung erreicht; die Verbindung läuft dann direkt und schlägt fehl, wo ausgehender Direktverkehr blockiert ist.
- **`web_fetch` mit direkter privater IP-Adresse.** Eine URL mit einer privaten IP-Adresse wie `http://10.0.0.5/` wird abgelehnt und nicht an den Proxy weitergeleitet. Ohne Proxy lehnt das Werkzeug sie ebenfalls ab.

<a id="check-that-it-worked"></a>

## Überprüfen Sie, ob es funktioniert hat

Bitten Sie den Agenten, eine Seite abzurufen, und prüfen Sie das Verbindungsprotokoll Ihrer Proxy-Anwendung.

```sh
ocean --profile headless "fetch https://example.com and tell me the page title"
```

Falls die Anfrage dort nicht erscheint, prüfen Sie, ob die Variablen in der Umgebung von OCEAN gesetzt sind.

```sh
env | grep -i proxy
```
