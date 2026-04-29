const express = require('express');
const customer_route = express();
const customerController = require('../controllers/customerController');
const { AddCustomerValidation, UpdateCustomerValidation, AddClearingValidation, UpdateClearingValidation,
    RegisterCustomerValidation, adminLoginValidation, AddfreightByClientsValidation, ClientfreightValidation } = require('../helpers/validation');
const { authMiddleWare } = require('../helpers/authJwt');

const path = require('path');
const multer = require('multer');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const documentFields = [
            "quote_document",
            "document",
            "sad500",
            "product_literature",
            "product_brochures",
            "arrival_notification",
            "supplier_invoice",
            "packing_list",
            "proof_of_payment",
            "waybill",
            "bill_of_lading",
            "letter_of_authority",
            "licenses",
            "other_documents",

            // extra ones you asked to add
            "Customs Documents",
            "Waybills",
            "Supporting Documents",
            "Invoice, Packing List",
            "Product Literature",
            "Letters of authority",
            "AD_Quotations",
            "Supplier Invoices",
            "Release"
        ];

        if (documentFields.includes(file.fieldname)) {
            cb(null, path.join(__dirname, "../public/documents"));
        } else if (file.fieldname === "profile") {
            cb(null, path.join(__dirname, "../public/images"));
        } else {
            cb(new Error("Unexpected field: " + file.fieldname));
        }
    },

    filename: function (req, file, cb) {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

const upload = multer({
    storage: storage
}).fields([
    { name: "document", maxCount: 5 },
    { name: "sad500", maxCount: 5 },
    { name: "quote_document", maxCount: 5 },
    { name: "profile", maxCount: 1 },
    { name: "supplier_invoice", maxCount: 5 },
    { name: "packing_list", maxCount: 5 },
    { name: "proof_of_payment", maxCount: 5 },
    { name: "waybill", maxCount: 5 },
    { name: "bill_of_lading", maxCount: 5 },
    { name: "arrival_notification", maxCount: 5 },
    { name: "product_brochures", maxCount: 5 },
    { name: "product_literature", maxCount: 5 },
    { name: "letter_of_authority", maxCount: 5 },
    { name: "licenses", maxCount: 5 },
    { name: "other_documents", maxCount: 5 },


    //  extra ones
    { name: "Customs Documents", maxCount: 5 },
    { name: "Waybills", maxCount: 5 },
    { name: "Supporting Documents", maxCount: 5 },
    { name: "Invoice, Packing List", maxCount: 5 },
    { name: "Product Literature", maxCount: 5 },
    { name: "Letters of authority", maxCount: 5 },
    { name: "AD_Quotations", maxCount: 5 },
    { name: "Supplier Invoices", maxCount: 5 },
    { name: "Warehouse Entry Docs", maxCount: 5 }

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
customer_route.post('/assign-clearance-supplier', customerController.AssignClearanceToSupplier);
customer_route.post('/GetAllAssignedClearances', customerController.GetAllAssignedClearances);
customer_route.post('/updateSupplierStatusOfClearance', customerController.updateSupplierStatusOfClearance);

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
customer_route.post("/addContactUs", customerController.addContactUs)
customer_route.post("/getContactUs", customerController.getContactUs)

customer_route.post("/updateQuery", customerController.updateQuery)
customer_route.post("/getQueries", customerController.getQueries)
customer_route.post("/getQueriesByUserId", customerController.getQueriesByUserId)
customer_route.post("/deleteQueries", customerController.deleteQueries)
customer_route.post("/addCommodity", customerController.addCommodity)
customer_route.get("/getCommodities", customerController.getCommodities)
customer_route.post("/AllFreightOrderNumbers", customerController.AllFreightOrderNumbers)
customer_route.post("/AllBatchNumbers", customerController.AllBatchNumbers)
customer_route.post("/getAssignShipmentList", customerController.getAssignShipmentList)
// customer_route.post("/getShipmentClearanceData", customerController.getShipmentClearanceData)
customer_route.post("/AddShipment", upload, customerController.AddShipment)
customer_route.post("/UpdateShipment", upload, customerController.UpdateShipment)
customer_route.post("/DeleteShipment", customerController.DeleteShipment)
customer_route.post("/getShipment", customerController.getShipment)

customer_route.post("/addWareProductByUser", customerController.addWareProductByUser)
customer_route.post("/AssignToClearing", customerController.AssignToClearing)
customer_route.post("/AssignFreightToClearing", customerController.AssignFreightToClearing)
customer_route.post("/CopyShipment", customerController.CopyShipment)
customer_route.post("/DeleteShipmentDetails", customerController.DeleteShipmentDetails)
customer_route.post("/DeleteShipmentDetailsByClearance", customerController.DeleteShipmentDetailsByClearance)
customer_route.post("/GetShipmentDetails", customerController.GetShipmentDetails)
customer_route.post("/getShipmentbyid", customerController.getShipmentbyid)
customer_route.post("/AssignBatchToClearing", customerController.AssignBatchOrdersToClearing)


module.exports = customer_route;
