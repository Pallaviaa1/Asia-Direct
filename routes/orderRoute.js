const express = require('express');
const order_route = express();
const orderController = require('../controllers/orderController');
const { } = require('../helpers/validation');
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

order_route.post('/update-load-details', orderController.updateLoadDetails);
order_route.post('/update-delivery-details', orderController.updateDeliveryDetails);
order_route.post('/get-orders-details', orderController.GetAllOrdersDetails);
order_route.post('/get-loading-details', orderController.GetLoadingDetails);
order_route.post('/get-delivery-details', orderController.GetDeliveryDetails);
order_route.post("/UploadExcelShipment", upload.single('file'), orderController.UploadExcelShipment);
order_route.post("/UploadExcelShipmentOrder", upload.single('file'), orderController.UploadExcelShipmentOrder)
order_route.post("/UploadExcelFullOrderDetails", upload.single('file'), orderController.UploadExcelFullOrderDetails)
order_route.post("/UploadExcelBatch", upload.single('file'), orderController.UploadExcelBatch)
order_route.post("/UploadExcelWarehouse", upload.single('file'), orderController.UploadExcelWarehouse)
order_route.post("/editBatch", orderController.editBatch)
order_route.post("/deleteBatche", orderController.deleteBatche)
order_route.post("/UploadSageInvoiceLlist", upload.single('file'), orderController.UploadSageInvoiceLlist)
order_route.get("/GetSageInvoiceList", orderController.GetSageInvoiceList)
order_route.post("/UploadCashbookList", upload.single('file'), orderController.UploadCashbookList)
order_route.get("/GetCashbookList", orderController.GetCashbookList)
order_route.post("/GetSageInvoiceDetails", orderController.GetSageInvoiceDetails)
order_route.post("/TransactionAllocation", orderController.TransactionAllocation)
order_route.post("/AddOrUpdateBookingInstruction", orderController.AddOrUpdateBookingInstruction)
order_route.post("/GetBookingInstructionById", orderController.GetBookingInstructionById)

module.exports = order_route;