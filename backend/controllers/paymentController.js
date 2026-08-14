const { Payment, Prescription, PrescriptionExam, Patient, Exam, User, Invoice, InvoiceLine } = require('../models');
const qrcodeService = require('../services/qrcodeService');
const { validationResult } = require('express-validator');
const { recordExpectedResultAt } = require('../services/resultReadinessService');
const { recordPayment, cancelPayment } = require('../services/invoiceService');
const { ensureExamInvoice } = require('../services/examBillingService');
const logger = require('../utils/logger');

/**
 * Effets metier declenches par le solde complet d'une facture d'examens :
 * liberation des examens, date de disponibilite annoncee au patient, et QR code
 * qui lui sert de droit d'entree dans les services.
 *
 * Ces effets sont volontairement lies au solde et non au premier versement : un
 * patient qui a verse la moitie ne doit pas repartir avec un QR code qui lui
 * ouvre tous les examens.
 */
const settleExamPrescription = async (prescription, payment, invoice) => {
  const qrPaymentData = qrcodeService.generatePaymentQRData(
    payment,
    prescription,
    prescription.patient,
    prescription.prescriptionExams,
    // Le QR porte le montant de la facture, pas celui du dernier versement :
    // en cas de reglement en plusieurs fois, le service qui le scanne doit voir
    // ce qui a ete paye en tout.
    invoice.totalAmount
  );

  const { qrCodeImage, qrData } = await qrcodeService.generateQRCode(qrPaymentData);

  payment.qrCode = qrCodeImage;
  payment.qrCodeData = qrData;
  await payment.save();

  prescription.status = 'PAID';
  await prescription.save();

  await PrescriptionExam.update(
    { status: 'PAID' },
    { where: { prescriptionId: prescription.id } }
  );

  // Date annoncee au patient sur son recu : le reglement est le point de depart
  // du delai, c'est donc ici qu'elle se fige.
  await recordExpectedResultAt(prescription.id, payment.paymentDate);
};

const paymentController = {
  /**
   * Encaisser un versement
   * POST /api/payments
   *
   * Accepte soit `invoiceId` (cas general : la caisse encaisse une facture),
   * soit `prescriptionId` (compatibilite : la facture d'examens est alors
   * retrouvee ou emise a la volee pour les prescriptions anterieures a la
   * facturation).
   *
   * `amount` est facultatif : sans lui, le caissier solde la facture. Le
   * preciser permet le reglement partiel.
   */
  create: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { prescriptionId, invoiceId, paymentMethod, transactionReference, amount } = req.body;

      if (!prescriptionId && !invoiceId) {
        return res.status(400).json({
          error: 'Une facture ou une prescription doit etre designee'
        });
      }

      let invoice;

      if (invoiceId) {
        invoice = await Invoice.findByPk(invoiceId);
        if (!invoice) {
          return res.status(404).json({ error: 'Facture non trouvee' });
        }
      } else {
        const prescription = await Prescription.findByPk(prescriptionId);

        if (!prescription) {
          return res.status(404).json({ error: 'Prescription non trouvee' });
        }

        if (prescription.status !== 'PENDING') {
          return res.status(400).json({
            error: 'Cette prescription a deja ete traitee'
          });
        }

        invoice = await ensureExamInvoice(prescription.id, { issuedBy: req.user.id });

        if (!invoice) {
          return res.status(400).json({
            error: 'Cette prescription ne comporte aucun examen a facturer'
          });
        }
      }

      const { invoice: updatedInvoice, payment, justSettled } = await recordPayment(invoice.id, {
        amount,
        paymentMethod: paymentMethod || 'CASH',
        transactionReference,
        cashierId: req.user.id
      });

      // Les effets aval ne concernent que les factures d'examens : une facture
      // de consultation n'ouvre aucun service et ne produit pas de QR code, le
      // ticket de passage suffit a appeler le patient.
      if (justSettled && updatedInvoice.invoiceType === 'EXAM' && updatedInvoice.prescriptionId) {
        const prescription = await Prescription.findByPk(updatedInvoice.prescriptionId, {
          include: [
            { model: Patient, as: 'patient' },
            {
              model: PrescriptionExam,
              as: 'prescriptionExams',
              include: [{ model: Exam, as: 'exam' }]
            }
          ]
        });

        if (prescription) {
          await settleExamPrescription(prescription, payment, updatedInvoice);
        }
      }

      const fullPayment = await Payment.findByPk(payment.id, {
        include: [
          {
            model: Invoice,
            as: 'invoice',
            include: [{ model: InvoiceLine, as: 'lines' }]
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

      logger.info('Versement enregistre', {
        paymentId: payment.id,
        paymentNumber: payment.paymentNumber,
        invoiceNumber: updatedInvoice.invoiceNumber,
        invoiceType: updatedInvoice.invoiceType,
        amount: payment.amount,
        balance: updatedInvoice.getBalance(),
        settled: justSettled
      });

      res.status(201).json({
        message: justSettled
          ? 'Paiement enregistre avec succes'
          : `Versement enregistre. Reste a payer : ${updatedInvoice.getBalance()}`,
        payment: fullPayment,
        invoice: updatedInvoice,
        settled: justSettled
      });
    } catch (error) {
      // Les erreurs metier du service de facturation portent leur propre code :
      // les ecraser en 500 ferait disparaitre "facture deja soldee" ou "montant
      // superieur au reste a payer" derriere une panne serveur.
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }

      logger.error('Create payment error:', error);
      res.status(500).json({
        error: 'Erreur lors de l\'enregistrement du paiement'
      });
    }
  },

  /**
   * Annuler un versement encaisse par erreur
   * PATCH /api/payments/:id/cancel
   *
   * Correction de caisse et non remboursement : la facture redevient due, le
   * mouvement d'espece se traite au guichet.
   */
  cancel: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const existing = await Payment.findByPk(req.params.id, {
        include: [{ model: Invoice, as: 'invoice' }]
      });

      if (!existing) {
        return res.status(404).json({ error: 'Paiement non trouve' });
      }

      // Une facture d'examens soldee a libere le circuit aval : QR code remis au
      // patient, examens ouverts aux services. Tant que rien n'a ete consomme on
      // sait revenir en arriere ; des qu'un service a commence, la correction
      // n'est plus une correction, c'est un litige a traiter a la main.
      const prescription = existing.invoice?.prescriptionId
        ? await Prescription.findByPk(existing.invoice.prescriptionId)
        : null;

      if (prescription && !['PENDING', 'PAID'].includes(prescription.status)) {
        return res.status(409).json({
          error: `Les examens de la prescription ${prescription.prescriptionNumber} sont deja engages (statut : ${prescription.status}). Ce versement ne peut plus etre annule.`
        });
      }

      const { payment, invoice } = await cancelPayment(req.params.id, {
        reason: req.body.cancelReason,
        userId: req.user.id
      });

      // La facture n'est plus soldee : le droit d'entree dans les services doit
      // etre retire avec l'argent.
      if (prescription && prescription.status === 'PAID' && invoice && invoice.status !== 'PAID') {
        await prescription.update({ status: 'PENDING', expectedResultAt: null });
        await PrescriptionExam.update(
          { status: 'PENDING' },
          { where: { prescriptionId: prescription.id } }
        );
        await Payment.update(
          { qrCode: null, qrCodeData: null },
          { where: { invoiceId: invoice.id } }
        );
      }

      logger.warn('Versement annule', {
        paymentId: payment.id,
        paymentNumber: payment.paymentNumber,
        amount: payment.amount,
        invoiceNumber: invoice ? invoice.invoiceNumber : null,
        reason: req.body.cancelReason,
        by: req.user.id
      });

      res.json({ message: 'Versement annule', payment, invoice });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }

      logger.error('Cancel payment error:', error);
      res.status(500).json({ error: 'Erreur lors de l\'annulation du versement' });
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
