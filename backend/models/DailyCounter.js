const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Compteur journalier des numeros de passage.
 *
 * Une ligne par jour d'activite : la remise a zero est implicite, une nouvelle
 * date cree une nouvelle ligne qui repart a 1. Aucune tache planifiee n'est
 * necessaire.
 *
 * L'increment se fait exclusivement via services/ticketService.js, qui utilise
 * un UPSERT atomique : `Model.count()` ou un `SELECT` suivi d'un `UPDATE`
 * donneraient le meme numero a deux agents d'accueil enregistrant simultanement.
 */
const DailyCounter = sequelize.define('DailyCounter', {
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
  tableName: 'daily_counters',
  timestamps: true
});

module.exports = DailyCounter;
