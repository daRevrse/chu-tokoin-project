# Phase 5: Accueil, Passages et File d'Attente

## Contexte

Le circuit actuel demarre au milieu du parcours reel : le medecin cree lui-meme le
patient (`POST /api/patients` est restreint a `DOCTOR, ADMIN`) puis la prescription.
L'arrivee du patient a l'hopital n'est modelisee nulle part, et il n'existe aucune
file d'attente.

Cette phase ajoute le segment amont du circuit :

```
[ACCUEIL] enregistrement + ticket  ->  [MEDECIN] consultation + prescription
   |                                        |
   +--> Visit (passage du jour)             +--> Prescription (existant)
                                                   |
                                            [CAISSE] -> [SERVICES] -> [RESULTATS]
```

## Objectifs

- Creer le role `RECEPTIONIST` (accueil / infirmier de reception)
- Introduire l'entite `Visit` (passage) : un patient = N passages
- Numeroter les passages avec un compteur journalier global remis a zero chaque jour
- Offrir une file d'attente consultable en temps quasi reel cote accueil et cote medecin
- Retirer au medecin la creation de patient et la rattacher a l'accueil
- Rattacher les prescriptions au passage qui les a produites

## Prerequis

- Phases 0-4 completees
- MySQL (le compteur atomique ci-dessous utilise une syntaxe specifique MySQL)

## Decisions actees

| Question | Decision |
|---|---|
| Portee du compteur | **Global par jour**, un seul numero pour tout l'etablissement |
| Roles accueil | **Un seul role `RECEPTIONIST`** (pas de role infirmier distinct) |
| Cle d'identification | UUID du `Visit` ; le numero de ticket est un identifiant d'affichage |
| Fin du passage | A la fin de la consultation ; l'aval reste suivi par `Prescription` |

### Pourquoi le statut du passage s'arrete a la consultation

`Prescription.status` (`PENDING -> PAID -> IN_PROGRESS -> COMPLETED`) modelise deja
tout l'aval. Dupliquer ces etats sur `Visit` creerait deux machines a etats a garder
synchronisees. `Visit` couvre donc uniquement : arrivee -> prise en charge -> fin de
consultation. Le suivi caisse/services se lit via les prescriptions rattachees.

---

## Backend

### 1. [x] Compteur journalier atomique (`models/DailyCounter.js`)

Le pattern actuel du projet (`Model.count()` + timestamp, cf. `models/Patient.js`)
n'est pas sur en concurrence : deux agents d'accueil qui enregistrent simultanement
peuvent obtenir le meme numero. Pour un compteur qui doit etre exact et sans trou,
il faut un increment atomique.

```js
// models/DailyCounter.js
const DailyCounter = sequelize.define('DailyCounter', {
  counterDate: { type: DataTypes.DATEONLY, primaryKey: true },
  lastValue:   { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
}, { tableName: 'daily_counters', timestamps: true });
```

```js
// services/ticketService.js — version retenue apres correction du deadlock
const reserveTicketNumber = async (businessDate) => {
  // 1. Creation de la ligne du jour, en autocommit et HORS transaction.
  //    Enchainer INSERT IGNORE puis UPDATE dans une meme transaction fait
  //    passer le verrou de partage a exclusif sur la ligne du compteur, ce qui
  //    provoque un deadlock des que plusieurs agents valident en meme temps.
  await sequelize.query(
    `INSERT IGNORE INTO daily_counters (counterDate, lastValue, createdAt, updatedAt)
     VALUES (:businessDate, 0, NOW(), NOW())`,
    { replacements: { businessDate } }
  );

  // 2. Increment dans une transaction dediee et tres courte : elle ne sert qu'a
  //    garantir que l'UPDATE et le SELECT partagent la meme connexion,
  //    LAST_INSERT_ID() etant une valeur de session. L'UPDATE est toujours
  //    execute, y compris pour le premier ticket du jour : la table n'ayant pas
  //    de colonne AUTO_INCREMENT, LAST_INSERT_ID() renverrait sinon un reliquat.
  return sequelize.transaction(async (transaction) => {
    await sequelize.query(
      `UPDATE daily_counters
          SET lastValue = LAST_INSERT_ID(lastValue + 1), updatedAt = NOW()
        WHERE counterDate = :businessDate`,
      { replacements: { businessDate }, transaction }
    );
    const [rows] = await sequelize.query(
      'SELECT LAST_INSERT_ID() AS ticketNumber', { transaction }
    );
    return Number(rows[0].ticketNumber);
  });
};
```

Le numero est donc reserve hors de la transaction metier de l'appelant : si la
creation du passage echoue ensuite, le numero est perdu. Un trou dans la
sequence est preferable a deux patients portant le meme numero.

Aucune tache planifiee de remise a zero n'est necessaire : une nouvelle date cree
une nouvelle ligne, donc le compteur repart naturellement a 1.

### 2. [x] Modele `Visit` (`models/Visit.js`)

```js
id                UUID (PK)
patientId         UUID  FK patients      NOT NULL
ticketNumber      INTEGER                NOT NULL   // 1, 2, 3... du jour
visitDate         DATEONLY               NOT NULL   // date locale du passage
status            ENUM('WAITING','IN_CONSULT','COMPLETED','CANCELLED') = 'WAITING'
priority          ENUM('NORMAL','URGENT') = 'NORMAL'
reason            TEXT      NULL         // motif de visite saisi a l'accueil
// Constantes relevees a l'accueil (toutes nullables)
weightKg          DECIMAL(5,2) NULL
heightCm          INTEGER      NULL
temperatureC      DECIMAL(4,1) NULL
bloodPressureSys  INTEGER      NULL
bloodPressureDia  INTEGER      NULL
pulseBpm          INTEGER      NULL
// Tracabilite
registeredBy      UUID FK users NOT NULL // le receptionniste
doctorId          UUID FK users NULL     // renseigne a la prise en charge
startedAt         DATE NULL              // debut de consultation
completedAt       DATE NULL
notes             TEXT NULL

indexes:
  UNIQUE (visitDate, ticketNumber)  name: visits_date_ticket
         (visitDate, status)        name: visits_date_status
         (patientId)                name: visits_patient
```

Les constantes vivent sur `Visit`, pas sur `Patient` : ce sont des mesures datees,
elles changent a chaque venue.

### 3. [x] Associations (`models/index.js`)

```js
Patient.hasMany(Visit, { foreignKey: 'patientId', as: 'visits' });
Visit.belongsTo(Patient, { foreignKey: 'patientId', as: 'patient' });
Visit.belongsTo(User, { foreignKey: 'registeredBy', as: 'receptionist' });
Visit.belongsTo(User, { foreignKey: 'doctorId', as: 'doctor' });
Visit.hasMany(Prescription, { foreignKey: 'visitId', as: 'prescriptions' });
Prescription.belongsTo(Visit, { foreignKey: 'visitId', as: 'visit' });
```

Exporter `Visit` et `DailyCounter` dans `module.exports`.

### 4. [x] Role `RECEPTIONIST` (`models/User.js`)

Ajouter la valeur a l'ENUM `role` **et** a la contrainte `validate.isIn`.
`sequelize.sync({ alter: true })` gere en principe l'ajout d'une valeur d'ENUM MySQL ;
verifier au demarrage et, si l'alter echoue, appliquer manuellement :

```sql
ALTER TABLE users MODIFY role
  ENUM('DOCTOR','CASHIER','RADIOLOGIST','LAB_TECHNICIAN','TECHNICIAN','ADMIN','RECEPTIONIST')
  NOT NULL;
```

### 5. [x] `Prescription.visitId`

Colonne `UUID NULL` avec FK vers `visits`. Nullable et non obligatoire : les
prescriptions existantes n'ont pas de passage, et le code aval doit continuer a
fonctionner quand `visitId` est `null`.

### 6. [x] Controleur `controllers/visitController.js`

| Methode | Role | Comportement |
|---|---|---|
| `create` | RECEPTIONIST, ADMIN | Transaction : verifie le patient, prend un numero, cree le passage `WAITING`. Renvoie le passage + patient (pour l'impression du ticket). |
| `getQueue` | RECEPTIONIST, DOCTOR, ADMIN | File du jour. Filtres `status` (defaut `WAITING,IN_CONSULT`), `priority`. Tri : `URGENT` d'abord, puis `ticketNumber` croissant. Inclut le patient. |
| `getByTicket` | RECEPTIONIST, DOCTOR, ADMIN | `GET /today/:ticketNumber` — scope implicite sur la date du jour. 404 explicite « aucun passage n'a ce numero aujourd'hui ». |
| `getById` | tous roles internes | Passage + patient + constantes + prescriptions liees. |
| `take` | DOCTOR, ADMIN | `WAITING -> IN_CONSULT`, pose `doctorId` et `startedAt`. Rejette en 409 si deja pris par un autre medecin (deux medecins qui cliquent sur le meme ticket). |
| `complete` | DOCTOR, ADMIN | `IN_CONSULT -> COMPLETED`, pose `completedAt`. |
| `cancel` | RECEPTIONIST, DOCTOR, ADMIN | `-> CANCELLED` avec motif obligatoire (patient reparti sans consulter). |
| `updateVitals` | RECEPTIONIST, ADMIN | Mise a jour des constantes tant que le passage est `WAITING`. |
| `getPatientHistory` | DOCTOR, ADMIN | Passages anterieurs d'un patient, pagines. |

Points d'attention :

- **Date du jour** : le pool MySQL est configure en `timezone: '+00:00'` (cf.
  `config/database.js`). Calculer `visitDate` avec une fonction utilitaire unique
  et documentee, sinon un passage cree en soiree bascule au lendemain.
- **Doublon** : refuser (409) un second passage `WAITING`/`IN_CONSULT` pour le meme
  patient le meme jour, sauf `?force=true`, pour eviter les tickets pris deux fois.
- **Reprise de numero** : ne jamais reutiliser un numero annule. Un trou dans la
  sequence est preferable a une ambiguite.

### 7. [x] Routes `routes/visits.js` + montage dans `server.js`

```
POST   /api/visits                       RECEPTIONIST, ADMIN
GET    /api/visits/queue                 RECEPTIONIST, DOCTOR, ADMIN
GET    /api/visits/today/:ticketNumber   RECEPTIONIST, DOCTOR, ADMIN
GET    /api/visits/patient/:patientId    DOCTOR, ADMIN
GET    /api/visits/:id                   RECEPTIONIST, DOCTOR, ADMIN
PATCH  /api/visits/:id/take              DOCTOR, ADMIN
PATCH  /api/visits/:id/complete          DOCTOR, ADMIN
PATCH  /api/visits/:id/cancel            RECEPTIONIST, DOCTOR, ADMIN
PATCH  /api/visits/:id/vitals            RECEPTIONIST, ADMIN
```

Validation `express-validator` sur `create` : `patientId` UUID, `priority` dans
l'enum, constantes numeriques optionnelles avec bornes plausibles (temperature
30-45, pouls 20-250) pour attraper les fautes de frappe.

### 8. [x] Reaffectation des droits sur `routes/patients.js`

```diff
- router.post('/', roleCheck('DOCTOR', 'ADMIN'), ...)
+ router.post('/', roleCheck('RECEPTIONIST', 'ADMIN'), ...)

- router.get('/', roleCheck('DOCTOR', 'CASHIER', 'ADMIN'), ...)
+ router.get('/', roleCheck('RECEPTIONIST', 'DOCTOR', 'CASHIER', 'ADMIN'), ...)

- router.get('/number/:number', roleCheck('DOCTOR', 'CASHIER', 'ADMIN'), ...)
+ router.get('/number/:number', roleCheck('RECEPTIONIST', 'DOCTOR', 'CASHIER', 'ADMIN'), ...)

  router.get('/:id', ... ajouter 'RECEPTIONIST' ...)

- router.put('/:id', roleCheck('DOCTOR', 'ADMIN'), ...)
+ router.put('/:id', roleCheck('RECEPTIONIST', 'ADMIN'), ...)
```

Le medecin perd la creation et la modification d'identite ; il conserve la lecture
et le dossier medical (`routes/patientRecords.js` inchange).

### 9. [x] `controllers/prescriptionController.js`

`create` accepte un `visitId` optionnel. S'il est fourni : verifier que le passage
existe, qu'il est `IN_CONSULT`, et que son `patientId` correspond au `patientId` de
la prescription — sinon 400. Stocker `visitId` sur la prescription.

### 10. [x] `controllers/statsController.js`

Ajouter un bloc accueil (`GET /api/stats/reception`) : passages du jour, en attente,
en consultation, termines, urgences en attente, delai moyen d'attente
(`startedAt - createdAt` sur les passages du jour deja pris en charge).

Ajouter au bloc medecin : `waitingCount` (passages `WAITING` du jour), pour afficher
un badge sur l'onglet file d'attente.

### 11. [x] Seeds (`seeds/initialData.js`)

Ajouter un compte de demonstration :
`accueil@chu-tokoin.tg` / role `RECEPTIONIST`, avec le meme mot de passe de test que
les autres comptes seedes.

---

## Frontend

### 12. [x] Mutualiser les composants patient

`PatientForm.jsx` et `PatientSearch.jsx` vivent dans `pages/doctor/` alors qu'ils
deviennent des outils d'accueil. Les deplacer vers `components/patient/` (dossier
existant) et corriger les imports dans `pages/doctor/DoctorDashboard.jsx`.

### 13. [x] Espace Accueil (`pages/reception/`)

| Fichier | Role |
|---|---|
| `ReceptionDashboard.jsx` | Conteneur a onglets (calque sur `DoctorDashboard`) + statistiques du jour |
| `PatientLookup.jsx` | Ecran d'entree : recherche nom / numero patient / telephone. Deux issues : « Ouvrir un passage » (patient trouve) ou « Nouveau patient » |
| `VisitForm.jsx` | Motif, priorite NORMAL/URGENT, constantes ; valide et cree le passage |
| `TicketPrint.jsx` | Ticket imprimable via `window.print()` : numero en tres gros, nom du patient, date, motif, priorite |
| `QueueBoard.jsx` | File du jour, urgences en tete, actions annuler / modifier constantes ; rafraichissement par polling |

Parcours cible : rechercher -> creer si absent -> saisir motif + constantes ->
valider -> le ticket s'affiche et s'imprime -> retour a la recherche.

### 14. [x] File d'attente cote medecin (`pages/doctor/DoctorDashboard.jsx`)

- Nouvel onglet **« File d'attente »** en premiere position, avec badge du nombre en
  attente.
- Liste vivante des passages `WAITING` (urgences en tete) ; un clic prend en charge
  (`PATCH /take`) et ouvre le dossier.
- Champ de saisie rapide du numero en secondaire (raccourci, pas le chemin principal) :
  saisie du numero -> `GET /visits/today/:n` -> meme ecran de prise en charge.
- L'ecran de prise en charge affiche les constantes relevees a l'accueil et le motif
  avant le formulaire de prescription.
- Retirer le bouton « Nouveau patient » et l'onglet de creation ; afficher a la place
  un message renvoyant vers l'accueil.
- `PrescriptionForm` transmet `visitId` a la creation.
- Un bouton « Terminer la consultation » appelle `PATCH /complete`.

### 15. [x] Rafraichissement

La pile ne comporte pas de WebSocket. Utiliser un polling `setInterval` de 15 s sur
`GET /api/visits/queue`, mis en pause quand l'onglet n'est pas visible
(`document.visibilityState`) pour ne pas marteler l'API sur les postes laisses
allumes. Aligner l'implementation sur ce que fait deja `pages/service/ExamQueue.jsx`.

### 16. [x] Cablage du role dans l'application

- `App.js` : route `/reception/*` avec `allowedRoles={['RECEPTIONIST', 'ADMIN']}`
- `pages/Dashboard.jsx` : carte « Espace Accueil » dans `roleCards`
- `components/layout/MainLayout.jsx` : libelle `RECEPTIONIST: 'Accueil'`, couleur,
  et entree de navigation (fichier construit la nav role par role, lignes ~115-125)
- `pages/admin/UserManagement.jsx` : ajouter `RECEPTIONIST` a la liste des roles
  selectionnables a la creation d'un compte

---

## Compatibilite avec l'existant

- Les patients deja en base n'ont aucun passage : normal, ils en auront un a leur
  prochaine venue.
- Les prescriptions existantes ont `visitId = null` : tous les ecrans qui affichent
  une prescription doivent tolerer l'absence de passage.
- Les comptes `DOCTOR` existants perdent la creation de patient. Prevenir avant le
  deploiement, sinon le service se bloque le premier matin.
- Aucun changement sur caisse, services, resultats, portail patient.

## Recette

1. [x] Un receptionniste enregistre un nouveau patient -> ticket **1**
2. [x] Deuxieme patient -> ticket **2** ; troisieme en `URGENT` -> ticket **3** mais
       affiche en tete de file
3. [x] Deux enregistrements simultanes (deux onglets) -> deux numeros distincts,
       aucun doublon
4. [x] Le medecin saisit « 2 » -> tombe sur le bon dossier, voit motif et constantes
5. [x] Deux medecins prennent le meme ticket -> le second recoit un 409
6. [x] Le medecin cree une prescription -> `visitId` renseigne, circuit caisse ->
       service -> resultats inchange
7. [x] Le patient du ticket 1 revient l'apres-midi -> nouveau passage, meme
       `patientNumber`, ticket **4**
8. [x] Lendemain (changer la date systeme ou la ligne `daily_counters`) -> le premier
       passage repart a **1**, et `GET /visits/today/1` ne renvoie pas celui d'hier
9. [x] Un `DOCTOR` qui appelle `POST /api/patients` recoit un 403
10. [x] Un `RECEPTIONIST` qui appelle `POST /api/prescriptions` recoit un 403

## Ordre d'execution suggere

Backend 1-5 (schema + compteur) -> 6-7 (API passages) -> verification a la main
via curl/Postman -> 8-11 (droits, liaison prescription, stats, seeds) ->
12-13 (espace accueil) -> 14-15 (file medecin) -> 16 (cablage role) -> recette.

Les etapes 1-2 sont bloquantes pour tout le reste ; 13 et 14 sont independantes une
fois l'API disponible.

---

## Etat de la mise en oeuvre

Phase implementee et verifiee le 12/08/2026. Les 16 etapes sont livrees.

### Ecarts par rapport au plan

- **`PatientLookup.jsx` n'a pas ete cree.** L'ecran se resumait a envelopper
  `PatientSearch` ; il est devenu le premier onglet de `ReceptionDashboard`.
- **Deux fichiers non prevus** se sont averes necessaires :
  `frontend/src/hooks/useVisitQueue.js` (polling mutualise accueil/medecin) et
  `backend/utils/businessDate.js` (calcul unique de la date metier).
- **Le compteur journalier a du etre repense.** La premiere version enchainait
  `INSERT IGNORE` puis `UPDATE` dans une meme transaction : l'escalade du
  verrou partage vers un verrou exclusif provoquait un deadlock des 20
  reservations simultanees. La creation de ligne se fait desormais en
  autocommit, hors de la transaction d'increment. Verifie : 20 reservations
  concurrentes donnent 1..20, sans doublon ni trou.

### Bugs pre-existants corriges en cours de route

Trois defauts anterieurs bloquaient le circuit d'accueil et ont ete corriges :

1. `routes/patients.js` — `body('email').optional()` ne saute que `undefined`,
   alors que le formulaire envoie toujours `email: ''`. **Aucun patient sans
   email ne pouvait etre cree.** Passe en `optional({ checkFalsy: true })`, avec
   normalisation `'' -> null` dans `patientController` (le validateur `isEmail`
   de Sequelize rejette lui aussi la chaine vide).
2. `routes/prescriptions.js` — meme cause sur `notes`, que le formulaire envoie
   a `null`. **Aucune prescription sans note ne pouvait etre creee.** Passe en
   `optional({ values: 'null' })`.
3. `pages/Login.jsx` — `getRedirectPath()` renvoyait `/` par defaut, qui
   redirige vers `/login`. Un `RECEPTIONIST` s'authentifiait sans jamais quitter
   la page de connexion. Le role `TECHNICIAN` souffrait du meme probleme ; il a
   ete traite dans la foulee (voir la section suivante).

---

## Complement : deblocage du role TECHNICIAN

Le role existait dans l'ENUM du modele mais etait inutilisable de bout en bout.
Aucun compte n'en portait, et pour cause : rien ne permettait d'en creer un.
Le supprimer n'etait pas une option, trois services (Cardiologie, Pneumologie,
Centre de Prelevement) n'ont aucun autre role capable de les staffer.

### Cause racine

Quatre copies de la liste des roles avaient diverge : `models/User.js`,
`routes/auth.js`, `routes/users.js` et `controllers/userController.js`. Les
validateurs rejetaient `TECHNICIAN` **et** `RECEPTIONIST`, tous deux presents
dans l'ENUM. Un administrateur ne pouvait donc creer ni technicien ni
receptionniste. La liste est desormais unique, dans `backend/utils/roles.js`.

### Corrections

- **Affectation a un service** : `serviceId` n'etait jamais lu par l'API de
  gestion des comptes, il n'etait pose que par `seeds/services.js`. Sans
  affectation possible, cabler le role serait reste cosmetique. Ajout du champ
  a la creation et a la modification, avec un selecteur dans l'ecran
  d'administration, visible pour les seuls roles techniques.
- **Perimetre derive du service** : `statsController.getServiceStats` et
  `resultController.upload` deduisaient la categorie du role via
  `role === 'RADIOLOGIST' ? 'RADIOLOGY' : 'LABORATORY'`, ce qui classait tout
  technicien en laboratoire. Ils passent par `utils/serviceScope.js`, qui donne
  la priorite a `serviceId`. Le champ `category` de la reponse devient `scope`,
  un libelle lisible (aucun consommateur cote frontend).
- **Garde-fous** : un TECHNICIAN sans service est refuse a la creation, un
  service inexistant aussi, et retrograder un technicien vers un role non
  technique libere son affectation. En defense en profondeur, un compte de
  service sans affectation obtient un perimetre **vide** et non total.
- **Frontend** : `Login.jsx`, `App.js` (`/service/*`), `MainLayout.jsx`,
  `Dashboard.jsx`, `Profile.jsx`, `UserManagement.jsx` et `ServiceDashboard.jsx`
  (dont le repli affichait « Laboratoire » pour tout non-radiologue).

### Verification

- Suite dediee : **16 assertions, 0 echec** (creation des deux roles jusqu'ici
  impossibles, perimetre = Cardiologie et non laboratoire, garde-fous,
  non-regression des perimetres radiologue et laborantin).
- Suite du circuit d'accueil rejouee : 34/34, aucune regression.
- Navigateur : connexion d'un technicien de cardiologie -> redirection
  `/service`, en-tete « Service Cardiologie », menu « Espace Service »,
  libelle de role « Technicien » ; selecteur de service present et requis
  dans l'ecran d'administration.

Un compte de demonstration reste en base de developpement :
`cardio@chu-tokoin.tg` / `Cardio123!` (TECHNICIAN, Cardiologie). Il n'est pas
dans les seeds : les comptes techniques se creent depuis l'administration.

### Verification effectuee

- Suite API de bout en bout : **34 assertions, 0 echec** (droits, numerotation,
  doublons, file, concurrence, prescription, cloture, historique, stats).
- Parcours complet dans le navigateur : enregistrement d'un patient a l'accueil
  -> ouverture du passage avec motif et constantes -> ticket n° 005 ->
  connexion medecin -> saisie du numero -> prise en charge -> prescription
  rattachee au passage (verifie en base) -> cloture -> sortie de la file.
- `npm run build` du frontend : succes, aucun warning sur les fichiers ajoutes.

Note : la base de developpement contient desormais quelques patients de test
issus de ces verifications (`PatientA/B/C`, `TETTEH Yawa`).

## Points laisses ouverts

- **Ticket papier** : imprimante thermique dediee ou impression navigateur ? Le plan
  suppose `window.print()` sur une mise en page reduite. Une imprimante ESC/POS
  demanderait un pont local.
- **QR sur le ticket** : `services/qrcodeService.js` existe deja pour les
  prescriptions ; on pourrait encoder l'UUID du passage sur le ticket pour eviter
  toute saisie manuelle. Non retenu dans ce plan, ajoutable ensuite sans changement
  de schema.
- **Affichage salle d'attente** : un ecran public listant les numeros appeles est un
  ajout naturel une fois `GET /queue` disponible. Hors perimetre ici.
