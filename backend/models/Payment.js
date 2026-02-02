const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  paymentNumber: {
    type: DataTypes.STRING(30),
    unique: true,
    allowNull: false
  },
  prescriptionId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'prescriptions',
      key: 'id'
    }
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  paymentMethod: {
    type: DataTypes.ENUM('CASH', 'MOBILE_MONEY', 'CARD'),
    defaultValue: 'CASH'
  },
  paymentStatus: {
    type: DataTypes.ENUM('PENDING', 'SUCCESS', 'FAILED'),
    defaultValue: 'PENDING'
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
  hooks: {
    beforeValidate: async (payment) => {
      // Generation automatique du numero de paiement si non defini
      if (!payment.paymentNumber) {
        const count = await Payment.count();
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const timestamp = Date.now().toString().slice(-4);
        payment.paymentNumber = `PAY-${year}${month}${day}-${String(count + 1).padStart(4, '0')}${timestamp}`;
      }
    }
  }
});

module.exports = Payment;
