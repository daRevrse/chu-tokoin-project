const { Patient, Prescription } = require('../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

const patientController = {
  /**
   * Creer un nouveau patient
   * POST /api/patients
   */
  create: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { firstName, lastName, dateOfBirth, gender, phone, address, email } = req.body;

      const patient = await Patient.create({
        firstName,
        lastName,
        dateOfBirth,
        gender,
        phone,
        address,
        email
      });

      logger.info('Patient cree', { patientId: patient.id, patientNumber: patient.patientNumber });

      res.status(201).json({
        message: 'Patient cree avec succes',
        patient
      });
    } catch (error) {
      logger.error('Create patient error:', error);
      res.status(500).json({
        error: 'Erreur lors de la creation du patient'
      });
    }
  },

  /**
   * Rechercher des patients
   * GET /api/patients?q=xxx
   */
  search: async (req, res) => {
    try {
      const { q, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      // Construction de la clause WHERE
      const where = q ? {
        [Op.or]: [
          { firstName: { [Op.like]: `%${q}%` } },
          { lastName: { [Op.like]: `%${q}%` } },
          { patientNumber: { [Op.like]: `%${q}%` } },
          { phone: { [Op.like]: `%${q}%` } }
        ]
      } : {};

      const { count, rows } = await Patient.findAndCountAll({
        where,
        order: [['lastName', 'ASC'], ['firstName', 'ASC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        patients: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          pages: Math.ceil(count / limit),
          limit: parseInt(limit)
        }
      });
    } catch (error) {
      logger.error('Search patients error:', error);
      res.status(500).json({
        error: 'Erreur lors de la recherche des patients'
      });
    }
  },

  /**
   * Obtenir un patient par ID
   * GET /api/patients/:id
   */
  getById: async (req, res) => {
    try {
      const patient = await Patient.findByPk(req.params.id, {
        include: [{
          model: Prescription,
          as: 'prescriptions',
          limit: 10,
          order: [['createdAt', 'DESC']]
        }]
      });

      if (!patient) {
        return res.status(404).json({
          error: 'Patient non trouve'
        });
      }

      res.json({ patient });
    } catch (error) {
      logger.error('Get patient error:', error);
      res.status(500).json({
        error: 'Erreur lors de la recuperation du patient'
      });
    }
  },

  /**
   * Mettre a jour un patient
   * PUT /api/patients/:id
   */
  update: async (req, res) => {
    try {
      const patient = await Patient.findByPk(req.params.id);

      if (!patient) {
        return res.status(404).json({
          error: 'Patient non trouve'
        });
      }

      const { firstName, lastName, dateOfBirth, gender, phone, address, email } = req.body;

      await patient.update({
        firstName: firstName || patient.firstName,
        lastName: lastName || patient.lastName,
        dateOfBirth: dateOfBirth || patient.dateOfBirth,
        gender: gender || patient.gender,
        phone: phone || patient.phone,
        address: address !== undefined ? address : patient.address,
        email: email !== undefined ? email : patient.email
      });

      logger.info('Patient mis a jour', { patientId: patient.id });

      res.json({
        message: 'Patient mis a jour',
        patient
      });
    } catch (error) {
      logger.error('Update patient error:', error);
      res.status(500).json({
        error: 'Erreur lors de la mise a jour du patient'
      });
    }
  },

  /**
   * Obtenir un patient par numero
   * GET /api/patients/number/:number
   */
  getByNumber: async (req, res) => {
    try {
      const patient = await Patient.findOne({
        where: { patientNumber: req.params.number }
      });

      if (!patient) {
        return res.status(404).json({
          error: 'Patient non trouve'
        });
      }

      res.json({ patient });
    } catch (error) {
      logger.error('Get patient by number error:', error);
      res.status(500).json({
        error: 'Erreur lors de la recuperation du patient'
      });
    }
  }
};

module.exports = patientController;
