<a id="schedule-reminders"></a>

# Planifier des rappels

<!-- USER_LANGUAGES_START -->
[English](schedule.md) | [中文](schedule.zh.md) | [Русский](schedule.ru.md) | [日本語](schedule.ja.md) | [Español](schedule.es.md) | Français | [Deutsch](schedule.de.md) | [Português](schedule.pt.md) | [한국어](schedule.ko.md)
<!-- USER_LANGUAGES_END -->

<a id="summary"></a>

## Résumé

Dans une conversation, demandez au modèle de créer, lister, afficher, modifier, suspendre, reprendre ou supprimer des rappels. Chaque rappel suit sa règle de répétition et transmet son instruction à une conversation existante, à une nouvelle conversation réutilisée ou à une conversation distincte à chaque occurrence. La page Tâches d’automatisation répertorie tous les rappels de l’hôte et permet de les créer, les modifier, les exécuter, les suspendre, les reprendre et les supprimer. Les tâches ponctuelles restent disponibles après leur envoi tant que vous ne les supprimez pas.

<a id="table-of-contents"></a>

## Table des matières

- [Créer des rappels](#create-reminders)
- [Inspecter, exécuter et supprimer les tâches](#manage-tasks)
- [Modifier une tâche](#edit-timing)
- [Horaires et envoi des rappels](#timing-and-delivery)
- [Pour aller plus loin](#further-exploration)

<a id="create-reminders"></a>
## Créer des rappels

Le profil web fourni contient le service de planification de l’hôte et la page Tâches d’automatisation. Configurez un fournisseur de modèles avant de demander à un modèle de créer des rappels.

Les préréglages `standard`, `cordis` et `ptc` déclarent les quatre outils de rappel et le contexte de l'horloge qui donne au modèle l'heure actuelle et la zone du navigateur, de sorte que ces préréglages fournissent `schedule_create`, `schedule_list`, `schedule_view` et `schedule_edit`; le préréglage `minimal` ne déclare aucun. Un sous-agent délégué voit les quatre outils, mais chaque outil refuse un appel d'un sous-agent délégué, de sorte qu'un sous-agent ne peut pas lire ou modifier des rappels.

Demandez au modèle de créer, de lister, de visualiser, de modifier, de suspendre, de reprendre ou de supprimer des rappels. Il utilise `schedule_create` pour en créer un, `schedule_list` pour lister les rappels de chaque conversation, `schedule_view` pour en lire un, et `schedule_edit` pour en modifier, mettre en pause, reprendre ou en supprimer un; une modification conserve l'identifiant de rappel et les enregistrements de livraison enregistrés. Un rappel que le modèle crée a un nom, une instruction, une heure de départ en UTC ou dans un fuseau horaire IANA, et une règle de répétition RFC 5545, comme chaque jour de semaine à 9h00 ou une seule fois. Il livre à cette conversation, à une nouvelle conversation que sa première livraison crée, ou à une nouvelle conversation à chaque livraison; une nouvelle conversation utilise le répertoire de travail et préréglage de cette conversation. Chaque livraison d'un rappel vient au moins une minute après l'heure prévue de la livraison précédente, ou après la course précédente maintenant; un rappel qui ouvre une nouvelle conversation à chaque livraison attend plutôt l'intervalle d'exécution minimum de l'hôte, une minute par défaut. Une livraison tardive, par exemple après un redémarrage Host, ne retarde pas la prochaine.

Une conversation qu'une livraison crée rejoint le Workspace enregistré dans son répertoire de travail et prend le nom de rappel comme titre. Pour un rappel qui ouvre une nouvelle conversation à chaque livraison, le titre indique également l'heure de lancement dans la zone de la règle du rappel, par exemple `Weekday digest · 2026-10-12 09:00`.

Par exemple, demandez « Rappelle-moi chaque jour à 23 h dans le fuseau Asia/Shanghai de consulter la météo. » Sous la réponse, une carte affiche le nom et la fréquence du rappel. Sélectionnez Ouvrir pour voir ses détails dans la barre latérale droite. Vérifiez que le rappel est programmé tous les jours à 23 h. Un rappel ponctuel ne devient pas récurrent après l’envoi. Une fois le rappel supprimé, la carte affiche Supprimé et ne l’ouvre plus.

Pour créer un rappel sans le modèle, ouvrez les tâches d’automatisation à partir de la barre latérale, ouvrez Choisissez une méthode de création à côté de New, et choisissez Create manuellement ; quand aucune tâche n’existe, Nouvelle tâche d’automatisation ouvre le même éditeur. Cet éditeur ouvre également les tâches existantes et demande un nom de tâche d’automatisation, une instruction de tâche d’automatisation, Exécuter dans, Espace de travail lié, et Durée d’exécution. Il commence par Une fois à une heure à partir de maintenant dans le fuseau horaire du navigateur et avec Créer une conversation et la réutiliser. Exécuter offre Créer une conversation et la réutiliser, ce qui crée une conversation à la première exécution et continue à l’utiliser, et Nouvelle conversation pour chaque exécution, qui crée une conversation séparée à chaque exécution et montre l’intervalle d’exécution minimum de l’hôte. L’espace de travail lié répertorie chaque espace de travail enregistré avec son répertoire et sélectionne l’espace de travail dont le répertoire utilise la nouvelle conversation; il commence à l’espace de travail par défaut, ou au premier espace de travail lorsque l’espace de travail par défaut n’est pas enregistré. Lorsqu’il n’existe pas d’espace de travail, l’espace de travail lié affiche Ungrouped et le répertoire de projet Host est utilisé. La nouvelle conversation utilise le préréglage par défaut. Créer crée la tâche et la sélectionne dans la liste, et Distard ferme l’éditeur sans en créer une. Si l’Host refuse la tâche, l’éditeur conserve votre entrée et indique le problème, par exemple que la date et l’heure doivent être dans l’avenir.

Nouveau, et Créer dans une conversation dans le même menu, ouvrir une nouvelle conversation dans l’espace de travail actuel ou le plus récent; demander au modèle là-bas de créer la tâche.

<a id="manage-tasks"></a>

<a id="inspect-run-and-delete-tasks"></a>

## Inspecter, exécuter et supprimer les tâches

Demandez au modèle de lister les rappels de toutes les conversations, avec les rappels actifs en premier. Vous pouvez aussi lui demander d’afficher, de suspendre, de reprendre ou de supprimer un rappel en indiquant son identifiant.

Ouvrez Tâches d’automatisation depuis la barre latérale pour voir les rappels de toutes les sessions sans ouvrir leurs conversations. Effectuez une recherche par nom de tâche, instruction ou identifiant de conversation. Le filtre d’état propose Toutes, Activées, En pause ou Terminées. Les lignes sont classées par heure planifiée, de la plus proche à la plus lointaine. Chaque ligne affiche le nom de la tâche ainsi qu’un résumé indiquant l’état si la tâche est en pause ou terminée, sa fréquence et, si elle est active, l’heure locale de la prochaine exécution et le temps restant.

Les tâches d’une session comprennent celles qui lui envoient des rappels, y compris la dernière exécution d’une tâche qui crée une conversation pour chaque exécution, ainsi que celles que son agent a créées ou modifiées. Une horloge apparaît dans la ligne d’une session inactive et non archivée qui compte au moins une tâche active. Pour une session archivée, la cellule reste vide et l’état actuel apparaît uniquement dans l’infobulle. Laissez le pointeur sur la ligne d’une session qui compte des tâches actives pour en voir jusqu’à deux, avec leur fréquence, l’heure de la prochaine exécution dans le fuseau de l’appareil et le temps restant. L’en-tête de la session ouverte affiche une icône d’horloge tant qu’il existe des tâches actives. Elle ouvre les détails de la tâche unique dans la barre latérale droite, ou la liste des tâches si elles sont plusieurs. Dans cette liste, chaque ligne permet d’ouvrir les détails ou de supprimer la tâche.

Sélectionnez une tâche pour ouvrir ses détails. La section Règles affiche son nom, la prochaine exécution en heure locale et le temps restant ou l’état si la tâche est en pause ou terminée, ainsi que l’instruction, la fréquence et la destination. Pour une tâche qui envoie les rappels à une conversation existante, la destination indique Conversation actuellement liée. En bas des détails, la section Session liée ou Conversation de la dernière exécution indique la conversation associée. Son bouton ouvre la session si elle est disponible et non archivée. Avant la première exécution, la section affiche En attente de création. Pour une destination existante, la section Règles indique si la conversation est archivée, indisponible ou en cours de chargement. Les détails et la suppression de la tâche restent accessibles même si la conversation ne peut pas s’ouvrir. Consulter une tâche ne désarchive aucune session.

Sélectionnez Historique pour charger les 20 entrées les plus récentes. Chaque entrée présente l’heure de l’occurrence dans le fuseau de la règle, ou celui du navigateur si la règle n’en précise pas, un bouton pour ouvrir la conversation destinataire si elle est disponible et l’instruction enregistrée. Développer affiche les instructions longues en entier. Une entrée sans instruction enregistrée laisse ce champ vide même si la tâche possède une instruction actuelle. Charger plus affiche la page suivante. Les entrées conservent leur ordre d’enregistrement, de la plus récente à la plus ancienne, même si l’horloge recule. Elles n’indiquent pas les résultats de l’exécution par le modèle. Les touches Flèche gauche, Flèche droite, Début et Fin déplacent le focus entre les onglets.

Une vue d’enregistrement vide signifie qu’une requête réussie n’a pas été renvoyée. Chargement, échec de la requête, une tâche manquante, et un curseur d’enregistrement plus ancien invalide ont des messages séparés. Utilisez Reessayer après une requête manquée ou une réponse manquante; utilisez Refraîchir après un curseur invalide pour recharger la page la plus récente. Les enregistrements déjà chargés peuvent rester visibles avec un avertissement alors qu’une demande échoue. Une nouvelle livraison rafraîchit la dernière page. Les réponses tardives pour une tâche ou une vue laissée ne remplacent pas la vue actuelle.

Lorsque la conservation a été retirée, la dernière page indique que les dossiers de livraison antérieurs ont été effacés, et les règles de conservation indiquent le nombre de dossiers et le nombre de jours que chaque tâche conserve. Une tâche plus ancienne sans historique enregistré ne montre que sa dernière livraison, sans instruction, jusqu’à ce que de nouvelles livraisons ajoutent des enregistrements. Les enregistrements antérieurs et les instantanés d’instruction non enregistrés ne peuvent pas être récupérés.

Les tâches actives participent à la planification. Les tâches interrompues et terminées ne prévoient pas une autre livraison. Une tâche ponctuelle se termine après que son rappel soit durablement écrit à la boîte de réception de la conversation, et une tâche répétée se termine après la dernière occurrence de sa règle; choisissez Tout ou Terminé dans l’état de la tâche pour trouver une tâche terminée. L’en-tête Session, la ligne et la carte hover n’affichent que des tâches actives, donc la disparition de ces vues ne signifie pas que la tâche a été supprimée.

Dans les détails, Mettre en pause arrête les futurs envois d’une tâche active et Reprendre réactive une tâche en pause. Dans le menu Actions de la tâche d’automatisation, Exécuter maintenant demande à l’hôte d’envoyer l’instruction une fois immédiatement. Cela conserve la prochaine exécution planifiée, même pour une tâche en pause ou terminée. Lorsqu’un envoi vers une conversation existante ou une seule nouvelle conversation est en attente ou en cours, les champs et les commandes Enregistrer les modifications, Mettre en pause, Reprendre, Exécuter maintenant et Supprimer la tâche sont désactivés. Les détails signalent l’état et indiquent que vous pouvez le gérer dans la conversation, accessible par le bouton en bas. Les tâches qui créent une conversation par exécution échappent à ce blocage. Leurs exécutions peuvent se chevaucher. Après un envoi, Exécuter maintenant reste désactivé jusqu’à la fin de l’intervalle minimal entre deux envois. Si seul cet intervalle bloque l’action, survolez le bouton ou placez-y le focus au clavier pour savoir quand il sera de nouveau disponible. Si l’hôte refuse une exécution pour l’une de ces raisons, les détails indiquent que la tâche est en attente, en cours ou vient de transmettre un rappel. Exécuter maintenant est également désactivé lorsque la conversation destinataire est archivée. Si vous arrêtez la conversation pendant que l’instruction de la tâche y attend, elle reste en file d’attente jusqu’à ce que votre prochain message, la prochaine exécution planifiée ou Exécuter maintenant lance le traitement.

Dans le menu Actions de la tâche d’automatisation, sélectionnez Supprimer la tâche et confirmez pour arrêter les futurs envois et retirer la tâche de la liste, même si elle est en pause ou terminée. La suppression efface aussi ses entrées d’historique. Après confirmation, une seule notification dans l’application signale le résultat. En cas de réussite, les détails se ferment. En cas d’échec, la tâche reste en place afin que vous puissiez réessayer. La suppression ne retire aucune conversation et ne rappelle aucun message déjà en file d’attente. La ligne reste visible jusqu’à ce qu’une requête réussie confirme les tâches restantes. Si la requête échoue, sélectionnez Réessayer pour recharger le catalogue. Un échec de requête ne signifie pas que la liste est vide.

<a id="edit-timing"></a>

<a id="edit-a-task"></a>

## Modifier une tâche

Demandez au modèle de changer le nom, l’instruction, la règle de répétition ou la cible de livraison d’un rappel, ou de le suspendre ou de le reprendre; le changement conserve l’identifiant de rappel et enregistre les dossiers de livraison.

Dans les tâches d’automatisation, sélectionnez une tâche pour changer son nom de tâche d’automatisation, instructions d’automatisation des tâches, Exécuter dans, Espace de travail lié, et Durée d’exécution, y compris pour une tâche interrompue ou terminée. Les éditions restent dans un brouillon local jusqu’à ce que vous choisissiez Enregistrer les modifications. L’édition conserve l’identifiant de tâche, le dernier reçu de livraison et tous les enregistrements de livraison enregistrés. Une règle modifiée rend une tâche terminée active à nouveau et maintient une tâche interrompue. Pour une tâche qui livre à une conversation existante, Exécuter dans affiche Conversation en relation avec le courant; choisir une autre option permet de lancer plus tard de créer leurs conversations et de définir l’espace de travail lié à sa valeur de départ, comme dans Créer manuellement. Une tâche conserve son préréglage stocké pendant que son Workspace reste le même ; un Workspace modifié utilise le préréglage par défaut.

- Une fois : La date ouvre un calendrier de mois, l’heure ouvre les colonnes Heure, Minute et Deuxième, et le fuseau horaire les interprète. La tâche s’exécute une fois et se termine.
- Toutes les N minutes ou Toutes les N heures. Intervalle indique un nombre de minutes ou d’heures, au minimum 1. L’intervalle commence à la minute à laquelle vous enregistrez la tâche.
- Chaque jour : Interval fixe le nombre de jours, et Time ouvre les colonnes Heure et Minute.
- Semaine et du lundi au vendredi: Interval fixe le nombre de semaines, le jour de la semaine sélectionne les jours, et l’heure ouvre Heure, Minute et Deuxième colonnes. Du lundi au vendredi sélectionne ces cinq jours à la fois.
- Mensuel : Intervalle fixe le nombre de mois, le jour du mois choisit une date de 1 à 31 et l’heure ouvre les colonnes Heure, Minute et Deuxième. Un mois sans la date sélectionnée tourne sur son dernier jour.
- Custom: Custom rule tient le texte de la règle. Une règle que les autres choix ne peuvent pas reproduire s’ouvre dans Custom. Une tâche existante sans texte de règle modifiable affiche sa fréquence d’origine et garde ce timing jusqu’à ce que vous sauvegardez un remplacement.

Le fuseau horaire énumère les zones récemment sélectionnées d’abord, marque la zone système, et les recherches par décalage UTC, IANA ID, ou ville. Il apparaît pour les choix guidés et les expressions personnalisées qui utilisent une zone séparée; sinon le texte de la règle personnalisée fournit sa zone.

Ces champs modifient uniquement le brouillon local. Si la tâche cible une conversation existante, l’option Session actuellement liée reste disponible pour annuler le changement de destination sans perdre les autres modifications. Pendant la modification, la mention Modifications non enregistrées apparaît en bas des détails avec Annuler et Enregistrer les modifications. Enregistrer les modifications transmet uniquement les champs modifiés en une seule opération. Annuler rétablit les valeurs enregistrées. Une nouvelle règle est envoyée uniquement si la planification a changé. Pour activer l’enregistrement, modifiez au moins une valeur et vérifiez que les champs et la planification sont valides. Si le texte de la règle personnalisée est invalide, le brouillon est conservé et un message indique comment le corriger. L’hôte valide également la règle à l’enregistrement. Enregistrez ou annulez vos modifications avant de suspendre, reprendre, exécuter ou supprimer la tâche. Les champs sont désactivés pendant l’enregistrement. Fermer les détails n’annule pas une écriture déjà engagée par l’hôte.

Changer de tâches ou laisser la page conserve des ébauches non enregistrées. Un catalogue rafraîchit un formulaire vierge; un formulaire édité conserve tous les champs et leur version originale. Si la livraison ou une autre modification modifie la tâche, les détails indiquent que la tâche a changé ailleurs et désactiver Enregistrer les changements lorsque la version plus récente arrive. L’hôte vérifie également la version en cours d’enregistrement. L’examen avec mes modifications maintient le titre, l’invite, le timing et les groupes cibles que vous avez changés et charge les dernières valeurs pour les autres groupes. Examiner le formulaire entier avant de sauvegarder; cette action seule ne sauve pas. Si le même groupe a changé ailleurs, vos modifications ont priorité dans le formulaire. Jeter remplace le brouillon entier par les dernières valeurs stockées. Si une autre sauvegarde échoue, le brouillon reste et les détails vous demandent d’essayer à nouveau; vérifiez la tâche avant de réessayer une mise à jour dont le résultat est inconnu. Une mise à jour acceptée actualise le catalogue. Les réponses tardives après la fermeture des détails ou les tâches de commutation ne remplacent pas la vue actuelle.

<a id="timing-and-delivery"></a>

<a id="timing-and-delivery-reference"></a>

## Horaires et envoi des rappels

Les rappels restent enregistrés même si leur session est fermée. Lorsque l’hôte fonctionne, il restaure ou crée la session cible à l’échéance du rappel et place un message de suivi dans la file d’attente, sans interrompre le travail en cours. Au redémarrage, il examine les tâches enregistrées et envoie tout rappel ponctuel en retard, ou seulement la dernière occurrence manquée de chaque tâche récurrente. La planification s’arrête lorsque vous fermez l’hôte et reprend au prochain démarrage. Plusieurs tâches récurrentes arrivées à échéance pour la même session peuvent partager un seul message.

Une règle récurrente dans un fuseau IANA suit l’heure locale. Elle ignore une heure locale inexistante et choisit la première occurrence d’une heure répétée. Les tâches existantes conservent leurs horaires jusqu’à l’enregistrement d’une nouvelle règle. Un rappel à intervalle fixe reste calé sur son heure de création. Un rappel quotidien, hebdomadaire ou cron suit les heures locales enregistrées dans son fuseau IANA. Le navigateur fournit le fuseau utilisé pour interpréter les demandes en langage naturel. Précisez le fuseau pour lever toute ambiguïté. La page Tâches d’automatisation affiche la prochaine exécution dans le fuseau du navigateur et précise le fuseau de la règle dans le texte de fréquence lorsqu’il diffère. Une règle sans fuseau explicite utilise celui du navigateur.

Les entrées de l’historique d’envoi confirment que les messages ont été enregistrés dans la boîte de réception de la conversation. Elles ne renseignent pas sur l’exécution du travail demandé par le modèle. Si l’enregistrement dans la boîte de réception ou l’écriture de la tâche échoue, aucune entrée n’est ajoutée. Un arrêt brutal ou un échec d’écriture de la tâche après l’enregistrement du message dans la boîte de réception peut laisser un envoi sans entrée dans l’historique et entraîner un nouvel envoi. L’envoi exactement une fois n’est pas garanti. À la fermeture de l’hôte, chaque message qui attend encore dans une boîte de réception est abandonné. Son entrée reste dans l’historique, le modèle ne reçoit jamais le message et l’hôte ne le renvoie pas. Cet historique ne retrace pas les exécutions et ne sert pas de canal de notification externe.

Lorsque l’hôte ajoute un accusé de réception, il purge les anciennes entrées. Il conserve les entrées dont l’heure d’accusé de réception se situe dans la période configurée par `deliveryHistoryDays`, calculée à rebours depuis le `deliveredAt` du nouvel accusé, dans la limite des `deliveryHistoryRecords` entrées les plus récentes. Le dernier accusé reste toujours disponible. Après une purge, les entrées antérieures sont signalées comme indisponibles. L’hôte conserve l’historique en mémoire et réécrit toute l’entrée de la tâche à chaque accusé. La pagination limite le nombre d’entrées renvoyées. Elle ne réduit ni l’historique conservé ni le volume des instructions.

Pour chaque rappel, le modèle peut utiliser `schedule_edit`, et l’utilisateur la page Tâches d’automatisation, pour modifier le nom, l’instruction, les horaires ou la destination, ou pour suspendre ou reprendre le rappel. Ces fonctions ne relaient pas les messages entre sessions. Une modification ajoute un avis à la prochaine requête de chaque conversation concernée dont l’agent est chargé, sauf dans la conversation qui a effectué la modification. Les rappels uniquement présents dans un ancien journal de session ne sont pas replanifiés automatiquement. Recréez ceux dont vous avez encore besoin. Les entrées des tâches supprimées ne sont pas reconstituées.

<a id="further-exploration"></a>
## Pour aller plus loin

- La [référence de planification](../../../packages/schedule/schedule/README.md) décrit les champs des tâches, les destinations, les règles de répétition, la persistance et les limites d’envoi.
- [Référence de la page des tâches d'automatisation](../../../packages/client/ui-schedule/README.md) décrit le catalogue global des pages et des en-têtes de conversation.

<a id="dev-note"></a>

## Note de développement

Aucune.
