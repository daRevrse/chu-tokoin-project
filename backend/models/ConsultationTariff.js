const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Grille des frais de consultation, administrable.
 *
 * Aucun montant n'est ecrit en dur dans le code : les tarifs different d'un
 * etablissement a l'autre et changent par arrete. La grille est donc une table,
 * pas une constante.
 *
 * Resolution du tarif applicable (voir services/consultationFeeService.js) :
 *   1. ligne active pour (specialite du passage, type de passage)
 *   2. a defaut, ligne active pour (specialite nulle, type de passage) = tarif
 *      par defaut de l'etablissement
 *   3. a defaut, aucun frais : le passage n'est pas facture et n'est pas bloque
 *
 * Le troisieme cas est volontaire. Sur une installation neuve ou l'administrateur
 * n'a encore rien saisi, le circuit doit continuer de fonctionner : un logiciel
 * qui bloque tous les patients parce qu'un tarif manque est pire que gratuit.
 *
 * Un montant a 0 est un tarif valide et distinct de l'absence de tarif : il
 * produit une facture soldee, donc une trace de la gratuite accordee.
 */
const ConsultationTariff = sequelize.define('ConsultationTariff', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  // NULL = tarif par defaut, applique a toute specialite sans tarif propre,
  // ainsi qu'aux passages non orientes.
  specialtyId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'specialties',
      key: 'id'
    }
  },
  // Meme decoupage que Visit.visitType : un retour resultats ne se facture pas
  // comme une premiere consultation, et ne pas pouvoir les distinguer
  // obligerait a facturer les deux au meme prix.
  // EMERGENCY couvre le forfait d'admission aux urgences. Il partage cette
  // grille parce que c'est le meme geste administratif — un droit d'entree dans
  // un circuit de soins — et qu'un second referentiel de tarifs se serait
  // desynchronise du premier.
  visitType: {
    type: DataTypes.ENUM('CONSULTATION', 'RESULT_REVIEW', 'EMERGENCY'),
    allowNull: false,
    defaultValue: 'CONSULTATION'
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: {
        args: [0],
        msg: 'Le montant ne peut pas etre negatif'
      }
    }
  },
  // Libelle imprime sur la facture et le recu, ex. "Consultation pediatrie"
  label: {
    type: DataTypes.STRING(120),
    allowNull: true
  },
  // Duree pendant laquelle le ticket de consultation reste valable : un patient
  // qui revient dans ce delai voir la meme specialite ne repaie pas.
  //
  // 0 = pas de gratuite de suivi, chaque passage est facture. C'est la valeur
  // par defaut : ne pas refacturer est une decision de l'etablissement, pas un
  // comportement a supposer.
  //
  // La contrepartie n'est pas effacee mais facturee a 0 : le passage laisse une
  // facture soldee, donc une trace de la gratuite accordee et de son motif.
  validityDays: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: { args: [0], msg: 'Le delai ne peut pas etre negatif' },
      max: { args: [365], msg: 'Delai invalide (365 jours maximum)' }
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'consultation_tariffs',
  timestamps: true,
  indexes: [
    // Index de lecture uniquement. L'unicite du couple (specialite, type) ne
    // peut pas etre confiee a MySQL : un index unique laisse passer plusieurs
    // lignes dont `specialtyId` est NULL, c'est-a-dire exactement les doublons
    // de tarif par defaut qu'il faudrait interdire. Elle est donc verifiee dans
    // le controleur.
    { fields: ['specialtyId', 'visitType'], name: 'tariffs_specialty_type' }
  ]
});

module.exports = ConsultationTariff;
