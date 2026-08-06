/**
 * Nettoyage des index UNIQUE dupliques.
 *
 * Sequelize, avec sync({ alter: true }), recree un index UNIQUE a chaque
 * demarrage pour les colonnes declarees `unique: true`. MySQL plafonnant a
 * 64 index par table, les tables finissent par saturer et toute modification
 * de schema echoue ("Too many keys specified").
 *
 * Ce script conserve un seul index par jeu de colonnes et supprime les autres.
 * Il ne touche ni a PRIMARY, ni aux cles etrangeres, ni aux donnees.
 *
 *   npm run db:cleanup-indexes
 */
require('dotenv').config();
const { sequelize } = require('../models');

// Index a ne jamais supprimer
const PROTECTED = new Set(['PRIMARY']);

const cleanupIndexes = async ({ dryRun = false } = {}) => {
  const [tables] = await sequelize.query('SHOW TABLES');
  const tableNames = tables.map((row) => Object.values(row)[0]);

  // Les index servant de support a une cle etrangere ne doivent pas etre
  // supprimes : MySQL refuserait, ou la contrainte perdrait son support.
  const [fks] = await sequelize.query(`
    SELECT DISTINCT CONSTRAINT_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL
  `);
  const fkNames = new Set(fks.map((r) => r.CONSTRAINT_NAME));

  const report = [];

  for (const table of tableNames) {
    const [rows] = await sequelize.query(`SHOW INDEX FROM \`${table}\``);

    // Regroupe les colonnes de chaque index, dans l'ordre
    const indexes = {};
    for (const r of rows) {
      (indexes[r.Key_name] ||= { cols: [], unique: r.Non_unique === 0 }).cols[r.Seq_in_index - 1] = r.Column_name;
    }

    // Regroupe les index partageant exactement le meme jeu de colonnes
    const groups = {};
    for (const [name, info] of Object.entries(indexes)) {
      if (PROTECTED.has(name) || fkNames.has(name)) continue;
      const key = `${info.unique ? 'U' : 'N'}:${info.cols.join(',')}`;
      (groups[key] ||= []).push(name);
    }

    const toDrop = [];
    for (const [key, names] of Object.entries(groups)) {
      if (names.length < 2) continue;
      // Conserve le nom le plus court (celui genere en premier, ex. "code"),
      // supprime les suffixes numerotes ajoutes ensuite (code_2, code_3, ...)
      const sorted = [...names].sort((a, b) => a.length - b.length || a.localeCompare(b));
      const keep = sorted[0];
      const drop = sorted.slice(1);
      toDrop.push(...drop);
      report.push({ table, colonnes: key.slice(2), conserve: keep, supprimes: drop.length });
    }

    if (!dryRun) {
      for (const name of toDrop) {
        await sequelize.query(`ALTER TABLE \`${table}\` DROP INDEX \`${name}\``);
      }
    }
  }

  return report;
};

if (require.main === module) {
  (async () => {
    try {
      const dryRun = process.argv.includes('--dry-run');
      const report = await cleanupIndexes({ dryRun });

      if (!report.length) {
        console.log('Aucun index duplique.');
      } else {
        console.log(dryRun ? '\n--- Simulation ---' : '\n--- Nettoyage des index ---');
        for (const r of report) {
          console.log(`${r.table} : "${r.colonnes}" -> ${r.supprimes} index supprime(s), "${r.conserve}" conserve`);
        }
      }
      process.exit(0);
    } catch (error) {
      console.error('Echec du nettoyage :', error.message);
      process.exit(1);
    }
  })();
}

module.exports = { cleanupIndexes };
