<a id="get-started-with-the-python-sdk"></a>

# Commencez avec le SDK Python

<!-- USER_LANGUAGES_START -->
[English](python-sdk.md) | [中文](python-sdk.zh.md) | [Русский](python-sdk.ru.md) | [日本語](python-sdk.ja.md) | [Español](python-sdk.es.md) | Français | [Deutsch](python-sdk.de.md) | [Português](python-sdk.pt.md) | [한국어](python-sdk.ko.md)
<!-- USER_LANGUAGES_END -->

Ce tutoriel construit le SDK Python à partir de la source de ce dépôt, exécute le profil minimal autonome expédié, et montre comment personnaliser le même profil `dsh` à partir de votre propre programme. Ocean n'a pas encore de npm public qualifié ou de distribution SDK PyPI.

<a id="prerequisites"></a>

## Préalables

- Python 3.10 ou plus récent
- Git
- Linux x64, Linux arm64, macOS 14 ou plus récent sur arm64, ou Windows x64
- Un paramètre et un justificatif d'API compatibles avec DeepSeek
- Un espace de travail isolé et une maison isolée de l'océan

<a id="build-the-sdk-from-source"></a>

## Construire le SDK à partir de la source

<div>
<a id="linux-and-macos"></a>

<a id="windows-powershell"></a>
</div>

Aucun registre public n'accueille un SDK Ocean qualifié; installer `deepseek-harness-sdk` de PyPI récupère le paquet du projet donateur, pas Ocean. Construire le support d'exécution et les deux roues dans cette caisse, puis les installer dans un environnement virtuel.

:: Groupe de codes;

```sh [Linux/macOS]
git clone https://github.com/Ryltsevmg/Ocean.git
cd Ocean
pnpm install
pnpm exec tsx scripts/build-exe-for-python-sdk.ts
python -m venv .venv
. .venv/bin/activate
python scripts/build-python-release.py --package sdk --output-dir dist-python
python scripts/build-python-release.py --package runtime --platform linux-x64 --runtime-exe dist-exe/deepseek-harness-sdk-runtime-linux-x64 --output-dir dist-python
pip install dist-python/*.whl
```

```powershell [Windows PowerShell]
git clone https://github.com/Ryltsevmg/Ocean.git
Set-Location Ocean
pnpm install
pnpm exec tsx scripts/build-exe-for-python-sdk.ts
py -3.10 -m venv .venv
.venv\Scripts\Activate.ps1
python scripts/build-python-release.py --package sdk --output-dir dist-python
python scripts/build-python-release.py --package runtime --platform win-x64 --runtime-exe dist-exe/deepseek-harness-sdk-runtime-win-x64.exe --output-dir dist-python
python -m pip install (Get-ChildItem dist-python\*.whl)
```

:::

Sélectionnez la valeur `--platform` et l'exécutable `dist-exe/` correspondant pour votre machine : `linux-x64`, `linux-arm64`, `macos-arm64`, `macos-x64`, ou `win-x64`; construisez chaque cible sur son architecture native. L'installation comprend une roue d'exécution native correspondante et la commande `dsh` . L'exécution normale SDK n'a pas besoin de système Node.js. Le flux de travail contributeur [Python](../../../python/development.md) possède les noms exacts de fichiers, validation et vérifications de libération pour ces étapes de construction.

<a id="run-the-checked-in-example"></a>

## Exécutez l'exemple d'enregistrement

Exporter le titre de compétence et, au besoin, un paramètre mandataire compatible :

<div>
<a id="linux-and-macos-1"></a>

<a id="windows-powershell-1"></a>
</div>

:: Groupe de codes;

```sh [Linux/macOS]
export DEEPSEEK_API_KEY=sk-your-key-here
# export DEEPSEEK_BASE_URL=http://127.0.0.1:8000/v1
```

```powershell [Windows PowerShell]
$env:DEEPSEEK_API_KEY = "sk-your-key-here"
# $env:DEEPSEEK_BASE_URL = "http://127.0.0.1:8000/v1"
```

:::

Exécutez une tâche avec un espace de travail et des chemins d'accès explicites :

<div>
<a id="linux-and-macos-2"></a>

<a id="windows-powershell-2"></a>
</div>

:: Groupe de codes;

```sh [Linux/macOS]
python python/sdk/examples/minimal.py \
  --workspace /absolute/path/to/disposable-workspace \
  --dsh-home /absolute/path/to/example-dsh-home \
  --session-id example-001 \
  "Inspect the repository and fix the failing tests."
```

```powershell [Windows PowerShell]
python python/sdk/examples/minimal.py `
  --workspace C:\work\disposable-workspace `
  --dsh-home C:\work\example-dsh-home `
  --session-id example-001 `
  "Inspect the repository and fix the failing tests."
```

:::

Le script imprime la réponse finale de l'assistant ou le résultat de la commande fourni par le profil sélectionné. La maison sélectionnée reçoit le profil `sdk-minimal` généré, les plugins installés et les journaux de session JSONL non compressés sous `sessions/`. L'exemple et le SDK ne lisent jamais silencieusement `~/.dsh`.

<a id="use-the-sdk-in-your-program"></a>

## Utilisez le SDK dans votre programme

```python
from pathlib import Path

from deepseek_harness import DeepSeekHarness

workspace = Path("/absolute/path/to/disposable-workspace").resolve()
dsh_home = Path("/absolute/path/to/example-dsh-home").resolve()
with DeepSeekHarness(
    provider="deepseek-official",
    model="deepseek-v4-flash",
    max_tokens=49_152,
    cwd=str(workspace),
    dsh_home=str(dsh_home),
    profile="sdk-minimal",
) as harness:
    result = harness.run(
        "Inspect the repository and fix the failing tests.",
        session_id="example-001",
    )

print(result.final_response)
```

Le SDK démarre le processus `dsh --profile sdk-minimal` livré paresseusement et le réutilise jusqu'à la sortie de la gestion de contexte. Le profil, son patch persistant, le patch maison et tout tuple `patches` commandé forment la configuration de l'application. Il n'y a pas d'option séparée Python runtime bin ou complet-config.

<a id="install-or-define-plugins"></a>

## Installer ou définir des plugins

Utilisez `dsh plugin` pour les dépendances et les couches de paquets qui devraient persister dans cette maison:

<div>
<a id="linux-and-macos-3"></a>

<a id="windows-powershell-3"></a>
</div>

:: Groupe de codes;

```sh [Linux/macOS]
export DSH_HOME=/absolute/path/to/example-dsh-home
dsh --profile sdk-minimal --dump-default-config >/dev/null
dsh plugin --profile sdk-minimal add file:/absolute/path/to/my-plugin-bundle
```

```powershell [Windows PowerShell]
$env:DSH_HOME = "C:\work\example-dsh-home"
dsh --profile sdk-minimal --dump-default-config | Out-Null
dsh plugin --profile sdk-minimal add file:C:/work/my-plugin-bundle
```

:::

La première commande initialise le profil autonome expédié. La deuxième gestion des paquets est transmise à `pnpm`, puis enregistre tout paquet installé qui exporte une couche `dsh.bundle` . Installez `pnpm` uniquement pour cette commande de gestion; le lancement du SDK installé n'en a pas besoin. Modifier `$DSH_HOME/profiles/sdk-minimal/cordis.patch.yml` pour les changements de lignes persistants, ou passer des fichiers patchs de Python pour les changements par lancement.

Un autre `profile` est valide lorsqu'il inclut `@ocean/ocean-sdk-app` ou une autre ligne de serveur JSON-RPC. Les lignes manquantes du serveur, les plugins non résolus et les correctifs invalides échouent au cours du démarrage au lieu de revenir à une autre composition.

<a id="opt-in-to-str_replace_editor"></a>
### Optez pour `str_replace_editor`

L'exécution groupée comprend `str_replace_editor`, mais `sdk-minimal` l'opère à partir de l'arborescence Cordis par défaut. Pour l'utiliser, enregistrer cette configuration en ajoutant `editor.patch.yml`; `insert` à l'éditeur en utilisant le fournisseur de système de fichiers existant:

```yaml
- insert:
    - id: tool-str-replace-editor
      name: '@ocean/ocean-tool-str-replace-editor'
```

Passez `patches=("/absolute/path/to/editor.patch.yml",)` lors de la construction de `DeepSeekHarness(profile="sdk-minimal", ...)`, ou mettez le patch dans `$DSH_HOME/profiles/sdk-minimal/cordis.patch.yml` pour une configuration persistante. Lors du prochain lancement, les requêtes de modèle incluent `str_replace_editor` à côté des outils par défaut. Le fournisseur de système de fichiers local utilise le répertoire de travail d'exécution pour les chemins relatifs; comme le shell minimal, il ne limite pas l'accès à ce répertoire. Le même patch fonctionne avec le profil standard `sdk` .

<a id="enable-team-mode"></a>
### Activer le mode Équipe

Utiliser la norme `sdk` profil pour les équipes d'agents; `sdk-minimal` ne comprend pas les sous-agents ou les services d'équipe. [Patch de l'équipe](../../../apps/cli/config/examples/team-mode.yml) comme `team-mode.yml`:

```yaml
- id: agent-team
  config:
    defaultEnabled: true
```

Passer son chemin absolu dans l'option `patches` du SDK avec `profile="sdk"`. Python utilise `patches=("/absolute/path/to/team-mode.yml",)`; TypeScript utilise `patches: ["/absolute/path/to/team-mode.yml"]`. Le patch remplace la configuration entière de la ligne `agent-team` , donc inclure toute limite personnalisée de `maxTasks` dans la même cartographie.

Créez une nouvelle session racine et demandez-lui de créer et de lister une tâche partagée. Sa première demande de modèle comprend les outils de l'équipe et les conseils de collaboration. La racine sauve son mode, et les sous-agents le partagent. Reprise d'une Session existante préserve son mode, même s'il a été explicitement désactivé ou n'a jamais été activé; modifier ou supprimer ce patch ne remplace pas les sélections enregistrées. Voir la référence de service [Team](../../../packages/team/agent-team/README.md#use-this-package) pour le mode et la sémantique des tâches.

<a id="understand-the-minimal-profile"></a>

## Comprendre le profil minimal

| Biens | Valeur |
|---|---|
| Demande système | `DSH_SYSTEM_PROMPT`, en revenant à `You are a helpful software engineer assistant.` |
| Modèle dans `minimal.py` | `--model`, puis `DSH_MODEL`, puis `deepseek-v4-flash` |
| Outils de présentation de modèles | Résistants `bash` sur Linux/macOS ou `pwsh` sur Windows, `read_image`, et `working_directory` |
| Heure d'arrêt Shell | 300 secondes |
| Contexte d'exécution optionnel | Absent |
| Compaction de contexte | Automatique; résume l'historique antérieur grâce à une demande de modèle supplémentaire |
| La persistance de la session | JSONL non compressée sous `<dsh_home>/sessions` |

Le seul paquet du profile insère l'arborescence complète sur une racine vide et n'inclut pas `dsh-base`; les outils de profil de base plus tard ne peuvent donc pas apparaître implicitement. Il contient le protocole SDK, un adaptateur DeepSeek configuré en environnement, l'exécution locale et la persistance, tandis que les outils de fichiers texte, les paramètres, les identifiants gérés, la télémétrie OTel, les outils Web, les sous-agents et la découverte d'instruction locale sont absents. Le contributeur de session de [DeepSeek](../../../packages/session/session-log-deepseek/README.md) télécharge par défaut des événements de log non acceptés avec des requêtes DeepSeek, au plus `maxBytes` (8 MiB) par requête; définissez `session-log-deepseek.enabled: false` dans un patch de profil pour le désactiver. Il épingle `danger-full-access`, de sorte que la plate-forme sélectionnée shell persistante peut modifier n'importe quel chemin visible à l'exécution; utiliser une caisse ou un conteneur jetables.

La lecture de l'image nécessite un itinéraire compatible avec l'image. Le compactage automatique préserve le journal complet de la session; voir le [référence du paquet](../../../packages/bundle/sdk-minimal/README.md) pour le modèle et les effets de stockage. `sdk-minimal` composition, l'entrée slash non prise en charge reste un texte rapide ordinaire.

La roue installée emballe toujours le profil `web` complet et les actifs frontend. Exécutez `dsh web` contre un `DSH_HOME` explicite lorsqu'un déploiement Python SDK a également besoin de l'application du navigateur; `web` est une application CLI distincte et ne peut pas servir un client Python SDK.

Utilisez une nouvelle maison lorsque les profils, les plugins, les références, les paramètres et les sessions doivent être isolés. Utilisez une nouvelle id de session pour un travail indépendant; réutiliser un harnais, une maison et une id seulement pour continuer la même conversation durable et les ressources de session.

Les [référence du paquet](../../../packages/bundle/sdk-minimal/README.md) possède l'arbre exact, et le [exemple de référence](../../../python/sdk/examples/README.md) possède le programme exécutable. [Python référence SDK](../../../python/sdk/README.md) couvre le cycle de vie, les résultats, les notifications et les comportements de faible niveau; [dsh CLI référence](../../../apps/cli/reference/README.md) couvre la superposition du profil.
