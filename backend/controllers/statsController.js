const { PrescriptionExam, Exam, User, Payment, Prescription, Patient, Result, Visit, EmergencyCase } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { getBusinessDate } = require('../utils/businessDate');
const { getExamScope, getScopeLabel } = require('../utils/serviceScope');
const { SERVICE_ROLES } = require('../utils/roles');
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

      // Patients en salle d'attente : alimente le badge de l'onglet file
      // d'attente. La file est commune a tous les medecins, ce compte n'est
      // donc pas filtre sur `doctorId`.
      const waitingCount = await Visit.count({
        where: { visitDate: getBusinessDate(), status: 'WAITING' }
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
        waitingCount,
        newResultsCount
      });
    } catch (error) {
      logger.error('Get doctor stats error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation des statistiques' });
    }
  },

  /**
   * Statistiques de l'accueil pour la journee
   * GET /api/stats/reception
   */
  getReceptionStats: async (req, res) => {
    try {
      const visitDate = getBusinessDate();

      const [byStatus, urgentWaiting, avgWaitRow] = await Promise.all([
        Visit.findAll({
          where: { visitDate },
          attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
          group: ['status'],
          raw: true
        }),
        Visit.count({
          where: { visitDate, status: 'WAITING', priority: 'URGENT' }
        }),
        // Delai moyen d'attente en minutes, sur les passages du jour deja pris
        // en charge. Les passages encore en attente sont exclus : leur delai
        // n'est pas fige.
        Visit.findAll({
          where: { visitDate, startedAt: { [Op.ne]: null } },
          attributes: [
            [sequelize.fn('AVG', sequelize.literal('TIMESTAMPDIFF(MINUTE, `createdAt`, `startedAt`)')), 'avgWaitMinutes']
          ],
          raw: true
        })
      ]);

      const counts = byStatus.reduce((acc, row) => {
        acc[row.status] = Number(row.count);
        return acc;
      }, {});

      const avgWaitMinutes = avgWaitRow[0] && avgWaitRow[0].avgWaitMinutes !== null
        ? Math.round(Number(avgWaitRow[0].avgWaitMinutes))
        : null;

      res.json({
        date: visitDate,
        total: Object.values(counts).reduce((sum, n) => sum + n, 0),
        waiting: counts.WAITING || 0,
        inConsult: counts.IN_CONSULT || 0,
        completed: counts.COMPLETED || 0,
        cancelled: counts.CANCELLED || 0,
        urgentWaiting,
        avgWaitMinutes
      });
    } catch (error) {
      logger.error('Get reception stats error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation des statistiques' });
    }
  },

  /**
   * Compteurs d'activite en attente, par espace
   * GET /api/stats/badges
   *
   * Alimente les pastilles du menu lateral. Un seul appel, filtre par role :
   * le menu n'a pas a savoir quelles statistiques interrogent quel espace, et
   * un utilisateur ne recoit que les compteurs des espaces qu'il peut ouvrir.
   *
   * Ne compte que ce qui appelle une action de l'utilisateur : un chiffre qui
   * ne redescend jamais serait ignore au bout de deux jours.
   */
  getBadges: async (req, res) => {
    try {
      const { role } = req.user;
      const isAdmin = role === 'ADMIN';
      const badges = {};

      if (role === 'RECEPTIONIST' || isAdmin) {
        badges.reception = await Visit.count({
          where: { visitDate: getBusinessDate(), status: 'WAITING' }
        });
      }

      if (['NURSE', 'DOCTOR'].includes(role) || isAdmin) {
        // Dossiers encore dans le service, toutes dates d'arrivee confondues :
        // un patient arrive avant minuit est toujours la apres.
        badges.emergency = await EmergencyCase.count({
          where: { status: { [Op.in]: ['AWAITING_TRIAGE', 'WAITING', 'IN_CARE'] } }
        });
      }

      if (role === 'DOCTOR' || isAdmin) {
        // Patients en salle d'attente + resultats en attente de validation.
        // Les deux demandent une action du medecin, la pastille les cumule.
        const [waiting, toValidate] = await Promise.all([
          Visit.count({ where: { visitDate: getBusinessDate(), status: 'WAITING' } }),
          Result.count({
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
                // Un ADMIN n'a pas de prescriptions propres : il voit le total.
                ...(isAdmin ? {} : { where: { doctorId: req.user.id } })
              }]
            }]
          })
        ]);
        badges.doctor = waiting + toValidate;
      }

      if (role === 'CASHIER' || isAdmin) {
        badges.cashier = await Prescription.count({ where: { status: 'PENDING' } });
      }

      if (SERVICE_ROLES.includes(role) || isAdmin) {
        badges.service = await PrescriptionExam.count({
          where: { status: 'PAID' },
          include: [{
            model: Exam,
            as: 'exam',
            // Un ADMIN n'etant affecte a aucun service, son perimetre est ouvert.
            where: isAdmin ? {} : getExamScope(req.user),
            attributes: []
          }]
        });
      }

      res.json({ badges });
    } catch (error) {
      logger.error('Get badges error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation des compteurs' });
    }
  },

  /**
   * Statistiques pour un service (radiologie ou labo)
   * GET /api/stats/service
   */
  getServiceStats: async (req, res) => {
    try {
      // Le perimetre vient du service d'affectation ; la categorie historique
      // n'est utilisee qu'en repli pour les comptes sans service. Le ternaire
      // precedent classait tout non-RADIOLOGIST en laboratoire, ce qui donnait
      // des chiffres faux a un TECHNICIAN de cardiologie ou de prelevement.
      const examScope = getExamScope(req.user);
      const scopeLabel = await getScopeLabel(req.user);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Examens en attente (PAID)
      const pendingCount = await PrescriptionExam.count({
        where: { status: 'PAID' },
        include: [{
          model: Exam,
          as: 'exam',
          where: examScope,
          attributes: []
        }]
      });

      // Examens en cours (IN_PROGRESS)
      const inProgressCount = await PrescriptionExam.count({
        where: { status: 'IN_PROGRESS' },
        include: [{
          model: Exam,
          as: 'exam',
          where: examScope,
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
          where: examScope,
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
          where: examScope,
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
        // Libelle du perimetre couvert par ces chiffres : nom du service
        // d'affectation, ou categorie historique pour un compte non migre.
        scope: scopeLabel
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
