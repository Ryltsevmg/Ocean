<a id="uninstall-ocean-desktop"></a>

# Désinstaller Ocean Desktop

<!-- USER_LANGUAGES_START -->
[English](desktop-uninstall-cleanup.md) | [中文](desktop-uninstall-cleanup.zh.md) | [Русский](desktop-uninstall-cleanup.ru.md) | [日本語](desktop-uninstall-cleanup.ja.md) | [Español](desktop-uninstall-cleanup.es.md) | Français | [Deutsch](desktop-uninstall-cleanup.de.md) | [Português](desktop-uninstall-cleanup.pt.md) | [한국어](desktop-uninstall-cleanup.ko.md)
<!-- USER_LANGUAGES_END -->

Utilisez ce guide pour désinstaller Ocean Desktop sur macOS, Windows ou Linux. Le nettoyage des données locales est facultatif.

<a id="1-uninstall-the-app"></a>

## 1. Désinstaller l'application

Terminer toutes les commandes en utilisant le CLI livré par Desktop. Si vous avez installé la commande `dsh` à travers Desktop, sélectionnez d'abord **Gérer la commande dsh... → Supprimer** dans le menu de l'application. Cela supprime l'enregistrement de commande de Desktop sans désinstaller des programmes CLI indépendants.

Quittez Ocean, puis désinstallez-le en utilisant la procédure de votre plateforme:

- **macOS:** Supprimer l'application des Applications dans Finder.
- **Windows:** Désinstallez-le via Paramètres → Applications → Installez des applications sur Windows 11, ou Panneau de configuration → Programmes → Programmes et fonctionnalités.
- **Linux :** Supprimez l'installation en utilisant la méthode qui l'a installée ; pour un répertoire extrait, supprimez ce répertoire d'installation après avoir quitté l'application.

<a id="2-inspect-local-data-before-cleanup"></a>

## 2. Inspecter les données locales avant le nettoyage

Supprimer les données locales peut supprimer définitivement les sessions, les identifiants, les paramètres, les plugins, les caches et l'état CLI partagé. Sauvegardez tout ce que vous voulez conserver. Ne supprimez pas un répertoire uniquement parce que son nom ressemble à Ocean ou DSH.

La maison Ocean par défaut actuelle est `~/.ocean`, ou `.ocean` sous le profil utilisateur de Windows. `DSH_HOME` peut sélectionner un autre emplacement; inspecter le réglage utilisé pour lancer Desktop, qui peut différer du terminal actuel. Les commandes ci-dessous n'impriment que les emplacements des candidats et ne suppriment rien. Ils ne découvrent pas le répertoire `userData` d'Electron ni tous les caches spécifiques à l'installation.

:: Groupe de codes;

```sh [macOS]
: "${HOME:?HOME must be set}"
printf '%s\n' \
  "Ocean home candidate: ${DSH_HOME:-$HOME/.ocean}" \
  "Updater cache candidate: $HOME/Library/Caches/@oceanocean-desktop-updater"
# Previous-release ~/.dsh and donor-era appId caches require separate ownership checks.
```

```powershell [Windows]
$ErrorActionPreference = 'Stop'
if (-not $env:USERPROFILE -or -not $env:LOCALAPPDATA) {
    throw 'USERPROFILE and LOCALAPPDATA must be set.'
}
$oceanHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.ocean' }
"Ocean home candidate: $oceanHome"
"Updater cache candidate: $(Join-Path $env:LOCALAPPDATA '@oceanocean-desktop-updater')"
# Previous-release .dsh and @deepseek-ai data are NOT removed.
# Inspect them separately; delete only data you recognize and no longer need.
```

```sh [Linux]
: "${HOME:?HOME must be set}"
printf '%s\n' \
  "Ocean home candidate: ${DSH_HOME:-$HOME/.ocean}" \
  "Updater cache candidate: ${XDG_CACHE_HOME:-$HOME/.cache}/@oceanocean-desktop-updater"
# Previous-release ~/.dsh requires a separate ownership check.
```

:::

Le nom de cache de la mise à jour est dérivé du nom du paquet Desktop, et non du titre du produit. `@ocean/ocean-desktop` paquet; une autre construction peut différer. [désinstaller](../../../apps/desktop/installer/uninstall.nsh) vérifie les répertoires de données d'applications nom de produit et nom de paquet et le cache de mise à jour, mais conserve la maison Ocean; les mises à jour et les données conservées peuvent également préserver les données d'application.

Trouver les données Electron et les répertoires de log pour votre installation avant de les supprimer; le [Référence du diagnostic](../../../apps/desktop/docs/diagnostics/README.md#report-contents) décrit les emplacements de log. préférence macOS, ShipIt, stockage HTTP, et noms de cache système dépendent de l'identificateur de paquet installé. `DSH_DESKTOP_APP_ID`; `com.deepseek.dsh` n'est pas un identificateur universel Ocean. Ne lancez pas un nettoyage de wildcard pour cet identificateur à moins que vous n'ayez identifié ces fichiers de manière indépendante comme des restes de votre installation précédente.

`~/.dsh` était un défaut précédent, pas le défaut actuel. Supprimez-le, les données précédentes de l'application `@deepseek-ai` , ou les caches d'identificateurs de l'ère donneur seulement si vous reconnaissez ces restes et qu'aucune autre installation n'en a besoin. Les répertoires de développement et de test nécessitent leurs propres vérifications.

<a id="3-remove-verified-data-and-check"></a>

## 3. Supprimer les données vérifiées et vérifier

Après avoir confirmé chaque chemin exact et sa propriété, supprimez seulement les répertoires que vous avez choisis en utilisant votre gestionnaire de fichiers. Laissez intacts les sentiers non reconnus. Confirmez que les chemins choisis n'existent plus avant de les réinstaller. Si la suppression signale une erreur, inspecter les fichiers restants et résoudre l'erreur plutôt que d'élargir la cible de suppression.
