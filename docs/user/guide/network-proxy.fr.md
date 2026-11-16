<a id="run-dsh-behind-a-network-proxy"></a>

# Exécuter DSH derrière un proxy réseau

<!-- USER_LANGUAGES_START -->
[English](network-proxy.md) | [中文](network-proxy.zh.md) | [Русский](network-proxy.ru.md) | [日本語](network-proxy.ja.md) | [Español](network-proxy.es.md) | Français | [Deutsch](network-proxy.de.md) | [Português](network-proxy.pt.md) | [한국어](network-proxy.ko.md)
<!-- USER_LANGUAGES_END -->

DSH achemine les requêtes sortantes de modèles, de recherche web, de récupération de pages et d’accès aux serveurs MCP sur HTTP via le proxy indiqué par les variables d’environnement standard. Il les lit au démarrage. Quelques connexions restent directes par conception ou en raison des limites de l’environnement d’exécution. Elles sont énumérées dans « Connexions qui restent directes ».

<a id="export-the-variables"></a>

## Exporter les variables

```sh
export HTTPS_PROXY=http://127.0.0.1:7890
export HTTP_PROXY=http://127.0.0.1:7890
```

Ajoutez les deux lignes au fichier de configuration de votre shell pour que chaque appel de `dsh` en hérite, ou placez-les dans `$DSH_HOME/.env` (`~/.ocean/.env` par défaut) à côté de votre clé API. Une variable exportée est toujours prioritaire sur ce fichier. Le fichier `.env` du projet ne peut pas les définir. Comme ce fichier est récupéré par `git clone`, DSH refuse de démarrer afin qu’un dépôt ne puisse pas choisir où transite votre trafic.

Si le proxy exige des identifiants, indiquez-les dans l’URL sous la forme `http://user:password@proxy.example:8080`. DSH n’affiche jamais cette URL dans ses diagnostics. Si une variable est rejetée, le diagnostic en indique seulement le nom, sans exposer les identifiants.

<a id="why-your-browser-is-proxied-but-your-terminal-is-not"></a>

## Pourquoi le navigateur utilise le proxy et le terminal y accède autrement

C’est la surprise la plus courante, et elle n’est pas spécifique à la DSH. Il n’y a pas de "proxy système" unique que tous les logiciels obéissent — il y a trois mécanismes indépendants:

| Mécanisme | Qui le suit |
|---|---|
| Les paramètres proxy du système d’exploitation | Safari, la plupart des applications macOS natives, Chrome et Edge |
| Les `HTTP_PROXY` / `HTTPS_PROXY` variables environnementales | `curl`, `git`, `npm`, `pip`, et DSH |
| Mode TUN (une interface réseau virtuelle) | Tout, de manière transparente |

Dans une application de proxy comme Clash, l’option « Proxy système » ne modifie que les paramètres du système d’exploitation. Les navigateurs en tiennent compte. Les outils en ligne de commande exigent que vous exportiez les variables séparément. Le mode TUN permet aux deux de fonctionner sans ces variables.

DSH ne lit pas les paramètres proxy du système d’exploitation. Exportez les variables ou utilisez le mode TUN.

<a id="choose-what-stays-direct"></a>

## Choisir ce qui reste direct

`NO_PROXY` liste les hôtes à atteindre directement:

```sh
export NO_PROXY=internal.example.com,.corp.example.com,registry.local
```

Une entrée correspond à un hôte et à tous ses sous-domaines. Ainsi, `NO_PROXY=example.com` rend aussi l’accès à `api.example.com` direct. Un préfixe `.` ou `*.` est accepté et a le même effet. Une entrée peut se terminer par `:port`. L’entrée `*` contourne le proxy pour tous les hôtes.

**Les plages CIDR ne fonctionnent pas.** Une liste de contournement du système d'exploitation contient souvent des entrées comme `10.0.0.0/8` ou `192.168.0.0/16`; copier celles-ci dans `NO_PROXY` n'a pas d'effet. Utilisez plutôt des noms d'hôte ou des suffixes de domaine.

Inutile d’ajouter `localhost` ou `127.0.0.1`. DSH accède toujours directement aux adresses de bouclage pour éviter une boucle passant par le proxy avec sa propre interface web ou un serveur local.

<a id="limits-worth-knowing"></a>

## Limites à connaître

**Les proxys SOCKS ne sont pas pris en charge.** Une valeur `socks5://` est signalée au démarrage et ignorée. DSH se connecte alors directement pour le protocole concerné. Si vous définissez `HTTPS_PROXY=socks5://…` avec un `HTTP_PROXY` valide, `https:` passe toujours en direct. Configurez les variables avec le port HTTP de votre application de proxy. La plupart de ces applications proposent les deux types de proxy, généralement sur des ports voisins.

**`ALL_PROXY` suffit.** DSH utilise cette valeur par défaut pour les deux protocoles, même si Node et curl diffèrent sur ce point. Définir `HTTPS_PROXY` explicitement rend le réglage plus clair.

**Un proxy d’entreprise qui intercepte TLS exige son certificat.** Si le proxy est joignable et que les requêtes échouent avec une erreur de certificat, indiquez à Node le fichier d’autorités de certification de votre organisation avant de lancer DSH.

```sh
export NODE_EXTRA_CA_CERTS=/path/to/corporate-ca.pem
```

Node lit cette variable seulement au démarrage du processus, donc exportez-la avant de lancer `dsh`.

**Les outils lancés par DSH utilisent le même proxy.** Les commandes de l’outil bash, `git`, `gh` et les serveurs MCP lancés en tant que processus enfants héritent de ces variables. Un programme Node lancé en tant que processus enfant utilise la version de Node installée pour lui. Node 22.21+ et Node 24+ tiennent compte de ces variables. Une version plus ancienne se connecte directement. Si DSH rejette une valeur de proxy, par exemple une URL SOCKS, les outils basés sur Node démarrent et se connectent directement. `curl` et `git` lisent toujours cette valeur.

**Ces outils reçoivent aussi le mot de passe inclus dans l’URL du proxy.** `HTTPS_PROXY=http://alice:s3cret@proxy.example:8080` est une variable d’environnement ordinaire. Chaque commande exécutée par DSH peut la lire, y compris celles que le modèle écrit. Une commande qui affiche son environnement écrit le mot de passe dans la sortie conservée. Cette variable se comporte exactement comme dans le reste de votre shell. Si nécessaire, fournissez un point d’accès au proxy sans identifiants ou utilisez une méthode d’authentification qui ne les inclut pas dans l’URL.

<a id="what-stays-direct"></a>

## Connexions qui restent directes

Certaines requêtes de DSH contournent le proxy.

- **Tout sur cette machine.** Loopback est toujours direct: `localhost`, l'ensemble de la gamme `127.0.0.0/8` , `::1`, et `0.0.0.0`. Un proxy ne peut pas facilement atteindre un service qui écoute seulement localement.
- **Code écrit par le modèle.** Les workers de workflow et les processus Node de ptc-runtime ne reçoivent aucun paramètre de proxy. Les scripts écrits par le modèle ne peuvent donc pas lire une URL de proxy susceptible de contenir un mot de passe. Si ces requêtes ont besoin d’un proxy, le script doit le configurer. L’environnement d’exécution isolé continue de s’appliquer.
- **Télémétrie d’utilisation.** L’exportateur OTLP utilise le client HTTP propre à Node. Il se connecte directement et échoue si les connexions sortantes directes sont bloquées. Ces échecs n’affectent pas l’utilisation de DSH. Définissez `DSH_TELEMETRY_MODE=DISABLED` pour désactiver entièrement la télémétrie.
- **`web_fetch` vers une adresse IP privée explicite.** L’outil refuse toute URL qui contient directement une adresse privée, telle que `http://10.0.0.5/`, sans la transmettre au proxy. Le refus est identique en l’absence de proxy.

<a id="check-that-it-worked"></a>

## Vérifier le fonctionnement du proxy

Demandez à l’agent de récupérer une page, puis consultez le journal des connexions de votre application de proxy.

```sh
dsh --profile headless "fetch https://example.com and tell me the page title"
```

Si la requête n’y figure pas, vérifiez que les variables sont présentes dans l’environnement de DSH.

```sh
env | grep -i proxy
```
