const { PrescriptionExam, Exam, User, Payment, Prescription, Patient, Result } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const logger = require('../utils/logger');

const statsController = {
  /**
   * Statistiques pour un medecin
   * GET /api/stats/doctor
   */
  getDoctorStats: async (req, res) => {
    try {
      const doctorId = req.user.id;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());

      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      // Prescriptions today
      const prescriptionsToday = await Prescription.count({
        where: {
          doctorId,
          createdAt: { [Op.gte]: today }
        }
      });

      // Distinct patients today
      const patientsToday = await Prescription.count({
        where: {
          doctorId,
          createdAt: { [Op.gte]: today }
        },
        distinct: true,
        col: 'patientId'
      });

      // Pending prescriptions
      const pendingPrescriptions = await Prescription.count({
        where: {
          doctorId,
          status: 'PENDING'
        }
      });

      // In progress prescriptions (awaiting exam results)
      const inProgressPrescriptions = await Prescription.count({
        where: {
          doctorId,
          status: { [Op.in]: ['PAID', 'IN_PROGRESS'] }
        }
      });

      // Total prescriptions
      const totalPrescriptions = await Prescription.count({
        where: { doctorId }
      });

      // Distinct patients total
      const distinctPatients = await Prescription.count({
        where: { doctorId },
        distinct: true,
        col: 'patientId'
      });

      // Completed this week
      const completedThisWeek = await Prescription.count({
        where: {
          doctorId,
          status: 'COMPLETED',
          updatedAt: { [Op.gte]: startOfWeek }
        }
      });

      // Completed this month
      const completedThisMonth = await Prescription.count({
        where: {
          doctorId,
          status: 'COMPLETED',
          updatedAt: { [Op.gte]: startOfMonth }
        }
      });

      // Results awaiting validation by this doctor
      const newResultsCount = await Result.count({
        where: { isValidated: false },
        include: [{
          model: PrescriptionExam,
          as: 'prescriptionExam',
          attributes: [],
          required: true,
          include: [{
            model: Prescription,
            as: 'prescription',
            attributes: [],
            required: true,
            where: { doctorId }
          }]
        }]
      });

      res.json({
        today: {
          prescriptions: prescriptionsToday,
          patients: patientsToday
        },
        pending: {
          prescriptions: pendingPrescriptions,
          awaitingResults: inProgressPrescriptions
        },
        totals: {
          prescriptions: totalPrescriptions,
          patients: distinctPatients,
          completedThisWeek,
          completedThisMonth
        },
        newResultsCount
      });
    } catch (error) {
      logger.error('Get doctor stats error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation des statistiques' });
    }
  },

  /**
   * Statistiques pour un service (radiologie ou labo)
   * GET /api/stats/service
   */
  getServiceStats: async (req, res) => {
    try {
      const userCategory = req.user.role === 'RADIOLOGIST' ? 'RADIOLOGY' : 'LABORATORY';

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Examens en attente (PAID)
      const pendingCount = await PrescriptionExam.count({
        where: { status: 'PAID' },
        include: [{
          model: Exam,
          as: 'exam',
          where: { category: userCategory },
          attributes: []
        }]
      });

      // Examens en cours (IN_PROGRESS)
      const inProgressCount = await PrescriptionExam.count({
        where: { status: 'IN_PROGRESS' },
        include: [{
          model: Exam,
          as: 'exam',
          where: { category: userCategory },
          attributes: []
        }]
      });

      // Mes examens termines aujourd'hui
      const myCompletedToday = await PrescriptionExam.count({
        where: {
          performedBy: req.user.id,
          status: 'COMPLETED',
          performedAt: { [Op.gte]: today }
        }
      });

      // Total termines aujourd'hui pour le service
      const totalCompletedToday = await PrescriptionExam.count({
        where: {
          status: 'COMPLETED',
          performedAt: { [Op.gte]: today }
        },
        include: [{
          model: Exam,
          as: 'exam',
          where: { category: userCategory },
          attributes: []
        }]
      });

      // Top 5 examens les plus demandes
      const topExams = await PrescriptionExam.findAll({
        attributes: [
          'examId',
          [sequelize.fn('COUNT', sequelize.col('PrescriptionExam.id')), 'count']
        ],
        include: [{
          model: Exam,
          as: 'exam',
          where: { category: userCategory },
          attributes: ['code', 'name']
        }],
        group: ['examId', 'exam.id'],
        order: [[sequelize.fn('COUNT', sequelize.col('PrescriptionExam.id')), 'DESC']],
        limit: 5
      });

      res.json({
        summary: {
          pending: pendingCount,
          inProgress: inProgressCount,
          myCompletedToday,
          totalCompletedToday
        },
        topExams: topExams.map(e => ({
          code: e.exam.code,
          name: e.exam.name,
          count: parseInt(e.dataValues.count)
        })),
        category: userCategory
      });
    } catch (error) {
      logger.error('Get service stats error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation des statistiques' });
    }
  },

  /**
   * Statistiques globales (admin)
   * GET /api/stats/global
   */
  getGlobalStats: async (req, res) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Prescriptions aujourd'hui
      const prescriptionsToday = await Prescription.count({
        where: { createdAt: { [Op.gte]: today } }
      });

      // Total prescriptions
      const totalPrescriptions = await Prescription.count();

      // Paiements aujourd'hui
      const paymentsToday = await Payment.count({
        where: {
          paymentDate: { [Op.gte]: today },
          paymentStatus: 'SUCCESS'
        }
      });

      // Montant total aujourd'hui
      const amountToday = await Payment.sum('amount', {
        where: {
          paymentDate: { [Op.gte]: today },
          paymentStatus: 'SUCCESS'
        }
      });

      // Montant total global
      const totalAmount = await Payment.sum('amount', {
        where: { paymentStatus: 'SUCCESS' }
      });

      // Examens termines aujourd'hui
      const examsCompletedToday = await PrescriptionExam.count({
        where: {
          performedAt: { [Op.gte]: today },
          status: 'COMPLETED'
        }
      });

      // Total patients
      const totalPatients = await Patient.count();

      // Patients enregistres aujourd'hui
      const patientsToday = await Patient.count({
        where: { createdAt: { [Op.gte]: today } }
      });

      // Prescriptions par statut
      const prescriptionsByStatus = await Prescription.findAll({
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['status']
      });

      // Examens par categorie aujourd'hui
      const examsByCategory = await PrescriptionExam.findAll({
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('PrescriptionExam.id')), 'count']
        ],
        include: [{
          model: Exam,
          as: 'exam',
          attributes: ['category']
        }],
        where: { createdAt: { [Op.gte]: today } },
        group: ['exam.category']
      });

      res.json({
        today: {
          prescriptions: prescriptionsToday,
          payments: paymentsToday,
          amount: amountToday || 0,
          examsCompleted: examsCompletedToday,
          newPatients: patientsToday
        },
        totals: {
          prescriptions: totalPrescriptions,
          patients: totalPatients,
          revenue: totalAmount || 0
        },
        prescriptionsByStatus: prescriptionsByStatus.map(p => ({
          status: p.status,
          count: parseInt(p.dataValues.count)
        })),
        examsByCategory: examsByCategory.map(e => ({
          category: e.exam.category,
          count: parseInt(e.dataValues.count)
        }))
      });
    } catch (error) {
      logger.error('Get global stats error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation des statistiques' });
    }
  }
};

module.exports = statsController;
