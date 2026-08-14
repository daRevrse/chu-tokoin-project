const sequelize = require('../config/database');
const { Invoice, InvoiceLine, Payment } = require('../models');
const { reserveNumber } = require('./sequenceService');
const { getBusinessDate } = require('../utils/businessDate');

/**
 * Emission des factures et encaissement des versements.
 *
 * Tout ce qui touche a un montant du ou verse passe par ici. Les controleurs
 * n'ecrivent jamais `totalAmount`, `paidAmount` ni `status` directement : ces
 * trois colonnes sont recalculees a partir des lignes et des paiements, et sont
 * la seule chose que la caisse et les rapports ont le droit de croire.
 */

// Les montants circulent en DECIMAL, que MySQL rend sous forme de chaine, et
// transitent par des additions en virgule flottante. Sans arrondi, une facture
// soldee peut afficher un reste a payer de 0.0000000001 et ne jamais passer a
// PAID.
const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

/**
 * Statut deduit des totaux. Une facture annulee le reste : l'annulation est une
 * decision, pas un etat de compte.
 *
 * L'ordre des tests compte. `paid >= total` passe avant `paid <= 0` pour que la
 * facture d'un tarif a 0 — une gratuite decidee par l'etablissement — naisse
 * soldee. Dans l'autre ordre elle resterait ISSUED, donc eternellement due :
 * le medecin ne pourrait jamais prendre le patient en charge, et la caisse
 * n'aurait rien a encaisser pour la debloquer.
 */
const deriveStatus = (invoice, total, paid) => {
  if (invoice.status === 'CANCELLED') return 'CANCELLED';
  if (paid >= total) return 'PAID';
  if (paid <= 0) return 'ISSUED';
  return 'PARTIALLY_PAID';
};

/**
 * Recalcule les totaux d'une facture depuis ses lignes et ses paiements.
 *
 * Recalcul complet plutot qu'increment : un increment se desynchronise au
 * premier paiement annule ou a la premiere ligne ajoutee apres coup, et
 * personne ne s'en apercoit avant l'arrete de caisse.
 *
 * @returns {Promise<Invoice>} la facture rechargee
 */
const refreshTotals = async (invoiceId, transaction) => {
  const invoice = await Invoice.findByPk(invoiceId, { transaction });
  if (!invoice) {
    throw new Error(`Facture introuvable : ${invoiceId}`);
  }

  const [lineTotal, paidTotal] = await Promise.all([
    InvoiceLine.sum('amount', { where: { invoiceId }, transaction }),
    Payment.sum('amount', {
      where: { invoiceId, paymentStatus: 'SUCCESS' },
      transaction
    })
  ]);

  // `SUM` sur un ensemble vide rend NULL, que Sequelize remonte en null.
  const total = round2(lineTotal || 0);
  const paid = round2(paidTotal || 0);

  await invoice.update(
    { totalAmount: total, paidAmount: paid, status: deriveStatus(invoice, total, paid) },
    { transaction }
  );

  return invoice;
};

/**
 * Emet une facture et ses lignes.
 *
 * @param {object} params
 * @param {string} params.patientId
 * @param {string} [params.visitId]
 * @param {string} [params.prescriptionId]
 * @param {string} params.invoiceType - CONSULTATION | EXAM | BED | PROCEDURE | OTHER
 * @param {Array}  params.lines - { lineType, label, unitPrice, quantity, examId, ... }
 * @param {string} [params.issuedBy] - utilisateur a l'origine de l'emission
 * @param {string} [params.notes]
 * @param {object} [transaction] - transaction appelante ; une transaction dediee
 *   est ouverte si elle n'est pas fournie
 * @returns {Promise<Invoice>} la facture, lignes incluses
 */
const issueInvoice = async (params, transaction) => {
  const run = async (t) => {
    const {
      patientId,
      visitId = null,
      prescriptionId = null,
      emergencyCaseId = null,
      invoiceType = 'OTHER',
      lines = [],
      issuedBy = null,
      notes = null
    } = params;

    if (!patientId) {
      throw new Error('Une facture doit designer un patient');
    }
    if (lines.length === 0) {
      throw new Error('Une facture doit comporter au moins une ligne');
    }

    // Le numero est reserve hors de la transaction metier, comme les numeros de
    // passage : en cas d'echec, un trou dans la sequence vaut mieux que deux
    // factures portant la meme reference.
    const businessDate = getBusinessDate();
    const sequence = await reserveNumber('INVOICE', businessDate);
    const invoiceNumber = `FAC-${businessDate.replace(/-/g, '')}-${String(sequence).padStart(4, '0')}`;

    const invoice = await Invoice.create({
      invoiceNumber,
      patientId,
      visitId,
      prescriptionId,
      emergencyCaseId,
      invoiceType,
      issuedBy,
      notes,
      status: 'ISSUED',
      totalAmount: 0,
      paidAmount: 0
    }, { transaction: t });

    await InvoiceLine.bulkCreate(
      lines.map((line) => ({
        invoiceId: invoice.id,
        lineType: line.lineType || invoiceType,
        label: line.label,
        unitPrice: line.unitPrice,
        quantity: line.quantity || 1,
        examId: line.examId || null,
        prescriptionExamId: line.prescriptionExamId || null,
        specialtyId: line.specialtyId || null
      })),
      // `validate` autant que `individualHooks` : bulkCreate n'execute par
      // defaut ni les validateurs ni les hooks de validation, or c'est un hook
      // beforeValidate qui calcule `amount`. Sans ces deux options, toutes les
      // lignes valent 0 et toutes les factures sont gratuites.
      { transaction: t, individualHooks: true, validate: true }
    );

    await refreshTotals(invoice.id, t);

    return Invoice.findByPk(invoice.id, {
      include: [{ model: InvoiceLine, as: 'lines' }],
      transaction: t
    });
  };

  return transaction ? run(transaction) : sequelize.transaction(run);
};

/**
 * Enregistre un versement sur une facture.
 *
 * Le verrou pris sur la facture n'est pas decoratif : deux caissiers qui
 * encaissent la meme facture au meme instant liraient tous deux un solde plein
 * et encaisseraient chacun la totalite.
 *
 * @returns {Promise<{invoice: Invoice, payment: Payment, justSettled: boolean}>}
 *   `justSettled` indique que ce versement est celui qui solde la facture ; il
 *   permet a l'appelant de declencher ses effets metier (liberation des examens,
 *   emission du QR code) une seule fois.
 */
const recordPayment = async (invoiceId, { amount, paymentMethod = 'CASH', transactionReference = null, cashierId, paymentStatus = 'SUCCESS' }) => {
  return sequelize.transaction(async (t) => {
    const invoice = await Invoice.findByPk(invoiceId, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!invoice) {
      const error = new Error('Facture non trouvee');
      error.statusCode = 404;
      throw error;
    }

    if (invoice.status === 'CANCELLED') {
      const error = new Error('Cette facture a ete annulee');
      error.statusCode = 409;
      throw error;
    }

    if (invoice.status === 'PAID') {
      const error = new Error('Cette facture est deja soldee');
      error.statusCode = 409;
      throw error;
    }

    const balance = round2(invoice.getBalance());
    // Sans montant precise, le caissier encaisse la totalite du reste a payer :
    // c'est le geste courant, et le rendre implicite evite une saisie de plus.
    const paid = round2(amount === undefined || amount === null || amount === '' ? balance : amount);

    if (!(paid > 0)) {
      const error = new Error('Le montant verse doit etre positif');
      error.statusCode = 400;
      throw error;
    }

    if (paid > balance) {
      const error = new Error(`Le montant verse depasse le reste a payer (${balance})`);
      error.statusCode = 400;
      throw error;
    }

    const payment = await Payment.create({
      invoiceId: invoice.id,
      // Raccourci de lecture pour le QR code, le portail et les rapports.
      prescriptionId: invoice.prescriptionId,
      amount: paid,
      paymentMethod,
      paymentStatus,
      cashierId,
      transactionReference,
      paymentDate: new Date()
    }, { transaction: t });

    const refreshed = await refreshTotals(invoice.id, t);

    return {
      invoice: refreshed,
      payment,
      justSettled: refreshed.status === 'PAID'
    };
  });
};

/**
 * Annule un versement encaisse par erreur (montant errone, mauvaise facture).
 *
 * C'est une correction de caisse, pas un remboursement : le versement sort du
 * total encaisse et la facture redevient due. Le mouvement d'espece qui va avec
 * se traite au guichet.
 *
 * Le paiement n'est pas supprime mais marque `CANCELLED` avec son motif et son
 * auteur : une ligne de caisse qui disparait est indistinguable d'un
 * detournement.
 *
 * @returns {Promise<{payment: Payment, invoice: Invoice}>}
 */
const cancelPayment = async (paymentId, { reason, userId }) => {
  return sequelize.transaction(async (t) => {
    const payment = await Payment.findByPk(paymentId, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!payment) {
      const error = new Error('Paiement non trouve');
      error.statusCode = 404;
      throw error;
    }

    if (payment.paymentStatus !== 'SUCCESS') {
      const error = new Error(`Seul un paiement abouti peut etre annule (statut : ${payment.paymentStatus})`);
      error.statusCode = 409;
      throw error;
    }

    await payment.update({
      paymentStatus: 'CANCELLED',
      cancelReason: reason,
      cancelledBy: userId,
      cancelledAt: new Date()
    }, { transaction: t });

    // Les totaux ne comptent que les versements aboutis : la facture redevient
    // due du seul fait du changement de statut.
    const invoice = payment.invoiceId
      ? await refreshTotals(payment.invoiceId, t)
      : null;

    return { payment, invoice };
  });
};

/**
 * Annule une facture (gratuite accordee, erreur de saisie, patient reparti).
 *
 * Une facture deja encaissee, meme partiellement, n'est pas annulable : il
 * faudrait rembourser, ce qui est un mouvement de caisse a part entiere et non
 * une correction.
 */
const cancelInvoice = async (invoiceId, { reason, userId }) => {
  return sequelize.transaction(async (t) => {
    const invoice = await Invoice.findByPk(invoiceId, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!invoice) {
      const error = new Error('Facture non trouvee');
      error.statusCode = 404;
      throw error;
    }

    if (invoice.status === 'CANCELLED') {
      const error = new Error('Cette facture est deja annulee');
      error.statusCode = 409;
      throw error;
    }

    if (Number(invoice.paidAmount) > 0) {
      const error = new Error('Une facture deja encaissee ne peut pas etre annulee');
      error.statusCode = 409;
      throw error;
    }

    await invoice.update({
      status: 'CANCELLED',
      cancelReason: reason,
      cancelledBy: userId
    }, { transaction: t });

    return invoice;
  });
};

/**
 * Marque une facture comme differee : la prestation est delivree avant d'etre
 * payee, la creance reste a regulariser a la caisse.
 *
 * C'est le mecanisme qui permet de prendre en charge une urgence sans passer
 * par le guichet. La creance n'est pas effacee, elle est tracee.
 */
const deferInvoice = async (invoiceId, { reason, userId }) => {
  const invoice = await Invoice.findByPk(invoiceId);

  if (!invoice) {
    const error = new Error('Facture non trouvee');
    error.statusCode = 404;
    throw error;
  }

  if (invoice.isSettled()) {
    const error = new Error('Cette facture n\'est plus a regler');
    error.statusCode = 409;
    throw error;
  }

  if (invoice.isDeferred) {
    return invoice;
  }

  await invoice.update({
    isDeferred: true,
    deferredReason: reason,
    deferredBy: userId,
    deferredAt: new Date()
  });

  return invoice;
};

module.exports = {
  issueInvoice,
  recordPayment,
  refreshTotals,
  cancelPayment,
  cancelInvoice,
  deferInvoice
};
