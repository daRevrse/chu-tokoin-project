# Phase 6: Facturation, Specialites et Frais de Consultation

## Contexte

Le circuit s'arretait au milieu du parcours financier. Un paiement etait colle a une
prescription (`Payment.prescriptionId`, obligatoire), ce qui interdisait tout ce qui
se paie sans prescription — a commencer par les **frais de consultation**, qui sont
dus *avant* d'avoir vu le medecin.

Le circuit reel de l'etablissement est :

```
[ACCUEIL] ticket + orientation
    |
    v
[CAISSE] frais de consultation        <-- absent du logiciel
    |
    v
[MEDECIN] consultation + prescription
    |
    v
[CAISSE] examens -> [SERVICES] -> [RESULTATS]
```

Le probleme depassait la seule consultation. Chaque nouveau motif de paiement
(hospitalisation, bloc operatoire, actes) aurait ajoute son propre chemin
d'encaissement, donc sa propre facon de calculer une recette : quatre chemins,
quatre totaux, aucune reconciliation possible. Cette phase pose donc d'abord le
socle — la **facture** — puis y branche les frais de consultation.

Trois chantiers, un seul sujet vu sous trois angles : qui consulte (specialites),
combien ca coute (tarifs), quand on paie (facture).

## Objectifs

- Introduire `Invoice` / `InvoiceLine` comme point unique de rencontre entre ce qui
  est du et ce qui est verse
- Rendre possible le **reglement partiel**, courant au guichet
- Rendre possible le **paiement differe**, sans lequel une urgence ne pourrait pas
  etre soignee avant d'etre payee
- Introduire `Specialty` : orientation du patient, file d'attente par specialite,
  et assiette du tarif de consultation
- Facturer les frais de consultation a l'ouverture du passage et bloquer la prise en
  charge tant qu'ils ne sont pas regles
- Faire passer le paiement des examens par la facture sans casser QR code, Mobile
  Money, rapports ni portail patient

## Prerequis

- Phases 0-5 completees
- MySQL (la numerotation atomique utilise une syntaxe specifique MySQL)

## Decisions actees

| Question | Decision |
|---|---|
| Portee de la facture | **Un moment d'encaissement = une facture.** Consultation et examens sont deux passages a la caisse, donc deux factures rattachees au meme `Visit` |
| Montant des lignes | **Copie a l'emission**, jamais relu du catalogue : un tarif change, une facture emise ne change pas |
| Totaux | `totalAmount` / `paidAmount` **recalcules** depuis les lignes et les paiements, jamais incrementes |
| Grille tarifaire | **Table administrable**, livree vide. Aucun montant n'est ecrit en dur ni seede |
| Absence de tarif | **Aucun frais**, le passage n'est pas bloque. Un logiciel qui bloque la file parce qu'un tarif manque coute plus cher que la gratuite |
| Tarif a 0 | **Facture soldee d'emblee** : distinct de l'absence de tarif, et laisse une trace de la gratuite accordee |
| Urgences | **Soins d'abord.** Un passage `URGENT` est pris en charge sans reglement ; la creance est marquee a regulariser, pas effacee |
| Specialite d'un medecin | **Un seul rattachement**, pas une liste. Un medecin qui consulte dans deux disciplines tient deux vacations, notion a modeliser le jour ou le cas se presentera |
| `Payment.prescriptionId` | **Conservee** comme raccourci de lecture denormalise, pour ne pas etendre le chantier au QR code, au portail, aux rapports et au Mobile Money |

### Pourquoi la facture et non un second type de paiement

Ajouter un `Payment` rattache au `Visit` a cote de celui rattache a la prescription
aurait resolu les frais de consultation en une heure, et institue deux chemins
d'encaissement pour toujours. La facture est le seul endroit ou l'on peut repondre a
« combien ce patient doit-il ? » sans enumerer des cas particuliers.

---

## Backend

### 1. [x] Numerotation atomique (`models/SequenceCounter.js`, `services/sequenceService.js`)

Le pattern historique du projet (`Model.count()` + timestamp) n'est pas sur en
concurrence : deux caissiers qui encaissent au meme instant obtiennent le meme
compte. Pour un numero de facture, qui est une reference comptable, c'est
inacceptable.

```js
sequence_counters:
  counterKey    STRING(30)  PK   // 'INVOICE', 'PAYMENT'
  counterDate   DATEONLY    PK
  lastValue     INTEGER
```

`reserveNumber(counterKey, businessDate)` reprend le deroulement en deux temps de
`services/ticketService.js` (`INSERT IGNORE` en autocommit, puis increment dans une
transaction dediee) — voir ce fichier pour le detail de l'interblocage evite.

Table distincte de `daily_counters` : y ajouter `counterKey` supposerait de modifier
une cle primaire, ce que `sync({ alter })` ne sait pas faire sur une table qui porte
deja des donnees.

Formats : `FAC-YYYYMMDD-0001`, `PAY-YYYYMMDD-0001`.

### 2. [x] Modele `Invoice` (`models/Invoice.js`)

```js
id             UUID PK
invoiceNumber  STRING(30)  UNIQUE
patientId      UUID FK patients      NOT NULL
visitId        UUID FK visits        NULL   // absent pour une prescription anterieure a l'accueil
prescriptionId UUID FK prescriptions NULL   // factures d'examens uniquement
invoiceType    ENUM('CONSULTATION','EXAM','BED','PROCEDURE','OTHER')
status         ENUM('ISSUED','PARTIALLY_PAID','PAID','CANCELLED') = 'ISSUED'
totalAmount    DECIMAL(10,2) = 0
paidAmount     DECIMAL(10,2) = 0
// Regularisation
isDeferred     BOOLEAN = false
deferredReason TEXT NULL
deferredBy     UUID FK users NULL
deferredAt     DATE NULL
// Tracabilite
issuedBy       UUID FK users NULL
cancelReason   TEXT NULL
cancelledBy    UUID FK users NULL
notes          TEXT NULL

indexes:
  UNIQUE (invoiceNumber)      name: invoices_number
         (visitId)            name: invoices_visit
         (prescriptionId)     name: invoices_prescription
         (status, invoiceType) name: invoices_status_type
```

`BED` et `PROCEDURE` sont declares d'avance : ajouter une valeur a un ENUM MySQL
reecrit la table, autant ne pas le faire a chaque module futur.

`getBalance()` convertit avant de soustraire : MySQL rend les `DECIMAL` sous forme de
chaine, et `"100" > "20"` est faux.

### 3. [x] Modele `InvoiceLine` (`models/InvoiceLine.js`)

```js
id                 UUID PK
invoiceId          UUID FK invoices NOT NULL
lineType           ENUM(...)  // meme jeu que invoiceType
label              STRING(200) NOT NULL
unitPrice          DECIMAL(10,2) NOT NULL
quantity           INTEGER = 1
amount             DECIMAL(10,2)   // unitPrice * quantity, calcule par hook
// Rapprochement, sans effet sur le montant
examId             UUID NULL
prescriptionExamId UUID NULL
specialtyId        UUID NULL
```

Le libelle et le prix sont **copies** a l'emission. Sans cette copie, modifier le prix
d'un examen en administration reecrirait retroactivement toutes les factures passees,
et la caisse ne pourrait plus justifier ce qu'elle a encaisse.

`amount` est redondant avec `unitPrice * quantity`, et c'est voulu : le total de la
facture se calcule par somme SQL sur cette colonne.

### 4. [x] Refonte de `Payment` (`models/Payment.js`)

```diff
+ invoiceId      UUID FK invoices NULL   // nullable pour les paiements anterieurs
- prescriptionId UUID NOT NULL
+ prescriptionId UUID NULL               // copie de invoice.prescriptionId
```

Un paiement n'est plus le reglement integral d'une prescription mais **un versement** :
plusieurs paiements peuvent porter sur la meme facture. Le solde et le statut se
lisent sur la facture, jamais sur le paiement.

`prescriptionId` est une denormalisation assumee et documentee : le QR code, le portail
patient, les rapports et le Mobile Money lisent tous `payment.prescription`. Les faire
passer par la facture aurait etendu le chantier a une dizaine de fichiers sans rien
apporter a l'utilisateur.

Le hook de numerotation passe par `sequenceService` (voir 1).

### 5. [x] Service de facturation (`services/invoiceService.js`)

| Fonction | Role |
|---|---|
| `issueInvoice(params, transaction)` | Emet la facture et ses lignes, calcule le total. Accepte la transaction de l'appelant |
| `recordPayment(invoiceId, {...})` | Enregistre un versement. `amount` absent = solde la facture. Rend `{ invoice, payment, justSettled }` |
| `refreshTotals(invoiceId, t)` | Recalcule `totalAmount` / `paidAmount` / `status` depuis les lignes et les paiements aboutis |
| `cancelInvoice(id, {...})` | Renonciation a la creance (gratuite, erreur, patient reparti). Refusee si un encaissement a deja eu lieu |
| `deferInvoice(id, {...})` | Marque la creance a regulariser |

Points d'attention :

- **Verrou.** `recordPayment` prend un `SELECT ... FOR UPDATE` sur la facture : sans
  lui, deux caissiers encaissant la meme facture liraient tous deux un solde plein et
  encaisseraient chacun la totalite.
- **Recalcul complet, jamais incremental.** Un increment se desynchronise au premier
  paiement annule ou a la premiere ligne ajoutee apres coup, et personne ne s'en
  apercoit avant l'arrete de caisse.
- **Arrondi a deux decimales.** Les montants transitent par des additions en virgule
  flottante ; sans arrondi, une facture soldee affiche un reste de 0.0000000001 et ne
  passe jamais a `PAID`.
- **Ordre des tests de statut.** `paid >= total` **avant** `paid <= 0`, pour qu'un
  tarif a 0 naisse solde (voir la section « Etat de la mise en oeuvre »).
- `justSettled` permet a l'appelant de declencher ses effets metier une seule fois,
  au moment ou la facture est soldee.

### 6. [x] Modele `Specialty` (`models/Specialty.js`)

```js
id, code UNIQUE, name, description, color, displayOrder, isActive
```

A ne pas confondre avec `Service`, qui designe un service **executant des examens**
(Laboratoire, Imagerie). Les deux portent parfois le meme nom mais n'ont pas la meme
fonction : une specialite oriente une file d'attente et porte un tarif de
consultation, un service porte des examens et le personnel qui les realise. Les
confondre reviendrait a facturer une consultation au tarif d'un prelevement.

### 7. [x] Modele `ConsultationTariff` (`models/ConsultationTariff.js`)

```js
id
specialtyId UUID FK specialties NULL   // NULL = tarif par defaut
visitType   ENUM('CONSULTATION','RESULT_REVIEW')
amount      DECIMAL(10,2)
label       STRING(120) NULL           // libelle imprime sur la facture
isActive    BOOLEAN = true
```

Resolution du tarif applicable :

1. ligne active pour (specialite du passage, type de passage)
2. a defaut, ligne active pour (specialite nulle, type de passage)
3. a defaut, **aucun frais**

L'unicite du couple (specialite, type) **ne peut pas** etre confiee a MySQL : un index
unique laisse passer plusieurs lignes dont `specialtyId` est `NULL`, c'est-a-dire
exactement les doublons de tarif par defaut qu'il faudrait interdire. Elle est verifiee
dans le controleur, avec la course residuelle que cela implique.

### 8. [x] Rattachements (`models/User.js`, `models/Visit.js`)

```js
User.specialtyId   UUID NULL   // medecins uniquement
Visit.specialtyId  UUID NULL FK specialties   // orientation decidee a l'accueil
```

Nullables : les passages anterieurs n'en ont pas, et un etablissement qui ne declare
aucune specialite continue de fonctionner avec une file unique.

Index supplementaire `(visitDate, specialtyId)` name `visits_date_specialty`.

### 9. [x] Service des frais de consultation (`services/consultationFeeService.js`)

| Fonction | Role |
|---|---|
| `resolveTariff({ specialtyId, visitType })` | Tarif applicable, ou `null` |
| `issueConsultationInvoice(visit, { issuedBy, transaction })` | Emet la facture, ou `null` si aucun tarif |
| `getConsultationInvoice(visitId)` | Facture de consultation non annulee du passage |
| `isConsultationSettled(visitId)` | `true` en l'absence de facture : rien a reclamer |

### 10. [x] Emission a l'ouverture du passage (`controllers/visitController.js`)

`create` accepte `specialtyId` (verifie existant et actif), puis ecrit **le passage et
sa facture dans une meme transaction** : un passage sans facture serait une
consultation gratuite que personne n'a decidee, une facture sans passage une creance
sans objet. La reponse porte `consultationInvoice`, pour que l'accueil annonce le
montant et l'imprime sur le ticket.

`take` refuse la prise en charge tant que la facture n'est pas soldee :

```
402 Payment Required
{ error, invoice: { id, invoiceNumber, totalAmount, paidAmount, balance }, hint }
```

**402 plutot que 409** : la cause est identifiable sans lire le message, ce qui permet
a l'interface d'afficher le montant du plutot qu'une erreur generique.

Deux exceptions, sans lesquelles la regle deviendrait dangereuse :

- passage `URGENT` : pris en charge immediatement ;
- `ADMIN` envoyant `deferPayment: true` : derogation motivee.

Dans les deux cas `deferInvoice` est appele, la decision est journalisee en `warn`, et
la creance remonte en tete de la file de la caisse.

`getQueue` accepte `specialtyId`, avec la valeur speciale `none` pour les passages non
orientes — sans ce filtre, un patient qu'on a oublie d'orienter n'apparaitrait dans la
file d'aucune specialite et attendrait indefiniment.

La file joint la facture de consultation en `LEFT JOIN` (`required: false`
obligatoire : avec un `where` sur une association `hasMany`, Sequelize passe en
jointure interne et fait disparaitre les passages non factures).

### 11. [x] Facturation des examens (`services/examBillingService.js`)

`ensureExamInvoice(prescriptionId, { issuedBy, transaction })`, idempotent, appele :

- a la creation de la prescription (`prescriptionController.create`), la ou nait la
  creance ;
- a la caisse, pour les prescriptions anterieures a la facturation.

Le prix des lignes vient de `PrescriptionExam.price`, pas du catalogue : c'est celui
annonce au patient au moment de la prescription.

`prescriptionController.cancel` annule la facture associee : la laisser ouverte ferait
apparaitre indefiniment a la caisse une creance sans objet.

### 12. [x] Encaissement (`controllers/paymentController.js`)

`POST /api/payments` accepte desormais :

| Champ | Role |
|---|---|
| `invoiceId` | Cas general : la caisse encaisse une facture |
| `prescriptionId` | Compatibilite : la facture d'examens est retrouvee ou emise a la volee |
| `amount` | Facultatif. Absent = solde la facture. Present = reglement partiel |

Les effets aval (examens `PAID`, `expectedResultAt`, QR code, prescription `PAID`) sont
declenches **au solde complet** et non au premier versement : un patient qui a verse la
moitie ne doit pas repartir avec un QR code qui lui ouvre tous les examens.

Les erreurs metier du service de facturation portent un `statusCode` et sont relayees
telles quelles : les ecraser en 500 ferait disparaitre « facture deja soldee » ou
« montant superieur au reste a payer » derriere une panne serveur.

### 13. [x] Mobile Money (`controllers/mobileMoneyController.js`)

Le paiement mobile porte sur la facture, comme un paiement au guichet. Il est cree en
`PENDING` puis bascule en `SUCCESS` de facon asynchrone en trois endroits (callback,
verification de statut, simulation) : `refreshTotals` est appele a chaque bascule,
faute de quoi la facture resterait impayee alors que l'argent est arrive.

Le montant initie est le **reste a payer**, pas le total : une facture deja reglee en
partie au guichet ne doit pas etre encaissee une seconde fois en entier.

### 14. [x] Controleurs et routes

`controllers/specialtyController.js` :

| Methode | Role | Comportement |
|---|---|---|
| `getAll` | tous roles internes | Specialites + nombre de medecins rattaches |
| `create` / `update` | ADMIN | Code normalise en majuscules, unique. Desactivation refusee si la file n'est pas vide |
| `getTariffs` | ADMIN, CASHIER, RECEPTIONIST | Grille complete |
| `createTariff` / `updateTariff` | ADMIN | Doublon (specialite, type) refuse |

`controllers/invoiceController.js` :

| Methode | Role | Comportement |
|---|---|---|
| `getAll` | CASHIER, ADMIN | Filtres `status` (defaut : dues), `type`, `date`, `deferred`, `patientId`, `visitId`, `prescriptionId` |
| `getById` | CASHIER, ADMIN, RECEPTIONIST, DOCTOR | Lignes, versements, solde |
| `getTodayConsultations` | CASHIER, ADMIN | File de travail de la caisse. Creances a regulariser en tete |
| `cancel` | ADMIN | Motif obligatoire |

```
GET    /api/specialties                    tous roles internes
POST   /api/specialties                    ADMIN
PUT    /api/specialties/:id                ADMIN
GET    /api/specialties/tariffs            ADMIN, CASHIER, RECEPTIONIST
POST   /api/specialties/tariffs            ADMIN
PUT    /api/specialties/tariffs/:id        ADMIN
GET    /api/invoices                       CASHIER, ADMIN
GET    /api/invoices/consultations/today   CASHIER, ADMIN
GET    /api/invoices/:id                   CASHIER, ADMIN, RECEPTIONIST, DOCTOR
PATCH  /api/invoices/:id/cancel            ADMIN
```

Les routes `/tariffs` et `/consultations/today` sont declarees **avant** `/:id`, sinon
la route parametrique les capture.

`getAll` utilise `distinct: true` : `findAndCountAll` avec une association `hasMany`
compte les lignes jointes et non les factures, et la pagination annoncerait trois fois
plus de factures qu'il n'y en a.

### 15. [x] Comptes medecins (`controllers/userController.js`, `controllers/authController.js`)

`resolveSpecialtyId(role, specialtyId)`, calque sur `resolveServiceId` : seul un
`DOCTOR` porte une specialite, et changer de role la libere. Elle reste facultative —
un etablissement qui n'a pas encore declare ses specialites doit pouvoir creer des
comptes medecin.

`login` et `getProfile` renvoient la specialite. `getProfile` recharge l'utilisateur :
le middleware d'authentification le charge seul, sans ses associations, et un medecin
qui rafraichit sa page perdrait le filtre de file d'attente qu'il avait a la connexion.

### 16. [x] Rapports (`services/reportService.js`)

Un paiement de consultation n'a pas de prescription : lire le patient depuis
`payment.prescription` afficherait « N/A » sur toutes les consultations encaissees,
alors qu'elles comptent dans le total. Le rapport journalier retombe sur le patient de
la facture, et affiche le numero de facture a defaut du numero de prescription.

### 17. [x] Migration du schema (`models/index.js`)

`sync({ alter })` ne suffit pas pour cette phase. Deux precautions, executees avant la
synchronisation generale :

1. **Creation anticipee des nouvelles tables, sans cles etrangeres.** Sequelize gere
   les references croisees en deux passes (creation sans contrainte, puis ajout), mais
   cette precaution ne vaut que pour les `CREATE TABLE`. Quand une table existe deja,
   l'ajout d'une colonne passe par un `ALTER TABLE` qui, lui, porte la contrainte :
   mettre a jour une base en service echoue en errno 150.
2. **Relachement de `payments.prescriptionId`.** `sync({ alter })` pose les cles
   etrangeres avant de modifier la nullabilite des colonnes, et MySQL refuse un
   `ON DELETE SET NULL` sur une colonne encore `NOT NULL`. La colonne est donc relachee
   en amont, en **conservant la collation `utf8mb4_bin`** (voir la section suivante).

### 18. [x] Seeds (`seeds/specialties.js`, `npm run seed:specialties`)

Huit specialites courantes d'un CHU, idempotent. **Aucun tarif n'est cree** : les frais
de consultation different d'un etablissement a l'autre et changent par arrete ; les
inventer reviendrait a facturer des patients a un montant que personne n'a decide.

---

## Frontend

### 19. [x] Accueil (`pages/reception/`)

- `VisitForm.jsx` : selecteur de specialite (les specialites sans medecin sont
  signalees) et **annonce du montant** avant validation. Le tarif est resolu cote
  client avec la meme regle que le serveur : l'accueil doit annoncer ce que la caisse
  reclamera, pas une approximation. Une grille indisponible n'empeche pas
  d'enregistrer le patient.
- `ReceptionDashboard.jsx` : transporte la facture jusqu'au ticket.
- `TicketPrint.jsx` : specialite et **frais de consultation imprimes** — c'est le seul
  papier que le patient emporte a la caisse.

### 20. [x] Caisse (`pages/cashier/ConsultationPayments.jsx`)

Nouvel onglet **« Consultations »**, en premiere position : les onglets suivent l'ordre
du parcours du patient, qui paie sa consultation avant de voir le medecin et ses
examens apres.

Table des factures du jour (ticket, patient, specialite, montant, reste a payer,
statut), creances **« A regulariser » en tete**. Le dialogue d'encaissement pre-remplit
le reste a payer — le reglement integral est le geste courant, le caissier ne corrige
que pour un versement partiel. Polling 15 s, meme cadence que la file d'attente.

Quatrieme carte statistique : consultations a encaisser.

### 21. [x] Medecin (`pages/doctor/VisitQueue.jsx`, `hooks/useVisitQueue.js`)

- Le hook accepte `specialtyId` ; le medecin ouvre sa journee sur **sa** file, sans
  quoi il verrait les patients de toutes les specialites et devrait trier lui-meme.
- Selecteur de file, avec une entree « Non orientes ».
- Colonne specialite, badge « Non regle » / « A regulariser », bouton desactive sauf
  sur une urgence.
- Le 402 est traduit en message portant le montant du et renvoyant a la caisse.

### 22. [x] Administration (`pages/admin/SpecialtyManagement.jsx`)

Onglet **« Specialites et tarifs »** : specialites (avec le nombre de medecins
rattaches, en alerte s'il vaut zero) et grille tarifaire. La modification d'un tarif
rappelle que les factures deja emises conservent leur montant.

Grille vide : un avertissement explique qu'aucune consultation n'est facturee.

`UserManagement.jsx` : selecteur de specialite pour les comptes `DOCTOR`.

---

## Compatibilite avec l'existant

- Les paiements deja enregistres n'ont pas de facture (`invoiceId = null`) : ils
  restent lisibles, seuls les nouveaux passent par la facturation.
- Les prescriptions existantes n'ont pas de facture : elle est emise a la volee au
  premier passage en caisse.
- Sans tarif saisi, **aucun changement percu** : pas de facture de consultation, pas de
  blocage, le circuit fonctionne comme en phase 5.
- Les passages et comptes existants n'ont pas de specialite : ils rejoignent la file
  « Non orientes », qui reste consultable.
- Aucun changement sur les services, les resultats et le portail patient.

## Recette

1. [x] Tarif de 3 000 sur une specialite ; second tarif actif sur le meme couple refuse
2. [x] Ouverture d'un passage oriente -> facture emise a 3 000, statut `ISSUED`
3. [x] Prise en charge par le medecin -> **402**, montant du dans la reponse
4. [x] La facture apparait dans la file de la caisse, avec le total du a percevoir
5. [x] Versement de 1 000 -> `PARTIALLY_PAID`, reste 2 000
6. [x] Versement de 9 999 -> refus, « depasse le reste a payer »
7. [x] Prise en charge -> toujours 402
8. [x] Versement sans montant -> solde la facture, `PAID`
9. [x] Prise en charge -> acceptee
10. [x] Prescription creee -> facture d'examens emise dans la foulee
11. [x] Paiement par `prescriptionId` -> solde, QR code emis, prescription `PAID`
12. [x] Passage `URGENT` non regle -> prise en charge acceptee
13. [x] La creance est marquee `isDeferred` avec le motif, et remonte en tete de la
        file caisse
14. [x] `GET /visits/queue?specialtyId=...` ne rend que les passages de la specialite
15. [x] Tarif a **0** -> facture `PAID` d'emblee, prise en charge acceptee
16. [x] Rapport financier journalier : les consultations encaissees portent un nom de
        patient et une reference, les versements partiels apparaissent en lignes
        distinctes

Verifie egalement dans le navigateur : selecteur et montant a l'accueil, ticket
imprime avec la somme due, onglet caisse avec les creances a regulariser en tete, file
medecin avec colonne specialite et bouton desactive, administration des specialites et
de la grille.

## Ordre d'execution suggere

Backend 1-5 (socle facturation) -> 6-9 (specialites et tarifs) -> 10-11 (emission aux
deux points du parcours) -> 12-13 (encaissement) -> verification a la main via
curl/Postman -> 14-16 (API et rapports) -> 17-18 (migration et seeds) -> 19-22
(interfaces) -> recette.

Les etapes 1-5 sont bloquantes pour tout le reste. Les etapes 19 a 22 sont
independantes une fois l'API disponible.

---

## Etat de la mise en oeuvre

Phase implementee et verifiee le 13/08/2026. Les 22 etapes sont livrees.

### Defauts trouves par la recette

1. **Toutes les factures naissaient gratuites.** `bulkCreate` n'execute par defaut ni
   les validateurs ni les hooks de validation, or c'est un hook `beforeValidate` qui
   calcule `amount`. Toutes les lignes valaient 0. Corrige en passant
   `individualHooks: true` **et** `validate: true` — sans quoi les bornes declarees sur
   les lignes ne s'appliquaient pas davantage.
2. **Un tarif a 0 bloquait le patient.** `deriveStatus` testait `paid <= 0` avant
   `paid >= total` : une facture a 0 restait `ISSUED`, donc eternellement due. Le
   medecin ne pouvait jamais prendre le patient en charge, et la caisse n'avait rien a
   encaisser pour la debloquer — `recordPayment` refuse un versement nul. L'ordre des
   tests a ete inverse et le cas ajoute a la recette.
3. **Le rapport financier perdait le patient** sur toutes les consultations
   encaissees (etape 16), decouvert en relisant `reportService` apres coup.

### Difficultes de migration

La mise a jour d'une base en service a echoue trois fois avant d'aboutir, chaque fois
sur le meme `errno 150 "Foreign key constraint is incorrectly formed"`, pour trois
causes differentes :

1. `users.specialtyId` reference `specialties`, qui n'existait pas encore au moment de
   l'`ALTER TABLE` ;
2. `payments.invoiceId` reference `invoices`, creee plus loin dans la meme passe ;
3. l'`ALTER` de relachement de `payments.prescriptionId` avait **perdu l'attribut
   `BINARY`**, ramenant la colonne en `utf8mb4_unicode_ci` alors que `prescriptions.id`
   est en `utf8mb4_bin`. MySQL refuse une cle etrangere entre deux collations
   differentes — avec le meme code d'erreur que pour une table manquante, ce qui rend
   le diagnostic trompeur.

D'ou les deux precautions de l'etape 17, et la verification de la collation dans la
condition d'idempotence de la migration.

### Ecarts par rapport au plan

- **`SequenceCounter` n'etait pas prevu.** Reutiliser `daily_counters` supposait de
  modifier une cle primaire sur une table en service.
- **`Payment.paymentNumber` a ete migre vers le compteur atomique** au passage. Ce
  n'etait pas dans le perimetre, mais la generation reposait sur `Payment.count()`,
  masquee par un suffixe horodate — le probleme etait le meme que celui qui motivait
  l'etape 1.
- **`Invoice.cancelledBy` a ete ajoute** en cours de route : `cancelInvoice` recevait
  l'utilisateur sans avoir ou l'ecrire, et une facture qui disparait sans auteur est un
  trou de caisse.
- **Aucun tarif n'est seede**, contrairement a ce que ferait un jeu de demonstration
  complet. Les regles tarifaires reelles de l'etablissement n'etaient pas connues au
  moment de l'implementation.

### Reste a faire

- Saisir la grille tarifaire reelle une fois les regles de l'etablissement connues :
  tarifs par specialite, distinction eventuelle entre premiere consultation et suivi,
  regime des retours resultats.
- Les exonerations (indigents, personnel, gratuites nationales) passent aujourd'hui par
  un tarif a 0 ou par l'annulation motivee d'une facture. Un regime d'exoneration
  nomme, applicable au patient, releve d'une phase ulterieure — de meme que le tiers
  payant.

---

## Complement : finition des frais de consultation

Ajoute le 14/08/2026, apres une relecture du circuit reel au guichet. La phase 6
livrait l'encaissement mais pas le geste complet : cinq trous se voyaient des
qu'on suivait un patient de bout en bout.

### 23. [x] Recu de consultation (`pages/cashier/ConsultationReceipt.jsx`)

Le paiement des examens produisait un recu et un QR code ; la consultation ne
produisait rien, le dialogue se fermait. Le patient repartait sans preuve de
paiement, et rien ne permettait de trancher une contestation au guichet ou
devant le medecin.

Le recu porte le montant verse, le mode de paiement, le ticket, la specialite et
la facture. En cas de reglement partiel il imprime aussi le **reste a payer** :
un patient qui a verse la moitie doit repartir avec ce qu'il doit encore, pas
avec un recu muet.

### 24. [x] Recherche a la caisse

`ConsultationPayments` affichait la liste du jour, sans recherche. A deux cents
passages par jour, le caissier faisait defiler pendant que le patient attendait.

Filtrage cote client sur le numero de ticket (zeros compris, tel qu'imprime), le
nom, le numero de patient, le telephone et le numero de facture. Cote client
parce que la liste tient dans une journee et que le patient est devant le
guichet : un aller-retour serveur a chaque frappe le ferait attendre pour rien.

### 25. [x] Creances a regulariser (`pages/cashier/OutstandingInvoices.jsx`)

**Le trou le plus grave.** `getTodayConsultations` joint sur
`visit.visitDate = aujourd'hui` : une creance differee la veille sortait de
l'ecran de la caisse le lendemain matin. L'API savait la retrouver
(`GET /invoices?deferred=true`), mais aucune interface ne l'appelait. Une
creance qu'on ne voit plus est une creance perdue.

Nouvel onglet **Creances**, toutes dates confondues, trie du plus ancien au plus
recent — l'ordre dans lequel une creance se recupere, l'inverse de l'ordre
d'affichage habituel. L'anciennete est signalee par une pastille qui vire a
l'orange a deux jours et au rouge a une semaine.

Le meme composant sert a l'administrateur en lecture seule (voir 26).

### 26. [x] Suivi des derogations (onglet admin « Creances et derogations »)

La prise en charge sans reglement n'etait tracee que par un `logger.warn` dans un
fichier. Aucun ecran ne montrait qui avait passe outre, combien de fois, pour
quel montant. Un contournement que personne ne regarde devient la norme en trois
semaines.

L'administrateur voit les memes creances, filtrees par defaut sur les soins
delivres sans reglement, sans bouton d'encaissement : la surveillance et le
guichet sont deux gestes distincts.

### 27. [x] Annulation d'un versement (`PATCH /api/payments/:id/cancel`)

Un caissier qui saisissait 30 000 au lieu de 3 000 n'avait aucun recours :
`cancelInvoice` refuse des qu'un encaissement a eu lieu, et rien ne permettait
d'annuler un versement.

Correction de caisse et non remboursement : le versement passe en `CANCELLED`
avec son motif et son auteur, la facture redevient due, le mouvement d'espece se
traite au guichet. Le paiement n'est jamais supprime — une ligne de caisse qui
disparait est indistinguable d'un detournement.

`CANCELLED` est un statut a part et non `FAILED` : `FAILED` signifie que
l'operateur a refuse la transaction. Les confondre rendrait impossible de
distinguer un incident technique d'une erreur de guichet.

Deux garde-fous sur les factures d'examens, dont le solde a libere le circuit
aval : l'annulation est **refusee** si les examens sont deja engages
(`IN_PROGRESS`, `COMPLETED`), et quand elle est acceptee sur une prescription
`PAID` elle retire ce que l'argent avait ouvert — prescription et examens
reviennent a `PENDING`, la date annoncee et le QR code sont effaces.

Reserve a l'administrateur : annuler un versement fait sortir de l'argent des
comptes sans contrepartie, ce n'est pas un geste de guichet.

### 28. [x] Validite du ticket de consultation

Un patient qui revenait le lendemain pour le meme motif repayait plein tarif.

`ConsultationTariff.validityDays` (0 par defaut) definit la duree pendant
laquelle un retour voir la meme specialite n'est pas refacture. A defaut de
modeliser l'episode de soins, il est approxime par le couple
(patient, specialite) sur la periode : volontairement large, mieux vaut ne pas
refacturer un patient qui revient pour autre chose que le facturer deux fois
pour la meme chose.

Deux precautions :

- seule une facture **effectivement soldee** couvre un retour, sinon un passage
  aux urgences non regle ouvrirait une semaine de consultations gratuites ;
- une facture a 0 ne peut pas servir de reference, sinon le delai glisserait a
  chaque retour et le ticket n'expirerait jamais.

Le retour couvert produit une facture a 0 **soldee**, dont le libelle et les
notes designent le ticket qui la couvre. Pas d'absence de facture : un retour
couvert et un passage jamais facture doivent rester distinguables dans les
comptes.

### Recette du complement

17. [x] Tarif a validite 7 jours ; premier passage facture plein tarif
18. [x] Une facture impayee ne couvre pas un retour
19. [x] Apres reglement, un retour le meme jour produit une facture a 0 soldee,
        qui nomme le ticket couvrant
20. [x] Le retour couvert est pris en charge sans passage en caisse
21. [x] Une autre specialite reste facturee au tarif plein
22. [x] Motif obligatoire pour annuler un versement
23. [x] Versement annule : la facture repasse a `ISSUED`, le passage redevient bloque
24. [x] Une seconde annulation du meme versement est refusee
25. [x] Le versement annule sort du rapport financier journalier
26. [x] Les creances remontent toutes dates confondues, et le filtre des soins
        delivres sans reglement ne rend que des factures differees
27. [x] Encaissement partiel depuis la caisse : le recu imprime le reste a payer

### Defaut trouve en cours de route

Regulariser une creance depuis l'ecran des creances ne produisait aucun recu,
alors que le meme encaissement en produisait un depuis la file du jour. Meme
geste, meme besoin : le recu a ete branche sur les deux ecrans.
