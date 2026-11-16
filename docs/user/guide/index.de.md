<a id="use-the-web-ui"></a>

# Verwenden Sie die Web-UI

<!-- USER_LANGUAGES_START -->
[English](index.md) | [中文](index.zh.md) | [Русский](index.ru.md) | [日本語](index.ja.md) | [Español](index.es.md) | [Français](index.fr.md) | Deutsch | [Português](index.pt.md) | [한국어](index.ko.md)
<!-- USER_LANGUAGES_END -->

Starten Sie die Web-Benutzeroberfläche über die [root README](../../development.md); der Befehl druckt seine URL aus. Diese Anleitung beginnt, nachdem dieser Server ausgeführt wurde. Der `dsh` -Prozess verwendet sein aufrufendes Verzeichnis als Standarddateisystemspeicherort, aber eine neue Web-Benutzeroberfläche hat keinen ausgewählten Arbeitsbereich, bis Sie einen hinzufügen.

<a id="configure-a-model"></a>

## Konfigurieren eines Modells

Offen **Einstellungen → Modelle** und wählen Sie einen Modellanbieter; [Modellkonfigurationsleitfaden](./providers.de.md) deckt die unterstützten Anbieter und benutzerdefinierten OpenAI-kompatiblen Endpunkte ab. [DeepSeek API Key](https://platform.deepseek.com/) Die Modellroute wird sofort nutzbar, ohne den Server neu zu starten.

<a id="choose-a-workspace"></a>

## Wählen Sie einen Workspace

Klicken Sie auf **Wählen Sie Arbeitsbereich**, fügen Sie das Projektverzeichnis hinzu, in dem Sie `dsh`gestartet haben, und wählen Sie es aus. Der Sitzungskomponist bleibt solange nicht verfügbar, bis ein Arbeitsbereich ausgewählt ist.

<a id="run-a-task"></a>

## Führen Sie eine Aufgabe

Starten Sie eine Sitzung und senden Sie:

> Fassen Sie dieses Repository zusammen und identifizieren Sie seine Hauptpakete.

Der Agent kann Workspace-Dateien lesen und bearbeiten, Befehle ausführen, Arbeit delegieren und einen Plan pflegen. Die Web-Benutzeroberfläche fragt vor Operationen, die nach der Richtlinie für aktive Berechtigungen genehmigt werden müssen.

<a id="continue"></a>

## Weiterfahren

- [Modelle konfigurieren](./providers.de.md)
- [Netzwerkproxy konfigurieren](./network-proxy.de.md)
- [MCP-Speicher verwenden](./mcp-memory.de.md)
- [Erinnerungen planen](./schedule.de.md)
- [Verwenden Sie das Python SDK](./python-sdk.de.md)
- [Veröffentlichen Sie die Web-Benutzeroberfläche hinter einem Reverse-Proxy](./public-deployments.de.md)
- [Uninstallieren Ocean Desktop](./desktop-uninstall-cleanup.de.md)
- [Verwenden Sie andere CLI-Modi](../../../apps/cli/README.md)
- [Entwickeln Sie ein Plugin](../develop/basic/index.md)
