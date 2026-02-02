# Phase 3: Gestion des Resultats et Dossier Patient

## Objectifs
- Implementer l'upload des resultats d'examens (PDF, images)
- Creer le dossier patient numerique complet
- Permettre la consultation des resultats par les medecins
- Developper l'historique medical du patient
- Creer le portail patient pour consultation des resultats

## Prerequis
- Phase 2 completee et validee
- Examens peuvent etre marques comme termines
- Systeme de fichiers configure pour les uploads

## Etapes de developpement

### Backend - Modele Result

#### 1. [ ] Modele Result (models/Result.js)
```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Result = sequelize.define('Result', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  prescriptionExamId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'prescription_exams',
      key: 'id'
    }
  },
  filePath: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  fileName: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  fileType: {
    type: DataTypes.ENUM('PDF', 'IMAGE', 'DICOM'),
    allowNull: false
  },
  mimeType: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  fileSize: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  uploadedBy: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  uploadDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  comments: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  conclusion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  isValidated: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  validatedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  validatedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'results',
  timestamps: true
});

module.exports = Result;
```

#### 2. [ ] Mise a jour des associations (models/index.js)
```javascript
// Ajouter aux imports
const Result = require('./Result');

// Ajouter les associations
PrescriptionExam.hasMany(Result, { foreignKey: 'prescriptionExamId', as: 'results' });
Result.belongsTo(PrescriptionExam, { foreignKey: 'prescriptionExamId', as: 'prescriptionExam' });

User.hasMany(Result, { foreignKey: 'uploadedBy', as: 'uploadedResults' });
Result.belongsTo(User, { foreignKey: 'uploadedBy', as: 'uploader' });

User.hasMany(Result, { foreignKey: 'validatedBy', as: 'validatedResults' });
Result.belongsTo(User, { foreignKey: 'validatedBy', as: 'validator' });

// Exporter Result
module.exports = {
  // ... existants
  Result,
};
```

### Backend - Configuration Upload

#### 3. [ ] Middleware upload (middleware/upload.js)
```javascript
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

// Creer le dossier uploads s'il n'existe pas
const uploadDir = process.env.UPLOAD_PATH || './uploads';
const resultsDir = path.join(uploadDir, 'results');

if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

// Configuration du stockage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Organiser par date
    const date = new Date();
    const yearMonth = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`;
    const destDir = path.join(resultsDir, yearMonth);

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    cb(null, destDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// Filtre des types de fichiers
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/dicom'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non autorise. Formats acceptes: PDF, JPEG, PNG, GIF, DICOM'), false);
  }
};

// Configuration multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB par defaut
  }
});

// Determiner le type de fichier
const getFileType = (mimeType) => {
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType === 'application/dicom') return 'DICOM';
  return 'PDF';
};

module.exports = {
  upload,
  getFileType,
  resultsDir
};
```

### Backend - API Resultats

#### 4. [ ] Controller des resultats (controllers/resultController.js)
```javascript
const { Result, PrescriptionExam, Prescription, Patient, Exam, User } = require('../models');
const { getFileType } = require('../middleware/upload');
const { validationResult } = require('express-validator');
const path = require('path');
const fs = require('fs');

const resultController = {
  // Upload d'un resultat
  upload: async (req, res) => {
    try {
      const { prescriptionExamId, comments, conclusion } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: 'Fichier requis' });
      }

      // Verifier que l'examen existe et est termine
      const prescriptionExam = await PrescriptionExam.findByPk(prescriptionExamId, {
        include: [{ model: Exam, as: 'exam' }]
      });

      if (!prescriptionExam) {
        // Supprimer le fichier uploade
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: 'Examen non trouve' });
      }

      // Verifier les permissions selon le role
      const userCategory = req.user.role === 'RADIOLOGIST' ? 'RADIOLOGY' : 'LABORATORY';
      if (prescriptionExam.exam.category !== userCategory && req.user.role !== 'ADMIN') {
        fs.unlinkSync(req.file.path);
        return res.status(403).json({ error: 'Vous n\'etes pas autorise a uploader pour cet examen' });
      }

      // Creer le resultat
      const result = await Result.create({
        prescriptionExamId,
        filePath: req.file.path,
        fileName: req.file.originalname,
        fileType: getFileType(req.file.mimetype),
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        uploadedBy: req.user.id,
        comments,
        conclusion
      });

      // Charger les relations
      const fullResult = await Result.findByPk(result.id, {
        include: [
          { model: User, as: 'uploader', attributes: ['id', 'firstName', 'lastName'] }
        ]
      });

      res.status(201).json({
        message: 'Resultat uploade avec succes',
        result: fullResult
      });
    } catch (error) {
      // Supprimer le fichier en cas d'erreur
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      console.error('Upload result error:', error);
      res.status(500).json({ error: 'Erreur lors de l\'upload du resultat' });
    }
  },

  // Obtenir les resultats d'un examen
  getByExam: async (req, res) => {
    try {
      const { prescriptionExamId } = req.params;

      const results = await Result.findAll({
        where: { prescriptionExamId },
        include: [
          { model: User, as: 'uploader', attributes: ['id', 'firstName', 'lastName'] },
          { model: User, as: 'validator', attributes: ['id', 'firstName', 'lastName'] }
        ],
        order: [['uploadDate', 'DESC']]
      });

      res.json({ results });
    } catch (error) {
      console.error('Get results error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation des resultats' });
    }
  },

  // Telecharger un fichier resultat
  download: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await Result.findByPk(id);
      if (!result) {
        return res.status(404).json({ error: 'Resultat non trouve' });
      }

      // Verifier que le fichier existe
      if (!fs.existsSync(result.filePath)) {
        return res.status(404).json({ error: 'Fichier non trouve sur le serveur' });
      }

      res.download(result.filePath, result.fileName);
    } catch (error) {
      console.error('Download result error:', error);
      res.status(500).json({ error: 'Erreur lors du telechargement' });
    }
  },

  // Valider un resultat (medecin senior)
  validate: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await Result.findByPk(id);
      if (!result) {
        return res.status(404).json({ error: 'Resultat non trouve' });
      }

      if (result.isValidated) {
        return res.status(400).json({ error: 'Resultat deja valide' });
      }

      result.isValidated = true;
      result.validatedBy = req.user.id;
      result.validatedAt = new Date();
      await result.save();

      const fullResult = await Result.findByPk(result.id, {
        include: [
          { model: User, as: 'uploader', attributes: ['id', 'firstName', 'lastName'] },
          { model: User, as: 'validator', attributes: ['id', 'firstName', 'lastName'] }
        ]
      });

      res.json({
        message: 'Resultat valide',
        result: fullResult
      });
    } catch (error) {
      console.error('Validate result error:', error);
      res.status(500).json({ error: 'Erreur lors de la validation' });
    }
  },

  // Mettre a jour les commentaires/conclusion
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { comments, conclusion } = req.body;

      const result = await Result.findByPk(id);
      if (!result) {
        return res.status(404).json({ error: 'Resultat non trouve' });
      }

      // Seul l'uploader ou un admin peut modifier
      if (result.uploadedBy !== req.user.id && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Non autorise a modifier ce resultat' });
      }

      await result.update({ comments, conclusion });

      res.json({
        message: 'Resultat mis a jour',
        result
      });
    } catch (error) {
      console.error('Update result error:', error);
      res.status(500).json({ error: 'Erreur lors de la mise a jour' });
    }
  },

  // Supprimer un resultat
  delete: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await Result.findByPk(id);
      if (!result) {
        return res.status(404).json({ error: 'Resultat non trouve' });
      }

      // Seul l'uploader ou un admin peut supprimer
      if (result.uploadedBy !== req.user.id && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Non autorise a supprimer ce resultat' });
      }

      // Supprimer le fichier physique
      if (fs.existsSync(result.filePath)) {
        fs.unlinkSync(result.filePath);
      }

      await result.destroy();

      res.json({ message: 'Resultat supprime' });
    } catch (error) {
      console.error('Delete result error:', error);
      res.status(500).json({ error: 'Erreur lors de la suppression' });
    }
  }
};

module.exports = resultController;
```

#### 5. [ ] Routes des resultats (routes/results.js)
```javascript
const express = require('express');
const router = express.Router();
const resultController = require('../controllers/resultController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { upload } = require('../middleware/upload');

router.use(authenticateToken);

// Upload resultat (radiologues, laborantins)
router.post('/',
  roleCheck('RADIOLOGIST', 'LAB_TECHNICIAN', 'ADMIN'),
  upload.single('file'),
  resultController.upload
);

// Resultats d'un examen
router.get('/exam/:prescriptionExamId',
  roleCheck('DOCTOR', 'RADIOLOGIST', 'LAB_TECHNICIAN', 'ADMIN'),
  resultController.getByExam
);

// Telecharger un resultat
router.get('/:id/download',
  roleCheck('DOCTOR', 'RADIOLOGIST', 'LAB_TECHNICIAN', 'ADMIN'),
  resultController.download
);

// Valider un resultat
router.patch('/:id/validate',
  roleCheck('DOCTOR', 'ADMIN'),
  resultController.validate
);

// Modifier un resultat
router.put('/:id',
  roleCheck('RADIOLOGIST', 'LAB_TECHNICIAN', 'ADMIN'),
  resultController.update
);

// Supprimer un resultat
router.delete('/:id',
  roleCheck('RADIOLOGIST', 'LAB_TECHNICIAN', 'ADMIN'),
  resultController.delete
);

module.exports = router;
```

### Backend - API Dossier Patient

#### 6. [ ] Controller dossier patient (controllers/patientRecordController.js)
```javascript
const { Patient, Prescription, PrescriptionExam, Exam, Result, User, Payment } = require('../models');
const { Op } = require('sequelize');

const patientRecordController = {
  // Dossier complet du patient
  getFullRecord: async (req, res) => {
    try {
      const { patientId } = req.params;

      const patient = await Patient.findByPk(patientId, {
        include: [{
          model: Prescription,
          as: 'prescriptions',
          include: [
            { model: User, as: 'doctor', attributes: ['id', 'firstName', 'lastName'] },
            {
              model: PrescriptionExam,
              as: 'prescriptionExams',
              include: [
                { model: Exam, as: 'exam' },
                {
                  model: Result,
                  as: 'results',
                  include: [
                    { model: User, as: 'uploader', attributes: ['id', 'firstName', 'lastName'] }
                  ]
                },
                { model: User, as: 'performer', attributes: ['id', 'firstName', 'lastName'] }
              ]
            },
            { model: Payment, as: 'payments' }
          ],
          order: [['prescriptionDate', 'DESC']]
        }]
      });

      if (!patient) {
        return res.status(404).json({ error: 'Patient non trouve' });
      }

      res.json({ patient });
    } catch (error) {
      console.error('Get patient record error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation du dossier' });
    }
  },

  // Historique des examens d'un patient
  getExamHistory: async (req, res) => {
    try {
      const { patientId } = req.params;
      const { category, startDate, endDate, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const prescriptionWhere = { patientId };
      if (startDate || endDate) {
        prescriptionWhere.prescriptionDate = {};
        if (startDate) prescriptionWhere.prescriptionDate[Op.gte] = new Date(startDate);
        if (endDate) prescriptionWhere.prescriptionDate[Op.lte] = new Date(endDate);
      }

      const examWhere = {};
      if (category) examWhere.category = category;

      const exams = await PrescriptionExam.findAll({
        include: [
          {
            model: Prescription,
            as: 'prescription',
            where: prescriptionWhere,
            include: [
              { model: User, as: 'doctor', attributes: ['id', 'firstName', 'lastName'] }
            ]
          },
          {
            model: Exam,
            as: 'exam',
            where: examWhere
          },
          {
            model: Result,
            as: 'results'
          },
          { model: User, as: 'performer', attributes: ['id', 'firstName', 'lastName'] }
        ],
        order: [[{ model: Prescription, as: 'prescription' }, 'prescriptionDate', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({ exams });
    } catch (error) {
      console.error('Get exam history error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation de l\'historique' });
    }
  },

  // Resultats disponibles pour un patient
  getResults: async (req, res) => {
    try {
      const { patientId } = req.params;
      const { validated } = req.query;

      const resultWhere = {};
      if (validated !== undefined) {
        resultWhere.isValidated = validated === 'true';
      }

      const results = await Result.findAll({
        where: resultWhere,
        include: [{
          model: PrescriptionExam,
          as: 'prescriptionExam',
          include: [
            { model: Exam, as: 'exam' },
            {
              model: Prescription,
              as: 'prescription',
              where: { patientId },
              include: [{ model: Patient, as: 'patient' }]
            }
          ]
        },
        { model: User, as: 'uploader', attributes: ['id', 'firstName', 'lastName'] },
        { model: User, as: 'validator', attributes: ['id', 'firstName', 'lastName'] }
        ],
        order: [['uploadDate', 'DESC']]
      });

      res.json({ results });
    } catch (error) {
      console.error('Get patient results error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation des resultats' });
    }
  },

  // Resume medical du patient
  getMedicalSummary: async (req, res) => {
    try {
      const { patientId } = req.params;

      const patient = await Patient.findByPk(patientId);
      if (!patient) {
        return res.status(404).json({ error: 'Patient non trouve' });
      }

      // Statistiques
      const totalPrescriptions = await Prescription.count({ where: { patientId } });
      const completedPrescriptions = await Prescription.count({
        where: { patientId, status: 'COMPLETED' }
      });

      const totalExams = await PrescriptionExam.count({
        include: [{
          model: Prescription,
          as: 'prescription',
          where: { patientId }
        }]
      });

      const completedExams = await PrescriptionExam.count({
        where: { status: 'COMPLETED' },
        include: [{
          model: Prescription,
          as: 'prescription',
          where: { patientId }
        }]
      });

      const totalResults = await Result.count({
        include: [{
          model: PrescriptionExam,
          as: 'prescriptionExam',
          include: [{
            model: Prescription,
            as: 'prescription',
            where: { patientId }
          }]
        }]
      });

      // Derniere visite
      const lastPrescription = await Prescription.findOne({
        where: { patientId },
        order: [['prescriptionDate', 'DESC']],
        include: [{ model: User, as: 'doctor', attributes: ['firstName', 'lastName'] }]
      });

      res.json({
        patient,
        summary: {
          totalPrescriptions,
          completedPrescriptions,
          totalExams,
          completedExams,
          totalResults,
          lastVisit: lastPrescription ? {
            date: lastPrescription.prescriptionDate,
            doctor: `Dr. ${lastPrescription.doctor.lastName} ${lastPrescription.doctor.firstName}`
          } : null
        }
      });
    } catch (error) {
      console.error('Get medical summary error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation du resume' });
    }
  }
};

module.exports = patientRecordController;
```

#### 7. [ ] Routes dossier patient (routes/patientRecords.js)
```javascript
const express = require('express');
const router = express.Router();
const patientRecordController = require('../controllers/patientRecordController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

router.use(authenticateToken);

// Dossier complet
router.get('/:patientId/full',
  roleCheck('DOCTOR', 'ADMIN'),
  patientRecordController.getFullRecord
);

// Historique examens
router.get('/:patientId/exams',
  roleCheck('DOCTOR', 'RADIOLOGIST', 'LAB_TECHNICIAN', 'ADMIN'),
  patientRecordController.getExamHistory
);

// Resultats
router.get('/:patientId/results',
  roleCheck('DOCTOR', 'ADMIN'),
  patientRecordController.getResults
);

// Resume medical
router.get('/:patientId/summary',
  roleCheck('DOCTOR', 'ADMIN'),
  patientRecordController.getMedicalSummary
);

module.exports = router;
```

### Backend - Portail Patient (Acces limite)

#### 8. [ ] Controller portail patient (controllers/portalController.js)
```javascript
const { Patient, Prescription, PrescriptionExam, Exam, Result } = require('../models');
const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');

const portalController = {
  // Generer un lien d'acces temporaire pour le patient
  generateAccessLink: async (req, res) => {
    try {
      const { patientId } = req.params;
      const { expiresIn = '24h' } = req.body;

      const patient = await Patient.findByPk(patientId);
      if (!patient) {
        return res.status(404).json({ error: 'Patient non trouve' });
      }

      // Token special pour acces patient
      const accessToken = jwt.sign(
        {
          patientId: patient.id,
          type: 'PATIENT_ACCESS'
        },
        jwtConfig.secret,
        { expiresIn }
      );

      const accessUrl = `${process.env.FRONTEND_URL}/patient-portal?token=${accessToken}`;

      res.json({
        message: 'Lien d\'acces genere',
        accessUrl,
        expiresIn
      });
    } catch (error) {
      console.error('Generate access link error:', error);
      res.status(500).json({ error: 'Erreur lors de la generation du lien' });
    }
  },

  // Verifier le token patient
  verifyPatientToken: async (req, res) => {
    try {
      const { token } = req.body;

      const decoded = jwt.verify(token, jwtConfig.secret);

      if (decoded.type !== 'PATIENT_ACCESS') {
        return res.status(401).json({ error: 'Token invalide' });
      }

      const patient = await Patient.findByPk(decoded.patientId);
      if (!patient) {
        return res.status(404).json({ error: 'Patient non trouve' });
      }

      res.json({
        valid: true,
        patient: {
          id: patient.id,
          patientNumber: patient.patientNumber,
          firstName: patient.firstName,
          lastName: patient.lastName
        }
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Lien expire' });
      }
      return res.status(401).json({ error: 'Token invalide' });
    }
  },

  // Obtenir mes resultats (acces patient)
  getMyResults: async (req, res) => {
    try {
      const { patientId } = req.patientAccess; // Set by middleware

      const results = await Result.findAll({
        where: { isValidated: true }, // Seuls les resultats valides
        include: [{
          model: PrescriptionExam,
          as: 'prescriptionExam',
          include: [
            { model: Exam, as: 'exam' },
            {
              model: Prescription,
              as: 'prescription',
              where: { patientId }
            }
          ]
        }],
        order: [['uploadDate', 'DESC']]
      });

      res.json({
        results: results.map(r => ({
          id: r.id,
          examName: r.prescriptionExam.exam.name,
          examCategory: r.prescriptionExam.exam.category,
          prescriptionDate: r.prescriptionExam.prescription.prescriptionDate,
          uploadDate: r.uploadDate,
          conclusion: r.conclusion,
          fileType: r.fileType
        }))
      });
    } catch (error) {
      console.error('Get my results error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation des resultats' });
    }
  },

  // Telecharger mon resultat
  downloadMyResult: async (req, res) => {
    try {
      const { patientId } = req.patientAccess;
      const { resultId } = req.params;

      const result = await Result.findByPk(resultId, {
        include: [{
          model: PrescriptionExam,
          as: 'prescriptionExam',
          include: [{
            model: Prescription,
            as: 'prescription',
            where: { patientId }
          }]
        }]
      });

      if (!result) {
        return res.status(404).json({ error: 'Resultat non trouve' });
      }

      if (!result.isValidated) {
        return res.status(403).json({ error: 'Resultat non encore valide' });
      }

      const fs = require('fs');
      if (!fs.existsSync(result.filePath)) {
        return res.status(404).json({ error: 'Fichier non trouve' });
      }

      res.download(result.filePath, result.fileName);
    } catch (error) {
      console.error('Download my result error:', error);
      res.status(500).json({ error: 'Erreur lors du telechargement' });
    }
  }
};

module.exports = portalController;
```

#### 9. [ ] Middleware acces patient (middleware/patientAuth.js)
```javascript
const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');

const patientAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token requis' });
    }

    const decoded = jwt.verify(token, jwtConfig.secret);

    if (decoded.type !== 'PATIENT_ACCESS') {
      return res.status(401).json({ error: 'Acces non autorise' });
    }

    req.patientAccess = {
      patientId: decoded.patientId
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expiree' });
    }
    return res.status(403).json({ error: 'Token invalide' });
  }
};

module.exports = patientAuth;
```

#### 10. [ ] Routes portail patient (routes/portal.js)
```javascript
const express = require('express');
const router = express.Router();
const portalController = require('../controllers/portalController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const patientAuth = require('../middleware/patientAuth');

// Generation lien (personnel medical)
router.post('/generate-link/:patientId',
  authenticateToken,
  roleCheck('DOCTOR', 'CASHIER', 'ADMIN'),
  portalController.generateAccessLink
);

// Verification token (public)
router.post('/verify-token', portalController.verifyPatientToken);

// Routes patient (avec token patient)
router.get('/my-results', patientAuth, portalController.getMyResults);
router.get('/my-results/:resultId/download', patientAuth, portalController.downloadMyResult);

module.exports = router;
```

### Frontend - Interface Resultats

#### 11. [ ] Composant Upload Resultat (components/service/ResultUpload.jsx)
```javascript
import React, { useState, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  LinearProgress,
  Alert,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import { CloudUpload, Delete, InsertDriveFile } from '@mui/icons-material';
import api from '../../services/api';

const ResultUpload = ({ prescriptionExamId, onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [comments, setComments] = useState('');
  const [conclusion, setConclusion] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const fileInputRef = useRef();

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // Verifier la taille (10MB max)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('Fichier trop volumineux (max 10MB)');
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Veuillez selectionner un fichier');
      return;
    }

    setUploading(true);
    setProgress(0);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('prescriptionExamId', prescriptionExamId);
    formData.append('comments', comments);
    formData.append('conclusion', conclusion);

    try {
      const response = await api.post('/results', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress(percent);
        }
      });

      setFile(null);
      setComments('');
      setConclusion('');
      if (onUploadSuccess) {
        onUploadSuccess(response.data.result);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de l\'upload');
    } finally {
      setUploading(false);
    }
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Uploader un resultat
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".pdf,.jpg,.jpeg,.png,.gif"
        style={{ display: 'none' }}
      />

      {!file ? (
        <Box
          sx={{
            border: '2px dashed',
            borderColor: 'grey.300',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            cursor: 'pointer',
            '&:hover': { borderColor: 'primary.main' }
          }}
          onClick={() => fileInputRef.current.click()}
        >
          <CloudUpload sx={{ fontSize: 48, color: 'grey.400' }} />
          <Typography color="textSecondary">
            Cliquez pour selectionner un fichier
          </Typography>
          <Typography variant="caption" color="textSecondary">
            PDF, JPEG, PNG (max 10MB)
          </Typography>
        </Box>
      ) : (
        <List>
          <ListItem>
            <InsertDriveFile sx={{ mr: 2, color: 'primary.main' }} />
            <ListItemText
              primary={file.name}
              secondary={`${(file.size / 1024 / 1024).toFixed(2)} MB`}
            />
            <ListItemSecondaryAction>
              <IconButton edge="end" onClick={removeFile} disabled={uploading}>
                <Delete />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        </List>
      )}

      <TextField
        fullWidth
        label="Commentaires"
        multiline
        rows={2}
        value={comments}
        onChange={(e) => setComments(e.target.value)}
        margin="normal"
        disabled={uploading}
      />

      <TextField
        fullWidth
        label="Conclusion"
        multiline
        rows={3}
        value={conclusion}
        onChange={(e) => setConclusion(e.target.value)}
        margin="normal"
        disabled={uploading}
      />

      {uploading && (
        <Box sx={{ my: 2 }}>
          <LinearProgress variant="determinate" value={progress} />
          <Typography variant="caption" align="center" display="block">
            {progress}%
          </Typography>
        </Box>
      )}

      <Button
        variant="contained"
        fullWidth
        onClick={handleUpload}
        disabled={!file || uploading}
        startIcon={<CloudUpload />}
        sx={{ mt: 2 }}
      >
        {uploading ? 'Upload en cours...' : 'Uploader le resultat'}
      </Button>
    </Paper>
  );
};

export default ResultUpload;
```

#### 12. [ ] Composant Visualisation Resultats (components/doctor/ResultsViewer.jsx)
```javascript
import React, { useState } from 'react';
import {
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Tooltip
} from '@mui/material';
import {
  PictureAsPdf,
  Image,
  Download,
  Visibility,
  CheckCircle,
  Schedule
} from '@mui/icons-material';
import api from '../../services/api';

const ResultsViewer = ({ results, onValidate, canValidate = false }) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedResult, setSelectedResult] = useState(null);

  const getFileIcon = (fileType) => {
    switch (fileType) {
      case 'PDF':
        return <PictureAsPdf color="error" />;
      case 'IMAGE':
        return <Image color="primary" />;
      default:
        return <PictureAsPdf />;
    }
  };

  const handleDownload = async (result) => {
    try {
      const response = await api.get(`/results/${result.id}/download`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', result.fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const handlePreview = async (result) => {
    if (result.fileType === 'IMAGE') {
      try {
        const response = await api.get(`/results/${result.id}/download`, {
          responseType: 'blob'
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        setPreviewUrl(url);
        setSelectedResult(result);
        setPreviewOpen(true);
      } catch (error) {
        console.error('Preview error:', error);
      }
    }
  };

  const closePreview = () => {
    setPreviewOpen(false);
    if (previewUrl) {
      window.URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!results || results.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="textSecondary">
          Aucun resultat disponible
        </Typography>
      </Paper>
    );
  }

  return (
    <>
      <Paper>
        <List>
          {results.map((result) => (
            <ListItem key={result.id} divider>
              <ListItemIcon>
                {getFileIcon(result.fileType)}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {result.fileName}
                    {result.isValidated ? (
                      <Chip
                        icon={<CheckCircle />}
                        label="Valide"
                        color="success"
                        size="small"
                      />
                    ) : (
                      <Chip
                        icon={<Schedule />}
                        label="En attente"
                        color="warning"
                        size="small"
                      />
                    )}
                  </Box>
                }
                secondary={
                  <>
                    <Typography variant="body2" color="textSecondary">
                      Upload par {result.uploader?.firstName} {result.uploader?.lastName} le {formatDate(result.uploadDate)}
                    </Typography>
                    {result.conclusion && (
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        <strong>Conclusion:</strong> {result.conclusion}
                      </Typography>
                    )}
                  </>
                }
              />
              <ListItemSecondaryAction>
                {result.fileType === 'IMAGE' && (
                  <Tooltip title="Apercu">
                    <IconButton onClick={() => handlePreview(result)}>
                      <Visibility />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Telecharger">
                  <IconButton onClick={() => handleDownload(result)}>
                    <Download />
                  </IconButton>
                </Tooltip>
                {canValidate && !result.isValidated && (
                  <Tooltip title="Valider">
                    <IconButton color="success" onClick={() => onValidate(result.id)}>
                      <CheckCircle />
                    </IconButton>
                  </Tooltip>
                )}
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </Paper>

      {/* Dialog apercu image */}
      <Dialog open={previewOpen} onClose={closePreview} maxWidth="lg">
        <DialogTitle>
          {selectedResult?.fileName}
        </DialogTitle>
        <DialogContent>
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Apercu"
              style={{ maxWidth: '100%', maxHeight: '70vh' }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closePreview}>Fermer</Button>
          <Button
            variant="contained"
            onClick={() => handleDownload(selectedResult)}
            startIcon={<Download />}
          >
            Telecharger
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ResultsViewer;
```

#### 13. [ ] Page Dossier Patient (pages/PatientRecord.jsx)
```javascript
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Tabs,
  Tab,
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Person,
  LocalHospital,
  Assignment,
  Timeline
} from '@mui/icons-material';
import api from '../services/api';
import Layout from '../components/common/Layout';
import ResultsViewer from '../components/doctor/ResultsViewer';

const PatientRecord = () => {
  const { patientId } = useParams();
  const [patient, setPatient] = useState(null);
  const [summary, setSummary] = useState(null);
  const [results, setResults] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPatientData();
  }, [patientId]);

  const fetchPatientData = async () => {
    setLoading(true);
    try {
      const [summaryRes, resultsRes] = await Promise.all([
        api.get(`/patient-records/${patientId}/summary`),
        api.get(`/patient-records/${patientId}/results`)
      ]);

      setPatient(summaryRes.data.patient);
      setSummary(summaryRes.data.summary);
      setResults(resultsRes.data.results);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleValidateResult = async (resultId) => {
    try {
      await api.patch(`/results/${resultId}/validate`);
      fetchPatientData();
    } catch (err) {
      console.error('Validate error:', err);
    }
  };

  if (loading) {
    return (
      <Layout>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <Container>
          <Alert severity="error">{error}</Alert>
        </Container>
      </Layout>
    );
  }

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        {/* En-tete patient */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item>
              <Person sx={{ fontSize: 60, color: 'primary.main' }} />
            </Grid>
            <Grid item xs>
              <Typography variant="h4">
                {patient.lastName} {patient.firstName}
              </Typography>
              <Typography color="textSecondary">
                N° {patient.patientNumber} | {patient.gender === 'M' ? 'Masculin' : 'Feminin'} |
                Ne(e) le {new Date(patient.dateOfBirth).toLocaleDateString('fr-FR')}
              </Typography>
              <Typography color="textSecondary">
                Tel: {patient.phone}
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        {/* Resume */}
        {summary && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={3}>
              <Card>
                <CardContent>
                  <Typography variant="h4" color="primary">
                    {summary.totalPrescriptions}
                  </Typography>
                  <Typography color="textSecondary">Prescriptions</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Card>
                <CardContent>
                  <Typography variant="h4" color="info.main">
                    {summary.totalExams}
                  </Typography>
                  <Typography color="textSecondary">Examens</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Card>
                <CardContent>
                  <Typography variant="h4" color="success.main">
                    {summary.completedExams}
                  </Typography>
                  <Typography color="textSecondary">Examens termines</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Card>
                <CardContent>
                  <Typography variant="h4" color="secondary.main">
                    {summary.totalResults}
                  </Typography>
                  <Typography color="textSecondary">Resultats</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Onglets */}
        <Paper sx={{ mb: 3 }}>
          <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
            <Tab icon={<Assignment />} label="Resultats" />
            <Tab icon={<Timeline />} label="Historique" />
          </Tabs>
        </Paper>

        {/* Contenu */}
        {activeTab === 0 && (
          <ResultsViewer
            results={results}
            onValidate={handleValidateResult}
            canValidate={true}
          />
        )}

        {activeTab === 1 && (
          <Paper sx={{ p: 3 }}>
            <Typography color="textSecondary">
              Historique complet a implementer
            </Typography>
          </Paper>
        )}
      </Container>
    </Layout>
  );
};

export default PatientRecord;
```

#### 14. [ ] Page Portail Patient (pages/PatientPortal.jsx)
```javascript
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Alert,
  CircularProgress,
  Chip
} from '@mui/material';
import {
  LocalHospital,
  Download,
  PictureAsPdf,
  Image,
  Science,
  MedicalServices
} from '@mui/icons-material';
import api from '../services/api';

const PatientPortal = () => {
  const [searchParams] = useSearchParams();
  const [patient, setPatient] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const token = searchParams.get('token');

  useEffect(() => {
    if (token) {
      verifyAndFetch();
    } else {
      setError('Lien invalide');
      setLoading(false);
    }
  }, [token]);

  const verifyAndFetch = async () => {
    try {
      // Verifier le token
      const verifyRes = await api.post('/portal/verify-token', { token });
      setPatient(verifyRes.data.patient);

      // Recuperer les resultats
      const resultsRes = await api.get('/portal/my-results', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResults(resultsRes.data.results);
    } catch (err) {
      setError(err.response?.data?.error || 'Lien invalide ou expire');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (resultId) => {
    try {
      const response = await api.get(`/portal/my-results/${resultId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const result = results.find(r => r.id === resultId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `resultat_${result.examName}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="sm" sx={{ py: 5 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 3 }}>
      <Container maxWidth="md">
        {/* Header */}
        <Paper sx={{ p: 3, mb: 3, textAlign: 'center' }}>
          <LocalHospital sx={{ fontSize: 48, color: 'primary.main' }} />
          <Typography variant="h4" gutterBottom>
            CHU Tokoin
          </Typography>
          <Typography variant="h6" color="textSecondary">
            Portail Patient - Resultats d'examens
          </Typography>
        </Paper>

        {/* Info patient */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Bonjour {patient.firstName} {patient.lastName}
            </Typography>
            <Typography color="textSecondary">
              N° Patient: {patient.patientNumber}
            </Typography>
          </CardContent>
        </Card>

        {/* Resultats */}
        <Paper>
          <Box sx={{ p: 2, bgcolor: 'primary.main', color: 'white' }}>
            <Typography variant="h6">
              Mes Resultats ({results.length})
            </Typography>
          </Box>

          {results.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="textSecondary">
                Aucun resultat disponible pour le moment
              </Typography>
            </Box>
          ) : (
            <List>
              {results.map((result) => (
                <ListItem
                  key={result.id}
                  divider
                  secondaryAction={
                    <IconButton onClick={() => handleDownload(result.id)}>
                      <Download />
                    </IconButton>
                  }
                >
                  <ListItemIcon>
                    {result.examCategory === 'RADIOLOGY' ? (
                      <MedicalServices color="primary" />
                    ) : (
                      <Science color="secondary" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {result.examName}
                        <Chip
                          label={result.examCategory === 'RADIOLOGY' ? 'Radiologie' : 'Laboratoire'}
                          size="small"
                          color={result.examCategory === 'RADIOLOGY' ? 'primary' : 'secondary'}
                        />
                      </Box>
                    }
                    secondary={
                      <>
                        <Typography variant="body2">
                          Date: {new Date(result.uploadDate).toLocaleDateString('fr-FR')}
                        </Typography>
                        {result.conclusion && (
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            <strong>Conclusion:</strong> {result.conclusion}
                          </Typography>
                        )}
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Paper>

        {/* Footer */}
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="caption" color="textSecondary">
            Ce lien est personnel et expire apres 24h.
            <br />
            Pour toute question, contactez le CHU Tokoin.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default PatientPortal;
```

#### 15. [ ] Mise a jour server.js
```javascript
const resultRoutes = require('./routes/results');
const patientRecordRoutes = require('./routes/patientRecords');
const portalRoutes = require('./routes/portal');

app.use('/api/results', resultRoutes);
app.use('/api/patient-records', patientRecordRoutes);
app.use('/api/portal', portalRoutes);

// Servir les fichiers statiques (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
```

## Tests a effectuer

### Backend
- [ ] POST /api/results - Upload fichier PDF
- [ ] POST /api/results - Upload fichier image
- [ ] GET /api/results/exam/:id - Resultats d'un examen
- [ ] GET /api/results/:id/download - Telecharger un fichier
- [ ] PATCH /api/results/:id/validate - Valider un resultat
- [ ] GET /api/patient-records/:id/full - Dossier complet
- [ ] GET /api/patient-records/:id/summary - Resume patient
- [ ] POST /api/portal/generate-link - Generation lien patient
- [ ] GET /api/portal/my-results - Resultats via portail

### Frontend
- [ ] Upload de fichier avec progression
- [ ] Visualisation des resultats (liste)
- [ ] Apercu des images
- [ ] Telechargement des fichiers
- [ ] Validation par le medecin
- [ ] Dossier patient complet
- [ ] Portail patient fonctionnel

### Integration
- [ ] Flow complet: upload -> validation -> consultation
- [ ] Acces patient securise par token temporaire
- [ ] Fichiers correctement stockes et accessibles
- [ ] Historique patient complet

## Points de validation
- [ ] Upload fichiers fonctionnel et securise
- [ ] Validation des resultats par medecin
- [ ] Dossier patient consultable
- [ ] Portail patient operationnel
- [ ] Fichiers organises et accessibles

## Prochaines etapes
-> PHASE_4_ADVANCED.md : Fonctionnalites avancees et optimisations
