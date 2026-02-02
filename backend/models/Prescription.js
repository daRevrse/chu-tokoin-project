const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Prescription = sequelize.define('Prescription', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  prescriptionNumber: {
    type: DataTypes.STRING(30),
    unique: true,
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
  doctorId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  prescriptionDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'PAID', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'),
    defaultValue: 'PENDING'
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'prescriptions',
  timestamps: true,
  hooks: {
    beforeValidate: async (prescription) => {
      // Generation automatique du numero de prescription si non defini
      if (!prescription.prescriptionNumber) {
        const count = await Prescription.count();
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const timestamp = Date.now().toString().slice(-4);
        prescription.prescriptionNumber = `PRE-${year}${month}-${String(count + 1).padStart(4, '0')}${timestamp}`;
      }
    }
  }
});

module.exports = Prescription;
