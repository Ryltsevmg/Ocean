<a id="get-started-with-the-python-sdk"></a>

# Prendre en main le SDK Python

<!-- USER_LANGUAGES_START -->
[English](python-sdk.md) | [中文](python-sdk.zh.md) | [Русский](python-sdk.ru.md) | [日本語](python-sdk.ja.md) | [Español](python-sdk.es.md) | Français | [Deutsch](python-sdk.de.md) | [Português](python-sdk.pt.md) | [한국어](python-sdk.ko.md)
<!-- USER_LANGUAGES_END -->

Ce tutoriel explique comment compiler le SDK Python à partir du code source de ce dépôt, exécuter le profil minimal autonome fourni et personnaliser ce même profil `dsh` dans votre propre programme. Ocean ne propose pas encore de distribution publique validée du SDK sur npm ou PyPI.

<a id="prerequisites"></a>

## Prérequis

- Python 3.10 ou plus récent
- Git
- Linux x64, Linux arm64, macOS 14 ou plus récent sur arm64, ou Windows x64
- Un point de terminaison d’API compatible avec DeepSeek et des identifiants
- Un espace de travail isolé et un répertoire de données Ocean isolé

<a id="build-the-sdk-from-source"></a>

## Compiler le SDK à partir du code source

<div>
<a id="linux-and-macos"></a>

<a id="windows-powershell"></a>
</div>

Aucun registre public ne distribue de SDK Ocean validé. Installer `deepseek-harness-sdk` depuis PyPI récupère le paquet du projet d’origine. Compilez l’exécutable et les deux paquets wheel dans cette copie du dépôt, puis installez-les dans un environnement virtuel.

::: code-group

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

## Exécuter l’exemple fourni dans le dépôt

Exportez les identifiants et, si nécessaire, indiquez un point de terminaison de proxy compatible.

<div>
<a id="linux-and-macos-1"></a>

<a id="windows-powershell-1"></a>
</div>

::: code-group

```sh [Linux/macOS]
export DEEPSEEK_API_KEY=sk-your-key-here
# export DEEPSEEK_BASE_URL=http://127.0.0.1:8000/v1
```

```powershell [Windows PowerShell]
$env:DEEPSEEK_API_KEY = "sk-your-key-here"
# $env:DEEPSEEK_BASE_URL = "http://127.0.0.1:8000/v1"
```

:::

Exécutez une tâche en indiquant explicitement les chemins de l’espace de travail et du répertoire de données.

<div>
<a id="linux-and-macos-2"></a>

<a id="windows-powershell-2"></a>
</div>

::: code-group

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

Le script affiche la réponse finale de l’assistant ou le résultat de la commande fourni par le profil sélectionné. Le répertoire de données choisi contient le profil généré `sdk-minimal`, les extensions installées et les journaux de session JSONL non compressés dans `sessions/`. L’exemple et le SDK ne lisent jamais `~/.dsh` de manière implicite.

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

Le SDK lance le processus fourni `dsh --profile sdk-minimal` à la première utilisation et le réutilise jusqu’à la sortie du gestionnaire de contexte. Le profil, sa surcouche persistante, la surcouche du répertoire de données et le tuple ordonné `patches` forment la configuration de l’application. Il n’existe ni exécutable d’environnement Python distinct ni option pour fournir une configuration complète.

<a id="install-or-define-plugins"></a>

## Installer ou définir des plugins

Utilisez `dsh plugin` pour les dépendances et les couches de paquets qui devraient persister dans cette maison:

<div>
<a id="linux-and-macos-3"></a>

<a id="windows-powershell-3"></a>
</div>

::: code-group

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

La première commande initialise le profil autonome fourni. La deuxième délègue la gestion des paquets à `pnpm`, puis enregistre chaque paquet installé qui exporte une couche `dsh.bundle`. Installez `pnpm` uniquement pour cette commande de gestion. Le SDK installé peut démarrer sans lui. Modifiez `$DSH_HOME/profiles/sdk-minimal/cordis.patch.yml` pour changer durablement des entrées, ou passez des fichiers de surcouche depuis Python pour les modifier au cas par cas.

Un autre `profile` est valide lorsqu'il inclut `@ocean/ocean-sdk-app` ou une autre ligne de serveur JSON-RPC. Les lignes manquantes du serveur, les plugins non résolus et les correctifs invalides échouent au cours du démarrage au lieu de revenir à une autre composition.

<a id="opt-in-to-str_replace_editor"></a>
### Optez pour `str_replace_editor`

L’environnement d’exécution fourni contient `str_replace_editor`, que `sdk-minimal` exclut de son arborescence Cordis par défaut. Pour utiliser cet outil, enregistrez cette configuration dans `editor.patch.yml`. `insert` ajoute l’éditeur en utilisant le fournisseur de système de fichiers existant.

```yaml
- insert:
    - id: tool-str-replace-editor
      name: '@ocean/ocean-tool-str-replace-editor'
```

Passez `patches=("/absolute/path/to/editor.patch.yml",)` lors de la construction de `DeepSeekHarness(profile="sdk-minimal", ...)`, ou mettez le patch dans `$DSH_HOME/profiles/sdk-minimal/cordis.patch.yml` pour une configuration persistante. Lors du prochain lancement, les requêtes de modèle incluent `str_replace_editor` à côté des outils par défaut. Le fournisseur de système de fichiers local utilise le répertoire de travail d'exécution pour les chemins relatifs; comme le shell minimal, il ne limite pas l'accès à ce répertoire. Le même patch fonctionne avec le profil standard `sdk` .

<a id="enable-team-mode"></a>
### Activer le mode Équipe

Utilisez le profil standard `sdk` pour les équipes d’agents. `sdk-minimal` ne comprend ni sous-agents ni services d’équipe. Enregistrez le [patch du mode équipe](../../../apps/cli/config/examples/team-mode.yml) sous `team-mode.yml`.

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
| Heure d’arrêt Shell | 300 secondes |
| Contexte d’exécution optionnel | Absent |
| Compaction de contexte | Automatique; résume l’historique antérieur grâce à une demande de modèle supplémentaire |
| La persistance de la session | JSONL non compressée sous `<dsh_home>/sessions` |

L’unique bundle du profil insère l’arborescence Cordis complète à partir d’une racine vide. Il n’inclut pas `dsh-base`. Les outils du profil de base ne peuvent donc pas apparaître implicitement par la suite. Il fournit le protocole SDK, un adaptateur DeepSeek configuré par l’environnement, l’exécution locale et la persistance. Il omet les outils de fichiers texte, les paramètres, les identifiants gérés, la télémétrie OTel, les outils web, les sous-agents et la détection des instructions locales. Par défaut, l’[extension DeepSeek de journal de session](../../../packages/session/session-log-deepseek/README.md) joint aux requêtes DeepSeek les événements de journal encore non confirmés, à hauteur de `maxBytes` (8 Mio) par requête. Pour désactiver cette fonction, définissez `session-log-deepseek.enabled: false` dans un patch de profil. Le profil fixe `danger-full-access`. Le shell persistant choisi par la plateforme peut donc modifier tous les chemins visibles par le processus. Utilisez une copie de travail ou un conteneur jetable.

La lecture de l'image nécessite un itinéraire compatible avec l'image. Le compactage automatique préserve le journal complet de la session; voir le [référence du paquet](../../../packages/bundle/sdk-minimal/README.md) pour le modèle et les effets de stockage. `sdk-minimal` composition, l'entrée slash non prise en charge reste un texte rapide ordinaire.

La roue installée emballe toujours le profil `web` complet et les actifs frontend. Exécutez `dsh web` contre un `DSH_HOME` explicite lorsqu'un déploiement Python SDK a également besoin de l'application du navigateur; `web` est une application CLI distincte et ne peut pas servir un client Python SDK.

Utilisez un nouveau répertoire de données pour isoler les profils, extensions, identifiants, paramètres et sessions. Utilisez un nouvel identifiant de session pour un travail indépendant. Réutilisez la même instance du SDK, le même répertoire de données et le même identifiant uniquement pour poursuivre la même conversation persistante et retrouver les ressources de sa session.

Les [référence du paquet](../../../packages/bundle/sdk-minimal/README.md) possède l'arbre exact, et le [exemple de référence](../../../python/sdk/examples/README.md) possède le programme exécutable. [Python référence SDK](../../../python/sdk/README.md) couvre le cycle de vie, les résultats, les notifications et les comportements de faible niveau; [dsh CLI référence](../../../apps/cli/reference/README.md) couvre la superposition du profil.
