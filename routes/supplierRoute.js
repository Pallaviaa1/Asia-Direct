const express = require('express');
const supplier_route = express();
const supplierController = require('../controllers/supplierController');
const { AddSupplierValidation, UpdateSupplierValidation, AssignSuppliersToFreight } = require('../helpers/validation');
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
        if (file.fieldname === "product_images") {
            cb(null, path.join(__dirname, '../public/documents'));
        }
        if (file.fieldname === "damage_images") {
            cb(null, path.join(__dirname, '../public/documents'));
        }
        if (file.fieldname === "documents") {
            cb(null, path.join(__dirname, '../public/documents'));
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
supplier_route.get('/getSupplierList', supplierController.getSupplierList);
supplier_route.get('/getWarehouseSupplierList', supplierController.getWarehouseSupplierList);
supplier_route.post('/new-supplier-list', supplierController.NewSupplierList);
supplier_route.post('/update-supplier', UpdateSupplierValidation, upload.single("profile"), supplierController.UpdateSupplier);
supplier_route.post('/get-supplier', supplierController.GetSupplierByid);
supplier_route.post('/delete-supplier', supplierController.DeleteSupplier);
supplier_route.post('/supplier-freights', supplierController.GetSupplierFreights);
supplier_route.post('/login-supplier', supplierController.LoginSupplier);
supplier_route.post("/freight/assign-Suppliers", supplierController.AssignSuppliersToFreight)

supplier_route.post("/assignFreightToSupplier", supplierController.assignFreightToSupplier)
supplier_route.post("/getFreightsBySupplier", supplierController.getFreightsBySupplier)
supplier_route.post("/getAllAssignedFreightsForAdmin", supplierController.getAllAssignedFreightsForAdmin)
supplier_route.post("/updateSupplierStatusOfFreight", supplierController.updateSupplierStatusOfFreight)

supplier_route.post('/GetSupplierProfile', supplierController.GetSupplierProfile);
supplier_route.post('/UpdateSupplierProfile', upload.single("profile"), supplierController.UpdateSupplierProfile);

supplier_route.post('/createOrderAndWarehouse', upload.fields([
    { name: "product_images", maxCount: 10 },
    { name: "damage_images", maxCount: 10 },
    { name: "documents", maxCount: 10 }
]), supplierController.createOrderAndWarehouse)

supplier_route.post('/update-Order-And-Warehouse', upload.fields([
    { name: "product_images", maxCount: 10 },
    { name: "damage_images", maxCount: 10 },
    { name: "documents", maxCount: 10 }
]), supplierController.updateOrderAndWarehouse)

supplier_route.post("/GetSupplierCreatedWarehouseOrders", supplierController.GetSupplierCreatedWarehouseOrders)
supplier_route.get("/getSupplierWarehouses", supplierController.getSupplierWarehouses)

supplier_route.post("/addSupplierWarehouseProduct", supplierController.addSupplierWarehouseProduct)
supplier_route.post("/updateSupplierWarehouseProduct", supplierController.updateSupplierWarehouseProduct)
supplier_route.get("/getSupplierWarehouseProducts", supplierController.getSupplierWarehouseProducts)

supplier_route.post("/adminUpdateSupplierWarehouse", supplierController.adminUpdateSupplierWarehouse)
supplier_route.post("/MoveSupplierWarehouseOrder", supplierController.MoveSupplierWarehouseOrder)
supplier_route.get("/AllOrderNumbers", supplierController.AllOrderNumbers)
supplier_route.get("/AllWarehouseBatchNumbers", supplierController.AllWarehouseBatchNumbers)

supplier_route.post("/get-notification-supplier", supplierController.GetNotificationSupplier)

// ==================================== Facilities Management ====================================== //

supplier_route.post('/addCustomsClearingAgent', supplierController.addCustomsClearingAgent);
supplier_route.post('/getCustomsClearingAgents', supplierController.getCustomsClearingAgents);
supplier_route.post('/getCustomsClearingAgentById', supplierController.getCustomsClearingAgentById);
supplier_route.post('/updateCustomsClearingAgent', supplierController.updateCustomsClearingAgent);
supplier_route.post('/deleteCustomsClearingAgent', supplierController.deleteCustomsClearingAgent);

supplier_route.post('/addFreightForwarder', supplierController.addFreightForwarder);
supplier_route.post('/getFreightForwarders', supplierController.getFreightForwarders);
supplier_route.post('/getFreightForwarderById', supplierController.getFreightForwarderById);
supplier_route.post('/updateFreightForwarder', supplierController.updateFreightForwarder);
supplier_route.post('/deleteFreightForwarder', supplierController.deleteFreightForwarder);

supplier_route.post('/addGroupageHandler', supplierController.addGroupageHandler);
supplier_route.post('/getGroupageHandlers', supplierController.getGroupageHandlers);
supplier_route.post('/getGroupageHandlerById', supplierController.getGroupageHandlerById);
supplier_route.post('/updateGroupageHandler', supplierController.updateGroupageHandler);
supplier_route.post('/deleteGroupageHandler', supplierController.deleteGroupageHandler);

supplier_route.post('/addTransporter', supplierController.addTransporter);
supplier_route.post('/getTransporters', supplierController.getTransporters);
supplier_route.post('/getTransporterById', supplierController.getTransporterById);
supplier_route.post('/updateTransporter', supplierController.updateTransporter);
supplier_route.post('/deleteTransporter', supplierController.deleteTransporter);

supplier_route.post('/add-task', supplierController.AddTask);
supplier_route.post('/staffTaskList', supplierController.staffTaskList);
supplier_route.post('/supplierTaskList', supplierController.supplierTaskList);
supplier_route.post('/adminTaskList', supplierController.adminTaskList);


module.exports = supplier_route;
