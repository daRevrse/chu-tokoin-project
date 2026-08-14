const sequelize = require('../config/database');

/**
 * Numerotation atomique, par cle et par jour.
 *
 * Le pattern historique du projet (`Model.count()` + timestamp) n'est pas sur en
 * concurrence : deux caissiers qui encaissent au meme instant obtiennent le meme
 * compte, donc le meme numero. Pour un numero de facture, qui est une reference
 * comptable, c'est inacceptable.
 *
 * Le deroulement en deux temps et la separation stricte des deux etapes
 * reprennent ceux de services/ticketService.js — voir ce fichier pour le detail
 * de l'interblocage evite.
 *
 * @param {string} counterKey - famille de numeros, ex. 'INVOICE'
 * @param {string} businessDate - date metier YYYY-MM-DD
 * @returns {Promise<number>} le numero attribue
 */
const reserveNumber = async (counterKey, businessDate) => {
  await sequelize.query(
    `INSERT IGNORE INTO sequence_counters (counterKey, counterDate, lastValue, createdAt, updatedAt)
     VALUES (:counterKey, :businessDate, 0, NOW(), NOW())`,
    { replacements: { counterKey, businessDate } }
  );

  return sequelize.transaction(async (transaction) => {
    await sequelize.query(
      `UPDATE sequence_counters
          SET lastValue = LAST_INSERT_ID(lastValue + 1),
              updatedAt = NOW()
        WHERE counterKey = :counterKey AND counterDate = :businessDate`,
      { replacements: { counterKey, businessDate }, transaction }
    );

    const [rows] = await sequelize.query(
      'SELECT LAST_INSERT_ID() AS value',
      { transaction }
    );

    return Number(rows[0].value);
  });
};

module.exports = { reserveNumber };
