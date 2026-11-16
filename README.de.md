# Ocean

<!-- USER_LANGUAGES_START -->
[English](README.md) | [中文](README.zh.md) | [Русский](README.ru.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | Deutsch | [Português](README.pt.md) | [한국어](README.ko.md)
<!-- USER_LANGUAGES_END -->

Ocean ist ein Desktop-Arbeitsbereich für KI-Agenten, Unterhaltungen und Werkzeuge. Über Plugins bindet die Laufzeit Modellanbieter, Entwicklungswerkzeuge und bei Bedarf die Browser- oder Computersteuerung ein.

<a id="developer-preview"></a>

## Entwicklervorschau

Ocean wird aktiv entwickelt. APIs und Funktionen können sich ändern. Lesen Sie vor dem Start die [Sicherheitshinweise](SAFETY.md). Ein erfolgreicher lokaler Build ersetzt weder ein Sicherheitsaudit noch eine signierte öffentliche Veröffentlichung.

<a id="get-started"></a>

## Erste Schritte

Verwenden Sie das Repository [Ryltsevmg/Ocean](https://github.com/Ryltsevmg/Ocean). Der Zugriff kann während der Vorbereitung der öffentlichen Veröffentlichung eingeschränkt sein. Installieren Sie Ocean weder mit einem Installationsprogramm des Ursprungsprojekts noch mit einem ungeprüften npm-Paket.

Der [Entwicklungsleitfaden](docs/development.md) erklärt die Einrichtung aus dem Quellcode und die Befehle zum lokalen Start der Web- und Desktopanwendung. In [package.json](package.json) stehen die Voraussetzungen und Befehle. Legen Sie vor dem Test eines neuen Builds eine Sicherung Ihrer vorhandenen Profile an.

<a id="documentation"></a>

## Dokumentation

- [Benutzerhandbuch](docs/user/index.de.md)
- [Architektur](docs/architecture.md)
- [Mitwirken](CONTRIBUTING.md)
- [Sicherheit](SAFETY.md)
- [Gestaltungsrichtlinien](docs/brand-guidelines.md)

Nach Veröffentlichung dieser Konfiguration startet der Prüfworkflow in [GitHub Actions](.github/workflows/) bei Pull Requests und Pushes auf main. Linux-Pakete werden weiterhin manuell erstellt. Die erzeugten Pakete sind derzeit unsigniert und bilden keinen Kanal für automatische Updates.

<a id="feedback"></a>

## Rückmeldungen

Melden Sie reproduzierbare Fehler in den [Ocean-Issues](https://github.com/Ryltsevmg/Ocean/issues), sofern Sie Zugriff auf das Repository haben. Sie können außerdem den [Ocean-Support](mailto:support@oceanharness.com) oder den [Support-Bot in Telegram](https://t.me/oceanchatsupportbot) kontaktieren. Veröffentlichen Sie keine Tokens, privaten Sitzungsprotokolle oder personenbezogenen Daten in einem öffentlichen Issue.

<a id="license-and-acknowledgements"></a>

## Lizenz und Danksagung

[MIT](LICENSE). Herkunft des Quellcodes, übernommene Urheberrechtshinweise und Lizenzbedingungen der Abhängigkeiten stehen in den [Hinweisen zu Drittsoftware](THIRD_PARTY_NOTICES.md).
