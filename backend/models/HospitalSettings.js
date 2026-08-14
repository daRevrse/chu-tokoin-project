const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Identite de l'etablissement qui exploite l'application : nom, logo et
 * coordonnees imprimes sur les tickets, ordonnances et rapports.
 *
 * Table a ligne unique (`settingsKey` = 'default'). Le logiciel etant vendu a
 * plusieurs hopitaux, ces valeurs sont administrables ; l'identite du produit
 * lui-meme (H360) reste figee dans utils/appIdentity.js.
 */
const HospitalSettings = sequelize.define('HospitalSettings', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  // Garantit l'unicite de la ligne de configuration
  settingsKey: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'default'
  },
  // Nom d'usage, affiche dans l'interface et en tete des documents
  name: {
    type: DataTypes.STRING(150),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Le nom de l\'etablissement est requis'
      }
    }
  },
  // Denomination complete (raison sociale), imprimee sous le nom d'usage
  fullName: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  address: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  country: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  phone: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  email: {
    type: DataTypes.STRING(150),
    allowNull: true,
    validate: {
      isEmailOrEmpty(value) {
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          throw new Error('Email invalide');
        }
      }
    }
  },
  website: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  // Chemin servi par /uploads (ex: /uploads/branding/xxx.png)
  logoUrl: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  // Mention libre imprimee en pied des documents (agrement, RCCM, ...)
  documentFooter: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'hospital_settings',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['settingsKey'], name: 'settings_key' }
  ]
});

module.exports = HospitalSettings;
