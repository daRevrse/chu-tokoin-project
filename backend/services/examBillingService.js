const { Op } = require('sequelize');
const { Invoice, InvoiceLine, Prescription, PrescriptionExam, Exam } = require('../models');
const { issueInvoice } = require('./invoiceService');

/**
 * Facturation des examens prescrits.
 *
 * La facture est emise a la creation de la prescription, c'est-a-dire au moment
 * ou la creance nait, et non au guichet. La caisse n'a alors plus qu'un seul
 * concept a manipuler : des factures a encaisser, qu'elles portent une
 * consultation ou des examens.
 */

/**
 * Retourne la facture d'examens d'une prescription, en l'emettant si elle
 * n'existe pas encore.
 *
 * Idempotent, et il doit le rester : la fonction est appelee a la creation de la
 * prescription mais aussi a la caisse, pour les prescriptions anterieures a la
 * facturation qui n'en ont jamais eu.
 *
 * @param {string} prescriptionId
 * @param {object} options
 * @param {string} [options.issuedBy]
 * @param {object} [options.transaction]
 * @returns {Promise<Invoice|null>} null si la prescription ne porte aucun examen
 */
const ensureExamInvoice = async (prescriptionId, { issuedBy = null, transaction = null } = {}) => {
  const existing = await Invoice.findOne({
    where: {
      prescriptionId,
      invoiceType: 'EXAM',
      status: { [Op.ne]: 'CANCELLED' }
    },
    include: [{ model: InvoiceLine, as: 'lines' }],
    transaction
  });

  if (existing) return existing;

  const prescription = await Prescription.findByPk(prescriptionId, {
    include: [{
      model: PrescriptionExam,
      as: 'prescriptionExams',
      include: [{ model: Exam, as: 'exam', attributes: ['id', 'code', 'name'] }]
    }],
    transaction
  });

  if (!prescription) {
    const error = new Error('Prescription non trouvee');
    error.statusCode = 404;
    throw error;
  }

  const lines = prescription.prescriptionExams.map((pe) => ({
    lineType: 'EXAM',
    // Le libelle est fige ici : renommer un examen en administration ne doit pas
    // reecrire les factures deja emises.
    label: pe.exam ? `${pe.exam.code} - ${pe.exam.name}` : 'Examen',
    // Le prix vient de la ligne de prescription, pas du catalogue : c'est celui
    // qui a ete annonce au patient au moment de la prescription.
    unitPrice: pe.price,
    quantity: pe.quantity || 1,
    examId: pe.examId,
    prescriptionExamId: pe.id
  }));

  if (lines.length === 0) return null;

  return issueInvoice({
    patientId: prescription.patientId,
    visitId: prescription.visitId,
    prescriptionId: prescription.id,
    invoiceType: 'EXAM',
    issuedBy,
    lines
  }, transaction);
};

module.exports = { ensureExamInvoice };
