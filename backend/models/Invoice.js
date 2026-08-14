const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Facture : ce que l'etablissement reclame au patient a un moment du parcours.
 *
 * Pourquoi cette entite existe
 * ----------------------------
 * Avant elle, un paiement etait colle a une prescription (`Payment.prescriptionId`,
 * obligatoire). Ce raccourci interdisait tout ce qui se paie sans prescription,
 * a commencer par les frais de consultation, qui sont dus *avant* d'avoir vu le
 * medecin. Chaque nouveau motif de paiement (hospitalisation, bloc, actes)
 * aurait ajoute son propre chemin d'encaissement, donc sa propre facon de
 * calculer une recette : quatre chemins, quatre totaux, aucune reconciliation
 * possible.
 *
 * La facture est le point unique ou se rencontrent ce qui est du (les lignes) et
 * ce qui a ete verse (les paiements). Tout module futur y branche des lignes au
 * lieu d'inventer son propre encaissement.
 *
 * Une facture par moment d'encaissement, pas une par passage : le patient paie
 * sa consultation en arrivant, ses examens apres avoir vu le medecin. Ce sont
 * deux passages a la caisse, donc deux factures rattachees au meme `Visit`.
 *
 * `totalAmount` et `paidAmount` sont des totaux entretenus par
 * services/invoiceService.js a partir des lignes et des paiements ; ils ne sont
 * jamais ecrits directement par un controleur.
 */
const Invoice = sequelize.define('Invoice', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  // Unicite declaree via un index nomme (voir `indexes` plus bas)
  invoiceNumber: {
    type: DataTypes.STRING(30),
    allowNull: false
  },
  patientId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'patients',
      key: 'id'
    }
  },
  // Passage a l'origine de la facture. Nullable : les factures d'examens
  // rattachees a une prescription anterieure a l'accueil n'ont pas de passage.
  visitId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'visits',
      key: 'id'
    }
  },
  // Renseigne pour les factures d'examens uniquement.
  prescriptionId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'prescriptions',
      key: 'id'
    }
  },
  // Dossier d'urgence a l'origine de la facture. Un passage aux urgences n'a pas
  // de `Visit` : les deux circuits sont distincts (voir models/EmergencyCase.js).
  emergencyCaseId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'emergency_cases',
      key: 'id'
    }
  },
  // Nature de ce qui est facture. Sert a la caisse, qui traite les consultations
  // (patient debout devant le guichet, en attente de passer) et les examens
  // (patient qui sort de consultation) dans deux files distinctes.
  // Les valeurs BED et PROCEDURE sont declarees d'avance : ajouter une valeur a
  // un ENUM MySQL reecrit la table, autant ne pas le faire a chaque module.
  invoiceType: {
    type: DataTypes.ENUM('CONSULTATION', 'EMERGENCY', 'EXAM', 'BED', 'PROCEDURE', 'OTHER'),
    allowNull: false,
    defaultValue: 'OTHER'
  },
  status: {
    type: DataTypes.ENUM('ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'),
    allowNull: false,
    defaultValue: 'ISSUED'
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  // Somme des paiements aboutis. Le reste a payer se lit totalAmount - paidAmount.
  paidAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },

  // --- Regularisation ---
  // Une facture differee est une facture dont la contrepartie a ete delivree
  // avant d'etre payee. C'est la soupape qui permet de soigner une urgence sans
  // passer par la caisse : sans elle, la regle "pas de paiement, pas de soin"
  // deviendrait un blocage informatique sur un patient grave.
  isDeferred: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  deferredReason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  deferredBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  deferredAt: {
    type: DataTypes.DATE,
    allowNull: true
  },

  // --- Tracabilite ---
  issuedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  // Annulation = renoncement a la creance (gratuite accordee, erreur de saisie,
  // patient reparti). Le motif est obligatoire cote controleur : une facture qui
  // disparait sans explication est un trou de caisse.
  cancelReason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  cancelledBy: {
    type: DataTypes.UUID,
    allowNull: true,
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
  tableName: 'invoices',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['invoiceNumber'], name: 'invoices_number' },
    { fields: ['visitId'], name: 'invoices_visit' },
    { fields: ['prescriptionId'], name: 'invoices_prescription' },
    { fields: ['status', 'invoiceType'], name: 'invoices_status_type' }
  ]
});

// Reste a payer, en nombre. Les DECIMAL remontent en chaine depuis MySQL :
// les comparer sans conversion donne des resultats faux ("100" > "20" est faux).
Invoice.prototype.getBalance = function() {
  return Number(this.totalAmount) - Number(this.paidAmount);
};

Invoice.prototype.isSettled = function() {
  return this.status === 'PAID' || this.status === 'CANCELLED';
};

module.exports = Invoice;
