const con = require('../config/database');
const { validationResult, Result } = require('express-validator');
const bcrypt = require('bcryptjs');
const sendMail = require('../helpers/sendMail')
const rendomString = require('randomstring');

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
                            console.log(results[0]);

                            const fetchedInvoiceAmt = results[0].total;
                            const newBalance = fetchedInvoiceAmt - (existingPayment || 0);
                            console.log(fetchedInvoiceAmt);

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

/* const ADDcashbook = async (req, res) => {
    try {
        const {
            cashbook_id,
            customer_id,
            order_id,
            allocated,
            receipt,
        } = req.body;

        if (!cashbook_id) {
            return res.status(400).send({
                success: false,
                message: "Cashbook ID is required.",
            });
        }

        // Dynamically build the update query and parameters
        let updateQuery = "UPDATE tbl_cashbook SET ";
        const updateFields = [];
        const updateParams = [];

        if (customer_id) {
            updateFields.push("customer_id = ?");
            updateParams.push(customer_id);
        }
        if (order_id) {
            updateFields.push("order_id = ?");
            updateParams.push(order_id);
        }
        if (allocated) {
            updateFields.push("allocated = ?");
            updateParams.push(allocated);
        }

        updateParams.push(cashbook_id);

        if (updateFields.length === 0) {
            return res.status(400).send({
                success: false,
                message: "No fields provided for update.",
            });
        }

        updateQuery += updateFields.join(", ") + " WHERE id = ?";

        // Update tbl_cashbook
        con.query(updateQuery, updateParams, (err, result) => {
            if (err) {
                console.error("Error updating cashbook:", err.message);
                return res.status(500).send({
                    success: false,
                    message: "Failed to update cashbook.",
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).send({
                    success: false,
                    message: "Cashbook not found for the given cashbook_id.",
                });
            }

            if (!order_id) {
                return res.status(200).send({
                    success: true,
                    message: "Cashbook updated successfully.",
                });
            }

            // Step 1: Fetch total receipt sum from tbl_cashbook for this order_id
            const fetchReceiptsQuery = `
                SELECT SUM(receipt) AS total_receipt 
                FROM tbl_cashbook 
                WHERE order_id = ?
            `;

            con.query(fetchReceiptsQuery, [order_id], (err, receiptResult) => {
                if (err) {
                    console.error("Error fetching receipt total:", err.message);
                    return res.status(500).send({
                        success: false,
                        message: "Failed to fetch receipt total.",
                    });
                }

                const totalReceipt = receiptResult[0]?.total_receipt || 0;

                // Step 2: Update payment in tbl_invoices
                const updatePaymentQuery = `
                    UPDATE tbl_invoices
                    SET 
                        payment = ?,
                        status = ?
                    WHERE order_id = ?
                `;

                con.query(updatePaymentQuery, [totalReceipt, "Part Paid", order_id], (err, paymentUpdateResult) => {
                    if (err) {
                        console.error("Error updating payment:", err.message);
                        return res.status(500).send({
                            success: false,
                            message: "Failed to update payment.",
                        });
                    }

                    if (paymentUpdateResult.affectedRows === 0) {
                        return res.status(404).send({
                            success: false,
                            message: "No invoice found for the given order ID.",
                        });
                    }

                    // Step 3: Fetch updated invoice details
                    const selectInvoiceQuery = `
                        SELECT invoice_amt, payment 
                        FROM tbl_invoices
                        WHERE order_id = ?
                    `;

                    con.query(selectInvoiceQuery, [order_id], (err, invoiceResult) => {
                        if (err) {
                            console.error("Error fetching invoice:", err.message);
                            return res.status(500).send({
                                success: false,
                                message: "Failed to fetch invoice details.",
                            });
                        }

                        if (invoiceResult.length === 0) {
                            return res.status(404).send({
                                success: false,
                                message: "No invoice found for the given order ID.",
                            });
                        }

                        const { invoice_amt, payment } = invoiceResult[0];
                        const finalBalance = invoice_amt ? invoice_amt - payment : 0;

                        // Step 4: Update balance in tbl_invoices
                        const updateStatusQuery = `
                            UPDATE tbl_invoices
                            SET balance = ?
                            WHERE order_id = ?
                        `;

                        con.query(updateStatusQuery, [finalBalance, order_id], (err) => {
                            if (err) {
                                console.error("Error updating invoice balance:", err.message);
                                return res.status(500).send({
                                    success: false,
                                    message: "Failed to update invoice balance.",
                                });
                            }

                            return res.status(200).send({
                                success: true,
                                message: "Cashbook and invoice updated successfully.",
                            });
                        });
                    });
                });
            });
        });
    } catch (error) {
        console.error("Unexpected error:", error.message);
        return res.status(500).send({
            success: false,
            message: "An unexpected error occurred.",
        });
    }
}; */

const ADDcashbook = async (req, res) => {
    try {
        const {
            cashbook_id,
            customer_id,
            order_id,
            allocated,
            receipt,
        } = req.body;

        if (!cashbook_id) {
            return res.status(400).send({
                success: false,
                message: "Cashbook ID is required.",
            });
        }

        // Check if cashbook exists
        const checkCashbookQuery = `SELECT * FROM tbl_cashbook WHERE id = ?`;
        con.query(checkCashbookQuery, [cashbook_id], (err, cashbookResult) => {
            if (err) {
                console.error("Error checking cashbook:", err.message);
                return res.status(500).send({
                    success: false,
                    message: "Failed to check cashbook.",
                });
            }

            if (cashbookResult.length === 0) {
                // Insert new cashbook entry if not found
                const insertCashbookQuery = `
                    INSERT INTO tbl_cashbook (id, customer_id, order_id, allocated, receipt)
                    VALUES (?, ?, ?, ?, ?)
                `;

                con.query(insertCashbookQuery, [cashbook_id, customer_id, order_id, "Yes", receipt], (err) => {
                    if (err) {
                        console.error("Error inserting cashbook:", err.message);
                        return res.status(500).send({
                            success: false,
                            message: "Failed to insert cashbook.",
                        });
                    }

                    return res.status(200).send({
                        success: true,
                        message: "New cashbook entry created successfully.",
                    });
                });
            } else {
                // Update existing cashbook
                let updateQuery = "UPDATE tbl_cashbook SET ";
                const updateFields = [];
                const updateParams = [];



                if (customer_id) {
                    updateFields.push("customer_id = ?");
                    updateParams.push(customer_id);
                }
                if (order_id) {
                    updateFields.push("order_id = ?");
                    updateParams.push(order_id);

                    updateFields.push("allocated = ?");
                    updateParams.push("Yes");
                }

                updateParams.push(cashbook_id);

                if (updateFields.length === 0) {
                    return res.status(400).send({
                        success: false,
                        message: "No fields provided for update.",
                    });
                }

                updateQuery += updateFields.join(", ") + " WHERE id = ?";

                con.query(updateQuery, updateParams, (err, result) => {
                    if (err) {
                        console.error("Error updating cashbook:", err.message);
                        return res.status(500).send({
                            success: false,
                            message: "Failed to update cashbook.",
                        });
                    }

                    if (!order_id) {
                        return res.status(200).send({
                            success: true,
                            message: "Cashbook updated successfully.",
                        });
                    }

                    // Step 1: Get total receipt for this order_id
                    const fetchReceiptsQuery = `SELECT SUM(receipt) AS total_receipt FROM tbl_cashbook WHERE order_id = ?`;
                    con.query(fetchReceiptsQuery, [order_id], (err, receiptResult) => {
                        if (err) {
                            console.error("Error fetching receipt total:", err.message);
                            return res.status(500).send({
                                success: false,
                                message: "Failed to fetch receipt total.",
                            });
                        }

                        const totalReceipt = receiptResult[0]?.total_receipt || 0;

                        // Step 2: Check if an invoice exists for this order_id
                        const checkInvoiceQuery = `SELECT * FROM tbl_invoices WHERE order_id = ?`;
                        con.query(checkInvoiceQuery, [order_id], (err, invoiceResult) => {
                            if (err) {
                                console.error("Error checking invoice:", err.message);
                                return res.status(500).send({
                                    success: false,
                                    message: "Failed to check invoice.",
                                });
                            }

                            if (invoiceResult.length > 0) {
                                // Step 3A: Update existing invoice
                                const updatePaymentQuery = `
                                    UPDATE tbl_invoices
                                    SET 
                                        payment = ?,
                                        status = ?
                                    WHERE order_id = ?
                                `;

                                con.query(updatePaymentQuery, [totalReceipt, "Part Paid", order_id], (err) => {
                                    if (err) {
                                        console.error("Error updating payment:", err.message);
                                        return res.status(500).send({
                                            success: false,
                                            message: "Failed to update payment.",
                                        });
                                    }

                                    // Fetch updated invoice details
                                    const selectInvoiceQuery = `SELECT invoice_amt, payment FROM tbl_invoices WHERE order_id = ?`;
                                    con.query(selectInvoiceQuery, [order_id], (err, invoiceDetails) => {
                                        if (err) {
                                            console.error("Error fetching invoice:", err.message);
                                            return res.status(500).send({
                                                success: false,
                                                message: "Failed to fetch invoice details.",
                                            });
                                        }

                                        const { invoice_amt, payment } = invoiceDetails[0];
                                        const finalBalance = invoice_amt ? invoice_amt - payment : 0;

                                        // Step 4A: Update balance in tbl_invoices
                                        const updateBalanceQuery = `
                                            UPDATE tbl_invoices
                                            SET balance = ?
                                            WHERE order_id = ?
                                        `;

                                        con.query(updateBalanceQuery, [finalBalance, order_id], (err) => {
                                            if (err) {
                                                console.error("Error updating invoice balance:", err.message);
                                                return res.status(500).send({
                                                    success: false,
                                                    message: "Failed to update invoice balance.",
                                                });
                                            }

                                            return res.status(200).send({
                                                success: true,
                                                message: "Invoice updated successfully.",
                                            });
                                        });
                                    });
                                });
                            } else {
                                // Step 3B: Insert new invoice
                                const insertInvoiceQuery = `
                                    INSERT INTO tbl_invoices (order_id, payment, status, balance)
                                    VALUES (?, ?, ?, ?)
                                `;

                                con.query(insertInvoiceQuery, [order_id, totalReceipt, "Part Paid", 0], (err) => {
                                    if (err) {
                                        console.error("Error inserting invoice:", err.message);
                                        return res.status(500).send({
                                            success: false,
                                            message: "Failed to insert invoice.",
                                        });
                                    }

                                    return res.status(200).send({
                                        success: true,
                                        message: "New invoice created successfully.",
                                    });
                                });
                            }
                        });
                    });
                });
            }
        });
    } catch (error) {
        console.error("Unexpected error:", error.message);
        return res.status(500).send({
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
                tbl_users.full_name as client_name
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

const GetRealeseDashboard = async (req, res) => {
    try {
        const paymentQuery = `SELECT i.*, tbl_users.full_name as order_user_name, CONCAT('OR000', o.id) AS order_number, r.id as realese_id, r.cargo_inspection, r.release_instruction, r.Status as release_status, o.track_status as order_status, c.order_status as clearance_status, s.customer_name as sage_customer_name, s.document_number as sage_document_number, s.customer_ref as sage_customer_ref, s.date as sage_date, s.total as sage_total FROM tbl_invoices as i 
        INNER JOIN sage_invoice_list as s on s.id=i.sage_invoice_id
        LEFT JOIN clearance_order as c on c.order_id=i.order_id
        INNER JOIN tbl_orders as o on o.id=i.order_id
        LEFT JOIN realese_dashboard as r on r.invoice_id=i.id
        LEFT JOIN tbl_users ON tbl_users.id = o.client_id`;
        con.query(paymentQuery, (err, paymentResult) => {
            if (err) {
                console.error("Error fetching existing payment:", err.message);
                return res.status(500).send({
                    success: false,
                    message: err.message
                });
            }
            return res.status(200).send({
                success: true,
                message: "Successfully",
                data: paymentResult
            });
        })
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: error.message,
        });
    }
}

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

module.exports = {
    AddInvoiceDetails, ADDcashbook, GetClientAllInvoice, GetAllFreightDocs, GetByIDAllFreightDocs, AddFreightDoc, UpdateSageInvoiceDoc,
    GetRealeseDashboard, ManageRealeseDashboard
}