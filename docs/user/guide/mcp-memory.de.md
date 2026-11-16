<a id="connect-a-third-party-memory-mcp-server"></a>

# Verbinden eines Speicher-MCP-Servers eines Drittanbieters

<!-- USER_LANGUAGES_START -->
[English](mcp-memory.md) | [中文](mcp-memory.zh.md) | [Русский](mcp-memory.ru.md) | [日本語](mcp-memory.ja.md) | [Español](mcp-memory.es.md) | [Français](mcp-memory.fr.md) | Deutsch | [Português](mcp-memory.pt.md) | [한국어](mcp-memory.ko.md)
<!-- USER_LANGUAGES_END -->

Diese drei **Standard-Aus-Referenzkonfigurationen** verbinden ein Speichersystem über [`@ocean/ocean-mcp-client`](../../../packages/mcp/mcp-client/README.md)mit DSH. Wählen Sie eine oder kopieren Sie die gleiche generische MCP-Zeile für einen anderen Server.

Diese Konfigurationen von Drittanbietern werden nur als Interoperabilitätsbeispiele zur Verfügung gestellt. Ihre Aufnahme bedeutet nicht die Billigung, Empfehlung, Partnerschaft oder laufende Unterstützung durch das Ocean-Projekt.

<a id="what-dsh-does"></a>

## Was DSH tut

DSH analysiert das ausgewählte Cordis-Overlay, startet einen konfigurierten Stdio-Befehl oder stellt eine Verbindung zu einer konfigurierten Streamable HTTP-URL her, entdeckt MCP-Tools und stellt sie als `mcp__<serverName>__<tool>`aus. DSH lädt **nicht** den Server herunter, initialisiert seine Datenbank, wählt seinen Modell- oder Einbettungsanbieter aus, erstellt ein Cloud-Konto, migriert Anbieterdaten oder überwacht einen separaten HTTP-Dienst. Für stdio startet und stoppt der generische Client das Kind mit dem DSH-Plugin-Lebenszyklus; für HTTP muss der Upstream-Dienst bereits ausgeführt werden.

Die Stdio-Brücke entfernt absichtlich Umgebungsvariablen, deren Namen normalerweise Anmeldeinformationen und alle `DSH_*` -Variablen identifizieren, bevor ein Kind gestartet wird; andere Umgebungsvariablen bleiben vererbt. Jedes Beispiel fügt nur den Baseline-Override hinzu, den es benötigt. Wenn ein optionales Upstream-Feature ein anderes Geheimnis benötigt, fügen Sie diese Variable zum `config.env` der Zeile hinzu, anstatt das Geheimnis direkt in YAML zu speichern.

<a id="choose-one"></a>

## Wählen Sie eine

| System | Geprüfte Pin | Transport | Upstream Voraussetzung |
|---|---:|---|---|
| [Memorix](https://github.com/AVIDS2/memorix) | `memorix@1.3.0` (`500792cad3144142293bfbb20acb4841c9f7fcfa`) | stdio | Node 22.18+ und `npm install --global memorix@1.3.0` |
| [MCP Referenzspeicher](https://github.com/modelcontextprotocol/servers/tree/main/src/memory) | `@modelcontextprotocol/server-memory@2026.7.4` (`6dd0a683e198783e30feabf7abaf42f925bd18b1`) | stdio | `npm install --global @modelcontextprotocol/server-memory@2026.7.4` |
| [Engram](https://github.com/Gentleman-Programming/engram) | `v1.20.0` (`ba9e46ced152c37a7cb9e576153c41995873e2fc`) | stdio | Go 1.25.10+ und `go install github.com/Gentleman-Programming/engram/cmd/engram@v1.20.0`, oder die passende Veröffentlichung binär |

<a id="enable-one"></a>

## Ermöglichen Sie eine

Übergeben Sie ein Overlay an DSH:

```sh
dsh web --patch "$PWD/apps/cli/config/examples/mcp-memory/memorix.cordis.yml"
```

Ersetzen Sie den Dateinamen durch `mcp-reference-memory.cordis.yml` oder `engram.cordis.yml`. Der Pfad kann auf eine kopierte Datei überall auf der Festplatte zeigen. Kein Speicherserver ist in der ausgelieferten Komposition vorhanden, so dass das Weglassen von `--patch` alle drei deaktiviert hält.

Um die Auswahl über läuft zu halten, Zusammenführen der ausgewählten Datei einzelne `insert` Patch in einem Benutzer-Patch-Layer — `$DSH_HOME/profiles/<name>/cordis.patch.yml` für ein Profil oder `$DSH_HOME/cordis.patch.yml` für jedes Profil auf dem Computer. Kopieren Sie nicht über eine vorhandene Datei: Sie enthält möglicherweise bereits nicht verwandte Benutzerpatches.

<a id="provider-setup"></a>

## Provider-Einrichtung

### Memorix

```sh
npm install --global memorix@1.3.0
dsh web --patch "$PWD/apps/cli/config/examples/mcp-memory/memorix.cordis.yml"
```

Memorix arbeitet im lokalen heuristischen Modus ohne LLM oder Einbettungsservice. Konfigurieren Sie optionale Anbieter in Memorix eigenen `~/.memorix/config.toml` oder Projekt `memorix.toml`. Das Beispiel hält die Git-Projekt-Identität von Memorix aus dem DSH-Arbeitsverzeichnis und verwendet den eigenen `~/.memorix/data` -Standard von Memorix. Setzen Sie `MEMORIX_DATA_DIR` , bevor Sie DSH starten, um es zu überschreiben.

<a id="mcp-reference-memory"></a>

### MCP-Referenzspeicher

```sh
npm install --global @modelcontextprotocol/server-memory@2026.7.4
dsh web --patch "$PWD/apps/cli/config/examples/mcp-memory/mcp-reference-memory.cordis.yml"
```

Dieser Referenzserver speichert einen lokalen Wissensgraphen und zeigt Entität, Beziehung, Beobachtung, Lesen, Suchen und offene Tools. Es braucht keinen Modell- oder Einbettungsservice. Das Beispiel speichert seine JSONL bei `$HOME/.dsh-mcp-reference-memory.jsonl` anstelle des installierten npm-Paketverzeichnisses. Setzen Sie `MEMORY_FILE_PATH` , bevor Sie DSH starten, um es zu überschreiben.

Die Suche ist eine fallunempfindliche Substring-Abgleichung über Entitätsnamen, Typen und Beobachtungen, nicht semantisches Abrufen. Der Server fügt keine Einbettungen, automatische Zusammenfassung, Konfliktlösung oder eine Vergessensrichtlinie hinzu.

<a id="engram"></a>

### Engramm

```sh
go install github.com/Gentleman-Programming/engram/cmd/engram@v1.20.0
dsh web --patch "$PWD/apps/cli/config/examples/mcp-memory/engram.cordis.yml"
```

Engram besitzt Storage und Projektauswahl: Es verwendet standardmäßig `~/.engram` , erkennt das Git-Projekt aus dem DSH-Arbeitsverzeichnis und akzeptiert `ENGRAM_DATA_DIR` oder `ENGRAM_PROJECT` als Ambient-Overrides.

<a id="optional-shared-model-instruction"></a>

## Optionale gemeinsame Modellanweisung

Fügen Sie diese kurze, herstellerneutrale Anleitung zu Ihren vorhandenen Modellanweisungen hinzu, wenn die Toolbeschreibungen des Servers die Speichernutzung nicht zuverlässig auslösen:

> Wenn der Benutzer Sie auffordert, sich an etwas zu erinnern, rufen Sie ein Speicherschreibwerkzeug auf.

Die Beispiele ersetzen nicht die vom DSH empfohlene Persona.

<a id="verify-write-fresh-session-recall-and-use"></a>

## Überprüfen Sie das Schreiben, den Rückruf in der Frischsitzung und die Verwendung

Verwenden Sie einen eindeutigen Wert und halten Sie den Speicherumfang des Anbieters durchweg unverändert:

1. In der DSH-Sitzung A fragen Sie: `Remember that my validation drink is lapsang-<unique suffix>.` Bestätigen Sie das Modell, das als Schreibwerkzeug des Anbieters bezeichnet wird, und das Tool hat den Erfolg zurückgegeben.
2. DSH-Sitzung B im selben Host erstellen, die Unterhaltung von Sitzung A nicht kopieren, fragen: `What is my validation drink? Check memory.` Bestätigen Sie das Modell mit der Bezeichnung Such- oder Rückruftool des Anbieters und geben Sie den Wert zurück.
3. Fragen Sie noch in Sitzung B: `Use that preference to suggest one drink for the meeting.` Bestätigen Sie, dass die Antwort den zurückgerufenen Wert verwendet.

Eine neue DSH-Sitzung ist erforderlich; ein Host-Neustart ist nicht erforderlich. Ein abgestürztes MCP-Kind löst die automatische Wiederverbindung mit Backoff und einem Tool-Re-Sync aus; Tools bleiben aufgeführt und Anrufe scheitern nur während des Ausfalls, und nachdem das Reconnect-Budget erschöpft ist, sind die Tools nicht registriert und die Reconnection stoppt bis zum Neuladen oder Neustart. Die erste Entdeckung ist asynchron, also warten Sie auf die `mcp__...` -Tools des Anbieters, bevor Sie die erste Validierungsaufforderung senden.

<a id="bring-another-mcp-server"></a>

## Bringen Sie einen anderen MCP-Server

Kopieren Sie die gleichen Eingabefelder und verwenden Sie eine eindeutige `id` und `serverName`:

```yaml
- insert:
    - id: memory-my-server
      name: '@ocean/ocean-mcp-client'
      config:
        serverName: my-memory
        transport: stdio
        command: my-memory-mcp
        args: []
        env: {}
        cwd: !!js process.cwd()
```

Für einen Remote-Server verwenden Sie stattdessen `transport: streamable-http`, `url`und `headers` . Anbieterspezifische Installation, Identität, Authentifizierung, Modelle, Einbettungen, Persistenz und Lizenzierung bleiben die Verantwortung des Anbieters.
