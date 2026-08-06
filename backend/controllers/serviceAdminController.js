const { Op } = require('sequelize');
const { Service, ExamCategory, ServiceStep, Exam, User } = require('../models');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * Administration des services hospitaliers, de leurs sous-categories et de
 * leurs etapes de realisation. Reserve aux administrateurs.
 */
const serviceAdminController = {
  /**
   * Lister les services avec categories, etapes et compteurs
   * GET /api/admin/services
   */
  getAll: async (req, res) => {
    try {
      const { active } = req.query;
      const where = {};
      if (active !== undefined && active !== '' && active !== 'all') {
        where.isActive = active === 'true';
      }

      const services = await Service.findAll({
        where,
        include: [
          { model: ExamCategory, as: 'categories', separate: true, order: [['displayOrder', 'ASC']] },
          { model: ServiceStep, as: 'steps', separate: true, order: [['displayOrder', 'ASC']] }
        ],
        order: [['displayOrder', 'ASC'], ['name', 'ASC']]
      });

      // Compteurs d'examens et de personnel, par service
      const [examCounts, staffCounts] = await Promise.all([
        Exam.findAll({
          attributes: ['serviceId', [Exam.sequelize.fn('COUNT', Exam.sequelize.col('id')), 'count']],
          where: { serviceId: { [Op.ne]: null } },
          group: ['serviceId']
        }),
        User.findAll({
          attributes: ['serviceId', [User.sequelize.fn('COUNT', User.sequelize.col('id')), 'count']],
          where: { serviceId: { [Op.ne]: null } },
          group: ['serviceId']
        })
      ]);

      const examBy = Object.fromEntries(examCounts.map(r => [r.get('serviceId'), parseInt(r.get('count'), 10)]));
      const staffBy = Object.fromEntries(staffCounts.map(r => [r.get('serviceId'), parseInt(r.get('count'), 10)]));

      res.json({
        services: services.map(s => ({
          ...s.toJSON(),
          examCount: examBy[s.id] || 0,
          staffCount: staffBy[s.id] || 0
        }))
      });
    } catch (error) {
      logger.error('Get services error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation des services' });
    }
  },

  /**
   * Creer un service
   * POST /api/admin/services
   */
  create: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { code, name, description, color, displayOrder } = req.body;
      const normalizedCode = code.trim().toUpperCase();

      if (await Service.findOne({ where: { code: normalizedCode } })) {
        return res.status(400).json({ error: 'Un service avec ce code existe deja' });
      }

      const service = await Service.create({
        code: normalizedCode,
        name,
        description: description || null,
        color: color || null,
        displayOrder: displayOrder ?? 0
      });

      logger.info('Service cree', { serviceId: service.id, code: service.code, by: req.user.id });
      res.status(201).json({ message: 'Service cree avec succes', service });
    } catch (error) {
      logger.error('Create service error:', error);
      res.status(500).json({ error: 'Erreur lors de la creation du service' });
    }
  },

  /**
   * Mettre a jour un service
   * PUT /api/admin/services/:id
   */
  update: async (req, res) => {
    try {
      const service = await Service.findByPk(req.params.id);
      if (!service) return res.status(404).json({ error: 'Service non trouve' });

      const { name, description, color, displayOrder, isActive } = req.body;

      // Un service encore utilise ne peut pas etre desactive sans consequence :
      // ses examens deviendraient inexecutables.
      if (isActive === false && service.isActive) {
        const examCount = await Exam.count({ where: { serviceId: service.id, isActive: true } });
        if (examCount > 0) {
          return res.status(400).json({
            error: `Ce service porte encore ${examCount} examen(s) actif(s). Retirez-les du catalogue avant de le desactiver.`
          });
        }
      }

      await service.update({
        name: name ?? service.name,
        description: description !== undefined ? description : service.description,
        color: color !== undefined ? color : service.color,
        displayOrder: displayOrder ?? service.displayOrder,
        isActive: isActive !== undefined ? isActive : service.isActive
      });

      logger.info('Service mis a jour', { serviceId: service.id, by: req.user.id });
      res.json({ message: 'Service mis a jour', service });
    } catch (error) {
      logger.error('Update service error:', error);
      res.status(500).json({ error: 'Erreur lors de la mise a jour du service' });
    }
  },

  // ---- Sous-categories ----

  createCategory: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const service = await Service.findByPk(req.params.serviceId);
      if (!service) return res.status(404).json({ error: 'Service non trouve' });

      const code = req.body.code.trim().toUpperCase();
      if (await ExamCategory.findOne({ where: { serviceId: service.id, code } })) {
        return res.status(400).json({ error: 'Une categorie avec ce code existe deja dans ce service' });
      }

      const count = await ExamCategory.count({ where: { serviceId: service.id } });
      const category = await ExamCategory.create({
        serviceId: service.id,
        code,
        name: req.body.name,
        description: req.body.description || null,
        displayOrder: req.body.displayOrder ?? count + 1
      });

      res.status(201).json({ message: 'Categorie creee', category });
    } catch (error) {
      logger.error('Create category error:', error);
      res.status(500).json({ error: 'Erreur lors de la creation de la categorie' });
    }
  },

  updateCategory: async (req, res) => {
    try {
      const category = await ExamCategory.findByPk(req.params.id);
      if (!category) return res.status(404).json({ error: 'Categorie non trouvee' });

      const { name, description, displayOrder, isActive } = req.body;
      await category.update({
        name: name ?? category.name,
        description: description !== undefined ? description : category.description,
        displayOrder: displayOrder ?? category.displayOrder,
        isActive: isActive !== undefined ? isActive : category.isActive
      });

      res.json({ message: 'Categorie mise a jour', category });
    } catch (error) {
      logger.error('Update category error:', error);
      res.status(500).json({ error: 'Erreur lors de la mise a jour de la categorie' });
    }
  },

  // ---- Etapes de realisation ----

  createStep: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const service = await Service.findByPk(req.params.serviceId);
      if (!service) return res.status(404).json({ error: 'Service non trouve' });

      const code = req.body.code.trim().toUpperCase();
      if (await ServiceStep.findOne({ where: { serviceId: service.id, code } })) {
        return res.status(400).json({ error: 'Une etape avec ce code existe deja dans ce service' });
      }

      // Une seule etape peut produire le resultat : c'est elle qui cloture
      // l'examen. Declarer la nouvelle libere l'ancienne.
      if (req.body.producesResult) {
        await ServiceStep.update(
          { producesResult: false },
          { where: { serviceId: service.id, producesResult: true } }
        );
      }

      const count = await ServiceStep.count({ where: { serviceId: service.id } });
      const step = await ServiceStep.create({
        serviceId: service.id,
        code,
        name: req.body.name,
        description: req.body.description || null,
        displayOrder: req.body.displayOrder ?? count + 1,
        isRequired: req.body.isRequired !== undefined ? req.body.isRequired : true,
        producesResult: Boolean(req.body.producesResult)
      });

      logger.info('Etape de service creee', { serviceId: service.id, code, by: req.user.id });
      res.status(201).json({ message: 'Etape creee', step });
    } catch (error) {
      logger.error('Create step error:', error);
      res.status(500).json({ error: 'Erreur lors de la creation de l\'etape' });
    }
  },

  updateStep: async (req, res) => {
    try {
      const step = await ServiceStep.findByPk(req.params.id);
      if (!step) return res.status(404).json({ error: 'Etape non trouvee' });

      const { name, description, displayOrder, isRequired, producesResult, isActive } = req.body;

      if (producesResult && !step.producesResult) {
        await ServiceStep.update(
          { producesResult: false },
          { where: { serviceId: step.serviceId, producesResult: true } }
        );
      }

      // Le service doit conserver une etape de cloture
      if (producesResult === false && step.producesResult) {
        return res.status(400).json({
          error: 'Le service doit conserver une etape produisant le resultat. Designez-en une autre d\'abord.'
        });
      }

      await step.update({
        name: name ?? step.name,
        description: description !== undefined ? description : step.description,
        displayOrder: displayOrder ?? step.displayOrder,
        isRequired: isRequired !== undefined ? isRequired : step.isRequired,
        producesResult: producesResult !== undefined ? producesResult : step.producesResult,
        isActive: isActive !== undefined ? isActive : step.isActive
      });

      res.json({ message: 'Etape mise a jour', step });
    } catch (error) {
      logger.error('Update step error:', error);
      res.status(500).json({ error: 'Erreur lors de la mise a jour de l\'etape' });
    }
  },

  /**
   * Reordonner les etapes d'un service
   * PATCH /api/admin/services/:serviceId/steps/reorder
   */
  reorderSteps: async (req, res) => {
    try {
      const { order } = req.body; // tableau d'identifiants, dans le nouvel ordre
      if (!Array.isArray(order) || order.length === 0) {
        return res.status(400).json({ error: 'Un ordre d\'etapes est requis' });
      }

      const steps = await ServiceStep.findAll({ where: { serviceId: req.params.serviceId } });
      const known = new Set(steps.map(s => s.id));
      if (order.some(id => !known.has(id)) || order.length !== steps.length) {
        return res.status(400).json({ error: 'L\'ordre fourni ne correspond pas aux etapes du service' });
      }

      await Promise.all(order.map((id, index) =>
        ServiceStep.update({ displayOrder: index + 1 }, { where: { id } })
      ));

      res.json({ message: 'Etapes reordonnees' });
    } catch (error) {
      logger.error('Reorder steps error:', error);
      res.status(500).json({ error: 'Erreur lors du reordonnancement' });
    }
  }
};

module.exports = serviceAdminController;
