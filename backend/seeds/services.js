/**
 * Mise en place des services hospitaliers et rattachement des donnees existantes.
 *
 * Ce script est idempotent : il peut etre relance sans creer de doublon ni
 * ecraser un rattachement deja effectue manuellement. Il ne supprime rien.
 *
 *   npm run seed:services
 */
require('dotenv').config();

const { sequelize, Service, ExamCategory, ServiceStep, Exam, User, syncDatabase } = require('../models');

// Les cinq services du MVP conseilles pour un CHU.
// Les autres (Neurologie, ORL, Endoscopie, ...) sont ajoutables depuis
// l'interface d'administration sans toucher au code.
const SERVICES = [
  {
    code: 'LABORATOIRE',
    name: 'Laboratoire',
    description: 'Analyses biologiques : hématologie, biochimie, sérologie, bactériologie...',
    color: '#9c27b0',
    displayOrder: 1,
    // L'echantillon est l'objet manipule : le circuit commence par un
    // prelevement et sa reception avant analyse.
    steps: [
      { code: 'PRELEVEMENT', name: 'Prélèvement' },
      { code: 'RECEPTION', name: 'Réception de l\'échantillon' },
      { code: 'ANALYSE', name: 'Analyse' },
      { code: 'VALIDATION', name: 'Validation biologiste', producesResult: true }
    ],
    categories: [
      { code: 'HEMATOLOGIE', name: 'Hématologie' },
      { code: 'BIOCHIMIE', name: 'Biochimie' },
      { code: 'IMMUNOLOGIE', name: 'Immunologie' },
      { code: 'BACTERIOLOGIE', name: 'Bactériologie' },
      { code: 'PARASITOLOGIE', name: 'Parasitologie' },
      { code: 'VIROLOGIE', name: 'Virologie' }
    ]
  },
  {
    code: 'IMAGERIE',
    name: 'Imagerie Médicale',
    description: 'Radiographie, scanner, IRM, échographie, mammographie',
    color: '#ed6c02',
    displayOrder: 2,
    // Pas d'echantillon : l'objet produit est un jeu d'images (DICOM)
    // accompagne d'un compte rendu d'interpretation.
    steps: [
      { code: 'PLANIFICATION', name: 'Planification' },
      { code: 'ACQUISITION', name: 'Acquisition des images' },
      { code: 'INTERPRETATION', name: 'Interprétation radiologue', producesResult: true }
    ],
    categories: [
      { code: 'RADIOGRAPHIE', name: 'Radiographie' },
      { code: 'SCANNER', name: 'Scanner (CT)' },
      { code: 'IRM', name: 'IRM' },
      { code: 'ECHOGRAPHIE', name: 'Échographie' },
      { code: 'MAMMOGRAPHIE', name: 'Mammographie' }
    ]
  },
  {
    code: 'CARDIOLOGIE',
    name: 'Cardiologie',
    description: 'ECG, Holter, échocardiographie, épreuve d\'effort',
    color: '#d32f2f',
    displayOrder: 3,
    steps: [
      { code: 'ENREGISTREMENT', name: 'Enregistrement du tracé' },
      { code: 'INTERPRETATION', name: 'Interprétation cardiologue', producesResult: true }
    ],
    categories: []
  },
  {
    code: 'PNEUMOLOGIE',
    name: 'Pneumologie',
    description: 'Spirométrie, exploration fonctionnelle respiratoire, gaz du sang',
    color: '#0288d1',
    displayOrder: 4,
    steps: [
      { code: 'MESURE', name: 'Mesure (spirométrie)' },
      { code: 'INTERPRETATION', name: 'Interprétation pneumologue', producesResult: true }
    ],
    categories: []
  },
  {
    code: 'PRELEVEMENT',
    name: 'Centre de Prélèvement',
    description: 'Prélèvements sanguins, urinaires, selles, biopsies',
    color: '#2e7d32',
    displayOrder: 5,
    // Service transversal : il preleve puis transmet au service analysant
    steps: [
      { code: 'PRELEVEMENT', name: 'Prélèvement' },
      { code: 'TRANSMISSION', name: 'Transmission au service', producesResult: true }
    ],
    categories: []
  }
];

// Correspondance entre l'ancienne enumeration figee et les nouveaux services
const LEGACY_CATEGORY_TO_SERVICE = {
  LABORATORY: 'LABORATOIRE',
  RADIOLOGY: 'IMAGERIE'
};

// Correspondance entre les roles techniques existants et leur service
const LEGACY_ROLE_TO_SERVICE = {
  LAB_TECHNICIAN: 'LABORATOIRE',
  RADIOLOGIST: 'IMAGERIE'
};

const stripAccents = (value) =>
  (value || '').normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Rafraichit un libelle existant uniquement s'il correspond au meme texte a
 * l'accentuation pres. Un service renomme depuis l'interface d'administration
 * n'est donc jamais ecrase par le seed.
 */
const refreshLabel = async (row, fields) => {
  const changes = {};

  for (const [field, expected] of Object.entries(fields)) {
    if (expected === undefined || expected === null) continue;
    const current = row[field];
    if (current === expected) continue;
    if (stripAccents(current) === stripAccents(expected)) {
      changes[field] = expected;
    }
  }

  if (Object.keys(changes).length > 0) {
    await row.update(changes);
    return Object.keys(changes).length;
  }
  return 0;
};

const seedServices = async () => {
  const summary = {
    libellesCorriges: 0,
    servicesCrees: 0,
    servicesExistants: 0,
    categoriesCreees: 0,
    categoriesExistantes: 0,
    etapesCreees: 0,
    etapesExistantes: 0,
    examensRattaches: 0,
    examensDejaRattaches: 0,
    utilisateursRattaches: 0,
    utilisateursDejaRattaches: 0
  };

  const byCode = {};

  // 1. Services, leurs sous-categories et leurs etapes de realisation
  for (const definition of SERVICES) {
    const { categories, steps = [], ...serviceData } = definition;

    const [service, created] = await Service.findOrCreate({
      where: { code: serviceData.code },
      defaults: serviceData
    });

    byCode[service.code] = service;
    if (created) {
      summary.servicesCrees++;
    } else {
      summary.servicesExistants++;
      summary.libellesCorriges += await refreshLabel(service, {
        name: serviceData.name,
        description: serviceData.description
      });
    }

    for (const [index, category] of categories.entries()) {
      const [row, catCreated] = await ExamCategory.findOrCreate({
        where: { serviceId: service.id, code: category.code },
        defaults: {
          ...category,
          serviceId: service.id,
          displayOrder: index + 1
        }
      });
      if (catCreated) {
        summary.categoriesCreees++;
      } else {
        summary.categoriesExistantes++;
        summary.libellesCorriges += await refreshLabel(row, { name: category.name });
      }
    }

    for (const [index, step] of steps.entries()) {
      const [row, stepCreated] = await ServiceStep.findOrCreate({
        where: { serviceId: service.id, code: step.code },
        defaults: {
          ...step,
          serviceId: service.id,
          displayOrder: index + 1
        }
      });
      if (stepCreated) {
        summary.etapesCreees++;
      } else {
        summary.etapesExistantes++;
        summary.libellesCorriges += await refreshLabel(row, { name: step.name });
      }
    }
  }

  // 2. Rattachement des examens existants, d'apres l'ancienne categorie.
  //    On ne touche jamais a un examen deja rattache a un service.
  for (const [legacyCategory, serviceCode] of Object.entries(LEGACY_CATEGORY_TO_SERVICE)) {
    const service = byCode[serviceCode];
    if (!service) continue;

    const [count] = await Exam.update(
      { serviceId: service.id },
      { where: { category: legacyCategory, serviceId: null } }
    );
    summary.examensRattaches += count;
  }
  summary.examensDejaRattaches = await Exam.count({
    where: { serviceId: { [sequelize.Sequelize.Op.ne]: null } }
  }) - summary.examensRattaches;

  // 3. Rattachement du personnel technique existant
  for (const [role, serviceCode] of Object.entries(LEGACY_ROLE_TO_SERVICE)) {
    const service = byCode[serviceCode];
    if (!service) continue;

    const [count] = await User.update(
      { serviceId: service.id },
      { where: { role, serviceId: null } }
    );
    summary.utilisateursRattaches += count;
  }
  summary.utilisateursDejaRattaches = await User.count({
    where: {
      role: Object.keys(LEGACY_ROLE_TO_SERVICE),
      serviceId: { [sequelize.Sequelize.Op.ne]: null }
    }
  }) - summary.utilisateursRattaches;

  return summary;
};

// Execution directe en ligne de commande
if (require.main === module) {
  (async () => {
    try {
      await syncDatabase();
      const summary = await seedServices();

      console.log('\n--- Mise en place des services ---');
      console.log(`Services      : ${summary.servicesCrees} crees, ${summary.servicesExistants} deja presents`);
      console.log(`Categories    : ${summary.categoriesCreees} creees, ${summary.categoriesExistantes} deja presentes`);
      console.log(`Etapes        : ${summary.etapesCreees} creees, ${summary.etapesExistantes} deja presentes`);
      console.log(`Libelles      : ${summary.libellesCorriges} corrige(s) (accentuation)`);
      console.log(`Examens       : ${summary.examensRattaches} rattaches, ${summary.examensDejaRattaches} deja rattaches`);
      console.log(`Utilisateurs  : ${summary.utilisateursRattaches} rattaches, ${summary.utilisateursDejaRattaches} deja rattaches`);

      const orphelins = await Exam.count({ where: { serviceId: null } });
      if (orphelins > 0) {
        console.log(`\nATTENTION : ${orphelins} examen(s) sans service. A rattacher depuis l'administration.`);
      } else {
        console.log('\nTous les examens sont rattaches a un service.');
      }

      process.exit(0);
    } catch (error) {
      console.error('Echec de la mise en place des services :', error.message);
      process.exit(1);
    }
  })();
}

module.exports = { seedServices, SERVICES };
