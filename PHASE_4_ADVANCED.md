# Phase 4: Fonctionnalites Avancees et Optimisations

## Objectifs
- Implementer l'integration Mobile Money (T-Money, Flooz)
- Creer les tableaux de bord financiers
- Developper les rapports d'activite
- Implementer l'export comptable
- Optimiser les performances
- Ameliorer la securite et le monitoring

## Prerequis
- Phases 0-3 completees et validees
- Systeme fonctionnel en production/staging
- Acces aux API Mobile Money (sandbox)

## Etapes de developpement

### Backend - Integration Mobile Money

#### 1. [ ] Service Mobile Money (services/mobileMoneyService.js)
```javascript
const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

// Configuration des providers
const providers = {
  TMONEY: {
    name: 'T-Money',
    baseUrl: process.env.TMONEY_API_URL,
    merchantId: process.env.TMONEY_MERCHANT_ID,
    apiKey: process.env.TMONEY_API_KEY,
    secretKey: process.env.TMONEY_SECRET_KEY
  },
  FLOOZ: {
    name: 'Flooz',
    baseUrl: process.env.FLOOZ_API_URL,
    merchantId: process.env.FLOOZ_MERCHANT_ID,
    apiKey: process.env.FLOOZ_API_KEY,
    secretKey: process.env.FLOOZ_SECRET_KEY
  }
};

const mobileMoneyService = {
  // Initier un paiement
  initiatePayment: async (provider, amount, phoneNumber, reference, description) => {
    try {
      const config = providers[provider];
      if (!config) {
        throw new Error('Provider non supporte');
      }

      // Generer la signature
      const timestamp = Date.now();
      const signature = crypto
        .createHmac('sha256', config.secretKey)
        .update(`${config.merchantId}${amount}${reference}${timestamp}`)
        .digest('hex');

      const payload = {
        merchantId: config.merchantId,
        amount,
        currency: 'XOF',
        phoneNumber,
        reference,
        description,
        callbackUrl: `${process.env.API_URL}/api/payments/mobile-money/callback`,
        timestamp,
        signature
      };

      logger.info(`Initiating ${provider} payment`, { reference, amount, phoneNumber });

      const response = await axios.post(`${config.baseUrl}/payment/initiate`, payload, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      return {
        success: true,
        transactionId: response.data.transactionId,
        status: response.data.status,
        message: response.data.message
      };
    } catch (error) {
      logger.error(`${provider} payment error`, { error: error.message, reference });
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  },

  // Verifier le statut d'un paiement
  checkStatus: async (provider, transactionId) => {
    try {
      const config = providers[provider];
      if (!config) {
        throw new Error('Provider non supporte');
      }

      const response = await axios.get(`${config.baseUrl}/payment/status/${transactionId}`, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`
        }
      });

      return {
        success: true,
        status: response.data.status,
        transactionId: response.data.transactionId,
        amount: response.data.amount,
        completedAt: response.data.completedAt
      };
    } catch (error) {
      logger.error(`${provider} status check error`, { error: error.message, transactionId });
      return {
        success: false,
        error: error.message
      };
    }
  },

  // Traiter le callback
  processCallback: async (provider, payload, signature) => {
    try {
      const config = providers[provider];

      // Verifier la signature
      const expectedSignature = crypto
        .createHmac('sha256', config.secretKey)
        .update(JSON.stringify(payload))
        .digest('hex');

      if (signature !== expectedSignature) {
        logger.warn('Invalid callback signature', { provider, reference: payload.reference });
        return { valid: false, error: 'Signature invalide' };
      }

      return {
        valid: true,
        reference: payload.reference,
        transactionId: payload.transactionId,
        status: payload.status,
        amount: payload.amount
      };
    } catch (error) {
      logger.error('Callback processing error', { error: error.message });
      return { valid: false, error: error.message };
    }
  }
};

module.exports = mobileMoneyService;
```

#### 2. [ ] Modele Transaction Mobile Money (models/MobileMoneyTransaction.js)
```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MobileMoneyTransaction = sequelize.define('MobileMoneyTransaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  paymentId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'payments',
      key: 'id'
    }
  },
  provider: {
    type: DataTypes.ENUM('TMONEY', 'FLOOZ'),
    allowNull: false
  },
  phoneNumber: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  transactionId: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED'),
    defaultValue: 'PENDING'
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  callbackReceived: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  callbackData: {
    type: DataTypes.JSON,
    allowNull: true
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'mobile_money_transactions',
  timestamps: true
});

module.exports = MobileMoneyTransaction;
```

#### 3. [ ] Controller Mobile Money (controllers/mobileMoneyController.js)
```javascript
const { Payment, Prescription, PrescriptionExam, MobileMoneyTransaction } = require('../models');
const mobileMoneyService = require('../services/mobileMoneyService');
const qrcodeService = require('../services/qrcodeService');
const logger = require('../utils/logger');

const mobileMoneyController = {
  // Initier un paiement Mobile Money
  initiate: async (req, res) => {
    try {
      const { prescriptionId, provider, phoneNumber } = req.body;

      // Validation du provider
      if (!['TMONEY', 'FLOOZ'].includes(provider)) {
        return res.status(400).json({ error: 'Provider invalide' });
      }

      // Verifier la prescription
      const prescription = await Prescription.findByPk(prescriptionId);
      if (!prescription) {
        return res.status(404).json({ error: 'Prescription non trouvee' });
      }

      if (prescription.status !== 'PENDING') {
        return res.status(400).json({ error: 'Prescription deja traitee' });
      }

      // Creer le paiement en attente
      const payment = await Payment.create({
        prescriptionId,
        amount: prescription.totalAmount,
        paymentMethod: 'MOBILE_MONEY',
        paymentStatus: 'PENDING',
        cashierId: req.user.id
      });

      // Creer la transaction Mobile Money
      const mmTransaction = await MobileMoneyTransaction.create({
        paymentId: payment.id,
        provider,
        phoneNumber,
        amount: prescription.totalAmount
      });

      // Initier le paiement aupres du provider
      const reference = `CHU-${payment.paymentNumber}`;
      const description = `Paiement prescription ${prescription.prescriptionNumber}`;

      const result = await mobileMoneyService.initiatePayment(
        provider,
        prescription.totalAmount,
        phoneNumber,
        reference,
        description
      );

      if (!result.success) {
        mmTransaction.status = 'FAILED';
        mmTransaction.errorMessage = result.error;
        await mmTransaction.save();

        payment.paymentStatus = 'FAILED';
        await payment.save();

        return res.status(400).json({ error: result.error });
      }

      // Mettre a jour avec l'ID de transaction
      mmTransaction.transactionId = result.transactionId;
      mmTransaction.status = 'PROCESSING';
      await mmTransaction.save();

      payment.transactionReference = result.transactionId;
      await payment.save();

      res.json({
        message: 'Paiement initie. Veuillez confirmer sur votre telephone.',
        paymentId: payment.id,
        transactionId: result.transactionId,
        provider,
        amount: prescription.totalAmount
      });
    } catch (error) {
      logger.error('Mobile money initiate error', { error: error.message });
      res.status(500).json({ error: 'Erreur lors de l\'initiation du paiement' });
    }
  },

  // Callback du provider
  callback: async (req, res) => {
    try {
      const { provider } = req.params;
      const signature = req.headers['x-signature'];

      const result = await mobileMoneyService.processCallback(provider, req.body, signature);

      if (!result.valid) {
        logger.warn('Invalid callback', { provider, error: result.error });
        return res.status(400).json({ error: result.error });
      }

      // Trouver la transaction
      const mmTransaction = await MobileMoneyTransaction.findOne({
        where: { transactionId: result.transactionId },
        include: [{
          model: Payment,
          as: 'payment',
          include: [{ model: Prescription, as: 'prescription' }]
        }]
      });

      if (!mmTransaction) {
        logger.warn('Transaction not found', { transactionId: result.transactionId });
        return res.status(404).json({ error: 'Transaction non trouvee' });
      }

      mmTransaction.callbackReceived = true;
      mmTransaction.callbackData = req.body;

      if (result.status === 'SUCCESS') {
        mmTransaction.status = 'SUCCESS';
        mmTransaction.completedAt = new Date();
        await mmTransaction.save();

        // Mettre a jour le paiement
        const payment = mmTransaction.payment;

        // Generer QR code
        const qrData = {
          paymentId: payment.id,
          prescriptionNumber: payment.prescription.prescriptionNumber,
          amount: payment.amount,
          paidAt: new Date().toISOString()
        };
        const { qrCodeImage, qrData: qrDataString } = await qrcodeService.generateQRCode(qrData);

        payment.paymentStatus = 'SUCCESS';
        payment.qrCode = qrCodeImage;
        payment.qrCodeData = qrDataString;
        payment.paymentDate = new Date();
        await payment.save();

        // Mettre a jour prescription et examens
        await payment.prescription.update({ status: 'PAID' });
        await PrescriptionExam.update(
          { status: 'PAID' },
          { where: { prescriptionId: payment.prescriptionId } }
        );

        logger.info('Mobile money payment successful', {
          paymentId: payment.id,
          transactionId: result.transactionId
        });
      } else if (result.status === 'FAILED') {
        mmTransaction.status = 'FAILED';
        mmTransaction.errorMessage = result.error || 'Paiement refuse';
        await mmTransaction.save();

        const payment = mmTransaction.payment;
        payment.paymentStatus = 'FAILED';
        await payment.save();

        logger.info('Mobile money payment failed', {
          paymentId: payment.id,
          transactionId: result.transactionId
        });
      }

      res.json({ received: true });
    } catch (error) {
      logger.error('Callback processing error', { error: error.message });
      res.status(500).json({ error: 'Erreur de traitement' });
    }
  },

  // Verifier le statut d'un paiement
  checkStatus: async (req, res) => {
    try {
      const { paymentId } = req.params;

      const payment = await Payment.findByPk(paymentId, {
        include: [{
          model: MobileMoneyTransaction,
          as: 'mobileMoneyTransaction'
        }]
      });

      if (!payment) {
        return res.status(404).json({ error: 'Paiement non trouve' });
      }

      // Si le callback n'a pas ete recu, verifier aupres du provider
      if (payment.mobileMoneyTransaction &&
          payment.mobileMoneyTransaction.status === 'PROCESSING' &&
          !payment.mobileMoneyTransaction.callbackReceived) {

        const result = await mobileMoneyService.checkStatus(
          payment.mobileMoneyTransaction.provider,
          payment.mobileMoneyTransaction.transactionId
        );

        if (result.success) {
          // Traiter comme un callback
          // ... (meme logique que callback)
        }
      }

      res.json({
        paymentId: payment.id,
        status: payment.paymentStatus,
        qrCode: payment.paymentStatus === 'SUCCESS' ? payment.qrCode : null,
        mobileMoneyStatus: payment.mobileMoneyTransaction?.status
      });
    } catch (error) {
      logger.error('Check status error', { error: error.message });
      res.status(500).json({ error: 'Erreur lors de la verification' });
    }
  }
};

module.exports = mobileMoneyController;
```

### Backend - Rapports et Statistiques

#### 4. [ ] Service Rapports (services/reportService.js)
```javascript
const { Payment, Prescription, PrescriptionExam, Exam, User, Patient } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const reportService = {
  // Rapport financier journalier
  getDailyFinancialReport: async (date) => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const payments = await Payment.findAll({
      where: {
        paymentDate: { [Op.between]: [startOfDay, endOfDay] },
        paymentStatus: 'SUCCESS'
      },
      include: [
        { model: User, as: 'cashier', attributes: ['firstName', 'lastName'] },
        {
          model: Prescription,
          as: 'prescription',
          include: [{ model: Patient, as: 'patient' }]
        }
      ],
      order: [['paymentDate', 'ASC']]
    });

    // Agregations
    const totalAmount = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const byPaymentMethod = payments.reduce((acc, p) => {
      acc[p.paymentMethod] = (acc[p.paymentMethod] || 0) + parseFloat(p.amount);
      return acc;
    }, {});
    const byCashier = payments.reduce((acc, p) => {
      const name = `${p.cashier.lastName} ${p.cashier.firstName}`;
      acc[name] = (acc[name] || 0) + parseFloat(p.amount);
      return acc;
    }, {});

    return {
      date,
      totalPayments: payments.length,
      totalAmount,
      byPaymentMethod,
      byCashier,
      payments: payments.map(p => ({
        paymentNumber: p.paymentNumber,
        prescriptionNumber: p.prescription.prescriptionNumber,
        patientName: `${p.prescription.patient.lastName} ${p.prescription.patient.firstName}`,
        amount: p.amount,
        paymentMethod: p.paymentMethod,
        cashier: `${p.cashier.lastName} ${p.cashier.firstName}`,
        time: p.paymentDate
      }))
    };
  },

  // Rapport d'activite par service
  getServiceActivityReport: async (category, startDate, endDate) => {
    const exams = await PrescriptionExam.findAll({
      where: {
        status: 'COMPLETED',
        performedAt: { [Op.between]: [startDate, endDate] }
      },
      include: [
        {
          model: Exam,
          as: 'exam',
          where: { category }
        },
        { model: User, as: 'performer', attributes: ['firstName', 'lastName'] }
      ]
    });

    // Par type d'examen
    const byExamType = {};
    exams.forEach(e => {
      const name = e.exam.name;
      if (!byExamType[name]) {
        byExamType[name] = { count: 0, revenue: 0 };
      }
      byExamType[name].count++;
      byExamType[name].revenue += parseFloat(e.price);
    });

    // Par technicien
    const byTechnician = {};
    exams.forEach(e => {
      const name = `${e.performer.lastName} ${e.performer.firstName}`;
      if (!byTechnician[name]) {
        byTechnician[name] = { count: 0 };
      }
      byTechnician[name].count++;
    });

    return {
      category,
      period: { startDate, endDate },
      totalExams: exams.length,
      totalRevenue: exams.reduce((sum, e) => sum + parseFloat(e.price), 0),
      byExamType,
      byTechnician
    };
  },

  // Export Excel
  generateExcelReport: async (data, reportType) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Rapport');

    if (reportType === 'financial') {
      // En-tete
      sheet.columns = [
        { header: 'N° Paiement', key: 'paymentNumber', width: 20 },
        { header: 'N° Prescription', key: 'prescriptionNumber', width: 20 },
        { header: 'Patient', key: 'patientName', width: 30 },
        { header: 'Montant (FCFA)', key: 'amount', width: 15 },
        { header: 'Methode', key: 'paymentMethod', width: 15 },
        { header: 'Caissier', key: 'cashier', width: 25 },
        { header: 'Heure', key: 'time', width: 20 }
      ];

      // Donnees
      data.payments.forEach(p => {
        sheet.addRow({
          ...p,
          time: new Date(p.time).toLocaleTimeString('fr-FR')
        });
      });

      // Total
      sheet.addRow({});
      sheet.addRow({
        paymentNumber: 'TOTAL',
        amount: data.totalAmount
      });
    }

    return workbook;
  },

  // Export PDF
  generatePDFReport: async (data, reportType) => {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument();
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // En-tete
      doc.fontSize(20).text('CHU Tokoin', { align: 'center' });
      doc.fontSize(14).text('Rapport Financier', { align: 'center' });
      doc.moveDown();

      doc.fontSize(12).text(`Date: ${data.date}`);
      doc.text(`Nombre de paiements: ${data.totalPayments}`);
      doc.text(`Montant total: ${data.totalAmount.toLocaleString()} FCFA`);
      doc.moveDown();

      // Par methode de paiement
      doc.fontSize(14).text('Par methode de paiement:');
      Object.entries(data.byPaymentMethod).forEach(([method, amount]) => {
        doc.fontSize(12).text(`  ${method}: ${amount.toLocaleString()} FCFA`);
      });
      doc.moveDown();

      // Par caissier
      doc.fontSize(14).text('Par caissier:');
      Object.entries(data.byCashier).forEach(([name, amount]) => {
        doc.fontSize(12).text(`  ${name}: ${amount.toLocaleString()} FCFA`);
      });

      doc.end();
    });
  }
};

module.exports = reportService;
```

#### 5. [ ] Controller Rapports (controllers/reportController.js)
```javascript
const reportService = require('../services/reportService');
const { validationResult } = require('express-validator');

const reportController = {
  // Rapport financier journalier
  getDailyFinancial: async (req, res) => {
    try {
      const { date } = req.query;
      const reportDate = date ? new Date(date) : new Date();

      const report = await reportService.getDailyFinancialReport(reportDate);
      res.json(report);
    } catch (error) {
      console.error('Daily financial report error:', error);
      res.status(500).json({ error: 'Erreur lors de la generation du rapport' });
    }
  },

  // Rapport d'activite service
  getServiceActivity: async (req, res) => {
    try {
      const { category, startDate, endDate } = req.query;

      if (!category || !startDate || !endDate) {
        return res.status(400).json({ error: 'Parametres manquants' });
      }

      const report = await reportService.getServiceActivityReport(
        category,
        new Date(startDate),
        new Date(endDate)
      );
      res.json(report);
    } catch (error) {
      console.error('Service activity report error:', error);
      res.status(500).json({ error: 'Erreur lors de la generation du rapport' });
    }
  },

  // Export Excel
  exportExcel: async (req, res) => {
    try {
      const { reportType, date, startDate, endDate, category } = req.query;

      let data;
      if (reportType === 'financial') {
        data = await reportService.getDailyFinancialReport(new Date(date));
      } else if (reportType === 'activity') {
        data = await reportService.getServiceActivityReport(
          category,
          new Date(startDate),
          new Date(endDate)
        );
      }

      const workbook = await reportService.generateExcelReport(data, reportType);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=rapport_${reportType}_${Date.now()}.xlsx`);

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error('Excel export error:', error);
      res.status(500).json({ error: 'Erreur lors de l\'export' });
    }
  },

  // Export PDF
  exportPDF: async (req, res) => {
    try {
      const { reportType, date, startDate, endDate, category } = req.query;

      let data;
      if (reportType === 'financial') {
        data = await reportService.getDailyFinancialReport(new Date(date));
      }

      const pdfBuffer = await reportService.generatePDFReport(data, reportType);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=rapport_${reportType}_${Date.now()}.pdf`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('PDF export error:', error);
      res.status(500).json({ error: 'Erreur lors de l\'export' });
    }
  }
};

module.exports = reportController;
```

#### 6. [ ] Routes Rapports (routes/reports.js)
```javascript
const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

router.use(authenticateToken);
router.use(roleCheck('ADMIN', 'CASHIER'));

router.get('/financial/daily', reportController.getDailyFinancial);
router.get('/activity/service', roleCheck('ADMIN'), reportController.getServiceActivity);
router.get('/export/excel', reportController.exportExcel);
router.get('/export/pdf', reportController.exportPDF);

module.exports = router;
```

### Backend - Optimisations et Securite

#### 7. [ ] Rate Limiting (middleware/rateLimiter.js)
```javascript
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');

// Rate limiter general
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requetes par fenetre
  message: { error: 'Trop de requetes, reessayez plus tard' },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter pour l'authentification
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5, // 5 tentatives
  message: { error: 'Trop de tentatives de connexion, reessayez dans 1 heure' },
  skipSuccessfulRequests: true
});

// Rate limiter pour les paiements
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requetes par minute
  message: { error: 'Trop de requetes de paiement' }
});

module.exports = {
  generalLimiter,
  authLimiter,
  paymentLimiter
};
```

#### 8. [ ] Cache avec Redis (services/cacheService.js)
```javascript
const Redis = require('ioredis');
const logger = require('../utils/logger');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3
});

redis.on('error', (err) => {
  logger.error('Redis error', { error: err.message });
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

const cacheService = {
  // Obtenir une valeur
  get: async (key) => {
    try {
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Cache get error', { key, error: error.message });
      return null;
    }
  },

  // Definir une valeur
  set: async (key, value, ttlSeconds = 300) => {
    try {
      await redis.setex(key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error('Cache set error', { key, error: error.message });
      return false;
    }
  },

  // Supprimer une valeur
  del: async (key) => {
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      logger.error('Cache del error', { key, error: error.message });
      return false;
    }
  },

  // Invalider par pattern
  invalidatePattern: async (pattern) => {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      return true;
    } catch (error) {
      logger.error('Cache invalidate error', { pattern, error: error.message });
      return false;
    }
  }
};

module.exports = { redis, cacheService };
```

#### 9. [ ] Middleware de cache (middleware/cache.js)
```javascript
const { cacheService } = require('../services/cacheService');

const cacheMiddleware = (ttlSeconds = 300) => {
  return async (req, res, next) => {
    // Ne pas cacher les requetes non-GET
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = `api:${req.originalUrl}:${req.user?.id || 'anonymous'}`;

    try {
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      // Intercepter la reponse
      const originalJson = res.json.bind(res);
      res.json = async (data) => {
        if (res.statusCode === 200) {
          await cacheService.set(cacheKey, data, ttlSeconds);
        }
        return originalJson(data);
      };

      next();
    } catch (error) {
      next();
    }
  };
};

module.exports = cacheMiddleware;
```

#### 10. [ ] Monitoring et Healthcheck (routes/health.js)
```javascript
const express = require('express');
const router = express.Router();
const sequelize = require('../config/database');
const { redis } = require('../services/cacheService');
const os = require('os');

router.get('/', async (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(os.totalmem() / 1024 / 1024)
    },
    services: {}
  };

  // Check database
  try {
    await sequelize.authenticate();
    health.services.database = { status: 'OK' };
  } catch (error) {
    health.services.database = { status: 'ERROR', message: error.message };
    health.status = 'DEGRADED';
  }

  // Check Redis
  try {
    await redis.ping();
    health.services.redis = { status: 'OK' };
  } catch (error) {
    health.services.redis = { status: 'ERROR', message: error.message };
    health.status = 'DEGRADED';
  }

  const statusCode = health.status === 'OK' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Metriques pour monitoring
router.get('/metrics', async (req, res) => {
  const { Payment, Prescription, PrescriptionExam } = require('../models');
  const { Op } = require('sequelize');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const metrics = {
    timestamp: new Date().toISOString(),
    today: {
      prescriptions: await Prescription.count({ where: { createdAt: { [Op.gte]: today } } }),
      payments: await Payment.count({
        where: { paymentDate: { [Op.gte]: today }, paymentStatus: 'SUCCESS' }
      }),
      revenue: await Payment.sum('amount', {
        where: { paymentDate: { [Op.gte]: today }, paymentStatus: 'SUCCESS' }
      }) || 0,
      examsCompleted: await PrescriptionExam.count({
        where: { performedAt: { [Op.gte]: today }, status: 'COMPLETED' }
      })
    },
    queue: {
      pendingExams: await PrescriptionExam.count({ where: { status: 'PAID' } }),
      inProgressExams: await PrescriptionExam.count({ where: { status: 'IN_PROGRESS' } })
    }
  };

  res.json(metrics);
});

module.exports = router;
```

### Frontend - Dashboard Admin

#### 11. [ ] Page Dashboard Admin (pages/AdminDashboard.jsx)
```javascript
import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Box,
  Tabs,
  Tab,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField
} from '@mui/material';
import {
  TrendingUp,
  People,
  Receipt,
  LocalHospital,
  Download,
  Refresh
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import api from '../services/api';
import Layout from '../components/common/Layout';

const COLORS = ['#1976d2', '#dc004e', '#4caf50', '#ff9800'];

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [stats, setStats] = useState(null);
  const [financialReport, setFinancialReport] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedDate]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, financialRes] = await Promise.all([
        api.get('/stats/global'),
        api.get(`/reports/financial/daily?date=${selectedDate.toISOString()}`)
      ]);

      setStats(statsRes.data);
      setFinancialReport(financialRes.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    try {
      const response = await api.get(
        `/reports/export/${format}?reportType=financial&date=${selectedDate.toISOString()}`,
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `rapport_${format === 'excel' ? 'xlsx' : 'pdf'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  const paymentMethodData = financialReport?.byPaymentMethod
    ? Object.entries(financialReport.byPaymentMethod).map(([name, value]) => ({
        name,
        value
      }))
    : [];

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">Tableau de Bord Administration</Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              type="date"
              value={selectedDate.toISOString().split('T')[0]}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              size="small"
            />
            <Button
              startIcon={<Refresh />}
              onClick={fetchDashboardData}
              variant="outlined"
            >
              Actualiser
            </Button>
          </Box>
        </Box>

        {/* Cartes de statistiques */}
        {stats && (
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: 'primary.main', color: 'white' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Receipt sx={{ fontSize: 40, mr: 2 }} />
                    <Box>
                      <Typography variant="h4">{stats.today.prescriptions}</Typography>
                      <Typography>Prescriptions</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: 'success.main', color: 'white' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <TrendingUp sx={{ fontSize: 40, mr: 2 }} />
                    <Box>
                      <Typography variant="h4">
                        {stats.today.amount?.toLocaleString()}
                      </Typography>
                      <Typography>Recettes (FCFA)</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: 'warning.main', color: 'white' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <LocalHospital sx={{ fontSize: 40, mr: 2 }} />
                    <Box>
                      <Typography variant="h4">{stats.today.examsCompleted}</Typography>
                      <Typography>Examens termines</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: 'secondary.main', color: 'white' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <People sx={{ fontSize: 40, mr: 2 }} />
                    <Box>
                      <Typography variant="h4">{stats.today.payments}</Typography>
                      <Typography>Paiements</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Onglets */}
        <Paper sx={{ mb: 3 }}>
          <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
            <Tab label="Rapport Financier" />
            <Tab label="Activite Services" />
            <Tab label="Gestion Utilisateurs" />
          </Tabs>
        </Paper>

        {/* Contenu */}
        {activeTab === 0 && financialReport && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6">Repartition par methode de paiement</Typography>
                  <Box>
                    <Button
                      size="small"
                      startIcon={<Download />}
                      onClick={() => handleExport('excel')}
                      sx={{ mr: 1 }}
                    >
                      Excel
                    </Button>
                    <Button
                      size="small"
                      startIcon={<Download />}
                      onClick={() => handleExport('pdf')}
                    >
                      PDF
                    </Button>
                  </Box>
                </Box>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={paymentMethodData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {paymentMethodData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value.toLocaleString()} FCFA`} />
                  </PieChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>Resume</Typography>
                <Box sx={{ mb: 2 }}>
                  <Typography color="textSecondary">Total paiements</Typography>
                  <Typography variant="h5">{financialReport.totalPayments}</Typography>
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography color="textSecondary">Montant total</Typography>
                  <Typography variant="h5">
                    {financialReport.totalAmount?.toLocaleString()} FCFA
                  </Typography>
                </Box>
                <Typography variant="subtitle2" gutterBottom>Par caissier:</Typography>
                {financialReport.byCashier && Object.entries(financialReport.byCashier).map(([name, amount]) => (
                  <Box key={name} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">{name}</Typography>
                    <Typography variant="body2">{amount.toLocaleString()} FCFA</Typography>
                  </Box>
                ))}
              </Paper>
            </Grid>
          </Grid>
        )}

        {activeTab === 1 && (
          <Paper sx={{ p: 3 }}>
            <Typography>Rapport d'activite des services - A implementer</Typography>
          </Paper>
        )}

        {activeTab === 2 && (
          <Paper sx={{ p: 3 }}>
            <Typography>Gestion des utilisateurs - A implementer</Typography>
          </Paper>
        )}
      </Container>
    </Layout>
  );
};

export default AdminDashboard;
```

#### 12. [ ] Composant Paiement Mobile Money (components/cashier/MobileMoneyPayment.jsx)
```javascript
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Stepper,
  Step,
  StepLabel
} from '@mui/material';
import { Phone, CheckCircle, Error } from '@mui/icons-material';
import api from '../../services/api';

const steps = ['Selection provider', 'Numero telephone', 'Confirmation', 'Resultat'];

const MobileMoneyPayment = ({ open, onClose, prescription, onSuccess }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [provider, setProvider] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paymentId, setPaymentId] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);

  // Polling pour verifier le statut
  useEffect(() => {
    let interval;
    if (paymentId && paymentStatus === 'PROCESSING') {
      interval = setInterval(async () => {
        try {
          const response = await api.get(`/payments/mobile-money/${paymentId}/status`);
          if (response.data.status === 'SUCCESS') {
            setPaymentStatus('SUCCESS');
            setActiveStep(3);
            clearInterval(interval);
          } else if (response.data.status === 'FAILED') {
            setPaymentStatus('FAILED');
            setError('Le paiement a ete refuse');
            clearInterval(interval);
          }
        } catch (err) {
          console.error('Status check error:', err);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [paymentId, paymentStatus]);

  const handleNext = async () => {
    if (activeStep === 2) {
      // Initier le paiement
      setLoading(true);
      setError(null);
      try {
        const response = await api.post('/payments/mobile-money/initiate', {
          prescriptionId: prescription.id,
          provider,
          phoneNumber
        });
        setPaymentId(response.data.paymentId);
        setPaymentStatus('PROCESSING');
        setActiveStep(3);
      } catch (err) {
        setError(err.response?.data?.error || 'Erreur lors du paiement');
      } finally {
        setLoading(false);
      }
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleClose = () => {
    if (paymentStatus === 'SUCCESS') {
      onSuccess();
    }
    onClose();
    // Reset state
    setActiveStep(0);
    setProvider('');
    setPhoneNumber('');
    setPaymentId(null);
    setPaymentStatus(null);
    setError(null);
  };

  const isNextDisabled = () => {
    if (activeStep === 0 && !provider) return true;
    if (activeStep === 1 && !phoneNumber) return true;
    return false;
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Paiement Mobile Money</DialogTitle>
      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ my: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {activeStep === 0 && (
          <FormControl fullWidth>
            <InputLabel>Provider</InputLabel>
            <Select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              label="Provider"
            >
              <MenuItem value="TMONEY">T-Money (Togocel)</MenuItem>
              <MenuItem value="FLOOZ">Flooz (Moov)</MenuItem>
            </Select>
          </FormControl>
        )}

        {activeStep === 1 && (
          <TextField
            fullWidth
            label="Numero de telephone"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+228 90 XX XX XX"
            InputProps={{
              startAdornment: <Phone sx={{ mr: 1, color: 'action.active' }} />
            }}
          />
        )}

        {activeStep === 2 && (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>Confirmer le paiement</Typography>
            <Typography>Provider: {provider}</Typography>
            <Typography>Telephone: {phoneNumber}</Typography>
            <Typography variant="h5" color="primary" sx={{ mt: 2 }}>
              {prescription.totalAmount?.toLocaleString()} FCFA
            </Typography>
          </Box>
        )}

        {activeStep === 3 && (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            {paymentStatus === 'PROCESSING' && (
              <>
                <CircularProgress size={60} sx={{ mb: 2 }} />
                <Typography variant="h6">Paiement en cours...</Typography>
                <Typography color="textSecondary">
                  Veuillez confirmer le paiement sur votre telephone
                </Typography>
              </>
            )}
            {paymentStatus === 'SUCCESS' && (
              <>
                <CheckCircle sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
                <Typography variant="h6" color="success.main">
                  Paiement reussi!
                </Typography>
              </>
            )}
            {paymentStatus === 'FAILED' && (
              <>
                <Error sx={{ fontSize: 60, color: 'error.main', mb: 2 }} />
                <Typography variant="h6" color="error.main">
                  Paiement echoue
                </Typography>
              </>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>
          {paymentStatus === 'SUCCESS' ? 'Fermer' : 'Annuler'}
        </Button>
        {activeStep < 3 && (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={isNextDisabled() || loading}
          >
            {loading ? <CircularProgress size={24} /> : activeStep === 2 ? 'Payer' : 'Suivant'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default MobileMoneyPayment;
```

## Tests a effectuer

### Backend
- [ ] POST /api/payments/mobile-money/initiate - Initier paiement
- [ ] POST /api/payments/mobile-money/callback/:provider - Recevoir callback
- [ ] GET /api/payments/mobile-money/:id/status - Verifier statut
- [ ] GET /api/reports/financial/daily - Rapport journalier
- [ ] GET /api/reports/activity/service - Rapport activite
- [ ] GET /api/reports/export/excel - Export Excel
- [ ] GET /api/reports/export/pdf - Export PDF
- [ ] GET /api/health - Healthcheck
- [ ] Rate limiting fonctionne
- [ ] Cache Redis fonctionne

### Frontend
- [ ] Dashboard admin affiche statistiques
- [ ] Graphiques de repartition
- [ ] Export rapports fonctionnel
- [ ] Paiement Mobile Money flow complet
- [ ] Polling statut paiement
- [ ] Gestion des erreurs

### Integration
- [ ] Flow Mobile Money complet (initiation -> callback -> QR)
- [ ] Rapports refletent les donnees reelles
- [ ] Exports corrects et complets
- [ ] Monitoring fonctionne

## Points de validation
- [ ] Integration Mobile Money operationnelle (sandbox)
- [ ] Rapports financiers complets
- [ ] Exports Excel et PDF
- [ ] Dashboard admin fonctionnel
- [ ] Rate limiting et cache actifs
- [ ] Monitoring et healthcheck

## Optimisations futures
- [ ] Integration SMS pour notifications
- [ ] Integration email pour resultats
- [ ] Application mobile patient
- [ ] Mode hors-ligne partiel
- [ ] Synchronisation multi-sites
- [ ] Backup automatique
- [ ] Audit de securite complet

## Documentation finale
- [ ] README.md complet
- [ ] SETUP.md avec instructions detaillees
- [ ] API.md documentation API
- [ ] DATABASE.md schema et migrations
- [ ] Guide utilisateur par role
