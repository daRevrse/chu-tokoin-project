const sequelize = require('../config/database');
const User = require('./User');
const Patient = require('./Patient');
const Exam = require('./Exam');
const Prescription = require('./Prescription');
const PrescriptionExam = require('./PrescriptionExam');
const Payment = require('./Payment');
const Result = require('./Result');
const MobileMoneyTransaction = require('./MobileMoneyTransaction');
const Service = require('./Service');
const ExamCategory = require('./ExamCategory');
const ServiceStep = require('./ServiceStep');
const ExamStepProgress = require('./ExamStepProgress');
const Visit = require('./Visit');
const DailyCounter = require('./DailyCounter');
const SequenceCounter = require('./SequenceCounter');
const HospitalSettings = require('./HospitalSettings');
const Specialty = require('./Specialty');
const ConsultationTariff = require('./ConsultationTariff');
const Invoice = require('./Invoice');
const InvoiceLine = require('./InvoiceLine');
const EmergencyCase = require('./EmergencyCase');

// ==========================================
// ASSOCIATIONS
// ==========================================

// Patient - Visit (un patient a autant de passages que de venues)
Patient.hasMany(Visit, {
  foreignKey: 'patientId',
  as: 'visits'
});
Visit.belongsTo(Patient, {
  foreignKey: 'patientId',
  as: 'patient'
});

// User (Receptionniste) - Visit
Visit.belongsTo(User, {
  foreignKey: 'registeredBy',
  as: 'receptionist'
});

// User (Medecin) - Visit (prise en charge)
User.hasMany(Visit, {
  foreignKey: 'doctorId',
  as: 'visitsAsDoctor'
});
Visit.belongsTo(User, {
  foreignKey: 'doctorId',
  as: 'doctor'
});

// Visit - Prescription (une consultation peut produire plusieurs ordonnances)
Visit.hasMany(Prescription, {
  foreignKey: 'visitId',
  as: 'prescriptions'
});
Prescription.belongsTo(Visit, {
  foreignKey: 'visitId',
  as: 'visit'
});

// Visit - Prescription relue (retour du patient pour ses resultats). Relation
// distincte de la precedente : ici la prescription preexiste au passage.
Visit.belongsTo(Prescription, {
  foreignKey: 'reviewedPrescriptionId',
  as: 'reviewedPrescription'
});

// Patient - Prescription
Patient.hasMany(Prescription, {
  foreignKey: 'patientId',
  as: 'prescriptions'
});
Prescription.belongsTo(Patient, {
  foreignKey: 'patientId',
  as: 'patient'
});

// User (Doctor) - Prescription
User.hasMany(Prescription, {
  foreignKey: 'doctorId',
  as: 'prescriptionsAsDoctor'
});
Prescription.belongsTo(User, {
  foreignKey: 'doctorId',
  as: 'doctor'
});

// Prescription - PrescriptionExam
Prescription.hasMany(PrescriptionExam, {
  foreignKey: 'prescriptionId',
  as: 'prescriptionExams'
});
PrescriptionExam.belongsTo(Prescription, {
  foreignKey: 'prescriptionId',
  as: 'prescription'
});

// Exam - PrescriptionExam
Exam.hasMany(PrescriptionExam, {
  foreignKey: 'examId',
  as: 'prescriptionExams'
});
PrescriptionExam.belongsTo(Exam, {
  foreignKey: 'examId',
  as: 'exam'
});

// User (Performer) - PrescriptionExam
User.hasMany(PrescriptionExam, {
  foreignKey: 'performedBy',
  as: 'performedExams'
});
PrescriptionExam.belongsTo(User, {
  foreignKey: 'performedBy',
  as: 'performer'
});

// Prescription - Payment. Conservee malgre l'arrivee de la facture : voir le
// commentaire de `Payment.prescriptionId` sur cette denormalisation.
Prescription.hasMany(Payment, {
  foreignKey: 'prescriptionId',
  as: 'payments'
});
Payment.belongsTo(Prescription, {
  foreignKey: 'prescriptionId',
  as: 'prescription'
});

// Invoice - InvoiceLine
Invoice.hasMany(InvoiceLine, {
  foreignKey: 'invoiceId',
  as: 'lines'
});
InvoiceLine.belongsTo(Invoice, {
  foreignKey: 'invoiceId',
  as: 'invoice'
});

// Invoice - Payment (plusieurs versements possibles sur une meme facture)
Invoice.hasMany(Payment, {
  foreignKey: 'invoiceId',
  as: 'payments'
});
Payment.belongsTo(Invoice, {
  foreignKey: 'invoiceId',
  as: 'invoice'
});

// Patient - Invoice
Patient.hasMany(Invoice, {
  foreignKey: 'patientId',
  as: 'invoices'
});
Invoice.belongsTo(Patient, {
  foreignKey: 'patientId',
  as: 'patient'
});

// Visit - Invoice (consultation puis examens : deux factures pour un passage)
Visit.hasMany(Invoice, {
  foreignKey: 'visitId',
  as: 'invoices'
});
Invoice.belongsTo(Visit, {
  foreignKey: 'visitId',
  as: 'visit'
});

// Prescription - Invoice
Prescription.hasMany(Invoice, {
  foreignKey: 'prescriptionId',
  as: 'invoices'
});
Invoice.belongsTo(Prescription, {
  foreignKey: 'prescriptionId',
  as: 'prescription'
});

Invoice.belongsTo(User, {
  foreignKey: 'issuedBy',
  as: 'issuer'
});

// --- Service d'accueil des urgences ---

// Patient - EmergencyCase. Le rattachement est facultatif : un dossier peut
// vivre sans patient tant que l'identite n'est pas etablie.
Patient.hasMany(EmergencyCase, {
  foreignKey: 'patientId',
  as: 'emergencyCases'
});
EmergencyCase.belongsTo(Patient, {
  foreignKey: 'patientId',
  as: 'patient'
});

EmergencyCase.belongsTo(User, {
  foreignKey: 'registeredBy',
  as: 'registrar'
});
EmergencyCase.belongsTo(User, {
  foreignKey: 'triagedBy',
  as: 'triageNurse'
});
EmergencyCase.belongsTo(User, {
  foreignKey: 'doctorId',
  as: 'doctor'
});

// EmergencyCase - Invoice
EmergencyCase.hasMany(Invoice, {
  foreignKey: 'emergencyCaseId',
  as: 'invoices'
});
Invoice.belongsTo(EmergencyCase, {
  foreignKey: 'emergencyCaseId',
  as: 'emergencyCase'
});

// --- Specialites cliniques ---

// Specialty - User (medecins rattaches a la specialite)
Specialty.hasMany(User, {
  foreignKey: 'specialtyId',
  as: 'doctors'
});
User.belongsTo(Specialty, {
  foreignKey: 'specialtyId',
  as: 'specialty'
});

// Specialty - Visit (orientation decidee a l'accueil)
Specialty.hasMany(Visit, {
  foreignKey: 'specialtyId',
  as: 'visits'
});
Visit.belongsTo(Specialty, {
  foreignKey: 'specialtyId',
  as: 'specialty'
});

// Specialty - ConsultationTariff
Specialty.hasMany(ConsultationTariff, {
  foreignKey: 'specialtyId',
  as: 'tariffs'
});
ConsultationTariff.belongsTo(Specialty, {
  foreignKey: 'specialtyId',
  as: 'specialty'
});

// User (Cashier) - Payment
User.hasMany(Payment, {
  foreignKey: 'cashierId',
  as: 'paymentsAsCashier'
});
Payment.belongsTo(User, {
  foreignKey: 'cashierId',
  as: 'cashier'
});

// PrescriptionExam - Result
PrescriptionExam.hasMany(Result, {
  foreignKey: 'prescriptionExamId',
  as: 'results'
});
Result.belongsTo(PrescriptionExam, {
  foreignKey: 'prescriptionExamId',
  as: 'prescriptionExam'
});

// User (Uploader) - Result
User.hasMany(Result, {
  foreignKey: 'uploadedBy',
  as: 'uploadedResults'
});
Result.belongsTo(User, {
  foreignKey: 'uploadedBy',
  as: 'uploader'
});

// User (Validator) - Result
User.hasMany(Result, {
  foreignKey: 'validatedBy',
  as: 'validatedResults'
});
Result.belongsTo(User, {
  foreignKey: 'validatedBy',
  as: 'validator'
});

// Payment - MobileMoneyTransaction
Payment.hasOne(MobileMoneyTransaction, {
  foreignKey: 'paymentId',
  as: 'mobileMoneyTransaction'
});
MobileMoneyTransaction.belongsTo(Payment, {
  foreignKey: 'paymentId',
  as: 'payment'
});

// Service - ExamCategory
Service.hasMany(ExamCategory, {
  foreignKey: 'serviceId',
  as: 'categories'
});
ExamCategory.belongsTo(Service, {
  foreignKey: 'serviceId',
  as: 'service'
});

// Service - Exam
Service.hasMany(Exam, {
  foreignKey: 'serviceId',
  as: 'exams'
});
Exam.belongsTo(Service, {
  foreignKey: 'serviceId',
  as: 'service'
});

// ExamCategory - Exam
ExamCategory.hasMany(Exam, {
  foreignKey: 'categoryId',
  as: 'exams'
});
Exam.belongsTo(ExamCategory, {
  foreignKey: 'categoryId',
  as: 'examCategory'
});

// Service - User (personnel affecte au service)
Service.hasMany(User, {
  foreignKey: 'serviceId',
  as: 'staff'
});
User.belongsTo(Service, {
  foreignKey: 'serviceId',
  as: 'service'
});

// Service - ServiceStep (etapes de realisation propres au service)
Service.hasMany(ServiceStep, {
  foreignKey: 'serviceId',
  as: 'steps'
});
ServiceStep.belongsTo(Service, {
  foreignKey: 'serviceId',
  as: 'service'
});

// PrescriptionExam - ExamStepProgress (avancement etape par etape)
PrescriptionExam.hasMany(ExamStepProgress, {
  foreignKey: 'prescriptionExamId',
  as: 'stepProgress'
});
ExamStepProgress.belongsTo(PrescriptionExam, {
  foreignKey: 'prescriptionExamId',
  as: 'prescriptionExam'
});

ServiceStep.hasMany(ExamStepProgress, {
  foreignKey: 'serviceStepId',
  as: 'progress'
});
ExamStepProgress.belongsTo(ServiceStep, {
  foreignKey: 'serviceStepId',
  as: 'step'
});

ExamStepProgress.belongsTo(User, {
  foreignKey: 'performedBy',
  as: 'performer'
});

// ==========================================
// SYNCHRONISATION
// ==========================================

/**
 * Tables nouvelles vers lesquelles des tables preexistantes pointent.
 *
 * Le schema comporte des references croisees (visits <-> prescriptions).
 * Sequelize traite ces modeles en deux passes : il cree d'abord les tables sans
 * contrainte, puis les ajoute. Cette precaution ne vaut que pour les CREATE
 * TABLE : quand une table existe deja, l'ajout d'une colonne passe par un
 * ALTER TABLE qui, lui, porte la contrainte. Mettre a jour une base en service
 * echoue donc en errno 150 — `payments.invoiceId` reference `invoices`, qui
 * n'est creee que plus loin dans la meme passe.
 *
 * Ces tables sont donc creees d'abord, sans leurs propres cles etrangeres : la
 * cible existe avant que quiconque ne la reference, et la passe generale pose
 * ensuite toutes les contraintes.
 */
// `emergency_cases` precede `invoices`, qui la reference.
const NEW_MODELS = [Specialty, ConsultationTariff, EmergencyCase, Invoice, InvoiceLine, SequenceCounter];

/**
 * Colonnes devenues facultatives, a relacher avant la synchronisation.
 *
 * `sync({ alter })` pose les cles etrangeres avant de modifier la nullabilite
 * des colonnes. Une contrainte `ON DELETE SET NULL` sur une colonne encore
 * NOT NULL est refusee par MySQL (errno 150), et la synchronisation s'arrete
 * avant d'avoir pu relacher la colonne : il faut donc le faire en amont.
 *
 * `payments.prescriptionId` est devenue facultative avec l'arrivee des factures,
 * un paiement pouvant desormais porter sur une consultation, qui n'a pas de
 * prescription.
 */
const RELAXED_COLUMNS = [
  {
    table: 'payments',
    column: 'prescriptionId',
    // `BINARY` n'est pas decoratif : les UUID generes par Sequelize sont stockes
    // en `utf8mb4_bin`, et MySQL refuse une cle etrangere entre deux colonnes de
    // collations differentes — avec le meme errno 150 que pour une table
    // manquante, ce qui rend le diagnostic trompeur.
    definition: 'CHAR(36) BINARY NULL',
    collation: 'utf8mb4_bin'
  }
];

const relaxColumns = async () => {
  for (const { table, column, definition, collation } of RELAXED_COLUMNS) {
    const [rows] = await sequelize.query(
      `SELECT IS_NULLABLE, COLLATION_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column`,
      { replacements: { table, column } }
    );

    // Table ou colonne absente (base neuve) : la creation posera directement la
    // bonne definition.
    if (rows.length === 0) continue;

    const current = rows[0];
    if (current.IS_NULLABLE === 'YES' && current.COLLATION_NAME === collation) continue;

    await sequelize.query(`ALTER TABLE \`${table}\` MODIFY \`${column}\` ${definition}`);
    console.log(`Colonne ${table}.${column} rendue facultative`);
  }
};

/**
 * Vide entierement le schema avant une reconstruction (`force`).
 *
 * `sync({ force })` s'en charge normalement, mais il ne sait pas ordonner les
 * suppressions quand le graphe des references comporte un cycle
 * (visits <-> prescriptions) : il supprime alors dans un ordre arbitraire et
 * echoue des qu'une table encore referencee passe en premier. Depuis que
 * `users` et `visits` pointent vers `specialties`, `npm run seed` s'arretait sur
 * `DROP TABLE specialties` — la base restait en l'etat et le seed ne se
 * terminait jamais.
 *
 * Les suppressions se font donc a la main, cles etrangeres desactivees. La
 * transaction n'est pas la pour l'atomicite — MySQL valide implicitement chaque
 * DDL — mais pour epingler une connexion unique : `FOREIGN_KEY_CHECKS` est une
 * variable de session, et le pool servirait sinon les DROP sur des connexions
 * ou elle est restee active.
 */
const dropAllTables = async () => {
  const [rows] = await sequelize.query(
    `SELECT TABLE_NAME AS name FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'`
  );

  if (rows.length === 0) return;

  await sequelize.transaction(async (transaction) => {
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { transaction });

    for (const { name } of rows) {
      await sequelize.query(`DROP TABLE IF EXISTS \`${name}\``, { transaction });
    }

    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { transaction });
  });
};

const syncDatabase = async (force = false) => {
  try {
    // Sur un schema vide, `sync({ force })` n'a plus que des CREATE a faire :
    // il les ordonne correctement, contrairement aux suppressions.
    if (force) await dropAllTables();

    for (const model of NEW_MODELS) {
      await model.sync({ force, alter: !force, withoutForeignKeyConstraints: true });
    }

    if (!force) await relaxColumns();

    await sequelize.sync({ force, alter: !force });
    console.log('Base de donnees synchronisee avec succes');
    return true;
  } catch (error) {
    console.error('Erreur lors de la synchronisation:', error);
    throw error;
  }
};

module.exports = {
  sequelize,
  User,
  Patient,
  Exam,
  Prescription,
  PrescriptionExam,
  Payment,
  Result,
  MobileMoneyTransaction,
  Service,
  ExamCategory,
  ServiceStep,
  ExamStepProgress,
  Visit,
  DailyCounter,
  SequenceCounter,
  HospitalSettings,
  Specialty,
  ConsultationTariff,
  Invoice,
  InvoiceLine,
  EmergencyCase,
  syncDatabase
};
