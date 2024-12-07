const con = require('../config/database');
const { validationResult, Result } = require('express-validator');
const bcrypt = require('bcryptjs');
const sendMail = require('../helpers/sendMail')
const rendomString = require('randomstring');
const { assign } = require('nodemailer/lib/shared');

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

// const Addfreight = async (req, res) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//         return res.status(400).json({
//             success: false,
//             errors: errors.array()
//         });
//     }
//     try {
//         // tbl_freight
//         const { client_ref, product_desc, date, type, freight, incoterm, dimension, weight, quote_received, client_quoted,
//             status, comment, no_of_packages, package_type, commodity, hazardous, industry, country_of_origin,
//             supplier_address, port_of_loading, post_of_discharge, place_of_delivery, ready_for_collection, assigned,
//             loading_frequency, transit_time, priority } = req.body;

//         // console.log(assigned);
//         let numbersArray;
//         if (assigned !== undefined && assigned !== '') {
//             numbersArray = assigned.split(',').map(Number);
//         }


//         // console.log(numbersArray);
//         if (req.file == undefined) {
//             const insertQuery = `insert into tbl_freight (client_ref, product_desc, date, type, freight, incoterm, dimension, weight, quote_received, client_quoted,
//                  status, comment, no_of_packages, package_type, commodity, hazardous, industry, collection_from, 
//                     supplier_address, port_of_loading, post_of_discharge, place_of_delivery, ready_for_collection, assign_id, 
//                     loading_frequency, transit_time, priority, added_by) values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
//             await con.query(insertQuery, [client_ref, product_desc, date, type, freight, incoterm, dimension, weight, quote_received, client_quoted, status, comment, no_of_packages, package_type, commodity, hazardous, industry, country_of_origin,
//                 supplier_address, port_of_loading, post_of_discharge, place_of_delivery, ready_for_collection, assigned,
//                 loading_frequency, transit_time, priority, 1], (err, data) => {
//                     if (err) throw err;
//                     if (data.affectedRows > 0) {
//                         if (numbersArray !== undefined) {
//                             numbersArray.forEach((id) => {
//                                 const inserdata = `insert into freight_assign (supplier_id, freight_id) values (?,?)`;
//                                 con.query(inserdata, [id, data.insertId], (err, result) => {
//                                     if (err) throw err;
//                                 })
//                             })
//                         }

//                         res.status(200).send({ success: true, message: "Insert freight successfully" })
//                     }
//                     else {
//                         res.status(400).send({ success: false, message: "Failed to insert Freight" })
//                     }
//                 })
//         }
//         else {
//             const insertQuery = `insert into tbl_freight (client_ref, product_desc, date, type, freight, incoterm, dimension, weight, quote_received, client_quoted, 
//                     quote_document, status, comment, no_of_packages, package_type, commodity, hazardous, industry, collection_from, 
//                     supplier_address, port_of_loading, post_of_discharge, place_of_delivery, ready_for_collection, 	assign_id, 
//                     loading_frequency, transit_time, priority, added_by) values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
//             await con.query(insertQuery, [client_ref, product_desc, date, type, freight, incoterm, dimension, weight, quote_received, client_quoted,
//                 req.file.filename, status, comment, no_of_packages, package_type, commodity, hazardous, industry, country_of_origin,
//                 supplier_address, port_of_loading, post_of_discharge, place_of_delivery, ready_for_collection, assigned,
//                 loading_frequency, transit_time, priority, 1], (err, data) => {
//                     if (err) throw err;
//                     if (data.affectedRows > 0) {
//                         if (numbersArray !== undefined) {
//                             numbersArray.forEach((id) => {
//                                 const inserdata = `insert into freight_assign (supplier_id, freight_id) values (?,?)`;
//                                 con.query(inserdata, [id, data.insertId], (err, result) => {
//                                     if (err) throw err;

//                                 })
//                             })
//                         }
//                         res.status(200).send({ success: true, message: "Insert freight successfully" })
//                     }
//                     else {
//                         res.status(400).send({
//                             success: false,
//                             message: "Failed to insert Freight"
//                         })
//                     }
//                 })
//         }
//     }
//     catch (error) {
//         res.status(500).send({
//             success: false,
//             message: error.message
//         })
//     }
// }

const GetFreightAdmin = async (req, res) => {
    const { status, priority } = req.body;
    // console.log(req.body);

    try {
        let condition = 'WHERE tbl_freight.is_deleted = ? AND tbl_freight.added_by = ? AND tbl_freight.order_status=?';
        let params = [0, 1, 0];

        if (status) {
            condition += ' AND tbl_freight.status = ?';
            params.push(status);
        }

        if (priority) {
            condition += ' AND tbl_freight.priority = ?';
            params.push(priority);
        }

        const selectQuery = `
            SELECT
            tbl_freight.id as freight_id,  tbl_freight.fcl_lcl, tbl_users.*, tbl_users.id as user_id, tbl_users.full_name as client_name, tbl_users.email as client_email, tbl_freight.product_desc,
                tbl_freight.client_ref, tbl_freight.date, tbl_freight.type, tbl_freight.freight, tbl_freight.incoterm, tbl_freight.dimension, tbl_freight.weight,
                tbl_freight.quote_received, tbl_freight.client_quoted, tbl_freight.status, tbl_freight.comment, tbl_freight.no_of_packages, tbl_freight.package_type,
                tbl_freight.commodity, tbl_freight.shipper_name, tbl_freight.hazardous, tbl_freight.collection_from, tbl_freight.delivery_to, tbl_freight.supplier_address, tbl_freight.shipment_origin, tbl_freight.shipment_des,
                tbl_freight.port_of_loading, tbl_freight.post_of_discharge, tbl_freight.place_of_delivery, tbl_freight.ready_for_collection,
                tbl_freight.transit_time, tbl_freight.priority, tbl_freight.added_by, tbl_freight.freight_number, tbl_freight.shipment_details,
                tbl_freight.nature_of_hazard, tbl_freight.volumetric_weight, tbl_freight.assign_for_estimate, tbl_freight.assign_to_transporter,
                tbl_freight.is_active, tbl_freight.add_attachments, tbl_freight.add_attachment_file, tbl_freight.assign_warehouse, tbl_freight.order_status, tbl_freight.assign_to_clearing, tbl_freight.send_to_warehouse, tbl_freight.client_ref_name, tbl_freight.shipment_ref, tbl_freight.insurance, c.name as delivery_to_name, co.name as collection_from_name, 
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
            LEFT JOIN tbl_users ON tbl_users.id = tbl_freight.client_ref
            LEFT JOIN countries AS c ON c.id = tbl_freight.delivery_to
            LEFT JOIN countries AS co ON co.id = tbl_freight.collection_from
            LEFT JOIN shipping_estimate  AS s ON s.freight_id = tbl_freight.id
            ${condition}
            GROUP BY tbl_freight.id
            ORDER BY tbl_freight.created_at DESC`;

        await con.query(selectQuery, params, (err, data) => {
            if (err) {
                // console.error('Query error:', err);
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
        // console.error('Catch error:', error);
        res.status(500).send({ success: false, message: error.message });
    }
};



const Addfreight = (req, res) => {
    try {
        // Extracting data from req.body
        const {
            client_ref, date, type, fcl_lcl, freight, incoterm, dimension, weight, quote_received, client_quoted, shipment_ref, insurance,
            is_active, comment, no_of_packages, package_type, commodity, hazardous, industry, country_of_origin, destination_country,
            supplier_address, shipper_name, port_of_loading, post_of_discharge, place_of_delivery, ready_for_collection, Product_Description,
            transit_time, priority, shipment_details, nature_of_hazard, volumetric_weight, assign_for_estimate, assign_to_transporter, assign_warehouse, assign_to_clearing, send_to_warehouse, shipment_origin, shipment_des, client_ref_name, add_attachments
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

            // Insert into the database
            let insertQuery;
            let insertParams;

            insertQuery = `INSERT INTO tbl_freight (client_ref, date, type, fcl_lcl, freight, incoterm, dimension, weight, 
            quote_received, client_quoted, is_active, comment, no_of_packages, package_type, commodity, hazardous, 
             collection_from, delivery_to, supplier_address, shipper_name, port_of_loading, post_of_discharge, place_of_delivery, 
            ready_for_collection, transit_time, priority, added_by, freight_number, shipment_details, 
            nature_of_hazard, volumetric_weight, assign_for_estimate, assign_to_transporter, assign_warehouse, assign_to_clearing, 
            send_to_warehouse, shipment_origin, shipment_des, product_desc, shipment_ref, insurance, client_ref_name) 
            VALUES ( ?, ?, ?, ?, ?, ?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?,?,?,?,?,?,?)`;
            insertParams = [
                client_ref, date, type, fcl_lcl || null, freight, incoterm, dimension, weight, quote_received, client_quoted,
                is_active, comment, no_of_packages, package_type, commodity, hazardous, country_of_origin, destination_country,
                supplier_address, shipper_name, port_of_loading, post_of_discharge, place_of_delivery, ready_for_collection,
                transit_time, priority, 1, freightNumber, shipment_details, nature_of_hazard, volumetric_weight, assign_for_estimate,
                assign_to_transporter, assign_warehouse, assign_to_clearing, send_to_warehouse, shipment_origin, shipment_des, Product_Description, shipment_ref, insurance, client_ref_name
            ];

            con.query(insertQuery, insertParams, (err, insertResult) => {
                if (err) {
                    // console.error('Error inserting freight data:', err);
                    return res.status(500).json({
                        success: false,
                        message: "Internal Server Error"
                    });
                }
                if (req.file && req.file.filename) {
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
                }
                return res.status(200).json({
                    success: true,
                    message: "Insert freight successfully"
                });
            });

        });

    } catch (error) {
        // console.error('Error in Addfreight function:', error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
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
    const { status } = req.body;
    // console.log(req.body);

    try {
        let condition = 'WHERE tbl_freight.is_deleted = ? AND tbl_freight.added_by = ?';
        let params = [0, 2];

        if (status !== undefined && status !== null) {
            condition += ' AND tbl_freight.status = ?';
            params.push(status);
        }

        const selectQuery = `
            SELECT tbl_freight.id AS freight_id, 
                   tbl_freight.freight_number,
                   tbl_freight.insurance,
                   tbl_freight.fcl_lcl,
                   tbl_freight.assign_to_clearing, 
                   tbl_freight.assign_warehouse, 
                   tbl_freight.client_ref as client_id, 
                   tbl_freight.product_desc, 
                   tbl_freight.collection_from, 
                   tbl_freight.commodity, 
                   tbl_freight.freight, 
                   tbl_freight.freight_type, 
                   tbl_freight.shipment_origin, 
                   tbl_freight.shipment_des, 
                   tbl_freight.shipment_ref, 
                   tbl_freight.dimension, 
                   tbl_freight.weight, 
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
                   tbl_freight.created_at, 
                   tbl_freight.updated_at,
                   tbl_users.full_name AS client_name,
                   tbl_users.id AS user_id,  -- Aliased to user_id
                   tbl_users.email AS client_email, 
                   c.name AS collection_from_country, 
                   co.name AS delivery_to_country,
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
            INNER JOIN tbl_users ON tbl_users.id = tbl_freight.client_ref
            LEFT JOIN countries AS c ON c.id = tbl_freight.collection_from
            LEFT JOIN countries AS co ON co.id = tbl_freight.delivery_to
            LEFT JOIN shipping_estimate  AS s ON s.freight_id = tbl_freight.id
            ${condition}
            GROUP BY tbl_freight.id
            ORDER BY tbl_freight.created_at DESC`;

        await con.query(selectQuery, params, (err, data) => {
            if (err) {
                // console.error(err);
                res.status(500).send({
                    success: false,
                    message: "Database query error"
                });
                return;
            }

            // console.log(data);

            if (data.length > 0) {
                res.status(200).send({ success: true, data: data });
            } else {
                res.status(400).send({ success: false, message: "No List Available" });
            }
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
};


const EditFreight = async (req, res) => {
    try {
        // Extracting data from req.body
        // console.log(req.body);
        const {
            id, // Assuming you will pass the ID of the freight to be updated
            client_ref, date, type, freight, fcl_lcl, incoterm, dimension, weight, quote_received, client_quoted, shipment_ref, insurance,
            is_active, comment, no_of_packages, package_type, commodity, hazardous, country_of_origin, destination_country,
            supplier_address, port_of_loading, post_of_discharge, place_of_delivery, ready_for_collection,
            transit_time, priority, shipment_details, nature_of_hazard, volumetric_weight, assign_for_estimate,
            assign_to_transporter, assign_warehouse, assign_to_clearing, send_to_warehouse, shipment_origin, shipment_des, client_ref_name, product_desc, add_attachments
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
                client_ref = ?, date = ?, type = ?, freight = ?, fcl_lcl=?, shipment_ref=?, insurance=?, incoterm = ?, dimension = ?, weight = ?, 
                quote_received = ?, product_desc=?, client_quoted = ?, is_active = ?, comment = ?, no_of_packages = ?, package_type = ?, 
                commodity = ?, hazardous = ?, collection_from = ?, delivery_to = ?, supplier_address = ?, 
                port_of_loading = ?, post_of_discharge = ?, place_of_delivery = ?, ready_for_collection = ?, 
                transit_time = ?, priority = ?, shipment_details = ?, nature_of_hazard = ?, volumetric_weight = ?, 
                assign_for_estimate = ?, assign_to_transporter = ?, assign_warehouse = ?, assign_to_clearing = ?, 
                send_to_warehouse = ?, shipment_origin = ?, shipment_des = ?, client_ref_name=?
            WHERE id = ?
        `;

        const updateParams = [
            client_ref, date, type, freight, fcl_lcl || null, shipment_ref, insurance, incoterm, dimension, weight, quote_received, product_desc, client_quoted, is_active, comment,
            no_of_packages, package_type, commodity, hazardous, country_of_origin, destination_country, supplier_address,
            port_of_loading, post_of_discharge, place_of_delivery, ready_for_collection, transit_time, priority, shipment_details,
            nature_of_hazard, volumetric_weight, assign_for_estimate, assign_to_transporter, assign_warehouse,
            assign_to_clearing, send_to_warehouse, shipment_origin, shipment_des, client_ref_name, id
        ];

        const result = await con.query(updateQuery, updateParams);

        // Check if result is as expected
        if (Array.isArray(result) && result[0].affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Freight not found"
            });
        }

        if (req.file && req.file.filename) {
            const docsInsertQuery = `update tbl_freight set add_attachments='${add_attachments}', add_attachment_file='${req.file.filename}' where id='${id}'`;
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
            const selectQuery = `select * from tbl_freight where id=?`;
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
        const selectQuery = `select id, full_name as client_name, client_ref from tbl_users 
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
            des_doc_final_amt, des_ware_final_amt, des_portfees_final_amt, des_unpack_final_amt, des_other_final_amt
        } = req.body;

        const Supplier_Quote_Attachment = req.file ? req.file.filename : null;

        // console.log(req.body);

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
            des_doc_final_amt=?, des_ware_final_amt=?, des_portfees_final_amt=?, des_unpack_final_amt=?, des_other_final_amt=? WHERE id=?`;

                const updateParams = [
                    client_id, supplier_id, serial_number, date, client_ref, freight, incoterm, dimension, weight, freight_agent, freight_amount, freight_gp,
                    freight_currency, origin_pick_up, origin_pickup_gp, origin_customs, origin_customs_gp, origin_document, origin_document_gp,
                    origin_warehouse, origin_warehouse_gp, origin_port_fees, origin_port_fees_gp, origin_other, origin_other_gp, origin_currency,
                    des_delivery, des_delivery_gp, des_customs, des_customs_gp, des_document, des_document_gp, des_warehouse, des_warehouse_gp,
                    des_port_fees, des_port_fees_gp, des_unpack, des_unpack_gp, des_other, des_other_gp, des_currency, freigh_amount, origin_amount,
                    des_amount, sub_amount, exchange_rate, total_amount, Supplier_Quote_Attachment, Supplier_Quote_Amount, final_base_currency, freight_final_amount, origin_pick_final_amt, origin_cust_final_amt,
                    origin_doc_final_amt, origin_ware_final_amt, org_port_fee_final_amt, org_other_final_amt, des_delivery_final_amt, des_cust_final_amt,
                    des_doc_final_amt, des_ware_final_amt, des_portfees_final_amt, des_unpack_final_amt, des_other_final_amt, result[0].id
                ];



                con.query(updateQuery, updateParams, (err, updateData) => {
                    if (err) throw err;
                    if (updateData.affectedRows > 0) {

                        const updateQuery = `UPDATE tbl_freight SET status=? WHERE id=?`;

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
            des_doc_final_amt, des_ware_final_amt, des_portfees_final_amt, des_unpack_final_amt, des_other_final_amt) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;

                const insertParams = [
                    freight_id, client_id, supplier_id, serial_number, date, client_ref, freight, incoterm, dimension, weight, freight_agent, freight_amount,
                    freight_gp, freight_currency, origin_pick_up, origin_pickup_gp, origin_customs, origin_customs_gp, origin_document, origin_document_gp,
                    origin_warehouse, origin_warehouse_gp, origin_port_fees, origin_port_fees_gp, origin_other, origin_other_gp, origin_currency, des_delivery,
                    des_delivery_gp, des_customs, des_customs_gp, des_document, des_document_gp, des_warehouse, des_warehouse_gp, des_port_fees, des_port_fees_gp,
                    des_unpack, des_unpack_gp, des_other, des_other_gp, des_currency, origin_amount, des_amount, sub_amount, exchange_rate, total_amount,
                    Supplier_Quote_Attachment, Supplier_Quote_Amount, final_base_currency, freight_final_amount, origin_pick_final_amt, origin_cust_final_amt,
                    origin_doc_final_amt, origin_ware_final_amt, org_port_fee_final_amt, org_other_final_amt, des_delivery_final_amt, des_cust_final_amt,
                    des_doc_final_amt, des_ware_final_amt, des_portfees_final_amt, des_unpack_final_amt, des_other_final_amt
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
        const selectQuery = `select shipping_estimate.*, shipping_estimate.final_currency, tbl_users.full_name as clientName, tbl_freight.freight_number, tbl_freight.product_desc, tbl_freight.created_at, c.name AS collection_from_name, 
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
            const selectQuery = `select * from shipping_estimate where id=? OR freight_id=?`;
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

                            con.query(insertNotificationDetailQuery, [data[0].client_ref, notificationData.insertId], (err) => {
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
    // WHERE tbl_orders.warehouse_status='${0}'
    try {
        con.query(`SELECT tbl_orders.*, 
    tbl_orders.dimensions AS order_dimensions,
    tbl_orders.created_at as order_created_date,
    f.*, 
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
                f.created_at IS NOT NULL
            GROUP BY
                DATE_FORMAT(f.created_at, '%m')
        ) AS data
    ON
        months.month = data.month;`

        await con.query(selectQuery, (err, data) => {
            if (err) throw err;
            if (data.length > 0) {
                res.status(200).send({
                    success: true,
                    data: data
                })
            } else {
                res.status(400).send({
                    success: false,
                    message: "Data not found"
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

// const UpdateOrderStatus = async (req, res) => {
//     try {
//         const { order_id, status, description } = req.body;

//         if (!order_id) {
//             return res.status(400).send({
//                 success: false,
//                 message: "Please provide order id"
//             });
//         }

//         if (!status) {
//             return res.status(400).send({
//                 success: false,
//                 message: "Please provide status"
//             });
//         }

//         // Check if the current status is valid for the given order_id
//         await con.query(`SELECT * FROM order_track WHERE order_id = ? ORDER BY created_at DESC LIMIT 1`, [order_id], (err, data) => {
//             if (err) throw err;

//             if (data.length > 0) {
//                 const lastStatus = data[0].status;

//                 if (lastStatus === status) {
//                     return res.status(400).send({
//                         success: false,
//                         message: `The order already has the status: ${status}`
//                     });
//                 }
//             }

//             // Insert the new status
//             const datetime = new Date().toISOString().slice(0, 19).replace('T', ' ');
//             con.query(`INSERT INTO order_track (order_id, status, description, created_at) VALUES (?, ?, ?, ?)`, [order_id, status, description, datetime], (err, result) => {
//                 if (err) throw err;

//                 if (result.affectedRows > 0) {
//                     const select = `SELECT client_id FROM tbl_orders WHERE id = ?`;
//                     con.query(select, [order_id], (err, client_id) => {
//                         if (err) throw err;

//                         const InsertQuery = `INSERT INTO tbl_notifications (title, description, send_to) VALUES (?, ?, ?)`;
//                         con.query(InsertQuery, ["Order Update", `Your Order Has Been ${status}`, 4], (err, data) => {
//                             if (err) throw err;

//                             const insertNotificationSql = 'INSERT INTO notification_details (user_id, notification_id) VALUES (?, ?)';
//                             con.query(insertNotificationSql, [client_id[0].client_id, data.insertId], (err, result) => {
//                                 if (err) throw err;
//                             });

//                             const updateStatus = 'Update tbl_orders set track_status=? where id=?';
//                             con.query(updateStatus, [status, order_id], (err, result) => {
//                                 if (err) throw err;
//                             });
//                         });
//                     });

//                     return res.status(200).send({
//                         success: true,
//                         message: "Update Order status successfully"
//                     });
//                 } else {
//                     return res.status(400).send({
//                         success: false,
//                         message: "Failed to update Order status"
//                     });
//                 }
//             });
//         });

//     } catch (error) {
//         return res.status(500).send({
//             success: false,
//             message: error.message
//         });
//     }
// };



const UpdateOrderStatus = async (req, res) => {
    try {
        const { order_id, status, description } = req.body;

        if (!order_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide order_id"
            });
        }

        if (!status) {
            return res.status(400).send({
                success: false,
                message: "Please provide status"
            });
        }
        // Fetch order data
        await con.query(`SELECT * FROM tbl_orders WHERE id='${order_id}'`, (err, orderData) => {
            if (err) throw err;
            // OR000
            if (orderData.length > 0) {
                // Check if the status already exists for this order_id
                con.query('SELECT COUNT(*) AS count FROM order_track WHERE order_id = ? AND status = ?', [order_id, status], (err, results) => {
                    if (err) throw err;

                    if (results[0].count > 0) {
                        // If the status already exists, return an error
                        return res.status(400).send({
                            success: false,
                            message: `Status ${status} already exists for this order.`
                        });
                    }

                    // Check the predefined statuses
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
                        'Imported at Asia Direct warehouse',
                        'Out for delivery',
                        'Delivered'
                    ];

                    const index = statuses.indexOf(status);
                    if (index === -1) {
                        return res.status(400).send({
                            success: false,
                            message: "Invalid status."
                        });
                    }

                    // Check if all previous statuses are inserted
                    const previousStatuses = statuses.slice(0, index);
                    const checkPreviousStatuses = previousStatuses.map((s) => {
                        return new Promise((resolve, reject) => {
                            con.query('SELECT COUNT(*) AS count FROM order_track WHERE status = ? AND order_id = ?', [s, order_id], (err, results) => {
                                if (err) {
                                    return reject(err);
                                }
                                resolve({ status: s, exists: results[0].count > 0 });
                            });
                        });
                    });

                    Promise.all(checkPreviousStatuses).then((results) => {
                        const missingStatuses = results.filter(result => !result.exists).map(result => result.status);

                        if (missingStatuses.length === 0) {
                            // Insert the new status
                            const datetime = new Date().toISOString().slice(0, 19).replace('T', ' ');
                            con.query('INSERT INTO order_track (order_id, status, description, created_at) VALUES (?, ?, ?, ?)', [order_id, status, description, datetime], (err, result) => {
                                if (err) throw err;

                                if (result.affectedRows > 0) {
                                    const select = `SELECT client_id FROM tbl_orders WHERE id = ?`;
                                    con.query(select, [order_id], (err, client_id) => {
                                        if (err) throw err;

                                        const InsertQuery = `INSERT INTO tbl_notifications (title, description, send_to) VALUES (?, ?, ?)`;
                                        con.query(InsertQuery, ["Order Status Update", `Order #OR000${order_id} has been ${status}. For more details, please track your order.`, 4], (err, data) => {
                                            if (err) throw err;

                                            const insertNotificationSql = 'INSERT INTO notification_details (user_id, notification_id) VALUES (?, ?)';
                                            con.query(insertNotificationSql, [client_id[0].client_id, data.insertId], (err, result) => {
                                                if (err) throw err;
                                            });

                                            const updateStatus = 'UPDATE tbl_orders SET track_status=? WHERE id=?';
                                            con.query(updateStatus, [status, order_id], (err, result) => {
                                                if (err) throw err;
                                            });
                                        });
                                    });

                                    return res.status(200).send({
                                        success: true,
                                        message: "Order status updated successfully."
                                    });
                                } else {
                                    return res.status(400).send({
                                        success: false,
                                        message: "Failed to update order status."
                                    });
                                }
                            });
                        } else {
                            // Return the missing statuses
                            return res.status(400).send({
                                success: false,
                                message: 'Please insert the following statuses before adding this one: ' + missingStatuses.join(', ')
                            });
                        }
                    }).catch(err => {
                        // console.error('Error checking previous statuses:', err);
                        res.status(500).send({ success: false, message: 'Error checking statuses.' });
                    });

                });
            } else {
                res.status(400).send({
                    success: false,
                    message: "Order id doesn't exist"
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


const GetOrderStatus = async (req, res) => {
    try {

        const { order_id } = req.body;

        if (!order_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide order_id"
            });
        }

        let numericOrderId;
        if (order_id.startsWith("OR000")) {
            numericOrderId = order_id.slice(5);
        } else {
            numericOrderId = order_id;
        }

        await con.query(`SELECT * FROM tbl_orders WHERE id='${numericOrderId}'`, (err, orderData) => {
            if (err) throw err;

            if (orderData.length > 0) {
                con.query(
                    `SELECT DISTINCT status FROM order_track`, // Fetch unique statuses
                    (err, statuses) => {
                        if (err) throw err;

                        if (statuses.length > 0) {
                            const statusList = statuses.map(row => row.status);
                            const statusUnion = statusList.map(status => `SELECT '${status}' AS status`).join(' UNION ');

                            con.query(
                                `SELECT statuses.status, created_at, description,
                                IFNULL(order_statuses.is_completed, '0') AS is_completed
                                FROM (
                                    ${statusUnion}
                                ) statuses
                                LEFT JOIN (
                                    SELECT status, created_at, description, '1' AS is_completed
                                    FROM order_track
                                    WHERE order_id='${numericOrderId}'
                                ) order_statuses
                                ON LOWER(statuses.status) = LOWER(order_statuses.status)`,
                                (err, statusData) => {
                                    if (err) throw err;

                                    res.status(200).send({
                                        success: true,
                                        data: statusData
                                    });
                                }
                            );
                        } else {
                            res.status(200).send({
                                success: true,
                                data: []
                            });
                        }
                    }
                );
            } else {
                res.status(400).send({
                    success: false,
                    message: "Order id doesn't exist"
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

                // Insert updated data into warehouse_tbl
                con.query(`INSERT INTO warehouse_assign_order (freight_id, order_id, warehouse_status) VALUES ('${freight_id} || 0', '${order_id}', 1)`, (err, insertResult) => {
                    if (err) throw err;

                    return res.status(200).send({
                        success: true,
                        message: 'Order added to warehouse successfully'
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
        // SELECT warehouse_assign_order.*, tbl_freight.*, tbl_orders.*, batches.*, warehouse_tbl.* 
        // AND warehouse_assign_order.assign_to_batch='0'
        con.query(`
     SELECT 
        warehouse_assign_order.*, 
        warehouse_assign_order.id as warehouse_assign_order_id, 
        tbl_freight.*, tbl_freight.id as freight_ID,
        tbl_orders.*, 
        batches.*, 
        warehouse_tbl.*,
        shipping_estimate.id as estimated_id,
        c.name as delivery_to_name, 
        co.name as collection_from_name,
        -- Use CASE to check if client_id is 0, then display client_name from tbl_orders, else fetch full_name from tbl_users
        CASE 
            WHEN tbl_orders.client_id = 0 THEN tbl_orders.client_name 
            ELSE tbl_users.full_name 
        END as client_name 
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
    WHERE warehouse_assign_order.warehouse_status = '1'
        AND tbl_freight.is_deleted='0'
    ORDER BY warehouse_assign_order.created_at DESC`, (err, data) => {
            if (err) throw err;

            if (data.length === 0) {
                return res.status(400).send({
                    success: false,
                    message: 'Freight not found'
                });
            }
            else {
                return res.status(200).send({
                    success: true,
                    data: data
                });
            }
        })
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: error.message
        });
    }
}

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
                        warehouse_products.id, 
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



const createBatch = async (req, res) => {
    try {
        const {
            batch_number,
            warehouse_id,
            freight,
            date_start,
            total_weight,
            total_dimensions,
            dispatched,
            date_dispatch,
            time_in_storage,
            costs_to_collect,
            warehouse_cost,
            costs_to_dispatch,
            destination,
            waybill,
            agent,
            forwarding_agent,
            batch_name, freight_cost, costs_to_collect_des, costs_to_dispatch_des, warehouse_cost_des
        } = req.body;
        // console.log(req.body);

        // Check if batch_number or batch_name already exists
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

            // Insert the new batch
            const insertQuery = `
                INSERT INTO batches (
                    batch_number, warehouse_id, freight, date_start, 
                    total_weight, total_dimensions, dispatched, date_dispatch, 
                    time_in_storage, costs_to_collect, warehouse_cost, costs_to_dispatch, 
                    destination, waybill, agent, forwarding_agent, is_deleted, batch_name, freight_cost, costs_to_collect_des, costs_to_dispatch_des, warehouse_cost_des
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
            `;
            con.query(insertQuery, [
                batch_number, warehouse_id, freight, date_start,
                total_weight, total_dimensions, dispatched, date_dispatch,
                time_in_storage, costs_to_collect, warehouse_cost, costs_to_dispatch,
                destination, waybill, agent, forwarding_agent, batch_name, freight_cost, costs_to_collect_des, costs_to_dispatch_des, warehouse_cost_des
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
        // const { id } = req.params;

        const getQuery = 'SELECT * FROM batches WHERE is_deleted = ?';
        con.query(getQuery, [0], (err, result) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: err.message
                });
            }

            if (result.length === 0) {
                return res.status(404).send({
                    success: false,
                    message: 'Batch not found'
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


const moveFreightToBatch = async (req, res) => {
    try {
        const { freight_id, batch_id, warehouse_id } = req.body;

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
                        message: 'Order already assigned to batch'
                    });
                }

                // Assign the freight to the batch
                const assignQuery = 'INSERT INTO freight_assig_to_batch (freight_id, batch_id) VALUES (?, ?)';
                con.query(assignQuery, [freight_id, batch_id], (err, result) => {
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
                        const updateWarehouse = 'Update warehouse_assign_order set batch_id=?, warehouse_id=?, assign_to_batch=? where freight_id=?';
                        con.query(updateWarehouse, [batch_id, warehouse_id, 1, freight_id], (err, result) => {
                            if (err) throw err;
                        })
                        return res.status(200).send({
                            success: true,
                            message: 'Order moved to batch successfully'
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
        const { batch_id } = req.body;
        const getFreightsQuery = `
    SELECT 
        fa.*, 
        fa.id as freight_assig_to_batch_id, 
        f.*, 
        f.id as freight_ID, 
        b.*, 
        b.freight as batch_freight, 
        b.total_weight as batch_total_weight, 
        b.agent as batch_agent, 
        b.forwarding_agent as batch_forwarding_agent, 
        b.total_dimensions as batch_total_dimensions, 
        b.date_dispatch as batch_date_dispatch, 
        b.time_in_storage as batch_time_in_storage, 
        b.costs_to_collect as batch_costs_to_collect, 
        b.warehouse_cost as batch_warehouse_cost, 
        b.costs_to_dispatch as batch_costs_to_dispatch, 
        b.destination as batch_destination, 
        b.waybill as batch_waybill, 
        b.id as batche_id, 
        o.*, 
        o.id as order_ID, 
        od.status as delivery_status, 
        od.date_dispatched as delivery_date_dispatched, 
        od.ETA as delivery_ETA, 
        od.*, 
        od.port_of_loading as delivery_port_of_loading, 
        od.port_of_discharge as delivery_port_of_discharge, 
        od.co_loader as delivery_co_loader, 
        od.trans_reference as delivery_trans_reference, 
        co.name as warehouse_origin,
        w.warehouse_name,
        u.full_name as client_Name
    FROM freight_assig_to_batch fa
    LEFT JOIN tbl_freight f ON fa.freight_id = f.id
    LEFT JOIN tbl_orders o ON fa.freight_id = o.freight_id
    LEFT JOIN order_delivery_details od ON od.order_id = o.id
    LEFT JOIN batches b ON b.id = fa.batch_id
    LEFT JOIN warehouse_tbl w ON w.id = b.warehouse_id
    LEFT JOIN countries AS co ON co.id = w.country
    LEFT JOIN tbl_users AS u ON u.id = f.client_ref
    WHERE fa.batch_id = ?
    GROUP BY fa.id
`;


        con.query(getFreightsQuery, [batch_id], (err, result) => {
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

// const getCleranceOrder = async (req, res) => {
//     try {
//         await con.query(`SELECT clearance_order.*, clearance_order.id AS clearance_id, tbl_clearance.*, a.name as port_of_exit_name,  b.name as port_of_entry_name,
//             tbl_users.full_name as client_name
// FROM clearance_order
// INNER JOIN tbl_clearance ON tbl_clearance.id = clearance_order.clearance_id
// INNER JOIN countries as a ON a.id = tbl_clearance.port_of_exit
// INNER JOIN countries as b ON b.id = tbl_clearance.port_of_entry
// INNER JOIN tbl_users ON tbl_users.id=clearance_order.user_id
// ORDER BY clearance_order.created_at DESC;

//         `, (err, data) => {
//             if (err) throw err;

//             if (data.length > 0) {
//                 res.status(200).send({
//                     success: true,
//                     data: data
//                 });
//             } else {
//                 res.status(400).send({
//                     success: false,
//                     message: "Clerance Order list not available"
//                 });
//             }
//         });
//     } catch (error) {
//         res.status(500).send({
//             success: false,
//             message: error.message
//         });
//     }
// }

const getCleranceOrder = async (req, res) => {
    try {
        const { status } = req.query; // Assuming status is passed as a query parameter
        // console.log(status);

        let query = `
            SELECT clearance_order.*, clearance_order.id AS clearance_id, tbl_clearance.*, 
                   a.name as port_of_exit_name, b.name as port_of_entry_name, 
                   tbl_users.full_name as client_name
            FROM clearance_order
            INNER JOIN tbl_clearance ON tbl_clearance.id = clearance_order.clearance_id
            INNER JOIN countries as a ON a.id = tbl_clearance.discharge_country
            INNER JOIN countries as b ON b.id = tbl_clearance.loading_country
            INNER JOIN tbl_users ON tbl_users.id = clearance_order.user_id
        `;

        // Apply filter based on status if provided
        if (status) {
            query += ` WHERE clearance_order.order_status = ? `;
        }

        query += ` ORDER BY clearance_order.created_at DESC`;

        await con.query(query, [status], (err, data) => {
            if (err) throw err;

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
            warehouse_order_id,
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
            (warehouse_order_id, product_description, Hazardous, date_received, package_type, packages, dimension, weight, warehouse_ref) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const values = [
            warehouse_order_id,
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

/* const GetCitiesByCountry = (req, res) => {
    // Get the country_id from request query
    const { country_id } = req.query;

    if (!country_id) {
        return res.status(400).send({
            success: false,
            message: "Country ID is required"
        });
    }

    // SQL query to fetch state IDs by country_id
    const selectStatesByCountry = `
        SELECT id FROM states
        WHERE country_id = ?
    `;
    
    // Execute the query to get state IDs
    con.query(selectStatesByCountry, [country_id], (err, statesData) => {
        if (err) {
            return res.status(500).send({
                success: false,
                message: "Error fetching states",
                error: err.message
            });
        }

        if (statesData.length === 0) {
            return res.status(404).send({
                success: false,
                message: "No states found for this country"
            });
        }

        // Extract state IDs from the result
        const stateIds = statesData.map(state => state.id);

        if (stateIds.length === 0) {
            return res.status(404).send({
                success: false,
                message: "No states found for the given country"
            });
        }

        // Array to hold all city results
        let allCities = [];
        let completedRequests = 0;

        // Function to query cities by state ID
        const queryCitiesByState = (stateId) => {
            const selectCitiesByStateId = `
                SELECT id, name FROM cities
                WHERE state_id = ?
            `;
            
            con.query(selectCitiesByStateId, [stateId], (err, citiesData) => {
                if (err) {
                    return res.status(500).send({
                        success: false,
                        message: "Error fetching cities",
                        error: err.message
                    });
                }

                // Add cities data to allCities array
                allCities = allCities.concat(citiesData);

                completedRequests++;

                // Check if all state queries are done
                if (completedRequests === stateIds.length) {
                    // Respond with all city data
                    if (allCities.length > 0) {
                        res.status(200).send({
                            success: true,
                            data: allCities
                        });
                    } else {
                        res.status(404).send({
                            success: false,
                            message: "No cities found for the given states"
                        });
                    }
                }
            });
        };

        // Query cities for each state ID
        stateIds.forEach(stateId => {
            queryCitiesByState(stateId);
        });
    });
}; */
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



module.exports = {
    AdminLogin, ChangePassword, PrivacyPolicy, GetPrivacy, TermCondition, GetTerms, Addfreight,
    GetFreightAdmin, EditFreight, GetFreightById, DeleteFreight, AddCountryOrigin, getCountryOriginList,
    updateCountryOrigin, GetCountryById, DeleteCountry, clientListAddFreight, CountryListAddFreight,
    Shipping_Estimate, updateShippingEstimate, ShipEstimateList, GetShipEstimateById, DeleteShipEstimate,
    updateProfile, forgotPassword, ResetPassword, SendNotification, GetNotification, deleteNotification,
    ChangeStatusFreight, GetFreightCustomer, GetShipEstimateDetails, order_Details,
    sendMessage, getMessagesList, getAllMessages, UpdateChatOnBack, UpdateChatOnEnter, countAll, countGraph,
    countofFreight, GetSupplerSelected, assignEstimatetoClient, UpdateOrderStatus, GetOrderStatus,
    StageOfShipment, socialMediaLinks, GetAllsocialLinks, getProfileAdmin, add_freight_to_warehouse, restore_order_from_warehouse,
    client_Shipping_Estimate, GetWarehouseOrders, DeleteWarehouseOrder, createBatch, getAllBatch, deleteBatch, moveFreightToBatch, restoreOrderFromBatch,
    getFreightsByBatch, MoveToOrder, MoveToClearaneOrder, getCleranceOrder, CompleteCleranceOrder,
    InprocessCleranceOrder, StillToCleranceOrder, addWarehouse, editWarehouse, getWarehouse, DeleteWarehouse, editWarehouseDetails, GetCountries,
    GetCitiesByCountry, RevertOrder, addWarehouseProduct, getWarehouseOrderProduct

}


// What is the status of the SSL renewal?
