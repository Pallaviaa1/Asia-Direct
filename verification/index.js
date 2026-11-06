// verification/index.js
/**
 * Dedicated Third-Party Verification Module
 */
const router = require('./routes/verificationRoute');
const faceVerificationService = require('./services/faceVerificationService');
const verificationController = require('./controllers/verificationController');
const verificationConfig = require('./config/verificationConfig');

module.exports = {
  router,
  faceVerificationService,
  verificationController,
  config: verificationConfig
};
