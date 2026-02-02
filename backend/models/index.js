const sequelize = require('../config/database');
const User = require('./User');
const Patient = require('./Patient');
const Exam = require('./Exam');
const Prescription = require('./Prescription');
const PrescriptionExam = require('./PrescriptionExam');
const Payment = require('./Payment');

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
  syncDatabase
};
