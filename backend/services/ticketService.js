const sequelize = require('../config/database');

/**
 * Attribution des numeros de passage.
 *
 * Le compteur est global par jour : un seul numero pour tout l'etablissement,
 * remis a zero chaque matin (une nouvelle date = une nouvelle ligne).
 */

/**
 * Reserve le prochain numero de la journee.
 *
 * Deroulement en deux temps, pour eviter un interblocage :
 *
 *  1. La ligne du jour est creee au besoin, en autocommit. `INSERT IGNORE`
 *     absorbe la course entre deux premiers passages simultanes.
 *  2. L'increment se fait dans une transaction dediee et tres courte. Elle ne
 *     sert qu'a garantir que l'UPDATE et le SELECT partagent la meme connexion,
 *     `LAST_INSERT_ID()` etant une valeur de session.
 *
 * Les deux etapes doivent rester separees : enchainer INSERT IGNORE puis UPDATE
 * dans une meme transaction fait passer le verrou de partage a exclusif sur la
 * ligne du compteur, ce qui provoque un deadlock des que plusieurs agents
 * d'accueil valident en meme temps.
 *
 * L'increment passe systematiquement par l'UPDATE, y compris pour le premier
 * ticket du jour : la table n'ayant pas de colonne AUTO_INCREMENT,
 * `LAST_INSERT_ID()` renverrait sinon un reliquat de la connexion.
 *
 * Le numero est reserve hors de la transaction metier de l'appelant : si la
 * creation du passage echoue ensuite, le numero est perdu. Un trou dans la
 * sequence est preferable a deux patients portant le meme numero.
 *
 * @param {string} businessDate - date metier YYYY-MM-DD
 * @returns {Promise<number>} le numero attribue
 */
const reserveTicketNumber = async (businessDate) => {
  await sequelize.query(
    `INSERT IGNORE INTO daily_counters (counterDate, lastValue, createdAt, updatedAt)
     VALUES (:businessDate, 0, NOW(), NOW())`,
    { replacements: { businessDate } }
  );

  return sequelize.transaction(async (transaction) => {
    await sequelize.query(
      `UPDATE daily_counters
          SET lastValue = LAST_INSERT_ID(lastValue + 1),
              updatedAt = NOW()
        WHERE counterDate = :businessDate`,
      { replacements: { businessDate }, transaction }
    );

    const [rows] = await sequelize.query(
      'SELECT LAST_INSERT_ID() AS ticketNumber',
      { transaction }
    );

    return Number(rows[0].ticketNumber);
  });
};

module.exports = { reserveTicketNumber };
