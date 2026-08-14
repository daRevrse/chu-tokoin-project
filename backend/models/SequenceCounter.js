const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Compteur journalier generique, identifie par une cle.
 *
 * Meme principe que `daily_counters` (numeros de passage) : une ligne par cle et
 * par jour, remise a zero implicite puisqu'une nouvelle date cree une nouvelle
 * ligne. Il sert aujourd'hui a numeroter les factures ('INVOICE').
 *
 * Pourquoi une seconde table plutot que d'ajouter une colonne `counterKey` a
 * `daily_counters` : cette colonne devrait entrer dans la cle primaire, et
 * sync({ alter }) ne sait pas modifier une cle primaire sur une table qui porte
 * deja des donnees. Une table neuve evite une migration manuelle sur les
 * installations en service.
 *
 * L'increment passe exclusivement par services/sequenceService.js.
 */
const SequenceCounter = sequelize.define('SequenceCounter', {
  counterKey: {
    type: DataTypes.STRING(30),
    primaryKey: true
  },
  counterDate: {
    type: DataTypes.DATEONLY,
    primaryKey: true
  },
  lastValue: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'sequence_counters',
  timestamps: true
});

module.exports = SequenceCounter;
