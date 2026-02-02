const jwt = require('jsonwebtoken');
const { User } = require('../models');
const jwtConfig = require('../config/jwt');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

const authController = {
  /**
   * Inscription d'un nouvel utilisateur
   * POST /api/auth/register
   */
  register: async (req, res) => {
    try {
      // Validation des donnees
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, firstName, lastName, role, phone } = req.body;

      // Verifier si l'email existe deja
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).json({
          error: 'Cet email est deja utilise'
        });
      }

      // Creer l'utilisateur
      const user = await User.create({
        email,
        password,
        firstName,
        lastName,
        role,
        phone
      });

      logger.info('Nouvel utilisateur cree', { userId: user.id, email: user.email });

      res.status(201).json({
        message: 'Utilisateur cree avec succes',
        user: user.toJSON()
      });
    } catch (error) {
      logger.error('Register error:', error);
      res.status(500).json({
        error: 'Erreur lors de l\'inscription'
      });
    }
  },

  /**
   * Connexion d'un utilisateur
   * POST /api/auth/login
   */
  login: async (req, res) => {
    try {
      // Validation
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      // Rechercher l'utilisateur
      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res.status(401).json({
          error: 'Email ou mot de passe incorrect'
        });
      }

      // Verifier si le compte est actif
      if (!user.isActive) {
        return res.status(401).json({
          error: 'Compte desactive. Contactez l\'administrateur.'
        });
      }

      // Verifier le mot de passe
      const isValidPassword = await user.validatePassword(password);
      if (!isValidPassword) {
        return res.status(401).json({
          error: 'Email ou mot de passe incorrect'
        });
      }

      // Generer le token d'acces
      const token = jwt.sign(
        { userId: user.id, role: user.role },
        jwtConfig.secret,
        { expiresIn: jwtConfig.expiresIn }
      );

      // Generer le refresh token
      const refreshToken = jwt.sign(
        { userId: user.id },
        jwtConfig.secret,
        { expiresIn: jwtConfig.refreshExpiresIn }
      );

      logger.info('Utilisateur connecte', { userId: user.id, email: user.email });

      res.json({
        message: 'Connexion reussie',
        token,
        refreshToken,
        user: user.toJSON()
      });
    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({
        error: 'Erreur lors de la connexion'
      });
    }
  },

  /**
   * Obtenir le profil de l'utilisateur connecte
   * GET /api/auth/profile
   */
  getProfile: async (req, res) => {
    try {
      res.json({
        user: req.user.toJSON()
      });
    } catch (error) {
      logger.error('Profile error:', error);
      res.status(500).json({
        error: 'Erreur lors de la recuperation du profil'
      });
    }
  },

  /**
   * Rafraichir le token d'acces
   * POST /api/auth/refresh-token
   */
  refreshToken: async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          error: 'Refresh token requis'
        });
      }

      // Verifier le refresh token
      const decoded = jwt.verify(refreshToken, jwtConfig.secret);

      // Recuperer l'utilisateur
      const user = await User.findByPk(decoded.userId);
      if (!user || !user.isActive) {
        return res.status(401).json({
          error: 'Utilisateur non trouve ou inactif'
        });
      }

      // Generer un nouveau token d'acces
      const newToken = jwt.sign(
        { userId: user.id, role: user.role },
        jwtConfig.secret,
        { expiresIn: jwtConfig.expiresIn }
      );

      res.json({
        token: newToken
      });
    } catch (error) {
      logger.error('Refresh token error:', error);

      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Refresh token expire, veuillez vous reconnecter'
        });
      }

      res.status(401).json({
        error: 'Refresh token invalide'
      });
    }
  },

  /**
   * Modifier le mot de passe
   * PUT /api/auth/change-password
   */
  changePassword: async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      // Verifier le mot de passe actuel
      const isValid = await req.user.validatePassword(currentPassword);
      if (!isValid) {
        return res.status(400).json({
          error: 'Mot de passe actuel incorrect'
        });
      }

      // Mettre a jour le mot de passe
      req.user.password = newPassword;
      await req.user.save();

      logger.info('Mot de passe modifie', { userId: req.user.id });

      res.json({
        message: 'Mot de passe modifie avec succes'
      });
    } catch (error) {
      logger.error('Change password error:', error);
      res.status(500).json({
        error: 'Erreur lors de la modification du mot de passe'
      });
    }
  }
};

module.exports = authController;
