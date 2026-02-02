const QRCode = require('qrcode');
const logger = require('../utils/logger');

const qrcodeService = {
  /**
   * Generer un QR code a partir des donnees
   * @param {Object} data - Les donnees a encoder
   * @returns {Object} - { qrCodeImage, qrData }
   */
  generateQRCode: async (data) => {
    try {
      // Convertir les donnees en JSON
      const qrData = JSON.stringify(data);

      // Generer le QR code en base64
      const qrCodeImage = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      });

      logger.debug('QR code genere', { dataLength: qrData.length });

      return {
        qrCodeImage,
        qrData
      };
    } catch (error) {
      logger.error('QR Code generation error:', error);
      throw new Error('Erreur lors de la generation du QR code');
    }
  },

  /**
   * Parser les donnees d'un QR code
   * @param {string} qrData - Les donnees du QR code
   * @returns {Object} - Les donnees parsees
   */
  parseQRCode: (qrData) => {
    try {
      return JSON.parse(qrData);
    } catch (error) {
      logger.warn('Invalid QR code data:', { data: qrData });
      throw new Error('QR code invalide');
    }
  },

  /**
   * Generer les donnees du QR code pour un paiement
   * @param {Object} payment - Le paiement
   * @param {Object} prescription - La prescription
   * @param {Object} patient - Le patient
   * @param {Array} exams - Les examens
   * @returns {Object} - Les donnees pour le QR code
   */
  generatePaymentQRData: (payment, prescription, patient, exams) => {
    return {
      type: 'CHU_TOKOIN_PAYMENT',
      version: '1.0',
      paymentId: payment.id,
      paymentNumber: payment.paymentNumber,
      prescriptionId: prescription.id,
      prescriptionNumber: prescription.prescriptionNumber,
      patient: {
        id: patient.id,
        number: patient.patientNumber,
        name: `${patient.lastName} ${patient.firstName}`
      },
      amount: parseFloat(payment.amount),
      exams: exams.map(pe => ({
        id: pe.id,
        code: pe.exam.code,
        name: pe.exam.name,
        category: pe.exam.category,
        status: pe.status
      })),
      paidAt: payment.paymentDate.toISOString(),
      generatedAt: new Date().toISOString()
    };
  }
};

module.exports = qrcodeService;
