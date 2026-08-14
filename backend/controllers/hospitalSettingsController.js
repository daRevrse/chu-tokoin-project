const fs = require('fs');
const path = require('path');
const { validationResult } = require('express-validator');
const {
  getHospitalSettings,
  invalidateHospitalSettingsCache
} = require('../services/hospitalSettingsService');
const { APP_IDENTITY } = require('../utils/appIdentity');
const logger = require('../utils/logger');

// Champs que l'administrateur de l'etablissement peut modifier. Tout ce qui
// touche a l'identite du produit (H360) en est volontairement absent.
const EDITABLE_FIELDS = [
  'name',
  'fullName',
  'address',
  'city',
  'country',
  'phone',
  'email',
  'website',
  'documentFooter'
];

/**
 * Supprime le fichier d'un ancien logo.
 * Meme precaution que pour les photos de profil : on verifie que le chemin
 * reconstruit reste dans le dossier des logos.
 */
const removeLogoFile = (logoUrl) => {
  if (!logoUrl) return;

  try {
    const uploadDir = process.env.UPLOAD_PATH || './uploads';
    const brandingDir = path.resolve(uploadDir, 'branding');
    const filePath = path.resolve(uploadDir, logoUrl.replace(/^\/uploads\//, ''));

    if (!filePath.startsWith(brandingDir + path.sep)) return;
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (error) {
    // Un fichier deja absent ne doit pas faire echouer la requete
    logger.warn('Suppression de l\'ancien logo impossible', { logoUrl });
  }
};

const hospitalSettingsController = {
  /**
   * Identite de l'etablissement et du logiciel
   * GET /api/settings/hospital
   *
   * Route publique : la page de connexion, le portail patient et les tickets
   * en ont besoin avant toute authentification. Ces informations figurent de
   * toute facon sur les documents remis aux patients.
   */
  get: async (req, res) => {
    try {
      const settings = await getHospitalSettings();

      res.json({
        hospital: settings.toJSON(),
        app: APP_IDENTITY
      });
    } catch (error) {
      logger.error('Get hospital settings error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation de l\'identite de l\'etablissement' });
    }
  },

  /**
   * Mettre a jour l'identite de l'etablissement
   * PUT /api/settings/hospital
   */
  update: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const settings = await getHospitalSettings();

      // Seuls les champs presents dans la requete sont touches ; une chaine
      // vide vaut "non renseigne" et repasse le champ a null.
      const updates = {};
      EDITABLE_FIELDS.forEach((field) => {
        if (req.body[field] === undefined) return;
        const value = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field];
        updates[field] = value === '' ? null : value;
      });

      if (updates.name === null) {
        return res.status(400).json({ error: 'Le nom de l\'etablissement est requis' });
      }

      await settings.update(updates);
      invalidateHospitalSettingsCache();

      logger.info('Identite de l\'etablissement mise a jour', { by: req.user.id });
      res.json({
        message: 'Identite de l\'etablissement mise a jour',
        hospital: settings.toJSON()
      });
    } catch (error) {
      logger.error('Update hospital settings error:', error);
      res.status(500).json({ error: 'Erreur lors de la mise a jour de l\'identite de l\'etablissement' });
    }
  },

  /**
   * Televerser le logo de l'etablissement
   * POST /api/settings/hospital/logo  (multipart, champ "logo")
   */
  uploadLogo: async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier recu' });
      }

      const settings = await getHospitalSettings();

      // Supprimer l'ancien logo pour ne pas accumuler de fichiers orphelins
      removeLogoFile(settings.logoUrl);

      await settings.update({ logoUrl: `/uploads/branding/${req.file.filename}` });
      invalidateHospitalSettingsCache();

      logger.info('Logo de l\'etablissement mis a jour', { by: req.user.id });
      res.json({
        message: 'Logo mis a jour',
        hospital: settings.toJSON()
      });
    } catch (error) {
      logger.error('Upload hospital logo error:', error);
      res.status(500).json({ error: 'Erreur lors de l\'envoi du logo' });
    }
  },

  /**
   * Retirer le logo de l'etablissement
   * DELETE /api/settings/hospital/logo
   */
  deleteLogo: async (req, res) => {
    try {
      const settings = await getHospitalSettings();

      if (!settings.logoUrl) {
        return res.status(400).json({ error: 'Aucun logo a supprimer' });
      }

      removeLogoFile(settings.logoUrl);
      await settings.update({ logoUrl: null });
      invalidateHospitalSettingsCache();

      logger.info('Logo de l\'etablissement supprime', { by: req.user.id });
      res.json({
        message: 'Logo supprime',
        hospital: settings.toJSON()
      });
    } catch (error) {
      logger.error('Delete hospital logo error:', error);
      res.status(500).json({ error: 'Erreur lors de la suppression du logo' });
    }
  }
};

module.exports = hospitalSettingsController;
