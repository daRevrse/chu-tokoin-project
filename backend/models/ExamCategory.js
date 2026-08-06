const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Sous-categorie d'examens a l'interieur d'un service.
 * Exemples : Hematologie / Biochimie pour le Laboratoire,
 *            Radiographie / Scanner / IRM pour l'Imagerie medicale.
 *
 * Un service peut n'avoir aucune categorie : ses examens lui sont alors
 * rattaches directement (cas de la Cardiologie ou de l'ORL, par exemple).
 */
const ExamCategory = sequelize.define('ExamCategory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  serviceId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  code: {
    type: DataTypes.STRING(30),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Le code de la categorie est requis'
      }
    }
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Le nom de la categorie est requis'
      }
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  displayOrder: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'exam_categories',
  timestamps: true,
  indexes: [
    {
      // Le code n'est unique qu'au sein d'un service : deux services peuvent
      // avoir une categorie portant le meme code.
      unique: true,
      fields: ['serviceId', 'code']
    }
  ]
});

module.exports = ExamCategory;
