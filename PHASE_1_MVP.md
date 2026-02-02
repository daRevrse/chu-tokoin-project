# Phase 1: MVP - Authentification, Prescriptions et Paiements

## Objectifs
- Implementer le systeme d'authentification JWT complet
- Creer tous les modeles Sequelize de base
- Developper l'API de gestion des prescriptions
- Implementer le module de paiement et generation QR code
- Creer les interfaces medecin et caissier fonctionnelles

## Prerequis
- Phase 0 completee et validee
- Base de donnees MySQL operationnelle
- Serveurs backend et frontend fonctionnels

## Etapes de developpement

### Backend - Modeles Sequelize

#### 1. [ ] Modele User (models/User.js)
```javascript
const { DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  firstName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  lastName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('DOCTOR', 'CASHIER', 'RADIOLOGIST', 'LAB_TECHNICIAN', 'ADMIN'),
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'users',
  timestamps: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    }
  }
});

User.prototype.validatePassword = async function(password) {
  return bcrypt.compare(password, this.password);
};

User.prototype.toJSON = function() {
  const values = { ...this.get() };
  delete values.password;
  return values;
};

module.exports = User;
```

#### 2. [ ] Modele Patient (models/Patient.js)
```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Patient = sequelize.define('Patient', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  patientNumber: {
    type: DataTypes.STRING(20),
    unique: true,
    allowNull: false
  },
  firstName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  lastName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  dateOfBirth: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  gender: {
    type: DataTypes.ENUM('M', 'F'),
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      isEmail: true
    }
  }
}, {
  tableName: 'patients',
  timestamps: true,
  hooks: {
    beforeCreate: async (patient) => {
      // Generation automatique du numero patient
      const count = await Patient.count();
      const year = new Date().getFullYear();
      patient.patientNumber = `PAT-${year}-${String(count + 1).padStart(6, '0')}`;
    }
  }
});

module.exports = Patient;
```

#### 3. [ ] Modele Exam (models/Exam.js)
```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Exam = sequelize.define('Exam', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  code: {
    type: DataTypes.STRING(20),
    unique: true,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  category: {
    type: DataTypes.ENUM('RADIOLOGY', 'LABORATORY'),
    allowNull: false
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'exams',
  timestamps: true
});

module.exports = Exam;
```

#### 4. [ ] Modele Prescription (models/Prescription.js)
```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Prescription = sequelize.define('Prescription', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  prescriptionNumber: {
    type: DataTypes.STRING(30),
    unique: true,
    allowNull: false
  },
  patientId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'patients',
      key: 'id'
    }
  },
  doctorId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  prescriptionDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'PAID', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'),
    defaultValue: 'PENDING'
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'prescriptions',
  timestamps: true,
  hooks: {
    beforeCreate: async (prescription) => {
      const count = await Prescription.count();
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      prescription.prescriptionNumber = `PRE-${year}${month}-${String(count + 1).padStart(6, '0')}`;
    }
  }
});

module.exports = Prescription;
```

#### 5. [ ] Modele PrescriptionExam (models/PrescriptionExam.js)
```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PrescriptionExam = sequelize.define('PrescriptionExam', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  prescriptionId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'prescriptions',
      key: 'id'
    }
  },
  examId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'exams',
      key: 'id'
    }
  },
  quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'PAID', 'IN_PROGRESS', 'COMPLETED'),
    defaultValue: 'PENDING'
  },
  performedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  performedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'prescription_exams',
  timestamps: true
});

module.exports = PrescriptionExam;
```

#### 6. [ ] Modele Payment (models/Payment.js)
```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  paymentNumber: {
    type: DataTypes.STRING(30),
    unique: true,
    allowNull: false
  },
  prescriptionId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'prescriptions',
      key: 'id'
    }
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  paymentMethod: {
    type: DataTypes.ENUM('CASH', 'MOBILE_MONEY', 'CARD'),
    defaultValue: 'CASH'
  },
  paymentStatus: {
    type: DataTypes.ENUM('PENDING', 'SUCCESS', 'FAILED'),
    defaultValue: 'PENDING'
  },
  qrCode: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  qrCodeData: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  cashierId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  transactionReference: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  paymentDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'payments',
  timestamps: true,
  hooks: {
    beforeCreate: async (payment) => {
      const count = await Payment.count();
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      payment.paymentNumber = `PAY-${year}${month}${day}-${String(count + 1).padStart(6, '0')}`;
    }
  }
});

module.exports = Payment;
```

#### 7. [ ] Index des modeles et associations (models/index.js)
```javascript
const sequelize = require('../config/database');
const User = require('./User');
const Patient = require('./Patient');
const Exam = require('./Exam');
const Prescription = require('./Prescription');
const PrescriptionExam = require('./PrescriptionExam');
const Payment = require('./Payment');

// Associations
// Patient - Prescription
Patient.hasMany(Prescription, { foreignKey: 'patientId', as: 'prescriptions' });
Prescription.belongsTo(Patient, { foreignKey: 'patientId', as: 'patient' });

// User (Doctor) - Prescription
User.hasMany(Prescription, { foreignKey: 'doctorId', as: 'prescriptionsAsDoctor' });
Prescription.belongsTo(User, { foreignKey: 'doctorId', as: 'doctor' });

// Prescription - PrescriptionExam - Exam
Prescription.hasMany(PrescriptionExam, { foreignKey: 'prescriptionId', as: 'prescriptionExams' });
PrescriptionExam.belongsTo(Prescription, { foreignKey: 'prescriptionId', as: 'prescription' });

Exam.hasMany(PrescriptionExam, { foreignKey: 'examId', as: 'prescriptionExams' });
PrescriptionExam.belongsTo(Exam, { foreignKey: 'examId', as: 'exam' });

// User (Performer) - PrescriptionExam
User.hasMany(PrescriptionExam, { foreignKey: 'performedBy', as: 'performedExams' });
PrescriptionExam.belongsTo(User, { foreignKey: 'performedBy', as: 'performer' });

// Prescription - Payment
Prescription.hasMany(Payment, { foreignKey: 'prescriptionId', as: 'payments' });
Payment.belongsTo(Prescription, { foreignKey: 'prescriptionId', as: 'prescription' });

// User (Cashier) - Payment
User.hasMany(Payment, { foreignKey: 'cashierId', as: 'paymentsAsCashier' });
Payment.belongsTo(User, { foreignKey: 'cashierId', as: 'cashier' });

// Synchronisation
const syncDatabase = async (force = false) => {
  try {
    await sequelize.sync({ force });
    console.log('Database synchronized successfully');
  } catch (error) {
    console.error('Error synchronizing database:', error);
  }
};

module.exports = {
  sequelize,
  User,
  Patient,
  Exam,
  Prescription,
  PrescriptionExam,
  Payment,
  syncDatabase
};
```

### Backend - Authentification

#### 8. [ ] Middleware d'authentification (middleware/auth.js)
```javascript
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const jwtConfig = require('../config/jwt');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token d\'authentification requis' });
    }

    const decoded = jwt.verify(token, jwtConfig.secret);
    const user = await User.findByPk(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Utilisateur non trouve ou inactif' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expire' });
    }
    return res.status(403).json({ error: 'Token invalide' });
  }
};

module.exports = authenticateToken;
```

#### 9. [ ] Middleware de verification des roles (middleware/roleCheck.js)
```javascript
const roleCheck = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifie' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Acces refuse. Role requis: ' + allowedRoles.join(' ou ')
      });
    }

    next();
  };
};

module.exports = roleCheck;
```

#### 10. [ ] Controller d'authentification (controllers/authController.js)
```javascript
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const jwtConfig = require('../config/jwt');
const { validationResult } = require('express-validator');

const authController = {
  // Inscription
  register: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, firstName, lastName, role, phone } = req.body;

      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ error: 'Cet email est deja utilise' });
      }

      const user = await User.create({
        email,
        password,
        firstName,
        lastName,
        role,
        phone
      });

      res.status(201).json({
        message: 'Utilisateur cree avec succes',
        user: user.toJSON()
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ error: 'Erreur lors de l\'inscription' });
    }
  },

  // Connexion
  login: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      }

      if (!user.isActive) {
        return res.status(401).json({ error: 'Compte desactive' });
      }

      const isValidPassword = await user.validatePassword(password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      }

      const token = jwt.sign(
        { userId: user.id, role: user.role },
        jwtConfig.secret,
        { expiresIn: jwtConfig.expiresIn }
      );

      const refreshToken = jwt.sign(
        { userId: user.id },
        jwtConfig.secret,
        { expiresIn: jwtConfig.refreshExpiresIn }
      );

      res.json({
        message: 'Connexion reussie',
        token,
        refreshToken,
        user: user.toJSON()
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Erreur lors de la connexion' });
    }
  },

  // Profil utilisateur
  getProfile: async (req, res) => {
    try {
      res.json({ user: req.user.toJSON() });
    } catch (error) {
      console.error('Profile error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation du profil' });
    }
  },

  // Rafraichir le token
  refreshToken: async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token requis' });
      }

      const decoded = jwt.verify(refreshToken, jwtConfig.secret);
      const user = await User.findByPk(decoded.userId);

      if (!user || !user.isActive) {
        return res.status(401).json({ error: 'Utilisateur non trouve ou inactif' });
      }

      const newToken = jwt.sign(
        { userId: user.id, role: user.role },
        jwtConfig.secret,
        { expiresIn: jwtConfig.expiresIn }
      );

      res.json({ token: newToken });
    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(401).json({ error: 'Refresh token invalide' });
    }
  }
};

module.exports = authController;
```

#### 11. [ ] Routes d'authentification (routes/auth.js)
```javascript
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const authenticateToken = require('../middleware/auth');

// Validation pour l'inscription
const registerValidation = [
  body('email').isEmail().withMessage('Email invalide'),
  body('password').isLength({ min: 6 }).withMessage('Mot de passe minimum 6 caracteres'),
  body('firstName').notEmpty().withMessage('Prenom requis'),
  body('lastName').notEmpty().withMessage('Nom requis'),
  body('role').isIn(['DOCTOR', 'CASHIER', 'RADIOLOGIST', 'LAB_TECHNICIAN', 'ADMIN'])
    .withMessage('Role invalide')
];

// Validation pour la connexion
const loginValidation = [
  body('email').isEmail().withMessage('Email invalide'),
  body('password').notEmpty().withMessage('Mot de passe requis')
];

// Routes
router.post('/register', registerValidation, authController.register);
router.post('/login', loginValidation, authController.login);
router.get('/profile', authenticateToken, authController.getProfile);
router.post('/refresh-token', authController.refreshToken);

module.exports = router;
```

### Backend - API Prescriptions

#### 12. [ ] Controller des prescriptions (controllers/prescriptionController.js)
```javascript
const { Prescription, PrescriptionExam, Patient, Exam, User } = require('../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');

const prescriptionController = {
  // Creer une prescription
  create: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { patientId, examIds, notes } = req.body;

      // Verifier que le patient existe
      const patient = await Patient.findByPk(patientId);
      if (!patient) {
        return res.status(404).json({ error: 'Patient non trouve' });
      }

      // Recuperer les examens et calculer le total
      const exams = await Exam.findAll({
        where: { id: { [Op.in]: examIds }, isActive: true }
      });

      if (exams.length !== examIds.length) {
        return res.status(400).json({ error: 'Un ou plusieurs examens invalides' });
      }

      const totalAmount = exams.reduce((sum, exam) => sum + parseFloat(exam.price), 0);

      // Creer la prescription
      const prescription = await Prescription.create({
        patientId,
        doctorId: req.user.id,
        totalAmount,
        notes
      });

      // Ajouter les examens a la prescription
      const prescriptionExams = exams.map(exam => ({
        prescriptionId: prescription.id,
        examId: exam.id,
        price: exam.price
      }));

      await PrescriptionExam.bulkCreate(prescriptionExams);

      // Recuperer la prescription complete
      const fullPrescription = await Prescription.findByPk(prescription.id, {
        include: [
          { model: Patient, as: 'patient' },
          { model: User, as: 'doctor', attributes: ['id', 'firstName', 'lastName'] },
          {
            model: PrescriptionExam,
            as: 'prescriptionExams',
            include: [{ model: Exam, as: 'exam' }]
          }
        ]
      });

      res.status(201).json({
        message: 'Prescription creee avec succes',
        prescription: fullPrescription
      });
    } catch (error) {
      console.error('Create prescription error:', error);
      res.status(500).json({ error: 'Erreur lors de la creation de la prescription' });
    }
  },

  // Lister les prescriptions
  getAll: async (req, res) => {
    try {
      const { status, patientId, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const where = {};
      if (status) where.status = status;
      if (patientId) where.patientId = patientId;

      // Si c'est un medecin, ne montrer que ses prescriptions
      if (req.user.role === 'DOCTOR') {
        where.doctorId = req.user.id;
      }

      const { count, rows } = await Prescription.findAndCountAll({
        where,
        include: [
          { model: Patient, as: 'patient' },
          { model: User, as: 'doctor', attributes: ['id', 'firstName', 'lastName'] },
          {
            model: PrescriptionExam,
            as: 'prescriptionExams',
            include: [{ model: Exam, as: 'exam' }]
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        prescriptions: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          pages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      console.error('Get prescriptions error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation des prescriptions' });
    }
  },

  // Obtenir une prescription par ID
  getById: async (req, res) => {
    try {
      const prescription = await Prescription.findByPk(req.params.id, {
        include: [
          { model: Patient, as: 'patient' },
          { model: User, as: 'doctor', attributes: ['id', 'firstName', 'lastName'] },
          {
            model: PrescriptionExam,
            as: 'prescriptionExams',
            include: [
              { model: Exam, as: 'exam' },
              { model: User, as: 'performer', attributes: ['id', 'firstName', 'lastName'] }
            ]
          }
        ]
      });

      if (!prescription) {
        return res.status(404).json({ error: 'Prescription non trouvee' });
      }

      res.json({ prescription });
    } catch (error) {
      console.error('Get prescription error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation de la prescription' });
    }
  },

  // Annuler une prescription
  cancel: async (req, res) => {
    try {
      const prescription = await Prescription.findByPk(req.params.id);

      if (!prescription) {
        return res.status(404).json({ error: 'Prescription non trouvee' });
      }

      if (prescription.status !== 'PENDING') {
        return res.status(400).json({ error: 'Seules les prescriptions en attente peuvent etre annulees' });
      }

      prescription.status = 'CANCELLED';
      await prescription.save();

      res.json({ message: 'Prescription annulee', prescription });
    } catch (error) {
      console.error('Cancel prescription error:', error);
      res.status(500).json({ error: 'Erreur lors de l\'annulation' });
    }
  }
};

module.exports = prescriptionController;
```

#### 13. [ ] Routes des prescriptions (routes/prescriptions.js)
```javascript
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const prescriptionController = require('../controllers/prescriptionController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// Validation
const createValidation = [
  body('patientId').isUUID().withMessage('ID patient invalide'),
  body('examIds').isArray({ min: 1 }).withMessage('Au moins un examen requis'),
  body('examIds.*').isUUID().withMessage('ID examen invalide')
];

// Routes
router.use(authenticateToken);

router.post('/',
  roleCheck('DOCTOR', 'ADMIN'),
  createValidation,
  prescriptionController.create
);

router.get('/',
  roleCheck('DOCTOR', 'CASHIER', 'ADMIN'),
  prescriptionController.getAll
);

router.get('/:id',
  roleCheck('DOCTOR', 'CASHIER', 'RADIOLOGIST', 'LAB_TECHNICIAN', 'ADMIN'),
  prescriptionController.getById
);

router.patch('/:id/cancel',
  roleCheck('DOCTOR', 'ADMIN'),
  prescriptionController.cancel
);

module.exports = router;
```

### Backend - API Paiements et QR Code

#### 14. [ ] Service QR Code (services/qrcodeService.js)
```javascript
const QRCode = require('qrcode');

const qrcodeService = {
  generateQRCode: async (data) => {
    try {
      const qrData = JSON.stringify(data);
      const qrCodeImage = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      return { qrCodeImage, qrData };
    } catch (error) {
      console.error('QR Code generation error:', error);
      throw new Error('Erreur lors de la generation du QR code');
    }
  },

  parseQRCode: (qrData) => {
    try {
      return JSON.parse(qrData);
    } catch (error) {
      throw new Error('QR code invalide');
    }
  }
};

module.exports = qrcodeService;
```

#### 15. [ ] Controller des paiements (controllers/paymentController.js)
```javascript
const { Payment, Prescription, PrescriptionExam, Patient, Exam } = require('../models');
const qrcodeService = require('../services/qrcodeService');
const { validationResult } = require('express-validator');

const paymentController = {
  // Enregistrer un paiement
  create: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { prescriptionId, paymentMethod, transactionReference } = req.body;

      // Verifier la prescription
      const prescription = await Prescription.findByPk(prescriptionId, {
        include: [
          { model: Patient, as: 'patient' },
          {
            model: PrescriptionExam,
            as: 'prescriptionExams',
            include: [{ model: Exam, as: 'exam' }]
          }
        ]
      });

      if (!prescription) {
        return res.status(404).json({ error: 'Prescription non trouvee' });
      }

      if (prescription.status !== 'PENDING') {
        return res.status(400).json({ error: 'Cette prescription a deja ete traitee' });
      }

      // Generer les donnees QR
      const qrData = {
        paymentId: null, // Sera mis a jour apres creation
        prescriptionNumber: prescription.prescriptionNumber,
        patientNumber: prescription.patient.patientNumber,
        patientName: `${prescription.patient.lastName} ${prescription.patient.firstName}`,
        amount: prescription.totalAmount,
        exams: prescription.prescriptionExams.map(pe => ({
          code: pe.exam.code,
          name: pe.exam.name,
          category: pe.exam.category
        })),
        paidAt: new Date().toISOString()
      };

      const { qrCodeImage, qrData: qrDataString } = await qrcodeService.generateQRCode(qrData);

      // Creer le paiement
      const payment = await Payment.create({
        prescriptionId,
        amount: prescription.totalAmount,
        paymentMethod,
        paymentStatus: 'SUCCESS',
        qrCode: qrCodeImage,
        qrCodeData: qrDataString,
        cashierId: req.user.id,
        transactionReference
      });

      // Mettre a jour le QR avec l'ID du paiement
      qrData.paymentId = payment.id;
      const updatedQR = await qrcodeService.generateQRCode(qrData);
      payment.qrCode = updatedQR.qrCodeImage;
      payment.qrCodeData = updatedQR.qrData;
      await payment.save();

      // Mettre a jour le statut de la prescription et des examens
      prescription.status = 'PAID';
      await prescription.save();

      await PrescriptionExam.update(
        { status: 'PAID' },
        { where: { prescriptionId: prescription.id } }
      );

      res.status(201).json({
        message: 'Paiement enregistre avec succes',
        payment: {
          ...payment.toJSON(),
          prescription
        }
      });
    } catch (error) {
      console.error('Create payment error:', error);
      res.status(500).json({ error: 'Erreur lors de l\'enregistrement du paiement' });
    }
  },

  // Obtenir un paiement par ID
  getById: async (req, res) => {
    try {
      const payment = await Payment.findByPk(req.params.id, {
        include: [{
          model: Prescription,
          as: 'prescription',
          include: [
            { model: Patient, as: 'patient' },
            {
              model: PrescriptionExam,
              as: 'prescriptionExams',
              include: [{ model: Exam, as: 'exam' }]
            }
          ]
        }]
      });

      if (!payment) {
        return res.status(404).json({ error: 'Paiement non trouve' });
      }

      res.json({ payment });
    } catch (error) {
      console.error('Get payment error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation du paiement' });
    }
  },

  // Lister les paiements
  getAll: async (req, res) => {
    try {
      const { page = 1, limit = 20, status } = req.query;
      const offset = (page - 1) * limit;

      const where = {};
      if (status) where.paymentStatus = status;

      // Si c'est un caissier, ne montrer que ses paiements
      if (req.user.role === 'CASHIER') {
        where.cashierId = req.user.id;
      }

      const { count, rows } = await Payment.findAndCountAll({
        where,
        include: [{
          model: Prescription,
          as: 'prescription',
          include: [{ model: Patient, as: 'patient' }]
        }],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        payments: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          pages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      console.error('Get payments error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation des paiements' });
    }
  }
};

module.exports = paymentController;
```

#### 16. [ ] Routes des paiements (routes/payments.js)
```javascript
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const paymentController = require('../controllers/paymentController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// Validation
const createValidation = [
  body('prescriptionId').isUUID().withMessage('ID prescription invalide'),
  body('paymentMethod').isIn(['CASH', 'MOBILE_MONEY', 'CARD']).withMessage('Methode de paiement invalide')
];

// Routes
router.use(authenticateToken);

router.post('/',
  roleCheck('CASHIER', 'ADMIN'),
  createValidation,
  paymentController.create
);

router.get('/',
  roleCheck('CASHIER', 'ADMIN'),
  paymentController.getAll
);

router.get('/:id',
  roleCheck('CASHIER', 'RADIOLOGIST', 'LAB_TECHNICIAN', 'ADMIN'),
  paymentController.getById
);

module.exports = router;
```

### Backend - API Patients et Examens

#### 17. [ ] Controller des patients (controllers/patientController.js)
```javascript
const { Patient, Prescription } = require('../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');

const patientController = {
  // Creer un patient
  create: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const patient = await Patient.create(req.body);
      res.status(201).json({ message: 'Patient cree', patient });
    } catch (error) {
      console.error('Create patient error:', error);
      res.status(500).json({ error: 'Erreur lors de la creation du patient' });
    }
  },

  // Rechercher des patients
  search: async (req, res) => {
    try {
      const { q, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const where = q ? {
        [Op.or]: [
          { firstName: { [Op.like]: `%${q}%` } },
          { lastName: { [Op.like]: `%${q}%` } },
          { patientNumber: { [Op.like]: `%${q}%` } },
          { phone: { [Op.like]: `%${q}%` } }
        ]
      } : {};

      const { count, rows } = await Patient.findAndCountAll({
        where,
        order: [['lastName', 'ASC'], ['firstName', 'ASC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        patients: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          pages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      console.error('Search patients error:', error);
      res.status(500).json({ error: 'Erreur lors de la recherche' });
    }
  },

  // Obtenir un patient par ID
  getById: async (req, res) => {
    try {
      const patient = await Patient.findByPk(req.params.id, {
        include: [{ model: Prescription, as: 'prescriptions' }]
      });

      if (!patient) {
        return res.status(404).json({ error: 'Patient non trouve' });
      }

      res.json({ patient });
    } catch (error) {
      console.error('Get patient error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation du patient' });
    }
  },

  // Mettre a jour un patient
  update: async (req, res) => {
    try {
      const patient = await Patient.findByPk(req.params.id);

      if (!patient) {
        return res.status(404).json({ error: 'Patient non trouve' });
      }

      await patient.update(req.body);
      res.json({ message: 'Patient mis a jour', patient });
    } catch (error) {
      console.error('Update patient error:', error);
      res.status(500).json({ error: 'Erreur lors de la mise a jour' });
    }
  }
};

module.exports = patientController;
```

#### 18. [ ] Controller des examens (controllers/examController.js)
```javascript
const { Exam } = require('../models');
const { validationResult } = require('express-validator');

const examController = {
  // Lister tous les examens
  getAll: async (req, res) => {
    try {
      const { category, active } = req.query;
      const where = {};

      if (category) where.category = category;
      if (active !== undefined) where.isActive = active === 'true';

      const exams = await Exam.findAll({
        where,
        order: [['category', 'ASC'], ['name', 'ASC']]
      });

      res.json({ exams });
    } catch (error) {
      console.error('Get exams error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation des examens' });
    }
  },

  // Creer un examen (admin)
  create: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const exam = await Exam.create(req.body);
      res.status(201).json({ message: 'Examen cree', exam });
    } catch (error) {
      console.error('Create exam error:', error);
      res.status(500).json({ error: 'Erreur lors de la creation de l\'examen' });
    }
  },

  // Mettre a jour un examen
  update: async (req, res) => {
    try {
      const exam = await Exam.findByPk(req.params.id);

      if (!exam) {
        return res.status(404).json({ error: 'Examen non trouve' });
      }

      await exam.update(req.body);
      res.json({ message: 'Examen mis a jour', exam });
    } catch (error) {
      console.error('Update exam error:', error);
      res.status(500).json({ error: 'Erreur lors de la mise a jour' });
    }
  }
};

module.exports = examController;
```

#### 19. [ ] Routes patients et examens
```javascript
// routes/patients.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const patientController = require('../controllers/patientController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

const createValidation = [
  body('firstName').notEmpty().withMessage('Prenom requis'),
  body('lastName').notEmpty().withMessage('Nom requis'),
  body('dateOfBirth').isDate().withMessage('Date de naissance invalide'),
  body('gender').isIn(['M', 'F']).withMessage('Genre invalide'),
  body('phone').notEmpty().withMessage('Telephone requis')
];

router.use(authenticateToken);

router.post('/', roleCheck('DOCTOR', 'ADMIN'), createValidation, patientController.create);
router.get('/', roleCheck('DOCTOR', 'CASHIER', 'ADMIN'), patientController.search);
router.get('/:id', patientController.getById);
router.put('/:id', roleCheck('DOCTOR', 'ADMIN'), patientController.update);

module.exports = router;

// routes/exams.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const examController = require('../controllers/examController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

const createValidation = [
  body('code').notEmpty().withMessage('Code requis'),
  body('name').notEmpty().withMessage('Nom requis'),
  body('category').isIn(['RADIOLOGY', 'LABORATORY']).withMessage('Categorie invalide'),
  body('price').isDecimal().withMessage('Prix invalide')
];

router.use(authenticateToken);

router.get('/', examController.getAll);
router.post('/', roleCheck('ADMIN'), createValidation, examController.create);
router.put('/:id', roleCheck('ADMIN'), examController.update);

module.exports = router;
```

#### 20. [ ] Mise a jour server.js avec toutes les routes
```javascript
// Ajouter apres les middleware existants
const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const examRoutes = require('./routes/exams');
const prescriptionRoutes = require('./routes/prescriptions');
const paymentRoutes = require('./routes/payments');

app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/payments', paymentRoutes);
```

### Backend - Seeds (Donnees initiales)

#### 21. [ ] Script de seed (seeds/initialData.js)
```javascript
const { User, Exam, syncDatabase } = require('../models');
const bcrypt = require('bcrypt');

const seedData = async () => {
  try {
    await syncDatabase(true); // Force: recree les tables

    // Creer les utilisateurs de test
    const users = [
      {
        email: 'admin@chu-tokoin.tg',
        password: 'Admin123!',
        firstName: 'Admin',
        lastName: 'System',
        role: 'ADMIN',
        phone: '+228 90 00 00 00'
      },
      {
        email: 'medecin@chu-tokoin.tg',
        password: 'Medecin123!',
        firstName: 'Jean',
        lastName: 'KOFFI',
        role: 'DOCTOR',
        phone: '+228 90 11 11 11'
      },
      {
        email: 'caissier@chu-tokoin.tg',
        password: 'Caissier123!',
        firstName: 'Marie',
        lastName: 'ADJO',
        role: 'CASHIER',
        phone: '+228 90 22 22 22'
      },
      {
        email: 'radio@chu-tokoin.tg',
        password: 'Radio123!',
        firstName: 'Pierre',
        lastName: 'MENSAH',
        role: 'RADIOLOGIST',
        phone: '+228 90 33 33 33'
      },
      {
        email: 'labo@chu-tokoin.tg',
        password: 'Labo123!',
        firstName: 'Sophie',
        lastName: 'AGBEKO',
        role: 'LAB_TECHNICIAN',
        phone: '+228 90 44 44 44'
      }
    ];

    for (const userData of users) {
      await User.create(userData);
    }

    // Creer le catalogue d'examens
    const exams = [
      // Radiologie
      { code: 'RAD-001', name: 'Radiographie thoracique', category: 'RADIOLOGY', price: 15000 },
      { code: 'RAD-002', name: 'Radiographie abdominale', category: 'RADIOLOGY', price: 15000 },
      { code: 'RAD-003', name: 'Radiographie du crane', category: 'RADIOLOGY', price: 20000 },
      { code: 'RAD-004', name: 'Radiographie des membres', category: 'RADIOLOGY', price: 12000 },
      { code: 'RAD-005', name: 'Echographie abdominale', category: 'RADIOLOGY', price: 25000 },
      { code: 'RAD-006', name: 'Echographie pelvienne', category: 'RADIOLOGY', price: 25000 },
      { code: 'RAD-007', name: 'Echographie obstetricale', category: 'RADIOLOGY', price: 30000 },
      { code: 'RAD-008', name: 'Scanner cerebral', category: 'RADIOLOGY', price: 80000 },
      { code: 'RAD-009', name: 'Scanner thoracique', category: 'RADIOLOGY', price: 100000 },
      { code: 'RAD-010', name: 'Scanner abdominal', category: 'RADIOLOGY', price: 100000 },

      // Laboratoire
      { code: 'LAB-001', name: 'Hemogramme complet (NFS)', category: 'LABORATORY', price: 5000 },
      { code: 'LAB-002', name: 'Glycemie a jeun', category: 'LABORATORY', price: 3000 },
      { code: 'LAB-003', name: 'Creatininemie', category: 'LABORATORY', price: 4000 },
      { code: 'LAB-004', name: 'Transaminases (ASAT/ALAT)', category: 'LABORATORY', price: 8000 },
      { code: 'LAB-005', name: 'Bilan lipidique', category: 'LABORATORY', price: 15000 },
      { code: 'LAB-006', name: 'Test VIH', category: 'LABORATORY', price: 5000 },
      { code: 'LAB-007', name: 'Goutte epaisse (paludisme)', category: 'LABORATORY', price: 3000 },
      { code: 'LAB-008', name: 'ECBU', category: 'LABORATORY', price: 8000 },
      { code: 'LAB-009', name: 'Coproculture', category: 'LABORATORY', price: 10000 },
      { code: 'LAB-010', name: 'Groupage sanguin ABO-Rh', category: 'LABORATORY', price: 5000 },
      { code: 'LAB-011', name: 'Ionogramme sanguin', category: 'LABORATORY', price: 12000 },
      { code: 'LAB-012', name: 'TSH (thyroide)', category: 'LABORATORY', price: 15000 },
      { code: 'LAB-013', name: 'PSA (prostate)', category: 'LABORATORY', price: 20000 },
      { code: 'LAB-014', name: 'Test de grossesse (Beta-HCG)', category: 'LABORATORY', price: 8000 },
      { code: 'LAB-015', name: 'Vitesse de sedimentation', category: 'LABORATORY', price: 3000 }
    ];

    for (const examData of exams) {
      await Exam.create(examData);
    }

    console.log('Seed completed successfully!');
    console.log('Users created:', users.length);
    console.log('Exams created:', exams.length);
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedData();
```

### Frontend - Composants de base

#### 22. [ ] Context d'authentification (contexts/AuthContext.jsx)
```javascript
import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const { token, refreshToken, user } = response.data;

    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));

    setUser(user);
    return user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
```

#### 23. [ ] Page de connexion (pages/Login.jsx)
```javascript
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(email, password);

      // Redirection selon le role
      switch (user.role) {
        case 'DOCTOR':
          navigate('/doctor');
          break;
        case 'CASHIER':
          navigate('/cashier');
          break;
        case 'RADIOLOGIST':
        case 'LAB_TECHNICIAN':
          navigate('/service');
          break;
        case 'ADMIN':
          navigate('/admin');
          break;
        default:
          navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default'
      }}
    >
      <Card sx={{ maxWidth: 400, width: '100%', mx: 2 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" align="center" gutterBottom>
            CHU Tokoin
          </Typography>
          <Typography variant="subtitle1" align="center" color="textSecondary" sx={{ mb: 4 }}>
            Systeme de Gestion des Examens
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              margin="normal"
              required
              autoFocus
            />
            <TextField
              fullWidth
              label="Mot de passe"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              required
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{ mt: 3 }}
            >
              {loading ? <CircularProgress size={24} /> : 'Se connecter'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Login;
```

#### 24. [ ] Composant ProtectedRoute (components/auth/ProtectedRoute.jsx)
```javascript
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default ProtectedRoute;
```

#### 25. [ ] Layout principal avec Sidebar (components/common/Layout.jsx)
- Navbar avec info utilisateur et logout
- Sidebar avec menu selon le role
- Zone de contenu principal

#### 26. [ ] Dashboard Medecin (pages/DoctorDashboard.jsx)
- Recherche patient
- Creation nouveau patient
- Formulaire de prescription
- Selection d'examens
- Calcul automatique du total
- Liste des prescriptions recentes

#### 27. [ ] Dashboard Caissier (pages/CashierDashboard.jsx)
- Liste des prescriptions en attente de paiement
- Formulaire de paiement
- Selection methode de paiement
- Generation et affichage du QR code
- Impression du recu

#### 28. [ ] Configuration App.jsx avec routes
```javascript
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Login from './pages/Login';
import DoctorDashboard from './pages/DoctorDashboard';
import CashierDashboard from './pages/CashierDashboard';
// ... autres imports

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/doctor/*"
              element={
                <ProtectedRoute allowedRoles={['DOCTOR', 'ADMIN']}>
                  <DoctorDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cashier/*"
              element={
                <ProtectedRoute allowedRoles={['CASHIER', 'ADMIN']}>
                  <CashierDashboard />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
```

## Tests a effectuer

### Backend
- [ ] POST /api/auth/register - Creation utilisateur
- [ ] POST /api/auth/login - Connexion et reception token
- [ ] GET /api/auth/profile - Profil avec token valide
- [ ] POST /api/patients - Creation patient
- [ ] GET /api/patients?q=xxx - Recherche patient
- [ ] GET /api/exams - Liste des examens
- [ ] POST /api/prescriptions - Creation prescription
- [ ] GET /api/prescriptions - Liste prescriptions
- [ ] POST /api/payments - Enregistrement paiement et generation QR
- [ ] Verification des roles et permissions

### Frontend
- [ ] Page login fonctionnelle
- [ ] Redirection selon role
- [ ] Dashboard medecin: recherche patient
- [ ] Dashboard medecin: creation prescription
- [ ] Dashboard caissier: liste prescriptions
- [ ] Dashboard caissier: paiement et QR code
- [ ] Deconnexion fonctionnelle

### Integration
- [ ] Flow complet: medecin cree prescription -> caissier paie -> QR genere
- [ ] Calcul correct des montants
- [ ] Statuts mis a jour correctement
- [ ] QR code contient les bonnes informations

## Points de validation
- [ ] Authentification JWT complete
- [ ] RBAC fonctionnel
- [ ] CRUD complet sur patients, prescriptions, paiements
- [ ] QR code genere avec donnees valides
- [ ] Interfaces medecin et caissier operationnelles
- [ ] Donnees initiales (seed) chargees

## Prochaines etapes
-> PHASE_2_EXAMS.md : Scan QR et gestion des examens par les services
