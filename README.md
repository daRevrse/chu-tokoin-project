# H360 - Solution Hospitaliere Intelligente

Systeme de gestion numerique du parcours patient, destine aux etablissements
hospitaliers.

## Apercu du Projet

H360 digitalise le parcours patient de bout en bout : de son arrivee a l'accueil
jusqu'a la consultation de ses resultats d'examens, en passant par la caisse, la
consultation medicale, les services techniques (radiologie, laboratoire et autres
services d'examens) et le service d'accueil des urgences.

### Identite du produit et identite de l'etablissement

Deux notions distinctes, a ne pas confondre en lisant le code :

- **H360** est le produit. Son nom, sa signature et son editeur sont les memes
  chez tous les clients : ils sont figes dans `backend/utils/appIdentity.js` et
  `frontend/src/config/appIdentity.js`, et ne sont pas administrables.
- **L'etablissement** qui exploite l'application est parametrable. Nom, raison
  sociale, logo, coordonnees et mentions de pied de page se reglent depuis
  **Administration > Etablissement** et sont imprimes sur les tickets, recus,
  ordonnances et rapports.

Le logiciel n'est donc lie a aucun hopital en particulier. Les jeux de donnees de
demonstration livres dans `backend/seeds/` portent des noms et des adresses
d'exemple : ils servent a faire tourner l'application avant parametrage, et n'ont
pas vocation a etre conserves en production.

### Workflow Principal

```
Accueil            Caisse             Medecin            Caisse             Service            Patient
   |                  |                  |                  |                  |                  |
   | 1. Passage       |                  |                  |                  |                  |
   |    + ticket      |                  |                  |                  |                  |
   |    + orientation |                  |                  |                  |                  |
   |----------------->|                  |                  |                  |                  |
   |                  | 2. Frais de      |                  |                  |                  |
   |                  |    consultation  |                  |                  |                  |
   |                  |----------------->|                  |                  |                  |
   |                  |                  | 3. Consultation  |                  |                  |
   |                  |                  |    + prescription|                  |                  |
   |                  |                  |----------------->|                  |                  |
   |                  |                  |                  | 4. Paiement      |                  |
   |                  |                  |                  |    + QR Code     |                  |
   |                  |                  |                  |----------------->|                  |
   |                  |                  |                  |                  | 5. Scan QR       |
   |                  |                  |                  |                  | 6. Examen        |
   |                  |                  |                  |                  | 7. Resultat      |
   |                  |                  |                  |                  |----------------->|
   |                  |                  | 8. Interpretation                   |   9. Portail     |
   |                  |                  |<---------------------------------------------------------|
```

Le medecin ne peut prendre un patient en charge que si les frais de consultation
sont regles. Deux exceptions : un passage marque URGENT est pris en charge
immediatement, et un administrateur peut passer outre en motivant sa decision.
Dans les deux cas la creance est marquee a regulariser et remonte a la caisse.

### Circuit des urgences

Le service d'accueil des urgences suit un circuit distinct, ou le soin ne depend
jamais du reglement :

```
[ARRIVEE 24h/24] -> [ADMISSION] -> [TRIAGE] -> [PRISE EN CHARGE] -> [SORTIE]
                         |            |               |                |
             identite reelle OU   infirmier,     jamais bloquee   domicile,
             designation          echelle 1-5    par le paiement  hospitalisation,
             provisoire           revisable                       transfert, deces
                                                                        |
                                                                        v
                                             [CAISSE] creance ouverte a
                                             l'identification, regularisee apres
```

Un dossier non trie passe devant tous les autres : personne ne l'a encore evalue.

Les frais de consultation sont administrables (Administration > Specialites et
tarifs). Tant qu'aucun tarif n'est saisi, aucune consultation n'est facturee et
le circuit fonctionne sans passage prealable a la caisse.

## Stack Technique

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Base de donnees**: MySQL 8.0+
- **ORM**: Sequelize
- **Authentification**: JWT

### Frontend
- **Framework**: React 18+
- **UI Library**: Material-UI (MUI v5)
- **Routing**: React Router v6
- **HTTP Client**: Axios

## Structure du Projet

```
h360/
├── backend/
│   ├── config/          # Configuration DB, JWT, serveur
│   ├── controllers/     # Logique metier
│   ├── middleware/      # Auth, validation, upload
│   ├── models/          # Modeles Sequelize
│   ├── routes/          # Routes API
│   ├── seeds/           # Jeux de donnees initiaux (idempotents)
│   ├── services/        # Regles metier (facturation, QR, PDF, numerotation)
│   ├── utils/           # Utilitaires
│   └── uploads/         # Fichiers uploades
│
├── frontend/
│   ├── src/
│   │   ├── components/  # Composants React
│   │   ├── contexts/    # Context API
│   │   ├── hooks/       # Hooks partages (file d'attente, ...)
│   │   ├── pages/       # Pages/Vues, un dossier par espace metier
│   │   ├── services/    # Client API
│   │   └── utils/       # Helpers
│   └── public/
│
└── docs/                # Documentation
```

## Roles Utilisateurs

| Role | Acces |
|------|-------|
| **RECEPTIONIST** | Enregistrer les patients, ouvrir un passage, orienter vers une specialite |
| **NURSE** | Admettre aux urgences, coter et reviser le triage, identifier un dossier |
| **DOCTOR** | Creer prescriptions, consulter resultats, prendre en charge et faire sortir aux urgences |
| **CASHIER** | Encaisser consultations et examens, generer QR codes, imprimer recus |
| **RADIOLOGIST** | Scanner QR, valider examens radiologie, uploader resultats |
| **LAB_TECHNICIAN** | Scanner QR, valider examens labo, uploader resultats |
| **TECHNICIAN** | Meme perimetre, pour les services crees en administration (cardiologie, prelevements, ...) ; le service d'affectation est obligatoire |
| **ADMIN** | Acces complet, gestion utilisateurs, tarifs, rapports |

## Phases de Developpement

Le projet est divise en 8 phases incrementales:

### Phase 0: Setup Initial
- Configuration environnement
- Setup backend Express
- Setup frontend React
- Configuration base de donnees

### Phase 1: MVP
- Authentification JWT
- Modeles de donnees
- API prescriptions
- Module paiement + QR code
- Interfaces medecin et caissier

### Phase 2: Gestion Examens
- Scan QR code
- Workflow examens (en attente -> en cours -> termine)
- Interface services (radio/labo)
- Statistiques service

### Phase 3: Resultats
- Upload fichiers resultats
- Dossier patient numerique
- Portail patient
- Historique medical

### Phase 4: Fonctionnalites Avancees
- Integration Mobile Money
- Tableaux de bord financiers
- Rapports et exports
- Optimisations

### Phase 5: Accueil, Passages et File d'Attente
- Role RECEPTIONIST et entite Visit (passage du jour)
- Numerotation journaliere des tickets
- File d'attente partagee accueil / medecin
- Retour du patient pour ses resultats

### Phase 6: Facturation et Frais de Consultation
- Factures et lignes de facture, socle unique d'encaissement
- Reglements partiels, recus, annulation de versement
- Specialites cliniques et files d'attente par specialite
- Frais de consultation dus avant la consultation, tarifs administrables
- Validite du ticket de consultation, creances a regulariser, suivi des derogations

### Phase 7: Service d'Accueil des Urgences
- Dossier d'urgence distinct du passage ambulatoire, numerote 24h/24
- Prise en charge avant identification, regularisation ulterieure
- Triage a cinq niveaux pose par un infirmier, revisable
- Creance ouverte systematiquement, jamais bloquante pour le soin

## Installation Rapide

### Prerequisites
- Node.js 18+
- MySQL 8.0+
- npm ou yarn

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Configurer .env avec vos parametres
npm run dev
```

### Donnees initiales

Les seeds sont idempotents : ils peuvent etre relances sans creer de doublon.

```bash
npm run seed             # comptes, patients et examens de demonstration
```

```bash
npm run seed:services    # services d'examens, categories et etapes
```

```bash
npm run seed:specialties # specialites cliniques (sans tarif)
```

Aucun tarif de consultation n'est livre : les montants relevent de chaque
etablissement et se saisissent dans **Administration > Specialites et tarifs**.
Tant que la grille est vide, aucune consultation n'est facturee.

### Premier parametrage

Apres le seed, trois reglages sont a faire avant toute utilisation reelle :

1. **Administration > Etablissement** — nom, logo et coordonnees de l'hopital.
   Les valeurs livrees sont des exemples et apparaissent sur tous les documents
   imprimes.
2. **Administration > Specialites et tarifs** — grille des frais de consultation
   et forfait d'admission aux urgences.
3. **Administration > Utilisateurs** — creation des comptes reels et
   desactivation des comptes de demonstration.

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
npm start
```

## Documentation

- [PHASE_0_SETUP.md](./PHASE_0_SETUP.md) - Setup initial
- [PHASE_1_MVP.md](./PHASE_1_MVP.md) - MVP
- [PHASE_2_EXAMS.md](./PHASE_2_EXAMS.md) - Gestion examens
- [PHASE_3_RESULTS.md](./PHASE_3_RESULTS.md) - Resultats
- [PHASE_4_ADVANCED.md](./PHASE_4_ADVANCED.md) - Fonctionnalites avancees
- [PHASE_5_ACCUEIL.md](./PHASE_5_ACCUEIL.md) - Accueil, passages et file d'attente
- [PHASE_6_FACTURATION.md](./PHASE_6_FACTURATION.md) - Facturation et frais de consultation
- [PHASE_7_URGENCES.md](./PHASE_7_URGENCES.md) - Service d'accueil des urgences

## Comptes de Demonstration (apres seed)

Comptes de test livres par `npm run seed`, mots de passe compris. Ils sont
destines au developpement et a la recette : **a desactiver avant toute mise en
service**.

| Role | Email | Mot de passe |
|------|-------|--------------|
| Admin | admin@chu-tokoin.tg | Admin123! |
| Accueil | accueil@chu-tokoin.tg | Accueil123! |
| Infirmier | infirmier@chu-tokoin.tg | Infirmier123! |
| Medecin | medecin@chu-tokoin.tg | Medecin123! |
| Caissier | caissier@chu-tokoin.tg | Caissier123! |
| Radiologue | radio@chu-tokoin.tg | Radio123! |
| Laborantin | labo@chu-tokoin.tg | Labo123! |

## API Endpoints Principaux

### Authentification
- `POST /api/auth/login` - Connexion
- `POST /api/auth/register` - Inscription
- `GET /api/auth/profile` - Profil utilisateur

### Patients
- `GET /api/patients` - Liste/recherche patients
- `POST /api/patients` - Creer patient
- `GET /api/patients/:id` - Detail patient

### Passages (accueil et file d'attente)
- `POST /api/visits` - Ouvrir un passage (ticket + orientation + frais de consultation)
- `GET /api/visits/queue` - File du jour (filtres `status`, `priority`, `specialtyId`)
- `GET /api/visits/today/:ticketNumber` - Retrouver un passage par son numero
- `PATCH /api/visits/:id/take` - Prendre en charge (402 si les frais ne sont pas regles)
- `PATCH /api/visits/:id/complete` - Cloturer la consultation

### Urgences
- `POST /api/emergencies` - Ouvrir un dossier (`patientId` **ou** `provisionalLabel`)
- `GET /api/emergencies/queue` - File du service, triee par gravite
- `GET /api/emergencies/unidentified` - Dossiers dont la creance n'a pu etre ouverte
- `PATCH /api/emergencies/:id/triage` - Coter ou reviser le niveau (1 a 5)
- `PATCH /api/emergencies/:id/take` - Prendre en charge (jamais bloquee par le paiement)
- `PATCH /api/emergencies/:id/identify` - Rattacher un patient et ouvrir la creance
- `PATCH /api/emergencies/:id/discharge` - Orienter a la sortie

### Prescriptions
- `POST /api/prescriptions` - Creer prescription (emet la facture des examens)
- `GET /api/prescriptions` - Liste prescriptions
- `GET /api/prescriptions/:id` - Detail prescription

### Facturation
- `GET /api/invoices` - Liste des factures (dues par defaut)
- `GET /api/invoices/consultations/today` - File de la caisse, consultations du jour
- `GET /api/invoices/:id` - Detail facture (lignes, versements, solde)
- `PATCH /api/invoices/:id/cancel` - Annuler une facture (gratuite, erreur de saisie)

### Paiements
- `POST /api/payments` - Encaisser un versement (`invoiceId` ou `prescriptionId`,
  `amount` facultatif : sans lui la facture est soldee, avec lui le reglement est partiel)
- `GET /api/payments/:id` - Detail paiement (avec QR)

### Specialites et tarifs
- `GET /api/specialties` - Liste des specialites cliniques
- `POST /api/specialties` - Creer une specialite (ADMIN)
- `GET /api/specialties/tariffs` - Grille des frais de consultation
- `POST /api/specialties/tariffs` - Creer un tarif (ADMIN)

### Services
- `POST /api/services/verify-qr` - Verifier QR code
- `PATCH /api/services/exams/:id/start` - Demarrer examen
- `PATCH /api/services/exams/:id/complete` - Terminer examen

### Resultats
- `POST /api/results` - Upload resultat
- `GET /api/results/:id/download` - Telecharger resultat

## Traces de l'etablissement pilote

Le projet a demarre pour un etablissement donne et en garde des traces, restees
en place pour ne pas invalider les donnees existantes. Elles sont sans effet sur
le fonctionnement, mais a traiter avant une diffusion plus large :

| Emplacement | Trace | Pourquoi elle n'a pas ete changee |
|---|---|---|
| `backend/services/qrcodeService.js` | `type: 'CHU_TOKOIN_PAYMENT'` dans la charge utile des QR codes | Les QR deja remis aux patients portent cette valeur ; la changer les rendrait illisibles par les services |
| `backend/utils/logger.js` | `service: 'chu-tokoin-api'` | Etiquette de journalisation, potentiellement utilisee par une collecte de logs existante |
| `backend/services/mobileMoneyService.js` | Prefixe `CHU-` des references de transaction | Reference transmise a l'operateur, rapprochee des transactions passees |
| `backend/seeds/`, `backend/database/init.sql`, `.env.example` | Noms, adresses et base `chu_tokoin` | Jeux de demonstration et parametres locaux |
| `backend/package.json` | `name: chu-tokoin-backend` | Renommage sans effet fonctionnel, a grouper avec les precedents |

## Licence

Application proprietaire. Tous droits reserves.

## Contact

Pour toute question, contactez l'equipe technique en charge du deploiement.
