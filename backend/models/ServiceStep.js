const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Etape de realisation propre a un service.
 *
 * Le circuit metier est commun a tous les services
 * (prescription -> paiement -> realisation -> resultat -> validation), seules
 * les etapes internes de realisation different : le laboratoire prelevе puis
 * analyse, l'imagerie planifie puis acquiert des images, la cardiologie
 * enregistre un trace puis l'interprete.
 *
 * Configurer ces etapes par service evite de dupliquer un module par
 * specialite : le moteur d'examens reste unique.
 */
const ServiceStep = sequelize.define('ServiceStep', {
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
        msg: 'Le code de l\'etape est requis'
      }
    }
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Le nom de l\'etape est requis'
      }
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Ordre d'enchainement des etapes au sein du service
  displayOrder: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  // Une etape facultative peut etre ignoree sans bloquer l'examen
  isRequired: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  // Etape a l'issue de laquelle le resultat est attendu (depot du compte rendu)
  producesResult: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'service_steps',
  timestamps: true,
  indexes: [
    {
      // Le code d'etape n'est unique qu'au sein de son service
      unique: true,
      fields: ['serviceId', 'code'],
      name: 'service_steps_service_code'
    }
  ]
});

module.exports = ServiceStep;
