const { Patient, Prescription, PrescriptionExam, Exam, Result, User, Payment } = require('../models');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

const patientRecordController = {
  /**
   * Obtenir le dossier complet d'un patient
   * GET /api/patient-records/:patientId
   */
  getPatientRecord: async (req, res) => {
    try {
      const { patientId } = req.params;

      const patient = await Patient.findByPk(patientId, {
        include: [
          {
            model: Prescription,
            as: 'prescriptions',
            include: [
              {
                model: User,
                as: 'doctor',
                attributes: ['id', 'firstName', 'lastName', 'role']
              },
              {
                model: PrescriptionExam,
                as: 'prescriptionExams',
                include: [
                  {
                    model: Exam,
                    as: 'exam',
                    attributes: ['id', 'name', 'code', 'category']
                  },
                  {
                    model: User,
                    as: 'performer',
                    attributes: ['id', 'firstName', 'lastName']
                  },
                  {
                    model: Result,
                    as: 'results',
                    include: [
                      {
                        model: User,
                        as: 'uploader',
                        attributes: ['id', 'firstName', 'lastName']
                      },
                      {
                        model: User,
                        as: 'validator',
                        attributes: ['id', 'firstName', 'lastName']
                      }
                    ]
                  }
                ]
              },
              {
                model: Payment,
                as: 'payments',
                include: [
                  {
                    model: User,
                    as: 'cashier',
                    attributes: ['id', 'firstName', 'lastName']
                  }
                ]
              }
            ],
            order: [['createdAt', 'DESC']]
          }
        ]
      });

      if (!patient) {
        return res.status(404).json({ error: 'Patient non trouve' });
      }

      res.json({ patient });
    } catch (error) {
      logger.error('Get patient record error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation du dossier' });
    }
  },

  /**
   * Obtenir l'historique des examens d'un patient
   * GET /api/patient-records/:patientId/exams
   */
  getPatientExamHistory: async (req, res) => {
    try {
      const { patientId } = req.params;
      const { category, status, startDate, endDate } = req.query;

      // Verifier que le patient existe
      const patient = await Patient.findByPk(patientId);
      if (!patient) {
        return res.status(404).json({ error: 'Patient non trouve' });
      }

      // Construire les conditions de filtre
      const examWhere = {};
      if (category) {
        examWhere.category = category;
      }

      const prescriptionExamWhere = {};
      if (status) {
        prescriptionExamWhere.status = status;
      }

      const prescriptionWhere = { patientId };
      if (startDate || endDate) {
        prescriptionWhere.createdAt = {};
        if (startDate) {
          prescriptionWhere.createdAt[Op.gte] = new Date(startDate);
        }
        if (endDate) {
          prescriptionWhere.createdAt[Op.lte] = new Date(endDate);
        }
      }

      const prescriptions = await Prescription.findAll({
        where: prescriptionWhere,
        include: [
          {
            model: User,
            as: 'doctor',
            attributes: ['id', 'firstName', 'lastName', 'role']
          },
          {
            model: PrescriptionExam,
            as: 'prescriptionExams',
            where: Object.keys(prescriptionExamWhere).length > 0 ? prescriptionExamWhere : undefined,
            required: false,
            include: [
              {
                model: Exam,
                as: 'exam',
                where: Object.keys(examWhere).length > 0 ? examWhere : undefined,
                attributes: ['id', 'name', 'code', 'category']
              },
              {
                model: Result,
                as: 'results',
                include: [
                  {
                    model: User,
                    as: 'uploader',
                    attributes: ['id', 'firstName', 'lastName']
                  }
                ]
              }
            ]
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      // Aplatir les resultats pour avoir une liste d'examens
      const exams = [];
      prescriptions.forEach(prescription => {
        prescription.prescriptionExams.forEach(pe => {
          exams.push({
            id: pe.id,
            prescriptionId: prescription.id,
            prescriptionDate: prescription.createdAt,
            doctor: prescription.doctor,
            exam: pe.exam,
            status: pe.status,
            price: pe.price,
            performedAt: pe.performedAt,
            results: pe.results,
            hasResults: pe.results && pe.results.length > 0,
            hasValidatedResults: pe.results && pe.results.some(r => r.isValidated)
          });
        });
      });

      res.json({
        patient: {
          id: patient.id,
          firstName: patient.firstName,
          lastName: patient.lastName,
          patientNumber: patient.patientNumber
        },
        exams,
        total: exams.length
      });
    } catch (error) {
      logger.error('Get patient exam history error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation de l\'historique' });
    }
  },

  /**
   * Obtenir les resultats valides d'un patient
   * GET /api/patient-records/:patientId/results
   */
  getPatientResults: async (req, res) => {
    try {
      const { patientId } = req.params;
      const { validatedOnly } = req.query;

      const patient = await Patient.findByPk(patientId);
      if (!patient) {
        return res.status(404).json({ error: 'Patient non trouve' });
      }

      const resultWhere = {};
      if (validatedOnly === 'true') {
        resultWhere.isValidated = true;
      }

      const prescriptions = await Prescription.findAll({
        where: { patientId },
        include: [
          {
            model: PrescriptionExam,
            as: 'prescriptionExams',
            include: [
              {
                model: Exam,
                as: 'exam',
                attributes: ['id', 'name', 'code', 'category']
              },
              {
                model: Result,
                as: 'results',
                where: Object.keys(resultWhere).length > 0 ? resultWhere : undefined,
                required: true,
                include: [
                  {
                    model: User,
                    as: 'uploader',
                    attributes: ['id', 'firstName', 'lastName']
                  },
                  {
                    model: User,
                    as: 'validator',
                    attributes: ['id', 'firstName', 'lastName']
                  }
                ]
              }
            ]
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      // Aplatir les resultats
      const results = [];
      prescriptions.forEach(prescription => {
        prescription.prescriptionExams.forEach(pe => {
          pe.results.forEach(result => {
            results.push({
              id: result.id,
              prescriptionExamId: pe.id,
              exam: pe.exam,
              fileName: result.fileName,
              fileType: result.fileType,
              uploadDate: result.uploadDate,
              uploader: result.uploader,
              comments: result.comments,
              conclusion: result.conclusion,
              isValidated: result.isValidated,
              validatedBy: result.validator,
              validatedAt: result.validatedAt
            });
          });
        });
      });

      res.json({
        patient: {
          id: patient.id,
          firstName: patient.firstName,
          lastName: patient.lastName,
          patientNumber: patient.patientNumber
        },
        results,
        total: results.length
      });
    } catch (error) {
      logger.error('Get patient results error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation des resultats' });
    }
  },

  /**
   * Rechercher des patients
   * GET /api/patient-records/search
   */
  searchPatients: async (req, res) => {
    try {
      const { q, limit = 20 } = req.query;

      if (!q || q.length < 2) {
        return res.status(400).json({ error: 'Le terme de recherche doit contenir au moins 2 caracteres' });
      }

      const patients = await Patient.findAll({
        where: {
          [Op.or]: [
            { firstName: { [Op.like]: `%${q}%` } },
            { lastName: { [Op.like]: `%${q}%` } },
            { patientNumber: { [Op.like]: `%${q}%` } },
            { phone: { [Op.like]: `%${q}%` } }
          ]
        },
        attributes: ['id', 'firstName', 'lastName', 'patientNumber', 'dateOfBirth', 'phone'],
        limit: parseInt(limit),
        order: [['lastName', 'ASC'], ['firstName', 'ASC']]
      });

      res.json({ patients });
    } catch (error) {
      logger.error('Search patients error:', error);
      res.status(500).json({ error: 'Erreur lors de la recherche' });
    }
  }
};

module.exports = patientRecordController;
