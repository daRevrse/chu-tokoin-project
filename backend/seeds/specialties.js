/**
 * Mise en place des specialites cliniques.
 *
 * Idempotent : relançable sans creer de doublon ni ecraser une specialite
 * modifiee depuis l'administration. Il ne supprime rien.
 *
 *   npm run seed:specialties
 *
 * Aucun tarif n'est cree. Les frais de consultation different d'un
 * etablissement a l'autre et changent par arrete : les inventer ici reviendrait
 * a facturer des patients a un montant que personne n'a decide. La grille se
 * saisit depuis l'administration ; tant qu'elle est vide, aucune consultation
 * n'est facturee et le circuit fonctionne comme avant.
 */
require('dotenv').config();

const { Specialty, syncDatabase } = require('../models');

// Specialites courantes d'un CHU. Les autres s'ajoutent depuis l'interface
// d'administration sans toucher au code.
const SPECIALTIES = [
  { code: 'GENERALE', name: 'Médecine générale', color: '#1976d2', displayOrder: 1 },
  { code: 'PEDIATRIE', name: 'Pédiatrie', color: '#2e7d32', displayOrder: 2 },
  { code: 'GYNECO', name: 'Gynécologie-Obstétrique', color: '#c2185b', displayOrder: 3 },
  { code: 'CHIRURGIE', name: 'Chirurgie générale', color: '#ed6c02', displayOrder: 4 },
  { code: 'CARDIOLOGIE', name: 'Cardiologie', color: '#d32f2f', displayOrder: 5 },
  { code: 'DERMATOLOGIE', name: 'Dermatologie', color: '#7b1fa2', displayOrder: 6 },
  { code: 'ORL', name: 'Oto-rhino-laryngologie', color: '#0288d1', displayOrder: 7 },
  { code: 'OPHTALMO', name: 'Ophtalmologie', color: '#00796b', displayOrder: 8 }
];

const seedSpecialties = async () => {
  const summary = { creees: 0, existantes: 0 };

  for (const definition of SPECIALTIES) {
    const [, created] = await Specialty.findOrCreate({
      where: { code: definition.code },
      defaults: definition
    });

    if (created) summary.creees += 1;
    else summary.existantes += 1;
  }

  return summary;
};

if (require.main === module) {
  (async () => {
    try {
      await syncDatabase();
      const summary = await seedSpecialties();

      console.log('\n--- Mise en place des specialites ---');
      console.log(`Specialites : ${summary.creees} creees, ${summary.existantes} deja presentes`);
      console.log('\nPensez a saisir la grille des frais de consultation depuis');
      console.log('Administration > Specialites et tarifs. Sans tarif, aucune');
      console.log('consultation n\'est facturee.');

      process.exit(0);
    } catch (error) {
      console.error('Echec de la mise en place des specialites :', error.message);
      process.exit(1);
    }
  })();
}

module.exports = { seedSpecialties, SPECIALTIES };
