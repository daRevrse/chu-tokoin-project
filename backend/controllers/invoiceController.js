const { Op } = require('sequelize');
const { Invoice, InvoiceLine, Payment, Patient, Visit, Prescription, User, Specialty } = require('../models');
const { validationResult } = require('express-validator');
const { cancelInvoice } = require('../services/invoiceService');
const { getBusinessDate, isBusinessDate } = require('../utils/businessDate');
const logger = require('../utils/logger');

// Factures qui attendent encore de l'argent.
const OPEN_STATUSES = ['ISSUED', 'PARTIALLY_PAID'];

const patientInclude = {
  model: Patient,
  as: 'patient',
  attributes: ['id', 'patientNumber', 'firstName', 'lastName', 'phone']
};

const visitInclude = {
  model: Visit,
  as: 'visit',
  attributes: ['id', 'ticketNumber', 'visitDate', 'status', 'priority', 'visitType'],
  include: [{ model: Specialty, as: 'specialty', attributes: ['id', 'code', 'name', 'color'] }]
};

const invoiceController = {
  /**
   * Lister les factures
   * GET /api/invoices?status=ISSUED,PARTIALLY_PAID&type=CONSULTATION&date=YYYY-MM-DD&deferred=true
   *
   * Sans filtre de statut, seules les factures encore dues remontent : c'est la
   * question que se pose la caisse toute la journee. L'historique complet
   * s'obtient avec status=all.
   */
  getAll: async (req, res) => {
    try {
      const {
        status,
        type,
        date,
        patientId,
        visitId,
        prescriptionId,
        deferred,
        page = 1,
        limit = 50
      } = req.query;

      const offset = (page - 1) * limit;
      const where = {};

      if (status === 'all') {
        // Aucun filtre de statut
      } else if (status) {
        where.status = {
          [Op.in]: String(status).split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
        };
      } else {
        where.status = { [Op.in]: OPEN_STATUSES };
      }

      if (type) where.invoiceType = String(type).toUpperCase();
      if (patientId) where.patientId = patientId;
      if (visitId) where.visitId = visitId;
      if (prescriptionId) where.prescriptionId = prescriptionId;
      if (deferred === 'true') where.isDeferred = true;

      if (date) {
        if (!isBusinessDate(date)) {
          return res.status(400).json({ error: 'Date invalide (format attendu YYYY-MM-DD)' });
        }
        const start = new Date(`${date}T00:00:00.000Z`);
        const end = new Date(`${date}T23:59:59.999Z`);
        where.createdAt = { [Op.between]: [start, end] };
      }

      const { count, rows } = await Invoice.findAndCountAll({
        where,
        include: [
          patientInclude,
          visitInclude,
          { model: InvoiceLine, as: 'lines' },
          { model: Prescription, as: 'prescription', attributes: ['id', 'prescriptionNumber', 'status'] }
        ],
        // `findAndCountAll` avec une association hasMany compte les lignes
        // jointes et non les factures : sans `distinct`, la pagination annonce
        // trois fois plus de factures qu'il n'y en a.
        distinct: true,
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10)
      });

      res.json({
        invoices: rows,
        pagination: {
          total: count,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          pages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      logger.error('Get invoices error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation des factures' });
    }
  },

  /**
   * Detail d'une facture
   * GET /api/invoices/:id
   */
  getById: async (req, res) => {
    try {
      const invoice = await Invoice.findByPk(req.params.id, {
        include: [
          patientInclude,
          visitInclude,
          { model: InvoiceLine, as: 'lines' },
          { model: Prescription, as: 'prescription', attributes: ['id', 'prescriptionNumber', 'status'] },
          { model: User, as: 'issuer', attributes: ['id', 'firstName', 'lastName'] },
          {
            model: Payment,
            as: 'payments',
            include: [{ model: User, as: 'cashier', attributes: ['id', 'firstName', 'lastName'] }]
          }
        ]
      });

      if (!invoice) {
        return res.status(404).json({ error: 'Facture non trouvee' });
      }

      res.json({
        invoice,
        balance: invoice.getBalance()
      });
    } catch (error) {
      logger.error('Get invoice error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation de la facture' });
    }
  },

  /**
   * Factures de consultation a encaisser aujourd'hui
   * GET /api/invoices/consultations/today
   *
   * C'est la file de travail de la caisse cote consultations : les patients qui
   * viennent d'etre enregistres a l'accueil et qui attendent devant le guichet.
   */
  getTodayConsultations: async (req, res) => {
    try {
      const visitDate = req.query.date || getBusinessDate();

      if (!isBusinessDate(visitDate)) {
        return res.status(400).json({ error: 'Date invalide (format attendu YYYY-MM-DD)' });
      }

      const invoices = await Invoice.findAll({
        where: {
          invoiceType: 'CONSULTATION',
          status: { [Op.in]: OPEN_STATUSES }
        },
        include: [
          patientInclude,
          { model: InvoiceLine, as: 'lines' },
          {
            // Jointure interne volontaire : la date de la file est celle du
            // passage, pas celle de la facture. Les deux coincident aujourd'hui
            // mais divergeraient sur un passage ouvert avant minuit.
            ...visitInclude,
            required: true,
            where: { visitDate }
          }
        ],
        order: [
          // Les creances a regulariser en tete : ce sont des patients deja
          // soignes, qu'il ne faut pas laisser repartir sans passer en caisse.
          ['isDeferred', 'DESC'],
          ['createdAt', 'ASC']
        ]
      });

      res.json({
        date: visitDate,
        count: invoices.length,
        totalDue: invoices.reduce((sum, i) => sum + i.getBalance(), 0),
        invoices
      });
    } catch (error) {
      logger.error('Get today consultations error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation des consultations a encaisser' });
    }
  },

  /**
   * Annuler une facture
   * PATCH /api/invoices/:id/cancel
   *
   * Sert notamment a accorder une gratuite : le motif reste attache a la
   * facture, ce qui vaut mieux qu'une creance qu'on laisse dormir.
   */
  cancel: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const invoice = await cancelInvoice(req.params.id, {
        reason: req.body.cancelReason,
        userId: req.user.id
      });

      logger.info('Facture annulee', {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        reason: req.body.cancelReason,
        by: req.user.id
      });

      res.json({ message: 'Facture annulee', invoice });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }

      logger.error('Cancel invoice error:', error);
      res.status(500).json({ error: 'Erreur lors de l\'annulation de la facture' });
    }
  }
};

module.exports = invoiceController;
