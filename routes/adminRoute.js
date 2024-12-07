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
        if (file.fieldname === "quote_document" || file.fieldname === "Supplier_Quote_Attachment" || file.fieldname === "document")  {
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

admin_route.post('/add-freight', upload.single('document'), adminController.Addfreight);
admin_route.post('/freight-list', adminController.GetFreightAdmin);
admin_route.post('/new-freight-list', adminController.GetFreightCustomer);
admin_route.post('/edit-freight', upload.single('document'), adminController.EditFreight);
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
admin_route.get('/GetWarehouseOrders', adminController.GetWarehouseOrders)
admin_route.post("/DeleteWarehouseOrder", adminController.DeleteWarehouseOrder)
admin_route.post('/createBatch', adminController.createBatch)
admin_route.get('/getAllBatch', adminController.getAllBatch)
admin_route.post("/deleteBatch", adminController.deleteBatch)
admin_route.post("/moveFreightToBatch", adminController.moveFreightToBatch)
admin_route.post("/restoreOrderFromBatch", adminController.restoreOrderFromBatch)
admin_route.post("/getFreightsByBatch", adminController.getFreightsByBatch)
admin_route.post("/MoveToOrder", adminController.MoveToOrder)
admin_route.post("/MoveToClearaneOrder", adminController.MoveToClearaneOrder)
admin_route.get("/getCleranceOrder", adminController.getCleranceOrder)
admin_route.post("/CompleteCleranceOrder", adminController.CompleteCleranceOrder)
admin_route.post("/InprocessCleranceOrder", adminController.InprocessCleranceOrder)
admin_route.post("/StillToCleranceOrder", adminController.StillToCleranceOrder)
admin_route.post("/addWarehouse", adminController.addWarehouse)
admin_route.post("/editWarehouse", adminController.editWarehouse)
admin_route.get("/getWarehouse", adminController.getWarehouse)
admin_route.post("/DeleteWarehouse", adminController.DeleteWarehouse)
admin_route.post("/editWarehouseDetails", adminController.editWarehouseDetails)
admin_route.get("/GetCountries", adminController.GetCountries)
admin_route.get("/GetCitiesByCountry", adminController.GetCitiesByCountry)
admin_route.post("/RevertOrder", adminController.RevertOrder)
admin_route.post("/addWarehouseProduct", adminController.addWarehouseProduct)
admin_route.post("/getWarehouseOrderProduct", adminController.getWarehouseOrderProduct)

module.exports = admin_route;