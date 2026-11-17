<a id="publish-the-web-ui-behind-a-reverse-proxy"></a>

# Publier l’interface web derrière un proxy inverse

<!-- USER_LANGUAGES_START -->
[English](public-deployments.md) | [中文](public-deployments.zh.md) | [Русский](public-deployments.ru.md) | [日本語](public-deployments.ja.md) | [Español](public-deployments.es.md) | Français | [Deutsch](public-deployments.de.md) | [Português](public-deployments.pt.md) | [한국어](public-deployments.ko.md)
<!-- USER_LANGUAGES_END -->

`ocean --profile web` expose l’interface graphique sur un port de l’interface de bouclage. Un navigateur sur une autre machine ne peut donc pas s’y connecter directement, et le processus ne connaît pas l’adresse publique. Le proxy inverse gère le nom d’hôte public, TLS et le préfixe de chemin. Il retire ce préfixe avant de transmettre la requête au serveur. Indiquez à OCEAN l’adresse utilisée par les navigateurs avec `--public-url`.

```sh
ocean --profile web --public-url https://app.example/ui/ --trusted-host app.example
```

<a id="what---public-url-advertises"></a>

## URL publiée par `--public-url`

`--public-url` accepte une URL de base en `http://` ou `https://`, avec un préfixe de chemin facultatif, et la normalise pour qu’elle se termine par `/`. Cette valeur sert à l’URL affichée et ouverte au démarrage, à `OCEAN_WEB_URL` et à l’URL de l’interface web fournie dans le contexte d’exécution de l’agent. Le serveur web continue de servir ses routes depuis la racine de l’origine et ignore le préfixe. Le champ de configuration `publicUrl` publie la même URL.

<a id="what-the-proxy-must-do"></a>

## Configuration du proxy

- **Conserver l’en-tête `Host` du navigateur.** Le filtre compare le `Host` reçu aux autorités autorisées. Le proxy doit donc le transmettre tel quel, sans le remplacer par l’adresse d’écoute du serveur.
- **Retirer le préfixe de chemin.** Le serveur répond aux routes à la racine de l’origine. Une requête pour `/ui/api/...` doit donc lui parvenir sous la forme `/api/...`.
- **Transmettre les demandes de changement de protocole.** Transmettez au serveur toutes les requêtes de la page, y compris les demandes de passage à WebSocket, en conservant les en-têtes `Upgrade` et `Connection`. Lorsque le proxy sert HTTPS, il termine TLS sur la liaison avec le navigateur.
- **Modifier la portée des cookies.** Un serveur en HTTP émet des cookies réservés à l’hôte, avec `Path=/` et sans attribut `Secure`. Le proxy remplace alors `Path` par le préfixe public (`/ui/`) et ajoute `Secure` sur la liaison HTTPS. Si le serveur gère déjà TLS, il ajoute lui-même `Secure` et le proxy modifie uniquement `Path`.
- **Rediriger le chemin sans barre oblique finale.** Seul `/ui/` permet d’échanger le jeton de lancement contre le cookie de session. Un navigateur qui possède déjà ce cookie peut charger le document à cette adresse ou à `/ui/index.html`. Le document résout les URL par rapport à son propre répertoire. Redirigez `/ui` vers `/ui/`, car le serveur en aval ne peut pas reconstituer ce chemin public après le retrait du préfixe.

<a id="trust-the-authority-browsers-use"></a>

## Autoriser le nom d’hôte et le port utilisés par le navigateur

Le filtre accepte l’interface de bouclage, l’adresse d’écoute du serveur et chaque autorité indiquée par `--trusted-host`. Un navigateur connecté par une autre autorité reçoit une réponse 403 à chaque appel API, même si le proxy est correctement configuré. Indiquez l’autorité visible du navigateur avec `--trusted-host`. `--public-url` sert uniquement à publier l’URL. Une entrée sans port accepte tous les ports, ce qui convient à un tunnel qui change de port à chaque lancement. Le filtre autorise la requête. Le jeton de lancement dans l’URL affichée et le cookie de session signé l’authentifient. Quel que soit le point de terminaison TLS, le certificat permet au navigateur de vérifier l’identité du serveur.

L’URL publiée et le filtre n’assurent aucune protection du port d’écoute lui-même. Limitez l’accès à ce port au proxy ou au réseau de confiance.

<a id="secure-the-external-leg"></a>

## Sécuriser la connexion publique

Vous pouvez terminer TLS au niveau du proxy, du serveur ou des deux. `--public-url` sert toujours uniquement à publier l’adresse. Une URL de base en `http://` expose le jeton de lancement en clair. Une URL de proxy en `https://` protège la liaison entre le navigateur et le proxy. Le chiffrement entre le proxy et le serveur dépend de la configuration TLS du serveur.

Pour terminer TLS sur le serveur, passez `--tls-cert` et `--tls-key`. Chaque chemin est résolu à partir du répertoire de travail du processus. Le premier fichier contient la chaîne complète de certificats et le second, une clé privée PEM non chiffrée. OCEAN n’obtient pas les certificats, ne les renouvelle pas et ne les surveille pas. Les fichiers ne sont lus qu’une fois. Pour les modifier, remplacez-les puis rechargez le serveur ou redémarrez le processus. Le démarrage échoue si la paire est absente ou invalide, sans retour à HTTP. Le navigateur utilise son propre magasin de certificats de confiance et vérifie le nom. Le certificat doit donc couvrir le nom d’hôte ou l’adresse IP utilisée dans le navigateur. Le port par défaut reste 3080. TLS peut fonctionner directement sur le serveur sans proxy. Les déploiements avec proxy et l’option `--public-url` restent pris en charge indépendamment. Un serveur qui utilise TLS marque les cookies de session avec `Secure`. Conservez HTTPS sur la connexion publique pour que le navigateur puisse renvoyer ces cookies.

L’URL affichée contient un jeton d’accès au processus. Communiquez-la uniquement aux utilisateurs concernés.

La [référence de l’application web](../../../packages/bundle/web-app/README.md#public-deployments) documente les options de ligne de commande `--public-url`, `--trusted-host` et `--tls-cert`/`--tls-key`. Dans le profil web, `publicUrl` configure l’entrée `web-runtime`, `trustedHosts` configure l’[entrée de connexion](../../../packages/client/connection/README.md) et `tls` configure l’[entrée du serveur web](../../../docs/subsystems/web-server.md#config).
