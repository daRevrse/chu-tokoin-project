const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Ligne de facture : une prestation facturee et son prix.
 *
 * Le libelle et le prix unitaire sont *copies* au moment de l'emission, jamais
 * relus depuis le catalogue. Un tarif change ; une facture emise ne change pas.
 * Sans cette copie, modifier le prix d'un examen en administration reecrirait
 * retroactivement toutes les factures passees, et la caisse ne pourrait plus
 * justifier ce qu'elle a encaisse.
 *
 * Les references (`examId`, `prescriptionExamId`) ne servent donc qu'au
 * rapprochement et aux statistiques, pas au calcul du montant.
 */
const InvoiceLine = sequelize.define('InvoiceLine', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  invoiceId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'invoices',
      key: 'id'
    }
  },
  // Meme jeu de valeurs que Invoice.invoiceType : une facture peut a terme
  // melanger des natures (un sejour porte des nuitees et des actes).
  lineType: {
    type: DataTypes.ENUM('CONSULTATION', 'EMERGENCY', 'EXAM', 'BED', 'PROCEDURE', 'OTHER'),
    allowNull: false,
    defaultValue: 'OTHER'
  },
  label: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Le libelle de la ligne est requis'
      }
    }
  },
  unitPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: {
        args: [0],
        msg: 'Le prix unitaire ne peut pas etre negatif'
      }
    }
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    validate: {
      min: {
        args: [1],
        msg: 'La quantite doit etre au moins 1'
      }
    }
  },
  // Redondant avec unitPrice * quantity, et c'est voulu : le total de la facture
  // se calcule par somme SQL sur cette colonne, sans avoir a multiplier ligne a
  // ligne en memoire.
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },

  // --- Rapprochement avec le catalogue (aucun effet sur le montant) ---
  examId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  prescriptionExamId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  specialtyId: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  tableName: 'invoice_lines',
  timestamps: true,
  indexes: [
    { fields: ['invoiceId'], name: 'invoice_lines_invoice' }
  ],
  hooks: {
    // Le montant se deduit toujours du prix unitaire et de la quantite : le
    // laisser a la charge de l'appelant, c'est accepter qu'une facture finisse
    // par ne plus egaler la somme de ses lignes.
    beforeValidate: (line) => {
      line.amount = Number(line.unitPrice || 0) * Number(line.quantity || 1);
    }
  }
});

module.exports = InvoiceLine;
