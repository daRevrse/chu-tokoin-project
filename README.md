# CHU Tokoin - Systeme de Digitalisation du Parcours Patient

Systeme de gestion numerique du parcours patient pour le Centre Hospitalier Universitaire de Tokoin (Togo).

## Apercu du Projet

Ce systeme digitalise le parcours patient pour les examens medicaux (radiologie et laboratoire), de la prescription par le medecin jusqu'a la consultation des resultats.

### Workflow Principal

```
Medecin              Caisse               Service              Patient
   |                    |                    |                    |
   | 1. Prescription    |                    |                    |
   |-------------------->                    |                    |
   |                    |                    |                    |
   |                    | 2. Paiement        |                    |
   |                    | + QR Code          |                    |
   |                    |------------------->|                    |
   |                    |                    |                    |
   |                    |                    | 3. Scan QR         |
   |                    |                    | 4. Realise examen  |
   |                    |                    | 5. Upload resultat |
   |                    |                    |------------------->|
   |                    |                    |                    |
   | 6. Consulte resultat                    |    7. Acces portail|
   |<-----------------------------------------------------------------|
```

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
chu-tokoin-system/
├── backend/
│   ├── config/          # Configuration DB, JWT, serveur
│   ├── controllers/     # Logique metier
│   ├── middleware/      # Auth, validation, upload
│   ├── models/          # Modeles Sequelize
│   ├── routes/          # Routes API
│   ├── services/        # Services (QR, PDF, email)
│   ├── utils/           # Utilitaires
│   └── uploads/         # Fichiers uploades
│
├── frontend/
│   ├── src/
│   │   ├── components/  # Composants React
│   │   ├── contexts/    # Context API
│   │   ├── pages/       # Pages/Vues
│   │   ├── services/    # Services API
│   │   └── utils/       # Helpers
│   └── public/
│
└── docs/                # Documentation
```

## Roles Utilisateurs

| Role | Acces |
|------|-------|
| **DOCTOR** | Creer prescriptions, consulter resultats, historique patient |
| **CASHIER** | Gerer paiements, generer QR codes, imprimer recus |
| **RADIOLOGIST** | Scanner QR, valider examens radiologie, uploader resultats |
| **LAB_TECHNICIAN** | Scanner QR, valider examens labo, uploader resultats |
| **ADMIN** | Acces complet, gestion utilisateurs, rapports |

## Phases de Developpement

Le projet est divise en 5 phases incrementales:

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

## Comptes de Test (apres seed)

| Role | Email | Mot de passe |
|------|-------|--------------|
| Admin | admin@chu-tokoin.tg | Admin123! |
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

### Prescriptions
- `POST /api/prescriptions` - Creer prescription
- `GET /api/prescriptions` - Liste prescriptions
- `GET /api/prescriptions/:id` - Detail prescription

### Paiements
- `POST /api/payments` - Enregistrer paiement
- `GET /api/payments/:id` - Detail paiement (avec QR)

### Services
- `POST /api/services/verify-qr` - Verifier QR code
- `PATCH /api/services/exams/:id/start` - Demarrer examen
- `PATCH /api/services/exams/:id/complete` - Terminer examen

### Resultats
- `POST /api/results` - Upload resultat
- `GET /api/results/:id/download` - Telecharger resultat

## Licence

Projet developpe pour le CHU Tokoin, Lome, Togo.

## Contact

Pour toute question concernant ce projet, contactez l'equipe technique du CHU Tokoin.
