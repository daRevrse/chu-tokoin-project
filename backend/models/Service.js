const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Service hospitalier realisant des examens (Laboratoire, Imagerie medicale,
 * Cardiologie, ...). Un service regroupe des categories d'examens, des examens
 * et le personnel qui les execute.
 */
const Service = sequelize.define('Service', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  // Unicite declaree via un index nomme (voir `indexes` plus bas)
  code: {
    type: DataTypes.STRING(30),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Le code du service est requis'
      }
    }
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Le nom du service est requis'
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
  tableName: 'services',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['code'], name: 'code' }
  ]
});

module.exports = Service;
