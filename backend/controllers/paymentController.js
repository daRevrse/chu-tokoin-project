const { Payment, Prescription, PrescriptionExam, Patient, Exam, User } = require('../models');
const qrcodeService = require('../services/qrcodeService');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

const paymentController = {
  /**
   * Enregistrer un paiement
   * POST /api/payments
   */
  create: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { prescriptionId, paymentMethod, transactionReference } = req.body;

      // Recuperer la prescription avec toutes les relations
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
        return res.status(404).json({
          error: 'Prescription non trouvee'
        });
      }

      if (prescription.status !== 'PENDING') {
        return res.status(400).json({
          error: 'Cette prescription a deja ete traitee'
        });
      }

      // Creer le paiement
      const payment = await Payment.create({
        prescriptionId,
        amount: prescription.totalAmount,
        paymentMethod: paymentMethod || 'CASH',
        paymentStatus: 'SUCCESS',
        cashierId: req.user.id,
        transactionReference,
        paymentDate: new Date()
      });

      // Generer les donnees du QR code
      const qrPaymentData = qrcodeService.generatePaymentQRData(
        payment,
        prescription,
        prescription.patient,
        prescription.prescriptionExams
      );

      // Generer le QR code
      const { qrCodeImage, qrData } = await qrcodeService.generateQRCode(qrPaymentData);

      // Mettre a jour le paiement avec le QR code
      payment.qrCode = qrCodeImage;
      payment.qrCodeData = qrData;
      await payment.save();

      // Mettre a jour le statut de la prescription
      prescription.status = 'PAID';
      await prescription.save();

      // Mettre a jour le statut des examens
      await PrescriptionExam.update(
        { status: 'PAID' },
        { where: { prescriptionId: prescription.id } }
      );

      // Recharger le paiement avec les relations
      const fullPayment = await Payment.findByPk(payment.id, {
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

      logger.info('Paiement enregistre', {
        paymentId: payment.id,
        paymentNumber: payment.paymentNumber,
        prescriptionId: prescription.id,
        amount: payment.amount
      });

      res.status(201).json({
        message: 'Paiement enregistre avec succes',
        payment: fullPayment
      });
    } catch (error) {
      logger.error('Create payment error:', error);
      res.status(500).json({
        error: 'Erreur lors de l\'enregistrement du paiement'
      });
    }
  },

  /**
   * Obtenir un paiement par ID
   * GET /api/payments/:id
   */
  getById: async (req, res) => {
    try {
      const payment = await Payment.findByPk(req.params.id, {
        include: [
          {
            model: User,
            as: 'cashier',
            attributes: ['id', 'firstName', 'lastName']
          },
          {
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
          }
        ]
      });

      if (!payment) {
        return res.status(404).json({
          error: 'Paiement non trouve'
        });
      }

      res.json({ payment });
    } catch (error) {
      logger.error('Get payment error:', error);
      res.status(500).json({
        error: 'Erreur lors de la recuperation du paiement'
      });
    }
  },

  /**
   * Lister les paiements
   * GET /api/payments
   */
  getAll: async (req, res) => {
    try {
      const { page = 1, limit = 20, status, startDate, endDate } = req.query;
      const offset = (page - 1) * limit;

      const where = {};

      if (status) {
        where.paymentStatus = status;
      }

      if (startDate && endDate) {
        where.paymentDate = {
          [require('sequelize').Op.between]: [new Date(startDate), new Date(endDate)]
        };
      }

      // Si c'est un caissier, ne montrer que ses paiements
      if (req.user.role === 'CASHIER') {
        where.cashierId = req.user.id;
      }

      const { count, rows } = await Payment.findAndCountAll({
        where,
        include: [
          {
            model: User,
            as: 'cashier',
            attributes: ['id', 'firstName', 'lastName']
          },
          {
            model: Prescription,
            as: 'prescription',
            include: [{ model: Patient, as: 'patient' }]
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        payments: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          pages: Math.ceil(count / limit),
          limit: parseInt(limit)
        }
      });
    } catch (error) {
      logger.error('Get payments error:', error);
      res.status(500).json({
        error: 'Erreur lors de la recuperation des paiements'
      });
    }
  },

  /**
   * Obtenir le QR code d'un paiement
   * GET /api/payments/:id/qrcode
   */
  getQRCode: async (req, res) => {
    try {
      const payment = await Payment.findByPk(req.params.id, {
        attributes: ['id', 'paymentNumber', 'qrCode', 'paymentStatus']
      });

      if (!payment) {
        return res.status(404).json({
          error: 'Paiement non trouve'
        });
      }

      if (payment.paymentStatus !== 'SUCCESS') {
        return res.status(400).json({
          error: 'QR code disponible uniquement pour les paiements reussis'
        });
      }

      res.json({
        paymentNumber: payment.paymentNumber,
        qrCode: payment.qrCode
      });
    } catch (error) {
      logger.error('Get QR code error:', error);
      res.status(500).json({
        error: 'Erreur lors de la recuperation du QR code'
      });
    }
  },

  /**
   * Statistiques des paiements du jour
   * GET /api/payments/stats/today
   */
  getTodayStats: async (req, res) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const where = {
        paymentDate: {
          [require('sequelize').Op.between]: [today, tomorrow]
        },
        paymentStatus: 'SUCCESS'
      };

      // Si c'est un caissier, ne compter que ses paiements
      if (req.user.role === 'CASHIER') {
        where.cashierId = req.user.id;
      }

      const payments = await Payment.findAll({ where });

      const stats = {
        count: payments.length,
        total: payments.reduce((sum, p) => sum + parseFloat(p.amount), 0),
        byMethod: {}
      };

      // Grouper par methode de paiement
      payments.forEach(p => {
        if (!stats.byMethod[p.paymentMethod]) {
          stats.byMethod[p.paymentMethod] = { count: 0, total: 0 };
        }
        stats.byMethod[p.paymentMethod].count++;
        stats.byMethod[p.paymentMethod].total += parseFloat(p.amount);
      });

      res.json({ stats });
    } catch (error) {
      logger.error('Get today stats error:', error);
      res.status(500).json({
        error: 'Erreur lors de la recuperation des statistiques'
      });
    }
  }
};

module.exports = paymentController;
