const express = require('express');
const invoice_route = express();
const invoiceController = require('../controllers/invoiceController');

const path = require('path');
const multer = require('multer');

var storage = multer.diskStorage({
    destination: function (err, file, cb) {
        if (file.fieldname === "document") {
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

invoice_route.post('/AddInvoiceDetails', invoiceController.AddInvoiceDetails);
invoice_route.post('/ADDcashbook', invoiceController.ADDcashbook)
invoice_route.post("/GetClientAllInvoice", invoiceController.GetClientAllInvoice)
invoice_route.get("/GetAllFreightDocs", invoiceController.GetAllFreightDocs)
invoice_route.post("/GetByIDAllFreightDocs", invoiceController.GetByIDAllFreightDocs)
invoice_route.post("/AddFreightDoc", upload.single('document'), invoiceController.AddFreightDoc)
invoice_route.post("/UpdateSageInvoiceDoc", upload.single('document'), invoiceController.UpdateSageInvoiceDoc)
invoice_route.get("/GetRealeseDashboard", invoiceController.GetRealeseDashboard)
invoice_route.post("/ManageRealeseDashboard", invoiceController.ManageRealeseDashboard)

module.exports = invoice_route;