// verification/controllers/verificationController.js
const faceVerificationService = require('../services/faceVerificationService');
const config = require('../config/verificationConfig');
const logger = require('../../logger');

/**
 * Controller to handle Face Verification (YES/NO) requests.
 */
const verificationController = {
  /**
   * Health check to inspect module status & configuration
   */
  healthCheck: async (req, res) => {
    return res.status(200).json({
      success: true,
      service: 'Face Verification (YES/NO) Module',
      configured: {
        hasBaseUrl: Boolean(config.baseUrl),
        hasDefaultMerchantKey: Boolean(config.defaultMerchantKey),
        hasDefaultUserId: Boolean(config.defaultUserId),
        center: config.defaultCenter,
        dataType: config.defaultDataType,
        timeoutMs: config.timeoutMs
      },
      timestamp: new Date().toISOString()
    });
  },

  /**
   * Execute Face Verification (YES/NO)
   */
  verifyFace: async (req, res) => {
    try {
      if (typeof req.body === 'string') {
        try {
          req.body = JSON.parse(req.body.replace(/[\r\n]+/g, ''));
        } catch (e) {}
      }
      const {
        pinNumber,
        image,
        dataType,
        center,
        userID,
        merchantKey
      } = req.body || {};

      // 1. Validation: pinNumber
      if (!pinNumber || typeof pinNumber !== 'string' || !pinNumber.trim()) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Field "pinNumber" is required and must be a non-empty string.',
          field: 'pinNumber'
        });
      }

      // 2. Validation: image (Base64)
      if (!image || typeof image !== 'string' || !image.trim()) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Field "image" is required and must be a valid Base64 string.',
          field: 'image'
        });
      }

      // Clean image if client sent data URI prefix e.g. "data:image/png;base64,..."
      let cleanedImage = image.trim();
      const dataUriMatch = cleanedImage.match(/^data:image\/[a-zA-Z]+;base64,(.+)$/);
      if (dataUriMatch && dataUriMatch[1]) {
        cleanedImage = dataUriMatch[1];
      }

      // 3. Validation: merchantKey (from body or env config)
      const effectiveMerchantKey = merchantKey || config.defaultMerchantKey;
      if (!effectiveMerchantKey) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Field "merchantKey" is required in request body or via THIRD_PARTY_VERIFICATION_MERCHANT_KEY environment variable.',
          field: 'merchantKey'
        });
      }

      // 4. Construct payload for third party
      const payload = {
        pinNumber: pinNumber.trim(),
        image: cleanedImage,
        dataType: (dataType && dataType.trim()) || config.defaultDataType,
        center: (center && center.trim()) || config.defaultCenter,
        userID: (userID && userID.trim()) || config.defaultUserId || '',
        merchantKey: effectiveMerchantKey
      };

      // 5. Invoke service
      const result = await faceVerificationService.verifyFace(payload);

      // 6. Handle failure / error response
      if (!result.success) {
        // If third party returned a structured verification response body (e.g. verified: "FALSE", code: "11", etc.)
        if (result.data) {
          return res.status(200).json(result.data);
        }

        // Otherwise return our structured error
        return res.status(result.statusCode || 500).json({
          success: false,
          code: result.code || 'VERIFICATION_FAILED',
          message: result.message || 'Face verification failed.',
          error: result.error || null,
          timestamp: new Date().toISOString()
        });
      }

      // 7. Handle success response
      // Third party returns { success: true, code: "00", timestamp: "...", data: { ... } }
      return res.status(result.statusCode || 200).json(result.data);
    } catch (err) {
      logger.error('[VerificationController] Unexpected error in verifyFace handler:', err);
      return res.status(500).json({
        success: false,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An internal server error occurred while processing face verification.',
        error: err.message,
        timestamp: new Date().toISOString()
      });
    }
  }
};

module.exports = verificationController;
