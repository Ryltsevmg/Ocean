<a id="publish-the-web-ui-behind-a-reverse-proxy"></a>

# Veröffentlichen Sie die Web-Benutzeroberfläche hinter einem Reverse-Proxy

<!-- USER_LANGUAGES_START -->
[English](public-deployments.md) | [中文](public-deployments.zh.md) | [Русский](public-deployments.ru.md) | [日本語](public-deployments.ja.md) | [Español](public-deployments.es.md) | [Français](public-deployments.fr.md) | Deutsch | [Português](public-deployments.pt.md) | [한국어](public-deployments.ko.md)
<!-- USER_LANGUAGES_END -->

`dsh --profile web` Die GUI wird an einem Loopback-Port bedient, so dass ein Browser auf einem anderen Computer ihn nicht erreichen kann und der Prozess nichts über die von Ihnen verwendete Adresse weiß. Ein Reverse-Proxy vor ihm besitzt dieses externe Bein - den öffentlichen Hostnamen TLS und das Pfadpräfix, das es vor der Weiterleitung an den Zuhörer entfernt - und `--public-url` teilt DSH mit, welche Adresse Browser verwenden:

```sh
dsh --profile web --public-url https://app.example/ui/ --trusted-host app.example
```

<a id="what---public-url-advertises"></a>

## Was `--public-url` wirbt

`--public-url` akzeptiert eine `http://` - oder `https://` -Root mit einem optionalen Mount-Präfix und normalisiert es so, dass es in `/`endet. Es liefert die gedruckte und geöffnete Start-URL, `DSH_WEB_URL`und die Web-GUI-URL im Laufzeitkontext des Agenten. Der Webserver bedient weiterhin Origin-Root-Routen und lernt das Mount nie. Das `publicUrl` -Konfigurationsfeld veröffentlicht die gleiche Werbung.

<a id="what-the-proxy-must-do"></a>

## Was der Proxy tun muss

- **Bewahren Sie den Browser-zugewandten `Host`.** Der Zaun vergleicht den empfangenen `Host` mit den akzeptierten Behörden, so dass der Proxy ihn unverändert weiterleitet, anstatt ihn an die Adresse des Zuhörers umzuschreiben.
- **Streifen Sie das Mount-Präfix.** Der Zuhörer beantwortet Origin-Root-Routen, also eine Anfrage für `/ui/api/...` muss ankommen als `/api/...`.
- **Vorwärts-Upgrades.** Jede Anfrage und WebSocket-Upgrade, das die Seite öffnet, muss den Zuhörer mit seinen `Upgrade` - und `Connection` -Headern intakt erreichen; TLS endet auf dem externen Bein des Proxys, wenn es HTTPS bedient.
- **Rewrite Cookie-Bereich.** Ein Backend, das einfaches HTTP bedient, gibt nur Host-Cookies `Path=/` ohne `Secure`aus; der Proxy schreibt dann `Path` in das Mount (`/ui/`) um und fügt `Secure` auf seinem HTTPS-Bein hinzu. Ein Backend-Hörer, der sein eigenes TLS bedient, markiert bereits das Cookie `Secure`, so dass der Proxy nur umschreibt `Path`.
- **Redirect das nackte Reittier.** `/ui/` ist der einzige Eintrag: Er tauscht allein das Start-Token für das Sitzungscookie aus, und er oder `/ui/index.html` stellt das Dokument einem Browser zur Verfügung, der dieses Cookie bereits enthält, da das servierte Dokument URLs gegen sein eigenes Verzeichnis auflöst. Eine Anfrage an `/ui` muss als `/ui/`ankommen, und das abgestreifte Backend kann diesen externen Pfad nicht rekonstruieren.

<a id="trust-the-authority-browsers-use"></a>

## Vertrauen Sie der Autorität, die Browser verwenden

Der Zaun akzeptiert Loopback, die eigene Bindeadresse des Zuhörers und alle `--trusted-host` -Namen. Ein Browser, der die Bereitstellung unter einer anderen Behörde erreicht, erhält 403 für jeden API-Aufruf, egal wie korrekt der Proxy ist, also nennen Sie die browsersichtbare Behörde mit `--trusted-host`; Werbung mit `--public-url` ist nur Anzeige und gibt sie nicht zu. Ein Eintrag ohne Port passt zu jedem Port, der zu einem Tunnel passt, der jedes Mal einen anderen bindet. Der Zaun gibt nur die Anfrage zu; das Start-Token in der gedruckten URL und das signierte Sitzungscookie authentifizieren es. TLS, wo auch immer es endet, ändert nichts daran: Das Zertifikat identifiziert den Server für den Browser, nicht den Browser für den Server.

Weder die beworbene URL noch der Zaun schützen den Abhörport selbst, beschränken Sie den Port daher auf den vertrauenswürdigen Proxy oder das Netzwerk.

<a id="secure-the-external-leg"></a>

## Sicherung des äußeren Beins

Beenden Sie TLS am Proxy, am Zuhörer selbst oder an beiden; `--public-url` bleibt eine Werbung. Eine `http://` -Browser-orientierte Wurzel zeigt das Start-Token im Klartext. Eine `https://` -Proxy-Root schützt das Browser-zu-Proxy-Bein; die Verschlüsselung zwischen Proxy und Listener hängt von der TLS-Konfiguration des Listeners ab.

Um auf dem Listener zu beenden, übergeben Sie `--tls-cert` und `--tls-key`, jeweils einen Pfad, der gegen das Prozessarbeitsverzeichnis aufgelöst wird: Die Zertifikatsdatei enthält die vollständige Kette und die Schlüsseldatei einen unverschlüsselten PEM-privaten Schlüssel. DSH erhält, erneuert oder beobachtet niemals Zertifikate, und der Carrier liest die Dateien einmal, also ersetzen Sie sie und laden Sie den Zuhörer neu oder starten Sie den Prozess neu, um sie zu ändern; das Starten schlägt bei einem fehlenden oder ungültigen Paar fehl und fällt nie wieder zu HTTP zurück. Der Browser wendet seinen eigenen Trust-Store und Namensprüfungen an, so dass das Zertifikat den Hostnamen oder die IP-Adresse abdecken muss, die Sie öffnen. Der Standard-Port bleibt 3080. Native TLS benötigt keinen Proxy, aber Proxy-Bereitstellungen und `--public-url` bleiben unabhängig voneinander unterstützt. Ein TLS-Hörer markiert Sitzungscookies `Secure`; Halten Sie das öffentliche Browser-orientierte Bein HTTPS, damit Browser diese Cookies zurückgeben können.

Die gedruckte URL trägt einen Prozessnachweis, also teilen Sie ihn nur mit beabsichtigten Benutzern.

Die [Web-App-Referenz](../../../packages/bundle/web-app/README.md#public-deployments) dokumentiert die Befehlszeilenoptionen `--public-url`, `--trusted-host`und `--tls-cert`/`--tls-key` . Im Webprofil konfiguriert `publicUrl` die `web-runtime` -Zeile, `trustedHosts` konfiguriert die [-Verbindungszeile](../../../packages/client/connection/README.md)und `tls` konfiguriert die [-Webserverzeile.](../../../docs/subsystems/web-server.md#config).
