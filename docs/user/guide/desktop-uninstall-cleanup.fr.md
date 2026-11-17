<a id="uninstall-ocean-desktop"></a>

# Désinstaller Ocean Desktop

<!-- USER_LANGUAGES_START -->
[English](desktop-uninstall-cleanup.md) | [中文](desktop-uninstall-cleanup.zh.md) | [Русский](desktop-uninstall-cleanup.ru.md) | [日本語](desktop-uninstall-cleanup.ja.md) | [Español](desktop-uninstall-cleanup.es.md) | Français | [Deutsch](desktop-uninstall-cleanup.de.md) | [Português](desktop-uninstall-cleanup.pt.md) | [한국어](desktop-uninstall-cleanup.ko.md)
<!-- USER_LANGUAGES_END -->

Utilisez ce guide pour désinstaller Ocean Desktop sur macOS, Windows ou Linux. Le nettoyage des données locales est facultatif.

<a id="1-uninstall-the-app"></a>

## 1. Désinstaller l’application

Attendez la fin des commandes en cours qui utilisent l’outil en ligne de commande fourni avec Ocean Desktop. Si vous avez installé la commande `ocean` depuis l’application, sélectionnez d’abord **Gérer la commande ocean… → Supprimer** dans son menu. Cette opération supprime l’enregistrement de la commande d’Ocean Desktop sans désinstaller les outils en ligne de commande indépendants.

Quittez Ocean, puis désinstallez-le en utilisant la procédure de votre plateforme:

- **macOS :** Supprimez l’application du dossier Applications dans le Finder.
- **Windows :** Désinstallez-la via Paramètres → Applications → Applications installées sous Windows 11, ou Panneau de configuration → Programmes → Programmes et fonctionnalités.
- **Linux :** Supprimez l’installation en utilisant la méthode qui l’a installée ; pour un répertoire extrait, supprimez ce répertoire d’installation après avoir quitté l’application.

<a id="2-inspect-local-data-before-cleanup"></a>

## 2. Inspecter les données locales avant le nettoyage

Supprimer les données locales peut supprimer définitivement les sessions, les identifiants, les paramètres, les plugins, les caches et l’état CLI partagé. Sauvegardez tout ce que vous voulez conserver. Ne supprimez pas un répertoire uniquement parce que son nom ressemble à Ocean ou OCEAN.

Le répertoire de données par défaut d’Ocean est actuellement `~/.ocean`, ou `.ocean` dans le profil utilisateur Windows. `OCEAN_HOME` permet de choisir un autre emplacement. Vérifiez la valeur utilisée pour lancer Ocean Desktop, qui peut différer de celle du terminal actuel. Les commandes ci-dessous affichent seulement les emplacements possibles et ne suppriment rien. Elles ne détectent ni le répertoire `userData` réellement utilisé par Electron ni tous les caches propres à l’installation.

::: code-group

```sh [macOS]
: "${HOME:?HOME must be set}"
printf '%s\n' \
  "Ocean home candidate: ${OCEAN_HOME:-$HOME/.ocean}" \
  "Updater cache candidate: $HOME/Library/Caches/@oceanocean-desktop-updater"
# Previous-release ~/.ocean and donor-era appId caches require separate ownership checks.
```

```powershell [Windows]
$ErrorActionPreference = 'Stop'
if (-not $env:USERPROFILE -or -not $env:LOCALAPPDATA) {
    throw 'USERPROFILE and LOCALAPPDATA must be set.'
}
$oceanHome = if ($env:OCEAN_HOME) { $env:OCEAN_HOME } else { Join-Path $env:USERPROFILE '.ocean' }
"Ocean home candidate: $oceanHome"
"Updater cache candidate: $(Join-Path $env:LOCALAPPDATA '@oceanocean-desktop-updater')"
# Previous-release .ocean and @deepseek-ai data are NOT removed.
# Inspect them separately; delete only data you recognize and no longer need.
```

```sh [Linux]
: "${HOME:?HOME must be set}"
printf '%s\n' \
  "Ocean home candidate: ${OCEAN_HOME:-$HOME/.ocean}" \
  "Updater cache candidate: ${XDG_CACHE_HOME:-$HOME/.cache}/@oceanocean-desktop-updater"
# Previous-release ~/.ocean requires a separate ownership check.
```

:::

Le nom du cache de mise à jour est dérivé du nom du paquet Desktop. Les emplacements proposés correspondent au paquet actuel `@ocean/ocean-desktop`. Une autre version compilée peut utiliser des emplacements différents. Sous Windows, le [programme de désinstallation](../../../apps/desktop/installer/uninstall.nsh) vérifie les répertoires de données d’application nommés d’après le produit et le paquet ainsi que le cache de mise à jour, mais conserve le répertoire de données d’Ocean. Les mises à jour et les réinstallations avec conservation des données peuvent également laisser des données d’application en place.

Repérez les vrais répertoires de données et de journaux Electron de votre installation avant de les supprimer. La [référence de diagnostic](../../../apps/desktop/docs/diagnostics/README.md#report-contents) indique où trouver les journaux. Les noms des fichiers de préférences macOS, de ShipIt, du stockage HTTP et des caches système dépendent de l’identifiant du paquet installé. La création d’un paquet exige de définir explicitement `OCEAN_DESKTOP_APP_ID`. `com.deepseek.ocean` n’est pas un identifiant Ocean universel. N’employez pas de caractère générique pour supprimer des fichiers portant cet identifiant sans avoir vérifié vous-même qu’ils proviennent de votre ancienne installation.

`~/.ocean` était le répertoire par défaut d’une version antérieure. Ne supprimez ce répertoire, les anciennes données d’application `@deepseek-ai` ou les caches associés aux identifiants du projet d’origine que si vous reconnaissez ces fichiers et qu’aucune autre installation n’en a besoin. Vérifiez séparément les répertoires de développement et de test.

<a id="3-remove-verified-data-and-check"></a>

## 3. Supprimer les données vérifiées et vérifier

Après avoir vérifié chaque chemin exact et déterminé à quelle installation il appartient, utilisez votre gestionnaire de fichiers pour supprimer uniquement les répertoires choisis. Laissez en place les chemins que vous ne reconnaissez pas. Vérifiez que les chemins choisis n’existent plus avant de réinstaller l’application. Si la suppression échoue, examinez les fichiers restants et résolvez l’erreur sans élargir le périmètre de suppression.
