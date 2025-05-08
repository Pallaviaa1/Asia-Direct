const con = require('../config/database');
const { validationResult, Result } = require('express-validator');
const sendMail = require('../helpers/sendMail')
const rendomString = require('randomstring');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const ChangeStatusClearance = async (req, res) => {
    try {
        const { clearance_id, status } = req.body;
        if (!clearance_id || !status) {
            return res.status(400).send({
                success: false,
                message: "Please provide both clearance id and status value"
            });
        }

        const selectQuery = `SELECT quotation_status, clearance_number, user_id FROM tbl_clearance WHERE id=?`;
        await con.query(selectQuery, [clearance_id], async (err, data) => {
            if (err) throw err;

            if (data.length == 0) {
                return res.status(400).send({
                    success: false,
                    message: "Clearance id doesn't exist"
                });
            }

            const currentStatus = data[0].quotation_status;
            if (currentStatus == status) {
                const message = status == 1 ? "Accepted" : "Declined";
                return res.status(400).send({
                    success: false,
                    message: `Clearance is already ${message}`
                });
            }

            const updateQuery = `UPDATE tbl_clearance SET quotation_status=? WHERE id=?`;
            await con.query(updateQuery, [status, clearance_id], async (err, result) => {
                if (err) throw err;

                if (result.affectedRows > 0) {
                    const statusMessage = status == 1 ? "Accepted" : "Declined";
                    const notificationTitle = `Your Clearance ${statusMessage}`;
                    const notificationDescription = `Clearance Number ${data[0].clearance_number} has been ${statusMessage.toLowerCase()}.`;

                    const insertNotificationQuery = `INSERT INTO tbl_notifications (title, description, send_to) VALUES (?, ?, ?)`;
                    await con.query(insertNotificationQuery, [notificationTitle, notificationDescription, 4], async (err, notificationData) => {
                        if (err) throw err;
                        const insertNotificationDetailQuery = `INSERT INTO notification_details (user_id, notification_id) VALUES (?,?)`;

                        await con.query(insertNotificationDetailQuery, [data[0].user_id, notificationData.insertId], (err) => {
                            if (err) throw err;
                        });

                    });

                    const message = status == 1 ? "accepted" : "declined";
                    return res.status(200).send({
                        success: true,
                        message: `Clearance ${message} successfully`
                    });
                } else {
                    return res.status(400).send({
                        success: false,
                        message: `Failed to update clearance status`
                    });
                }
            });
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
};



const AcceptClearanceQuotation = async (req, res) => {
    try {
        const { clearance_id, user_id } = req.body;
        if (!clearance_id || !user_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide clearance id or user id"
            })
        }

        await con.query(`select * from tbl_clearance where id='${clearance_id}'`, (err, order_status) => {
            if (err) throw err;
            if (order_status.length > 0) {
                if (order_status[0].quotation_status == 0) {
                    con.query(`update tbl_clearance set quotation_status='${1}' where id='${clearance_id}'`, (err, data) => {
                        if (err) throw err;
                        if (data.affectedRows > 0) {
                            con.query('INSERT INTO tbl_orders (clearance_id, client_id) VALUES (?, ?)', [clearance_id, user_id], (err, result) => {
                                if (err) throw err;
                                const InsertQuery = `insert into tbl_notifications (title, description, send_to) values (?,?,?)`;
                                con.query(InsertQuery, ["New Order of Custom Clearance Received!", `Dear Admin, User has submitted a new order with Clearance Number: ${order_status[0].clearance_number}. Please review the clearance details and proceed accordingly.`, 5], (err, data) => {
                                    if (err) throw err;
                                    con.query(`select id from tbl_users where user_type='${1}'`, (err, id) => {
                                        if (err) throw err;
                                        const insertNotificationSql = 'INSERT INTO notification_details (user_id, notification_id) VALUES (?, ?)';
                                        con.query(insertNotificationSql, [id[0].id, data.insertId], (err, result) => {
                                            if (err) throw err;
                                        });
                                    })
                                })
                                // console.log(result.affectedRows);
                                // Handle the result or perform any other necessary actions.
                            });

                            res.status(200).send({
                                success: true,
                                message: "Accept clearance quotation successfully"
                            })
                        }
                        else {
                            res.status(400).send({
                                success: false,
                                message: "Failed to Accept clearance quotation"
                            })
                        }
                    })
                }
                else if (order_status[0].quotation_status == 2) {
                    res.status(400).send({
                        success: false,
                        message: "Clearance quotation is already decliend"
                    })
                }
                else {
                    res.status(400).send({
                        success: false,
                        message: "Clearance quotation is already accepted"
                    })
                }
            }
            else {
                res.status(400).send({
                    success: false,
                    message: "Clearance id doesn't exist"
                })
            }
        })

    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        })
    }
}

const RejectClearanceQuotation = async (req, res) => {
    try {
        const { clearance_id, user_id } = req.body;
        if (!clearance_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide clearance id"
            })
        }
        await con.query(`select * from tbl_clearance where id='${clearance_id}'`, (err, order_status) => {
            if (err) throw err;
            if (order_status.length > 0) {
                // console.log(order_status[0]);
                if (order_status[0].quotation_status == 0) {
                    con.query(`update tbl_clearance set quotation_status='${2}' where id='${clearance_id}'`, (err, data) => {
                        if (err) throw err;
                        if (data.affectedRows > 0) {
                            /* con.query('INSERT INTO tbl_orders (freight_id, user_id) VALUES (?, ?)', [freight_id, user_id], (err, result) => {
                                if (err) throw err;
                                // Handle the result or perform any other necessary actions.
                            }); */
                            const InsertQuery = `insert into tbl_notifications (title, description, send_to) values (?,?,?)`;
                            con.query(InsertQuery, ["Clearance Quotation Rejected", `Dear Admin, User has declined the final quotation for Clearance Number: ${order_status[0].clearance_number}. Please review the details and take necessary action`, 5], (err, data) => {
                                if (err) throw err;
                                con.query(`select id from tbl_users where user_type='${1}'`, (err, id) => {
                                    if (err) throw err;
                                    const insertNotificationSql = 'INSERT INTO notification_details (user_id, notification_id) VALUES (?, ?)';
                                    con.query(insertNotificationSql, [id[0].id, data.insertId], (err, result) => {
                                        if (err) throw err;
                                    });
                                })
                            })
                            res.status(200).send({
                                success: true,
                                message: "Reject clearance quotation successfully"
                            })
                        }
                        else {
                            res.status(400).send({
                                success: false,
                                message: "Failed to Reject clearance quotation"
                            })
                        }
                    })
                }
                else if (order_status[0].quotation_status == 1) {
                    res.status(400).send({
                        success: false,
                        message: "Clearance quotation is already accepted"
                    })
                }
                else {
                    res.status(400).send({
                        success: false,
                        message: "Clearance quotation is already rejected"
                    })
                }
            }
            else {
                res.status(400).send({
                    success: false,
                    message: "Clearance id doesn't exist"
                })
            }
        })

    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        })
    }
}

const calculateEstimateClearance = async (req, res) => {
    try {
        const { data } = req.body;
        if (!Array.isArray(data) || data.length === 0) {
            return res.status(400).send({ success: false, message: "Please provide valid data array" });
        }

        let processed = 0;

        for (let record of data) {
            const {
                id,
                clearance_id,
                client_id,
                quoted_rate,
                HS_tariff_code,
                HS_description,
                goods_value,
                values_of_good,
                import_duty_per,
                vat_per,
                import_duty,
                vat,
                customs_amount_due,
                total_amount
            } = record;

            const selectQuery = `SELECT id FROM estimate_clearance WHERE id=?`;
            con.query(selectQuery, [id], (err, existing) => {
                if (err) return res.status(500).send({ success: false, message: err.message });

                if (existing.length > 0) {
                    // UPDATE existing
                    const updateQuery = `
                        UPDATE estimate_clearance SET  
                            quoted_rate=?, 
                            HS_tariff_code=?, 
                            HS_description=?, 
                            goods_value=?,
                            values_of_good=?, 
                            import_duty_per=?,
                            vat_per=?, 
                            import_duty=?, 
                            vat=?, 
                            customs_amount_due=?,
                            total_amount=?
                        WHERE id=?`;

                    const updateValues = [
                        quoted_rate,
                        HS_tariff_code,
                        HS_description,
                        goods_value,
                        values_of_good,
                        import_duty_per,
                        vat_per,
                        import_duty,
                        vat,
                        customs_amount_due,
                        total_amount,
                        id
                    ];

                    con.query(updateQuery, updateValues, (err) => {
                        if (err) return res.status(500).send({ success: false, message: err.message });

                        // Update total in tbl_clearance
                        const updateClearance = `UPDATE tbl_clearance SET total_amount=? WHERE id=?`;
                        con.query(updateClearance, [total_amount, clearance_id], (err) => {
                            if (err) return res.status(500).send({ success: false, message: err.message });
                            processed++;
                            if (processed === data.length) {
                                return res.status(200).send({ success: true, message: "Processed all records" });
                            }
                        });
                    });
                } else {
                    // Check count
                    const countQuery = `SELECT COUNT(*) AS total FROM estimate_clearance WHERE clearance_id = ?`;
                    con.query(countQuery, [clearance_id], (err, result) => {
                        if (err) return res.status(500).send({ success: false, message: err.message });

                        const quotationCount = result[0]?.total || 0;
                        if (quotationCount >= 3) {
                            return res.status(400).send({ success: false, message: "Quotation limit reached for this clearance" });
                        }

                        const insertQuery = `INSERT INTO estimate_clearance 
                            (clearance_id, client_id, quoted_rate, HS_tariff_code, HS_description, goods_value, values_of_good, import_duty_per, vat_per, import_duty, vat, customs_amount_due, total_amount) 
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

                        const insertValues = [
                            clearance_id,
                            client_id,
                            quoted_rate,
                            HS_tariff_code,
                            HS_description,
                            goods_value,
                            values_of_good,
                            import_duty_per,
                            vat_per,
                            import_duty,
                            vat,
                            customs_amount_due,
                            total_amount
                        ];

                        con.query(insertQuery, insertValues, (err) => {
                            if (err) return res.status(500).send({ success: false, message: err.message });

                            // Update total in tbl_clearance
                            const updateClearance = `UPDATE tbl_clearance SET total_amount=? WHERE id=?`;
                            con.query(updateClearance, [total_amount, clearance_id], (err) => {
                                if (err) return res.status(500).send({ success: false, message: err.message });
                                processed++;
                                if (processed === data.length) {
                                    return res.status(200).send({ success: true, message: "Processed all records" });
                                }
                            });
                        });
                    });
                }
            });
        }
    } catch (error) {
        return res.status(500).send({ success: false, message: error.message });
    }
};

const calculateEditEstimateClearance = async (req, res) => {
    try {
        const data = req.body;
        console.log(req.body);
        console.log(data);


        // If data is not an object, return error
        if (!data || typeof data !== "object") {
            return res.status(400).send({ success: false, message: "Please provide valid data object" });
        }

        const {
            id,
            clearance_id,
            client_id,
            quoted_rate,
            HS_tariff_code,
            HS_description,
            goods_value,
            values_of_good,
            import_duty_per,
            vat_per,
            import_duty,
            vat,
            customs_amount_due,
            total_amount
        } = data;

        const selectQuery = `SELECT id FROM estimate_clearance WHERE id=?`;
        con.query(selectQuery, [id], async (err, rows) => {
            if (err) throw err;

            if (rows.length > 0) {
                // Update existing estimate_clearance
                const updateQuery = `
                    UPDATE estimate_clearance SET  
                        quoted_rate=?, 
                        HS_tariff_code=?, 
                        HS_description=?, 
                        goods_value=?,
                        values_of_good=?, 
                        import_duty_per=?,
                        vat_per=?, 
                        import_duty=?, 
                        vat=?, 
                        customs_amount_due=?,
                        total_amount=?
                    WHERE id=?`;

                const updateValues = [
                    quoted_rate,
                    HS_tariff_code,
                    HS_description,
                    goods_value,
                    values_of_good,
                    import_duty_per,
                    vat_per,
                    import_duty,
                    vat,
                    customs_amount_due,
                    total_amount,
                    id
                ];

                con.query(updateQuery, updateValues, (err) => {
                    if (err) throw err;
                });
            } else {
                // Insert new estimate_clearance
                const insertQuery = `INSERT INTO estimate_clearance 
                    (clearance_id, client_id, quoted_rate, HS_tariff_code, HS_description, goods_value, values_of_good, import_duty_per, vat_per, import_duty, vat, customs_amount_due, total_amount) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

                const insertValues = [
                    clearance_id,
                    client_id,
                    quoted_rate,
                    HS_tariff_code,
                    HS_description,
                    goods_value,
                    values_of_good,
                    import_duty_per,
                    vat_per,
                    import_duty,
                    vat,
                    customs_amount_due,
                    total_amount
                ];

                con.query(insertQuery, insertValues, (err) => {
                    if (err) throw err;
                });
            }

            // Update tbl_clearance with total amount
            const updateClearanceQuery = `UPDATE tbl_clearance SET total_amount=? WHERE id=?`;
            con.query(updateClearanceQuery, [total_amount, clearance_id], (err, result) => {
                if (err) throw err;

                if (result.affectedRows > 0) {
                    console.log("Updated tbl_clearance successfully");
                } else {
                    console.log("Failed to update tbl_clearance");
                }

                return res.status(200).send({ success: true, message: "Processed successfully" });
            });
        });
    } catch (error) {
        res.status(500).send({ success: false, message: error.message });
    }
};


const getCalculateEstClearance = async (req, res) => {
    try {
        const { clearance_id } = req.body;
        if (!clearance_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide clearance id"
            })
        }
        await con.query(`select * from estimate_clearance where clearance_id='${clearance_id}'`, (err, data) => {
            if (err) throw err;
            if (data.length > 0) {
                res.status(200).send({
                    success: true,
                    data: data
                })
            }
            else {
                res.status(400).send({
                    success: false,
                    message: "Data not found"
                })
            }
        })
    }
    catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        })
    }
}


const calculateClearanceByAdmin = async (req, res) => {
    try {
        //const { clearance_id, client_id } = req.body;
        const { clearance_id, import_vat, customs_duty, agency_surcharge, disbursement_fee, customs_clearing_fee, document_fee, final_amount } = req.body;

        console.log(req.body);
        const updateQuery = `UPDATE estimate_clearance SET  
        import_vat=?, customs_duty=?, agency_surcharge=?, disbursement_fee=?, customs_clearing_fee=?, document_fee=?, final_amount=?
        WHERE clearance_id=?`;

        const updateValues = [
            import_vat, customs_duty, agency_surcharge, disbursement_fee, customs_clearing_fee, document_fee, final_amount,
            clearance_id
        ];

        await con.query(updateQuery, updateValues, (err, result) => {
            if (err) throw err;


        });

        const update = `UPDATE tbl_clearance SET  
        total_amount=?,
        calculated_by_admin=?,
        quotation_status=?
        WHERE id=?`;

        const updateValue = [
            final_amount,
            1,
            "4",
            clearance_id
        ];

        await con.query(update, updateValue, (err, result) => {
            if (err) throw err;

            res.status(200).send({ success: true, message: "Calculate success" });
        });

    } catch (error) {
        res.status(500).send({ success: false, message: error.message });
    }
};
const deleteEstimateClearance = async (req, res) => {
    try {
        const { id } = req.body;

        if (!id) {
            return res.status(400).send({ success: false, message: "Quotation ID is required" });
        }

        const selectQuery = `SELECT * FROM estimate_clearance WHERE id = ?`;
        con.query(selectQuery, [id], (err, result) => {
            if (err) return res.status(500).send({ success: false, message: err.message });

            if (result.length === 0) {
                return res.status(404).send({ success: false, message: "Quotation not found" });
            }

            const deleteQuery = `DELETE FROM estimate_clearance WHERE id = ?`;
            con.query(deleteQuery, [id], (err) => {
                if (err) return res.status(500).send({ success: false, message: err.message });

                return res.status(200).send({ success: true, message: "Quotation deleted successfully" });
            });
        });

    } catch (error) {
        return res.status(500).send({ success: false, message: error.message });
    }
};

const fieldMapping = {
    'Client Name': 'full_name',
    'Email': 'email',
    'Contact Person': 'contact_person',
    'Cellphone': 'cellphone',
    'Telephone': 'telephone',
    'Address 1': 'address_1',
    'Address 2': 'address_2',
    'City': 'city',
    'Province': 'province',
    'Country': 'country',
    'Code': 'code',
    'Company Reg / ID #': 'company_id',
    'Importers Ref': 'importers_ref',
    'Vat / Tax Ref': 'tax_ref'
};

const getCountryIdByName = async (countryName) => {
    return new Promise((resolve, reject) => {
        con.query('SELECT id FROM countries WHERE LOWER(name) = LOWER(?)', [countryName], (err, rows) => {
            if (err) {
                console.error('Error fetching country ID:', err);
                reject(err);
            } else {
                resolve(rows.length > 0 ? rows[0].id : null);
            }
        });
    });
};

const checkDuplicateUser = async (email, cellphone) => {
    return new Promise((resolve, reject) => {
        const query = 'SELECT id FROM tbl_users WHERE email = ? OR cellphone = ?';
        con.query(query, [email, cellphone], (err, results) => {
            if (err) {
                console.error('Error checking duplicate user:', err);
                reject(err);
            } else {
                resolve(results.length > 0);
            }
        });
    });
};

// Validate and transform data
const validateAndTransformData = async (row) => {
    const transformedRow = {};

    for (const [excelField, dbField] of Object.entries(fieldMapping)) {
        transformedRow[dbField] = row[excelField] !== undefined && row[excelField] !== null ? row[excelField] : '';
    }

    transformedRow.country = await getCountryIdByName(transformedRow.country) || 0;
    transformedRow.user_type = "3"; // Static value for user type

    return transformedRow;
};

const UploadExcelClient = async (req, res) => {
    const file = req.file;
    if (!file) {
        return res.status(400).send({ success: false, message: 'No file uploaded' });
    }

    const workbook = XLSX.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    try {
        const transformedData = [];

        for (const row of data) {
            try {
                const validatedRow = await validateAndTransformData(row);
                const isDuplicate = await checkDuplicateUser(validatedRow.email, validatedRow.cellphone);

                if (!isDuplicate) {
                    transformedData.push(validatedRow);
                } else {
                    console.log(`Skipping duplicate entry: Email: ${validatedRow.email}, Cellphone: ${validatedRow.cellphone}`);
                }
            } catch (error) {
                console.error('Validation error:', error.message);
            }
        }

        // Insert unique records into database
        for (const row of transformedData) {
            const query = 'INSERT INTO tbl_users SET ?';
            await new Promise((resolve, reject) => {
                con.query(query, row, (error) => {
                    if (error) {
                        console.error('Error inserting data:', error.message, 'Data:', row);
                        reject(error);
                    } else {
                        console.log('Row inserted successfully:', row);
                        resolve();
                    }
                });
            });
        }

        // Update file tracking in All_Upload_Excel
        const checkFileQuery = `SELECT * FROM All_Upload_Excel WHERE file_type = "Client_Excel"`;
        const existingFile = await new Promise((resolve, reject) => {
            con.query(checkFileQuery, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        if (existingFile.length === 0) {
            const insertFileQuery = 'INSERT INTO All_Upload_Excel (file, file_type) VALUES (?, ?)';
            await new Promise((resolve, reject) => {
                con.query(insertFileQuery, [req.file.filename, "Client_Excel"], (error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });
        } else {
            const updateFileQuery = 'UPDATE All_Upload_Excel SET file = ? WHERE file_type = "Client_Excel"';
            await new Promise((resolve, reject) => {
                con.query(updateFileQuery, [req.file.filename], (error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });
        }

        fs.unlink(file.path, (err) => {
            if (err) console.error('Error deleting file', err);
        });

        res.send({ success: true, message: 'File uploaded and data inserted', insertedRecords: transformedData.length });
    } catch (error) {
        res.status(500).send({ success: false, message: error.message });
    }
};


module.exports = {
    ChangeStatusClearance, AcceptClearanceQuotation, RejectClearanceQuotation,
    calculateEstimateClearance, getCalculateEstClearance, calculateClearanceByAdmin, UploadExcelClient, calculateEditEstimateClearance, deleteEstimateClearance
}
