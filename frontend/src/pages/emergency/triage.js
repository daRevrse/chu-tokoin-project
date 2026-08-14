/**
 * Echelle de triage a cinq niveaux, du plus grave au moins grave.
 *
 * Les couleurs ne sont pas decoratives : c'est par elles qu'un infirmier lit sa
 * file en une seconde depuis l'autre bout de la piece. Elles suivent la
 * convention habituelle des services d'urgences (rouge, orange, jaune, vert,
 * bleu) et ne doivent pas etre reaffectees a d'autres usages dans cet espace.
 */
export const TRIAGE_LEVELS = [
  {
    level: 1,
    label: 'Réanimation',
    description: 'Détresse vitale, prise en charge immédiate',
    color: '#d32f2f',
    bgColor: '#ffebee',
    maxWaitMinutes: 0
  },
  {
    level: 2,
    label: 'Très urgent',
    description: 'Atteinte sévère, à voir dans les minutes qui suivent',
    color: '#ed6c02',
    bgColor: '#fff3e0',
    maxWaitMinutes: 20
  },
  {
    level: 3,
    label: 'Urgent',
    description: 'État instable ou douleur importante',
    color: '#f9a825',
    bgColor: '#fffde7',
    maxWaitMinutes: 60
  },
  {
    level: 4,
    label: 'Peu urgent',
    description: 'État stable, prise en charge différable',
    color: '#2e7d32',
    bgColor: '#e8f5e9',
    maxWaitMinutes: 120
  },
  {
    level: 5,
    label: 'Non urgent',
    description: 'Relève d\'une consultation ordinaire',
    color: '#1976d2',
    bgColor: '#e3f2fd',
    maxWaitMinutes: 240
  }
];

export const getTriage = (level) =>
  TRIAGE_LEVELS.find(t => t.level === level) || null;

export const ARRIVAL_MODES = [
  { value: 'WALK_IN', label: 'Par ses propres moyens' },
  { value: 'AMBULANCE', label: 'Ambulance' },
  { value: 'REFERRAL', label: 'Référé par un autre établissement' },
  { value: 'LAW_ENFORCEMENT', label: 'Forces de l\'ordre' },
  { value: 'OTHER', label: 'Autre' }
];

export const OUTCOMES = [
  { value: 'HOME', label: 'Retour à domicile' },
  { value: 'ADMISSION', label: 'Hospitalisation' },
  { value: 'TRANSFER', label: 'Transfert vers un autre établissement' },
  { value: 'AGAINST_ADVICE', label: 'Sortie contre avis médical' },
  { value: 'DECEASED', label: 'Décès' }
];

export const STATUS_LABELS = {
  AWAITING_TRIAGE: 'En attente de triage',
  WAITING: 'En attente',
  IN_CARE: 'Pris en charge',
  DISCHARGED: 'Sorti',
  LEFT_WITHOUT_CARE: 'Parti sans être vu'
};

/**
 * Minutes ecoulees depuis l'arrivee. Aux urgences, c'est la donnee qui compte
 * autant que la gravite : un niveau 2 qui attend depuis une heure est un
 * incident.
 */
export const waitedMinutes = (emergencyCase) =>
  Math.max(0, Math.round((Date.now() - new Date(emergencyCase.arrivalAt)) / 60000));

/**
 * Le delai cible du niveau est-il depasse ?
 * Rend `false` pour un dossier non trie : on ne peut pas depasser un delai qui
 * n'a pas encore ete fixe.
 */
export const isOverdue = (emergencyCase) => {
  const triage = getTriage(emergencyCase.triageLevel);
  if (!triage) return false;
  return waitedMinutes(emergencyCase) > triage.maxWaitMinutes;
};

export const displayName = (emergencyCase) => {
  if (emergencyCase.patient) {
    return `${emergencyCase.patient.lastName} ${emergencyCase.patient.firstName}`;
  }
  return emergencyCase.provisionalLabel || 'Patient non identifié';
};
