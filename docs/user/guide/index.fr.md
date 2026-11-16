<a id="use-the-web-ui"></a>

# Utilisez l'interface utilisateur Web

<!-- USER_LANGUAGES_START -->
[English](index.md) | [中文](index.zh.md) | [Русский](index.ru.md) | [日本語](index.ja.md) | [Español](index.es.md) | Français | [Deutsch](index.de.md) | [Português](index.pt.md) | [한국어](index.ko.md)
<!-- USER_LANGUAGES_END -->

Démarrez l'interface Web via la racine [README](../../development.md); la commande imprime son URL. Ce guide commence après que ce serveur est en cours d'exécution. Le processus `dsh` utilise son répertoire comme emplacement par défaut du système de fichiers, mais une nouvelle interface utilisateur Web n'a pas d'espace de travail sélectionné jusqu'à ce que vous en ajoutiez un.

<a id="configure-a-model"></a>

## Configurer un modèle

Ouvrir **Paramètres → Modèles** et choisir un fournisseur modèle; [guide de configuration du modèle](./providers.fr.md) couvre les fournisseurs supportés et les paramètres compatibles OpenAI personnalisés. Pour une route DeepSeek, entrez votre [Clé API DeepSeek](https://platform.deepseek.com/) La route du modèle devient utilisable immédiatement sans redémarrer le serveur.

<a id="choose-a-workspace"></a>

## Choisir un espace de travail

Cliquez sur **Choisissez l'espace de travail**, ajoutez le répertoire du projet où vous avez démarré `dsh`, et sélectionnez-le. L'éditeur de session reste indisponible jusqu'à ce qu'un espace de travail soit sélectionné.

<a id="run-a-task"></a>

## Exécuter une tâche

Démarrer une session et envoyer :

> Résumez ce dépôt et identifiez ses principaux paquets.

L'agent peut lire et modifier des fichiers d'espace de travail, exécuter des commandes, déléguer le travail et maintenir un plan. L'interface utilisateur Web demande avant les opérations qui nécessitent l'approbation en vertu de la politique de permission active.

<a id="continue"></a>

## Continuer

- [Configurer les modèles](./providers.fr.md)
- [Configurer un proxy réseau](./network-proxy.fr.md)
- [Utiliser la mémoire MCP](./mcp-memory.fr.md)
- [Planifier des rappels](./schedule.fr.md)
- [Utiliser le SDK Python](./python-sdk.fr.md)
- [Publier l'interface utilisateur Web derrière un proxy inversé](./public-deployments.fr.md)
- [Désinstaller Ocean Desktop](./desktop-uninstall-cleanup.fr.md)
- [Utiliser d'autres modes CLI](../../../apps/cli/README.md)
- [Développez un plugin](../develop/basic/index.md)
