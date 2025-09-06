const con = require('../config/database');
const { validationResult, Result } = require('express-validator');
const bcrypt = require('bcryptjs');
const rendomString = require('randomstring');
const sendMail = require('../helpers/sendMail')
const { findOrCreateFolder, uploadFile, uploadToSpecificPath, findFolderId, deleteFolderByName } = require('../helpers/uploadDrive');
const { SMTP_MAIL, SMTP_PASSWORD } = process.env;
const { sendSms, sendWhatsApp } = require('../helpers/twilioService');
const cron = require('node-cron');

async function hashPassword(password) {
    return await bcrypt.hash(password, 10);
}

const nestedFolderStructure = {
    "Clearing Documents": [
        "Customs Documents",
        "Supporting Documents"
    ],
    "Freight documents": [
        "Waybills",
        "Warehouse Entry Docs",
        "Supplier Invoices"
    ],
    "Supplier Invoices": [
        "Invoice, Packing List",
        "Product Literature",
        "Letters of authority"
    ],
    "Quotations": [
        "AD_ Invoice",
        "AD_Quotations"
    ],
    "Proof of Delivery": [
        "Delivery note",
        "Courier Waybills"
    ]
};

const getMainFolderForDoc = (docName) => {
    for (const [mainFolder, subFolders] of Object.entries(nestedFolderStructure)) {
        if (subFolders.includes(docName)) return mainFolder;
    }
    return null; // not found
};

// Upload file to matching subfolder
const uploadToMatchingFolder = async (file, documentName, freightNumber) => {
    // Map document to main folder type
    const mainFolderName = getMainFolderForDoc(documentName);
    if (!mainFolderName) {
        console.log(`Document name "${documentName}" does not match any known subfolder. Upload skipped.`);
        return null;
    }

    // Find the main freight folder by freightNumber
    const freightFolderId = await findFolderId(freightNumber);
    if (!freightFolderId) {
        console.log(`Freight folder "${freightNumber}" not found. Upload skipped.`);
        return null;
    }

    // Find main folder inside the freight folder
    const mainFolderId = await findFolderId(mainFolderName, freightFolderId);
    if (!mainFolderId) {
        console.log(`Main folder "${mainFolderName}" not found inside "${freightNumber}". Upload skipped.`);
        return null;
    }

    // Find subfolder inside the main folder
    const subFolderId = await findFolderId(documentName, mainFolderId);
    if (!subFolderId) {
        console.log(`Subfolder "${documentName}" not found inside "${mainFolderName}". Upload skipped.`);
        return null;
    }

    // Upload file to the subfolder
    const result = await uploadFile(subFolderId, file);
    console.log(`Uploaded ${file.originalname} to ${freightNumber}/${mainFolderName}/${documentName}`);
    return result;
};


const AddCustomer = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    try {
        const { client_name, email, client_ref, contact_person,
            cellphone, telephone, address_1, address_2, city, province, country, code, company_id, importers_ref, tax_ref, password } = req.body;
        var encrypassword = await hashPassword(password);
        await con.query(`select * from tbl_users where email='${email}' and is_deleted='${0}' and user_type='${3}'`, (err, result) => {
            if (err) throw err;
            if (result.length > 0) {
                res.status(400).send({
                    success: false,
                    message: "Email is already exists !"
                })
            }
            else {
                con.query(`select telephone from tbl_users where telephone='${telephone}' and is_deleted='${0}'`, (err, result1) => {
                    if (err) throw err;
                    if (result1.length > 0) {
                        res.status(400).send({
                            success: false,
                            message: "telephone number is already exists !"
                        })
                    }
                    else {
                        const insertQuery = `INSERT INTO tbl_users (full_name, email, client_ref, contact_person, cellphone,
                            telephone, address_1, address_2, city, province, country, code, company_id, importers_ref, tax_ref, user_type, password)
                            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                        con.query(insertQuery, [client_name, email, client_ref, contact_person, cellphone,
                            telephone, address_1, address_2, city, province, country, code, company_id, importers_ref, tax_ref, 3, encrypassword], (err, insertdata) => {
                                if (err) throw err;
                                if (insertdata.affectedRows > 0) {

                                    /* const Email = SMTP_MAIL;
                                    const mailSubject = 'New User Registered';
                                    const content = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; background-color: #f9f9f9;">
    <h2 style="color: #2c3e50; border-bottom: 1px solid #ccc; padding-bottom: 10px;">New User Registered</h2>

    <p style="font-size: 16px; color: #333;">
      Hey Sales, let's welcome <strong>${client_name}</strong> who has just created a new profile and let's give them an awesome experience.
    </p>

    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">

    <p style="font-size: 14px; color: #777;">
      Regards,<br>
      <strong>Management System</strong>
    </p>
  </div>
`;

                                    sendMail(Email, mailSubject, content); */

                                    res.status(200).send({
                                        success: true,
                                        message: "Add client successfully"
                                    })
                                }
                                else {
                                    res.status(400).send({
                                        success: false,
                                        message: "failed to add client"
                                    })
                                }
                            })
                    }
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

const GetClientList = async (req, res) => {
    try {
        const selectQuery = `SELECT tbl_users.*, countries.name as country_name  
FROM tbl_users 
LEFT JOIN countries ON countries.id = tbl_users.country
WHERE tbl_users.user_type = ? AND tbl_users.is_deleted = ?  
ORDER BY tbl_users.full_name ASC;
`;
        await con.query(selectQuery, [3, 0], (err, data) => {
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
                    message: "No List Available"
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

const Get_ClientList = async (req, res) => {
    try {
        const { search = "", page = 1, limit = 10 } = req.body;
        const offset = (page - 1) * limit;

        let whereClause = `WHERE tbl_users.user_type = 3 AND tbl_users.is_deleted = 0`;

        // Add search condition if present
        if (search.trim()) {
            const s = search.trim();
            whereClause += ` AND (
                    tbl_users.full_name LIKE '%${s}%' OR
                    tbl_users.email LIKE '%${s}%' OR
                    tbl_users.cellphone LIKE '%${s}%' OR
                    tbl_users.telephone LIKE '%${s}%'
                )`;
        }

        // Query to get total count
        const countQuery = `SELECT COUNT(*) AS total FROM tbl_users ${whereClause}`;
        con.query(countQuery, (countErr, countResult) => {
            if (countErr) {
                throw countErr;
            }

            const total = countResult[0].total;
            const totalPages = Math.ceil(total / limit);

            // Query to get paginated result
            const selectQuery = `
                    SELECT tbl_users.*, countries.name as country_name  
                    FROM tbl_users 
                    LEFT JOIN countries ON countries.id = tbl_users.country
                    ${whereClause}
                    ORDER BY tbl_users.full_name ASC
                    LIMIT ${limit} OFFSET ${offset}
                `;

            con.query(selectQuery, (err, data) => {
                if (err) throw err;

                res.status(200).send({
                    success: true,
                    currentPage: parseInt(page),
                    totalPages: totalPages,
                    totalRecords: total,
                    data: data
                });
            });
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
};


const updateClient = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    try {
        const { client_id, client_name, email, client_ref, contact_person,
            cellphone, telephone, address_1, address_2, city, province, country, code, company_id, importers_ref, tax_ref } = req.body;
        let sql = "Select * from tbl_users where (email = ? OR telephone = ?) AND id <> ? AND is_deleted=?";
        await con.query(sql, [email, telephone, client_id, 0], (err, data) => {
            if (err) throw err;
            if (data.length > 0) {
                res.status(400).send({
                    success: false,
                    message: "Email or phone number already exists !"
                })
            }
            else {
                const updateQuery = `update tbl_users set full_name=?, email=?, client_ref=?, contact_person=?, cellphone=?, 
                    telephone=?, address_1=?, address_2=?, city=?, province=?, country=?, code=?, company_id=?, importers_ref=?, tax_ref=? where id=?`;
                con.query(updateQuery, [client_name, email, client_ref, contact_person,
                    cellphone, telephone, address_1, address_2, city, province, country, code, company_id, importers_ref, tax_ref, client_id], (err, updateData) => {
                        if (err) throw err;
                        if (updateData.affectedRows > 0) {
                            res.status(200).send({
                                success: true,
                            })
                        }
                        else {
                            res.status(400).send({
                                success: false,
                                message: "Failed to update Details"
                            })
                        }
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

const GetClientById = async (req, res) => {
    try {
        const { client_id } = req.body;
        if (!client_id) {
            res.status(400).send({
                success: false,
                message: "Please provide client id"
            })
        }
        else {
            const selectQuery = `SELECT tbl_users.*, countries.name AS country_name
FROM tbl_users
LEFT JOIN countries ON countries.id = tbl_users.country
WHERE tbl_users.id = ?
`;
            await con.query(selectQuery, [client_id], (err, data) => {
                if (err) throw err;
                if (data.length > 0) {
                    res.status(200).send({
                        success: true,
                        message: "",
                        data: data[0]
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
    }
    catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        })
    }
}

const DeleteClient = async (req, res) => {
    try {
        const { client_id } = req.body;
        if (!client_id) {
            res.status(400).send({
                success: false,
                message: "Please enter client id"
            })
        }
        else {
            const selectQuery = `select is_deleted from tbl_users where id=?`;
            await con.query(selectQuery, [client_id], (err, result) => {
                if (err) throw err;
                if (result.length > 0) {
                    if (result[0].is_deleted == 1) {
                        res.status(400).send({
                            success: false,
                            message: "Client already deleted"
                        })
                    }
                    else {
                        const updateQuery = `update tbl_users set is_deleted=? where id=?`;
                        con.query(updateQuery, [1, client_id], (err, data) => {
                            if (err) throw err;
                            if (data.affectedRows > 0) {
                                res.status(200).send({
                                    success: true,
                                    message: "Client deleted successfully"
                                })
                            }
                            else {
                                res.status(400).send({
                                    success: false,
                                    message: "Failed to delete client"
                                })
                            }
                        })
                    }
                }
                else {
                    res.status(400).send({
                        success: false,
                        message: "Data not found"
                    })
                }
            })

        }
    }
    catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        })
    }
}

/* const GetClientFreights = async (req, res) => {
    try {
        const { user_id, status } = req.body;

        if (!user_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide user id"
            });
        }

        const getUserQuery = `SELECT * FROM tbl_users WHERE id = ?`;

        con.query(getUserQuery, [user_id], async (err, result) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: err.message
                });
            }

            if (result.length === 0) {
                return res.status(400).send({
                    success: false,
                    message: "User id does not exist"
                });
            }

            let condition = 'WHERE tbl_freight.client_id = ? AND tbl_freight.is_deleted = 0';
            let params = [user_id];

            if (status) {
                condition += ' AND tbl_freight.status = ?';
                params.push(status);
            }

            const selectQuery = `
                SELECT tbl_freight.*, cm.name as commodity_name,
                       tbl_users.full_name AS client_name, 
                       tbl_users.profile,  tbl_users.email,  tbl_users.client_ref,  tbl_users.contact_person,  tbl_users.cellphone, 
                       tbl_users.telephone,  tbl_users.address_1,  tbl_users.address_2,  tbl_users.city,  tbl_users.province, 
                       tbl_users.country,  tbl_users.code,  tbl_users.company_id,  tbl_users.importers_ref,  tbl_users.tax_ref, 
                       c.name AS collection_from_country, c.flag_url as flag_url_f,
                       co.name AS delivery_to_country, co.flag_url as flag_url_d,
                       u.full_name AS shipment_ref_name
                FROM tbl_freight 
                INNER JOIN tbl_users ON tbl_users.id = tbl_freight.client_id
                LEFT JOIN countries AS c ON c.id = tbl_freight.collection_from
                LEFT JOIN countries AS co ON co.id = tbl_freight.delivery_to
                LEFT JOIN tbl_users AS u ON u.id = tbl_freight.shipment_ref
                LEFT JOIN tbl_commodity  AS cm ON cm.id = tbl_freight.commodity
                ${condition}
                ORDER BY tbl_freight.created_at DESC`;

            try {
                const data = await new Promise((resolve, reject) => {
                    con.query(selectQuery, params, (err, data) => {
                        if (err) reject(err);
                        else resolve(data);
                    });
                });

                res.status(200).send({
                    success: true,
                    data: data
                });

            } catch (error) {
                res.status(500).send({
                    success: false,
                    message: error.message
                });
            }
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
}; */

const GetClientFreights = async (req, res) => {
    try {
        const { user_id, status, origin, destination, startDate, endDate, freightType, freightSpeed } = req.body;

        if (!user_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide user id"
            });
        }

        const getUserQuery = `SELECT * FROM tbl_users WHERE id = ?`;

        con.query(getUserQuery, [user_id], async (err, result) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: err.message
                });
            }

            if (result.length === 0) {
                return res.status(400).send({
                    success: false,
                    message: "User id does not exist"
                });
            }

            let condition = 'WHERE tbl_freight.client_id = ? AND tbl_freight.is_deleted = 0';
            let params = [user_id];

            if (status) {
                condition += ' AND tbl_freight.status = ?';
                params.push(status);
            }

            if (origin) {
                condition += ' AND tbl_freight.collection_from = ?';
                params.push(origin);
            }

            if (destination) {
                condition += ' AND tbl_freight.delivery_to = ?';
                params.push(destination);
            }

            if (startDate && endDate) {
                condition += ' AND tbl_freight.date BETWEEN ? AND ?';
                params.push(startDate, endDate);
            }

            if (freightType) {
                condition += ' AND tbl_freight.freight = ?';
                params.push(freightType);
            }

            if (freightSpeed) {
                condition += ' AND tbl_freight.type = ?';
                params.push(freightSpeed);
            }

            const selectQuery = `
                SELECT tbl_freight.*, cm.name as commodity_name,
                       tbl_users.full_name AS client_name, 
                       tbl_users.profile, tbl_users.email, tbl_users.client_ref, tbl_users.contact_person, tbl_users.cellphone, 
                       tbl_users.telephone, tbl_users.address_1, tbl_users.address_2, tbl_users.city, tbl_users.province, 
                       tbl_users.country, tbl_users.code, tbl_users.company_id, tbl_users.importers_ref, tbl_users.tax_ref, 
                       c.name AS collection_from_country, c.flag_url as flag_url_f,
                       co.name AS delivery_to_country, co.flag_url as flag_url_d,
                       u.full_name AS shipment_ref_name
                FROM tbl_freight 
                INNER JOIN tbl_users ON tbl_users.id = tbl_freight.client_id
                LEFT JOIN countries AS c ON c.id = tbl_freight.collection_from
                LEFT JOIN countries AS co ON co.id = tbl_freight.delivery_to
                LEFT JOIN tbl_users AS u ON u.id = tbl_freight.shipment_ref
                LEFT JOIN tbl_commodity AS cm ON cm.id = tbl_freight.commodity
                ${condition}
                ORDER BY tbl_freight.created_at DESC`;

            try {
                const data = await new Promise((resolve, reject) => {
                    con.query(selectQuery, params, (err, data) => {
                        if (err) reject(err);
                        else resolve(data);
                    });
                });

                res.status(200).send({
                    success: true,
                    data: data
                });

            } catch (error) {
                res.status(500).send({
                    success: false,
                    message: error.message
                });
            }
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
};


// const AddClearing = async (req, res) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//         return res.status(400).json({
//             success: false,
//             errors: errors.array()
//         });
//     }

//     try {
//         const {
//             trans_reference, client, customer_ref, goods_desc, destination, port_of_entry, port_of_exit, clearing_agent, clearing_status, clearing_result,
//             document_req, comment_on_docs, sales_representative
//         } = req.body;
//         console.log(req.body);

//         generateClearanceNumber((err, clearanceNumber) => {
//             if (err) {
//                 return res.status(500).json({
//                     success: false,
//                     message: "Internal Server Error"
//                 });
//             }

//             const insertQuery = `INSERT INTO tbl_clearance (trans_reference, client, customer_ref, goods_desc, destination, loading_country, discharge_country, clearing_agent, clearing_status, clearing_result, 
//                 document_req, comment_on_docs, added_by, clearance_number, sales_representative) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
//             const insertParams = [
//                 trans_reference, client, customer_ref, goods_desc, destination, port_of_entry, port_of_exit, clearing_agent, clearing_status, clearing_result,
//                 document_req, comment_on_docs, 1, clearanceNumber, sales_representative
//             ];

//             con.query(insertQuery, insertParams, (err, data) => {
//                 if (err) {
//                     return res.status(500).json({
//                         success: false,
//                         message: "Internal Server Error",
//                         error: err.message
//                     });
//                 }
// /* const documentTypes = [
//                         'packing_list',
//                         'licenses_permit',
//                         'product_literature',
//                         'other_docs'
//                     ]; */
//                 if (data.affectedRows > 0) {
//                     if (req.files && req.files.document) {
//                         const updateQuery = `UPDATE tbl_clearance SET document_upload = ? WHERE id = ?`;
//                         const updateParams = [req.files.document[0].filename, data.insertId];

//                         con.query(updateQuery, updateParams, (updateErr, updateData) => {
//                             if (updateErr) {
//                                 return res.status(500).json({
//                                     success: false,
//                                     message: "Failed to update document"
//                                 });
//                             }
//                             const selectQuery = `SELECT clearance_number FROM tbl_clearance WHERE id = ?`;

//                             con.query(selectQuery, [data.insertId], async (err, result) => {
//                                 if (err) {
//                                     console.error("Error fetching clearance number:", err);
//                                     return;
//                                 }
//                                 let file = req.files.document[0];
//                                 // console.log(file);

//                                 const clearanceNumber = result[0].clearance_number;
//                                 const folderId = await findOrCreateFolder(clearanceNumber);
//                                 console.log(`📂 Folder ID: ${folderId}`);


//                                 const { fileId, webViewLink } = await uploadFile(folderId, file);
//                             })
//                             res.status(200).send({
//                                 success: true,
//                                 message: "Clearance added and document updated successfully"
//                             });
//                         });
//                     } else if (req.files && req.files.packing_list) {
//                         const updateQuery = `UPDATE tbl_clearance SET document_upload = ? WHERE id = ?`;
//                         const updateParams = [req.files.document[0].filename, data.insertId];

//                         con.query(updateQuery, updateParams, (updateErr, updateData) => {
//                             if (updateErr) {
//                                 return res.status(500).json({
//                                     success: false,
//                                     message: "Failed to update document"
//                                 });
//                             }
//                             const selectQuery = `SELECT clearance_number FROM tbl_clearance WHERE id = ?`;

//                             con.query(selectQuery, [data.insertId], async (err, result) => {
//                                 if (err) {
//                                     console.error("Error fetching clearance number:", err);
//                                     return;
//                                 }
//                                 let file = req.files.document[0];
//                                 // console.log(file);

//                                 const clearanceNumber = result[0].clearance_number;
//                                 const folderId = await findOrCreateFolder(clearanceNumber);
//                                 console.log(`📂 Folder ID: ${folderId}`);


//                                 const { fileId, webViewLink } = await uploadFile(folderId, file);
//                             })
//                             res.status(200).send({
//                                 success: true,
//                                 message: "Clearance added and document updated successfully"
//                             });
//                         });
//                     } else {
//                         res.status(200).send({
//                             success: true,
//                             message: "Clearance added successfully"
//                         });
//                     }
//                 } else {
//                     res.status(400).send({
//                         success: false,
//                         message: "Failed to add Clearance"
//                     });
//                 }
//             });
//         });
//     } catch (error) {
//         res.status(500).send({
//             success: false,
//             message: error.message
//         });
//     }
// };
// const generateClearanceNumber = (callback) => {
//     try {
//         // Get the last inserted clearance number
//         con.query(
//             'SELECT clearance_number FROM tbl_clearance ORDER BY id DESC LIMIT 1',
//             (err, rows) => {
//                 if (err) {
//                     callback(err);
//                     return;
//                 }

//                 let sequenceNumber = 1;
//                 const currentDate = new Date();
//                 const year = currentDate.getFullYear();
//                 const month = (currentDate.getMonth() + 1).toString().padStart(2, '0'); // Months are zero-indexed

//                 if (rows.length > 0 && rows[0].clearance_number) {
//                     const lastClearanceNumber = rows[0].clearance_number;
//                     const lastYearMonth = lastClearanceNumber.slice(2, 8); // Extract the year and month (e.g., '202406')
//                     const currentYearMonth = `${year}${month}`;

//                     if (lastYearMonth === currentYearMonth) {
//                         const lastSequencePart = parseInt(lastClearanceNumber.slice(-3)); // Extract last 3 digits
//                         sequenceNumber = lastSequencePart + 1;
//                     }
//                 }

//                 // Format the clearance number as C-YYYYMMNNN
//                 const clearanceNumber = `C-${year}${month}${sequenceNumber.toString().padStart(3, '0')}`;
//                 callback(null, clearanceNumber);
//             }
//         );
//     } catch (error) {
//         // console.error('Error generating clearance number:', error);
//         callback(error);
//     }
// };


const AddClearing = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }

    try {
        const {
            trans_reference, client, customer_ref, goods_desc, destination, port_of_entry, port_of_exit,
            clearing_agent, clearing_status, clearing_result,
            document_req, comment_on_docs, sales_representative
        } = req.body;

        generateClearanceNumber(async (err, clearanceNumber) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "Internal Server Error"
                });
            }

            const insertQuery = `
                INSERT INTO tbl_clearance 
                (trans_reference, client, customer_ref, goods_desc, destination, loading_country, discharge_country,
                clearing_agent, clearing_status, clearing_result, document_req, comment_on_docs, added_by, 
                clearance_number, sales_representative)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const insertParams = [
                trans_reference, client, customer_ref, goods_desc, destination, port_of_entry, port_of_exit,
                clearing_agent, clearing_status, clearing_result,
                document_req, comment_on_docs, 1, clearanceNumber, sales_representative
            ];

            con.query(insertQuery, insertParams, async (err, result) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: "Error inserting clearance",
                        error: err.message
                    });
                }

                const clearanceId = result.insertId;

                // Process uploaded files
                // await handleFileUploads(clearanceId, clearanceNumber, req.files);

                await findOrCreateFolder(clearanceNumber);

                if (req.files && Object.keys(req.files).length > 0) {
                    for (const fieldName of Object.keys(req.files)) {
                        const filesArray = req.files[fieldName];

                        for (const file of filesArray) {
                            const documentName = req.body.documentName; // sent from Postman
                            console.log(documentName);

                            await uploadToMatchingFolder(file, documentName, clearanceNumber);

                            // Save in DB
                            const docQuery = `INSERT INTO clearance_docs (clearance_id, document_name, document_file) 
            VALUES (?, ?, ?)`;
                            await new Promise((resolve, reject) => {
                                con.query(docQuery, [clearanceId, documentName, file.filename], (err) => {
                                    if (err) return reject(err);
                                    resolve();
                                });
                            });
                        }
                    }
                }

                return res.status(200).json({
                    success: true,
                    message: "Clearance added and documents uploaded successfully"
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Unexpected error",
            error: error.message
        });
    }
};

// const handleFileUploads = async (clearanceId, clearanceNumber, files) => {
//     try {
//         if (files) {
//             const fileKeys = Object.keys(files);
//             for (const key of fileKeys) {
//                 const fileArray = Array.isArray(files[key]) ? files[key] : [files[key]];
//                 const documentName = getDocumentName(key);

//                 await processFiles(fileArray, documentName, clearanceId, clearanceNumber);
//             }
//         }
//     } catch (error) {
//         console.error("❌ Error handling file uploads:", error);
//     }
// };

// const processFiles = async (fileArray, documentName, clearanceId, clearanceNumber) => {
//     for (const file of fileArray) {
//         const insertDocQuery = `
//             INSERT INTO clearance_docs (clearance_id, document_name, document_file) 
//             VALUES (?, ?, ?)
//         `;

//         await new Promise((resolve, reject) => {
//             con.query(insertDocQuery, [clearanceId, documentName, file.filename], (err) => {
//                 if (err) {
//                     console.error(`❌ Error inserting ${documentName}:`, err);
//                     return reject(err);
//                 }
//                 resolve();
//             });
//         });

//         console.log(`✅ Saved to DB: ${documentName} - ${file.originalname}`);

//         const subfolderName = getFolderNameFromDocumentName(documentName); // returns "AD_Quotations" etc.

//         const uploadResult = await uploadToSpecificPath(
//             clearanceNumber,     // Main folder: e.g., "F-20250613"
//             "Supplier Invoices",      // Parent folder or fixed main type
//             subfolderName,     // Subfolder based on document type
//             file               // Current file
//         );

//         // Optional: Upload to Google Drive
//         /*
//         const folderId = await findOrCreateFolder(clearanceNumber);
//         const { fileId, webViewLink } = await uploadFile(folderId, file);

//         const insertFileQuery = `
//             INSERT INTO transaction_files 
//             (clearance_number, file_name, drive_file_id, file_link) 
//             VALUES (?, ?, ?, ?)
//         `;

//         await new Promise((resolve, reject) => {
//             con.query(insertFileQuery, [clearanceNumber, file.filename, fileId, webViewLink], (err) => {
//                 if (err) {
//                     console.error("❌ Error inserting file details:", err);
//                     return reject(err);
//                 }
//                 resolve();
//             });
//         });
//         */
//     }
// };

// const getDocumentName = (fieldName) => {
//     switch (fieldName) {
//         case 'document':
//             return "General Document";
//         case 'packing_list':
//             return "Packing List";
//         case 'licenses':
//             return "Licenses/Permit";
//         case 'product_literature':
//             return "Product Literature";
//         case 'other_documents':
//             return "Other Documents";
//         default:
//             return "Unknown Document";
//     }
// };

const getFolderNameFromDocumentName1 = (documentName) => {
    switch (documentName) {
        case 'Supplier Invoices':
            return 'Invoice, Packing List';
        case 'Packing List':
            return 'Invoice, Packing List';
        case 'Licenses':
            return 'Invoice, Packing List';
        case 'Other Documents':
            return 'Invoice, Packing List';
        default:
            return 'Invoice, Packing List';
    }
};

const getFolderNameFromDocumentName = (documentName) => {
    switch (documentName) {
        case 'General Document':
            return 'Invoice, Packing List';
        case 'Packing List':
            return 'Invoice, Packing List';
        case 'Licenses/Permit':
            return 'roduct Literature';
        case 'Product Literature':
            return 'Product Literature';
        case 'Other Documents':
            return 'Invoice, Packing List';
        default:
            return 'Invoice, Packing List';
    }
};


const generateClearanceNumber = (callback) => {
    try {
        // Get the last inserted clearance number
        con.query(
            'SELECT clearance_number FROM tbl_clearance ORDER BY id DESC LIMIT 1',
            (err, rows) => {
                if (err) {
                    callback(err);
                    return;
                }

                let sequenceNumber = 1;
                const currentDate = new Date();
                const year = currentDate.getFullYear();
                const month = (currentDate.getMonth() + 1).toString().padStart(2, '0'); // Months are zero-indexed

                if (rows.length > 0 && rows[0].clearance_number) {
                    const lastClearanceNumber = rows[0].clearance_number;
                    const lastYearMonth = lastClearanceNumber.slice(2, 8); // Extract the year and month (e.g., '202406')
                    const currentYearMonth = `${year}${month}`;

                    if (lastYearMonth === currentYearMonth) {
                        const lastSequencePart = parseInt(lastClearanceNumber.slice(-3)); // Extract last 3 digits
                        sequenceNumber = lastSequencePart + 1;
                    }
                }

                // Format the clearance number as C-YYYYMMNNN
                const clearanceNumber = `C-${year}${month}${sequenceNumber.toString().padStart(3, '0')}`;
                callback(null, clearanceNumber);
            }
        );
    } catch (error) {
        // console.error('Error generating clearance number:', error);
        callback(error);
    }
};
// const AddClearingByCustomer = async (req, res) => {
//     try {
//         const { user_id, client, freight, freight_option, is_Import_Export, is_cong_shipp, customer_ref, goods_desc, nature_of_goods, packing_type, total_dimension, total_box, total_weight, destination, loading_country, discharge_country, port_of_loading, port_of_discharge, comment_on_docs, added_by, document_name } = req.body;
//         // console.log(req.body);
//         if (!user_id) {
//             return res.status(400).send({
//                 success: false,
//                 message: "Please provide user id"
//             });
//         }

//         // Generate the clearance number
//         generateClearanceNumber((err, clearanceNumber) => {
//             if (err) {
//                 // console.error('Error generating clearance number:', err);
//                 return res.status(500).json({
//                     success: false,
//                     message: "Internal Server Error"
//                 });
//             }
//             const addedByValue = added_by || 2;
//             // Prepare insert query based on the presence of document files
//             let insertQuery = `INSERT INTO tbl_clearance (user_id, freight, freight_option, is_Import_Export, is_cong_shipp, customer_ref, goods_desc, nature_of_goods, destination, loading_country, discharge_country, port_of_loading, port_of_discharge, packing_type, total_dimension, total_box, total_weight, comment_on_docs, added_by, clearance_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?,?,?,?,?,?,?,?,?)`;
//             let insertParams = [user_id, freight, freight_option, is_Import_Export, is_cong_shipp, customer_ref || null, goods_desc, nature_of_goods, destination, loading_country, discharge_country, port_of_loading, port_of_discharge, packing_type, total_dimension, total_box, total_weight, comment_on_docs, addedByValue, clearanceNumber];

//             if (req.files && req.files.document) {
//                 insertQuery = `INSERT INTO tbl_clearance (user_id, freight, freight_option, is_Import_Export, is_cong_shipp, customer_ref, goods_desc, nature_of_goods, destination, loading_country, discharge_country, port_of_loading, port_of_discharge, packing_type, total_dimension, total_box, total_weight, document_upload, document_name, comment_on_docs, added_by, clearance_number) VALUES (?, ?, ?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?,?,?,?,?,?,?,?)`;
//                 insertParams = [user_id, freight, freight_option, is_Import_Export, is_cong_shipp, customer_ref || null, goods_desc, nature_of_goods, destination, loading_country, discharge_country, port_of_loading, port_of_discharge, packing_type, total_dimension, total_box, total_weight, req.files.document[0].filename, document_name, comment_on_docs, addedByValue, clearanceNumber];

//             }

//             // Execute the insertion query
//             con.query(insertQuery, insertParams, (err, data) => {
//                 if (err) {
//                     // console.error('Error inserting clearance data:', err);
//                     return res.status(500).json({
//                         success: false,
//                         message: "Internal Server Error"
//                     });
//                 }
//                 const selectQuery = `SELECT clearance_number FROM tbl_clearance WHERE id = ?`;

//                 con.query(selectQuery, [data.insertId], async (err, result) => {
//                     if (err) {
//                         console.error("Error fetching clearance number:", err);
//                         return;
//                     }
//                     let file = req.files.document[0];
//                     // console.log(file);

//                     const clearanceNumber = result[0].clearance_number;
//                     /* const folderId = await findOrCreateFolder(clearanceNumber);
//                     console.log(`📂 Folder ID: ${folderId}`);


//                     const { fileId, webViewLink } = await uploadFile(folderId, file); */
//                 })
//                 if (data.affectedRows > 0) {
//                     const InsertQuery = `insert into tbl_notifications (title, description, send_to) values (?,?,?)`;
//                     con.query(InsertQuery, ["New Clearance Alert!", `A Client Has Added a New Clearance. Admins, Please Review and Process Accordingly`, 5], (err, notificationData) => {
//                         if (err) {
//                             // console.error('Error inserting notification:', err);
//                             return res.status(500).json({
//                                 success: false,
//                                 message: "Internal Server Error"
//                             });
//                         }

//                         con.query(`select * from tbl_users where user_type='${1}'`, (err, id) => {
//                             if (err) {
//                                 // console.error('Error fetching admin user:', err);
//                                 return res.status(500).json({
//                                     success: false,
//                                     message: "Internal Server Error"
//                                 });
//                             }
//                             const selectQuery1 = `SELECT * FROM tbl_clearance WHERE id = ?`;

//                             con.query(selectQuery1, [data.insertId], async (err, result1) => {
//                                 if (err) {
//                                     console.error("Error fetching clearance number:", err);
//                                     return;
//                                 }
//                                 con.query(`select * from tbl_users where id='${result1[0].user_id}'`, (err, userrData) => {
//                                     if (err) {
//                                         // console.error('Error fetching admin user:', err);
//                                         return res.status(500).json({
//                                             success: false,
//                                             message: "Internal Server Error"
//                                         });
//                                     }
//                                     const insertNotificationSql = 'INSERT INTO notification_details (user_id, notification_id) VALUES (?, ?)';
//                                     con.query(insertNotificationSql, [id[0].id, notificationData.insertId], (err, result) => {
//                                         if (err) {
//                                             // console.error('Error inserting notification details:', err);
//                                             return res.status(500).json({
//                                                 success: false,
//                                                 message: "Internal Server Error"
//                                             });
//                                         }
//                                     });
//                                     Email = SMTP_MAIL;
//                                     mailSubject = `New Clearance Registered by ${id[0].full_name}`;
//                                     content = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; background-color: #f9f9f9;">
// <h2 style="color: #2c3e50; border-bottom: 1px solid #ccc; padding-bottom: 10px;">New Clearance Registered</h2>

// <p style="font-size: 16px; color: #333;">
// <strong>Client Name:</strong> ${userrData[0].full_name}<br>
// <strong>Client Email:</strong> ${userrData[0].email}<br>
// <strong>Freight Number:</strong> ${result1[0].clearance_number}<br>
// <strong>Goods Description:</strong> ${result1[0].goods_desc}<br>
// </p>

// <p style="font-size: 16px; color: #333;">
// The client has successfully registered a new clearance. Please review the clearance details in the system.
// </p>

// <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">

// <p style="font-size: 14px; color: #777;">
// Regards,<br>
// <strong>Management System</strong>
// </p>
// </div>`
//                                     //content = 'Hi ' + data[0].first_name + ', <p> Please click the below button to reset your password. </p> <p> <span style="background: #6495ED; padding: 5px;"> <a style="color: white; text-decoration: none;  font-weight: 600;" href="http://localhost:3001/reset-password?token=' + randomToken + '">Click Here </a> </span> </p>';
//                                     sendMail(Email, mailSubject, content);
//                                 });
//                             })
//                         })
//                     });

//                     res.status(200).send({
//                         success: true,
//                         message: "Clearance added successfully",
//                         data: data.insertId
//                     });
//                 } else {
//                     res.status(400).send({
//                         success: false,
//                         message: "Failed to add Clearance"
//                     });
//                 }
//             });
//         });

//     } catch (error) {
//         res.status(500).send({
//             success: false,
//             message: error.message
//         });
//     }
// };

// Utility function to generate clearance number

const AddClearingByCustomer = async (req, res) => {
    try {
        const {
            user_id, client, freight, freight_option, is_Import_Export, is_cong_shipp,
            customer_ref, goods_desc, nature_of_goods, packing_type, total_dimension,
            total_box, total_weight, destination, loading_country, discharge_country,
            port_of_loading, port_of_discharge, comment_on_docs, added_by
        } = req.body;

        if (!user_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide user id"
            });
        }
        console.log(req.files);

        generateClearanceNumber((err, clearanceNumber) => {
            if (err) {
                return res.status(500).json({ success: false, message: "Internal Server Error" });
            }

            const addedByValue = added_by || 2;
            const insertQuery = `INSERT INTO tbl_clearance (user_id, freight, freight_option, is_Import_Export, is_cong_shipp, customer_ref, goods_desc, nature_of_goods, destination, loading_country, discharge_country, port_of_loading, port_of_discharge, packing_type, total_dimension, total_box, total_weight, comment_on_docs, added_by, clearance_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            const insertParams = [user_id, freight, freight_option, is_Import_Export, is_cong_shipp, customer_ref || null, goods_desc, nature_of_goods, destination, loading_country, discharge_country, port_of_loading, port_of_discharge, packing_type, total_dimension, total_box, total_weight, comment_on_docs, addedByValue, clearanceNumber];

            con.query(insertQuery, insertParams, async (err, data) => {
                if (err) return res.status(500).json({ success: false, message: "Internal Server Error" });

                const clearanceId = data.insertId;

                //  Process and insert uploaded documents
                // handleFile_Uploads(clearanceId, req.files, clearanceNumber);

                await findOrCreateFolder(clearanceNumber);

                if (req.files && Object.keys(req.files).length > 0) {
                    for (const fieldName of Object.keys(req.files)) {
                        const filesArray = req.files[fieldName];

                        for (const file of filesArray) {
                            const documentName = req.body.documentName; // sent from Postman
                            console.log(documentName);

                            await uploadToMatchingFolder(file, documentName, clearanceNumber);

                            // Save in DB
                            const docQuery = `INSERT INTO clearance_docs (clearance_id, uploaded_by, document_name, document_file) 
            VALUES (?, ?, ?, ?)`;
                            await new Promise((resolve, reject) => {
                                con.query(docQuery, [clearanceId, added_by, documentName, file.filename], (err) => {
                                    if (err) return reject(err);
                                    resolve();
                                });
                            });
                        }
                    }
                }

                const selectQuery = `SELECT clearance_number FROM tbl_clearance WHERE id = ?`;
                con.query(selectQuery, [clearanceId], async (err, result) => {
                    if (err) return console.error("Error fetching clearance number:", err);

                    if (data.affectedRows > 0) {
                        const InsertQuery = `INSERT INTO tbl_notifications (title, description, send_to) VALUES (?,?,?)`;
                        con.query(InsertQuery, ["New Clearance Alert!", `A Client Has Added a New Clearance. Admins, Please Review and Process Accordingly`, 5], (err, notificationData) => {
                            if (err) return res.status(500).json({ success: false, message: "Internal Server Error" });

                            con.query(`SELECT * FROM tbl_users WHERE user_type='${1}'`, (err, id) => {
                                if (err) return res.status(500).json({ success: false, message: "Internal Server Error" });

                                const selectQuery1 = `SELECT * FROM tbl_clearance WHERE id = ?`;
                                con.query(selectQuery1, [clearanceId], async (err, result1) => {
                                    if (err) return console.error("Error fetching clearance:", err);

                                    con.query(`SELECT * FROM tbl_users WHERE id='${result1[0].user_id}'`, (err, userrData) => {
                                        if (err) return res.status(500).json({ success: false, message: "Internal Server Error" });

                                        const insertNotificationSql = 'INSERT INTO notification_details (user_id, notification_id) VALUES (?, ?)';
                                        con.query(insertNotificationSql, [id[0].id, notificationData.insertId], (err) => {
                                            if (err) return res.status(500).json({ success: false, message: "Internal Server Error" });
                                        });

                                        const Email = SMTP_MAIL;
                                        const mailSubject = `New Clearance Registered by ${id[0].full_name}`;
                                        const content = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; background-color: #f9f9f9;">
    <h2 style="color: #2c3e50; border-bottom: 1px solid #ccc; padding-bottom: 10px;">New Clearance Registered</h2>
    <p style="font-size: 16px; color: #333;">
        <strong>Client Name:</strong> ${userrData[0].full_name}<br>
        <strong>Client Email:</strong> ${userrData[0].email}<br>
        <strong>Freight Number:</strong> ${result1[0].clearance_number}<br>
        <strong>Goods Description:</strong> ${result1[0].goods_desc}<br>
    </p>
    <p style="font-size: 16px; color: #333;">
        The client has successfully registered a new clearance. Please review the clearance details in the system.
    </p>
    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
    <p style="font-size: 14px; color: #777;">Regards,<br><strong>Management System</strong></p>
</div>`;
                                        // sendMail(Email, mailSubject, content);
                                    });
                                });
                            });
                        });

                        res.status(200).send({
                            success: true,
                            message: "Clearance added successfully",
                            data: clearanceId
                        });
                    } else {
                        res.status(400).send({
                            success: false,
                            message: "Failed to add Clearance"
                        });
                    }
                });
            });
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
};


// const handleFile_Uploads = async (clearanceId, files, clearanceNumber) => {
//     try {
//         if (files) {
//             const fileKeys = Object.keys(files);
//             for (const key of fileKeys) {
//                 const fileArray = Array.isArray(files[key]) ? files[key] : [files[key]];
//                 const documentName = getDocumentNames(key);

//                 for (const file of fileArray) {
//                     const insertDocQuery = `INSERT INTO clearance_docs (clearance_id, document_name, document_file) VALUES (?, ?, ?)`;
//                     await new Promise((resolve, reject) => {
//                         con.query(insertDocQuery, [clearanceId, documentName, file.filename], (err) => {
//                             if (err) {
//                                 console.error(`❌ Error inserting ${documentName}:`, err);
//                                 return reject(err);
//                             }
//                             console.log(`✅ Uploaded: ${documentName} - ${file.originalname}`);
//                             resolve();
//                         });
//                     });

//                     const subfolderName = getFolderNameFromDocumentName(documentName); // returns "AD_Quotations" etc.

//                     const uploadResult = await uploadToSpecificPath(
//                         clearanceNumber,     // Main folder: e.g., "F-20250613"
//                         "Supplier Invoices",      // Parent folder or fixed main type
//                         subfolderName,     // Subfolder based on document type
//                         file               // Current file
//                     );
//                 }
//             }
//         }
//     } catch (error) {
//         console.error("❌ Error processing documents:", error);
//     }
// };

// const getDocumentNames = (fieldName) => {
//     switch (fieldName) {
//         case 'document': return "General Document";
//         case 'packing_list': return "Packing List";
//         case 'licenses': return "Licenses";
//         case 'product_literature': return "Product Literature";
//         case 'other_documents': return "Other Documents";
//         default: return "Unknown Document";
//     }
// };

const GetClearingClient = async (req, res) => {
    try {
        const { user_id, clearing_status } = req.body;
        // console.log( clearing_status );
        if (!user_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide user id"
            })
        }
        if (!clearing_status) {
            const selectQuery = `select tbl_clearance.*, u.full_name as client_name, c.name as port_of_entry_name, co.name as port_of_exit_name  from tbl_clearance
            LEFT JOIN countries AS c ON c.id = tbl_clearance.loading_country
            LEFT JOIN countries AS co ON co.id = tbl_clearance.discharge_country
            INNER JOIN tbl_users AS u ON u.id = tbl_clearance.user_id
             where tbl_clearance.is_deleted=? and tbl_clearance.user_id=? ORDER BY tbl_clearance.created_at DESC`;
            await con.query(selectQuery, [0, user_id], (err, data) => {
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
                        message: "No List Available"
                    })
                }
            })
        }
        else {
            const selectQuery = `SELECT tbl_clearance.*, c.name as port_of_entry_name, co.name as port_of_exit_name  from tbl_clearance
            LEFT JOIN countries AS c ON c.id = tbl_clearance.loading_country
            LEFT JOIN countries AS co ON co.id = tbl_clearance.discharge_country
            WHERE tbl_clearance.is_deleted=? AND tbl_clearance.user_id=? AND tbl_clearance.clearing_status=? 
            ORDER BY created_at DESC;`;
            await con.query(selectQuery, [0, user_id, clearing_status], (err, data) => {
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
                        message: "No List Available"
                    })
                }
            })
        }
    }
    catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        })
    }
}

// const EditClearing = async (req, res) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//         return res.status(400).json({
//             success: false,
//             errors: errors.array()
//         });
//     }

//     try {
//         // Extract all fields from the request body for the update
//         const { clearing_id, client, freight, freight_option, is_Import_Export, is_cong_shipp, customer_ref, goods_desc, nature_of_goods, packing_type, total_dimension,
//             total_box, total_weight, destination, loading_country, discharge_country,
//             port_of_loading, port_of_discharge, comment_on_docs, document_name, sales_representative } = req.body;
//         console.log(req.body);
//         // console.log(req.files);

//         // Check if a document file is provided
//         if (req.files && req.files.document) {
//             const UpdateQueryWithDoc = `
//                 UPDATE tbl_clearance 
//                 SET freight=?, user_id=?, freight_option=?, is_Import_Export=?, is_cong_shipp=?, customer_ref=?, goods_desc=?, nature_of_goods=?, 
//                     packing_type=?, total_dimension=?, total_box=?, total_weight=?, destination=?, loading_country=?, discharge_country=?, 
//                     port_of_loading=?, port_of_discharge=?, document_upload=?, document_name=?, comment_on_docs=?, sales_representative=?
//                 WHERE id=?`;

//             // Execute update query with document upload
//             await con.query(UpdateQueryWithDoc, [
//                 freight, client, freight_option, is_Import_Export, is_cong_shipp, customer_ref, goods_desc, nature_of_goods,
//                 packing_type, total_dimension, total_box, total_weight, destination, loading_country, discharge_country,
//                 port_of_loading, port_of_discharge, req.files.document[0].filename, document_name, comment_on_docs, sales_representative, clearing_id
//             ], (err, data) => {
//                 if (err) throw err;
//                 if (data.affectedRows > 0) {

//                     const selectQuery = `SELECT clearance_number FROM tbl_clearance WHERE id = ?`;

//                     con.query(selectQuery, [clearing_id], async (err, result) => {
//                         if (err) {
//                             console.error("Error fetching clearance number:", err);
//                             return;
//                         }
//                         let file = req.files.document[0];
//                         // console.log(file);

//                         const clearanceNumber = result[0].clearance_number;
//                         /*  const folderId = await findOrCreateFolder(clearanceNumber);
//                          console.log(`📂 Folder ID: ${folderId}`);


//                          const { fileId, webViewLink } = await uploadFile(folderId, file); */
//                     })
//                     res.status(200).send({
//                         success: true,
//                         message: "Clearance updated successfully"
//                     });
//                 } else {
//                     res.status(400).send({
//                         success: false,
//                         message: "Failed to update clearance"
//                     });
//                 }
//             });
//         } else {
//             // Update query when there is no document file to upload
//             const UpdateQueryWithoutDoc = `
//                 UPDATE tbl_clearance 
//                 SET  freight=?, user_id=?, freight_option=?, is_Import_Export=?, is_cong_shipp=?, customer_ref=?, goods_desc=?, nature_of_goods=?, 
//                     packing_type=?, total_dimension=?, total_box=?, total_weight=?, destination=?, loading_country=?, discharge_country=?, 
//                     port_of_loading=?, port_of_discharge=?, comment_on_docs=?, sales_representative=?
//                 WHERE id=?`;

//             // Execute update query without document upload
//             await con.query(UpdateQueryWithoutDoc, [
//                 freight, client, freight_option, is_Import_Export, is_cong_shipp, customer_ref, goods_desc, nature_of_goods,
//                 packing_type, total_dimension, total_box, total_weight, destination, loading_country, discharge_country,
//                 port_of_loading, port_of_discharge, comment_on_docs, sales_representative, clearing_id
//             ], (err, data) => {
//                 if (err) throw err;
//                 if (data.affectedRows > 0) {
//                     res.status(200).send({
//                         success: true,
//                         message: "Clearance updated successfully"
//                     });
//                 } else {
//                     res.status(400).send({
//                         success: false,
//                         message: "Failed to update clearance"
//                     });
//                 }
//             });
//         }
//     } catch (error) {
//         res.status(500).send({
//             success: false,
//             message: error.message
//         });
//     }
// };

const EditClearing = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }

    try {
        const {
            clearing_id, client, freight, freight_option, is_Import_Export, is_cong_shipp,
            customer_ref, goods_desc, nature_of_goods, packing_type, total_dimension,
            total_box, total_weight, destination, loading_country, discharge_country,
            port_of_loading, port_of_discharge, comment_on_docs, sales_representative, uploaded_by
        } = req.body;
        console.log(req.body);

        const updateQuery = `
            UPDATE tbl_clearance 
            SET freight=?, user_id=?, freight_option=?, is_Import_Export=?, is_cong_shipp=?, customer_ref=?, goods_desc=?, 
                nature_of_goods=?, packing_type=?, total_dimension=?, total_box=?, total_weight=?, destination=?, 
                loading_country=?, discharge_country=?, port_of_loading=?, port_of_discharge=?, comment_on_docs=?, 
                sales_representative=?
            WHERE id=?
        `;

        const updateParams = [
            freight, client, freight_option, is_Import_Export, is_cong_shipp, customer_ref, goods_desc,
            nature_of_goods, packing_type, total_dimension, total_box, total_weight, destination,
            loading_country, discharge_country, port_of_loading, port_of_discharge,
            comment_on_docs, sales_representative, clearing_id
        ];

        con.query(updateQuery, updateParams, async (err, data) => {
            if (err) throw err;

            if (data.affectedRows > 0) {
                const selectQuery = `SELECT clearance_number FROM tbl_clearance WHERE id = ?`;
                con.query(selectQuery, [clearing_id], async (err, result) => {
                    if (err) {
                        console.error("Error fetching clearance number:", err);
                        return res.status(500).send({
                            success: false,
                            message: "Error fetching clearance number"
                        });
                    }

                    const clearanceNumber = result[0].clearance_number;

                    // Handle all uploaded documents
                    // await handle_FileUploads(clearing_id, clearanceNumber, req.files);

                    await findOrCreateFolder(clearanceNumber);

                    if (req.files && Object.keys(req.files).length > 0) {
                        for (const fieldName of Object.keys(req.files)) {
                            const filesArray = req.files[fieldName];

                            for (const file of filesArray) {
                                const documentName = req.body.documentName; // sent from Postman
                                console.log(documentName);

                                await uploadToMatchingFolder(file, documentName, clearanceNumber);

                                // Save in DB
                                const docQuery = `INSERT INTO clearance_docs (clearance_id, uploaded_by, document_name, document_file) 
            VALUES (?, ?, ?, ?)`;
                                await new Promise((resolve, reject) => {
                                    con.query(docQuery, [clearing_id, uploaded_by, documentName, file.filename], (err) => {
                                        if (err) return reject(err);
                                        resolve();
                                    });
                                });
                            }
                        }
                    }

                    return res.status(200).send({
                        success: true,
                        message: "Clearance updated and documents uploaded successfully"
                    });
                });
            } else {
                return res.status(400).send({
                    success: false,
                    message: "Failed to update clearance"
                });
            }
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

// const handle_FileUploads = async (clearanceId, clearanceNumber, files) => {
//     try {
//         if (files) {
//             const fileKeys = Object.keys(files);
//             for (const key of fileKeys) {
//                 const fileArray = Array.isArray(files[key]) ? files[key] : [files[key]];
//                 const documentName = get_DocumentName(key);

//                 await process_Files(fileArray, documentName, clearanceId, clearanceNumber);
//             }
//         }
//     } catch (error) {
//         console.error("❌ Error handling file uploads:", error);
//     }
// };

// const process_Files = async (fileArray, documentName, clearanceId, clearanceNumber) => {
//     for (const file of fileArray) {
//         const insertDocQuery = `
//             INSERT INTO clearance_docs (clearance_id, document_name, document_file) 
//             VALUES (?, ?, ?)
//         `;

//         await new Promise((resolve, reject) => {
//             con.query(insertDocQuery, [clearanceId, documentName, file.filename], (err) => {
//                 if (err) {
//                     console.error(`❌ Error inserting ${documentName}:`, err);
//                     return reject(err);
//                 }
//                 resolve();
//             });
//         });

//         console.log(`✅ Saved to DB: ${documentName} - ${file.originalname}`);

//     }
// };

// const get_DocumentName = (fieldName) => {
//     switch (fieldName) {
//         case 'document':
//             return "General Document";
//         case 'packing_list':
//             return "Packing List";
//         case 'licenses':
//             return "Licenses/Permit";
//         case 'product_literature':
//             return "Product Literature";
//         case 'other_documents':
//             return "Other Documents";
//         default:
//             return "Unknown Document";
//     }
// };

const GetClearingList = async (req, res) => {
    try {
        const { origin, destination, startDate, endDate, clearingType, clearing_status, added_by } = req.body;

        if (!added_by) {
            return res.status(400).send({
                success: false,
                message: "Please provide added_by"
            });
        }

        // Base condition and parameters
        let condition = `WHERE tbl_clearance.is_deleted = ? AND tbl_clearance.added_by = ?`;
        let params = [0, added_by];

        if (clearing_status) {
            condition += ` AND tbl_clearance.quotation_status = ?`;
            params.push(clearing_status);
        }

        if (origin) {
            condition += ` AND tbl_clearance.loading_country = ?`;
            params.push(origin);
        }

        if (destination) {
            condition += ` AND tbl_clearance.discharge_country = ?`;
            params.push(destination);
        }

        if (startDate && endDate) {
            condition += ` AND tbl_clearance.created_at BETWEEN ? AND ?`;
            params.push(startDate, endDate);
        }

        if (clearingType) {
            condition += ` AND tbl_clearance.freight = ?`;
            params.push(freightType);
        }

        const selectQuery = `
            SELECT 
                tbl_clearance.*, ss.full_name as sales_name,
                a.name AS port_of_exit_name, 
                b.name AS port_of_entry_name, 
                u.full_name AS client_name
            FROM tbl_clearance
            INNER JOIN countries AS a 
                ON a.id = tbl_clearance.discharge_country
            INNER JOIN countries AS b 
                ON b.id = tbl_clearance.loading_country
            INNER JOIN tbl_users AS u 
                ON u.id = tbl_clearance.user_id
            LEFT JOIN tbl_users AS ss 
                ON ss.id = tbl_clearance.sales_representative
            ${condition}
            ORDER BY tbl_clearance.created_at DESC;
        `;

        con.query(selectQuery, params, (err, data) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: err.message
                });
            }

            if (data.length > 0) {
                res.status(200).send({
                    success: true,
                    data: data
                });
            } else {
                res.status(400).send({
                    success: false,
                    message: "No List Available"
                });
            }
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

const GetClearingById = async (req, res) => {
    try {
        const { clearing_id } = req.body;
        if (!clearing_id) {
            res.status(400).send({
                success: false,
                message: "Please provide clearing id"
            })
        }
        else {
            const selectQuery = `select tbl_clearance.*, ss.full_name as sales_name  from tbl_clearance
            LEFT JOIN tbl_users AS ss 
                ON ss.id = tbl_clearance.sales_representative 
            where tbl_clearance.id=? and tbl_clearance.is_deleted=?`;
            await con.query(selectQuery, [clearing_id, 0], (err, data) => {
                if (err) throw err;
                if (data.length > 0) {
                    res.status(200).send({
                        success: true,
                        data: data[0]
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
    }
    catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        })
    }
}

const Deleteclearance = async (req, res) => {
    try {
        const { clearing_id } = req.body;
        if (!clearing_id) {
            res.status(400).send({
                success: false,
                message: "Please provide clearing id"
            })
        }
        else {
            const selectQuery = `select * from tbl_clearance where id=?`;
            await con.query(selectQuery, [clearing_id], (err, data) => {
                if (err) throw err;
                if (data.length > 0) {
                    if (data[0].is_deleted == 1) {
                        res.status(400).send({
                            success: false,
                            message: "This clearence already deleted"
                        })
                    }
                    else {
                        const updateQuery = `update tbl_clearance set is_deleted=? where id=?`;
                        con.query(updateQuery, [1, clearing_id], async (err, result) => {
                            if (err) throw err;
                            if (result.affectedRows > 0) {
                                const docQuery = `DELETE FROM clearance_docs WHERE clearance_id = ?`;
                                await con.query(docQuery, [clearing_id]);
                                const folderDeleted = await deleteFolderByName(data[0].clearance_number);
                                res.status(200).send({
                                    success: true,
                                    message: "Clearance deleted successfully"
                                })
                            }
                            else {
                                res.status(400).send({
                                    success: false,
                                    message: "Failed to delete clearence"
                                })
                            }
                        })
                    }
                }
                else {
                    res.status(400).send({
                        success: false,
                        message: "Clearing id does not exist"
                    })
                }
            })
        }
    }
    catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        })
    }
}



const customerRegister = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    try {
        const { client_name, email, password, contact_person,
            cellphone, telephone, address_1, address_2, city, province, country, code, company_id, importers_ref, tax_ref } = req.body;
        //  const { client_name, email, password, cellphone } = req.body;
        // console.log(req.body);
        var encrypassword = await hashPassword(password);
        await con.query(`select * from tbl_users where email='${email}' and is_deleted='${0}'`, (err, result) => {
            if (err) throw err;
            // console.log(result);
            if (result.length > 0) {
                res.status(400).send({
                    success: false,
                    message: "Email is already exists !"
                })
            }
            else {
                con.query(`select cellphone from tbl_users where cellphone='${cellphone}' and is_deleted='${0}'`, (err, result1) => {
                    if (err) throw err;
                    if (result1.length > 0) {
                        res.status(400).send({
                            success: false,
                            message: "cellphone number is already exists !"
                        })
                    }
                    else {
                        /* client_name, email, password, contact_person,
            cellphone, telephone, address_1, address_2, city, province, country, code, company_id, importers_ref, tax_ref */
                        const insertQuery = `INSERT INTO tbl_users (full_name, email, password, cellphone, telephone, contact_person, 
                            address_1, address_2, city, province, country, code, company_id, importers_ref, tax_ref, user_type)
                            VALUES(?, ?, ?, ?, ?,?,?,?,?,?,?,?,?,?,?,?)`;
                        con.query(insertQuery, [client_name, email, encrypassword, cellphone, telephone, contact_person, address_1, address_2, city, province, country, code, company_id, importers_ref, tax_ref, 3], (err, insertdata) => {
                            if (err) throw err;
                            if (insertdata.affectedRows > 0) {
                                const mailSubject = 'New User Registered';
                                const content = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; background-color: #f9f9f9;">
        <h2 style="color: #2c3e50; border-bottom: 1px solid #ccc; padding-bottom: 10px;">New User Registered</h2>

        <p style="font-size: 16px; color: #333;">
          Hey Sales, let's welcome <strong>${client_name}</strong> who has just created a new profile and let's give them an awesome experience.
        </p>

        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">

        <p style="font-size: 14px; color: #777;">
          Regards,<br>
          <strong>Management System</strong>
        </p>
      </div>
    `;

                                // Query all staff with role 'Sales'
                                const getSalesEmailsQuery = `SELECT email FROM tbl_users WHERE user_type = 2 AND FIND_IN_SET(4, assigned_roles) AND is_deleted=0 AND status=1`;

                                con.query(getSalesEmailsQuery, (err, results) => {
                                    if (err) {
                                        console.error("Error fetching sales emails:", err);
                                        return res.status(500).send({
                                            success: false,
                                            message: "Account created but failed to notify sales team."
                                        });
                                    }

                                    // Loop through each email and send the message
                                    results.forEach((staff) => {
                                        const staffEmail = staff.email;
                                        // sendMail(staffEmail, mailSubject, content);
                                    });

                                    return res.status(200).send({
                                        success: true,
                                        message: "Your account has been successfully created and sales team notified!"
                                    });
                                });
                            }
                            else {
                                res.status(400).send({
                                    success: false,
                                    message: "failed to create account !"
                                })
                            }
                        })
                    }
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

const CustomerLogin = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    try {
        const { email, password } = req.body;
        let findUserQuery = "SELECT * FROM tbl_users WHERE email = ? and user_type=? and is_deleted=?";
        await con.query(findUserQuery, [email, 3, 0], (err, data) => {
            if (err) throw err;
            // User found
            if (data.length <= 0) {
                return res.status(400).send({
                    success: false,
                    message: "Email does not exist !"
                });
            }
            else {
                bcrypt.compare(password, data[0].password, (err, password) => {
                    if (err) throw err;
                    if (password) {
                        if (data[0].status == 1 && data[0].is_deleted == 0) {
                            let updateLoginQuery = "UPDATE tbl_users SET LastLogin = ? WHERE id = ?";

                            con.query(updateLoginQuery, [new Date(), data[0].id], (err) => {
                                if (err) console.error('Failed to update last login:', err.message);
                                // You can still send response even if update fails
                                res.status(200).send({
                                    success: true,
                                    message: "Customer Login Successfully!",
                                    data: data[0]
                                });
                            });
                        }
                        else {
                            if (data[0].is_deleted == 1) {
                                res.status(400).send({
                                    success: false,
                                    message: "Your account is deleted by admin !"
                                })
                            }
                            else {
                                res.status(400).send({
                                    success: false,
                                    message: "Your account is Inactivate by admin !"
                                })
                            }
                        }
                    }
                    else {
                        res.status(400).send({
                            success: false,
                            message: "Password Incorrect !"
                        })
                    }
                });
            }
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        })
    }
}

const UpdateClientProfile = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }

    try {
        const { client_id, client_name, email, contact_person,
            cellphone, telephone, address_1, address_2, city, province, country, code, company_id, importers_ref, tax_ref } = req.body;
        let sql = "Select * from tbl_users where email = ? AND id <> ? AND is_deleted=?";
        await con.query(sql, [email, client_id, 0], (err, data) => {
            if (err) throw err;
            if (data.length > 0) {
                res.status(400).send({
                    success: false,
                    message: "Email is already exists !"
                })
            }
            else {
                con.query(`select cellphone from tbl_users where cellphone='${cellphone}' and id <> '${client_id}' and is_deleted='${0}'`, (err, result1) => {
                    if (err) throw err;
                    if (result1.length > 0) {
                        res.status(400).send({
                            success: false,
                            message: "cellphone number is already exists !"
                        })
                    }
                    else {
                        if (req.files.profile) {
                            // console.log(req.files.profile[0].filename);
                            //  console.log(client_id);
                            const updateQuery = `Update tbl_users set full_name=?, email=?, profile=?, client_ref=?, contact_person=?,
                            cellphone=?, telephone=?, address_1=?, address_2=?, city=?, province=?, country=?, code=?, company_id=?, importers_ref=?, tax_ref=? where id=?`;
                            con.query(updateQuery, [client_name, email, req.files.profile[0].filename, client_id, contact_person,
                                cellphone, telephone, address_1, address_2, city, province, country, code, company_id, importers_ref, tax_ref, client_id], (err, insertdata) => {
                                    if (err) throw err;
                                    if (insertdata.affectedRows > 0) {
                                        let sql = "Select * from tbl_users where id =?"
                                        con.query(sql, [client_id], (err, alldata) => {
                                            if (err) throw err;
                                            res.status(200).send({
                                                success: true,
                                                message: "Your account has been successfully updated !",
                                                data: alldata
                                            })

                                        })

                                    }
                                    else {
                                        res.status(400).send({
                                            success: false,
                                            message: "failed to update profile !"
                                        })
                                    }
                                })
                        }
                        else {

                            const updateQuery = `Update tbl_users set full_name=?, email=?, client_ref=?, contact_person=?,
                            cellphone=?, telephone=?, address_1=?, address_2=?, city=?, province=?, country=?, code=?, company_id=?, importers_ref=?, tax_ref=? where id=?`;
                            con.query(updateQuery, [client_name, email, client_id, contact_person,
                                cellphone, telephone, address_1, address_2, city, province, country, code, company_id, importers_ref, tax_ref, client_id], (err, insertdata) => {
                                    if (err) throw err;
                                    if (insertdata.affectedRows > 0) {
                                        let sql = "Select * from tbl_users where id =?"
                                        con.query(sql, [client_id], (err, alldata) => {
                                            if (err) throw err;
                                            res.status(200).send({
                                                success: true,
                                                message: "Your account has been successfully updated !",
                                                data: alldata
                                            })

                                        })
                                    }
                                    else {
                                        res.status(400).send({
                                            success: false,
                                            message: "failed to update profile !"
                                        })
                                    }
                                })
                        }
                    }
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

const AddfreightByCustomer = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    console.log(req.body);
    console.log(req.files);


    try {
        // Extracting data from req.body
        const {
            client_id, date, commodity, fcl_lcl, product_desc, collection_from, freight, freight_type, shipment_ref, dimension, weight, user_type,
            shipment_origin, shipment_des, comment, no_of_packages, package_type, collection_address, delivery_address,
            nature_of_goods, delivery_to, port_of_loading, post_of_discharge, auto_calculate, add_attachments, sea_freight_option, road_freight_option, assign_for_estimate, insurance, quote_received, client_quoted, assign_to_transporter, send_to_warehouse, assign_warehouse, assign_to_clearing
        } = req.body;
        // console.log(req.body);
        // console.log(req.files);

        // Generate the freight number
        generateFreightNumber((err, freightNumber) => {
            if (err) throw err;

            const insertQuery = `INSERT INTO tbl_freight (client_id, commodity, date, fcl_lcl, product_desc, collection_from, freight, freight_type,
                shipment_origin, shipment_des, shipment_ref, dimension, weight, user_type, comment, no_of_packages, package_type,
                collection_address, delivery_address, nature_of_goods, delivery_to, port_of_loading, post_of_discharge, auto_calculate,
                added_by, add_attachments, sea_freight_option, road_freight_option, freight_number, assign_for_estimate, insurance, quote_received, client_quoted, assign_to_transporter, send_to_warehouse, assign_warehouse, assign_to_clearing )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? ,?,?, ?,?,?,?,?,? )`;

            con.query(insertQuery, [
                client_id, commodity, date, fcl_lcl || null, product_desc, collection_from, freight, freight_type, shipment_origin, shipment_des,
                shipment_ref, dimension, weight, user_type, comment, no_of_packages, package_type, collection_address,
                delivery_address, nature_of_goods, delivery_to, port_of_loading, post_of_discharge, auto_calculate, 2, add_attachments,
                sea_freight_option, road_freight_option, freightNumber, assign_for_estimate, insurance, quote_received, client_quoted, assign_to_transporter, send_to_warehouse, assign_warehouse, assign_to_clearing
            ], (err, data) => {
                if (err) throw err;
                // console.log(req.files.document);

                if (data.affectedRows > 0) {
                    const freightId = data.insertId;
                    // Handle document uploads
                    const selectQuery = `SELECT freight_number FROM tbl_freight WHERE id = ?`;

                    con.query(selectQuery, [freightId], async (err, result) => {
                        if (err) {
                            console.error("Error fetching freight number:", err);
                            return;
                        }

                        if (result.length === 0) {
                            console.error("No freight number found for the given ID.");
                            return;
                        }

                        const freightNumber = result[0].freight_number;
                        // console.log(freightNumber);

                        await findOrCreateFolder(freightNumber);

                        if (req.files && Object.keys(req.files).length > 0) {
                            for (const fieldName of Object.keys(req.files)) {
                                const filesArray = req.files[fieldName];

                                for (const file of filesArray) {
                                    const documentName = req.body.documentName; // sent from Postman
                                    console.log(documentName);

                                    await uploadToMatchingFolder(file, documentName, freightNumber);

                                    // Save in DB
                                    const docQuery = `INSERT INTO freight_doc (freight_id, uploaded_by, document_name, document) VALUES (?, ?, ?, ?)`;
                                    await new Promise((resolve, reject) => {
                                        con.query(docQuery, [freightId, 2, documentName, file.filename], (err) => {
                                            if (err) return reject(err);
                                            resolve();
                                        });
                                    });
                                }
                            }
                        }
                    });

                    /*  if (req.files && req.files.supplier_invoice) {
                         // Iterate over all uploaded files for 'supplier_invoice'
                         const docsInsertQuery = `INSERT INTO freight_doc (freight_id, document_name, document) VALUES (?, ?, ?)`;
 
                         req.files.supplier_invoice.forEach((file) => {
                             con.query(docsInsertQuery, [freightId, "Supplier Invoice", file.filename], (err, result) => {
                                 if (err) throw err;
                             });
                         })
                     }
                     if (req.files && req.files.packing_list) {
                         const docsInsertQuery = `INSERT INTO freight_doc (freight_id, document_name, document) VALUES (?, ?, ?)`;
 
                         req.files.packing_list.forEach((file) => {
                             con.query(docsInsertQuery, [freightId, "Packing List", file.filename], (err, result) => {
                                 if (err) throw err;
                             });
                         })
                     }
                     if (req.files && req.files.licenses) {
                         const docsInsertQuery = `INSERT INTO freight_doc (freight_id, document_name, document) VALUES (?, ?, ?)`;
 
                         req.files.licenses.forEach((file) => {
                             con.query(docsInsertQuery, [freightId, "Licenses", file.filename], (err, result) => {
                                 if (err) throw err;
                             });
                         })
                     }
                     if (req.files && req.files.other_documents) {
                         const docsInsertQuery = `INSERT INTO freight_doc (freight_id, document_name, document) VALUES (?, ?, ?)`;
 
                         req.files.other_documents.forEach((file) => {
                             con.query(docsInsertQuery, [freightId, "Other Documents", file.filename], (err, result) => {
                                 if (err) throw err;
                             });
                         })
                     } */

                    con.query(`SELECT * FROM tbl_users WHERE user_type = ?`, [1], (err, adminUsers) => {
                        if (err) {
                            // console.error('Error fetching admin users:', err);
                            if (err) throw err;
                        }

                        con.query(`SELECT * FROM tbl_users WHERE id = ?`, [client_id], (err, user) => {
                            if (err) throw err;
                            const selectQuery = `select * from tbl_freight where id='${freightId}'`
                            con.query(selectQuery, (err, result) => {
                                if (err) throw err;
                                const InsertQuery = `INSERT INTO tbl_notifications (title, description, send_to) VALUES (?, ?, ?)`;
                                con.query(InsertQuery, [
                                    "New Freight Alert!",
                                    `${user[0].full_name} has added a new freight with Freight Number: ${result[0].freight_number}. Please Review and Process Accordingly.`,
                                    5
                                ], (err, notificationResult) => {
                                    if (err) throw err;

                                    const insertNotificationSql = 'INSERT INTO notification_details (user_id, notification_id) VALUES (?, ?)';
                                    con.query(insertNotificationSql, [adminUsers[0].id, notificationResult.insertId], (err, result) => {
                                        if (err) throw err;
                                    });
                                });


                                Email = SMTP_MAIL;
                                mailSubject = `New Freight Registered by ${user[0].full_name}`;
                                content = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; background-color: #f9f9f9;">
    <h2 style="color: #2c3e50; border-bottom: 1px solid #ccc; padding-bottom: 10px;">New Freight Registered</h2>

    <p style="font-size: 16px; color: #333;">
      <strong>Client Name:</strong> ${user[0].full_name}<br>
      <strong>Freight Number:</strong> ${result[0].freight_number}<br>
      <strong>Client Email:</strong> ${user[0].email}<br>
      <strong>Product Description:</strong> ${result[0].product_desc}<br>
      <strong>Freight:</strong> ${result[0].freight}<br>
    </p>

    <p style="font-size: 16px; color: #333;">
      The client has successfully registered a new freight. Please review the freight details in the system.
    </p>

    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">

    <p style="font-size: 14px; color: #777;">
      Regards,<br>
      <strong>Management System</strong>
    </p>
  </div>`
                                //content = 'Hi ' + data[0].first_name + ', <p> Please click the below button to reset your password. </p> <p> <span style="background: #6495ED; padding: 5px;"> <a style="color: white; text-decoration: none;  font-weight: 600;" href="http://localhost:3001/reset-password?token=' + randomToken + '">Click Here </a> </span> </p>';
                                // sendMail(Email, mailSubject, content);
                            })
                        });
                    });

                    res.status(200).send({
                        success: true,
                        message: "Freight inserted successfully"
                    });
                } else {
                    res.status(400).send({
                        success: false,
                        message: "Failed to insert Freight"
                    });
                }
            });
        });

    } catch (error) {
        // console.error('Error in AddfreightByCustomer function:', error);
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

// Utility function to generate freight number in the format "F-YYYYMMDDHHMMSS"
const generateFreightNumber = (callback) => {
    try {
        // Get the last inserted freight number
        con.query(
            'SELECT freight_number FROM tbl_freight ORDER BY id DESC LIMIT 1',
            (err, rows) => {
                if (err) {
                    callback(err);
                    return;
                }

                let sequenceNumber = 1;
                const currentDate = new Date();
                const year = currentDate.getFullYear();
                const month = (currentDate.getMonth() + 1).toString().padStart(2, '0'); // Months are zero-indexed

                if (rows.length > 0) {
                    const lastFreightNumber = rows[0].freight_number;
                    const lastYearMonth = lastFreightNumber.slice(2, 8); // Extract the year and month (e.g., '202406')
                    const currentYearMonth = `${year}${month}`;

                    if (lastYearMonth === currentYearMonth) {
                        const lastSequencePart = parseInt(lastFreightNumber.slice(-2)); // Extract last 4 digits
                        sequenceNumber = lastSequencePart + 1;
                    }
                }

                // Format the freight number as F-YYYYMMNNNN
                const freightNumber = `F-${year}${month}${sequenceNumber.toString().padStart(3, '0')}`;
                callback(null, freightNumber);
            }
        );
    } catch (error) {
        // console.error('Error generating freight number:', error);
        callback(error);
    }
};


// const UpdatefreightByCustomer = async (req, res) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//         return res.status(400).json({
//             success: false,
//             errors: errors.array()
//         });
//     }

//     try {
//         const {
//             freight_id, client_id, product_desc, fcl_lcl, commodity, collection_from, freight, freight_type, shipment_ref, dimension, weight, user_type,
//             shipment_origin, shipment_des, comment, no_of_packages, package_type, collection_address, delivery_address,
//             nature_of_goods, delivery_to, port_of_loading, post_of_discharge, auto_calculate, add_attachments, sea_freight_option, road_freight_option, assign_for_estimate, insurance, quote_received, client_quoted, assign_to_transporter, send_to_warehouse, assign_warehouse, assign_to_clearing
//         } = req.body;
//         // console.log(req.body);
//         console.log(req.files);

//         let updateFields = [];
//         let updateParams = [];

//         // Conditionally add client_id if provided
//         if (client_id) {
//             updateFields.push("client_id = ?");
//             updateParams.push(client_id);
//         }

//         // Unconditionally add other fields
//         updateFields.push("product_desc = ?");
//         updateParams.push(product_desc);

//         updateFields.push("collection_from = ?");
//         updateParams.push(collection_from);

//         updateFields.push("freight = ?");
//         updateParams.push(freight);

//         updateFields.push("freight_type = ?");
//         updateParams.push(freight_type);

//         updateFields.push("shipment_origin = ?");
//         updateParams.push(shipment_origin);

//         updateFields.push("shipment_des = ?");
//         updateParams.push(shipment_des);

//         updateFields.push("shipment_ref = ?");
//         updateParams.push(shipment_ref);

//         updateFields.push("dimension = ?");
//         updateParams.push(dimension);

//         updateFields.push("weight = ?");
//         updateParams.push(weight);

//         updateFields.push("user_type = ?");
//         updateParams.push(user_type);

//         updateFields.push("comment = ?");
//         updateParams.push(comment);

//         updateFields.push("no_of_packages = ?");
//         updateParams.push(no_of_packages);

//         updateFields.push("package_type = ?");
//         updateParams.push(package_type);

//         updateFields.push("collection_address = ?");
//         updateParams.push(collection_address);

//         updateFields.push("delivery_address = ?");
//         updateParams.push(delivery_address);

//         updateFields.push("nature_of_goods = ?");
//         updateParams.push(nature_of_goods);

//         updateFields.push("delivery_to = ?");
//         updateParams.push(delivery_to);

//         updateFields.push("port_of_loading = ?");
//         updateParams.push(port_of_loading);

//         updateFields.push("post_of_discharge = ?");
//         updateParams.push(post_of_discharge);

//         updateFields.push("auto_calculate = ?");
//         updateParams.push(auto_calculate);

//         updateFields.push("add_attachments = ?");
//         updateParams.push(add_attachments);

//         updateFields.push("sea_freight_option = ?");
//         updateParams.push(sea_freight_option);

//         updateFields.push("road_freight_option = ?");
//         updateParams.push(road_freight_option);

//         updateFields.push("assign_for_estimate = ?");
//         updateParams.push(assign_for_estimate);

//         updateFields.push("insurance = ?");
//         updateParams.push(insurance);

//         updateFields.push("quote_received = ?");
//         updateParams.push(quote_received);

//         updateFields.push("client_quoted = ?");
//         updateParams.push(client_quoted);

//         updateFields.push("assign_to_transporter = ?");
//         updateParams.push(assign_to_transporter);

//         updateFields.push("send_to_warehouse = ?");
//         updateParams.push(send_to_warehouse);

//         updateFields.push("assign_warehouse = ?");
//         updateParams.push(assign_warehouse);

//         updateFields.push("assign_to_clearing = ?");
//         updateParams.push(assign_to_clearing);

//         updateFields.push("fcl_lcl = ?");
//         updateParams.push(fcl_lcl);

//         updateFields.push("commodity = ?")
//         updateParams.push(commodity)

//         updateParams.push(freight_id);

//         const updateQuery = `UPDATE tbl_freight SET ${updateFields.join(", ")} WHERE id = ?`;

//         con.query(updateQuery, updateParams, (err, data) => {
//             if (err) {
//                 return res.status(500).send({
//                     success: false,
//                     message: err.message
//                 });
//             }
//             console.log(data);

//             if (data.affectedRows > 0) {
//                 // Handle document updates
//                 /*  if (req.files && req.files.document) {
//                      const docsInsertQuery = `update tbl_freight set add_attachment_file='${req.files.document[0].filename}' where id='${freight_id}'`;
//                      con.query(docsInsertQuery, (err, result) => {
//                          if (err) {
//                              console.error('Error inserting document data:', err);
//                              return res.status(500).json({
//                                  success: false,
//                                  message: "Internal Server Error"
//                              });
//                          }
//                      });
//                  } */
//                 /* if (req.files && req.files.supplier_invoice) {
//                     // Iterate over all uploaded files for 'supplier_invoice'
//                     const docsInsertQuery = `INSERT INTO freight_doc (freight_id, document_name, document) VALUES (?, ?, ?)`;

//                     req.files.supplier_invoice.forEach((file) => {
//                         con.query(docsInsertQuery, [freight_id, "Supplier Invoice", file.filename], (err, result) => {
//                             if (err) throw err;
//                         });
//                     })
//                 }
//                 if (req.files && req.files.packing_list) {
//                     const docsInsertQuery = `INSERT INTO freight_doc (freight_id, document_name, document) VALUES (?, ?, ?)`;

//                     req.files.packing_list.forEach((file) => {
//                         con.query(docsInsertQuery, [freight_id, "Packing List", file.filename], (err, result) => {
//                             if (err) throw err;
//                         });
//                     })
//                 }
//                 if (req.files && req.files.licenses) {
//                     const docsInsertQuery = `INSERT INTO freight_doc (freight_id, document_name, document) VALUES (?, ?, ?)`;

//                     req.files.licenses.forEach((file) => {
//                         con.query(docsInsertQuery, [freight_id, "Licenses", file.filename], (err, result) => {
//                             if (err) throw err;
//                         });
//                     })
//                 }
//                 if (req.files && req.files.other_documents) {
//                     const docsInsertQuery = `INSERT INTO freight_doc (freight_id, document_name, document) VALUES (?, ?, ?)`;

//                     req.files.other_documents.forEach((file) => {
//                         con.query(docsInsertQuery, [freight_id, "Other Documents", file.filename], (err, result) => {
//                             if (err) throw err;
//                         });
//                     })
//                 } */

//                 const selectQuery = `SELECT freight_number FROM tbl_freight WHERE id = ?`;

//                 con.query(selectQuery, [freight_id], (err, result) => {
//                     if (err) {
//                         console.error("Error fetching freight number:", err);
//                         return;
//                     }

//                     if (result.length === 0) {
//                         console.error("No freight number found for the given ID.");
//                         return;
//                     }

//                     const freightNumber = result[0].freight_number;
//                     console.log(freightNumber);

//                     // Process all files for a given document type
//                     const processFiles = async (fileArray, documentName) => {
//                         try {
//                             for (const file of fileArray) { // Loop through all files
//                                 const docsInsertQuery = `INSERT INTO freight_doc (freight_id, document_name, document) VALUES (?, ?, ?)`;

//                                 await new Promise((resolve, reject) => {
//                                     con.query(docsInsertQuery, [freight_id, documentName, file.filename], (err) => {
//                                         if (err) {
//                                             console.error(`Error inserting ${documentName}:`, err);
//                                             return reject(err);
//                                         }
//                                         resolve();
//                                     });
//                                 });

//                                 console.log(`🚀 Uploading file: ${file.originalname}`);

//                                 // Upload the file to Google Drive
//                                 /*   const folderId = await findOrCreateFolder(freightNumber);
//                                   console.log(`📂 Folder ID: ${folderId}`);
//                                   console.log(file);

//                                   const { fileId, webViewLink } = await uploadFile(folderId, file);

//                                   // Insert file details into transaction_files
//                                   const insertFileQuery = `
//                                    INSERT INTO transaction_files 
//                                    (freight_number, file_name, drive_file_id, file_link) 
//                                    VALUES (?, ?, ?, ?)
//                                `;

//                                   await new Promise((resolve, reject) => {
//                                       con.query(insertFileQuery, [freightNumber, file.filename, fileId, webViewLink], (err) => {
//                                           if (err) {
//                                               console.error("Error inserting file details:", err);
//                                               return reject(err);
//                                           }
//                                           resolve();
//                                       });
//                                   });

//                                   console.log(`✅ ${documentName}: ${file.originalname} uploaded and recorded successfully!`); */
//                                 const subfolderName = getFolderNameFromDocumentName(documentName); // returns "AD_Quotations" etc.

//                                 const uploadResult = await uploadToSpecificPath(
//                                     freightNumber,     // Main folder: e.g., "F-20250613"
//                                     "Supplier Invoices",      // Parent folder or fixed main type
//                                     subfolderName,     // Subfolder based on document type
//                                     file               // Current file
//                                 );
//                             }
//                         } catch (error) {
//                             console.error(`Error processing files for ${documentName}:`, error);
//                         }
//                     };

//                     const handleFileUploads = async () => {
//                         try {
//                             if (req.files) {
//                                 const fileKeys = Object.keys(req.files);

//                                 for (const key of fileKeys) {
//                                     const files = Array.isArray(req.files[key]) ? req.files[key] : [req.files[key]];

//                                     if (files.length > 0) {
//                                         const documentName = getDocumentName(key);
//                                         console.log(files, documentName, "📂 Files to process");

//                                         await processFiles(files, documentName);
//                                     }
//                                 }

//                                 console.log("✅ All files processed successfully!");
//                             }
//                         } catch (error) {
//                             console.error("Error handling file uploads:", error);
//                         }
//                     };
//                     // Map field names to document names
//                     const getDocumentName = (fieldName) => {
//                         console.log(fieldName);

//                         switch (fieldName) {
//                             case 'supplier_invoice':
//                                 return "Supplier Invoice";
//                             case 'packing_list':
//                                 return "Packing List";
//                             case 'licenses':
//                                 return "Licenses";
//                             case 'other_documents':
//                                 return "Other Documents";
//                             default:
//                                 return "Unknown Document";
//                         }
//                     };

//                     // Start processing all files
//                     handleFileUploads();
//                 });
//                 res.status(200).send({
//                     success: true,
//                     message: "Freight updated successfully"
//                 });
//             } else {
//                 res.status(400).send({
//                     success: false,
//                     message: "Failed to update Freight"
//                 });
//             }
//         });
//     } catch (error) {
//         res.status(500).send({
//             success: false,
//             message: error.message
//         });
//     }
// };

const UpdatefreightByCustomer = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    console.log(req.files);
    console.log(req.body);


    try {
        const {
            freight_id, client_id, product_desc, fcl_lcl, commodity, collection_from, freight, freight_type, shipment_ref, dimension, weight, user_type,
            shipment_origin, shipment_des, comment, no_of_packages, package_type, collection_address, delivery_address,
            nature_of_goods, delivery_to, port_of_loading, post_of_discharge, auto_calculate, add_attachments, sea_freight_option, road_freight_option, assign_for_estimate, insurance, quote_received, client_quoted, assign_to_transporter, send_to_warehouse, assign_warehouse, assign_to_clearing
        } = req.body;

        console.log("Files received:", req.files);

        let updateFields = [];
        let updateParams = [];

        if (client_id) {
            updateFields.push("client_id = ?");
            updateParams.push(client_id);
        }

        updateFields.push("product_desc = ?", "collection_from = ?", "freight = ?", "freight_type = ?",
            "shipment_origin = ?", "shipment_des = ?", "shipment_ref = ?", "dimension = ?", "weight = ?", "user_type = ?",
            "comment = ?", "no_of_packages = ?", "package_type = ?", "collection_address = ?", "delivery_address = ?",
            "nature_of_goods = ?", "delivery_to = ?", "port_of_loading = ?", "post_of_discharge = ?",
            "auto_calculate = ?", "add_attachments = ?", "sea_freight_option = ?", "road_freight_option = ?",
            "assign_for_estimate = ?", "insurance = ?", "quote_received = ?", "client_quoted = ?",
            "assign_to_transporter = ?", "send_to_warehouse = ?", "assign_warehouse = ?", "assign_to_clearing = ?",
            "fcl_lcl = ?", "commodity = ?");

        updateParams.push(
            product_desc, collection_from, freight, freight_type, shipment_origin, shipment_des, shipment_ref, dimension, weight,
            user_type, comment, no_of_packages, package_type, collection_address, delivery_address, nature_of_goods,
            delivery_to, port_of_loading, post_of_discharge, auto_calculate, add_attachments, sea_freight_option,
            road_freight_option, assign_for_estimate, insurance, quote_received, client_quoted, assign_to_transporter,
            send_to_warehouse, assign_warehouse, assign_to_clearing, fcl_lcl, commodity
        );

        updateParams.push(freight_id);

        const updateQuery = `UPDATE tbl_freight SET ${updateFields.join(", ")} WHERE id = ?`;

        con.query(updateQuery, updateParams, (err, data) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: err.message
                });
            }

            if (data.affectedRows === 0) {
                return res.status(400).send({
                    success: false,
                    message: "Failed to update Freight"
                });
            }

            const selectQuery = `SELECT freight_number FROM tbl_freight WHERE id = ?`;
            con.query(selectQuery, [freight_id], async (err, result) => {
                if (err || result.length === 0) {
                    return res.status(500).json({ success: false, message: "Could not retrieve freight number" });
                }

                const freightNumber = result[0].freight_number;

                try {
                    await findOrCreateFolder(freightNumber);

                    if (req.files && Object.keys(req.files).length > 0) {
                        for (const fieldName of Object.keys(req.files)) {
                            const filesArray = Array.isArray(req.files[fieldName]) ? req.files[fieldName] : [req.files[fieldName]];

                            for (const file of filesArray) {
                                const documentName = req.body.documentName || fieldName; // fallback to fieldName
                                await uploadToMatchingFolder(file, documentName, freightNumber);

                                const docQuery = `INSERT INTO freight_doc (freight_id, uploaded_by, document_name, document) VALUES (?, ?, ?, ?)`;
                                await new Promise((resolve, reject) => {
                                    con.query(docQuery, [freight_id, 2, documentName, file.filename], (err) => {
                                        if (err) return reject(err);
                                        resolve();
                                    });
                                });
                            }
                        }
                    }

                    return res.status(200).json({
                        success: true,
                        message: "Freight updated successfully"
                    });

                } catch (uploadErr) {
                    console.error("❌ Upload processing failed:", uploadErr);
                    return res.status(500).json({ success: false, message: uploadErr.message });
                }
            });
        });
    } catch (error) {
        console.error("❌ Unexpected error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Helper to map field names to document types
// function getDocumentName1(fieldName) {
//     switch (fieldName) {
//         case 'supplier_invoice':
//             return "Supplier Invoices";
//         case 'packing_list':
//             return "Packing List";
//         case 'licenses':
//             return "Licenses";
//         case 'other_documents':
//             return "Other Documents";
//         default:
//             return "Unknown Document";
//     }
// }

const GetNotificationUser = async (req, res) => {
    try {
        const { user_id } = req.body;
        if (!user_id) {
            res.status(400).send({
                success: false,
                message: "Please provide user id"
            });
        }
        else {
            const getNotificationsSql = `
            SELECT notification_details.*, tbl_notifications.title, tbl_notifications.description
            FROM notification_details
            INNER JOIN tbl_notifications ON notification_details.notification_id = tbl_notifications.id
            WHERE notification_details.user_id = ? AND tbl_notifications.is_deleted = ? AND notification_details.is_deleted = ?
            ORDER BY notification_details.created_at DESC;`;

            await con.query(getNotificationsSql, [user_id, 0, 0], (err, results) => {
                if (err) throw err;

                if (results.length > 0) {
                    let unseenCount = 0;
                    let foundLastSeen = false;

                    // Iterate through notifications in reverse order
                    for (let i = results.length - 1; i >= 0; i--) {
                        const notification = results[i];

                        if (notification.is_seen === 1) {
                            foundLastSeen = true; // Mark the last seen notification
                            unseenCount = 0; // Reset unseenCount when a seen notification is found
                        } else if (foundLastSeen) {
                            unseenCount++; // Count subsequent unseen notifications
                        }
                    }

                    // If no is_seen=1 found, count all messages
                    if (!foundLastSeen) {
                        unseenCount = results.length;
                    }

                    res.status(200).json({
                        success: true,
                        message: "",
                        data: results,
                        unseenCount: unseenCount
                    });
                } else {
                    res.status(200).json({
                        success: true,
                        message: "No notification found",
                        data: results,
                        unseenCount: 0
                    });
                }
            });
        }

    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
}

const updateNotificationSeen = async (req, res) => {
    try {
        const { user_id } = req.body;
        if (!user_id) {
            res.status(400).send({
                success: false,
                message: "Please provide user id"
            })
        }
        else {
            function getLastInsertedNotificationId(user_id, callback) {
                const query = `SELECT notification_details.id FROM  notification_details
                INNER JOIN tbl_notifications on tbl_notifications.id=notification_details.notification_id
                WHERE notification_details.user_id = ? and tbl_notifications.is_deleted='${0}' ORDER BY id DESC LIMIT 1`;
                /* SELECT tbl_notifications.id FROM tbl_notifications
                        INNER JOIN notification_details on notification_details.id=tbl_notifications.notification_id
                        WHERE tbl_notifications.user_id = ? and notification_details.is_deleted='${0}' ORDER BY id DESC LIMIT 1 */
                con.query(query, [user_id], (error, results) => {
                    if (error) throw error;
                    // console.log(results);

                    const lastInsertedNotificationId = results.length > 0 ? results[0].id : null;
                    callback(lastInsertedNotificationId);
                });
            }

            // Function to update is_seen status for a notification
            function markNotificationAsSeen(user_id, callback) {
                getLastInsertedNotificationId(user_id, (lastInsertedNotificationId) => {
                    if (!lastInsertedNotificationId) {
                        // console.log('No notifications found for the user.');
                        callback(false);
                        return;
                    }

                    const query = 'UPDATE notification_details SET is_seen = 1 WHERE id = ?';

                    con.query(query, [lastInsertedNotificationId], (error, results) => {
                        if (error) throw error;

                        const affectedRows = results.affectedRows;

                        callback(affectedRows > 0); // Returns true if the notification was updated, false otherwise
                    });
                });
            }
            markNotificationAsSeen(user_id, (notificationUpdated) => {
                if (notificationUpdated) {
                    //console.log(`Last notification for user ${user_id} marked as seen.`);
                    res.status(200).send({
                        success: true,
                        message: "Last notification marked as seen."
                    })
                } else {
                    //console.log(`No notifications found or last notification already seen for user ${user_id}.`);
                    res.status(400).send({
                        success: false,
                        message: "No notifications found or last notification already seen"
                    })
                }
            });
        }

    }
    catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        })
    }
}

const deleteOneNotification = async (req, res) => {
    try {
        const { notification_id } = req.body;
        if (!notification_id) {
            res.status(400).send({
                success: false,
                message: "Please provide notification id"
            })
        }
        else {
            const checkQuery = "SELECT is_deleted FROM notification_details WHERE id=?";

            con.query(checkQuery, [notification_id], (err, data) => {
                if (err) throw err;

                if (data.length > 0) {
                    const isAlreadyDeleted = data[0].is_deleted === 1;

                    if (isAlreadyDeleted) {
                        return res.status(400).send({
                            success: false,
                            message: "This notification is already deleted!"
                        });
                    } else {
                        const updateQuery = "UPDATE notification_details SET is_deleted=? WHERE id=?";

                        con.query(updateQuery, [1, notification_id], (err, data) => {
                            if (err) throw err;

                            return res.status(200).send({
                                success: true,
                                message: "Notification deleted successfully!"
                            });
                        });
                    }
                } else {
                    return res.status(400).send({
                        success: false,
                        message: "Id does not exist!"
                    });
                }
            });
        }

    } catch (error) {
        // console.error(error);
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

const DeleteAllNotification = async (req, res) => {
    try {
        const { user_id } = req.body;
        if (!user_id) {
            res.status(400).send({
                success: false,
                message: "Please provide user id"
            })
        }
        else {
            var sql = "update notification_details set is_deleted=? where user_id=?";
            await con.query(sql, [1, user_id], (err, data) => {
                if (err) throw err;
                // console.log(data);
                if (data.affectedRows > 0) {
                    res.status(200).send({
                        success: true,
                        message: "Notifications cleared successfully!"
                    })
                }
                else {
                    res.status(400).send({
                        success: false,
                        message: "Failed to clear Notifications"
                    })
                }
            })
        }
    }
    catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        })
    }
}

const AcceptQuotation = async (req, res) => {
    try {
        const { freight_id, user_id } = req.body;
        if (!freight_id || !user_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide freight id or user id"
            })
        }
        await con.query(`select * from tbl_freight where id='${freight_id}'`, (err, order_status) => {
            if (err) throw err;
            if (order_status.length > 0) {
                if (order_status[0].order_status == 0) {
                    con.query(`update tbl_freight set status='${5}', order_status='${1}' where id='${freight_id}'`, (err, data) => {
                        if (err) throw err;
                        if (data.affectedRows > 0) {
                            con.query('INSERT INTO tbl_orders (freight_id, client_id) VALUES (?, ?)', [freight_id, user_id], (err, result) => {
                                if (err) throw err;
                                // console.log(result.affectedRows);
                                var orderId = "OR000" + result.insertId;
                                con.query(`select * from tbl_users where id='${user_id}'`, (err, details) => {
                                    if (err) throw err;
                                    var username = details[0].full_name;
                                    var user_phoneNumber = `+918340721420` || details[0].cellphone || details[0].telephone
                                    const InsertQuery = `insert into tbl_notifications (title, description, send_to) values (?,?,?)`;
                                    con.query(InsertQuery, ["New Order Alert!", `Congratulations! User ${username} has placed a new order with Order ID: ${orderId}. Please Review Details and Proceed Accordingly.`, 5], (err, data) => {
                                        if (err) throw err;
                                        con.query(`select id from tbl_users where user_type='${1}'`, (err, id) => {
                                            if (err) throw err;
                                            const insertNotificationSql = 'INSERT INTO notification_details (user_id, notification_id) VALUES (?, ?)';
                                            con.query(insertNotificationSql, [id[0].id, data.insertId], (err, result) => {
                                                if (err) throw err;
                                            });
                                        })
                                    })//OR000
                                    const InsertQuery1 = `insert into tbl_notifications (title, description, send_to) values (?,?,?)`;
                                    con.query(InsertQuery, ["Order Confirmation", `
Dear Customer, your freight: ${order_status[0].freight_number} has been converted to an order. 
Thank you for your order. You can track your order using the following tracking number: ${orderId}`, 4], (err, data) => {
                                        if (err) throw err;
                                        const insertNotificationSql = 'INSERT INTO notification_details (user_id, notification_id) VALUES (?, ?)';
                                        con.query(insertNotificationSql, [user_id, data.insertId], (err, result) => {
                                            if (err) throw err;
                                        });

                                    })

                                    /*  01-09-2025
                                     const createDriveFolderOnly = async (req, res) => {
                                        try {
                                            const freightNumber = order_status[0].freight_number;

                                            if (!freightNumber) {
                                                return res.status(400).json({ message: "Missing freightNumber in request body" });
                                            }

                                            const folderId = await findOrCreateFolder(freightNumber);

                                        } catch (error) {
                                            console.error("Error creating folder:", error);
                                        }
                                    };
                                    createDriveFolderOnly() */
                                    // let Email = SMTP_MAIL;
                                    const mailSubject = `Order Confirmation by ${username}`;
                                    const content = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; background-color: #f9f9f9;">
  <h2 style="color: #2c3e50; border-bottom: 1px solid #ccc; padding-bottom: 10px;">Order Details</h2>

  <p style="font-size: 16px; color: #333;">
    <strong>Client Name:</strong> ${details[0].full_name}<br>
    <strong>Client Email:</strong> ${details[0].email}<br>
    <strong>Freight Number:</strong> ${order_status[0].freight_number}<br>
    <strong>Order Number:</strong> ${orderId}<br>
    <strong>Goods Description:</strong> ${order_status[0].product_desc}<br>
    <strong>Freight:</strong> ${order_status[0].freight}<br>
    <strong>Weight (Kgs):</strong> ${order_status[0].dimension}<br>
    <strong>Dimensions (CBM):</strong> ${order_status[0].weight}<br>
  </p>

  <p style="font-size: 16px; color: #333;">
    Your order has been successfully confirmed. We will keep you updated with further processing and shipping details.
  </p>

  <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">

  <p style="font-size: 14px; color: #777;">
    Regards,<br>
    <strong>Management System</strong>
  </p>
</div>
`;
                                    // sendMail(Email, mailSubject, content);

                                    const message = `*New Shipment Booking*\n\nA new shipment from client ${details[0].full_name} for Freight number ${order_status[0].freight_number} has been confirmed.\nPlease arrange booking.`;

                                    const getOperationPhonesQuery = `SELECT cellphone, telephone FROM tbl_users WHERE user_type = 2 AND FIND_IN_SET(2, assigned_roles) AND is_deleted=0 AND status=1`;

                                    con.query(getOperationPhonesQuery, (err, result) => {
                                        if (err) {
                                            console.error('Failed to fetch operations team:', err);
                                            return res.status(500).send({
                                                success: false,
                                                message: 'Internal server error while notifying operations team.'
                                            });
                                        }
                                        console.log("result");

                                        if (result.length === 0) {
                                            console.warn('No operations team phone numbers found.');
                                        } else {
                                            result.forEach((row) => {
                                                const phone = row.cellphone || row.telephone;
                                                // 05-06-2025
                                                /* sendWhatsApp(phone, message); */
                                                console.log("send");

                                            });
                                            // Notify Sales Person
                                            const salesQuery = `SELECT tbl_freight.*, tbl_users.full_name as sales_name, tbl_users.email as sales_email, tbl_users.cellphone as sales_cellphone, tbl_users.telephone as sales_telephone
                                            FROM tbl_freight INNER JOIN tbl_users ON tbl_users.id = tbl_freight.client_id WHERE tbl_freight.id = ?`;

                                            con.query(salesQuery, [freight_id], (err, result) => {
                                                if (err) {
                                                    console.error('Failed to fetch sales person:', err);
                                                } else if (result.length > 0) {
                                                    const user = result[0];
                                                    console.log(user);

                                                    const phone = user.cellphone || user.telephone;
                                                    // 05-06-2025
                                                    /* if (phone) sendWhatsApp(phone, message); */
                                                    if (user.email) sendMail(user.email, mailSubject, content);
                                                } else {
                                                    console.warn('No sales person found for the provided freight ID.');
                                                }

                                                // Notify Booking Team
                                                const bookingQuery = `SELECT full_name, email, cellphone, telephone FROM tbl_users WHERE user_type = 2 AND FIND_IN_SET(6, assigned_roles) AND is_deleted = 0 AND status = 1`;
                                                con.query(bookingQuery, (err, bookingUsers) => {
                                                    if (err) {
                                                        console.error('Failed to fetch booking team:', err);
                                                    } else {
                                                        console.log(bookingUsers);

                                                        bookingUsers.forEach((user) => {
                                                            const phone = user.cellphone || user.telephone;
                                                            // 05-06-2025
                                                            /* if (phone) sendWhatsApp(phone, message); */
                                                            if (user.email) sendMail(user.email, mailSubject, content);
                                                        });
                                                    }

                                                    // Final response
                                                    return res.status(200).send({
                                                        success: true,
                                                        message: "Accept quotation successfully"
                                                    });
                                                });
                                            });

                                        }
                                    });
                                })
                            })
                        }
                        else {
                            res.status(400).send({
                                success: false,
                                message: "Failed to Accept quotation"
                            })
                        }
                    })
                }
                else if (order_status[0].order_status == 2) {
                    res.status(400).send({
                        success: false,
                        message: "Quotation is already decliend"
                    })
                }
                else {
                    res.status(400).send({
                        success: false,
                        message: "Quotation is already accepted"
                    })
                }
            }
            else {
                res.status(400).send({
                    success: false,
                    message: "Freight id doesn't exist"
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

const GetShipEstimate = async (req, res) => {
    try {
        const { freight_id } = req.body;
        if (!freight_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide freight id"
            })
        }
        await con.query(`select shipping_estimate.*, shipping_estimate.id as esimate_id, tbl_users.*, tbl_users.id as user_id, tbl_freight.*, tbl_freight.id as freight_id from shipping_estimate 
        INNER JOIN tbl_freight on tbl_freight.id=shipping_estimate.freight_id
        INNER JOIN tbl_users on tbl_users.id=shipping_estimate.client_id
        where shipping_estimate.freight_id=?`, [freight_id], (err, data) => {
            if (err) throw err;
            if (data.length > 0) {
                if (data[0].is_assigned == 0) {
                    res.status(400).send({
                        success: false,
                        message: "Quotation has not been assigned to you"
                    })
                }
                else {
                    res.status(200).send({
                        success: true,
                        data: data[0]
                    })
                }
            }
            else {
                res.status(400).send({
                    success: false,
                    message: "freight id doesn't exist"
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

const RejectQuotation = async (req, res) => {
    try {
        const { freight_id } = req.body;
        if (!freight_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide freight id"
            })
        }
        console.log(req.body);
        await con.query(`select * from tbl_freight where id='${freight_id}'`, (err, order_status) => {
            if (err) throw err;
            if (order_status.length > 0) {
                // console.log(order_status[0]);
                if (order_status[0].order_status == 0) {
                    con.query(`update tbl_freight set status='${6}', order_status='${2}' where id='${freight_id}'`, (err, data) => {
                        if (err) throw err;
                        if (data.affectedRows > 0) {
                            /* con.query('INSERT INTO tbl_orders (freight_id, user_id) VALUES (?, ?)', [freight_id, user_id], (err, result) => {
                                if (err) throw err;
                                // Handle the result or perform any other necessary actions.
                            }); */
                            con.query(`select * from tbl_users where id='${order_status[0].client_id}'`, (err, details) => {
                                if (err) throw err;
                                var username = details[0].full_name;
                                const InsertQuery = `insert into tbl_notifications (title, description, send_to) values (?,?,?)`;
                                con.query(InsertQuery, ["Quotation Declined", `Dear Admin, User ${username} has declined the quotation for freight number: ${order_status[0].freight_number}.`, 5], (err, data) => {
                                    if (err) throw err;
                                    con.query(`select id from tbl_users where user_type='${1}'`, (err, id) => {
                                        if (err) throw err;
                                        const insertNotificationSql = 'INSERT INTO notification_details (user_id, notification_id) VALUES (?, ?)';
                                        con.query(insertNotificationSql, [id[0].id, data.insertId], (err, result) => {
                                            if (err) throw err;
                                        });
                                    })
                                })
                            })

                            res.status(200).send({
                                success: true,
                                message: "Reject quotation successfully"
                            })
                        }
                        else {
                            res.status(400).send({
                                success: false,
                                message: "Failed to Reject quotation"
                            })
                        }
                    })
                }
                else if (order_status[0].order_status == 1) {
                    res.status(400).send({
                        success: false,
                        message: "Quotation is already accepted"
                    })
                }
                else {
                    res.status(400).send({
                        success: false,
                        message: "Quotation is already decliend"
                    })
                }
            }
            else {
                res.status(400).send({
                    success: false,
                    message: "Freight id doesn't exist"
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

const orderDetails = async (req, res) => {
    try {
        const { user_id, origin, destination, startDate, endDate, freightType, freightSpeed } = req.body;

        if (!user_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide user id"
            });
        }

        // Construct the base query and condition
        let condition = `WHERE tbl_orders.client_id = ? ORDER BY tbl_orders.created_at DESC`;
        let params = [user_id];

        if (origin) {
            condition += ` AND tbl_freight.collection_from = ?`;
            params.push(origin);
        }

        if (destination) {
            condition += ` AND tbl_freight.delivery_to = ?`;
            params.push(destination);
        }

        if (startDate && endDate) {
            condition += ` AND tbl_orders.created_at BETWEEN ? AND ?`;
            params.push(startDate, endDate);
        }

        if (freightType) {
            condition += ` AND tbl_freight.freight = ?`;
            params.push(freightType);
        }

        if (freightSpeed) {
            condition += ` AND tbl_freight.type = ?`;
            params.push(freightSpeed);
        }

        const query = `
                SELECT tbl_orders.*, wa.id AS warehouse_assign_order_id, 
                       tbl_orders.id AS ORDER_ID, 
                       CONCAT('OR000', tbl_orders.id) AS order_id, 
                       tbl_freight.*, tbl_freight.id AS freight_id, 
                       tbl_users.*, 
                       c.name AS collection_from_country, 
                       co.name AS delivery_to_country, 
                       cm.name AS commodity_name,
                       c.flag_url AS collection_from_country_flag_url, 
                       co.flag_url AS delivery_to_country_flag_url
                FROM tbl_orders
                INNER JOIN tbl_freight ON tbl_freight.id = tbl_orders.freight_id
                INNER JOIN tbl_users ON tbl_users.id = tbl_orders.client_id
                LEFT JOIN countries AS co ON co.id = tbl_freight.delivery_to
                LEFT JOIN tbl_commodity AS cm ON cm.id = tbl_freight.commodity
                LEFT JOIN countries AS c ON c.id = tbl_freight.collection_from
                LEFT JOIN warehouse_assign_order AS wa ON wa.order_id = tbl_orders.id
                ${condition}
            `;

        con.query(query, params, (err, data) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: err.message
                });
            }

            if (data.length > 0) {
                res.status(200).send({
                    success: true,
                    data: data
                });
            } else {
                res.status(400).send({
                    success: false,
                    message: "Order list not available"
                });
            }
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
};


const UserforgotPassword = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    try {
        const { email } = req.body;
        let sql = "SELECT * FROM tbl_users WHERE email=?";
        await con.query(sql, [email], (err, data) => {
            if (err) throw err;
            if (data.length < 1) {
                res.status(400).send({
                    success: false,
                    msg: "Email doesn't exist !"
                })
            }
            else {
                Email = data[0].email;
                mailSubject = "Forgot Password";
                const randomToken = rendomString.generate();
                content = `<table cellspacing="0" border="0" cellpadding="0" width="100%" bgcolor="#f2f3f8"
                style="@import url(https://fonts.googleapis.com/css?family=Rubik:300,400,500,700|Open+Sans:300,400,600,700); font-family: 'Open Sans', sans-serif;">
                <tr>
                    <td>
                        <table style="background-color: #f2f3f8; max-width:670px;  margin:0 auto;" width="100%" border="0"
                            align="center" cellpadding="0" cellspacing="0">
                            <tr>
                                <td style="height:80px;">&nbsp;</td>
                            </tr>
                            
                            <tr>
                                <td style="height:20px;">&nbsp;</td>
                            </tr>
                            <tr>
                                <td>
                                    <table width="95%" border="0" align="center" cellpadding="0" cellspacing="0"
                                        style="max-width:670px;background:#fff; border-radius:3px; text-align:center;-webkit-box-shadow:0 6px 18px 0 rgba(0,0,0,.06);-moz-box-shadow:0 6px 18px 0 rgba(0,0,0,.06);box-shadow:0 6px 18px 0 rgba(0,0,0,.06);">
                                        <tr>
                                            <td style="height:40px;">&nbsp;</td>
                                        </tr>
                                        <tr>
                                            <td style="padding:0 35px;">
                                                <h1 style="color:#1e1e2d; font-weight:500; margin:0;font-size:29px;font-family:'Rubik',sans-serif;">You have
                                                    requested to reset your password</h1>
                                                
                                                <span
                                                    style="display:inline-block; vertical-align:middle; margin:19px 0 26px; border-bottom:1px solid #cecece; width:100px;"></span>
                                                    <h3 style="text-align: left;">Hi, ${data[0].full_name}</h3>
                                                    <p style="color:#455056; font-size:15px;line-height:24px; margin:0;">
                                                    We cannot simply send you your old password. A unique link to reset your
                                                    password has been generated for you. To reset your password, click the
                                                    following link and follow the instructions.
                                                </p>
                                                <a href="http://ship.asiadirect.africa/ResetPassword?token='${randomToken}'"
                                                    style="background:#20e277;text-decoration:none !important; font-weight:500; margin-top:35px; color:#fff;text-transform:uppercase; font-size:14px;padding:10px 24px;display:inline-block;border-radius:50px;">Reset
                                                    Password</a>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="height:40px;">&nbsp;</td>
                                        </tr>
                                        <tr>
                                             <td><p style="color:#455056; font-size:15px;line-height:24px; margin:0;">If you did not forgot your password, please ignore this email and have a lovely day.</p></td>
                                        </tr>
                                        <tr>
                                            <td style="height:40px;">&nbsp;</td>
                                        </tr>
                                        <tr>
                                             <td style="padding:0 35px;"> <p style="color:#455056; font-size:13px;line-height:22px; margin:0;">If the above button doesn't work, you can reset your password by clicking the following link, <a href="http://localhost:3001/reset-password?token='${randomToken}'">Reset Password</a></p> 
                                             </td>
                                        </tr>
                                        <tr>
                                            <td style="height:80px;">&nbsp;</td>
                                        </tr>
                                    </table>
                                </td>
                            <tr>
                                <td style="height:20px;">&nbsp;</td>
                            </tr>
                            <tr>
                                <td style="text-align:center;">
                                    <p style="font-size:14px; color:rgba(69, 80, 86, 0.7411764705882353); line-height:18px; margin:0 0 0;">&copy; <strong>AsiaDirect</strong></p>
                                </td>
                            </tr>
                            <tr>
                                <td style="height:80px;">&nbsp;</td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>`
                //content = 'Hi ' + data[0].first_name + ', <p> Please click the below button to reset your password. </p> <p> <span style="background: #6495ED; padding: 5px;"> <a style="color: white; text-decoration: none;  font-weight: 600;" href="http://localhost:3001/reset-password?token=' + randomToken + '">Click Here </a> </span> </p>';
                sendMail(Email, mailSubject, content);
                token = randomToken;
                let delTokenQuery = "DELETE FROM resetpassword_token WHERE email = ?";
                con.query(delTokenQuery, [data[0].email], (err, data1) => {
                    if (err) throw err;
                });
                con.query(`insert into resetpassword_token (token, email) values('${token}','${Email}')`, (err, presult) => {
                    if (err) throw err;
                    res.status(200).send({
                        success: true,
                        msg: "Check your email a password reset email was sent.",
                        token: token
                    })
                })
            }
        })
    } catch (error) {
        res.status(400).send({
            success: false,
            msg: error.message
        })
    }
}

const UserResetPassword = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    try {
        console.log(req.query.token);
        const { newPassword, confirmPassword } = req.body;
        let password = await hashPassword(newPassword);
        let sql = "Select * from resetpassword_token where token= ?";
        await con.query(sql, [req.query.token], (err, data) => {
            if (err) throw err;
            if (data.length < 1) {
                res.status(400).send({
                    success: false,
                    msg: "This link has been expired !"
                })
            }
            else {
                let sql = "Select * from tbl_users where email=?";
                con.query(sql, [data[0].email], (err, newdata) => {
                    if (err) throw err;
                    if (newdata.length >= 1) {
                        if (newPassword != confirmPassword) {
                            res.status(400).send({
                                success: false,
                                msg: "new password and confirm password do not match !"
                            })
                        }
                        else {
                            let delTokenQuery = "DELETE FROM resetpassword_token WHERE email = ?";
                            con.query(delTokenQuery, [newdata[0].email], (err, data1) => {
                                if (err) throw err;
                            });
                            let updateQuery = "UPDATE tbl_users SET password = ? WHERE email = ?";
                            con.query(updateQuery, [password, newdata[0].email], (err, data1) => {
                                if (err) throw err;
                                if (data1.affectedRows < 1) {
                                    res.status(400).send({
                                        success: false,
                                        msg: "Password Not Reset !"
                                    })
                                }
                                else {
                                    res.status(200).send({
                                        success: true,
                                        msg: "Password Reset Successfully  !"
                                    })
                                }
                            });
                        }
                    }
                })
            }
        })
    }
    catch (error) {
        res.status(500).send({
            success: false,
            msg: error.message
        })
    }
}

const findHsCode = async (req, res) => {
    try {
        const { hs_code } = req.body;
        if (!hs_code) {
            return res.status(400).send({
                success: false,
                message: "Please Provide Hs Code"
            })
        }
        const sqlQuery = `select * from tbl_hs_code where hs_cod='${hs_code}'`;
        await con.query(sqlQuery, (err, data) => {
            if (err) throw err;
            if (data.length > 0) {
                res.status(200).send({
                    success: true,
                    data: data[0]
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

const getListClearanceQuotation = async (req, res) => {
    try {
        const { clearance_id } = req.body;
        const sqlQuery = `SELECT * FROM estimate_clearance WHERE clearance_id='${clearance_id}' ORDER BY created_at DESC;`;
        await con.query(sqlQuery, (err, data) => {
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

//const saveClearanceQuotation

/* const uploadClrearanceDOC = async (req, res) => {
    try {
        const { clearance_id } = req.body;
        if (req.files && req.files.supplier_invoice) {
            con.query(`update tbl_clearance set supplier_invoice='${req.files.supplier_invoice[0].filename}' where id='${clearance_id}'`, (err, data) => {
                if (err) throw err;
            })
            const selectQuery = `SELECT clearance_number FROM tbl_clearance WHERE id = ?`;

            con.query(selectQuery, [clearance_id], async (err, result) => {
                if (err) {
                    console.error("Error fetching freight number:", err);
                    return;
                }
                const clearanceNumber = result[0].clearance_number;
                const Subfolder = "Supplier Invoices"
                // const folderId = await findOrCreateFolder(clearanceNumber, Subfolder);
                // console.log(`📂 Folder ID: ${folderId}`);
                // console.log(file);

                // const { fileId, webViewLink } = await uploadFile(folderId.subfolderId, req.files.supplier_invoice[0]);
            })
        }
        if (req.files && req.files.packing_list) {
            con.query(`update tbl_clearance set packing_list='${req.files.packing_list[0].filename}' where id='${clearance_id}'`, (err, data) => {
                if (err) throw err;
            })
        }
        if (req.files && req.files.proof_of_payment) {
            con.query(`update tbl_clearance set proof_of_payment='${req.files.proof_of_payment[0].filename}' where id='${clearance_id}'`, (err, data) => {
                if (err) throw err;
            })
            const uploadResult = await uploadToSpecificPath(
                freightNumber,     // Main folder: e.g., "F-20250613"
                "Supplier Invoices",      // Parent folder or fixed main type
                subfolderName,     // Subfolder based on document type
                file               // Current file
            );

        }
        if (req.files && req.files.waybill) {
            con.query(`update tbl_clearance set waybill='${req.files.waybill[0].filename}' where id='${clearance_id}'`, (err, data) => {
                if (err) throw err;
            })
            const uploadResult = await uploadToSpecificPath(
                freightNumber,     // Main folder: e.g., "F-20250613"
                "Supplier Invoices",      // Parent folder or fixed main type
                subfolderName,     // Subfolder based on document type
                file               // Current file
            );

        }
        if (req.files && req.files.bill_of_lading) {
            con.query(`update tbl_clearance set bill_of_lading='${req.files.bill_of_lading[0].filename}' where id='${clearance_id}'`, (err, data) => {
                if (err) throw err;
            })
            const uploadResult = await uploadToSpecificPath(
                freightNumber,     // Main folder: e.g., "F-20250613"
                "Supplier Invoices",      // Parent folder or fixed main type
                subfolderName,     // Subfolder based on document type
                file               // Current file
            );

        }
        if (req.files && req.files.product_brochures) {
            con.query(`update tbl_clearance set product_brochures='${req.files.product_brochures[0].filename}' where id='${clearance_id}'`, (err, data) => {
                if (err) throw err;
            })
            const uploadResult = await uploadToSpecificPath(
                freightNumber,     // Main folder: e.g., "F-20250613"
                "Supplier Invoices",      // Parent folder or fixed main type
                subfolderName,     // Subfolder based on document type
                file               // Current file
            );

        }
        if (req.files && req.files.arrival_notification) {
            con.query(`update tbl_clearance set arrival_notification='${req.files.arrival_notification[0].filename}' where id='${clearance_id}'`, (err, data) => {
                if (err) throw err;
            })
            const uploadResult = await uploadToSpecificPath(
                freightNumber,     // Main folder: e.g., "F-20250613"
                "Supplier Invoices",      // Parent folder or fixed main type
                subfolderName,     // Subfolder based on document type
                file               // Current file
            );

        }
        if (req.files && req.files.product_literature) {
            con.query(`update tbl_clearance set product_literature='${req.files.product_literature[0].filename}' where id='${clearance_id}'`, (err, data) => {
                if (err) throw err;
            })
            const uploadResult = await uploadToSpecificPath(
                freightNumber,     // Main folder: e.g., "F-20250613"
                "Supplier Invoices",      // Parent folder or fixed main type
                subfolderName,     // Subfolder based on document type
                file               // Current file
            );

        }
        if (req.files && req.files.letter_of_authority) {
            con.query(`update tbl_clearance set letter_of_authority='${req.files.letter_of_authority[0].filename}' where id='${clearance_id}'`, (err, data) => {
                if (err) throw err;
            })
            const uploadResult = await uploadToSpecificPath(
                freightNumber,     // Main folder: e.g., "F-20250613"
                "Supplier Invoices",      // Parent folder or fixed main type
                subfolderName,     // Subfolder based on document type
                file               // Current file
            );

        }
        res.status(200).send({
            success: true,
            message: "upload successfully"
        })
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        })
    }
}
 */

const uploadClrearanceDOC = async (req, res) => {
    try {
        const { clearance_id } = req.body;

        // Step 1: Get clearance details
        const [clearanceRow] = await new Promise((resolve, reject) => {
            con.query(`SELECT clearance_number, freight_id FROM tbl_clearance WHERE id = ?`, [clearance_id], (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });

        let folderName = clearanceRow.clearance_number;

        // If freight_id exists, get freight_number
        if (clearanceRow.freight_id) {
            const [freightRow] = await new Promise((resolve, reject) => {
                con.query(`SELECT freight_number FROM tbl_freight WHERE id = ?`, [clearanceRow.freight_id], (err, result) => {
                    if (err) return reject(err);
                    resolve(result);
                });
            });
            folderName = freightRow.freight_number;
        }

        const mainFolder = folderName;
        const subFolder = "Supplier Invoices";

        if (req.files && req.files.supplier_invoice) {
            const file = req.files.supplier_invoice[0];
            con.query(`UPDATE tbl_clearance SET supplier_invoice = ? WHERE id = ?`, [file.filename, clearance_id], (err) => {
                if (err) throw err;
            });
            await uploadToSpecificPath(mainFolder, subFolder, "Invoice, Packing List", file);
        }

        if (req.files && req.files.packing_list) {
            const file = req.files.packing_list[0];
            con.query(`UPDATE tbl_clearance SET packing_list = ? WHERE id = ?`, [file.filename, clearance_id], (err) => {
                if (err) throw err;
            });
            await uploadToSpecificPath(mainFolder, subFolder, "Invoice, Packing List", file);
        }

        if (req.files && req.files.proof_of_payment) {
            const file = req.files.proof_of_payment[0];
            con.query(`UPDATE tbl_clearance SET proof_of_payment = ? WHERE id = ?`, [file.filename, clearance_id], (err) => {
                if (err) throw err;
            });
            await uploadToSpecificPath(mainFolder, subFolder, "Invoice, Packing List", file);
        }

        if (req.files && req.files.waybill) {
            const file = req.files.waybill[0];
            con.query(`UPDATE tbl_clearance SET waybill = ? WHERE id = ?`, [file.filename, clearance_id], (err) => {
                if (err) throw err;
            });
            await uploadToSpecificPath(mainFolder, "Freight documents", "Waybill", file);
        }

        if (req.files && req.files.bill_of_lading) {
            const file = req.files.bill_of_lading[0];
            con.query(`UPDATE tbl_clearance SET bill_of_lading = ? WHERE id = ?`, [file.filename, clearance_id], (err) => {
                if (err) throw err;
            });
            await uploadToSpecificPath(mainFolder, "Freight documents", "Waybill", file);
        }

        if (req.files && req.files.product_brochures) {
            const file = req.files.product_brochures[0];
            con.query(`UPDATE tbl_clearance SET product_brochures = ? WHERE id = ?`, [file.filename, clearance_id], (err) => {
                if (err) throw err;
            });
            await uploadToSpecificPath(mainFolder, subFolder, "Invoice, Packing List", file);
        }

        if (req.files && req.files.arrival_notification) {
            const file = req.files.arrival_notification[0];
            con.query(`UPDATE tbl_clearance SET arrival_notification = ? WHERE id = ?`, [file.filename, clearance_id], (err) => {
                if (err) throw err;
            });
            await uploadToSpecificPath(mainFolder, subFolder, "Invoice, Packing List", file);
        }

        if (req.files && req.files.product_literature) {
            const file = req.files.product_literature[0];
            con.query(`UPDATE tbl_clearance SET product_literature = ? WHERE id = ?`, [file.filename, clearance_id], (err) => {
                if (err) throw err;
            });
            await uploadToSpecificPath(mainFolder, subFolder, "Product Literature", file);
        }

        if (req.files && req.files.letter_of_authority) {
            const file = req.files.letter_of_authority[0];
            con.query(`UPDATE tbl_clearance SET letter_of_authority = ? WHERE id = ?`, [file.filename, clearance_id], (err) => {
                if (err) throw err;
            });
            await uploadToSpecificPath(mainFolder, subFolder, "Letters of authority", file);
        }

        res.status(200).send({
            success: true,
            message: "Upload successful"
        });

    } catch (error) {
        console.error("Upload error:", error);
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

const CleranceOrderList = async (req, res) => {
    try {
        const { user_id } = req.body;
        // console.log(req.body);

        if (!user_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide user id"
            })
        }
        const query = `
  SELECT 
    clearance_order.*, 
    clearance_order.id AS clearance_id, 
    tbl_clearance.*, 
    tbl_users.full_name as client_name, 
    c.name AS port_of_entry_name, 
    co.name AS port_of_exit_name
  FROM clearance_order
  INNER JOIN tbl_clearance 
    ON tbl_clearance.id = clearance_order.clearance_id
  INNER JOIN tbl_users 
    ON clearance_order.user_id = tbl_users.id
  LEFT JOIN countries AS c 
    ON c.id = tbl_clearance.loading_country
  LEFT JOIN countries AS co 
    ON co.id = tbl_clearance.discharge_country
  WHERE clearance_order.user_id = '${user_id}'
  ORDER BY clearance_order.created_at DESC;`;
        // Now you can execute the query with your MySQL connection
        con.query(query, (error, data, fields) => {
            if (error) {
                console.error('Error executing query:', error);
                return;
            }

            if (data.length > 0) {
                res.status(200).send({
                    success: true,
                    data: data
                });
            } else {
                res.status(400).send({
                    success: false,
                    message: "Clerance Order list not available"
                });
            }
        });

    }
    catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        })
    }
}

const addQueries = async (req, res) => {
    try {
        const { name, user_id, freight_no, nature_of_Heading, subject, message } = req.body;

        if (!name || !user_id || !freight_no || !nature_of_Heading || !subject || !message) {
            return res.status(400).send({
                success: false,
                message: "All Fields are Required",
            });
        }

        const currentYear = new Date().getFullYear();
        let newDisputeNumber = 1;
        let disputeId = `D-${currentYear}${newDisputeNumber}`;

        con.query("SELECT Dispute_ID FROM tbl_queries ORDER BY id DESC LIMIT 1", (err, result) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: "Database error while fetching last Dispute_ID",
                    error: err.message,
                });
            }

            if (result.length > 0 && result[0].Dispute_ID) {
                const match = result[0].Dispute_ID.match(/^D-(\d{4})(\d+)$/);
                if (match) {
                    const lastYear = parseInt(match[1], 10);
                    const lastNumber = parseInt(match[2], 10);
                    if (lastYear === currentYear) {
                        newDisputeNumber = lastNumber + 1;
                    }
                }
            }

            disputeId = `D-${currentYear}${newDisputeNumber}`;

            con.query(
                "INSERT INTO tbl_queries (Dispute_ID, user_id, name, freight_no, nature_of_Heading, subject, message, outcome) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                [disputeId, user_id, name, freight_no, nature_of_Heading, subject, message, "Pending"],
                (insertErr) => {
                    if (insertErr) {
                        return res.status(500).send({
                            success: false,
                            message: "Failed to insert query",
                            error: insertErr.message,
                        });
                    }

                    const emailSubject = `New Dispute Lodged - ${disputeId}`;
                    const emailContent = `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; background-color: #f9f9f9;">
                            <h2 style="color: #2c3e50; border-bottom: 1px solid #ccc; padding-bottom: 10px;">New Dispute Created</h2>
                            <p style="font-size: 16px; color: #333;">
                              Hello Support/Accounts,<br><br>
                              A new dispute <strong>${disputeId}</strong> has been lodged in the system.<br>
                              Please review and take necessary action.
                            </p>
                            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                            <p style="font-size: 14px; color: #777;">
                              Regards,<br>
                              <strong>Management System</strong>
                            </p>
                        </div>
                    `;

                    const notificationMessage = `Dispute ${disputeId} has been lodged.\nRaised By: ${name}\nFreight Number: ${freight_no}`;

                    // 🔍 Fetch accounts & support team members
                    const queryTeam = `
    SELECT email, cellphone FROM tbl_users 
    WHERE user_type = 2
      AND (FIND_IN_SET(5, assigned_roles) OR FIND_IN_SET(8, assigned_roles))
      AND is_deleted = 0 
      AND status = 1
`;

                    con.query(queryTeam, async (err, teamMembers) => {
                        if (err) {
                            console.error("Failed to fetch team members", err);
                            return res.status(500).send({
                                success: false,
                                message: "Query inserted, but failed to notify team.",
                            });
                        }

                        for (const member of teamMembers) {
                            if (member.email) await sendMail(member.email, emailSubject, emailContent);
                            if (member.cellphone) {
                                const phone = member.cellphone.startsWith("+") ? member.cellphone : `+${member.cellphone}`;
                                // 05-06-2025
                                /* await sendSms(phone, notificationMessage);
                                await sendWhatsApp(phone, notificationMessage); */
                            }
                        }

                        return res.status(200).send({
                            success: true,
                            message: "Your query has been received. Our team will get back to you shortly.",
                            disputeId,
                        });
                    });
                }
            );
        });

    } catch (error) {
        console.error("Unexpected Error:", error);
        res.status(500).send({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

const updateQuery = async (req, res) => {
    try {
        const { id, outcome, resolution } = req.body;

        if (!id) {
            return res.status(400).send({
                success: false,
                message: "Please provide ID"
            });
        }

        con.query(
            `UPDATE tbl_queries 
             SET outcome = ?, resolution = ?
             WHERE id = ?`,
            [outcome, resolution, id],
            (err, result) => {
                if (err) {
                    throw err;
                }
                if (result.affectedRows === 0) {
                    return res.status(404).send({
                        success: false,
                        message: "Query not found"
                    });
                }
                return res.status(200).send({
                    success: true,
                    message: "Your query has been updated successfully."
                });
            }
        );
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
};


const getQueries = async (req, res) => {
    try {
        con.query(`select * from tbl_queries ORDER BY created DESC`, (err, result) => {
            if (err) throw err;
            res.status(200).send({
                success: true,
                message: "Get All Queries",
                data: result
            })
        })
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        })
    }
}

const getQueriesByUserId = async (req, res) => {
    try {
        const { user_id } = req.body; // Assuming user_id is passed in the request body

        if (!user_id) {
            return res.status(400).send({
                success: false,
                message: "User ID is required",
            });
        }

        con.query(
            `SELECT * FROM tbl_queries WHERE user_id = ? ORDER BY created DESC`,
            [user_id],
            (err, result) => {
                if (err) {
                    return res.status(500).send({
                        success: false,
                        message: "Database query error",
                        error: err.message,
                    });
                }

                if (result.length === 0) {
                    return res.status(404).send({
                        success: false,
                        message: "No queries found for this user",
                        data: [],
                    });
                }

                res.status(200).send({
                    success: true,
                    message: "Queries retrieved successfully",
                    data: result,
                });
            }
        );
    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};


const deleteQueries = async (req, res) => {
    try {
        const { query_id } = req.body;
        con.query(`DELETE from tbl_queries Where id='${query_id}'`, (err, result) => {
            if (err) throw err;
            res.status(200).send({
                success: true,
                message: "Query Deleted Successfully"
            })
        })
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        })
    }
}

const addCommodity = async (req, res) => {
    try {
        const { name } = req.body;

        // Check if the name already exists in a case-insensitive manner
        con.query(`SELECT * FROM tbl_commodity WHERE LOWER(name) = LOWER(?)`, [name], (err, result) => {
            if (err) {
                throw err;
            }

            if (result.length > 0) {
                // Name already exists, return an error response
                return res.status(400).send({
                    success: false,
                    message: "Commodity name already exists"
                });
            }

            // Insert the new name into the table
            con.query(`INSERT INTO tbl_commodity (name) VALUES (?)`, [name], (err, result) => {
                if (err) {
                    throw err;
                }

                res.status(200).send({
                    success: true,
                    message: "Commodity added successfully"
                });
            });
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
};


const getCommodities = async (req, res) => {
    try {
        // Fetch all commodities
        con.query(`SELECT * FROM tbl_commodity ORDER BY name ASC`, (err, result) => {
            if (err) {
                throw err;
            }

            // Send the fetched data
            res.status(200).send({
                success: true,
                data: result,
                message: "Commodities fetched successfully"
            });
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
};
/* const AddShipment = async (req, res) => {
    try {
        const {
            freight_id,
            waybill,
            carrier,
            vessel,
            container,
            destination,
            date_of_dispatch,
            agent,
            forwarding_agent,
        } = req.body;

        const checkWaybillQuery = `SELECT * FROM batches WHERE waybill = ? AND is_deleted = 0`;
        con.query(checkWaybillQuery, [waybill], (err, results) => {
            if (err) {
                console.error("Error checking waybill:", err);
                return res.status(500).json({ success: false, message: "Error checking waybill", error: err.message });
            }

            if (results.length > 0) {
                return res.status(400).json({ success: false, message: "Waybill already exists." });
            }

            const insertQuery = `INSERT INTO batches 
        (freight, waybill, carrier, vessel, container, destination, date_dispatch, agent, forwarding_agent) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            con.query(insertQuery, [freight_id, waybill, carrier, vessel, container, destination, date_of_dispatch, agent, forwarding_agent], (err, result) => {
                if (err) {
                    console.error("Error inserting shipment:", err);
                    return res.status(500).json({ success: false, message: "Error inserting shipment", error: err.message });
                }

                // ✅ Fetch the operations team
                const teamQuery = `
          SELECT full_name, email, cellphone 
          FROM tbl_users 
          WHERE user_type = 2
            AND FIND_IN_SET(2, assigned_roles) 
            AND is_deleted = 0 
            AND status = 1
        `;

                con.query(teamQuery, async (opErr, teamResults) => {
                    if (opErr) {
                        console.error("Error fetching team members:", opErr);
                        return res.status(500).json({ success: false, message: "Failed to fetch operations team", error: opErr.message });
                    }

                    const mailSubject = 'New Freight Option Created';
                    const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; background-color: #f9f9f9;">
              <h2 style="color: #2c3e50; border-bottom: 1px solid #ccc; padding-bottom: 10px;">New Freight Option Created</h2>
              <p style="font-size: 16px; color: #333;">Hi Operations Team,</p>
              <p style="font-size: 16px; color: #333;">A new freight option has been created.</p>
              <p style="font-size: 16px; color: #333;">
                <strong>Waybill:</strong> ${waybill}<br>
                <strong>Freight:</strong> ${freight_id}<br>
                <strong>Carrier:</strong> ${carrier}<br>
                <strong>Vessel:</strong> ${vessel}<br>
                <strong>Date of Dispatch:</strong> ${date_of_dispatch}<br>
                <strong>Container Number:</strong> ${container}
              </p>
              <p style="font-size: 16px; color: #333;">Please review the freight option in the system.</p>
              <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
              <p style="font-size: 14px; color: #777;">Regards,<br><strong>Management System</strong></p>
            </div>
          `;

                    const plainMessage = `*New Freight Option Created*\n\n` +
                        `A new freight option has been created.\n\n` +
                        `Waybill: ${waybill}\n` +
                        `Freight: ${freight_id}\n` +
                        `Carrier: ${carrier}\n` +
                        `Vessel: ${vessel}\n` +
                        `Date of Dispatch: ${date_of_dispatch}\n` +
                        `Container Number: ${container}\n\n` +
                        `Please review this shipment.`;

                    for (const member of teamResults) {
                        if (member.email) {
                            sendMail(member.email, mailSubject, htmlContent);
                        }

                        if (member.cellphone) {
                            sendWhatsApp(member.cellphone, plainMessage);
                            sendSms(member.cellphone, plainMessage);
                        }
                    }

                    return res.status(200).json({
                        success: true,
                        message: "Shipment added and notifications sent successfully",
                    });
                });
            });
        });
    } catch (err) {
        console.error("Unhandled error in AddShipment:", err);
        return res.status(500).json({ success: false, message: "Server Error", error: err.message });
    }
};
 */

const AddShipment = (req, res) => {
    const {
        waybill,
        freight,
        carrier,
        vessel,
        ETD,
        ATD,
        date_of_dispatch,
        status,
        origin_agent,
        port_of_loading,
        port_of_discharge,
        destination_agent,
        load,
        release_type,
        container,
        seal,
        origin_country_id,
        des_country_id,
        details,
        documentName
    } = req.body;

    console.log(req.body);
    console.log(req.files);
    const detailALL = details ? JSON.parse(details) : null;
    let detailALL1;
    if (details !== undefined && details !== '') {
        const detailsArray = JSON.parse(details);
        detailALL1 = detailsArray.join(',');
    }

    const shipmentQuery = `
        INSERT INTO tbl_shipments 
        (waybill, freight, carrier, vessel, ETD, ATD, date_of_dispatch, status, origin_agent, port_of_loading, port_of_discharge, destination_agent, \`load\`, release_type, container, seal,
         origin_country_id, des_country_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const shipmentValues = [
        waybill || null,
        freight || null,
        carrier || null,
        vessel || null,
        ETD || null,
        ATD || null,
        date_of_dispatch || null,
        status || null,
        origin_agent || null,
        port_of_loading || null,
        port_of_discharge || null,
        destination_agent || null,
        load || null,
        release_type || null,
        container || null,
        seal || null,
        origin_country_id || null,
        des_country_id || null,
    ];

    con.query(shipmentQuery, shipmentValues, (shipmentErr, shipmentResult) => {
        if (shipmentErr) {
            return res.status(500).send({
                success: false,
                message: "Failed to insert shipment",
                error: shipmentErr.message,
                data: req.body
            });
        }

        const shipmentId = shipmentResult.insertId;
        if (req.files && req.files.document) {
            con.query(`update tbl_shipments set document='${req.files.document[0].filename}' where id='${shipmentId}'`, (err, data) => {
                if (err) throw err;
            })
        }
        if (req.files && req.files.document) {
            req.files.document.forEach(file => {
                con.query(
                    `INSERT INTO shipment_documents (shipment_id, document_name, document_file) VALUES (?, ?, ?)`,
                    [shipmentId, req.body.documentName, file.filename],
                    (err) => {
                        if (err) throw err;
                    }
                );
            });
        }

        if (detailALL && Array.isArray(detailALL) && detailALL.length > 0) {
            const detailsQuery = `
                INSERT INTO shipment_details (shipment_id, order_id, batch_id)
                VALUES ?
            `;

            const detailsValues = detailALL.map((data) => [
                shipmentId,
                data.order_id,
                data.batch_id || null,
            ]);

            con.query(detailsQuery, [detailsValues], async (detailsErr) => {
                if (detailsErr) {
                    return res.status(500).send({
                        success: false,
                        message: "Failed to insert shipment details",
                        error: detailsErr.message,
                    });
                }
                if (req.files && req.files.document && req.files.document.length > 0) {
                    // console.log("hii");
                    const file = req.files.document[0];
                    const documentName = req.body.documentName;

                    for (const order of detailALL) {
                        const freightId = await new Promise((resolve, reject) => {
                            con.query(
                                `SELECT freight_id FROM tbl_orders WHERE id = ?`,
                                [order.order_id],
                                (err, result) => {
                                    if (err) return reject(err);
                                    if (result.length === 0) return reject(new Error("No freight_id found for order"));
                                    resolve(result[0].freight_id);
                                }
                            );
                        });

                        const freightNumber = await new Promise((resolve, reject) => {
                            con.query(
                                `SELECT freight_number FROM tbl_freight WHERE id = ?`,
                                [freightId],
                                (err, result) => {
                                    if (err) return reject(err);
                                    if (result.length === 0) return reject(new Error("No freight_number found for freight_id"));
                                    resolve(result[0].freight_number);
                                }
                            );
                        });

                        const freightFolderId = await findOrCreateFolder(freightNumber);
                        const googleFileId = await uploadToMatchingFolder(file, documentName, freightNumber);

                        await new Promise((resolve, reject) => {
                            con.query(
                                `INSERT INTO freight_doc (freight_id, uploaded_by, document_name, document) VALUES (?, ?, ?, ?)`,
                                [freightId, 1, documentName, file.filename],
                                (err) => {
                                    if (err) return reject(err);
                                    resolve();
                                }
                            );
                        });
                    }
                }


                // Update orders and batches
                detailALL.forEach((data) => {
                    // Update tbl_orders

                    const updateOrderTrack =
                        `INSERT INTO order_track (order_id, batch_id, status, description) VALUES (?, ?, ?, ?)`
                        ;
                    con.query(updateOrderTrack, [data.order_id, data.batch_id || null, status, null], (updateErr) => {
                        if (updateErr) {
                            console.error("Failed to update order delivery details:", updateErr.message);
                        }
                    });

                    const updateOrderQuery = `
                        UPDATE tbl_orders 
                        SET track_status = ?, assign_to_shipment = ?
                        WHERE id = ?
                    `;

                    con.query(updateOrderQuery, [status, 1, data.order_id], (orderErr) => {
                        if (orderErr) {
                            console.error("Failed to update order:", orderErr.message);
                        }
                    });
                    const selectDeliveryQuery = `
    SELECT * FROM order_delivery_details
    WHERE order_id = ?
`;

                    con.query(selectDeliveryQuery, [data.order_id], (selectErr, data1) => {
                        if (selectErr) {
                            console.error("Failed to fetch order delivery details:", selectErr.message);
                            return;
                        }

                        if (data1.length > 0) {
                            // Update existing delivery details
                            const updateDeliveryQuery = `
            UPDATE order_delivery_details 
            SET actual_delivery_date = ?, date_dispatched=?, vessel = ?, container_no = ?, seal_no = ? , Carrier=?
            WHERE order_id = ?
        `;

                            con.query(updateDeliveryQuery, [ATD, date_of_dispatch, vessel, container, seal, carrier, data.order_id], (updateErr) => {
                                if (updateErr) {
                                    console.error("Failed to update order delivery details:", updateErr.message);
                                } else {
                                    console.log("Order delivery details updated successfully for order_id:", data.order_id);
                                }
                            });
                        } else {
                            // Insert new delivery details
                            const insertDeliveryQuery = `
            INSERT INTO order_delivery_details (order_id, client_id, actual_delivery_date, date_dispatched, vessel, container_no, seal_no, Carrier) 
            VALUES (?, ?, ?, ?, ?, ?)
        `;

                            con.query(insertDeliveryQuery, [data.order_id, data.client_id, ATD, date_of_dispatch, vessel, container, seal, carrier], (insertErr) => {
                                if (insertErr) {
                                    console.error("Failed to insert order delivery details:", insertErr.message);
                                } else {
                                    console.log("Order delivery details inserted successfully for order_id:", data.order_id);
                                }
                            });
                        }
                    });
                    // Fetch batch ID for the order
                    const batchQuery = `
                        SELECT batch_id 
                        FROM freight_assig_to_batch 
                        WHERE order_id = ?
                    `;

                    con.query(batchQuery, [data.order_id], (batchErr, batchResult) => {
                        if (batchErr || !batchResult.length) {
                            console.error("Failed to fetch batch_id:", batchErr ? batchErr.message : "Batch not found");
                            return;
                        }

                        const batchId = batchResult[0].batch_id;
                        const updateBatchQuery = `
                            UPDATE batches 
                            SET waybill = ?, vessel = ?, container_no = ?, carrier=?, track_status=?
                            WHERE id = ?
                        `;

                        con.query(updateBatchQuery, [waybill, vessel, container, carrier, status, batchId], (updateBatchErr) => {
                            if (updateBatchErr) {
                                console.error("Failed to update batch:", updateBatchErr.message);
                            }
                        });

                        // Fetch all orders in the batch
                        const fetchBatchOrdersQuery = `
                            SELECT order_id 
                            FROM freight_assig_to_batch 
                            WHERE batch_id = ? and is_assign_shipment = ?
                        `;

                        con.query(fetchBatchOrdersQuery, [batchId, 0], (fetchErr, batchOrders) => {
                            if (fetchErr || !batchOrders.length) {
                                console.error("Failed to fetch batch orders:", fetchErr ? fetchErr.message : "No batch orders found");
                                return;
                            }

                            const batchOrderIds = batchOrders.map((order) => order.order_id);

                            // Check if all orders in the batch are assigned to shipment
                            const allOrdersAssigned = batchOrderIds.every((orderId) =>
                                detailALL.some((detail) => detail.order_id === orderId)
                            );

                            if (allOrdersAssigned) {
                                const updateBatchQuery = `
                                    UPDATE batches 
                                    SET assign_to_shipment = ? 
                                    WHERE id = ?
                                `;

                                con.query(updateBatchQuery, [1, batchId], (updateBatchErr) => {
                                    if (updateBatchErr) {
                                        console.error("Failed to update batch:", updateBatchErr.message);
                                    } else {
                                        console.log(`Batch ${batchId} updated successfully.`);
                                    }
                                });
                            } else {
                                const updateBatchQuery = `
                                    UPDATE batches 
                                    SET assign_to_shipment = ? 
                                    WHERE id = ?
                                `;

                                con.query(updateBatchQuery, [0, batchId], (updateBatchErr) => {
                                    if (updateBatchErr) {
                                        console.error("Failed to update batch:", updateBatchErr.message);
                                    } else {
                                        console.log(`Batch ${batchId} updated successfully.`);
                                    }
                                });
                            }
                            const updateBatchOrder = `
                    UPDATE freight_assig_to_batch 
                    SET is_assign_shipment = ?
                    WHERE order_id = ?
                `;
                            con.query(
                                updateBatchOrder,
                                [1, data.order_id],
                                (deliveryErr) => {
                                    if (deliveryErr) {
                                        console.error(
                                            "Failed to update order delivery details:",
                                            deliveryErr.message
                                        );
                                    }
                                }
                            );
                        });
                    });
                });

                res.status(200).send({
                    success: true,
                    message: "Shipment added successfully",
                    detailALL
                });
            });
        } else {
            const teamQuery = `
          SELECT full_name, email, cellphone 
          FROM tbl_users 
          WHERE user_type = 2
            AND FIND_IN_SET(2, assigned_roles) 
            AND is_deleted = 0 
            AND status = 1
        `;
            con.query(teamQuery, async (opErr, teamResults) => {
                if (opErr) {
                    console.error("Error fetching team members:", opErr);
                    return res.status(500).json({ success: false, message: "Failed to fetch operations team", error: opErr.message });
                }

                const mailSubject = 'New Freight Option Created';
                const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; background-color: #f9f9f9;">
              <h2 style="color: #2c3e50; border-bottom: 1px solid #ccc; padding-bottom: 10px;">New Freight Option Created</h2>
              <p style="font-size: 16px; color: #333;">Hi Operations Team,</p>
              <p style="font-size: 16px; color: #333;">A new freight option has been created.</p>
              <p style="font-size: 16px; color: #333;">
                <strong>Waybill:</strong> ${waybill}<br>
                <strong>Freight:</strong> ${freight}<br>
                <strong>Carrier:</strong> ${carrier}<br>
                <strong>Vessel:</strong> ${vessel}<br>
                <strong>Date of Dispatch:</strong> ${date_of_dispatch}<br>
                <strong>Container Number:</strong> ${container}
              </p>
              <p style="font-size: 16px; color: #333;">Please review the freight option in the system.</p>
              <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
              <p style="font-size: 14px; color: #777;">Regards,<br><strong>Management System</strong></p>
            </div>
          `;

                const plainMessage = `*New Freight Option Created*\n\n` +
                    `A new freight option has been created.\n\n` +
                    `Waybill: ${waybill}\n` +
                    `Freight: ${freight}\n` +
                    `Carrier: ${carrier}\n` +
                    `Vessel: ${vessel}\n` +
                    `Date of Dispatch: ${date_of_dispatch}\n` +
                    `Container Number: ${container}\n\n` +
                    `Please review this shipment.`;
                console.log(teamResults);

                for (const member of teamResults) {
                    if (member.email) {
                        sendMail(member.email, mailSubject, htmlContent);
                    }
                    // 05-06-2025
                    /* if (member.cellphone) {
                        sendWhatsApp(member.cellphone, plainMessage);
                        sendSms(member.cellphone, plainMessage);
                    } */
                }


            });
            res.status(200).send({
                success: true,
                message: "Shipment added successfully with no details.",
                detailALL,
                detailALL1
            });
        }
    });
};


const getShipment = async (req, res) => {
    try {
        const query = `SELECT tbl_shipments.*, c.name as des_country_name, co.name as origin_country_name FROM tbl_shipments
        LEFT JOIN countries AS c ON c.id = tbl_shipments.des_country_id
            LEFT JOIN countries AS co ON co.id = tbl_shipments.origin_country_id 
        ORDER by tbl_shipments.created_at DESC`;

        con.query(query, (err, result) => {
            if (err) throw err;
            return res.status(200).send({
                success: true,
                data: result
            });
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message,
        });
    }
}


const getShipmentbyid = async (req, res) => {
    try {
        const { shipment_id } = req.body;
        const query = `SELECT tbl_shipments.*, c.name as des_country_name, co.name as origin_country_name FROM tbl_shipments
        LEFT JOIN countries AS c ON c.id = tbl_shipments.des_country_id
            LEFT JOIN countries AS co ON co.id = tbl_shipments.origin_country_id
        WHERE tbl_shipments.id=? ORDER by tbl_shipments.created_at DESC`;

        con.query(query, [shipment_id], (err, result) => {
            if (err) throw err;
            return res.status(200).send({
                success: true,
                data: result
            });
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message,
        });
    }
}

const GetShipmentDetails = async (req, res) => {
    try {
        const { shipment_id } = req.body;

        // Validate that shipment_id is provided
        if (!shipment_id) {
            return res.status(400).send({
                success: false,
                message: "Shipment ID is required",
            });
        }

        // Query to fetch shipment details from tbl_shipments
        const shipmentQuery = `
            SELECT * FROM tbl_shipments
            WHERE id = ?
        `;

        // Fetch shipment data
        const shipmentData = await new Promise((resolve, reject) => {
            con.query(shipmentQuery, [shipment_id], (err, shipmentData) => {
                if (err) {
                    return reject(err);
                }
                if (!shipmentData || shipmentData.length === 0) {
                    return reject(new Error("Shipment not found"));
                }
                resolve(shipmentData);
            });
        });

        // Fetch shipment details
        const detailsQuery = `
            SELECT * FROM shipment_details
            WHERE shipment_id = ?
        `;

        const shipmentDetails = await new Promise((resolve, reject) => {
            con.query(detailsQuery, [shipment_id], (err, details) => {
                if (err) {
                    return reject(err);
                }
                resolve(details);
            });
        });

        // Prepare an array to store the detailed shipment data
        const detailsData = [];

        // Loop through shipment details and fetch additional data for each order
        for (let detail of shipmentDetails) {
            const { order_id, id, batch_id } = detail; // Extract batch_id from shipmentDetails

            const detailsDataQuery = `
                SELECT 
                    o.id AS order_id, 
                    COALESCE(o.weight, f.weight) AS weight, 
                    COALESCE(o.dimensions, f.dimension) AS dimensions, 
                    COALESCE(f.nature_of_goods, '') AS nature_of_goods, 
                    f.freight_number AS freight_number, 
                    CONCAT('OR000', o.id) AS order_number,
                    CASE 
                        WHEN o.client_id = 0 THEN o.client_name
                        ELSE u.full_name
                    END AS client_name
                FROM tbl_orders AS o
                LEFT JOIN tbl_freight AS f ON o.freight_id = f.id
                LEFT JOIN tbl_users AS u ON u.id = o.client_id
                WHERE o.id = ?
            `;

            const orderDetails = await new Promise((resolve, reject) => {
                con.query(detailsDataQuery, [order_id], (err, detailsAll) => {
                    if (err) {
                        return reject(err);
                    }
                    if (detailsAll.length > 0) {
                        detailsAll[0].batch_id = batch_id || null; // Assign batch_id to the first result
                    }
                    resolve(detailsAll);
                });
            });

            if (orderDetails.length > 0) {
                orderDetails[0].shipment_details_id = id; // Add shipment_details_id
                detailsData.push(orderDetails[0]); // Push the first result to detailsData
            }
        }

        // Send the response with both shipment and detailed data
        return res.status(200).send({
            success: true,
            message: "Shipment details fetched successfully",
            shipment: shipmentData[0], // Send the first shipment data
            details: detailsData,      // Send all related details
        });

    } catch (error) {
        console.error("Server error:", error);
        res.status(500).send({
            success: false,
            message: error.message,
        });
    }
};

const UpdateShipment = async (req, res) => {
    try {
        const {
            shipment_id,
            waybill,
            freight,
            carrier,
            vessel,
            ETD,
            ATD,
            date_of_dispatch,
            status,
            origin_agent,
            port_of_loading,
            port_of_discharge,
            destination_agent,
            load,
            release_type,
            container,
            seal,
            origin_country_id,
            des_country_id,
            details, // Details for shipment_details update
        } = req.body;
        console.log(req.body);

        // Validate required fields
        if (!shipment_id) {
            return res.status(400).send({
                success: false,
                message: "Shipment ID is required for update.",
            });
        }
        const detailALL = details ? JSON.parse(details) : null;

        const [existingData] = await executeQuery(
            "SELECT status, waybill FROM tbl_shipments WHERE id = ?",
            [shipment_id]
        );

        if (!existingData) {
            return res.status(404).send({
                success: false,
                message: "Shipment not found.",
            });
        }

        const oldStatus = existingData.status;
        const isStatusChanged = status !== oldStatus;

        // Prepare shipment update query
        const updateShipmentQuery = `
            UPDATE tbl_shipments
            SET
                waybill = ?, freight = ?, carrier = ?, vessel = ?, ETD = ?, ATD = ?, date_of_dispatch=?, 
                status = ?, origin_agent = ?, port_of_loading = ?, port_of_discharge = ?, 
                destination_agent = ?, \`load\` = ?, release_type = ?, container = ?, seal = ?, 
                origin_country_id = ?, des_country_id = ?
            WHERE id = ?
        `;
        const shipmentValues = [
            waybill || null,
            freight || null,
            carrier || null,
            vessel || null,
            ETD || null,
            ATD || null,
            date_of_dispatch || null,
            status || null,
            origin_agent || null,
            port_of_loading || null,
            port_of_discharge || null,
            destination_agent || null,
            load || null,
            release_type || null,
            container || null,
            seal || null,
            origin_country_id || null,
            des_country_id || null,
            shipment_id,
        ];

        // Execute shipment update
        await executeQuery(updateShipmentQuery, shipmentValues);
        console.log(req.files);

        if (req.files && req.files.document) {
            con.query(`update tbl_shipments set document='${req.files.document[0].filename}' where id='${shipment_id}'`, (err, data) => {
                if (err) throw err;
            })
        }
        if (req.files && req.files.document) {
            req.files.document.forEach(file => {
                con.query(
                    `INSERT INTO shipment_documents (shipment_id, document_name, document_file) VALUES (?, ?,?)`,
                    [shipment_id, req.body.documentName, file.filename],
                    (err) => {
                        if (err) throw err;
                    }
                );
            });
        }

        if (isStatusChanged) {
            // const message = getOrderStatusMessage(orderNumber, fullName, status);

            // WhatsApp/SMS messages
            // Fetch ops team dynamically
            const teamQuery = `
  SELECT full_name, email, cellphone 
  FROM tbl_users 
  WHERE user_type = 2 AND FIND_IN_SET(2, assigned_roles) AND is_deleted = 0 AND status = 1
`;
            const opsTeamMembers = await executeQuery(teamQuery);

            if (opsTeamMembers && opsTeamMembers.length > 0) {
                // Compose SMS message
                const SMSmessage = `*Shipment Status Updated*\n\nThe status of the shipment (Waybill: ${waybill}) has been updated to: ${status}.\n\nPlease check the shipment details.`;

                // Compose email content (you can reuse your existing mailContent)
                const mailContent = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; background-color: #f9f9f9;">
    <h2 style="color: #2c3e50; border-bottom: 1px solid #ccc; padding-bottom: 10px;">
      Shipment Status: ${status}
    </h2>

    <p style="font-size: 16px; color: #333;">
      Dear Operations Team,<br><br>
      Shipment status has Updated.
    </p>

    <p style="font-size: 16px; color: #333;">
      <strong>Waybill:</strong> ${waybill}<br>
      <strong>Current Status:</strong> ${status}
    </p>

    <p style="font-size: 16px; color: #333;">
      Please log in to dashboard for more information.
    </p>

    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 20px;">

    <p style="font-size: 14px; color: #777;">
      Regards,<br>
      <strong>Management System</strong>
    </p>
  </div>`;

                // Send notifications to each ops team member
                for (const member of opsTeamMembers) {
                    const { full_name, email, cellphone } = member;

                    if (email) {
                        sendMail(email, "Shipment status has Updated", mailContent);
                    }
                    // 05-06-2025
                    /* if (cellphone) {
                        sendWhatsApp(cellphone, SMSmessage);
                        sendSms(cellphone, SMSmessage);
                    } */
                }
            }

        }

        if (status && isStatusChanged && status === "Customs released") {
            // Use the opsTeamMembers fetched above or query again if needed

            const teamQuery = `
  SELECT full_name, email, cellphone 
  FROM tbl_users 
  WHERE user_type = 2 AND FIND_IN_SET(2, assigned_roles) AND is_deleted = 0 AND status = 1
`;
            const opsTeamMembers = await executeQuery(teamQuery);
            const emailSubject = "Shipment Released";
            const emailContent = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; background-color: #f9f9f9;">
    <h2 style="color: #2c3e50;">Shipment Released Notification</h2>
    <p style="font-size: 16px; color: #333;">
      Dear Operations Team,
    </p>
    <p style="font-size: 16px; color: #333;">
      A shipment with Waybill: <strong>${waybill}</strong> has been <strong>released</strong>.
    </p>
    <p style="font-size: 16px; color: #333;">
      <strong>Waybill:</strong> ${waybill || ""}<br>
      <strong>Status:</strong> ${status}<br>
    </p>
    <p style="font-size: 16px; color: #333;">
      Please check the system for more details.
    </p>
    <hr style="border-top: 1px solid #ddd;">
    <p style="font-size: 14px; color: #777;">
      Regards,<br><strong>Management System</strong>
    </p>
  </div>`;

            const whatsappMessage = `*Shipment Released*\n\nA shipment with Waybill *${waybill}* has been *released*.\n\nCheck the system for full details.`;

            for (const member of opsTeamMembers) {
                const { email, cellphone } = member;

                if (email) {
                    sendMail(email, emailSubject, emailContent);
                }
                // 05-06-2025
                /* if (cellphone) {
                    sendWhatsApp(cellphone, whatsappMessage);
                } */
            }
        }


        if (detailALL && Array.isArray(detailALL)) {

            if (req.files && req.files.document && req.files.document.length > 0) {
                // console.log("hii");
                const file = req.files.document[0];
                const documentName = req.body.documentName;

                for (const order of detailALL) {
                    const freightId = await new Promise((resolve, reject) => {
                        con.query(
                            `SELECT freight_id FROM tbl_orders WHERE id = ?`,
                            [order.order_id],
                            (err, result) => {
                                if (err) return reject(err);
                                if (result.length === 0) return reject(new Error("No freight_id found for order"));
                                resolve(result[0].freight_id);
                            }
                        );
                    });

                    const freightNumber = await new Promise((resolve, reject) => {
                        con.query(
                            `SELECT freight_number FROM tbl_freight WHERE id = ?`,
                            [freightId],
                            (err, result) => {
                                if (err) return reject(err);
                                if (result.length === 0) return reject(new Error("No freight_number found for freight_id"));
                                resolve(result[0].freight_number);
                            }
                        );
                    });

                    const freightFolderId = await findOrCreateFolder(freightNumber);
                    const googleFileId = await uploadToMatchingFolder(file, documentName, freightNumber);

                    await new Promise((resolve, reject) => {
                        con.query(
                            `INSERT INTO freight_doc (freight_id, uploaded_by, document_name, document) VALUES (?, ?, ?, ?)`,
                            [freightId, 1, documentName, file.filename],
                            (err) => {
                                if (err) return reject(err);
                                resolve();
                            }
                        );
                    });
                }
            }
            // Step 1: Delete existing shipment details
            const deleteDetailsQuery = `DELETE FROM shipment_details WHERE shipment_id = ?`;
            await executeQuery(deleteDetailsQuery, [shipment_id]);

            // Step 2: Insert new shipment details
            const insertDetailsQuery = `
                INSERT INTO shipment_details (shipment_id, order_id, batch_id)
                VALUES ?
            `;
            const detailsValues = detailALL.map((data) => [
                shipment_id,
                data.order_id,
                data.batch_id || null,
            ]);

            await executeQuery(insertDetailsQuery, [detailsValues]);

            // Step 3: Update related orders and batches
            for (const data of detailALL) {
                const { order_id, batch_id } = data;
                console.log(order_id);

                // Update order details
                const updateOrderTrack =
                    `INSERT INTO order_track (order_id, batch_id, status, description) VALUES (?, ?, ?, ?)`
                    ;
                con.query(updateOrderTrack, [order_id, batch_id, status, null], (updateErr) => {
                    if (updateErr) {
                        console.error("Failed to update order delivery details:", updateErr.message);
                    }
                });
                const updateOrderQuery = `
                    UPDATE tbl_orders 
                    SET track_status = ?, assign_to_shipment = ?
                    WHERE id = ?
                `;
                await executeQuery(updateOrderQuery, [status, 1, order_id]);

                // Update delivery details

                const selectDeliveryQuery = `
    SELECT * FROM order_delivery_details
    WHERE order_id = ?
`;

                con.query(selectDeliveryQuery, [data.order_id], (selectErr, data1) => {
                    if (selectErr) {
                        console.error("Failed to fetch order delivery details:", selectErr.message);
                        return;
                    }

                    if (data1.length > 0) {
                        // Update existing delivery details
                        const updateDeliveryQuery = `
            UPDATE order_delivery_details 
            SET actual_delivery_date = ?, date_dispatched=?, vessel = ?, container_no = ?, seal_no = ?, Carrier=? 
            WHERE order_id = ?
        `;

                        con.query(updateDeliveryQuery, [ATD, vessel, date_of_dispatch, container, seal, carrier, data.order_id], (updateErr) => {
                            if (updateErr) {
                                console.error("Failed to update order delivery details:", updateErr.message);
                            } else {
                                console.log("Order delivery details updated successfully for order_id:", data.order_id);
                            }
                        });
                    } else {
                        // Insert new delivery details
                        const insertDeliveryQuery = `
            INSERT INTO order_delivery_details (order_id, client_id, date_dispatched, actual_delivery_date, vessel, container_no, seal_no, Carrier) 
            VALUES (?, ?, ?, ?, ?,?)
        `;

                        con.query(insertDeliveryQuery, [data.order_id, data.client_id, date_of_dispatch, ATD, vessel, container, seal, carrier], (insertErr) => {
                            if (insertErr) {
                                console.error("Failed to insert order delivery details:", insertErr.message);
                            } else {
                                console.log("Order delivery details inserted successfully for order_id:", data.order_id);
                            }
                        });
                    }
                });

                // const updateDeliveryQuery = `
                //     UPDATE order_delivery_details 
                //     SET actual_delivery_date = ?, vessel = ?, container_no = ?, seal_no = ?
                //     WHERE order_id = ?
                // `;
                // await executeQuery(updateDeliveryQuery, [ATD, vessel, container, seal, order_id]);

                // Handle batch updates
                const batchQuery = `
                    SELECT batch_id 
                    FROM freight_assig_to_batch 
                    WHERE order_id = ?
                `;
                const [batchData] = await executeQuery(batchQuery, [order_id]);
                if (batchData) {
                    console.log(batchData);

                    const batchId = batchData.batch_id;
                    console.log(batchId);

                    const updateBatchQuerys = `
                    UPDATE batches 
                    SET waybill = ?, vessel = ?, container_no = ?, carrier=?, track_status=?
                    WHERE id = ?
                `;

                    con.query(updateBatchQuerys, [waybill, vessel, container, carrier, status, batchId], (updateBatchErr) => {
                        if (updateBatchErr) {
                            console.error("Failed to update batch:", updateBatchErr.message);
                        }
                    });
                    // Check if all orders in the batch are assigned
                    const fetchBatchOrdersQuery = `
                        SELECT order_id 
                        FROM freight_assig_to_batch 
                        WHERE batch_id = ? AND is_assign_shipment = 0
                    `;
                    const batchOrders = await executeQuery(fetchBatchOrdersQuery, [batchId]);

                    const allOrdersAssigned = batchOrders.every((order) =>
                        detailALL.some((detail) => detail.order_id === order.order_id)
                    );

                    const updateBatchQuery = `
                        UPDATE batches 
                        SET assign_to_shipment = ?
                        WHERE id = ?
                    `;
                    await executeQuery(updateBatchQuery, [allOrdersAssigned ? 1 : 0, batchId]);

                    // Update freight assignment
                    const updateBatchOrderQuery = `
                        UPDATE freight_assig_to_batch 
                        SET is_assign_shipment = ?
                        WHERE order_id = ?
                    `;
                    await executeQuery(updateBatchOrderQuery, [1, order_id]);
                }
            }
        }

        return res.status(200).send({
            success: true,
            message: "Shipment updated successfully.",
        });
    } catch (error) {
        console.error("Error updating shipment:", error.message);
        return res.status(500).send({
            success: false,
            message: "An unexpected error occurred: " + error.message,
        });
    }
};

// Helper function to execute SQL queries with Promises
const executeQuery = (query, values) => {
    return new Promise((resolve, reject) => {
        con.query(query, values, (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });
};



const DeleteShipment = async (req, res) => {
    try {
        const { shipment_id } = req.body; // ID of the shipment to delete

        // Validate that the `id` is provided
        if (!shipment_id) {
            return res.status(400).send({
                success: false,
                message: "Shipment ID is required for deletion",
            });
        }

        // Construct the SQL query
        const query = `DELETE FROM tbl_shipments WHERE id = ?`;

        // Execute the query
        con.query(query, [shipment_id], (err, result) => {
            if (err) throw err;

            if (result.affectedRows === 0) {
                return res.status(400).send({
                    success: false,
                    message: "Shipment not found or already deleted",
                });
            }
            const query = `DELETE FROM shipment_details WHERE shipment_id = ?`;

            // Execute the query
            con.query(query, [shipment_id], (err, result) => {
                if (err) throw err;
            })
            return res.status(200).send({
                success: true,
                message: "Shipment deleted successfully",
            });
        });
    } catch (error) {
        console.error("Server error:", error);
        res.status(500).send({
            success: false,
            message: error.message,
        });
    }
};


const DeleteShipmentDetails = async (req, res) => {
    try {
        const { shipment_detail_id, orderId } = req.body;

        // Validate that required fields are provided
        if (!shipment_detail_id || !orderId) {
            return res.status(400).send({
                success: false,
                message: "Shipment Detail ID and Order ID are required for deletion",
            });
        }

        // Step 1: Update the `assign_to_shipment` field in `tbl_orders`
        const updateOrderQuery = `
            UPDATE tbl_orders 
            SET assign_to_shipment = ? 
            WHERE id = ?
        `;
        await new Promise((resolve, reject) => {
            con.query(updateOrderQuery, [0, orderId], (err) => {
                if (err) return reject(err);
                resolve();
            });
        });

        // Step 2: Update the `is_assign_shipment` field in `freight_assig_to_batch`
        const updateBatchOrderQuery = `
            UPDATE freight_assig_to_batch 
            SET is_assign_shipment = ? 
            WHERE order_id = ?
        `;
        await new Promise((resolve, reject) => {
            con.query(updateBatchOrderQuery, [0, orderId], (err) => {
                if (err) return reject(err);
                resolve();
            });
        });

        // Step 3: Fetch the `batch_id` from `freight_assig_to_batch`
        const fetchBatchOrdersQuery = `
            SELECT batch_id 
            FROM freight_assig_to_batch 
            WHERE order_id = ?
        `;
        const batchData = await new Promise((resolve, reject) => {
            con.query(fetchBatchOrdersQuery, [orderId], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });

        // Step 4: Update the `assign_to_shipment` field in `batches`, if applicable
        if (batchData.length > 0) {
            const updateBatchQuery = `
                UPDATE batches 
                SET assign_to_shipment = ? 
                WHERE id = ?
            `;
            await new Promise((resolve, reject) => {
                con.query(updateBatchQuery, [0, batchData[0].batch_id], (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });
        }

        // Step 5: Delete the shipment detail from `shipment_details`
        const deleteQuery = `
            DELETE FROM shipment_details 
            WHERE id = ?
        `;
        const deleteResult = await new Promise((resolve, reject) => {
            con.query(deleteQuery, [shipment_detail_id], (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });

        if (deleteResult.affectedRows === 0) {
            return res.status(400).send({
                success: false,
                message: "Shipment Detail not found or already deleted",
            });
        }

        // Success response
        return res.status(200).send({
            success: true,
            message: "Shipment Detail Deleted Successfully",
        });

    } catch (error) {
        console.error("Server error:", error);
        return res.status(500).send({
            success: false,
            message: error.message,
        });
    }
};

const CopyShipment = (req, res) => {
    try {
        const { shipment_id } = req.body;

        if (!shipment_id) {
            return res.status(400).send({
                success: false,
                message: "Shipment ID is required",
            });
        }

        // Fetch shipment data
        con.query(
            `SELECT * FROM tbl_shipments WHERE id = ?`,
            [shipment_id],
            (err, shipmentData) => {
                if (err) {
                    return res.status(500).send({
                        success: false,
                        message: `Error fetching shipment: ${err.message}`,
                    });
                }

                if (!shipmentData || shipmentData.length === 0) {
                    return res.status(404).send({
                        success: false,
                        message: "Shipment not found",
                    });
                }

                const shipment = shipmentData[0];

                // Prepare values for insertion
                const values = [
                    null, // waybill (set to null)
                    shipment.freight || null,
                    shipment.carrier || null,
                    shipment.vessel || null,
                    shipment.ETD || null,
                    shipment.ATD || null,
                    shipment.status || null,
                    shipment.origin_agent || null,
                    shipment.port_of_loading || null,
                    shipment.port_of_discharge || null,
                    shipment.destination_agent || null,
                    shipment.load || null,
                    shipment.release_type || null,
                    null, // container (set to null)
                    null, // seal (set to null)
                ];

                // Insert a new shipment
                con.query(
                    `
                    INSERT INTO tbl_shipments  
                    (waybill, freight, carrier, vessel, ETD, ATD, status, origin_agent, port_of_loading, port_of_discharge, destination_agent, \`load\`, release_type, container, seal)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `,
                    values,
                    (err, result) => {
                        if (err) {
                            return res.status(500).send({
                                success: false,
                                message: `Error inserting shipment: ${err.message}`,
                            });
                        }

                        const newShipmentId = result.insertId;

                        // Fetch shipment details
                        con.query(
                            `SELECT order_id FROM shipment_details WHERE shipment_id = ?`,
                            [shipment_id],
                            (err, detailsData) => {
                                if (err) {
                                    return res.status(500).send({
                                        success: false,
                                        message: `Error fetching shipment details: ${err.message}`,
                                    });
                                }

                                if (detailsData && detailsData.length > 0) {
                                    let completed = 0;
                                    const total = detailsData.length;

                                    detailsData.forEach((detail) => {
                                        con.query(
                                            `
                                            INSERT INTO shipment_details  
                                            (shipment_id, order_id)
                                            VALUES (?, ?, ?)
                                            `,
                                            [newShipmentId, detail.order_id],
                                            (err) => {
                                                if (err) {
                                                    return res.status(500).send({
                                                        success: false,
                                                        message: `Error inserting shipment details: ${err.message}`,
                                                    });
                                                }

                                                completed++;
                                                if (completed === total) {
                                                    return res.status(200).send({
                                                        success: true,
                                                        message: "Shipment copied successfully",
                                                        new_shipment_id: newShipmentId,
                                                        details_copied: total,
                                                    });
                                                }
                                            }
                                        );
                                    });
                                } else {
                                    return res.status(200).send({
                                        success: true,
                                        message: "Shipment copied successfully",
                                        new_shipment_id: newShipmentId,
                                        details_copied: 0,
                                    });
                                }
                            }
                        );
                    }
                );
            }
        );
    } catch (error) {
        res.status(500).send({
            success: false,
            message: `An unexpected error occurred: ${error.message}`,
        });
    }
};


const getAssignShipmentList = async (req, res) => {
    try {
        const { type, id, origin_country_id, des_country_id } = req.body;

        // Validate inputs
        if (!type || !id || !origin_country_id || !des_country_id) {
            return res.status(400).send({
                success: false,
                message: "Type, ID, origin_country_id and des_country_id are required.",
            });
        }

        const query =
            type == 1
                ? `SELECT 
                      o.id AS order_id, 
                      o.client_id,
                      COALESCE(o.weight, f.weight) AS weight, 
                      COALESCE(o.dimensions, f.dimension) AS dimensions, 
                      COALESCE(f.nature_of_goods, '') AS nature_of_goods, 
                      f.freight_number AS freight_number, 
                      CONCAT('OR000', o.id) AS order_number,
                      CASE 
                          WHEN o.client_id = 0 THEN o.client_name
                          ELSE u.full_name
                      END AS client_name
                  FROM tbl_orders AS o
                  LEFT JOIN tbl_freight AS f ON o.freight_id = f.id
                  LEFT JOIN tbl_users AS u ON u.id = o.client_id
                  WHERE o.id = ? and f.collection_from=? and f.delivery_to=?`
                : `SELECT 
                      b.*, 
                      bt.batch_number,
                      o.id AS order_id, 
                      o.client_id,
                      COALESCE(o.weight, f.weight) AS weight, 
                      COALESCE(o.dimensions, f.dimension) AS dimensions, 
                      COALESCE(f.nature_of_goods, '') AS nature_of_goods, 
                      f.freight_number AS freight_number, 
                      CONCAT('OR000', o.id) AS order_number,
                      CASE 
                          WHEN o.client_id = 0 THEN o.client_name
                          ELSE u.full_name
                      END AS client_name
                  FROM freight_assig_to_batch AS b
                  LEFT JOIN batches AS bt ON bt.id = b.batch_id
                  LEFT JOIN tbl_freight AS f ON b.freight_id = f.id
                  LEFT JOIN tbl_orders AS o ON o.freight_id = f.id
                  LEFT JOIN tbl_users AS u ON u.id = o.client_id
                  WHERE b.batch_id = ? and bt.origin_country_id =? and bt.detination_country_id =? and is_assign_shipment=?
                  ORDER BY b.assigned_at DESC`;

        // Execute the query
        con.query(query, [id, origin_country_id, des_country_id, 0], (err, result) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: "Database query failed.",
                    error: err.message,
                });
            }
            if (result.length > 0) {
                res.status(200).send({
                    success: true,
                    data: result,
                    message: "Data fetched successfully",
                });
            } else {
                res.status(400).send({
                    success: false,
                    data: result,
                    message: "No data found for the specified shipment origin country and destination country.",
                });

            }

        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message,
        });
    }
};


const AllFreightOrderNumbers = async (req, res) => {
    const { des_country_id, origin_country_id, freight } = req.body;
    if (!des_country_id || !origin_country_id) {
        return res.status(400).send({
            success: false,
            message: "des_country_id and origin_country_id are required.",
        });
    }

    try {
        await con.query(`SELECT o.id AS order_id, f.freight_number AS freight_number, CONCAT('OR000', o.id) AS order_number
    FROM tbl_orders AS o
    LEFT JOIN tbl_freight AS f ON o.freight_id = f.id
    WHERE o.assign_to_shipment = ? AND f.collection_from = ? AND f.delivery_to = ? AND f.freight=?
    ORDER BY o.id DESC`, [0, origin_country_id, des_country_id, freight], (err, data) => {
            if (err) throw err;
            res.status(200).send({
                success: true,
                data: data
            });
        })
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
}

const AllBatchNumbers = async (req, res) => {
    const { des_country_id, origin_country_id, freight } = req.body;
    if (!des_country_id || !origin_country_id || !freight) {
        return res.status(400).send({
            success: false,
            message: "des_country_id, origin_country_id and freight are required.",
        });
    }
    try {
        await con.query(`SELECT b.id as batch_id, b.batch_number as batch_number
     FROM batches as b
     WHERE b.is_deleted='${0}' and b.assign_to_shipment='${0}' and b.origin_country_id='${origin_country_id}' and b.detination_country_id='${des_country_id}' and b.freight='${freight}'`, (err, data) => {
            if (err) throw err;
            res.status(200).send({
                success: true,
                data: data
            });
        })
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
}

const addWareProductByUser = async (req, res) => {
    try {
        const {
            user_id,
            order_id,
            product_description,
            Hazardous,
            date_received,
            package_type,
            packages,
            dimension,
            weight,
            warehouse_ref
        } = req.body;

        // console.log(req.body);

        // Ensure all string values are properly quoted and dates are formatted
        const query = `
            INSERT INTO warehouse_products 
            (user_id, added_by, order_id, product_description, Hazardous, date_received, package_type, packages, dimension, weight, warehouse_ref) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const values = [
            user_id,
            3,
            order_id,
            product_description,
            Hazardous,
            date_received,
            package_type,
            packages,
            dimension,
            weight,
            warehouse_ref
        ];

        con.query(query, values, (err, data) => {
            if (err) throw err;

            res.status(200).send({
                success: true,
                message: "Warehouse Product Details Added successfully"
            });
        });
    } catch (error) {
        // console.error("Error adding warehouse product:", error.message);
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
}

const AssignFreightToClearing = async (req, res) => {
    try {
        const { freight_id } = req.body;

        if (!freight_id) {
            return res.status(400).json({
                success: false,
                message: "freight_id is required"
            });
        }
        // console.log(freight_id);

        // Fetch data based on freight_id
        const fetchQuery = `
            SELECT 
               f.client_id, f.client_ref_name, f.product_desc, f.shipment_ref as is_cong_shipp,  
                f.collection_from, f.delivery_to, f.port_of_loading, f.post_of_discharge, 
                f.commodity, f.package_type, f.no_of_packages, f.dimension, f.weight, 
                f.assign_to_clearance
            FROM tbl_freight as f
            WHERE f.id = ?
        `;

        con.query(fetchQuery, [freight_id], (fetchErr, result) => {
            if (fetchErr) {
                return res.status(500).json({
                    success: false,
                    message: fetchErr.message
                });
            }

            if (result.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "No data found for the provided freight_id"
                });
            }

            const {
                assign_to_clearance, client_id, client_ref_name, product_desc, is_cong_shipp,
                collection_from, delivery_to, port_of_loading, post_of_discharge,
                commodity, package_type, no_of_packages, dimension, weight
            } = result[0];

            // Check the assign_to_clearance status
            if (assign_to_clearance === 1) {
                return res.status(400).json({
                    success: false,
                    message: "Freight is already assigned to clearance"
                });
            }

            // Generate the clearance number
            generateClearanceNumber((err, clearanceNumber) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: "Error generating clearance number"
                    });
                }

                // Insert data into tbl_clearance
                const insertQuery = `
                    INSERT INTO tbl_clearance (
                        clearance_number,  user_id, freight_id, customer_ref, goods_desc, 
                        is_cong_shipp, loading_country, discharge_country, 
                        port_of_loading, port_of_discharge, nature_of_goods, 
                        packing_type, total_dimension, total_weight, total_box, added_by
                    ) 
                    VALUES (?, ?, ?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
                const insertParams = [
                    clearanceNumber, client_id, freight_id, client_ref_name, product_desc || "",
                    is_cong_shipp || "", collection_from, delivery_to,
                    port_of_loading, post_of_discharge, commodity,
                    package_type, dimension, weight, no_of_packages, 1
                ];

                con.query(insertQuery, insertParams, (insertErr, data) => {
                    if (insertErr) {
                        return res.status(500).json({
                            success: false,
                            message: insertErr.message
                        });
                    }

                    if (data.affectedRows > 0) {
                        // Update the assign_to_clearance field in tbl_freight

                        con.query('INSERT INTO clearance_order (clearance_id, user_id, freight_id) VALUES (?,?,?)', [data.insertId, client_id || null, freight_id || null], (err, result) => {
                            if (err) throw err;
                            // console.log(result.affectedRows);
                        })
                        con.query(`update tbl_clearance set quotation_status='${3}' where id='${data.insertId}'`, (err, result) => {
                            if (err) throw err;
                        })
                        const updateQuery = `
                            UPDATE tbl_freight 
                            SET assign_to_clearance = 1, clearance_id = ?
                            WHERE id = ?
                        `;
                        con.query(updateQuery, [data.insertId, freight_id], (updateErr) => {
                            if (updateErr) {
                                return res.status(500).json({
                                    success: false,
                                    message: "Clearance added, but failed to update freight status"
                                });
                            }

                            res.status(200).json({
                                success: true,
                                message: "Clearance added successfully"
                            });
                        });
                    } else {
                        res.status(400).json({
                            success: false,
                            message: "Failed to add clearance"
                        });
                    }
                });
            });
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


const AssignToClearing = async (req, res) => {
    try {
        const { freight_id, order_id } = req.body;

        if (!freight_id || !order_id) {
            return res.status(400).json({
                success: false,
                message: "freight_id and order_id are required"
            });
        }

        // Fetch data based on freight_id and order_id
        const fetchQuery = `
            SELECT 
                o.assign_to_clearance, o.client_id, f.client_ref_name, f.product_desc, f.shipment_ref as is_cong_shipp,  
                f.collection_from, f.delivery_to, f.port_of_loading, f.post_of_discharge, f.commodity, 
                f.package_type, f.no_of_packages, o.dimensions, o.weight, o.id as order_id
            FROM tbl_orders as o
            INNER JOIN tbl_freight as f ON f.id = o.freight_id
            WHERE o.id = ? 
        `;

        con.query(fetchQuery, [order_id], (fetchErr, result) => {
            if (fetchErr) {
                return res.status(500).json({
                    success: false,
                    message: "Error fetching data from the database"
                });
            }

            if (result.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "No data found for the provided freight_id and order_id"
                });
            }

            const {
                assign_to_clearance, client_id, client_ref_name, product_desc, is_cong_shipp,
                collection_from, delivery_to, port_of_loading, post_of_discharge, commodity,
                package_type, no_of_packages, dimensions, weight, order_id
            } = result[0];

            // Check the assign_to_clearance status
            if (assign_to_clearance === 1) {
                return res.status(400).json({
                    success: false,
                    message: "Order is already assigned to clearance"
                });
            }

            // Generate the clearance number
            generateClearanceNumber((err, clearanceNumber) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: "Error generating clearance number"
                    });
                }

                // Insert data into tbl_clearance
                const insertQuery = `
                    INSERT INTO tbl_clearance (
                        clearance_number, user_id, order_id, customer_ref, goods_desc, 
                        is_cong_shipp, loading_country, discharge_country, 
                        port_of_loading, port_of_discharge, nature_of_goods, 
                        packing_type, total_dimension, total_weight, total_box, added_by
                    ) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)
                `;
                const insertParams = [
                    clearanceNumber, client_id, order_id, client_ref_name, product_desc || "",
                    is_cong_shipp, collection_from, delivery_to,
                    port_of_loading, post_of_discharge, commodity,
                    package_type, dimensions, weight, no_of_packages, 1
                ];

                con.query(insertQuery, insertParams, (insertErr, data) => {
                    if (insertErr) {
                        return res.status(500).json({
                            success: false,
                            message: insertErr.message
                        });
                    }

                    if (data.affectedRows > 0) {
                        // Update the assign_to_clearance field in tbl_orders

                        con.query('INSERT INTO clearance_order (clearance_id, user_id, order_id) VALUES (?,?,?)', [data.insertId, client_id || null, order_id], (err, result) => {
                            if (err) throw err;
                            // console.log(result.affectedRows);
                        })
                        con.query(`update tbl_clearance set quotation_status='${3}' where id='${data.insertId}'`, (err, result) => {
                            if (err) throw err;
                        })

                        const updateQuery = `
                            UPDATE tbl_orders 
                            SET assign_to_clearance = 1, clearance_id =?
                            WHERE id = ?
                        `;
                        con.query(updateQuery, [data.insertId, order_id], (updateErr) => {
                            if (updateErr) {
                                return res.status(500).json({
                                    success: false,
                                    message: "Clearance added, but failed to update order status"
                                });
                            }

                            res.status(200).json({
                                success: true,
                                message: "Clearance added successfully"
                            });
                        });
                    } else {
                        res.status(400).json({
                            success: false,
                            message: "Failed to add clearance"
                        });
                    }
                });
            });
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const AssignBatchOrdersToClearing = async (req, res) => {
    try {
        const { batch_id } = req.body;

        if (!batch_id) {
            return res.status(400).json({
                success: false,
                message: "batch_id is required"
            });
        }

        // Fetch all order_ids for the given batch_id from the batches table
        const fetchOrdersQuery = `
            SELECT order_id AS order_id FROM freight_assig_to_batch WHERE batch_id = ?
        `;

        con.query(fetchOrdersQuery, [batch_id], (fetchErr, orders) => {
            if (fetchErr) {
                return res.status(500).json({
                    success: false,
                    message: "Error fetching orders from the batches table"
                });
            }

            if (orders.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "No orders found to be assigned to clearance for the given batch_id"
                });
            }

            // Iterate over each order and assign it to clearance
            const ordersProcessed = [];
            let ordersToProcess = orders.length;

            orders.forEach(order => {
                const { order_id } = order;

                // Check if the order is already assigned to clearance
                const checkClearanceQuery = `
                    SELECT id FROM tbl_clearance WHERE order_id = ?
                `;

                con.query(checkClearanceQuery, [order_id], (checkErr, existingClearance) => {
                    if (checkErr) {
                        return res.status(500).json({
                            success: false,
                            message: "Error checking existing clearance"
                        });
                    }

                    // If the order is already assigned to clearance, skip it
                    if (existingClearance.length > 0) {
                        ordersToProcess--;
                        if (ordersToProcess === 0) {
                            return res.status(200).json({
                                success: true,
                                message: "All orders processed successfully"
                            });
                        }
                        return;
                    }

                    // Fetch order data based on order_id
                    const fetchOrderQuery = `
                        SELECT 
                            o.assign_to_clearance, o.client_id, f.client_ref_name, f.product_desc, f.shipment_ref AS is_cong_shipp,  
                            f.collection_from, f.delivery_to, f.port_of_loading, f.post_of_discharge, f.commodity, 
                            f.package_type, f.no_of_packages, o.dimensions, o.weight, o.id AS order_id
                        FROM tbl_orders AS o
                        INNER JOIN tbl_freight AS f ON f.id = o.freight_id
                        WHERE o.id = ?
                    `;

                    con.query(fetchOrderQuery, [order_id], (fetchErr, result) => {
                        if (fetchErr) {
                            return res.status(500).json({
                                success: false,
                                message: "Error fetching order data"
                            });
                        }

                        if (result.length === 0) {
                            return res.status(404).json({
                                success: false,
                                message: `Order with ID ${order_id} not found`
                            });
                        }

                        const {
                            assign_to_clearance, client_id, client_ref_name, product_desc, is_cong_shipp,
                            collection_from, delivery_to, port_of_loading, post_of_discharge, commodity,
                            package_type, no_of_packages, dimensions, weight
                        } = result[0];

                        // Check if order is already assigned to clearance
                        if (assign_to_clearance === 1) {
                            ordersToProcess--;
                            if (ordersToProcess === 0) {
                                return res.status(200).json({
                                    success: true,
                                    message: "All orders processed successfully"
                                });
                            }
                            return;
                        }

                        // Generate clearance number
                        generateClearanceNumber((err, clearanceNumber) => {
                            if (err) {
                                return res.status(500).json({
                                    success: false,
                                    message: "Error generating clearance number"
                                });
                            }

                            // Insert data into tbl_clearance
                            const insertQuery = `
                                INSERT INTO tbl_clearance (
                                    clearance_number, user_id, order_id, customer_ref, goods_desc, 
                                    is_cong_shipp, loading_country, discharge_country, 
                                    port_of_loading, port_of_discharge, nature_of_goods, 
                                    packing_type, total_dimension, total_weight, total_box, added_by
                                ) 
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)
                            `;
                            const insertParams = [
                                clearanceNumber, client_id, order_id, client_ref_name, product_desc || "",
                                is_cong_shipp, collection_from, delivery_to,
                                port_of_loading, post_of_discharge, commodity,
                                package_type, dimensions, weight, no_of_packages, 1
                            ];

                            con.query(insertQuery, insertParams, (insertErr, data) => {
                                if (insertErr) {
                                    return res.status(500).json({
                                        success: false,
                                        message: insertErr.message
                                    });
                                }

                                if (data.affectedRows > 0) {
                                    // Insert into clearance_order
                                    con.query('INSERT INTO clearance_order (clearance_id, user_id, order_id) VALUES (?,?,?)', [data.insertId, client_id || null, order_id], (err) => {
                                        if (err) throw err;
                                    });

                                    // Update the tbl_orders to mark it as assigned to clearance
                                    const updateQuery = `
                                        UPDATE tbl_orders 
                                        SET assign_to_clearance = 1, clearance_id =?
                                        WHERE id = ?
                                    `;
                                    con.query(updateQuery, [data.insertId, order_id], (updateErr) => {
                                        if (updateErr) {
                                            return res.status(500).json({
                                                success: false,
                                                message: "Error updating order status"
                                            });
                                        }

                                        ordersProcessed.push(order_id);

                                        if (ordersProcessed.length === orders.length) {
                                            res.status(200).json({
                                                success: true,
                                                message: "All orders assigned to clearance successfully"
                                            });
                                        }
                                    });
                                } else {
                                    res.status(400).json({
                                        success: false,
                                        message: "Failed to add clearance for order ID: " + order_id
                                    });
                                }
                            });
                        });
                    });
                });
            });
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


function notifyUnrespondedDisputes() {
    const disputeQuery = `
        SELECT id, Dispute_ID, created 
        FROM tbl_queries 
        WHERE TIMESTAMPDIFF(HOUR, created, NOW()) >= 48 
          AND is_notified = 0
    `;

    // Query to fetch all active accounts and support team members
    const teamQuery = `
        SELECT email, cellphone 
        FROM tbl_users 
        WHERE user_type = 2 
          AND (FIND_IN_SET(5, assigned_roles) OR FIND_IN_SET(8, assigned_roles))
          AND is_deleted = 0 
          AND status = 1
    `;

    con.query(disputeQuery, (err, disputes) => {
        if (err) {
            console.error('Error querying disputes:', err);
            return;
        }

        if (!disputes.length) {
            console.log('No pending disputes for notification.');
            return;
        }

        con.query(teamQuery, (teamErr, teamMembers) => {
            if (teamErr) {
                console.error('Error fetching team members:', teamErr);
                return;
            }

            if (!teamMembers.length) {
                console.log('No active accounts or support team members found to notify.');
                return;
            }

            disputes.forEach(dispute => {
                const disputeId = dispute.Dispute_ID;

                const message = `*Dispute Pending Review*\n\nDispute ID: #${disputeId} has not been resolved for over 48 hours.\n\nPlease review this dispute.`;
                const emailSubject = `Dispute ID: #${disputeId} Overdue`;
                const emailBody = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; background-color: #fff; border: 1px solid #ddd;">
                        <h2 style="color: #d9534f;">Dispute Notification</h2>
                        <p>Dispute with ID <strong>#${disputeId}</strong> has not been addressed within 48 hours.</p>
                        <p>Please log in to your dashboard to review and take necessary action.</p>
                        <br/>
                        <p style="font-size: 14px; color: #888;">
                            Regards,<br><strong>Management System</strong>
                        </p>
                    </div>
                `;

                // Send notifications to each team member
                teamMembers.forEach(member => {
                    // 05-06-2025
                    /* if (member.cellphone) {
                        sendWhatsApp(member.cellphone, message);
                        sendSms(member.cellphone, message);
                    } */
                    if (member.email) {
                        sendMail(member.email, emailSubject, emailBody);
                    }
                });

                // Mark dispute as notified
                const updateQuery = `UPDATE tbl_queries SET is_notified = 1 WHERE Dispute_ID = ?`;
                con.query(updateQuery, [disputeId], (updateErr) => {
                    if (updateErr) {
                        console.error(`Error updating dispute ${disputeId}:`, updateErr);
                    } else {
                        console.log(`Notification sent for Dispute ID: ${disputeId}`);
                    }
                });
            });
        });
    });
}


// Schedule to run every hour at minute 0
cron.schedule('0 * * * *', () => {
    console.log(`Running dispute notification check at ${new Date().toISOString()}`);
    notifyUnrespondedDisputes();
});


function notifyDisputesUnresolved7Days() {
    const disputeQuery = `
        SELECT id, Dispute_ID, created 
        FROM tbl_queries 
        WHERE TIMESTAMPDIFF(DAY, created, NOW()) >= 7 
          AND is_notified_7days = 0
    `;

    const teamQuery = `
        SELECT email, cellphone 
        FROM tbl_users 
        WHERE user_type = 2 
          AND (FIND_IN_SET(5, assigned_roles) OR FIND_IN_SET(8, assigned_roles))
          AND is_deleted = 0 
          AND status = 1
    `;

    con.query(disputeQuery, (err, disputes) => {
        if (err) {
            console.error('Error querying 7-day disputes:', err);
            return;
        }

        if (!disputes.length) {
            console.log(' No disputes pending for 7-day notification.');
            return;
        }

        con.query(teamQuery, (teamErr, teamMembers) => {
            if (teamErr) {
                console.error('Error fetching team members:', teamErr);
                return;
            }

            if (!teamMembers.length) {
                console.log('No active accounts or support team members found to notify.');
                return;
            }

            disputes.forEach(dispute => {
                const disputeId = dispute.Dispute_ID;

                const message = `*Dispute Unresolved - 7 Days*\n\nDispute ID: #${disputeId} has remained unresolved for over 7 days.\n\nImmediate action is required.`;
                const emailSubject = `Dispute ID: #${disputeId} Unresolved for 7 Days`;
                const emailBody = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; background-color: #fff; border: 1px solid #ddd;">
                        <h2 style="color: #d9534f;">Urgent Dispute Notification</h2>
                        <p>Dispute with ID <strong>#${disputeId}</strong> has not been resolved for over 7 days.</p>
                        <p>Please take immediate action.</p>
                        <br/>
                        <p style="font-size: 14px; color: #888;">
                            Regards,<br><strong>Management System</strong>
                        </p>
                    </div>
                `;

                // Send notifications to each team member
                teamMembers.forEach(member => {
                    // 05-06-2025
                    /* if (member.cellphone) {
                        sendWhatsApp(member.cellphone, message);
                        sendSms(member.cellphone, message);
                    } */
                    if (member.email) {
                        sendMail(member.email, emailSubject, emailBody);
                    }
                });

                // Mark as notified for 7 days
                const updateQuery = `UPDATE tbl_queries SET is_notified_7days = 1 WHERE Dispute_ID = ?`;
                con.query(updateQuery, [disputeId], (updateErr) => {
                    if (updateErr) {
                        console.error(`Error updating 7-day dispute ${disputeId}:`, updateErr);
                    } else {
                        console.log(`7-day notification sent for Dispute ID: ${disputeId}`);
                    }
                });
            });
        });
    });
}


cron.schedule('0 0 * * *', () => {
    notifyDisputesUnresolved7Days();
});




module.exports = {
    AddCustomer, GetClientList, Get_ClientList, updateClient, GetClientById, DeleteClient, GetClientFreights, AddClearing,
    EditClearing, GetClearingList, GetClearingById, Deleteclearance, customerRegister, CustomerLogin,
    AddfreightByCustomer, UpdatefreightByCustomer, GetNotificationUser, updateNotificationSeen, deleteOneNotification,
    DeleteAllNotification, UpdateClientProfile, AddClearingByCustomer, GetClearingClient, AcceptQuotation,
    GetShipEstimate, RejectQuotation, orderDetails, UserforgotPassword, UserResetPassword, findHsCode, getListClearanceQuotation,
    uploadClrearanceDOC, CleranceOrderList, addQueries, updateQuery, getQueries, getQueriesByUserId, deleteQueries, addCommodity,
    getCommodities, AllFreightOrderNumbers, AllBatchNumbers, getAssignShipmentList, AddShipment, getShipment,
    UpdateShipment, DeleteShipment, addWareProductByUser, AssignFreightToClearing, AssignToClearing, CopyShipment, DeleteShipmentDetails, GetShipmentDetails, getShipmentbyid, AssignBatchOrdersToClearing
}
