# Phase 2: Gestion des Examens par les Services

## Objectifs
- Implementer le scan de QR code cote services (radiologie/laboratoire)
- Gerer le workflow complet des examens (reception -> en cours -> termine)
- Creer le journal d'activite des services
- Implementer les statistiques de base par service
- Permettre la validation des examens effectues

## Prerequis
- Phase 1 completee et validee
- QR codes generes correctement apres paiement
- Authentification fonctionnelle pour les roles RADIOLOGIST et LAB_TECHNICIAN

## Etapes de developpement

### Backend - API Examens Services

#### 1. [ ] Controller pour scanner QR code (controllers/serviceController.js)
```javascript
const { Payment, Prescription, PrescriptionExam, Patient, Exam, User } = require('../models');
const qrcodeService = require('../services/qrcodeService');

const serviceController = {
  // Verifier un QR code et obtenir les examens
  verifyQRCode: async (req, res) => {
    try {
      const { qrData } = req.body;

      // Parser les donnees du QR
      let parsedData;
      try {
        parsedData = qrcodeService.parseQRCode(qrData);
      } catch (error) {
        return res.status(400).json({ error: 'QR code invalide' });
      }

      // Verifier le paiement
      const payment = await Payment.findByPk(parsedData.paymentId, {
        include: [{
          model: Prescription,
          as: 'prescription',
          include: [
            { model: Patient, as: 'patient' },
            {
              model: PrescriptionExam,
              as: 'prescriptionExams',
              include: [
                { model: Exam, as: 'exam' },
                { model: User, as: 'performer', attributes: ['id', 'firstName', 'lastName'] }
              ]
            }
          ]
        }]
      });

      if (!payment) {
        return res.status(404).json({ error: 'Paiement non trouve' });
      }

      if (payment.paymentStatus !== 'SUCCESS') {
        return res.status(400).json({ error: 'Paiement non valide' });
      }

      // Filtrer les examens selon le role de l'utilisateur
      const userCategory = req.user.role === 'RADIOLOGIST' ? 'RADIOLOGY' : 'LABORATORY';
      const relevantExams = payment.prescription.prescriptionExams.filter(
        pe => pe.exam.category === userCategory
      );

      if (relevantExams.length === 0) {
        return res.status(404).json({
          error: `Aucun examen de ${userCategory === 'RADIOLOGY' ? 'radiologie' : 'laboratoire'} pour ce patient`
        });
      }

      res.json({
        patient: payment.prescription.patient,
        prescriptionNumber: payment.prescription.prescriptionNumber,
        paymentNumber: payment.paymentNumber,
        paidAt: payment.paymentDate,
        exams: relevantExams.map(pe => ({
          id: pe.id,
          examId: pe.examId,
          code: pe.exam.code,
          name: pe.exam.name,
          status: pe.status,
          performedBy: pe.performer ? `${pe.performer.firstName} ${pe.performer.lastName}` : null,
          performedAt: pe.performedAt
        }))
      });
    } catch (error) {
      console.error('Verify QR error:', error);
      res.status(500).json({ error: 'Erreur lors de la verification du QR code' });
    }
  },

  // Obtenir les examens en attente pour un service
  getPendingExams: async (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const userCategory = req.user.role === 'RADIOLOGIST' ? 'RADIOLOGY' : 'LABORATORY';

      const { count, rows } = await PrescriptionExam.findAndCountAll({
        where: { status: 'PAID' },
        include: [
          {
            model: Exam,
            as: 'exam',
            where: { category: userCategory }
          },
          {
            model: Prescription,
            as: 'prescription',
            include: [{ model: Patient, as: 'patient' }]
          }
        ],
        order: [['createdAt', 'ASC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        exams: rows.map(pe => ({
          id: pe.id,
          examCode: pe.exam.code,
          examName: pe.exam.name,
          patientNumber: pe.prescription.patient.patientNumber,
          patientName: `${pe.prescription.patient.lastName} ${pe.prescription.patient.firstName}`,
          prescriptionNumber: pe.prescription.prescriptionNumber,
          prescriptionDate: pe.prescription.prescriptionDate,
          status: pe.status
        })),
        pagination: {
          total: count,
          page: parseInt(page),
          pages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      console.error('Get pending exams error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation des examens' });
    }
  },

  // Demarrer un examen (passer en IN_PROGRESS)
  startExam: async (req, res) => {
    try {
      const { id } = req.params;

      const prescriptionExam = await PrescriptionExam.findByPk(id, {
        include: [{ model: Exam, as: 'exam' }]
      });

      if (!prescriptionExam) {
        return res.status(404).json({ error: 'Examen non trouve' });
      }

      // Verifier que l'examen correspond au role
      const userCategory = req.user.role === 'RADIOLOGIST' ? 'RADIOLOGY' : 'LABORATORY';
      if (prescriptionExam.exam.category !== userCategory) {
        return res.status(403).json({ error: 'Vous n\'etes pas autorise a traiter cet examen' });
      }

      if (prescriptionExam.status !== 'PAID') {
        return res.status(400).json({ error: 'L\'examen doit etre paye pour etre demarre' });
      }

      prescriptionExam.status = 'IN_PROGRESS';
      prescriptionExam.performedBy = req.user.id;
      await prescriptionExam.save();

      res.json({
        message: 'Examen demarre',
        exam: prescriptionExam
      });
    } catch (error) {
      console.error('Start exam error:', error);
      res.status(500).json({ error: 'Erreur lors du demarrage de l\'examen' });
    }
  },

  // Terminer un examen
  completeExam: async (req, res) => {
    try {
      const { id } = req.params;
      const { notes } = req.body;

      const prescriptionExam = await PrescriptionExam.findByPk(id, {
        include: [
          { model: Exam, as: 'exam' },
          { model: Prescription, as: 'prescription' }
        ]
      });

      if (!prescriptionExam) {
        return res.status(404).json({ error: 'Examen non trouve' });
      }

      // Verifier que c'est le bon utilisateur
      if (prescriptionExam.performedBy !== req.user.id) {
        return res.status(403).json({ error: 'Vous n\'etes pas autorise a terminer cet examen' });
      }

      if (prescriptionExam.status !== 'IN_PROGRESS') {
        return res.status(400).json({ error: 'L\'examen doit etre en cours pour etre termine' });
      }

      prescriptionExam.status = 'COMPLETED';
      prescriptionExam.performedAt = new Date();
      await prescriptionExam.save();

      // Verifier si tous les examens de la prescription sont termines
      const allExams = await PrescriptionExam.findAll({
        where: { prescriptionId: prescriptionExam.prescriptionId }
      });

      const allCompleted = allExams.every(e => e.status === 'COMPLETED');
      if (allCompleted) {
        await prescriptionExam.prescription.update({ status: 'COMPLETED' });
      } else {
        await prescriptionExam.prescription.update({ status: 'IN_PROGRESS' });
      }

      res.json({
        message: 'Examen termine',
        exam: prescriptionExam,
        prescriptionCompleted: allCompleted
      });
    } catch (error) {
      console.error('Complete exam error:', error);
      res.status(500).json({ error: 'Erreur lors de la fin de l\'examen' });
    }
  },

  // Obtenir les examens en cours par l'utilisateur
  getMyExams: async (req, res) => {
    try {
      const { status, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const where = { performedBy: req.user.id };
      if (status) where.status = status;

      const { count, rows } = await PrescriptionExam.findAndCountAll({
        where,
        include: [
          { model: Exam, as: 'exam' },
          {
            model: Prescription,
            as: 'prescription',
            include: [{ model: Patient, as: 'patient' }]
          }
        ],
        order: [['updatedAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        exams: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          pages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      console.error('Get my exams error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation des examens' });
    }
  }
};

module.exports = serviceController;
```

#### 2. [ ] Routes des services (routes/services.js)
```javascript
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const serviceController = require('../controllers/serviceController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

router.use(authenticateToken);
router.use(roleCheck('RADIOLOGIST', 'LAB_TECHNICIAN', 'ADMIN'));

// Scanner et verifier QR code
router.post('/verify-qr',
  body('qrData').notEmpty().withMessage('Donnees QR requises'),
  serviceController.verifyQRCode
);

// Examens en attente
router.get('/pending', serviceController.getPendingExams);

// Mes examens (en cours et termines)
router.get('/my-exams', serviceController.getMyExams);

// Demarrer un examen
router.patch('/exams/:id/start', serviceController.startExam);

// Terminer un examen
router.patch('/exams/:id/complete', serviceController.completeExam);

module.exports = router;
```

### Backend - Journal d'activite

#### 3. [ ] Modele ActivityLog (models/ActivityLog.js)
```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ActivityLog = sequelize.define('ActivityLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  action: {
    type: DataTypes.ENUM(
      'LOGIN',
      'LOGOUT',
      'CREATE_PRESCRIPTION',
      'CREATE_PAYMENT',
      'START_EXAM',
      'COMPLETE_EXAM',
      'UPLOAD_RESULT',
      'VIEW_PATIENT',
      'SCAN_QR'
    ),
    allowNull: false
  },
  entityType: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  entityId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  details: {
    type: DataTypes.JSON,
    allowNull: true
  },
  ipAddress: {
    type: DataTypes.STRING(45),
    allowNull: true
  }
}, {
  tableName: 'activity_logs',
  timestamps: true,
  updatedAt: false
});

module.exports = ActivityLog;
```

#### 4. [ ] Service de logging (services/activityService.js)
```javascript
const ActivityLog = require('../models/ActivityLog');

const activityService = {
  log: async (userId, action, entityType = null, entityId = null, details = null, ipAddress = null) => {
    try {
      await ActivityLog.create({
        userId,
        action,
        entityType,
        entityId,
        details,
        ipAddress
      });
    } catch (error) {
      console.error('Activity log error:', error);
      // Ne pas faire echouer l'operation principale
    }
  },

  getUserActivity: async (userId, limit = 50) => {
    return ActivityLog.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit
    });
  },

  getEntityActivity: async (entityType, entityId, limit = 50) => {
    return ActivityLog.findAll({
      where: { entityType, entityId },
      order: [['createdAt', 'DESC']],
      limit
    });
  }
};

module.exports = activityService;
```

#### 5. [ ] Middleware de logging automatique (middleware/activityLogger.js)
```javascript
const activityService = require('../services/activityService');

const activityLogger = (action, getEntityInfo = null) => {
  return async (req, res, next) => {
    // Stocker la fonction originale res.json
    const originalJson = res.json.bind(res);

    res.json = async (data) => {
      // Logger uniquement si la reponse est un succes
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          let entityType = null;
          let entityId = null;
          let details = null;

          if (getEntityInfo && typeof getEntityInfo === 'function') {
            const entityInfo = getEntityInfo(req, data);
            entityType = entityInfo.entityType;
            entityId = entityInfo.entityId;
            details = entityInfo.details;
          }

          await activityService.log(
            req.user?.id,
            action,
            entityType,
            entityId,
            details,
            req.ip
          );
        } catch (error) {
          console.error('Activity logger error:', error);
        }
      }

      return originalJson(data);
    };

    next();
  };
};

module.exports = activityLogger;
```

### Backend - Statistiques Service

#### 6. [ ] Controller statistiques (controllers/statsController.js)
```javascript
const { PrescriptionExam, Exam, User, Payment, Prescription } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

const statsController = {
  // Statistiques pour un service (radiologie ou labo)
  getServiceStats: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const userCategory = req.user.role === 'RADIOLOGIST' ? 'RADIOLOGY' : 'LABORATORY';

      const dateFilter = {};
      if (startDate) dateFilter[Op.gte] = new Date(startDate);
      if (endDate) dateFilter[Op.lte] = new Date(endDate);

      // Examens par statut
      const examsByStatus = await PrescriptionExam.findAll({
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('PrescriptionExam.id')), 'count']
        ],
        include: [{
          model: Exam,
          as: 'exam',
          where: { category: userCategory },
          attributes: []
        }],
        where: dateFilter.createdAt ? { createdAt: dateFilter } : {},
        group: ['status'],
        raw: true
      });

      // Examens effectues par l'utilisateur
      const myExams = await PrescriptionExam.count({
        where: {
          performedBy: req.user.id,
          status: 'COMPLETED',
          ...(dateFilter.performedAt ? { performedAt: dateFilter } : {})
        }
      });

      // Top examens demandes
      const topExams = await PrescriptionExam.findAll({
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('PrescriptionExam.id')), 'count']
        ],
        include: [{
          model: Exam,
          as: 'exam',
          where: { category: userCategory },
          attributes: ['code', 'name']
        }],
        group: ['exam.id'],
        order: [[sequelize.fn('COUNT', sequelize.col('PrescriptionExam.id')), 'DESC']],
        limit: 10,
        raw: true,
        nest: true
      });

      // Examens en attente (file d'attente)
      const pendingCount = await PrescriptionExam.count({
        where: { status: 'PAID' },
        include: [{
          model: Exam,
          as: 'exam',
          where: { category: userCategory }
        }]
      });

      // Examens en cours
      const inProgressCount = await PrescriptionExam.count({
        where: { status: 'IN_PROGRESS' },
        include: [{
          model: Exam,
          as: 'exam',
          where: { category: userCategory }
        }]
      });

      res.json({
        summary: {
          pending: pendingCount,
          inProgress: inProgressCount,
          myCompletedToday: myExams
        },
        examsByStatus,
        topExams,
        category: userCategory
      });
    } catch (error) {
      console.error('Get service stats error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation des statistiques' });
    }
  },

  // Statistiques globales (admin)
  getGlobalStats: async (req, res) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Prescriptions aujourd'hui
      const prescriptionsToday = await Prescription.count({
        where: { createdAt: { [Op.gte]: today } }
      });

      // Paiements aujourd'hui
      const paymentsToday = await Payment.count({
        where: {
          paymentDate: { [Op.gte]: today },
          paymentStatus: 'SUCCESS'
        }
      });

      // Montant total aujourd'hui
      const amountToday = await Payment.sum('amount', {
        where: {
          paymentDate: { [Op.gte]: today },
          paymentStatus: 'SUCCESS'
        }
      });

      // Examens termines aujourd'hui
      const examsCompletedToday = await PrescriptionExam.count({
        where: {
          performedAt: { [Op.gte]: today },
          status: 'COMPLETED'
        }
      });

      // Repartition par categorie
      const examsByCategory = await PrescriptionExam.findAll({
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('PrescriptionExam.id')), 'count']
        ],
        include: [{
          model: Exam,
          as: 'exam',
          attributes: ['category']
        }],
        where: { createdAt: { [Op.gte]: today } },
        group: ['exam.category'],
        raw: true,
        nest: true
      });

      res.json({
        today: {
          prescriptions: prescriptionsToday,
          payments: paymentsToday,
          amount: amountToday || 0,
          examsCompleted: examsCompletedToday
        },
        examsByCategory
      });
    } catch (error) {
      console.error('Get global stats error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation des statistiques' });
    }
  }
};

module.exports = statsController;
```

#### 7. [ ] Routes statistiques (routes/stats.js)
```javascript
const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

router.use(authenticateToken);

// Stats service (radiologie/labo)
router.get('/service',
  roleCheck('RADIOLOGIST', 'LAB_TECHNICIAN', 'ADMIN'),
  statsController.getServiceStats
);

// Stats globales (admin)
router.get('/global',
  roleCheck('ADMIN'),
  statsController.getGlobalStats
);

module.exports = router;
```

### Frontend - Interface Service

#### 8. [ ] Scanner QR Code (components/service/QRScanner.jsx)
```javascript
import React, { useState, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import {
  Box,
  Paper,
  Typography,
  Alert,
  CircularProgress,
  Button
} from '@mui/material';
import { CameraAlt, Refresh } from '@mui/icons-material';

const QRScanner = ({ onScanSuccess, onScanError }) => {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let scanner = null;

    if (scanning) {
      scanner = new Html5QrcodeScanner('qr-reader', {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      });

      scanner.render(
        (decodedText) => {
          scanner.clear();
          setScanning(false);
          onScanSuccess(decodedText);
        },
        (err) => {
          // Ignorer les erreurs de scan en continu
          if (!err.includes('NotFoundException')) {
            console.error('Scan error:', err);
          }
        }
      );
    }

    return () => {
      if (scanner) {
        scanner.clear().catch(console.error);
      }
    };
  }, [scanning, onScanSuccess]);

  const startScan = () => {
    setError(null);
    setScanning(true);
  };

  const stopScan = () => {
    setScanning(false);
  };

  return (
    <Paper sx={{ p: 3, textAlign: 'center' }}>
      <Typography variant="h6" gutterBottom>
        Scanner le QR Code du Patient
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!scanning ? (
        <Box>
          <Button
            variant="contained"
            size="large"
            startIcon={<CameraAlt />}
            onClick={startScan}
            sx={{ mt: 2 }}
          >
            Demarrer le Scan
          </Button>
        </Box>
      ) : (
        <Box>
          <div id="qr-reader" style={{ width: '100%', maxWidth: 400, margin: '0 auto' }} />
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={stopScan}
            sx={{ mt: 2 }}
          >
            Arreter
          </Button>
        </Box>
      )}
    </Paper>
  );
};

export default QRScanner;
```

#### 9. [ ] Liste des examens a effectuer (components/service/ExamList.jsx)
```javascript
import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Typography,
  Box
} from '@mui/material';
import { PlayArrow, Check, Visibility } from '@mui/icons-material';

const statusColors = {
  PAID: 'warning',
  IN_PROGRESS: 'info',
  COMPLETED: 'success'
};

const statusLabels = {
  PAID: 'En attente',
  IN_PROGRESS: 'En cours',
  COMPLETED: 'Termine'
};

const ExamList = ({ exams, onStartExam, onCompleteExam, onViewDetails, loading }) => {
  if (!exams || exams.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="textSecondary">
          Aucun examen a afficher
        </Typography>
      </Paper>
    );
  }

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Patient</TableCell>
            <TableCell>N° Prescription</TableCell>
            <TableCell>Examen</TableCell>
            <TableCell>Statut</TableCell>
            <TableCell align="center">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {exams.map((exam) => (
            <TableRow key={exam.id}>
              <TableCell>
                <Typography variant="body2" fontWeight="medium">
                  {exam.patientName}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {exam.patientNumber}
                </Typography>
              </TableCell>
              <TableCell>{exam.prescriptionNumber}</TableCell>
              <TableCell>
                <Typography variant="body2">{exam.examName}</Typography>
                <Typography variant="caption" color="textSecondary">
                  {exam.examCode}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip
                  label={statusLabels[exam.status]}
                  color={statusColors[exam.status]}
                  size="small"
                />
              </TableCell>
              <TableCell align="center">
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                  {exam.status === 'PAID' && (
                    <Tooltip title="Demarrer l'examen">
                      <IconButton
                        color="primary"
                        onClick={() => onStartExam(exam.id)}
                        disabled={loading}
                      >
                        <PlayArrow />
                      </IconButton>
                    </Tooltip>
                  )}
                  {exam.status === 'IN_PROGRESS' && (
                    <Tooltip title="Terminer l'examen">
                      <IconButton
                        color="success"
                        onClick={() => onCompleteExam(exam.id)}
                        disabled={loading}
                      >
                        <Check />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Voir details">
                    <IconButton onClick={() => onViewDetails(exam)}>
                      <Visibility />
                    </IconButton>
                  </Tooltip>
                </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default ExamList;
```

#### 10. [ ] Detail patient apres scan (components/service/PatientExamCard.jsx)
```javascript
import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Box,
  Button,
  Grid
} from '@mui/material';
import {
  Person,
  LocalHospital,
  Payment,
  Schedule,
  PlayArrow,
  Check
} from '@mui/icons-material';

const PatientExamCard = ({
  patient,
  prescriptionNumber,
  paymentNumber,
  paidAt,
  exams,
  onStartExam,
  onCompleteExam,
  loading
}) => {
  const formatDate = (date) => {
    return new Date(date).toLocaleString('fr-FR');
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Person sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6">
            {patient.lastName} {patient.firstName}
          </Typography>
        </Box>

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={6}>
            <Typography variant="body2" color="textSecondary">
              N° Patient
            </Typography>
            <Typography variant="body1">{patient.patientNumber}</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" color="textSecondary">
              N° Prescription
            </Typography>
            <Typography variant="body1">{prescriptionNumber}</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" color="textSecondary">
              N° Paiement
            </Typography>
            <Typography variant="body1">{paymentNumber}</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" color="textSecondary">
              Paye le
            </Typography>
            <Typography variant="body1">{formatDate(paidAt)}</Typography>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
          <LocalHospital sx={{ mr: 1 }} />
          Examens a effectuer ({exams.length})
        </Typography>

        <List dense>
          {exams.map((exam) => (
            <ListItem
              key={exam.id}
              secondaryAction={
                exam.status === 'PAID' ? (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<PlayArrow />}
                    onClick={() => onStartExam(exam.id)}
                    disabled={loading}
                  >
                    Demarrer
                  </Button>
                ) : exam.status === 'IN_PROGRESS' ? (
                  <Button
                    variant="contained"
                    color="success"
                    size="small"
                    startIcon={<Check />}
                    onClick={() => onCompleteExam(exam.id)}
                    disabled={loading}
                  >
                    Terminer
                  </Button>
                ) : (
                  <Chip label="Termine" color="success" size="small" />
                )
              }
            >
              <ListItemText
                primary={exam.name}
                secondary={`Code: ${exam.code}`}
              />
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );
};

export default PatientExamCard;
```

#### 11. [ ] Dashboard Service (pages/ServiceDashboard.jsx)
```javascript
import React, { useState, useEffect } from 'react';
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
  Alert,
  Snackbar
} from '@mui/material';
import {
  QrCodeScanner,
  List,
  Assessment,
  CheckCircle,
  HourglassEmpty,
  PlayCircle
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import Layout from '../components/common/Layout';
import QRScanner from '../components/service/QRScanner';
import ExamList from '../components/service/ExamList';
import PatientExamCard from '../components/service/PatientExamCard';

const ServiceDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [pendingExams, setPendingExams] = useState([]);
  const [myExams, setMyExams] = useState([]);
  const [scannedPatient, setScannedPatient] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const serviceName = user.role === 'RADIOLOGIST' ? 'Radiologie' : 'Laboratoire';

  useEffect(() => {
    fetchPendingExams();
    fetchMyExams();
    fetchStats();
  }, []);

  const fetchPendingExams = async () => {
    try {
      const response = await api.get('/services/pending');
      setPendingExams(response.data.exams);
    } catch (error) {
      console.error('Error fetching pending exams:', error);
    }
  };

  const fetchMyExams = async () => {
    try {
      const response = await api.get('/services/my-exams');
      setMyExams(response.data.exams);
    } catch (error) {
      console.error('Error fetching my exams:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/stats/service');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleScanSuccess = async (qrData) => {
    setLoading(true);
    try {
      const response = await api.post('/services/verify-qr', { qrData });
      setScannedPatient(response.data);
      showSnackbar('Patient trouve', 'success');
    } catch (error) {
      showSnackbar(error.response?.data?.error || 'QR code invalide', 'error');
      setScannedPatient(null);
    } finally {
      setLoading(false);
    }
  };

  const handleStartExam = async (examId) => {
    setLoading(true);
    try {
      await api.patch(`/services/exams/${examId}/start`);
      showSnackbar('Examen demarre', 'success');
      fetchPendingExams();
      fetchMyExams();
      fetchStats();
      // Mettre a jour le patient scanne si present
      if (scannedPatient) {
        const updatedExams = scannedPatient.exams.map(e =>
          e.id === examId ? { ...e, status: 'IN_PROGRESS' } : e
        );
        setScannedPatient({ ...scannedPatient, exams: updatedExams });
      }
    } catch (error) {
      showSnackbar(error.response?.data?.error || 'Erreur', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteExam = async (examId) => {
    setLoading(true);
    try {
      await api.patch(`/services/exams/${examId}/complete`);
      showSnackbar('Examen termine', 'success');
      fetchPendingExams();
      fetchMyExams();
      fetchStats();
      // Mettre a jour le patient scanne
      if (scannedPatient) {
        const updatedExams = scannedPatient.exams.map(e =>
          e.id === examId ? { ...e, status: 'COMPLETED' } : e
        );
        setScannedPatient({ ...scannedPatient, exams: updatedExams });
      }
    } catch (error) {
      showSnackbar(error.response?.data?.error || 'Erreur', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Typography variant="h4" gutterBottom>
          Service {serviceName}
        </Typography>

        {/* Statistiques rapides */}
        {stats && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <Card>
                <CardContent sx={{ display: 'flex', alignItems: 'center' }}>
                  <HourglassEmpty sx={{ fontSize: 40, color: 'warning.main', mr: 2 }} />
                  <Box>
                    <Typography variant="h4">{stats.summary.pending}</Typography>
                    <Typography color="textSecondary">En attente</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card>
                <CardContent sx={{ display: 'flex', alignItems: 'center' }}>
                  <PlayCircle sx={{ fontSize: 40, color: 'info.main', mr: 2 }} />
                  <Box>
                    <Typography variant="h4">{stats.summary.inProgress}</Typography>
                    <Typography color="textSecondary">En cours</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card>
                <CardContent sx={{ display: 'flex', alignItems: 'center' }}>
                  <CheckCircle sx={{ fontSize: 40, color: 'success.main', mr: 2 }} />
                  <Box>
                    <Typography variant="h4">{stats.summary.myCompletedToday}</Typography>
                    <Typography color="textSecondary">Mes termines (aujourd'hui)</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Onglets */}
        <Paper sx={{ mb: 3 }}>
          <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
            <Tab icon={<QrCodeScanner />} label="Scanner QR" />
            <Tab icon={<List />} label="File d'attente" />
            <Tab icon={<Assessment />} label="Mes examens" />
          </Tabs>
        </Paper>

        {/* Contenu des onglets */}
        {activeTab === 0 && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <QRScanner
                onScanSuccess={handleScanSuccess}
                onScanError={(err) => showSnackbar(err, 'error')}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              {scannedPatient ? (
                <PatientExamCard
                  patient={scannedPatient.patient}
                  prescriptionNumber={scannedPatient.prescriptionNumber}
                  paymentNumber={scannedPatient.paymentNumber}
                  paidAt={scannedPatient.paidAt}
                  exams={scannedPatient.exams}
                  onStartExam={handleStartExam}
                  onCompleteExam={handleCompleteExam}
                  loading={loading}
                />
              ) : (
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <Typography color="textSecondary">
                    Scannez un QR code pour voir les informations du patient
                  </Typography>
                </Paper>
              )}
            </Grid>
          </Grid>
        )}

        {activeTab === 1 && (
          <ExamList
            exams={pendingExams}
            onStartExam={handleStartExam}
            onCompleteExam={handleCompleteExam}
            onViewDetails={(exam) => console.log('View details:', exam)}
            loading={loading}
          />
        )}

        {activeTab === 2 && (
          <ExamList
            exams={myExams}
            onStartExam={handleStartExam}
            onCompleteExam={handleCompleteExam}
            onViewDetails={(exam) => console.log('View details:', exam)}
            loading={loading}
          />
        )}

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </Layout>
  );
};

export default ServiceDashboard;
```

#### 12. [ ] Mise a jour des routes frontend
```javascript
// Dans App.jsx, ajouter:
import ServiceDashboard from './pages/ServiceDashboard';

// Ajouter la route:
<Route
  path="/service/*"
  element={
    <ProtectedRoute allowedRoles={['RADIOLOGIST', 'LAB_TECHNICIAN', 'ADMIN']}>
      <ServiceDashboard />
    </ProtectedRoute>
  }
/>
```

#### 13. [ ] Mise a jour server.js avec nouvelles routes
```javascript
const serviceRoutes = require('./routes/services');
const statsRoutes = require('./routes/stats');

app.use('/api/services', serviceRoutes);
app.use('/api/stats', statsRoutes);
```

## Tests a effectuer

### Backend
- [ ] POST /api/services/verify-qr - Scanner un QR code valide
- [ ] POST /api/services/verify-qr - Rejeter un QR invalide
- [ ] GET /api/services/pending - Liste examens en attente
- [ ] PATCH /api/services/exams/:id/start - Demarrer un examen
- [ ] PATCH /api/services/exams/:id/complete - Terminer un examen
- [ ] GET /api/services/my-exams - Mes examens
- [ ] GET /api/stats/service - Statistiques service
- [ ] Verification des permissions par role (radiologue vs laborantin)

### Frontend
- [ ] Scanner QR fonctionne avec camera
- [ ] Affichage correct des informations patient apres scan
- [ ] Boutons demarrer/terminer fonctionnels
- [ ] File d'attente mise a jour en temps reel
- [ ] Statistiques affichees correctement
- [ ] Filtrage des examens selon le role

### Integration
- [ ] Flow complet: scan QR -> demarrer examen -> terminer examen
- [ ] Statuts mis a jour dans prescription
- [ ] Statistiques refletent les changements
- [ ] Journal d'activite enregistre les actions

## Points de validation
- [ ] Scan QR fonctionnel et securise
- [ ] Workflow examens complet (PAID -> IN_PROGRESS -> COMPLETED)
- [ ] Separation radiologie/laboratoire operationnelle
- [ ] Statistiques temps reel
- [ ] Interface intuitive pour les techniciens

## Prochaines etapes
-> PHASE_3_RESULTS.md : Upload et consultation des resultats d'examens
