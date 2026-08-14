const { Exam, Service, ExamCategory } = require('../models');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

// L'ancienne colonne `category` est NOT NULL et sert encore de repli aux
// ecrans non migres. On la derive du service plutot que de la demander.
const LEGACY_BY_SERVICE_CODE = {
  IMAGERIE: 'RADIOLOGY',
  LABORATOIRE: 'LABORATORY'
};

/**
 * Valide et normalise le rattachement d'un examen a un service et, le cas
 * echeant, a l'une de ses sous-categories.
 */
const resolvePlacement = async ({ serviceId, categoryId, category }) => {
  if (!serviceId) {
    // Aucun service fourni : on conserve l'ancien fonctionnement par categorie
    if (!category) {
      return { error: 'Un service est requis pour cet examen' };
    }
    return { serviceId: null, categoryId: null, category };
  }

  const service = await Service.findByPk(serviceId);
  if (!service) {
    return { error: 'Service introuvable' };
  }
  if (!service.isActive) {
    return { error: 'Ce service est desactive' };
  }

  let resolvedCategoryId = null;
  if (categoryId) {
    const examCategory = await ExamCategory.findByPk(categoryId);
    if (!examCategory) {
      return { error: 'Sous-categorie introuvable' };
    }
    // Une sous-categorie n'a de sens qu'a l'interieur de son propre service
    if (examCategory.serviceId !== service.id) {
      return { error: 'Cette sous-categorie n\'appartient pas au service choisi' };
    }
    resolvedCategoryId = examCategory.id;
  }

  return {
    serviceId: service.id,
    categoryId: resolvedCategoryId,
    // Les services ajoutes apres coup n'ont pas d'equivalent historique :
    // on les rattache par defaut au laboratoire pour satisfaire la colonne.
    category: LEGACY_BY_SERVICE_CODE[service.code] || category || 'LABORATORY'
  };
};

const examController = {
  /**
   * Lister tous les examens
   * GET /api/exams
   */
  getAll: async (req, res) => {
    try {
      const { category, active, serviceId, categoryId } = req.query;
      const where = {};

      if (category) {
        where.category = category;
      }

      if (serviceId) {
        where.serviceId = serviceId;
      }

      if (categoryId) {
        where.categoryId = categoryId;
      }

      if (active === 'all') {
        // Actifs et desactives : utilise par l'ecran d'administration
      } else if (active !== undefined) {
        where.isActive = active === 'true';
      } else {
        // Par defaut, ne montrer que les examens actifs
        where.isActive = true;
      }

      // Le service est renvoye avec l'examen : les ecrans regroupent les
      // examens par service plutot que par l'ancienne categorie figee.
      const exams = await Exam.findAll({
        where,
        include: [
          { model: Service, as: 'service', attributes: ['id', 'code', 'name', 'color', 'displayOrder'] },
          { model: ExamCategory, as: 'examCategory', attributes: ['id', 'code', 'name', 'displayOrder'] }
        ],
        order: [['category', 'ASC'], ['name', 'ASC']]
      });

      res.json({ exams });
    } catch (error) {
      logger.error('Get exams error:', error);
      res.status(500).json({
        error: 'Erreur lors de la recuperation des examens'
      });
    }
  },

  /**
   * Obtenir un examen par ID
   * GET /api/exams/:id
   */
  getById: async (req, res) => {
    try {
      const exam = await Exam.findByPk(req.params.id);

      if (!exam) {
        return res.status(404).json({
          error: 'Examen non trouve'
        });
      }

      res.json({ exam });
    } catch (error) {
      logger.error('Get exam error:', error);
      res.status(500).json({
        error: 'Erreur lors de la recuperation de l\'examen'
      });
    }
  },

  /**
   * Creer un nouvel examen (admin)
   * POST /api/exams
   */
  create: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { code, name, category, price, description, serviceId, categoryId, resultDelayHours } = req.body;

      // Verifier si le code existe deja
      const existingExam = await Exam.findOne({ where: { code } });
      if (existingExam) {
        return res.status(400).json({
          error: 'Ce code d\'examen existe deja'
        });
      }

      const placement = await resolvePlacement({ serviceId, categoryId, category });
      if (placement.error) {
        return res.status(400).json({ error: placement.error });
      }

      const exam = await Exam.create({
        code,
        name,
        category: placement.category,
        serviceId: placement.serviceId,
        categoryId: placement.categoryId,
        price,
        description,
        // Absent : le modele applique son defaut de 24 h.
        ...(resultDelayHours !== undefined && resultDelayHours !== null
          ? { resultDelayHours }
          : {})
      });

      logger.info('Examen cree', { examId: exam.id, code: exam.code });

      res.status(201).json({
        message: 'Examen cree avec succes',
        exam
      });
    } catch (error) {
      logger.error('Create exam error:', error);
      res.status(500).json({
        error: 'Erreur lors de la creation de l\'examen'
      });
    }
  },

  /**
   * Mettre a jour un examen
   * PUT /api/exams/:id
   */
  update: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const exam = await Exam.findByPk(req.params.id);

      if (!exam) {
        return res.status(404).json({
          error: 'Examen non trouve'
        });
      }

      const { name, price, description, isActive, serviceId, categoryId, resultDelayHours } = req.body;

      // Le rattachement n'est recalcule que s'il est explicitement fourni
      let placement = null;
      if (serviceId !== undefined || categoryId !== undefined) {
        placement = await resolvePlacement({
          serviceId: serviceId !== undefined ? serviceId : exam.serviceId,
          categoryId: categoryId !== undefined ? categoryId : exam.categoryId,
          category: exam.category
        });
        if (placement.error) {
          return res.status(400).json({ error: placement.error });
        }
      }

      await exam.update({
        name: name || exam.name,
        price: price !== undefined ? price : exam.price,
        description: description !== undefined ? description : exam.description,
        isActive: isActive !== undefined ? isActive : exam.isActive,
        resultDelayHours: resultDelayHours !== undefined && resultDelayHours !== null
          ? resultDelayHours
          : exam.resultDelayHours,
        ...(placement ? {
          serviceId: placement.serviceId,
          categoryId: placement.categoryId,
          category: placement.category
        } : {})
      });

      logger.info('Examen mis a jour', { examId: exam.id });

      res.json({
        message: 'Examen mis a jour',
        exam
      });
    } catch (error) {
      logger.error('Update exam error:', error);
      res.status(500).json({
        error: 'Erreur lors de la mise a jour de l\'examen'
      });
    }
  },

  /**
   * Obtenir les examens par categorie
   * GET /api/exams/category/:category
   */
  getByCategory: async (req, res) => {
    try {
      const { category } = req.params;

      if (!['RADIOLOGY', 'LABORATORY'].includes(category)) {
        return res.status(400).json({
          error: 'Categorie invalide. Utilisez RADIOLOGY ou LABORATORY'
        });
      }

      const exams = await Exam.findAll({
        where: {
          category,
          isActive: true
        },
        order: [['name', 'ASC']]
      });

      res.json({ exams });
    } catch (error) {
      logger.error('Get exams by category error:', error);
      res.status(500).json({
        error: 'Erreur lors de la recuperation des examens'
      });
    }
  }
};

module.exports = examController;
