const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Avancement d'un examen prescrit sur une etape de son service.
 *
 * Une ligne est creee par etape lorsque l'examen entre en realisation ; le
 * statut global de PrescriptionExam reste la synthese (PAID -> IN_PROGRESS ->
 * COMPLETED), tandis que ces lignes tracent le detail du parcours et qui a
 * realise quoi.
 */
const ExamStepProgress = sequelize.define('ExamStepProgress', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  prescriptionExamId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  serviceStepId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'),
    defaultValue: 'PENDING'
  },
  // Ordre fige a la creation : si les etapes du service sont reordonnees plus
  // tard, l'historique des examens deja engages reste coherent.
  stepOrder: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  performedBy: {
    type: DataTypes.UUID,
    allowNull: true
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'exam_step_progress',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['prescriptionExamId', 'serviceStepId'],
      name: 'exam_step_progress_unique'
    }
  ]
});

module.exports = ExamStepProgress;
