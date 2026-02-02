const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

// Configuration des providers Mobile Money
const providers = {
  TMONEY: {
    name: 'T-Money',
    baseUrl: process.env.TMONEY_API_URL || 'https://api-sandbox.tmoney.tg',
    merchantId: process.env.TMONEY_MERCHANT_ID || 'CHU_TOKOIN_SANDBOX',
    apiKey: process.env.TMONEY_API_KEY || 'sandbox_key',
    secretKey: process.env.TMONEY_SECRET_KEY || 'sandbox_secret'
  },
  FLOOZ: {
    name: 'Flooz',
    baseUrl: process.env.FLOOZ_API_URL || 'https://api-sandbox.flooz.tg',
    merchantId: process.env.FLOOZ_MERCHANT_ID || 'CHU_TOKOIN_SANDBOX',
    apiKey: process.env.FLOOZ_API_KEY || 'sandbox_key',
    secretKey: process.env.FLOOZ_SECRET_KEY || 'sandbox_secret'
  }
};

const mobileMoneyService = {
  /**
   * Initier un paiement Mobile Money
   */
  initiatePayment: async (provider, amount, phoneNumber, reference, description) => {
    try {
      const config = providers[provider];
      if (!config) {
        throw new Error('Provider non supporte');
      }

      // Generer la signature
      const timestamp = Date.now();
      const signature = crypto
        .createHmac('sha256', config.secretKey)
        .update(`${config.merchantId}${amount}${reference}${timestamp}`)
        .digest('hex');

      const payload = {
        merchantId: config.merchantId,
        amount,
        currency: 'XOF',
        phoneNumber,
        reference,
        description,
        callbackUrl: `${process.env.API_URL || 'http://localhost:5000'}/api/payments/mobile-money/callback/${provider.toLowerCase()}`,
        timestamp,
        signature
      };

      logger.info(`Initiating ${provider} payment`, { reference, amount, phoneNumber: phoneNumber.slice(-4) });

      // En mode sandbox/developpement, simuler la reponse
      if (process.env.NODE_ENV !== 'production' || !config.baseUrl.includes('api.')) {
        logger.info('Mode sandbox - Simulation de paiement Mobile Money');
        return {
          success: true,
          transactionId: `${provider}_${crypto.randomUUID()}`,
          status: 'PENDING',
          message: 'Paiement initie avec succes (Sandbox)'
        };
      }

      const response = await axios.post(`${config.baseUrl}/payment/initiate`, payload, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      return {
        success: true,
        transactionId: response.data.transactionId,
        status: response.data.status,
        message: response.data.message
      };
    } catch (error) {
      logger.error(`${provider} payment error`, { error: error.message, reference });
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  },

  /**
   * Verifier le statut d'un paiement
   */
  checkStatus: async (provider, transactionId) => {
    try {
      const config = providers[provider];
      if (!config) {
        throw new Error('Provider non supporte');
      }

      // En mode sandbox, simuler une reponse positive apres un delai
      if (process.env.NODE_ENV !== 'production') {
        logger.info('Mode sandbox - Simulation de verification de statut');
        return {
          success: true,
          status: 'SUCCESS',
          transactionId,
          amount: 0,
          completedAt: new Date().toISOString()
        };
      }

      const response = await axios.get(`${config.baseUrl}/payment/status/${transactionId}`, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`
        }
      });

      return {
        success: true,
        status: response.data.status,
        transactionId: response.data.transactionId,
        amount: response.data.amount,
        completedAt: response.data.completedAt
      };
    } catch (error) {
      logger.error(`${provider} status check error`, { error: error.message, transactionId });
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Traiter le callback du provider
   */
  processCallback: async (provider, payload, signature) => {
    try {
      const config = providers[provider.toUpperCase()];
      if (!config) {
        return { valid: false, error: 'Provider non supporte' };
      }

      // En mode sandbox, accepter tous les callbacks
      if (process.env.NODE_ENV !== 'production') {
        logger.info('Mode sandbox - Callback accepte automatiquement');
        return {
          valid: true,
          reference: payload.reference,
          transactionId: payload.transactionId,
          status: payload.status || 'SUCCESS',
          amount: payload.amount
        };
      }

      // Verifier la signature en production
      const expectedSignature = crypto
        .createHmac('sha256', config.secretKey)
        .update(JSON.stringify(payload))
        .digest('hex');

      if (signature !== expectedSignature) {
        logger.warn('Invalid callback signature', { provider, reference: payload.reference });
        return { valid: false, error: 'Signature invalide' };
      }

      return {
        valid: true,
        reference: payload.reference,
        transactionId: payload.transactionId,
        status: payload.status,
        amount: payload.amount
      };
    } catch (error) {
      logger.error('Callback processing error', { error: error.message });
      return { valid: false, error: error.message };
    }
  },

  /**
   * Simuler un callback pour les tests
   */
  simulateCallback: async (paymentId, status = 'SUCCESS') => {
    // Cette fonction est utilisee uniquement en mode sandbox pour simuler les callbacks
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Simulation non autorisee en production');
    }

    return {
      valid: true,
      status,
      simulatedAt: new Date().toISOString()
    };
  }
};

module.exports = mobileMoneyService;
