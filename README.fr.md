# Ocean

<!-- USER_LANGUAGES_START -->
[English](README.md) | [中文](README.zh.md) | [Русский](README.ru.md) | [日本語](README.ja.md) | [Español](README.es.md) | Français | [Deutsch](README.de.md) | [Português](README.pt.md) | [한국어](README.ko.md)
<!-- USER_LANGUAGES_END -->

Ocean est un espace de travail de bureau pour les agents d’IA, les conversations et les outils. Son environnement d’exécution s’appuie sur des extensions pour intégrer les fournisseurs de modèles, les outils de développement et, si nécessaire, le pilotage du navigateur ou de l’ordinateur.

<a id="developer-preview"></a>

## Aperçu pour les développeurs

Ocean est en cours de développement. Les API et les fonctionnalités peuvent évoluer. Lisez l’[avis de sécurité](SAFETY.md) avant de le lancer. Une compilation locale réussie ne remplace ni un audit de sécurité ni une version publique signée.

<a id="get-started"></a>

## Prise en main

Utilisez le dépôt [Ryltsevmg/Ocean](https://github.com/Ryltsevmg/Ocean). L’accès peut être restreint pendant la préparation de la version publique. N’utilisez pas le programme d’installation du projet d’origine ni un paquet npm non vérifié pour installer Ocean.

Consultez le [guide de développement](docs/development.md) pour configurer le projet à partir du code source et lancer les clients web et de bureau en local. Les prérequis et les commandes sont définis dans [package.json](package.json). Sauvegardez les profils existants avant de tester une nouvelle compilation.

## Documentation

- [Guide d’utilisation](docs/user/index.fr.md)
- [Architecture](docs/architecture.md)
- [Contribuer](CONTRIBUTING.md)
- [Sécurité](SAFETY.md)
- [Charte graphique](docs/brand-guidelines.md)

Une fois la configuration publiée, le processus de vérification de [GitHub Actions](.github/workflows/) s’exécute sur les demandes de fusion et les envois vers main. La création des paquets Linux reste manuelle. Les paquets produits ne sont pas signés et ne constituent pas un canal de mise à jour automatique.

<a id="feedback"></a>

## Vos retours

Si vous avez accès au dépôt, signalez les bugs reproductibles dans les [tickets Ocean](https://github.com/Ryltsevmg/Ocean/issues). Vous pouvez aussi contacter l’[assistance Ocean](mailto:support@oceanharness.com) ou son [bot Telegram](https://t.me/oceanchatsupportbot). Ne publiez jamais de jetons, de journaux privés de session ou de données personnelles dans un ticket public.

<a id="license-and-acknowledgements"></a>

## Licence et remerciements

[MIT](LICENSE). L’origine du code, les mentions de droits d’auteur conservées et les conditions des dépendances figurent dans les [mentions relatives aux composants tiers](THIRD_PARTY_NOTICES.md).
