const { Payment, Prescription, PrescriptionExam, Patient, Exam, User } = require('../models');
const qrcodeService = require('../services/qrcodeService');
const logger = require('../utils/logger');

const serviceController = {
  /**
   * Verifier un QR code et obtenir les examens
   * POST /api/services/verify-qr
   */
  verifyQRCode: async (req, res) => {
    try {
      const { qrData } = req.body;

      if (!qrData) {
        return res.status(400).json({ error: 'Donnees QR requises' });
      }

      // Parser les donnees du QR
      let parsedData;
      try {
        parsedData = qrcodeService.parseQRCode(qrData);
      } catch (error) {
        return res.status(400).json({ error: 'QR code invalide ou mal forme' });
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
        return res.status(400).json({ error: 'Paiement non valide ou non confirme' });
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

      logger.info('QR code verifie', {
        paymentId: payment.id,
        userId: req.user.id,
        examCount: relevantExams.length
      });

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
      logger.error('Verify QR error:', error);
      res.status(500).json({ error: 'Erreur lors de la verification du QR code' });
    }
  },

  /**
   * Obtenir les examens en attente pour un service
   * GET /api/services/pending
   */
  getPendingExams: async (req, res) => {
    try {
      const { page = 1, limit = 50 } = req.query;
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
      logger.error('Get pending exams error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation des examens' });
    }
  },

  /**
   * Demarrer un examen (passer en IN_PROGRESS)
   * PATCH /api/services/exams/:id/start
   */
  startExam: async (req, res) => {
    try {
      const { id } = req.params;

      const prescriptionExam = await PrescriptionExam.findByPk(id, {
        include: [
          { model: Exam, as: 'exam' },
          {
            model: Prescription,
            as: 'prescription',
            include: [{ model: Patient, as: 'patient' }]
          }
        ]
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
        return res.status(400).json({
          error: `L'examen ne peut pas etre demarre (statut actuel: ${prescriptionExam.status})`
        });
      }

      prescriptionExam.status = 'IN_PROGRESS';
      prescriptionExam.performedBy = req.user.id;
      await prescriptionExam.save();

      // Mettre a jour le statut de la prescription si c'est le premier examen demarre
      if (prescriptionExam.prescription.status === 'PAID') {
        await prescriptionExam.prescription.update({ status: 'IN_PROGRESS' });
      }

      logger.info('Examen demarre', {
        examId: id,
        userId: req.user.id,
        patientId: prescriptionExam.prescription.patient.id
      });

      res.json({
        message: 'Examen demarre',
        exam: {
          id: prescriptionExam.id,
          code: prescriptionExam.exam.code,
          name: prescriptionExam.exam.name,
          status: prescriptionExam.status
        }
      });
    } catch (error) {
      logger.error('Start exam error:', error);
      res.status(500).json({ error: 'Erreur lors du demarrage de l\'examen' });
    }
  },

  /**
   * Terminer un examen
   * PATCH /api/services/exams/:id/complete
   */
  completeExam: async (req, res) => {
    try {
      const { id } = req.params;
      const notes = req.body?.notes;

      const prescriptionExam = await PrescriptionExam.findByPk(id, {
        include: [
          { model: Exam, as: 'exam' },
          { model: Prescription, as: 'prescription' }
        ]
      });

      if (!prescriptionExam) {
        return res.status(404).json({ error: 'Examen non trouve' });
      }

      // Verifier que c'est le bon utilisateur ou un admin
      if (req.user.role !== 'ADMIN' && prescriptionExam.performedBy !== req.user.id) {
        return res.status(403).json({ error: 'Vous n\'etes pas autorise a terminer cet examen' });
      }

      if (prescriptionExam.status !== 'IN_PROGRESS') {
        return res.status(400).json({
          error: `L'examen doit etre en cours pour etre termine (statut actuel: ${prescriptionExam.status})`
        });
      }

      prescriptionExam.status = 'COMPLETED';
      prescriptionExam.performedAt = new Date();
      if (notes) {
        prescriptionExam.notes = notes;
      }
      await prescriptionExam.save();

      // Verifier si tous les examens de la prescription sont termines
      const allExams = await PrescriptionExam.findAll({
        where: { prescriptionId: prescriptionExam.prescriptionId }
      });

      const allCompleted = allExams.every(e => e.status === 'COMPLETED');
      if (allCompleted) {
        await prescriptionExam.prescription.update({ status: 'COMPLETED' });
      }

      logger.info('Examen termine', {
        examId: id,
        userId: req.user.id,
        prescriptionCompleted: allCompleted
      });

      res.json({
        message: 'Examen termine',
        exam: {
          id: prescriptionExam.id,
          code: prescriptionExam.exam.code,
          name: prescriptionExam.exam.name,
          status: prescriptionExam.status,
          performedAt: prescriptionExam.performedAt
        },
        prescriptionCompleted: allCompleted
      });
    } catch (error) {
      logger.error('Complete exam error:', error);
      res.status(500).json({ error: 'Erreur lors de la fin de l\'examen' });
    }
  },

  /**
   * Obtenir les examens en cours/termines par l'utilisateur
   * GET /api/services/my-exams
   */
  getMyExams: async (req, res) => {
    try {
      const { status, page = 1, limit = 50 } = req.query;
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
        exams: rows.map(pe => ({
          id: pe.id,
          examCode: pe.exam.code,
          examName: pe.exam.name,
          patientNumber: pe.prescription.patient.patientNumber,
          patientName: `${pe.prescription.patient.lastName} ${pe.prescription.patient.firstName}`,
          prescriptionNumber: pe.prescription.prescriptionNumber,
          status: pe.status,
          performedAt: pe.performedAt
        })),
        pagination: {
          total: count,
          page: parseInt(page),
          pages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      logger.error('Get my exams error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation des examens' });
    }
  },

  /**
   * Obtenir les examens en cours (IN_PROGRESS)
   * GET /api/services/in-progress
   */
  getInProgressExams: async (req, res) => {
    try {
      const userCategory = req.user.role === 'RADIOLOGIST' ? 'RADIOLOGY' : 'LABORATORY';

      const exams = await PrescriptionExam.findAll({
        where: {
          status: 'IN_PROGRESS',
          performedBy: req.user.id
        },
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
        order: [['updatedAt', 'ASC']]
      });

      res.json({
        exams: exams.map(pe => ({
          id: pe.id,
          examCode: pe.exam.code,
          examName: pe.exam.name,
          patientNumber: pe.prescription.patient.patientNumber,
          patientName: `${pe.prescription.patient.lastName} ${pe.prescription.patient.firstName}`,
          prescriptionNumber: pe.prescription.prescriptionNumber,
          status: pe.status
        }))
      });
    } catch (error) {
      logger.error('Get in-progress exams error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation des examens' });
    }
  }
};

module.exports = serviceController;
