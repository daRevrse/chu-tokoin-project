const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { User, Service } = require('../models');
const jwtConfig = require('../config/jwt');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * Supprime le fichier d'une ancienne photo de profil.
 * Le chemin stocke est public (/uploads/avatars/x.png) : on le reconvertit en
 * chemin disque et on verifie qu'il reste bien dans le dossier des avatars,
 * pour qu'une valeur inattendue en base ne puisse pas viser un autre fichier.
 */
const removeAvatarFile = (avatarUrl) => {
  if (!avatarUrl) return;

  try {
    const uploadDir = process.env.UPLOAD_PATH || './uploads';
    const avatarsDir = path.resolve(uploadDir, 'avatars');
    const filePath = path.resolve(uploadDir, avatarUrl.replace(/^\/uploads\//, ''));

    if (!filePath.startsWith(avatarsDir + path.sep)) return;
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (error) {
    // Un fichier deja absent ne doit pas faire echouer la requete
    logger.warn('Suppression de l\'ancienne photo de profil impossible', { avatarUrl });
  }
};

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

      // Rechercher l'utilisateur, avec son service d'affectation : l'interface
      // affiche le nom du service plutot que de le deduire du role.
      const user = await User.findOne({
        where: { email },
        include: [{ model: Service, as: 'service', attributes: ['id', 'code', 'name', 'color'] }]
      });
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
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

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
  },

  /**
   * Televerser sa photo de profil
   * POST /api/auth/avatar  (multipart, champ "avatar")
   */
  uploadAvatar: async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier recu' });
      }

      // Supprimer l'ancienne photo pour ne pas accumuler de fichiers orphelins
      removeAvatarFile(req.user.avatarUrl);

      req.user.avatarUrl = `/uploads/avatars/${req.file.filename}`;
      await req.user.save();

      logger.info('Photo de profil mise a jour', { userId: req.user.id });

      res.json({
        message: 'Photo de profil mise a jour',
        user: req.user.toJSON()
      });
    } catch (error) {
      logger.error('Upload avatar error:', error);
      res.status(500).json({
        error: 'Erreur lors de l\'envoi de la photo de profil'
      });
    }
  },

  /**
   * Supprimer sa photo de profil
   * DELETE /api/auth/avatar
   */
  deleteAvatar: async (req, res) => {
    try {
      if (!req.user.avatarUrl) {
        return res.status(400).json({ error: 'Aucune photo de profil a supprimer' });
      }

      removeAvatarFile(req.user.avatarUrl);

      req.user.avatarUrl = null;
      await req.user.save();

      logger.info('Photo de profil supprimee', { userId: req.user.id });

      res.json({
        message: 'Photo de profil supprimee',
        user: req.user.toJSON()
      });
    } catch (error) {
      logger.error('Delete avatar error:', error);
      res.status(500).json({
        error: 'Erreur lors de la suppression de la photo de profil'
      });
    }
  }
};

module.exports = authController;
