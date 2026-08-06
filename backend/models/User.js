const { DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  // Unicite declaree via un index nomme (voir `indexes` plus bas) : avec
  // `unique: true`, sync({ alter }) recree un index a chaque demarrage.
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
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
  // TECHNICIAN est le role generique du personnel d'un service ; il permet
  // d'affecter du personnel aux nouveaux services (Cardiologie, ORL, ...).
  // RADIOLOGIST et LAB_TECHNICIAN sont conserves pour les comptes existants.
  role: {
    type: DataTypes.ENUM('DOCTOR', 'CASHIER', 'RADIOLOGIST', 'LAB_TECHNICIAN', 'TECHNICIAN', 'ADMIN'),
    allowNull: false,
    validate: {
      isIn: {
        args: [['DOCTOR', 'CASHIER', 'RADIOLOGIST', 'LAB_TECHNICIAN', 'TECHNICIAN', 'ADMIN']],
        msg: 'Role invalide'
      }
    }
  },
  // Service d'affectation du personnel technique
  serviceId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  // Chemin public de la photo de profil, ex. /uploads/avatars/<uuid>.png
  avatarUrl: {
    type: DataTypes.STRING(255),
    allowNull: true
  }
}, {
  tableName: 'users',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['email'], name: 'email' }
  ],
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
