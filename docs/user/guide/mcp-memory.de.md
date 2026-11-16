<a id="connect-a-third-party-memory-mcp-server"></a>

# Einen MCP-Speicherserver eines Drittanbieters verbinden

<!-- USER_LANGUAGES_START -->
[English](mcp-memory.md) | [中文](mcp-memory.zh.md) | [Русский](mcp-memory.ru.md) | [日本語](mcp-memory.ja.md) | [Español](mcp-memory.es.md) | [Français](mcp-memory.fr.md) | Deutsch | [Português](mcp-memory.pt.md) | [한국어](mcp-memory.ko.md)
<!-- USER_LANGUAGES_END -->

Diese drei **standardmäßig deaktivierten Referenzkonfigurationen** verbinden jeweils ein Speichersystem über [`@ocean/ocean-mcp-client`](../../../packages/mcp/mcp-client/README.md) mit DSH. Wählen Sie eine Konfiguration oder kopieren Sie denselben generischen MCP-Eintrag für einen anderen Server.

Diese Konfigurationen von Drittanbietern werden nur als Interoperabilitätsbeispiele zur Verfügung gestellt. Ihre Aufnahme bedeutet nicht die Billigung, Empfehlung, Partnerschaft oder laufende Unterstützung durch das Ocean-Projekt.

<a id="what-dsh-does"></a>

## Was DSH tut

DSH liest das ausgewählte Cordis-Overlay, startet den konfigurierten stdio-Befehl oder verbindet sich mit der konfigurierten Streamable-HTTP-URL. DSH ermittelt die MCP-Tools und stellt sie unter `mcp__<serverName>__<tool>` bereit. DSH lädt den Server nicht herunter, initialisiert seine Datenbank nicht, wählt keinen Modell- oder Embedding-Anbieter aus, erstellt kein Cloud-Konto, migriert keine Anbieterdaten und überwacht keinen separaten HTTP-Dienst. Bei stdio startet und stoppt der generische Client den Kindprozess mit dem DSH-Plugin. Bei HTTP muss der Server bereits laufen.

Vor dem Start des Kindprozesses entfernt die stdio-Verbindung alle `DSH_*`-Variablen sowie Umgebungsvariablen, deren Namen üblicherweise auf Anmeldedaten hinweisen. Der Kindprozess erbt die übrigen Variablen. Jedes Beispiel fügt nur den benötigten Konfigurationswert hinzu. Wenn eine optionale Funktion des Servers ein weiteres Geheimnis benötigt, geben Sie die entsprechende Variable in `config.env` an, ohne den geheimen Wert direkt in YAML einzutragen.

<a id="choose-one"></a>

## Einen Server auswählen

| System | Getestete Version | Transport | Voraussetzungen des Anbieters |
|---|---:|---|---|
| [Memorix](https://github.com/AVIDS2/memorix) | `memorix@1.3.0` (`500792cad3144142293bfbb20acb4841c9f7fcfa`) | stdio | Node 22.18+ und `npm install --global memorix@1.3.0` |
| [MCP Referenzspeicher](https://github.com/modelcontextprotocol/servers/tree/main/src/memory) | `@modelcontextprotocol/server-memory@2026.7.4` (`6dd0a683e198783e30feabf7abaf42f925bd18b1`) | stdio | `npm install --global @modelcontextprotocol/server-memory@2026.7.4` |
| [Engram](https://github.com/Gentleman-Programming/engram) | `v1.20.0` (`ba9e46ced152c37a7cb9e576153c41995873e2fc`) | stdio | Go 1.25.10+ und `go install github.com/Gentleman-Programming/engram/cmd/engram@v1.20.0`, oder die passende Veröffentlichung binär |

<a id="enable-one"></a>

## Einen Server aktivieren

Übergeben Sie ein Overlay an DSH:

```sh
dsh web --patch "$PWD/apps/cli/config/examples/mcp-memory/memorix.cordis.yml"
```

Ersetzen Sie den Dateinamen durch `mcp-reference-memory.cordis.yml` oder `engram.cordis.yml`. Der Pfad kann auf eine Kopie an einem beliebigen Ort auf dem Datenträger zeigen. Das ausgelieferte Profil enthält keinen Speicherserver. Ohne `--patch` bleiben alle drei deaktiviert.

Um die Auswahl über mehrere Starts hinweg beizubehalten, übernehmen Sie den einzelnen `insert`-Patch der gewählten Datei in die Benutzer-Patchdatei `$DSH_HOME/profiles/<name>/cordis.patch.yml` für ein Profil oder `$DSH_HOME/cordis.patch.yml` für alle Profile auf dem Rechner. Überschreiben Sie keine vorhandene Datei, da sie bereits andere Benutzer-Patches enthalten kann.

<a id="provider-setup"></a>

## Provider-Einrichtung

### Memorix

```sh
npm install --global memorix@1.3.0
dsh web --patch "$PWD/apps/cli/config/examples/mcp-memory/memorix.cordis.yml"
```

Memorix arbeitet im lokalen heuristischen Modus ohne LLM oder Embedding-Dienst. Optionale Anbieter konfigurieren Sie in `~/.memorix/config.toml` von Memorix oder in `memorix.toml` im Projekt. Das Beispiel lässt Memorix das Git-Projekt anhand des DSH-Arbeitsverzeichnisses erkennen und das Standardverzeichnis `~/.memorix/data` verwenden. Setzen Sie vor dem Start von DSH `MEMORIX_DATA_DIR`, um dieses Verzeichnis zu ändern.

<a id="mcp-reference-memory"></a>

### MCP-Referenzspeicher

```sh
npm install --global @modelcontextprotocol/server-memory@2026.7.4
dsh web --patch "$PWD/apps/cli/config/examples/mcp-memory/mcp-reference-memory.cordis.yml"
```

Dieser Referenzserver speichert einen lokalen Wissensgraphen. Seine Tools verwalten Entitäten, Beziehungen und Beobachtungen und können Einträge lesen, durchsuchen und öffnen. Ein Modell oder Embedding-Dienst ist dafür nicht erforderlich. Das Beispiel speichert die JSONL-Datei unter `$HOME/.dsh-mcp-reference-memory.jsonl` außerhalb des Verzeichnisses des installierten npm-Pakets. Setzen Sie vor dem Start von DSH `MEMORY_FILE_PATH`, um den Speicherort zu ändern.

Die Suche gleicht Teilzeichenfolgen in Entitätsnamen, Typen und Beobachtungen ab und ignoriert die Groß- und Kleinschreibung. Der Server bietet keine semantische Suche, Embeddings, automatische Zusammenfassungen, Konfliktauflösung oder Regeln zum Vergessen.

<a id="engram"></a>

### Engram

```sh
go install github.com/Gentleman-Programming/engram/cmd/engram@v1.20.0
dsh web --patch "$PWD/apps/cli/config/examples/mcp-memory/engram.cordis.yml"
```

Engram verwaltet die Speicherung und die Projektauswahl. Es verwendet standardmäßig `~/.engram` und erkennt das Git-Projekt anhand des DSH-Arbeitsverzeichnisses. Mit den Umgebungsvariablen `ENGRAM_DATA_DIR` oder `ENGRAM_PROJECT` können Sie diese Werte überschreiben.

<a id="optional-shared-model-instruction"></a>

## Optionale gemeinsame Modellanweisung

Fügen Sie diese kurze, herstellerneutrale Anleitung zu Ihren vorhandenen Modellanweisungen hinzu, wenn die Toolbeschreibungen des Servers die Speichernutzung nicht zuverlässig auslösen:

> Wenn der Benutzer Sie bittet, sich etwas zu merken, rufen Sie ein Tool zum Schreiben in den Speicher auf. Wenn frühere Informationen relevant sein könnten, durchsuchen Sie den Speicher und verwenden Sie die relevanten Ergebnisse.

Diese Anweisung ergänzt die bestehenden Anweisungen. Die Beispiele lassen die im Systemprompt von DSH festgelegte Rolle bestehen.

<a id="verify-write-fresh-session-recall-and-use"></a>

## Speichern, Abrufen in einer neuen Sitzung und Verwenden prüfen

Verwenden Sie einen eindeutigen Wert und halten Sie den Speicherumfang des Anbieters durchweg unverändert:

1. Bitten Sie in DSH-Sitzung A: `Remember that my validation drink is lapsang-<unique suffix>.` Prüfen Sie, ob das Modell das Schreibtool des Anbieters aufgerufen und das Tool Erfolg gemeldet hat.
2. Erstellen Sie DSH-Sitzung B im selben laufenden Host. Kopieren Sie die Unterhaltung aus Sitzung A nicht. Fragen Sie: `What is my validation drink? Check memory.` Prüfen Sie, ob das Modell das Such- oder Abrufwerkzeug des Anbieters aufgerufen und den Wert zurückgegeben hat.
3. Fragen Sie noch in Sitzung B: `Use that preference to suggest one drink for the meeting.` Bestätigen Sie, dass die Antwort den zurückgerufenen Wert verwendet.

Erstellen Sie eine neue DSH-Sitzung, ohne den Host neu zu starten. Wenn ein MCP-Kindprozess abstürzt, versucht DSH mit zunehmenden Wartezeiten, die Verbindung wiederherzustellen, und synchronisiert danach die Tools erneut. Die Tools bleiben aufgelistet, und Aufrufe schlagen nur während der Unterbrechung fehl. Sind die Wiederverbindungsversuche ausgeschöpft, meldet DSH die Tools ab und wartet auf ein Neuladen oder einen Neustart. Die erste Erkennung erfolgt asynchron. Warten Sie deshalb vor der ersten Testanfrage, bis die `mcp__...`-Tools des Anbieters verfügbar sind.

<a id="bring-another-mcp-server"></a>

## Einen anderen MCP-Server verbinden

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

Verwenden Sie bei einem Remote-Server `transport: streamable-http`, `url` und `headers`. Installation, Identität, Authentifizierung, Modelle, Embeddings, dauerhafte Speicherung und Lizenzierung liegen beim jeweiligen Anbieter.
