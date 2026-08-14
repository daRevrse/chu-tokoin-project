const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Discipline clinique dans laquelle un medecin consulte (Medecine generale,
 * Pediatrie, Gynecologie, Cardiologie, ...).
 *
 * A ne pas confondre avec `Service`, qui designe un service *executant des
 * examens* (Laboratoire, Imagerie medicale). Les deux notions portent parfois
 * le meme nom mais n'ont pas la meme fonction : une specialite oriente une file
 * d'attente et porte un tarif de consultation, un service porte des examens et
 * le personnel qui les realise. Les confondre reviendrait a faire payer une
 * consultation au tarif d'un prelevement.
 */
const Specialty = sequelize.define('Specialty', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  // Unicite declaree via un index nomme (voir `indexes` plus bas) : avec
  // `unique: true`, sync({ alter }) recree un index a chaque demarrage.
  code: {
    type: DataTypes.STRING(30),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Le code de la specialite est requis'
      }
    }
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Le nom de la specialite est requis'
      }
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Couleur d'accent utilisee par l'interface (format hexadecimal)
  color: {
    type: DataTypes.STRING(20),
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
  tableName: 'specialties',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['code'], name: 'specialties_code' }
  ]
});

module.exports = Specialty;
