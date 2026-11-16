<a id="configure-models"></a>

# Modelle konfigurieren

<!-- USER_LANGUAGES_START -->
[English](providers.md) | [中文](providers.zh.md) | [Русский](providers.ru.md) | [日本語](providers.ja.md) | [Español](providers.es.md) | [Français](providers.fr.md) | Deutsch | [Português](providers.pt.md) | [한국어](providers.ko.md)
<!-- USER_LANGUAGES_END -->

Diese Anleitung geht davon aus, dass Sie die Weboberfläche nach dem [Entwicklungsleitfaden](../../development.md) gestartet haben. Modelländerungen gelten ab der nächsten Anfrage, ohne Neustart des Servers.

<a id="configure-deepseek"></a>

## Konfigurieren von DeepSeek

Öffnen Sie **Einstellungen → Modelle**. Die DeepSeek-Karte enthält ein Feld für den API-Schlüssel. Geben Sie den Schlüssel ein und speichern Sie ihn.

![The Models page: the DeepSeek card, with Add model provider below it](providers-models-page.png)

Schlüssel können nur geschrieben werden. Nach dem Speichern erhält die Seite eine bereinigte Beschreibung. Der geheime Wert wird ihr nie übermittelt. Der Schlüssel liegt in `$DSH_HOME/.credentials.yaml`. Die Einstellungen enthalten lediglich den Verweis auf den Zugangsnachweis.

Mit einem gespeicherten Schlüssel und dem Standard-Endpunkt folgen DeepSeeks Modelle der Liste, die die DeepSeek API veröffentlicht. Die Liste wird geladen, wenn die Modelle zum ersten Mal benötigt werden, aktualisiert sich im Hintergrund etwa alle zehn Minuten, während sie verwendet werden, und fällt auf die eingebauten Modelle zurück, wenn sie nicht geladen werden können. Die Bearbeitung von **Modellen** unter **Angepasste Einstellungen** führt stattdessen Ihre eigene Liste und hört auf, der veröffentlichten zu folgen; **stellt die Standardeinstellungen** wieder her und lädt sie erneut. Während die veröffentlichte Liste in Gebrauch ist, zeigt die Karte die eingebauten Modelle an, so dass ein neu veröffentlichtes Modell nur im Modellwähler erscheint. Die [API-Schlüssel-Providerreferenz](../../../packages/llm/llm-deepseek-api-key/README.md) besitzt die Listing-, Fallback- und Gating-Regeln.

<a id="add-a-third-party-provider"></a>

## Hinzufügen eines Drittanbieters

Wählen Sie **Add model provider**. Die Karte wird auf **geöffnet Drittanbieter-Modellanbieter**: Wählen Sie einen Anbieter-DSH-Schiffe mit - die Liste zeigt Anbieter-IDs wie `anthropic`, `openai`, `moonshotai` für Kimi oder `zai` für GLM - geben Sie seinen API-Schlüssel ein und speichern Sie. Der installierte Katalog liefert die Endpunkt-, Protokoll- und Modellliste.

Die Authentifizierung **?** erklärt gespeicherte Berechtigungs-Priorität und Umgebungs-Fallbacks. Lassen Sie den Schlüssel leer, um einen gespeicherten Berechtigungsnachweis zu verwenden, oder probieren Sie die aufgelisteten Umgebungsvariablen aus. Ein grüner Hinweis identifiziert eine erkannte Umgebungsvariable. Ein gelber Hinweis bedeutet, dass keine Anmeldevariable erkannt wurde; Geben Sie einen API-Schlüssel ein oder konfigurieren Sie die aufgelistete Variable. Ein unbestätigter Hinweis bedeutet, dass der gelesene Status fehlgeschlagen ist. Die Erkennung validiert nicht den Nachweis oder testet die Verbindung. Von Anbietern verwaltete Anmeldeinformationen, einschließlich AWS-Profile und Google-Anwendungsstandardanmeldeinformationen, befinden sich außerhalb dieser Überprüfung. Anbieter ohne native Schlüssel-Authentifizierung, wie z. B. `openai-codex`, zeigen kein Schlüsselfeld an, es sei denn, das Profil benennt explizit einen Berechtigungsverweis.

Ein gespeicherter Berechtigungsnachweis zeigt eine maskierte Vorschau in der Eingabe und einen grünen Hinweis darauf an, dass der gespeicherte Schlüssel verwendet wird. Die Vorschau behält den Bezeichner vor dem ersten Bindestrich oder Unterstrich, dann fünf führende und vier nachlaufende Schlüsselzeichen, nur wenn mindestens acht mittlere Zeichen verborgen bleiben; Andernfalls werden der gesamte Schlüssel und der Bezeichner zu Punkten. Zähler verwenden Unicode-Codepunkte. Gespeicherte Schlüssel haben keinen Augenknopf und können nicht enthüllt, kopiert, geschnitten oder teilweise bearbeitet werden; das Eingeben oder Einfügen ersetzt den gesamten Schlüssel. Backspace oder Delete Stufen Ganzschlüsselentfernung. Backspace drücken oder löschen, dann **Beantragen**, um die gespeicherte Überschreibung zu entfernen und die Umgebungs-Authentifizierung zu verwenden, wobei das Leeren eines Ersatzes auch das Löschen des gespeicherten Schlüssels inszeniert. **Stornierung** Wenn der Schlüssel entfernt wird, aber die Einstellungen fehlschlagen, wird in der Warnung angezeigt, dass das Löschen nicht rückgängig gemacht werden kann; Wiederholung **Beantragen** die Einstellungen zu beenden oder **Schließen** Das Löschen eines freigegebenen Anmeldeinformationen betrifft jedes Feature unter Verwendung der gleichen Referenz. Ohne Umgebungsanmeldeinformationen hat der Anbieter nach dem Löschen keine Authentifizierung. Umgebungs-Ausweichanwendungen **Lassen Sie leer, um env als auth zu verwenden** und ein Erkennungshinweis, während der Eingang leer ist. Ein Ersatzentwurf zeigt eine Erinnerung an die Anwendung des neuen Schlüssels. Ausstehende Entfernung benennt die nach der Anwendung verwendete Umgebungsvariable, wenn die Route eine solche deklariert. Andere nicht leere Eingaben zeigen keinen Authentifizierungsstatustext an. Adresskonfigurationsvariablen erscheinen unter **Basis-URL** Und zählen nicht als Referenzen.

Ein editierbarer, nicht leerer Tastenentwurf hat einen Augenknopf. Wählen Sie **Zeigen Sie geheim** , um zu überprüfen, was Sie eingegeben haben, und **Verstecken Sie geheim** , um es erneut zu maskieren. Das Ändern der Eingabe maskiert sie erneut. Native Passwortfelder bieten keinen Schnitt; Wählen Sie den Entwurf und drücken Sie den Backspace, um ihn zu löschen, oder offenbaren Sie ihn vor dem Schneiden. Gespeicherte Anmeldeinformationen bleiben Write-only.

<a id="add-a-custom-model-api"></a>

## Hinzufügen einer benutzerdefinierten Modell-API

Wechseln Sie die Karte zu **Custom Model API** für ein Relais, ein Firmen-Gateway, einen selbst gehosteten Server oder einen Anbieter, der im installierten Katalog fehlt. Geben Sie eine Kleinbuchstaben-Anbieter-ID, Basis-URL, API-Protokoll, Anmeldeinformationen und mindestens ein Modell an. Das **-API-Protokoll** muss das sein, was Ihr Gateway spricht, und der Picker bietet vier: OpenAI Chat Completions, OpenAI Responses, Anthropic Messages und Gemini API, die im aktiven Profil `cordis.patch.yml` als `openai-completions`, `openai-responses`, `anthropic-messages`und `google-generative-ai`gespeichert sind. Eine Gemini-API-Basis-URL enthält die API-Version, z. B. `https://gateway.example/v1beta`. Ein Anbieter spricht ein Protokoll, so dass ein Gateway, das zwei bedient, zwei Anbieter benötigt.

![The custom model API form: Provider ID, display name, base URL, API protocol, and API key](providers-custom-form.png)

Die Provider-ID ist dauerhaft, da sie von Anfragen, gespeicherten Sitzungen, Modellstandards und Anmeldeinformationen verwendet wird. Um einen Anbieter umzubenennen, fügen Sie einen neuen Anbieter hinzu und löschen Sie den alten. Der Anzeigename, die Basis-URL, das Protokoll, die Anmeldeinformationen und die Modelle bleiben editierbar.

<a id="discover-models"></a>

### Entdecken Sie Modelle

Unter **Modellkatalog**, wählen **Abruf verfügbare Modelle** um den Endpunkt zu fragen, welche Modelle er bedient. Die Anfrage verwendet die Basis-URL, das Protokoll und den Schlüssel, der sich derzeit im Formular befindet, oder den gespeicherten Schlüssel eines Anbieters, und die Antwort öffnet einen durchsuchbaren Picker: Modelle, die bereits in der Liste enthalten sind, beginnen angekreuzt, also suchen Sie, kreuzen Sie die Modelle an, um sie hinzuzufügen, kreuzen Sie die zu entfernenden an und wählen Sie **Aktualisierungsliste**. Konfigurierte Modelle, die der Endpunkt nicht auflistet, bleiben. Nichts wird gespeichert, bis Sie den Anbieter speichern oder erstellen.

Discovery liest die Auflistungsformate, die gewöhnliche Gateways veröffentlichen, aber nicht jeder Endpunkt antwortet in einem von ihnen, also behandeln Sie es als Bequemlichkeit und nicht als Garantie: Wenn es fehlschlägt oder nichts auflistet, fügen Sie die Modell-IDs von Hand hinzu und sie funktionieren genauso. Ein eingebauter Anbieter wird immer aus dem installierten Katalog beantwortet, auch wenn seine Basis-URL auf ein Gateway verweist, also holen Sie sich einen benutzerdefinierten Anbieter, um zu sehen, was das Gateway wirklich bedient.

<a id="select-a-model"></a>

## Wählen Sie ein Modell

Die Auswahl eines Modells macht es auch zur Standardeinstellung für neue Sitzungen. Eine Sitzung, die bereits eine Anfrage gesendet hat, behält das Modell in ihrem eigenen Protokoll.

Um die Modellreihenfolge eines Anbieters zu ändern, bearbeiten Sie sie in **Einstellungen → Modelle**, öffnen Sie **kundenspezifische Einstellungen**und ziehen Sie den dreizeiligen Griff eines Modells. Sie können auch den Griff fokussieren und die Pfeiltaste nach oben oder unten drücken. **Apply** behält die Reihenfolge; **Stornieren** verwirft es. Der Model Picker folgt der gespeicherten Bestellung innerhalb dieses Anbieters.

Wenn ein gespeicherter Standard einen Anbieter benennt, der gelöscht wurde, zeigt der Composer das Modell **Select** an und blockiert die Eingabe, bis ein anderes Modell ausgewählt ist.

<a id="advanced-configuration"></a>

## Erweiterte Konfiguration

Der generierte [Plugin-Konfigurationskatalog](../../config-catalog.md) listet jedes unterstützte Feld und jeden Standard für jedes Plugin auf; [`dsh-llm-pi-ai`](../../config-catalog.md#oceanocean-llm-pi-ai) ist der Anbieterbereich, den diese Seite konfiguriert. Die [`dsh-llm-pi-ai`](../../../packages/llm/llm-pi-ai/README.md) und [`dsh-llm-deepseek`](../../../packages/llm/llm-deepseek/README.md) verweisen auf eigene direkte `cordis.patch.yml` -Konfiguration, Katalogauflösung, Argumentationssteuerungen, Anmeldeinformationen und Adapterfehler.

::: Tipp Zusätzliche Einstellungen Die Models-Seite zeigt den API-Schlüssel, den Anzeigenamen, die Basis-URL, das API-Protokoll und die ID jedes Modells, den Anzeigenamen, das Kontextfenster, die maximalen Ausgabetoken und die Eingabetypen sowie die Argumentationsebenen eines Modells auf einem benutzerdefinierten Modell-API-Anbieter. Konfigurieren Sie die Argumentationsebenen der Modelle eines integrierten Anbieters, Request-Kompatibilitätsschalter, Header, Timeouts und Retry-Richtlinien in `$DSH_HOME/profiles/<profile>/cordis.patch.yml`, dem gleichen Dokument, das die Seite schreibt. Bearbeiten Sie es direkt oder öffnen Sie es, wenn der Browser auf demselben Computer wie der Server ausgeführt wird, mit der Konfigurationsdatei **Öffnen Sie die Konfigurationsdatei** im Einstellungs-Header; die Adapter lesen es bei der nächsten Anforderung erneut, so dass nichts neu gestartet werden muss. Die folgenden Unterabschnitte decken die Felder ab, die die meisten Gateways benötigen.

Für den Standard-Web-UI-Start mit `dsh web`, `<profile>` ist `web`, also ist der Pfad `$DSH_HOME/profiles/web/cordis.patch.yml`. Wenn Sie ein benutzerdefiniertes Profil starten, verwenden Sie stattdessen den beim Start ausgewählten Namen. ::::

<a id="image-input"></a>

### Bildeingang

In **Einstellungen → Modelle**editieren Sie den Anbieter, öffnen Sie **Maßgeschneiderte Einstellungen**und erweitern Sie die **Modelloptionen**. **Eingabetypen** nimmt eine eigene Zeile unter den Kapazitätsfeldern ein. Wählen Sie **Image** für ein Modell, das Bilder akzeptiert, und speichern. **Text** wird für ein neues benutzerdefiniertes Modell ohne geerbte Bildfähigkeit ausgewählt. Mindestens ein Typ muss ausgewählt bleiben; Wählen Sie Bild, bevor Sie Text für ein reines Bildmodell löschen.

Die Checkboxen speichern `input` für pi-ai-Modelle und `inputModalities` für den direkten DeepSeek-Adapter. Sie können das Modell auch in `$DSH_HOME/profiles/<profile>/cordis.patch.yml`bearbeiten; dieser benutzerdefinierte pi-ai-Anbieter deklariert beispielsweise ein reines Textmodell und ein Vision-Modell:

Diese Beispiele zeigen Config-Felder innerhalb eines Profil-Patches. Ein Cordis-Config-Override ersetzt die komplette Entry-Konfig; bewahren Sie beim Bearbeiten eines vorhandenen Overrides andere Anbieter und Felder.

```yaml
- id: llm-pi-ai
  config:
    providers:
      my-gateway:
        apiKeyEnv: GATEWAY_API_KEY
        api: openai-completions
        baseURL: https://gateway.example/v1
        models:
          - id: legacy-chat
          - id: vision-preview
            input: [text, image]
```

Pi-ais `input` akzeptiert `text` und `image` und gilt nur für dieses Modell. Eine explizite nonleere Auswahl hat Priorität. Ein ausgelassenes oder leeres `input` erbt die Eingabetypen des installierten Katalogs, dann das `defaultInput`der Route, das standardmäßig `[text]`ist. In den Kontrollkästchen werden diese geerbten Werte angezeigt, ohne eine Überschreibung zu speichern, wenn Sie die Zeile nur öffnen.

DeepSeek behandelt ein weggelassenes `inputModalities` als text-only und lehnt eine leere Liste ab. Durch das Löschen von Image werden auch die `imagePixelBudget` und `imageMaxBytes`dieses Modells entfernt, da DeepSeek Bildlimits für ein reines Textmodell ablehnt. Legen Sie diese Limits erneut fest, wenn Sie später Bilder aktivieren und benutzerdefinierte Limits benötigen.

Um die Vererbung nach dem Bearbeiten der Kontrollkästchen wiederherzustellen, entfernen Sie das `input` - oder `inputModalities` -Feld des Modells aus `cordis.patch.yml`. **Wiederherstellen Standard** entfernt den gesamten Modell-Katalog-Override, einschließlich anderer Modellbearbeitungen, also verwenden Sie es nur, wenn Sie den gesamten Katalog wiederherstellen möchten.

Wenn jedes Modell, das Sie von Hand eingegeben haben, Bilder aufnimmt, stellen Sie den Fallback einmal auf der Route statt auf jedem von ihnen ein:

```yaml
- id: llm-pi-ai
  config:
    providers:
      vision-gateway:
        apiKeyEnv: GATEWAY_API_KEY
        api: openai-completions
        baseURL: https://vision.example/v1
        defaultInput: [text, image]
        models:
          - id: first-model
          - id: second-model
```

`defaultInput` ist ein Fallback, kein Override und standardmäßig `[text]`: Auf einem eingebauten Anbieter antwortet es nur für Modelle, die sein Katalog nicht beschreibt, so dass es niemals Bilder aus einem Katalogmodell entfernt, das sie hat. Enger einer von denen mit dem eigenen `input`dieses Modells. Wenn ein eingebauter Anbieter keine explizite `models` -Liste hat, schreiben Sie sie unter `modelOverrides`, eingegeben nach Modell-ID:

```yaml
- id: llm-pi-ai
  config:
    providers:
      anthropic:
        modelOverrides:
          claude-sonnet-4-5:
            input: [text]
```

In der Pi-Ai-Konfiguration muss jede Liste mindestens eine Modalität nennen, außer der eigenen `input`eines Modells, wobei eine leere Liste dasselbe bedeutet wie das Weglassen.

Ein Modell, das Bilder deklariert, deren Endpunkt nicht dient, wird hier nicht abgefangen; der Anbieter lehnt stattdessen die Anfrage ab.

<a id="deepseek-account-models"></a>

### DeepSeek Account Modelle

Ein angemeldetes DeepSeek-Konto listet seine Modelle aus dem Kontodienst auf, so dass die Models-Seite keinen Modelleditor dafür bietet. Passen Sie ein einzelnes Modell mit `modelOverrides` in `$DSH_HOME/profiles/<profile>/cordis.patch.yml`an; die Felder stimmen mit einem DeepSeek `models` -Eintrag überein, und entschärfte Felder behalten die aufgeführten Werte bei:

```yaml
- id: llm-deepseek-account
  config:
    modelOverrides:
      deepseek-flash:
        contextWindow: 524288
        maxTokens: 131072
```

Ein Modell, das einen neueren Ocean benötigt, schlägt mit `CLIENT_UPGRADE_REQUIRED`fehl, der die zu installierende Version benennt. Die [-Kontoanbieterreferenz](../../../packages/llm/llm-deepseek-account/README.md) besitzt die Listing-, Fallback- und Gating-Regeln.

<a id="reasoning-effort"></a>

### Begründungsaufwand

Der Model Picker bietet ein **Effort** -Menü für ein Modell, das Argumentationsstufen angibt. Die Modelle eines eingebauten Anbieters erben ihre Level aus dem installierten Katalog, und die Modelle von DeepSeek halten die Level des Adapters. Ein Modell, das Sie von Hand eingeben, deklariert keine, bis Sie sie hinzufügen, so dass bis dahin der Aufwandseintrag nicht im Menü erscheint und der eigene Standard des Endpunkts entscheidet, ob das Modell denkt.

Auf einem benutzerdefinierten Modell-API-Anbieter deklarieren Sie die Level in **Einstellungen → Modelle**: Bearbeiten Sie den Provider, öffnen Sie **kundenspezifische Einstellungen**, erweitern Sie die **Modelloptionen**und schalten Sie die **Reasoning Levels**ein. Die Zeilen beginnen mit aus, niedrig, mittel und hoch. Jede Zeile koppelt eine Ebene mit dem **API-Wert** , der für sie gesendet wurde, was standardmäßig auf den Levelnamen lautet; ändern Sie ihn nur, wenn die API-Dokumentation des Modellanbieters die Ebene unterschiedlich buchstabiert. Hinzufügen oder Löschen von Zeilen, um dem zu entsprechen, was der Endpunkt unterstützt, halten Sie mindestens eine Ebene außer aus und speichern Sie. Durch das Ausschalten des Schalters wird die Erklärung entfernt.

Die Seite schreibt `reasoningEfforts` in `$DSH_HOME/profiles/<profile>/cordis.patch.yml`, wo Sie die Level auch direkt deklarieren können:

```yaml
- id: llm-pi-ai
  config:
    providers:
      my-gateway:
        apiKeyEnv: GATEWAY_API_KEY
        api: openai-completions
        baseURL: https://gateway.example/v1
        reasoning: high
        models:
          - id: my-reasoner
            reasoningEfforts:
              off:
              high: high
              max: max
```

Jeder Schlüssel ist eine Ebene, die das Menü anbietet, und sein Wert ist die Schreibweise, die auf dem Draht als `reasoning_effort`gesendet wird, so dass `max: xhigh` eine Ebene für ein Gateway mit seinem eigenen Vokabular umbenennt. Nur `off` kann leer bleiben, weil für die meisten Endpunkte nicht zu denken ist die Abwesenheit des Parameters. Der `reasoning` der Route ist der Level, der verwendet wird, während eine Sitzung keine ausgewählt hat; die Auswahl eines Aufwands im Picker speichert ihn mit dem Modell als Standard für neue Sitzungen.

Ein leer gelassenes `off` sendet nichts, was nur ein Modell stoppt, das auf Anfrage denkt; ein `off` , dem ein Wert zugewiesen wurde, sendet diesen Wert stattdessen als `reasoning_effort` . Ein Modell, das denkt, es sei denn, es wird nicht gesagt - DeepSeek V4 hinter einem OpenAI-kompatiblen Gateway, zum Beispiel - braucht `compat.thinkingFormat: deepseek`, was `off` dazu bringt, `thinking: {type: disabled}` zu senden und jede andere Ebene `thinking: {type: enabled}` neben der Anstrengung:

```yaml
        models:
          - id: deepseek-v4-pro
            compat:
              thinkingFormat: deepseek
            reasoningEfforts:
              off:
              high: high
              max: max
```

Ein eingebautes Provider-Modell, dessen Gateway keinen Grund hat, verliert seine Level mit `reasoningEfforts: false` unter `modelOverrides`; die Auswahl eines Aufwands dafür wird dann als `UNSUPPORTED_REASONING_EFFORT`abgelehnt. DeepSeeks eigene Route braucht nichts davon: Seine Modelle bieten bereits `off`, `low`, `high`und `max`und `llm-deepseek.reasoningEffort` setzt den Standard, ab dem der Picker startet:

```yaml
- id: llm-deepseek
  config:
    reasoningEffort: max
```

<a id="request-compatibility"></a>

### Kompatibilität mit dem Antrag

Ein Gateway kann einen Arbeitsschlüssel an einer erreichbaren Adresse halten und trotzdem jede Anfrage ablehnen. pi-ai entscheidet über die Form einer Anfrage - welche Rolle die Systemaufforderung trägt, welches Feld die Ausgabe begrenzt, wie eine Denkebene reist - von der URL des Endpunkts, und eine Adresse, die es nicht erkennt, wird so angesprochen, als wäre es OpenAI selbst. Die meisten OpenAI-kompatiblen Gateways lehnen mindestens eine Sache ab, die OpenAI akzeptiert.

Zwei machen das meiste aus. Ein Modell, das Argumentation deklariert, hat seine Systemaufforderung als `role: "developer"`gesendet, was viele Gateways völlig ablehnen, und die Ausgabeobergrenze wird als `max_completion_tokens`gesendet, was ein Server, der nur `max_tokens` kennt, ablehnt. Das Formular hat kein Feld für entweder; korrigieren Sie sie auf der Route in `$DSH_HOME/profiles/<profile>/cordis.patch.yml`:

```yaml
- id: llm-pi-ai
  config:
    providers:
      my-gateway:
        apiKeyEnv: GATEWAY_API_KEY
        api: openai-completions
        baseURL: https://gateway.example/v1
        compat:
          supportsDeveloperRole: false
          maxTokensField: max_tokens
        models:
          - id: my-model
```

Der `compat` einer Route ist die Standardeinstellung für ihre Modelle, und das eigene Modell gewinnt Feld für Feld, so dass ein Modell korrigiert werden kann, ohne die Route zu wiederholen:

```yaml
        models:
          - id: my-model
          - id: my-reasoner
            compat:
              thinkingFormat: deepseek
```

Was keine der beiden Sets den Wert des installierten Katalogs für dieses Modell behält und was der Katalog nicht beschreibt, fällt auf die Erkennung von pi-ai. Geben Sie jedem Schalter, den Sie benennen, einen Wert: Ein leer gelassener Schlüssel (`supportsDeveloperRole:`) wird abgelehnt und nicht ignoriert, da ein leerer Wert das löschen würde, was der Katalog weiß, während er an seiner Stelle nichts sagt. Ein name, den kein protokoll akzeptiert, wird ebenfalls abgelehnt, und die nachricht listet diejenigen auf, die verfügbar sind.

Jeder Switch gehört zu den Protokollen, die ihn deklarieren, so dass ein Switch, der auf einem `api` gültig ist, auf einem anderen abgelehnt werden kann - die Nachricht benennt, was dieses Protokoll bietet. Wie bei `input` oben, gibt ein Switch einen Anspruch auf Ihren Endpunkt an, anstatt ihn zu überprüfen: Wenn Sie einen festlegen, den Ihr Gateway nicht benötigt, wird einfach eine andere Anforderung gesendet.

Jeder Switch, seine akzeptierten Werte und die Protokolle, die ihn aufnehmen, sind unter `PiAiCompatProfile` in der [generierten `dsh-llm-pi-ai` -Konfigurationsreferenz](../../config-catalog.md#oceanocean-llm-pi-ai) aufgeführt - die von der Quelle abgeleitet ist, so dass er nicht hinter das zurückfallen kann, was der Adapter akzeptiert.

<a id="troubleshooting"></a>

## Fehlerbehebung

- **`MISSING_CREDENTIAL`** Speichern Sie den Provider-Schlüssel über die Models-Seite oder geben Sie die referenzierte Umgebungsvariable an.
- **`UNKNOWN_MODEL`** Wählen Sie ein konfiguriertes Modell aus oder fügen Sie das fehlende Modell dem benutzerdefinierten Anbieter hinzu.
- **Wenn Sie verfügbare Modelle abrufen, erhalten Sie 401** — Wählen Sie den Schlüssel aus. Die Modellerkennung ruft den OpenAI-kompatiblen `GET /models` -Endpunkt auf; geben Sie Modelle manuell für Endpunkte ein, die sie nicht bereitstellen.
- **Das Abrufen verfügbarer Modelle meldet weder ein `data` -Array noch ein `models` -Objekt** — Die Auflistung des Endpunkts befindet sich in einem Format, in dem die Erkennung nicht gelesen wird. Geben Sie die Modelle von Hand ein.
- **Das Gateway lehnt jede Anfrage ab, obwohl der Schlüssel und die URL richtig sind** — Seine Anforderungsform unterscheidet sich von OpenAI. Beginnen Sie mit `compat.supportsDeveloperRole: false` und `compat.maxTokensField: max_tokens` auf der Route.
- **Nur Argumentationsmodelle scheitern an** – pi-ai sendet ihre Systemaufforderung als `developer` -Rolle, die das Gateway ablehnt. `compat.supportsDeveloperRole: false`.
- **Das Aufwandsmenü wird nicht für ein Modell angezeigt, das Sie von Hand eingegeben haben** - Es deklariert keine Level. Schalten Sie auf einem benutzerdefinierten Modell-API-Anbieter die **Reasoning Level** in den **Modelloptionen des Modells**ein; an anderer Stelle fügen Sie `reasoningEfforts` zum Modell in `cordis.patch.yml`.
- **`off` hält ein DeepSeek-Modell nicht vom Denken ab** — Eine leere `off` Sendet überhaupt kein Argumentationsfeld, und ein Endpunkt, der standardmäßig denkt, denkt weiter. `compat.thinkingFormat: deepseek` auf dem Modell oder der Route.
- **Ein Compat-Switch wird abgelehnt, da er keinen Wert** hat — Ein Schlüssel, der mit nichts nach dem Doppelpunkt geschrieben wurde. Geben Sie ihm einen Wert oder entfernen Sie den Schlüssel, um den installierten Katalog zu behalten.
- **Ein Bild wird vor dem Senden von** abgelehnt - Das Modell deklariert keine Bildmodalität. Geben Sie das Modell eines benutzerdefinierten Anbieters `input: [text, image]`an; Wählen Sie auf DeepSeeks eigener Route einen bildfähigen Eintrag aus dem konfigurierten Katalog aus (standardmäßig`deepseek-flash` ) und bestätigen Sie, dass Ihr Gateway dieses Modell mit Bildeingabe bedient.
- **Der Anbieter lehnt eine Anfrage ab, die ein Bild** enthält – Das Modell erklärt, dass Bilder, deren Endpunkt nicht wirklich dient, nicht verwendet werden. Entfernen Sie `image` aus der Liste, die es gewährt hat - `input`des Modells oder `defaultInput` der Route - und starten Sie dann eine neue Sitzung: Das angehängte Bild bleibt im Sitzungsprotokoll, so dass sich die gleiche Anforderung wiederholt, bis die Sitzung es verlässt.
