<a id="publish-the-web-ui-behind-a-reverse-proxy"></a>

# Die Weboberfläche über einen Reverse Proxy bereitstellen

<!-- USER_LANGUAGES_START -->
[English](public-deployments.md) | [中文](public-deployments.zh.md) | [Русский](public-deployments.ru.md) | [日本語](public-deployments.ja.md) | [Español](public-deployments.es.md) | [Français](public-deployments.fr.md) | Deutsch | [Português](public-deployments.pt.md) | [한국어](public-deployments.ko.md)
<!-- USER_LANGUAGES_END -->

`ocean --profile web` stellt die Weboberfläche auf einem Loopback-Port bereit. Ein Browser auf einem anderen Rechner kann den Port daher nicht direkt erreichen, und der Prozess kennt die öffentliche Adresse nicht. Der Reverse Proxy verwaltet den öffentlichen Hostnamen, TLS und das Pfadpräfix. Vor der Weiterleitung an den Webserver entfernt er dieses Präfix. Mit `--public-url` geben Sie OCEAN die Adresse an, die Browser verwenden.

```sh
ocean --profile web --public-url https://app.example/ui/ --trusted-host app.example
```

<a id="what---public-url-advertises"></a>

## Von `--public-url` veröffentlichte URL

`--public-url` akzeptiert eine Basis-URL mit `http://` oder `https://` und einem optionalen Pfadpräfix und ergänzt bei Bedarf ein abschließendes `/`. Der Wert bestimmt die beim Start ausgegebene und geöffnete URL, den Wert von `OCEAN_WEB_URL` und die Weboberflächen-URL im Laufzeitkontext des Agenten. Der Webserver bedient weiterhin seine Routen relativ zum Wurzelpfad und kennt das Präfix nicht. Das Konfigurationsfeld `publicUrl` veröffentlicht dieselbe URL.

<a id="what-the-proxy-must-do"></a>

## Was der Proxy tun muss

- **Den vom Browser gesendeten `Host`-Header beibehalten.** Der Filter vergleicht den empfangenen `Host` mit den zulässigen Adressen. Der Proxy gibt den Header unverändert weiter, ohne ihn durch die Adresse des Webservers zu ersetzen.
- **Das Pfadpräfix entfernen.** Der Webserver bedient seine Routen relativ zum Wurzelpfad. Eine Anfrage an `/ui/api/...` muss daher als `/api/...` ankommen.
- **Protokollwechsel weiterleiten.** Der Proxy leitet alle Anfragen der Seite einschließlich WebSocket-Upgrades weiter und erhält dabei die Header `Upgrade` und `Connection`. Wenn der Proxy HTTPS anbietet, endet TLS für die Browserverbindung am Proxy.
- **Den Geltungsbereich der Cookies anpassen.** Ein Backend mit unverschlüsseltem HTTP setzt Cookies, die nur für den Host gelten, mit `Path=/` und ohne `Secure`. Der Proxy setzt `Path` auf das öffentliche Präfix (`/ui/`) und fügt bei HTTPS `Secure` hinzu. Wenn das Backend selbst TLS verwendet, setzt es bereits `Secure`, und der Proxy passt nur `Path` an.
- **Den Pfad ohne abschließenden Schrägstrich umleiten.** Nur unter `/ui/` wird das Starttoken gegen das Sitzungscookie eingetauscht. Wenn der Browser dieses Cookie bereits hat, kann er das Dokument unter diesem Pfad oder unter `/ui/index.html` laden. Das Dokument löst URLs relativ zu seinem eigenen Verzeichnis auf. Leiten Sie `/ui` auf `/ui/` um. Nachdem der Proxy das Präfix entfernt hat, kann das Backend den öffentlichen Pfad nicht rekonstruieren.

<a id="trust-the-authority-browsers-use"></a>

## Den vom Browser verwendeten Host und Port zulassen

Der Filter akzeptiert Loopback, die Bindeadresse des Webservers und alle mit `--trusted-host` angegebenen Adressen. Verwendet der Browser eine andere Adresse, erhält er bei jedem API-Aufruf den Status 403, auch wenn der Proxy korrekt eingerichtet ist. Geben Sie die aus Browsersicht sichtbare Adresse mit `--trusted-host` an. `--public-url` veröffentlicht die Adresse lediglich. Ein Eintrag ohne Port gilt für jeden Port, etwa für einen Tunnel, der bei jedem Start einen anderen Port belegt. Der Filter lässt die Anfrage zu. Das Starttoken in der ausgegebenen URL und das signierte Sitzungscookie dienen zur Authentifizierung. Unabhängig vom TLS-Endpunkt bestätigt das Zertifikat dem Browser die Identität des Servers.

Die veröffentlichte URL und der Filter schützen den Port selbst nicht. Beschränken Sie den Zugriff auf den Port auf den vertrauenswürdigen Proxy oder das vertrauenswürdige Netzwerk.

<a id="secure-the-external-leg"></a>

## Die öffentliche Verbindung absichern

Die TLS-Verbindung kann am Proxy, am Webserver oder an beiden enden. `--public-url` dient weiterhin nur der Veröffentlichung der Adresse. Eine öffentliche Basis-URL mit `http://` überträgt das Starttoken im Klartext. Eine Proxy-Basis-URL mit `https://` schützt die Verbindung vom Browser zum Proxy. Die Verschlüsselung zwischen Proxy und Webserver richtet sich nach der TLS-Konfiguration des Servers.

Um TLS am Webserver zu terminieren, geben Sie `--tls-cert` und `--tls-key` an. Beide Pfade werden relativ zum Arbeitsverzeichnis des Prozesses aufgelöst. Die Zertifikatsdatei enthält die vollständige Zertifikatskette, die Schlüsseldatei einen unverschlüsselten privaten PEM-Schlüssel. OCEAN beschafft, erneuert und überwacht keine Zertifikate. Die Dateien werden einmalig eingelesen. Wenn Sie sie austauschen, laden Sie den Webserver neu oder starten Sie den Prozess erneut. Bei einem fehlenden oder ungültigen Dateipaar schlägt der Start fehl, ohne auf HTTP zurückzufallen. Der Browser prüft das Zertifikat anhand seines eigenen Zertifikatsspeichers und des aufgerufenen Namens. Das Zertifikat muss den Hostnamen oder die IP-Adresse im Browser abdecken. Der Standardport bleibt 3080. Der Webserver unterstützt TLS direkt ohne Proxy. Die Bereitstellung über einen Proxy und `--public-url` bleiben unabhängig davon möglich. Ein Webserver mit TLS setzt für Sitzungscookies `Secure`. Stellen Sie die öffentliche Verbindung über HTTPS bereit, damit Browser diese Cookies zurücksenden können.

Die ausgegebene URL enthält Zugangsdaten für den Prozess. Geben Sie die URL nur an die vorgesehenen Benutzer weiter.

Die [Referenz zur Webanwendung](../../../packages/bundle/web-app/README.md#public-deployments) beschreibt die Befehlszeilenoptionen `--public-url`, `--trusted-host` und `--tls-cert`/`--tls-key`. Im Webprofil konfiguriert `publicUrl` den Eintrag `web-runtime`, `trustedHosts` den [Verbindungseintrag](../../../packages/client/connection/README.md) und `tls` den [Webserver-Eintrag](../../../docs/subsystems/web-server.md#config).
