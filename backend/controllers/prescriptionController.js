const { Prescription, PrescriptionExam, Patient, Exam, User, Payment } = require('../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

const prescriptionController = {
  /**
   * Creer une nouvelle prescription
   * POST /api/prescriptions
   */
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
        return res.status(404).json({
          error: 'Patient non trouve'
        });
      }

      // Recuperer les examens et calculer le total
      const exams = await Exam.findAll({
        where: {
          id: { [Op.in]: examIds },
          isActive: true
        }
      });

      if (exams.length === 0) {
        return res.status(400).json({
          error: 'Aucun examen valide selectionne'
        });
      }

      if (exams.length !== examIds.length) {
        return res.status(400).json({
          error: 'Un ou plusieurs examens sont invalides ou inactifs'
        });
      }

      // Calculer le montant total
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
        price: exam.price,
        quantity: 1
      }));

      await PrescriptionExam.bulkCreate(prescriptionExams);

      // Recuperer la prescription complete avec les relations
      const fullPrescription = await Prescription.findByPk(prescription.id, {
        include: [
          { model: Patient, as: 'patient' },
          {
            model: User,
            as: 'doctor',
            attributes: ['id', 'firstName', 'lastName', 'email']
          },
          {
            model: PrescriptionExam,
            as: 'prescriptionExams',
            include: [{ model: Exam, as: 'exam' }]
          }
        ]
      });

      logger.info('Prescription creee', {
        prescriptionId: prescription.id,
        prescriptionNumber: prescription.prescriptionNumber,
        doctorId: req.user.id
      });

      res.status(201).json({
        message: 'Prescription creee avec succes',
        prescription: fullPrescription
      });
    } catch (error) {
      logger.error('Create prescription error:', error);
      res.status(500).json({
        error: 'Erreur lors de la creation de la prescription'
      });
    }
  },

  /**
   * Lister les prescriptions
   * GET /api/prescriptions
   */
  getAll: async (req, res) => {
    try {
      const { status, patientId, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const where = {};

      if (status) {
        where.status = status;
      }

      if (patientId) {
        where.patientId = patientId;
      }

      // Si c'est un medecin, ne montrer que ses prescriptions
      if (req.user.role === 'DOCTOR') {
        where.doctorId = req.user.id;
      }

      const { count, rows } = await Prescription.findAndCountAll({
        where,
        include: [
          { model: Patient, as: 'patient' },
          {
            model: User,
            as: 'doctor',
            attributes: ['id', 'firstName', 'lastName']
          },
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
          pages: Math.ceil(count / limit),
          limit: parseInt(limit)
        }
      });
    } catch (error) {
      logger.error('Get prescriptions error:', error);
      res.status(500).json({
        error: 'Erreur lors de la recuperation des prescriptions'
      });
    }
  },

  /**
   * Obtenir une prescription par ID
   * GET /api/prescriptions/:id
   */
  getById: async (req, res) => {
    try {
      const prescription = await Prescription.findByPk(req.params.id, {
        include: [
          { model: Patient, as: 'patient' },
          {
            model: User,
            as: 'doctor',
            attributes: ['id', 'firstName', 'lastName', 'email']
          },
          {
            model: PrescriptionExam,
            as: 'prescriptionExams',
            include: [
              { model: Exam, as: 'exam' },
              {
                model: User,
                as: 'performer',
                attributes: ['id', 'firstName', 'lastName']
              }
            ]
          },
          {
            model: Payment,
            as: 'payments',
            include: [{
              model: User,
              as: 'cashier',
              attributes: ['id', 'firstName', 'lastName']
            }]
          }
        ]
      });

      if (!prescription) {
        return res.status(404).json({
          error: 'Prescription non trouvee'
        });
      }

      res.json({ prescription });
    } catch (error) {
      logger.error('Get prescription error:', error);
      res.status(500).json({
        error: 'Erreur lors de la recuperation de la prescription'
      });
    }
  },

  /**
   * Obtenir une prescription par numero
   * GET /api/prescriptions/number/:number
   */
  getByNumber: async (req, res) => {
    try {
      const prescription = await Prescription.findOne({
        where: { prescriptionNumber: req.params.number },
        include: [
          { model: Patient, as: 'patient' },
          {
            model: User,
            as: 'doctor',
            attributes: ['id', 'firstName', 'lastName']
          },
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

      res.json({ prescription });
    } catch (error) {
      logger.error('Get prescription by number error:', error);
      res.status(500).json({
        error: 'Erreur lors de la recuperation de la prescription'
      });
    }
  },

  /**
   * Annuler une prescription
   * PATCH /api/prescriptions/:id/cancel
   */
  cancel: async (req, res) => {
    try {
      const prescription = await Prescription.findByPk(req.params.id);

      if (!prescription) {
        return res.status(404).json({
          error: 'Prescription non trouvee'
        });
      }

      if (prescription.status !== 'PENDING') {
        return res.status(400).json({
          error: 'Seules les prescriptions en attente peuvent etre annulees'
        });
      }

      // Verifier que c'est le medecin qui a cree la prescription ou un admin
      if (req.user.role !== 'ADMIN' && prescription.doctorId !== req.user.id) {
        return res.status(403).json({
          error: 'Vous ne pouvez annuler que vos propres prescriptions'
        });
      }

      prescription.status = 'CANCELLED';
      await prescription.save();

      // Annuler aussi les examens associes
      await PrescriptionExam.update(
        { status: 'PENDING' },
        { where: { prescriptionId: prescription.id } }
      );

      logger.info('Prescription annulee', { prescriptionId: prescription.id });

      res.json({
        message: 'Prescription annulee',
        prescription
      });
    } catch (error) {
      logger.error('Cancel prescription error:', error);
      res.status(500).json({
        error: 'Erreur lors de l\'annulation'
      });
    }
  },

  /**
   * Obtenir les prescriptions du medecin connecte
   * GET /api/prescriptions/my-prescriptions
   */
  getMyPrescriptions: async (req, res) => {
    try {
      const { status, page = 1, limit = 50 } = req.query;
      const offset = (page - 1) * limit;

      const where = { doctorId: req.user.id };

      if (status) {
        where.status = status;
      }

      const { count, rows } = await Prescription.findAndCountAll({
        where,
        include: [
          { model: Patient, as: 'patient' },
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
      logger.error('Get my prescriptions error:', error);
      res.status(500).json({
        error: 'Erreur lors de la recuperation des prescriptions'
      });
    }
  },

  /**
   * Obtenir les prescriptions en attente de paiement
   * GET /api/prescriptions/pending
   */
  getPending: async (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const { count, rows } = await Prescription.findAndCountAll({
        where: { status: 'PENDING' },
        include: [
          { model: Patient, as: 'patient' },
          {
            model: User,
            as: 'doctor',
            attributes: ['id', 'firstName', 'lastName']
          },
          {
            model: PrescriptionExam,
            as: 'prescriptionExams',
            include: [{ model: Exam, as: 'exam' }]
          }
        ],
        order: [['createdAt', 'ASC']],
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
      logger.error('Get pending prescriptions error:', error);
      res.status(500).json({
        error: 'Erreur lors de la recuperation des prescriptions'
      });
    }
  }
};

module.exports = prescriptionController;
