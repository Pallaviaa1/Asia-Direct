const express = require('express');
const upload_route = express();
const uploadController = require('../controllers/uploadController');

const path = require('path');
const multer = require('multer');

var storage = multer.diskStorage({
    destination: function (err, file, cb) {
        if (file.fieldname === "quote_document" || file.fieldname === "file"
        ) {
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

upload_route.post('/Upload-Documents', upload.single('file'), uploadController.UploadDocuments);
upload_route.post('/AttachedShippingEstimate', upload.single('file'), uploadController.AttachedShippingEstimate)
upload_route.post("/AttachedCustomOrderDoc", upload.single('file'), uploadController.AttachedCustomOrderDoc)

module.exports = upload_route;