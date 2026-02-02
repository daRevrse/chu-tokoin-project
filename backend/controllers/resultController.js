const { Result, PrescriptionExam, Prescription, Patient, Exam, User } = require('../models');
const { getFileType } = require('../middleware/upload');
const { validationResult } = require('express-validator');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

const resultController = {
  /**
   * Upload d'un resultat
   * POST /api/results
   */
  upload: async (req, res) => {
    try {
      const { prescriptionExamId, comments, conclusion } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: 'Fichier requis' });
      }

      if (!prescriptionExamId) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'ID de l\'examen requis' });
      }

      // Verifier que l'examen existe
      const prescriptionExam = await PrescriptionExam.findByPk(prescriptionExamId, {
        include: [{ model: Exam, as: 'exam' }]
      });

      if (!prescriptionExam) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: 'Examen non trouve' });
      }

      // Verifier les permissions selon le role
      if (req.user.role !== 'ADMIN') {
        const userCategory = req.user.role === 'RADIOLOGIST' ? 'RADIOLOGY' : 'LABORATORY';
        if (prescriptionExam.exam.category !== userCategory) {
          fs.unlinkSync(req.file.path);
          return res.status(403).json({ error: 'Vous n\'etes pas autorise a uploader pour cet examen' });
        }
      }

      // Creer le resultat
      const result = await Result.create({
        prescriptionExamId,
        filePath: req.file.path,
        fileName: req.file.originalname,
        fileType: getFileType(req.file.mimetype),
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        uploadedBy: req.user.id,
        comments,
        conclusion
      });

      // Charger les relations
      const fullResult = await Result.findByPk(result.id, {
        include: [
          { model: User, as: 'uploader', attributes: ['id', 'firstName', 'lastName'] }
        ]
      });

      logger.info('Resultat uploade', {
        resultId: result.id,
        examId: prescriptionExamId,
        userId: req.user.id
      });

      res.status(201).json({
        message: 'Resultat uploade avec succes',
        result: fullResult
      });
    } catch (error) {
      // Supprimer le fichier en cas d'erreur
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      logger.error('Upload result error:', error);
      res.status(500).json({ error: 'Erreur lors de l\'upload du resultat' });
    }
  },

  /**
   * Obtenir les resultats d'un examen
   * GET /api/results/exam/:prescriptionExamId
   */
  getByExam: async (req, res) => {
    try {
      const { prescriptionExamId } = req.params;

      const results = await Result.findAll({
        where: { prescriptionExamId },
        include: [
          { model: User, as: 'uploader', attributes: ['id', 'firstName', 'lastName'] },
          { model: User, as: 'validator', attributes: ['id', 'firstName', 'lastName'] }
        ],
        order: [['uploadDate', 'DESC']]
      });

      res.json({ results });
    } catch (error) {
      logger.error('Get results error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation des resultats' });
    }
  },

  /**
   * Telecharger un fichier resultat
   * GET /api/results/:id/download
   */
  download: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await Result.findByPk(id);
      if (!result) {
        return res.status(404).json({ error: 'Resultat non trouve' });
      }

      // Verifier que le fichier existe
      if (!fs.existsSync(result.filePath)) {
        return res.status(404).json({ error: 'Fichier non trouve sur le serveur' });
      }

      res.download(result.filePath, result.fileName);
    } catch (error) {
      logger.error('Download result error:', error);
      res.status(500).json({ error: 'Erreur lors du telechargement' });
    }
  },

  /**
   * Valider un resultat (medecin)
   * PATCH /api/results/:id/validate
   */
  validate: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await Result.findByPk(id);
      if (!result) {
        return res.status(404).json({ error: 'Resultat non trouve' });
      }

      if (result.isValidated) {
        return res.status(400).json({ error: 'Resultat deja valide' });
      }

      result.isValidated = true;
      result.validatedBy = req.user.id;
      result.validatedAt = new Date();
      await result.save();

      const fullResult = await Result.findByPk(result.id, {
        include: [
          { model: User, as: 'uploader', attributes: ['id', 'firstName', 'lastName'] },
          { model: User, as: 'validator', attributes: ['id', 'firstName', 'lastName'] }
        ]
      });

      logger.info('Resultat valide', { resultId: id, validatedBy: req.user.id });

      res.json({
        message: 'Resultat valide',
        result: fullResult
      });
    } catch (error) {
      logger.error('Validate result error:', error);
      res.status(500).json({ error: 'Erreur lors de la validation' });
    }
  },

  /**
   * Mettre a jour les commentaires/conclusion
   * PUT /api/results/:id
   */
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { comments, conclusion } = req.body;

      const result = await Result.findByPk(id);
      if (!result) {
        return res.status(404).json({ error: 'Resultat non trouve' });
      }

      // Seul l'uploader ou un admin peut modifier
      if (result.uploadedBy !== req.user.id && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Non autorise a modifier ce resultat' });
      }

      await result.update({ comments, conclusion });

      res.json({
        message: 'Resultat mis a jour',
        result
      });
    } catch (error) {
      logger.error('Update result error:', error);
      res.status(500).json({ error: 'Erreur lors de la mise a jour' });
    }
  },

  /**
   * Supprimer un resultat
   * DELETE /api/results/:id
   */
  delete: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await Result.findByPk(id);
      if (!result) {
        return res.status(404).json({ error: 'Resultat non trouve' });
      }

      // Seul l'uploader ou un admin peut supprimer
      if (result.uploadedBy !== req.user.id && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Non autorise a supprimer ce resultat' });
      }

      // Supprimer le fichier physique
      if (fs.existsSync(result.filePath)) {
        fs.unlinkSync(result.filePath);
      }

      await result.destroy();

      logger.info('Resultat supprime', { resultId: id, deletedBy: req.user.id });

      res.json({ message: 'Resultat supprime' });
    } catch (error) {
      logger.error('Delete result error:', error);
      res.status(500).json({ error: 'Erreur lors de la suppression' });
    }
  }
};

module.exports = resultController;
