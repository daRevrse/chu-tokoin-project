const { Op } = require('sequelize');
const { User, Service } = require('../models');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

const { ROLES, SERVICE_ROLES } = require('../utils/roles');

/**
 * Valide l'affectation a un service en fonction du role.
 *
 * Seul le personnel technique porte un service. Pour un TECHNICIAN, le service
 * n'est pas optionnel : c'est lui, et non le role, qui definit son perimetre
 * d'examens (voir utils/serviceScope.js). Un TECHNICIAN sans service ne verrait
 * aucun examen et son compte serait inutilisable.
 *
 * @returns {Promise<{ value?: string|null, error?: string }>}
 */
const resolveServiceId = async (role, serviceId) => {
  if (!SERVICE_ROLES.includes(role)) {
    // Un role non technique ne conserve aucune affectation.
    return { value: null };
  }

  if (!serviceId) {
    if (role === 'TECHNICIAN') {
      return { error: 'Un technicien doit etre affecte a un service' };
    }
    // RADIOLOGIST et LAB_TECHNICIAN restent rattachables par leur categorie
    // historique (voir utils/serviceScope.js), le service est donc facultatif.
    return { value: null };
  }

  const service = await Service.findByPk(serviceId);
  if (!service) {
    return { error: 'Service introuvable' };
  }

  return { value: service.id };
};

/**
 * Compte les administrateurs actifs, en excluant eventuellement un utilisateur.
 * Sert a empecher la suppression du dernier acces administrateur.
 */
const countOtherActiveAdmins = async (excludedUserId) => {
  return User.count({
    where: {
      role: 'ADMIN',
      isActive: true,
      id: { [Op.ne]: excludedUserId }
    }
  });
};

const userController = {
  /**
   * Lister les utilisateurs avec filtres
   * GET /api/users?role=&active=&search=
   */
  getAll: async (req, res) => {
    try {
      const { role, active, search } = req.query;
      const where = {};

      if (role) {
        where.role = role;
      }

      if (active !== undefined && active !== '') {
        where.isActive = active === 'true';
      }

      if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        where[Op.or] = [
          { firstName: { [Op.like]: term } },
          { lastName: { [Op.like]: term } },
          { email: { [Op.like]: term } }
        ];
      }

      const users = await User.findAll({
        where,
        // Le service d'affectation est affiche dans la liste d'administration
        // et conditionne le perimetre du personnel technique.
        include: [{ model: Service, as: 'service', attributes: ['id', 'code', 'name', 'color'] }],
        order: [['role', 'ASC'], ['lastName', 'ASC'], ['firstName', 'ASC']]
      });

      res.json({ users });
    } catch (error) {
      logger.error('Get users error:', error);
      res.status(500).json({
        error: 'Erreur lors de la recuperation des utilisateurs'
      });
    }
  },

  /**
   * Repartition des utilisateurs par role et par statut
   * GET /api/users/stats
   */
  getStats: async (req, res) => {
    try {
      const [total, active, byRoleRaw] = await Promise.all([
        User.count(),
        User.count({ where: { isActive: true } }),
        User.findAll({
          attributes: [
            'role',
            [User.sequelize.fn('COUNT', User.sequelize.col('id')), 'count']
          ],
          group: ['role']
        })
      ]);

      const byRole = ROLES.reduce((acc, r) => ({ ...acc, [r]: 0 }), {});
      for (const row of byRoleRaw) {
        byRole[row.get('role')] = parseInt(row.get('count'), 10);
      }

      res.json({
        total,
        active,
        inactive: total - active,
        byRole
      });
    } catch (error) {
      logger.error('Get user stats error:', error);
      res.status(500).json({
        error: 'Erreur lors de la recuperation des statistiques utilisateurs'
      });
    }
  },

  /**
   * Obtenir un utilisateur par ID
   * GET /api/users/:id
   */
  getById: async (req, res) => {
    try {
      const user = await User.findByPk(req.params.id);

      if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouve' });
      }

      res.json({ user });
    } catch (error) {
      logger.error('Get user error:', error);
      res.status(500).json({
        error: 'Erreur lors de la recuperation de l\'utilisateur'
      });
    }
  },

  /**
   * Creer un utilisateur
   * POST /api/users
   */
  create: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, firstName, lastName, role, phone, serviceId } = req.body;

      const existing = await User.findOne({ where: { email } });
      if (existing) {
        return res.status(400).json({
          error: 'Un utilisateur avec cet email existe deja'
        });
      }

      const resolvedService = await resolveServiceId(role, serviceId);
      if (resolvedService.error) {
        return res.status(400).json({ error: resolvedService.error });
      }

      // Le hachage du mot de passe est assure par le hook beforeCreate du modele
      const user = await User.create({
        email,
        password,
        firstName,
        lastName,
        role,
        phone: phone || null,
        serviceId: resolvedService.value
      });

      logger.info('Utilisateur cree', {
        userId: user.id,
        role: user.role,
        by: req.user.id
      });

      res.status(201).json({
        message: 'Utilisateur cree avec succes',
        user
      });
    } catch (error) {
      logger.error('Create user error:', error);
      res.status(500).json({
        error: 'Erreur lors de la creation de l\'utilisateur'
      });
    }
  },

  /**
   * Mettre a jour un utilisateur
   * PUT /api/users/:id
   */
  update: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = await User.findByPk(req.params.id);
      if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouve' });
      }

      const { email, firstName, lastName, role, phone, serviceId } = req.body;

      // L'email doit rester unique
      if (email && email !== user.email) {
        const existing = await User.findOne({ where: { email } });
        if (existing) {
          return res.status(400).json({
            error: 'Un utilisateur avec cet email existe deja'
          });
        }
      }

      // Un administrateur ne peut pas se retirer son propre role : cela le
      // priverait immediatement de l'acces a cette interface.
      if (user.id === req.user.id && role && role !== user.role) {
        return res.status(400).json({
          error: 'Vous ne pouvez pas modifier votre propre role'
        });
      }

      // Ne pas retrograder le dernier administrateur actif
      if (user.role === 'ADMIN' && role && role !== 'ADMIN') {
        const others = await countOtherActiveAdmins(user.id);
        if (others === 0) {
          return res.status(400).json({
            error: 'Impossible de retrograder le dernier administrateur actif'
          });
        }
      }

      // Le service est resolu par rapport au role final : retrograder un
      // technicien vers un role non technique doit liberer son affectation.
      const finalRole = role || user.role;
      const resolvedService = serviceId !== undefined || role
        ? await resolveServiceId(finalRole, serviceId !== undefined ? serviceId : user.serviceId)
        : { value: user.serviceId };

      if (resolvedService.error) {
        return res.status(400).json({ error: resolvedService.error });
      }

      await user.update({
        email: email || user.email,
        firstName: firstName || user.firstName,
        lastName: lastName || user.lastName,
        role: finalRole,
        phone: phone !== undefined ? phone : user.phone,
        serviceId: resolvedService.value
      });

      logger.info('Utilisateur mis a jour', {
        userId: user.id,
        by: req.user.id
      });

      res.json({
        message: 'Utilisateur mis a jour',
        user
      });
    } catch (error) {
      logger.error('Update user error:', error);
      res.status(500).json({
        error: 'Erreur lors de la mise a jour de l\'utilisateur'
      });
    }
  },

  /**
   * Activer / desactiver un utilisateur
   * PATCH /api/users/:id/status
   *
   * La desactivation remplace la suppression : les comptes restent references
   * par les prescriptions, paiements et resultats deja enregistres.
   */
  setStatus: async (req, res) => {
    try {
      const user = await User.findByPk(req.params.id);
      if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouve' });
      }

      const { isActive } = req.body;
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({
          error: 'Le champ isActive doit etre un booleen'
        });
      }

      if (user.id === req.user.id && !isActive) {
        return res.status(400).json({
          error: 'Vous ne pouvez pas desactiver votre propre compte'
        });
      }

      if (user.role === 'ADMIN' && !isActive) {
        const others = await countOtherActiveAdmins(user.id);
        if (others === 0) {
          return res.status(400).json({
            error: 'Impossible de desactiver le dernier administrateur actif'
          });
        }
      }

      await user.update({ isActive });

      logger.info('Statut utilisateur modifie', {
        userId: user.id,
        isActive,
        by: req.user.id
      });

      res.json({
        message: isActive ? 'Utilisateur active' : 'Utilisateur desactive',
        user
      });
    } catch (error) {
      logger.error('Set user status error:', error);
      res.status(500).json({
        error: 'Erreur lors du changement de statut'
      });
    }
  },

  /**
   * Reinitialiser le mot de passe d'un utilisateur
   * PATCH /api/users/:id/reset-password
   */
  resetPassword: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = await User.findByPk(req.params.id);
      if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouve' });
      }

      // Le hachage est assure par le hook beforeUpdate du modele
      user.password = req.body.password;
      await user.save();

      logger.info('Mot de passe reinitialise', {
        userId: user.id,
        by: req.user.id
      });

      res.json({ message: 'Mot de passe reinitialise avec succes' });
    } catch (error) {
      logger.error('Reset password error:', error);
      res.status(500).json({
        error: 'Erreur lors de la reinitialisation du mot de passe'
      });
    }
  }
};

module.exports = userController;
