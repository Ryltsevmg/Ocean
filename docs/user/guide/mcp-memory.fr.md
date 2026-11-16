<a id="connect-a-third-party-memory-mcp-server"></a>

# Connexion d'un serveur MCP de mémoire tiers

<!-- USER_LANGUAGES_START -->
[English](mcp-memory.md) | [中文](mcp-memory.zh.md) | [Русский](mcp-memory.ru.md) | [日本語](mcp-memory.ja.md) | [Español](mcp-memory.es.md) | Français | [Deutsch](mcp-memory.de.md) | [Português](mcp-memory.pt.md) | [한국어](mcp-memory.ko.md)
<!-- USER_LANGUAGES_END -->

Ces trois **configurations de référence par défaut** connecter un système de mémoire à DSH à travers [`@ocean/ocean-mcp-client`](../../../packages/mcp/mcp-client/README.md). Choisissez un, ou copiez la même ligne générique MCP pour un autre serveur.

Ces configurations de tiers sont fournies à titre d'exemples d'interopérabilité seulement. Leur inclusion n'implique pas l'approbation, la recommandation, le partenariat ou le soutien continu du projet Ocean.

<a id="what-dsh-does"></a>

## Ce que fait DSH

DSH analyse la superposition de Cordis sélectionnée, démarre une commande stdio configurée ou se connecte à une URL HTTP via Streamable configurée, découvre les outils MCP et les expose comme `mcp__<serverName>__<tool>`- C'est vrai. **pas** télécharger le serveur, initialiser sa base de données, choisir son modèle ou intégrer le fournisseur, créer un compte cloud, migrer les données du fournisseur ou superviser un service HTTP séparé. Pour stdio, le client générique lance et arrête l'enfant avec le cycle de vie du plugin DSH ; pour HTTP, le service en amont doit déjà être exécuté.

Le pont stdio supprime délibérément les variables ambiantes dont les noms identifient généralement les identificateurs et toutes les variables `DSH_*` avant de lancer un enfant; d'autres variables ambiantes restent héritées. Chaque exemple ajoute seulement la priorité de base dont il a besoin. Si une fonctionnalité en amont optionnelle a besoin d'un autre secret, ajoutez cette variable au `config.env` de la ligne au lieu de mettre le secret directement dans YAML.

<a id="choose-one"></a>

## Choisissez-en un

| Système | Pin testé | Transport | Préalable en amont |
|---|---:|---|---|
| [Memorix](https://github.com/AVIDS2/memorix) | `memorix@1.3.0` (`500792cad3144142293bfbb20acb4841c9f7fcfa`) | stdio | Node 22.18+ et `npm install --global memorix@1.3.0` |
| [Mémoire de référence MCP](https://github.com/modelcontextprotocol/servers/tree/main/src/memory) | `@modelcontextprotocol/server-memory@2026.7.4` (`6dd0a683e198783e30feabf7abaf42f925bd18b1`) | stdio | `npm install --global @modelcontextprotocol/server-memory@2026.7.4` |
| [Engram](https://github.com/Gentleman-Programming/engram) | `v1.20.0` (`ba9e46ced152c37a7cb9e576153c41995873e2fc`) | stdio | Go 1.25.10+ et `go install github.com/Gentleman-Programming/engram/cmd/engram@v1.20.0`, ou le binaire de sortie correspondant |

<a id="enable-one"></a>

## Activer une

Passez une superposition à DSH :

```sh
dsh web --patch "$PWD/apps/cli/config/examples/mcp-memory/memorix.cordis.yml"
```

Remplacer le nom du fichier par `mcp-reference-memory.cordis.yml` ou `engram.cordis.yml`. Le chemin peut pointer vers un fichier copié n'importe où sur le disque. Aucun serveur de mémoire n'est présent dans la composition expédiée, donc l'omission `--patch` maintient les trois désactivés.

Pour garder la sélection à travers les parcours, fusionnez le patch `insert` unique du fichier sélectionné en un patch utilisateur – `$DSH_HOME/profiles/<name>/cordis.patch.yml` pour un profil, ou `$DSH_HOME/cordis.patch.yml` pour chaque profil de la machine. Ne pas copier sur un fichier existant : il peut déjà contenir des correctifs utilisateurs indépendants.

<a id="provider-setup"></a>

## Configuration du fournisseur

<a id="memorix"></a>

### Mémoire

```sh
npm install --global memorix@1.3.0
dsh web --patch "$PWD/apps/cli/config/examples/mcp-memory/memorix.cordis.yml"
```

Memorix travaille en mode heuristique local sans LLM ni service d'intégration. Configurer les fournisseurs optionnels dans le propre `~/.memorix/config.toml` de Memorix ou le projet `memorix.toml`. L'exemple conserve l'identité Git-project de Memorix à partir du répertoire de travail DSH et utilise la propre `~/.memorix/data` de Memorix par défaut. Définissez `MEMORIX_DATA_DIR` avant de démarrer DSH pour le surcharger.

<a id="mcp-reference-memory"></a>

### Mémoire de référence MCP

```sh
npm install --global @modelcontextprotocol/server-memory@2026.7.4
dsh web --patch "$PWD/apps/cli/config/examples/mcp-memory/mcp-reference-memory.cordis.yml"
```

Ce serveur de référence stocke un graphique de connaissances local et expose les entités, les relations, l'observation, la lecture, la recherche et les outils ouverts. Il n'a pas besoin de modèle ni de service d'intégration. L'exemple stocke son JSONL à `$HOME/.dsh-mcp-reference-memory.jsonl` au lieu du répertoire de paquets npm installé. Définissez `MEMORY_FILE_PATH` avant de démarrer DSH pour le surcharger.

La recherche est une sous-chaîne insensible à la casse qui correspond aux noms, aux types et aux observations des entités, et non à la récupération sémantique. Le serveur n'ajoute pas d'intégrations, de sommation automatique, de résolution de conflits ou d'une politique d'oubli.

<a id="engram"></a>

### Engramme

```sh
go install github.com/Gentleman-Programming/engram/cmd/engram@v1.20.0
dsh web --patch "$PWD/apps/cli/config/examples/mcp-memory/engram.cordis.yml"
```

Engram possède le stockage et la sélection de projets : il utilise `~/.engram` par défaut, détecte le projet Git à partir du répertoire de travail DSH et accepte `ENGRAM_DATA_DIR` ou `ENGRAM_PROJECT` comme des dépassements ambiants.

<a id="optional-shared-model-instruction"></a>

## Enseignement optionnel du modèle partagé

Ajoutez cette courte instruction neutre pour le fournisseur à vos instructions de modèle existantes si les descriptions d'outils du serveur ne déclenchent pas l'utilisation de la mémoire de manière fiable:

> Lorsque l'utilisateur vous demande de vous souvenir de quelque chose, appelez un outil d'écriture de mémoire. Lorsque l'information historique peut être pertinente, recherchez la mémoire et utilisez les résultats pertinents.

Il ne s'agit que d'indications additives. Les exemples ne remplacent pas la personnalité de la DSH.

<a id="verify-write-fresh-session-recall-and-use"></a>

## Vérifier l'écriture, le rappel de session et l'utilisation

Utilisez une valeur unique et maintenez la portée de stockage du fournisseur inchangé tout au long :

1. Dans la session A de DSH, demandez : `Remember that my validation drink is lapsang-<unique suffix>.` Confirmez le modèle appelé outil d'écriture du fournisseur et l'outil retourné succès.
2. Créez la session DSH B dans le même hôte en cours d'exécution. Ne copiez pas la conversation de la session A. Demandez : `What is my validation drink? Check memory.` Confirmez le modèle appelé outil de recherche ou de rappel du fournisseur et renvoyez la valeur.
3. Toujours en session B, demandez : `Use that preference to suggest one drink for the meeting.` Confirmez que la réponse utilise la valeur rappelée.

Une nouvelle session DSH est requise; un redémarrage Host ne l'est pas. Un enfant MCP écrasé déclenche une reconnection automatique avec backoff et un re-sync outil; les outils restent listés et les appels échouent seulement pendant la panne, et après que le budget de reconnect est épuisé, les outils sont non enregistrés et la reconnection s'arrête jusqu'à ce qu'un rechargement ou redémarre. La découverte initiale est asynchrone, alors attendez les outils `mcp__...` du fournisseur avant d'envoyer la première demande de validation.

<a id="bring-another-mcp-server"></a>

## Apportez un autre serveur MCP

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

Pour un serveur distant, utilisez `transport: streamable-http`, `url`, et `headers` à la place. L'installation, l'identité, l'authentification, les modèles, l'intégration, la persistance et la licence spécifiques au fournisseur restent la responsabilité du fournisseur.
