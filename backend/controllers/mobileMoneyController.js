const { Payment, Prescription, PrescriptionExam, MobileMoneyTransaction } = require('../models');
const mobileMoneyService = require('../services/mobileMoneyService');
const qrcodeService = require('../services/qrcodeService');
const logger = require('../utils/logger');

const mobileMoneyController = {
  /**
   * Initier un paiement Mobile Money
   * POST /api/payments/mobile-money/initiate
   */
  initiate: async (req, res) => {
    try {
      const { prescriptionId, provider, phoneNumber } = req.body;

      // Validation
      if (!prescriptionId || !provider || !phoneNumber) {
        return res.status(400).json({ error: 'Donnees manquantes (prescriptionId, provider, phoneNumber requis)' });
      }

      if (!['TMONEY', 'FLOOZ'].includes(provider)) {
        return res.status(400).json({ error: 'Provider invalide. Utiliser TMONEY ou FLOOZ' });
      }

      // Verifier la prescription
      const prescription = await Prescription.findByPk(prescriptionId);
      if (!prescription) {
        return res.status(404).json({ error: 'Prescription non trouvee' });
      }

      if (prescription.status !== 'PENDING') {
        return res.status(400).json({ error: 'Cette prescription a deja ete traitee' });
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

        return res.status(400).json({ error: result.error || 'Erreur lors de l\'initiation du paiement' });
      }

      // Mettre a jour avec l'ID de transaction
      mmTransaction.transactionId = result.transactionId;
      mmTransaction.status = 'PROCESSING';
      await mmTransaction.save();

      payment.transactionReference = result.transactionId;
      await payment.save();

      logger.info('Mobile money payment initiated', {
        paymentId: payment.id,
        provider,
        transactionId: result.transactionId
      });

      res.json({
        message: 'Paiement initie. Veuillez confirmer sur votre telephone.',
        paymentId: payment.id,
        transactionId: result.transactionId,
        provider,
        amount: prescription.totalAmount,
        prescriptionNumber: prescription.prescriptionNumber
      });
    } catch (error) {
      logger.error('Mobile money initiate error', { error: error.message });
      res.status(500).json({ error: 'Erreur lors de l\'initiation du paiement' });
    }
  },

  /**
   * Callback du provider Mobile Money
   * POST /api/payments/mobile-money/callback/:provider
   */
  callback: async (req, res) => {
    try {
      const { provider } = req.params;
      const signature = req.headers['x-signature'];

      logger.info('Mobile money callback received', { provider, body: req.body });

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
          paymentNumber: payment.paymentNumber,
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
      } else {
        await mmTransaction.save();
      }

      res.json({ received: true });
    } catch (error) {
      logger.error('Callback processing error', { error: error.message });
      res.status(500).json({ error: 'Erreur de traitement' });
    }
  },

  /**
   * Verifier le statut d'un paiement Mobile Money
   * GET /api/payments/mobile-money/:paymentId/status
   */
  checkStatus: async (req, res) => {
    try {
      const { paymentId } = req.params;

      const payment = await Payment.findByPk(paymentId, {
        include: [
          {
            model: MobileMoneyTransaction,
            as: 'mobileMoneyTransaction'
          },
          {
            model: Prescription,
            as: 'prescription'
          }
        ]
      });

      if (!payment) {
        return res.status(404).json({ error: 'Paiement non trouve' });
      }

      // Si le callback n'a pas ete recu et le paiement est en cours, verifier aupres du provider
      if (payment.mobileMoneyTransaction &&
          payment.mobileMoneyTransaction.status === 'PROCESSING' &&
          !payment.mobileMoneyTransaction.callbackReceived) {

        const result = await mobileMoneyService.checkStatus(
          payment.mobileMoneyTransaction.provider,
          payment.mobileMoneyTransaction.transactionId
        );

        if (result.success && result.status === 'SUCCESS') {
          // Traiter comme un callback reussi
          payment.mobileMoneyTransaction.status = 'SUCCESS';
          payment.mobileMoneyTransaction.completedAt = new Date();
          await payment.mobileMoneyTransaction.save();

          // Generer QR code
          const qrData = {
            paymentId: payment.id,
            paymentNumber: payment.paymentNumber,
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

          await payment.prescription.update({ status: 'PAID' });
          await PrescriptionExam.update(
            { status: 'PAID' },
            { where: { prescriptionId: payment.prescriptionId } }
          );

          logger.info('Mobile money payment confirmed via status check', { paymentId: payment.id });
        }
      }

      res.json({
        paymentId: payment.id,
        paymentNumber: payment.paymentNumber,
        status: payment.paymentStatus,
        amount: payment.amount,
        qrCode: payment.paymentStatus === 'SUCCESS' ? payment.qrCode : null,
        mobileMoneyStatus: payment.mobileMoneyTransaction?.status,
        provider: payment.mobileMoneyTransaction?.provider
      });
    } catch (error) {
      logger.error('Check status error', { error: error.message });
      res.status(500).json({ error: 'Erreur lors de la verification' });
    }
  },

  /**
   * Simuler un callback pour les tests (sandbox uniquement)
   * POST /api/payments/mobile-money/:paymentId/simulate-callback
   */
  simulateCallback: async (req, res) => {
    try {
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Non autorise en production' });
      }

      const { paymentId } = req.params;
      const { status = 'SUCCESS' } = req.body;

      const payment = await Payment.findByPk(paymentId, {
        include: [
          { model: MobileMoneyTransaction, as: 'mobileMoneyTransaction' },
          { model: Prescription, as: 'prescription' }
        ]
      });

      if (!payment || !payment.mobileMoneyTransaction) {
        return res.status(404).json({ error: 'Paiement ou transaction non trouve' });
      }

      const mmTransaction = payment.mobileMoneyTransaction;

      if (status === 'SUCCESS') {
        mmTransaction.status = 'SUCCESS';
        mmTransaction.completedAt = new Date();
        mmTransaction.callbackReceived = true;
        await mmTransaction.save();

        // Generer QR code
        const qrData = {
          paymentId: payment.id,
          paymentNumber: payment.paymentNumber,
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

        await payment.prescription.update({ status: 'PAID' });
        await PrescriptionExam.update(
          { status: 'PAID' },
          { where: { prescriptionId: payment.prescriptionId } }
        );

        logger.info('Simulated successful callback', { paymentId });
      } else {
        mmTransaction.status = 'FAILED';
        mmTransaction.errorMessage = 'Paiement refuse (simulation)';
        mmTransaction.callbackReceived = true;
        await mmTransaction.save();

        payment.paymentStatus = 'FAILED';
        await payment.save();

        logger.info('Simulated failed callback', { paymentId });
      }

      res.json({
        message: `Callback simule avec statut ${status}`,
        paymentStatus: payment.paymentStatus,
        qrCode: payment.qrCode
      });
    } catch (error) {
      logger.error('Simulate callback error', { error: error.message });
      res.status(500).json({ error: 'Erreur lors de la simulation' });
    }
  }
};

module.exports = mobileMoneyController;
