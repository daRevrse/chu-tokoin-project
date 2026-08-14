const { Op } = require('sequelize');
const { sequelize, EmergencyCase, Patient, User, Invoice, InvoiceLine } = require('../models');
const { validationResult } = require('express-validator');
const { reserveNumber } = require('../services/sequenceService');
const { tryEnsureEmergencyInvoice } = require('../services/emergencyBillingService');
const { getBusinessDate } = require('../utils/businessDate');
const logger = require('../utils/logger');

// Constantes relevees au triage
const VITALS_FIELDS = [
  'weightKg',
  'heightCm',
  'temperatureC',
  'bloodPressureSys',
  'bloodPressureDia',
  'pulseBpm',
  'oxygenSaturation'
];

// Dossiers encore dans le service
const OPEN_STATUSES = ['AWAITING_TRIAGE', 'WAITING', 'IN_CARE'];

/**
 * Ordre d'appel du service.
 *
 * Un dossier non trie passe avant tout le monde : personne n'a encore evalue ce
 * patient, il peut aussi bien etre un niveau 1. Faire attendre un dossier non
 * cote derriere des patients cotes reviendrait a decider de sa gravite sans
 * l'avoir vu.
 *
 * Vient ensuite la gravite, puis l'anciennete a gravite egale.
 */
const QUEUE_ORDER = [
  [sequelize.literal("CASE WHEN `EmergencyCase`.`status` = 'AWAITING_TRIAGE' THEN 0 ELSE 1 END"), 'ASC'],
  ['triageLevel', 'ASC'],
  ['arrivalAt', 'ASC']
];

const patientInclude = {
  model: Patient,
  as: 'patient',
  attributes: ['id', 'patientNumber', 'firstName', 'lastName', 'dateOfBirth', 'gender', 'phone']
};

const staffAttributes = ['id', 'firstName', 'lastName', 'role'];

const staffIncludes = [
  { model: User, as: 'doctor', attributes: staffAttributes },
  { model: User, as: 'triageNurse', attributes: staffAttributes },
  { model: User, as: 'registrar', attributes: staffAttributes }
];

const invoiceInclude = {
  model: Invoice,
  as: 'invoices',
  required: false,
  attributes: ['id', 'invoiceNumber', 'status', 'totalAmount', 'paidAmount', 'isDeferred']
};

const pickVitals = (body) => VITALS_FIELDS.reduce((acc, field) => {
  if (body[field] !== undefined && body[field] !== '') {
    acc[field] = body[field];
  }
  return acc;
}, {});

const loadCase = (id) => EmergencyCase.findByPk(id, {
  include: [patientInclude, ...staffIncludes, invoiceInclude]
});

const emergencyController = {
  /**
   * Ouvrir un dossier d'urgence
   * POST /api/emergencies
   *
   * Le patient peut etre identifie (`patientId`) ou seulement decrit
   * (`provisionalLabel`). L'un des deux suffit : exiger une identite complete
   * reviendrait a retarder la prise en charge d'un patient inconscient le temps
   * de remplir un formulaire d'etat civil.
   */
  create: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        patientId = null,
        provisionalLabel = null,
        arrivalMode = 'WALK_IN',
        chiefComplaint = null,
        triageLevel = null,
        triageNotes = null,
        notes = null
      } = req.body;

      if (!patientId && !provisionalLabel) {
        return res.status(400).json({
          error: 'Identifiez le patient ou donnez-lui une designation provisoire'
        });
      }

      if (patientId && !(await Patient.findByPk(patientId))) {
        return res.status(404).json({ error: 'Patient non trouve' });
      }

      // Numerotation sur la date calendaire : le service tourne 24h/24 et ne
      // depend d'aucune ouverture de guichet.
      const sequence = await reserveNumber('EMERGENCY', getBusinessDate());
      const caseNumber = `URG-${getBusinessDate().replace(/-/g, '')}-${String(sequence).padStart(4, '0')}`;

      // Le triage peut etre pose des l'admission quand l'infirmier accueille
      // lui-meme le patient ; sinon le dossier attend son evaluation.
      const triaged = triageLevel !== null && triageLevel !== undefined && triageLevel !== '';

      const emergencyCase = await EmergencyCase.create({
        caseNumber,
        patientId,
        provisionalLabel: patientId ? null : provisionalLabel,
        arrivalAt: new Date(),
        arrivalMode,
        chiefComplaint,
        notes,
        status: triaged ? 'WAITING' : 'AWAITING_TRIAGE',
        triageLevel: triaged ? triageLevel : null,
        triageNotes: triaged ? triageNotes : null,
        triagedBy: triaged ? req.user.id : null,
        triagedAt: triaged ? new Date() : null,
        registeredBy: req.user.id,
        ...pickVitals(req.body)
      });

      // La facture n'est emise que si le patient est identifie, et elle ne
      // conditionne rien : voir services/emergencyBillingService.js.
      const invoice = patientId
        ? await tryEnsureEmergencyInvoice(emergencyCase.id, { issuedBy: req.user.id })
        : null;

      logger.info('Dossier d\'urgence ouvert', {
        emergencyCaseId: emergencyCase.id,
        caseNumber,
        identified: Boolean(patientId),
        arrivalMode,
        triageLevel: emergencyCase.triageLevel,
        registeredBy: req.user.id
      });

      res.status(201).json({
        message: 'Dossier d\'urgence ouvert',
        emergencyCase: await loadCase(emergencyCase.id),
        invoice
      });
    } catch (error) {
      logger.error('Create emergency case error:', error);
      res.status(500).json({ error: 'Erreur lors de l\'ouverture du dossier d\'urgence' });
    }
  },

  /**
   * File des urgences
   * GET /api/emergencies/queue?status=...&date=YYYY-MM-DD
   *
   * Par defaut, les dossiers encore dans le service, quelle que soit leur date
   * d'arrivee : un patient arrive a 23h50 est toujours la a 00h10, et il ne doit
   * pas disparaitre de l'ecran au passage de minuit.
   */
  getQueue: async (req, res) => {
    try {
      const { status, date } = req.query;

      const where = {};

      if (status === 'all') {
        // Aucun filtre
      } else if (status) {
        where.status = {
          [Op.in]: String(status).split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
        };
      } else {
        where.status = { [Op.in]: OPEN_STATUSES };
      }

      if (date) {
        const start = new Date(`${date}T00:00:00.000Z`);
        const end = new Date(`${date}T23:59:59.999Z`);
        where.arrivalAt = { [Op.between]: [start, end] };
      }

      const cases = await EmergencyCase.findAll({
        where,
        include: [patientInclude, ...staffIncludes, invoiceInclude],
        order: QUEUE_ORDER
      });

      res.json({
        count: cases.length,
        awaitingTriage: cases.filter(c => c.status === 'AWAITING_TRIAGE').length,
        emergencyCases: cases
      });
    } catch (error) {
      logger.error('Get emergency queue error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation de la file des urgences' });
    }
  },

  /**
   * Detail d'un dossier
   * GET /api/emergencies/:id
   */
  getById: async (req, res) => {
    try {
      const emergencyCase = await EmergencyCase.findByPk(req.params.id, {
        include: [
          patientInclude,
          ...staffIncludes,
          { model: Invoice, as: 'invoices', include: [{ model: InvoiceLine, as: 'lines' }] }
        ]
      });

      if (!emergencyCase) {
        return res.status(404).json({ error: 'Dossier d\'urgence non trouve' });
      }

      res.json({ emergencyCase });
    } catch (error) {
      logger.error('Get emergency case error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation du dossier' });
    }
  },

  /**
   * Coter ou recoter le triage
   * PATCH /api/emergencies/:id/triage
   *
   * Revisable tant que le patient est dans le service : un etat clinique se
   * degrade, et un triage qu'on ne peut pas revoir est un triage faux des la
   * deuxieme heure d'attente.
   */
  triage: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const emergencyCase = await EmergencyCase.findByPk(req.params.id);

      if (!emergencyCase) {
        return res.status(404).json({ error: 'Dossier d\'urgence non trouve' });
      }

      if (!OPEN_STATUSES.includes(emergencyCase.status)) {
        return res.status(409).json({
          error: `Ce dossier est cloture (statut : ${emergencyCase.status})`
        });
      }

      const { triageLevel, triageNotes } = req.body;

      await emergencyCase.update({
        triageLevel,
        triageNotes: triageNotes !== undefined ? triageNotes : emergencyCase.triageNotes,
        triagedBy: req.user.id,
        triagedAt: new Date(),
        // Une recotation ne renvoie pas en attente un patient deja pris en
        // charge : elle met a jour la gravite, pas l'etape du parcours.
        status: emergencyCase.status === 'AWAITING_TRIAGE' ? 'WAITING' : emergencyCase.status,
        ...pickVitals(req.body || {})
      });

      logger.info('Triage pose', {
        emergencyCaseId: emergencyCase.id,
        caseNumber: emergencyCase.caseNumber,
        triageLevel,
        by: req.user.id
      });

      res.json({ message: 'Triage enregistre', emergencyCase: await loadCase(emergencyCase.id) });
    } catch (error) {
      logger.error('Triage error:', error);
      res.status(500).json({ error: 'Erreur lors du triage' });
    }
  },

  /**
   * Prendre en charge
   * PATCH /api/emergencies/:id/take
   *
   * Aucune verification de paiement, volontairement : c'est toute la difference
   * avec le circuit ambulatoire. Aux urgences la creance suit le soin, elle ne
   * le precede pas.
   */
  take: async (req, res) => {
    try {
      const emergencyCase = await EmergencyCase.findByPk(req.params.id);

      if (!emergencyCase) {
        return res.status(404).json({ error: 'Dossier d\'urgence non trouve' });
      }

      // La condition de statut fait partie du UPDATE : si deux medecins cliquent
      // sur le meme dossier, un seul voit une ligne modifiee.
      const [affected] = await EmergencyCase.update(
        { status: 'IN_CARE', doctorId: req.user.id, startedAt: new Date() },
        { where: { id: emergencyCase.id, status: { [Op.in]: ['AWAITING_TRIAGE', 'WAITING'] } } }
      );

      if (affected === 0) {
        const current = await loadCase(emergencyCase.id);
        return res.status(409).json({
          error: current.status === 'IN_CARE'
            ? 'Ce patient est deja pris en charge par un autre medecin'
            : `Ce dossier n'est plus en attente (statut : ${current.status})`,
          emergencyCase: current
        });
      }

      logger.info('Urgence prise en charge', {
        emergencyCaseId: emergencyCase.id,
        caseNumber: emergencyCase.caseNumber,
        triageLevel: emergencyCase.triageLevel,
        doctorId: req.user.id
      });

      res.json({ message: 'Patient pris en charge', emergencyCase: await loadCase(emergencyCase.id) });
    } catch (error) {
      logger.error('Take emergency case error:', error);
      res.status(500).json({ error: 'Erreur lors de la prise en charge' });
    }
  },

  /**
   * Orienter a la sortie
   * PATCH /api/emergencies/:id/discharge
   *
   * Un passage aux urgences ne se termine pas, il s'oriente : domicile,
   * hospitalisation, transfert, sortie contre avis medical, deces.
   */
  discharge: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const emergencyCase = await EmergencyCase.findByPk(req.params.id);

      if (!emergencyCase) {
        return res.status(404).json({ error: 'Dossier d\'urgence non trouve' });
      }

      if (emergencyCase.status !== 'IN_CARE') {
        return res.status(409).json({
          error: `Seul un patient en cours de prise en charge peut sortir (statut : ${emergencyCase.status})`
        });
      }

      if (emergencyCase.doctorId !== req.user.id && req.user.role !== 'ADMIN') {
        return res.status(403).json({
          error: 'Ce patient est pris en charge par un autre medecin'
        });
      }

      const { outcome, outcomeNotes } = req.body;

      await emergencyCase.update({
        status: 'DISCHARGED',
        outcome,
        outcomeNotes: outcomeNotes || null,
        completedAt: new Date()
      });

      // Derniere chance de facturer : si le patient a ete identifie pendant le
      // sejour, la creance est ouverte maintenant. Sinon le dossier remonte dans
      // les non identifies, et rien n'est perdu.
      const invoice = await tryEnsureEmergencyInvoice(emergencyCase.id, { issuedBy: req.user.id });

      logger.info('Sortie des urgences', {
        emergencyCaseId: emergencyCase.id,
        caseNumber: emergencyCase.caseNumber,
        outcome,
        identified: Boolean(emergencyCase.patientId),
        doctorId: req.user.id
      });

      res.json({
        message: 'Sortie enregistree',
        emergencyCase: await loadCase(emergencyCase.id),
        invoice
      });
    } catch (error) {
      logger.error('Discharge error:', error);
      res.status(500).json({ error: 'Erreur lors de l\'enregistrement de la sortie' });
    }
  },

  /**
   * Rattacher un dossier a un patient
   * PATCH /api/emergencies/:id/identify
   *
   * Regularise une admission ouverte sous designation provisoire. C'est ici que
   * la creance devient reclamable : avant, il n'y avait personne a qui la
   * presenter.
   */
  identify: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const emergencyCase = await EmergencyCase.findByPk(req.params.id);

      if (!emergencyCase) {
        return res.status(404).json({ error: 'Dossier d\'urgence non trouve' });
      }

      if (emergencyCase.patientId) {
        return res.status(409).json({
          error: 'Ce dossier est deja rattache a un patient'
        });
      }

      const patient = await Patient.findByPk(req.body.patientId);
      if (!patient) {
        return res.status(404).json({ error: 'Patient non trouve' });
      }

      // La designation provisoire est conservee : elle documente sous quel
      // libelle le patient a ete soigne, ce que les comptes rendus rediges
      // pendant le sejour continuent de porter.
      await emergencyCase.update({ patientId: patient.id });

      const invoice = await tryEnsureEmergencyInvoice(emergencyCase.id, { issuedBy: req.user.id });

      logger.info('Dossier d\'urgence identifie', {
        emergencyCaseId: emergencyCase.id,
        caseNumber: emergencyCase.caseNumber,
        patientNumber: patient.patientNumber,
        invoiceNumber: invoice ? invoice.invoiceNumber : null,
        by: req.user.id
      });

      res.json({
        message: 'Patient rattache au dossier',
        emergencyCase: await loadCase(emergencyCase.id),
        invoice
      });
    } catch (error) {
      logger.error('Identify emergency case error:', error);
      res.status(500).json({ error: 'Erreur lors du rattachement du patient' });
    }
  },

  /**
   * Patient parti sans etre vu
   * PATCH /api/emergencies/:id/leave
   *
   * Etat a part entiere et non une annulation : un patient qui repart avant
   * d'etre examine est un evenement que le service doit pouvoir compter.
   */
  leave: async (req, res) => {
    try {
      const emergencyCase = await EmergencyCase.findByPk(req.params.id);

      if (!emergencyCase) {
        return res.status(404).json({ error: 'Dossier d\'urgence non trouve' });
      }

      if (!['AWAITING_TRIAGE', 'WAITING'].includes(emergencyCase.status)) {
        return res.status(409).json({
          error: `Ce dossier n'est plus en attente (statut : ${emergencyCase.status})`
        });
      }

      await emergencyCase.update({
        status: 'LEFT_WITHOUT_CARE',
        completedAt: new Date(),
        outcomeNotes: (req.body || {}).notes || null
      });

      logger.info('Patient parti sans etre vu', {
        emergencyCaseId: emergencyCase.id,
        caseNumber: emergencyCase.caseNumber,
        by: req.user.id
      });

      res.json({ message: 'Depart enregistre', emergencyCase: await loadCase(emergencyCase.id) });
    } catch (error) {
      logger.error('Leave emergency case error:', error);
      res.status(500).json({ error: 'Erreur lors de l\'enregistrement du depart' });
    }
  },

  /**
   * Dossiers jamais identifies
   * GET /api/emergencies/unidentified
   *
   * Ce sont les dossiers dont la creance n'a jamais pu etre ouverte. Sans cet
   * ecran, ils n'apparaissent nulle part une fois le patient sorti.
   */
  getUnidentified: async (req, res) => {
    try {
      const cases = await EmergencyCase.findAll({
        where: { patientId: { [Op.is]: null } },
        include: staffIncludes,
        order: [['arrivalAt', 'DESC']]
      });

      res.json({ count: cases.length, emergencyCases: cases });
    } catch (error) {
      logger.error('Get unidentified cases error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation des dossiers non identifies' });
    }
  }
};

module.exports = emergencyController;
