const { Op } = require('sequelize');
const { ConsultationTariff, Specialty, Invoice, InvoiceLine, Visit } = require('../models');
const { issueInvoice } = require('./invoiceService');

/**
 * Frais de consultation : ce que le patient regle *avant* de voir le medecin.
 *
 * Le circuit reel de l'etablissement est :
 *   accueil (ticket) -> caisse (ticket de consultation) -> medecin -> caisse
 *   (examens) -> services
 *
 * La facture est donc emise a l'ouverture du passage, pas au guichet : le
 * patient doit connaitre le montant du en quittant l'accueil, et la caisse doit
 * le voir arriver dans sa file sans avoir a ressaisir quoi que ce soit.
 */

const CONSULTATION_LABEL = 'Consultation';

/**
 * Tarif applicable a un passage.
 *
 * Deux requetes plutot qu'un `IN` avec tri applicatif : la seconde n'est
 * executee que si la premiere ne rend rien, c'est-a-dire dans le seul cas ou
 * l'etablissement n'a pas defini de tarif propre a la specialite.
 *
 * @returns {Promise<ConsultationTariff|null>} null si aucun tarif n'est defini
 */
const resolveTariff = async ({ specialtyId, visitType = 'CONSULTATION' }) => {
  if (specialtyId) {
    const specific = await ConsultationTariff.findOne({
      where: { specialtyId, visitType, isActive: true },
      include: [{ model: Specialty, as: 'specialty', attributes: ['id', 'name'] }]
    });
    if (specific) return specific;
  }

  return ConsultationTariff.findOne({
    where: { specialtyId: { [Op.is]: null }, visitType, isActive: true }
  });
};

/**
 * Libelle imprime sur la facture. Le tarif peut porter le sien ; a defaut on le
 * compose a partir de la specialite, pour qu'un patient tenant deux recus sache
 * lequel correspond a quelle consultation.
 */
const buildLabel = (tariff, specialty, visitType) => {
  if (tariff.label) return tariff.label;

  const base = visitType === 'RESULT_REVIEW'
    ? 'Consultation de resultats'
    : CONSULTATION_LABEL;

  return specialty ? `${base} - ${specialty.name}` : base;
};

/**
 * Cherche un ticket de consultation encore valable pour ce patient.
 *
 * Le ticket couvre un episode de soins : un patient qui revient dans le delai
 * voir la meme specialite ne repaie pas. A defaut de modeliser l'episode
 * lui-meme, on l'approxime par le couple (patient, specialite) sur la periode de
 * validite. C'est volontairement large : mieux vaut ne pas refacturer un patient
 * qui revient pour autre chose que le facturer deux fois pour la meme chose.
 *
 * Seules les factures effectivement soldees couvrent un retour. Une facture
 * differee, restee impayee, ne donne droit a rien : sinon un passage aux
 * urgences non regle ouvrirait une semaine de consultations gratuites.
 *
 * @returns {Promise<Invoice|null>} la facture qui couvre le passage
 */
const findCoveringInvoice = async (visit, tariff, transaction) => {
  if (!tariff.validityDays || tariff.validityDays <= 0) return null;

  const since = new Date(Date.now() - tariff.validityDays * 24 * 60 * 60 * 1000);

  return Invoice.findOne({
    where: {
      patientId: visit.patientId,
      invoiceType: 'CONSULTATION',
      status: 'PAID',
      // Une facture a 0 est elle-meme une gratuite de suivi : la prendre comme
      // reference ferait glisser le delai a chaque retour, et le ticket ne
      // expirerait jamais.
      totalAmount: { [Op.gt]: 0 },
      createdAt: { [Op.gte]: since }
    },
    include: [{
      model: Visit,
      as: 'visit',
      required: true,
      attributes: ['id', 'specialtyId', 'visitDate'],
      where: { specialtyId: visit.specialtyId || { [Op.is]: null } }
    }],
    order: [['createdAt', 'DESC']],
    transaction
  });
};

/**
 * Emet la facture des frais de consultation d'un passage.
 *
 * Rend `null` quand aucun tarif n'est defini pour ce couple (specialite, type de
 * passage). C'est le comportement voulu et non un echec : sur une installation
 * ou l'administrateur n'a pas encore saisi de grille, le passage doit continuer
 * a s'ouvrir et le patient a etre vu. Un logiciel qui bloque toute la file
 * parce qu'un tarif manque coute plus cher que la gratuite.
 *
 * @param {Visit} visit - passage deja cree
 * @param {object} options
 * @param {string} options.issuedBy - utilisateur a l'origine de l'ouverture
 * @param {object} [options.specialty] - specialite deja chargee, pour eviter une requete
 * @param {object} [options.transaction] - transaction de l'appelant. L'ouverture
 *   du passage et l'emission de sa facture doivent reussir ou echouer ensemble :
 *   un passage sans facture, c'est une consultation gratuite que personne n'a
 *   decidee.
 * @returns {Promise<Invoice|null>}
 */
const issueConsultationInvoice = async (visit, { issuedBy, specialty = null, transaction = null } = {}) => {
  const tariff = await resolveTariff({
    specialtyId: visit.specialtyId,
    visitType: visit.visitType
  });

  if (!tariff) return null;

  const resolvedSpecialty = specialty
    || tariff.specialty
    || (visit.specialtyId ? await Specialty.findByPk(visit.specialtyId, { attributes: ['id', 'name'] }) : null);

  const covering = await findCoveringInvoice(visit, tariff, transaction);

  // Facture a 0 plutot qu'absence de facture : le passage garde une piece
  // justificative, qui nomme la gratuite et designe le ticket qui la couvre.
  // Sans elle, un retour couvert et un passage jamais facture seraient
  // indistinguables dans les comptes.
  const unitPrice = covering ? 0 : tariff.amount;
  const label = covering
    ? `${buildLabel(tariff, resolvedSpecialty, visit.visitType)} (couverte par ${covering.invoiceNumber})`
    : buildLabel(tariff, resolvedSpecialty, visit.visitType);

  return issueInvoice({
    patientId: visit.patientId,
    visitId: visit.id,
    invoiceType: 'CONSULTATION',
    issuedBy,
    notes: covering
      ? `Ticket de consultation ${covering.invoiceNumber} encore valable (${tariff.validityDays} jours)`
      : null,
    lines: [{
      lineType: 'CONSULTATION',
      label,
      unitPrice,
      quantity: 1,
      specialtyId: visit.specialtyId || null
    }]
  }, transaction);
};

/**
 * Facture de consultation d'un passage, s'il y en a une.
 *
 * Une seule est attendue par passage ; on prend la plus recente non annulee
 * pour rester juste si une premiere emission a ete annulee puis refaite.
 */
const getConsultationInvoice = async (visitId) => {
  return Invoice.findOne({
    where: {
      visitId,
      invoiceType: 'CONSULTATION',
      status: { [Op.ne]: 'CANCELLED' }
    },
    include: [{ model: InvoiceLine, as: 'lines' }],
    order: [['createdAt', 'DESC']]
  });
};

/**
 * Le passage peut-il entrer en consultation ?
 *
 * Repond `true` en l'absence de facture : pas de tarif defini, donc rien a
 * reclamer. Une facture annulee (gratuite accordee) ne bloque pas davantage,
 * `getConsultationInvoice` l'ayant deja ecartee.
 */
const isConsultationSettled = async (visitId) => {
  const invoice = await getConsultationInvoice(visitId);
  if (!invoice) return true;
  return invoice.status === 'PAID';
};

module.exports = {
  resolveTariff,
  issueConsultationInvoice,
  getConsultationInvoice,
  isConsultationSettled
};
