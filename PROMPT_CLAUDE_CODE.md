# PROMPT POUR CLAUDE CODE - PROJET DIGITALISATION CHU TOKOIN

Tu es un développeur senior fullstack spécialisé dans les applications médicales et hospitalières. Tu vas mettre en place le projet de digitalisation du parcours patient pour le CHU Tokoin (Togo).

## 📋 DOCUMENT DE RÉFÉRENCE

Le projet est décrit en détail dans le fichier `Projet_Digitalisation_Parcours_Patient_CHU_Tokoin.pdf`. 
**Lis ce document en priorité** pour comprendre:
- Le contexte et les problématiques
- Les objectifs du système
- Les fonctionnalités attendues
- Le parcours patient actuel vs parcours cible

## 🎯 STACK TECHNIQUE IMPOSÉE

### Backend
- **Runtime**: Node.js 18+ (LTS)
- **Framework**: Express.js
- **Langage**: JavaScript (pas TypeScript pour l'instant)
- **Base de données**: MySQL 8.0+
- **ORM**: Sequelize
- **Authentification**: JWT (jsonwebtoken)
- **Validation**: express-validator
- **Sécurité**: helmet, cors, bcrypt

### Frontend
- **Framework**: React 18+
- **Langage**: JavaScript (pas TypeScript)
- **UI Library**: Material-UI (MUI v5)
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **State Management**: React Context API + useState/useReducer
- **Forms**: React Hook Form
- **QR Code**: react-qr-code (génération) + react-qr-scanner (lecture)

### Outils & Utilities
- **QR Code Backend**: qrcode (npm)
- **PDF**: pdfkit
- **Upload fichiers**: multer
- **Variables d'env**: dotenv
- **Logging**: winston
- **Validation**: joi ou express-validator

## 📁 STRUCTURE DU PROJET

```
chu-tokoin-system/
├── backend/
│   ├── config/
│   │   ├── database.js
│   │   ├── jwt.js
│   │   └── server.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Patient.js
│   │   ├── Prescription.js
│   │   ├── Exam.js
│   │   ├── Payment.js
│   │   └── Result.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── prescriptionController.js
│   │   ├── paymentController.js
│   │   ├── examController.js
│   │   └── resultController.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── prescriptions.js
│   │   ├── payments.js
│   │   ├── exams.js
│   │   └── results.js
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── roleCheck.js
│   │   ├── errorHandler.js
│   │   └── upload.js
│   ├── services/
│   │   ├── qrcodeService.js
│   │   ├── pdfService.js
│   │   ├── emailService.js
│   │   └── smsService.js
│   ├── utils/
│   │   ├── logger.js
│   │   └── validators.js
│   ├── uploads/
│   ├── .env
│   ├── .env.example
│   ├── server.js
│   └── package.json
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/
│   │   │   │   ├── Navbar.jsx
│   │   │   │   ├── Sidebar.jsx
│   │   │   │   ├── Loading.jsx
│   │   │   │   └── ErrorAlert.jsx
│   │   │   ├── auth/
│   │   │   │   ├── Login.jsx
│   │   │   │   └── ProtectedRoute.jsx
│   │   │   ├── doctor/
│   │   │   │   ├── PrescriptionForm.jsx
│   │   │   │   ├── PatientSearch.jsx
│   │   │   │   └── ExamSelector.jsx
│   │   │   ├── cashier/
│   │   │   │   ├── PaymentForm.jsx
│   │   │   │   ├── QRCodeGenerator.jsx
│   │   │   │   └── ReceiptPrint.jsx
│   │   │   ├── service/
│   │   │   │   ├── QRScanner.jsx
│   │   │   │   ├── ExamList.jsx
│   │   │   │   └── ExamValidation.jsx
│   │   │   └── patient/
│   │   │       ├── ResultsView.jsx
│   │   │       └── MedicalHistory.jsx
│   │   ├── contexts/
│   │   │   ├── AuthContext.jsx
│   │   │   └── AppContext.jsx
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   ├── authService.js
│   │   │   └── prescriptionService.js
│   │   ├── utils/
│   │   │   ├── constants.js
│   │   │   └── helpers.js
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── DoctorDashboard.jsx
│   │   │   ├── CashierDashboard.jsx
│   │   │   ├── ServiceDashboard.jsx
│   │   │   └── PatientPortal.jsx
│   │   ├── App.jsx
│   │   ├── index.js
│   │   └── theme.js
│   ├── .env
│   ├── .env.example
│   └── package.json
│
├── docs/
│   ├── SETUP.md
│   ├── API.md
│   └── DATABASE.md
│
├── PHASE_0_SETUP.md
├── PHASE_1_MVP.md
├── PHASE_2_EXAMS.md
├── PHASE_3_RESULTS.md
├── PHASE_4_ADVANCED.md
├── README.md
└── .gitignore
```

## 🚀 APPROCHE INCRÉMENTALE OBLIGATOIRE

**IMPORTANT**: Avant de commencer à coder, tu DOIS créer des fichiers d'étapes détaillés pour CHAQUE PHASE du projet.

### Créer d'abord ces fichiers de planification:

1. **PHASE_0_SETUP.md**
   - Installation de l'environnement
   - Configuration MySQL
   - Structure de base backend
   - Structure de base frontend
   - Configuration des dépendances
   - Variables d'environnement
   - Tests de connexion DB

2. **PHASE_1_MVP.md**
   - Modèles de base (User, Patient, Prescription, Exam, Payment)
   - Auth & JWT
   - API prescriptions médicales
   - Interface médecin (prescription)
   - Calcul automatique des coûts
   - Module paiement caisse
   - Génération QR code
   - Interface de vérification services

3. **PHASE_2_EXAMS.md**
   - Scan QR code
   - Gestion états examens
   - Validation examens
   - Journal d'activité
   - Statistiques service

4. **PHASE_3_RESULTS.md**
   - Upload résultats (PDF/images)
   - Dossier patient numérique
   - Consultation résultats médecin
   - Historique patient
   - Portail patient

5. **PHASE_4_ADVANCED.md**
   - Intégration Mobile Money
   - Tableaux de bord financiers
   - Rapports d'activité
   - Export comptable
   - Optimisations

### Format des fichiers d'étapes

Chaque fichier PHASE_X.md doit contenir:
```markdown
# Phase X: [Nom de la phase]

## Objectifs
- Liste des objectifs

## Prérequis
- Ce qui doit être fait avant

## Étapes de développement

### Backend
1. [ ] Modèle 1
   - Code SQL/Sequelize
   - Migrations
2. [ ] API Endpoint 1
   - Route
   - Controller
   - Validation
3. [ ] Service 1
   - Logique métier

### Frontend
1. [ ] Composant 1
   - Props
   - State
   - Intégration API
2. [ ] Page 1
   - Layout
   - Navigation

## Tests à effectuer
- [ ] Test 1
- [ ] Test 2

## Points de validation
- Critères de succès de la phase

## Prochaines étapes
- Lien vers phase suivante
```

## 🎯 RÔLES ET PERMISSIONS

Le système doit gérer 5 types d'utilisateurs:

1. **Médecin** (DOCTOR)
   - Créer prescriptions
   - Consulter résultats
   - Voir historique patient

2. **Caissier** (CASHIER)
   - Voir prescriptions
   - Enregistrer paiements
   - Générer QR codes
   - Imprimer reçus

3. **Radiologue** (RADIOLOGIST)
   - Scanner QR code
   - Voir examens radiologie payés
   - Valider examens effectués
   - Uploader résultats

4. **Laborantin** (LAB_TECHNICIAN)
   - Scanner QR code
   - Voir examens laboratoire payés
   - Valider examens effectués
   - Uploader résultats

5. **Admin** (ADMIN)
   - Gestion utilisateurs
   - Configuration système
   - Rapports globaux

## 📊 MODÈLES DE DONNÉES PRINCIPAUX

### User
```javascript
{
  id: UUID,
  email: String (unique),
  password: String (hashed),
  firstName: String,
  lastName: String,
  role: ENUM('DOCTOR', 'CASHIER', 'RADIOLOGIST', 'LAB_TECHNICIAN', 'ADMIN'),
  phone: String,
  isActive: Boolean,
  createdAt: DateTime,
  updatedAt: DateTime
}
```

### Patient
```javascript
{
  id: UUID,
  patientNumber: String (unique, auto-généré),
  firstName: String,
  lastName: String,
  dateOfBirth: Date,
  gender: ENUM('M', 'F'),
  phone: String,
  address: String,
  email: String (nullable),
  createdAt: DateTime,
  updatedAt: DateTime
}
```

### Prescription
```javascript
{
  id: UUID,
  prescriptionNumber: String (unique, auto-généré),
  patientId: UUID (FK),
  doctorId: UUID (FK),
  prescriptionDate: DateTime,
  status: ENUM('PENDING', 'PAID', 'COMPLETED', 'CANCELLED'),
  totalAmount: Decimal(10,2),
  notes: Text,
  createdAt: DateTime,
  updatedAt: DateTime
}
```

### Exam
```javascript
{
  id: UUID,
  code: String (unique),
  name: String,
  category: ENUM('RADIOLOGY', 'LABORATORY'),
  price: Decimal(10,2),
  description: Text,
  isActive: Boolean,
  createdAt: DateTime,
  updatedAt: DateTime
}
```

### PrescriptionExam (table de liaison)
```javascript
{
  id: UUID,
  prescriptionId: UUID (FK),
  examId: UUID (FK),
  quantity: Integer (default 1),
  price: Decimal(10,2),
  status: ENUM('PENDING', 'PAID', 'IN_PROGRESS', 'COMPLETED'),
  performedBy: UUID (FK User, nullable),
  performedAt: DateTime (nullable),
  createdAt: DateTime,
  updatedAt: DateTime
}
```

### Payment
```javascript
{
  id: UUID,
  paymentNumber: String (unique, auto-généré),
  prescriptionId: UUID (FK),
  amount: Decimal(10,2),
  paymentMethod: ENUM('CASH', 'MOBILE_MONEY', 'CARD'),
  paymentStatus: ENUM('PENDING', 'SUCCESS', 'FAILED'),
  qrCode: String (unique),
  cashierId: UUID (FK),
  transactionReference: String (nullable),
  paymentDate: DateTime,
  createdAt: DateTime,
  updatedAt: DateTime
}
```

### Result
```javascript
{
  id: UUID,
  prescriptionExamId: UUID (FK),
  filePath: String,
  fileType: ENUM('PDF', 'IMAGE', 'DICOM'),
  uploadedBy: UUID (FK User),
  uploadDate: DateTime,
  comments: Text,
  isValidated: Boolean,
  validatedBy: UUID (FK User, nullable),
  validatedAt: DateTime (nullable),
  createdAt: DateTime,
  updatedAt: DateTime
}
```

## 🔒 SÉCURITÉ & BONNES PRATIQUES

### Backend
1. **Authentification**
   - JWT avec expiration (24h pour access, 7j pour refresh)
   - Middleware auth sur toutes les routes protégées
   - Role-based access control (RBAC)

2. **Validation**
   - Valider TOUS les inputs avec express-validator ou Joi
   - Sanitize les données
   - Protéger contre SQL injection (Sequelize le fait)

3. **Sécurité**
   - Helmet pour headers HTTP sécurisés
   - CORS configuré pour frontend uniquement
   - Rate limiting sur auth endpoints
   - Passwords hashés avec bcrypt (10 rounds)
   - Variables sensibles dans .env

4. **Erreurs**
   - Middleware centralisé de gestion d'erreurs
   - Logs avec Winston
   - Messages d'erreur génériques côté client

### Frontend
1. **Auth**
   - Token stocké en localStorage (avec considération sécurité)
   - Intercepteur Axios pour auto-ajout du token
   - Redirection auto si token expiré
   - Protected routes avec vérification de rôle

2. **UX**
   - Loading states partout
   - Error boundaries React
   - Messages de succès/erreur avec MUI Snackbar
   - Confirmations avant actions destructives

3. **Performance**
   - Lazy loading des routes
   - Memoization où nécessaire
   - Debounce sur recherches

## 🎨 GUIDELINES UI/UX

### Design System
- Utiliser Material-UI v5 strictement
- Palette de couleurs médicale:
  ```javascript
  primary: '#1976d2' (bleu médical)
  secondary: '#dc004e' (rouge urgence)
  success: '#4caf50'
  warning: '#ff9800'
  error: '#f44336'
  ```

### Composants clés
1. **Dashboard médecin**: Formulaire prescription + recherche patient
2. **Dashboard caisse**: Liste prescriptions + paiement + QR
3. **Dashboard service**: Scanner QR + liste examens + validation
4. **Portail patient**: Historique + résultats

### Responsive
- Mobile-first approach
- Breakpoints MUI standard
- Sidebar collapsible sur mobile

## 📝 CONVENTIONS DE CODE

### JavaScript
```javascript
// Nommage
const myVariable = 'camelCase';
const MyComponent = () => {}; // PascalCase pour composants
const MY_CONSTANT = 'UPPERCASE';

// Async/Await partout (pas de .then())
const fetchData = async () => {
  try {
    const response = await api.get('/endpoint');
    return response.data;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

// Arrow functions privilégiées
const add = (a, b) => a + b;

// Destructuring
const { data, loading, error } = useApi();
```

### Structure fichiers
- 1 composant = 1 fichier
- Nom de fichier = nom du composant
- Index.js pour exports groupés si nécessaire

### Commentaires
- JSDoc pour fonctions importantes
- Commentaires pour logique complexe
- TODO pour tâches futures

## ⚙️ CONFIGURATION ENVIRONNEMENT

### Backend .env
```
# Server
NODE_ENV=development
PORT=5000

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

# Email (optionnel pour l'instant)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=

# SMS (optionnel pour l'instant)
SMS_API_KEY=
```

### Frontend .env
```
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_ENV=development
```

## 🧪 TESTS & VALIDATION

Pour chaque phase, valider:
1. **Backend**
   - Test routes avec Postman/Thunder Client
   - Vérifier logs console
   - Tester avec données invalides
   - Vérifier DB après opérations

2. **Frontend**
   - Test navigation
   - Test formulaires (validation)
   - Test responsive
   - Test avec différents rôles

3. **Intégration**
   - Test flow complet utilisateur
   - Vérifier cohérence données backend/frontend

## 📚 DOCUMENTATION À CRÉER

1. **README.md**: Installation, démarrage, aperçu
2. **SETUP.md**: Guide détaillé setup environnement
3. **API.md**: Documentation API (endpoints, body, responses)
4. **DATABASE.md**: Schéma DB, migrations, seed data

## 🎯 TES TÂCHES IMMÉDIATES

1. **COMMENCER PAR LIRE** le document `Projet_Digitalisation_Parcours_Patient_CHU_Tokoin.pdf`

2. **CRÉER les fichiers de planification** (PHASE_0_SETUP.md à PHASE_4_ADVANCED.md)
   - Détaille CHAQUE étape
   - Ordre logique de développement
   - Checkboxes pour suivre progression
   - Exemples de code pour points complexes

3. **POSER DES QUESTIONS** si besoin de clarifications sur:
   - Les workflows métier
   - Les règles de gestion
   - Les priorités de fonctionnalités
   - Les cas d'usage spécifiques

4. **ATTENDRE VALIDATION** des fichiers de planification avant de coder

5. **DÉVELOPPER PHASE PAR PHASE**
   - Ne jamais passer à la phase suivante sans validation
   - Commit réguliers avec messages clairs
   - Tests après chaque fonctionnalité

## 💡 CONSEILS SUPPLÉMENTAIRES

- **Simplicité d'abord**: MVP fonctionnel avant optimisations
- **Code propre**: Privilégier lisibilité à la performance prématurée
- **DRY**: Don't Repeat Yourself
- **KISS**: Keep It Simple, Stupid
- **YAGNI**: You Aren't Gonna Need It (ne pas sur-engineer)

- **Gestion erreurs**: Toujours prévoir le cas d'échec
- **Validation**: Côté client ET serveur
- **Sécurité**: Penser sécurité dès le début
- **UX**: Feedback utilisateur à chaque action

## ❓ QUESTIONS À POSER SI NÉCESSAIRE

- Quel catalogue d'examens initial? (radios, analyses...)
- Grille tarifaire exacte?
- Règles de génération des numéros (prescription, patient...)?
- Format des QR codes?
- Règles métier spécifiques CHU Tokoin?
- Intégrations Mobile Money (T-Money, Flooz) maintenant ou plus tard?

## 🚀 COMMANDE DE DÉMARRAGE

Une fois que tu as lu le document et créé les fichiers de planification, commence par:

```bash
# Créer la structure du projet
mkdir chu-tokoin-system
cd chu-tokoin-system
mkdir backend frontend docs

# Backend setup
cd backend
npm init -y
npm install express mysql2 sequelize dotenv cors helmet bcrypt jsonwebtoken express-validator morgan winston qrcode pdfkit multer

# Frontend setup
cd ../frontend
npx create-react-app .
npm install @mui/material @emotion/react @emotion/styled @mui/icons-material axios react-router-dom react-hook-form react-qr-code html5-qrcode

cd ..
```

Ensuite, suis PHASE_0_SETUP.md étape par étape.

---

**ES-TU PRÊT?** Commence par lire le PDF, puis crée les fichiers de planification détaillés. Pose-moi toutes tes questions avant de commencer à coder.
