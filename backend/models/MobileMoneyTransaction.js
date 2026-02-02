const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MobileMoneyTransaction = sequelize.define('MobileMoneyTransaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  paymentId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'payments',
      key: 'id'
    }
  },
  provider: {
    type: DataTypes.ENUM('TMONEY', 'FLOOZ'),
    allowNull: false
  },
  phoneNumber: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  transactionId: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'ID de transaction fourni par le provider'
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED'),
    defaultValue: 'PENDING'
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  callbackReceived: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  callbackData: {
    type: DataTypes.JSON,
    allowNull: true
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'mobile_money_transactions',
  timestamps: true
});

module.exports = MobileMoneyTransaction;
