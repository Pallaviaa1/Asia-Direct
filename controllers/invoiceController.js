const con = require('../config/database');
const { validationResult, Result } = require('express-validator');
const bcrypt = require('bcryptjs');
const sendMail = require('../helpers/sendMail')
const rendomString = require('randomstring');
const PDFDocument = require("pdfkit");
const moment = require("moment");
const fs = require("fs");
const path = require("path");
const { recalcOrderPayment, recalcSupplierInvoicePayment } = require("../helpers/recalcOrderPayment");

const AddInvoiceDetails = async (req, res) => {
    try {
        const {
            invoice_id,
            date,
            transaction,
            order_id,
            client_id,
            sage_invoice_id,
            Excl,
            Vat,
            invoice_amt,
            due_date,
            status,
            payment,
            day_overdue,
            invoice_currency
        } = req.body;

        // console.log(req.body);

        if (!invoice_id && !sage_invoice_id) {
            return res.status(400).send({
                success: false,
                message: "Please First Select Invoice Ref"
            });
        }


        if (invoice_id) {
            // Fetch existing payment
            const paymentQuery = `SELECT payment, invoice_amt FROM tbl_invoices WHERE id = ?`;
            con.query(paymentQuery, [invoice_id], (err, paymentResult) => {
                if (err) {
                    console.error("Error fetching existing payment:", err.message);
                    return res.status(500).send({
                        success: false,
                        message: "Error fetching existing payment."
                    });
                }

                const existingPayment = paymentResult.length > 0 ? paymentResult[0].payment : 0;
                const invoice_amt = paymentResult[0].invoice_amt || 0
                if (sage_invoice_id) {
                    // Fetch invoice details from sage_invoice_list
                    const query = `SELECT total, date FROM sage_invoice_list WHERE id = ?`;
                    con.query(query, [sage_invoice_id], (err, results) => {
                        if (err) {
                            console.error("Error fetching sage invoice:", err.message);
                            return res.status(500).send({
                                success: false,
                                message: "Error fetching sage invoice."
                            });
                        }

                        if (results.length > 0) {
                            // console.log(results[0]);

                            const fetchedInvoiceAmt = results[0].total;
                            const newBalance = fetchedInvoiceAmt - (existingPayment || 0);
                            // console.log(fetchedInvoiceAmt);

                            updateInvoice(invoice_id, {
                                date: results[0].date,
                                transaction,
                                order_id,
                                client_id,
                                sage_invoice_id,
                                Excl,
                                Vat,
                                invoice_amt: fetchedInvoiceAmt, // Override with fetched value
                                due_date,
                                status,
                                payment: existingPayment,
                                balance: newBalance,
                                day_overdue,
                                invoice_currency
                            }, res);

                            // Update tbl_orders with sage_invoice_id
                            updateOrderSageInvoice(order_id, sage_invoice_id);
                        } else {
                            return res.status(404).send({
                                success: false,
                                message: "Sage invoice not found."
                            });
                        }
                    });
                } else {
                    const newBalance = (invoice_amt || 0) - (existingPayment || 0);
                    updateInvoice(invoice_id, {
                        date,
                        transaction,
                        order_id,
                        client_id,
                        sage_invoice_id,
                        Excl,
                        Vat,
                        invoice_amt,
                        due_date,
                        status,
                        payment: existingPayment,
                        balance: newBalance,
                        day_overdue,
                        invoice_currency
                    }, res);

                    // Update tbl_orders with sage_invoice_id
                    updateOrderSageInvoice(order_id, sage_invoice_id);
                }
            });
        } else {
            // Insert new record

            // Fetch invoice details from sage_invoice_list
            const query = `SELECT total, date FROM sage_invoice_list WHERE id = ?`;
            con.query(query, [sage_invoice_id], (err, results) => {
                if (err) {
                    console.error("Error fetching sage invoice:", err.message);
                    return res.status(500).send({
                        success: false,
                        message: "Error fetching sage invoice."
                    });
                }

                const fetchedInvoiceAmt = results[0].total;
                const fetchedDate = results[0].date;
                const insertQuery = `
                INSERT INTO tbl_invoices (
                    date, transaction, order_id, client_id, sage_invoice_id, Excl, Vat, invoice_amt, due_date, status, payment, balance, day_overdue, invoice_currency
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
                const insertParams = [
                    fetchedDate || date || null,
                    transaction || null,
                    order_id || null,
                    client_id || null,
                    sage_invoice_id || null,
                    Excl || null,
                    Vat || null,
                    fetchedInvoiceAmt || invoice_amt || null,
                    due_date || null,
                    status || null,
                    payment || 0, // Default payment to 0 if not provided
                    (invoice_amt || 0) - (payment || 0), // Calculate balance
                    day_overdue || null,
                    invoice_currency || null
                ];

                con.query(insertQuery, insertParams, (err, result) => {
                    if (err) {
                        console.error("Error inserting invoice:", err.message);
                        return res.status(500).send({
                            success: false,
                            message: err.message
                        });
                    }

                    // Update tbl_orders with sage_invoice_id
                    updateOrderSageInvoice(order_id, sage_invoice_id);

                    return res.status(200).send({
                        success: true,
                        message: "Invoice added successfully.",
                        invoice_id: result.insertId
                    });
                });
            })
        }

    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

// Function to update tbl_orders with sage_invoice_id
const updateOrderSageInvoice = (order_id, sage_invoice_id) => {
    if (!order_id || !sage_invoice_id) return;

    const updateOrderQuery = `UPDATE tbl_orders SET sage_invoice_id = ? WHERE id = ?`;
    con.query(updateOrderQuery, [sage_invoice_id, order_id], (err, result) => {
        if (err) {
            console.error("Error updating tbl_orders with sage_invoice_id:", err.message);
        }
    });
};

// Function to update the invoice dynamically
const updateInvoice = (invoice_id, fields, res) => {
    let updateQuery = "UPDATE tbl_invoices SET ";
    const updateFields = [];
    const updateParams = [];

    Object.keys(fields).forEach((key) => {
        if (fields[key] !== undefined && fields[key] !== null) {
            updateFields.push(`${key} = ?`);
            updateParams.push(fields[key]);
        }
    });

    if (updateFields.length === 0) {
        return res.status(400).send({
            success: false,
            message: "No fields provided for update."
        });
    }

    updateQuery += updateFields.join(", ") + " WHERE id = ?";
    updateParams.push(invoice_id);

    con.query(updateQuery, updateParams, (err, result) => {
        if (err) {
            console.error("Error updating invoice:", err.message);
            return res.status(500).send({
                success: false,
                message: err.message
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).send({
                success: false,
                message: "Invoice not found for the given invoice_id."
            });
        }

        return res.status(200).send({
            success: true,
            message: "Invoice updated successfully."
        });
    });
};

// const ADDcashbook = async (req, res) => {
//     try {
//         const {
//             cashbook_id,
//             customer_id,
//             supplier_id,
//             order_id,
//             supplier_invoice_id,
//             allocation_type = "Customer",
//             allocated,
//             receipt,
//         } = req.body;

//         // ======================================================
//         // BASIC VALIDATION
//         // ======================================================

//         if (!cashbook_id) {
//             return res.status(400).send({
//                 success: false,
//                 message: "Cashbook ID is required.",
//             });
//         }

//         if (!["Customer", "Supplier"].includes(allocation_type)) {
//             return res.status(400).send({
//                 success: false,
//                 message: "Invalid allocation type. Use Customer or Supplier.",
//             });
//         }

//         if (allocation_type === "Customer" && !customer_id) {
//             return res.status(400).send({
//                 success: false,
//                 message: "Customer ID is required.",
//             });
//         }

//         if (allocation_type === "Supplier" && !supplier_id) {
//             return res.status(400).send({
//                 success: false,
//                 message: "Supplier ID is required.",
//             });
//         }

//         if (allocation_type === "Supplier" && !supplier_invoice_id) {
//             return res.status(400).send({
//                 success: false,
//                 message: "Supplier Invoice ID is required.",
//             });
//         }

//         // =====================================================
//         // CHECK CASHBOOK
//         // =====================================================

//         const checkCashbookQuery = `
//             SELECT *
//             FROM tbl_cashbook
//             WHERE id = ?
//         `;

//         con.query(
//             checkCashbookQuery,
//             [cashbook_id],
//             (err, cashbookResult) => {
//                 if (err) {
//                     console.error(
//                         "Error checking cashbook:",
//                         err.message
//                     );

//                     return res.status(500).send({
//                         success: false,
//                         message: "Failed to check cashbook.",
//                     });
//                 }

//                 // =================================================
//                 // CASE 1: CASHBOOK DOES NOT EXIST
//                 // =================================================

//                 if (cashbookResult.length === 0) {

//                     const insertCashbookQuery = `
//                         INSERT INTO tbl_cashbook
//                         (
//                             id,
//                             customer_id,
//                             supplier_id,
//                             supplier_invoice_id,
//                             order_id,
//                             allocated,
//                             allocation_type,
//                             receipt
//                         )
//                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
//                     `;

//                     const insertParams = [
//                         cashbook_id,

//                         allocation_type === "Customer"
//                             ? customer_id
//                             : null,

//                         allocation_type === "Supplier"
//                             ? supplier_id
//                             : null,

//                         allocation_type === "Supplier"
//                             ? supplier_invoice_id
//                             : null,

//                         allocation_type === "Customer"
//                             ? order_id
//                             : null,

//                         "Yes",
//                         allocation_type,
//                         receipt || 0,
//                     ];

//                     con.query(
//                         insertCashbookQuery,
//                         insertParams,
//                         (err) => {
//                             if (err) {
//                                 console.error(
//                                     "Error inserting cashbook:",
//                                     err.message
//                                 );

//                                 return res.status(500).send({
//                                     success: false,
//                                     message: "Failed to insert cashbook.",
//                                 });
//                             }

//                             // -----------------------------------------
//                             // CUSTOMER
//                             // -----------------------------------------

//                             if (allocation_type === "Customer") {

//                                 // Existing code previously stopped here
//                                 // when a new cashbook record was inserted.
//                                 //
//                                 // To preserve that behavior:
//                                 return res.status(200).send({
//                                     success: true,
//                                     message:
//                                         "New cashbook entry created successfully.",
//                                 });
//                             }

//                             // -----------------------------------------
//                             // SUPPLIER
//                             // -----------------------------------------

//                             updateSupplierInvoicePayment(
//                                 supplier_invoice_id,
//                                 (supplierErr, supplierResponse) => {

//                                     if (supplierErr) {
//                                         console.error(
//                                             "Supplier invoice update error:",
//                                             supplierErr.message
//                                         );

//                                         return res.status(500).send({
//                                             success: false,
//                                             message:
//                                                 supplierErr.message,
//                                         });
//                                     }

//                                     return res.status(200).send({
//                                         success: true,
//                                         message:
//                                             "New cashbook entry created and supplier invoice updated successfully.",
//                                         data: supplierResponse,
//                                     });
//                                 }
//                             );
//                         }
//                     );

//                     return;
//                 }

//                 // =================================================
//                 // CASE 2: CASHBOOK ALREADY EXISTS
//                 // =================================================

//                 let updateQuery = `
//                     UPDATE tbl_cashbook
//                     SET
//                 `;

//                 const updateFields = [];
//                 const updateParams = [];

//                 // -----------------------------------------
//                 // CUSTOMER
//                 // -----------------------------------------

//                 if (allocation_type === "Customer") {

//                     if (customer_id) {
//                         updateFields.push("customer_id = ?");
//                         updateParams.push(customer_id);
//                     }

//                     // Remove supplier allocation if changing
//                     // this cashbook back to Customer
//                     updateFields.push("supplier_id = NULL");
//                     updateFields.push("supplier_invoice_id = NULL");

//                     updateFields.push("allocation_type = ?");
//                     updateParams.push("Customer");

//                     if (order_id) {
//                         updateFields.push("order_id = ?");
//                         updateParams.push(order_id);

//                         updateFields.push("allocated = ?");
//                         updateParams.push("Yes");
//                     }
//                 }

//                 // -----------------------------------------
//                 // SUPPLIER
//                 // -----------------------------------------

//                 if (allocation_type === "Supplier") {

//                     updateFields.push("supplier_id = ?");
//                     updateParams.push(supplier_id);

//                     updateFields.push("supplier_invoice_id = ?");
//                     updateParams.push(supplier_invoice_id);

//                     updateFields.push("customer_id = NULL");
//                     updateFields.push("order_id = NULL");

//                     updateFields.push("allocation_type = ?");
//                     updateParams.push("Supplier");

//                     updateFields.push("allocated = ?");
//                     updateParams.push("Yes");
//                 }

//                 updateParams.push(cashbook_id);

//                 if (updateFields.length === 0) {
//                     return res.status(400).send({
//                         success: false,
//                         message: "No fields provided for update.",
//                     });
//                 }

//                 updateQuery +=
//                     updateFields.join(", ") +
//                     " WHERE id = ?";

//                 con.query(
//                     updateQuery,
//                     updateParams,
//                     (err, result) => {

//                         if (err) {
//                             console.error(
//                                 "Error updating cashbook:",
//                                 err.message
//                             );

//                             return res.status(500).send({
//                                 success: false,
//                                 message: "Failed to update cashbook.",
//                             });
//                         }

//                         // =================================================
//                         // SUPPLIER FLOW
//                         // =================================================

//                         if (allocation_type === "Supplier") {

//                             updateSupplierInvoicePayment(
//                                 supplier_invoice_id,
//                                 (supplierErr, supplierResponse) => {

//                                     if (supplierErr) {
//                                         console.error(
//                                             "Supplier invoice update error:",
//                                             supplierErr.message
//                                         );

//                                         return res.status(500).send({
//                                             success: false,
//                                             message:
//                                                 supplierErr.message,
//                                         });
//                                     }

//                                     return res.status(200).send({
//                                         success: true,
//                                         message:
//                                             "Supplier payment allocated and invoice updated successfully.",
//                                         data: supplierResponse,
//                                     });
//                                 }
//                             );

//                             return;
//                         }

//                         // =================================================
//                         // CUSTOMER FLOW
//                         // =================================================

//                         if (!order_id) {
//                             return res.status(200).send({
//                                 success: true,
//                                 message:
//                                     "Cashbook updated successfully.",
//                             });
//                         }

//                         // -----------------------------------------
//                         // STEP 1:
//                         // GET TOTAL RECEIPT FOR ORDER
//                         // -----------------------------------------

//                         const fetchReceiptsQuery = `
//                             SELECT
//                                 SUM(receipt) AS total_receipt
//                             FROM tbl_cashbook
//                             WHERE order_id = ?
//                         `;

//                         con.query(
//                             fetchReceiptsQuery,
//                             [order_id],
//                             (err, receiptResult) => {

//                                 if (err) {
//                                     console.error(
//                                         "Error fetching receipt total:",
//                                         err.message
//                                     );

//                                     return res.status(500).send({
//                                         success: false,
//                                         message:
//                                             "Failed to fetch receipt total.",
//                                     });
//                                 }

//                                 const totalReceipt =
//                                     Number(
//                                         receiptResult[0]?.total_receipt
//                                     ) || 0;

//                                 // -----------------------------------------
//                                 // STEP 2:
//                                 // CHECK CUSTOMER INVOICE
//                                 // -----------------------------------------

//                                 const checkInvoiceQuery = `
//                                     SELECT *
//                                     FROM tbl_invoices
//                                     WHERE order_id = ?
//                                 `;

//                                 con.query(
//                                     checkInvoiceQuery,
//                                     [order_id],
//                                     (err, invoiceResult) => {

//                                         if (err) {
//                                             console.error(
//                                                 "Error checking invoice:",
//                                                 err.message
//                                             );

//                                             return res.status(500).send({
//                                                 success: false,
//                                                 message:
//                                                     "Failed to check invoice.",
//                                             });
//                                         }

//                                         // =================================
//                                         // EXISTING CUSTOMER INVOICE
//                                         // =================================

//                                         if (
//                                             invoiceResult.length > 0
//                                         ) {

//                                             const updatePaymentQuery = `
//                                                 UPDATE tbl_invoices
//                                                 SET
//                                                     payment = ?,
//                                                     status = ?
//                                                 WHERE order_id = ?
//                                             `;

//                                             con.query(
//                                                 updatePaymentQuery,
//                                                 [
//                                                     totalReceipt,
//                                                     "Part Paid",
//                                                     order_id,
//                                                 ],
//                                                 (err) => {

//                                                     if (err) {
//                                                         console.error(
//                                                             "Error updating payment:",
//                                                             err.message
//                                                         );

//                                                         return res.status(500).send({
//                                                             success: false,
//                                                             message:
//                                                                 "Failed to update payment.",
//                                                         });
//                                                     }

//                                                     // -------------------------
//                                                     // GET INVOICE DETAILS
//                                                     // -------------------------

//                                                     const selectInvoiceQuery = `
//                                                         SELECT
//                                                             invoice_amt,
//                                                             payment
//                                                         FROM tbl_invoices
//                                                         WHERE order_id = ?
//                                                     `;

//                                                     con.query(
//                                                         selectInvoiceQuery,
//                                                         [order_id],
//                                                         (
//                                                             err,
//                                                             invoiceDetails
//                                                         ) => {

//                                                             if (err) {
//                                                                 console.error(
//                                                                     "Error fetching invoice:",
//                                                                     err.message
//                                                                 );

//                                                                 return res.status(500).send({
//                                                                     success: false,
//                                                                     message:
//                                                                         "Failed to fetch invoice details.",
//                                                                 });
//                                                             }

//                                                             if (
//                                                                 invoiceDetails.length ===
//                                                                 0
//                                                             ) {
//                                                                 return res.status(404).send({
//                                                                     success: false,
//                                                                     message:
//                                                                         "Invoice not found.",
//                                                                 });
//                                                             }

//                                                             const invoiceAmt =
//                                                                 Number(
//                                                                     invoiceDetails[0]
//                                                                         .invoice_amt
//                                                                 ) || 0;

//                                                             const payment =
//                                                                 Number(
//                                                                     invoiceDetails[0]
//                                                                         .payment
//                                                                 ) || 0;

//                                                             const finalBalance =
//                                                                 invoiceAmt -
//                                                                 payment;

//                                                             // -------------------------
//                                                             // UPDATE BALANCE
//                                                             // -------------------------

//                                                             const updateBalanceQuery = `
//                                                                 UPDATE tbl_invoices
//                                                                 SET balance = ?
//                                                                 WHERE order_id = ?
//                                                             `;

//                                                             con.query(
//                                                                 updateBalanceQuery,
//                                                                 [
//                                                                     finalBalance,
//                                                                     order_id,
//                                                                 ],
//                                                                 (err) => {

//                                                                     if (err) {
//                                                                         console.error(
//                                                                             "Error updating invoice balance:",
//                                                                             err.message
//                                                                         );

//                                                                         return res.status(500).send({
//                                                                             success: false,
//                                                                             message:
//                                                                                 "Failed to update invoice balance.",
//                                                                         });
//                                                                     }

//                                                                     return res.status(200).send({
//                                                                         success: true,
//                                                                         message:
//                                                                             "Customer invoice updated successfully.",
//                                                                         data: {
//                                                                             payment:
//                                                                                 payment,
//                                                                             balance:
//                                                                                 finalBalance,
//                                                                         },
//                                                                     });
//                                                                 }
//                                                             );
//                                                         }
//                                                     );
//                                                 }
//                                             );

//                                         } else {

//                                             // =================================
//                                             // NEW CUSTOMER INVOICE
//                                             // =================================

//                                             const insertInvoiceQuery = `
//                                                 INSERT INTO tbl_invoices
//                                                 (
//                                                     order_id,
//                                                     payment,
//                                                     status,
//                                                     balance
//                                                 )
//                                                 VALUES (?, ?, ?, ?)
//                                             `;

//                                             con.query(
//                                                 insertInvoiceQuery,
//                                                 [
//                                                     order_id,
//                                                     totalReceipt,
//                                                     "Part Paid",
//                                                     0,
//                                                 ],
//                                                 (err) => {

//                                                     if (err) {
//                                                         console.error(
//                                                             "Error inserting invoice:",
//                                                             err.message
//                                                         );

//                                                         return res.status(500).send({
//                                                             success: false,
//                                                             message:
//                                                                 "Failed to insert invoice.",
//                                                         });
//                                                     }

//                                                     return res.status(200).send({
//                                                         success: true,
//                                                         message:
//                                                             "New customer invoice created successfully.",
//                                                     });
//                                                 }
//                                             );
//                                         }
//                                     }
//                                 );
//                             }
//                         );
//                     }
//                 );
//             }
//         );
//     } catch (error) {

//         console.error(
//             "Unexpected error:",
//             error.message
//         );

//         return res.status(500).send({
//             success: false,
//             message: "An unexpected error occurred.",
//         });
//     }
// };




// =============================================================
// SUPPLIER INVOICE PAYMENT HELPER
// =============================================================


const ADDcashbook = async (req, res) => {
    try {
        const {
            cashbook_id,
            customer_id,
            supplier_id,
            order_id,
            supplier_invoice_id,
            allocation_type = "Customer",
            allocated,
            receipt,
        } = req.body;

        // ======================================================
        // BASIC VALIDATION
        // ======================================================

        if (!cashbook_id) {
            return res.status(400).send({
                success: false,
                message: "Cashbook ID is required.",
            });
        }

        if (!["Customer", "Supplier"].includes(allocation_type)) {
            return res.status(400).send({
                success: false,
                message:
                    "Invalid allocation type. Use Customer or Supplier.",
            });
        }

        if (allocation_type === "Customer" && !customer_id) {
            return res.status(400).send({
                success: false,
                message: "Customer ID is required.",
            });
        }

        if (allocation_type === "Supplier" && !supplier_id) {
            return res.status(400).send({
                success: false,
                message: "Supplier ID is required.",
            });
        }

        if (
            allocation_type === "Supplier" &&
            !supplier_invoice_id
        ) {
            return res.status(400).send({
                success: false,
                message: "Supplier Invoice ID is required.",
            });
        }

        // ======================================================
        // HELPER: UPDATE CUSTOMER INVOICE STATUS AND BALANCE
        // ======================================================

        const updateCustomerInvoiceStatus = (
            customerOrderId,
            callback
        ) => {
            if (!customerOrderId) {
                return callback(null, {
                    status: null,
                    balance: null,
                    payment: 0,
                    invoice_amount: 0,
                });
            }

            const fetchCustomerPaymentQuery = `
                SELECT
                    COALESCE(
                        SUM(COALESCE(receipt, 0)),
                        0
                    ) AS total_receipt
                FROM tbl_cashbook
                WHERE order_id = ?
                  AND allocation_type = 'Customer'
            `;

            con.query(
                fetchCustomerPaymentQuery,
                [customerOrderId],
                (err, receiptResult) => {
                    if (err) {
                        return callback(err);
                    }

                    const totalReceipt =
                        Number(
                            receiptResult[0]?.total_receipt
                        ) || 0;

                    const fetchQuoteInvoiceQuery = `
                        SELECT
                            id,
                            sumof_vatincl,
                            sumof_finalamount,
                            chargeable,
                            balance,
                            status
                        FROM quote_invoice
                        WHERE order_id = ?
                          AND is_deleted = 0
                        ORDER BY id DESC
                        LIMIT 1
                    `;

                    con.query(
                        fetchQuoteInvoiceQuery,
                        [customerOrderId],
                        (err, quoteInvoiceResult) => {
                            if (err) {
                                return callback(err);
                            }

                            /*
                             * Agar quote_invoice nahi milti hai,
                             * existing flow ko fail nahi karna hai.
                             */
                            if (
                                quoteInvoiceResult.length === 0
                            ) {
                                return callback(null, {
                                    status: null,
                                    balance: null,
                                    payment: totalReceipt,
                                    invoice_amount: 0,
                                });
                            }

                            const quoteInvoice =
                                quoteInvoiceResult[0];

                            /*
                             * Primary invoice amount:
                             * sumof_vatincl
                             *
                             * Fallback:
                             * sumof_finalamount, chargeable
                             */
                            const invoiceAmount =
                                Number(
                                    quoteInvoice.sumof_vatincl
                                ) ||
                                Number(
                                    quoteInvoice.sumof_finalamount
                                ) ||
                                Number(
                                    quoteInvoice.chargeable
                                ) ||
                                0;

                            const finalBalance = Math.max(
                                invoiceAmount - totalReceipt,
                                0
                            );

                            let invoiceStatus = "Unpaid";

                            if (
                                invoiceAmount > 0 &&
                                totalReceipt >= invoiceAmount
                            ) {
                                invoiceStatus = "Paid";
                            } else if (totalReceipt > 0) {
                                invoiceStatus = "Part Paid";
                            }

                            const updateQuoteInvoiceQuery = `
                                UPDATE quote_invoice
                                SET
                                    balance = ?,
                                    status = ?,
                                    updated_at = CURRENT_TIMESTAMP
                                WHERE order_id = ?
                                  AND is_deleted = 0
                            `;

                            con.query(
                                updateQuoteInvoiceQuery,
                                [
                                    finalBalance,
                                    invoiceStatus,
                                    customerOrderId,
                                ],
                                (err) => {
                                    if (err) {
                                        return callback(err);
                                    }

                                    return callback(null, {
                                        status: invoiceStatus,
                                        balance: finalBalance,
                                        payment: totalReceipt,
                                        invoice_amount:
                                            invoiceAmount,
                                    });
                                }
                            );
                        }
                    );
                }
            );
        };

        // ======================================================
        // CHECK CASHBOOK
        // ======================================================

        const checkCashbookQuery = `
            SELECT *
            FROM tbl_cashbook
            WHERE id = ?
        `;

        con.query(
            checkCashbookQuery,
            [cashbook_id],
            (err, cashbookResult) => {
                if (err) {
                    console.error(
                        "Error checking cashbook:",
                        err.message
                    );

                    return res.status(500).send({
                        success: false,
                        message: "Failed to check cashbook.",
                    });
                }

                // =================================================
                // CASE 1: CASHBOOK DOES NOT EXIST
                // =================================================

                if (cashbookResult.length === 0) {
                    const insertCashbookQuery = `
                        INSERT INTO tbl_cashbook
                        (
                            id,
                            customer_id,
                            supplier_id,
                            supplier_invoice_id,
                            order_id,
                            allocated,
                            allocation_type,
                            receipt
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `;

                    const insertParams = [
                        cashbook_id,

                        allocation_type === "Customer"
                            ? customer_id
                            : null,

                        allocation_type === "Supplier"
                            ? supplier_id
                            : null,

                        allocation_type === "Supplier"
                            ? supplier_invoice_id
                            : null,

                        allocation_type === "Customer"
                            ? order_id
                            : null,

                        "Yes",
                        allocation_type,
                        receipt || 0,
                    ];

                    con.query(
                        insertCashbookQuery,
                        insertParams,
                        (err) => {
                            if (err) {
                                console.error(
                                    "Error inserting cashbook:",
                                    err.message
                                );

                                return res.status(500).send({
                                    success: false,
                                    message:
                                        "Failed to insert cashbook.",
                                });
                            }

                            // -----------------------------------------
                            // CUSTOMER
                            // -----------------------------------------

                            if (
                                allocation_type === "Customer"
                            ) {
                                /*
                                 * Existing behavior:
                                 * New customer cashbook insert ke baad
                                 * customer invoice processing nahi hoti thi.
                                 *
                                 * New requirement:
                                 * quote_invoice ka payment status/balance
                                 * synchronize karna hai.
                                 * tbl_invoices.payment is refreshed from the
                                 * cashbook total for this order as well.
                                 */
                                recalcOrderPayment(order_id)
                                    .then(() => {
                                        updateCustomerInvoiceStatus(
                                            order_id,
                                            (
                                                customerErr,
                                                customerResponse
                                            ) => {
                                                if (customerErr) {
                                                    console.error(
                                                        "Customer invoice status update error:",
                                                        customerErr.message
                                                    );

                                                    return res.status(500).send({
                                                        success: false,
                                                        message:
                                                            customerErr.message,
                                                    });
                                                }

                                                return res.status(200).send({
                                                    success: true,
                                                    message:
                                                        "New cashbook entry created successfully.",
                                                    data: customerResponse,
                                                });
                                            }
                                        );
                                    })
                                    .catch((customerErr) => {
                                        console.error(
                                            "Customer invoice refresh error:",
                                            customerErr.message
                                        );

                                        if (!res.headersSent) {
                                            return res.status(500).send({
                                                success: false,
                                                message: customerErr.message,
                                            });
                                        }
                                    });

                                return;
                            }

                            // -----------------------------------------
                            // SUPPLIER
                            // -----------------------------------------

                            updateSupplierInvoicePayment(
                                supplier_invoice_id,
                                (
                                    supplierErr,
                                    supplierResponse
                                ) => {
                                    if (supplierErr) {
                                        console.error(
                                            "Supplier invoice update error:",
                                            supplierErr.message
                                        );

                                        return res.status(500).send({
                                            success: false,
                                            message:
                                                supplierErr.message,
                                        });
                                    }

                                    return res.status(200).send({
                                        success: true,
                                        message:
                                            "New cashbook entry created and supplier invoice updated successfully.",
                                        data: supplierResponse,
                                    });
                                }
                            );
                        }
                    );

                    return;
                }

                // =================================================
                // CASE 2: CASHBOOK ALREADY EXISTS
                // =================================================

                const previousOrderId = cashbookResult[0].order_id;
                const previousSupplierInvoiceId = cashbookResult[0].supplier_invoice_id;

                let updateQuery = `
                    UPDATE tbl_cashbook
                    SET
                `;

                const updateFields = [];
                const updateParams = [];

                // -----------------------------------------
                // CUSTOMER
                // -----------------------------------------

                if (allocation_type === "Customer") {
                    if (customer_id) {
                        updateFields.push("customer_id = ?");
                        updateParams.push(customer_id);
                    }

                    // Existing logic preserved
                    updateFields.push("supplier_id = NULL");
                    updateFields.push(
                        "supplier_invoice_id = NULL"
                    );

                    updateFields.push(
                        "allocation_type = ?"
                    );
                    updateParams.push("Customer");

                    if (order_id) {
                        updateFields.push("order_id = ?");
                        updateParams.push(order_id);

                        updateFields.push("allocated = ?");
                        updateParams.push("Yes");
                    }

                    /*
                     * Receipt ko update karna zaroori hai.
                     * Isse existing cashbook payment amount
                     * latest request ke amount se synchronize hoga.
                     */
                    if (receipt !== undefined) {
                        updateFields.push("receipt = ?");
                        updateParams.push(receipt || 0);
                    }
                }

                // -----------------------------------------
                // SUPPLIER
                // -----------------------------------------

                if (allocation_type === "Supplier") {
                    updateFields.push("supplier_id = ?");
                    updateParams.push(supplier_id);

                    updateFields.push(
                        "supplier_invoice_id = ?"
                    );
                    updateParams.push(supplier_invoice_id);

                    updateFields.push("customer_id = NULL");
                    updateFields.push("order_id = NULL");

                    updateFields.push(
                        "allocation_type = ?"
                    );
                    updateParams.push("Supplier");

                    updateFields.push("allocated = ?");
                    updateParams.push("Yes");

                    /*
                     * Existing supplier flow preserve.
                     * Receipt update only if request mein provided hai.
                     */
                    if (receipt !== undefined) {
                        updateFields.push("receipt = ?");
                        updateParams.push(receipt || 0);
                    }
                }

                updateParams.push(cashbook_id);

                if (updateFields.length === 0) {
                    return res.status(400).send({
                        success: false,
                        message:
                            "No fields provided for update.",
                    });
                }

                updateQuery +=
                    updateFields.join(", ") +
                    " WHERE id = ?";

                con.query(
                    updateQuery,
                    updateParams,
                    (err, result) => {
                        if (err) {
                            console.error(
                                "Error updating cashbook:",
                                err.message
                            );

                            return res.status(500).send({
                                success: false,
                                message:
                                    "Failed to update cashbook.",
                            });
                        }

                    /*
                     * The row may have moved off its previous order or
                     * supplier invoice. Refresh those old links first.
                     * The new link is refreshed by the flow below.
                     */
                    const nextOrderId = allocation_type === "Customer" ? (order_id || null) : null;
                    const nextSupplierInvoiceId = allocation_type === "Supplier" ? (supplier_invoice_id || null) : null;

                    const continueAllocation = () => {

                    // =================================================
                    // SUPPLIER FLOW
                    // =================================================

                    if (
                        allocation_type === "Supplier"
                    ) {
                            updateSupplierInvoicePayment(
                                supplier_invoice_id,
                                (
                                    supplierErr,
                                    supplierResponse
                                ) => {
                                    if (supplierErr) {
                                        console.error(
                                            "Supplier invoice update error:",
                                            supplierErr.message
                                        );

                                        return res.status(500).send({
                                            success: false,
                                            message:
                                                supplierErr.message,
                                        });
                                    }

                                    return res.status(200).send({
                                        success: true,
                                        message:
                                            "Supplier payment allocated and invoice updated successfully.",
                                        data: supplierResponse,
                                    });
                                }
                            );

                            return;
                        }

                        // =================================================
                        // CUSTOMER FLOW
                        // =================================================

                        /*
                         * Existing customer tbl_invoices logic preserved.
                         * Pehle customer invoice update hoga.
                         */

                        if (!order_id) {
                            return res.status(200).send({
                                success: true,
                                message:
                                    "Cashbook updated successfully.",
                            });
                        }

                        // -----------------------------------------
                        // STEP 1:
                        // GET TOTAL CUSTOMER RECEIPT
                        // -----------------------------------------

                        const fetchReceiptsQuery = `
                            SELECT
                                COALESCE(
                                    SUM(
                                        COALESCE(receipt, 0)
                                    ),
                                    0
                                ) AS total_receipt
                            FROM tbl_cashbook
                            WHERE order_id = ?
                              AND allocation_type = 'Customer'
                        `;

                        con.query(
                            fetchReceiptsQuery,
                            [order_id],
                            (err, receiptResult) => {
                                if (err) {
                                    console.error(
                                        "Error fetching receipt total:",
                                        err.message
                                    );

                                    return res.status(500).send({
                                        success: false,
                                        message:
                                            "Failed to fetch receipt total.",
                                    });
                                }

                                const totalReceipt =
                                    Number(
                                        receiptResult[0]
                                            ?.total_receipt
                                    ) || 0;

                                // -----------------------------------------
                                // STEP 2:
                                // EXISTING tbl_invoices UPDATE
                                // -----------------------------------------

                                const checkInvoiceQuery = `
                                    SELECT *
                                    FROM tbl_invoices
                                    WHERE order_id = ?
                                `;

                                con.query(
                                    checkInvoiceQuery,
                                    [order_id],
                                    (err, invoiceResult) => {
                                        if (err) {
                                            console.error(
                                                "Error checking invoice:",
                                                err.message
                                            );

                                            return res.status(500).send({
                                                success: false,
                                                message:
                                                    "Failed to check invoice.",
                                            });
                                        }

                                        /*
                                         * Existing tbl_invoices flow:
                                         * Isko change nahi kiya gaya.
                                         */

                                        if (
                                            invoiceResult.length > 0
                                        ) {
                                            const updatePaymentQuery = `
                                                UPDATE tbl_invoices
                                                SET
                                                    payment = ?,
                                                    status = ?
                                                WHERE order_id = ?
                                            `;

                                            con.query(
                                                updatePaymentQuery,
                                                [
                                                    totalReceipt,
                                                    "Part Paid",
                                                    order_id,
                                                ],
                                                (err) => {
                                                    if (err) {
                                                        console.error(
                                                            "Error updating payment:",
                                                            err.message
                                                        );

                                                        return res.status(500).send({
                                                            success: false,
                                                            message:
                                                                "Failed to update payment.",
                                                        });
                                                    }

                                                    /*
                                                     * Existing tbl_invoices
                                                     * update ke baad new
                                                     * quote_invoice flow.
                                                     */
                                                    updateCustomerInvoiceStatus(
                                                        order_id,
                                                        (
                                                            customerErr,
                                                            customerResponse
                                                        ) => {
                                                            if (
                                                                customerErr
                                                            ) {
                                                                console.error(
                                                                    "Customer quote invoice update error:",
                                                                    customerErr.message
                                                                );

                                                                return res.status(500).send({
                                                                    success: false,
                                                                    message:
                                                                        customerErr.message,
                                                                });
                                                            }

                                                            /*
                                                             * Existing invoice
                                                             * details flow.
                                                             */
                                                            const selectInvoiceQuery = `
                                                                SELECT
                                                                    invoice_amt,
                                                                    payment
                                                                FROM tbl_invoices
                                                                WHERE order_id = ?
                                                            `;

                                                            con.query(
                                                                selectInvoiceQuery,
                                                                [order_id],
                                                                (
                                                                    err,
                                                                    invoiceDetails
                                                                ) => {
                                                                    if (err) {
                                                                        console.error(
                                                                            "Error fetching invoice:",
                                                                            err.message
                                                                        );

                                                                        return res.status(500).send({
                                                                            success: false,
                                                                            message:
                                                                                "Failed to fetch invoice details.",
                                                                        });
                                                                    }

                                                                    if (
                                                                        invoiceDetails.length ===
                                                                        0
                                                                    ) {
                                                                        return res.status(404).send({
                                                                            success: false,
                                                                            message:
                                                                                "Invoice not found.",
                                                                        });
                                                                    }

                                                                    const invoiceAmt =
                                                                        Number(
                                                                            invoiceDetails[0]
                                                                                .invoice_amt
                                                                        ) || 0;

                                                                    const payment =
                                                                        Number(
                                                                            invoiceDetails[0]
                                                                                .payment
                                                                        ) || 0;

                                                                    const finalBalance =
                                                                        invoiceAmt -
                                                                        payment;

                                                                    const updateBalanceQuery = `
                                                                        UPDATE tbl_invoices
                                                                        SET balance = ?
                                                                        WHERE order_id = ?
                                                                    `;

                                                                    con.query(
                                                                        updateBalanceQuery,
                                                                        [
                                                                            finalBalance,
                                                                            order_id,
                                                                        ],
                                                                        (err) => {
                                                                            if (err) {
                                                                                console.error(
                                                                                    "Error updating invoice balance:",
                                                                                    err.message
                                                                                );

                                                                                return res.status(500).send({
                                                                                    success: false,
                                                                                    message:
                                                                                        "Failed to update invoice balance.",
                                                                                });
                                                                            }

                                                                            return res.status(200).send({
                                                                                success: true,
                                                                                message:
                                                                                    "Customer invoice updated successfully.",
                                                                                data: {
                                                                                    existing_invoice: {
                                                                                        payment,
                                                                                        balance: finalBalance,
                                                                                    },
                                                                                    quote_invoice:
                                                                                        customerResponse,
                                                                                },
                                                                            });
                                                                        }
                                                                    );
                                                                }
                                                            );
                                                        }
                                                    );
                                                }
                                            );

                                            return;
                                        }

                                        // -----------------------------------------
                                        // EXISTING LOGIC:
                                        // NEW tbl_invoices RECORD
                                        // -----------------------------------------

                                        const insertInvoiceQuery = `
                                            INSERT INTO tbl_invoices
                                            (
                                                order_id,
                                                payment,
                                                status,
                                                balance
                                            )
                                            VALUES (?, ?, ?, ?)
                                        `;

                                        con.query(
                                            insertInvoiceQuery,
                                            [
                                                order_id,
                                                totalReceipt,
                                                "Part Paid",
                                                0,
                                            ],
                                            (err) => {
                                                if (err) {
                                                    console.error(
                                                        "Error inserting invoice:",
                                                        err.message
                                                    );

                                                    return res.status(500).send({
                                                        success: false,
                                                        message:
                                                            "Failed to insert invoice.",
                                                    });
                                                }

                                                /*
                                                 * Existing new invoice
                                                 * insertion ke baad new
                                                 * quote_invoice update.
                                                 */
                                                updateCustomerInvoiceStatus(
                                                    order_id,
                                                    (
                                                        customerErr,
                                                        customerResponse
                                                    ) => {
                                                        if (
                                                            customerErr
                                                        ) {
                                                            console.error(
                                                                "Customer quote invoice update error:",
                                                                customerErr.message
                                                            );

                                                            return res.status(500).send({
                                                                success: false,
                                                                message:
                                                                    customerErr.message,
                                                            });
                                                        }

                                                        return res.status(200).send({
                                                            success: true,
                                                            message:
                                                                "New customer invoice created successfully.",
                                                            data: {
                                                                quote_invoice:
                                                                    customerResponse,
                                                            },
                                                        });
                                                    }
                                                );
                                            }
                                        );
                                    }
                                );
                            }
                        );
                    }

                    Promise.resolve()
                        .then(async () => {
                            if (
                                previousOrderId &&
                                String(previousOrderId) !== String(nextOrderId || "")
                            ) {
                                await recalcOrderPayment(previousOrderId);
                            }
                            if (
                                previousSupplierInvoiceId &&
                                String(previousSupplierInvoiceId) !== String(nextSupplierInvoiceId || "")
                            ) {
                                await recalcSupplierInvoicePayment(previousSupplierInvoiceId);
                            }
                        })
                        .then(() => continueAllocation())
                        .catch((refreshErr) => {
                            console.error(
                                "Invoice payment refresh error:",
                                refreshErr.message
                            );
                            if (!res.headersSent) {
                                return res.status(500).send({
                                    success: false,
                                    message: refreshErr.message,
                                });
                            }
                        });
                }
            );
            }
        );
    } catch (error) {
        console.error(
            "Unexpected error:",
            error.message
        );

        return res.status(500).send({
            success: false,
            message:
                "An unexpected error occurred.",
        });
    }
};

const updateSupplierInvoicePayment = (
    supplierInvoiceId,
    callback
) => {

    // ---------------------------------------------------------
    // STEP 1:
    // GET SUPPLIER INVOICE
    // ---------------------------------------------------------

    const getSupplierInvoiceQuery = `
        SELECT
            id,
            supplier_id,
            reference_no,
            sumof_vatincl,
            payment,
            balance,
            status
        FROM supplier_shipment_invoice
        WHERE id = ?
    `;

    con.query(
        getSupplierInvoiceQuery,
        [supplierInvoiceId],
        (err, invoiceResult) => {

            if (err) {
                return callback(
                    new Error(
                        "Failed to fetch supplier invoice: " +
                        err.message
                    )
                );
            }

            if (invoiceResult.length === 0) {
                return callback(
                    new Error(
                        "Supplier invoice not found."
                    )
                );
            }

            const invoice =
                invoiceResult[0];

            const invoiceAmount =
                Number(invoice.sumof_vatincl) || 0;

            // -------------------------------------------------
            // STEP 2:
            // GET TOTAL PAYMENT FROM CASHBOOK
            // -------------------------------------------------

            const totalPaymentQuery = `
                SELECT
                    SUM(receipt) AS total_payment
                FROM tbl_cashbook
                WHERE allocation_type = 'Supplier'
                AND supplier_invoice_id = ?
            `;

            con.query(
                totalPaymentQuery,
                [supplierInvoiceId],
                (err, paymentResult) => {

                    if (err) {
                        return callback(
                            new Error(
                                "Failed to fetch supplier payment total: " +
                                err.message
                            )
                        );
                    }

                    const totalPayment =
                        Number(
                            paymentResult[0]?.total_payment
                        ) || 0;

                    // -------------------------------------------------
                    // STEP 3:
                    // CALCULATE BALANCE
                    // -------------------------------------------------

                    let balance =
                        invoiceAmount -
                        totalPayment;

                    // Prevent negative balance
                    if (balance < 0) {
                        balance = 0;
                    }

                    // -------------------------------------------------
                    // STEP 4:
                    // DETERMINE STATUS
                    // -------------------------------------------------

                    let status = "unpaid";

                    if (totalPayment > 0 && balance > 0) {
                        status = "Part Paid";
                    }

                    if (balance <= 0 && totalPayment > 0) {
                        status = "Paid";
                    }

                    // -------------------------------------------------
                    // STEP 5:
                    // UPDATE SUPPLIER INVOICE
                    // -------------------------------------------------

                    const updateSupplierInvoiceQuery = `
                        UPDATE supplier_shipment_invoice
                        SET
                            payment = ?,
                            balance = ?,
                            status = ?
                        WHERE id = ?
                    `;

                    con.query(
                        updateSupplierInvoiceQuery,
                        [
                            totalPayment,
                            balance,
                            status,
                            supplierInvoiceId,
                        ],
                        (err) => {

                            if (err) {
                                return callback(
                                    new Error(
                                        "Failed to update supplier invoice: " +
                                        err.message
                                    )
                                );
                            }

                            return callback(
                                null,
                                {
                                    supplier_invoice_id:
                                        supplierInvoiceId,

                                    reference_no:
                                        invoice.reference_no,

                                    invoice_amount:
                                        invoiceAmount,

                                    payment:
                                        totalPayment,

                                    balance:
                                        balance,

                                    status:
                                        status,
                                }
                            );
                        }
                    );
                }
            );
        }
    );
};

const getSupplierAllInvoice = async (req, res) => {
    try {
        const { supplier_id } = req.query;

        if (!supplier_id) {
            return res.status(400).json({
                success: false,
                message: "Supplier ID is required.",
            });
        }

        const query = `
            SELECT
                id as supplier_invoice_id,
                reference_no,
                supplier_id,
                sumof_vatincl,
                payment,
                balance,
                status
            FROM supplier_shipment_invoice
            WHERE supplier_id = ?
            AND status != 'paid'
            ORDER BY id DESC
        `;

        con.query(
            query,
            [supplier_id],
            (err, result) => {
                if (err) {
                    console.error(
                        "Error fetching supplier invoices:",
                        err.message
                    );

                    return res.status(500).json({
                        success: false,
                        message: "Failed to fetch supplier invoices.",
                    });
                }

                return res.status(200).json({
                    success: true,
                    message: "Supplier invoices fetched successfully.",
                    data: result,
                });
            }
        );

    } catch (error) {
        console.error(
            "Unexpected error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred.",
        });
    }
};


const GetClientAllInvoice = async (req, res) => {
    try {
        const { client_id } = req.body;
        const paymentQuery = `SELECT 
    tbl_orders.id AS order_ID, 
    sage_invoice_list.*, 
    COALESCE(tbl_queries.subject, '') AS query_subject, 
    COALESCE(tbl_queries.message, '') AS query_message, 
    COALESCE(tbl_queries.nature_of_Heading, '') AS query_nature_of_Heading,
    COALESCE(tbl_queries.outcome, '') AS query_outcome, 
    COALESCE(tbl_queries.resolution, '') AS query_resolution,
    COALESCE(tbl_queries.	Dispute_ID, '') AS query_Dispute_ID,
    tbl_invoices.id AS invoice_id, 
    tbl_invoices.*, 
    tbl_freight.freight_number AS freight_number,
    CONCAT('OR000', tbl_orders.id) AS order_number, 
    tbl_users.id AS client_id, 
    CASE 
        WHEN tbl_orders.client_id = 0 THEN tbl_orders.client_name 
        ELSE COALESCE(tbl_users.full_name, 'Unknown Client') 
    END AS client_name
FROM tbl_orders
LEFT JOIN tbl_users ON tbl_users.id = tbl_orders.client_id
LEFT JOIN tbl_freight ON tbl_freight.id = tbl_orders.freight_id
LEFT JOIN tbl_invoices ON tbl_invoices.order_id = tbl_orders.id
LEFT JOIN tbl_queries ON tbl_queries.freight_no = tbl_freight.freight_number
LEFT JOIN sage_invoice_list ON sage_invoice_list.id = tbl_invoices.sage_invoice_id
WHERE tbl_orders.client_id = ?
ORDER BY tbl_orders.id DESC;
`
        con.query(paymentQuery, [client_id], (err, paymentResult) => {
            if (err) throw err;
            return res.status(200).send({
                success: true,
                data: paymentResult,
            });
        })
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: error.message,
        });
    }
}

const GetAllFreightDocs = async (req, res) => {
    try {
        const paymentQuery = `
            SELECT 
                tbl_freight.id, 
                tbl_freight.freight_number,
                tbl_users.full_name as client_name,
                tbl_users.client_number AS client_number
            FROM tbl_freight
            LEFT JOIN tbl_users ON tbl_users.id = tbl_freight.client_id
            ORDER BY tbl_freight.id DESC;
        `;

        con.query(paymentQuery, (err, results) => {
            if (err) throw err;

            return res.status(200).send({
                success: true,
                data: results,
            });
        });
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: error.message,
        });
    }
};


const GetByIDAllFreightDocs = async (req, res) => {
    try {
        const { freight_id } = req.body;
        const paymentQuery = `
            SELECT 
                tbl_freight.id, 
                tbl_freight.attachment_Estimate,
                GROUP_CONCAT(
                    CONCAT('{"document_name":"', freight_doc.document_name, '", "doc":"', freight_doc.document, '"}')
                    SEPARATOR ','
                ) AS documents,
                GROUP_CONCAT(
                    CONCAT('{ "doc":"', all_freight_docs.docs, '"}')
                    SEPARATOR ','
                ) AS EXTRA_documents
            FROM tbl_freight
            LEFT JOIN freight_doc ON freight_doc.freight_id = tbl_freight.id
            LEFT JOIN all_freight_docs ON all_freight_docs.freight_id = tbl_freight.id
            WHERE tbl_freight.is_deleted=0 and tbl_freight.id=?
            GROUP BY tbl_freight.id, tbl_freight.attachment_Estimate
            ORDER BY tbl_freight.id DESC;
        `;

        con.query(paymentQuery, [freight_id], (err, results) => {
            if (err) throw err;

            // Format response properly
            const formattedData = results.map(row => ({
                id: row.id,
                attachment_Estimate: row.attachment_Estimate,
                documents: row.documents ? JSON.parse(`[${row.documents}]`) : [], // Convert to JSON array
                EXTRA_documents: row.EXTRA_documents ? JSON.parse(`[${row.EXTRA_documents}]`) : [] // Convert to JSON array
            }));

            return res.status(200).send({
                success: true,
                data: formattedData,
            });
        });
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: error.message,
        });
    }
};


const AddFreightDoc = async (req, res) => {
    try {
        const { freight_id } = req.body;

        // Check if a file is uploaded
        if (!req.file) {
            return res.status(400).send({
                success: false,
                message: "Document file is required",
            });
        }

        const document = req.file.originalname; // Get file name from Multer

        // Insert Query.extname(file.originalname));
        const insertQuery = `
            INSERT INTO all_freight_docs (freight_id, docs)
            VALUES (?, ?)
        `;

        con.query(insertQuery, [freight_id, document], (err, result) => {
            if (err) throw err;

            return res.status(201).send({
                success: true,
                message: "Document added successfully",
                document_id: result.insertId,
            });
        });

    } catch (error) {
        return res.status(500).send({
            success: false,
            message: error.message,
        });
    }
};

const UpdateSageInvoiceDoc = async (req, res) => {
    try {
        const { sage_invoice_id } = req.body;

        // Check if a file is uploaded
        if (!req.file) {
            return res.status(400).send({
                success: false,
                message: "Document file is required",
            });
        }

        const document = req.file.filename; // Get file name from Multer

        // Insert Query
        const insertQuery = `
            UPDATE sage_invoice_list SET document=? where id=?
        `;

        con.query(insertQuery, [document, sage_invoice_id], (err, result) => {
            if (err) throw err;

            return res.status(201).send({
                success: true,
                message: "Document updated successfully",
            });
        });

    } catch (error) {
        return res.status(500).send({
            success: false,
            message: error.message,
        });
    }
};

// const GetRealeseDashboard = async (req, res) => {
//     try {
//         const page = Math.max(Number(req.body.page) || 1, 1);
//         const limit = Math.max(Number(req.body.limit) || 10, 1);
//         const offset = (page - 1) * limit;

//         const paymentQuery = `
//     SELECT 
//         i.*, 
//         tbl_users.full_name as order_user_name, 
//         CONCAT('OR000', o.id) AS order_number, 
//         r.id as realese_id, 
//         r.cargo_inspection, 
//         r.release_instruction, 
//         r.Status as release_status, 
//         o.track_status as order_status, 
//         c.order_status as clearance_status, 
//         s.customer_name as sage_customer_name, 
//         s.document_number as sage_document_number, 
//         s.customer_ref as sage_customer_ref, 
//         s.date as sage_date, 
//         s.total as sage_total 
//     FROM tbl_invoices as i 
//     INNER JOIN sage_invoice_list as s 
//         ON s.id=i.sage_invoice_id
//     LEFT JOIN clearance_order as c 
//         ON c.order_id=i.order_id
//     INNER JOIN tbl_orders as o 
//         ON o.id=i.order_id
//     LEFT JOIN realese_dashboard as r 
//         ON r.invoice_id=i.id
//     LEFT JOIN tbl_users 
//         ON tbl_users.id = o.client_id

//     ORDER BY i.id DESC

//     LIMIT ? OFFSET ?
// `;
//         con.query(paymentQuery, [limit, offset], (err, paymentResult) => {
//             if (err) {
//                 console.error("Error fetching existing payment:", err.message);
//                 return res.status(500).send({
//                     success: false,
//                     message: err.message
//                 });
//             }

//             const Query = `SELECT COUNT(*) as total FROM tbl_invoices`;
//             con.query(Query, (err, total) => {
//                 if (err) {
//                     console.error("Error fetching existing payment:", err.message);
//                     return res.status(500).send({
//                         success: false,
//                         message: err.message
//                     });
//                 }
//                 return res.status(200).send({
//                     success: true,
//                     message: "Successfully",
//                     data: paymentResult,
//                     page,
//                     limit,
//                     total: total[0].total,
//                     totalPages: Math.ceil(total[0].total / limit)
//                 });
//             })
//         })
//     } catch (error) {
//         return res.status(500).send({
//             success: false,
//             message: error.message,
//         });
//     }
// }

const GetRealeseDashboard = async (req, res) => {

    try {

        const page = Math.max(Number(req.query.page) || 1, 1);
        const limit = Math.max(Number(req.query.limit) || 10, 1);

        const offset = (page - 1) * limit;

        const paymentQuery = `
            SELECT 
                i.*, 
                tbl_users.full_name as order_user_name, 
                CONCAT('OR000', o.id) AS order_number, 
                r.id as realese_id, 
                r.cargo_inspection, 
                r.release_instruction, 
                r.Status as release_status, 
                o.track_status as order_status, 
                c.order_status as clearance_status, 
                s.customer_name as sage_customer_name, 
                s.document_number as sage_document_number, 
                s.customer_ref as sage_customer_ref, 
                s.date as sage_date, 
                s.total as sage_total 

            FROM tbl_invoices as i 

            INNER JOIN sage_invoice_list as s 
                ON s.id = i.sage_invoice_id

            LEFT JOIN clearance_order as c 
                ON c.order_id = i.order_id

            INNER JOIN tbl_orders as o 
                ON o.id = i.order_id

            LEFT JOIN realese_dashboard as r 
                ON r.invoice_id = i.id

            LEFT JOIN tbl_users 
                ON tbl_users.id = o.client_id

            ORDER BY i.id DESC

            LIMIT ? OFFSET ?
        `;

        con.query(paymentQuery, [limit, offset], (err, paymentResult) => {

            if (err) {

                return res.status(500).send({
                    success: false,
                    message: err.message
                });

            }

            const countQuery = `
                SELECT COUNT(*) as total
                FROM tbl_invoices
            `;

            con.query(countQuery, (err, totalResult) => {

                if (err) {

                    return res.status(500).send({
                        success: false,
                        message: err.message
                    });

                }

                const total = totalResult[0].total;

                return res.status(200).send({
                    success: true,
                    message: "Successfully",
                    data: paymentResult,
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                });

            });

        });

    } catch (error) {

        return res.status(500).send({
            success: false,
            message: error.message
        });

    }

};

const ManageRealeseDashboard = async (req, res) => {
    try {
        const {
            order_id,
            invoice_id,
            cargo_inspection,
            release_instruction,
            Status,
            realese_id
        } = req.body;

        if (!realese_id) {
            const insertQuery = `
                INSERT INTO realese_dashboard 
                (order_id, invoice_id, cargo_inspection, release_instruction, Status)
                VALUES (?, ?, ?, ?, ?)
            `;

            con.query(
                insertQuery,
                [
                    order_id,
                    invoice_id,
                    cargo_inspection || null,
                    release_instruction || null,
                    Status || "Open"
                ],
                (err, result) => {
                    if (err) {
                        console.error("Insert Error:", err);
                        return res.status(500).send({
                            success: false,
                            message: "Database insert error",
                        });
                    }

                    return res.status(200).send({
                        success: true,
                        message: "Added successfully",
                        id: result.insertId,
                    });
                }
            );
        } else {
            let finalrelease_instruction = Status == "Close" ? "Release" : "Hold"

            const updateQuery = `
                UPDATE realese_dashboard 
                SET cargo_inspection = ?, release_instruction = ?, Status = ?
                WHERE id = ?
            `;
            con.query(
                updateQuery,
                [cargo_inspection, finalrelease_instruction, Status, realese_id],
                (err, result) => {
                    if (err) {
                        console.error("Update Error:", err);
                        return res.status(500).send({
                            success: false,
                            message: "Database update error",
                        });
                    }

                    return res.status(200).send({
                        success: true,
                        message: "Updated successfully",
                        id: realese_id,
                    });
                }
            );
        }
    } catch (error) {
        console.error("Unhandled Error:", error);
        return res.status(500).send({
            success: false,
            message: error.message || "Unexpected server error",
        });
    }
};

const DownloadQuoteEstimatePDF = async (req, res) => {
    try {
        const { quote_estimate_id } = req.body;

        if (!quote_estimate_id) {
            return res.status(400).json({
                success: false,
                message: "quote_estimate_id required"
            });
        }

        const sql = `SELECT * FROM estimate_shipping_quote WHERE id = ?`;

        con.query(sql, [quote_estimate_id], (err, rows) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            if (!rows.length) return res.status(404).json({ success: false, message: "Not found" });

            const d = rows[0];

            /* ================= PDF INIT ================= */
            const doc = new PDFDocument({ size: "A4", margin: 40 });
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename=Quote_${d.serial_number}.pdf`);
            doc.pipe(res);

            /* ================= COLORS ================= */
            const HEADER_BG = "#0B5ED7";
            const SECTION_BG = "#E9F2FF";
            const TABLE_HEADER = "#D0E2FF";
            const TOTAL_BG = "#0B5ED7";
            const WHITE = "#FFFFFF";
            const TEXT = "#000000";

            /* ================= HEADER ================= */
            doc.rect(0, 0, 595, 80).fill(HEADER_BG);
            doc.fillColor(WHITE).fontSize(22).text("QUOTATION", 40, 30);

            /* ================= INFO BOX ================= */
            doc.rect(40, 100, 515, 90).fill(SECTION_BG);
            doc.fillColor(TEXT).fontSize(10);

            doc.text(`Quotation No : ${d.serial_number}`, 50, 110);
            doc.text(`Date : ${moment(d.date).format("DD-MM-YYYY")}`, 350, 110);
            doc.text(`Client Name : ${d.client_name}`, 50, 130);
            doc.text(`Freight Type : ${d.freight}`, 50, 150);
            doc.text(`Incoterm : ${d.incoterm}`, 350, 150);

            /* ================= TABLE HEADER ================= */
            let y = 220;
            doc.rect(40, y, 515, 30).fill(TABLE_HEADER);
            doc.fillColor(TEXT).fontSize(11).font("Helvetica-Bold");
            doc.text("Charge Description", 50, y + 8);
            doc.text("Amount", 450, y + 8, { align: "right" });

            y += 30;
            doc.font("Helvetica").fontSize(10);

            /* ================= CHARGES ================= */
            const charges = [
                ["Origin Pickup", d.finalvlaueoriginPickup],
                ["Origin Fuel", d.finalvlaueoFuel],
                ["Origin CFS", d.finalvlaueocfs],
                ["Origin Documentation", d.finalvlaueodoc],
                ["Origin Forwarding", d.finalvlaueoforewarding],
                ["Origin Customs", d.finalvlaueoCustomes],
                ["Freight Charges", d.finalvlaueofreight],
                ["Insurance", d.finalvlaueoInsurance],
                ["Transit Charges", d.finalvlaueotransit],
                ["Destination THC", d.final3rTHCdestination1],
                ["Destination Delivery", d.final3runpackdestination1],
                ["Admin Charges", d.finalvlaueotAdmin]
            ];

            charges.forEach(c => {
                if (Number(c[1]) > 0) {
                    doc.rect(40, y, 515, 25).stroke("#B6C8E6");
                    doc.fillColor(TEXT).text(c[0], 50, y + 7);
                    doc.text(Number(c[1]).toFixed(2), 450, y + 7, { align: "right" });
                    y += 25;
                }
            });

            /* ================= TOTAL ================= */
            y += 10;
            doc.rect(40, y, 515, 35).fill(TOTAL_BG);
            doc.fillColor(WHITE).fontSize(12).font("Helvetica-Bold");
            doc.text("Grand Total", 50, y + 10);
            doc.text(Number(d.sumofall).toFixed(2), 450, y + 10, { align: "right" });

            /* ================= FOOTER ================= */
            doc.moveDown(4);
            doc.fillColor("#444").fontSize(9);
            doc.text("This is a system generated quotation.", { align: "center" });

            doc.end();
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


module.exports = {
    AddInvoiceDetails, ADDcashbook, GetClientAllInvoice, GetAllFreightDocs, GetByIDAllFreightDocs, AddFreightDoc, UpdateSageInvoiceDoc,
    GetRealeseDashboard, ManageRealeseDashboard, getSupplierAllInvoice
}