<a id="publish-the-web-ui-behind-a-reverse-proxy"></a>

# Publier l'interface utilisateur Web derrière un proxy inversé

<!-- USER_LANGUAGES_START -->
[English](public-deployments.md) | [中文](public-deployments.zh.md) | [Русский](public-deployments.ru.md) | [日本語](public-deployments.ja.md) | [Español](public-deployments.es.md) | Français | [Deutsch](public-deployments.de.md) | [Português](public-deployments.pt.md) | [한국어](public-deployments.ko.md)
<!-- USER_LANGUAGES_END -->

`dsh --profile web` sert l'interface graphique sur un port loopback, donc un navigateur sur une autre machine ne peut pas l'atteindre, et le processus ne sait rien de l'adresse que vous utilisez. Un proxy inversé devant lui possède cette jambe externe — le nom de l'hôte public, TLS, et le préfixe de chemin qu'il bande avant de transmettre à l'auditeur — et `--public-url` indique à DSH quelle adresse les navigateurs utilisent:

```sh
dsh --profile web --public-url https://app.example/ui/ --trusted-host app.example
```

<a id="what---public-url-advertises"></a>

## Ce que `--public-url` annonce

`--public-url` accepte une racine `http://` ou `https://` avec un préfixe de montage en option et la normalise pour se terminer dans `/`. Il fournit l'URL de démarrage imprimée et ouverte, `DSH_WEB_URL`, et l'URL Web GUI dans le contexte d'exécution de l'agent. Le serveur Web continue de servir les routes origine-racine et n'apprend jamais le montage. Le champ de configuration `publicUrl` publie la même annonce.

<a id="what-the-proxy-must-do"></a>

## Ce que le mandataire doit faire

- **Préserver le `Host`.** face au navigateur La clôture compare le `Host` reçu aux autorités acceptées, de sorte que le mandataire l'avance inchangé au lieu de le réécrire à l'adresse de l'auditeur.
- **Découpez le préfixe de montage.** L'auditeur répond aux itinéraires origine-root, donc une demande pour `/ui/api/...` doit arriver comme `/api/...`.
- **Mises à niveau vers l'avant.** Chaque requête et mise à niveau WebSocket la page s'ouvre doit atteindre l'auditeur avec ses en-têtes `Upgrade` et `Connection` intacts; TLS se termine sur la jambe externe du proxy lorsqu'il sert HTTPS.
- **Réécrire la portée des cookies.** Un moteur servant des problèmes HTTP simples uniquement pour les cookies `Path=/` sans `Secure`; le proxy réécrit ensuite `Path` sur le support (`/ui/`) et ajoute `Secure` sur sa jambe HTTPS. Un auditeur de backend servant son propre TLS marque déjà le cookie `Secure`, donc le proxy ne réécrit que `Path`.
- **Rediriger la monture nue.** `/ui/` est la seule entrée : il échange seul le jeton de lancement pour le cookie de session, et il ou `/ui/index.html` sert le document à un navigateur qui détient déjà ce cookie, parce que le document servi résout les URLs par rapport à son propre répertoire. Une requête à `/ui` doit arriver sous la forme de `/ui/`, et le moteur dépouillé ne peut pas reconstruire ce chemin externe.

<a id="trust-the-authority-browsers-use"></a>

## Faites confiance à l'utilisation des navigateurs d'autorité

La clôture accepte le loopback, l'adresse de l'auditeur et les noms de chaque autorité `--trusted-host` . Un navigateur qui atteint le déploiement sous n'importe quelle autre autorité obtient 403 pour chaque appel API, cependant correct le proxy est, donc nom de l'autorité visible du navigateur avec `--trusted-host`; la publicité avec `--public-url` est affichée seulement et ne l'admet pas. Une entrée sans port correspond à n'importe quel port, ce qui convient à un tunnel qui lie un autre à chaque fois. La clôture n'admet que la demande; le jeton de lancement dans l'URL imprimée et le cookie de session signé l'authentifient. TLS, où qu'il se termine, ne change rien de tout cela : le certificat identifie le serveur au navigateur, et non le navigateur au serveur.

Ni l'URL annoncée ni la clôture ne protègent le port d'écoute lui-même, limitant ainsi le port au mandataire ou au réseau de confiance.

<a id="secure-the-external-leg"></a>

## Sécuriser la jambe externe

Terminer TLS au proxy, sur l'auditeur lui-même, ou sur les deux; `--public-url` reste une publicité. Une racine de navigateur `http://` expose le jeton de lancement dans le texte clair. Une racine de proxy `https://` protège la jambe de navigateur à proxy ; le chiffrement entre proxy et auditeur dépend de la configuration TLS de l'auditeur.

Pour terminer sur l'auditeur, passez `--tls-cert` et `--tls-key`, chacun un chemin résolu contre le répertoire de travail du processus : le fichier certificat détient la chaîne complète et le fichier clé une clé privée PEM non chiffrée. DSH n'obtient jamais, ne renouvelle pas ou ne regarde jamais les certificats, et le transporteur lit les fichiers une fois, donc remplacez-les et rechargez l'auditeur ou redémarrez le processus pour les changer ; le démarrage échoue sur une paire manquante ou invalide et ne revient jamais à HTTP. Le navigateur applique son propre magasin de trust et les vérifications de nom, de sorte que le certificat doit couvrir le nom d'hôte ou l'IP que vous ouvrez. Le port par défaut reste 3080. Native TLS n'a pas besoin de proxy, mais les déploiements proxy et `--public-url` restent pris en charge indépendamment. Un auditeur TLS marque les cookies de session `Secure`; gardez la jambe publique vers le navigateur HTTPS afin que les navigateurs puissent retourner ces cookies.

L'URL imprimée porte un justificatif de processus, alors partagez-le seulement avec les utilisateurs prévus.

Les [Référence de l'application Web](../../../packages/bundle/web-app/README.md#public-deployments) documente les `--public-url`, `--trusted-host`et `--tls-cert`/`--tls-key` dans le profil Web, `publicUrl` configure la `web-runtime` ligne, `trustedHosts` configure la [Ligne de connexion](../../../packages/client/connection/README.md)et `tls` configure la [ligne du serveur web](../../../docs/subsystems/web-server.md#config).
