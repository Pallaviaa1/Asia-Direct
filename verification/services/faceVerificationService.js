// verification/services/faceVerificationService.js
const axios = require('axios');
const config = require('../config/verificationConfig');
const logger = require('../../logger');

/**
 * Call the third-party Face Verification API.
 *
 * @param {Object} payload
 * @param {string} payload.pinNumber
 * @param {string} payload.image
 * @param {string} [payload.dataType]
 * @param {string} [payload.center]
 * @param {string} [payload.userID]
 * @param {string} [payload.merchantKey]
 * @returns {Promise<Object>} Formatted result { success, statusCode, data, message, error }
 */
async function verifyFace(payload) {
  const baseUrl = config.baseUrl;
  if (!baseUrl) {
    const errorMsg = 'Third-party verification base URL is not configured (THIRD_PARTY_VERIFICATION_BASE_URL).';
    logger.error(`[FaceVerificationService] Configuration error: ${errorMsg}`);
    return {
      success: false,
      statusCode: 500,
      code: 'CONFIG_ERROR',
      message: errorMsg,
      error: { reason: 'MISSING_BASE_URL' }
    };
  }

  // Construct target URL
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedPath = config.endpointPath.replace(/^\/+/, '');
  const targetUrl = `${normalizedBase}/${normalizedPath}`;

  // Build the request body with defaults where needed
  const requestBody = {
    pinNumber: payload.pinNumber,
    image: payload.image,
    dataType: payload.dataType || config.defaultDataType,
    center: payload.center || config.defaultCenter,
    userID: payload.userID || config.defaultUserId,
    merchantKey: payload.merchantKey || config.defaultMerchantKey
  };

  logger.info(`[FaceVerificationService] Sending face verification request to ${targetUrl}`, {
    pinNumber: requestBody.pinNumber,
    dataType: requestBody.dataType,
    center: requestBody.center,
    userID: requestBody.userID,
    hasImage: Boolean(requestBody.image),
    hasMerchantKey: Boolean(requestBody.merchantKey)
  });

  const startTime = Date.now();

  try {
    const response = await axios.post(targetUrl, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: config.timeoutMs
    });

    const duration = Date.now() - startTime;
    logger.info(`[FaceVerificationService] Success response received in ${duration}ms`, {
      status: response.status,
      code: response.data?.code,
      verified: response.data?.data?.verified
    });

    return {
      success: true,
      statusCode: response.status || 200,
      data: response.data
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    // Case 1: The third-party server responded with a non-2xx status code
    if (error.response) {
      logger.error(`[FaceVerificationService] Third-party responded with error status ${error.response.status} in ${duration}ms`, {
        status: error.response.status,
        data: error.response.data
      });

      return {
        success: false,
        statusCode: error.response.status,
        code: error.response.data?.code || 'THIRD_PARTY_ERROR',
        message: error.response.data?.message || 'Third-party verification failed.',
        data: error.response.data
      };
    }

    // Case 2: Request timed out
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      logger.error(`[FaceVerificationService] Request timed out after ${duration}ms (limit: ${config.timeoutMs}ms)`);
      return {
        success: false,
        statusCode: 504,
        code: 'GATEWAY_TIMEOUT',
        message: `Face verification service timed out after ${config.timeoutMs}ms.`,
        error: { timeout: config.timeoutMs }
      };
    }

    // Case 3: Network or connection failure (DNS failure, ECONNREFUSED, etc.)
    if (error.request) {
      logger.error(`[FaceVerificationService] Network error connecting to third party: ${error.message}`);
      return {
        success: false,
        statusCode: 502,
        code: 'BAD_GATEWAY',
        message: 'Unable to reach the third-party verification server.',
        error: { details: error.message, code: error.code }
      };
    }

    // Case 4: Any other unexpected error
    logger.error(`[FaceVerificationService] Unexpected error: ${error.message}`, { stack: error.stack });
    return {
      success: false,
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred during face verification.',
      error: { details: error.message }
    };
  }
}

module.exports = {
  verifyFace
};
