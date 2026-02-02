# Guide d'Installation - CHU Tokoin

## Prerequisites

- Node.js 18+
- MySQL 8.0+
- npm ou yarn

## Installation

### 1. Base de donnees MySQL

Creer la base de donnees:

```sql
CREATE DATABASE IF NOT EXISTS chu_tokoin
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;
```

Ou executer le script:
```bash
mysql -u root < backend/database/init.sql
```

### 2. Backend

```bash
cd backend

# Installer les dependances
npm install

# Configurer les variables d'environnement
cp .env.example .env
# Editer .env avec vos parametres MySQL

# Demarrer en mode developpement
npm run dev
```

Le backend sera accessible sur `http://localhost:5000`

### 3. Frontend

```bash
cd frontend

# Installer les dependances
npm install

# Configurer les variables d'environnement
cp .env.example .env

# Demarrer en mode developpement
npm start
```

Le frontend sera accessible sur `http://localhost:3000`

## Configuration

### Backend (.env)

```env
# Server
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000

# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=chu_tokoin
DB_USER=root
DB_PASSWORD=

# JWT
JWT_SECRET=votre_secret_jwt_unique
JWT_EXPIRE=24h
JWT_REFRESH_EXPIRE=7d
```

### Frontend (.env)

```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_ENV=development
```

## Test de verification

### Backend
```bash
curl http://localhost:5000/api/health
```

Reponse attendue:
```json
{
  "status": "OK",
  "message": "CHU Tokoin API is running"
}
```

### Frontend
Ouvrir `http://localhost:3000` dans le navigateur.
La page de login doit s'afficher.

## Structure du projet

```
chu-tokoin-project/
├── backend/
│   ├── config/           # Configuration (DB, JWT)
│   ├── controllers/      # Logique metier
│   ├── middleware/       # Auth, validation, erreurs
│   ├── models/           # Modeles Sequelize
│   ├── routes/           # Routes API
│   ├── services/         # Services (QR, PDF)
│   ├── utils/            # Utilitaires (logger)
│   ├── uploads/          # Fichiers uploades
│   ├── logs/             # Logs applicatifs
│   ├── database/         # Scripts SQL
│   ├── .env              # Variables d'environnement
│   └── server.js         # Point d'entree
│
├── frontend/
│   ├── src/
│   │   ├── components/   # Composants React
│   │   ├── contexts/     # Context API
│   │   ├── pages/        # Pages
│   │   ├── services/     # Services API
│   │   ├── utils/        # Helpers
│   │   ├── theme.js      # Theme MUI
│   │   └── App.js        # Composant principal
│   └── .env              # Variables d'environnement
│
└── docs/                 # Documentation
```

## Commandes utiles

### Backend
```bash
npm run dev     # Demarrer avec nodemon (hot reload)
npm start       # Demarrer en production
npm run seed    # Charger les donnees initiales (Phase 1)
```

### Frontend
```bash
npm start       # Demarrer en developpement
npm run build   # Build de production
npm test        # Lancer les tests
```

## Prochaines etapes

Une fois la Phase 0 validee, passer a la Phase 1:
- Implementation des modeles de donnees
- Systeme d'authentification
- API prescriptions et paiements
