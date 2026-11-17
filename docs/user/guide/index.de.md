<a id="use-the-web-ui"></a>

# Die Weboberfläche verwenden

<!-- USER_LANGUAGES_START -->
[English](index.md) | [中文](index.zh.md) | [Русский](index.ru.md) | [日本語](index.ja.md) | [Español](index.es.md) | [Français](index.fr.md) | Deutsch | [Português](index.pt.md) | [한국어](index.ko.md)
<!-- USER_LANGUAGES_END -->

Starten Sie die Weboberfläche wie in der [README des Repositorys](../../development.md) beschrieben. Der Befehl gibt die URL aus. Folgen Sie dieser Anleitung, sobald der Server läuft. Der `ocean`-Prozess verwendet das Verzeichnis, aus dem Sie ihn starten, als Standardpfad im Dateisystem. In einer neuen Weboberfläche ist zunächst kein Arbeitsbereich ausgewählt.

<a id="configure-a-model"></a>

## Ein Modell konfigurieren

Öffnen Sie **Einstellungen → Modelle** und wählen Sie einen Modellanbieter. Der [Leitfaden zur Modellkonfiguration](./providers.de.md) beschreibt die unterstützten Anbieter und benutzerdefinierte OpenAI-kompatible Endpunkte. Wenn Sie DeepSeek verwenden, geben Sie Ihren [DeepSeek-API-Schlüssel](https://platform.deepseek.com/) ein und speichern Sie ihn. Das Modell ist sofort verfügbar, ohne dass Sie den Server neu starten müssen.

<a id="choose-a-workspace"></a>

## Einen Arbeitsbereich auswählen

Klicken Sie auf **Arbeitsbereich auswählen**, fügen Sie das Projektverzeichnis hinzu, aus dem Sie `ocean` gestartet haben, und wählen Sie es aus. Das Eingabefeld der Sitzung ist erst verfügbar, wenn ein Arbeitsbereich ausgewählt ist.

<a id="run-a-task"></a>

## Eine Aufgabe ausführen

Starten Sie eine Sitzung und senden Sie:

> Fassen Sie dieses Repository zusammen und identifizieren Sie seine Hauptpakete.

Der Agent kann Dateien im Arbeitsbereich lesen und bearbeiten, Befehle ausführen, Aufgaben delegieren und seinen Plan aktualisieren. Die Weboberfläche bittet vor Vorgängen um Ihre Zustimmung, wenn die aktive Berechtigungsrichtlinie das vorsieht.

<a id="continue"></a>

## Nächste Schritte

- [Modelle konfigurieren](./providers.de.md)
- [Netzwerkproxy konfigurieren](./network-proxy.de.md)
- [MCP-Speicher verwenden](./mcp-memory.de.md)
- [Erinnerungen planen](./schedule.de.md)
- [Das Python-SDK verwenden](./python-sdk.de.md)
- [Die Weboberfläche über einen Reverse Proxy bereitstellen](./public-deployments.de.md)
- [Ocean Desktop deinstallieren](./desktop-uninstall-cleanup.de.md)
- [Weitere CLI-Modi verwenden](../../../apps/cli/README.md)
- [Ein Plugin entwickeln](../develop/basic/index.md)
