const express = require('express');
const router = express.Router();
const sequelize = require('../config/database');
const os = require('os');
const { Op } = require('sequelize');

/**
 * Health check endpoint
 * GET /api/health
 */
router.get('/', async (req, res) => {
  console.log('Health route accessed - using new healthRoutes');
  const health = {
    status: 'OK',
    source: 'healthRoutes',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(os.totalmem() / 1024 / 1024),
      free: Math.round(os.freemem() / 1024 / 1024)
    },
    cpu: os.loadavg(),
    services: {}
  };

  // Check database
  try {
    await sequelize.authenticate();
    health.services.database = { status: 'OK' };
  } catch (error) {
    health.services.database = { status: 'ERROR', message: error.message };
    health.status = 'DEGRADED';
  }

  const statusCode = health.status === 'OK' ? 200 : 503;
  res.status(statusCode).json(health);
});

/**
 * Metriques pour monitoring
 * GET /api/health/metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const { Payment, Prescription, PrescriptionExam, Patient } = require('../models');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      todayPrescriptions,
      todayPayments,
      todayExamsCompleted,
      monthPrescriptions,
      pendingExams,
      inProgressExams,
      totalPatients
    ] = await Promise.all([
      Prescription.count({ where: { createdAt: { [Op.gte]: today } } }),
      Payment.findAll({
        where: { paymentDate: { [Op.gte]: today }, paymentStatus: 'SUCCESS' },
        attributes: ['amount']
      }),
      PrescriptionExam.count({
        where: { performedAt: { [Op.gte]: today }, status: 'COMPLETED' }
      }),
      Prescription.count({ where: { createdAt: { [Op.gte]: firstDayOfMonth } } }),
      PrescriptionExam.count({ where: { status: 'PAID' } }),
      PrescriptionExam.count({ where: { status: 'IN_PROGRESS' } }),
      Patient.count()
    ]);

    const todayRevenue = todayPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

    const metrics = {
      timestamp: new Date().toISOString(),
      today: {
        prescriptions: todayPrescriptions,
        payments: todayPayments.length,
        revenue: todayRevenue,
        examsCompleted: todayExamsCompleted
      },
      month: {
        prescriptions: monthPrescriptions
      },
      queue: {
        pendingExams,
        inProgressExams
      },
      totals: {
        patients: totalPatients
      },
      system: {
        uptime: process.uptime(),
        memoryUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        cpuLoad: os.loadavg()[0]
      }
    };

    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la recuperation des metriques' });
  }
});

/**
 * Readiness check
 * GET /api/health/ready
 */
router.get('/ready', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ ready: true });
  } catch (error) {
    res.status(503).json({ ready: false, error: error.message });
  }
});

/**
 * Liveness check
 * GET /api/health/live
 */
router.get('/live', (req, res) => {
  res.json({ alive: true, timestamp: new Date().toISOString() });
});

module.exports = router;
