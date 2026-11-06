const express = require('express');
const router = express.Router();
const WarehouseTrackingController = require('../controllers/warehouseTrackingController');
const authServices = require('../helpers/authJwt');

const { check, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const damagePhotoDir = path.join(__dirname, '../public/damage_photos');
if (!fs.existsSync(damagePhotoDir)) {
    fs.mkdirSync(damagePhotoDir, { recursive: true });
}

// Supported image extensions regex
const IMAGE_EXT_REGEX = /\.(jpe?g|png|webp|heic|heif|gif|bmp|tiff?|svg|avif|ico|dng|raw|cr2|nef)$/i;

const damageStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, damagePhotoDir);
    },
    filename: function (req, file, cb) {
        let ext = (path.extname(file.originalname) || '').toLowerCase();
        if (!ext) {
            const mime = (file.mimetype || '').toLowerCase();
            if (mime.includes('png')) ext = '.png';
            else if (mime.includes('webp')) ext = '.webp';
            else if (mime.includes('heic')) ext = '.heic';
            else if (mime.includes('heif')) ext = '.heif';
            else if (mime.includes('gif')) ext = '.gif';
            else if (mime.includes('bmp')) ext = '.bmp';
            else if (mime.includes('svg')) ext = '.svg';
            else if (mime.includes('tiff') || mime.includes('tif')) ext = '.tif';
            else if (mime.includes('avif')) ext = '.avif';
            else ext = '.jpg';
        }
        const safeName = `damage-${Date.now()}-${Math.round(Math.random() * 1E6)}${ext}`;
        cb(null, safeName);
    }
});

const uploadDamage = multer({
    storage: damageStorage,
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
    fileFilter: (req, file, cb) => {
        const mime = (file.mimetype || '').toLowerCase();
        const originalName = (file.originalname || '').toLowerCase();
        const isImageMime = mime.startsWith('image/');
        const isImageExt = IMAGE_EXT_REGEX.test(originalName);
        const isGenericBinary = (mime === 'application/octet-stream' || !mime || mime === 'binary/octet-stream');

        // Accept ANY image format (JPG, JPEG, PNG, WEBP, HEIC, HEIF, GIF, BMP, TIFF, SVG, AVIF, RAW, etc.)
        if (isImageMime || isImageExt || isGenericBinary) {
            cb(null, true);
        } else {
            cb(new Error(`File '${file.originalname}' is not a recognized image format. Supported formats: JPG, JPEG, PNG, WEBP, HEIC, HEIF, GIF, BMP, TIFF, SVG, AVIF.`));
        }
    }
});

const handleDamageUpload = (req, res, next) => {
    uploadDamage.any()(req, res, (err) => {
        if (err) {
            if (err instanceof multer.MulterError) {
                return res.status(400).json({ success: false, message: `Image upload error: ${err.message}` });
            }
            return res.status(400).json({ success: false, message: err.message });
        }
        next();
    });
};

const productPhotoDir = path.join(__dirname, '../public/product_pictures');
if (!fs.existsSync(productPhotoDir)) {
    fs.mkdirSync(productPhotoDir, { recursive: true });
}

const productStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, productPhotoDir);
    },
    filename: function (req, file, cb) {
        let ext = (path.extname(file.originalname) || '').toLowerCase();
        if (!ext) {
            const mime = (file.mimetype || '').toLowerCase();
            if (mime.includes('png')) ext = '.png';
            else if (mime.includes('webp')) ext = '.webp';
            else ext = '.jpg';
        }
        const safeName = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, safeName);
    }
});

const uploadProductPictures = multer({
    storage: productStorage,
    limits: { fileSize: 25 * 1024 * 1024 }
});

const handleProductUpload = (req, res, next) => {
    uploadProductPictures.any()(req, res, (err) => {
        if (err) {
            if (err instanceof multer.MulterError) {
                return res.status(400).json({ success: false, message: `Image upload error: ${err.message}` });
            }
            return res.status(400).json({ success: false, message: err.message });
        }
        next();
    });
};

const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return next();
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
        if (!err && user) req.user = user;
        next();
    });
};

const validateBarcodeGeneration = [
    (req, res, next) => {
        if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Request body is required and cannot be empty'
            });
        }
        next();
    },
    check('total_boxes', 'total_boxes must be a positive integer between 1 and 1000')
        .optional({ checkFalsy: false })
        .isInt({ min: 1, max: 1000 }),
    check('weight_kg', 'weight_kg must be a non-negative number')
        .optional({ checkFalsy: false })
        .isFloat({ min: 0 }),
    check('cbm', 'cbm must be a non-negative number')
        .optional({ checkFalsy: false })
        .isFloat({ min: 0 }),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: errors.array()[0].msg,
                errors: errors.array()
            });
        }
        next();
    }
];

const validateMobileLogin = [
    check('email', 'A valid email address is required').trim().isEmail(),
    check('password', 'Password is required and cannot be empty').notEmpty(),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: errors.array()[0].msg,
                errors: errors.array()
            });
        }
        next();
    }
];

/**
 * Warehouse Barcode & Tracking API Routes
 * Mounted at: /api/warehouse
 */

// 0. Mobile Authentication (Unified Login for Staff & Supplier)
router.post('/auth/mobile-login', validateMobileLogin, WarehouseTrackingController.mobileLogin);
router.post('/login', validateMobileLogin, WarehouseTrackingController.mobileLogin);
router.get('/auth/me', authServices.authMiddleWare, WarehouseTrackingController.getCurrentUserProfile);
router.get('/me', authServices.authMiddleWare, WarehouseTrackingController.getCurrentUserProfile);

// 1. Warehouse Orders List & Creation (For Staff & Supplier to create orders and generate barcodes)
router.get('/orders', optionalAuth, WarehouseTrackingController.getWarehouseOrdersList);
router.post('/orders', optionalAuth, WarehouseTrackingController.getWarehouseOrdersList);
router.post('/orders/create', optionalAuth, handleDamageUpload, WarehouseTrackingController.createSupplierWarehouseOrder);
router.post('/orders/add', optionalAuth, handleDamageUpload, WarehouseTrackingController.createSupplierWarehouseOrder);
router.post('/supplier/order', optionalAuth, handleDamageUpload, WarehouseTrackingController.createSupplierWarehouseOrder);

// 1.1 Staff Warehouse Orders with Access Country Filtering (Tracking counterpart of adminController.GetWarehouseOrders)
router.get('/staff/orders', optionalAuth, WarehouseTrackingController.getStaffWarehouseOrders);

router.get('/orders/:id', optionalAuth, WarehouseTrackingController.getWarehouseOrderDetail);
router.get('/supplier/orders/:id', optionalAuth, WarehouseTrackingController.getWarehouseOrderDetail);

// 1.5 Supplier Warehouse Products (Add / Update / Get Products inside a Warehouse Order)
router.post('/orders/products/add', optionalAuth, handleProductUpload, WarehouseTrackingController.addSupplierWarehouseProduct);
router.post('/orders/products/update', optionalAuth, handleProductUpload, WarehouseTrackingController.updateSupplierWarehouseProduct);
router.get('/orders/products', optionalAuth, WarehouseTrackingController.getSupplierWarehouseProducts);
router.get('/orders/:id/products', optionalAuth, WarehouseTrackingController.getSupplierWarehouseProducts);
router.post('/orders/products/delete', optionalAuth, WarehouseTrackingController.deleteSupplierWarehouseProduct);

// Compatibility routes matching supplierRoute.js naming under /api/warehouse:
router.post('/addSupplierWarehouseProduct', optionalAuth, handleProductUpload, WarehouseTrackingController.addSupplierWarehouseProduct);
router.post('/updateSupplierWarehouseProduct', optionalAuth, handleProductUpload, WarehouseTrackingController.updateSupplierWarehouseProduct);
router.get('/getSupplierWarehouseProducts', optionalAuth, WarehouseTrackingController.getSupplierWarehouseProducts);

// 2. TMS Shipments (Search & Auto-fill details for Barcode intake form)
router.get('/shipments', optionalAuth, WarehouseTrackingController.getTmsShipmentsList);
router.get('/shipments/:identifier', optionalAuth, WarehouseTrackingController.getTmsShipmentDetails);

// 3. Barcode Generation & Reprinting
router.post('/barcodes/generate', optionalAuth, validateBarcodeGeneration, WarehouseTrackingController.generateBoxBarcodes);
router.get('/barcodes/reprint', WarehouseTrackingController.reprintBarcodes);
router.post('/barcodes/reprint', WarehouseTrackingController.reprintBarcodes);
router.get('/barcodes/image/:barcode', WarehouseTrackingController.getBarcodeImage);
router.get('/warehouses', WarehouseTrackingController.getWarehouseDropdowns);


// 3. Honeywell & Thermal Label Printing (PDF & ZPL)
router.get('/labels/pdf', WarehouseTrackingController.getPdfLabels);
router.get('/labels/zpl', WarehouseTrackingController.getZplLabels);

// 3. Handheld / Mobile Scanner Endpoints (Intake & Check-in)
router.get('/intake/auto-populate/:barcode', WarehouseTrackingController.autoPopulateIntake);
router.post('/scan/validate', WarehouseTrackingController.validateScan);
router.post('/scan/event', optionalAuth, handleDamageUpload, WarehouseTrackingController.recordScanEvent);

// 3.5 Damaged Carton Photo Upload
router.post('/box/:barcode/upload', optionalAuth, handleDamageUpload, WarehouseTrackingController.uploadDamagePhoto);
router.post('/box/upload-damage', optionalAuth, handleDamageUpload, WarehouseTrackingController.uploadDamagePhoto);

// 4. Milestone Timeline Tracking (Public / Portal / Mobile)
router.get('/track/:identifier', WarehouseTrackingController.trackTimeline);

// 5. Container & Flight Loading Reconciliation
router.get('/batches', WarehouseTrackingController.getWarehouseBatches);
router.get('/batch/:batch_id/reconciliation', WarehouseTrackingController.getBatchReconciliation);

// 6. Mobile App Home Dashboard & Recent Activity Endpoints
router.get('/home', optionalAuth, WarehouseTrackingController.getWarehouseHomeDashboard);
router.get('/dashboard', optionalAuth, WarehouseTrackingController.getWarehouseHomeDashboard);
router.get('/activities', optionalAuth, WarehouseTrackingController.getActivitiesList);
router.get('/orders/recent', optionalAuth, WarehouseTrackingController.getActivitiesList);
router.get('/activity/:identifier', optionalAuth, WarehouseTrackingController.getActivityDetails);
router.get('/activity', optionalAuth, WarehouseTrackingController.getActivityDetails);
router.get('/order/:identifier', optionalAuth, WarehouseTrackingController.getActivityDetails);
router.get('/scan/:identifier', optionalAuth, WarehouseTrackingController.getActivityDetails);

module.exports = router;
