const con = require('../config/database');
const { validationResult, Result } = require('express-validator');
const bcrypt = require('bcryptjs');
const rendomString = require('randomstring');
const sendMail = require('../helpers/sendMail')


async function hashPassword(password) {
    return await bcrypt.hash(password, 10);
}

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
                                message: "Details updated successfully "
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

// const GetClientFreights = async (req, res) => {
//     try {
//         const { user_id, status } = req.body;

//         if (!user_id) {
//             res.status(400).send({
//                 success: false,
//                 message: "Please provide user id"
//             });
//             return;
//         }

//         const getUserQuery = `SELECT * FROM tbl_users WHERE id=?`;

//         con.query(getUserQuery, [user_id], async (err, result) => {
//             try {
//                 if (err) throw err;

//                 if (result.length === 0) {
//                     res.status(400).send({
//                         success: false,
//                         message: "User id does not exist"
//                     });
//                     return;
//                 }

//                 let condition = 'WHERE tbl_freight.client_ref = ? AND tbl_freight.is_deleted = ?';
//                 let params = [user_id, 0];

//                 if (status) {
//                     condition += ' AND tbl_freight.status = ?';
//                     params.push(status);
//                 }

//                 const selectQuery = `
//                     SELECT tbl_freight.id, tbl_freight.client_ref, tbl_freight.product_desc, tbl_freight.date, tbl_freight.type, tbl_freight.freight, tbl_freight.incoterm, tbl_freight.dimension, tbl_freight.weight,
//                         tbl_freight.comment, tbl_freight.no_of_packages, tbl_freight.package_type, tbl_freight.commodity, tbl_freight.hazardous, tbl_freight.industry, tbl_freight.country_id, 
//                         tbl_freight.place_of_delivery, tbl_freight.ready_for_collection, tbl_freight.added_by, tbl_freight.status, tbl_freight.order_status, tbl_users.full_name AS client_name
//                     FROM tbl_freight 
//                     INNER JOIN tbl_users ON tbl_users.id = tbl_freight.client_ref 
//                     ${condition}
//                     ORDER BY tbl_freight.created_at DESC`;

//                 const data = await new Promise((resolve, reject) => {
//                     con.query(selectQuery, params, (err, data) => {
//                         if (err) reject(err);
//                         else resolve(data);
//                     });
//                 });

//                 if (data.length > 0) {
//                     const promises = data.map(async (item) => {
//                         if (item.country_id !== 0) {
//                             const countryResult = await new Promise((resolve, reject) => {
//                                 con.query(`SELECT country_of_origin FROM country_origin WHERE id=?`, [item.country_id], (err, result) => {
//                                     if (err) reject(err);
//                                     else resolve(result);
//                                 });
//                             });

//                             if (countryResult.length > 0) {
//                                 item.country_id = countryResult[0].country_of_origin;
//                             }
//                         }
//                     });

//                     await Promise.all(promises);

//                     res.status(200).send({
//                         success: true,
//                         data: data
//                     });
//                 } else {
//                     res.status(400).send({
//                         success: false,
//                         message: "No list available"
//                     });
//                 }
//             } catch (error) {
//                 res.status(500).send({
//                     success: false,
//                     message: error.message
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

const GetClientFreights = async (req, res) => {
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

            let condition = 'WHERE tbl_freight.client_ref = ? AND tbl_freight.is_deleted = 0';
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
                INNER JOIN tbl_users ON tbl_users.id = tbl_freight.client_ref
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
};


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
            trans_reference, client, customer_ref, goods_desc, destination, port_of_entry, port_of_exit, clearing_agent, clearing_status, clearing_result,
            document_req, comment_on_docs
        } = req.body;

        // Generate the clearance number
        generateClearanceNumber((err, clearanceNumber) => {
            if (err) {
                // console.error('Error generating clearance number:', err);
                return res.status(500).json({
                    success: false,
                    message: "Internal Server Error"
                });
            }

            // Determine which insert query to use based on file uploads
            let insertQuery = `INSERT INTO tbl_clearance (trans_reference, client, customer_ref, goods_desc, destination, loading_country, discharge_country, clearing_agent, clearing_status, clearing_result, 
                document_req, comment_on_docs, added_by, clearance_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            let insertParams = [
                trans_reference, client, customer_ref, goods_desc, destination, port_of_entry, port_of_exit, clearing_agent, clearing_status, clearing_result,
                document_req, comment_on_docs, 1, clearanceNumber
            ];

            if (req.files && req.files.document && req.files.sad500) {
                insertQuery = `INSERT INTO tbl_clearance (trans_reference, client, customer_ref, goods_desc, destination, loading_country, discharge_country, clearing_agent, clearing_status, clearing_result, 
                    document_req, document_upload, sad500, comment_on_docs, added_by, clearance_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                insertParams = [
                    trans_reference, client, customer_ref, goods_desc, destination, port_of_entry, port_of_exit, clearing_agent, clearing_status, clearing_result,
                    document_req, req.files.document[0].filename, req.files.sad500[0].filename, comment_on_docs, 1, clearanceNumber
                ];
            } else if (req.files && req.files.document) {
                insertQuery = `INSERT INTO tbl_clearance (trans_reference, client, customer_ref, goods_desc, destination, loading_country, discharge_country, clearing_agent, clearing_status, clearing_result, 
                    document_req, document_upload, comment_on_docs, added_by, clearance_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                insertParams = [
                    trans_reference, client, customer_ref, goods_desc, destination, port_of_entry, port_of_exit, clearing_agent, clearing_status, clearing_result,
                    document_req, req.files.document[0].filename, comment_on_docs, 1, clearanceNumber
                ];
            } else if (req.files && req.files.sad500) {
                insertQuery = `INSERT INTO tbl_clearance (trans_reference, client, customer_ref, goods_desc, destination, loading_country, discharge_country, clearing_agent, clearing_status, clearing_result, 
                    document_req, sad500, comment_on_docs, added_by, clearance_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                insertParams = [
                    trans_reference, client, customer_ref, goods_desc, destination, port_of_entry, port_of_exit, clearing_agent, clearing_status, clearing_result,
                    document_req, req.files.sad500[0].filename, comment_on_docs, 1, clearanceNumber
                ];
            }

            // Execute the insertion query
            con.query(insertQuery, insertParams, (err, data) => {
                if (err) {
                    // console.error('Error inserting clearance data:', err);
                    return res.status(500).json({
                        success: false,
                        message: "Internal Server Error"
                    });
                }

                if (data.affectedRows > 0) {
                    res.status(200).send({
                        success: true,
                        message: "Clearance added successfully"
                    });
                } else {
                    res.status(400).send({
                        success: false,
                        message: "Failed to add Clearance"
                    });
                }
            });
        });

    } catch (error) {
        // console.error('Error in AddClearing function:', error);
        res.status(500).send({
            success: false,
            message: error.message
        });
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



const AddClearingByCustomer = async (req, res) => {
    try {
        const { user_id, client, freight, freight_option, is_Import_Export, is_cong_shipp, customer_ref, goods_desc, nature_of_goods, packing_type, total_dimension, total_box, total_weight, destination, loading_country, discharge_country, port_of_loading, port_of_discharge, comment_on_docs, added_by, document_name } = req.body;
        // console.log(req.body);
        if (!user_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide user id"
            });
        }

        // Generate the clearance number
        generateClearanceNumber((err, clearanceNumber) => {
            if (err) {
                // console.error('Error generating clearance number:', err);
                return res.status(500).json({
                    success: false,
                    message: "Internal Server Error"
                });
            }
            const addedByValue = added_by || 2;
            // Prepare insert query based on the presence of document files
            let insertQuery = `INSERT INTO tbl_clearance (user_id, freight, freight_option, is_Import_Export, is_cong_shipp, customer_ref, goods_desc, nature_of_goods, destination, loading_country, discharge_country, port_of_loading, port_of_discharge, packing_type, total_dimension, total_box, total_weight, comment_on_docs, added_by, clearance_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?,?,?,?,?,?,?,?,?)`;
            let insertParams = [user_id, freight, freight_option, is_Import_Export, is_cong_shipp, customer_ref || null, goods_desc, nature_of_goods, destination, loading_country, discharge_country, port_of_loading, port_of_discharge, packing_type, total_dimension, total_box, total_weight, comment_on_docs, addedByValue, clearanceNumber];

            if (req.files && req.files.document) {
                insertQuery = `INSERT INTO tbl_clearance (user_id, freight, freight_option, is_Import_Export, is_cong_shipp, customer_ref, goods_desc, nature_of_goods, destination, loading_country, discharge_country, port_of_loading, port_of_discharge, packing_type, total_dimension, total_box, total_weight, document_upload, document_name, comment_on_docs, added_by, clearance_number) VALUES (?, ?, ?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?,?,?,?,?,?,?,?)`;
                insertParams = [user_id, freight, freight_option, is_Import_Export, is_cong_shipp, customer_ref || null, goods_desc, nature_of_goods, destination, loading_country, discharge_country, port_of_loading, port_of_discharge, packing_type, total_dimension, total_box, total_weight, req.files.document[0].filename, document_name, comment_on_docs, addedByValue, clearanceNumber];
            }

            // Execute the insertion query
            con.query(insertQuery, insertParams, (err, data) => {
                if (err) {
                    // console.error('Error inserting clearance data:', err);
                    return res.status(500).json({
                        success: false,
                        message: "Internal Server Error"
                    });
                }

                if (data.affectedRows > 0) {
                    const InsertQuery = `insert into tbl_notifications (title, description, send_to) values (?,?,?)`;
                    con.query(InsertQuery, ["New Clearance Alert!", `A Client Has Added a New Clearance. Admins, Please Review and Process Accordingly`, 5], (err, notificationData) => {
                        if (err) {
                            // console.error('Error inserting notification:', err);
                            return res.status(500).json({
                                success: false,
                                message: "Internal Server Error"
                            });
                        }

                        con.query(`select id from tbl_users where user_type='${1}'`, (err, id) => {
                            if (err) {
                                // console.error('Error fetching admin user:', err);
                                return res.status(500).json({
                                    success: false,
                                    message: "Internal Server Error"
                                });
                            }

                            const insertNotificationSql = 'INSERT INTO notification_details (user_id, notification_id) VALUES (?, ?)';
                            con.query(insertNotificationSql, [id[0].id, notificationData.insertId], (err, result) => {
                                if (err) {
                                    // console.error('Error inserting notification details:', err);
                                    return res.status(500).json({
                                        success: false,
                                        message: "Internal Server Error"
                                    });
                                }
                            });
                        });
                    });

                    res.status(200).send({
                        success: true,
                        message: "Clearance added successfully",
                        data: data.insertId
                    });
                } else {
                    res.status(400).send({
                        success: false,
                        message: "Failed to add Clearance"
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

// Utility function to generate clearance number


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

const EditClearing = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }

    try {
        // Extract all fields from the request body for the update
        const { clearing_id, client, freight, freight_option, is_Import_Export, is_cong_shipp, customer_ref, goods_desc, nature_of_goods, packing_type, total_dimension, total_box, total_weight, destination, loading_country, discharge_country, port_of_loading, port_of_discharge, comment_on_docs, document_name } = req.body;
        // console.log(req.body);
        // console.log(req.files);

        // Check if a document file is provided
        if (req.files && req.files.document) {
            const UpdateQueryWithDoc = `
                UPDATE tbl_clearance 
                SET freight=?, freight_option=?, is_Import_Export=?, is_cong_shipp=?, customer_ref=?, goods_desc=?, nature_of_goods=?, 
                    packing_type=?, total_dimension=?, total_box=?, total_weight=?, destination=?, loading_country=?, discharge_country=?, 
                    port_of_loading=?, port_of_discharge=?, document_upload=?, document_name=?, comment_on_docs=?
                WHERE id=?`;

            // Execute update query with document upload
            await con.query(UpdateQueryWithDoc, [
                freight, freight_option, is_Import_Export, is_cong_shipp, customer_ref, goods_desc, nature_of_goods,
                packing_type, total_dimension, total_box, total_weight, destination, loading_country, discharge_country,
                port_of_loading, port_of_discharge, req.files.document[0].filename, document_name, comment_on_docs, clearing_id
            ], (err, data) => {
                if (err) throw err;
                if (data.affectedRows > 0) {
                    res.status(200).send({
                        success: true,
                        message: "Clearance updated successfully"
                    });
                } else {
                    res.status(400).send({
                        success: false,
                        message: "Failed to update clearance"
                    });
                }
            });
        } else {
            // Update query when there is no document file to upload
            const UpdateQueryWithoutDoc = `
                UPDATE tbl_clearance 
                SET  freight=?, freight_option=?, is_Import_Export=?, is_cong_shipp=?, customer_ref=?, goods_desc=?, nature_of_goods=?, 
                    packing_type=?, total_dimension=?, total_box=?, total_weight=?, destination=?, loading_country=?, discharge_country=?, 
                    port_of_loading=?, port_of_discharge=?, comment_on_docs=?
                WHERE id=?`;

            // Execute update query without document upload
            await con.query(UpdateQueryWithoutDoc, [
                freight, freight_option, is_Import_Export, is_cong_shipp, customer_ref, goods_desc, nature_of_goods,
                packing_type, total_dimension, total_box, total_weight, destination, loading_country, discharge_country,
                port_of_loading, port_of_discharge, comment_on_docs, clearing_id
            ], (err, data) => {
                if (err) throw err;
                if (data.affectedRows > 0) {
                    res.status(200).send({
                        success: true,
                        message: "Clearance updated successfully"
                    });
                } else {
                    res.status(400).send({
                        success: false,
                        message: "Failed to update clearance"
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
};

const GetClearingList = async (req, res) => {
    try {
        const { clearing_status, added_by } = req.body;
        // console.log(req.body);
        // console.log( clearing_status );
        if (!added_by) {
            return res.status(400).send({
                success: false,
                message: "Please provide added_by"
            })
        }
        if (!clearing_status) {

            const selectQuery = `SELECT tbl_clearance.*, a.name as port_of_exit_name, b.name as port_of_entry_name, u.full_name as client_name
FROM tbl_clearance
INNER JOIN countries as a ON a.id = tbl_clearance.discharge_country
INNER JOIN countries as b ON b.id = tbl_clearance.loading_country
INNER JOIN tbl_users as u ON u.id = tbl_clearance.user_id
WHERE tbl_clearance.is_deleted = ? AND tbl_clearance.added_by = ?
ORDER BY tbl_clearance.created_at DESC;
`;
            await con.query(selectQuery, [0, added_by], (err, data) => {
                if (err) throw err;
                // console.log(data.length);
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
            const selectQuery = `SELECT tbl_clearance.*, a.name as port_of_exit_name, b.name as port_of_entry_name, u.full_name as client_name
FROM tbl_clearance
INNER JOIN countries as a ON a.id = tbl_clearance.discharge_country
INNER JOIN countries as b ON b.id = tbl_clearance.loading_country
INNER JOIN tbl_users as u ON u.id = tbl_clearance.user_id
WHERE tbl_clearance.is_deleted = ?  AND tbl_clearance.quotation_status=? AND tbl_clearance.added_by = ?
ORDER BY tbl_clearance.created_at DESC`;
            await con.query(selectQuery, [0, clearing_status, added_by], (err, data) => {
                if (err) throw err;
                // console.log(data);
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
            const selectQuery = `select * from tbl_clearance where id=? and is_deleted=?`;
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
                        con.query(updateQuery, [1, clearing_id], (err, result) => {
                            if (err) throw err;
                            if (result.affectedRows > 0) {
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
                                res.status(200).send({
                                    success: true,
                                    message: "Your account has been successfully created !"
                                })
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
                            res.status(200).send({
                                success: true,
                                message: "Customer Login Sucessfully !",
                                data: data[0]
                            })
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

    try {
        // Extracting data from req.body
        const {
            client_id, date, commodity, fcl_lcl, product_desc, collection_from, freight, freight_type, shipment_ref, dimension, weight, user_type,
            shipment_origin, shipment_des, comment, no_of_packages, package_type, collection_address, delivery_address,
            nature_of_goods, delivery_to, port_of_loading, post_of_discharge, auto_calculate, add_attachments, sea_freight_option, road_freight_option, assign_for_estimate, insurance, quote_received, client_quoted, assign_to_transporter, send_to_warehouse, assign_warehouse, assign_to_clearing
        } = req.body;
        // console.log(req.body);
        // Generate the freight number
        generateFreightNumber((err, freightNumber) => {
            if (err) {
                // console.error('Error generating freight number:', err);
                return res.status(500).json({
                    success: false,
                    message: "Internal Server Error"
                });
            }

            const insertQuery = `INSERT INTO tbl_freight (client_ref, commodity, date, fcl_lcl, product_desc, collection_from, freight, freight_type,
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
                if (err) {
                    // console.error('Error inserting freight data:', err);
                    return res.status(500).json({
                        success: false,
                        message: "Internal Server Error"
                    });
                }
                // console.log(req.files.document);

                if (data.affectedRows > 0) {
                    const freightId = data.insertId;
                    // Handle document uploads
                    if (req.files && req.files.document) {
                        const docsInsertQuery = `update tbl_freight set add_attachment_file='${req.files.document[0].filename}' where id='${freightId}'`;
                        con.query(docsInsertQuery, (err, result) => {
                            if (err) {
                                // console.error('Error inserting document data:', err);
                                return res.status(500).json({
                                    success: false,
                                    message: "Internal Server Error"
                                });
                            }
                        });
                    }

                    con.query(`SELECT * FROM tbl_users WHERE user_type = ?`, [1], (err, adminUsers) => {
                        if (err) {
                            // console.error('Error fetching admin users:', err);
                            return res.status(500).json({
                                success: false,
                                message: "Internal Server Error"
                            });
                        }

                        con.query(`SELECT * FROM tbl_users WHERE id = ?`, [client_id], (err, user) => {
                            if (err) {
                                // console.error('Error fetching user data:', err);
                                return res.status(500).json({
                                    success: false,
                                    message: "Internal Server Error"
                                });
                            }
                            const selectQuery = `select * from tbl_freight where id='${freightId}'`
                            con.query(selectQuery, (err, result) => {
                                if (err) throw err;
                                const InsertQuery = `INSERT INTO tbl_notifications (title, description, send_to) VALUES (?, ?, ?)`;
                                con.query(InsertQuery, [
                                    "New Freight Alert!",
                                    `${user[0].full_name} has added a new freight with Freight Number: ${result[0].freight_number}. Please Review and Process Accordingly.`,
                                    5
                                ], (err, notificationResult) => {
                                    if (err) {
                                        // console.error('Error inserting notification:', err);
                                        return res.status(500).json({
                                            success: false,
                                            message: "Internal Server Error"
                                        });
                                    }

                                    const insertNotificationSql = 'INSERT INTO notification_details (user_id, notification_id) VALUES (?, ?)';
                                    con.query(insertNotificationSql, [adminUsers[0].id, notificationResult.insertId], (err, result) => {
                                        if (err) {
                                            // console.error('Error inserting notification details:', err);
                                            return res.status(500).json({
                                                success: false,
                                                message: "Internal Server Error"
                                            });
                                        }
                                    });
                                });
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
//         const { freight_id, product_desc, date, type, freight, incoterm, dimension, weight,
//             comment, no_of_packages, package_type, commodity, hazardous, industry, country_of_origin,
//             place_of_delivery, ready_for_collection } = req.body;
//         if (!freight_id) {
//             return res.status(400).send({
//                 success: false,
//                 message: error.message
//             })
//         }
//         await con.query(`select id from tbl_freight where id=?`, [freight_id], (err, result) => {
//             if (err) throw err;
//             if (result.length > 0) {
//                 const updateQuery = `Update tbl_freight set product_desc=?, date=?, type=?, freight=?, incoterm=?, dimension=?, weight=?,
//                 comment=?, no_of_packages=?, package_type=?, commodity=?, hazardous=?, industry=?, country_id=?, place_of_delivery=?, ready_for_collection=?, added_by=? where id=?`;
//                 con.query(updateQuery, [product_desc, date, type, freight, incoterm, dimension, weight, comment, no_of_packages, package_type, commodity, hazardous, industry, country_of_origin,
//                     place_of_delivery, ready_for_collection, 2, freight_id], (err, data) => {
//                         if (err) throw err;
//                         if (data.affectedRows > 0) {
//                             res.status(200).send({
//                                 success: true,
//                                 message: "Update freight successfully"
//                             })
//                         }
//                         else {
//                             res.status(400).send({
//                                 success: false,
//                                 message: "Failed to update Freight"
//                             })
//                         }
//                     })
//             }
//             else {
//                 res.status(400).send({
//                     success: false,
//                     message: "Freight id doesn't exist"
//                 })
//             }
//         })

//         /* if (req.file == undefined) {

//         }
//         else {
//             const insertQuery = `insert into tbl_freight (client_ref, product_desc, date, type, freight, incoterm, dimension, weight, 
//                     comment, no_of_packages, package_type, commodity, hazardous, industry, country_id, place_of_delivery, ready_for_collection, added_by) values( ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
//             await con.query(insertQuery, [client_id, product_desc, date, type, freight, incoterm, dimension, weight,
//                 comment, no_of_packages, package_type, commodity, hazardous, industry, country_of_origin, place_of_delivery, ready_for_collection, 2], (err, data) => {
//                     if (err) throw err;
//                     if (data.affectedRows > 0) {
//                         res.status(200).send({
//                             success: true,
//                             message: "Insert freight successfully"
//                         })
//                     }
//                     else {
//                         res.status(400).send({
//                             success: false,
//                             message: "Failed to insert Freight"
//                         })
//                     }
//                 })
//         } */
//     }
//     catch (error) {
//         res.status(500).send({
//             success: false,
//             message: error.message
//         })
//     }
// }
const UpdatefreightByCustomer = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }

    try {
        const {
            freight_id, client_id, product_desc, fcl_lcl, commodity, collection_from, freight, freight_type, shipment_ref, dimension, weight, user_type,
            shipment_origin, shipment_des, comment, no_of_packages, package_type, collection_address, delivery_address,
            nature_of_goods, delivery_to, port_of_loading, post_of_discharge, auto_calculate, add_attachments, sea_freight_option, road_freight_option, assign_for_estimate, insurance, quote_received, client_quoted, assign_to_transporter, send_to_warehouse, assign_warehouse, assign_to_clearing
        } = req.body;
        console.log(req.body);

        let updateFields = [];
        let updateParams = [];

        // Conditionally add client_id if provided
        if (client_id) {
            updateFields.push("client_ref = ?");
            updateParams.push(client_id);
        }

        // Unconditionally add other fields
        updateFields.push("product_desc = ?");
        updateParams.push(product_desc);

        updateFields.push("collection_from = ?");
        updateParams.push(collection_from);

        updateFields.push("freight = ?");
        updateParams.push(freight);

        updateFields.push("freight_type = ?");
        updateParams.push(freight_type);

        updateFields.push("shipment_origin = ?");
        updateParams.push(shipment_origin);

        updateFields.push("shipment_des = ?");
        updateParams.push(shipment_des);

        updateFields.push("shipment_ref = ?");
        updateParams.push(shipment_ref);

        updateFields.push("dimension = ?");
        updateParams.push(dimension);

        updateFields.push("weight = ?");
        updateParams.push(weight);

        updateFields.push("user_type = ?");
        updateParams.push(user_type);

        updateFields.push("comment = ?");
        updateParams.push(comment);

        updateFields.push("no_of_packages = ?");
        updateParams.push(no_of_packages);

        updateFields.push("package_type = ?");
        updateParams.push(package_type);

        updateFields.push("collection_address = ?");
        updateParams.push(collection_address);

        updateFields.push("delivery_address = ?");
        updateParams.push(delivery_address);

        updateFields.push("nature_of_goods = ?");
        updateParams.push(nature_of_goods);

        updateFields.push("delivery_to = ?");
        updateParams.push(delivery_to);

        updateFields.push("port_of_loading = ?");
        updateParams.push(port_of_loading);

        updateFields.push("post_of_discharge = ?");
        updateParams.push(post_of_discharge);

        updateFields.push("auto_calculate = ?");
        updateParams.push(auto_calculate);

        updateFields.push("add_attachments = ?");
        updateParams.push(add_attachments);

        updateFields.push("sea_freight_option = ?");
        updateParams.push(sea_freight_option);

        updateFields.push("road_freight_option = ?");
        updateParams.push(road_freight_option);

        updateFields.push("assign_for_estimate = ?");
        updateParams.push(assign_for_estimate);

        updateFields.push("insurance = ?");
        updateParams.push(insurance);

        updateFields.push("quote_received = ?");
        updateParams.push(quote_received);

        updateFields.push("client_quoted = ?");
        updateParams.push(client_quoted);

        updateFields.push("assign_to_transporter = ?");
        updateParams.push(assign_to_transporter);

        updateFields.push("send_to_warehouse = ?");
        updateParams.push(send_to_warehouse);

        updateFields.push("assign_warehouse = ?");
        updateParams.push(assign_warehouse);

        updateFields.push("assign_to_clearing = ?");
        updateParams.push(assign_to_clearing);

        updateFields.push("fcl_lcl = ?");
        updateParams.push(fcl_lcl);

        updateFields.push("commodity = ?")
        updateParams.push(commodity)

        updateParams.push(freight_id);

        const updateQuery = `UPDATE tbl_freight SET ${updateFields.join(", ")} WHERE id = ?`;

        con.query(updateQuery, updateParams, (err, data) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: err.message
                });
            }

            if (data.affectedRows > 0) {
                // Handle document updates
                if (req.files && req.files.document) {
                    const docsInsertQuery = `update tbl_freight set add_attachment_file='${req.files.document[0].filename}' where id='${freight_id}'`;
                    con.query(docsInsertQuery, (err, result) => {
                        if (err) {
                            console.error('Error inserting document data:', err);
                            return res.status(500).json({
                                success: false,
                                message: "Internal Server Error"
                            });
                        }
                    });
                }

                res.status(200).send({
                    success: true,
                    message: "Freight updated successfully"
                });
            } else {
                res.status(400).send({
                    success: false,
                    message: "Failed to update Freight"
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
                                })
                            });

                            res.status(200).send({
                                success: true,
                                message: "Accept quotation successfully"
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
                            con.query(`select * from tbl_users where id='${order_status[0].client_ref}'`, (err, details) => {
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
        const { user_id } = req.body;
        if (!user_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide user id"
            })
        }
        await con.query(`select tbl_orders.*, CONCAT('OR000', tbl_orders.id) as order_id, tbl_freight.*, tbl_freight.id as freight_id, tbl_users.*, c.name AS collection_from_country, 
    co.name AS delivery_to_country, cm.name as commodity_name,
    c.flag_url AS collection_from_country_flag_url, 
    co.flag_url AS delivery_to_country_flag_url
            from tbl_orders
        INNER JOIN tbl_freight on tbl_freight.id=tbl_orders.freight_id
        INNER JOIN tbl_users on tbl_users.id=tbl_orders.client_id
        LEFT JOIN countries AS co ON co.id = tbl_freight.delivery_to
        LEFT JOIN tbl_commodity  AS cm ON cm.id = tbl_freight.commodity
        LEFT JOIN countries AS c ON c.id = tbl_freight.collection_from
        where client_id='${user_id}'`, (err, data) => {
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
                    message: "Order list not available"
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

const uploadClrearanceDOC = async (req, res) => {
    try {
        const { clearance_id } = req.body;
        if (req.files && req.files.supplier_invoice) {
            con.query(`update tbl_clearance set supplier_invoice='${req.files.supplier_invoice[0].filename}' where id='${clearance_id}'`, (err, data) => {
                if (err) throw err;
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
        }
        if (req.files && req.files.waybill) {
            con.query(`update tbl_clearance set waybill='${req.files.waybill[0].filename}' where id='${clearance_id}'`, (err, data) => {
                if (err) throw err;
            })
        }
        if (req.files && req.files.bill_of_lading) {
            con.query(`update tbl_clearance set bill_of_lading='${req.files.bill_of_lading[0].filename}' where id='${clearance_id}'`, (err, data) => {
                if (err) throw err;
            })
        }
        if (req.files && req.files.product_brochures) {
            con.query(`update tbl_clearance set product_brochures='${req.files.product_brochures[0].filename}' where id='${clearance_id}'`, (err, data) => {
                if (err) throw err;
            })
        }
        if (req.files && req.files.arrival_notification) {
            con.query(`update tbl_clearance set arrival_notification='${req.files.arrival_notification[0].filename}' where id='${clearance_id}'`, (err, data) => {
                if (err) throw err;
            })
        }
        if (req.files && req.files.product_literature) {
            con.query(`update tbl_clearance set product_literature='${req.files.product_literature[0].filename}' where id='${clearance_id}'`, (err, data) => {
                if (err) throw err;
            })
        }
        if (req.files && req.files.letter_of_authority) {
            con.query(`update tbl_clearance set letter_of_authority='${req.files.letter_of_authority[0].filename}' where id='${clearance_id}'`, (err, data) => {
                if (err) throw err;
            })
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
        const { name, phone_no, email, subject, message } = req.body;

        if (!name || !phone_no || !email || !subject || !message) {
            return res.status(400).send({
                success: false,
                message: "All Fields are Required"
            })
        }
        con.query(`insert into tbl_queries (name, phone_no, email, subject, message) values('${name}','${phone_no}', '${email}', '${subject}', '${message}')`, (err, presult) => {
            if (err) throw err;
            return res.status(200).send({
                success: true,
                message: "Your query has been received. Our team will get back to you shortly."
            })
        })
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        })
    }
}

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
        con.query(`SELECT * FROM tbl_commodity ORDER BY created_at DESC`, (err, result) => {
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


module.exports = {
    AddCustomer, GetClientList, updateClient, GetClientById, DeleteClient, GetClientFreights, AddClearing,
    EditClearing, GetClearingList, GetClearingById, Deleteclearance, customerRegister, CustomerLogin,
    AddfreightByCustomer, UpdatefreightByCustomer, GetNotificationUser, updateNotificationSeen, deleteOneNotification,
    DeleteAllNotification, UpdateClientProfile, AddClearingByCustomer, GetClearingClient, AcceptQuotation,
    GetShipEstimate, RejectQuotation, orderDetails, UserforgotPassword, UserResetPassword, findHsCode, getListClearanceQuotation,
    uploadClrearanceDOC, CleranceOrderList, addQueries, getQueries, deleteQueries, addCommodity, getCommodities
}
