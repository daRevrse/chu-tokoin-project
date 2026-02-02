const { DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: {
        msg: 'Email invalide'
      }
    }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      len: {
        args: [6, 255],
        msg: 'Le mot de passe doit contenir au moins 6 caracteres'
      }
    }
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
  role: {
    type: DataTypes.ENUM('DOCTOR', 'CASHIER', 'RADIOLOGIST', 'LAB_TECHNICIAN', 'ADMIN'),
    allowNull: false,
    validate: {
      isIn: {
        args: [['DOCTOR', 'CASHIER', 'RADIOLOGIST', 'LAB_TECHNICIAN', 'ADMIN']],
        msg: 'Role invalide'
      }
    }
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'users',
  timestamps: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    }
  }
});

// Methode pour valider le mot de passe
User.prototype.validatePassword = async function(password) {
  return bcrypt.compare(password, this.password);
};

// Methode pour exclure le mot de passe lors de la serialisation
User.prototype.toJSON = function() {
  const values = { ...this.get() };
  delete values.password;
  return values;
};

module.exports = User;
