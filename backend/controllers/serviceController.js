const { Op } = require('sequelize');
const { Payment, Prescription, PrescriptionExam, Patient, Exam, User, ServiceStep, ExamStepProgress } = require('../models');
const qrcodeService = require('../services/qrcodeService');
const logger = require('../utils/logger');
const { getExamScope, getScopeLabel, isExamInScope, initExamSteps } = require('../utils/serviceScope');

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

      // Filtrer les examens relevant du service de l'utilisateur
      const relevantExams = payment.prescription.prescriptionExams.filter(
        pe => isExamInScope(req.user, pe.exam)
      );

      if (relevantExams.length === 0) {
        const label = await getScopeLabel(req.user);
        return res.status(404).json({
          error: `Aucun examen de ${label} pour ce patient`
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

      const { count, rows } = await PrescriptionExam.findAndCountAll({
        where: { status: 'PAID' },
        include: [
          {
            model: Exam,
            as: 'exam',
            where: getExamScope(req.user)
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

      // Verifier que l'examen releve bien du service de l'utilisateur
      if (!isExamInScope(req.user, prescriptionExam.exam)) {
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

      // Derouler le circuit configure pour le service (prelevement, analyse,
      // validation...). Sans etape configuree, l'examen suit le circuit court.
      const steps = await initExamSteps(
        prescriptionExam,
        prescriptionExam.exam.serviceId || req.user.serviceId
      );

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
        stepsCount: steps.length,
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

      // Cloturer les etapes encore ouvertes : terminer l'examen directement
      // ne doit pas laisser d'etapes en suspens dans le suivi.
      await ExamStepProgress.update(
        {
          status: 'COMPLETED',
          completedAt: new Date(),
          performedBy: req.user.id
        },
        {
          where: {
            prescriptionExamId: prescriptionExam.id,
            status: ['PENDING', 'IN_PROGRESS']
          }
        }
      );

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
      const exams = await PrescriptionExam.findAll({
        where: {
          status: 'IN_PROGRESS',
          performedBy: req.user.id
        },
        include: [
          {
            model: Exam,
            as: 'exam',
            where: getExamScope(req.user)
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
  },

  /**
   * Circuit de realisation d'un examen et avancement etape par etape
   * GET /api/services/exams/:id/steps
   */
  getExamSteps: async (req, res) => {
    try {
      const prescriptionExam = await PrescriptionExam.findByPk(req.params.id, {
        include: [{ model: Exam, as: 'exam' }]
      });

      if (!prescriptionExam) {
        return res.status(404).json({ error: 'Examen non trouve' });
      }

      if (req.user.role !== 'ADMIN' && !isExamInScope(req.user, prescriptionExam.exam)) {
        return res.status(403).json({ error: 'Cet examen ne releve pas de votre service' });
      }

      const progress = await ExamStepProgress.findAll({
        where: { prescriptionExamId: prescriptionExam.id },
        include: [
          { model: ServiceStep, as: 'step' },
          { model: User, as: 'performer', attributes: ['id', 'firstName', 'lastName'] }
        ],
        order: [['stepOrder', 'ASC']]
      });

      res.json({
        examStatus: prescriptionExam.status,
        steps: progress.map(p => ({
          id: p.id,
          code: p.step?.code,
          name: p.step?.name,
          order: p.stepOrder,
          status: p.status,
          isRequired: p.step?.isRequired ?? true,
          producesResult: p.step?.producesResult ?? false,
          startedAt: p.startedAt,
          completedAt: p.completedAt,
          notes: p.notes,
          performedBy: p.performer
            ? `${p.performer.firstName} ${p.performer.lastName}`
            : null
        }))
      });
    } catch (error) {
      logger.error('Get exam steps error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation des etapes' });
    }
  },

  /**
   * Terminer une etape et passer a la suivante
   * PATCH /api/services/exams/:id/steps/:progressId
   *
   * Terminer l'etape marquee `producesResult` acheve l'examen : c'est la
   * derniere du circuit configure pour le service.
   */
  completeStep: async (req, res) => {
    try {
      const { id, progressId } = req.params;
      const { notes, skip } = req.body || {};

      const prescriptionExam = await PrescriptionExam.findByPk(id, {
        include: [
          { model: Exam, as: 'exam' },
          { model: Prescription, as: 'prescription' }
        ]
      });

      if (!prescriptionExam) {
        return res.status(404).json({ error: 'Examen non trouve' });
      }

      if (req.user.role !== 'ADMIN' && !isExamInScope(req.user, prescriptionExam.exam)) {
        return res.status(403).json({ error: 'Cet examen ne releve pas de votre service' });
      }

      const current = await ExamStepProgress.findOne({
        where: { id: progressId, prescriptionExamId: id },
        include: [{ model: ServiceStep, as: 'step' }]
      });

      if (!current) {
        return res.status(404).json({ error: 'Etape non trouvee pour cet examen' });
      }

      if (current.status === 'COMPLETED' || current.status === 'SKIPPED') {
        return res.status(400).json({ error: 'Cette etape est deja cloturee' });
      }

      // Une etape obligatoire ne peut pas etre ignoree
      if (skip && current.step?.isRequired) {
        return res.status(400).json({ error: 'Cette etape est obligatoire et ne peut pas etre ignoree' });
      }

      // Les etapes precedentes doivent etre cloturees : le circuit est sequentiel
      const anterieuresOuvertes = await ExamStepProgress.count({
        where: {
          prescriptionExamId: id,
          stepOrder: { [Op.lt]: current.stepOrder },
          status: ['PENDING', 'IN_PROGRESS']
        }
      });
      if (anterieuresOuvertes > 0) {
        return res.status(400).json({
          error: 'Une etape precedente n\'est pas terminee'
        });
      }

      current.status = skip ? 'SKIPPED' : 'COMPLETED';
      current.completedAt = new Date();
      current.performedBy = req.user.id;
      if (notes) current.notes = notes;
      if (!current.startedAt) current.startedAt = new Date();
      await current.save();

      // Ouvrir l'etape suivante, s'il en reste
      const next = await ExamStepProgress.findOne({
        where: {
          prescriptionExamId: id,
          stepOrder: { [Op.gt]: current.stepOrder },
          status: 'PENDING'
        },
        order: [['stepOrder', 'ASC']]
      });

      if (next) {
        next.status = 'IN_PROGRESS';
        next.startedAt = new Date();
        await next.save();
      }

      // L'etape produisant le resultat cloture l'examen
      let examCompleted = false;
      if (current.step?.producesResult && !skip) {
        prescriptionExam.status = 'COMPLETED';
        prescriptionExam.performedAt = new Date();
        await prescriptionExam.save();
        examCompleted = true;

        const allExams = await PrescriptionExam.findAll({
          where: { prescriptionId: prescriptionExam.prescriptionId }
        });
        if (allExams.every(e => e.status === 'COMPLETED')) {
          await prescriptionExam.prescription.update({ status: 'COMPLETED' });
        }
      }

      logger.info('Etape d\'examen cloturee', {
        examId: id,
        step: current.step?.code,
        skipped: Boolean(skip),
        userId: req.user.id
      });

      res.json({
        message: skip ? 'Etape ignoree' : 'Etape terminee',
        examCompleted,
        nextStep: next ? { id: next.id, order: next.stepOrder } : null
      });
    } catch (error) {
      logger.error('Complete step error:', error);
      res.status(500).json({ error: 'Erreur lors de la cloture de l\'etape' });
    }
  }
};

module.exports = serviceController;
