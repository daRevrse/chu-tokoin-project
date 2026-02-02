const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PrescriptionExam = sequelize.define('PrescriptionExam', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  prescriptionId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'prescriptions',
      key: 'id'
    }
  },
  examId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'exams',
      key: 'id'
    }
  },
  quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    validate: {
      min: 1
    }
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'PAID', 'IN_PROGRESS', 'COMPLETED'),
    defaultValue: 'PENDING'
  },
  performedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  performedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'prescription_exams',
  timestamps: true
});

module.exports = PrescriptionExam;
