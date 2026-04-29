const express = require('express');
const clearance_route = express();
const clearanceController = require('../controllers/clearanceController');
const {  } = require('../helpers/validation');
const { authMiddleWare } = require('../helpers/authJwt');

const path = require('path');
const multer = require('multer');

var storage = multer.diskStorage({
    destination: function (err, file, cb) {
        if (file.fieldname === "quote_document" || file.fieldname === "file") {
            cb(null, path.join(__dirname, '../public/documents'));
        }
        if (file.fieldname === "profile") {
            cb(null, path.join(__dirname, '../public/images'));
        }
    },
    filename: function (err, file, cb) {
        cb(null, Date.now() + '-' + file.originalname, (err, success) => {
            if (err) {
                console.log(err);
            }
        });
    }
})

var upload = multer({ storage: storage })

clearance_route.post('/status-clearance', clearanceController.ChangeStatusClearance);
clearance_route.post('/accept-clearance', clearanceController.AcceptClearanceQuotation);
clearance_route.post('/reject-clearance', clearanceController.RejectClearanceQuotation);
clearance_route.post('/calculate-clearance', clearanceController.calculateEstimateClearance);
clearance_route.post('/get-calculated-details', clearanceController.getCalculateEstClearance);
clearance_route.post("/calculateClearanceByAdmin", clearanceController.calculateClearanceByAdmin)
clearance_route.post('/upload-excel-client', upload.single('file'), clearanceController.UploadExcelClient)
clearance_route.post("/calculateEditEstimateClearance", clearanceController.calculateEditEstimateClearance)
clearance_route.post("/deleteEstimateClearance", clearanceController.deleteEstimateClearance)


module.exports = clearance_route;
