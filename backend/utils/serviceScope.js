const { Service, ServiceStep, ExamStepProgress } = require('../models');
const { SERVICE_ROLES } = require('./roles');

// Correspondance historique role -> categorie figee, conservee pour les
// comptes techniques qui n'ont pas encore de service d'affectation.
const LEGACY_ROLE_CATEGORY = {
  RADIOLOGIST: 'RADIOLOGY',
  LAB_TECHNICIAN: 'LABORATORY'
};

/**
 * Filtre Sequelize a appliquer sur les examens visibles par un utilisateur.
 *
 * Le service d'affectation prime ; a defaut on retombe sur l'ancienne
 * correspondance par role, afin qu'un compte non migre continue de fonctionner.
 *
 * Un compte de service sans affectation ni categorie historique (typiquement un
 * TECHNICIAN cree sans service) ne voit rien plutot que tout : c'est une
 * mauvaise configuration, et le perimetre vide est le seul repli sur lequel on
 * peut se tromper sans consequence. Le scope ouvert reste reserve a l'ADMIN.
 */
const getExamScope = (user) => {
  if (user.serviceId) {
    return { serviceId: user.serviceId };
  }

  const category = LEGACY_ROLE_CATEGORY[user.role];
  if (category) return { category };

  // `id IS NULL` sur une cle primaire ne peut jamais etre vrai : perimetre vide.
  if (SERVICE_ROLES.includes(user.role)) {
    return { id: null };
  }

  return {};
};

/**
 * Libelle du perimetre, pour les messages destines a l'utilisateur.
 */
const getScopeLabel = async (user) => {
  if (user.serviceId) {
    const service = await Service.findByPk(user.serviceId);
    if (service) return service.name;
  }

  const category = LEGACY_ROLE_CATEGORY[user.role];
  if (category === 'RADIOLOGY') return 'radiologie';
  if (category === 'LABORATORY') return 'laboratoire';
  if (SERVICE_ROLES.includes(user.role)) return 'aucun service affecte';
  return 'votre service';
};

/**
 * Verifie qu'un examen prescrit releve bien du perimetre de l'utilisateur.
 */
const isExamInScope = (user, exam) => {
  if (!exam) return false;
  if (user.serviceId) return exam.serviceId === user.serviceId;

  const category = LEGACY_ROLE_CATEGORY[user.role];
  if (category) return exam.category === category;

  // Meme raisonnement que getExamScope : un compte de service sans affectation
  // n'a pas de perimetre, il ne doit rien pouvoir traiter.
  return !SERVICE_ROLES.includes(user.role);
};

/**
 * Cree les lignes d'avancement d'un examen a partir des etapes configurees
 * pour son service. Sans etape configuree, rien n'est cree : l'examen suit
 * alors simplement le circuit court PAID -> IN_PROGRESS -> COMPLETED.
 *
 * L'operation est idempotente : relancee, elle ne duplique pas les etapes.
 */
const initExamSteps = async (prescriptionExam, serviceId) => {
  if (!serviceId) return [];

  const existing = await ExamStepProgress.count({
    where: { prescriptionExamId: prescriptionExam.id }
  });
  if (existing > 0) return [];

  const steps = await ServiceStep.findAll({
    where: { serviceId, isActive: true },
    order: [['displayOrder', 'ASC']]
  });
  if (steps.length === 0) return [];

  const rows = steps.map((step, index) => ({
    prescriptionExamId: prescriptionExam.id,
    serviceStepId: step.id,
    // L'ordre est fige ici : reordonner les etapes du service plus tard ne
    // doit pas reecrire le parcours des examens deja engages.
    stepOrder: step.displayOrder,
    status: index === 0 ? 'IN_PROGRESS' : 'PENDING',
    startedAt: index === 0 ? new Date() : null
  }));

  return ExamStepProgress.bulkCreate(rows);
};

module.exports = {
  getExamScope,
  getScopeLabel,
  isExamInScope,
  initExamSteps,
  LEGACY_ROLE_CATEGORY
};
