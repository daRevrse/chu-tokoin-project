const { sequelize, Visit, Patient, User, Prescription, PrescriptionExam, Exam } = require('../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const { reserveTicketNumber } = require('../services/ticketService');
const { getReadiness } = require('../services/resultReadinessService');
const { getBusinessDate, isBusinessDate } = require('../utils/businessDate');
const logger = require('../utils/logger');

// Champs de constantes acceptes a la creation comme a la mise a jour
const VITALS_FIELDS = [
  'weightKg',
  'heightCm',
  'temperatureC',
  'bloodPressureSys',
  'bloodPressureDia',
  'pulseBpm'
];

// Statuts consideres comme "passage encore ouvert"
const OPEN_STATUSES = ['WAITING', 'IN_CONSULT'];

// Les urgences remontent en tete de file, le reste suit l'ordre d'arrivee.
const QUEUE_ORDER = [
  [sequelize.literal("CASE WHEN `Visit`.`priority` = 'URGENT' THEN 0 ELSE 1 END"), 'ASC'],
  ['ticketNumber', 'ASC']
];

const patientInclude = {
  model: Patient,
  as: 'patient',
  attributes: ['id', 'patientNumber', 'firstName', 'lastName', 'dateOfBirth', 'gender', 'phone']
};

const staffAttributes = ['id', 'firstName', 'lastName', 'role'];

// Prescription dont le patient vient chercher les resultats. Volontairement
// reduite au strict necessaire : la file n'a besoin que du numero, le detail
// se recupere via /visits/tracking/:prescriptionNumber.
const reviewedPrescriptionInclude = {
  model: Prescription,
  as: 'reviewedPrescription',
  attributes: ['id', 'prescriptionNumber', 'status', 'prescriptionDate']
};

const pickVitals = (body) => VITALS_FIELDS.reduce((acc, field) => {
  if (body[field] !== undefined && body[field] !== '') {
    acc[field] = body[field];
  }
  return acc;
}, {});

const visitController = {
  /**
   * Ouvrir un passage pour un patient existant
   * POST /api/visits
   */
  create: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        patientId,
        reason,
        priority = 'NORMAL',
        notes,
        force,
        visitType = 'CONSULTATION',
        reviewedPrescriptionId
      } = req.body;

      const patient = await Patient.findByPk(patientId);
      if (!patient) {
        return res.status(404).json({ error: 'Patient non trouve' });
      }

      // Retour du patient pour ses resultats : la prescription doit exister,
      // lui appartenir, et etre entierement validee. L'accueil ne remet pas un
      // ticket pour des resultats que le medecin n'a pas encore interpretes.
      if (visitType === 'RESULT_REVIEW') {
        if (!reviewedPrescriptionId) {
          return res.status(400).json({
            error: 'Un retour resultats doit designer une prescription'
          });
        }

        const tracking = await getReadiness({ id: reviewedPrescriptionId });

        if (!tracking) {
          return res.status(404).json({ error: 'Prescription non trouvee' });
        }

        if (tracking.patient.id !== patientId) {
          return res.status(400).json({
            error: 'Cette prescription concerne un autre patient'
          });
        }

        if (!tracking.readiness.ready) {
          return res.status(409).json({
            error: 'Les resultats de cette prescription ne sont pas tous valides',
            readiness: tracking.readiness
          });
        }
      }

      const visitDate = getBusinessDate();

      // Un patient deja en file ne doit pas prendre un second ticket par
      // inadvertance. `force` laisse le choix a l'accueil si le cas est reel
      // (retour dans la journee pour un autre motif).
      if (!force) {
        const openVisit = await Visit.findOne({
          where: { patientId, visitDate, status: { [Op.in]: OPEN_STATUSES } }
        });

        if (openVisit) {
          return res.status(409).json({
            error: 'Ce patient a deja un passage en cours aujourd\'hui',
            visit: openVisit,
            hint: 'Renvoyer force=true pour ouvrir un second passage'
          });
        }
      }

      // Le numero est reserve hors transaction metier : en cas d'echec de la
      // creation, il est perdu plutot que reattribue (voir ticketService).
      const ticketNumber = await reserveTicketNumber(visitDate);

      const visit = await Visit.create({
        patientId,
        ticketNumber,
        visitDate,
        priority,
        reason,
        notes,
        visitType,
        reviewedPrescriptionId: visitType === 'RESULT_REVIEW' ? reviewedPrescriptionId : null,
        registeredBy: req.user.id,
        ...pickVitals(req.body)
      });

      const fullVisit = await Visit.findByPk(visit.id, {
        include: [
          patientInclude,
          { model: User, as: 'receptionist', attributes: staffAttributes },
          reviewedPrescriptionInclude,
        ]
      });

      logger.info('Passage ouvert', {
        visitId: visit.id,
        ticketNumber,
        visitDate,
        patientNumber: patient.patientNumber,
        registeredBy: req.user.id
      });

      res.status(201).json({
        message: 'Passage ouvert avec succes',
        visit: fullVisit
      });
    } catch (error) {
      logger.error('Create visit error:', error);
      res.status(500).json({ error: 'Erreur lors de l\'ouverture du passage' });
    }
  },

  /**
   * Suivi d'une prescription par son numero, pour l'accueil
   * GET /api/visits/tracking/:prescriptionNumber
   *
   * Le patient repart de la caisse avec son numero de prescription ; c'est ce
   * numero qu'il presente en revenant. Aucun code supplementaire n'est emis :
   * deux identifiants a presenter au guichet, ce sont des erreurs de saisie.
   */
  getTracking: async (req, res) => {
    try {
      const prescriptionNumber = String(req.params.prescriptionNumber || '').trim().toUpperCase();

      if (!prescriptionNumber) {
        return res.status(400).json({ error: 'Numero de prescription requis' });
      }

      const tracking = await getReadiness({ prescriptionNumber });

      if (!tracking) {
        return res.status(404).json({
          error: `Aucune prescription ne porte le numero ${prescriptionNumber}`
        });
      }

      // Un passage de retour deja ouvert aujourd'hui : l'accueil doit le voir
      // pour ne pas remettre un second ticket au meme patient.
      const activeVisit = await Visit.findOne({
        where: {
          reviewedPrescriptionId: tracking.prescription.id,
          visitDate: getBusinessDate(),
          status: { [Op.in]: OPEN_STATUSES }
        }
      });

      res.json({ ...tracking, activeVisit });
    } catch (error) {
      logger.error('Get tracking error:', error);
      res.status(500).json({ error: 'Erreur lors de la recherche de la prescription' });
    }
  },

  /**
   * File d'attente d'une journee
   * GET /api/visits/queue?date=YYYY-MM-DD&status=WAITING&priority=URGENT
   */
  getQueue: async (req, res) => {
    try {
      const { date, status, priority } = req.query;

      if (date && !isBusinessDate(date)) {
        return res.status(400).json({ error: 'Date invalide (format attendu YYYY-MM-DD)' });
      }

      const statuses = status
        ? String(status).split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
        : OPEN_STATUSES;

      const where = {
        visitDate: date || getBusinessDate(),
        status: { [Op.in]: statuses }
      };

      if (priority) {
        where.priority = String(priority).toUpperCase();
      }

      const visits = await Visit.findAll({
        where,
        include: [
          patientInclude,
          { model: User, as: 'doctor', attributes: staffAttributes },
          { model: User, as: 'receptionist', attributes: staffAttributes },
          reviewedPrescriptionInclude,
        ],
        order: QUEUE_ORDER
      });

      res.json({
        date: where.visitDate,
        count: visits.length,
        visits
      });
    } catch (error) {
      logger.error('Get queue error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation de la file d\'attente' });
    }
  },

  /**
   * Retrouver le passage du jour par son numero de ticket
   * GET /api/visits/today/:ticketNumber
   *
   * La recherche est implicitement limitee a la date du jour : les numeros
   * etant remis a zero chaque matin, un numero seul ne designe rien.
   */
  getByTicket: async (req, res) => {
    try {
      const ticketNumber = Number(req.params.ticketNumber);

      if (!Number.isInteger(ticketNumber) || ticketNumber < 1) {
        return res.status(400).json({ error: 'Numero de ticket invalide' });
      }

      const visitDate = getBusinessDate();

      const visit = await Visit.findOne({
        where: { visitDate, ticketNumber },
        include: [
          patientInclude,
          { model: User, as: 'doctor', attributes: staffAttributes },
          { model: User, as: 'receptionist', attributes: staffAttributes },
          reviewedPrescriptionInclude,
        ]
      });

      if (!visit) {
        return res.status(404).json({
          error: `Aucun passage ne porte le numero ${ticketNumber} aujourd'hui`
        });
      }

      res.json({ visit });
    } catch (error) {
      logger.error('Get visit by ticket error:', error);
      res.status(500).json({ error: 'Erreur lors de la recherche du passage' });
    }
  },

  /**
   * Detail d'un passage
   * GET /api/visits/:id
   */
  getById: async (req, res) => {
    try {
      const visit = await Visit.findByPk(req.params.id, {
        include: [
          { model: Patient, as: 'patient' },
          { model: User, as: 'doctor', attributes: staffAttributes },
          { model: User, as: 'receptionist', attributes: staffAttributes },
          reviewedPrescriptionInclude,
          {
            model: Prescription,
            as: 'prescriptions',
            include: [{
              model: PrescriptionExam,
              as: 'prescriptionExams',
              include: [{ model: Exam, as: 'exam', attributes: ['id', 'code', 'name', 'price'] }]
            }]
          }
        ]
      });

      if (!visit) {
        return res.status(404).json({ error: 'Passage non trouve' });
      }

      res.json({ visit });
    } catch (error) {
      logger.error('Get visit error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation du passage' });
    }
  },

  /**
   * Prendre en charge un passage (medecin)
   * PATCH /api/visits/:id/take
   */
  take: async (req, res) => {
    try {
      const visit = await Visit.findByPk(req.params.id);

      if (!visit) {
        return res.status(404).json({ error: 'Passage non trouve' });
      }

      // La condition `status: WAITING` fait partie du UPDATE : si deux medecins
      // cliquent sur le meme ticket, un seul voit une ligne modifiee.
      const [affected] = await Visit.update(
        {
          status: 'IN_CONSULT',
          doctorId: req.user.id,
          startedAt: new Date()
        },
        { where: { id: visit.id, status: 'WAITING' } }
      );

      if (affected === 0) {
        const current = await Visit.findByPk(visit.id, {
          include: [{ model: User, as: 'doctor', attributes: staffAttributes }]
        });

        return res.status(409).json({
          error: current.status === 'IN_CONSULT'
            ? 'Ce patient est deja pris en charge par un autre medecin'
            : `Ce passage n'est plus en attente (statut : ${current.status})`,
          visit: current
        });
      }

      const fullVisit = await Visit.findByPk(visit.id, {
        include: [
          { model: Patient, as: 'patient' },
          { model: User, as: 'doctor', attributes: staffAttributes },
          reviewedPrescriptionInclude
        ]
      });

      logger.info('Passage pris en charge', {
        visitId: visit.id,
        ticketNumber: visit.ticketNumber,
        doctorId: req.user.id
      });

      res.json({ message: 'Patient pris en charge', visit: fullVisit });
    } catch (error) {
      logger.error('Take visit error:', error);
      res.status(500).json({ error: 'Erreur lors de la prise en charge' });
    }
  },

  /**
   * Cloturer la consultation
   * PATCH /api/visits/:id/complete
   */
  complete: async (req, res) => {
    try {
      const visit = await Visit.findByPk(req.params.id);

      if (!visit) {
        return res.status(404).json({ error: 'Passage non trouve' });
      }

      if (visit.status !== 'IN_CONSULT') {
        return res.status(409).json({
          error: `Seul un passage en consultation peut etre cloture (statut : ${visit.status})`
        });
      }

      // Un medecin ne cloture pas la consultation d'un confrere ; l'admin peut.
      if (visit.doctorId !== req.user.id && req.user.role !== 'ADMIN') {
        return res.status(403).json({
          error: 'Ce passage est pris en charge par un autre medecin'
        });
      }

      // La cloture est souvent envoyee sans corps de requete : `req.body` est
      // alors indefini, aucun parser n'ayant traite la requete.
      const { notes } = req.body || {};

      await visit.update({
        status: 'COMPLETED',
        completedAt: new Date(),
        notes: notes !== undefined ? notes : visit.notes
      });

      logger.info('Consultation cloturee', {
        visitId: visit.id,
        ticketNumber: visit.ticketNumber,
        doctorId: req.user.id
      });

      res.json({ message: 'Consultation cloturee', visit });
    } catch (error) {
      logger.error('Complete visit error:', error);
      res.status(500).json({ error: 'Erreur lors de la cloture de la consultation' });
    }
  },

  /**
   * Annuler un passage (patient reparti sans consulter)
   * PATCH /api/visits/:id/cancel
   */
  cancel: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const visit = await Visit.findByPk(req.params.id);

      if (!visit) {
        return res.status(404).json({ error: 'Passage non trouve' });
      }

      if (!OPEN_STATUSES.includes(visit.status)) {
        return res.status(409).json({
          error: `Ce passage ne peut plus etre annule (statut : ${visit.status})`
        });
      }

      // Le numero du passage annule n'est jamais reattribue : un trou dans la
      // sequence vaut mieux que deux patients portant le meme numero.
      await visit.update({
        status: 'CANCELLED',
        cancelReason: req.body.cancelReason
      });

      logger.info('Passage annule', {
        visitId: visit.id,
        ticketNumber: visit.ticketNumber,
        cancelledBy: req.user.id
      });

      res.json({ message: 'Passage annule', visit });
    } catch (error) {
      logger.error('Cancel visit error:', error);
      res.status(500).json({ error: 'Erreur lors de l\'annulation du passage' });
    }
  },

  /**
   * Mettre a jour les constantes relevees a l'accueil
   * PATCH /api/visits/:id/vitals
   */
  updateVitals: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const visit = await Visit.findByPk(req.params.id);

      if (!visit) {
        return res.status(404).json({ error: 'Passage non trouve' });
      }

      // Une fois la consultation commencee, les constantes font partie du
      // dossier consulte par le medecin : elles ne bougent plus.
      if (visit.status !== 'WAITING') {
        return res.status(409).json({
          error: `Les constantes ne sont modifiables qu'avant la consultation (statut : ${visit.status})`
        });
      }

      const body = req.body || {};
      const vitals = pickVitals(body);

      if (Object.keys(vitals).length === 0 && body.reason === undefined) {
        return res.status(400).json({ error: 'Aucune donnee a mettre a jour' });
      }

      if (body.reason !== undefined) {
        vitals.reason = body.reason;
      }

      await visit.update(vitals);

      res.json({ message: 'Constantes mises a jour', visit });
    } catch (error) {
      logger.error('Update vitals error:', error);
      res.status(500).json({ error: 'Erreur lors de la mise a jour des constantes' });
    }
  },

  /**
   * Historique des passages d'un patient
   * GET /api/visits/patient/:patientId
   */
  getPatientHistory: async (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const { count, rows } = await Visit.findAndCountAll({
        where: { patientId: req.params.patientId },
        include: [
          { model: User, as: 'doctor', attributes: staffAttributes },
          { model: Prescription, as: 'prescriptions', attributes: ['id', 'prescriptionNumber', 'status', 'totalAmount'] }
        ],
        order: [['visitDate', 'DESC'], ['ticketNumber', 'DESC']],
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10)
      });

      res.json({
        visits: rows,
        pagination: {
          total: count,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          pages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      logger.error('Get patient visits error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation de l\'historique' });
    }
  }
};

module.exports = visitController;
