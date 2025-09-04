const express = require('express');
const admin_route = express();
const adminController = require('../controllers/adminController');
const { adminLoginValidation, adminChangPassValidation, Privacy_TermValidation,
    UpdateShipEstimateValidation, adminUpdateProfileValidation, forgotPasswordValidation, resetPasswordValidation } = require('../helpers/validation');
const { authMiddleWare } = require('../helpers/authJwt');

const path = require('path');
const multer = require('multer');

var storage = multer.diskStorage({
    destination: function (err, file, cb) {
        if (file.fieldname === "Supplier_Quote_Attachment" || file.fieldname === "licenses" || file.fieldname === "other_documents" || file.fieldname === "document" || file.fieldname === "supplier_invoice" || file.fieldname === "packing_list") {
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

admin_route.post('/admin-login', adminLoginValidation, adminController.AdminLogin);
admin_route.post('/change-password', adminChangPassValidation, adminController.ChangePassword);
admin_route.post('/update-profile', upload.single('profile'), adminUpdateProfileValidation, adminController.updateProfile)
admin_route.post('/get-profile-admin', adminController.getProfileAdmin);
admin_route.post('/forgot-password', forgotPasswordValidation, adminController.forgotPassword);
admin_route.post('/reset-password', resetPasswordValidation, adminController.ResetPassword);

admin_route.post('/privacy-policy', Privacy_TermValidation, adminController.PrivacyPolicy);
admin_route.get('/get-privacy', adminController.GetPrivacy);

admin_route.post('/term-condition', Privacy_TermValidation, adminController.TermCondition);
admin_route.get('/get-terms', adminController.GetTerms);

admin_route.post('/add-freight', upload.fields([{ name: 'document', maxCount: 5 }]), adminController.Addfreight);
admin_route.post('/freight-list', adminController.GetFreightAdmin);
admin_route.post('/new-freight-list', adminController.GetFreightCustomer);
admin_route.post('/edit-freight', upload.fields([{ name: 'document', maxCount: 5 }, { name: 'supplier_invoice', maxCount: 5 }, { name: 'packing_list', maxCount: 5 }, { name: 'licenses', maxCount: 5 }, { name: 'other_documents', maxCount: 5 }]), adminController.EditFreight);
admin_route.post('/get-freight', adminController.GetFreightById);
admin_route.post('/delete-freight', adminController.DeleteFreight);

admin_route.post('/add-country', adminController.AddCountryOrigin);
admin_route.get('/country-list', adminController.getCountryOriginList);
admin_route.post('/update-country', adminController.updateCountryOrigin);
admin_route.post('/get-country', adminController.GetCountryById);
admin_route.post('/delete-country', adminController.DeleteCountry);

// All list for Add Freight

admin_route.get('/clientlist', adminController.clientListAddFreight);
admin_route.get('/countrylist', adminController.CountryListAddFreight);

admin_route.post('/shipping_estimate', upload.single('Supplier_Quote_Attachment'), adminController.Shipping_Estimate);
admin_route.get('/shipestimate-list', adminController.ShipEstimateList);
admin_route.post('/update-shipestimate', UpdateShipEstimateValidation, adminController.updateShippingEstimate);
admin_route.post('/get-shipestimate', adminController.GetShipEstimateById);
admin_route.post('/delete-shipestimate', adminController.DeleteShipEstimate);

admin_route.post('/send-notification', adminController.SendNotification);
admin_route.post('/notification-list', adminController.GetNotification);
admin_route.post('/delete-notification', adminController.deleteNotification);

admin_route.post('/status-Freight', adminController.ChangeStatusFreight);
admin_route.post('/get-estimate-details', adminController.GetShipEstimateDetails);
admin_route.post('/order/details', adminController.order_Details);
admin_route.post("/OrderDetailsById", adminController.OrderDetailsById)

admin_route.post('/sendMessage', adminController.sendMessage);
admin_route.post('/get-messages-list', adminController.getMessagesList);
admin_route.post('/get-all-messages', adminController.getAllMessages);
admin_route.post('/update-chat-onback', adminController.UpdateChatOnBack);
admin_route.post('/update-chat-onenter', adminController.UpdateChatOnEnter);

admin_route.post('/count-all', adminController.countAll);
admin_route.post('/count-graph', adminController.countGraph);
admin_route.post('/count-of-freight', adminController.countofFreight);

admin_route.post('/get-suppler-selected', adminController.GetSupplerSelected);
admin_route.post('/assign-estimateto-client', adminController.assignEstimatetoClient);

admin_route.post('/update-order-status', adminController.UpdateOrderStatus);
admin_route.post('/get-order-status', adminController.GetOrderStatus);
admin_route.post('/stage-of-shipment', adminController.StageOfShipment);

admin_route.post('/social-media-links', adminController.socialMediaLinks);
admin_route.get('/get-social-links', adminController.GetAllsocialLinks);


// Api for add_freight_to_warehouse
admin_route.post('/add_freight_to_warehouse', adminController.add_freight_to_warehouse)
admin_route.post("/restore_order_from_warehouse", adminController.restore_order_from_warehouse)
admin_route.post('/client_Shipping_Estimate', adminController.client_Shipping_Estimate)
admin_route.post('/GetWarehouseOrders', adminController.GetWarehouseOrders)
admin_route.post("/DeleteWarehouseOrder", adminController.DeleteWarehouseOrder)
admin_route.post('/createBatch', upload.fields([{ name: 'document', maxCount: 5 }]), adminController.createBatch)
admin_route.get('/getAllBatch', adminController.getAllBatch)
admin_route.post("/deleteBatch", adminController.deleteBatch)
admin_route.get("/getBatchList", adminController.getBatchList)
admin_route.post("/moveFreightToBatch", adminController.moveFreightToBatch)
admin_route.post("/UpdateOrderFromBatch", adminController.UpdateOrderStatusesFromBatch)
admin_route.post("/restoreOrderFromBatch", adminController.restoreOrderFromBatch)
admin_route.post("/getFreightsByBatch", adminController.getFreightsByBatch)
admin_route.post("/MoveToOrder", adminController.MoveToOrder)
admin_route.post("/MoveToClearaneOrder", adminController.MoveToClearaneOrder)
admin_route.post("/getCleranceOrder", adminController.getCleranceOrder)
admin_route.post("/CompleteCleranceOrder", adminController.CompleteCleranceOrder)
admin_route.post("/DeleteClearanceOrder", adminController.DeleteClearanceOrder)
admin_route.post("/InprocessCleranceOrder", adminController.InprocessCleranceOrder)
admin_route.post("/StillToCleranceOrder", adminController.StillToCleranceOrder)
admin_route.post("/addWarehouse", adminController.addWarehouse)
admin_route.post("/editWarehouse", adminController.editWarehouse)
admin_route.get("/getWarehouse", adminController.getWarehouse)
admin_route.post("/DeleteWarehouse", adminController.DeleteWarehouse)
admin_route.post("/editWarehouseDetails", upload.fields([{ name: 'document', maxCount: 5 }]), adminController.editWarehouseDetails)
admin_route.get("/GetCountries", adminController.GetCountries)
admin_route.get("/GetCitiesByCountry", adminController.GetCitiesByCountry)
admin_route.post("/RevertOrder", adminController.RevertOrder)
admin_route.post("/addWarehouseProduct", upload.fields([{ name: 'document', maxCount: 5 }]), adminController.addWarehouseProduct)
admin_route.post("/getWarehouseOrderProduct", adminController.getWarehouseOrderProduct)
admin_route.post("/updateWarehouseProduct", adminController.updateWarehouseProduct)
admin_route.post("/updateClientWarehouseProduct", adminController.updateClientWarehouseProduct)
admin_route.post("/DeleteWarehouseProduct", adminController.DeleteWarehouseProduct)

admin_route.post("/GetFreightImages", adminController.GetFreightImages)
admin_route.post("/DeleteDocument", adminController.DeleteDocument)
admin_route.get("/GetDeliveredOrder", adminController.GetDeliveredOrder)
admin_route.get("/OrderInvoiceList", adminController.OrderInvoiceList)
admin_route.post("/revertMovedFreight", adminController.revertMovedFreight)

module.exports = admin_route;