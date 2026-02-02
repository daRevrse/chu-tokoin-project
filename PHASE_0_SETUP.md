# Phase 0: Configuration et Setup Initial

## Objectifs
- Mettre en place l'environnement de developpement complet
- Configurer la base de donnees MySQL
- Creer la structure de base du backend Express.js
- Creer la structure de base du frontend React
- Configurer les variables d'environnement
- Valider la connexion entre tous les composants

## Prerequis
- Node.js 18+ installe
- MySQL 8.0+ installe et en cours d'execution
- npm ou yarn disponible
- Editeur de code (VS Code recommande)

## Etapes de developpement

### Backend

#### 1. [ ] Initialisation du projet backend
```bash
mkdir -p backend
cd backend
npm init -y
```

#### 2. [ ] Installation des dependances
```bash
npm install express mysql2 sequelize dotenv cors helmet bcrypt jsonwebtoken express-validator morgan winston qrcode pdfkit multer uuid
npm install --save-dev nodemon
```

#### 3. [ ] Configuration package.json scripts
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

#### 4. [ ] Creation de la structure des dossiers
```
backend/
├── config/
│   ├── database.js
│   ├── jwt.js
│   └── server.js
├── models/
├── controllers/
├── routes/
├── middleware/
├── services/
├── utils/
├── uploads/
├── .env
├── .env.example
└── server.js
```

#### 5. [ ] Configuration de la base de donnees (config/database.js)
```javascript
const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

module.exports = sequelize;
```

#### 6. [ ] Configuration JWT (config/jwt.js)
```javascript
module.exports = {
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRE || '24h',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRE || '7d'
};
```

#### 7. [ ] Configuration du serveur Express (server.js)
```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const sequelize = require('./config/database');
const logger = require('./utils/logger');

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// Routes de test
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'CHU Tokoin API is running' });
});

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Gestion globale des erreurs
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

// Connexion DB et demarrage serveur
const startServer = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully.');

    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    process.exit(1);
  }
};

startServer();
```

#### 8. [ ] Configuration du logger (utils/logger.js)
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

module.exports = logger;
```

#### 9. [ ] Fichier .env.example
```
# Server
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000

# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=chu_tokoin
DB_USER=root
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your_super_secret_key_change_in_production
JWT_EXPIRE=24h
JWT_REFRESH_EXPIRE=7d

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads
```

#### 10. [ ] Creation de la base de donnees MySQL
```sql
CREATE DATABASE IF NOT EXISTS chu_tokoin
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;
```

### Frontend

#### 11. [ ] Initialisation du projet React
```bash
npx create-react-app frontend
cd frontend
```

#### 12. [ ] Installation des dependances
```bash
npm install @mui/material @emotion/react @emotion/styled @mui/icons-material axios react-router-dom react-hook-form react-qr-code html5-qrcode
```

#### 13. [ ] Creation de la structure des dossiers
```
frontend/src/
├── components/
│   ├── common/
│   ├── auth/
│   ├── doctor/
│   ├── cashier/
│   ├── service/
│   └── patient/
├── contexts/
├── services/
├── utils/
├── pages/
├── App.jsx
├── index.js
└── theme.js
```

#### 14. [ ] Configuration du theme Material-UI (src/theme.js)
```javascript
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0'
    },
    secondary: {
      main: '#dc004e',
      light: '#ff5983',
      dark: '#9a0036'
    },
    success: {
      main: '#4caf50'
    },
    warning: {
      main: '#ff9800'
    },
    error: {
      main: '#f44336'
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff'
    }
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600
    },
    h5: {
      fontWeight: 600
    },
    h6: {
      fontWeight: 600
    }
  },
  shape: {
    borderRadius: 8
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }
      }
    }
  }
});

export default theme;
```

#### 15. [ ] Configuration Axios (src/services/api.js)
```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Intercepteur pour ajouter le token JWT
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur pour gerer les erreurs
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

#### 16. [ ] Configuration App.jsx de base
```javascript
import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <div className="App">
          <h1>CHU Tokoin - Systeme de Gestion</h1>
          <p>Configuration en cours...</p>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
```

#### 17. [ ] Fichier .env frontend
```
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_ENV=development
```

### Configuration Git

#### 18. [ ] Fichier .gitignore racine
```
# Dependencies
node_modules/
.pnp/
.pnp.js

# Testing
coverage/

# Production
build/
dist/

# Environment
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Uploads
uploads/*
!uploads/.gitkeep

# Misc
*.pem
*.key
```

#### 19. [ ] Initialisation Git
```bash
git init
git add .
git commit -m "Initial setup: backend Express + frontend React"
```

## Tests a effectuer

### Backend
- [ ] Lancer `npm run dev` sans erreur
- [ ] Acceder a `http://localhost:5000/api/health` retourne status OK
- [ ] Connexion MySQL etablie (message dans logs)
- [ ] Fichiers de logs crees dans backend/logs/

### Frontend
- [ ] Lancer `npm start` sans erreur
- [ ] Application visible sur `http://localhost:3000`
- [ ] Pas d'erreurs dans la console navigateur
- [ ] Theme MUI applique (typographie, couleurs)

### Integration
- [ ] Frontend peut appeler backend (tester avec health check)
- [ ] CORS fonctionne correctement
- [ ] Variables d'environnement chargees des deux cotes

## Points de validation
- [ ] Les deux serveurs demarrent sans erreur
- [ ] La base de donnees est creee et accessible
- [ ] La structure des dossiers est complete
- [ ] Les fichiers de configuration sont en place
- [ ] Git est initialise avec premier commit

## Prochaines etapes
-> PHASE_1_MVP.md : Creation des modeles de donnees et de l'authentification
