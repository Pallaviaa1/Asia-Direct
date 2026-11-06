// verification/routes/verificationRoute.js
const express = require('express');
const router = express.Router();
const verificationController = require('../controllers/verificationController');

// Ensure route handles base64 payload up to 50mb
router.use(express.json({ limit: '50mb' }));
router.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Handle JSON syntax errors gracefully (e.g. unescaped newlines in base64 string)
router.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_JSON_FORMAT',
      message: 'Invalid JSON format in request body. If you pasted a Base64 image, make sure it does not contain unescaped line breaks or control characters.',
      error: err.message
    });
  }
  next(err);
});

const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// Middleware to extract file buffer to base64 if sent via multipart/form-data
const handleFileUpload = (req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    upload.any()(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          code: 'FILE_UPLOAD_ERROR',
          message: err.message
        });
      }
      if (req.files && req.files.length > 0) {
        const imgFile = req.files.find(f => f.fieldname === 'image' || f.fieldname === 'file') || req.files[0];
        if (imgFile && imgFile.buffer) {
          req.body = req.body || {};
          req.body.image = imgFile.buffer.toString('base64');
        }
      }
      next();
    });
  } else {
    next();
  }
};

/**
 * Health check & configuration status
 * GET /api/verification/health
 */
router.get('/verification/health', verificationController.healthCheck);

/**
 * Face Verification (YES/NO) Endpoint
 * POST /api/verification/face
 */
router.post('/verification/face', handleFileUpload, verificationController.verifyFace);

/**
 * 1:1 Mirror endpoint matching third-party path:
 * POST /api/v1/third-party/verification/yes_no/face
 */
router.post('/v1/third-party/verification/yes_no/face', handleFileUpload, verificationController.verifyFace);

module.exports = router;
