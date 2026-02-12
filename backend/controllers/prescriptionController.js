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
      const { status, page = 1, limit = 50, startDate, endDate, patientSearch } = req.query;
      const offset = (page - 1) * limit;

      const where = { doctorId: req.user.id };

      if (status) {
        where.status = status;
      }

      if (startDate) {
        where.createdAt = { ...(where.createdAt || {}), [Op.gte]: new Date(startDate) };
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt = { ...(where.createdAt || {}), [Op.lte]: end };
      }

      const patientWhere = {};
      if (patientSearch) {
        patientWhere[Op.or] = [
          { firstName: { [Op.like]: `%${patientSearch}%` } },
          { lastName: { [Op.like]: `%${patientSearch}%` } },
          { patientNumber: { [Op.like]: `%${patientSearch}%` } }
        ];
      }

      const { count, rows } = await Prescription.findAndCountAll({
        where,
        include: [
          { model: Patient, as: 'patient', where: patientSearch ? patientWhere : undefined },
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
  },

  /**
   * Exporter une prescription en PDF
   * GET /api/prescriptions/:id/pdf
   */
  exportPDF: async (req, res) => {
    try {
      const PDFDocument = require('pdfkit');

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
            include: [{ model: Exam, as: 'exam' }]
          }
        ]
      });

      if (!prescription) {
        return res.status(404).json({ error: 'Prescription non trouvee' });
      }

      const doc = new PDFDocument({ size: 'A4', margin: 50 });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=prescription-${prescription.prescriptionNumber}.pdf`);

      doc.pipe(res);

      // Header
      doc.fontSize(20).font('Helvetica-Bold').text('CHU TOKOIN', { align: 'center' });
      doc.fontSize(10).font('Helvetica').text('Centre Hospitalier Universitaire de Tokoin - Lome, Togo', { align: 'center' });
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(1);

      // Title
      doc.fontSize(16).font('Helvetica-Bold').text('PRESCRIPTION MEDICALE', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').text(`N° ${prescription.prescriptionNumber}`, { align: 'center' });
      doc.moveDown(1);

      // Date
      const date = new Date(prescription.createdAt);
      const dateStr = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
      doc.fontSize(10).text(`Date: ${dateStr}`, { align: 'right' });
      doc.moveDown(1);

      // Patient Info
      doc.fontSize(12).font('Helvetica-Bold').text('Patient');
      doc.fontSize(10).font('Helvetica');
      doc.text(`Nom: ${prescription.patient.lastName} ${prescription.patient.firstName}`);
      doc.text(`N° Patient: ${prescription.patient.patientNumber}`);
      doc.text(`Sexe: ${prescription.patient.gender === 'M' ? 'Homme' : 'Femme'}`);
      if (prescription.patient.dateOfBirth) {
        const dob = new Date(prescription.patient.dateOfBirth);
        doc.text(`Date de naissance: ${dob.toLocaleDateString('fr-FR')}`);
      }
      if (prescription.patient.phone) {
        doc.text(`Telephone: ${prescription.patient.phone}`);
      }
      doc.moveDown(1);

      // Medecin
      doc.fontSize(12).font('Helvetica-Bold').text('Medecin prescripteur');
      doc.fontSize(10).font('Helvetica');
      doc.text(`Dr. ${prescription.doctor.lastName} ${prescription.doctor.firstName}`);
      doc.moveDown(1);

      // Examens table
      doc.fontSize(12).font('Helvetica-Bold').text('Examens prescrits');
      doc.moveDown(0.5);

      // Table header
      const tableTop = doc.y;
      const col1 = 50;
      const col2 = 130;
      const col3 = 360;
      const col4 = 460;

      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Code', col1, tableTop);
      doc.text('Examen', col2, tableTop);
      doc.text('Categorie', col3, tableTop);
      doc.text('Prix (FCFA)', col4, tableTop);

      doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();

      let y = tableTop + 22;
      doc.font('Helvetica').fontSize(9);

      prescription.prescriptionExams.forEach((pe) => {
        if (y > 700) {
          doc.addPage();
          y = 50;
        }
        doc.text(pe.exam.code, col1, y);
        doc.text(pe.exam.name, col2, y, { width: 220 });
        doc.text(pe.exam.category === 'RADIOLOGY' ? 'Radiologie' : 'Laboratoire', col3, y);
        doc.text(new Intl.NumberFormat('fr-FR').format(pe.price), col4, y);
        y += 18;
      });

      // Total
      doc.moveTo(50, y).lineTo(545, y).stroke();
      y += 8;
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text('TOTAL:', col3, y);
      doc.text(new Intl.NumberFormat('fr-FR').format(prescription.totalAmount) + ' FCFA', col4, y);

      // Notes
      if (prescription.notes) {
        y += 30;
        doc.fontSize(12).font('Helvetica-Bold').text('Notes', 50, y);
        y += 15;
        doc.fontSize(10).font('Helvetica').text(prescription.notes, 50, y, { width: 495 });
      }

      // Footer
      doc.fontSize(8).font('Helvetica')
        .text(
          `Document genere le ${new Date().toLocaleDateString('fr-FR')} a ${new Date().toLocaleTimeString('fr-FR')}`,
          50, 750,
          { align: 'center' }
        );

      doc.end();
    } catch (error) {
      logger.error('Export prescription PDF error:', error);
      res.status(500).json({ error: 'Erreur lors de la generation du PDF' });
    }
  }
};

module.exports = prescriptionController;
