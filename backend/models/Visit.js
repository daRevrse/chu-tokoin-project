const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Passage d'un patient a l'etablissement (une venue).
 *
 * Patient = identite permanente ; Visit = une venue datee. Un patient qui
 * revient ne genere pas un nouveau dossier, mais un nouveau passage avec un
 * nouveau numero de ticket.
 *
 * Le statut s'arrete volontairement a la fin de la consultation : l'aval
 * (caisse, services, resultats) est deja modelise par Prescription.status, et
 * dupliquer ces etats ici imposerait de maintenir deux machines a etats
 * synchronisees.
 */
const Visit = sequelize.define('Visit', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  patientId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'patients',
      key: 'id'
    }
  },
  // Numero d'affichage remis a zero chaque jour. Jamais une cle : la cle est
  // `id`. Unique uniquement combine a `visitDate` (voir `indexes` plus bas).
  ticketNumber: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  visitDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('WAITING', 'IN_CONSULT', 'COMPLETED', 'CANCELLED'),
    defaultValue: 'WAITING'
  },
  // Motif d'entree dans le circuit. RESULT_REVIEW = le patient revient chercher
  // l'interpretation d'examens deja realises. Meme file et meme ticket qu'une
  // consultation, mais le medecin doit pouvoir distinguer les deux : sans cela
  // les retours entrent en concurrence avec les malades qui arrivent.
  visitType: {
    type: DataTypes.ENUM('CONSULTATION', 'RESULT_REVIEW'),
    defaultValue: 'CONSULTATION',
    allowNull: false
  },
  // Prescription dont le patient vient chercher les resultats. A ne pas
  // confondre avec l'association inverse (Visit.hasMany(Prescription)), qui
  // designe les ordonnances *produites* pendant la consultation.
  reviewedPrescriptionId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'prescriptions',
      key: 'id'
    }
  },
  // Specialite vers laquelle l'accueil oriente le patient. Nullable : les
  // passages anterieurs aux specialites n'en ont pas, et un etablissement qui
  // n'en declare aucune continue de fonctionner avec une file unique.
  specialtyId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'specialties',
      key: 'id'
    }
  },
  priority: {
    type: DataTypes.ENUM('NORMAL', 'URGENT'),
    defaultValue: 'NORMAL'
  },
  // Motif de visite saisi a l'accueil
  reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  // --- Constantes relevees a l'accueil ---
  // Elles vivent sur le passage et non sur le patient : ce sont des mesures
  // datees, qui changent a chaque venue.
  weightKg: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true
  },
  heightCm: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  temperatureC: {
    type: DataTypes.DECIMAL(4, 1),
    allowNull: true
  },
  bloodPressureSys: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  bloodPressureDia: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  pulseBpm: {
    type: DataTypes.INTEGER,
    allowNull: true
  },

  // --- Tracabilite ---
  registeredBy: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  // Renseigne au moment de la prise en charge
  doctorId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  cancelReason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'visits',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['visitDate', 'ticketNumber'], name: 'visits_date_ticket' },
    { fields: ['visitDate', 'status'], name: 'visits_date_status' },
    { fields: ['visitDate', 'specialtyId'], name: 'visits_date_specialty' },
    { fields: ['patientId'], name: 'visits_patient' }
  ]
});

// Libelle d'affichage du ticket, ex. "N° 042"
Visit.prototype.getTicketLabel = function() {
  return `N° ${String(this.ticketNumber).padStart(3, '0')}`;
};

module.exports = Visit;
