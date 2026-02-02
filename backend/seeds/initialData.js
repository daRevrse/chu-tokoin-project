/**
 * Script de seed pour initialiser les donnees de test
 * Usage: npm run seed
 */

require('dotenv').config();
const { User, Exam, Patient, syncDatabase } = require('../models');

const seedData = async () => {
  try {
    console.log('Demarrage du seed...');

    // Synchroniser la base de donnees (force = true pour recreer les tables)
    await syncDatabase(true);
    console.log('Tables creees.');

    // ==========================================
    // UTILISATEURS
    // ==========================================
    console.log('Creation des utilisateurs...');

    const users = [
      {
        email: 'admin@chu-tokoin.tg',
        password: 'Admin123!',
        firstName: 'Admin',
        lastName: 'Systeme',
        role: 'ADMIN',
        phone: '+228 90 00 00 00'
      },
      {
        email: 'medecin@chu-tokoin.tg',
        password: 'Medecin123!',
        firstName: 'Jean',
        lastName: 'KOFFI',
        role: 'DOCTOR',
        phone: '+228 90 11 11 11'
      },
      {
        email: 'medecin2@chu-tokoin.tg',
        password: 'Medecin123!',
        firstName: 'Marie',
        lastName: 'MENSAH',
        role: 'DOCTOR',
        phone: '+228 90 11 22 22'
      },
      {
        email: 'caissier@chu-tokoin.tg',
        password: 'Caissier123!',
        firstName: 'Ama',
        lastName: 'ADJO',
        role: 'CASHIER',
        phone: '+228 90 22 22 22'
      },
      {
        email: 'caissier2@chu-tokoin.tg',
        password: 'Caissier123!',
        firstName: 'Kofi',
        lastName: 'AGBEKO',
        role: 'CASHIER',
        phone: '+228 90 22 33 33'
      },
      {
        email: 'radio@chu-tokoin.tg',
        password: 'Radio123!',
        firstName: 'Pierre',
        lastName: 'AMOUZOU',
        role: 'RADIOLOGIST',
        phone: '+228 90 33 33 33'
      },
      {
        email: 'labo@chu-tokoin.tg',
        password: 'Labo123!',
        firstName: 'Sophie',
        lastName: 'GBEDJI',
        role: 'LAB_TECHNICIAN',
        phone: '+228 90 44 44 44'
      }
    ];

    for (const userData of users) {
      await User.create(userData);
      console.log(`  - Utilisateur cree: ${userData.email}`);
    }

    // ==========================================
    // CATALOGUE D'EXAMENS
    // ==========================================
    console.log('Creation du catalogue d\'examens...');

    const exams = [
      // RADIOLOGIE
      { code: 'RAD-001', name: 'Radiographie thoracique (face)', category: 'RADIOLOGY', price: 15000, description: 'Radio du thorax de face' },
      { code: 'RAD-002', name: 'Radiographie thoracique (face + profil)', category: 'RADIOLOGY', price: 20000, description: 'Radio du thorax face et profil' },
      { code: 'RAD-003', name: 'Radiographie abdominale sans preparation', category: 'RADIOLOGY', price: 15000, description: 'ASP' },
      { code: 'RAD-004', name: 'Radiographie du crane (face + profil)', category: 'RADIOLOGY', price: 20000, description: 'Radio du crane' },
      { code: 'RAD-005', name: 'Radiographie du rachis cervical', category: 'RADIOLOGY', price: 18000, description: 'Radio colonne cervicale' },
      { code: 'RAD-006', name: 'Radiographie du rachis lombaire', category: 'RADIOLOGY', price: 20000, description: 'Radio colonne lombaire' },
      { code: 'RAD-007', name: 'Radiographie du bassin', category: 'RADIOLOGY', price: 18000, description: 'Radio bassin de face' },
      { code: 'RAD-008', name: 'Radiographie des membres (1 segment)', category: 'RADIOLOGY', price: 12000, description: 'Radio membre unique' },
      { code: 'RAD-009', name: 'Echographie abdominale complete', category: 'RADIOLOGY', price: 25000, description: 'Echo abdominale' },
      { code: 'RAD-010', name: 'Echographie pelvienne', category: 'RADIOLOGY', price: 20000, description: 'Echo pelvienne' },
      { code: 'RAD-011', name: 'Echographie obstetricale', category: 'RADIOLOGY', price: 25000, description: 'Echo grossesse' },
      { code: 'RAD-012', name: 'Echographie prostatique', category: 'RADIOLOGY', price: 25000, description: 'Echo prostate' },
      { code: 'RAD-013', name: 'Echographie thyroidienne', category: 'RADIOLOGY', price: 20000, description: 'Echo thyroide' },
      { code: 'RAD-014', name: 'Echographie mammaire', category: 'RADIOLOGY', price: 25000, description: 'Echo seins' },
      { code: 'RAD-015', name: 'Scanner cerebral sans injection', category: 'RADIOLOGY', price: 80000, description: 'TDM cerebrale' },
      { code: 'RAD-016', name: 'Scanner cerebral avec injection', category: 'RADIOLOGY', price: 100000, description: 'TDM cerebrale + contraste' },
      { code: 'RAD-017', name: 'Scanner thoracique', category: 'RADIOLOGY', price: 100000, description: 'TDM thorax' },
      { code: 'RAD-018', name: 'Scanner abdomino-pelvien', category: 'RADIOLOGY', price: 120000, description: 'TDM abdomen + pelvis' },

      // LABORATOIRE - Hematologie
      { code: 'LAB-001', name: 'Hemogramme complet (NFS)', category: 'LABORATORY', price: 5000, description: 'Numeration formule sanguine' },
      { code: 'LAB-002', name: 'Vitesse de sedimentation (VS)', category: 'LABORATORY', price: 2000, description: 'VS' },
      { code: 'LAB-003', name: 'Groupage sanguin ABO-Rhesus', category: 'LABORATORY', price: 5000, description: 'Groupe sanguin' },
      { code: 'LAB-004', name: 'Taux de prothrombine (TP)', category: 'LABORATORY', price: 5000, description: 'TP/INR' },
      { code: 'LAB-005', name: 'Temps de cephaline activee (TCA)', category: 'LABORATORY', price: 5000, description: 'TCA' },

      // LABORATOIRE - Biochimie
      { code: 'LAB-010', name: 'Glycemie a jeun', category: 'LABORATORY', price: 2000, description: 'Glucose sanguin' },
      { code: 'LAB-011', name: 'Hemoglobine glyquee (HbA1c)', category: 'LABORATORY', price: 15000, description: 'HbA1c' },
      { code: 'LAB-012', name: 'Creatininemie', category: 'LABORATORY', price: 3000, description: 'Creatinine sanguine' },
      { code: 'LAB-013', name: 'Uree sanguine', category: 'LABORATORY', price: 3000, description: 'Azote ureique' },
      { code: 'LAB-014', name: 'Acide urique', category: 'LABORATORY', price: 4000, description: 'Uricemie' },
      { code: 'LAB-015', name: 'Transaminases (ASAT/ALAT)', category: 'LABORATORY', price: 6000, description: 'Enzymes hepatiques' },
      { code: 'LAB-016', name: 'Gamma GT', category: 'LABORATORY', price: 4000, description: 'GGT' },
      { code: 'LAB-017', name: 'Phosphatases alcalines', category: 'LABORATORY', price: 4000, description: 'PAL' },
      { code: 'LAB-018', name: 'Bilirubine totale et conjuguee', category: 'LABORATORY', price: 5000, description: 'Bilirubine' },
      { code: 'LAB-019', name: 'Cholesterol total', category: 'LABORATORY', price: 3000, description: 'Cholesterolemie' },
      { code: 'LAB-020', name: 'HDL-Cholesterol', category: 'LABORATORY', price: 4000, description: 'Bon cholesterol' },
      { code: 'LAB-021', name: 'LDL-Cholesterol', category: 'LABORATORY', price: 4000, description: 'Mauvais cholesterol' },
      { code: 'LAB-022', name: 'Triglycerides', category: 'LABORATORY', price: 4000, description: 'TG' },
      { code: 'LAB-023', name: 'Bilan lipidique complet', category: 'LABORATORY', price: 12000, description: 'CT + HDL + LDL + TG' },
      { code: 'LAB-024', name: 'Ionogramme sanguin', category: 'LABORATORY', price: 10000, description: 'Na, K, Cl, Ca' },
      { code: 'LAB-025', name: 'Calcemie', category: 'LABORATORY', price: 4000, description: 'Calcium sanguin' },
      { code: 'LAB-026', name: 'Magnesemie', category: 'LABORATORY', price: 5000, description: 'Magnesium sanguin' },
      { code: 'LAB-027', name: 'Proteines totales', category: 'LABORATORY', price: 4000, description: 'Proteinemie' },
      { code: 'LAB-028', name: 'Albumine', category: 'LABORATORY', price: 4000, description: 'Albuminemie' },

      // LABORATOIRE - Serologie/Immunologie
      { code: 'LAB-030', name: 'Serologie VIH', category: 'LABORATORY', price: 5000, description: 'Test VIH' },
      { code: 'LAB-031', name: 'Serologie Hepatite B (AgHBs)', category: 'LABORATORY', price: 5000, description: 'Antigene HBs' },
      { code: 'LAB-032', name: 'Serologie Hepatite C', category: 'LABORATORY', price: 8000, description: 'Anti-VHC' },
      { code: 'LAB-033', name: 'TPHA/VDRL (Syphilis)', category: 'LABORATORY', price: 5000, description: 'Serologie syphilitique' },
      { code: 'LAB-034', name: 'CRP (Proteine C reactive)', category: 'LABORATORY', price: 5000, description: 'CRP' },
      { code: 'LAB-035', name: 'ASLO', category: 'LABORATORY', price: 5000, description: 'Antistreptolysine O' },
      { code: 'LAB-036', name: 'Facteur rhumatoide', category: 'LABORATORY', price: 8000, description: 'FR' },
      { code: 'LAB-037', name: 'Widal et Felix', category: 'LABORATORY', price: 5000, description: 'Serodiagnostic typhoide' },

      // LABORATOIRE - Hormonologie
      { code: 'LAB-040', name: 'TSH', category: 'LABORATORY', price: 12000, description: 'Thyreostimuline' },
      { code: 'LAB-041', name: 'T3 libre', category: 'LABORATORY', price: 10000, description: 'Triiodothyronine' },
      { code: 'LAB-042', name: 'T4 libre', category: 'LABORATORY', price: 10000, description: 'Thyroxine' },
      { code: 'LAB-043', name: 'Bilan thyroidien complet', category: 'LABORATORY', price: 25000, description: 'TSH + T3 + T4' },
      { code: 'LAB-044', name: 'PSA total', category: 'LABORATORY', price: 15000, description: 'Antigene prostatique' },
      { code: 'LAB-045', name: 'Beta-HCG', category: 'LABORATORY', price: 8000, description: 'Test de grossesse sanguin' },

      // LABORATOIRE - Parasitologie
      { code: 'LAB-050', name: 'Goutte epaisse', category: 'LABORATORY', price: 2000, description: 'Recherche paludisme' },
      { code: 'LAB-051', name: 'TDR Paludisme', category: 'LABORATORY', price: 3000, description: 'Test rapide paludisme' },
      { code: 'LAB-052', name: 'Examen parasitologique des selles', category: 'LABORATORY', price: 3000, description: 'KOP' },

      // LABORATOIRE - Bacteriologie
      { code: 'LAB-060', name: 'ECBU', category: 'LABORATORY', price: 8000, description: 'Examen cytobacteriologique des urines' },
      { code: 'LAB-061', name: 'Coproculture', category: 'LABORATORY', price: 10000, description: 'Culture des selles' },
      { code: 'LAB-062', name: 'Prelevement vaginal', category: 'LABORATORY', price: 8000, description: 'PV' },
      { code: 'LAB-063', name: 'Prelevement uretral', category: 'LABORATORY', price: 8000, description: 'Ecoulement uretral' },
      { code: 'LAB-064', name: 'Hemoculture', category: 'LABORATORY', price: 15000, description: 'Culture sanguine' },
      { code: 'LAB-065', name: 'Antibiogramme', category: 'LABORATORY', price: 10000, description: 'Sensibilite aux antibiotiques' }
    ];

    for (const examData of exams) {
      await Exam.create(examData);
    }
    console.log(`  - ${exams.length} examens crees.`);

    // ==========================================
    // PATIENTS DE TEST
    // ==========================================
    console.log('Creation des patients de test...');

    const patients = [
      {
        firstName: 'Kossi',
        lastName: 'AGBODJAN',
        dateOfBirth: '1985-03-15',
        gender: 'M',
        phone: '+228 90 12 34 56',
        address: 'Quartier Nyekonakpoe, Lome',
        email: 'kossi.agbodjan@email.tg'
      },
      {
        firstName: 'Adjoa',
        lastName: 'MENSAH',
        dateOfBirth: '1990-07-22',
        gender: 'F',
        phone: '+228 91 23 45 67',
        address: 'Quartier Adidogome, Lome'
      },
      {
        firstName: 'Koffi',
        lastName: 'AMEGAH',
        dateOfBirth: '1978-11-08',
        gender: 'M',
        phone: '+228 92 34 56 78',
        address: 'Quartier Be, Lome'
      },
      {
        firstName: 'Afi',
        lastName: 'SEGBEAYA',
        dateOfBirth: '1995-01-30',
        gender: 'F',
        phone: '+228 93 45 67 89',
        address: 'Quartier Tokoin, Lome',
        email: 'afi.segbeaya@email.tg'
      },
      {
        firstName: 'Kodjo',
        lastName: 'AZIAFEKEY',
        dateOfBirth: '1960-05-12',
        gender: 'M',
        phone: '+228 94 56 78 90',
        address: 'Quartier Djidjole, Lome'
      }
    ];

    for (const patientData of patients) {
      const patient = await Patient.create(patientData);
      console.log(`  - Patient cree: ${patient.patientNumber} - ${patient.lastName} ${patient.firstName}`);
    }

    // ==========================================
    // TERMINE
    // ==========================================
    console.log('\n========================================');
    console.log('Seed termine avec succes!');
    console.log('========================================');
    console.log(`Utilisateurs crees: ${users.length}`);
    console.log(`Examens crees: ${exams.length}`);
    console.log(`Patients crees: ${patients.length}`);
    console.log('\nComptes de test:');
    console.log('  - Admin: admin@chu-tokoin.tg / Admin123!');
    console.log('  - Medecin: medecin@chu-tokoin.tg / Medecin123!');
    console.log('  - Caissier: caissier@chu-tokoin.tg / Caissier123!');
    console.log('  - Radiologue: radio@chu-tokoin.tg / Radio123!');
    console.log('  - Laborantin: labo@chu-tokoin.tg / Labo123!');
    console.log('========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Erreur lors du seed:', error);
    process.exit(1);
  }
};

// Executer le seed
seedData();
