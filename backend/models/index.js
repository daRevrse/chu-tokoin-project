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

// ==========================================
// ASSOCIATIONS
// ==========================================

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

// Prescription - Payment
Prescription.hasMany(Payment, {
  foreignKey: 'prescriptionId',
  as: 'payments'
});
Payment.belongsTo(Prescription, {
  foreignKey: 'prescriptionId',
  as: 'prescription'
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

const syncDatabase = async (force = false) => {
  try {
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
  syncDatabase
};
