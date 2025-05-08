const express = require('express');
const supplier_route = express();
const supplierController = require('../controllers/supplierController');
const { AddSupplierValidation, UpdateSupplierValidation } = require('../helpers/validation');
const { authMiddleWare } = require('../helpers/authJwt');

const path = require('path');
const multer = require('multer');

var storage = multer.diskStorage({
    destination: function (err, file, cb) {
        if (file.fieldname === "quote_document") {
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

supplier_route.post('/add-supplier', AddSupplierValidation, supplierController.AddSupplier);
supplier_route.get('/supplier-list', supplierController.SupplierList);
supplier_route.post('/update-supplier', UpdateSupplierValidation, supplierController.UpdateSupplier);
supplier_route.post('/get-supplier', supplierController.GetSupplierByid);
supplier_route.post('/delete-supplier', supplierController.DeleteSupplier);
supplier_route.post('/supplier-freights', supplierController.GetSupplierFreights);

module.exports = supplier_route;