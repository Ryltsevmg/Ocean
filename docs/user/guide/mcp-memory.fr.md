<a id="connect-a-third-party-memory-mcp-server"></a>

# Connecter un serveur MCP de mémoire tiers

<!-- USER_LANGUAGES_START -->
[English](mcp-memory.md) | [中文](mcp-memory.zh.md) | [Русский](mcp-memory.ru.md) | [日本語](mcp-memory.ja.md) | [Español](mcp-memory.es.md) | Français | [Deutsch](mcp-memory.de.md) | [Português](mcp-memory.pt.md) | [한국어](mcp-memory.ko.md)
<!-- USER_LANGUAGES_END -->

Ces trois **configurations de référence désactivées par défaut** permettent de connecter un système de mémoire à OCEAN via [`@ocean/ocean-mcp-client`](../../../packages/mcp/mcp-client/README.md). Choisissez-en une ou recopiez la même entrée MCP générique pour un autre serveur.

Ces configurations de tiers sont fournies à titre d’exemples d’interopérabilité seulement. Leur inclusion n’implique pas l’approbation, la recommandation, le partenariat ou le soutien continu du projet Ocean.

<a id="what-ocean-does"></a>

## Ce que fait OCEAN

OCEAN analyse la surcouche Cordis sélectionnée, lance la commande stdio configurée ou se connecte à l’URL Streamable HTTP configurée, découvre les outils MCP et les expose sous la forme `mcp__<serverName>__<tool>`. OCEAN ne télécharge pas le serveur, n’initialise pas sa base de données, ne choisit pas son modèle ni son fournisseur d’embeddings, ne crée pas de compte cloud, ne migre pas les données du fournisseur et ne supervise pas de service HTTP distinct. En stdio, le client générique démarre et arrête le processus enfant selon le cycle de vie de l’extension OCEAN. En HTTP, le service distant doit déjà fonctionner.

Avant de lancer le processus enfant, le client stdio retire du milieu d’exécution les variables dont le nom désigne généralement des identifiants, ainsi que toutes les variables `OCEAN_*`. Le processus enfant hérite des autres variables. Chaque exemple ajoute uniquement le réglage dont il a besoin. Si une fonction facultative du serveur requiert un autre secret, ajoutez la variable correspondante à `config.env` dans l’entrée, sans inscrire le secret dans le YAML.

<a id="choose-one"></a>

## Choisir un serveur

| Système | Version testée | Transport | Prérequis du fournisseur |
|---|---:|---|---|
| [Memorix](https://github.com/AVIDS2/memorix) | `memorix@1.3.0` (`500792cad3144142293bfbb20acb4841c9f7fcfa`) | stdio | Node 22.18+ et `npm install --global memorix@1.3.0` |
| [Mémoire de référence MCP](https://github.com/modelcontextprotocol/servers/tree/main/src/memory) | `@modelcontextprotocol/server-memory@2026.7.4` (`6dd0a683e198783e30feabf7abaf42f925bd18b1`) | stdio | `npm install --global @modelcontextprotocol/server-memory@2026.7.4` |
| [Engram](https://github.com/Gentleman-Programming/engram) | `v1.20.0` (`ba9e46ced152c37a7cb9e576153c41995873e2fc`) | stdio | Go 1.25.10+ et `go install github.com/Gentleman-Programming/engram/cmd/engram@v1.20.0`, ou le binaire de sortie correspondant |

<a id="enable-one"></a>

## Activer un serveur

Passez une surcouche à OCEAN.

```sh
ocean web --patch "$PWD/apps/cli/config/examples/mcp-memory/memorix.cordis.yml"
```

Remplacez le nom de fichier par `mcp-reference-memory.cordis.yml` ou `engram.cordis.yml`. Vous pouvez indiquer le chemin d’une copie du fichier à n’importe quel emplacement sur le disque. Aucun serveur de mémoire n’est configuré dans la composition fournie. Sans `--patch`, les trois serveurs restent désactivés.

Pour conserver le réglage entre deux lancements, fusionnez l’unique patch `insert` du fichier choisi dans la surcouche utilisateur `$OCEAN_HOME/profiles/<name>/cordis.patch.yml` pour un profil ou `$OCEAN_HOME/cordis.patch.yml` pour tous les profils de la machine. N’écrasez pas le fichier existant, qui peut déjà contenir d’autres patches utilisateur.

<a id="provider-setup"></a>

## Configuration du fournisseur

<a id="memorix"></a>

### Memorix

```sh
npm install --global memorix@1.3.0
ocean web --patch "$PWD/apps/cli/config/examples/mcp-memory/memorix.cordis.yml"
```

Memorix fonctionne en mode heuristique local sans LLM ni service d’embeddings. Configurez les fournisseurs facultatifs dans `~/.memorix/config.toml` ou dans le fichier `memorix.toml` du projet. L’exemple laisse Memorix identifier le projet Git à partir du répertoire de travail de OCEAN et utiliser son emplacement par défaut `~/.memorix/data`. Pour changer cet emplacement, définissez `MEMORIX_DATA_DIR` avant de lancer OCEAN.

<a id="mcp-reference-memory"></a>

### Mémoire de référence MCP

```sh
npm install --global @modelcontextprotocol/server-memory@2026.7.4
ocean web --patch "$PWD/apps/cli/config/examples/mcp-memory/mcp-reference-memory.cordis.yml"
```

Ce serveur de référence stocke un graphe de connaissances local. Ses outils gèrent les entités, les relations et les observations, et permettent de lire, de rechercher et d’ouvrir des éléments. Aucun modèle ni service d’embeddings n’est requis. L’exemple stocke le JSONL dans `$HOME/.ocean-mcp-reference-memory.jsonl` en dehors du répertoire du paquet npm installé. Pour changer cet emplacement, définissez `MEMORY_FILE_PATH` avant de lancer OCEAN.

La recherche compare les sous-chaînes sans tenir compte de la casse dans les noms, les types et les observations des entités. Le serveur ne fournit ni recherche sémantique, ni embeddings, ni résumé automatique, ni résolution des conflits, ni politique d’oubli.

<a id="engram"></a>

### Engram

```sh
go install github.com/Gentleman-Programming/engram/cmd/engram@v1.20.0
ocean web --patch "$PWD/apps/cli/config/examples/mcp-memory/engram.cordis.yml"
```

Engram gère le stockage et la sélection du projet. Il utilise `~/.engram` par défaut et détecte le projet Git à partir du répertoire de travail de OCEAN. Les variables d’environnement `ENGRAM_DATA_DIR` et `ENGRAM_PROJECT` permettent de remplacer ces valeurs.

<a id="optional-shared-model-instruction"></a>

## Instruction commune facultative pour le modèle

Ajoutez cette courte instruction neutre pour le fournisseur à vos instructions de modèle existantes si les descriptions d’outils du serveur ne déclenchent pas l’utilisation de la mémoire de manière fiable:

> Lorsque l’utilisateur vous demande de vous souvenir de quelque chose, appelez un outil d’écriture de mémoire. Lorsque l’information historique peut être pertinente, recherchez la mémoire et utilisez les résultats pertinents.

Cette instruction complète les instructions existantes. Les exemples conservent le rôle défini par le message système de OCEAN.

<a id="verify-write-fresh-session-recall-and-use"></a>

## Vérifier l’écriture, le rappel de session et l’utilisation

Utilisez une valeur unique et maintenez la portée de stockage du fournisseur inchangé tout au long :

1. Dans la session OCEAN A, demandez : `Remember that my validation drink is lapsang-<unique suffix>.` Vérifiez que le modèle a appelé l’outil d’écriture du fournisseur et que l’outil a signalé une réussite.
2. Créez la session OCEAN B dans le même hôte en cours d’exécution. Ne copiez pas la conversation de la session A. Demandez : `What is my validation drink? Check memory.` Vérifiez que le modèle a appelé l’outil de recherche ou de rappel du fournisseur et a restitué la valeur.
3. Toujours en session B, demandez : `Use that preference to suggest one drink for the meeting.` Confirmez que la réponse utilise la valeur rappelée.

Ouvrez une nouvelle session OCEAN sans redémarrer l’hôte. Si un processus enfant MCP se termine brutalement, OCEAN tente de se reconnecter automatiquement avec des délais croissants, puis resynchronise les outils. Les outils restent répertoriés et les appels échouent uniquement pendant l’interruption. Une fois les tentatives épuisées, OCEAN désenregistre les outils et cesse de se reconnecter jusqu’au rechargement ou au redémarrage. La découverte initiale est asynchrone. Attendez que les outils `mcp__...` du fournisseur apparaissent avant d’envoyer la première demande de validation.

<a id="bring-another-mcp-server"></a>

## Connecter un autre serveur MCP

Copiez les mêmes champs d'entrée et utilisez un `id` unique et `serverName`:

```yaml
- insert:
    - id: memory-my-server
      name: '@ocean/ocean-mcp-client'
      config:
        serverName: my-memory
        transport: stdio
        command: my-memory-mcp
        args: []
        env: {}
        cwd: !!js process.cwd()
```

Pour un serveur distant, utilisez `transport: streamable-http`, `url` et `headers`. L’installation, l’identité, l’authentification, les modèles, les embeddings, la persistance et les licences restent du ressort du fournisseur.
