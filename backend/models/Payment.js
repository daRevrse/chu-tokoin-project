const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { reserveNumber } = require('../services/sequenceService');
const { getBusinessDate } = require('../utils/businessDate');

/**
 * Versement effectue par un patient sur une facture.
 *
 * Un paiement n'est plus le reglement integral d'une prescription mais un
 * versement : plusieurs paiements peuvent porter sur la meme facture, ce qui
 * rend possible le reglement partiel, courant au guichet. Le solde et le statut
 * se lisent sur la facture, jamais ici.
 */
const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  // Unicite declaree via un index nomme (voir `indexes` plus bas)
  paymentNumber: {
    type: DataTypes.STRING(30),
    allowNull: false
  },
  // Facture reglee. Nullable uniquement pour les paiements anterieurs a la mise
  // en place de la facturation : tout nouveau paiement en porte une.
  invoiceId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'invoices',
      key: 'id'
    }
  },
  // Copie de `invoice.prescriptionId`, renseignee a la creation et jamais
  // modifiee ensuite.
  //
  // C'est une denormalisation assumee : le QR code, le portail patient, les
  // rapports et le module Mobile Money lisent tous `payment.prescription`. Les
  // faire passer par la facture aurait etendu le chantier a une dizaine de
  // fichiers sans rien apporter a l'utilisateur. La facture reste la source de
  // verite de ce qui est du et de ce qui est paye ; cette colonne n'est qu'un
  // raccourci de lecture. Nulle pour un paiement de consultation.
  prescriptionId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'prescriptions',
      key: 'id'
    }
  },
  // Montant de ce versement, pas du total du : il peut etre inferieur au
  // montant de la facture.
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  paymentMethod: {
    type: DataTypes.ENUM('CASH', 'MOBILE_MONEY', 'CARD'),
    defaultValue: 'CASH'
  },
  // CANCELLED est distinct de FAILED : FAILED signifie que l'operateur a refuse
  // la transaction, CANCELLED qu'un versement bien recu a ete annule par
  // l'etablissement (erreur de saisie). Les confondre rendrait impossible de
  // distinguer un incident technique d'une correction de caisse.
  paymentStatus: {
    type: DataTypes.ENUM('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'),
    defaultValue: 'PENDING'
  },
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
  cancelledAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  qrCode: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  qrCodeData: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  cashierId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  transactionReference: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  paymentDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'payments',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['paymentNumber'], name: 'paymentNumber' },
    { fields: ['invoiceId'], name: 'payments_invoice' }
  ],
  hooks: {
    beforeValidate: async (payment) => {
      if (!payment.paymentNumber) {
        // Compteur atomique plutot que `Payment.count()` : deux caissiers qui
        // encaissent au meme instant obtiennent le meme compte, donc le meme
        // numero. Le suffixe horodate qui masquait le probleme disparait avec.
        const businessDate = getBusinessDate();
        const value = await reserveNumber('PAYMENT', businessDate);
        payment.paymentNumber = `PAY-${businessDate.replace(/-/g, '')}-${String(value).padStart(4, '0')}`;
      }
    }
  }
});

module.exports = Payment;
