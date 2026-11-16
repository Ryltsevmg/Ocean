<a id="use-the-web-ui"></a>

# Utiliser l’interface web

<!-- USER_LANGUAGES_START -->
[English](index.md) | [中文](index.zh.md) | [Русский](index.ru.md) | [日本語](index.ja.md) | [Español](index.es.md) | Français | [Deutsch](index.de.md) | [Português](index.pt.md) | [한국어](index.ko.md)
<!-- USER_LANGUAGES_END -->

Lancez l’interface web en suivant le [README principal](../../development.md). La commande affiche son URL. Suivez ce guide une fois le serveur démarré. Le processus `dsh` utilise par défaut le répertoire depuis lequel vous l’avez lancé. Au premier lancement de l’interface web, aucun espace de travail n’est sélectionné.

<a id="configure-a-model"></a>

## Configurer un modèle

Ouvrez **Paramètres → Modèles** et choisissez un fournisseur de modèles. Le [guide de configuration des modèles](./providers.fr.md) présente les fournisseurs pris en charge et les points de terminaison personnalisés compatibles avec OpenAI. Pour utiliser DeepSeek, saisissez votre [clé API DeepSeek](https://platform.deepseek.com/) et enregistrez-la. Vous pouvez utiliser le modèle immédiatement, sans redémarrer le serveur.

<a id="choose-a-workspace"></a>

## Choisir un espace de travail

Cliquez sur **Choisir un espace de travail**, ajoutez le répertoire du projet depuis lequel vous avez lancé `dsh`, puis sélectionnez-le. La zone de saisie de la session reste indisponible jusqu’à ce que vous ayez sélectionné un espace de travail.

<a id="run-a-task"></a>

## Exécuter une tâche

Démarrez une session et envoyez ce message :

> Résumez ce dépôt et identifiez ses principaux paquets.

L’agent peut lire et modifier les fichiers de l’espace de travail, exécuter des commandes, déléguer des tâches et tenir son plan à jour. L’interface web demande votre accord pour les opérations qui exigent une autorisation selon la politique en vigueur.

<a id="continue"></a>

## Pour aller plus loin

- [Configurer les modèles](./providers.fr.md)
- [Configurer un proxy réseau](./network-proxy.fr.md)
- [Utiliser la mémoire MCP](./mcp-memory.fr.md)
- [Planifier des rappels](./schedule.fr.md)
- [Utiliser le SDK Python](./python-sdk.fr.md)
- [Publier l’interface web derrière un proxy inverse](./public-deployments.fr.md)
- [Désinstaller Ocean Desktop](./desktop-uninstall-cleanup.fr.md)
- [Utiliser d’autres modes en ligne de commande](../../../apps/cli/README.md)
- [Développer une extension](../develop/basic/index.md)
