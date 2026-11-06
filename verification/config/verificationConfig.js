// verification/config/verificationConfig.js
require('dotenv').config();

module.exports = {
  // Third-party verification base URL (defaults to env or empty string)
  baseUrl: process.env.THIRD_PARTY_VERIFICATION_BASE_URL || '',

  // Endpoint path for face verification
  endpointPath: process.env.THIRD_PARTY_VERIFICATION_PATH || '/api/v1/third-party/verification/yes_no/face',

  // Optional default credentials if not passed in the request body
  defaultMerchantKey: process.env.THIRD_PARTY_VERIFICATION_MERCHANT_KEY || '',
  defaultUserId: process.env.THIRD_PARTY_VERIFICATION_USER_ID || '',
  defaultCenter: process.env.THIRD_PARTY_VERIFICATION_CENTER || 'BRANCHLESS',
  defaultDataType: process.env.THIRD_PARTY_VERIFICATION_DATA_TYPE || 'PNG',

  // Request timeout in milliseconds (default: 30 seconds)
  timeoutMs: parseInt(process.env.THIRD_PARTY_VERIFICATION_TIMEOUT_MS, 10) || 30000,
};
