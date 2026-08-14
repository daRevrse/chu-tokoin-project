const { Op } = require('sequelize');
const { Specialty, ConsultationTariff, User, Visit } = require('../models');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * Specialites cliniques et grille des frais de consultation.
 *
 * La consultation est en lecture pour tout le personnel : l'accueil oriente les
 * patients, le medecin filtre sa file. L'ecriture reste a l'administrateur, un
 * tarif etant une decision de l'etablissement.
 */
const specialtyController = {
  /**
   * Lister les specialites
   * GET /api/specialties?active=true&withTariffs=true
   */
  getAll: async (req, res) => {
    try {
      const { active, withTariffs } = req.query;

      const where = {};
      if (active !== undefined && active !== '' && active !== 'all') {
        where.isActive = active === 'true';
      }

      const include = [];
      if (withTariffs === 'true') {
        include.push({
          model: ConsultationTariff,
          as: 'tariffs',
          separate: true,
          where: { isActive: true },
          required: false
        });
      }

      const specialties = await Specialty.findAll({
        where,
        include,
        order: [['displayOrder', 'ASC'], ['name', 'ASC']]
      });

      // Nombre de medecins rattaches : une specialite sans medecin ne doit pas
      // recevoir de patient, l'accueil a besoin de le voir avant d'orienter.
      const doctorCounts = await User.findAll({
        attributes: ['specialtyId', [User.sequelize.fn('COUNT', User.sequelize.col('id')), 'count']],
        where: { specialtyId: { [Op.ne]: null }, isActive: true },
        group: ['specialtyId']
      });

      const doctorsBy = Object.fromEntries(
        doctorCounts.map(r => [r.get('specialtyId'), parseInt(r.get('count'), 10)])
      );

      res.json({
        specialties: specialties.map(s => ({
          ...s.toJSON(),
          doctorCount: doctorsBy[s.id] || 0
        }))
      });
    } catch (error) {
      logger.error('Get specialties error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation des specialites' });
    }
  },

  /**
   * Creer une specialite
   * POST /api/specialties
   */
  create: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { code, name, description, color, displayOrder } = req.body;
      const normalizedCode = code.trim().toUpperCase();

      if (await Specialty.findOne({ where: { code: normalizedCode } })) {
        return res.status(400).json({ error: 'Une specialite avec ce code existe deja' });
      }

      const specialty = await Specialty.create({
        code: normalizedCode,
        name,
        description: description || null,
        color: color || null,
        displayOrder: displayOrder ?? 0
      });

      logger.info('Specialite creee', { specialtyId: specialty.id, code: specialty.code, by: req.user.id });
      res.status(201).json({ message: 'Specialite creee avec succes', specialty });
    } catch (error) {
      logger.error('Create specialty error:', error);
      res.status(500).json({ error: 'Erreur lors de la creation de la specialite' });
    }
  },

  /**
   * Mettre a jour une specialite
   * PUT /api/specialties/:id
   */
  update: async (req, res) => {
    try {
      const specialty = await Specialty.findByPk(req.params.id);
      if (!specialty) return res.status(404).json({ error: 'Specialite non trouvee' });

      const { name, description, color, displayOrder, isActive } = req.body;

      // Desactiver une specialite dont la file n'est pas vide laisserait des
      // patients dans une file que plus personne ne regarde.
      if (isActive === false && specialty.isActive) {
        const waiting = await Visit.count({
          where: { specialtyId: specialty.id, status: { [Op.in]: ['WAITING', 'IN_CONSULT'] } }
        });

        if (waiting > 0) {
          return res.status(400).json({
            error: `${waiting} patient(s) sont encore en attente dans cette specialite.`
          });
        }
      }

      await specialty.update({
        name: name ?? specialty.name,
        description: description !== undefined ? description : specialty.description,
        color: color !== undefined ? color : specialty.color,
        displayOrder: displayOrder ?? specialty.displayOrder,
        isActive: isActive !== undefined ? isActive : specialty.isActive
      });

      logger.info('Specialite mise a jour', { specialtyId: specialty.id, by: req.user.id });
      res.json({ message: 'Specialite mise a jour', specialty });
    } catch (error) {
      logger.error('Update specialty error:', error);
      res.status(500).json({ error: 'Erreur lors de la mise a jour de la specialite' });
    }
  },

  // ---- Grille tarifaire ----

  /**
   * Lister les tarifs de consultation
   * GET /api/specialties/tariffs
   */
  getTariffs: async (req, res) => {
    try {
      const tariffs = await ConsultationTariff.findAll({
        include: [{ model: Specialty, as: 'specialty', attributes: ['id', 'code', 'name'] }],
        order: [['visitType', 'ASC'], ['createdAt', 'ASC']]
      });

      res.json({ tariffs });
    } catch (error) {
      logger.error('Get tariffs error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation des tarifs' });
    }
  },

  /**
   * Creer un tarif
   * POST /api/specialties/tariffs
   */
  createTariff: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { specialtyId = null, visitType = 'CONSULTATION', amount, label, validityDays = 0 } = req.body;

      if (specialtyId && !(await Specialty.findByPk(specialtyId))) {
        return res.status(404).json({ error: 'Specialite non trouvee' });
      }

      // MySQL ne peut pas garantir cette unicite : un index unique laisse passer
      // plusieurs lignes dont `specialtyId` est NULL, donc plusieurs tarifs par
      // defaut concurrents pour un meme type de passage. La verification est
      // donc ici, avec la course residuelle que cela implique — deux
      // administrateurs creant le meme tarif a la seconde pres restent possibles,
      // et se corrigent en desactivant le doublon.
      const duplicate = await ConsultationTariff.findOne({
        where: {
          specialtyId: specialtyId || { [Op.is]: null },
          visitType,
          isActive: true
        }
      });

      if (duplicate) {
        return res.status(400).json({
          error: specialtyId
            ? 'Un tarif actif existe deja pour cette specialite et ce type de passage'
            : 'Un tarif par defaut actif existe deja pour ce type de passage'
        });
      }

      const tariff = await ConsultationTariff.create({
        specialtyId: specialtyId || null,
        visitType,
        amount,
        label: label || null,
        validityDays: validityDays || 0
      });

      logger.info('Tarif de consultation cree', {
        tariffId: tariff.id,
        specialtyId: tariff.specialtyId,
        visitType: tariff.visitType,
        amount: tariff.amount,
        by: req.user.id
      });

      res.status(201).json({ message: 'Tarif cree avec succes', tariff });
    } catch (error) {
      logger.error('Create tariff error:', error);
      res.status(500).json({ error: 'Erreur lors de la creation du tarif' });
    }
  },

  /**
   * Mettre a jour un tarif
   * PUT /api/specialties/tariffs/:id
   *
   * Les factures deja emises ne bougent pas : leurs lignes portent une copie du
   * montant (voir models/InvoiceLine.js). Un changement de tarif ne vaut donc
   * que pour les passages ouverts ensuite.
   */
  updateTariff: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const tariff = await ConsultationTariff.findByPk(req.params.id);
      if (!tariff) return res.status(404).json({ error: 'Tarif non trouve' });

      const { amount, label, isActive, validityDays } = req.body;

      await tariff.update({
        amount: amount !== undefined ? amount : tariff.amount,
        label: label !== undefined ? label : tariff.label,
        validityDays: validityDays !== undefined ? validityDays : tariff.validityDays,
        isActive: isActive !== undefined ? isActive : tariff.isActive
      });

      logger.info('Tarif de consultation mis a jour', {
        tariffId: tariff.id,
        amount: tariff.amount,
        isActive: tariff.isActive,
        by: req.user.id
      });

      res.json({ message: 'Tarif mis a jour', tariff });
    } catch (error) {
      logger.error('Update tariff error:', error);
      res.status(500).json({ error: 'Erreur lors de la mise a jour du tarif' });
    }
  }
};

module.exports = specialtyController;
