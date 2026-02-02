const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Result = sequelize.define('Result', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  prescriptionExamId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'prescription_exams',
      key: 'id'
    }
  },
  filePath: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  fileName: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  fileType: {
    type: DataTypes.ENUM('PDF', 'IMAGE', 'DICOM'),
    allowNull: false
  },
  mimeType: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  fileSize: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  uploadedBy: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  uploadDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  comments: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  conclusion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  isValidated: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  validatedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  validatedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'results',
  timestamps: true
});

module.exports = Result;
