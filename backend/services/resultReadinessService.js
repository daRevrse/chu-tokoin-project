const { Prescription, PrescriptionExam, Exam, Service, Result, Patient } = require('../models');

/**
 * Disponibilite des resultats d'une prescription pour le patient.
 *
 * Un resultat n'est disponible que lorsqu'il a ete **valide** par le medecin,
 * et non lorsqu'il a ete depose par le service : remettre un compte rendu brut
 * non interprete reviendrait a contourner le medecin.
 *
 * Regle retenue : la prescription est prete quand *tous* ses examens ont au
 * moins un resultat valide. Le patient ne se deplace donc qu'une fois, meme
 * lorsque ses examens relevent de services differents qui ne finissent pas
 * ensemble.
 */

/**
 * Charge une prescription avec tout ce qu'il faut pour juger de son etat.
 */
const loadPrescription = (where) => Prescription.findOne({
  where,
  include: [
    {
      model: Patient,
      as: 'patient',
      attributes: ['id', 'patientNumber', 'firstName', 'lastName', 'dateOfBirth', 'gender', 'phone']
    },
    {
      model: PrescriptionExam,
      as: 'prescriptionExams',
      include: [
        {
          model: Exam,
          as: 'exam',
          attributes: ['id', 'code', 'name'],
          include: [{ model: Service, as: 'service', attributes: ['id', 'code', 'name', 'color'] }]
        },
        {
          model: Result,
          as: 'results',
          attributes: ['id', 'isValidated', 'validatedAt', 'createdAt']
        }
      ]
    }
  ]
});

/**
 * Etat de chaque examen prescrit, du point de vue du patient.
 */
const describeExams = (prescription) => (prescription.prescriptionExams || []).map((pe) => {
  const validated = (pe.results || []).find(r => r.isValidated);
  const uploaded = (pe.results || []).length > 0;

  return {
    prescriptionExamId: pe.id,
    code: pe.exam ? pe.exam.code : null,
    name: pe.exam ? pe.exam.name : 'Examen',
    service: pe.exam && pe.exam.service
      ? { id: pe.exam.service.id, name: pe.exam.service.name, color: pe.exam.service.color }
      : null,
    examStatus: pe.status,
    // Trois etats distincts : le patient n'a pas a savoir qu'un compte rendu
    // existe tant que le medecin ne l'a pas valide, mais l'accueil doit
    // pouvoir dire ou en est chaque examen.
    resultState: validated ? 'VALIDATED' : (uploaded ? 'AWAITING_VALIDATION' : 'PENDING'),
    validatedAt: validated ? validated.validatedAt : null
  };
});

/**
 * Synthese : la prescription est-elle prete a etre restituee au patient ?
 */
const summarize = (exams) => {
  const total = exams.length;
  const validated = exams.filter(e => e.resultState === 'VALIDATED').length;
  const missing = exams.filter(e => e.resultState !== 'VALIDATED');

  return {
    total,
    validated,
    // Une prescription sans examen n'est jamais "prete" : il n'y a rien a rendre.
    ready: total > 0 && validated === total,
    missing: missing.map(e => ({
      name: e.name,
      service: e.service ? e.service.name : null,
      resultState: e.resultState
    }))
  };
};

/**
 * Etat complet d'une prescription pour l'accueil.
 * @returns {Promise<null|{ prescription, patient, exams, readiness }>}
 */
const getReadiness = async (where) => {
  const prescription = await loadPrescription(where);
  if (!prescription) return null;

  const exams = describeExams(prescription);

  return {
    prescription: {
      id: prescription.id,
      prescriptionNumber: prescription.prescriptionNumber,
      status: prescription.status,
      prescriptionDate: prescription.prescriptionDate,
      totalAmount: prescription.totalAmount,
      // Date annoncee au patient a la caisse : l'accueil doit pouvoir la lui
      // rappeler quand il repasse trop tot.
      expectedResultAt: prescription.expectedResultAt
    },
    patient: prescription.patient,
    exams,
    readiness: summarize(exams)
  };
};

/**
 * Fige la date de disponibilite annoncee au patient, au moment du paiement.
 *
 * Le delai retenu est le **plus long** des examens de l'ordonnance, et non
 * leur somme : les services travaillent en parallele, et la prescription n'est
 * prete que lorsque le dernier examen est valide (voir summarize).
 *
 * Appelee depuis tous les chemins qui passent une prescription a PAID (caisse
 * et Mobile Money) : recalculer l'estimation dans chacun les ferait diverger.
 *
 * Note : le calcul est une simple addition d'heures. Les horaires d'ouverture
 * et les jours feries ne sont modelises nulle part dans l'application ; une
 * estimation tombant un dimanche reste donc possible.
 *
 * @param {string} prescriptionId
 * @param {Date} [from] - point de depart, l'instant du paiement par defaut
 * @returns {Promise<Date|null>} la date annoncee, ou null si rien a estimer
 */
const recordExpectedResultAt = async (prescriptionId, from = new Date()) => {
  const prescription = await Prescription.findByPk(prescriptionId, {
    include: [{
      model: PrescriptionExam,
      as: 'prescriptionExams',
      include: [{ model: Exam, as: 'exam', attributes: ['id', 'resultDelayHours'] }]
    }]
  });

  if (!prescription) return null;

  const delays = (prescription.prescriptionExams || [])
    .map(pe => (pe.exam ? pe.exam.resultDelayHours : null))
    .filter(h => Number.isFinite(h));

  if (delays.length === 0) return null;

  const expectedResultAt = new Date(from.getTime() + Math.max(...delays) * 60 * 60 * 1000);
  await prescription.update({ expectedResultAt });

  return expectedResultAt;
};

module.exports = { getReadiness, recordExpectedResultAt };
