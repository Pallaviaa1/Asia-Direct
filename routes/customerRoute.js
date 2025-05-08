const express = require('express');
const customer_route = express();
const customerController = require('../controllers/customerController');
const { AddCustomerValidation, UpdateCustomerValidation, AddClearingValidation, UpdateClearingValidation,
    RegisterCustomerValidation, adminLoginValidation, AddfreightByClientsValidation, ClientfreightValidation } = require('../helpers/validation');
const { authMiddleWare } = require('../helpers/authJwt');

const path = require('path');
const multer = require('multer');

var storage = multer.diskStorage({
    destination: function (err, file, cb) {
        if (file.fieldname === "quote_document" || file.fieldname === "document" || file.fieldname === "sad500"
            || file.fieldname === "product_literature" || file.fieldname === "product_brochures" || file.fieldname === "arrival_notification"
            || file.fieldname === "supplier_invoice" || file.fieldname === "packing_list" || file.fieldname === "proof_of_payment"
            || file.fieldname === "waybill" || file.fieldname === "bill_of_lading" || file.fieldname === "letter_of_authority" || file.fieldname === "licenses" || file.fieldname === "other_documents"
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

var upload = multer({
    storage: storage,
    // fileFilter:fileFilter
}).fields([{ name: 'document' }, { name: 'sad500' }, { name: 'quote_document' }, { name: 'profile' },
{ name: 'supplier_invoice' }, { name: 'packing_list' }, { name: 'proof_of_payment' }, { name: 'waybill' }, { name: 'bill_of_lading' }, { name: 'arrival_notification' }, { name: 'product_brochures' }
    , { name: 'product_literature' }, { name: 'letter_of_authority' }, { name: 'licenses' }, { name: 'other_documents' }
]);


customer_route.post('/add-customer', AddCustomerValidation, customerController.AddCustomer);
customer_route.get('/client-list', customerController.GetClientList);
customer_route.post('/client-list', customerController.Get_ClientList)
customer_route.post('/update-client', UpdateCustomerValidation, customerController.updateClient);
customer_route.post('/client-details', customerController.GetClientById);
customer_route.post('/delete-client', customerController.DeleteClient);

customer_route.post('/customer-register', RegisterCustomerValidation, customerController.customerRegister);
customer_route.post('/customer-login', adminLoginValidation, customerController.CustomerLogin);
customer_route.post('/update-client-profile', upload, UpdateCustomerValidation, customerController.UpdateClientProfile)

customer_route.post('/freight-add', upload, customerController.AddfreightByCustomer);
customer_route.post('/client-freights', customerController.GetClientFreights);
customer_route.post('/update-freights', upload, customerController.UpdatefreightByCustomer);


customer_route.post('/add-clearing', upload, AddClearingValidation, customerController.AddClearing);
customer_route.post('/update-clearing', upload, UpdateClearingValidation, customerController.EditClearing);
customer_route.post('/clearing-list', customerController.GetClearingList);
customer_route.post('/get-clearing', customerController.GetClearingById);
customer_route.post('/delete-clearing', customerController.Deleteclearance);

customer_route.post('/notification-users', customerController.GetNotificationUser);   // client or admin all notification
customer_route.post('/notification-status', customerController.updateNotificationSeen);
customer_route.post('/remove-notification', customerController.deleteOneNotification);
customer_route.post('/remove-all-notifications', customerController.DeleteAllNotification);

customer_route.post('/add-clearing-customer', upload, customerController.AddClearingByCustomer)
customer_route.post('/get-client-clearing', customerController.GetClearingClient)
customer_route.post('/get-list-clearance-quotation', customerController.getListClearanceQuotation);

customer_route.post('/accept-quotation', customerController.AcceptQuotation);
customer_route.post('/reject-quotation', customerController.RejectQuotation);

customer_route.post('/get-shipping-estimate', customerController.GetShipEstimate);

customer_route.post('/order-details', customerController.orderDetails);

customer_route.post('/user-forgot-password', customerController.UserforgotPassword);
customer_route.post('/user-reset-password', customerController.UserResetPassword);

customer_route.post('/find-hs-code', customerController.findHsCode);
customer_route.post('/upload-clrearance-doc', upload, customerController.uploadClrearanceDOC)
customer_route.post("/CleranceOrderList", customerController.CleranceOrderList)
customer_route.post("/addQueries", customerController.addQueries)
customer_route.post("/updateQuery", customerController.updateQuery)
customer_route.get("/getQueries", customerController.getQueries)
customer_route.post("/getQueriesByUserId", customerController.getQueriesByUserId)
customer_route.post("/deleteQueries", customerController.deleteQueries)
customer_route.post("/addCommodity", customerController.addCommodity)
customer_route.get("/getCommodities", customerController.getCommodities)
customer_route.post("/AllFreightOrderNumbers", customerController.AllFreightOrderNumbers)
customer_route.post("/AllBatchNumbers", customerController.AllBatchNumbers)
customer_route.post("/getAssignShipmentList", customerController.getAssignShipmentList)
customer_route.post("/AddShipment", upload, customerController.AddShipment)
customer_route.post("/UpdateShipment", upload, customerController.UpdateShipment)
customer_route.post("/DeleteShipment", customerController.DeleteShipment)
customer_route.get("/getShipment", customerController.getShipment)

customer_route.post("/addWareProductByUser", customerController.addWareProductByUser)
customer_route.post("/AssignToClearing", customerController.AssignToClearing)
customer_route.post("/AssignFreightToClearing", customerController.AssignFreightToClearing)
customer_route.post("/CopyShipment", customerController.CopyShipment)
customer_route.post("/DeleteShipmentDetails", customerController.DeleteShipmentDetails)
customer_route.post("/GetShipmentDetails", customerController.GetShipmentDetails)
customer_route.post("/getShipmentbyid", customerController.getShipmentbyid)
customer_route.post("/AssignBatchToClearing", customerController.AssignBatchOrdersToClearing)


module.exports = customer_route;
