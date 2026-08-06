const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Exam = sequelize.define('Exam', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  // L'unicite est declaree plus bas via un index nomme : declaree ici avec
  // `unique: true`, sync({ alter }) recreerait un index a chaque demarrage
  // jusqu'a saturer la limite de 64 index de MySQL.
  code: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  // Ancienne categorisation figee. Conservee le temps de la transition vers
  // les services dynamiques : elle reste alimentee pour que les ecrans et
  // rapports non encore migres continuent de fonctionner.
  category: {
    type: DataTypes.ENUM('RADIOLOGY', 'LABORATORY'),
    allowNull: false
  },
  // Service executant l'examen (remplace progressivement `category`)
  serviceId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  // Sous-categorie optionnelle a l'interieur du service
  categoryId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: {
        args: [0],
        msg: 'Le prix doit etre positif'
      }
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'exams',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['code'], name: 'code' }
  ]
});

module.exports = Exam;
