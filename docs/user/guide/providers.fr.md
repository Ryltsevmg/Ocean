<a id="configure-models"></a>

# Configurer les modèles

<!-- USER_LANGUAGES_START -->
[English](providers.md) | [中文](providers.zh.md) | [Русский](providers.ru.md) | [日本語](providers.ja.md) | [Español](providers.es.md) | Français | [Deutsch](providers.de.md) | [Português](providers.pt.md) | [한국어](providers.ko.md)
<!-- USER_LANGUAGES_END -->

Ce guide suppose que vous avez lancé l’interface web en suivant le [guide de développement](../../development.md). Les changements de modèle prennent effet dès la requête suivante, sans redémarrer le serveur.

<a id="configure-deepseek"></a>

## Configurer DeepSeek

Ouvrez **Paramètres → Modèles**. La carte DeepSeek comporte un seul champ pour la clé API. Saisissez la clé et enregistrez-la.

![The Models page: the DeepSeek card, with Add model provider below it](providers-models-page.png)

Les clés sont accessibles uniquement en écriture. Après l’enregistrement, la page reçoit un descripteur expurgé. La valeur du secret ne lui est jamais transmise. La clé est stockée dans `$OCEAN_HOME/.credentials.yaml` et les paramètres n’en conservent que la référence.

Si une clé est enregistrée et que le point de terminaison par défaut est utilisé, les modèles de DeepSeek suivent la liste publiée par son API. OCEAN charge la liste lorsque les modèles sont nécessaires pour la première fois, puis l’actualise en arrière-plan environ toutes les dix minutes pendant leur utilisation. Si le chargement échoue, OCEAN utilise les modèles intégrés. Modifier **Modèles** dans **Paramètres personnalisés** conserve votre propre liste et arrête le suivi de la liste publiée. **Restaurer les valeurs par défaut** réactive ce suivi et recharge la liste. Tant que la liste publiée est utilisée, la carte affiche les modèles intégrés. Un modèle nouvellement publié apparaît seulement dans le sélecteur. La [référence du fournisseur DeepSeek par clé API](../../../packages/llm/llm-deepseek-api-key/README.md) décrit les règles de sélection, de repli et d’accès.

<a id="add-a-third-party-provider"></a>

## Ajouter un fournisseur tiers

Choisir **Ajouter le fournisseur de modèle**. La carte s'ouvre sur **Fournisseur de modèles tiers**: choisissez un fournisseur avec ocean — la liste affiche les ids du fournisseur tels que `anthropic`, `openai`, `moonshotai` pour Kimi, ou `zai` pour GLM — entrez sa clé API et enregistrez. Le catalogue installé fournit la liste des paramètres, des protocoles et des modèles.

Le **?** de la section d’authentification explique la priorité des identifiants enregistrés et le recours aux variables d’environnement. Laissez le champ vide pour utiliser une clé enregistrée ou essayer les variables indiquées. Un message vert signale qu’une variable a été détectée. Un message jaune indique qu’aucune variable d’identification n’a été détectée. Dans ce cas, saisissez une clé API ou configurez la variable indiquée. Un état non confirmé signifie que sa lecture a échoué. La détection ne vérifie ni la validité des identifiants ni la connexion. Elle ne couvre pas les fichiers d’identifiants gérés par les fournisseurs, comme les profils AWS ou les identifiants par défaut de Google pour les applications. Les fournisseurs sans authentification native par clé, comme `openai-codex`, n’affichent pas de champ de clé, sauf si le profil indique explicitement une référence d’identification.

Une clé enregistrée apparaît sous forme masquée dans le champ, avec un message vert qui indique qu’elle sera utilisée. L’aperçu conserve l’identifiant qui précède le premier trait d’union ou tiret bas, ainsi que les cinq premiers et quatre derniers caractères de la clé, à condition qu’au moins huit caractères intermédiaires restent masqués. Sinon, des points remplacent la clé et l’identifiant entiers. Le décompte se fait en points de code Unicode. Aucun bouton en forme d’œil ne permet de révéler une clé enregistrée. Vous ne pouvez ni la copier, ni la couper, ni la modifier en partie. Toute saisie ou tout collage la remplace entièrement. Appuyez sur Retour arrière ou Suppr, puis sur **Appliquer**, pour supprimer la clé enregistrée et utiliser l’authentification d’environnement. Vider une clé de remplacement prépare également la suppression de la clé enregistrée. **Annuler** conserve la clé enregistrée tant que vous n’avez pas appliqué les changements. Si la suppression est refusée, les réglages restent inchangés. Si la clé est supprimée mais que l’enregistrement des réglages échoue, le message indique que la suppression est définitive. Sélectionnez à nouveau **Appliquer** pour enregistrer les réglages ou **Fermer** pour conserver ce résultat partiel. Effacer un identifiant partagé affecte toutes les fonctionnalités qui utilisent sa référence. Sans identifiant d’environnement, le fournisseur ne peut plus s’authentifier après la suppression. Lorsque le champ est vide et utilise la valeur d’environnement, il affiche **Laisser vide pour utiliser la variable d’environnement** et un message de détection. Une clé de remplacement saisie affiche un rappel pour l’appliquer. Lorsqu’une suppression est en attente, le champ indique la variable d’environnement que la route utilisera après application si elle en déclare une. Les autres champs non vides n’affichent aucun état d’authentification. Les variables de configuration d’adresse s’affichent sous **URL de base** et ne sont pas des identifiants.

Lorsque vous saisissez une clé modifiable, une icône en forme d’œil apparaît. Sélectionnez **Afficher le secret** pour vérifier la saisie, puis **Masquer le secret** pour la masquer de nouveau. Toute modification masque de nouveau la saisie. Les champs de mot de passe natifs ne permettent pas de couper le texte masqué. Sélectionnez votre saisie et appuyez sur Retour arrière pour l’effacer, ou affichez-la avant de la couper. Les identifiants enregistrés restent accessibles uniquement en écriture.

<a id="add-a-custom-model-api"></a>

## Ajouter une API modèle personnalisée

Sélectionnez **API de modèles personnalisée** pour un relais, une passerelle d’entreprise, un serveur auto-hébergé ou un fournisseur absent du catalogue installé. Indiquez un identifiant de fournisseur en minuscules, une URL de base, un protocole API, des identifiants et au moins un modèle. Choisissez le **Protocole API** de votre passerelle parmi OpenAI Chat Completions, OpenAI Responses, Anthropic Messages et Gemini API. Le fichier `cordis.patch.yml` du profil actif les enregistre sous `openai-completions`, `openai-responses`, `anthropic-messages` et `google-generative-ai`. L’URL de base de l’API Gemini contient la version de l’API, par exemple `https://gateway.example/v1beta`. Un fournisseur utilise un seul protocole. Si votre passerelle en propose deux, configurez deux fournisseurs.

![The custom model API form: Provider ID, display name, base URL, API protocol, and API key](providers-custom-form.png)

L’ID du fournisseur est permanent parce que les demandes, les sessions sauvegardées, les modèles par défaut et les références de justificatifs l’utilisent. Pour renommer un fournisseur, ajoutez un nouveau fournisseur et supprimez l’ancien. Le nom de l’affichage, l’URL de base, le protocole, le titre de créance et les modèles restent modifiables.

<a id="discover-models"></a>

### Découvrez les modèles

Dans **Catalogue de modèles**, sélectionnez **Récupérer les modèles disponibles** pour interroger le point de terminaison. La requête utilise l’URL de base, le protocole et la clé du formulaire, ou la clé enregistrée du fournisseur. Les résultats s’affichent dans un sélecteur avec recherche. Les modèles déjà dans la liste sont cochés. Recherchez et cochez ceux à ajouter, décochez ceux à retirer, puis sélectionnez **Mettre à jour la liste**. Les modèles configurés qui ne figurent pas dans la réponse restent dans la liste. Les changements sont enregistrés lorsque vous enregistrez ou créez le fournisseur.

La découverte lit les formats de liste utilisés par les passerelles courantes. Si le point de terminaison ne répond pas dans un format reconnu, si la découverte échoue ou si elle ne liste aucun modèle, ajoutez les identifiants manuellement. Les modèles fonctionnent de la même façon. Pour un fournisseur intégré, la liste provient toujours du catalogue installé, même lorsque son URL de base pointe vers une passerelle. Utilisez un fournisseur personnalisé pour découvrir les modèles réellement proposés par la passerelle.

<a id="select-a-model"></a>

## Sélectionner un modèle

Les fournisseurs configurés apparaissent dans le sélecteur de modèle. La sélection d’un modèle en fait également la valeur par défaut pour les nouvelles sessions. Une session qui a déjà envoyé une requête conserve le modèle enregistré dans son propre journal.

Pour changer l’ordre des modèles d’un fournisseur, modifiez-le dans **Paramètres → Modèles**, ouvrez **Paramètres personnalisés** et déplacez un modèle à l’aide de sa poignée à trois lignes. Vous pouvez aussi sélectionner la poignée au clavier et appuyer sur la flèche haut ou bas. **Appliquer** enregistre l’ordre et **Annuler** abandonne la modification. Le sélecteur affiche les modèles de ce fournisseur dans l’ordre enregistré.

Si un fournisseur par défaut enregistré a été supprimé, l’éditeur affiche **Sélectionnez le modèle** et bloque l’entrée jusqu’à ce qu’un autre modèle soit sélectionné.

<a id="advanced-configuration"></a>

## Configuration avancée

Le catalogue de configuration du plugin [généré](../../config-catalog.md) liste chaque champ pris en charge et par défaut pour chaque plugin; [`ocean-llm-pi-ai`](../../config-catalog.md#oceanocean-llm-pi-ai) est la section fournisseur que cette page configure. Les références [`ocean-llm-pi-ai`](../../../packages/llm/llm-pi-ai/README.md) et [`ocean-llm-deepseek`](../../../packages/llm/llm-deepseek/README.md) possèdent une configuration directe `cordis.patch.yml` , une résolution de catalogue, des contrôles de raisonnement, des identifiants et des erreurs d'adaptateur.

::: tip Paramètres supplémentaires
La page Modèles présente la clé API, le nom d’affichage, l’URL de base, le protocole API ainsi que l’identifiant, le nom d’affichage, la fenêtre de contexte, le nombre maximal de jetons de sortie et les types d’entrée de chaque modèle. Elle permet aussi de régler les niveaux de raisonnement des modèles d’un fournisseur d’API personnalisé. Pour les modèles d’un fournisseur intégré, configurez les niveaux de raisonnement, les options de compatibilité des requêtes, les en-têtes, les délais d’attente et la politique de nouvelle tentative dans `$OCEAN_HOME/profiles/<profile>/cordis.patch.yml`, le même document que la page modifie. Modifiez-le directement. Si votre navigateur tourne sur la même machine que le serveur, vous pouvez aussi l’ouvrir avec **Ouvrir le fichier de configuration** dans l’en-tête des paramètres. Les adaptateurs relisent le fichier à la requête suivante, sans redémarrage. Les sections suivantes décrivent les champs dont la plupart des passerelles ont besoin.

Pour le lancement standard de l’interface web avec `ocean web`, `<profile>` vaut `web`. Le chemin est donc `$OCEAN_HOME/profiles/web/cordis.patch.yml`. Si vous lancez un profil personnalisé, utilisez le nom choisi au démarrage.
:::

### Entrée d’images

Dans les paramètres **→ Modèles**, éditer le fournisseur, ouvrir **Paramètres personnalisés**, et étendre les options du modèle **Options du modèle**. **Types d’entrée** occupe sa propre ligne sous les champs de capacité. Sélectionnez **Image** pour un modèle qui accepte les images, et enregistrez. **Texte** démarre sélectionné pour un nouveau modèle personnalisé sans capacité d’image héritée. Au moins un type doit rester sélectionné; sélectionnez Image avant de supprimer Texte pour un modèle uniquement image.

Les cases à cocher sauvegardent `input` pour les modèles pi-ai et `inputModalities` pour l'adaptateur DeepSeek direct. Vous pouvez également modifier le modèle dans `$OCEAN_HOME/profiles/<profile>/cordis.patch.yml`; par exemple, ce fournisseur pi-ai personnalisé déclare un modèle texte seulement et un modèle de vision :

Ces exemples montrent les champs de configuration à l’intérieur d’un patch de profil. Une fonction de configuration Cordis remplace la fonction de configuration d’entrée complète; conserve d’autres fournisseurs et champs lors de l’édition d’une fonction de remplacement existante.

```yaml
- id: llm-pi-ai
  config:
    providers:
      my-gateway:
        apiKeyEnv: GATEWAY_API_KEY
        api: openai-completions
        baseURL: https://gateway.example/v1
        models:
          - id: legacy-chat
          - id: vision-preview
            input: [text, image]
```

Le champ `input` de pi-ai accepte `text` et `image` et s’applique uniquement au modèle concerné. Une sélection explicite non vide est prioritaire. Si `input` est absent ou vide, le modèle hérite des types d’entrée du catalogue installé, ou à défaut de `defaultInput` sur la route, qui vaut `[text]` par défaut. Les cases affichent ces valeurs héritées. Ouvrir la ligne n’enregistre aucune valeur de remplacement.

DeepSeek traite un `inputModalities` omis comme un texte seulement et rejette une liste vide. Effacer l'image supprime également les limites d'image `imagePixelBudget` et `imageMaxBytes` de ce modèle, car DeepSeek rejette les limites d'image sur un modèle texte seulement. Définissez à nouveau ces limites si vous activez ultérieurement les images et avez besoin de limites personnalisées.

Pour restaurer l'héritage après l'édition des cases à cocher, supprimer le champ `input` ou `inputModalities` du modèle à partir de `cordis.patch.yml`. **Restaurer par défaut** supprime l'ensemble de la surcharge du catalogue modèle, y compris les autres modifications du modèle, alors utilisez-le seulement lorsque vous voulez restaurer l'ensemble du catalogue.

Si chaque modèle que vous entrez à la main prend des images, placez le recul une fois sur la route au lieu de chacun d’eux:

```yaml
- id: llm-pi-ai
  config:
    providers:
      vision-gateway:
        apiKeyEnv: GATEWAY_API_KEY
        api: openai-completions
        baseURL: https://vision.example/v1
        defaultInput: [text, image]
        models:
          - id: first-model
          - id: second-model
```

`defaultInput` est un repli, pas une redéfinition, et par défaut à `[text]`: sur un fournisseur intégré, il répond uniquement pour les modèles que son catalogue ne décrit pas, donc il ne supprime jamais les images d'un modèle de catalogue qui les possède. Nez l'un de ceux avec le propre `input` de ce modèle. Lorsqu'un fournisseur intégré n'a pas de liste explicite de `models` , écrivez-la sous `modelOverrides`, clé par id du modèle:

```yaml
- id: llm-pi-ai
  config:
    providers:
      anthropic:
        modelOverrides:
          claude-sonnet-4-5:
            input: [text]
```

Dans la configuration pi-ai, chaque liste doit nommer au moins une modalité à l'exception de la propre `input` d'un modèle, où une liste vide signifie la même chose que l'omission. Une modalité inconnue est refusée partout où elle est écrite.

Les deux champs déclarent les capacités attendues du point de terminaison sans les vérifier. Si le modèle déclare accepter des images et que le point de terminaison ne les prend pas en charge, le fournisseur rejette la requête.

<a id="deepseek-account-models"></a>

### Modèles de compte DeepSeek

Un compte DeepSeek signé liste ses modèles à partir du service de compte, de sorte que la page Models n'offre pas d'éditeur de modèle pour lui. Ajustez un modèle unique avec `modelOverrides` dans `$OCEAN_HOME/profiles/<profile>/cordis.patch.yml`; les champs correspondent à une entrée DeepSeek `models` , et les champs non définis conservent les valeurs listées :

```yaml
- id: llm-deepseek-account
  config:
    modelOverrides:
      deepseek-flash:
        contextWindow: 524288
        maxTokens: 131072
```

Un modèle qui a besoin d'un océan plus récent échoue avec `CLIENT_UPGRADE_REQUIRED`, qui nomme la version à installer. [référence du prestataire de compte](../../../packages/llm/llm-deepseek-account/README.md) possède les règles d'inscription, de retrait et de gating.

<a id="reasoning-effort"></a>

### Effort de raisonnement

Le sélecteur de modèle offre un menu **Effort** pour un modèle qui déclare les niveaux de raisonnement. Les modèles d’un fournisseur intégré héritent de leurs niveaux depuis le catalogue installé, et les modèles de DeepSeek conservent les niveaux de l’adaptateur. Un modèle que vous entrez à la main n’en déclare aucun jusqu’à ce que vous l’ajoutiez, de sorte que jusqu’à ce que l’entrée Effort n’apparaît pas dans le menu et que le point de départ décide par défaut si le modèle pense.

Sur un modèle personnalisé API fournisseur, déclarer les niveaux dans **Paramètres → Modèles**: éditer le fournisseur, ouvrir **Paramètres personnalisés**, étendre les options de modèle **du modèle**, et activer **Niveaux de raisonnement**. Les rangées commencent avec les lignes off, bas, moyen et haut. Chaque ligne jumele un niveau avec la valeur de l’API **que** envoie pour elle, ce qui est par défaut le nom du niveau; changez-le seulement là où la documentation de l’API du fournisseur de modèle épele le niveau différemment. Ajoutez ou supprimez des lignes pour correspondre à ce que prend en charge le paramètre, gardez au moins un niveau en dehors et enregistrez. L’arrêt de l’interrupteur supprime la déclaration.

La page écrit `reasoningEfforts` dans `$OCEAN_HOME/profiles/<profile>/cordis.patch.yml`, où vous pouvez également déclarer les niveaux directement:

```yaml
- id: llm-pi-ai
  config:
    providers:
      my-gateway:
        apiKeyEnv: GATEWAY_API_KEY
        api: openai-completions
        baseURL: https://gateway.example/v1
        reasoning: high
        models:
          - id: my-reasoner
            reasoningEfforts:
              off:
              high: high
              max: max
```

Chaque clé est un niveau que le menu offre, et sa valeur est l'orthographe envoyée sur le fil comme `reasoning_effort`, donc `max: xhigh` renomme un niveau pour une passerelle avec son propre vocabulaire. Seul `off` peut rester vide, parce que pour la plupart des paramètres qui ne pensent pas est l'absence du paramètre. Le `reasoning` de l'itinéraire est le niveau utilisé alors qu'une session n'en a pas choisi ; choisir un effort dans le sélecteur l'enregistre, avec le modèle, comme valeur par défaut pour les nouvelles sessions.

Un `off` laissé vide n'envoie rien, ce qui n'arrête qu'un modèle qui pense sur demande ; un `off` donné une valeur envoie cette valeur comme `reasoning_effort` à la place. Un modèle qui pense à moins de dire de ne pas — DeepSeek V4 derrière une passerelle compatible OpenAI, par exemple — a besoin de `compat.thinkingFormat: deepseek`, ce qui fait que `off` envoie `thinking: {type: disabled}` et tous les autres niveaux envoient `thinking: {type: enabled}` à côté de l'effort:

```yaml
        models:
          - id: deepseek-v4-pro
            compat:
              thinkingFormat: deepseek
            reasoningEfforts:
              off:
              high: high
              max: max
```

Le modèle d'un fournisseur intégré dont la passerelle ne raisonne pas perd ses niveaux avec `reasoningEfforts: false` sous `modelOverrides`; la sélection d'un effort pour elle est ensuite refusée comme `UNSUPPORTED_REASONING_EFFORT`. La route de DeepSeek n'a pas besoin de cela : ses modèles offrent déjà `off`, `low`, `high`, et `max`, et `llm-deepseek.reasoningEffort` définit la valeur par défaut à partir de laquelle le sélectionneur commence :

```yaml
- id: llm-deepseek
  config:
    reasoningEffort: max
```

<a id="request-compatibility"></a>

### Compatibilité des requêtes

Une passerelle peut contenir une clé de travail à une adresse accessible et toujours refuser chaque requête. pi-ai décide de la forme d’une requête — quel rôle porte l’invite du système, quel champ capte la sortie, comment un niveau de pensée voyage — à partir de l’URL du paramètre, et une adresse qu’il ne reconnaît pas est traitée comme si c’était OpenAI lui-même. La plupart des passerelles compatibles OpenAI refusent au moins une chose qu’OpenAI accepte.

Deux en représentent la plus grande partie. Un modèle qui déclare le raisonnement a son système prompt envoyé sous la forme de `role: "developer"`, que beaucoup de passerelles rejettent carrément, et le capuchon de sortie est envoyé sous la forme de `max_completion_tokens`, qu'un serveur qui ne connaît que `max_tokens` refuse. Le formulaire n'a pas de champ pour l'un ou l'autre; corrigez-les sur la route en `$OCEAN_HOME/profiles/<profile>/cordis.patch.yml`:

```yaml
- id: llm-pi-ai
  config:
    providers:
      my-gateway:
        apiKeyEnv: GATEWAY_API_KEY
        api: openai-completions
        baseURL: https://gateway.example/v1
        compat:
          supportsDeveloperRole: false
          maxTokensField: max_tokens
        models:
          - id: my-model
```

Une route `compat` est la valeur par défaut pour ses modèles, et le propre modèle gagne champ par champ, de sorte qu'un modèle peut être corrigé sans répéter l'itinéraire:

```yaml
        models:
          - id: my-model
          - id: my-reasoner
            compat:
              thinkingFormat: deepseek
```

Ce que ni l'un ni l'autre ne conserve la valeur du catalogue installé pour ce modèle, et ce que le catalogue ne décrit pas tombe à la détection de pi-ai. Donnez à chaque commutateur une valeur : une clé laissée vide (`supportsDeveloperRole:`) est refusée plutôt que ignorée, car une valeur vide effacerait ce que le catalogue sait en ne disant rien à sa place. Un nom qu'aucun protocole n'accepte est également refusé, et le message énumère ceux qui sont disponibles.

Chaque interrupteur appartient aux protocoles qui le déclarent, de sorte qu'un interrupteur valide sur un `api` peut être refusé sur un autre — le message indique ce que ce protocole offre. Comme `input` ci-dessus, un switch indique une revendication au sujet de votre point final plutôt que de la vérifier : définir une passerelle n'a pas besoin d'envoyer simplement une requête différente.

Chaque interrupteur, ses valeurs acceptées et les protocoles qui le prennent sont listés sous `PiAiCompatProfile` dans le [généré `ocean-llm-pi-ai` référence de configuration](../../config-catalog.md#oceanocean-llm-pi-ai) — qui est dérivé de la source, de sorte qu'il ne peut pas tomber sous ce que l'adaptateur accepte.

<a id="troubleshooting"></a>

## Dépannage

- **`MISSING_CREDENTIAL`** — Entreposez la clé du fournisseur sur la page Modèles ou fournissez la variable d'environnement référencée.
- **`UNKNOWN_MODEL`** — Sélectionnez un modèle configuré ou ajoutez le modèle manquant au fournisseur personnalisé.
- **La récupération des modèles disponibles renvoie 401**. Vérifiez la clé. La découverte appelle le point de terminaison `GET /models` compatible avec OpenAI. Si le point de terminaison n’existe pas, saisissez les modèles manuellement.
- **La récupération des modèles disponibles ne trouve ni tableau `data` ni objet `models`**. Le point de terminaison renvoie une liste dans un format que la découverte ne sait pas lire. Saisissez les modèles manuellement.
- **La passerelle refuse toutes les requêtes bien que la clé et l'URL soient bonnes** — Sa forme de requête diffère de celle d'OpenAI. Commencez par `compat.supportsDeveloperRole: false` et `compat.maxTokensField: max_tokens` sur l'itinéraire.
- **Seuls les modèles de raisonnement échouent**. Pi-ai envoie leur message système avec le rôle `developer`, que la passerelle refuse. Définissez `compat.supportsDeveloperRole: false`.
- **Le menu Effort n'apparaît pas pour un modèle que vous avez saisi à la main** — Il ne déclare aucun niveau. Sur un fournisseur d'API de modèle personnalisé, allumez **Niveaux de raisonnement** dans les options de modèle **du modèle**; ailleurs, ajoutez `reasoningEfforts` au modèle dans `cordis.patch.yml`.
- **`off` ne désactive pas le raisonnement d’un modèle DeepSeek**. Un `off` vide n’envoie aucun champ de raisonnement. Un point de terminaison qui raisonne par défaut continue donc de le faire. Définissez `compat.thinkingFormat: deepseek` sur le modèle ou sur la route.
- **Un commutateur de compat est refusé comme n’ayant aucune valeur** — Une clé écrite avec rien après le côlon. Donnez-lui une valeur, ou supprimez la clé pour garder le catalogue installé.
- **Une image est refusée avant d'envoyer** — Le modèle ne déclare aucune modalité d'image. Donnez le modèle `input: [text, image]` d'un fournisseur personnalisé ; sur la route propre de DeepSeek, sélectionnez une entrée compatible avec l'image dans le catalogue configuré (`deepseek-flash` par défaut) et confirmez que votre passerelle sert ce modèle avec l'entrée d'image.
- **Le fournisseur rejette une demande portant une image** — Le modèle déclare que les images ne sont pas réellement desservies. Supprimez `image` de la liste qui l'a accordé — `input` du modèle ou `defaultInput` de la route — puis démarrez une nouvelle session: l'image jointe reste dans le journal de session, donc la même requête se répète jusqu'à ce que la session se retire.
