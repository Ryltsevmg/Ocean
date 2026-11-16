<a id="schedule-reminders"></a>

# Calendrier des rappels

<!-- USER_LANGUAGES_START -->
[English](schedule.md) | [中文](schedule.zh.md) | [Русский](schedule.ru.md) | [日本語](schedule.ja.md) | [Español](schedule.es.md) | Français | [Deutsch](schedule.de.md) | [Português](schedule.pt.md) | [한국어](schedule.ko.md)
<!-- USER_LANGUAGES_END -->

<a id="summary"></a>

## Résumé

Demandez au modèle dans une conversation de créer, de lister, de visualiser, de modifier, de pauser, de reprendre ou de supprimer des rappels. Chaque rappel se répète par sa règle et donne son instruction à une conversation existante, à une nouvelle conversation, ou à une nouvelle conversation à chaque événement. La page des tâches d'automatisation liste chaque rappel de l'hôte et peut créer, modifier, exécuter, mettre en pause, reprendre et supprimer un. Les tâches d'un seul coup sont disponibles jusqu'à ce que vous les effaciez explicitement.

<a id="table-of-contents"></a>

## Table des matières

- [Créer des rappels](#create-reminders)
- [Inspecter, exécuter et supprimer les tâches](#manage-tasks)
- [Modifier une tâche](#edit-timing)
- [Délai et référence de livraison](#timing-and-delivery)
- [Autres activités d'exploration](#further-exploration)

<a id="create-reminders"></a>
## Créer des rappels

Le profil Web expédié comprend le service d'Host Schedule et la page des tâches d'automatisation. Configurez un fournisseur modèle avant de lui demander de créer des rappels.

Les préréglages `standard`, `cordis`et `ptc` déclarent les quatre outils de rappel et le contexte de l'horloge qui donne au modèle l'heure actuelle et la zone du navigateur, de sorte que ces préréglages fournissent `schedule_create`, `schedule_list`, `schedule_view`et `schedule_edit`; le préréglage `minimal` ne déclare aucun. Un sous-agent délégué voit les quatre outils, mais chaque outil refuse un appel d'un sous-agent délégué, de sorte qu'un sous-agent ne peut pas lire ou modifier des rappels.

Demandez au modèle de créer, de lister, de visualiser, de modifier, de suspendre, de reprendre ou de supprimer des rappels. Il utilise `schedule_create` pour en créer un, `schedule_list` pour lister les rappels de chaque conversation, `schedule_view` pour en lire un, et `schedule_edit` pour en modifier, mettre en pause, reprendre ou en supprimer un; une modification conserve l'identifiant de rappel et les enregistrements de livraison enregistrés. Un rappel que le modèle crée a un nom, une instruction, une heure de départ en UTC ou dans un fuseau horaire IANA, et une règle de répétition RFC 5545, comme chaque jour de semaine à 9h00 ou une seule fois. Il livre à cette conversation, à une nouvelle conversation que sa première livraison crée, ou à une nouvelle conversation à chaque livraison; une nouvelle conversation utilise le répertoire de travail et préréglage de cette conversation. Chaque livraison d'un rappel vient au moins une minute après l'heure prévue de la livraison précédente, ou après la course précédente maintenant; un rappel qui ouvre une nouvelle conversation à chaque livraison attend plutôt l'intervalle d'exécution minimum de l'hôte, une minute par défaut. Une livraison tardive, par exemple après un redémarrage Host, ne retarde pas la prochaine.

Une conversation qu'une livraison crée rejoint le Workspace enregistré dans son répertoire de travail et prend le nom de rappel comme titre. Pour un rappel qui ouvre une nouvelle conversation à chaque livraison, le titre indique également l'heure de lancement dans la zone de la règle du rappel, par exemple `Weekday digest · 2026-10-12 09:00`.

Par exemple, demandez-moi : -Rappelez-moi chaque jour à 23h00 en Asie/Shanghai pour vérifier la météo.--En dessous de la réponse, une carte affiche le nom et la fréquence du rappel créé ; Ouvrir affiche ses détails dans la barre latérale droite. Vérifiez que la fréquence se répète tous les jours à 23h00, pas une fois. Un rappel unique ne devient pas récurrent après la livraison. Une fois le rappel supprimé, la carte affiche Supprimé et ne l'ouvre plus.

Pour créer un rappel sans le modèle, ouvrez les tâches d'automatisation à partir de la barre latérale, ouvrez Choisissez une méthode de création à côté de New, et choisissez Create manuellement ; quand aucune tâche n'existe, Nouvelle tâche d'automatisation ouvre le même éditeur. Cet éditeur ouvre également les tâches existantes et demande un nom de tâche d'automatisation, une instruction de tâche d'automatisation, Exécuter dans, Espace de travail lié, et Durée d'exécution. Il commence par Une fois à une heure à partir de maintenant dans le fuseau horaire du navigateur et avec Créer une conversation et la réutiliser. Exécuter offre Créer une conversation et la réutiliser, ce qui crée une conversation à la première exécution et continue à l'utiliser, et Nouvelle conversation pour chaque exécution, qui crée une conversation séparée à chaque exécution et montre l'intervalle d'exécution minimum de l'hôte. L'espace de travail lié répertorie chaque espace de travail enregistré avec son répertoire et sélectionne l'espace de travail dont le répertoire utilise la nouvelle conversation; il commence à l'espace de travail par défaut, ou au premier espace de travail lorsque l'espace de travail par défaut n'est pas enregistré. Lorsqu'il n'existe pas d'espace de travail, l'espace de travail lié affiche Ungrouped et le répertoire de projet Host est utilisé. La nouvelle conversation utilise le préréglage par défaut. Créer crée la tâche et la sélectionne dans la liste, et Distard ferme l'éditeur sans en créer une. Si l'Host refuse la tâche, l'éditeur conserve votre entrée et indique le problème, par exemple que la date et l'heure doivent être dans l'avenir.

Nouveau, et Créer dans une conversation dans le même menu, ouvrir une nouvelle conversation dans l'espace de travail actuel ou le plus récent; demander au modèle là-bas de créer la tâche.

<a id="manage-tasks"></a>

<a id="inspect-run-and-delete-tasks"></a>

## Inspecter, exécuter et supprimer les tâches

Demandez au modèle de lister les rappels pour voir les rappels de chaque conversation, les plus actifs d'abord, ou de montrer, de pause, de reprendre ou de supprimer un rappel par son id.

Ouvrez les tâches d'automatisation depuis la barre latérale pour afficher les rappels à travers les Sessions sans activer leurs conversations. Rechercher par le nom de la tâche, l'instruction ou l'identifiant de la conversation de la tâche, et filtrer par l'état de la tâche : Tous, activé, épuisé ou terminé. Les lignes sont commandées par leur heure prévue, le plus tôt possible. Chaque ligne affiche le nom de la tâche et une ligne de résumé : l'état d'une tâche interrompue ou terminée, la fréquence et, pour une tâche activée, l'heure programmée suivante avec son heure locale et relative.

Les tâches d'une Session sont les tâches qui lui sont confiées, y compris la dernière série d'une tâche qui crée une nouvelle conversation pour chaque course, et les tâches que son Agent a créées ou éditées. Une rangée de Session inactive et non archivée dont la Session a au moins une tâche active affiche une marque d'horloge; une rangée archivée garde cette cellule vide, avec son statut en direct sur la carte de vol stationnaire seulement. Un long vol stationnaire sur une ligne de session avec des tâches actives énumère jusqu'à deux de ces tâches avec leur fréquence et leur prochaine exécution comme une durée de zone de périphérique avec sa durée relative. L'en-tête de la Session ouverte affiche une horloge de rappel icon-only tandis que la Session a des tâches actives : elle ouvre les détails de la tâche unique dans la barre latérale droite, ou autrement une liste des tâches dans lesquelles chaque ligne ouvre les détails de la tâche ou supprime la tâche.

Sélectionnez une tâche pour ouvrir ses détails. Les règles indiquent le nom de la tâche, la prochaine exécution avec son heure locale et relative ou l'état d'une tâche interrompue ou terminée, l'instruction, Répéter et Exécuter, qui montre la conversation courante liée pour une tâche qui livre à une conversation existante. Le bas des détails montre la session liée, ou la conversation de dernier exercice pour une tâche qui crée une nouvelle conversation pour chaque exécution. Son bouton ouvre cette conversation lorsque la Session est disponible et non archivée, et est désactivée autrement; avant que la première exécution crée la conversation, l'entrée affiche En attente de création. Pour une tâche qui livre à une conversation existante, Règles indique quand cette conversation est archivée, indisponible, ou encore chargement. Les détails de la tâche et la suppression restent disponibles même lorsqu'une conversation ne peut pas s'ouvrir. Les tâches de navigation ne sont pas des Sessions non historiques.

Choisissez Records pour charger les 20 enregistrements enregistrés les plus récents. Chaque enregistrement montre l'heure d'occurrence dans la zone de la règle de la tâche (la zone du navigateur lorsque la règle n'en nomme aucun), un bouton qui ouvre la conversation qui a reçu la livraison lorsque cette conversation est disponible, et l'instruction sauvegardée; Expand affiche une longue instruction en entier. Les enregistrements sans instruction sauvegardée ne montrent jamais l'instruction actuelle à sa place. Charger plus ajoute la page suivante. Les enregistrements suivent l'ordre le plus récent, même si l'horloge recule; ils ne décrivent pas les résultats d'exécution du modèle. Flèches gauche/droite et changement d'intérieur/fin des onglets focalisés.

Une vue d'enregistrement vide signifie qu'une requête réussie n'a pas été renvoyée. Chargement, échec de la requête, une tâche manquante, et un curseur d'enregistrement plus ancien invalide ont des messages séparés. Utilisez Reessayer après une requête manquée ou une réponse manquante; utilisez Refraîchir après un curseur invalide pour recharger la page la plus récente. Les enregistrements déjà chargés peuvent rester visibles avec un avertissement alors qu'une demande échoue. Une nouvelle livraison rafraîchit la dernière page. Les réponses tardives pour une tâche ou une vue laissée ne remplacent pas la vue actuelle.

Lorsque la conservation a été retirée, la dernière page indique que les dossiers de livraison antérieurs ont été effacés, et les règles de conservation indiquent le nombre de dossiers et le nombre de jours que chaque tâche conserve. Une tâche plus ancienne sans historique enregistré ne montre que sa dernière livraison, sans instruction, jusqu'à ce que de nouvelles livraisons ajoutent des enregistrements. Les enregistrements antérieurs et les instantanés d'instruction non enregistrés ne peuvent pas être récupérés.

Les tâches actives participent à la planification. Les tâches interrompues et terminées ne prévoient pas une autre livraison. Une tâche ponctuelle se termine après que son rappel soit durablement écrit à la boîte de réception de la conversation, et une tâche répétée se termine après la dernière occurrence de sa règle; choisissez Tout ou Terminé dans l'état de la tâche pour trouver une tâche terminée. L'en-tête Session, la ligne et la carte hover n'affichent que des tâches actives, donc la disparition de ces vues ne signifie pas que la tâche a été supprimée.

Pause dans les détails arrête les futures livraisons d'une tâche active, et Resume redémarre une tâche interrompue. Exécuter maintenant, dans le menu Actions des tâches d'automatisation, demande à l'hôte de livrer l'instruction une fois maintenant et conserve la prochaine exécution programmée, également pour une tâche interrompue ou terminée. Alors qu'une livraison d'une tâche qui livre à une conversation existante ou à une nouvelle conversation est en file d'attente ou en cours d'exécution, les champs, Enregistrer les modifications, Pause, Reprendre, Exécuter maintenant et Supprimer la tâche sont désactivés, et les détails indiquent que la tâche est en file d'attente ou en cours d'exécution et que vous la gérez dans sa conversation, que le bouton en bas des détails s'ouvre. Une tâche qui crée une nouvelle conversation pour chaque course n'est pas désactivée de cette façon ; ses courses se poursuivent les unes les autres. Après une livraison, Exécuter reste maintenant désactivé jusqu'à ce que l'intervalle de livraison minimal de la tâche se termine; alors que seul l'intervalle le tient, maintenez le pointeur sur Exécuter maintenant ou déplacez le clavier vers lui pour voir quand il devient disponible. Si l'hôte refuse une course pour l'une de ces raisons, les détails indiquent que la tâche est en file d'attente, en cours d'exécution ou vient d'être livrée. Exécuter maintenant est également désactivé pendant que la conversation que la tâche livre à est archivée. Si vous arrêtez la conversation pendant que l'instruction de la tâche attend là, l'instruction reste en file d'attente jusqu'à ce que votre prochain message, la tâche prochaine est programmée, ou Exécutez maintenant.

Choisissez Supprimer la tâche dans le menu Actions d'automatisation et confirmez pour arrêter la livraison future et supprimer la tâche de la liste, y compris pour une tâche interrompue ou terminée. Suppression supprime la tâche avec ses enregistrements de livraison sauvegardés, de sorte que l'historique de la tâche sauvegardée est parti. Confirmer la suppression indique le résultat dans une seule notification à l'échelle de l'application — supprimé, qui ferme également les détails, ou un échec qui laisse la tâche en place pour réessayer; il ne supprime pas les conversations ou rétracte un message déjà en attente là. La ligne reste visible jusqu'à ce qu'une requête réussie confirme les tâches restantes. Si une requête échoue, Reessayer recharge le catalogue ; l'erreur n'est pas un résultat vide réussi.

<a id="edit-timing"></a>

<a id="edit-a-task"></a>

## Modifier une tâche

Demandez au modèle de changer le nom, l'instruction, la règle de répétition ou la cible de livraison d'un rappel, ou de le suspendre ou de le reprendre; le changement conserve l'identifiant de rappel et enregistre les dossiers de livraison.

Dans les tâches d'automatisation, sélectionnez une tâche pour changer son nom de tâche d'automatisation, instructions d'automatisation des tâches, Exécuter dans, Espace de travail lié, et Durée d'exécution, y compris pour une tâche interrompue ou terminée. Les éditions restent dans un brouillon local jusqu'à ce que vous choisissiez Enregistrer les modifications. L'édition conserve l'identifiant de tâche, le dernier reçu de livraison et tous les enregistrements de livraison enregistrés. Une règle modifiée rend une tâche terminée active à nouveau et maintient une tâche interrompue. Pour une tâche qui livre à une conversation existante, Exécuter dans affiche Conversation en relation avec le courant; choisir une autre option permet de lancer plus tard de créer leurs conversations et de définir l'espace de travail lié à sa valeur de départ, comme dans Créer manuellement. Une tâche conserve son préréglage stocké pendant que son Workspace reste le même ; un Workspace modifié utilise le préréglage par défaut.

- Une fois : La date ouvre un calendrier de mois, l'heure ouvre les colonnes Heure, Minute et Deuxième, et le fuseau horaire les interprète. La tâche s'exécute une fois et se termine.
- Toutes les minutes N et toutes les heures N: Interval fixe le nombre de minutes ou d'heures, au moins 1. L'intervalle compte à partir de la minute à laquelle vous enregistrez la tâche.
- Chaque jour : Interval fixe le nombre de jours, et Time ouvre les colonnes Heure et Minute.
- Semaine et du lundi au vendredi: Interval fixe le nombre de semaines, le jour de la semaine sélectionne les jours, et l'heure ouvre Heure, Minute et Deuxième colonnes. Du lundi au vendredi sélectionne ces cinq jours à la fois.
- Mensuel : Intervalle fixe le nombre de mois, le jour du mois choisit une date de 1 à 31 et l'heure ouvre les colonnes Heure, Minute et Deuxième. Un mois sans la date sélectionnée tourne sur son dernier jour.
- Custom: Custom rule tient le texte de la règle. Une règle que les autres choix ne peuvent pas reproduire s'ouvre dans Custom. Une tâche existante sans texte de règle modifiable affiche sa fréquence d'origine et garde ce timing jusqu'à ce que vous sauvegardez un remplacement.

Le fuseau horaire énumère les zones récemment sélectionnées d'abord, marque la zone système, et les recherches par décalage UTC, IANA ID, ou ville. Il apparaît pour les choix guidés et les expressions personnalisées qui utilisent une zone séparée; sinon le texte de la règle personnalisée fournit sa zone.

Les champs ne changent qu'une ébauche locale. Si la tâche cible une conversation existante, la session en lien courant reste disponible afin que vous puissiez annuler une modification de destination sans rejeter d'autres modifications. Pendant que vous modifiez, le bas des détails affiche les modifications non enregistrées avec les modifications Déchiffrer et Enregistrer; Enregistrer les modifications n'envoie que les champs modifiés dans une mise à jour, et Déchiffrer restaure les valeurs stockées. Un save n'envoie une nouvelle règle que lorsque le timing a changé. Enregistrer les changements reste désactivé jusqu'à ce qu'un changement significatif ait des champs valides et un timing. Texte personnalisé non valide conserve le brouillon et affiche un message de correction; l'hôte valide également la règle sur l'enregistrement. Pause, recommencer, Exécuter maintenant, et la suppression attendre jusqu'à ce que vous sauvegardez ou rejetez les modifications non enregistrées. Les champs sont désactivés pendant qu'une sauvegarde est en vol. Laisser les détails ne retourne pas une écriture Host déjà commencé.

Changer de tâches ou laisser la page conserve des ébauches non enregistrées. Un catalogue rafraîchit un formulaire vierge; un formulaire édité conserve tous les champs et leur version originale. Si la livraison ou une autre modification modifie la tâche, les détails indiquent que la tâche a changé ailleurs et désactiver Enregistrer les changements lorsque la version plus récente arrive. L'hôte vérifie également la version en cours d'enregistrement. L'examen avec mes modifications maintient le titre, l'invite, le timing et les groupes cibles que vous avez changés et charge les dernières valeurs pour les autres groupes. Examiner le formulaire entier avant de sauvegarder; cette action seule ne sauve pas. Si le même groupe a changé ailleurs, vos modifications ont priorité dans le formulaire. Jeter remplace le brouillon entier par les dernières valeurs stockées. Si une autre sauvegarde échoue, le brouillon reste et les détails vous demandent d'essayer à nouveau; vérifiez la tâche avant de réessayer une mise à jour dont le résultat est inconnu. Une mise à jour acceptée actualise le catalogue. Les réponses tardives après la fermeture des détails ou les tâches de commutation ne remplacent pas la vue actuelle.

<a id="timing-and-delivery"></a>

<a id="timing-and-delivery-reference"></a>

## Délai et référence de livraison

Les rappels restent stockés lorsque leur Session n'est pas ouverte. Pendant que l'hôte tourne, il restaure ou crée la session cible lorsqu'un rappel devient dû et fait une file d'attente pour un suivi sans interrompre le travail en cours. Redémarrer vérifie les tâches stockées et envoie une capture en retard ou seulement la dernière occurrence manquée de chaque tâche récurrente. La fermeture de l'hôte cesse de planifier jusqu'à ce qu'il recommence. Les tâches récurrentes dues pour la même session peuvent partager un message.

Une règle répétée dans une zone IANA suit l'heure du mur local : elle saute une heure locale qui n'existe pas et utilise l'instant antérieur d'une heure locale répétée. Les tâches existantes conservent leur chronométrage jusqu'à ce que vous enregistriez une nouvelle règle : un rappel à taux fixe reste aligné sur son heure de création, et un rappel quotidien, hebdomadaire ou cron suit ses heures locales enregistrées dans sa zone IANA. Le navigateur fournit sa zone d'interprétation des requêtes en langage naturel; le nom d'une zone évite explicitement toute ambiguïté. La page des tâches d'automatisation affiche chaque prochaine exécution comme une horloge de zone de navigateur, et la fréquence du texte nomme la zone d'une règle quand elle diffère de la zone du navigateur; une règle qui ne nomme aucune zone utilise la zone du navigateur.

Les dossiers de livraison sauvegardés confirment que les messages ont persisté dans la boîte de réception de la conversation, et non que le modèle a terminé le travail demandé. La persistance de la boîte de réception ou la tâche a échoué écrit ajouter aucun enregistrement enregistré. Une panne d'écrasement ou d'écriture de tâches après la persistance de la boîte de réception peut laisser un message livré non enregistré et répéter une livraison; exactement-une fois la livraison n'est pas garantie. La fermeture de l'hôte rejette chaque message qui attend toujours dans une boîte de dialogue : son enregistrement enregistré reste, le modèle ne reçoit jamais ce message, et l'hôte ne l'envoie plus. Il ne s'agit pas d'un historique d'exécution ou d'un canal de notification externe.

Les enregistrements sauvegardés sont tronqués lorsqu'un accusé de réception est annexé : l'hôte conserve les enregistrements dont le temps de reconnaissance tombe dans la fenêtre `deliveryHistoryDays` configurée, mesurée à partir du `deliveredAt`du reçu annexé, et au plus tard les enregistrements `deliveryHistoryRecords` les plus récents. Le dernier reçu survit toujours, et une fenêtre taillée marque des enregistrements antérieurs indisponibles. L'hôte conserve l'historique conservé en mémoire et réécrit la ligne complète des tâches pour chaque reconnaissance. Les limites de pagination renvoient le nombre d'enregistrements, et non l'historique ou les octets d'instruction conservés.

Le nom, l'instruction, le timing et l'édition de cibles, l'arrêt et la reprise sont disponibles pour le modèle via `schedule_edit` et la page des tâches d'automatisation pour chaque rappel; ni un flux de travail de relais croisé. Un changement ajoute un avis à la demande de modèle suivante de chaque conversation en cause dont l'Agent est chargé, sauf la conversation qui a fait le changement. Les rappels enregistrés uniquement dans un ancien journal de session ne sont pas programmés automatiquement; recréez ceux dont vous avez encore besoin. Les enregistrements des tâches précédemment supprimés ne sont pas reconstruits.

<a id="further-exploration"></a>
## Autres activités d'exploration

- [L'annexe](../../../packages/schedule/schedule/README.md) documente les champs de tâches, les cibles de livraison, les règles de récurrence, la persistance et les limites de livraison.
- [Référence de la page des tâches d'automatisation](../../../packages/client/ui-schedule/README.md) décrit le catalogue global des pages et des en-têtes de conversation.

<a id="dev-note"></a>

## Remarque Dev

Aucune.
