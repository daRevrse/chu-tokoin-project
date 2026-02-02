const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Patient = sequelize.define('Patient', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  patientNumber: {
    type: DataTypes.STRING(20),
    unique: true,
    allowNull: false
  },
  firstName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Le prenom est requis'
      }
    }
  },
  lastName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Le nom est requis'
      }
    }
  },
  dateOfBirth: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    validate: {
      isDate: {
        msg: 'Date de naissance invalide'
      }
    }
  },
  gender: {
    type: DataTypes.ENUM('M', 'F'),
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      isEmail: {
        msg: 'Email invalide'
      }
    }
  }
}, {
  tableName: 'patients',
  timestamps: true,
  hooks: {
    beforeValidate: async (patient) => {
      // Generation automatique du numero patient si non defini
      if (!patient.patientNumber) {
        const count = await Patient.count();
        const year = new Date().getFullYear();
        const timestamp = Date.now().toString().slice(-4);
        patient.patientNumber = `PAT-${year}-${String(count + 1).padStart(4, '0')}${timestamp}`;
      }
    }
  }
});

// Methode pour obtenir le nom complet
Patient.prototype.getFullName = function() {
  return `${this.lastName} ${this.firstName}`;
};

// Methode pour calculer l'age
Patient.prototype.getAge = function() {
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

module.exports = Patient;
