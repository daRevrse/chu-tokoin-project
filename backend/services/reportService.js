const { Payment, Prescription, PrescriptionExam, Exam, User, Patient } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const logger = require('../utils/logger');

const reportService = {
  /**
   * Rapport financier journalier
   */
  getDailyFinancialReport: async (date) => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const payments = await Payment.findAll({
      where: {
        paymentDate: { [Op.between]: [startOfDay, endOfDay] },
        paymentStatus: 'SUCCESS'
      },
      include: [
        { model: User, as: 'cashier', attributes: ['id', 'firstName', 'lastName'] },
        {
          model: Prescription,
          as: 'prescription',
          include: [{ model: Patient, as: 'patient', attributes: ['id', 'firstName', 'lastName', 'patientNumber'] }]
        }
      ],
      order: [['paymentDate', 'ASC']]
    });

    // Agregations
    const totalAmount = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

    const byPaymentMethod = payments.reduce((acc, p) => {
      const method = p.paymentMethod || 'CASH';
      acc[method] = (acc[method] || 0) + parseFloat(p.amount || 0);
      return acc;
    }, {});

    const byCashier = payments.reduce((acc, p) => {
      if (p.cashier) {
        const name = `${p.cashier.lastName} ${p.cashier.firstName}`;
        acc[name] = (acc[name] || 0) + parseFloat(p.amount || 0);
      }
      return acc;
    }, {});

    return {
      date: date.toISOString().split('T')[0],
      totalPayments: payments.length,
      totalAmount,
      byPaymentMethod,
      byCashier,
      payments: payments.map(p => ({
        paymentNumber: p.paymentNumber,
        prescriptionNumber: p.prescription?.prescriptionNumber,
        patientName: p.prescription?.patient
          ? `${p.prescription.patient.lastName} ${p.prescription.patient.firstName}`
          : 'N/A',
        patientNumber: p.prescription?.patient?.patientNumber,
        amount: parseFloat(p.amount || 0),
        paymentMethod: p.paymentMethod,
        cashier: p.cashier ? `${p.cashier.lastName} ${p.cashier.firstName}` : 'N/A',
        time: p.paymentDate
      }))
    };
  },

  /**
   * Rapport financier par periode
   */
  getPeriodFinancialReport: async (startDate, endDate) => {
    const payments = await Payment.findAll({
      where: {
        paymentDate: { [Op.between]: [startDate, endDate] },
        paymentStatus: 'SUCCESS'
      },
      include: [
        { model: User, as: 'cashier', attributes: ['id', 'firstName', 'lastName'] }
      ],
      order: [['paymentDate', 'ASC']]
    });

    const totalAmount = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

    // Regrouper par jour
    const byDay = {};
    payments.forEach(p => {
      const day = new Date(p.paymentDate).toISOString().split('T')[0];
      if (!byDay[day]) {
        byDay[day] = { count: 0, amount: 0 };
      }
      byDay[day].count++;
      byDay[day].amount += parseFloat(p.amount || 0);
    });

    const byPaymentMethod = payments.reduce((acc, p) => {
      const method = p.paymentMethod || 'CASH';
      acc[method] = (acc[method] || 0) + parseFloat(p.amount || 0);
      return acc;
    }, {});

    return {
      period: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      },
      totalPayments: payments.length,
      totalAmount,
      byDay,
      byPaymentMethod
    };
  },

  /**
   * Rapport d'activite par service (Radiologie ou Laboratoire)
   */
  getServiceActivityReport: async (category, startDate, endDate) => {
    const exams = await PrescriptionExam.findAll({
      where: {
        status: 'COMPLETED',
        performedAt: { [Op.between]: [startDate, endDate] }
      },
      include: [
        {
          model: Exam,
          as: 'exam',
          where: { category },
          attributes: ['id', 'name', 'code', 'category']
        },
        { model: User, as: 'performer', attributes: ['id', 'firstName', 'lastName'] }
      ]
    });

    // Par type d'examen
    const byExamType = {};
    exams.forEach(e => {
      if (e.exam) {
        const name = e.exam.name;
        if (!byExamType[name]) {
          byExamType[name] = { count: 0, revenue: 0, code: e.exam.code };
        }
        byExamType[name].count++;
        byExamType[name].revenue += parseFloat(e.price || 0);
      }
    });

    // Par technicien
    const byTechnician = {};
    exams.forEach(e => {
      if (e.performer) {
        const name = `${e.performer.lastName} ${e.performer.firstName}`;
        if (!byTechnician[name]) {
          byTechnician[name] = { count: 0 };
        }
        byTechnician[name].count++;
      }
    });

    const totalRevenue = exams.reduce((sum, e) => sum + parseFloat(e.price || 0), 0);

    return {
      category,
      categoryLabel: category === 'RADIOLOGY' ? 'Radiologie' : 'Laboratoire',
      period: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      },
      totalExams: exams.length,
      totalRevenue,
      byExamType: Object.entries(byExamType).map(([name, data]) => ({
        name,
        ...data
      })),
      byTechnician: Object.entries(byTechnician).map(([name, data]) => ({
        name,
        ...data
      }))
    };
  },

  /**
   * Statistiques globales pour le dashboard
   */
  getGlobalStats: async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayPrescriptions, todayPayments, todayExams, totalPatients, pendingExams] = await Promise.all([
      Prescription.count({ where: { createdAt: { [Op.gte]: today } } }),
      Payment.findAll({
        where: { paymentDate: { [Op.gte]: today }, paymentStatus: 'SUCCESS' },
        attributes: ['amount']
      }),
      PrescriptionExam.count({ where: { performedAt: { [Op.gte]: today }, status: 'COMPLETED' } }),
      Patient.count(),
      PrescriptionExam.count({ where: { status: { [Op.in]: ['PAID', 'IN_PROGRESS'] } } })
    ]);

    const todayAmount = todayPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

    // Statistiques du mois
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthPayments = await Payment.findAll({
      where: { paymentDate: { [Op.gte]: firstDayOfMonth }, paymentStatus: 'SUCCESS' },
      attributes: ['amount']
    });
    const monthAmount = monthPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

    return {
      today: {
        prescriptions: todayPrescriptions,
        payments: todayPayments.length,
        amount: todayAmount,
        examsCompleted: todayExams
      },
      month: {
        payments: monthPayments.length,
        amount: monthAmount
      },
      totals: {
        patients: totalPatients,
        pendingExams
      }
    };
  },

  /**
   * Generer un rapport Excel (retourne les donnees formatees)
   */
  generateExcelData: async (data, reportType) => {
    if (reportType === 'financial') {
      return {
        headers: ['N Paiement', 'N Prescription', 'Patient', 'Montant (FCFA)', 'Methode', 'Caissier', 'Heure'],
        rows: data.payments.map(p => [
          p.paymentNumber,
          p.prescriptionNumber,
          p.patientName,
          p.amount,
          p.paymentMethod,
          p.cashier,
          new Date(p.time).toLocaleTimeString('fr-FR')
        ]),
        summary: {
          totalPayments: data.totalPayments,
          totalAmount: data.totalAmount
        }
      };
    } else if (reportType === 'activity') {
      return {
        headers: ['Examen', 'Code', 'Nombre', 'Recettes (FCFA)'],
        rows: data.byExamType.map(e => [
          e.name,
          e.code,
          e.count,
          e.revenue
        ]),
        summary: {
          totalExams: data.totalExams,
          totalRevenue: data.totalRevenue
        }
      };
    }
    return null;
  }
};

module.exports = reportService;
