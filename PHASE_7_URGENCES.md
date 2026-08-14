# Phase 7: Service d'Accueil des Urgences

## Contexte

La phase 6 a livre une soupape, pas une gestion des urgences.

Un `grep URGENT` sur le backend d'apres phase 6 rendait neuf lignes, et elles ne
faisaient que deux choses : remonter le patient en tete de la file d'attente, et
autoriser le medecin a le prendre en charge sans reglement. Tout le reste
manquait :

- **aucun triage.** N'importe quel agent d'accueil cochait « urgence ». Le
  patient presse et le vrai niveau 1 etaient traites pareil, et personne ne
  reevaluait ;
- **un contournement, pas un circuit.** Une vraie urgence arrive parfois sans
  identite, hors heures d'ouverture de l'accueil, et doit etre prise en charge
  *avant* l'enregistrement administratif, pas apres ;
- **aucune redevabilite.** La derogation n'etait tracee que par un `logger.warn`
  dans un fichier ;
- **le drapeau n'expirait jamais** et ne se recalculait pas.

Cette phase construit le circuit distinct :

```
[ARRIVEE 24h/24]
    |
    v
[ADMISSION] dossier ouvert, identite reelle OU designation provisoire
    |
    v
[TRIAGE] infirmier, echelle 1-5, revisable
    |
    v
[PRISE EN CHARGE] medecin — jamais conditionnee au reglement
    |
    v
[SORTIE] domicile | hospitalisation | transfert | contre avis | deces
    |
    v
[CAISSE] creance ouverte a l'identification, regularisee apres
```

## Objectifs

- Modeliser un passage aux urgences comme une entite propre, distincte du passage
  ambulatoire
- Permettre la prise en charge **avant identification**, avec regularisation
  ulterieure
- Introduire un triage a cinq niveaux, pose par un soignant et revisable
- Numeroter les dossiers 24h/24, sans dependre d'une ouverture de guichet
- Ouvrir systematiquement une creance, sans jamais qu'elle conditionne un soin
- Donner au service la vue dont il a besoin : qui attend, depuis combien de
  temps, et a quelle gravite

## Prerequis

- Phase 6 completee : la facture et le mecanisme de creance differee sont le
  socle sur lequel se branche la facturation des urgences

## Decisions actees

| Question | Decision |
|---|---|
| Entite | **`EmergencyCase`, distincte de `Visit`.** Les deux ne suivent pas les memes regles (voir tableau ci-dessous) |
| Identite | **Facultative a l'admission.** Un patient inconscient s'admet sous designation provisoire |
| Triage | **Acte clinique**, reserve au nouveau role `NURSE`, au medecin et a l'administrateur. L'accueil peut admettre, pas coter |
| Dossier non trie | **Passe devant tout le monde.** Personne ne l'a evalue, il peut aussi bien etre un niveau 1 |
| Recotation | **Toujours possible** tant que le patient est dans le service |
| Paiement | **Jamais bloquant.** Aucune verification a la prise en charge |
| Emission de la facture | **A l'identification**, ou a defaut a la sortie. Avant, il n'y a personne a qui la presenter |
| Statut de la creance | **Differee des l'emission** : la contrepartie a deja ete delivree |
| Echec de facturation | **Non bloquant.** Il ne doit jamais empecher de sortir un patient |
| Fin de passage | **Un mode de sortie**, pas une cloture. Un passage aux urgences s'oriente |

### Pourquoi une entite distincte et non un drapeau sur `Visit`

| | Passage ambulatoire | Dossier d'urgence |
|---|---|---|
| Identite | connue avant l'ouverture | parfois inconnue, regularisee apres |
| Horaire | heures d'ouverture de l'accueil | 24h/24 |
| Ordre d'appel | numero d'arrivee | gravite du triage |
| Paiement | du avant la consultation | jamais bloquant |
| Fin | fin de consultation | mode de sortie |

Plaquer ces regles sur `Visit` aurait impose des exceptions partout dans le
circuit ambulatoire, pour un cas qui n'est pas une exception mais un autre
metier.

---

## Backend

### 1. [x] Role `NURSE` (`utils/roles.js`)

Le triage est un acte clinique, pas un geste de guichet. Laisser l'accueil coter
la gravite reviendrait a faire evaluer un patient par quelqu'un qui n'a pas
qualite pour le faire — c'est exactement le defaut du drapeau `URGENT` de la
phase 6.

```js
const ROLES = ['RECEPTIONIST', 'NURSE', 'DOCTOR', 'CASHIER', ...SERVICE_ROLES, 'ADMIN'];
const EMERGENCY_ROLES = ['NURSE', 'DOCTOR', 'ADMIN'];
```

### 2. [x] Modele `EmergencyCase` (`models/EmergencyCase.js`)

```js
id                UUID PK
caseNumber        STRING(30) UNIQUE          // URG-YYYYMMDD-0001
// Identite
patientId         UUID FK patients NULL      // NULL tant que non identifie
provisionalLabel  STRING(150) NULL           // "Homme, environ 40 ans, inconscient"
// Arrivee
arrivalAt         DATE NOT NULL
arrivalMode       ENUM('WALK_IN','AMBULANCE','REFERRAL','LAW_ENFORCEMENT','OTHER')
chiefComplaint    TEXT NULL
// Triage
triageLevel       INTEGER NULL               // 1 (reanimation) a 5 (non urgent)
triagedBy         UUID FK users NULL
triagedAt         DATE NULL
triageNotes       TEXT NULL
// Constantes
weightKg, heightCm, temperatureC, bloodPressureSys, bloodPressureDia, pulseBpm
oxygenSaturation  INTEGER NULL               // absente du passage ambulatoire
// Prise en charge
status            ENUM('AWAITING_TRIAGE','WAITING','IN_CARE','DISCHARGED','LEFT_WITHOUT_CARE')
doctorId          UUID FK users NULL
startedAt         DATE NULL
// Sortie
outcome           ENUM('HOME','ADMISSION','TRANSFER','AGAINST_ADVICE','DECEASED') NULL
outcomeNotes      TEXT NULL
completedAt       DATE NULL
// Tracabilite
registeredBy      UUID FK users NOT NULL
notes             TEXT NULL

indexes:
  UNIQUE (caseNumber)          name: emergency_cases_number
         (status, triageLevel) name: emergency_cases_status_triage
         (patientId)           name: emergency_cases_patient
         (arrivalAt)           name: emergency_cases_arrival
```

`patientId` nullable est le point central du modele. `provisionalLabel` sert a
nommer le patient dans la file et sur les documents ; il n'est jamais promu en
identite reelle, et il est conserve apres identification — il documente sous quel
libelle le patient a ete soigne, ce que les comptes rendus rediges pendant le
sejour continuent de porter.

`oxygenSaturation` n'existe pas sur `Visit` : c'est l'une des constantes qui font
basculer un triage d'un niveau a l'autre.

### 3. [x] Numerotation 24h/24

`caseNumber` passe par `sequenceService` avec la cle `EMERGENCY` et la date
calendaire. Le service ne depend d'aucune ouverture de guichet : contrairement a
un ticket de passage, un dossier d'urgence s'ouvre a 3 h du matin.

### 4. [x] Facturation (`services/emergencyBillingService.js`)

Trois regles, qui decoulent toutes de la meme idee : **aux urgences, l'argent ne
conditionne jamais le soin**.

1. La facture n'est jamais emise avant la prise en charge. Elle l'est a
   l'identification du patient, ou a defaut a la sortie.
2. Elle nait **differee** : la contrepartie a deja ete delivree, la creance est
   suivie a la caisse comme une regularisation.
3. Son absence ne bloque rien. Un dossier jamais identifie reste soignable,
   consultable et cloturable ; il remonte dans la liste des dossiers a
   regulariser.

`tryEnsureEmergencyInvoice` journalise l'echec au lieu de le propager : une
facturation qui plante ne doit pas empecher de sortir un patient.

Le forfait d'admission se lit dans la grille de la phase 6, ligne
`visitType = 'EMERGENCY'` sans specialite. Meme referentiel parce que c'est le
meme geste administratif — un droit d'entree dans un circuit de soins — et qu'un
second referentiel se serait desynchronise du premier.

Valeurs ajoutees aux ENUM existants : `Invoice.invoiceType`,
`InvoiceLine.lineType` et `ConsultationTariff.visitType` recoivent `EMERGENCY`.

### 5. [x] Controleur (`controllers/emergencyController.js`)

| Methode | Role | Comportement |
|---|---|---|
| `create` | NURSE, DOCTOR, ADMIN, RECEPTIONIST | Ouvre un dossier. `patientId` **ou** `provisionalLabel` obligatoire. Triage possible des l'admission |
| `getQueue` | + CASHIER | Dossiers encore dans le service, toutes dates d'arrivee confondues |
| `getById` | + CASHIER | Detail, factures incluses |
| `triage` | NURSE, DOCTOR, ADMIN | Pose ou revise le niveau et les constantes |
| `take` | DOCTOR, ADMIN | `WAITING`/`AWAITING_TRIAGE` -> `IN_CARE`. **Aucune verification de paiement** |
| `discharge` | DOCTOR, ADMIN | `IN_CARE` -> `DISCHARGED` avec mode de sortie |
| `identify` | NURSE, DOCTOR, ADMIN, RECEPTIONIST, CASHIER | Rattache un patient reel et ouvre la creance |
| `leave` | NURSE, DOCTOR, ADMIN, RECEPTIONIST | Patient parti sans etre vu |
| `getUnidentified` | + CASHIER | Dossiers dont la creance n'a jamais pu etre ouverte |

Points d'attention :

- **Ordre d'appel.** `AWAITING_TRIAGE` d'abord, puis `triageLevel` croissant,
  puis anciennete. Faire attendre un dossier non cote derriere des patients cotes
  reviendrait a decider de sa gravite sans l'avoir vu.
- **File sans filtre de date.** Un patient arrive a 23 h 50 est toujours la a
  00 h 10 ; il ne doit pas disparaitre de l'ecran au passage de minuit.
- **Recotation.** Elle ne renvoie pas en attente un patient deja pris en charge :
  elle met a jour la gravite, pas l'etape du parcours.
- **Concurrence.** La condition de statut fait partie du `UPDATE` de `take` : si
  deux medecins cliquent sur le meme dossier, un seul voit une ligne modifiee.
- **`leave` est un etat, pas une annulation.** Un patient qui repart avant d'etre
  examine est un evenement que le service doit pouvoir compter.

### 6. [x] Routes (`routes/emergencies.js`)

```
POST   /api/emergencies                  NURSE, DOCTOR, ADMIN, RECEPTIONIST
GET    /api/emergencies/queue            + CASHIER
GET    /api/emergencies/unidentified     + CASHIER
GET    /api/emergencies/:id              + CASHIER
PATCH  /api/emergencies/:id/triage       NURSE, DOCTOR, ADMIN
PATCH  /api/emergencies/:id/take         DOCTOR, ADMIN
PATCH  /api/emergencies/:id/discharge    DOCTOR, ADMIN
PATCH  /api/emergencies/:id/identify     + RECEPTIONIST, CASHIER
PATCH  /api/emergencies/:id/leave        + RECEPTIONIST
```

L'accueil peut ouvrir un dossier : la nuit ou l'infirmier est au chevet d'un
patient, refuser l'admission a l'agent present retarderait la prise en charge. Il
ne peut en revanche pas coter le triage.

La caisse accede a la file et aux dossiers non identifies : ce sont les creances
qu'elle n'a aucun moyen de reclamer tant que le dossier n'est pas rattache.

### 7. [x] Pastille de navigation (`controllers/statsController.js`)

`badges.emergency` compte les dossiers encore dans le service, pour `NURSE`,
`DOCTOR` et `ADMIN`.

---

## Frontend

### 8. [x] Referentiel de triage (`pages/emergency/triage.js`)

Echelle a cinq niveaux, ses couleurs, ses delais cibles, les modes d'arrivee et
les modes de sortie. Les couleurs ne sont pas decoratives : c'est par elles qu'un
infirmier lit sa file en une seconde depuis l'autre bout de la piece. Elles
suivent la convention habituelle (rouge, orange, jaune, vert, bleu).

| Niveau | Libelle | Delai cible |
|---|---|---|
| 1 | Reanimation | immediat |
| 2 | Tres urgent | 20 min |
| 3 | Urgent | 60 min |
| 4 | Peu urgent | 120 min |
| 5 | Non urgent | 240 min |

`isOverdue()` croise le delai cible et le temps d'attente : c'est le croisement
des deux qui signale un probleme, pas l'un des deux seul.

### 9. [x] Admission (`pages/emergency/EmergencyAdmission.jsx`)

Deux entrees : patient retrouve au fichier, ou patient decrit. La seconde n'est
pas un cas degrade a eviter, c'est le cas normal d'une arrivee en ambulance.

Le triage est proposable des l'admission quand l'infirmier accueille lui-meme le
patient ; sans cotation, le dossier passe en tete de file en attente
d'evaluation, et l'ecran le dit.

### 10. [x] File (`pages/emergency/EmergencyQueue.jsx`)

Lignes colorees par niveau de gravite, dossiers non tries surlignes en tete,
temps d'attente en rouge quand le delai cible est depasse. Actions filtrees par
role : l'infirmier trie, recote et identifie ; le medecin prend en charge et fait
sortir.

Trois dialogues : triage (niveau + constantes + observations), sortie
(orientation + observations), identification (recherche patient).

### 11. [x] Espace (`pages/emergency/EmergencyDashboard.jsx`)

La file est le premier onglet, et non l'admission : le personnel passe sa journee
a surveiller qui attend, pas a saisir des arrivees.

Quatre compteurs : patients dans le service, en attente de triage, pris en
charge, dossiers non identifies. Un troisieme onglet liste les dossiers jamais
identifies — sans lui, ils n'apparaitraient nulle part une fois le patient sorti.

### 12. [x] Cablage du role

`App.js` (route `/emergency/*`), `MainLayout` (libelle, couleur, entree de
navigation placee avant l'espace medecin), `Login` (redirection), `Dashboard`
(carte), `UserManagement` (role selectionnable), seed (`infirmier@chu-tokoin.tg`).

---

## Compatibilite avec l'existant

- `Visit.priority = URGENT` est conserve : il garde son sens pour une
  consultation externe qu'on fait passer devant, et reste la soupape du circuit
  ambulatoire. Il ne pretend plus couvrir les urgences.
- Aucun changement sur l'accueil, la caisse, les services, les resultats et le
  portail patient.
- Les creances d'urgence rejoignent l'ecran « Creances » de la caisse et le suivi
  administrateur livres au complement de la phase 6, sans code supplementaire.

## Recette

1. [x] Admission sans identite, sous designation provisoire, mode ambulance
2. [x] Le dossier nait `AWAITING_TRIAGE` et aucune facture n'est emise
3. [x] Une admission sans identite ni designation est refusee
4. [x] L'accueil ne peut pas coter le triage (403)
5. [x] Prise en charge immediate, sans reglement, sur un dossier non identifie
6. [x] Un dossier non trie passe devant un dossier cote niveau 4
7. [x] Triage pose par l'infirmier : le dossier passe en `WAITING`
8. [x] Recotation a la hausse possible, et la file se reordonne
9. [x] Les dossiers non identifies sont listes
10. [x] Le rattachement d'un patient ouvre la creance au montant du forfait
11. [x] La creance nait marquee a regulariser, avec son motif
12. [x] Une seconde identification du meme dossier est refusee
13. [x] La creance remonte dans les creances a regulariser de la caisse
14. [x] Sortie avec orientation ; une seconde sortie est refusee
15. [x] Depart sans etre vu enregistre comme tel
16. [x] Les dossiers cloture quittent la file
17. [x] La creance d'urgence s'encaisse comme les autres

Verifie egalement dans le navigateur : connexion infirmier redirigee vers
l'espace urgences, file triee par gravite avec les non tries en tete, compteurs,
formulaire d'admission dans ses deux modes, actions filtrees par role.

## Ordre d'execution suggere

Backend 1-3 (role et modele) -> 4 (facturation) -> 5-6 (API) -> verification a la
main -> 7 (pastille) -> 8-11 (interfaces) -> 12 (cablage) -> recette.

---

## Etat de la mise en oeuvre

Phase implementee et verifiee le 14/08/2026. Les 12 etapes sont livrees.

### Defauts trouves par la recette

1. **Le forfait d'urgences ne pouvait pas etre cree.** L'ENUM du modele avait
   recu `EMERGENCY`, le validateur de route etait reste sur
   `['CONSULTATION', 'RESULT_REVIEW']`. Le tarif etait rejete en 400, donc aucune
   creance n'etait ouverte a l'identification — un echec silencieux, puisque la
   facturation est volontairement non bloquante. Le menu deroulant de
   l'administration souffrait du meme oubli.
2. **La facture renvoyee se disait encore due au guichet.** `issueInvoice` rend
   l'instance lue avant le marquage differe ; l'appelant recevait donc
   `isDeferred = false` alors que la base disait le contraire. La facture est
   desormais rechargee apres marquage.

### Regression corrigee

`npm run seed` etait casse. `sync({ force })` ne sait pas ordonner les
suppressions quand le graphe des references comporte un cycle
(`visits` <-> `prescriptions`) : il supprimait dans un ordre arbitraire et
echouait sur `DROP TABLE specialties`, encore referencee par `users` et `visits`
depuis la phase 6. La base restait en l'etat et le seed ne se terminait jamais.

`syncDatabase` vide desormais le schema a la main avant une reconstruction, cles
etrangeres desactivees, dans une transaction qui epingle une connexion unique —
`FOREIGN_KEY_CHECKS` etant une variable de session, le pool servirait sinon les
`DROP` sur des connexions ou elle est restee active. Verifie sur une base jetable
plutot que sur la base de developpement.

### Ecarts par rapport au plan

- **Le role `NURSE` n'etait pas prevu au depart.** Il s'est impose des lors que
  le triage devenait un acte clinique : sans lui, il aurait fallu le confier a
  l'accueil, c'est-a-dire reproduire le defaut que cette phase corrige.
- **`getUnidentified` a ete ajoute en cours de route.** Sans cet ecran, un
  dossier jamais identifie disparaissait completement apres la sortie du patient,
  et sa creance avec lui.

### Reste a faire

- Le forfait d'urgences est unique et forfaitaire. Une tarification par niveau de
  gravite, ou l'exoneration des niveaux 1-2, releve de regles que
  l'etablissement n'a pas encore arretees.
- `outcome = 'ADMISSION'` enregistre l'orientation vers une hospitalisation mais
  ne cree aucun sejour : le module d'hospitalisation (lits, chambres, prix de
  journee) reste a construire. C'est le rattachement naturel de cette valeur.
- Aucun compte rendu de passage aux urgences n'est produit. Le dossier porte les
  constantes, le triage et les observations de sortie, pas un document.
- Le delai cible par niveau n'est pas administrable : il vit dans
  `pages/emergency/triage.js`.
