const { Exam } = require('../models');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

const examController = {
  /**
   * Lister tous les examens
   * GET /api/exams
   */
  getAll: async (req, res) => {
    try {
      const { category, active } = req.query;
      const where = {};

      if (category) {
        where.category = category;
      }

      if (active !== undefined) {
        where.isActive = active === 'true';
      } else {
        // Par defaut, ne montrer que les examens actifs
        where.isActive = true;
      }

      const exams = await Exam.findAll({
        where,
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

      const { code, name, category, price, description } = req.body;

      // Verifier si le code existe deja
      const existingExam = await Exam.findOne({ where: { code } });
      if (existingExam) {
        return res.status(400).json({
          error: 'Ce code d\'examen existe deja'
        });
      }

      const exam = await Exam.create({
        code,
        name,
        category,
        price,
        description
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
      const exam = await Exam.findByPk(req.params.id);

      if (!exam) {
        return res.status(404).json({
          error: 'Examen non trouve'
        });
      }

      const { name, price, description, isActive } = req.body;

      await exam.update({
        name: name || exam.name,
        price: price !== undefined ? price : exam.price,
        description: description !== undefined ? description : exam.description,
        isActive: isActive !== undefined ? isActive : exam.isActive
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
