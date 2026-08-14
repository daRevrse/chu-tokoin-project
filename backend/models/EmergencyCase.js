const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Passage au service d'accueil des urgences.
 *
 * Entite distincte de `Visit`, et non un `Visit` avec un drapeau, parce que les
 * deux ne suivent pas les memes regles :
 *
 * | | Passage ambulatoire | Dossier d'urgence |
 * |---|---|---|
 * | Identite | connue avant l'ouverture | parfois inconnue, regularisee apres |
 * | Horaire | heures d'ouverture de l'accueil | 24h/24 |
 * | Ordre d'appel | numero d'arrivee | gravite du triage |
 * | Paiement | du avant la consultation | jamais bloquant |
 * | Fin | fin de consultation | mode de sortie (domicile, hospitalisation, transfert, deces) |
 *
 * Plaquer ces regles sur `Visit` aurait impose des exceptions partout dans le
 * circuit ambulatoire, pour un cas qui n'est pas une exception mais un autre
 * metier.
 */
const EmergencyCase = sequelize.define('EmergencyCase', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  // Unicite declaree via un index nomme (voir `indexes` plus bas)
  caseNumber: {
    type: DataTypes.STRING(30),
    allowNull: false
  },

  // --- Identite ---
  // Nullable, et c'est le point central de ce modele : un patient inconscient
  // amene par une ambulance doit pouvoir etre pris en charge avant d'etre
  // identifie. L'identite est rattachee ensuite, sans rien perdre de ce qui a
  // ete fait entre-temps.
  patientId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'patients',
      key: 'id'
    }
  },
  // Designation provisoire tant que l'identite est inconnue, ex. "Homme, environ
  // 40 ans, amene inconscient". Elle sert a nommer le patient dans la file et sur
  // les documents ; elle n'est jamais promue en identite reelle.
  provisionalLabel: {
    type: DataTypes.STRING(150),
    allowNull: true
  },

  // --- Arrivee ---
  arrivalAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  arrivalMode: {
    type: DataTypes.ENUM('WALK_IN', 'AMBULANCE', 'REFERRAL', 'LAW_ENFORCEMENT', 'OTHER'),
    allowNull: false,
    defaultValue: 'WALK_IN'
  },
  chiefComplaint: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  // --- Triage ---
  // Echelle a 5 niveaux, du plus grave au moins grave :
  //   1 reanimation immediate     2 tres urgent      3 urgent
  //   4 peu urgent                5 non urgent
  // Nulle tant que le triage n'a pas eu lieu : un dossier non cote est traite
  // comme le plus prioritaire, faute de savoir.
  triageLevel: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: { args: [1], msg: 'Niveau de triage invalide (1 a 5)' },
      max: { args: [5], msg: 'Niveau de triage invalide (1 a 5)' }
    }
  },
  triagedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  triagedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  triageNotes: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  // --- Constantes relevees au triage ---
  weightKg: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
  heightCm: { type: DataTypes.INTEGER, allowNull: true },
  temperatureC: { type: DataTypes.DECIMAL(4, 1), allowNull: true },
  bloodPressureSys: { type: DataTypes.INTEGER, allowNull: true },
  bloodPressureDia: { type: DataTypes.INTEGER, allowNull: true },
  pulseBpm: { type: DataTypes.INTEGER, allowNull: true },
  // Absente du passage ambulatoire, indispensable ici : c'est l'une des
  // constantes qui font basculer un triage d'un niveau a l'autre.
  oxygenSaturation: { type: DataTypes.INTEGER, allowNull: true },

  // --- Prise en charge ---
  status: {
    type: DataTypes.ENUM(
      'AWAITING_TRIAGE',
      'WAITING',
      'IN_CARE',
      'DISCHARGED',
      'LEFT_WITHOUT_CARE'
    ),
    allowNull: false,
    defaultValue: 'AWAITING_TRIAGE'
  },
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

  // --- Sortie ---
  // Un passage aux urgences ne se termine pas, il s'oriente. Le mode de sortie
  // est ce que le service doit pouvoir compter en fin de journee.
  outcome: {
    type: DataTypes.ENUM('HOME', 'ADMISSION', 'TRANSFER', 'AGAINST_ADVICE', 'DECEASED'),
    allowNull: true
  },
  outcomeNotes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  completedAt: {
    type: DataTypes.DATE,
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
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'emergency_cases',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['caseNumber'], name: 'emergency_cases_number' },
    { fields: ['status', 'triageLevel'], name: 'emergency_cases_status_triage' },
    { fields: ['patientId'], name: 'emergency_cases_patient' },
    { fields: ['arrivalAt'], name: 'emergency_cases_arrival' }
  ]
});

// Libelle d'affichage : identite reelle si elle est connue, designation
// provisoire sinon. Les ecrans ne doivent jamais avoir a arbitrer eux-memes.
EmergencyCase.prototype.getDisplayName = function() {
  if (this.patient) {
    return `${this.patient.lastName} ${this.patient.firstName}`;
  }
  return this.provisionalLabel || 'Patient non identifie';
};

module.exports = EmergencyCase;
