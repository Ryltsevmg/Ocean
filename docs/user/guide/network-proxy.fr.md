<a id="run-dsh-behind-a-network-proxy"></a>

# Exécutez DSH derrière un proxy réseau

<!-- USER_LANGUAGES_START -->
[English](network-proxy.md) | [中文](network-proxy.zh.md) | [Русский](network-proxy.ru.md) | [日本語](network-proxy.ja.md) | [Español](network-proxy.es.md) | Français | [Deutsch](network-proxy.de.md) | [Português](network-proxy.pt.md) | [한국어](network-proxy.ko.md)
<!-- USER_LANGUAGES_END -->

DSH canalise ses requêtes sortantes — appels de modèles, recherche web, recherche de pages et serveurs MCP sur HTTP — par le biais du proxy nommé par les variables d'environnement proxy standard. Il les lit au lancement; rien d'autre n'a besoin d'être configuré. Quelques chemins restent directs par conception ou par limite d'exécution, listés dans "Ce qui reste direct" ci-dessous.

<a id="export-the-variables"></a>

## Exporter les variables

```sh
export HTTPS_PROXY=http://127.0.0.1:7890
export HTTP_PROXY=http://127.0.0.1:7890
```

Mettez les deux lignes dans votre profil shell afin que chaque invocation `dsh` les hérite, ou dans `$DSH_HOME/.env` (`~/.dsh/.env` par défaut) à côté de votre clé API; une variable exportée gagne toujours sur ce fichier. `.env` ne peut pas les définir : il arrive avec `git clone`, et DSH refuse de démarrer plutôt que de laisser un dépôt décider où va votre trafic.

Un proxy qui a besoin d'identifications les prend dans l'URL : `http://user:password@proxy.example:8080`. DSH n'imprime jamais l'URL en arrière : un diagnostic nomme la variable qu'il a rejetée, de sorte que ni le nom d'utilisateur ni le mot de passe n'apparaissent nulle part.

<a id="why-your-browser-is-proxied-but-your-terminal-is-not"></a>

## Pourquoi votre navigateur est proxié mais votre terminal n'est pas

C'est la surprise la plus courante, et elle n'est pas spécifique à la DSH. Il n'y a pas de "proxy système" unique que tous les logiciels obéissent — il y a trois mécanismes indépendants:

| Mécanisme | Qui le suit |
|---|---|
| Les paramètres proxy du système d'exploitation | Safari, la plupart des applications macOS natives, Chrome et Edge |
| Les `HTTP_PROXY` / `HTTPS_PROXY` variables environnementales | `curl`, `git`, `npm`, `pip`, et DSH |
| Mode TUN (une interface réseau virtuelle) | Tout, de manière transparente |

Le commutateur « proxy système » dans une application proxy telle que Clash n'écrit que la première. Les navigateurs le récupèrent; les outils en ligne de commande ne le voient jamais. C'est pourquoi l'exportation des variables est une étape séparée, et pourquoi activer le mode TUN rend les deux fonctionnent sans aucune variable du tout.

DSH ne lit pas les paramètres proxy du système d'exploitation. Exportez les variables ou utilisez le mode TUN.

<a id="choose-what-stays-direct"></a>

## Choisir ce qui reste direct

`NO_PROXY` liste les hôtes à atteindre directement:

```sh
export NO_PROXY=internal.example.com,.corp.example.com,registry.local
```

Une entrée nomme un hôte et l'associe à chaque sous-domaine sous-jacent : `NO_PROXY=example.com` envoie également `api.example.com` directement. Une `.` ou `*.` leader est acceptée et signifie la même chose. Une entrée peut porter un `:port`, et `*` contourne tout.

**Les plages CIDR ne fonctionnent pas.** Une liste de contournement du système d'exploitation contient souvent des entrées comme `10.0.0.0/8` ou `192.168.0.0/16`; copier celles-ci dans `NO_PROXY` n'a pas d'effet. Utilisez plutôt des noms d'hôte ou des suffixes de domaine.

Vous n'avez pas besoin de lister `localhost` ou `127.0.0.1`. DSH contourne toujours le loopback, car son propre interface utilisateur Web et les serveurs locaux seraient autrement acheminés par le proxy et la boucle.

<a id="limits-worth-knowing"></a>

## Limites à connaître

**Les proxys SOCKS ne sont pas pris en charge. La valeur** A `socks5://` est enregistrée au démarrage et ignorée, et DSH se connecte directement pour le schéma qui l'a nommée — définir `HTTPS_PROXY=socks5://…` aux côtés d'un `HTTP_PROXY` utilisable laisse `https:` directement au lieu d'emprunter le proxy HTTP. Pointez plutôt les variables sur le port HTTP de votre application proxy — la plupart exposent les deux, et le HTTP est généralement un numéro de port voisin.

**`ALL_PROXY` seul suffit.** La DSH y revient pour les deux schémas, même si le nœud et la boucle diffèrent sur ce point. `HTTPS_PROXY` explicitement est encore plus clair.

**Un proxy d'entreprise qui intercepte TLS a besoin de son certificat.** Si les demandes échouent avec une erreur de certificat une fois le proxy accessible, point Noeud dans le paquet CA de votre organisation avant de lancer:

```sh
export NODE_EXTRA_CA_CERTS=/path/to/corporate-ca.pem
```

Node lit cette variable seulement au démarrage du processus, donc exportez-la avant de lancer `dsh`.

**Outils DSH fonctionne pour vous suivez le même proxy. Les commandes** dans l'outil bash, `git`, `gh`et les serveurs MCP ont démarré lorsque les enfants traitent toutes ces variables. Un programme enfant Node utilise son propre runtime installé: Node 22.21+ et Node 24+ honorent ces variables; un runtime plus ancien se connecte directement. Si l'une de vos variables proxy détient une valeur DSH rejetée — une URL SOCKS, disons —, les outils basés sur les nœuds se connectent aussi directement au lieu de ne pas démarrer, alors que `curl` et `git` lisent encore cette valeur.

**Un mot de passe dans l'URL proxy atteint également ces outils.** `HTTPS_PROXY=http://alice:s3cret@proxy.example:8080` est une variable d'environnement normale, de sorte que chaque commande DSH fonctionne — y compris celles que le modèle écrit — peut la lire, et une commande qui imprime son environnement met le mot de passe dans la sortie qui est conservée. C'est ainsi que la variable se comporte déjà pour tout le reste dans votre shell. Si cela est important, donnez au proxy un point d'entrée sans titre, ou authentifiez-le autrement que dans l'URL.

<a id="what-stays-direct"></a>

## Ce qui reste direct

Toutes les requêtes faites par DSH passent par le proxy :

- **Tout sur cette machine.** Loopback est toujours direct: `localhost`, l'ensemble de la gamme `127.0.0.0/8` , `::1`, et `0.0.0.0`. Un proxy ne peut pas facilement atteindre un service qui écoute seulement localement.
- **Coder le modèle écrit.** Les workflow work workers et les processus ptc-runtime de Node ne reçoivent pas de paramètres de proxy, de sorte que les scripts d'auteurs de modèles ne peuvent pas lire une URL proxy qui peut porter un mot de passe. Les requêtes directes doivent configurer elles-mêmes tout proxy requis et rester soumises à l'exécution sandbox.
- **Télémétrie d'utilisation.** L'exportateur OTLP utilise le propre client HTTP de Node plutôt que celui qu'un proxy configure, donc la télémétrie se connecte directement et échoue simplement là où l'évacuation directe est bloquée. Rien de ce que tu fais en DSH ne dépend de ça. Réglez `DSH_TELEMETRY_MODE=DISABLED` pour l'éteindre complètement.
- **`web_fetch` à une adresse privée littérale.** Une URL nommant une adresse comme `http://10.0.0.5/` est refusé plutôt que remis au proxy, le même refus qu'il obtient avec aucun proxy configuré.

<a id="check-that-it-worked"></a>

## Vérifiez que ça a marché.

Demandez à l'agent de récupérer une page et de regarder le journal de connexion de votre application mandataire :

```sh
dsh --profile headless "fetch https://example.com and tell me the page title"
```

Si la demande n'apparaît pas, confirmez que les variables survivent dans le propre environnement de DSH :

```sh
env | grep -i proxy
```
