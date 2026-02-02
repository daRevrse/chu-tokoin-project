const { Patient, Prescription, PrescriptionExam, Exam, Result, User } = require('../models');
const { generatePatientToken } = require('../middleware/patientAuth');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');

const portalController = {
  /**
   * Generer un lien d'acces temporaire pour un patient
   * POST /api/portal/generate-access
   * (Accessible uniquement par le personnel medical)
   */
  generateAccess: async (req, res) => {
    try {
      const { patientId, expiresInHours = 24 } = req.body;

      if (!patientId) {
        return res.status(400).json({ error: 'ID du patient requis' });
      }

      // Verifier que le patient existe
      const patient = await Patient.findByPk(patientId);
      if (!patient) {
        return res.status(404).json({ error: 'Patient non trouve' });
      }

      // Generer le token
      const token = generatePatientToken(patientId, expiresInHours);

      // Construire l'URL d'acces
      const portalUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/portal?token=${token}`;

      logger.info('Acces portail genere', {
        patientId,
        generatedBy: req.user.id,
        expiresInHours
      });

      res.json({
        message: 'Lien d\'acces genere',
        token,
        portalUrl,
        expiresIn: `${expiresInHours} heures`,
        patient: {
          id: patient.id,
          firstName: patient.firstName,
          lastName: patient.lastName
        }
      });
    } catch (error) {
      logger.error('Generate access error:', error);
      res.status(500).json({ error: 'Erreur lors de la generation de l\'acces' });
    }
  },

  /**
   * Obtenir les informations du patient connecte au portail
   * GET /api/portal/me
   */
  getMyInfo: async (req, res) => {
    try {
      const patient = req.patient;

      res.json({
        patient: {
          id: patient.id,
          firstName: patient.firstName,
          lastName: patient.lastName,
          matricule: patient.matricule,
          dateOfBirth: patient.dateOfBirth,
          gender: patient.gender
        }
      });
    } catch (error) {
      logger.error('Get portal info error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation des informations' });
    }
  },

  /**
   * Obtenir les resultats valides du patient
   * GET /api/portal/results
   */
  getMyResults: async (req, res) => {
    try {
      const patientId = req.patient.id;

      const prescriptions = await Prescription.findAll({
        where: { patientId },
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
                model: Result,
                as: 'results',
                where: { isValidated: true }, // Seuls les resultats valides
                required: true,
                include: [
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

      // Formater les resultats
      const results = [];
      prescriptions.forEach(prescription => {
        prescription.prescriptionExams.forEach(pe => {
          pe.results.forEach(result => {
            results.push({
              id: result.id,
              examName: pe.exam.name,
              examCode: pe.exam.code,
              examCategory: pe.exam.category,
              prescriptionDate: prescription.createdAt,
              doctor: {
                name: `Dr. ${prescription.doctor.firstName} ${prescription.doctor.lastName}`,
                role: prescription.doctor.role
              },
              fileName: result.fileName,
              fileType: result.fileType,
              uploadDate: result.uploadDate,
              conclusion: result.conclusion,
              validatedAt: result.validatedAt,
              validatedBy: result.validator ?
                `Dr. ${result.validator.firstName} ${result.validator.lastName}` : null
            });
          });
        });
      });

      res.json({
        results,
        total: results.length
      });
    } catch (error) {
      logger.error('Get portal results error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation des resultats' });
    }
  },

  /**
   * Telecharger un resultat (portail patient)
   * GET /api/portal/results/:id/download
   */
  downloadResult: async (req, res) => {
    try {
      const { id } = req.params;
      const patientId = req.patient.id;

      // Verifier que le resultat appartient au patient et est valide
      const result = await Result.findByPk(id, {
        include: [
          {
            model: PrescriptionExam,
            as: 'prescriptionExam',
            include: [
              {
                model: Prescription,
                as: 'prescription',
                where: { patientId }
              }
            ]
          }
        ]
      });

      if (!result || !result.prescriptionExam || !result.prescriptionExam.prescription) {
        return res.status(404).json({ error: 'Resultat non trouve' });
      }

      if (!result.isValidated) {
        return res.status(403).json({ error: 'Ce resultat n\'est pas encore valide' });
      }

      // Verifier que le fichier existe
      if (!fs.existsSync(result.filePath)) {
        return res.status(404).json({ error: 'Fichier non trouve sur le serveur' });
      }

      logger.info('Telechargement portail patient', {
        resultId: id,
        patientId
      });

      res.download(result.filePath, result.fileName);
    } catch (error) {
      logger.error('Portal download error:', error);
      res.status(500).json({ error: 'Erreur lors du telechargement' });
    }
  },

  /**
   * Obtenir l'historique des prescriptions du patient
   * GET /api/portal/prescriptions
   */
  getMyPrescriptions: async (req, res) => {
    try {
      const patientId = req.patient.id;

      const prescriptions = await Prescription.findAll({
        where: { patientId },
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
                model: Result,
                as: 'results',
                where: { isValidated: true },
                required: false,
                attributes: ['id', 'fileName', 'fileType', 'uploadDate', 'isValidated']
              }
            ]
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      const formattedPrescriptions = prescriptions.map(p => ({
        id: p.id,
        date: p.createdAt,
        status: p.status,
        doctor: {
          name: `Dr. ${p.doctor.firstName} ${p.doctor.lastName}`,
          role: p.doctor.role
        },
        exams: p.prescriptionExams.map(pe => ({
          id: pe.id,
          name: pe.exam.name,
          code: pe.exam.code,
          category: pe.exam.category,
          status: pe.status,
          hasValidatedResults: pe.results && pe.results.length > 0
        })),
        totalAmount: p.totalAmount,
        priority: p.priority
      }));

      res.json({
        prescriptions: formattedPrescriptions,
        total: formattedPrescriptions.length
      });
    } catch (error) {
      logger.error('Get portal prescriptions error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation des prescriptions' });
    }
  }
};

module.exports = portalController;
