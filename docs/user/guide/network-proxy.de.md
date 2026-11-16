<a id="run-dsh-behind-a-network-proxy"></a>

# DSH hinter einem Netzwerk-Proxy ausführen

<!-- USER_LANGUAGES_START -->
[English](network-proxy.md) | [中文](network-proxy.zh.md) | [Русский](network-proxy.ru.md) | [日本語](network-proxy.ja.md) | [Español](network-proxy.es.md) | [Français](network-proxy.fr.md) | Deutsch | [Português](network-proxy.pt.md) | [한국어](network-proxy.ko.md)
<!-- USER_LANGUAGES_END -->

DSH leitet seine ausgehenden Anfragen - Modellaufrufe, Websuche, Seitenabrufe und MCP-Server über HTTP - durch den Proxy, der von den Standard-Proxy-Umgebungsvariablen benannt wird. Es liest sie beim Start; nichts anderes muss konfiguriert werden. Einige Pfade bleiben direkt durch Design oder Laufzeitlimit, aufgeführt unter "Was bleibt direkt" unten.

<a id="export-the-variables"></a>

## Exportieren der Variablen

```sh
export HTTPS_PROXY=http://127.0.0.1:7890
export HTTP_PROXY=http://127.0.0.1:7890
```

Setzen Sie beide Zeilen in Ihr Shell-Profil, so dass jede `dsh` -Aufruf sie erbt, oder standardmäßig in `$DSH_HOME/.env` (`~/.dsh/.env` neben Ihrem API-Schlüssel; eine exportierte Variable gewinnt immer über diese Datei. Ein projekteigenes `.env` kann sie nicht festlegen: Es kommt mit `git clone`an, und DSH weigert sich zu starten, anstatt ein Repository entscheiden zu lassen, wohin Ihr Traffic geht.

Ein Proxy, der Anmeldeinformationen benötigt, nimmt sie in die URL: `http://user:password@proxy.example:8080`. DSH druckt die URL nie zurück: Eine Diagnose benennt die Variable, die sie abgelehnt hat, so dass weder der Benutzername noch das Passwort irgendwo erscheinen.

<a id="why-your-browser-is-proxied-but-your-terminal-is-not"></a>

## Warum ist Ihr Browser proxied, aber Ihr Terminal ist nicht

Dies ist die häufigste Überraschung, und es ist nicht spezifisch für DSH. Es gibt keinen einzigen "System-Proxy", dem alle Software gehorcht - es gibt drei nicht verwandte Mechanismen:

| Mechanismus | Wer folgt ihm |
|---|---|
| Die Proxy-Einstellungen des Betriebssystems | Safari, die meisten nativen macOS-Apps, Chrome und Edge |
| Die `HTTP_PROXY` / `HTTPS_PROXY` Umgebungsvariablen | `curl`, `git`, `npm`, `pip`und DSH |
| TUN-Modus (eine virtuelle Netzwerkschnittstelle) | Alles, transparent |

Der "System-Proxy"-Switch in einer Proxy-Anwendung wie Clash schreibt nur den ersten. Browser nehmen es auf; Kommandozeilen-Tools sehen es nie. Aus diesem Grund ist der Export der Variablen ein separater Schritt, und warum das Einschalten des TUN-Modus beide ohne Variablen funktionieren lässt.

DSH liest die Proxy-Einstellungen des Betriebssystems nicht, exportiert die Variablen oder verwendet den TUN-Modus.

<a id="choose-what-stays-direct"></a>

## Wählen Sie, was direkt bleibt

`NO_PROXY` Listen Hosts direkt zu erreichen:

```sh
export NO_PROXY=internal.example.com,.corp.example.com,registry.local
```

Ein Eintrag benennt einen Host und ordnet ihn mit jeder Subdomain darunter ab: `NO_PROXY=example.com` sendet auch `api.example.com` direkt. Ein führender `.` oder `*.` wird akzeptiert und bedeutet dasselbe. Ein Eintrag kann einen `:port`tragen und `*` umgeht alles.

**CIDR-Bereiche funktionieren nicht.** Eine Umgehungsliste für Betriebssysteme enthält häufig Einträge wie `10.0.0.0/8` oder `192.168.0.0/16`; das Kopieren in `NO_PROXY` hat keine Auswirkungen.

Sie müssen `localhost` oder `127.0.0.1`nicht auflisten. DSH umgeht immer Loopback, da seine eigene Web-Benutzeroberfläche und lokale Server sonst durch den Proxy und die Schleife geleitet würden.

<a id="limits-worth-knowing"></a>

## Grenzen wissenswert

**SOCKS Proxies werden nicht unterstützt. Der** A `socks5://` -Wert wird beim Start gemeldet und übersprungen, und DSH verbindet sich direkt mit dem Schema, das ihn benannt hat - `HTTPS_PROXY=socks5://…` neben einem verwendbaren `HTTP_PROXY` lässt `https:` direkt, anstatt den HTTP-Proxy zu leihen. Richten Sie die Variablen stattdessen auf den HTTP-Port Ihrer Proxy-Anwendung - die meisten setzen beide frei, und die HTTP-Nummer ist normalerweise eine benachbarte Portnummer.

**`ALL_PROXY` Allein reicht es.** DSH greift für beide Schemata darauf zurück, obwohl Node und Curl sich darin unterscheiden. `HTTPS_PROXY` Das ist explizit noch klarer.

**Ein TLS-intercepting Corporate Proxy benötigt sein Zertifikat.** Wenn Anfragen mit einem Zertifikatsfehler fehlschlagen, sobald der Proxy erreichbar ist, weisen Sie vor dem Start auf Node im CA-Bundle Ihres Unternehmens hin:

```sh
export NODE_EXTRA_CA_CERTS=/path/to/corporate-ca.pem
```

Node liest diese Variable nur beim Prozessstart, also exportieren Sie sie vor dem Ausführen `dsh`.

**Tools dsh läuft für sie dem gleichen proxy folgen.** -Befehle im bash-Tool, `git`, `gh`und MCP-Server, die als Kind-Prozesse gestartet wurden, erben alle diese Variablen. Ein untergeordnetes Node-Programm verwendet seine eigene installierte Laufzeit: Node 22.21+ und Node 24+ ehren diese Variablen; eine ältere Laufzeit verbindet sich direkt. Wenn eine Ihrer Proxy-Variablen einen Wert enthält, der DSH abgelehnt wurde - eine SOCKS-URL, sagen wir -, verbinden sich Node-basierte Tools auch direkt, anstatt nicht zu starten, während `curl` und `git` diesen Wert immer noch lesen.

**Ein Passwort in der Proxy-URL erreicht auch diese Tools.** `HTTPS_PROXY=http://alice:s3cret@proxy.example:8080` ist eine normale Umgebungsvariable, so dass jeder Befehl, den DSH ausführt - einschließlich derjenigen, die das Modell schreibt - ihn lesen kann, und ein Befehl, der seine Umgebung ausdruckt, legt das Passwort in die Ausgabe, die beibehalten wird. So verhält sich die Variable bereits für alles andere in Ihrer Shell. Wenn dies wichtig ist, geben Sie dem Proxy einen anerkennungsfreien Einstiegspunkt oder authentifizieren Sie ihn auf andere Weise als in der URL.

<a id="what-stays-direct"></a>

## Was bleibt direkt

Nicht jede Anfrage, die DSH macht, geht durch den Proxy:

- **Alles an dieser Maschine.** Loopback ist immer direkt: `localhost`, Gesamt `127.0.0.0/8` Reichweite, `::1`, und `0.0.0.0`Ein Proxy kann einen Dienst, der nur lokal zuhört, nicht sinnvoll erreichen.
- **Code das Modell schreibt.** Workflow Worker und Node ptc-Runtime-Prozesse erhalten keine Proxy-Einstellungen, so dass modellautorisierte Skripte keine Proxy-URL lesen können, die möglicherweise ein Passwort enthält. Direkte Anfragen müssen den erforderlichen Proxy selbst konfigurieren und der Ausführungssandbox unterliegen.
- **Nutzungstelemetrie.** Der OTLP-Exporteur verwendet den eigenen HTTP-Client von Node und nicht den, den ein Proxy konfiguriert, so dass sich die Telemetrie direkt verbindet und einfach ausfällt, wenn der direkte Ausgang blockiert ist. Nichts, was Sie in DSH tun, hängt davon ab. Stellen Sie `DSH_TELEMETRY_MODE=DISABLED` ein, um es vollständig auszuschalten.
- **`web_fetch` an eine buchstäbliche Privatadresse.** Eine URL, die eine Adresse wie `http://10.0.0.5/` wird abgelehnt und nicht an den proxy übergeben, die gleiche ablehnung, die er ohne proxy-konfiguration erhält.

<a id="check-that-it-worked"></a>

## Überprüfen Sie, ob es funktioniert hat

Bitten Sie den Agenten, eine Seite abzurufen und das Verbindungsprotokoll Ihrer Proxy-Anwendung zu sehen:

```sh
dsh --profile headless "fetch https://example.com and tell me the page title"
```

Wenn die Anforderung dort nicht erscheint, bestätigen Sie, dass die Variablen in der DSH-eigenen Umgebung überleben:

```sh
env | grep -i proxy
```
