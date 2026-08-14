const { Op } = require('sequelize');
const { ConsultationTariff, Invoice, InvoiceLine, EmergencyCase, Patient } = require('../models');
const { issueInvoice, deferInvoice } = require('./invoiceService');
const logger = require('../utils/logger');

/**
 * Facturation des passages aux urgences.
 *
 * Trois regles, qui decoulent toutes de la meme idee : aux urgences, l'argent ne
 * conditionne jamais le soin.
 *
 * 1. La facture n'est jamais emise avant la prise en charge. Elle l'est a
 *    l'identification du patient, ou a defaut a la sortie.
 * 2. Elle nait **differee** : la contrepartie a deja ete delivree, la creance
 *    est ouverte et suivie a la caisse comme une regularisation.
 * 3. Son absence ne bloque rien. Un dossier jamais identifie reste soignable,
 *    consultable et cloturable ; il remonte simplement dans la liste des
 *    dossiers a regulariser.
 *
 * Le forfait d'admission se lit dans la meme grille que les consultations,
 * ligne `visitType = 'EMERGENCY'` sans specialite (voir
 * models/ConsultationTariff.js).
 */

const EMERGENCY_LABEL = 'Admission aux urgences';
const DEFERRED_REASON = 'Urgences : soins delivres avant reglement';

const resolveEmergencyTariff = async () => ConsultationTariff.findOne({
  where: {
    specialtyId: { [Op.is]: null },
    visitType: 'EMERGENCY',
    isActive: true
  }
});

/**
 * Emet la facture d'un dossier d'urgence, si elle ne l'est pas deja.
 *
 * Idempotente et silencieuse : elle est appelee a l'identification comme a la
 * sortie, et ne doit jamais faire echouer l'acte metier qui l'accompagne. Une
 * facturation qui plante ne doit pas empecher de sortir un patient.
 *
 * @returns {Promise<Invoice|null>} null si le patient n'est pas identifie ou si
 *   aucun forfait n'est defini
 */
const ensureEmergencyInvoice = async (emergencyCaseId, { issuedBy = null } = {}) => {
  const existing = await Invoice.findOne({
    where: {
      emergencyCaseId,
      invoiceType: 'EMERGENCY',
      status: { [Op.ne]: 'CANCELLED' }
    },
    include: [{ model: InvoiceLine, as: 'lines' }]
  });

  if (existing) return existing;

  const emergencyCase = await EmergencyCase.findByPk(emergencyCaseId);
  if (!emergencyCase) return null;

  // Sans patient identifie, il n'y a personne a qui reclamer : la facture
  // attendra l'identification. Le dossier reste signale comme non regularise.
  if (!emergencyCase.patientId) return null;

  const tariff = await resolveEmergencyTariff();
  if (!tariff) return null;

  const invoice = await issueInvoice({
    patientId: emergencyCase.patientId,
    emergencyCaseId: emergencyCase.id,
    invoiceType: 'EMERGENCY',
    issuedBy,
    notes: `Dossier d'urgence ${emergencyCase.caseNumber}`,
    lines: [{
      lineType: 'EMERGENCY',
      label: tariff.label || `${EMERGENCY_LABEL} (${emergencyCase.caseNumber})`,
      unitPrice: tariff.amount,
      quantity: 1
    }]
  });

  // Un forfait a 0 naît deja solde : le marquer a regulariser afficherait une
  // creance inexistante dans la file de la caisse.
  const deferred = invoice.status !== 'PAID';
  if (deferred) {
    await deferInvoice(invoice.id, { reason: DEFERRED_REASON, userId: issuedBy });
  }

  logger.info('Facture d\'urgence emise', {
    emergencyCaseId: emergencyCase.id,
    caseNumber: emergencyCase.caseNumber,
    invoiceNumber: invoice.invoiceNumber,
    amount: invoice.totalAmount,
    deferred
  });

  // Rechargement plutot que renvoi de l'instance : `issueInvoice` l'a lue avant
  // le marquage, et l'appelant recevrait une facture qui se dit encore due au
  // guichet alors qu'elle est en regularisation.
  if (!deferred) return invoice;

  return Invoice.findByPk(invoice.id, {
    include: [{ model: InvoiceLine, as: 'lines' }]
  });
};

/**
 * Variante non bloquante : journalise l'echec au lieu de le propager.
 *
 * Utilisee depuis les actes cliniques (identification, sortie), ou l'echec de la
 * facturation ne doit jamais annuler l'acte.
 */
const tryEnsureEmergencyInvoice = async (emergencyCaseId, options) => {
  try {
    return await ensureEmergencyInvoice(emergencyCaseId, options);
  } catch (error) {
    logger.error('Echec de la facturation d\'un dossier d\'urgence', {
      emergencyCaseId,
      error: error.message
    });
    return null;
  }
};

module.exports = {
  ensureEmergencyInvoice,
  tryEnsureEmergencyInvoice,
  resolveEmergencyTariff
};
