const con = require('../config/database');
const { validationResult, Result } = require('express-validator');
const bcrypt = require('bcryptjs');
const sendMail = require('../helpers/sendMail')
const rendomString = require('randomstring');
const { assign } = require('nodemailer/lib/shared');
const { findOrCreateFolder, uploadFile } = require('../helpers/uploadDrive');
const { logging } = require('googleapis/build/src/apis/logging');
const { sendSms, sendWhatsApp } = require('../helpers/twilioService');
const cron = require('node-cron');

async function hashPassword(password) {
    return await bcrypt.hash(password, 10);
}

const AdminLogin = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    try {
        const { email, password } = req.body;
        let findUserQuery = "SELECT id, full_name, profile, email, password, user_type, is_deleted, status, assigned_roles, created_at, updated_at FROM tbl_users WHERE email = ? and is_deleted=? and (user_type=? or user_type=?)";
        await con.query(findUserQuery, [email, 0, 1, 2], (err, data) => {
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
                                message: "Admin Login Sucessfully !",
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

const ChangePassword = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    try {
        const { id, oldpassword, newpassword, confirmpassword } = req.body;
        var encrypassword = await hashPassword(newpassword);
        await con.query(`select password from tbl_users where id='${id}'`, (err, pass) => {
            if (err) throw err;
            bcrypt.compare(oldpassword, pass[0].password, (err, password) => {
                if (err) throw err;
                if (password) {
                    if (newpassword !== confirmpassword) {
                        res.status(400).send({
                            success: false,
                            message: "New Password and Confirm Password doesn't match !"
                        })
                    }
                    else {
                        con.query(`update tbl_users set password='${encrypassword}' where id='${id}'`, (err, data) => {
                            if (err) throw err;
                            // console.log(data);
                            if (data.affectedRows > 0) {
                                res.status(200).send({
                                    success: true,
                                    message: "Password has been successfully changed !"
                                })
                            }
                            else {
                                res.status(400).send({
                                    success: false,
                                    message: "Failed to changed password !"
                                })
                            }
                        })
                    }
                }
                else {
                    res.status(400).send({
                        success: false,
                        message: "Old password Incorrect !"
                    })
                }
            })
        });

    }
    catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        })
    }
}

const updateProfile = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    try {
        const { id, full_name, email } = req.body;
        let sql = "Select * from tbl_users where email = ? AND id <> ? AND user_type=?";
        await con.query(sql, [email, id, 1], (err, data) => {
            if (err) throw err;
            if (data.length > 0) {
                res.status(400).send({
                    success: false,
                    message: "Email already exists !"
                })
            }
            else {
                if (req.file !== undefined) {
                    const updateQuery = `update tbl_users set full_name=?, email=?, profile=? where id=?`;
                    con.query(updateQuery, [full_name, email, req.file.filename, id], (err, updateData) => {
                        if (err) throw err;
                        if (updateData.affectedRows > 0) {

                            let sql = "Select * from tbl_users where id= ?";
                            con.query(sql, [id], (err, datas) => {
                                if (err) throw err;

                                res.status(200).send({
                                    success: true,
                                    message: "Details updated successfully ",
                                    data: datas
                                })
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
                else {
                    const updateQuery = `update tbl_users set full_name=?, email=? where id=?`;
                    con.query(updateQuery, [full_name, email, id], (err, updateData) => {
                        if (err) throw err;
                        if (updateData.affectedRows > 0) {
                            let sql = "Select * from tbl_users where id= ?";
                            con.query(sql, [id], (err, datas) => {
                                if (err) throw err;

                                res.status(200).send({
                                    success: true,
                                    message: "Details updated successfully ",
                                    data: datas
                                })
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

const forgotPassword = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    try {
        const { email } = req.body;
        let sql = "SELECT * FROM tbl_users WHERE email=? AND (user_type=? OR user_type=?)";
        await con.query(sql, [email, 1, 2], (err, data) => {
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
                                                <a href="http://ship.asiadirect.africa/Admin/conform-passs?token='${randomToken}'"
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

const ResetPassword = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    try {
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

const PrivacyPolicy = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    try {
        const { heading, description } = req.body;

        const selectQuery = `select id from tbl_privacy`;
        await con.query(selectQuery, (err, privacy) => {
            if (err) throw err;
            if (privacy.length > 0) {
                const updateQuery = `update tbl_privacy set heading=?, description=? where id=?`;
                con.query(updateQuery, [heading, description, privacy[0].id], (err, data) => {
                    if (err) throw err;
                    if (data.affectedRows > 0) {
                        res.status(200).send({
                            success: true,
                            message: "Successfully update Privacy & Policy"
                        })
                    }
                    else {
                        res.status(400).send({
                            success: false,
                            message: "Failed to update Privacy & Policy"
                        })
                    }
                })
            }
            else {
                const insertQuery = `insert into tbl_privacy (heading, description) values(?, ?)`;
                con.query(insertQuery, [heading, description], (err, result) => {
                    if (err) throw err;
                    if (result.affectedRows > 0) {
                        res.status(200).send({
                            success: true,
                            message: "Privacy & Policy successfully added"
                        })
                    }
                    else {
                        res.status(400).send({
                            success: false,
                            message: "Failed to update Privacy & Policy"
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

const GetPrivacy = async (req, res) => {
    try {
        const selectQuery = `select * from tbl_privacy`;
        await con.query(selectQuery, (err, data) => {
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

const TermCondition = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    try {
        const { heading, description } = req.body;
        const selectQuery = `select id from tbl_terms`;
        await con.query(selectQuery, (err, terms) => {
            if (err) throw err;
            if (terms.length > 0) {
                const updateQuery = `update tbl_terms set heading=?, description=? where id=?`;
                con.query(updateQuery, [heading, description, terms[0].id], (err, terms) => {
                    if (err) throw err;
                    if (terms.affectedRows > 0) {
                        res.status(200).send({
                            success: true,
                            message: "Successfully update Terms & Conditions"
                        })
                    }
                    else {
                        res.status(400).send({
                            success: false,
                            message: "Failed to update Terms & Conditions"
                        })
                    }
                })
            }
            else {
                const insertQuery = `insert into tbl_terms (heading, description) values (?, ?)`;
                con.query(insertQuery, [heading, description], (err, data) => {
                    if (err) throw err;
                    if (data.affectedRows > 0) {
                        res.status(200).send({
                            success: true,
                            message: "Terms & Conditions successfully added"
                        })
                    }
                    else {
                        res.status(400).send({
                            success: false,
                            message: "Failed to update Terms & Conditions"
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

const GetTerms = async (req, res) => {
    try {
        const selectTerm = `select * from tbl_terms`;
        await con.query(selectTerm, (err, data) => {
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


const GetFreightAdmin = async (req, res) => {
    const { status, priority, origin, destination, startDate, endDate, freightType, freightSpeed } = req.body;

    try {
        let condition = 'WHERE tbl_freight.is_deleted = ? AND tbl_freight.added_by = ? AND tbl_freight.order_status = ?';
        let params = [0, 1, 0];

        if (status) {
            condition += ' AND tbl_freight.status = ?';
            params.push(status);
        }

        if (priority) {
            condition += ' AND tbl_freight.priority = ?';
            params.push(priority);
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
            SELECT
            tbl_freight.id as freight_id, tbl_freight.attachment_Estimate, tbl_freight.sales_representative as sales_id, ss.full_name as sales_name,  tbl_freight.fcl_lcl, tbl_users.*, tbl_users.id as user_id, tbl_users.full_name as client_name, tbl_users.email as client_email, tbl_freight.product_desc,
                tbl_freight.client_id as client_ref, tbl_freight.date, tbl_freight.type, tbl_freight.freight, tbl_freight.incoterm, tbl_freight.dimension, tbl_freight.weight,
                tbl_freight.quote_received, tbl_freight.client_quoted, tbl_freight.status, tbl_freight.comment, tbl_freight.no_of_packages, tbl_freight.package_type,
                tbl_freight.commodity, cm.name as commodity_name, tbl_freight.shipper_name, tbl_freight.hazardous, tbl_freight.collection_from, tbl_freight.delivery_to, tbl_freight.supplier_address, tbl_freight.shipment_origin, tbl_freight.shipment_des,
                tbl_freight.port_of_loading, tbl_freight.post_of_discharge, tbl_freight.place_of_delivery, tbl_freight.ready_for_collection,
                tbl_freight.transit_time, tbl_freight.priority, tbl_freight.added_by, tbl_freight.freight_number, tbl_freight.shipment_details,
                tbl_freight.nature_of_hazard, tbl_freight.volumetric_weight, tbl_freight.assign_for_estimate, tbl_freight.assign_to_transporter,
                tbl_freight.is_active, tbl_freight.add_attachments, tbl_freight.add_attachment_file, tbl_freight.assign_warehouse, tbl_freight.order_status, tbl_freight.created_at as freight_created_at, tbl_freight.assign_to_clearing, tbl_freight.send_to_warehouse, tbl_freight.client_ref_name, tbl_freight.shipment_ref, tbl_freight.insurance, c.name as delivery_to_name, co.name as collection_from_name, 
                s.origin_pick_up AS estimate_origin_pick_up, s.Supplier_Quote_Amount AS estimate_Supplier_Quote_Amount,
                s.freight_currency AS estimate_freight_currency, s.freight_amount AS estimate_freight_amount,
                s.origin_customs AS estimate_origin_customs, 
                    s.origin_customs_gp AS estimate_origin_customs_gp,
                     s.origin_customs AS estimate_origin_customs, 
                    s.origin_document AS estimate_origin_document, 
                   s.origin_document_gp AS estimate_origin_document_gp,
                   s.origin_warehouse AS estimate_origin_warehouse, 
                    s.origin_warehouse_gp AS estimate_origin_warehouse_gp, 
                    s.des_warehouse AS estimate_des_warehouse, 
                    s.des_warehouse_gp AS estimate_des_warehouse_gp, 
                    s.des_delivery AS estimate_des_delivery, 
                    s.des_delivery_gp AS estimate_des_delivery_gp,
                     s.freight_amount as estimate_freight_amount,
                     s.id as estimated_id,
    s.freight_gp as estimate_freight_gp,
    s.origin_port_fees as estimate_origin_port_fees,
    s.origin_port_fees_gp as estimate_origin_port_fees_gp,
    s.des_customs_gp as estimate_des_customs_gp,
    s.des_customs as estimate_des_customs,
 s.des_document as estimate_des_document,
    s.des_document_gp as estimate_des_document_gp,
     s.des_port_fees as estimate_des_port_fees,
    s.des_port_fees_gp as estimate_des_port_fees_gp,
    s.des_unpack as estimate_des_unpack,
    s.des_unpack_gp as estimate_des_unpack_gp,
    s.des_other as estimate_des_other,
    s.des_other_gp as estimate_des_other_gp,
    s.des_other as estimate_des_other,
    s.des_currency as estimate_des_currency,
    s.freigh_amount as estimate_freigh_amount,
    s.origin_amount as estimate_origin_amount,
     s.des_amount as estimate_des_amount,
    s.sub_amount as estimate_sub_amount,
    s.exchange_rate as estimate_exchange_rate,
    s.total_amount as estimate_total_amount,
    s.Supplier_Quote_Attachment as estimate_Supplier_Quote_Attachment,
    s.Supplier_Quote_Amount as estimate_Supplier_Quote_Amount,
    s.serial_number as estimate_serial_number
            FROM tbl_freight
            LEFT JOIN tbl_users AS ss ON ss.id = tbl_freight.sales_representative
            LEFT JOIN tbl_users ON tbl_users.id = tbl_freight.client_id
            LEFT JOIN countries AS c ON c.id = tbl_freight.delivery_to
            LEFT JOIN countries AS co ON co.id = tbl_freight.collection_from
            LEFT JOIN shipping_estimate  AS s ON s.freight_id = tbl_freight.id
            LEFT JOIN tbl_commodity  AS cm ON cm.id = tbl_freight.commodity
            ${condition}
            GROUP BY tbl_freight.id
            ORDER BY tbl_freight.created_at DESC`;

        await con.query(selectQuery, params, (err, data) => {
            if (err) {
                res.status(500).send({ success: false, message: err.message });
                return;
            }

            if (data.length > 0) {
                res.status(200).send({ success: true, data: data });
            } else {
                res.status(404).send({ success: false, message: 'No records found' });
            }
        });
    } catch (error) {
        res.status(500).send({ success: false, message: error.message });
    }
};


const Addfreight = (req, res) => {
    try {
        // Extracting data from req.body
        const {
            client_ref, client_email, date, type, fcl_lcl, freight, incoterm, dimension, weight, quote_received, client_quoted, shipment_ref, insurance,
            is_active, comment, no_of_packages, package_type, commodity, hazardous, industry, country_of_origin, destination_country,
            supplier_address, shipper_name, port_of_loading, post_of_discharge, place_of_delivery, ready_for_collection, Product_Description,
            transit_time, priority, shipment_details, nature_of_hazard, volumetric_weight, assign_for_estimate, sales_representative, assign_to_transporter, assign_warehouse, assign_to_clearing, send_to_warehouse, shipment_origin, shipment_des, client_ref_name, add_attachments
        } = req.body;
        // console.log(req.files);

        // Generate the freight number
        generateFreightNumber((err, freightNumber) => {
            if (err) throw err;

            // Insert into the database
            let insertQuery;
            let insertParams;

            insertQuery = `INSERT INTO tbl_freight (client_id, client_email, date, type, fcl_lcl, freight, incoterm, dimension, weight, 
            quote_received, client_quoted, is_active, comment, no_of_packages, package_type, commodity, hazardous, 
             collection_from, delivery_to, supplier_address, shipper_name, port_of_loading, post_of_discharge, place_of_delivery, 
            ready_for_collection, transit_time, priority, added_by, freight_number, shipment_details, 
            nature_of_hazard, volumetric_weight, assign_for_estimate, assign_to_transporter, assign_warehouse, assign_to_clearing, 
            send_to_warehouse, shipment_origin, shipment_des, product_desc, shipment_ref, insurance, client_ref_name, sales_representative) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?,?,?,?,?,?,?)`;
            insertParams = [
                client_ref, client_email, date, type, fcl_lcl || null, freight, incoterm, dimension, weight, quote_received, client_quoted,
                is_active, comment, no_of_packages, package_type, commodity, hazardous, country_of_origin, destination_country,
                supplier_address, shipper_name, port_of_loading, post_of_discharge, place_of_delivery, ready_for_collection,
                transit_time, priority, 1, freightNumber, shipment_details, nature_of_hazard, volumetric_weight, assign_for_estimate,
                assign_to_transporter, assign_warehouse, assign_to_clearing, send_to_warehouse, shipment_origin, shipment_des, Product_Description, shipment_ref, insurance, client_ref_name, sales_representative
            ];

            con.query(insertQuery, insertParams, (err, insertResult) => {
                if (err) throw err;
                /* if (req.file && req.file.filename) {
                    const docsInsertQuery = `update tbl_freight set add_attachments='${add_attachments}', add_attachment_file='${req.file.filename}' where id='${insertResult.insertId}'`;
                    con.query(docsInsertQuery, (err, result) => {
                        if (err) {
                            // console.error('Error inserting document data:', err);
                            return res.status(500).json({
                                success: false,
                                message: "Internal Server Error"
                            });
                        }
                    });
                } */

                const selectQuery = `
                    SELECT tbl_freight.freight_number, tbl_freight.client_id, tbl_users.full_name
                    FROM tbl_freight
                    INNER JOIN tbl_users ON tbl_users.id = tbl_freight.client_id
                    WHERE tbl_freight.id = ?
                  `;


                con.query(selectQuery, [insertResult.insertId], (err, result) => {
                    if (err) {
                        console.error("Error fetching freight number:", err);
                        return;
                    }

                    if (result.length === 0) {
                        console.error("No freight number found for the given ID.");
                        return;
                    }

                    const freightNumber = result[0].freight_number;
                    const Email = client_email; // send email to customer
                    const mailSubject = 'New Shipment Enquiry';
                    const content = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; background-color: #f9f9f9;">
    <h2 style="color: #2c3e50; border-bottom: 1px solid #ccc; padding-bottom: 10px;">New Shipment Enquiry</h2>

    <p style="font-size: 16px; color: #333;">
      Dear <strong>${result[0].full_name}</strong>,
    </p>

    <p style="font-size: 16px; color: #333;">
      We’re excited to let you know that a new shipment enquiry has been created under your profile.
    </p>

    <p style="font-size: 16px; color: #333;">
      <strong>Shipment Details:</strong><br>
      Freight Number: <strong>${freightNumber}</strong><br>
      Product Description: <strong>${Product_Description}</strong><br>
      Freight: <strong>${freight}</strong>
    </p>

    <p style="font-size: 16px; color: #333;">
      Our sales team will reach out to you shortly with further details. In the meantime, feel free to contact us if you have any questions.
    </p>

    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">

    <p style="font-size: 14px; color: #777;">
      Regards,<br>
      <strong>Management System</strong>
    </p>
  </div>
`;

                    sendMail(Email, mailSubject, content);

                    // Process all files for a given document type
                    const processFiles = async (fileArray, documentName) => {
                        try {


                            for (const file of fileArray) { // Loop through all files
                                const docsInsertQuery = `INSERT INTO freight_doc (freight_id, document_name, document) VALUES (?, ?, ?)`;

                                await new Promise((resolve, reject) => {
                                    con.query(docsInsertQuery, [insertResult.insertId, documentName, file.filename], (err) => {
                                        if (err) {
                                            console.error(`Error inserting ${documentName}:`, err);
                                            return reject(err);
                                        }
                                        resolve();
                                    });
                                });

                                console.log(`🚀 Uploading file: ${file.originalname}`);

                                // Upload the file to Google Drive
                                const folderId = await findOrCreateFolder(freightNumber);
                                console.log(`📂 Folder ID: ${folderId}`);
                                console.log(file);

                                const { fileId, webViewLink } = await uploadFile(folderId, file);

                                // Insert file details into transaction_files
                                const insertFileQuery = `
                                    INSERT INTO transaction_files 
                                    (freight_number, file_name, drive_file_id, file_link) 
                                    VALUES (?, ?, ?, ?)
                                `;

                                await new Promise((resolve, reject) => {
                                    con.query(insertFileQuery, [freightNumber, file.filename, fileId, webViewLink], (err) => {
                                        if (err) {
                                            console.error("Error inserting file details:", err);
                                            return reject(err);
                                        }
                                        resolve();
                                    });
                                });

                                console.log(`✅ ${documentName}: ${file.originalname} uploaded and recorded successfully!`);
                            }
                        } catch (error) {
                            console.error(`Error processing files for ${documentName}:`, error);
                        }
                    };


                    const handleFileUploads = async () => {
                        try {
                            if (req.files) {
                                const fileKeys = Object.keys(req.files);

                                for (const key of fileKeys) {
                                    const files = Array.isArray(req.files[key]) ? req.files[key] : [req.files[key]];

                                    if (files.length > 0) {
                                        const documentName = getDocumentName(key);
                                        console.log(files, documentName, "📂 Files to process");

                                        await processFiles(files, documentName);
                                    }
                                }

                                console.log("✅ All files processed successfully!");
                            }
                        } catch (error) {
                            console.error("Error handling file uploads:", error);
                        }
                    };


                    // Map field names to document names
                    const getDocumentName = (fieldName) => {
                        console.log(fieldName);

                        switch (fieldName) {
                            case 'supplier_invoice':
                                return "Supplier Invoice";
                            case 'packing_list':
                                return "Packing List";
                            case 'licenses':
                                return "Licenses";
                            case 'other_documents':
                                return "Other Documents";
                            default:
                                return "Unknown Document";
                        }
                    };

                    // Start processing all files
                    handleFileUploads();
                });

            });
            res.send({ success: true, message: "success" })
        });

    } catch (error) {
        // console.error('Error in Addfreight function:', error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

function generateFreightNumber(callback) {
    try {
        // Get the last inserted freight number
        con.query(
            'SELECT freight_number FROM tbl_freight ORDER BY id DESC LIMIT 1',
            (err, rows) => {
                if (err) {
                    callback(err);
                    return;
                }

                let sequenceNumber = 1; // Default to 1 for new freight number
                const currentDate = new Date();
                const year = currentDate.getFullYear();
                const month = (currentDate.getMonth() + 1).toString().padStart(2, '0'); // Get current month (01 - 12)

                if (rows.length > 0) {
                    const lastFreightNumber = rows[0].freight_number; // Get last freight number

                    // Extract the year and month from the last freight number (e.g., '202410')
                    const lastYearMonth = lastFreightNumber.slice(2, 8);
                    const currentYearMonth = `${year}${month}`;

                    if (lastYearMonth === currentYearMonth) {
                        // If the last freight number is from the same year and month, increment the sequence
                        const lastSequencePart = parseInt(lastFreightNumber.slice(-3)); // Extract the last 3 digits (sequence)
                        sequenceNumber = lastSequencePart + 1;
                    }
                }

                // Generate the new freight number in the format F-YYYYMMNNN
                const freightNumber = `F-${year}${month}${sequenceNumber.toString().padStart(3, '0')}`;

                // Return the generated freight number
                callback(null, freightNumber);
            }
        );
    } catch (error) {
        // console.error('Error generating freight number:', error);
        callback(error);
    }
}


const GetFreightCustomer = async (req, res) => {
    const { status, priority, origin, destination, startDate, endDate, freightType, freightSpeed } = req.body;

    try {
        let condition = 'WHERE tbl_freight.is_deleted = ? AND tbl_freight.added_by = ?';
        let params = [0, 2];

        if (status !== undefined && status !== null) {
            condition += ' AND tbl_freight.status = ?';
            params.push(status);
        }

        if (priority) {
            condition += ' AND tbl_freight.priority = ?';
            params.push(priority);
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
            SELECT tbl_freight.id AS freight_id, 
                   tbl_freight.freight_number,
                   tbl_freight.insurance,
                   tbl_freight.fcl_lcl,
                   tbl_freight.assign_to_clearing, 
                   tbl_freight.assign_warehouse, 
                   tbl_freight.client_id as client_id, 
                   tbl_freight.product_desc, 
                   tbl_freight.collection_from, 
                   tbl_freight.commodity,
                   cm.name as commodity_name,
                   tbl_freight.freight, 
                   tbl_freight.freight_type, 
                   tbl_freight.shipment_origin, 
                   tbl_freight.shipment_des, 
                   tbl_freight.shipment_ref, 
                   tbl_freight.dimension, 
                   tbl_freight.weight,
                   tbl_freight.date,
                   tbl_freight.type,
                   tbl_freight.user_type, 
                   tbl_freight.comment, 
                   tbl_freight.no_of_packages, 
                   tbl_freight.package_type, 
                   tbl_freight.collection_address, 
                   tbl_freight.delivery_address, 
                   tbl_freight.nature_of_goods, 
                   tbl_freight.delivery_to, 
                   tbl_freight.port_of_loading, 
                   tbl_freight.post_of_discharge, 
                   tbl_freight.auto_calculate, 
                   tbl_freight.added_by, 
                   tbl_freight.status, 
                   tbl_freight.add_attachments, 
                   tbl_freight.add_attachment_file, 
                   tbl_freight.sea_freight_option, 
                   tbl_freight.road_freight_option,
                   tbl_freight.attachment_Estimate,
                   tbl_freight.priority,
                   tbl_freight.created_at, 
                   tbl_freight.updated_at,
                   tbl_users.full_name AS client_name,
                   tbl_users.id AS user_id, 
                   tbl_users.email AS client_email,
                   tbl_users.address_1 AS client_address_1,
                   tbl_users.address_2 AS client_address_2, 
                   tbl_users.cellphone AS client_cellphone, 
                   tbl_users.telephone AS client_telephone, 
                   c.name AS collection_from_country, 
                   co.name AS delivery_to_country
            FROM tbl_freight
            INNER JOIN tbl_users ON tbl_users.id = tbl_freight.client_id
            LEFT JOIN countries AS c ON c.id = tbl_freight.collection_from
            LEFT JOIN countries AS co ON co.id = tbl_freight.delivery_to
            LEFT JOIN tbl_commodity AS cm ON cm.id = tbl_freight.commodity
            ${condition}
            GROUP BY tbl_freight.id
            ORDER BY tbl_freight.created_at DESC`;

        await con.query(selectQuery, params, (err, data) => {
            if (err) {
                res.status(500).send({ success: false, message: 'Database error' });
                return;
            }

            if (data.length > 0) {
                res.status(200).send({ success: true, data: data });
            } else {
                res.status(404).send({ success: false, message: 'No records found' });
            }
        });
    } catch (error) {
        res.status(500).send({ success: false, message: error.message });
    }
};


const EditFreight = async (req, res) => {
    try {
        // Extracting data from req.body
        console.log(req.body);
        const {
            id, // Assuming you will pass the ID of the freight to be updated
            client_ref, client_email, date, type, freight, fcl_lcl, incoterm, dimension, weight, quote_received, client_quoted, shipment_ref, insurance,
            is_active, comment, no_of_packages, package_type, commodity, hazardous, country_of_origin, destination_country,
            supplier_address, port_of_loading, post_of_discharge, place_of_delivery, ready_for_collection,
            transit_time, priority, shipment_details, nature_of_hazard, volumetric_weight, assign_for_estimate,
            assign_to_transporter, assign_warehouse, assign_to_clearing, send_to_warehouse, shipment_origin, shipment_des, client_ref_name, product_desc, sales_representative
        } = req.body;

        // Validate input data
        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Freight ID is required"
            });
        }

        // Update the database
        const updateQuery = `
            UPDATE tbl_freight SET
                client_id = ?, client_email=?, date = ?, type = ?, freight = ?, fcl_lcl=?, shipment_ref=?, insurance=?, incoterm = ?, dimension = ?, weight = ?, 
                quote_received = ?, product_desc=?, client_quoted = ?, is_active = ?, comment = ?, no_of_packages = ?, package_type = ?, 
                commodity = ?, hazardous = ?, collection_from = ?, delivery_to = ?, supplier_address = ?, 
                port_of_loading = ?, post_of_discharge = ?, place_of_delivery = ?, ready_for_collection = ?, 
                transit_time = ?, priority = ?, shipment_details = ?, nature_of_hazard = ?, volumetric_weight = ?, 
                assign_for_estimate = ?, assign_to_transporter = ?, assign_warehouse = ?, assign_to_clearing = ?, 
                send_to_warehouse = ?, shipment_origin = ?, shipment_des = ?, client_ref_name=?, sales_representative=?
            WHERE id = ?
        `;

        const updateParams = [
            client_ref, client_email, date, type, freight, fcl_lcl || null, shipment_ref, insurance, incoterm, dimension, weight, quote_received, product_desc, client_quoted, is_active, comment,
            no_of_packages, package_type, commodity, hazardous, country_of_origin, destination_country, supplier_address,
            port_of_loading, post_of_discharge, place_of_delivery, ready_for_collection, transit_time, priority, shipment_details,
            nature_of_hazard, volumetric_weight, assign_for_estimate, assign_to_transporter, assign_warehouse,
            assign_to_clearing, send_to_warehouse, shipment_origin, shipment_des, client_ref_name, sales_representative, id
        ];

        const result = await con.query(updateQuery, updateParams);

        // Check if result is as expected
        if (Array.isArray(result) && result[0].affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Freight not found"
            });
        }

       
        const selectQuery = `SELECT freight_number FROM tbl_freight WHERE id = ?`;

        con.query(selectQuery, [id], (err, result) => {
            if (err) {
                console.error("Error fetching freight number:", err);
                return;
            }

            if (result.length === 0) {
                console.error("No freight number found for the given ID.");
                return;
            }

            const freightNumber = result[0].freight_number;

            // Process all files for a given document type
            const processFiles = async (fileArray, documentName) => {
                try {
                    for (const file of fileArray) { // Loop through all files
                        const docsInsertQuery = `INSERT INTO freight_doc (freight_id, document_name, document) VALUES (?, ?, ?)`;

                        await new Promise((resolve, reject) => {
                            con.query(docsInsertQuery, [id, documentName, file.filename], (err) => {
                                if (err) {
                                    console.error(`Error inserting ${documentName}:`, err);
                                    return reject(err);
                                }
                                resolve();
                            });
                        });

                        console.log(`🚀 Uploading file: ${file.originalname}`);

                        // Upload the file to Google Drive
                        const folderId = await findOrCreateFolder(freightNumber);
                        console.log(`📂 Folder ID: ${folderId}`);
                        console.log(file);

                        const { fileId, webViewLink } = await uploadFile(folderId, file);

                        // Insert file details into transaction_files
                        const insertFileQuery = `
                                INSERT INTO transaction_files 
                                (freight_number, file_name, drive_file_id, file_link) 
                                VALUES (?, ?, ?, ?)
                            `;

                        await new Promise((resolve, reject) => {
                            con.query(insertFileQuery, [freightNumber, file.filename, fileId, webViewLink], (err) => {
                                if (err) {
                                    console.error("Error inserting file details:", err);
                                    return reject(err);
                                }
                                resolve();
                            });
                        });

                        console.log(`✅ ${documentName}: ${file.originalname} uploaded and recorded successfully!`);
                    }
                } catch (error) {
                    console.error(`Error processing files for ${documentName}:`, error);
                }
            };

            const handleFileUploads = async () => {
                try {
                    if (req.files) {
                        const fileKeys = Object.keys(req.files);

                        for (const key of fileKeys) {
                            const files = Array.isArray(req.files[key]) ? req.files[key] : [req.files[key]];

                            if (files.length > 0) {
                                const documentName = getDocumentName(key);
                                console.log(files, documentName, "📂 Files to process");

                                await processFiles(files, documentName);
                            }
                        }

                        console.log("✅ All files processed successfully!");
                    }
                } catch (error) {
                    console.error("Error handling file uploads:", error);
                }
            };


            // Map field names to document names
            const getDocumentName = (fieldName) => {
                console.log(fieldName);

                switch (fieldName) {
                    case 'supplier_invoice':
                        return "Supplier Invoice";
                    case 'packing_list':
                        return "Packing List";
                    case 'licenses':
                        return "Licenses";
                    case 'other_documents':
                        return "Other Documents";
                    default:
                        return "Unknown Document";
                }
            };

            // Start processing all files
            handleFileUploads();
        });
        res.status(200).json({
            success: true,
            message: "Freight updated successfully"
        });
    } catch (error) {
        // console.error('Error in EditFreight function:', error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};



// Example of using con.query with promises

const GetFreightById = async (req, res) => {
    try {
        const { freight_id } = req.body;
        if (!freight_id) {
            res.status(400).send({
                success: false,
                message: "Please provide freight id"
            })
        }
        else {
            const selectQuery = `select f.*, c.name as commodity_name  from tbl_freight asf
            LEFT JOIN tbl_commodity  AS c ON c.id = f.commodity
            where f.id=?`;
            await con.query(selectQuery, [freight_id], (err, data) => {
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
                        message: "Data not exist"
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

const DeleteFreight = async (req, res) => {
    try {
        const { freight_id } = req.body;
        if (!freight_id) {
            res.status(400).send({
                success: false,
                message: "Please provide freight id"
            })
        }
        else {
            const selectQuery = `select is_deleted from tbl_freight where id=?`;
            await con.query(selectQuery, [freight_id], (err, data) => {
                if (err) throw err;
                if (data.length > 0) {
                    if (data[0].is_deleted == 1) {
                        res.status(400).send({
                            success: false,
                            message: "Freight already deleted"
                        })
                    }
                    else {
                        const updateQuery = `update tbl_freight set is_deleted=? where id=?`;
                        con.query(updateQuery, [1, freight_id], (err, data) => {
                            if (err) throw err;
                            if (data.affectedRows > 0) {
                                res.status(200).send({
                                    success: true,
                                    message: "Freight deleted successfully"
                                })
                            }
                            else {
                                res.status(400).send({
                                    success: false,
                                    message: "Failed to delete freight"
                                })
                            }
                        })
                    }
                } else {
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

const AddCountryOrigin = async (req, res) => {
    try {
        const { country_id, cities, sea_ports, land_ports, air_ports } = req.body;
        // console.log(req.body); // Ensure logging sensitive data is safe

        // Convert arrays to comma-separated strings or default to empty strings
        const citiesStr = cities && cities.length > 0 ? cities.join(',') : '';
        const sea_portsStr = sea_ports && sea_ports.length > 0 ? sea_ports.join(',') : '';
        const land_portsStr = land_ports && land_ports.length > 0 ? land_ports.join(',') : '';
        const air_portsStr = air_ports && air_ports.length > 0 ? air_ports.join(',') : '';

        // Use parameterized query to prevent SQL injection
        const selectQuery = `SELECT * FROM country_origin WHERE country_id = ? and is_deleted=?`;
        con.query(selectQuery, [country_id, 0], (err, data) => {
            if (err) throw err;

            if (data.length > 0) {
                return res.status(400).send({
                    success: false,
                    message: "Country already exists!",
                });
            } else {
                const insertQuery = `
                    INSERT INTO country_origin (country_id, city_id, sea_port, land_port, air_port)
                    VALUES (?, ?, ?, ?, ?)
                `;

                // Execute the query with parameters
                con.query(insertQuery, [country_id, citiesStr, sea_portsStr, land_portsStr, air_portsStr], (err, result) => {
                    if (err) {
                        return res.status(500).send({
                            success: false,
                            message: "Error inserting data",
                            error: err.message
                        });
                    }

                    res.status(200).send({
                        success: true,
                        message: "Data inserted successfully",
                    });
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


const getCountryOriginList = async (req, res) => {
    try {
        // SQL query to select all country_origin records
        const selectAllQuery = `
            SELECT id,
                country_id,
                city_id,
                sea_port,
                land_port,
                air_port
            FROM country_origin
            WHERE is_deleted = 0
        `;

        // Execute the query to get all country_origin records
        con.query(selectAllQuery, async (err, records) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: "Error fetching data",
                    error: err.message
                });
            }

            // Collect all unique IDs from the records
            const allIds = new Set();
            const allCountryIds = new Set();

            records.forEach(record => {
                if (record.city_id) record.city_id.split(',').forEach(id => allIds.add(id.trim()));
                if (record.sea_port) record.sea_port.split(',').forEach(id => allIds.add(id.trim()));
                if (record.land_port) record.land_port.split(',').forEach(id => allIds.add(id.trim()));
                if (record.air_port) record.air_port.split(',').forEach(id => allIds.add(id.trim()));
                allCountryIds.add(record.country_id); // Collect all country IDs
            });

            // Fetch names for all collected city IDs
            const idsArray = Array.from(allIds);
            const fetchNamesQuery = `SELECT id, name FROM cities WHERE id IN (${idsArray.map(() => '?').join(',')})`;
            const fetchCountryNamesQuery = `SELECT id, name FROM countries WHERE id IN (${Array.from(allCountryIds).map(() => '?').join(',')})`;

            // Execute the queries
            con.query(fetchNamesQuery, idsArray, (err, cityNames) => {
                if (err) {
                    return res.status(500).send({
                        success: false,
                        message: "Error fetching city names",
                        error: err.message
                    });
                }

                con.query(fetchCountryNamesQuery, Array.from(allCountryIds), (err, countryNames) => {
                    if (err) {
                        return res.status(500).send({
                            success: false,
                            message: "Error fetching country names",
                            error: err.message
                        });
                    }

                    // Create maps for easy lookup
                    const nameMap = cityNames.reduce((acc, curr) => {
                        acc[curr.id] = curr.name;
                        return acc;
                    }, {});

                    const countryNameMap = countryNames.reduce((acc, curr) => {
                        acc[curr.id] = curr.name;
                        return acc;
                    }, {});

                    // Process records to include names in the response
                    const formattedResults = records.map(record => {
                        return {
                            id: record.id,
                            country_id: record.country_id,
                            country_name: countryNameMap[record.country_id] || 'Unknown',
                            cities: record.city_id ? record.city_id.split(',').map(id => ({
                                id: id.trim(),
                                name: nameMap[id.trim()] || 'Unknown'
                            })) : [],
                            sea_ports: record.sea_port ? record.sea_port.split(',').map(id => ({
                                id: id.trim(),
                                name: nameMap[id.trim()] || 'Unknown'
                            })) : [],
                            land_ports: record.land_port ? record.land_port.split(',').map(id => ({
                                id: id.trim(),
                                name: nameMap[id.trim()] || 'Unknown'
                            })) : [],
                            air_ports: record.air_port ? record.air_port.split(',').map(id => ({
                                id: id.trim(),
                                name: nameMap[id.trim()] || 'Unknown'
                            })) : []
                        };
                    });

                    res.status(200).send({
                        success: true,
                        data: formattedResults
                    });
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



const updateCountryOrigin = async (req, res) => {
    try {
        const { country_id, cities, sea_ports, land_ports, air_ports } = req.body;

        // Ensure country_id is provided
        if (!country_id) {
            return res.status(400).send({
                success: false,
                message: "Country ID is required"
            });
        }

        // Convert arrays to comma-separated strings or default to empty strings
        const citiesStr = cities && cities.length > 0 ? cities.join(',') : '';
        const sea_portsStr = sea_ports && sea_ports.length > 0 ? sea_ports.join(',') : '';
        const land_portsStr = land_ports && land_ports.length > 0 ? land_ports.join(',') : '';
        const air_portsStr = air_ports && air_ports.length > 0 ? air_ports.join(',') : '';

        // Construct the SQL query to update the record
        const updateQuery = `
            UPDATE country_origin
            SET city_id = ?, sea_port = ?, land_port = ?, air_port = ?
            WHERE country_id = ?
        `;

        // Execute the query with parameters
        con.query(updateQuery, [citiesStr, sea_portsStr, land_portsStr, air_portsStr, country_id], (err, result) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: "Error updating data",
                    error: err.message
                });
            }

            // Check if the row was affected (updated)
            if (result.affectedRows === 0) {
                return res.status(404).send({
                    success: false,
                    message: "No record found for the given country_id"
                });
            }

            res.status(200).send({
                success: true,
                message: "Data updated successfully",
            });
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
};


const GetCountryById = async (req, res) => {
    try {
        const { country_id } = req.body;
        if (!country_id) {
            res.status(400).send({
                success: false,
                message: "Please provide country id"
            })
        }
        else {
            const selectQuery = `select * from country_origin where id=?`;
            await con.query(selectQuery, [country_id], (err, data) => {
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
                        message: "Data not Found"
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

const DeleteCountry = async (req, res) => {
    try {
        const { country_id } = req.body;
        if (!country_id) {
            res.status(400).send({
                success: false,
                message: "Please provide country id"
            })
        }
        else {
            const selectQuery = `select is_deleted from country_origin where id=?`;
            await con.query(selectQuery, [country_id], (err, data) => {
                if (err) throw err;
                if (data.length > 0) {
                    if (data[0].is_deleted == 1) {
                        res.status(400).send({
                            success: false,
                            message: "This country of origin already deleted "
                        })
                    }
                    else {
                        const updateQuery = `update country_origin set is_deleted=? where id=?`;
                        con.query(updateQuery, [1, country_id], (err, result) => {
                            if (err) throw err;
                            if (result.affectedRows > 0) {
                                res.status(200).send({
                                    success: true,
                                    message: "Delete country of origin successfully"
                                })
                            }
                            else {
                                res.status(400).send({
                                    success: false,
                                    message: "Failed to delete country of origin"
                                })
                            }
                        })
                    }
                }
                else {
                    res.status(400).send({
                        success: false,
                        message: "id does not exist"
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

const clientListAddFreight = async (req, res) => {
    try {
        const selectQuery = `select id, full_name as client_name, client_ref, email from tbl_users 
        where user_type=? and is_deleted=?`;
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
                    message: "No List Available",
                    data: data
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

const CountryListAddFreight = async (req, res) => {
    try {
        const sqlQuery = `select country_origin.id, c.name from country_origin
        INNER JOIN countries as c on c.id=country_origin.id
         where country_origin.is_deleted=?`;
        await con.query(sqlQuery, [0], (err, data) => {
            if (err) throw err;
            if (data.length < 1) {
                res.status(400).send({
                    success: false,
                    message: "No List Available",
                    data: data
                })
            }
            else {
                res.status(200).send({
                    success: true,
                    data: data
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

const Shipping_Estimate = async (req, res) => {
    try {
        const {
            freight_id, client_id, supplier_id, serial_number, date, client_ref, freight, incoterm, dimension, weight, freight_agent,
            freight_amount, freight_gp, freight_currency, origin_pick_up, origin_pickup_gp, origin_customs, origin_customs_gp, origin_document,
            origin_document_gp, origin_warehouse, origin_warehouse_gp, origin_port_fees, origin_port_fees_gp, origin_other, origin_other_gp,
            origin_currency, des_delivery, des_delivery_gp, des_customs, des_customs_gp, des_document, des_document_gp, des_warehouse, des_warehouse_gp,
            des_port_fees, des_port_fees_gp, des_unpack, des_unpack_gp, des_other, des_other_gp, des_currency, freigh_amount, origin_amount,
            des_amount, sub_amount, exchange_rate, total_amount, Supplier_Quote_Amount, final_base_currency, freight_final_amount, origin_pick_final_amt, origin_cust_final_amt,
            origin_doc_final_amt, origin_ware_final_amt, org_port_fee_final_amt, org_other_final_amt, des_delivery_final_amt, des_cust_final_amt,
            des_doc_final_amt, des_ware_final_amt, des_portfees_final_amt, des_unpack_final_amt, des_other_final_amt, Roefreight, roe_origin_currency, roe_des_currency
        } = req.body;

        const Supplier_Quote_Attachment = req.file ? req.file.filename : null;

        console.log(req.body);

        await con.query(`SELECT id FROM shipping_estimate WHERE freight_id='${freight_id}' AND client_id='${client_id}'`, async (err, result) => {
            if (err) throw err;

            if (result.length > 0) {
                // Update existing record
                const updateQuery = `UPDATE shipping_estimate SET client_id=?, supplier_id=?, serial_number=?, date=?, client_ref=?, freight=?, incoterm=?, dimension=?, 
                    weight=?, freight_agent=?, freight_amount=?, freight_gp=?, freight_currency=?, origin_pick_up=?, origin_pickup_gp=?, origin_customs=?, 
                    origin_customs_gp=?, origin_document=?, origin_document_gp=?, origin_warehouse=?, origin_warehouse_gp=?, origin_port_fees=?, 
                    origin_port_fees_gp=?, origin_other=?, origin_other_gp=?, origin_currency=?, des_delivery=?, des_delivery_gp=?, des_customs=?, 
                    des_customs_gp=?, des_document=?, des_document_gp=?, des_warehouse=?, des_warehouse_gp=?, des_port_fees=?, des_port_fees_gp=?, 
                    des_unpack=?, des_unpack_gp=?, des_other=?, des_other_gp=?, des_currency=?, freigh_amount=?, origin_amount=?, des_amount=?, sub_amount=?, 
                    exchange_rate=?, total_amount=?, Supplier_Quote_Attachment=?, Supplier_Quote_Amount=?, final_currency=?, freight_final_amount=?, origin_pick_final_amt=?, origin_cust_final_amt=?,
            origin_doc_final_amt=?, origin_ware_final_amt=?, org_port_fee_final_amt=?, org_other_final_amt=?, des_delivery_final_amt=?, des_cust_final_amt=?,
            des_doc_final_amt=?, des_ware_final_amt=?, des_portfees_final_amt=?, des_unpack_final_amt=?, des_other_final_amt=?, ROE_freight=?, ROE_origin_currency=?, ROE_des_currency=? WHERE id=?`;

                const updateParams = [
                    client_id, supplier_id, serial_number, date, client_ref, freight, incoterm, dimension, weight, freight_agent, freight_amount, freight_gp,
                    freight_currency, origin_pick_up, origin_pickup_gp, origin_customs, origin_customs_gp, origin_document, origin_document_gp,
                    origin_warehouse, origin_warehouse_gp, origin_port_fees, origin_port_fees_gp, origin_other, origin_other_gp, origin_currency,
                    des_delivery, des_delivery_gp, des_customs, des_customs_gp, des_document, des_document_gp, des_warehouse, des_warehouse_gp,
                    des_port_fees, des_port_fees_gp, des_unpack, des_unpack_gp, des_other, des_other_gp, des_currency, freigh_amount, origin_amount,
                    des_amount, sub_amount, exchange_rate, total_amount, Supplier_Quote_Attachment, Supplier_Quote_Amount, final_base_currency, freight_final_amount, origin_pick_final_amt, origin_cust_final_amt,
                    origin_doc_final_amt, origin_ware_final_amt, org_port_fee_final_amt, org_other_final_amt, des_delivery_final_amt, des_cust_final_amt,
                    des_doc_final_amt, des_ware_final_amt, des_portfees_final_amt, des_unpack_final_amt, des_other_final_amt, Roefreight, roe_origin_currency, roe_des_currency, result[0].id
                ];



                con.query(updateQuery, updateParams, (err, updateData) => {
                    if (err) throw err;
                    if (updateData.affectedRows > 0) {

                        const updateQuery = `UPDATE tbl_freight SET status = ?, estimate_date = NOW() WHERE id = ?`;
                        const updateParams = [
                            4, freight_id
                        ];
                        con.query(updateQuery, updateParams, (err, updateData) => {
                            if (err) throw err;
                        })
                        res.status(200).send({
                            success: true,
                            message: "Successfully updated shipping estimate"
                        });
                    } else {

                        res.status(400).send({
                            success: false,
                            message: "Failed to update shipping estimate"
                        });
                    }
                });

            } else {
                // Insert new record
                const insertQuery = `INSERT INTO shipping_estimate (
                    freight_id, client_id, supplier_id, serial_number, date, client_ref, freight, incoterm, dimension, weight, freight_agent, 
                    freight_amount, freight_gp, freight_currency, origin_pick_up, origin_pickup_gp, origin_customs, origin_customs_gp, origin_document, 
                    origin_document_gp, origin_warehouse, origin_warehouse_gp, origin_port_fees, origin_port_fees_gp, origin_other, origin_other_gp, 
                    origin_currency, des_delivery, des_delivery_gp, des_customs, des_customs_gp, des_document, des_document_gp, des_warehouse, des_warehouse_gp, 
                    des_port_fees, des_port_fees_gp, des_unpack, des_unpack_gp, des_other, des_other_gp, des_currency, origin_amount, 
                    des_amount, sub_amount, exchange_rate, total_amount, Supplier_Quote_Attachment, Supplier_Quote_Amount, final_currency, freight_final_amount, origin_pick_final_amt, origin_cust_final_amt,
            origin_doc_final_amt, origin_ware_final_amt, org_port_fee_final_amt, org_other_final_amt, des_delivery_final_amt, des_cust_final_amt,
            des_doc_final_amt, des_ware_final_amt, des_portfees_final_amt, des_unpack_final_amt, des_other_final_amt, ROE_freight, ROE_origin_currency, ROE_des_currency ) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;

                const insertParams = [
                    freight_id, client_id, supplier_id, serial_number, date, client_ref, freight, incoterm, dimension, weight, freight_agent, freight_amount,
                    freight_gp, freight_currency, origin_pick_up, origin_pickup_gp, origin_customs, origin_customs_gp, origin_document, origin_document_gp,
                    origin_warehouse, origin_warehouse_gp, origin_port_fees, origin_port_fees_gp, origin_other, origin_other_gp, origin_currency, des_delivery,
                    des_delivery_gp, des_customs, des_customs_gp, des_document, des_document_gp, des_warehouse, des_warehouse_gp, des_port_fees, des_port_fees_gp,
                    des_unpack, des_unpack_gp, des_other, des_other_gp, des_currency, origin_amount, des_amount, sub_amount, exchange_rate, total_amount,
                    Supplier_Quote_Attachment, Supplier_Quote_Amount, final_base_currency, freight_final_amount, origin_pick_final_amt, origin_cust_final_amt,
                    origin_doc_final_amt, origin_ware_final_amt, org_port_fee_final_amt, org_other_final_amt, des_delivery_final_amt, des_cust_final_amt,
                    des_doc_final_amt, des_ware_final_amt, des_portfees_final_amt, des_unpack_final_amt, des_other_final_amt, Roefreight, roe_origin_currency, roe_des_currency
                ];

                con.query(insertQuery, insertParams, (err, data) => {
                    if (err) throw err;
                    if (data.affectedRows > 0) {
                        const updateQuery = `UPDATE tbl_freight SET status=? WHERE id=?`;

                        const updateParams = [
                            4, freight_id
                        ];
                        con.query(updateQuery, updateParams, (err, updateData) => {
                            if (err) throw err;
                        })
                        res.status(200).send({
                            success: true,
                            message: "Successfully added shipping estimate"
                        });
                    } else {
                        res.status(400).send({
                            success: false,
                            message: "Failed to add shipping estimate"
                        });
                    }
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


const client_Shipping_Estimate = async (req, res) => {
    try {
        const { freight_id, client_id, supplier_id, serial_number, date, client_ref, freight, dimension, weight, freight_agent, freight_amount, freight_gp, freight_currency, origin_pick_up, origin_pickup_gp, origin_customs, origin_customs_gp, origin_document, origin_document_gp, origin_warehouse, origin_warehouse_gp, origin_port_fees, origin_port_fees_gp, origin_other, origin_other_gp, origin_currency, des_delivery, des_delivery_gp, des_customs, des_customs_gp, des_document, des_document_gp, des_warehouse, des_warehouse_gp, des_port_fees,
            des_port_fees_gp, des_unpack, des_unpack_gp, des_other, des_other_gp, des_currency, freigh_amount, origin_amount, des_amount, sub_amount, exchange_rate, total_amount } = req.body;
        // console.log(req.body);
        await con.query(`select id from shipping_estimate where freight_id='${freight_id}' and client_id='${client_id}'`, (err, result) => {
            if (err) throw err;
            if (result.length > 0) {
                const updateQuery = `Update shipping_estimate set supplier_id=?,  serial_number=?, date=?, client_ref=?, freight=?,  dimension=?, weight=?, freight_agent=?, 
                freight_amount=?, freight_gp=?, freight_currency=?, origin_pick_up=?, origin_pickup_gp=?, origin_customs=?, origin_customs_gp=?, origin_document=?, origin_document_gp=?, origin_warehouse=?, origin_warehouse_gp=?, origin_port_fees=?, origin_port_fees_gp=?, origin_other=?, origin_other_gp=?, origin_currency=?, 
                des_delivery=?, des_delivery_gp=?, des_customs=?, des_customs_gp=?, des_document=?, des_document_gp=?, des_warehouse=?, des_warehouse_gp=?, des_port_fees=?, 
                des_port_fees_gp=?, des_unpack=?, des_unpack_gp=?, des_other=?, des_other_gp=?, des_currency=?, freigh_amount=?, origin_amount=?, des_amount=?, sub_amount=?, exchange_rate=?, total_amount=? where id=?`;
                con.query(updateQuery, [supplier_id, serial_number, date, client_ref, freight, dimension, weight, freight_agent, freight_amount, freight_gp, freight_currency, origin_pick_up, origin_pickup_gp, origin_customs, origin_customs_gp, origin_document, origin_document_gp, origin_warehouse, origin_warehouse_gp, origin_port_fees, origin_port_fees_gp, origin_other, origin_other_gp, origin_currency, des_delivery, des_delivery_gp, des_customs, des_customs_gp, des_document, des_document_gp, des_warehouse, des_warehouse_gp, des_port_fees,
                    des_port_fees_gp, des_unpack, des_unpack_gp, des_other, des_other_gp, des_currency, freigh_amount, origin_amount, des_amount, sub_amount, exchange_rate, total_amount, result[0].id], (err, updateData) => {
                        if (err) throw err;
                        if (updateData.affectedRows > 0) {
                            res.status(200).send({
                                success: true,
                                message: "Successfully update shipping estimate "
                            })
                        }
                        else {
                            res.status(400).send({
                                success: false,
                                message: "Failed to update shipping estimate "
                            })
                        }
                    })
            }
            else {
                const insrtQuery = `INSERT INTO shipping_estimate (freight_id, client_id, supplier_id,  serial_number, date, client_ref,  freight,  dimension, weight, freight_agent, 
                    freight_amount, freight_gp, freight_currency, origin_pick_up, origin_pickup_gp, origin_customs, origin_customs_gp, origin_document, origin_document_gp, origin_warehouse, origin_warehouse_gp, origin_port_fees, origin_port_fees_gp, origin_other, origin_other_gp, origin_currency, des_delivery, des_delivery_gp, des_customs, des_customs_gp, des_document, des_document_gp, des_warehouse, des_warehouse_gp, des_port_fees, 
                    des_port_fees_gp, des_unpack, des_unpack_gp, des_other, des_other_gp, des_currency, freigh_amount, origin_amount, des_amount, sub_amount, exchange_rate, total_amount ) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                con.query(insrtQuery, [freight_id, client_id, supplier_id, serial_number, date, client_ref, freight, dimension, weight, freight_agent,
                    freight_amount, freight_gp, freight_currency, origin_pick_up, origin_pickup_gp, origin_customs, origin_customs_gp, origin_document, origin_document_gp, origin_warehouse, origin_warehouse_gp, origin_port_fees, origin_port_fees_gp, origin_other, origin_other_gp, origin_currency, des_delivery, des_delivery_gp, des_customs, des_customs_gp, des_document, des_document_gp, des_warehouse, des_warehouse_gp, des_port_fees,
                    des_port_fees_gp, des_unpack, des_unpack_gp, des_other, des_other_gp, des_currency, freigh_amount, origin_amount, des_amount, sub_amount, exchange_rate, total_amount], (err, data) => {
                        if (err) throw err;
                        if (data.affectedRows > 0) {

                            /*  const UpdateQuery4 = `Update tbl_freight SET status=? where id=?`;
                             con.query(UpdateQuery4, [4, freight_id], (err, data) => {
                                 if (err) throw err;
                             }) */
                        }
                        else {
                            res.status(400).send({
                                success: false,
                                message: "Failed to add shipping estimate "
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

const updateShippingEstimate = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }

    try {
        const { estimate_id, client_name, serial_number, date, client_ref, product_desc, type, freight, incoterm, dimension, weight, freight_agent, currency, air_freight, sea_freight, road_freight, other_freight, origin_pick_up, origin_customs, origin_document, origin_warehouse, origin_port_fees, origin_other, des_delivery, des_customs, des_document, des_warehouse, des_port_fees, des_unpack, des_other, gp } = req.body;
        if (!estimate_id) {
            res.status(400).send({
                success: false,
                message: "Please provide estimate id"
            })
        }
        else {
            await con.query(`select * from shipping_estimate where id=?`, [estimate_id], (err, result) => {
                if (err) throw err;
                if (result.length < 1) {
                    res.status(400).send({
                        success: false,
                        message: "Estimate id does not exist"
                    })
                }
                else {
                    const UpdateQuery1 = `Update shipping_estimate SET client_name=?, serial_number=?, date=?, client_ref=?,
                    product_desc=?, type=?, freight=?, incoterm=?, dimension=?, weight=?, freight_agent=?, 
                    currency=?, air_freight=?, sea_freight=?, road_freight=?, other_freight=?, 
                    origin_pick_up=?, origin_customs=?, origin_document=?, origin_warehouse=?, origin_port_fees=?, 
                    origin_other=?, des_delivery=?, des_customs=?, des_document=?, des_warehouse=?, des_port_fees=?, des_unpack=?, des_other=?, gp=? where id=?`;
                    con.query(UpdateQuery1, [client_name, serial_number, date, client_ref, product_desc, type, freight, incoterm, dimension, weight, freight_agent, currency, air_freight, sea_freight, road_freight, other_freight, origin_pick_up, origin_customs, origin_document, origin_warehouse, origin_port_fees, origin_other, des_delivery, des_customs, des_document, des_warehouse, des_port_fees, des_unpack, des_other, gp, estimate_id], (err, data) => {
                        if (err) throw err;
                        if (data.affectedRows > 0) {
                            res.status(200).send({
                                success: true,
                                message: "Update details successfully"
                            })
                        }
                        else {
                            res.status(400).send({
                                success: false,
                                message: "Failed to update details"
                            })
                        }
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

const ShipEstimateList = async (req, res) => {
    try {
        const selectQuery = `select shipping_estimate.*, shipping_estimate.ROE_freight as Roefreight, shipping_estimate.ROE_origin_currency as roe_origin_currency, 
        shipping_estimate.ROE_des_currency as roe_des_currency, shipping_estimate.final_currency as final_base_currency, tbl_users.full_name as clientName, tbl_freight.freight_number, tbl_freight.product_desc, tbl_freight.created_at, c.name AS collection_from_name, 
                   co.name AS delivery_to_name from shipping_estimate
        INNER JOIN tbl_freight on tbl_freight.id=shipping_estimate.freight_id
        INNER JOIN tbl_users on tbl_users.id=shipping_estimate.client_id
         LEFT JOIN countries AS co ON co.id = tbl_freight.delivery_to
          LEFT JOIN countries AS c ON c.id = tbl_freight.collection_from
        where shipping_estimate.is_deleted=? ORDER BY shipping_estimate.created_at DESC`;
        await con.query(selectQuery, [0], (err, data) => {
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

const GetShipEstimateById = async (req, res) => {
    try {
        const { estimate_id, freight_id } = req.body;
        // console.log(req.body);

        if (!estimate_id && !freight_id) {
            res.status(400).send({
                success: false,
                message: "Please provide estimate id"
            })
        }
        else {
            const selectQuery = `select *, shipping_estimate.final_currency as final_base_currency, shipping_estimate.ROE_freight as Roefreight, shipping_estimate.ROE_origin_currency as roe_origin_currency, 
        shipping_estimate.ROE_des_currency as roe_des_currency from shipping_estimate where id=? OR freight_id=?`;
            await con.query(selectQuery, [estimate_id, freight_id], (err, data) => {
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
                        message: "Data not Found"
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

const DeleteShipEstimate = async (req, res) => {
    try {
        const { estimate_id } = req.body;
        if (!estimate_id) {
            res.status(400).send({
                success: false,
                message: "Please provide estimate id"
            })
        }
        else {
            const selectQuery = `select is_deleted from shipping_estimate where id=?`;
            await con.query(selectQuery, [estimate_id], (err, data) => {
                if (err) throw err;
                if (data.length > 0) {
                    if (data[0].is_deleted == 1) {
                        res.status(400).send({
                            success: false,
                            message: "This shipping estimate already deleted "
                        })
                    }
                    else {
                        const updateQuery = `update shipping_estimate set is_deleted=? where id=?`;
                        con.query(updateQuery, [1, estimate_id], (err, result) => {
                            if (err) throw err;
                            if (result.affectedRows > 0) {
                                res.status(200).send({
                                    success: true,
                                    message: "Delete details successfully"
                                })
                            }
                            else {
                                res.status(400).send({
                                    success: false,
                                    message: "Failed to delete details"
                                })
                            }
                        })
                    }
                }
                else {
                    res.status(400).send({
                        success: false,
                        message: "id does not exist"
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

const SendNotification = async (req, res) => {
    try {
        // send_to = 1(All Staff), 2(All Client), 3(Particular staff), 4(Particular client)
        const { send_to, user_id, title, description } = req.body;
        if (!send_to) {
            res.status(400).send({
                success: false,
                message: "Please provide send_to"
            })
        }
        else {
            if (send_to == 1) {
                const getUsersSql = 'SELECT id FROM tbl_users where user_type=? and is_deleted=?'; // Replace 'users' with your actual users table name
                await con.query(getUsersSql, [2, 0], (err, results) => {
                    if (err) throw err;

                    // Send notifications to each user
                    if (results.length > 0) {
                        const InsertQuery = `insert into tbl_notifications (title, description, send_to) values (?,?,?)`;
                        con.query(InsertQuery, [title, description, 1], (err, data) => {
                            if (err) throw err;
                            if (data.affectedRows > 0) {

                                results.forEach((user) => {
                                    const insertNotificationSql = 'INSERT INTO notification_details (user_id, notification_id) VALUES (?, ?)';
                                    con.query(insertNotificationSql, [user.id, data.insertId], (err, result) => {
                                        if (err) throw err;
                                    });
                                });

                                res.status(200).send({
                                    success: true,
                                    message: "Send notification successfully"
                                })
                            }
                            else {
                                res.status(400).send({
                                    success: false,
                                    message: "Send to failed notification"
                                })
                            }
                        })
                    }
                    else {
                        res.status(400).send({
                            success: false,
                            message: "User not found"
                        })
                    }
                })
            }
            else if (send_to == 2) {
                const getUsersSql = 'SELECT id FROM tbl_users where user_type=? and is_deleted=?'; // Replace 'users' with your actual users table name
                await con.query(getUsersSql, [3, 0], (err, results) => {
                    if (err) throw err;

                    // Send notifications to each user
                    if (results.length > 0) {
                        const InsertQuery = `insert into tbl_notifications (title, description, send_to) values (?, ?, ?)`;
                        con.query(InsertQuery, [title, description, 2], (err, data) => {
                            if (err) throw err;
                            if (data.affectedRows > 0) {
                                results.forEach((user) => {
                                    const insertNotificationSql = 'INSERT INTO notification_details (user_id, notification_id) VALUES (?, ?)';
                                    con.query(insertNotificationSql, [user.id, data.insertId], (err, result) => {
                                        if (err) throw err;
                                    });
                                });
                                res.status(200).send({
                                    success: true,
                                    message: "Send notification successfully"
                                })
                            }
                            else {
                                res.status(400).send({
                                    success: false,
                                    message: "Failed to send notification"
                                })
                            }
                        })
                    }
                    else {
                        res.status(400).send({
                            success: false,
                            message: "User not found"
                        })
                    }
                })

            }
            else if (send_to == 3) {
                if (!user_id) {
                    res.status(400).send({
                        success: false,
                        message: "Please provide user_id"
                    })
                }
                else {
                    const InsertQuery = `insert into tbl_notifications (title, description, send_to) values (?,?,?)`;
                    await con.query(InsertQuery, [title, description, 3], (err, data) => {
                        if (err) throw err;
                        if (data.affectedRows > 0) {
                            const insertNotificationSql = 'INSERT INTO notification_details (user_id, notification_id) VALUES (?, ?)';
                            con.query(insertNotificationSql, [user_id, data.insertId], (err, result) => {
                                if (err) throw err;
                            });
                            res.status(200).send({
                                success: true,
                                message: "Send notification successfully"
                            })
                        }
                        else {
                            res.status(400).send({
                                success: false,
                                message: "Failed to send notification"
                            })
                        }
                    })
                }
            }
            else {
                if (!user_id) {
                    res.status(400).send({
                        success: false,
                        message: "Please provide user_id"
                    })
                }
                else {
                    const InsertQuery = `insert into tbl_notifications (title, description, send_to) values (?,?,?)`;
                    await con.query(InsertQuery, [title, description, 4], (err, data) => {
                        if (err) throw err;
                        if (data.affectedRows > 0) {
                            const insertNotificationSql = 'INSERT INTO notification_details (user_id, notification_id) VALUES (?, ?)';
                            con.query(insertNotificationSql, [user_id, data.insertId], (err, result) => {
                                if (err) throw err;
                            });
                            res.status(200).send({
                                success: true,
                                message: "Send notification successfully"
                            })
                        }
                        else {
                            res.status(400).send({
                                success: false,
                                message: "Failed to send notification"
                            })
                        }
                    })
                }
            }
        }
    }
    catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        })
    }
}

const GetNotification = async (req, res) => {
    try {
        const selectQuery = `
        SELECT
            DISTINCT nd.id AS notification_id,
            nd.title,
            nd.description,
            CASE
                WHEN nd.send_to = 1 THEN '1'
                WHEN nd.send_to = 2 THEN '2'
                WHEN nd.send_to IN (3, 4) THEN CONCAT(v.full_name)
            END AS send_to,
            nd.is_deleted,
            nd.created_at
        FROM
            notification_details n
        LEFT JOIN
            tbl_notifications nd ON nd.id = n.notification_id
        LEFT JOIN
            tbl_users v ON n.user_id = v.id
        WHERE nd.is_deleted='${0}' AND nd.send_to <> 5
        ORDER BY
            nd.created_at DESC`;

        const data = await new Promise((resolve, reject) => {
            con.query(selectQuery, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });

        if (data.length > 0) {
            const modifiedData = data.map(notification => ({
                id: notification.notification_id,
                title: notification.title,
                description: notification.description,
                send_to: notification.send_to,
                is_deleted: notification.is_deleted,
                created_at: notification.created_at
            }));

            res.status(200).send({
                success: true,
                data: modifiedData
            });
        } else {
            res.status(400).send({
                success: false,
                message: "No notifications found"
            });
        }
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

const deleteNotification = async (req, res) => {
    try {
        const { notification_id } = req.body;
        if (!notification_id) {
            res.status(400).send({
                success: false,
                message: "Please provide notification id"
            })
        }
        else {
            var sql = "select is_deleted from tbl_notifications where id=?";
            await con.query(sql, [notification_id], (err, data) => {
                if (err) throw err;
                if (data.length > 0) {
                    if (data[0].is_deleted == 1) {
                        res.status(400).send({
                            success: false,
                            message: "This notification is already deleted !"
                        })
                    }
                    else {
                        var sql = "update tbl_notifications set is_deleted=? where id=?";
                        con.query(sql, [1, notification_id], (err, data) => {
                            if (err) throw err;
                            res.status(200).send({
                                success: true,
                                message: "Notification deleted successfully!"
                            })
                        })
                    }
                }
                else {
                    res.status(400).send({
                        success: false,
                        message: "Data not exist !"
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

const ChangeStatusFreight = async (req, res) => {
    try {
        const { freight_id, status } = req.body;
        if (!freight_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide freight id"
            });
        }
        if (!status) {
            return res.status(400).send({
                success: false,
                message: "Please provide status value"
            });
        }

        const selectQuery = `SELECT * FROM tbl_freight WHERE id = ?`;
        con.query(selectQuery, [freight_id], async (err, data) => {
            if (err) throw err;
            if (data.length > 0) {
                const currentStatus = data[0].status;
                if (status == 1 && currentStatus == 1) {
                    return res.status(400).send({
                        success: false,
                        message: "Freight is already Accepted"
                    });
                }
                if (status == 2 && currentStatus == 2) {
                    return res.status(400).send({
                        success: false,
                        message: "Freight is already Declined"
                    });
                }
                if (status == 3 && currentStatus == 3) {
                    return res.status(400).send({
                        success: false,
                        message: "Freight is already Partial"
                    });
                }

                const updateQuery = `UPDATE tbl_freight SET status = ? WHERE id = ?`;
                con.query(updateQuery, [status, freight_id], async (err, result) => {
                    if (err) throw err;
                    if (result.affectedRows > 0) {
                        // Prepare notification
                        const statusMessage = status == 1 ? "Accepted" : status == 2 ? "Declined" : "Partially Accepted";
                        const notificationTitle = `Your Freight ${statusMessage}`;
                        const notificationDescription = `Freight Number ${data[0].freight_number} has been ${statusMessage.toLowerCase()}.`;

                        const insertNotificationQuery = `INSERT INTO tbl_notifications (title, description, send_to) VALUES (?, ?, ?)`;
                        con.query(insertNotificationQuery, [notificationTitle, notificationDescription, 4], async (err, notificationData) => {
                            if (err) throw err;

                            // Directly insert notification details for known user IDs
                            const insertNotificationDetailQuery = `INSERT INTO notification_details (user_id, notification_id) VALUES (?,?)`;

                            con.query(insertNotificationDetailQuery, [data[0].client_id, notificationData.insertId], (err) => {
                                if (err) throw err;
                            });
                        });

                        return res.status(200).send({
                            success: true,
                            message: `Freight ${statusMessage.toLowerCase()} successfully`
                        });
                    } else {
                        return res.status(400).send({
                            success: false,
                            message: `Failed to ${statusMessage.toLowerCase()} freight`
                        });
                    }
                });
            } else {
                return res.status(400).send({
                    success: false,
                    message: "Freight ID doesn't exist"
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




const GetShipEstimateDetails = async (req, res) => {
    try {
        const { estimate_id } = req.body;
        if (!estimate_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide estimate id"
            })
        }
        await con.query(`select shipping_estimate.*, shipping_estimate.id as esimate_id, tbl_freight.*, tbl_freight.id as freight_id 
        from shipping_estimate 
        INNER JOIN tbl_freight on tbl_freight.id=shipping_estimate.freight_id
        where shipping_estimate.id=?`, [estimate_id], (err, data) => {
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
                    message: "Estimate id doesn't exist"
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


const order_Details = async (req, res) => {
    const {
        origin,
        destination,
        startDate,
        endDate,
        freightType,
        freightSpeed,
        search = "",
        page = 1,
        limit = 10
    } = req.body;

    try {
        let conditions = [];

        if (origin) conditions.push(`f.collection_from = '${origin}'`);
        if (destination) conditions.push(`f.delivery_to = '${destination}'`);
        if (startDate && endDate) {
            conditions.push(`DATE(tbl_orders.created_at) BETWEEN '${startDate}' AND '${endDate}'`);
        }
        if (freightType) conditions.push(`f.freight = '${freightType}'`);
        if (freightSpeed) conditions.push(`f.type = '${freightSpeed}'`);

        // Search conditions
        if (search) {
            const s = search.trim();
            conditions.push(`(
                CONCAT('OR000', tbl_orders.id) LIKE '%${s}%' OR
                tbl_orders.client_name LIKE '%${s}%' OR
                cu.full_name LIKE '%${s}%' OR
                tbl_orders.weight LIKE '%${s}%' OR
                f.freight LIKE '%${s}%'
            )`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        const offset = (page - 1) * limit;

        // Get total count
        con.query(
            `SELECT COUNT(DISTINCT tbl_orders.id) AS total
             FROM tbl_orders
             LEFT JOIN tbl_users as cu ON cu.id = tbl_orders.client_id
             LEFT JOIN tbl_freight AS f ON tbl_orders.freight_id = f.id
             LEFT JOIN countries AS co ON co.id = f.delivery_to
             LEFT JOIN countries AS c ON c.id = f.collection_from
             LEFT JOIN countries AS u ON u.id = cu.country
             ${whereClause}`,
            (countErr, countResult) => {
                if (countErr) {
                    console.error("Error fetching count: ", countErr);
                    res.status(500).send({ success: false, message: "Database count error", error: countErr.message });
                    return;
                }

                const total = countResult[0].total;

                // Get paginated data
                con.query(
                    `SELECT tbl_orders.*, 
                        tbl_orders.dimensions AS order_dimensions,
                        tbl_orders.created_at as order_created_date,
                        f.*,
                        tbl_orders.weight AS order_weight, 
                        tbl_orders.id AS order_id,
                        CONCAT('OR000', tbl_orders.id) AS order_number,
                        cu.*, 
                        cu.id AS user_id, 
                        CASE 
                            WHEN tbl_orders.client_id = 0 THEN tbl_orders.client_name 
                            ELSE cu.full_name 
                        END as client_name,
                        su.full_name as sales_representative_name,
                        cu.email AS client_email,
                        c.name AS collection_from_country, 
                        co.name AS delivery_to_country,
                        u.name AS user_country_name
                    FROM tbl_orders
                    LEFT JOIN tbl_users as cu ON cu.id = tbl_orders.client_id
                    LEFT JOIN tbl_freight AS f ON tbl_orders.freight_id = f.id
                    LEFT JOIN tbl_users as su ON su.id = f.sales_representative
                    LEFT JOIN countries AS co ON co.id = f.delivery_to
                    LEFT JOIN countries AS c ON c.id = f.collection_from
                    LEFT JOIN countries AS u ON u.id = cu.country
                    ${whereClause}
                    GROUP BY tbl_orders.id
                    ORDER BY tbl_orders.id DESC
                    LIMIT ${limit} OFFSET ${offset}`,
                    (dataErr, data) => {
                        if (dataErr) {
                            console.error("Error executing query: ", dataErr);
                            res.status(500).send({ success: false, message: "Database query error", error: dataErr.message });
                            return;
                        }

                        res.status(200).send({
                            success: true,
                            currentPage: page,
                            totalPages: Math.ceil(total / limit),
                            totalRecords: total,
                            data: data
                        });
                    }
                );
            }
        );
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

const OrderDetailsById = async (req, res) => {
    const { origin, destination, startDate, endDate, freightType, freightSpeed, orderId } = req.body;

    try {
        // Ensure the orderId is provided
        if (!orderId) {
            return res.status(400).send({ success: false, message: "Order ID is required" });
        }

        // Build the WHERE conditions dynamically
        let conditions = [`tbl_orders.id = ${orderId}`];  // Always filter by the specific orderId

        if (origin) conditions.push(`f.collection_from = '${origin}'`);
        if (destination) conditions.push(`f.delivery_to = '${destination}'`);
        if (startDate && endDate) {
            conditions.push(`DATE(tbl_orders.created_at) BETWEEN '${startDate}' AND '${endDate}'`);
        }
        if (freightType) conditions.push(`f.freight = '${freightType}'`);
        if (freightSpeed) conditions.push(`f.type = '${freightSpeed}'`);

        // Combine conditions into a WHERE clause
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Execute the query
        con.query(
            `SELECT tbl_orders.*, 
                tbl_orders.dimensions AS order_dimensions,
                tbl_orders.created_at as order_created_date,
                f.*, cm.name as commodity_name,
                tbl_orders.weight AS order_weight, 
                tbl_orders.id AS order_id,
                CONCAT('OR000', tbl_orders.id) AS order_number,
                tbl_users.*, 
                tbl_users.id AS user_id, 
                CASE 
                    WHEN tbl_orders.client_id = 0 THEN tbl_orders.client_name 
                    ELSE tbl_users.full_name 
                END as client_name,
                tbl_users.email AS client_email,
                o.status AS delivery_status, 
                o.date_dispatched, 
                o.ETA AS delivery_ETA,
                o.actual_delivery_date, 
                o.freight_option AS delivery_freight_option, 
                o.port_of_loading AS delivery_port_of_loading,
                o.port_of_discharge AS delivery_port_of_discharge, 
                o.co_loader, 
                o.carrier,
                o.vessel, 
                o.master_landing_bill, 
                o.house_bill_landing, 
                o.release_type,
                o.container_no, 
                o.seal_no, 
                o.local_handler, 
                o.local_carrier, 
                o.driver_name, 
                o.vehicle_registration,
                o.comments AS delivery_comment, 
                o.last_check_in, 
                o.location_check_in, 
                o.driver_license_id, 
                o.status_updated_at,
                o.Delivery_Instruction, 
                o.cargo_pickup,
                o.Carrier_code,
                wao.ware_receipt_no, 
                wao.tracking_number, 
                wao.warehouse_collect, 
                wao.date_received,
                w.warehouse_name,
                w.warehouse_address,
                w.town,
                w.country,
                w.email,
                w.contact_person,
                w.mobile_number,
                b.batch_number, 
                b.freight AS batch_freight, 
                b.date_start, 
                b.total_weight, 
                b.total_dimensions, 
                b.dispatched, 
                b.time_in_storage, 
                b.costs_to_collect,
                b.destination, 
                b.waybill, 
                b.agent, 
                b.forwarding_agent,
                c.name AS collection_from_country, 
                co.name AS delivery_to_country,
                u.name AS user_country_name,
                s.id as estimate_id,
                s.origin_pick_up AS estimate_origin_pick_up, 
                s.origin_pickup_gp AS estimate_origin_pickup_gp,
                s.origin_warehouse AS estimate_origin_warehouse, 
                s.origin_warehouse_gp AS estimate_origin_warehouse_gp, 
                s.des_warehouse AS estimate_des_warehouse, 
                s.des_warehouse_gp AS estimate_des_warehouse_gp, 
                s.des_delivery AS estimate_des_delivery, 
                s.des_delivery_gp AS estimate_des_delivery_gp,
                s.freight_amount as estimate_freight_amount,
                s.freight_gp as estimate_freight_gp,
                sds.waybill as shipments_waybill,
                sds.freight as shipments_freight,
                sds.carrier as shipments_carrier,
                sds.vessel as shipments_vessel,
                sds.waybill as shipments_date_of_dispatch,
                sds.waybill as shipments_ETD,
                sds.waybill as shipments_ATD,
                sds.waybill as shipments_status,
                sds.waybill as shipments_origin_agent,
                sds.waybill as shipments_port_of_loading,
                sds.waybill as shipments_port_of_discharge,
                sds.waybill as shipments_origin_country_id,
                sds.waybill as shipments_des_country_id,
                sds.waybill as shipments_destination_agent,
                sds.waybill as shipments_load,
                sds.waybill as shipments_release_type,
                sds.waybill as shipments_container,
                sds.waybill as shipments_seal,
                sds.waybill as shipments_document,
                cos.name AS shipment_collection_country, 
                coss.name AS shipment_delivery_country
            FROM tbl_orders
            LEFT JOIN tbl_users ON tbl_users.id = tbl_orders.client_id
            LEFT JOIN order_delivery_details AS o ON o.order_id = tbl_orders.id
            LEFT JOIN tbl_freight AS f ON tbl_orders.freight_id = f.id
            LEFT JOIN warehouse_assign_order AS wao ON wao.order_id = tbl_orders.id
            LEFT JOIN batches AS b ON b.id = wao.batch_id
            LEFT JOIN warehouse_tbl AS w ON w.id = b.warehouse_id
            LEFT JOIN countries AS co ON co.id = f.delivery_to
            LEFT JOIN countries AS c ON c.id = f.collection_from
            LEFT JOIN countries AS u ON u.id = tbl_users.country
            LEFT JOIN shipping_estimate  AS s ON s.freight_id = tbl_orders.freight_id
            LEFT JOIN tbl_commodity  AS cm ON cm.id = f.commodity
            LEFT JOIN shipment_details As sd ON sd.order_id = tbl_orders.id
            LEFT JOIN tbl_shipments As sds ON sds.id = sd.shipment_id
            LEFT JOIN countries AS cos ON co.id = sds.des_country_id
            LEFT JOIN countries AS coss ON c.id = sds.origin_country_id
            ${whereClause}
            GROUP BY tbl_orders.id
            ORDER BY tbl_orders.id DESC`,
            async (err, data) => {
                if (err) {
                    console.error("Error executing query: ", err);
                    return res.status(500).send({ success: false, message: "Database query error", error: err.message });
                }

                // If no data found for the given order ID
                if (data.length === 0) {
                    return res.status(404).send({ success: false, message: "Order not found" });
                }

                res.status(200).send({
                    success: true,
                    data: data
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



const sendMessage = async (req, res) => {
    try {
        const { sender_id, receiver_id, message_text } = req.body;
        if (!sender_id || !receiver_id || !message_text) {
            return res.status(400).send({
                success: false,
                message: "please provide sender_id or receiver_id or message_text"
            })
        }
        const newMessage = {
            sender_id: sender_id, // Replace with the sender's user ID
            receiver_id: receiver_id, // Replace with the receiver's user ID
            message_text: message_text,
            //is_seen: 1,
            //on_chat:1
        };
        await con.query(`select on_chat from tbl_messages where sender_id='${newMessage.sender_id}' and receiver_id = '${newMessage.receiver_id}' ORDER BY send_date DESC LIMIT 1`, (err, details) => {
            if (err) throw err;
            // console.log(details);
            if (details.length > 0) {
                if (details[0].on_chat == 1) {
                    con.query(`INSERT INTO tbl_messages SET sender_id='${newMessage.sender_id}', receiver_id='${newMessage.receiver_id}', message_text='${newMessage.message_text}', is_seen='${1}', on_chat='${1}'`, (error, updateResults) => {
                        if (error) throw error;
                        if (updateResults.affectedRows > 0) {
                            res.status(200).send({
                                success: true,
                                message: "Message has been successfully sent"
                            })
                        }
                        else {
                            res.status(400).send({
                                success: false,
                                message: "Message failed to send"
                            })
                        }
                    });
                }
                else {
                    con.query('INSERT INTO tbl_messages SET ?', newMessage, (error, results) => {
                        if (error) throw error;
                        if (results.affectedRows > 0) {
                            // if(results.insertId)
                            res.status(200).send({
                                success: true,
                                message: "Message has been successfully sent"
                            })

                        }
                        else {
                            res.status(400).send({
                                success: false,
                                message: "Message failed to send"
                            })
                        }
                    });
                }
            }
            else {
                con.query('INSERT INTO tbl_messages SET ?', newMessage, (error, results) => {
                    if (error) throw error;
                    if (results.affectedRows > 0) {
                        // if(results.insertId)
                        res.status(200).send({
                            success: true,
                            message: "Message has been successfully sent"
                        })

                    }
                    else {
                        res.status(400).send({
                            success: false,
                            message: "Message failed to send"
                        })
                    }
                });
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

const getMessagesList = async (req, res) => {
    try {
        // const userId = req.user.id; // Replace with the ID of the current user
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).send({
                success: false,
                message: "Please provide userId"
            })
        }
        const query = `SELECT CASE
            WHEN sender_id = ? THEN receiver_id
            WHEN receiver_id = ? THEN sender_id
            END AS other_user_id,
            MAX(send_date) AS latest_send_date FROM tbl_messages
            WHERE (sender_id = ? OR receiver_id = ?) GROUP BY other_user_id ORDER BY latest_send_date DESC`;

        await con.query(query, [userId, userId, userId, userId], (err, results) => {
            if (err) throw err;

            if (results.length > 0) {
                const latestMessages = [];
                // console.log(results);
                results.forEach((result) => {
                    const otherUserId = result.other_user_id;
                    const latestSendDate = result.latest_send_date;

                    const getMessageQuery = `SELECT m.*, u.profile AS sender_profile, 
                    u.full_name as sender_name, u.id as sent_to
                    FROM tbl_messages m
                    LEFT JOIN tbl_users u ON ((m.sender_id = u.id AND m.sender_id !='${userId}') 
                    OR (m.receiver_id = u.id AND m.receiver_id !='${userId}'))
                    WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
                    AND send_date = ?`;

                    con.query(
                        getMessageQuery,
                        [userId, otherUserId, otherUserId, userId, latestSendDate],
                        (err, messageResults) => {
                            if (err) throw err;

                            latestMessages.push(messageResults[0]);

                            if (latestMessages.length === results.length) {
                                res.status(200).json({
                                    success: true,
                                    message: "Message List",
                                    data: latestMessages,
                                });
                            }
                        }
                    );
                });
            } else {
                res.status(200).json({
                    success: true,
                    message: 'No messages found',
                    data: results
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

const getAllMessages = async (req, res) => {
    try {
        const { sender_id, receiver_id, user_id } = req.body;
        // console.log(req.body);
        if (!sender_id || !receiver_id || !user_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide sender_id or receiver_id or user_id"
            })
        }
        const query = `SELECT m.*, u.profile AS sender_profile, u.full_name as sender_name FROM tbl_messages m
            LEFT JOIN tbl_users u ON ((m.sender_id = u.id AND m.sender_id !='${user_id}') OR (m.receiver_id = u.id AND m.receiver_id !='${user_id}'))
            WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
            ORDER BY send_date`;

        const getLastMessageQuery = `
            SELECT id, receiver_id
            FROM tbl_messages
            WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
            ORDER BY send_date DESC
            LIMIT 1`;

        await con.query(query, [sender_id, receiver_id, receiver_id, sender_id], (err, results) => {
            if (err) throw err;
            // console.log(results);
            if (results.length > 0) {
                con.query(getLastMessageQuery, [sender_id, receiver_id, receiver_id, sender_id], (err, lastMessageResult) => {
                    if (err) throw err;
                    res.status(200).send({
                        success: true,
                        messages: "All Messages",
                        last_messagesId: lastMessageResult[0].id.toString(),
                        last_receiverId: lastMessageResult[0].receiver_id.toString(),
                        data: results
                    });
                });
            }
            else {
                res.status(200).json({
                    success: true,
                    message: 'No messages found',
                    last_messagesId: "",
                    last_receiverId: "",
                    data: results
                });
            }
        })
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        })
    }
}

const UpdateChatOnBack = async (req, res) => {
    try {
        const { message_id, receiver_id, user_id } = req.body
        if (!message_id || !receiver_id || !user_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide message_id or receiver_id or user_id"
            })
        }
        if (receiver_id == user_id) {

            const query = 'UPDATE tbl_messages SET on_chat = ? WHERE id = ?';
            await con.query(query, [0, message_id], (err, result) => {
                if (err) throw err;
                res.status(200).send({
                    success: true,
                    message: "Chat status updated successfully"
                })
            });
        }
        else {
            res.status(200).send({
                success: true,
                message: "Chat status updated successfully"
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

const UpdateChatOnEnter = async (req, res) => {
    try {
        const { message_id, receiver_id, user_id } = req.body
        if (!message_id || !receiver_id || !user_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide message_id or receiver_id or user_id"
            })
        }
        if (receiver_id == user_id) {
            const query = 'UPDATE tbl_messages SET on_chat = ?, is_seen =? WHERE id = ?';
            await con.query(query, [1, 1, message_id], (err, result) => {
                if (err) throw err;
                res.status(200).send({
                    success: true,
                    message: "Chat status updated successfully"
                })
            });
        }
        else {
            res.status(200).send({
                success: true,
                message: "Chat status updated successfully"
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

const countAll = async (req, res) => {
    try {
        let sqlQuery = `SELECT COUNT(*) as no_of_clients from tbl_users WHERE user_type='${3}' and is_deleted='${0}'`
        await con.query(sqlQuery, (err, clients) => {
            if (err) throw err;
            let query = `SELECT COUNT(*) as no_of_freights from tbl_freight where is_deleted='${0}'`;
            con.query(query, (err, freights) => {
                if (err) throw err;
                let query1 = `SELECT COUNT(*) as no_of_orders from tbl_orders`;
                con.query(query1, (err, orders) => {
                    if (err) throw err;
                    let query2 = `SELECT COUNT(*) as no_of_clearance from tbl_clearance where is_deleted='${0}'`;
                    con.query(query2, (err, clearance) => {
                        if (err) throw err;
                        let query3 = `SELECT COUNT(*) as no_Of_clearanceOrder from clearance_order`;
                        con.query(query3, (err, clearance_order) => {
                            if (err) throw err;
                            let details = {
                                no_of_clients: clients[0].no_of_clients,
                                no_of_freights: freights[0].no_of_freights,
                                no_of_orders: orders[0].no_of_orders,
                                no_of_clearance: clearance[0].no_of_clearance,
                                no_Of_clearanceOrder: clearance_order[0].no_Of_clearanceOrder

                            }
                            res.status(200).send({
                                success: true,
                                details
                            })
                        })
                    })
                })
            })

        })
    }
    catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        })
    }
}


const countGraph = async (req, res) => {
    try {
        const selectQuery = `
        SELECT
            months.month AS month,
            COALESCE(data.pending_orders, 0) AS pending_orders,
            COALESCE(data.accepted_orders, 0) AS accepted_orders,
            COALESCE(data.rejected_orders, 0) AS rejected_orders,
            COALESCE(data.partial_orders, 0) AS partial_orders,
            IFNULL(ROUND((COALESCE(data.pending_orders, 0) / total_orders) * 100, 2), 0) AS pending_percentage,
            IFNULL(ROUND((COALESCE(data.accepted_orders, 0) / total_orders) * 100, 2), 0) AS accepted_percentage,
            IFNULL(ROUND((COALESCE(data.rejected_orders, 0) / total_orders) * 100, 2), 0) AS rejected_percentage,
            IFNULL(ROUND((COALESCE(data.partial_orders, 0) / total_orders) * 100, 2), 0) AS partial_percentage
        FROM
            (
                SELECT '01' AS month UNION ALL SELECT '02' UNION ALL SELECT '03' UNION ALL
                SELECT '04' UNION ALL SELECT '05' UNION ALL SELECT '06' UNION ALL
                SELECT '07' UNION ALL SELECT '08' UNION ALL SELECT '09' UNION ALL
                SELECT '10' UNION ALL SELECT '11' UNION ALL SELECT '12'
            ) AS months
        LEFT JOIN
            (
                SELECT
                    DATE_FORMAT(f.created_at, '%m') AS month,
                    SUM(CASE WHEN f.order_status != '1' THEN 1 ELSE 0 END) AS pending_orders,
                    SUM(CASE WHEN f.order_status = '1' THEN 1 ELSE 0 END) AS accepted_orders,
                    SUM(CASE WHEN f.order_status = '2' THEN 1 ELSE 0 END) AS rejected_orders,
                    SUM(CASE WHEN f.order_status = '3' THEN 1 ELSE 0 END) AS partial_orders,
                    SUM(1) AS total_orders
                FROM
                    tbl_freight f
                WHERE
                    f.created_at IS NOT NULL AND YEAR(f.created_at) = YEAR(CURDATE())
                GROUP BY
                    DATE_FORMAT(f.created_at, '%m')
            ) AS data
        ON
            months.month = data.month;
        `;

        await con.query(selectQuery, (err, data) => {
            if (err) throw err;
            if (data.length > 0) {
                res.status(200).send({
                    success: true,
                    data: data
                });
            } else {
                res.status(400).send({
                    success: false,
                    message: "Data not found"
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

const countofFreight = async (req, res) => {
    try {
        const selectQuery = `SELECT 
        COUNT(CASE WHEN freight = 'Road' THEN 1 END) AS road_freight_count,
        COUNT(CASE WHEN freight = 'Air' THEN 1 END) AS air_freight_count,
        COUNT(CASE WHEN freight = 'Sea' THEN 1 END) AS sea_freight_count,
        COUNT(*) AS total_freight_count,
        (COUNT(CASE WHEN freight = 'Road' THEN 1 END) / COUNT(*)) * 100 AS road_percentage,
        (COUNT(CASE WHEN freight = 'Air' THEN 1 END) / COUNT(*)) * 100 AS air_percentage,
        (COUNT(CASE WHEN freight = 'Sea' THEN 1 END) / COUNT(*)) * 100 AS sea_percentage
    FROM 
        tbl_freight;`
        await con.query(selectQuery, (err, data) => {
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

const GetSupplerSelected = async (req, res) => {
    try {
        const { freight_id } = req.body;
        if (!freight_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide freight_id"
            })
        }
        await con.query(`select * from freight_assign where freight_id ='${freight_id}'`, (err, data) => {
            if (err) throw err;
            if (data.length > 0) {
                // console.log(data);
                const arr = [];
                data.forEach((item) => {
                    // console.log(item.supplier_id);
                    con.query(`select * from tbl_suppliers where id='${item.supplier_id}'`, (err, result) => {
                        if (err) throw err;
                        arr.push({ id: result[0].id, name: result[0].name })
                    })
                })
                setTimeout(() => {
                    res.status(200).send({
                        success: true,
                        data: arr
                    })
                }, 1000);
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

const assignEstimatetoClient = async (req, res) => {
    try {
        const { freight_id } = req.body;
        if (!freight_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide freight_id"
            })
        }
        await con.query(`select shipping_estimate.id, shipping_estimate.is_assigned, tbl_freight.status from shipping_estimate 
            INNER JOIN tbl_freight on tbl_freight.id=shipping_estimate.freight_id
            where freight_id='${freight_id}'`, (err, data) => {
            if (err) throw err;
            if (data.length > 0) {
                // console.log(data);
                if (data[0].is_assigned == 0 && data[0].status == 1) {
                    const updateQuery = `update shipping_estimate set is_assigned='${1}' where id='${data[0].id}'`;
                    con.query(updateQuery, (err, data) => {
                        if (err) throw err;
                        const update = `update tbl_freight set status='${4}' where id='${freight_id}'`;
                        con.query(update, (err, data) => {
                            if (err) throw err;

                        })
                        res.status(200).send({
                            success: true,
                            message: "Quote successfully assigned to client"
                        })
                    })

                }
                else if (data[0].is_assigned == 1 && data[0].status == 4) {
                    res.status(400).send({
                        success: false,
                        message: "This quote has already been assigned to the client"
                    })
                }
                else {
                    res.status(400).send({
                        success: false,
                        message: "failed to assign quotation"
                    })
                }
            }
            else {
                res.status(400).send({
                    success: false,
                    message: "Quotation not found"
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


const UpdateOrderStatus = async (req, res) => {
    try {
        const { order_id, status, description } = req.body;

        if (!order_id || !status) {
            return res.status(400).send({
                success: false,
                message: "Please provide both order_id and status"
            });
        }

        const datetime = new Date().toISOString().slice(0, 19).replace('T', ' ');

        // Check if order exists
        con.query(`SELECT * FROM tbl_orders WHERE id = ?`, [order_id], (err, orderData) => {
            if (err) return res.status(500).send({ success: false, message: err.message });

            if (orderData.length === 0) {
                return res.status(400).send({
                    success: false,
                    message: "Order ID doesn't exist"
                });
            }

            // Insert status update into order_track
            con.query(`INSERT INTO order_track (order_id, status, description, created_at) VALUES (?, ?, ?, ?)`,
                [order_id, status, description, datetime],
                (err, insertTrackResult) => {
                    if (err) return res.status(500).send({ success: false, message: err.message });

                    // Get client_id
                    con.query(`SELECT client_id FROM tbl_orders WHERE id = ?`, [order_id], (err, clientResult) => {
                        if (err) return res.status(500).send({ success: false, message: err.message });

                        const client_id = clientResult[0].client_id;

                        // Insert notification
                        const notificationMessage = `Order #OR000${order_id} has been ${status}. For more details, please track your order.`;
                        con.query(`INSERT INTO tbl_notifications (title, description, send_to) VALUES (?, ?, ?)`,
                            ["Order Status Update", notificationMessage, 4],
                            (err, notificationResult) => {
                                if (err) return res.status(500).send({ success: false, message: err.message });

                                const notification_id = notificationResult.insertId;

                                // Link notification to client
                                con.query(`INSERT INTO notification_details (user_id, notification_id) VALUES (?, ?)`,
                                    [client_id, notification_id],
                                    (err) => {
                                        if (err) return res.status(500).send({ success: false, message: err.message });

                                        // Update order's current status
                                        con.query(`UPDATE tbl_orders SET track_status = ? WHERE id = ?`,
                                            [status, order_id],
                                            (err) => {
                                                if (err) return res.status(500).send({ success: false, message: err.message });

                                                // Fetch user email and name
                                                con.query(`SELECT * FROM tbl_users WHERE id = ?`, [client_id], (err, userData) => {
                                                    if (err) return res.status(500).send({ success: false, message: err.message });

                                                    const email = userData[0].email;
                                                    const fullName = userData[0].full_name;
                                                    const user_phoneNumber = userData[0].cellphone || userData[0].telephone;
                                                    const orderNumber = `OR000${order_id}`
                                                    const message = getOrderStatusMessage(orderNumber, fullName, status);
                                                    // const smsResponse = sendSms(user_phoneNumber, message);
                                                    // const whatsappResponse = sendWhatsApp(user_phoneNumber, message);
                                                    // console.log(smsResponse);
                                                    // console.log(whatsappResponse);

                                                    const mailContent = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; background-color: #f9f9f9;">
  <h2 style="color: #2c3e50; border-bottom: 1px solid #ccc; padding-bottom: 10px;">
    Order Status: ${status}
  </h2>

  <p style="font-size: 16px; color: #333;">
    Dear ${fullName},<br><br>
    Your order status has been updated.
  </p>

  <p style="font-size: 16px; color: #333;">
    <strong>Order Number:</strong> OR000${order_id}<br>
    <strong>Current Status:</strong> ${status}
  </p>

  <p style="font-size: 16px; color: #333;">
    Please log in to your dashboard for more information.
  </p>

  <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 20px;">

  <p style="font-size: 14px; color: #777;">
    Regards,<br>
    <strong>Management System</strong>
  </p>
</div>`;

                                                    // Send email
                                                    sendMail(email, "Order Status Update", mailContent);

                                                    return res.status(200).send({
                                                        success: true,
                                                        message: "Order status updated and notification sent.",
                                                        email: email
                                                    });
                                                });
                                            });
                                    });
                            });
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

const getOrderStatusMessage = (orderId, customerName, status) => {
    // Define a common template message
    let statusMessage = '';

    switch (status) {
        case 'Collected from supplier':
            statusMessage = `Dear ${customerName},\n\nYour order with Order ID: ${orderId} has been successfully Collected from supplier. We are processing your order now.`;
            break;
        case 'Delivered':
            statusMessage = `Dear ${customerName},\n\nYour order with Order ID: ${orderId} has been delivered successfully. Thank you for shopping with us!`;
            break;
        default:
            statusMessage = `Dear ${customerName},\n\nYour order with Order ID: ${orderId} has been successfully ${status}. Please check your account for the latest details.`;
    }

    return statusMessage;
};


const GetOrderStatus = async (req, res) => {
    try {
        const { order_id, batch_id } = req.body;

        // Validate input
        if (!order_id && !batch_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide either order_id or batch_id"
            });
        }

        if (order_id) {
            // Process using order_id
            let numericOrderId;
            if (order_id.startsWith("OR000")) {
                numericOrderId = order_id.slice(5);
            } else {
                numericOrderId = order_id;
            }

            await con.query(`SELECT * FROM tbl_orders WHERE id='${numericOrderId}'`, (err, orderData) => {
                if (err) throw err;

                if (orderData.length > 0) {
                    con.query(`SELECT status, created_at, description FROM order_track WHERE order_id='${numericOrderId}' ORDER BY created_at DESC`, (err, orderStatuses) => {
                        if (err) throw err;

                        handleStatusResponse(res, orderStatuses);
                    });
                } else {
                    res.status(400).send({
                        success: false,
                        message: "Order id doesn't exist"
                    });
                }
            });
        } else if (batch_id) {
            // Process using batch_id
            await con.query(`SELECT * FROM batches WHERE id='${batch_id}'`, (err, batchData) => {
                if (err) throw err;

                if (batchData.length > 0) {
                    con.query(`SELECT status, created_at, description FROM order_track WHERE batch_id='${batch_id}' ORDER BY created_at DESC`, (err, orderStatuses) => {
                        if (err) throw err;

                        handleStatusResponse(res, orderStatuses);
                    });
                } else {
                    res.status(400).send({
                        success: false,
                        message: "Batch id doesn't exist"
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

// Helper function to process and send status response
const handleStatusResponse = (res, orderStatuses) => {
    const statuses = [
        'Collected from supplier',
        'Received at Asia Direct warehouse',
        'Dispatched to port',
        'Goods at origin port',
        'Goods are in transit',
        'Arrived at destination port',
        'Customs clearing in progress',
        'Customs released',
        'Goods in transit to warehouse',
        'Arrived at Asia Direct warehouse',
        'Out for delivery',
        'Delivered'
    ];

    if (orderStatuses.length > 0) {
        const latestStatus = orderStatuses[0].status;

        const result = statuses.map((status, index) => {
            const statusData = {
                status,
                created_at: null,
                description: null,
                is_completed: '0' // Default is 0 (not completed)
            };

            const foundStatus = orderStatuses.find(oStatus => oStatus.status === status);
            if (foundStatus) {
                statusData.created_at = foundStatus.created_at;
                statusData.description = foundStatus.description;
                statusData.is_completed = '1'; // Mark as completed if found in database
            }

            if (status === latestStatus || statuses.indexOf(status) < statuses.indexOf(latestStatus)) {
                statusData.is_completed = '1';
            } else {
                statusData.is_completed = '0';
            }

            return statusData;
        });

        res.status(200).send({
            success: true,
            data: result
        });
    } else {
        res.status(200).send({
            success: true,
            data: [] // No statuses found
        });
    }
};


const StageOfShipment = async (req, res) => {
    const query = `
    SELECT status_list.status, 
           COALESCE(COUNT(order_delivery_details.status), 0) AS count, 
           ROUND((COALESCE(COUNT(order_delivery_details.status), 0) / (SELECT COUNT(*) FROM order_delivery_details)) * 100, 2) AS percentage
    FROM (
        SELECT 'In-Transit' AS status
        UNION ALL
        SELECT 'At Local Port' AS status
        UNION ALL
        SELECT 'Ready for Dispatch' AS status
    ) AS status_list
    LEFT JOIN order_delivery_details ON status_list.status = order_delivery_details.status
    GROUP BY status_list.status`;

    con.query(query, (err, results) => {
        if (err) {
            // console.error(err);
            res.status(500).json({ success: false, message: 'Internal server error' });
            return;
        }

        // Prepare data for graph
        const graphData = results.map(row => {
            return { status: row.status, percentage: row.percentage };
        });

        // Send graph data as JSON response
        res.status(200).json({ success: true, data: graphData });
    });
};

const socialMediaLinks = async (req, res) => {
    try {
        const { facebook_link, instagram_link, youtube_link, twitter_link, linkedin_link } = req.body;
        let selectQuery = `select  id from  social_media_links`;
        await con.query(selectQuery, (err, result) => {
            if (err) throw err;
            if (result.length > 0) {
                const insertQuery = `update social_media_links set facebook_link=?, instagram_link=?, youtube_link=?, twitter_link=?, linkedin_link=? where id=?`;
                con.query(insertQuery, [facebook_link, instagram_link, youtube_link, twitter_link, linkedin_link, result[0].id], (err, data) => {
                    if (err) throw err;
                    res.status(200).send({
                        success: true,
                        message: "Social media links updated successfully"
                    })
                })
            }
            else {
                const insertQuery = `insert into  social_media_links (facebook_link, instagram_link, youtube_link, twitter_link, linkedin_link) values(?,?,?,?,?)`;
                con.query(insertQuery, [facebook_link, instagram_link, youtube_link, twitter_link, linkedin_link], (err, data) => {
                    if (err) throw err;
                    res.status(200).send({
                        success: true,
                        message: "Social media links added successfully"
                    })
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


const GetAllsocialLinks = async (req, res) => {
    try {
        let selectQuery = `select * from  social_media_links`;
        await con.query(selectQuery, (err, result) => {
            if (err) throw err;
            if (result.length > 0) {
                res.status(200).send({
                    success: true,
                    data: result[0]
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


const getProfileAdmin = async (req, res) => {
    try {
        const { user_id } = req.body;
        if (!user_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide user_id"
            });
        }
        await con.query(`select * from 	tbl_users where id='${user_id}'`, (err, data) => {
            if (err) throw err;
            if (data.length > 0) {
                res.status(200).send({
                    success: true,
                    data: data[0]
                });
            }
            else {
                res.status(400).send({
                    success: false,
                    message: "Data not found"
                });
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


// Api for add frieght to warehouse
const add_freight_to_warehouse = async (req, res) => {
    try {
        const { freight_id, order_id } = req.body;

        // Check for required field

        // Check for freight existence and warehouse_status
        con.query(`SELECT * FROM tbl_orders WHERE id = '${order_id}'`, (err, data) => {
            if (err) throw err;

            if (data.length === 0) {
                return res.status(400).send({
                    success: false,
                    message: 'order not found'
                });
            }

            if (data[0].warehouse_status !== 0) {
                return res.status(400).send({
                    success: false,
                    message: 'Order already in warehouse'
                });
            }

            // Update warehouse_status in tbl_freight
            con.query(`UPDATE tbl_orders SET warehouse_status = 1 WHERE id = '${order_id}'`, (err, updateResult) => {
                if (err) throw err;
                con.query(`UPDATE tbl_freight SET warehouse_status = 1 WHERE id = '${freight_id}'`, (err, updateResult) => {
                    if (err) throw err;
                    // Insert updated data into warehouse_tbl
                    con.query(`INSERT INTO warehouse_assign_order (freight_id, order_id, warehouse_status) VALUES ('${freight_id} || 0', '${order_id}', 1)`, (err, insertResult) => {
                        if (err) throw err;

                        return res.status(200).send({
                            success: true,
                            message: 'Order added to warehouse successfully'
                        });
                    });
                })
            });

        });
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

const restore_order_from_warehouse = async (req, res) => {
    try {
        const { order_id } = req.body;

        // Check for required field
        if (!order_id) {
            return res.status(400).send({
                success: false,
                message: 'Order ID are required'
            });
        }

        // Check if the order exists and is currently assigned to the warehouse
        con.query(`SELECT * FROM tbl_orders WHERE id = '${order_id}'`, (err, data) => {
            if (err) throw err;

            if (data.length === 0) {
                return res.status(400).send({
                    success: false,
                    message: 'Order not found'
                });
            }

            if (data[0].warehouse_status !== 1) {
                return res.status(400).send({
                    success: false,
                    message: 'Order is not currently in the warehouse'
                });
            }

            // Update warehouse_status in tbl_orders to 0 (restored)
            con.query(`UPDATE tbl_orders SET warehouse_status = 0 WHERE id = '${order_id}'`, (err, updateResult) => {
                if (err) throw err;

                // Remove the restored order from warehouse_assign_order table
                con.query(`DELETE FROM warehouse_assign_order WHERE order_id = '${order_id}'`, (err, deleteResult) => {
                    if (err) throw err;

                    return res.status(200).send({
                        success: true,
                        message: 'Order restored from warehouse successfully'
                    });
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


const GetWarehouseOrders = async (req, res) => {
    try {
        const { origin, destination, startDate, endDate, freightType, freightSpeed } = req.body;

        // Base condition and parameters
        let condition = `WHERE warehouse_assign_order.warehouse_status = '1' AND tbl_freight.is_deleted = '0'`;
        let params = [];

        if (origin) {
            condition += ` AND tbl_freight.collection_from = ?`;
            params.push(origin);
        }

        if (destination) {
            condition += ` AND tbl_freight.delivery_to = ?`;
            params.push(destination);
        }

        if (startDate && endDate) {
            condition += ` AND tbl_freight.created_at BETWEEN ? AND ?`;
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
            SELECT 
                warehouse_assign_order.*, 
                warehouse_assign_order.id AS warehouse_assign_order_id, 
                tbl_freight.*, 
                tbl_freight.freight as Freight,
                tbl_freight.id AS freight_ID,
                tbl_orders.*, 
                batches.*, 
                warehouse_tbl.*,
                shipping_estimate.id AS estimated_id,
                c.name AS delivery_to_name, 
                co.name AS collection_from_name,
                CASE 
                    WHEN tbl_orders.client_id = 0 THEN tbl_orders.client_name 
                    ELSE tbl_users.full_name 
                END AS client_name 
            FROM warehouse_assign_order 
            LEFT JOIN tbl_freight 
                ON warehouse_assign_order.freight_id = tbl_freight.id 
                AND tbl_freight.is_deleted = '0'
            LEFT JOIN shipping_estimate 
                ON warehouse_assign_order.freight_id = shipping_estimate.freight_id 
                AND tbl_freight.is_deleted = '0'
            LEFT JOIN tbl_orders 
                ON warehouse_assign_order.order_id = tbl_orders.id
            LEFT JOIN tbl_users  
                ON tbl_users.id = tbl_orders.client_id
            LEFT JOIN batches 
                ON batches.id = warehouse_assign_order.batch_id
            LEFT JOIN warehouse_tbl 
                ON warehouse_tbl.id = batches.warehouse_id
            LEFT JOIN countries AS c 
                ON c.id = tbl_freight.delivery_to
            LEFT JOIN countries AS co 
                ON co.id = tbl_freight.collection_from
            ${condition}
            ORDER BY warehouse_assign_order.created_at DESC
        `;

        con.query(query, params, (err, data) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: err.message
                });
            }

            if (data.length === 0) {
                return res.status(400).send({
                    success: false,
                    message: 'Freight not found'
                });
            } else {
                return res.status(200).send({
                    success: true,
                    data: data
                });
            }
        });
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: error.message
        });
    }
};


const DeleteWarehouseOrder = async (req, res) => {
    try {
        const { id, order_id, freight_id } = req.body; // Assuming the ID is passed as a parameter

        if (!id) {
            return res.status(400).send({
                success: false,
                message: 'Warehouse order ID is required',
            });
        }

        con.query(
            `DELETE FROM warehouse_assign_order WHERE id = ?`,
            [id],
            (err, result) => {
                if (err) {
                    throw err;
                }

                if (result.affectedRows === 0) {
                    return res.status(404).send({
                        success: false,
                        message: 'Warehouse order not found',
                    });
                }
                con.query(`UPDATE tbl_orders SET warehouse_status = 0 WHERE id = '${order_id}'`, (err, updateResult) => {
                    if (err) throw err;
                })

                const updateFreightQuery = 'UPDATE tbl_freight SET asigned_to_batch = 0 WHERE id = ?';
                con.query(updateFreightQuery, [freight_id], (err, updateResult) => {
                    if (err) throw err;
                })

                const DeleteFreightQuery = 'DELETE from freight_assig_to_batch where freight_id = ?';
                con.query(DeleteFreightQuery, [freight_id], (err, updateResult) => {
                    if (err) throw err;
                })

                return res.status(200).send({
                    success: true,
                    message: 'Warehouse order deleted successfully',
                });
            }
        );
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: error.message,
        });
    }
};

const getWarehouseOrderProduct = async (req, res) => {
    try {
        const { warehouse_assign_order_id } = req.body;

        // Step 1: Fetch freight details first
        con.query(
            `
            SELECT 
                product_desc AS product_description, 
                date AS date_received, 
                hazardous AS Hazardous, 
                package_type AS package_type, 
                no_of_packages AS packages, 
                dimension, 
                weight
            FROM 
                tbl_freight
            WHERE 
                id = (
                    SELECT freight_id 
                    FROM warehouse_assign_order 
                    WHERE id = ?
                )
            `,
            [warehouse_assign_order_id],
            (err, freightData) => {
                if (err) throw err;

                if (freightData.length === 0) {
                    return res.status(400).send({
                        success: false,
                        message: "No freight data found for the given ID",
                    });
                }

                // Step 2: Fetch warehouse product details
                con.query(
                    `
                    SELECT 
                        warehouse_products.id as warehouse_products_id, 
                        warehouse_products.warehouse_order_id, 
                        warehouse_products.product_description, 
                        warehouse_products.Hazardous, 
                        warehouse_products.date_received, 
                        warehouse_products.package_type, 
                        warehouse_products.packages, 
                        warehouse_products.dimension, 
                        warehouse_products.weight, 
                        warehouse_products.warehouse_ref, 
                        warehouse_products.created,
                        warehouse_products.tracking_number,
                        warehouse_assign_order.freight_id
                    FROM 
                        warehouse_products
                    LEFT JOIN 
                        warehouse_assign_order 
                        ON warehouse_assign_order.id = warehouse_products.warehouse_order_id
                    WHERE 
                        warehouse_products.warehouse_order_id = ?
                    ORDER BY 
                        warehouse_products.created DESC
                    `,
                    [warehouse_assign_order_id],
                    (err, productsData) => {
                        if (err) throw err;

                        // Combine freight details into the productsData array
                        const responseData = [
                            {
                                ...freightData[0], // Freight details at the top
                            },
                            ...productsData, // Append all warehouse product data
                        ];

                        return res.status(200).send({
                            success: true,
                            data: responseData,
                        });
                    }
                );
            }
        );
    } catch (error) {
        // console.error("Error in getWarehouseOrderProduct:", error.message);
        return res.status(500).send({
            success: false,
            message: error.message,
        });
    }
};

const updateWarehouseProduct = async (req, res) => {
    try {
        const {
            warehouse_products_id, // Ensure this is passed to identify the product
            product_description,
            Hazardous,
            date_received,
            package_type,
            packages,
            dimension,
            weight,
            warehouse_ref
        } = req.body;

        if (!warehouse_products_id) {
            return res.status(400).send({
                success: false,
                message: "Product ID is required for updating."
            });
        }

        const query = `
            UPDATE warehouse_products
            SET 
                product_description = ?, 
                Hazardous = ?, 
                date_received = ?, 
                package_type = ?, 
                packages = ?, 
                dimension = ?, 
                weight = ?, 
                warehouse_ref = ?
            WHERE id = ?`;

        const values = [
            product_description,
            Hazardous,
            date_received,
            package_type,
            packages,
            dimension,
            weight,
            warehouse_ref,
            warehouse_products_id // Ensure `product_id` is used in the WHERE clause
        ];

        con.query(query, values, (err, result) => {
            if (err) throw err;

            if (result.affectedRows === 0) {
                return res.status(404).send({
                    success: false,
                    message: "No product found with the given ID."
                });
            }

            res.status(200).send({
                success: true,
                message: "Warehouse Product Details Updated successfully"
            });
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

const updateClientWarehouseProduct = async (req, res) => {
    try {
        const {
            warehouse_products_id, // Ensure this is passed to identify the product
            product_description,
            Hazardous,
            date_received,
            package_type,
            packages,
            dimension,
            weight,
            warehouse_ref,
            supplier,
            warehouse_receipt_number,
            tracking_number,
            supplier_address,
            Supplier_Contact,
            supplier_Email
        } = req.body;

        if (!warehouse_products_id) {
            return res.status(400).send({
                success: false,
                message: "Product ID is required for updating."
            });
        }

        const query = `
            UPDATE warehouse_products
            SET 
                product_description = ?, 
                Hazardous = ?, 
                date_received = ?, 
                package_type = ?, 
                packages = ?, 
                dimension = ?, 
                weight = ?, 
                warehouse_ref = ?,
                supplier = ?,
                warehouse_receipt_number = ?,
                tracking_number = ?,
                supplier_address = ?,
                Supplier_Contact = ?,
                supplier_Email = ?
            WHERE id = ?`;

        const values = [
            product_description,
            Hazardous,
            date_received,
            package_type,
            packages,
            dimension,
            weight,
            warehouse_ref,
            supplier,
            warehouse_receipt_number,
            tracking_number,
            supplier_address,
            Supplier_Contact,
            supplier_Email,
            warehouse_products_id // Ensure `product_id` is used in the WHERE clause
        ];

        con.query(query, values, (err, result) => {
            if (err) throw err;

            if (result.affectedRows === 0) {
                return res.status(404).send({
                    success: false,
                    message: "No product found with the given ID."
                });
            }

            res.status(200).send({
                success: true,
                message: "Warehouse Product Details Updated successfully"
            });
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

const DeleteWarehouseProduct = async (req, res) => {
    try {
        const { warehouse_products_id } = req.body;

        if (!warehouse_products_id) {
            return res.status(400).send({
                success: false,
                message: "Product ID is required for deletion."
            });
        }

        const query = `
            DELETE FROM warehouse_products
            WHERE id = ?`;

        con.query(query, [warehouse_products_id], (err, result) => {
            if (err) throw err;

            if (result.affectedRows === 0) {
                return res.status(404).send({
                    success: false,
                    message: "No product found with the given ID."
                });
            }

            res.status(200).send({
                success: true,
                message: "Warehouse Product deleted successfully."
            });
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
};


const createBatch = async (req, res) => {
    try {
        const {
            batch_number,
            warehouse_id,
            date_first_received,
            ETD,
            total_days_storage,
            batch_name,
            is_exporImport,
            freight,
            freight_option,
            freight_speed,
            collection_warehouse,
            delivery_warehouse,
            origin_country_id,
            detination_country_id,
            port_loading,
            port_discharge,
            collection_address,
            delivery_address,
            origin_handler,
            des_handler,
            costs_to_collect,
            warehouse_cost,
            origin_doc_costs,
            origin_oncarriage_costs,
            origin_Incidental_costs,
            costs_to_collect_des,
            warehouse_cost_des,
            des_doc_costs,
            des_oncarriage_costs,
            des_Incidental_costs,
            freight_cost,
            no_of_shipments,
            nature_of_good,
            type_of_packaging,
            total_boxes,
            volumentric_weight,
            total_weight,
            total_dimensions,
            master_waybill,
            house_waybill,
            carrier,
            vessel,
            container_no,
            devy_port_of_loading,
            devy_port_of_discharge,
            devy_final_des,
            origin_carrier,
            des_carrier,
            registration_number,
            comment
        } = req.body;
        console.log(req.body);

        // Check if batch_number already exists
        const checkQuery = 'SELECT * FROM batches WHERE batch_number = ?';
        con.query(checkQuery, [batch_number], (err, result) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: err.message
                });
            }

            if (result.length > 0) {
                return res.status(400).send({
                    success: false,
                    message: 'Batch number already exists'
                });
            }

            // Insert new batch
            const insertQuery = `
                INSERT INTO batches (
                    batch_number, warehouse_id, date_first_received, ETD, total_days_storage, 
                    batch_name, is_exporImport, freight, freight_option, freight_speed, 
                    collection_warehouse, delivery_warehouse, origin_country_id, detination_country_id, port_loading, port_discharge, collection_address, delivery_address, 
                    origin_handler, des_handler, costs_to_collect, warehouse_cost, 
                    origin_doc_costs, origin_oncarriage_costs, origin_Incidental_costs, 
                    costs_to_collect_des, warehouse_cost_des, des_doc_costs, des_oncarriage_costs, 
                    des_Incidental_costs, freight_cost, no_of_shipments, nature_of_good, 
                    type_of_packaging, total_boxes, volumentric_weight, total_weight, 
                    total_dimensions, master_waybill, house_waybill, carrier, vessel, 
                    container_no, devy_port_of_loading, devy_port_of_discharge, devy_final_des, 
                    origin_carrier, des_carrier, registration_number, comment
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                   ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
                   ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            con.query(insertQuery, [
                batch_number, warehouse_id, date_first_received, ETD, total_days_storage,
                batch_name, is_exporImport, freight, freight_option, freight_speed,
                collection_warehouse, delivery_warehouse, origin_country_id, detination_country_id,
                port_loading, port_discharge, collection_address, delivery_address,
                origin_handler, des_handler, costs_to_collect, warehouse_cost,
                origin_doc_costs, origin_oncarriage_costs, origin_Incidental_costs,
                costs_to_collect_des, warehouse_cost_des, des_doc_costs, des_oncarriage_costs,
                des_Incidental_costs, freight_cost, no_of_shipments, nature_of_good,
                type_of_packaging, total_boxes, volumentric_weight, total_weight,
                total_dimensions, master_waybill, house_waybill, carrier, vessel,
                container_no, devy_port_of_loading, devy_port_of_discharge, devy_final_des,
                origin_carrier, des_carrier, registration_number, comment
            ], (err, result) => {
                if (err) {
                    return res.status(500).send({
                        success: false,
                        message: err.message
                    });
                }

                return res.status(201).send({
                    success: true,
                    message: 'Batch created successfully'
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


const getAllBatch = async (req, res) => {
    try {
        const getQuery = `
            SELECT b.*, 
                   b.origin_country_id AS origin_country, 
                   b.detination_country_id AS destination_country,
                    c.name as des_country_name, co.name as origin_country_name
            FROM batches as b
            LEFT JOIN countries AS c ON c.id = b.detination_country_id
            LEFT JOIN countries AS co ON co.id = b.origin_country_id
            WHERE b.is_deleted = ?
            ORDER BY b.id DESC`;

        // Execute the main query
        con.query(getQuery, [0], async (err, results) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: err.message,
                });
            }

            if (results.length === 0) {
                return res.status(404).send({
                    success: false,
                    message: 'Batch not found',
                });
            }

            // Process each batch and fetch its freight count
            try {
                const updatedResults = await Promise.all(
                    results.map((result) => {
                        return new Promise((resolve, reject) => {
                            const getQuery1 = `
                                SELECT * 
                                FROM freight_assig_to_batch 
                                WHERE batch_id = ?`;

                            con.query(getQuery1, [result.id], (err, data) => {
                                if (err) return reject(err);

                                result.count_freight = data.length;
                                resolve(result);
                            });
                        });
                    })
                );

                return res.status(200).send({
                    success: true,
                    data: updatedResults,
                });
            } catch (innerErr) {
                return res.status(500).send({
                    success: false,
                    message: innerErr.message,
                });
            }
        });
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: error.message,
        });
    }
};


const deleteBatch = async (req, res) => {
    try {
        const { id } = req.body;

        // Soft delete the batch by setting is_deleted to true
        const deleteQuery = 'UPDATE batches SET is_deleted = 1 WHERE id = ?';
        con.query(deleteQuery, [id], (err, result) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: err.message
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).send({
                    success: false,
                    message: 'Batch not found'
                });
            }

            return res.status(200).send({
                success: true,
                message: 'Batch deleted successfully'
            });
        });
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: error.message
        });
    }
};


const UpdateOrderStatusesFromBatch = async (req, res) => {
    try {
        const { batch_id, status, description } = req.body;
        console.log(req.body);


        if (!batch_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide batch_id",
            });
        }

        if (!status) {
            return res.status(400).send({
                success: false,
                message: "Please provide status",
            });
        }

        // Predefined statuses
        const statuses = [
            'Received at Asia Direct warehouse',
            'Dispatched to port',
            'Goods at origin port',
            'Goods are in transit',
            'Arrived at destination port',
            'Customs clearing in progress',
            'Customs released',
            'Goods in transit to warehouse',
            'Arrived at Asia Direct warehouse',
        ];

        // Validate provided status
        const statusIndex = statuses.indexOf(status);
        if (statusIndex === -1) {
            return res.status(400).send({
                success: false,
                message: "Invalid status.",
            });
        }

        // Fetch orders for the batch
        const orders = await new Promise((resolve, reject) => {
            con.query(
                'SELECT order_id FROM freight_assig_to_batch WHERE batch_id = ?',
                [batch_id],
                (err, result) => {
                    if (err) return reject(err);
                    resolve(result);
                }
            );
        });

        if (!orders.length) {
            return res.status(404).send({
                success: false,
                message: "No orders found for the given batch_id.",
            });
        }

        const datetime = new Date().toISOString().slice(0, 19).replace('T', ' ');

        for (const { order_id } of orders) {
            // Fetch existing statuses
            const existingStatuses = await new Promise((resolve, reject) => {
                con.query(
                    'SELECT status FROM order_track WHERE order_id = ?',
                    [order_id],
                    (err, result) => {
                        if (err) return reject(err);
                        resolve(result.map(row => row.status));
                    }
                );
            });

            // Determine missing statuses
            const missingStatuses = statuses.slice(0, statusIndex).filter(
                s => !existingStatuses.includes(s)
            );

            // Insert missing statuses
            for (const missingStatus of missingStatuses) {
                await new Promise((resolve, reject) => {
                    con.query(
                        'INSERT INTO order_track (order_id, batch_id, status, description, created_at) VALUES (?, ?, ?, ?, ?)',
                        [order_id, batch_id, missingStatus, null, datetime],
                        (err, result) => {
                            if (err) return reject(err);
                            resolve(result);
                        }
                    );
                });
            }

            // Insert the current status
            await new Promise((resolve, reject) => {
                /* con.query(
                    'DELETE FROM order_track WHERE order_id = ?',
                    [order_id],
                    (err, result) => {
                        if (err) return reject(err);
                        resolve(result);
                    }
                ); */

                con.query(
                    'INSERT INTO order_track (order_id, batch_id, status, description, created_at) VALUES (?, ?, ?, ?, ?)',
                    [order_id, batch_id, status, description || null, datetime],
                    (err, result) => {
                        if (err) return reject(err);
                        resolve(result);
                    }
                );
            });

            // Update order status in tbl_orders
            await new Promise((resolve, reject) => {
                con.query(
                    'UPDATE tbl_orders SET track_status = ? WHERE id = ?',
                    [status, order_id],
                    (err, result) => {
                        if (err) return reject(err);
                        resolve(result);
                    }
                );
            });

            // Notify client
            const client_id = await new Promise((resolve, reject) => {
                con.query(
                    'SELECT client_id FROM tbl_orders WHERE id = ?',
                    [order_id],
                    (err, result) => {
                        if (err) return reject(err);
                        resolve(result[0]?.client_id || null);
                    }
                );
            });

            if (client_id) {
                const notificationId = await new Promise((resolve, reject) => {
                    con.query(
                        'INSERT INTO tbl_notifications (title, description, send_to) VALUES (?, ?, ?)',
                        ["Order Status Update", `Order #OR000${order_id} has been ${status}.`, 4],
                        (err, result) => {
                            if (err) return reject(err);
                            resolve(result.insertId);
                        }
                    );
                });

                await new Promise((resolve, reject) => {
                    con.query(
                        'INSERT INTO notification_details (user_id, notification_id) VALUES (?, ?)',
                        [client_id, notificationId],
                        (err, result) => {
                            if (err) return reject(err);
                            resolve(result);
                        }
                    );
                });

                const userData = await new Promise((resolve, reject) => {
                    con.query(`SELECT * FROM tbl_users WHERE id = ?`, [client_id], (err, result) => {
                        if (err) return reject(err);
                        resolve(result);
                    });
                });

                const email = userData[0]?.email;
                const fullName = userData[0]?.full_name;
                const mailContent = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; background-color: #f9f9f9;">
<h2 style="color: #2c3e50; border-bottom: 1px solid #ccc; padding-bottom: 10px;">
Order Status: ${status}
</h2>

<p style="font-size: 16px; color: #333;">
Dear ${fullName},<br><br>
Your order status has been updated.
</p>

<p style="font-size: 16px; color: #333;">
<strong>Order Number:</strong> OR000${order_id}<br>
<strong>Current Status:</strong> ${status}
</p>

<p style="font-size: 16px; color: #333;">
Please log in to your dashboard for more information.
</p>

<hr style="border: none; border-top: 1px solid #ddd; margin: 20px 20px;">

<p style="font-size: 14px; color: #777;">
Regards,<br>
<strong>Management System</strong>
</p>
</div>`;

                // Send email
                sendMail(email, "Order Status Update", mailContent);

            }

        }

        // Update batch status once
        await new Promise((resolve, reject) => {
            con.query(
                'UPDATE batches SET track_status = ? WHERE id = ?',
                [status, batch_id],
                (err, result) => {
                    if (err) return reject(err);
                    resolve(result);
                }
            );
        });

        res.status(200).send({
            success: true,
            message: "Statuses updated successfully for all orders in the batch.",
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message,
        });
    }
};

const moveFreightToBatch = async (req, res) => {
    try {
        const { freight_id, batch_id, warehouse_id, order_id } = req.body;
        console.log(req.body);

        // Check if the batch exists
        const batchCheckQuery = 'SELECT * FROM batches WHERE id = ?';
        con.query(batchCheckQuery, [batch_id], (err, batchResult) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: err.message
                });
            }

            if (batchResult.length === 0) {
                return res.status(400).send({
                    success: false,
                    message: 'Batch not found'
                });
            }

            // Fetch the order's origin and destination country IDs
            const orderCheckQuery = `SELECT f.collection_from, f.delivery_to, f.freight FROM tbl_orders as o
            INNER JOIN tbl_freight as f on f.id=o.freight_id
            WHERE o.id = ?`;
            con.query(orderCheckQuery, [order_id], (err, orderResult) => {
                if (err) {
                    return res.status(500).send({
                        success: false,
                        message: err.message
                    });
                }

                if (orderResult.length === 0) {
                    return res.status(400).send({
                        success: false,
                        message: 'Order not found'
                    });
                }

                const { collection_from: orderOriginCountryId, delivery_to: orderDestinationCountryId, freight: orderFreight } = orderResult[0];

                // Fetch the batch's origin and destination country IDs
                const { origin_country_id: batchOriginCountryId, detination_country_id: batchDestinationCountryId, freight: batchFreight } = batchResult[0];

                // Check if the countries match
                if (orderOriginCountryId !== batchOriginCountryId || orderDestinationCountryId !== batchDestinationCountryId) {
                    return res.status(400).send({
                        success: false,
                        message: 'Order countries do not match with batch countries'
                    });
                }

                // Check if the freight exists and is not already assigned
                const freightCheckQuery = 'SELECT * FROM tbl_freight WHERE id = ? AND asigned_to_batch = 0';
                con.query(freightCheckQuery, [freight_id], (err, freightResult) => {
                    if (err) {
                        return res.status(500).send({
                            success: false,
                            message: err.message
                        });
                    }

                    if (freightResult.length === 0) {
                        return res.status(400).send({
                            success: false,
                            message: 'Order already assigned to batch',
                            data: freightResult, freight_id
                        });
                    }

                    // Assign the freight to the batch
                    const assignQuery = 'INSERT INTO freight_assig_to_batch (freight_id, batch_id, order_id) VALUES (?, ?, ?)';
                    con.query(assignQuery, [freight_id, batch_id, order_id], (err, result) => {
                        if (err) {
                            return res.status(500).send({
                                success: false,
                                message: err.message
                            });
                        }

                        // Update the freight status to assigned
                        const updateFreightQuery = 'UPDATE tbl_freight SET asigned_to_batch = 1 WHERE id = ?';
                        con.query(updateFreightQuery, [freight_id], (err, updateResult) => {
                            if (err) {
                                return res.status(500).send({
                                    success: false,
                                    message: err.message
                                });
                            }

                            // Update the warehouse assignment
                            const updateWarehouse = 'UPDATE warehouse_assign_order SET batch_id=?, warehouse_id=?, assign_to_batch=? WHERE freight_id=?';
                            con.query(updateWarehouse, [batch_id, warehouse_id, 1, freight_id], (err, result) => {
                                if (err) throw err;
                            });

                            return res.status(200).send({
                                success: true,
                                message: 'Order moved to batch successfully'
                            });
                        });
                    });
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


const restoreOrderFromBatch = async (req, res) => {
    try {
        const { freight_id, batch_id } = req.body;

        // Check if the freight is assigned to the batch
        const freightCheckQuery = 'SELECT * FROM freight_assig_to_batch WHERE freight_id = ? AND batch_id = ?';
        con.query(freightCheckQuery, [freight_id, batch_id], (err, freightResult) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: err.message
                });
            }

            if (freightResult.length === 0) {
                return res.status(400).send({
                    success: false,
                    message: 'Freight is not assigned to this batch'
                });
            }

            // Remove the freight from the batch
            const deleteAssignmentQuery = 'DELETE FROM freight_assig_to_batch WHERE freight_id = ? AND batch_id = ?';
            con.query(deleteAssignmentQuery, [freight_id, batch_id], (err, deleteResult) => {
                if (err) {
                    return res.status(500).send({
                        success: false,
                        message: err.message
                    });
                }

                // Update the freight status to unassigned
                const updateFreightQuery = 'UPDATE tbl_freight SET asigned_to_batch = 0 WHERE id = ?';
                con.query(updateFreightQuery, [freight_id], (err, updateResult) => {
                    if (err) {
                        return res.status(500).send({
                            success: false,
                            message: err.message
                        });
                    }

                    // Update the warehouse assignment (remove batch reference)
                    const updateWarehouseQuery = 'UPDATE warehouse_assign_order SET batch_id = NULL, assign_to_batch = 0 WHERE freight_id = ?';
                    con.query(updateWarehouseQuery, [freight_id], (err, updateWarehouseResult) => {
                        if (err) {
                            return res.status(500).send({
                                success: false,
                                message: err.message
                            });
                        }

                        return res.status(200).send({
                            success: true,
                            message: 'Freight restored from batch successfully'
                        });
                    });
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

const getFreightsByBatch = async (req, res) => {
    try {
        const { batch_id, origin, destination, startDate, endDate, freightType, freightSpeed } = req.body;

        if (!batch_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide batch_id"
            });
        }

        // Base condition and parameters
        let condition = `WHERE fa.batch_id = ?`;
        let params = [batch_id];

        if (origin) {
            condition += ` AND f.collection_from = ?`;
            params.push(origin);
        }

        if (destination) {
            condition += ` AND f.delivery_to = ?`;
            params.push(destination);
        }

        if (startDate && endDate) {
            condition += ` AND fa.created_at BETWEEN ? AND ?`;
            params.push(startDate, endDate);
        }

        if (freightType) {
            condition += ` AND f.freight = ?`;
            params.push(freightType);
        }

        if (freightSpeed) {
            condition += ` AND f.type = ?`;
            params.push(freightSpeed);
        }

        const getFreightsQuery = `
            SELECT 
                fa.*, 
                fa.id AS freight_assig_to_batch_id, 
                f.*, 
                f.id AS freight_ID, 
                b.*, 
                b.freight AS batch_freight, 
                b.total_weight AS batch_total_weight, 
                b.agent AS batch_agent, 
                b.forwarding_agent AS batch_forwarding_agent, 
                b.total_dimensions AS batch_total_dimensions, 
                b.date_dispatch AS batch_date_dispatch, 
                b.time_in_storage AS batch_time_in_storage, 
                b.costs_to_collect AS batch_costs_to_collect, 
                b.warehouse_cost AS batch_warehouse_cost, 
                b.costs_to_dispatch AS batch_costs_to_dispatch, 
                b.destination AS batch_destination, 
                b.waybill AS batch_waybill, 
                b.id AS batche_id, 
                o.id AS order_ID, 
                od.status AS delivery_status, 
                od.date_dispatched AS delivery_date_dispatched, 
                od.ETA AS delivery_ETA, 
                od.*, 
                od.port_of_loading AS delivery_port_of_loading, 
                od.port_of_discharge AS delivery_port_of_discharge, 
                od.co_loader AS delivery_co_loader, 
                od.trans_reference AS delivery_trans_reference, 
                co.name AS warehouse_origin,
                w.warehouse_name,
                u.full_name AS client_Name
            FROM freight_assig_to_batch fa
            LEFT JOIN tbl_freight f ON fa.freight_id = f.id
            LEFT JOIN tbl_orders o ON fa.freight_id = o.freight_id
            LEFT JOIN order_delivery_details od ON od.order_id = o.id
            LEFT JOIN batches b ON b.id = fa.batch_id
            LEFT JOIN warehouse_tbl w ON w.id = b.warehouse_id
            LEFT JOIN countries AS co ON co.id = w.country
            LEFT JOIN tbl_users AS u ON u.id = f.client_id
            ${condition}
            GROUP BY fa.id
        `;

        con.query(getFreightsQuery, params, (err, result) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: err.message
                });
            }

            if (result.length === 0) {
                return res.status(404).send({
                    success: false,
                    message: 'No freights found for this batch'
                });
            }

            return res.status(200).send({
                success: true,
                data: result
            });
        });
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: error.message
        });
    }
};


const MoveToOrder = async (req, res) => {
    try {
        const { freight_id, client_id } = req.body;
        // console.log(freight_id);
        if (!freight_id || !client_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide freight_id or client_id"
            })
        }
        await con.query(`select * from tbl_orders where freight_id='${freight_id}'`, (err, order_status) => {
            if (err) throw err;
            if (order_status.length < 1) {
                con.query(`update tbl_freight set order_status='${1}' where id='${freight_id}'`, (err, data) => {
                    if (err) throw err;
                    if (data.affectedRows > 0) {
                        con.query('INSERT INTO tbl_orders (freight_id, client_id) VALUES (?,?)', [freight_id, client_id], (err, result) => {
                            if (err) throw err;
                            // console.log(result.affectedRows);
                        })

                        res.status(200).send({
                            success: true,
                            message: "Move to order successfully"
                        })
                    }
                    else {
                        res.status(400).send({
                            success: false,
                            message: "Failed to move order"
                        })
                    }
                })
            }
            else {
                res.status(400).send({
                    success: false,
                    message: "Already moved into order."
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


const MoveToClearaneOrder = async (req, res) => {
    try {
        const { clearance_id, user_id } = req.body;
        //  console.log(req.body);
        if (!clearance_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide clearance id"
            })
        }
        await con.query(`select * from tbl_clearance where id='${clearance_id}'`, (err, quotation_status) => {
            if (err) throw err;
            //  console.log(quotation_status[0].quotation_status);
            if (quotation_status[0].quotation_status != 3) {
                con.query(`update tbl_clearance set quotation_status='${3}' where id='${clearance_id}'`, (err, data) => {
                    if (err) throw err;
                    if (data.affectedRows > 0) {
                        con.query('INSERT INTO clearance_order (clearance_id, user_id) VALUES (?,?)', [clearance_id, user_id || null], (err, result) => {
                            if (err) throw err;
                            // console.log(result.affectedRows);
                        })

                        res.status(200).send({
                            success: true,
                            message: "Move to Clearance order successfully"
                        })
                    }
                    else {
                        res.status(400).send({
                            success: false,
                            message: "Failed to move order"
                        })
                    }
                })
            }
            else {
                res.status(400).send({
                    success: false,
                    message: "Already moved into Clearance order."
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


const getCleranceOrder = async (req, res) => {
    try {
        const { status, origin, destination, startDate, endDate, clearingType } = req.body;

        // Base condition and parameters
        let condition = `WHERE clearance_order.is_deleted='${0}'`; // Ensures base query remains valid
        let params = [];

        if (status) {
            condition += ` AND clearance_order.order_status = ?`;
            params.push(status);
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
            condition += ` AND clearance_order.created_at BETWEEN ? AND ?`;
            params.push(startDate, endDate);
        }

        if (clearingType) {
            condition += ` AND tbl_clearance.freight = ?`;
            params.push(clearingType);
        }
        /*  --LEFT JOIN tbl_orders 
                --ON tbl_orders.id = clearance_order.order_id
           -- LEFT JOIN tbl_freight 
               -- ON tbl_freight.id = tbl_orders.freight_id */

        const query = `
            SELECT 
                clearance_order.*, 
                clearance_order.id AS clearance_id, 
                tbl_clearance.*,
                a.name AS port_of_exit_name, 
                b.name AS port_of_entry_name, 
                tbl_users.full_name AS client_name
            FROM clearance_order
            INNER JOIN tbl_clearance 
                ON tbl_clearance.id = clearance_order.clearance_id
            INNER JOIN countries AS a 
                ON a.id = tbl_clearance.discharge_country
            INNER JOIN countries AS b 
                ON b.id = tbl_clearance.loading_country
            INNER JOIN tbl_users 
                ON tbl_users.id = clearance_order.user_id
            ${condition}
            ORDER BY clearance_order.created_at DESC;
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
                    message: "Clearance Order list not available"
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

const DeleteClearanceOrder = async (req, res) => {
    const { clearance_order_id } = req.body;
    // console.log(req.body);

    if (!clearance_order_id) {
        return res.status(400).send({
            success: false,
            message: "Provide clearance order id"
        });
    }
    try {
        const selectQuery = `SELECT * FROM clearance_order where  id=?`;

        con.query(selectQuery, [clearance_order_id], (err, data) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: err.message
                });
            }
            if (data.length > 0) {
                console.log(data);

                if (data[0].is_deleted === 0) {
                    const query = `update clearance_order set is_deleted=? where id=?`;
                    const params = [1, clearance_order_id]
                    con.query(query, params, (err, data) => {
                        if (err) {
                            return res.status(500).send({
                                success: false,
                                message: err.message
                            });
                        }
                        res.status(200).send({
                            success: false,
                            message: "Clearance order deleted successfully"
                        });
                    })
                }
                else {
                    res.status(400).send({
                        success: false,
                        message: "Clearance order already deleted"
                    });
                }
            } else {
                res.status(400).send({
                    success: false,
                    message: "Data not found"
                });
            }
        })

    }
    catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
}

const CompleteCleranceOrder = async (req, res) => {
    try {
        const { clerance_id } = req.body;
        await con.query(`SELECT * FROM clearance_order Where clearance_id='${clerance_id}'`, (err, data) => {
            if (err) throw err;

            if (data.length > 0) {
                if (data.order_status == "Cleared") {
                    res.status(400).send({
                        success: false,
                        message: "Clerance Order Already Cleared"
                    });
                } else {
                    con.query(`update clearance_order set order_status="Cleared" where clearance_id='${clerance_id}'`, (err, data) => {
                        if (err) throw err;

                    })
                    con.query(`update tbl_clearance set clearing_status="Cleared" where id='${clerance_id}'`, (err, data) => {
                        if (err) throw err;

                    })
                    res.status(200).send({
                        success: true,
                        message: "Clerance Order staus changed successfully"
                    });
                }

            } else {
                res.status(400).send({
                    success: false,
                    message: "Clerance Order list not available"
                });
            }
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
}

const InprocessCleranceOrder = async (req, res) => {
    try {
        const { clerance_id } = req.body;
        await con.query(`SELECT *
            FROM clearance_order Where clearance_id='${clerance_id}'`, (err, data) => {
            if (err) throw err;

            if (data.length > 0) {
                if (data.order_status == "In process") {
                    res.status(400).send({
                        success: false,
                        message: "Clerance Order Already In process"
                    });
                } else {
                    con.query(`update clearance_order set order_status="In process" where clearance_id='${clerance_id}'`, (err, data) => {
                        if (err) throw err;

                    })
                    con.query(`update tbl_clearance set clearing_status="In process" where id='${clerance_id}'`, (err, data) => {
                        if (err) throw err;

                    })
                    res.status(200).send({
                        success: true,
                        message: "Clerance Order staus changed successfully"
                    });
                }

            } else {
                res.status(400).send({
                    success: false,
                    message: "Clerance Order list not available"
                });
            }
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
}


const StillToCleranceOrder = async (req, res) => {
    try {
        const { clerance_id } = req.body;
        await con.query(`SELECT *
            FROM clearance_order Where clearance_id='${clerance_id}'`, (err, data) => {
            if (err) throw err;

            if (data.length > 0) {
                if (data.order_status == "Still to clear") {
                    res.status(400).send({
                        success: false,
                        message: "Clerance Order Already Still to clear"
                    });
                } else {
                    con.query(`update clearance_order set order_status="Still to clear" where clearance_id='${clerance_id}'`, (err, data) => {
                        if (err) throw err;
                    })
                    con.query(`update tbl_clearance set clearing_status="Still to clear" where id='${clerance_id}'`, (err, data) => {
                        if (err) throw err;

                    })
                    res.status(200).send({
                        success: true,
                        message: "Clerance Order staus changed successfully"
                    });
                }

            } else {
                res.status(400).send({
                    success: false,
                    message: "Clerance Order list not available"
                });
            }
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
}

const addWarehouse = async (req, res) => {
    try {
        const {
            warehouse_number,
            warehouse_name,
            warehouse_address,
            town,
            country,
            email,
            contact_person,
            mobile_number
        } = req.body;
        // console.log(req.body);

        // Check if the warehouse_number already exists
        const checkQuery = 'SELECT COUNT(*) AS count FROM warehouse_tbl WHERE warehouse_number = ?';
        await con.query(checkQuery, [warehouse_number], (err, results) => {
            if (err) {
                return res.status(500).json({ success: false, error: err.message });
            }

            if (results[0].count > 0) {
                return res.status(400).json({ success: false, error: 'Warehouse number already exists' });
            }

            // Insert the new warehouse
            const insertQuery = `
                INSERT INTO warehouse_tbl (
                    warehouse_number, warehouse_name, warehouse_address, town, country, email, contact_person, mobile_number
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            con.query(insertQuery, [
                warehouse_number, warehouse_name, warehouse_address, town, country, email, contact_person, mobile_number
            ], (err, results) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                res.status(200).json({ success: true, message: 'Warehouse added successfully', warehouse_id: results.insertId });
            });
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
}

const editWarehouse = async (req, res) => {
    try {
        const {
            warehouse_number,
            warehouse_name,
            warehouse_address,
            town,
            country,
            email,
            contact_person,
            mobile_number,
            warehouse_id
        } = req.body;

        // Check if the new warehouse_number already exists for another warehouse
        const checkQuery = `
            SELECT COUNT(*) AS count 
            FROM warehouse_tbl 
            WHERE warehouse_number = ? 
            AND id <> ?`; // Check if warehouse_number exists for another warehouse

        await con.query(checkQuery, [warehouse_number, warehouse_id], (err, results) => {
            if (err) {
                return res.status(500).json({ success: false, error: err.message });
            }

            if (results[0].count > 0) {
                return res.status(400).json({ success: false, error: 'Warehouse number already exists for another warehouse' });
            }

            // Update the warehouse data
            const updateQuery = `
                UPDATE warehouse_tbl SET 
                    warehouse_number = ?, 
                    warehouse_name = ?, 
                    warehouse_address = ?, 
                    town = ?, 
                    country = ?, 
                    email = ?, 
                    contact_person = ?, 
                    mobile_number = ?
                WHERE id = ?
            `;
            con.query(updateQuery, [
                warehouse_number,
                warehouse_name,
                warehouse_address,
                town,
                country,
                email,
                contact_person,
                mobile_number,
                warehouse_id // Use warehouse_id from params to locate the correct warehouse
            ], (err, results) => {
                if (err) {
                    return res.status(500).json({ success: false, error: err.message });
                }

                if (results.affectedRows === 0) {
                    return res.status(404).json({ success: false, error: 'Warehouse not found' });
                }

                res.status(200).json({ success: true, message: 'Warehouse updated successfully' });
            });
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

const getWarehouse = async (req, res) => {
    try {
        const query = 'SELECT * FROM warehouse_tbl';

        con.query(query, (err, results) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
            }

            res.status(200).json({ success: true, data: results });
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

const DeleteWarehouse = async (req, res) => {
    const { warehouse_id } = req.body;
    try {
        const query = `DELETE FROM warehouse_tbl where id='${warehouse_id}'`;

        con.query(query, (err, results) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
            }

            res.status(200).json({ success: true, message: "Warehouse Deleted successfully" });
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
};


const editWarehouseDetails = async (req, res) => {
    try {
        const { warehouse_assign_id, order_id, freight_id, ware_receipt_no, tracking_number, warehouse_status, warehouse_collect, date_received, package_type, packages, dimension, weight } = req.body;
        // console.log(req.body);

        con.query(`update warehouse_assign_order set ware_receipt_no='${ware_receipt_no}', tracking_number='${tracking_number}', warehouse_status='${warehouse_status}', warehouse_collect='${warehouse_collect}', date_received='${date_received}' where id='${warehouse_assign_id}'`, (err, data) => {
            if (err) throw err;
        })
        con.query(`update tbl_orders set dimensions='${dimension}', weight='${weight}' where id='${order_id}'`, (err, data) => {
            if (err) throw err;

        })
        con.query(`update tbl_freight set no_of_packages='${packages}', package_type='${package_type}' where id='${freight_id}'`, (err, data) => {
            if (err) throw err;

        })
        res.status(200).send({
            success: true,
            message: "Warehouse details update successfully"
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
}

const addWarehouseProduct = async (req, res) => {
    try {
        const {
            user_id,
            added_by,
            warehouse_order_id,
            product_description,
            Hazardous,
            date_received,
            package_type,
            packages,
            dimension,
            weight,
            warehouse_ref,
            freight,
            groupage_batch_ref,
            supplier,
            warehouse_receipt_number,
            tracking_number,
            date_dspatched,
            supplier_address,
            warehouse_collect,
            costs_to_collect,
            port_of_loading,
            warehouse_dispatch,
            warehouse_cost,
            cost_to_dispatch,
            waybill_ref,
            supplier_Email,
            Supplier_Contact
        } = req.body;

        // SQL query with all fields
        const query = `
            INSERT INTO warehouse_products 
            (user_id, added_by, warehouse_order_id, product_description, Hazardous, date_received, package_type, packages, dimension, weight, warehouse_ref, 
            freight, groupage_batch_ref, supplier, warehouse_receipt_number, tracking_number, date_dspatched, supplier_address, warehouse_collect, 
            costs_to_collect, port_of_loading, warehouse_dispatch, warehouse_cost, cost_to_dispatch, waybill_ref, supplier_Email, Supplier_Contact) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const values = [
            user_id,
            added_by,
            warehouse_order_id,
            product_description,
            Hazardous,
            date_received,
            package_type,
            packages,
            dimension,
            weight,
            warehouse_ref,
            freight,
            groupage_batch_ref,
            supplier,
            warehouse_receipt_number,
            tracking_number,
            date_dspatched,
            supplier_address,
            warehouse_collect,
            costs_to_collect,
            port_of_loading,
            warehouse_dispatch,
            warehouse_cost,
            cost_to_dispatch,
            waybill_ref,
            supplier_Email,
            Supplier_Contact
        ];

        // Execute the query
        con.query(query, values, (err, data) => {
            if (err) {
                throw err;
            }

            res.status(200).send({
                success: true,
                message: "Warehouse Product Details Added successfully"
            });
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
}


const GetCountries = async (req, res) => {
    try {
        // SQL query to select all countries
        const selectCountries = `SELECT * FROM countries`;

        // Execute the query
        await con.query(selectCountries, (err, data) => {
            if (err) throw err; // Handle query error

            // If countries exist in the database
            if (data.length > 0) {
                res.status(200).send({
                    success: true,
                    data: data // Return all countries
                });
            }
            // If no countries found
            else {
                res.status(400).send({
                    success: false,
                    message: "No countries found"
                });
            }
        });
    }
    catch (error) {
        // Handle any errors that occur during the process
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
};


const GetCitiesByCountry = async (req, res) => {
    try {
        // Get the country_id from request parameters or query
        const { country_id } = req.query;

        if (!country_id) {
            return res.status(400).send({
                success: false,
                message: "Country ID is required"
            });
        }

        // SQL query to select cities by country_id and order alphabetically by city name
        const selectCitiesByCountry = `
            SELECT c.name, c.id FROM cities c
            JOIN states s ON c.state_id = s.id
            JOIN countries co ON s.country_id = co.id 
            WHERE co.id = ?
            ORDER BY c.name ASC
        `;

        // Execute the query with the country_id
        await con.query(selectCitiesByCountry, [country_id], (err, data) => {
            if (err) throw err;

            // Check if data is found
            if (data.length > 0) {
                res.status(200).send({
                    success: true,
                    data: data  // Return list of cities
                });
            } else {
                // No cities found for the given country_id
                res.status(404).send({
                    success: false,
                    message: "No cities found for this country"
                });
            }
        });
    } catch (error) {
        // Catch any error during query execution
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
};


const RevertOrder = async (req, res) => {
    try {
        const { order_id, freight_id } = req.body;

        if (!order_id || !freight_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide order_id and freight_id"
            });
        }

        // Check if the order exists in tbl_orders
        await con.query(`SELECT * FROM tbl_orders WHERE id='${order_id}' AND freight_id='${freight_id}'`, (err, order_status) => {
            if (err) throw err;

            // If the order exists
            if (order_status.length > 0) {
                // Update tbl_freight to set order_status back to 0
                con.query(`UPDATE tbl_freight SET order_status='${0}' WHERE id='${freight_id}'`, (err, data) => {
                    if (err) throw err;

                    if (data.affectedRows > 0) {
                        // Delete or mark the order in tbl_orders as reverted
                        con.query(`DELETE FROM tbl_orders WHERE id='${order_id}'`, (err, result) => {
                            if (err) throw err;

                            res.status(200).send({
                                success: true,
                                message: "Order reverted back to freight successfully"
                            });
                        });
                    } else {
                        res.status(400).send({
                            success: false,
                            message: "Failed to revert freight data"
                        });
                    }
                });
            } else {
                res.status(400).send({
                    success: false,
                    message: "No matching order found for given order_id and freight_id"
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

const GetFreightImages = async (req, res) => {
    const { freight_id } = req.body;  // Retrieve the freight ID from the request parameters

    try {
        // Validate the freight ID
        if (!freight_id) {
            return res.status(400).send({ success: false, message: 'Freight ID is required' });
        }

        // Query to fetch documents associated with the provided freight ID
        const selectQuery = `SELECT * FROM freight_doc WHERE freight_id = ?`;

        con.query(selectQuery, [freight_id], (err, docs) => {
            if (err) {
                // Handle database errors
                return res.status(500).send({ success: false, message: 'Database error' });
            }

            if (docs.length > 0) {
                // Group documents by `document_name` if needed
                const groupedDocuments = docs.reduce((result, doc) => {
                    if (!result[doc.document_name]) {
                        result[doc.document_name] = [];
                    }
                    result[doc.document_name].push({
                        id: doc.id,
                        document_name: doc.document_name,
                        document: doc.document,
                        created_at: doc.created_at
                    });
                    return result;
                }, {});

                // Send the final response with grouped images
                res.status(200).send({
                    success: true,
                    data: groupedDocuments
                });
            } else {
                res.status(404).send({ success: false, message: 'No images found for the given freight ID' });
            }
        });
    } catch (error) {
        // Handle any unexpected errors
        res.status(500).send({ success: false, message: error.message });
    }
};

const DeleteDocument = async (req, res) => {
    const { doc_id } = req.body;
    try {
        if (!doc_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide doc_id"
            });
        }
        await con.query(`DELETE FROM freight_doc WHERE id='${doc_id}'`, (err, result) => {
            if (err) throw err;

            return res.status(200).send({
                success: true,
                message: "Document Deleted successfully"
            });
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
}

const GetDeliveredOrder = async (req, res) => {
    // WHERE tbl_orders.warehouse_status='${0}'
    try {
        con.query(`SELECT tbl_orders.*, 
    tbl_orders.dimensions AS order_dimensions,
    tbl_orders.created_at as order_created_date,
    f.*, cm.name as commodity_name,
    tbl_orders.weight AS order_weight, 
    tbl_orders.id AS order_id, 
    tbl_users.*, 
    tbl_users.id AS user_id, 
    CASE 
            WHEN tbl_orders.client_id = 0 THEN tbl_orders.client_name 
            ELSE tbl_users.full_name 
        END as client_name,
    tbl_users.email AS client_email,
    o.status AS delivery_status, 
    o.date_dispatched, 
    o.ETA AS delivery_ETA,
    o.actual_delivery_date, 
    o.freight_option AS delivery_freight_option, 
    o.port_of_loading AS delivery_port_of_loading,
    o.port_of_discharge AS delivery_port_of_discharge, 
    o.co_loader, 
    o.carrier,
    o.vessel, 
    o.master_landing_bill, 
    o.house_bill_landing, 
    o.release_type,
    o.container_no, 
    o.seal_no, 
    o.local_handler, 
    o.local_carrier, 
    o.driver_name, 
    o.vehicle_registration,
    o.comments AS delivery_comment, 
    o.last_check_in, 
    o.location_check_in, 
    o.driver_license_id, 
    o.status_updated_at,
    wao.ware_receipt_no, 
    wao.tracking_number, 
    wao.warehouse_collect, 
    wao.date_received,
    w.warehouse_name,
    w.warehouse_address,
    w.town,
    w.country,
    w.email,
    w.contact_person,
    w.mobile_number,
    b.batch_number, 
    b.freight AS batch_freight, 
    b.date_start, 
    b.total_weight, 
    b.total_dimensions, 
    b.dispatched, 
    b.time_in_storage, 
    b.costs_to_collect,
    b.destination, 
    b.waybill, 
    b.agent, 
    b.forwarding_agent,
    c.name AS collection_from_country, 
    co.name AS delivery_to_country,
    u.name AS user_country_name,
    s.id as estimate_id,
   s.origin_pick_up AS estimate_origin_pick_up, 
    s.origin_pickup_gp AS estimate_origin_pickup_gp,
    s.origin_warehouse AS estimate_origin_warehouse, 
    s.origin_warehouse_gp AS estimate_origin_warehouse_gp, 
    s.des_warehouse AS estimate_des_warehouse, 
    s.des_warehouse_gp AS estimate_des_warehouse_gp, 
    s.des_delivery AS estimate_des_delivery, 
    s.des_delivery_gp AS estimate_des_delivery_gp,
    s.freight_amount as estimate_freight_amount,
    s.freight_gp as estimate_freight_gp
FROM tbl_orders
LEFT JOIN tbl_users ON tbl_users.id = tbl_orders.client_id
LEFT JOIN order_delivery_details AS o ON o.order_id = tbl_orders.id
LEFT JOIN tbl_freight AS f ON tbl_orders.freight_id = f.id
LEFT JOIN warehouse_assign_order AS wao ON wao.order_id = tbl_orders.id
LEFT JOIN batches AS b ON b.id = wao.batch_id
LEFT JOIN warehouse_tbl AS w ON w.id = b.warehouse_id
LEFT JOIN countries AS co ON co.id = f.delivery_to
LEFT JOIN countries AS c ON c.id = f.collection_from
LEFT JOIN countries AS u ON u.id = tbl_users.country
LEFT JOIN shipping_estimate  AS s ON s.freight_id = tbl_orders.freight_id
LEFT JOIN tbl_commodity  AS cm ON cm.id = f.commodity
WHERE tbl_orders.track_status= "Delivered"
GROUP BY tbl_orders.id
        ORDER BY tbl_orders.id DESC`, async (err, data) => {
            if (err) {
                // console.error("Error executing query: ", err);
                return;
            }
            // Process the data here
            res.status(200).send({
                success: true,
                data: data
            });

        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
};


const OrderInvoiceList = async (req, res) => {
    try {
        const { search, client_id, page = 1, limit = 10 } = req.query; // Default page=1, limit=10
        const offset = (page - 1) * limit; // Calculate offset for pagination

        let query = `SELECT 
                        tbl_orders.id AS order_ID, 
                        tbl_invoices.id AS invoice_id, 
                        tbl_invoices.*, 
                        CONCAT('OR000', tbl_orders.id) AS order_number, 
                        tbl_users.id AS client_id, 
                        CASE 
                            WHEN tbl_orders.client_id = 0 THEN tbl_orders.client_name 
                            ELSE tbl_users.full_name 
                        END AS client_name
                    FROM tbl_orders
                    LEFT JOIN tbl_users ON tbl_users.id = tbl_orders.client_id
                    LEFT JOIN tbl_invoices ON tbl_invoices.order_id = tbl_orders.id`;

        let queryParams = [];
        let countQuery = `SELECT COUNT(*) AS total FROM tbl_orders`;
        let countParams = [];

        // Add search condition if 'search' query param is provided
        if (search) {
            query += ` WHERE (CONCAT('OR000', tbl_orders.id) LIKE ? 
                            OR tbl_users.full_name LIKE ? 
                            OR tbl_invoices.id LIKE ?
                            OR tbl_invoices.invoice_amt LIKE ?
                            OR tbl_invoices.due_date LIKE ?)`;

            // Add search parameters for multiple columns
            queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (client_id) {
            query += query.includes("WHERE") ? " AND" : " WHERE";
            query += ` tbl_orders.client_id = ?`;
            queryParams.push(client_id);
            countQuery += ` WHERE client_id = ?`;
            countParams.push(client_id);
        }

        // Pagination logic
        query += ` ORDER BY tbl_orders.id DESC LIMIT ? OFFSET ?;`;
        queryParams.push(parseInt(limit), parseInt(offset));

        // Count query
        con.query(countQuery, countParams, (err, countResult) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "Database query error",
                    error: err.message
                });
            }

            const totalRecords = countResult[0].total;
            const totalPages = Math.ceil(totalRecords / limit);

            // Fetch paginated records
            con.query(query, queryParams, (err, data) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: "Database query error",
                        error: err.message
                    });
                }

                res.status(200).json({
                    success: true,
                    data: data,
                    pagination: {
                        totalRecords,
                        totalPages,
                        currentPage: parseInt(page),
                        pageSize: parseInt(limit)
                    }
                });
            });
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "An error occurred while fetching data.",
            error: error.message
        });
    }
};

function checkAndNotifyEstimateOverdue() {
    const query = `
      SELECT tbl_freight.freight_number, tbl_users.full_name
      FROM tbl_freight
      INNER JOIN tbl_users ON tbl_freight.client_id = tbl_users.id
      WHERE tbl_freight.status <> 4
        AND TIMESTAMPDIFF(HOUR, tbl_freight.created_at, NOW()) >= 72
    `;

    con.query(query, function (err, results) {
        if (err) {
            console.error('Database error:', err);
            return;
        }

        if (results.length === 0) {
            console.log('No overdue estimates found.');
            return;
        }
        let estimatesTeamPhoneNumber = `+918340721420`
        results.forEach(freight => {
            const message = `*Quote overdue*\n\nQuote for client "${freight.full_name}"\nfreight: "${freight.freight_number}" has not been issued in the past 72 hours.\nUrgently`;

            sendWhatsApp(estimatesTeamPhoneNumber, message);  // <<== FIXED (use correct variable)
        });
    });
}

// Schedule to run every hour
// cron.schedule('0 * * * *', function () {
//     console.log('Running check for overdue estimates...');
//     checkAndNotifyEstimateOverdue();
// });

function checkAndNotifyOverdueQuotes() {
    const query = `
    SELECT
        f.freight_number,
        c.full_name AS client_name,
        sp.full_name AS sales_person_name,
        sp.email AS sales_person_email,
        sp.cellphone AS sales_person_phone
    FROM tbl_freight f
    INNER JOIN tbl_users c ON f.client_id = c.id
    INNER JOIN tbl_users sp ON f.sales_representative = sp.id
    WHERE
        f.status = 4
        AND f.order_status = 0
        AND DATEDIFF(NOW(), f.estimate_date) >= 10
`;


    con.query(query, function (err, results) {
        if (err) {
            console.error('Database error:', err);
            return;
        }

        if (results.length === 0) {
            console.log('No overdue quotes found.');
            return;
        }

        results.forEach(record => {
            const subject = "Overdue Quote";
            const emailMessage = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; background-color: #f9f9f9;">
  <h2 style="color: #2c3e50; border-bottom: 1px solid #ccc; padding-bottom: 10px;">Overdue Quote Notification</h2>
  
  <p style="font-size: 16px; color: #333;">
    Hi <strong>${record.sales_person_name}</strong>,
  </p>
  
  <p style="font-size: 16px; color: #333;">
    A quote has been issued and its status has not been updated within the required timeframe.<br>
    Please follow up with the client as soon as possible.
  </p>
  
  <p style="font-size: 16px; color: #333;">
    <strong>Freight Number:</strong> ${record.freight_number}<br>
    <strong>Client Name:</strong> ${record.client_name}
  </p>
  
  <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
  
  <p style="font-size: 14px; color: #777;">
    Regards,<br>
    <strong>Management System</strong>
  </p>
</div>
`;

            let salesEmail = `mobappssolutions174@gmail.com` || record.sales_person_email
            let sales_person_phone = `+918340721420` || record.sales_person_phone
            const whatsappMessage = `Hi ${record.sales_person_name},\nQuote has been issued and status not updated.\nPlease follow up with client.\n\nFreight Number: ${record.freight_number}\nClient Name: ${record.client_name}`;

            sendMail(salesEmail, subject, emailMessage);
            // sendWhatsApp(sales_person_phone, whatsappMessage);
        });
    });
}

// run every day at 9 AM
// cron.schedule('0 9 * * *', () => {
//     console.log('Checking overdue quotes...');
//     checkAndNotifyOverdueQuotes();
// });


module.exports = {
    AdminLogin, ChangePassword, PrivacyPolicy, GetPrivacy, TermCondition, GetTerms, Addfreight,
    GetFreightAdmin, EditFreight, GetFreightById, DeleteFreight, AddCountryOrigin, getCountryOriginList,
    updateCountryOrigin, GetCountryById, DeleteCountry, clientListAddFreight, CountryListAddFreight,
    Shipping_Estimate, updateShippingEstimate, ShipEstimateList, GetShipEstimateById, DeleteShipEstimate,
    updateProfile, forgotPassword, ResetPassword, SendNotification, GetNotification, deleteNotification,
    ChangeStatusFreight, GetFreightCustomer, GetShipEstimateDetails, order_Details, OrderDetailsById,
    sendMessage, getMessagesList, getAllMessages, UpdateChatOnBack, UpdateChatOnEnter, countAll, countGraph,
    countofFreight, GetSupplerSelected, assignEstimatetoClient, UpdateOrderStatus, GetOrderStatus,
    StageOfShipment, socialMediaLinks, GetAllsocialLinks, getProfileAdmin, add_freight_to_warehouse, restore_order_from_warehouse,
    client_Shipping_Estimate, GetWarehouseOrders, DeleteWarehouseOrder, createBatch, getAllBatch, deleteBatch, UpdateOrderStatusesFromBatch, moveFreightToBatch, restoreOrderFromBatch,
    getFreightsByBatch, MoveToOrder, MoveToClearaneOrder, getCleranceOrder, CompleteCleranceOrder, DeleteClearanceOrder,
    InprocessCleranceOrder, StillToCleranceOrder, addWarehouse, editWarehouse, getWarehouse, DeleteWarehouse, editWarehouseDetails, GetCountries,
    GetCitiesByCountry, RevertOrder, addWarehouseProduct, getWarehouseOrderProduct, updateWarehouseProduct, updateClientWarehouseProduct, DeleteWarehouseProduct, GetFreightImages,
    DeleteDocument, GetDeliveredOrder, OrderInvoiceList

}
