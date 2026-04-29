const con = require('../config/database');
const { validationResult, Result } = require('express-validator');
const bcrypt = require('bcryptjs');
const sendMail = require('../helpers/sendMail')
const path = require('path')
const rendomString = require('randomstring');
const { assign } = require('nodemailer/lib/shared');
const { findOrCreateFolder, uploadFile, findFolderId, deleteFolderByName } = require('../helpers/uploadDrive');
const { logging } = require('googleapis/build/src/apis/logging');
const { sendSms, sendWhatsApp, sendWhatsAppNotification } = require('../helpers/twilioService');
const cron = require('node-cron');
async function hashPassword(password) {
    return await bcrypt.hash(password, 10);
}

const stripHtml = (html = "") => {
    return html.replace(/<[^>]*>?/gm, "").trim();
};

// const formatWhatsAppNumber = (country_code, phone_no) => {
//     if (!phone_no) return null;

//     let code = country_code
//         ? country_code.toString().replace('+', '')
//         : '91';

//     let number = phone_no.toString().replace(/\D/g, '');

//     return `+${code}${number}`; // ❗ NO whatsapp: here
// };

// const formatTwilioWhatsAppNumber = (countryCode, phone) => {
//     if (!phone || !countryCode) return null;

//     phone = phone.toString().replace(/\D/g, '');
//     phone = phone.replace(/^0+/, '');

//     countryCode = countryCode.toString().replace(/\D/g, '');

//     return `+${countryCode}${phone}`;
// };

const formatWhatsAppNumber = (country_code, phone_no) => {
    if (!phone_no) {
        throw new Error("Phone number missing");
    }

    let code = country_code
        ? country_code.toString().replace(/\D/g, '')
        : '91'; // default India

    let number = phone_no.toString().replace(/\D/g, '');
    number = number.replace(/^0+/, '');

    if (!code || !number) {
        throw new Error("Invalid country code or phone number");
    }

    const full = `+${code}${number}`;

    // Length validation (E.164 standard)
    if (full.length < 10 || full.length > 15) {
        throw new Error("Invalid phone length");
    }

    return full;
};

const formatTwilioWhatsAppNumber = (countryCode, phone) => {
    if (!phone) {
        throw new Error("Phone number missing");
    }

    if (!countryCode) {
        throw new Error("Country code missing");
    }

    let cleanPhone = phone.toString().replace(/\D/g, '');
    cleanPhone = cleanPhone.replace(/^0+/, '');

    let cleanCode = countryCode.toString().replace(/\D/g, '');

    if (!cleanPhone || !cleanCode) {
        throw new Error("Invalid phone or country code");
    }

    const full = `+${cleanCode}${cleanPhone}`;

    // Strict validation
    if (full.length < 10 || full.length > 15) {
        throw new Error("Invalid phone length");
    }

    return full;
};

// const AdminLogin = async (req, res) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//         return res.status(400).json({
//             success: false,
//             errors: errors.array()
//         });
//     }
//     try {
//         const { email, password } = req.body;
//         let findUserQuery = "SELECT id, full_name, profile, email, password, user_type, is_deleted, status, assigned_roles, created_at, updated_at FROM tbl_users WHERE email = ? and is_deleted=? and (user_type=? or user_type=?)";
//         await con.query(findUserQuery, [email, 0, 1, 2], (err, data) => {
//             if (err) throw err;
//             // User found
//             if (data.length <= 0) {
//                 return res.status(400).send({
//                     success: false,
//                     message: "Email does not exist !"
//                 });
//             }
//             else {
//                 bcrypt.compare(password, data[0].password, (err, password) => {
//                     if (err) throw err;
//                     if (password) {
//                         if (data[0].status == 1 && data[0].is_deleted == 0) {
//                             let updateLoginQuery = "UPDATE tbl_users SET LastLogin = ? WHERE id = ?";

//                             con.query(updateLoginQuery, [new Date(), data[0].id], (err) => {
//                                 if (err) console.error('Failed to update last login:', err.message);
//                                 res.status(200).send({
//                                     success: true,
//                                     message: "Admin Login Sucessfully !",
//                                     data: data[0]
//                                 })
//                             })
//                         }
//                         else {
//                             if (data[0].is_deleted == 1) {
//                                 res.status(400).send({
//                                     success: false,
//                                     message: "Your account is deleted by admin !"
//                                 })
//                             }
//                             else {
//                                 res.status(400).send({
//                                     success: false,
//                                     message: "Your account is Inactivate by admin !"
//                                 })
//                             }
//                         }

//                     }
//                     else {
//                         res.status(400).send({
//                             success: false,
//                             message: "Password Incorrect !"
//                         })
//                     }
//                 });
//             }
//         });
//     } catch (error) {
//         res.status(500).send({
//             success: false,
//             message: error.message
//         })
//     }
// }

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

        let findUserQuery = `
            SELECT 
                id,
                full_name,
                profile,
                email,
                password,
                user_type,
                is_deleted,
                status,
                assigned_roles,
                access_country,
                created_at,
                updated_at
            FROM tbl_users 
            WHERE email = ? 
              AND is_deleted = ? 
              AND (user_type = ? OR user_type = ?)
        `;

        con.query(findUserQuery, [email, 0, 1, 2], async (err, data) => {
            if (err) throw err;

            if (data.length <= 0) {
                return res.status(400).send({
                    success: false,
                    message: "Email does not exist !"
                });
            }

            bcrypt.compare(password, data[0].password, async (err, isMatch) => {
                if (err) throw err;

                if (!isMatch) {
                    return res.status(400).send({
                        success: false,
                        message: "Password Incorrect !"
                    });
                }

                if (data[0].status != 1 || data[0].is_deleted != 0) {
                    return res.status(400).send({
                        success: false,
                        message: data[0].is_deleted == 1
                            ? "Your account is deleted by admin !"
                            : "Your account is Inactivate by admin !"
                    });
                }

                /* ===============================
                   ACCESS COUNTRY PROCESSING
                =============================== */

                const accessCountryArr = data[0].access_country
                    ? data[0].access_country.split(',').map(id => id.trim())
                    : [];

                let accessCountryNameArr = [];

                if (accessCountryArr.length > 0) {
                    const countryQuery = `
                        SELECT id, name 
                        FROM countries 
                        WHERE id IN (?)
                    `;

                    const countryRows = await new Promise((resolve, reject) => {
                        con.query(countryQuery, [accessCountryArr], (err, rows) => {
                            if (err) return reject(err);
                            resolve(rows);
                        });
                    });

                    const countryMap = {};
                    countryRows.forEach(c => {
                        countryMap[c.id] = c.name;
                    });

                    accessCountryNameArr = accessCountryArr.map(
                        id => countryMap[id] || null
                    );
                }

                /* ===============================
                   UPDATE LAST LOGIN
                =============================== */

                let updateLoginQuery = `UPDATE tbl_users SET LastLogin = ? WHERE id = ?`;
                con.query(updateLoginQuery, [new Date(), data[0].id], err => {
                    if (err) console.error("Failed to update last login:", err.message);
                });

                /* ===============================
                   FINAL RESPONSE
                =============================== */

                const responseData = {
                    ...data[0],
                    assigned_roles: data[0].assigned_roles, //  unchanged
                    access_country: accessCountryArr,
                    access_country_name: accessCountryNameArr
                };

                delete responseData.password;

                res.status(200).send({
                    success: true,
                    message: "Admin Login Sucessfully !",
                    data: responseData
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


// const GetFreightAdmin = async (req, res) => {
//     const { status, priority, origin, destination, startDate, endDate, freightType, freightSpeed, user_id, user_type, search, page = 1, limit = 10 } = req.body;

//     try {
//         let userCountry = null;

//         if (user_id) {
//             const userQuery = `
//                 SELECT country 
//                 FROM tbl_users 
//                 WHERE id = ? AND is_deleted = 0
//             `;

//             const userData = await new Promise((resolve, reject) => {
//                 con.query(userQuery, [user_id], (err, rows) => {
//                     if (err) return reject(err);
//                     resolve(rows);
//                 });
//             });

//             if (!userData.length) {
//                 return res.status(404).send({
//                     success: false,
//                     message: "User not found"
//                 });
//             }

//             userCountry = userData[0].country;
//         }

//         /* ==================== STEP 2: BASE CONDITION ==================== */
//         let condition = `
//             WHERE tbl_freight.is_deleted = ?
//             AND tbl_freight.added_by = ?
//             AND tbl_freight.order_status = ?
//         `;
//         let params = [0, 1, 0];

//         /* ==================== STEP 3: COUNTRY MATCH CONDITION ==================== */
//         if (userCountry) {
//             condition += `
//                 AND (
//                     tbl_freight.collection_from = ?
//                     OR tbl_freight.delivery_to = ?
//                 )
//             `;
//             params.push(userCountry, userCountry);
//         }

//         if (status) {
//             condition += ' AND tbl_freight.status = ?';
//             params.push(status);
//         }

//         if (priority) {
//             condition += ' AND tbl_freight.priority = ?';
//             params.push(priority);
//         }

//         if (origin) {
//             condition += ' AND tbl_freight.collection_from = ?';
//             params.push(origin);
//         }

//         if (destination) {
//             condition += ' AND tbl_freight.delivery_to = ?';
//             params.push(destination);
//         }

//         if (startDate && endDate) {
//             condition += ' AND tbl_freight.date BETWEEN ? AND ?';
//             params.push(startDate, endDate);
//         }

//         if (freightType) {
//             condition += ' AND tbl_freight.freight = ?';
//             params.push(freightType);
//         }

//         if (freightSpeed) {
//             condition += ' AND tbl_freight.type = ?';
//             params.push(freightSpeed);
//         }

//         // Add global search condition across multiple fields
//         if (search) {
//             condition += ` AND (
//                 tbl_freight.freight_number LIKE ?
//                 OR tbl_users.full_name LIKE ?
//                 OR tbl_users.email LIKE ?
//                 OR tbl_freight.product_desc LIKE ?
//                 OR cm.name LIKE ?
//                 OR tbl_freight.shipper_name LIKE ?
//                 OR tbl_freight.shipment_details LIKE ?
//                 OR tbl_freight.comment LIKE ?
//                 OR ss.full_name LIKE ?
//                 OR ts.name LIKE ?
//                 OR c.name LIKE ?
//                 OR co.name LIKE ?
//             )`;
//             const searchParam = `%${search}%`;
//             params.push(searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam);
//         }

//         const All_access_USER_ID = 19855;

//         if (user_type === 2 && user_id != null && user_id !== All_access_USER_ID) {
//             condition += ' AND (tbl_freight.user_id = ? OR tbl_freight.sales_representative = ?)';
//             params.push(user_id, user_id);
//         }

//         // Build base query for joins and conditions (without GROUP BY for count)
//         const baseQueryWithoutGroup = `
//             FROM tbl_freight
//             LEFT JOIN tbl_suppliers as ts on ts.id = tbl_freight.supplier_task_assign_id
//             LEFT JOIN estimate_shipping_quote AS esq ON esq.freight_id = tbl_freight.id
//             LEFT JOIN tbl_users AS ss ON ss.id = tbl_freight.sales_representative
//             LEFT JOIN tbl_users ON tbl_users.id = tbl_freight.client_id
//             LEFT JOIN countries AS c ON c.id = tbl_freight.delivery_to
//             LEFT JOIN countries AS co ON co.id = tbl_freight.collection_from
//             LEFT JOIN shipping_estimate  AS s ON s.freight_id = tbl_freight.id
//             LEFT JOIN tbl_commodity  AS cm ON cm.id = tbl_freight.commodity
//             ${condition}
//         `;

//         // Build base query for joins and conditions (with GROUP BY for data)
//         const baseQuery = `${baseQueryWithoutGroup}
//             GROUP BY tbl_freight.id
//         `;

//         // Query for total count
//         const countQuery = `SELECT COUNT(DISTINCT tbl_freight.id) as total ${baseQueryWithoutGroup}`;
//         const totalResult = await new Promise((resolve, reject) => {
//             con.query(countQuery, params, (err, rows) => {
//                 if (err) return reject(err);
//                 resolve(rows);
//             });
//         });
//         const total = totalResult[0].total;

//         // Calculate offset for pagination
//         const offset = (page - 1) * limit;

//         // Full select query with pagination
//         const selectQuery = `
//             SELECT
//             tbl_freight.id as freight_id, tbl_freight.attachment_Estimate, tbl_freight.isConfirmed, tbl_freight.sales_representative as sales_id, ss.full_name as sales_name,  tbl_freight.fcl_lcl, tbl_users.*, tbl_users.id as user_id, tbl_users.full_name as client_name, tbl_users.email as client_email, tbl_users.client_number AS client_number, tbl_freight.product_desc,
//                 tbl_freight.client_id as client_ref, tbl_freight.date, tbl_freight.type, tbl_freight.freight, tbl_freight.incoterm, tbl_freight.dimension, tbl_freight.weight,
//                 tbl_freight.quote_received, tbl_freight.client_quoted, tbl_freight.status, tbl_freight.comment, tbl_freight.no_of_packages, tbl_freight.package_type,
//                 tbl_freight.commodity, cm.name as commodity_name, tbl_freight.shipper_name, tbl_freight.hazardous, tbl_freight.collection_from, tbl_freight.delivery_to, tbl_freight.supplier_address, tbl_freight.shipment_origin, tbl_freight.shipment_des,
//                 tbl_freight.port_of_loading, tbl_freight.post_of_discharge, tbl_freight.place_of_delivery, tbl_freight.ready_for_collection,
//                 tbl_freight.transit_time, tbl_freight.priority, tbl_freight.added_by, tbl_freight.freight_number, tbl_freight.shipment_details,
//                 tbl_freight.nature_of_hazard, tbl_freight.volumetric_weight, tbl_freight.assign_for_estimate, tbl_freight.assign_to_transporter,
//                 tbl_freight.is_active, tbl_freight.add_attachments, tbl_freight.add_attachment_file, tbl_freight.assign_warehouse, tbl_freight.order_status, tbl_freight.created_at as freight_created_at, tbl_freight.assign_to_clearing, tbl_freight.send_to_warehouse, tbl_freight.client_ref_name, tbl_freight.shipment_ref, tbl_freight.insurance, c.name as delivery_to_name, co.name as collection_from_name, 
//                     s.origin_pick_up AS estimate_origin_pick_up, s.Supplier_Quote_Amount AS estimate_Supplier_Quote_Amount,
//                     s.freight_currency AS estimate_freight_currency, s.freight_amount AS estimate_freight_amount,
//                     s.origin_customs AS estimate_origin_customs, 
//                     s.origin_customs_gp AS estimate_origin_customs_gp,
//                     s.origin_customs AS estimate_origin_customs, 
//                     s.origin_document AS estimate_origin_document, 
//                     s.origin_document_gp AS estimate_origin_document_gp,
//                     s.origin_warehouse AS estimate_origin_warehouse, 
//                     s.origin_warehouse_gp AS estimate_origin_warehouse_gp, 
//                     s.des_warehouse AS estimate_des_warehouse, 
//                     s.des_warehouse_gp AS estimate_des_warehouse_gp, 
//                     s.des_delivery AS estimate_des_delivery, 
//                     s.des_delivery_gp AS estimate_des_delivery_gp,
//                     s.freight_amount as estimate_freight_amount,
//                     s.id as estimate_id,
//     s.freight_gp as estimate_freight_gp,
//     s.origin_port_fees as estimate_origin_port_fees,
//     s.origin_port_fees_gp as estimate_origin_port_fees_gp,
//     s.des_customs_gp as estimate_des_customs_gp,
//     s.des_customs as estimate_des_customs,
//     s.des_document as estimate_des_document,
//     s.des_document_gp as estimate_des_document_gp,
//     s.des_port_fees as estimate_des_port_fees,
//     s.des_port_fees_gp as estimate_des_port_fees_gp,
//     s.des_unpack as estimate_des_unpack,
//     s.des_unpack_gp as estimate_des_unpack_gp,
//     s.des_other as estimate_des_other,
//     s.des_other_gp as estimate_des_other_gp,
//     s.des_other as estimate_des_other,
//     s.des_currency as estimate_des_currency,
//     s.freigh_amount as estimate_freigh_amount,
//     s.origin_amount as estimate_origin_amount,
//     s.des_amount as estimate_des_amount,
//     s.sub_amount as estimate_sub_amount,
//     s.exchange_rate as estimate_exchange_rate,
//     s.total_amount as estimate_total_amount,
//     s.Supplier_Quote_Attachment as estimate_Supplier_Quote_Attachment,
//     s.Supplier_Quote_Amount as estimate_Supplier_Quote_Amount,
//     s.serial_number as estimate_serial_number,
//     COUNT(s.freight_id) AS estimate_count,
//             ts.name as assigned_supplier_name,
//                 esq.id as quote_estimate_id,
//                 esq.freight_id AS quote_freight_id,
//                 esq.client_id AS quote_client_id,
//                 esq.supplier_id AS quote_supplier_id,
//                 esq.serial_number AS quote_serial_number,
//                 esq.date AS quote_date,
//                 esq.client_ref AS quote_client_ref,
//                 esq.totalChageswithOutExchange AS quote_total_without_exchange,
//                 esq.totalChangeRoeOrigin AS quote_total_roe_origin,
//                 esq.sumofall AS quote_grand_total,
//                 esq.sumofRoe AS quote_grand_total_roe,
//                 COUNT(DISTINCT esq.id) AS quote_count
//             ${baseQuery}
//             ORDER BY tbl_freight.created_at DESC
//             LIMIT ? OFFSET ?
//         `;

//         // Add limit and offset to params
//         const dataParams = [...params, limit, offset];

//         await con.query(selectQuery, dataParams, (err, data) => {
//             if (err) {
//                 res.status(500).send({ success: false, message: err.message });
//                 return;
//             }

//             // Always return success with data (empty array if no records), total, page, limit
//             res.status(200).send({ success: true, data: data, total: total, page: parseInt(page), limit: parseInt(limit) });
//         });
//     } catch (error) {
//         res.status(500).send({ success: false, message: error.message });
//     }
// };

// 2/4/2026

// const GetFreightAdmin = (req, res) => {
//     const {
//         status, priority, origin, destination, startDate, endDate,
//         freightType, freightSpeed, user_id, user_type,
//         search, page = 1, limit = 10
//     } = req.body;

//     let userCountry = null;
//     const offset = (page - 1) * limit;
//     const All_access_USER_ID = 19855;

//     /* ==================== STEP 1: USER COUNTRY ==================== */
//     let accessCountries = [];

//     const getUserCountry = (cb) => {
//         if (!user_id) return cb();

//         // All-access user bypass
//         if (user_id === All_access_USER_ID) {
//             accessCountries = [];
//             return cb();
//         }

//         con.query(
//             `SELECT access_country FROM tbl_users WHERE id = ? AND is_deleted = 0`,
//             [user_id],
//             (err, rows) => {
//                 if (err) return cb(err);

//                 if (!rows.length) {
//                     return res.status(404).send({
//                         success: false,
//                         message: "User not found"
//                     });
//                 }

//                 if (rows[0].access_country) {
//                     accessCountries = rows[0].access_country
//                         .split(',')
//                         .map(id => Number(id.trim()));
//                 }

//                 cb();
//             }
//         );
//     };

//     /* ==================== STEP 2: BUILD CONDITIONS ==================== */
//     const buildCondition = () => {
//         let condition = `
//             WHERE tbl_freight.is_deleted = 0
//             AND tbl_freight.added_by = 1
//             AND tbl_freight.order_status = 0
//         `;
//         let params = [];

//         if (
//             user_id !== All_access_USER_ID &&
//             accessCountries.length
//         ) {
//             const placeholders = accessCountries.map(() => '?').join(',');

//             condition += `
//          AND (
//             tbl_freight.collection_from IN (${placeholders})
//             OR tbl_freight.delivery_to IN (${placeholders})
//          )
//            `;

//             params.push(...accessCountries, ...accessCountries);
//         }

//         if (status) { condition += ' AND tbl_freight.status = ?'; params.push(status); }
//         if (priority) { condition += ' AND tbl_freight.priority = ?'; params.push(priority); }
//         if (origin) { condition += ' AND tbl_freight.collection_from = ?'; params.push(origin); }
//         if (destination) { condition += ' AND tbl_freight.delivery_to = ?'; params.push(destination); }
//         if (startDate && endDate) {
//             condition += ' AND tbl_freight.date BETWEEN ? AND ?';
//             params.push(startDate, endDate);
//         }
//         if (freightType) { condition += ' AND tbl_freight.freight = ?'; params.push(freightType); }
//         if (freightSpeed) { condition += ' AND tbl_freight.type = ?'; params.push(freightSpeed); }

//         if (user_type === 2 && user_id && user_id !== All_access_USER_ID) {
//             condition += ' AND (tbl_freight.user_id = ? OR tbl_freight.sales_representative = ?)';
//             params.push(user_id, user_id);
//         }
//         // Add global search condition across multiple fields
//         if (search) {
//             condition += ` AND (
//                 tbl_freight.freight_number LIKE ?
//                 OR tbl_users.full_name LIKE ?
//                 OR tbl_users.email LIKE ?
//                 OR tbl_freight.product_desc LIKE ?
//                 OR cm.name LIKE ?
//                 OR tbl_freight.shipper_name LIKE ?
//                 OR tbl_freight.shipment_details LIKE ?
//                 OR tbl_freight.comment LIKE ?
//                 OR ss.full_name LIKE ?
//                 OR ts.name LIKE ?
//                 OR c.name LIKE ?
//                 OR co.name LIKE ?
//             )`;
//             const searchParam = `%${search}%`;
//             params.push(searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam);
//         }

//         return { condition, params };
//     };

//     /* ==================== STEP 3: COUNT QUERY (FAST) ==================== */
//     const getCount = (condition, params, cb) => {

//         const countQuery = `
//         SELECT COUNT(DISTINCT tbl_freight.id) AS total
//         FROM tbl_freight
//         ${search ? `
//             LEFT JOIN tbl_users ON tbl_users.id = tbl_freight.client_id
//             LEFT JOIN tbl_users ss ON ss.id = tbl_freight.sales_representative
//             LEFT JOIN tbl_suppliers ts ON ts.id = tbl_freight.supplier_task_assign_id
//             LEFT JOIN tbl_commodity cm ON cm.id = tbl_freight.commodity
//             LEFT JOIN countries c ON c.id = tbl_freight.delivery_to
//             LEFT JOIN countries co ON co.id = tbl_freight.collection_from
//         ` : ''}
//         ${condition}
//     `;

//         con.query(countQuery, params, (err, rows) => {
//             if (err) return cb(err);
//             cb(null, rows[0].total);
//         });
//     };

// //  s.id AS estimate_id,

//     /* ==================== STEP 4: DATA QUERY ==================== */
//     const getData = (condition, params, total) => {
//         const dataQuery = `
//             SELECT
//                 tbl_freight.id AS freight_id,
//                 tbl_freight.freight_number,
//                 tbl_freight.status,
//                 tbl_freight.priority,
//                 tbl_freight.date,
//                 tbl_freight.created_at,
//                 tbl_freight.client_id AS freight_client_id,
//                 tbl_freight.type, tbl_freight.freight,
//                 tbl_freight.product_desc,
//                 tbl_freight.hazardous,
//                 tbl_freight.client_id as client_ref,
//                 tbl_freight.sales_representative as staff_id,
//                 tbl_freight.nature_of_hazard,
//                 tbl_freight.order_status, tbl_freight.created_at as freight_created_at, tbl_freight.assign_to_clearing, tbl_freight.send_to_warehouse,
//                 tbl_users.full_name AS client_name,
//                 ss.full_name AS sales_name,
//                 tu.full_name as staff_name, 
//                     esq.id AS quote_id,
//                     esq.id as quote_estimate_id,
//                 tbl_freight.sales_representative AS sales_id,
//                 ts.name AS supplier_name,
//                 ts.id AS supplier_id,
//                 cm.name AS commodity_name,
//                 c.name AS delivery_to_name,
//                 co.name AS collection_from_name,
//                 (
//     SELECT COUNT(*) 
//     FROM estimate_shipping_quote eq 
//     WHERE eq.freight_id = tbl_freight.id
// ) AS quote_count,
//                 (
//     SELECT COUNT(*) 
//     FROM shipping_estimate se 
//     WHERE se.freight_id = tbl_freight.id
// ) AS estimate_count
//             FROM tbl_freight
//             LEFT JOIN tbl_users ON tbl_users.id = tbl_freight.client_id
//             LEFT JOIN tbl_users ss ON ss.id = tbl_freight.sales_representative
//             LEFT JOIN tbl_users tu ON tu.id = tbl_freight.sales_representative
//             LEFT JOIN tbl_commodity cm ON cm.id = tbl_freight.commodity
//             LEFT JOIN countries c ON c.id = tbl_freight.delivery_to
//             LEFT JOIN countries co ON co.id = tbl_freight.collection_from
//             LEFT JOIN tbl_suppliers ts 
//             ON ts.id = esq.supplier_id
//             ${condition}
//             GROUP BY tbl_freight.id
//             ORDER BY tbl_freight.created_at DESC
//             LIMIT ? OFFSET ?
//         `;

//         con.query(
//             dataQuery,
//             [...params, Number(limit), Number(offset)],
//             (err, data) => {
//                 if (err) {
//                     return res.status(500).send({ success: false, message: err.message });
//                 }

//                 res.status(200).send({
//                     success: true,
//                     data,
//                     total,
//                     page: Number(page),
//                     limit: Number(limit)
//                 });
//             }
//         );
//     };

//     /* ==================== FLOW ==================== */
//     getUserCountry((err) => {
//         if (err) return res.status(500).send({ success: false, message: err.message });

//         const { condition, params } = buildCondition();

//         getCount(condition, params, (err, total) => {
//             if (err) return res.status(500).send({ success: false, message: err.message });
//             getData(condition, params, total);
//         });
//     });
// };


const GetFreightAdmin = (req, res) => {
    const {
        status, priority, origin, destination, startDate, endDate,
        freightType, freightSpeed, user_id, user_type,
        search, page = 1, limit = 10
    } = req.body;

    let userCountry = null;
    const offset = (page - 1) * limit;
    const All_access_USER_ID = 19855;

    /* ==================== STEP 1: USER COUNTRY ==================== */
    let accessCountries = [];

    const getUserCountry = (cb) => {
        if (!user_id) return cb();

        // All-access user bypass
        if (user_id === All_access_USER_ID) {
            accessCountries = [];
            return cb();
        }

        con.query(
            `SELECT access_country FROM tbl_users WHERE id = ? AND is_deleted = 0`,
            [user_id],
            (err, rows) => {
                if (err) return cb(err);

                if (!rows.length) {
                    return res.status(404).send({
                        success: false,
                        message: "User not found"
                    });
                }

                if (rows[0].access_country) {
                    accessCountries = rows[0].access_country
                        .split(',')
                        .map(id => Number(id.trim()));
                }

                cb();
            }
        );
    };

    /* ==================== STEP 2: BUILD CONDITIONS ==================== */
    const buildCondition = () => {
        let condition = `
            WHERE tbl_freight.is_deleted = 0
            AND tbl_freight.added_by = 1
            AND tbl_freight.order_status = 0
        `;
        let params = [];

        if (
            user_id !== All_access_USER_ID &&
            accessCountries.length
        ) {
            const placeholders = accessCountries.map(() => '?').join(',');

            condition += `
         AND (
            tbl_freight.collection_from IN (${placeholders})
            OR tbl_freight.delivery_to IN (${placeholders})
         )
           `;

            params.push(...accessCountries, ...accessCountries);
        }

        if (status) { condition += ' AND tbl_freight.status = ?'; params.push(status); }
        if (priority) { condition += ' AND tbl_freight.priority = ?'; params.push(priority); }
        if (origin) { condition += ' AND tbl_freight.collection_from = ?'; params.push(origin); }
        if (destination) { condition += ' AND tbl_freight.delivery_to = ?'; params.push(destination); }
        if (startDate && endDate) {
            condition += ' AND tbl_freight.date BETWEEN ? AND ?';
            params.push(startDate, endDate);
        }
        if (freightType) { condition += ' AND tbl_freight.freight = ?'; params.push(freightType); }
        if (freightSpeed) { condition += ' AND tbl_freight.type = ?'; params.push(freightSpeed); }

        if (user_type === 2 && user_id && user_id !== All_access_USER_ID) {
            condition += ' AND (tbl_freight.user_id = ? OR tbl_freight.sales_representative = ?)';
            params.push(user_id, user_id);
        }
        // Add global search condition across multiple fields
        if (search) {
            condition += ` AND (
                tbl_freight.freight_number LIKE ?
                OR tbl_users.full_name LIKE ?
                OR tbl_users.email LIKE ?
                OR tbl_freight.product_desc LIKE ?
                OR cm.name LIKE ?
                OR tbl_freight.shipper_name LIKE ?
                OR tbl_freight.shipment_details LIKE ?
                OR tbl_freight.comment LIKE ?
                OR ss.full_name LIKE ?
                OR ts.name LIKE ?
                OR c.name LIKE ?
                OR co.name LIKE ?
            )`;
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam);
        }

        return { condition, params };
    };

    /* ==================== STEP 3: COUNT QUERY (FAST) ==================== */
    const getCount = (condition, params, cb) => {

        const countQuery = `
        SELECT COUNT(DISTINCT tbl_freight.id) AS total
        FROM tbl_freight
        ${search ? `
            LEFT JOIN tbl_users ON tbl_users.id = tbl_freight.client_id
            LEFT JOIN tbl_users ss ON ss.id = tbl_freight.sales_representative
            LEFT JOIN tbl_suppliers ts ON ts.id = tbl_freight.supplier_task_assign_id
            LEFT JOIN tbl_commodity cm ON cm.id = tbl_freight.commodity
            LEFT JOIN countries c ON c.id = tbl_freight.delivery_to
            LEFT JOIN countries co ON co.id = tbl_freight.collection_from
        ` : ''}
        ${condition}
    `;

        con.query(countQuery, params, (err, rows) => {
            if (err) return cb(err);
            cb(null, rows[0].total);
        });
    };


    /* ==================== STEP 4: DATA QUERY ==================== */
    const getData = (condition, params, total) => {
        const dataQuery = `
            SELECT
                DISTINCT tbl_freight.id AS freight_id,
                tbl_freight.freight_number,
                tbl_freight.status,
                tbl_freight.priority,
                tbl_freight.date,
                tbl_freight.created_at,
                tbl_freight.client_id AS freight_client_id,
                tbl_freight.type, tbl_freight.freight,
                tbl_freight.product_desc,
                tbl_freight.hazardous,
                tbl_freight.client_id as client_ref,
                tbl_freight.sales_representative as staff_id,
                tbl_freight.nature_of_hazard,
                tbl_freight.isConfirmed,
                tbl_freight.order_status, tbl_freight.created_at as freight_created_at, tbl_freight.assign_to_clearing, tbl_freight.send_to_warehouse,
                tbl_users.full_name AS client_name,
                ss.full_name AS sales_name,
                ss.full_name as staff_name,
                    s.id AS estimate_id,
                    esq.id AS quote_id,
                    esq.id as quote_estimate_id,
                tbl_freight.sales_representative AS sales_id,
                ts.name AS supplier_name,
                ts.id AS supplier_id,
                cm.name AS commodity_name,
                c.name AS delivery_to_name,
                co.name AS collection_from_name,
                (
    SELECT COUNT(*) 
    FROM estimate_shipping_quote eq 
    WHERE eq.freight_id = tbl_freight.id
) AS quote_count,
                (
    SELECT COUNT(*) 
    FROM shipping_estimate se 
    WHERE se.freight_id = tbl_freight.id
) AS estimate_count
            FROM tbl_freight
            LEFT JOIN tbl_users ON tbl_users.id = tbl_freight.client_id
            LEFT JOIN tbl_users ss ON ss.id = tbl_freight.sales_representative
            LEFT JOIN tbl_commodity cm ON cm.id = tbl_freight.commodity
            LEFT JOIN countries c ON c.id = tbl_freight.delivery_to
            LEFT JOIN countries co ON co.id = tbl_freight.collection_from
            LEFT JOIN shipping_estimate s ON s.freight_id = tbl_freight.id
            LEFT JOIN estimate_shipping_quote esq 
            ON esq.freight_id = tbl_freight.id 
            LEFT JOIN tbl_suppliers ts 
            ON ts.id = esq.supplier_id
            ${condition}
            GROUP BY tbl_freight.id
            ORDER BY tbl_freight.created_at DESC
            LIMIT ? OFFSET ?
        `;

        con.query(
            dataQuery,
            [...params, Number(limit), Number(offset)],
            (err, data) => {
                if (err) {
                    return res.status(500).send({ success: false, message: err.message });
                }

                res.status(200).send({
                    success: true,
                    data,
                    total,
                    page: Number(page),
                    limit: Number(limit)
                });
            }
        );
    };

    /* ==================== FLOW ==================== */
    getUserCountry((err) => {
        if (err) return res.status(500).send({ success: false, message: err.message });

        const { condition, params } = buildCondition();

        getCount(condition, params, (err, total) => {
            if (err) return res.status(500).send({ success: false, message: err.message });
            getData(condition, params, total);
        });
    });
};

const GetFreightAdminById = async (req, res) => {
    const { freight_id, status, priority, origin, destination, startDate, endDate, freightType, freightSpeed, user_id, user_type } = req.body;

    try {
        if (!freight_id) {
            return res.status(400).send({
                success: false,
                message: "freight_id is required"
            });
        }

        let userCountry = null;

        if (user_id) {
            const userQuery = `
                SELECT country 
                FROM tbl_users 
                WHERE id = ? AND is_deleted = 0
            `;

            const userData = await new Promise((resolve, reject) => {
                con.query(userQuery, [user_id], (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows);
                });
            });

            if (!userData.length) {
                return res.status(404).send({
                    success: false,
                    message: "User not found"
                });
            }

            userCountry = userData[0].country;
        }

        /* ==================== STEP 2: BASE CONDITION ==================== */
        let condition = `
            WHERE tbl_freight.is_deleted = ?
            AND tbl_freight.added_by = ?
            AND tbl_freight.order_status = ?
        `;
        let params = [0, 1, 0];

        /* ==================== STEP 3: COUNTRY MATCH CONDITION ==================== */
        if (userCountry) {
            condition += `
                AND (
                    tbl_freight.collection_from = ?
                    OR tbl_freight.delivery_to = ?
                )
            `;
            params.push(userCountry, userCountry);
        }

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

        if (freight_id) {
            condition += ` AND tbl_freight.id = ? `;
            params.push(freight_id);
        }

        if (freightSpeed) {
            condition += ' AND tbl_freight.type = ?';
            params.push(freightSpeed);
        }

        const All_access_USER_ID = 19855;

        if (user_type === 2 && user_id != null && user_id !== All_access_USER_ID) {
            condition += ' AND (tbl_freight.user_id = ? OR tbl_freight.sales_representative = ?)';
            params.push(user_id, user_id);
        }

        const selectQuery = `
            SELECT
            tbl_freight.id as freight_id, tbl_freight.attachment_Estimate, tbl_freight.isConfirmed, tbl_freight.sales_representative as sales_id, ss.full_name as sales_name,  tbl_freight.fcl_lcl, tbl_users.*, tbl_users.id as user_id, tbl_users.full_name as client_name, tbl_users.email as client_email, tbl_users.client_number AS client_number, tbl_freight.product_desc,
                tbl_freight.client_id as client_ref, tbl_freight.date, tbl_freight.type, tbl_freight.freight, tbl_freight.incoterm, tbl_freight.dimension, tbl_freight.weight,
                tbl_freight.quote_received, tbl_freight.client_quoted, tbl_freight.status, tbl_freight.comment, tbl_freight.no_of_packages, tbl_freight.package_type,
                tbl_freight.commodity, cm.name as commodity_name, tbl_freight.shipper_name, tbl_freight.hazardous, tbl_freight.collection_from as country_of_origin, tbl_freight.delivery_to as destination_country, tbl_freight.supplier_address, tbl_freight.shipment_origin, tbl_freight.shipment_des,
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
                    s.id as estimate_id,
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
    s.serial_number as estimate_serial_number,
    COUNT(s.freight_id) AS estimate_count,
            ts.name as assigned_supplier_name,
                esq.id as quote_estimate_id,
                esq.freight_id AS quote_freight_id,
                esq.client_id AS quote_client_id,
                esq.supplier_id AS quote_supplier_id,
                esq.serial_number AS quote_serial_number,
                esq.date AS quote_date,
                esq.client_ref AS quote_client_ref,
                esq.totalChageswithOutExchange AS quote_total_without_exchange,
                esq.totalChangeRoeOrigin AS quote_total_roe_origin,
                esq.sumofall AS quote_grand_total,
                esq.sumofRoe AS quote_grand_total_roe,
                COUNT(DISTINCT esq.id) AS quote_count
            FROM tbl_freight
            LEFT JOIN tbl_suppliers as ts on ts.id = tbl_freight.supplier_task_assign_id
            LEFT JOIN estimate_shipping_quote AS esq ON esq.freight_id = tbl_freight.id
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

            // Always return success with data (empty array if no records)
            res.status(200).send({ success: true, data: data });
        });
    } catch (error) {
        res.status(500).send({ success: false, message: error.message });
    }
};

// const Addfreight = (req, res) => {
//     try {
//         // Extracting data from req.body
//         const {
//             client_ref, client_email, date, type, fcl_lcl, freight, incoterm, dimension, weight, quote_received, client_quoted, shipment_ref, insurance,
//             is_active, comment, no_of_packages, package_type, commodity, hazardous, industry, country_of_origin, destination_country,
//             supplier_address, shipper_name, port_of_loading, post_of_discharge, place_of_delivery, ready_for_collection, Product_Description,
//             transit_time, priority, shipment_details, nature_of_hazard, volumetric_weight, assign_for_estimate, sales_representative, assign_to_transporter, assign_warehouse, assign_to_clearing, send_to_warehouse, shipment_origin, shipment_des, client_ref_name, add_attachments, documentName
//         } = req.body;
//         // console.log(req.files);

//         // Generate the freight number
//         generateFreightNumber((err, freightNumber) => {
//             if (err) throw err;

//             // Insert into the database
//             let insertQuery;
//             let insertParams;

//             insertQuery = `INSERT INTO tbl_freight (client_id, client_email, date, type, fcl_lcl, freight, incoterm, dimension, weight, 
//             quote_received, client_quoted, is_active, comment, no_of_packages, package_type, commodity, hazardous, 
//              collection_from, delivery_to, supplier_address, shipper_name, port_of_loading, post_of_discharge, place_of_delivery, 
//             ready_for_collection, transit_time, priority, added_by, freight_number, shipment_details, 
//             nature_of_hazard, volumetric_weight, assign_for_estimate, assign_to_transporter, assign_warehouse, assign_to_clearing, 
//             send_to_warehouse, shipment_origin, shipment_des, product_desc, shipment_ref, insurance, client_ref_name, sales_representative) 
//             VALUES (?, ?, ?, ?, ?, ?, ?, ?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?,?,?,?,?,?,?)`;
//             insertParams = [
//                 client_ref, client_email, date, type, fcl_lcl || null, freight, incoterm, dimension, weight, quote_received, client_quoted,
//                 is_active, comment, no_of_packages, package_type, commodity, hazardous, country_of_origin, destination_country,
//                 supplier_address, shipper_name, port_of_loading, post_of_discharge, place_of_delivery, ready_for_collection,
//                 transit_time, priority, 1, freightNumber, shipment_details, nature_of_hazard, volumetric_weight, assign_for_estimate,
//                 assign_to_transporter, assign_warehouse, assign_to_clearing, send_to_warehouse, shipment_origin, shipment_des, Product_Description, shipment_ref, insurance, client_ref_name, sales_representative
//             ];

//             con.query(insertQuery, insertParams, (err, insertResult) => {
//                 if (err) throw err;
//                 /* if (req.file && req.file.filename) {
//                     const docsInsertQuery = `update tbl_freight set add_attachments='${add_attachments}', add_attachment_file='${req.file.filename}' where id='${insertResult.insertId}'`;
//                     con.query(docsInsertQuery, (err, result) => {
//                         if (err) {
//                             // console.error('Error inserting document data:', err);
//                             return res.status(500).json({
//                                 success: false,
//                                 message: "Internal Server Error"
//                             });
//                         }
//                     });
//                 } */

//                 const selectQuery = `
//                     SELECT tbl_freight.freight_number, tbl_freight.client_id, tbl_users.full_name
//                     FROM tbl_freight
//                     LEFT JOIN tbl_users ON tbl_users.id = tbl_freight.client_id
//                     WHERE tbl_freight.id = ?
//                   `;


//                 con.query(selectQuery, [insertResult.insertId], (err, result) => {
//                     if (err) {
//                         console.error("Error fetching freight number:", err);
//                         return;
//                     }

//                     if (result.length === 0) {
//                         console.error("No freight number found for the given ID.");
//                         return;
//                     }

//                     const freightNumber = result[0].freight_number;

//                     const createDriveFolderOnly = async (req, res) => {
//                         try {

//                             if (!freightNumber) {
//                                 return res.status(400).json({ message: "Missing freightNumber" });
//                             }

//                             const folderId = await findOrCreateFolder(freightNumber);

//                         } catch (error) {
//                             console.error("Error creating folder:", error);
//                         }
//                     };
//                     createDriveFolderOnly()

//                     const Email = client_email; // send email to customer
//                     const mailSubject = 'New Shipment Enquiry';
//                     const content = `
//   <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; background-color: #f9f9f9;">
//     <h2 style="color: #2c3e50; border-bottom: 1px solid #ccc; padding-bottom: 10px;">New Shipment Enquiry</h2>

//     <p style="font-size: 16px; color: #333;">
//       Dear <strong>${result[0].full_name}</strong>,
//     </p>

//     <p style="font-size: 16px; color: #333;">
//       We’re excited to let you know that a new shipment enquiry has been created under your profile.
//     </p>

//     <p style="font-size: 16px; color: #333;">
//       <strong>Shipment Details:</strong><br>
//       Freight Number: <strong>${freightNumber}</strong><br>
//       Product Description: <strong>${Product_Description}</strong><br>
//       Freight: <strong>${freight}</strong>
//     </p>

//     <p style="font-size: 16px; color: #333;">
//       Our sales team will reach out to you shortly with further details. In the meantime, feel free to contact us if you have any questions.
//     </p>

//     <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">

//     <p style="font-size: 14px; color: #777;">
//       Regards,<br>
//       <strong>Management System</strong>
//     </p>
//   </div>
// `;

//                     // sendMail(Email, mailSubject, content);

//                     // Process all files for a given document type
//                     const processFiles = async (fileArray, documentName) => {
//                         try {


//                             for (const file of fileArray) { // Loop through all files
//                                 const docsInsertQuery = `INSERT INTO freight_doc (freight_id, document_name, document) VALUES (?, ?, ?)`;

//                                 await new Promise((resolve, reject) => {
//                                     con.query(docsInsertQuery, [insertResult.insertId, documentName, file.filename], (err) => {
//                                         if (err) {
//                                             console.error(`Error inserting ${documentName}:`, err);
//                                             return reject(err);
//                                         }
//                                         resolve();
//                                     });
//                                 });

//                                 // Step 2: Upload to Google Drive (or your cloud service)
//                                 const subfolderName = getFolderNameFromDocumentName(documentName); // returns "AD_Quotations" etc.

//                                 const uploadResult = await uploadToSpecificPath(
//                                     freightNumber,     // Main folder: e.g., "F-20250613"
//                                     "Supplier Invoices",      // Parent folder or fixed main type
//                                     subfolderName,     // Subfolder based on document type
//                                     file               // Current file
//                                 );

//                                 // console.log(` Uploading file: ${file.originalname}`);

//                                 // Upload the file to Google Drive
//                                 /* const folderId = await findOrCreateFolder(freightNumber);
//                                 console.log(` Folder ID: ${folderId}`);
//                                 console.log(file);

//                                 const { fileId, webViewLink } = await uploadFile(folderId, file);

//                                 // Insert file details into transaction_files
//                                 const insertFileQuery = `
//                                     INSERT INTO transaction_files 
//                                     (freight_number, file_name, drive_file_id, file_link) 
//                                     VALUES (?, ?, ?, ?)
//                                 `;

//                                 await new Promise((resolve, reject) => {
//                                     con.query(insertFileQuery, [freightNumber, file.filename, fileId, webViewLink], (err) => {
//                                         if (err) {
//                                             console.error("Error inserting file details:", err);
//                                             return reject(err);
//                                         }
//                                         resolve();
//                                     });
//                                 }); */

//                                 // console.log(`${documentName}: ${file.originalname} uploaded and recorded successfully!`);
//                             }
//                         } catch (error) {
//                             console.error(`Error processing files for ${documentName}:`, error);
//                         }
//                     };


//                     /* const handleFileUploads = async () => {
//                         try {
//                             if (req.files) {
//                                 const fileKeys = Object.keys(req.files);

//                                 for (const key of fileKeys) {
//                                     const files = Array.isArray(req.files[key]) ? req.files[key] : [req.files[key]];

//                                     if (files.length > 0) {
//                                         const documentName = getDocumentName(key);
//                                         // console.log(files, documentName, " Files to process");

//                                         await processFiles(files, documentName);
//                                     }
//                                 }

//                                 console.log("All files processed successfully!");
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
//                                 return "Supplier Invoices";
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
//                     handleFileUploads(); */
//                 });
//                 await processFiles(files, documentName);
//             });
//             res.send({ success: true, message: "success" })
//         });

//     } catch (error) {
//         // console.error('Error in Addfreight function:', error);
//         return res.status(500).json({
//             success: false,
//             message: error.message
//         });
//     }
// };


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

const Addfreight = async (req, res) => {
    try {
        const {
            client_ref, client_email, date, type, fcl_lcl, freight, incoterm, dimension, weight, quote_received, client_quoted, shipment_ref, insurance,
            is_active, comment, no_of_packages, package_type, commodity, hazardous, industry, country_of_origin, destination_country,
            supplier_address, shipper_name, port_of_loading, post_of_discharge, place_of_delivery, ready_for_collection, Product_Description,
            transit_time, priority, shipment_details, nature_of_hazard, volumetric_weight, assign_for_estimate, sales_representative, assign_to_transporter, assign_warehouse, assign_to_clearing, send_to_warehouse, shipment_origin, shipment_des, client_ref_name, add_attachments, documentName, weight_unit, dimension_unit, user_id
        } = req.body;
        // console.log(req.body);
        console.log(req.files);

        // console.log(req.body.documentName);
        // Generate freight number
        generateFreightNumber(async (err, freightNumber) => {
            if (err) throw err;

            // Insert freight into DB
            const insertResult = await new Promise((resolve, reject) => {
                insertQuery = `INSERT INTO tbl_freight (client_id, client_email, date, type, fcl_lcl, freight, incoterm, dimension, weight, 
            quote_received, client_quoted, is_active, comment, no_of_packages, package_type, commodity, hazardous, 
             collection_from, delivery_to, supplier_address, shipper_name, port_of_loading, post_of_discharge, place_of_delivery, 
            ready_for_collection, transit_time, priority, added_by, freight_number, shipment_details, 
            nature_of_hazard, volumetric_weight, assign_for_estimate, assign_to_transporter, assign_warehouse, assign_to_clearing, 
            send_to_warehouse, shipment_origin, shipment_des, product_desc, shipment_ref, insurance, client_ref_name, sales_representative, weight_unit, dimension_unit, user_id ) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?,?,?,?,?,?,?, ?, ?, ?)`;
                insertParams = [
                    client_ref, client_email, date, type, fcl_lcl || null, freight, incoterm, dimension, weight, quote_received, client_quoted,
                    is_active, comment, no_of_packages, package_type, commodity, hazardous, country_of_origin, destination_country,
                    supplier_address, shipper_name, port_of_loading, post_of_discharge, place_of_delivery, ready_for_collection,
                    transit_time, priority, 1, freightNumber, shipment_details, nature_of_hazard, volumetric_weight, assign_for_estimate,
                    assign_to_transporter, assign_warehouse, assign_to_clearing, send_to_warehouse, shipment_origin, shipment_des, Product_Description, shipment_ref, insurance, client_ref_name, sales_representative, weight_unit || null, dimension_unit || null, user_id || null
                ];
                con.query(insertQuery, insertParams, (err, result) => {
                    if (err) return reject(err);
                    resolve(result);
                });
            });

            // Create main freight folder
            const freightFolderId = await findOrCreateFolder(freightNumber);
            const selectQuery = `
            SELECT tbl_freight.freight_number, tbl_users.full_name, c.name AS collection_from_country, 
                   co.name AS delivery_to_country
            FROM tbl_freight
            LEFT JOIN tbl_users ON tbl_users.id = tbl_freight.client_id
             LEFT JOIN countries AS c ON c.id = tbl_freight.collection_from
            LEFT JOIN countries AS co ON co.id = tbl_freight.delivery_to
            WHERE tbl_freight.id = ?
        `;
            con.query(selectQuery, [insertResult.insertId], async (err, result) => {
                if (err || result.length === 0) return console.error("Error fetching client info:", err);

                const Email = client_email;
                const mailSubject = 'New Shipment Enquiry';
                //                 const content = `
                //                 <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; background-color: #f9f9f9;">
                //     <h2 style="color: #2c3e50; border-bottom: 1px solid #ccc; padding-bottom: 10px;">
                //         New Shipment Enquiry
                //     </h2>

                //     <p>Dear <strong>${result[0].full_name}</strong>,</p>

                //     <p>
                //         We’re excited to let you know that a new shipment enquiry has been created under your profile.
                //     </p>

                //     <p><strong>Shipment Details:</strong></p>

                //     <p>
                //         Freight Number: <strong>${result[0].freight_number}</strong><br>
                //         Product Description: <strong>${Product_Description}</strong><br>
                //         Freight: <strong>${freight}</strong><br>
                //         Type: <strong>${type}</strong><br>
                //         Origin: <strong>${result[0].collection_from_country}</strong><br>
                //         Port of Loading: <strong>${port_of_loading}</strong><br>
                //         Port of Discharge: <strong>${post_of_discharge}</strong><br>
                //         Final Destination: <strong>${result[0].delivery_to_country}</strong>
                //     </p>

                //     <p>
                //         Our sales team will reach out to you shortly with further details.  
                //         In the meantime, feel free to contact us if you have any questions or log in at  
                //         <a href="https://www.ship.asiadirect.africa" target="_blank">www.ship.asiadirect.africa</a>.
                //     </p>

                //     <p>
                //         Regards,<br>
                //         <strong>Management System</strong>
                //     </p>
                // </div>

                //             `;

                const content = `
                <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 20px auto; background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 25px; color: #333; font-size: 15px; line-height: 1.5;">

  <!-- Logo -->
  <div style="text-align: center; margin-bottom: 20px;">
    <img src="http://ship.asiadirect.africa/Admin/static/media/logotransparent.40e77f3a4e8fb45b5543.png" alt="Asia Direct" style="height: 80px;">
  </div>

  <!-- Heading -->
  <h2 style="border-bottom: 1px solid #ccc; padding-bottom: 10px; margin-top: 0; color: #222;">New Shipment Enquiry</h2>

  <!-- Greeting -->
  <p>Dear <strong>${result[0].full_name || 'Customer'}</strong>,</p>

  <!-- Message -->
  <p>We’re excited to let you know that a new shipment enquiry has been created under your profile.</p>

  <!-- Shipment Details Table -->
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-family: Arial, sans-serif;">
  <tr>
    <td style="width: 50%; vertical-align: top; padding-right: 15px;">
      <div style="padding: 3px 5px;"><strong>Freight Number:</strong> ${result[0].freight_number}</div>
      <div style="padding: 3px 5px;"><strong>Product Description:</strong> ${Product_Description}</div>
      <div style="padding: 3px 5px;"><strong>Freight:</strong> ${freight}</div>
      <div style="padding: 3px 5px;"><strong>Type:</strong> ${type}</div>
    </td>
    <td style="width: 50%; vertical-align: top; padding-left: 15px;">
      <div style="padding: 3px 5px;"><strong>Origin:</strong> ${result[0].collection_from_country}</div>
      <div style="padding: 3px 5px;"><strong>Port of Loading:</strong> ${port_of_loading}</div>
      <div style="padding: 3px 5px;"><strong>Port of Discharge:</strong> ${post_of_discharge}</div>
      <div style="padding: 3px 5px;"><strong>Final Destination:</strong> ${result[0].delivery_to_country}</div>
    </td>
  </tr>
</table>


  <p>Our sales team will reach out to you shortly with further details. In the meantime, feel free to contact us if you have any further questions or alternatively log in at <a href="https://www.ship.asiadirect.africa" style="color: #1e3a8a; font-weight: bold; text-decoration: underline;">www.ship.asiadirect.africa</a>.</p>

  <p>Best Regards,<br><strong>The Asia Direct Africa Team</strong></p>
</div> `;
                /*  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;  font-family: Arial, sans-serif;">
                    <tr>
                      <td style="width: 50%; vertical-align: top; padding-right: 15px;">
                        <table style="width: 100%; border-collapse: collapse;">
                          <tr><td style="font-weight: bold; padding: 3px 5px;">Freight Number:</td><td style="padding: 3px 0px;">${result[0].freight_number}</td></tr>
                          <tr><td style="font-weight: bold; padding: 3px 5px;">Product Description:</td><td style="padding: 3px 0px;">${Product_Description}</td></tr>
                          <tr><td style="font-weight: bold; padding: 3px 5px;">Freight:</td><td style="padding: 3px 0px;">${freight}</td></tr>
                          <tr><td style="font-weight: bold; padding: 3px 5px;">Type:</td><td style="padding: 3px 0px;">${type}</td></tr>
                        </table>
                      </td>
                      <td style="width: 50%; vertical-align: top; padding-left: 15px;">
                        <table style="width: 100%; border-collapse: collapse; text-align: left;">
                          <tr><td style="font-weight: bold; padding: 3px 5px;">Origin:</td><td style="padding: 3px 0px;">${result[0].collection_from_country}</td></tr>
                          <tr><td style="font-weight: bold; padding: 3px 5px;">Port of Loading:</td><td style="padding: 3px 0px;">${port_of_loading}</td></tr>
                          <tr><td style="font-weight: bold; padding: 3px 5px;">Port of Discharge:</td><td style="padding: 3px 0px;">${post_of_discharge}</td></tr>
                          <tr><td style="font-weight: bold; padding: 3px 5px;">Final Destination:</td><td style="padding: 3px 0px;">${result[0].delivery_to_country}</td></tr>
                        </table>
                      </td>
                    </tr>
                  </table> */

                sendMail(Email, mailSubject, content);

                // Process files dynamically
                // Example usage inside your Addfreight controller
                // if (req.files && Object.keys(req.files).length > 0) {
                //     for (const fieldName of Object.keys(req.files)) {
                //         const filesArray = req.files[fieldName];

                //         for (const file of filesArray) {
                //             const documentName = req.body.documentName; // sent from Postman
                //             console.log(documentName);

                //             await uploadToMatchingFolder(file, documentName, result[0].freight_number);

                //             // Save in DB
                //             const docQuery = `INSERT INTO freight_doc (freight_id, uploaded_by, document_name, document) VALUES (?, ?, ?, ?)`;
                //             await new Promise((resolve, reject) => {
                //                 con.query(docQuery, [insertResult.insertId, 1, documentName, file.filename], (err) => {
                //                     if (err) return reject(err);
                //                     resolve();
                //                 });
                //             });
                //         }
                //     }
                // }
                if (req.files && Object.keys(req.files).length > 0) {
                    for (const fieldName of Object.keys(req.files)) {
                        const filesArray = req.files[fieldName];

                        for (const file of filesArray) {
                            // Use fieldName as the document name for folder mapping
                            await uploadToMatchingFolder(file, fieldName, result[0].freight_number);

                            // Save in DB
                            const docQuery = `INSERT INTO freight_doc (freight_id, uploaded_by, document_name, document) VALUES (?, ?, ?, ?)`;
                            await new Promise((resolve, reject) => {
                                con.query(docQuery, [insertResult.insertId, 1, fieldName, file.filename], (err) => {
                                    if (err) return reject(err);
                                    resolve();
                                });
                            });
                        }
                    }
                }

            });
            res.json({ success: true, message: "Freight added successfully", freightNumber });
        });
    } catch (error) {
        console.error('AddFreight error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const getFolderNameFromDocumentName = (documentName) => {
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

function generateFreightNumber(callback) {
    try {
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
                const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
                const day = currentDate.getDate().toString().padStart(2, '0');

                if (rows.length > 0) {
                    const lastFreightNumber = rows[0].freight_number;

                    // Extract YYYYMMDD from freight number
                    const lastDatePart = lastFreightNumber.slice(2, 10);
                    const currentDatePart = `${year}${month}${day}`;

                    if (lastDatePart === currentDatePart) {
                        // Everything after YYYYMMDD is the sequence (no fixed 3-digit limit)
                        const lastSeq = parseInt(lastFreightNumber.substring(11));
                        sequenceNumber = lastSeq + 1;
                    }
                }

                // Format: F-YYYYMMDDNNN... (can go 001, 999, 1000, 1001, …)
                const freightNumber = `F-${year}${month}${day}${sequenceNumber.toString().padStart(3, '0')}`;

                callback(null, freightNumber);
            }
        );
    } catch (error) {
        callback(error);
    }
}

const GetFreightCustomer = async (req, res) => {
    const {
        status,
        priority,
        origin,
        destination,
        startDate,
        endDate,
        freightType,
        freightSpeed,
        user_id,
        search,
        page = 1,
        limit = 10
    } = req.body;

    try {
        if (!user_id) {
            return res.status(400).send({
                success: false,
                message: "user_id is required"
            });
        }

        /* ===== ALL ACCESS USERS ===== */
        const ALL_ACCESS_USERS = [1, 19855];

        /* ===== GET ACCESS COUNTRIES ===== */
        let accessCountries = [];

        if (!ALL_ACCESS_USERS.includes(Number(user_id))) {
            const userResult = await new Promise((resolve, reject) => {
                con.query(
                    `SELECT access_country FROM tbl_users WHERE id = ? AND is_deleted = 0`,
                    [user_id],
                    (err, rows) => {
                        if (err) return reject(err);
                        resolve(rows);
                    }
                );
            });

            if (!userResult.length) {
                return res.status(404).send({
                    success: false,
                    message: "User not found"
                });
            }

            if (userResult[0].access_country) {
                accessCountries = userResult[0].access_country
                    .split(',')
                    .map(id => Number(id.trim()));
            }
        }

        /* ===== BASE CONDITION ===== */
        let condition = `
            WHERE 
                tbl_freight.is_deleted = ?
                AND tbl_freight.added_by = ?
        `;
        let params = [0, 2];

        /* ===== MULTI COUNTRY ACCESS ===== */
        if (
            !ALL_ACCESS_USERS.includes(Number(user_id)) &&
            accessCountries.length
        ) {
            const placeholders = accessCountries.map(() => '?').join(',');

            condition += `
                AND (
                    tbl_freight.collection_from IN (${placeholders})
                    OR tbl_freight.delivery_to IN (${placeholders})
                )
            `;

            params.push(...accessCountries, ...accessCountries);
        }

        /* ===== FILTERS ===== */
        if (status !== undefined && status !== null) {
            condition += ` AND tbl_freight.status = ?`;
            params.push(status);
        }

        if (priority) {
            condition += ` AND tbl_freight.priority = ?`;
            params.push(priority);
        }

        if (origin) {
            condition += ` AND tbl_freight.collection_from = ?`;
            params.push(origin);
        }

        if (destination) {
            condition += ` AND tbl_freight.delivery_to = ?`;
            params.push(destination);
        }

        if (startDate && endDate) {
            condition += ` AND tbl_freight.date BETWEEN ? AND ?`;
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

        // Add global search condition across multiple fields
        if (search) {
            condition += ` AND (
                tbl_freight.freight_number LIKE ?
                OR client_user.full_name LIKE ?
                OR client_user.email LIKE ?
                OR tbl_freight.product_desc LIKE ?
                OR cm.name LIKE ?
                OR tbl_freight.shipment_details LIKE ?
                OR tbl_freight.comment LIKE ?
                OR ts.name LIKE ?
                OR c.name LIKE ?
                OR co.name LIKE ?
            )`;
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam);
        }

        /* ===== BASE QUERY FOR JOINS AND CONDITIONS ===== */
        const baseQuery = `
            FROM tbl_freight
            LEFT JOIN tbl_suppliers as ts on ts.id = tbl_freight.supplier_task_assign_id
            LEFT JOIN tbl_users as tu on tu.id = tbl_freight.staff_assign_id

            INNER JOIN tbl_users AS client_user
                ON client_user.id = tbl_freight.client_id

            LEFT JOIN estimate_shipping_quote esq
                ON esq.freight_id = tbl_freight.id

            LEFT JOIN countries AS c
                ON c.id = tbl_freight.collection_from

            LEFT JOIN countries AS co
                ON co.id = tbl_freight.delivery_to

            LEFT JOIN tbl_commodity AS cm
                ON cm.id = tbl_freight.commodity

            ${condition}
        `;

        /* ===== COUNT QUERY ===== */
        const countQuery = `
            SELECT COUNT(DISTINCT tbl_freight.id) AS total
            ${baseQuery}
        `;

        const totalResult = await new Promise((resolve, reject) => {
            con.query(countQuery, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });

        const total = totalResult[0].total;

        /* ===== PAGINATION ===== */
        const offset = (page - 1) * limit;

        /* ===== MAIN QUERY WITH PAGINATION ===== */
        const query = `
            SELECT DISTINCT
                tbl_freight.id AS freight_id,
                esq.id AS quote_estimate_id,
                ts.name as assigned_supplier_name,
                tbl_freight.freight_number,
                tbl_freight.insurance,
                tbl_freight.fcl_lcl,
                tbl_freight.assign_to_clearing,
                tbl_freight.assign_warehouse,
                tbl_freight.client_id,
                tbl_freight.staff_assign_id as staff_id,
                tu.full_name as staff_name,
                tbl_freight.product_desc,
                tbl_freight.collection_from,
                tbl_freight.commodity,
                cm.name AS commodity_name,
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

                client_user.id AS client_id,
                client_user.full_name AS client_name,
                client_user.client_number,
                client_user.email AS client_email,
                client_user.address_1,
                client_user.address_2,
                client_user.cellphone,
                client_user.telephone,

                c.name AS collection_from_country,
                co.name AS delivery_to_country

            ${baseQuery}
            ORDER BY tbl_freight.created_at DESC
            LIMIT ? OFFSET ?
        `;

        // Add limit and offset to params
        const dataParams = [...params, limit, offset];

        con.query(query, dataParams, (err, data) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: err.message
                });
            }

            // Always return success with data (empty array if no records), total, page, limit
            return res.status(200).send({
                success: true,
                data: data,
                total: total,
                page: parseInt(page),
                limit: parseInt(limit)
            });
        });

    } catch (error) {
        return res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

const EditFreight = async (req, res) => {
    try {
        // Extracting data from req.body
        console.log(req.body);
        console.log(req.files);
        console.log(req.body.documentName);

        const {
            id, // Assuming you will pass the ID of the freight to be updated
            client_ref, client_email, date, type, freight, fcl_lcl, incoterm, dimension, weight, quote_received, client_quoted, shipment_ref, insurance,
            is_active, comment, no_of_packages, package_type, commodity, hazardous, country_of_origin, destination_country,
            supplier_address, port_of_loading, post_of_discharge, place_of_delivery, ready_for_collection,
            transit_time, priority, shipment_details, nature_of_hazard, volumetric_weight, assign_for_estimate,
            assign_to_transporter, assign_warehouse, assign_to_clearing, send_to_warehouse, shipment_origin, shipment_des, client_ref_name,
            product_desc, sales_representative, weight_unit, dimension_unit
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
                send_to_warehouse = ?, shipment_origin = ?, shipment_des = ?, client_ref_name=?, sales_representative=?, weight_unit=?, dimension_unit=?
            WHERE id = ?
        `;

        const updateParams = [
            client_ref, client_email, date, type, freight, fcl_lcl || null, shipment_ref, insurance, incoterm, dimension, weight, quote_received, product_desc, client_quoted, is_active, comment,
            no_of_packages, package_type, commodity, hazardous, country_of_origin, destination_country, supplier_address,
            port_of_loading, post_of_discharge, place_of_delivery, ready_for_collection, transit_time, priority, shipment_details,
            nature_of_hazard, volumetric_weight, assign_for_estimate, assign_to_transporter, assign_warehouse,
            assign_to_clearing, send_to_warehouse, shipment_origin, shipment_des, client_ref_name, sales_representative, weight_unit || null, dimension_unit || null, id
        ];

        const result = await con.query(updateQuery, updateParams);

        // Check if result is as expected
        if (Array.isArray(result) && result[0].affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Freight not found"
            });
        }


        const selectQuery = `SELECT tbl_freight.freight_number, tbl_freight.client_id, us.full_name as sales_full_name, us.email as sale_email,
                us.cellphone as sales_person_phone, us.country_code as sales_person_country_code, u.full_name
                FROM tbl_freight
                LEFT JOIN tbl_users as us ON us.id = tbl_freight.sales_representative
                LEFT JOIN tbl_users as u ON u.id = tbl_freight.client_id
                WHERE tbl_freight.id = ?`;

        con.query(selectQuery, [id], async (err, result) => {
            if (err) {
                console.error("Error fetching freight number:", err);
                return;
            }
            console.log(result);

            if (result.length === 0) {
                console.error("No freight number found for the given ID.");
                return;
            }

            const freightNumber = result[0].freight_number;
            const mailSubject = 'Shipment Details Amended';

            const contentTemplate = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; background-color: #f9f9f9;">
    <h2 style="color: #2c3e50; border-bottom: 1px solid #ccc; padding-bottom: 10px;">Shipment Details Amended</h2>

    <p style="font-size: 16px; color: #333;">
      Hi,
    </p>

    <p style="font-size: 16px; color: #333;">
      The shipment details have been amended.<br>
      Please check the updated shipment details in the system.
    </p>

    <p style="font-size: 16px; color: #333;">
      <strong>Freight Number:</strong> ${freightNumber}
    </p>

    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">

    <p style="font-size: 14px; color: #777;">
      Regards,<br>
      <strong>Management System</strong>
    </p>
  </div>
`;
            // console.log(result[0].sales_email);


            sendMail(result[0].sale_email, mailSubject, contentTemplate);


            /* wrong // sendMail(estimatesTeamEmail, mailSubject, contentTemplate); */

            const whatsappMessage = `
            Shipment details have been amended.
            
            Freight Number: ${freightNumber}
            You can proceed with the shipment (freights).
            
            Please check the updated details.
            `;
            // const salesPersonPhone = result[0].sales_person_phone;
            // // 05-06-2025
            // /* sendWhatsApp(salesPersonPhone, whatsappMessage); */

            // //////////  02/01/2026     /////////////////
            // sendWhatsApp(salesPersonPhone, 'shipment_freight_updated', {
            //     "1": freightNumber
            // });

            // 2/18/2026
            const salesPersonPhone = result[0].sales_person_phone;
            const salesPersonCountryCode = result[0].sales_person_country_code;

            if (salesPersonPhone && salesPersonCountryCode) {

                const formattedPhone = formatTwilioWhatsAppNumber(
                    salesPersonCountryCode,
                    salesPersonPhone
                );

                await sendWhatsApp(
                    formattedPhone,
                    'shipment_freight_updated',
                    {
                        "1": freightNumber
                    }
                );

            } else {
                console.warn("Missing sales person phone or country code");
            }

            // Send email and WhatsApp to all team members
            const teamQuery = `SELECT full_name, email, cellphone, country_code FROM tbl_users WHERE user_type = 2 AND FIND_IN_SET(1, assigned_roles) AND is_deleted=0 AND status=1`;

            con.query(teamQuery, async (err, teamMembers) => {
                if (err) {
                    console.error("Error fetching team members:", err);
                    return;
                }

                // for (const member of teamMembers) {
                //     // Send Email
                //     await sendMail(member.email, mailSubject, contentTemplate);

                //     // Send WhatsApp
                //     const formattedPhone = member.cellphone.startsWith('+') ? member.cellphone : `+${member.cellphone}`;
                //     // 05-06-2025
                //     /* await sendWhatsApp(formattedPhone, whatsappMessage); */
                //     //////////  02/01/2026     /////////////////
                //     sendWhatsApp(formattedPhone, 'shipment_freight_updated', {
                //         "1": freightNumber
                //     });
                // }

                // 1/18/2026
                for (const member of teamMembers) {

                    // Send Email
                    await sendMail(member.email, mailSubject, contentTemplate);

                    // Skip if phone or country code missing
                    if (!member.cellphone || !member.country_code) {
                        console.warn(`Missing phone/country code for ${member.email}`);
                        continue;
                    }

                    // Use your helper function (already defined above)
                    const formattedPhone = formatTwilioWhatsAppNumber(
                        member.country_code,
                        member.cellphone
                    );

                    if (!formattedPhone) {
                        console.warn(`Invalid phone format for ${member.email}`);
                        continue;
                    }

                    // IMPORTANT: Twilio requires whatsapp: prefix
                    await sendWhatsApp(
                        formattedPhone,
                        'shipment_freight_updated',
                        {
                            "1": freightNumber
                        }
                    );
                }

                // console.log("Notifications sent to all team members.");
            });


            // Send WhatsApp to Estimates Team
            // const estimatesTeamPhone = result[0].estimates_team_phone;
            // sendWhatsApp(estimatesTeamPhone, whatsappMessage);

            // Process all files for a given document type
            // const processFiles = async (fileArray, documentName) => {
            //     try {
            //         for (const file of fileArray) { // Loop through all files
            //             const docsInsertQuery = `INSERT INTO freight_doc (freight_id, document_name, document) VALUES (?, ?, ?)`;

            //             await new Promise((resolve, reject) => {
            //                 con.query(docsInsertQuery, [id, documentName, file.filename], (err) => {
            //                     if (err) {
            //                         console.error(`Error inserting ${documentName}:`, err);
            //                         return reject(err);
            //                     }
            //                     resolve();
            //                 });
            //             });

            //             console.log(` Uploading file: ${file.originalname}`);

            //             const subfolderName = getFolderNameFromDocumentName(documentName); // returns "AD_Quotations" etc.

            //             const uploadResult = await uploadToSpecificPath(
            //                 freightNumber,     // Main folder: e.g., "F-20250613"
            //                 "Supplier Invoices",      // Parent folder or fixed main type
            //                 subfolderName,     // Subfolder based on document type
            //                 file               // Current file
            //             );

            //             // Upload the file to Google Drive
            //             /* const folderId = await findOrCreateFolder(freightNumber);
            //             console.log(` Folder ID: ${folderId}`);
            //             console.log(file);

            //             const { fileId, webViewLink } = await uploadFile(folderId, file);

            //             // Insert file details into transaction_files
            //             const insertFileQuery = `
            //                     INSERT INTO transaction_files 
            //                     (freight_number, file_name, drive_file_id, file_link) 
            //                     VALUES (?, ?, ?, ?)
            //                 `;

            //             await new Promise((resolve, reject) => {
            //                 con.query(insertFileQuery, [freightNumber, file.filename, fileId, webViewLink], (err) => {
            //                     if (err) {
            //                         console.error("Error inserting file details:", err);
            //                         return reject(err);
            //                     }
            //                     resolve();
            //                 });
            //             }); */

            //             console.log(`${documentName}: ${file.originalname} uploaded and recorded successfully!`);
            //         }
            //     } catch (error) {
            //         console.error(`Error processing files for ${documentName}:`, error);
            //     }
            // };

            // const handleFileUploads = async () => {
            //     try {
            //         if (req.files) {
            //             const fileKeys = Object.keys(req.files);

            //             for (const key of fileKeys) {
            //                 const files = Array.isArray(req.files[key]) ? req.files[key] : [req.files[key]];

            //                 if (files.length > 0) {
            //                     const documentName = getDocumentName(key);
            //                     console.log(files, documentName, " Files to process");

            //                     await processFiles(files, documentName);
            //                 }
            //             }

            //             console.log("All files processed successfully!");
            //         }
            //     } catch (error) {
            //         console.error("Error handling file uploads:", error);
            //     }
            // };


            // // Map field names to document names
            // const getDocumentName = (fieldName) => {
            //     console.log(fieldName);

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
            // };

            // // Start processing all files
            // handleFileUploads();
            // const freightFolderId = await findOrCreateFolder(freightNumber);
            if (req.files && Object.keys(req.files).length > 0) {
                for (const fieldName of Object.keys(req.files)) {
                    const filesArray = req.files[fieldName];

                    for (const file of filesArray) {
                        // const documentName = req.body.documentName; // sent from Postman
                        console.log(file, fieldName);

                        await uploadToMatchingFolder(file, fieldName, freightNumber);

                        // Save in DB
                        const docQuery = `INSERT INTO freight_doc (freight_id, uploaded_by, document_name, document) VALUES (?, ?, ?, ?)`;
                        await new Promise((resolve, reject) => {
                            con.query(docQuery, [id, 1, fieldName, file.filename], (err) => {
                                if (err) return reject(err);
                                resolve();
                            });
                        });
                    }
                }
            }
        });

        res.status(200).json({
            success: true,
            message: "Freight updated successfully",
            data: req.body
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
            return res.status(400).send({
                success: false,
                message: "Please provide freight id"
            });
        }

        const selectQuery = `SELECT is_deleted, freight_number FROM tbl_freight WHERE id = ?`;
        con.query(selectQuery, [freight_id], (err, result) => {
            if (err) throw err;

            if (result.length === 0) {
                return res.status(400).send({
                    success: false,
                    message: "Data not found"
                });
            }

            const { is_deleted, freight_number } = result[0];

            if (is_deleted == 1) {
                return res.status(400).send({
                    success: false,
                    message: "Freight already deleted"
                });
            }

            const updateQuery = `UPDATE tbl_freight SET is_deleted = ? WHERE id = ?`;
            con.query(updateQuery, [1, freight_id], async (err, updateResult) => {
                if (err) throw err;

                if (updateResult.affectedRows > 0) {
                    try {
                        // delete freight docs
                        await con.query(`DELETE FROM freight_doc WHERE freight_id = ?`, [freight_id]);

                        // delete folder by freight_number
                        await deleteFolderByName(freight_number);

                        return res.status(200).send({
                            success: true,
                            message: "Freight deleted successfully"
                        });
                    } catch (error) {
                        return res.status(500).send({
                            success: false,
                            message: "Freight updated but error while deleting related files: " + error.message
                        });
                    }
                } else {
                    return res.status(400).send({
                        success: false,
                        message: "Failed to delete freight"
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

// const getCountryOriginList = async (req, res) => {
//     try {
//         // SQL query to select all country_origin records
//         const selectAllQuery = `
//             SELECT id,
//                 country_id,
//                 city_id,
//                 sea_port,
//                 land_port,
//                 air_port
//             FROM country_origin
//             WHERE is_deleted = 0
//         `;

//         // Execute the query to get all country_origin records
//         con.query(selectAllQuery, async (err, records) => {
//             if (err) {
//                 return res.status(500).send({
//                     success: false,
//                     message: "Error fetching data",
//                     error: err.message
//                 });
//             }

//             // Collect all unique IDs from the records
//             const allIds = new Set();
//             const allCountryIds = new Set();

//             records.forEach(record => {
//                 if (record.city_id) record.city_id.split(',').forEach(id => allIds.add(id.trim()));
//                 if (record.sea_port) record.sea_port.split(',').forEach(id => allIds.add(id.trim()));
//                 if (record.land_port) record.land_port.split(',').forEach(id => allIds.add(id.trim()));
//                 if (record.air_port) record.air_port.split(',').forEach(id => allIds.add(id.trim()));
//                 allCountryIds.add(record.country_id); // Collect all country IDs
//             });

//             // Fetch names for all collected city IDs
//             const idsArray = Array.from(allIds);
//             const fetchNamesQuery = `SELECT id, name FROM cities WHERE id IN (${idsArray.map(() => '?').join(',')})`;
//             const fetchCountryNamesQuery = `SELECT id, name FROM countries WHERE id IN (${Array.from(allCountryIds).map(() => '?').join(',')})`;

//             // Execute the queries
//             con.query(fetchNamesQuery, idsArray, (err, cityNames) => {
//                 if (err) {
//                     return res.status(500).send({
//                         success: false,
//                         message: "Error fetching city names",
//                         error: err.message
//                     });
//                 }

//                 con.query(fetchCountryNamesQuery, Array.from(allCountryIds), (err, countryNames) => {
//                     if (err) {
//                         return res.status(500).send({
//                             success: false,
//                             message: "Error fetching country names",
//                             error: err.message
//                         });
//                     }

//                     // Create maps for easy lookup
//                     const nameMap = cityNames.reduce((acc, curr) => {
//                         acc[curr.id] = curr.name;
//                         return acc;
//                     }, {});

//                     const countryNameMap = countryNames.reduce((acc, curr) => {
//                         acc[curr.id] = curr.name;
//                         return acc;
//                     }, {});

//                     // Process records to include names in the response
//                     const formattedResults = records.map(record => {
//                         return {
//                             id: record.id,
//                             country_id: record.country_id,
//                             country_name: countryNameMap[record.country_id] || 'Unknown',
//                             cities: record.city_id ? record.city_id.split(',').map(id => ({
//                                 id: id.trim(),
//                                 name: nameMap[id.trim()] || 'Unknown'
//                             })) : [],
//                             sea_ports: record.sea_port ? record.sea_port.split(',').map(id => ({
//                                 id: id.trim(),
//                                 name: nameMap[id.trim()] || 'Unknown'
//                             })) : [],
//                             land_ports: record.land_port ? record.land_port.split(',').map(id => ({
//                                 id: id.trim(),
//                                 name: nameMap[id.trim()] || 'Unknown'
//                             })) : [],
//                             air_ports: record.air_port ? record.air_port.split(',').map(id => ({
//                                 id: id.trim(),
//                                 name: nameMap[id.trim()] || 'Unknown'
//                             })) : []
//                         };
//                     });

//                     res.status(200).send({
//                         success: true,
//                         data: formattedResults
//                     });
//                 });
//             });
//         });
//     } catch (error) {
//         res.status(500).send({
//             success: false,
//             message: error.message
//         });
//     }
// };

const getQueryAsync = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        con.query(sql, params, (err, result) => {
            if (err) reject(err);
            else resolve(result);
        });
    });
};

// const getCountryOriginList = async (req, res) => {
//     try {
//         let { page = 1, limit = 10, search } = req.body;

//         page = parseInt(page);
//         limit = parseInt(limit);
//         const offset = (page - 1) * limit;

//         //  Paginated query
//         const dataQuery = `
//             SELECT id, country_id, city_id, sea_port, land_port, air_port
//             FROM country_origin
//             WHERE is_deleted = 0
//             ORDER BY id DESC
//             LIMIT ? OFFSET ?
//         `;

//         //  Count query
//         const countQuery = `
//             SELECT COUNT(*) AS total
//             FROM country_origin
//             WHERE is_deleted = 0
//         `;

//         // Run both queries in parallel 
//         const [records, countResult] = await Promise.all([
//             getQueryAsync(dataQuery, [limit, offset]),
//             getQueryAsync(countQuery)
//         ]);

//         // Collect IDs ONLY from paginated data
//         const allIds = new Set();
//         const allCountryIds = new Set();

//         records.forEach(record => {
//             if (record.city_id) record.city_id.split(',').forEach(id => allIds.add(id.trim()));
//             if (record.sea_port) record.sea_port.split(',').forEach(id => allIds.add(id.trim()));
//             if (record.land_port) record.land_port.split(',').forEach(id => allIds.add(id.trim()));
//             if (record.air_port) record.air_port.split(',').forEach(id => allIds.add(id.trim()));
//             if (record.country_id) allCountryIds.add(record.country_id);
//         });

//         const idsArray = Array.from(allIds);
//         const countryIdsArray = Array.from(allCountryIds);

//         //  Fetch names in parallel
//         const [cityNames, countryNames] = await Promise.all([
//             idsArray.length
//                 ? getQueryAsync(
//                     `SELECT id, name FROM cities WHERE id IN (${idsArray.map(() => '?').join(',')})`,
//                     idsArray
//                 )
//                 : [],
//             countryIdsArray.length
//                 ? getQueryAsync(
//                     `SELECT id, name FROM countries WHERE id IN (${countryIdsArray.map(() => '?').join(',')})`,
//                     countryIdsArray
//                 )
//                 : []
//         ]);

//         //  Create maps
//         const nameMap = {};
//         cityNames.forEach(c => nameMap[c.id] = c.name);

//         const countryNameMap = {};
//         countryNames.forEach(c => countryNameMap[c.id] = c.name);

//         //  Format response
//         const formattedResults = records.map(record => ({
//             id: record.id,
//             country_id: record.country_id,
//             country_name: countryNameMap[record.country_id] || 'Unknown',

//             cities: record.city_id
//                 ? record.city_id.split(',').map(id => ({
//                     id: id.trim(),
//                     name: nameMap[id.trim()] || 'Unknown'
//                 }))
//                 : [],

//             sea_ports: record.sea_port
//                 ? record.sea_port.split(',').map(id => ({
//                     id: id.trim(),
//                     name: nameMap[id.trim()] || 'Unknown'
//                 }))
//                 : [],

//             land_ports: record.land_port
//                 ? record.land_port.split(',').map(id => ({
//                     id: id.trim(),
//                     name: nameMap[id.trim()] || 'Unknown'
//                 }))
//                 : [],

//             air_ports: record.air_port
//                 ? record.air_port.split(',').map(id => ({
//                     id: id.trim(),
//                     name: nameMap[id.trim()] || 'Unknown'
//                 }))
//                 : []
//         }));

//         return res.status(200).send({
//             success: true,
//             data: formattedResults,
//             page,
//             limit,
//             total: countResult[0].total,
//             total_pages: Math.ceil(countResult[0].total / limit)
//         });

//     } catch (error) {
//         return res.status(500).send({
//             success: false,
//             message: error.message
//         });
//     }
// };

const getCountryOriginList = async (req, res) => {
    try {
        let { page = 1, limit = 10, search = '' } = req.body;

        page = parseInt(page);
        limit = parseInt(limit);
        const offset = (page - 1) * limit;

        let searchCondition = '';
        let searchParams = [];

        if (search) {
            searchCondition = `
                AND (
                    c.name LIKE ? 
                    OR EXISTS (
                        SELECT 1 FROM cities ci 
                        WHERE FIND_IN_SET(ci.id, co.city_id) 
                        AND ci.name LIKE ?
                    )
                )
            `;
            searchParams = [`%${search}%`, `%${search}%`];
        }

        //  Paginated query with JOIN
        const dataQuery = `
            SELECT co.id, co.country_id, co.city_id, co.sea_port, co.land_port, co.air_port
            FROM country_origin co
            LEFT JOIN countries c ON c.id = co.country_id
            WHERE co.is_deleted = 0
            ${searchCondition}
            ORDER BY co.id DESC
            LIMIT ? OFFSET ?
        `;

        //  Count query
        const countQuery = `
            SELECT COUNT(*) AS total
            FROM country_origin co
            LEFT JOIN countries c ON c.id = co.country_id
            WHERE co.is_deleted = 0
            ${searchCondition}
        `;

        // Run queries
        const [records, countResult] = await Promise.all([
            getQueryAsync(dataQuery, [...searchParams, limit, offset]),
            getQueryAsync(countQuery, searchParams)
        ]);

        // Collect IDs
        const allIds = new Set();
        const allCountryIds = new Set();

        records.forEach(record => {
            if (record.city_id) record.city_id.split(',').forEach(id => allIds.add(id.trim()));
            if (record.sea_port) record.sea_port.split(',').forEach(id => allIds.add(id.trim()));
            if (record.land_port) record.land_port.split(',').forEach(id => allIds.add(id.trim()));
            if (record.air_port) record.air_port.split(',').forEach(id => allIds.add(id.trim()));
            if (record.country_id) allCountryIds.add(record.country_id);
        });

        const idsArray = Array.from(allIds);
        const countryIdsArray = Array.from(allCountryIds);

        // Fetch names
        const [cityNames, countryNames] = await Promise.all([
            idsArray.length
                ? getQueryAsync(
                    `SELECT id, name FROM cities WHERE id IN (${idsArray.map(() => '?').join(',')})`,
                    idsArray
                )
                : [],
            countryIdsArray.length
                ? getQueryAsync(
                    `SELECT id, name FROM countries WHERE id IN (${countryIdsArray.map(() => '?').join(',')})`,
                    countryIdsArray
                )
                : []
        ]);

        // Maps
        const nameMap = {};
        cityNames.forEach(c => nameMap[c.id] = c.name);

        const countryNameMap = {};
        countryNames.forEach(c => countryNameMap[c.id] = c.name);

        // Format response
        const formattedResults = records.map(record => ({
            id: record.id,
            country_id: record.country_id,
            country_name: countryNameMap[record.country_id] || 'Unknown',

            cities: record.city_id
                ? record.city_id.split(',').map(id => ({
                    id: id.trim(),
                    name: nameMap[id.trim()] || 'Unknown'
                }))
                : [],

            sea_ports: record.sea_port
                ? record.sea_port.split(',').map(id => ({
                    id: id.trim(),
                    name: nameMap[id.trim()] || 'Unknown'
                }))
                : [],

            land_ports: record.land_port
                ? record.land_port.split(',').map(id => ({
                    id: id.trim(),
                    name: nameMap[id.trim()] || 'Unknown'
                }))
                : [],

            air_ports: record.air_port
                ? record.air_port.split(',').map(id => ({
                    id: id.trim(),
                    name: nameMap[id.trim()] || 'Unknown'
                }))
                : []
        }));

        return res.status(200).send({
            success: true,
            data: formattedResults,
            page,
            limit,
            total: countResult[0].total,
            total_pages: Math.ceil(countResult[0].total / limit)
        });

    } catch (error) {
        return res.status(500).send({
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
        const selectQuery = `select id, full_name as client_name, client_number, client_ref, email from tbl_users 
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

const addEstimateShippingQuote = async (req, res) => {
    try {
        const data = req.body;
        console.log(req.body);
        let selectQuery = "";
        let selectParams = [];

        console.log(data);


        if (data.quote_estimate_id) {

            // Admin update specific quote
            selectQuery = `
         SELECT id as quote_estimate_id 
         FROM estimate_shipping_quote 
         WHERE id = ?
         `;
            selectParams = [data.quote_estimate_id];

        } else {

            // Supplier quote check
            selectQuery = `
         SELECT id as quote_estimate_id 
         FROM estimate_shipping_quote 
         WHERE freight_id = ? AND supplier_id = ?
           `;
            selectParams = [data.freight_id, data.supplier_id];

        }

        // if (data.quote_estimate_id) {
        //     selectQuery += `id = ?`;
        //     selectParams.push(data.quote_estimate_id);
        // } else {
        //     // selectQuery += `freight_id = ? AND client_id = ?`;
        //     // selectParams.push(data.freight_id, data.client_id);
        //     selectQuery += `1 = 0`;
        // }

        con.query(selectQuery, selectParams, (err, result) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: err.message
                });
            }

            if (result.length > 0) {

                const updateQuery = `
                    UPDATE estimate_shipping_quote SET
                        supplier_id=?,
                        client_name=?, serial_number=?, date=?, client_ref=?, product_desc=?,
                        type=?, freight=?, incoterm=?, dimension=?, weight=?,

                        origin_pick_up_cost=?, origin_pick_up_fees=?, origin_pickup_fee_gpcalc=?,
                        oripick4=?, finalori1=?, roe_origin_currencyorigin=?, finalvlaueoriginPickup=?,

                        origin_pick_up_fuel_cost=?, origin_pick_up_fuel_fees=?, origin_pick_fuelGP=?,
                        orifuel4=?, finalfuel1=?, roe_origin_fuel_currency=?, finalvlaueoFuel=?,

                        origin_pick_up_cfs_cost=?, origin_pick_up_cfs_fees=?, origin_pickup_vfs_gp=?,
                        oricfs4=?, finalcfs1=?, roe_origin_cfs_currency=?, finalvlaueocfs=?,

                        origin_pick_up_documantion_cost=?, origin_pick_up_documantation_fees=?,
                        origin_pick_documantation_cost_gp=?, oridoc4=?, finaldoc1=?,
                        roe_origin_doc_currency=?, finalvlaueodoc=?,

                        origin_pick_up_forewarding_cost=?, origin_pick_up_forewarding_fees=?,
                        origin_pickup_forewarding_gp=?, oriforewarding4=?, roe_origin_forewarding=?,
                        finalforewarding1=?, finalvlaueoforewarding=?,

                        origin_pick_up_custome_cost=?, origin_pick_up_custome_clearance=?,
                        origin_pickup_custome_gp=?, oricustome4=?, roe_origin_customes=?,
                        finalcustomes1=?, finalvlaueoCustomes=?,

                        totalChageswithOutExchange=?, totalChangeRoeOrigin=?,

                        freight_charge_currency_cost=?, freight_charge_currency_fees=?,
                        freight_charge_currency_gp=?, orifreight4=?,
                        finalValuefreight=?, finalfreight1=?, finalvlaueofreight=?,

                        freight_currency_insurance_cost=?, freightorigin_insurance_gp=?,
                        freight_currency_insurance_unit=?, oriinsurance4=?,
                        roe_insurance_currency=?, finalinsurance1=?, finalvlaueoInsurance=?,

                        totalChageswithOutExchangeinsurance=?,
                        totalChangeRoeOriginaftercalcuinsurance=?,

                        Transit_currency_Cost=?, Transit_currency_gp=?, Transit_currency_unit=?,
                        finaltransit1=?, oritransit4=?, Transit_currency_roe=?,
                        finalvlaueotransit=?,

                        transit_currency_THC_cost=?, transit_currency_THC_init=?,
                        transit_currency_THC_gp=?, oriThc4=?, finalThc1=?,
                        finalvlaueotfineal=?, roe_Transit_Thc=?,

                        Transit_currency_unpack_cost=?, Transit_currency_unpack_unit=?,
                        Transit_currency_unpack_gp=?, finalunpack1=?, oriunpack4=?,
                        finalvlaueotfunpack=?, Transit_unpack_roe=?,

                        totalChaDestinationTransit=?, totalChaDestinationTransitRoe=?,
                        sumofall=?, sumofRoe=?,
                        transit_3rd_party_cost=?,
                        transit_3rd_party_unit=?,
                        transit_3rd_party_gp=?,
                        ori3rdparty4=?,
                        final3rdparty1=?,
                        finalvlaueot3dparty=?,
                        transit_currency_3rd=?,

                        transit_admin_change=?,
                        transit_admin_unit=?,
                        transit_admin_gp=?,
                        ori3rdAdmin4=?,
                        final3rdAdmin1=?,
                        finalvlaueotAdmin=?,
                        roe_transit_admin=?,

                        transit_currency_port=?,
                        transit_currency_port_unit=?,
                        transit_currency_port_gp=?,
                        ori3rdport4=?,
                        final3rdport1=?,
                        finalvlaueotPort=?,
                        roe_trans_port=?,

                        Transit_advanced_load=?,
                        Transit_advanced_unit=?,
                        Transit_advanced_gp=?,
                        oriadv4=?,
                        final3rdadv1=?,
                        finalvlaueotadv=?,
                        Transit_advanced_gp_roe=?,

                        transit_change_Documentation=?,
                        transit_change_Documentation_unit=?,
                        oridocumentation4=?,
                        transit_change_Documentation_gp=?,
                        final3rdocumantation1=?,
                        finalvlaueotDocumantation=?,
                        roe_transit_change_Documentation=?,

                        totalChageswithOuTransit=?,
                        transitRoe=?,

                        Destination_freight_currency_cost=?,
                        Destination_freight_currency_unit=?,
                        Destination_freight_currency_gp=?,
                        destinationdocumentation4=?,
                        final3rdestinationRoe=?,
                        final3rdestination1=?,
                        Destination_freight_currency_Roe=?,

                        Destination_THC_currency_cost=?,
                        Destination_THC_currency_unit=?,
                        Destination_THC_currency_gp=?,
                        destinationTHCdocumentation4=?,
                        final3rTHCdestination1=?,
                        final3rTHCdestinationRoe=?,
                        Destination_THC_currency_Roe=?,

                        Destination_Unpack_currency_cost=?,
                        Destination_Unpack_currency_unit=?,
                        Destination_Unpack_currency_gp=?,
                        destinationUnpackdocumentation4=?,
                        Destination_Unpack_currency_roe=?,
                        final3rUnpackdestinationRoe=?,
                        final3runpackdestination1=?,

                        totaAdminransit=?,
                        totalAdminnsitRoe=?,

                        Destination_fuelsurcharge_currency_cost = ?,
                        Destination_fuelsurcharge_currency_unit = ?,
                        Destination_fuelsurcharge_currency_gp = ?,
                        destinationfuelsurchargedocumentation4 = ?,
                        final3rfuelsurchargedestination1 = ?,
                        final3rfuelsurCahrgeestinationRoe = ?,
                        Destination_fuelsurcharge_currency_roe = ?,

                        Destination_adminsurcharge_currency_cost = ?,
                        Destination_adminsurcharge_currency_unit = ?,
                        Destination_adminsurcharge_currency_gp = ?,
                        destinatiadminsurcharge4 = ?,
                        Valueadminsurchargedestanion = ?,
                        adminsurcharge2 = ?,
                        Destination_adminsurcharge_currency_roe = ?,

                        Destination_portcargo_currency_cost = ?,
                        Destination_portcargo_currency_unit = ?,
                        Destination_portcargo_currency_gp = ?,
                        destinatiportcargo4 = ?,
                        Vaportcargoion = ?,
                        admiportcargo2 = ?,
                        Destination_portcargo_currency_roe = ?,

                        Destination_AdvancedLoad_currency_cost = ?,
                        Destination_AdvancedLoad_currency_unit = ?,
                        Destination_AdvancedLoad_currency_gp = ?,
                        destinatiAdvancedLoad4 = ?,
                        VAdvancedLoadion = ?,
                        desdvancedLoadion = ?,
                        Destination_AdvancedLoad_currency_roe = ?,

                        Destination_3rdpartyDesc_currency_cost = ?,
                        Destination_3rdpartyDesc_currency_unit = ?,
                        Destination_3rdpartyDesc_currency_gp = ?,
                        destinati3rdpartyload4 = ?,
                        VAdvanced3rdpartyLoadion = ?,
                        desdva3rdpartyion = ?,
                        Destination_3rdpartyDesc_currency_roe = ?,

                        Destination_delivery_currency_cost = ?,
                        Destination_delivery_currency_unit = ?,
                        Destination_delivery_currency_gp = ?,
                        destindeliveryyDesc4 = ?,
                        VAdvandeliverytyLoadion = ?,
                        desddeliverytyion = ?,
                        Destination_delivery_currency_roe = ?,

                        Destination_fuelcharge_currency_cost = ?,
                        Destination_fuelcharge_currency_unit = ?,
                        Destination_fuelcharge_currency_gp = ?,
                        destindfuelchangerDesc4 = ?,
                        VAdvfuelchangeon = ?,
                        defuelchangyion = ?,
                        Destination_fuelcharge_currency_roe = ?,

                        Destination_AdminAgrncy_currency_cost = ?,
                        Destination_AdminAgrncy_currency_unit = ?,
                        Destination_AdminAgrncy_currency_gp = ?,
                        deadminAgencyesc4 = ?,
                        VAadminAgencyngeon = ?,
                        defuelchdminAgencyngangyion = ?,
                        Destination_AdminAgrncy_currency_roe = ?,

                        Destination_disbursemant_currency_cost = ?,
                        Destination_disbursemant_currency_unit = ?,
                        Destination_disbursemant_currency_gp = ?,
                        deaddisbursemantc4 = ?,
                        VAdisbursemon = ?,
                        dedisbursementon = ?,
                        Destination_disbursemant_currency_roe = ?,

                        Destination_doc_currency_cost = ?,
                        Destination_doc_currency_unit = ?,
                        Destination_doc_currency_gp = ?,
                        deadoctc4 = ?,
                        VAdocon = ?,
                        dedisbudoon = ?,
                        Destination_doc_currency_roe = ?,
                        roe_freight_currency = ?,

                        freight_charge_currency = ?,
                        freight_charge_currency_unitType = ?,
                        freight_currency_insurance_unittype = ?,

                        origin_pick_up_unitType = ?,
                        origin_pick_up_fuel_unitType = ?,
                        origin_pick_up_cfs_unitType = ?,
                        origin_pick_up_documantation_unitType = ?,
                        origin_pick_up_forewarding_unitType = ?,
                        origin_pick_up_custome_unitType = ?,

                        Transit_currency_unitTpe = ?,
                        transit_currency_THC_initType = ?,
                        Transit_currency_unpack_unitType = ?,
                        transit_3rd_party_unittype = ?,
                        transit_admin_unittype = ?,
                        transit_currency_port_unitType = ?,
                        Transit_advanced_unitType = ?,
                        transit_change_Documentation_unitType = ?,

                        Destination_freight_currency_unitType = ?,
                        Destination_THC_currency_unitType = ?,
                        Destination_Unpack_currency_unitType = ?,
                        Destination_fuelsurcharge_currency_typeUnit = ?,
                        Destination_adminsurcharge_currency_unitType = ?,
                        Destination_portcargo_currency_unitType = ?,
                        Destination_AdvancedLoad_currency_unitType = ?,
                        Destination_3rdpartyDesc_currency_unitType = ?,
                        Destination_delivery_currency_unitType = ?,
                        Destination_fuelcharge_currency_unitType = ?,

                        Destination_AdminAgrncy_currency_unitType = ?,
                        Destination_disbursemant_currency_unitType = ?,
                        Destination_doc_currency_unittype = ?,

                        freight_charge_currencyQTY = ?,
                        origin_pick_up_fuel_unitTypeQTY = ?,
                        origin_pick_up_cfs_unitTypeQTY = ?,
                        origin_pick_up_forewarding_unitTypeQTY = ?,
                        origin_pick_up_documantation_unitTypeQTY = ?,
                        origin_pick_up_custome_unitTypeQTY = ?,
                        chargable_rate = ?,
                        freight_charge_currency_unitTypeQTY = ?,
                        freight_currency_insurance_unittypeQTY = ?,

                        Transit_currency_unitTpeQTY = ?,
                        transit_currency_THC_initTypeQTY = ?,
                        transit_currency_THC_initTypeeQTY = ?,
                        transit_3rd_party_unittypeQTY = ?,
                        transit_admin_unittypeQTY = ?,
                        transit_currency_port_unitTypeQTY = ?,
                        Transit_advanced_unitTypeQTY = ?,
                        transit_change_Documentation_unitTypeQTY = ?,

                        Destination_freight_currency_unitTypeQTY = ?,
                        Destination_THC_currency_unitTypeQTY = ?,
                        Destination_Unpack_currency_unitTypeQTY = ?,
                        Destination_fuelsurcharge_currency_typeUnitQTY = ?,
                        Destination_adminsurcharge_currency_unitTypeQTY = ?,
                        Destination_portcargo_currency_unitTypeQTY = ?,
                        Destination_AdvancedLoad_currency_unitTypeQTY = ?,
                        Destination_3rdpartyDesc_currency_unitTypeQTY = ?,
                        Destination_delivery_currency_unitTypeQTY = ?,
                        Destination_fuelcharge_currency_unitTypeQTY = ?,
                        Destination_AdminAgrncy_currency_unitQTY = ?,
                        Destination_disbursemant_currency_unitTypeQTY = ?,
                        Destination_doc_currency_unittypeQTY = ?,
                        pickup_freight_currency =?,
                        Transit_currency=?,
                        Destination_freight_currency=?,
                        admin_currency_charge=?,
                        Destination_disbursemant_currenc_unitType1=?
                    WHERE id=?
                `;

                const updateParams = [
                    data.supplier_id,

                    data.client_name, data.serial_number, data.date, data.client_ref, data.product_desc,
                    data.type, data.freight, data.incoterm, data.dimension, data.weight,

                    data.origin_pick_up_cost, data.origin_pick_up_fees, data.origin_pickup_fee_gpcalc,
                    data.oripick4, data.finalori1, data.roe_origin_currencyorigin, data.finalvlaueoriginPickup,

                    data.origin_pick_up_fuel_cost, data.origin_pick_up_fuel_fees, data.origin_pick_fuelGP,
                    data.orifuel4, data.finalfuel1, data.roe_origin_fuel_currency, data.finalvlaueoFuel,

                    data.origin_pick_up_cfs_cost, data.origin_pick_up_cfs_fees, data.origin_pickup_vfs_gp,
                    data.oricfs4, data.finalcfs1, data.roe_origin_cfs_currency, data.finalvlaueocfs,

                    data.origin_pick_up_documantion_cost, data.origin_pick_up_documantation_fees,
                    data.origin_pick_documantation_cost_gp, data.oridoc4, data.finaldoc1,
                    data.roe_origin_doc_currency, data.finalvlaueodoc,

                    data.origin_pick_up_forewarding_cost, data.origin_pick_up_forewarding_fees,
                    data.origin_pickup_forewarding_gp, data.oriforewarding4, data.roe_origin_forewarding,
                    data.finalforewarding1, data.finalvlaueoforewarding,

                    data.origin_pick_up_custome_cost, data.origin_pick_up_custome_clearance,
                    data.origin_pickup_custome_gp, data.oricustome4, data.roe_origin_customes,
                    data.finalcustomes1, data.finalvlaueoCustomes,

                    data.totalChageswithOutExchange, data.totalChangeRoeOrigin,

                    data.freight_charge_currency_cost, data.freight_charge_currency_fees,
                    data.freight_charge_currency_gp, data.orifreight4,
                    data.finalValuefreight, data.finalfreight1, data.finalvlaueofreight,

                    data.freight_currency_insurance_cost, data.freightorigin_insurance_gp,
                    data.freight_currency_insurance_unit, data.oriinsurance4,
                    data.roe_insurance_currency, data.finalinsurance1, data.finalvlaueoInsurance,

                    data.totalChageswithOutExchangeinsurance,
                    data.totalChangeRoeOriginaftercalcuinsurance,

                    data.Transit_currency_Cost, data.Transit_currency_gp, data.Transit_currency_unit,
                    data.finaltransit1, data.oritransit4, data.Transit_currency_roe,
                    data.finalvlaueotransit,

                    data.transit_currency_THC_cost, data.transit_currency_THC_init,
                    data.transit_currency_THC_gp, data.oriThc4, data.finalThc1,
                    data.finalvlaueotfineal, data.roe_Transit_Thc,

                    data.Transit_currency_unpack_cost, data.Transit_currency_unpack_unit,
                    data.Transit_currency_unpack_gp, data.finalunpack1, data.oriunpack4,
                    data.finalvlaueotfunpack, data.Transit_unpack_roe,

                    data.totalChaDestinationTransit, data.totalChaDestinationTransitRoe,
                    data.sumofall, data.sumofRoe,

                    data.transit_3rd_party_cost,
                    data.transit_3rd_party_unit,
                    data.transit_3rd_party_gp,
                    data.ori3rdparty4,
                    data.final3rdparty1,
                    data.finalvlaueot3dparty,
                    data.transit_currency_3rd,

                    data.transit_admin_change,
                    data.transit_admin_unit,
                    data.transit_admin_gp,
                    data.ori3rdAdmin4,
                    data.final3rdAdmin1,
                    data.finalvlaueotAdmin,
                    data.roe_transit_admin,

                    data.transit_currency_port,
                    data.transit_currency_port_unit,
                    data.transit_currency_port_gp,
                    data.ori3rdport4,
                    data.final3rdport1,
                    data.finalvlaueotPort,
                    data.roe_trans_port,

                    data.Transit_advanced_load,
                    data.Transit_advanced_unit,
                    data.Transit_advanced_gp,
                    data.oriadv4,
                    data.final3rdadv1,
                    data.finalvlaueotadv,
                    data.Transit_advanced_gp_roe,

                    data.transit_change_Documentation,
                    data.transit_change_Documentation_unit,
                    data.oridocumentation4,
                    data.transit_change_Documentation_gp,
                    data.final3rdocumantation1,
                    data.finalvlaueotDocumantation,
                    data.roe_transit_change_Documentation,

                    data.totalChageswithOuTransit,
                    data.transitRoe,

                    data.Destination_freight_currency_cost,
                    data.Destination_freight_currency_unit,
                    data.Destination_freight_currency_gp,
                    data.destinationdocumentation4,
                    data.final3rdestinationRoe,
                    data.final3rdestination1,
                    data.Destination_freight_currency_Roe,

                    data.Destination_THC_currency_cost,
                    data.Destination_THC_currency_unit,
                    data.Destination_THC_currency_gp,
                    data.destinationTHCdocumentation4,
                    data.final3rTHCdestination1,
                    data.final3rTHCdestinationRoe,
                    data.Destination_THC_currency_Roe,

                    data.Destination_Unpack_currency_cost,
                    data.Destination_Unpack_currency_unit,
                    data.Destination_Unpack_currency_gp,
                    data.destinationUnpackdocumentation4,
                    data.Destination_Unpack_currency_roe,
                    data.final3rUnpackdestinationRoe,
                    data.final3runpackdestination1,

                    data.totaAdminransit,
                    data.totalAdminnsitRoe,

                    data.Destination_fuelsurcharge_currency_cost,
                    data.Destination_fuelsurcharge_currency_unit,
                    data.Destination_fuelsurcharge_currency_gp,
                    data.destinationfuelsurchargedocumentation4,
                    data.final3rfuelsurchargedestination1,
                    data.final3rfuelsurCahrgeestinationRoe,
                    data.Destination_fuelsurcharge_currency_roe,

                    data.Destination_adminsurcharge_currency_cost,
                    data.Destination_adminsurcharge_currency_unit,
                    data.Destination_adminsurcharge_currency_gp,
                    data.destinatiadminsurcharge4,
                    data.Valueadminsurchargedestanion,
                    data.adminsurcharge2,
                    data.Destination_adminsurcharge_currency_roe,

                    data.Destination_portcargo_currency_cost,
                    data.Destination_portcargo_currency_unit,
                    data.Destination_portcargo_currency_gp,
                    data.destinatiportcargo4,
                    data.Vaportcargoion,
                    data.admiportcargo2,
                    data.Destination_portcargo_currency_roe,

                    data.Destination_AdvancedLoad_currency_cost,
                    data.Destination_AdvancedLoad_currency_unit,
                    data.Destination_AdvancedLoad_currency_gp,
                    data.destinatiAdvancedLoad4,
                    data.VAdvancedLoadion,
                    data.desdvancedLoadion,
                    data.Destination_AdvancedLoad_currency_roe,

                    data.Destination_3rdpartyDesc_currency_cost,
                    data.Destination_3rdpartyDesc_currency_unit,
                    data.Destination_3rdpartyDesc_currency_gp,
                    data.destinati3rdpartyload4,
                    data.VAdvanced3rdpartyLoadion,
                    data.desdva3rdpartyion,
                    data.Destination_3rdpartyDesc_currency_roe,

                    data.Destination_delivery_currency_cost,
                    data.Destination_delivery_currency_unit,
                    data.Destination_delivery_currency_gp,
                    data.destindeliveryyDesc4,
                    data.VAdvandeliverytyLoadion,
                    data.desddeliverytyion,
                    data.Destination_delivery_currency_roe,

                    data.Destination_fuelcharge_currency_cost,
                    data.Destination_fuelcharge_currency_unit,
                    data.Destination_fuelcharge_currency_gp,
                    data.destindfuelchangerDesc4,
                    data.VAdvfuelchangeon,
                    data.defuelchangyion,
                    data.Destination_fuelcharge_currency_roe,

                    data.Destination_AdminAgrncy_currency_cost,
                    data.Destination_AdminAgrncy_currency_unit,
                    data.Destination_AdminAgrncy_currency_gp,
                    data.deadminAgencyesc4,
                    data.VAadminAgencyngeon,
                    data.defuelchdminAgencyngangyion,
                    data.Destination_AdminAgrncy_currency_roe,

                    data.Destination_disbursemant_currency_cost,
                    data.Destination_disbursemant_currency_unit,
                    data.Destination_disbursemant_currency_gp,
                    data.deaddisbursemantc4,
                    data.VAdisbursemon,
                    data.dedisbursementon,
                    data.Destination_disbursemant_currency_roe,

                    data.Destination_doc_currency_cost,
                    data.Destination_doc_currency_unit,
                    data.Destination_doc_currency_gp,
                    data.deadoctc4,
                    data.VAdocon,
                    data.dedisbudoon,
                    data.Destination_doc_currency_roe,
                    data.roe_freight_currency,

                    data.freight_charge_currency,
                    data.freight_charge_currency_unitType,
                    data.freight_currency_insurance_unittype,

                    data.origin_pick_up_unitType,
                    data.origin_pick_up_fuel_unitType,
                    data.origin_pick_up_cfs_unitType,
                    data.origin_pick_up_documantation_unitType,
                    data.origin_pick_up_forewarding_unitType,
                    data.origin_pick_up_custome_unitType,

                    data.Transit_currency_unitTpe,
                    data.transit_currency_THC_initType,
                    data.Transit_currency_unpack_unitType,
                    data.transit_3rd_party_unittype,
                    data.transit_admin_unittype,
                    data.transit_currency_port_unitType,
                    data.Transit_advanced_unitType,
                    data.transit_change_Documentation_unitType,

                    data.Destination_freight_currency_unitType,
                    data.Destination_THC_currency_unitType,
                    data.Destination_Unpack_currency_unitType,
                    data.Destination_fuelsurcharge_currency_typeUnit,
                    data.Destination_adminsurcharge_currency_unitType,
                    data.Destination_portcargo_currency_unitType,
                    data.Destination_AdvancedLoad_currency_unitType,
                    data.Destination_3rdpartyDesc_currency_unitType,
                    data.Destination_delivery_currency_unitType,
                    data.Destination_fuelcharge_currency_unitType,

                    data.Destination_AdminAgrncy_currency_unitType,
                    data.Destination_disbursemant_currency_unitType,
                    data.Destination_doc_currency_unittype,

                    data.freight_charge_currencyQTY,
                    data.origin_pick_up_fuel_unitTypeQTY,
                    data.origin_pick_up_cfs_unitTypeQTY,
                    data.origin_pick_up_forewarding_unitTypeQTY,
                    data.origin_pick_up_documantation_unitTypeQTY,
                    data.origin_pick_up_custome_unitTypeQTY,
                    data.chargable_rate,
                    data.freight_charge_currency_unitTypeQTY,
                    data.freight_currency_insurance_unittypeQTY,

                    data.Transit_currency_unitTpeQTY,
                    data.transit_currency_THC_initTypeQTY,
                    data.transit_currency_THC_initTypeeQTY,
                    data.transit_3rd_party_unittypeQTY,
                    data.transit_admin_unittypeQTY,
                    data.transit_currency_port_unitTypeQTY,
                    data.Transit_advanced_unitTypeQTY,
                    data.transit_change_Documentation_unitTypeQTY,

                    data.Destination_freight_currency_unitTypeQTY,
                    data.Destination_THC_currency_unitTypeQTY,
                    data.Destination_Unpack_currency_unitTypeQTY,
                    data.Destination_fuelsurcharge_currency_typeUnitQTY,
                    data.Destination_adminsurcharge_currency_unitTypeQTY,
                    data.Destination_portcargo_currency_unitTypeQTY,
                    data.Destination_AdvancedLoad_currency_unitTypeQTY,
                    data.Destination_3rdpartyDesc_currency_unitTypeQTY,
                    data.Destination_delivery_currency_unitTypeQTY,
                    data.Destination_fuelcharge_currency_unitTypeQTY,
                    data.Destination_AdminAgrncy_currency_unitQTY,
                    data.Destination_disbursemant_currency_unitTypeQTY,
                    data.Destination_doc_currency_unittypeQTY,
                    data.pickup_freight_currency,
                    data.Transit_currency,
                    data.Destination_freight_currency,
                    data.admin_currency_charge,
                    data.Destination_disbursemant_currenc_unitType1,
                    result[0].quote_estimate_id
                ];

                con.query(updateQuery, updateParams, (err, updateData) => {
                    if (err) {
                        return res.status(500).send({
                            success: false,
                            message: err.message
                        });
                    }
                    if (data.user_type == "1" || data.user_type == "2") {
                        con.query(
                            `UPDATE tbl_freight SET status=?, shipping_estimate_id=?, estimate_date=NOW() WHERE id=?`,
                            [4, result[0].quote_estimate_id, data.freight_id]
                        );
                    }

                    return res.status(200).send({
                        success: true,
                        message: "Estimate shipping quote updated successfully"
                    });
                });

            }
            /* ================= INSERT ================= */
            else {

                const insertQuery = `INSERT INTO estimate_shipping_quote SET ?`;

                con.query(insertQuery, data, (err, insertData) => {
                    if (err) {
                        return res.status(500).send({
                            success: false,
                            message: err.message
                        });
                    }

                    if (data.user_type == "1" || data.user_type == "2") {
                        con.query(
                            `UPDATE tbl_freight SET status=?, shipping_estimate_id=?, estimate_date=NOW() WHERE id=?`,
                            [4, insertData.insertId, data.freight_id]
                        );
                    }

                    return res.status(200).send({
                        success: true,
                        message: "Estimate shipping quote added successfully",
                        ID: insertData.insertId
                    });
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

const GetQuoteShipEstimateById = async (req, res) => {
    try {
        const { quote_estimate_id, freight_id, supplier_id } = req.body;

        if (!quote_estimate_id) {
            return res.status(400).json({
                success: false,
                message: "quote_estimate_id is required"
            });
        }

        let selectQuery = `
            SELECT 
                estimate_shipping_quote.*,
                estimate_shipping_quote.id AS quote_estimate_id
            FROM estimate_shipping_quote
            WHERE estimate_shipping_quote.id = ?
        `;

        const queryParams = [quote_estimate_id];

        // Optional freight filter
        if (freight_id) {
            selectQuery += ` AND estimate_shipping_quote.freight_id = ?`;
            queryParams.push(freight_id);
        }

        // Optional supplier filter
        if (supplier_id) {
            selectQuery += ` AND estimate_shipping_quote.supplier_id = ?`;
            queryParams.push(supplier_id);
        }

        con.query(selectQuery, queryParams, (err, data) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: err.message
                });
            }

            if (!data || data.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Data not found"
                });
            }

            return res.status(200).json({
                success: true,
                data: data[0]
            });
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const GetQuoteShipEstimateBySupplier = async (req, res) => {
    try {
        const { freight_id, supplier_id } = req.body;

        if (!freight_id || !supplier_id) {
            return res.status(400).json({
                success: false,
                message: "freight_id and supplier_id are required"
            });
        }

        let selectQuery = `
            SELECT 
    estimate_shipping_quote.*,
    tbl_freight.*,
    estimate_shipping_quote.id AS quote_estimate_id
FROM estimate_shipping_quote
LEFT JOIN tbl_freight 
    ON estimate_shipping_quote.freight_id = tbl_freight.id
WHERE estimate_shipping_quote.freight_id = ?
  AND estimate_shipping_quote.supplier_id = ?
        `;

        const queryParams = [freight_id, supplier_id];

        con.query(selectQuery, queryParams, (err, data) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: err.message
                });
            }

            if (!data || data.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Data not found"
                });
            }

            return res.status(200).json({
                success: true,
                data: data[0]
            });
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

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

const Shipping_Estimate_supplier = async (req, res) => {

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

        await con.query(`SELECT id FROM shipping_estimate WHERE freight_id='${freight_id}' AND supplier_id='${supplier_id}'`, async (err, result) => {
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
                        console.log(freight_id),
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
        const { estimate_id, freight_id, supplier_id } = req.body;

        if (!supplier_id) {
            return res.status(400).json({
                success: false,
                message: "supplier_id is required"
            });
        }

        if (!estimate_id && !freight_id) {
            return res.status(400).json({
                success: false,
                message: "Please provide estimate_id or freight_id"
            });
        }

        const selectQuery = `
            SELECT 
                shipping_estimate.*, 
                shipping_estimate.id AS estimate_id, 
                shipping_estimate.final_currency AS final_base_currency, 
                shipping_estimate.ROE_freight AS Roefreight, 
                shipping_estimate.ROE_origin_currency AS roe_origin_currency,
                shipping_estimate.ROE_des_currency AS roe_des_currency
            FROM shipping_estimate
            WHERE (shipping_estimate.id = ? OR shipping_estimate.freight_id = ?)
            AND shipping_estimate.supplier_id = ?
        `;

        con.query(selectQuery, [estimate_id, freight_id, supplier_id], (err, data) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: err.message
                });
            }

            if (data.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Data not found"
                });
            }

            return res.status(200).json({
                success: true,
                data: data[0]
            });
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const GetShipEstimateSupplierId = async (req, res) => {
    try {
        const { supplier_id, freight_id } = req.body;

        if (!supplier_id || !freight_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide supplier_id and freight_id"
            });
        }

        const selectQuery = `
            SELECT 
                se.*, 
                se.final_currency AS final_base_currency,
                se.ROE_freight AS Roefreight,
                se.ROE_origin_currency AS roe_origin_currency,
                se.ROE_des_currency AS roe_des_currency,

                -- Freight Table Columns
                f.id AS freight_id_value,
                f.freight_number,
                f.client_email,
                f.clearance_id,
                f.isConfirmed,
                f.product_desc AS freight_product_desc,
                f.date AS freight_date,
                f.type AS freight_type,
                f.weight AS freight_weight,
                f.dimension AS freight_dimension,
                f.status AS freight_status,
                f.quote_received,
                f.client_quoted,
                f.attachment_Estimate,
                f.estimate_date

            FROM shipping_estimate AS se
            LEFT JOIN tbl_freight AS f ON se.freight_id = f.id 
            LEFT JOIN tbl_users AS ss ON ss.id = f.sales_representative
            LEFT JOIN tbl_users AS u ON u.id = f.client_id
            LEFT JOIN countries AS c ON c.id = f.delivery_to
            LEFT JOIN countries AS co ON co.id = f.collection_from
            LEFT JOIN tbl_commodity AS cm ON cm.id = f.commodity
            WHERE se.supplier_id = ? 
            AND se.freight_id = ?
            AND se.is_deleted = 0
            LIMIT 1
        `;

        // FROM tbl_freight
        //     LEFT JOIN tbl_users AS ss ON ss.id = tbl_freight.sales_representative
        //     LEFT JOIN tbl_users ON tbl_users.id = tbl_freight.client_id
        //     LEFT JOIN countries AS c ON c.id = tbl_freight.delivery_to
        //     LEFT JOIN countries AS co ON co.id = tbl_freight.collection_from
        //     LEFT JOIN shipping_estimate  AS s ON s.freight_id = tbl_freight.id
        //     LEFT JOIN tbl_commodity  AS cm ON cm.id = tbl_freight.commodity
        //     ${condition}
        //     GROUP BY tbl_freight.id
        //     ORDER BY tbl_freight.created_at DESC`;


        con.query(selectQuery, [supplier_id, freight_id], (err, data) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: err.message
                });
            }

            if (data.length === 0) {
                return res.status(404).send({
                    success: false,
                    message: "Data not Found"
                });
            }

            return res.status(200).send({
                success: true,
                data: data[0]
            });
        });

    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

// const ApproveShippingEstimate = (req, res) => {
//     const { freight_id, supplier_id, status } = req.body;

//     if (!freight_id || !supplier_id || ![1, 2].includes(status)) {
//         return res.status(400).json({
//             success: false,
//             message: "freight_id, supplier_id and valid status (1=Approved, 2=Rejected) are required"
//         });
//     }

//     con.getConnection((err, connection) => {
//         if (err) {
//             return res.status(500).json({
//                 success: false,
//                 message: "Database connection failed"
//             });
//         }

//         connection.beginTransaction((err) => {
//             if (err) {
//                 connection.release();
//                 return res.status(500).json({
//                     success: false,
//                     message: "Transaction start failed"
//                 });
//             }

//             /* ================= CHECK FREIGHT ================= */
//             connection.query(
//                 `SELECT id, assign_id, isConfirmed 
//                  FROM tbl_freight 
//                  WHERE id = ? AND is_deleted = 0`,
//                 [freight_id],
//                 (err, freightRows) => {

//                     if (err) return rollback(connection, res, err);

//                     if (!freightRows.length) {
//                         connection.release();
//                         return res.status(404).json({
//                             success: false,
//                             message: "Freight not found"
//                         });
//                     }

//                     const freight = freightRows[0];

//                     if (freight.isConfirmed === 1) {
//                         connection.release();
//                         return res.status(400).json({
//                             success: false,
//                             message: "Freight already confirmed. No further changes allowed."
//                         });
//                     }

//                     /* ================= CHECK IF ANY SUPPLIER ALREADY APPROVED ================= */
//                     connection.query(
//                         `SELECT id FROM estimate_shipping_quote
//                          WHERE freight_id = ? AND is_approved = 1`,
//                         [freight_id],
//                         (err, approvedRows) => {

//                             if (err) return rollback(connection, res, err);

//                             if (approvedRows.length > 0 && status === 1) {
//                                 connection.release();
//                                 return res.status(400).json({
//                                     success: false,
//                                     message: "One supplier is already approved for this freight"
//                                 });
//                             }

//                             /* ================= CHECK SUPPLIER ASSIGNED ================= */
//                             const assignedSuppliers = freight.assign_id
//                                 ? freight.assign_id.split(",")
//                                 : [];

//                             if (!assignedSuppliers.includes(String(supplier_id))) {
//                                 connection.release();
//                                 return res.status(400).json({
//                                     success: false,
//                                     message: "Supplier not assigned to this freight"
//                                 });
//                             }

//                             /* ================= CHECK ESTIMATE EXISTS ================= */
//                             connection.query(
//                                 `SELECT id FROM estimate_shipping_quote
//                                  WHERE freight_id = ? AND supplier_id = ?`,
//                                 [freight_id, supplier_id],
//                                 (err, estimateRows) => {

//                                     if (err) return rollback(connection, res, err);

//                                     if (!estimateRows.length) {
//                                         connection.release();
//                                         return res.status(404).json({
//                                             success: false,
//                                             message: "Shipping estimate not found"
//                                         });
//                                     }

//                                     const estimateId = estimateRows[0].id;

//                                     /* ================= IF APPROVE ================= */
//                                     if (status === 1) {

//                                         connection.query(
//                                             `UPDATE estimate_shipping_quote 
//                                              SET is_approved = 1
//                                              WHERE id = ?`,
//                                             [estimateId],
//                                             (err) => {

//                                                 if (err) return rollback(connection, res, err);

//                                                 connection.query(
//                                                     `UPDATE estimate_shipping_quote
//                                                      SET is_approved = 2
//                                                      WHERE freight_id = ?
//                                                      AND supplier_id != ?`,
//                                                     [freight_id, supplier_id],
//                                                     (err) => {

//                                                         if (err) return rollback(connection, res, err);

//                                                         connection.query(
//                                                             `UPDATE tbl_freight
//                                                              SET shipping_estimate_id = ?,
//                                                                  isConfirmed = 1
//                                                              WHERE id = ?`,
//                                                             [estimateId, freight_id],
//                                                             (err) => {

//                                                                 if (err) return rollback(connection, res, err);

//                                                                 con.query(
//                                                                     `UPDATE tbl_freight SET status=?, estimate_date=NOW() WHERE id=?`,
//                                                                     [4, data.freight_id]
//                                                                 );

//                                                                 commitAndRespond(connection, res, {
//                                                                     message: "Supplier approved successfully",
//                                                                     freight_id,
//                                                                     supplier_id,
//                                                                     status: 1
//                                                                 });
//                                                             }
//                                                         );
//                                                     }
//                                                 );
//                                             }
//                                         );

//                                     } else {

//                                         /* ================= REJECT ================= */
//                                         connection.query(
//                                             `UPDATE estimate_shipping_quote
//                                              SET is_approved = 2
//                                              WHERE id = ?`,
//                                             [estimateId],
//                                             (err) => {

//                                                 if (err) return rollback(connection, res, err);

//                                                 commitAndRespond(connection, res, {
//                                                     message: "Supplier rejected successfully",
//                                                     freight_id,
//                                                     supplier_id,
//                                                     status: 2
//                                                 });
//                                             }
//                                         );
//                                     }
//                                 }
//                             );
//                         }
//                     );
//                 }
//             );
//         });
//     });
// };


const ApproveShippingEstimate = (req, res) => {
    let { freight_id, supplier_id, status } = req.body;

    // FIX: ensure status is number
    status = Number(status);

    if (!freight_id || !supplier_id || ![1, 2].includes(status)) {
        return res.status(400).json({
            success: false,
            message: "freight_id, supplier_id and valid status (1=Approved, 2=Rejected) are required"
        });
    }

    con.getConnection((err, connection) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: "Database connection failed"
            });
        }

        connection.beginTransaction((err) => {
            if (err) {
                connection.release();
                return res.status(500).json({
                    success: false,
                    message: "Transaction start failed"
                });
            }

            connection.query(
                `SELECT id, assign_id, isConfirmed 
                 FROM tbl_freight 
                 WHERE id = ? AND is_deleted = 0`,
                [freight_id],
                (err, freightRows) => {

                    if (err) return rollback(connection, res, err);

                    if (!freightRows.length) {
                        connection.release();
                        return res.status(404).json({
                            success: false,
                            message: "Freight not found"
                        });
                    }

                    const freight = freightRows[0];

                    if (freight.isConfirmed === 1) {
                        connection.release();
                        return res.status(400).json({
                            success: false,
                            message: "Freight already confirmed"
                        });
                    }

                    connection.query(
                        `SELECT id FROM estimate_shipping_quote
                         WHERE freight_id = ? AND is_approved = 1`,
                        [freight_id],
                        (err, approvedRows) => {

                            if (err) return rollback(connection, res, err);

                            if (approvedRows.length > 0 && status === 1) {
                                connection.release();
                                return res.status(400).json({
                                    success: false,
                                    message: "One supplier already approved"
                                });
                            }

                            const assignedSuppliers = freight.assign_id
                                ? freight.assign_id.split(",")
                                : [];

                            if (!assignedSuppliers.includes(String(supplier_id))) {
                                connection.release();
                                return res.status(400).json({
                                    success: false,
                                    message: "Supplier not assigned"
                                });
                            }

                            connection.query(
                                `SELECT id FROM estimate_shipping_quote
                                 WHERE freight_id = ? AND supplier_id = ?`,
                                [freight_id, supplier_id],
                                (err, estimateRows) => {

                                    if (err) return rollback(connection, res, err);

                                    if (!estimateRows.length) {
                                        connection.release();
                                        return res.status(404).json({
                                            success: false,
                                            message: "Estimate not found"
                                        });
                                    }

                                    const estimateId = estimateRows[0].id;

                                    /*  APPROVE */
                                    if (status === 1) {

                                        connection.query(
                                            `UPDATE estimate_shipping_quote 
                                             SET is_approved = 1
                                             WHERE id = ?`,
                                            [estimateId],
                                            (err) => {

                                                if (err) return rollback(connection, res, err);

                                                connection.query(
                                                    `UPDATE estimate_shipping_quote
                                                     SET is_approved = 2
                                                     WHERE freight_id = ?
                                                     AND supplier_id != ?`,
                                                    [freight_id, supplier_id],
                                                    (err) => {

                                                        if (err) return rollback(connection, res, err);

                                                        connection.query(
                                                            `UPDATE tbl_freight
                                                             SET shipping_estimate_id = ?,
                                                                 isConfirmed = 1,
                                                                 status = 4,
                                                                 estimate_date = NOW()
                                                             WHERE id = ?`,
                                                            [estimateId, freight_id],
                                                            (err) => {

                                                                if (err) return rollback(connection, res, err);

                                                                commitAndRespond(connection, res, {
                                                                    message: "Supplier approved successfully",
                                                                    freight_id,
                                                                    supplier_id,
                                                                    status: 1
                                                                });
                                                            }
                                                        );
                                                    }
                                                );
                                            }
                                        );

                                    } else {
                                        /*  REJECT */
                                        connection.query(
                                            `UPDATE estimate_shipping_quote
                                             SET is_approved = 2
                                             WHERE id = ?`,
                                            [estimateId],
                                            (err) => {

                                                if (err) return rollback(connection, res, err);

                                                commitAndRespond(connection, res, {
                                                    message: "Supplier rejected successfully",
                                                    freight_id,
                                                    supplier_id,
                                                    status: 2
                                                });
                                            }
                                        );
                                    }
                                }
                            );
                        }
                    );
                }
            );
        });
    });
};

function rollback(connection, res, err) {
    connection.rollback(() => {
        connection.release();
        return res.status(500).send({
            success: false,
            message: err.message || "Database error"
        });
    });
}

function commitAndRespond(connection, res, data) {
    connection.commit((err) => {
        if (err) return rollback(connection, res, err);

        connection.release();
        return res.status(200).json({
            success: true,
            ...data
        });
    });
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
        // send_to = 1(All Staff), 2(All Client), 3(Particular staff), 4(Particular client), 5(Multiple Users), 6(Batch Users)
        const { send_to, user_id, title, description, send_whatsapp, batch_id } = req.body;

        const documentPath = req.files && req.files.length > 0
            ? req.files.map(file => file.filename).join(',')
            : null;
        // console.log("Document Path:", documentPath);
        // console.log("Resolved Path:", documentPath ? path.resolve(documentPath) : null);
        console.log("Uploaded files:", req.files.map(f => f.filename));

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
                        const InsertQuery = `insert into tbl_notifications (title, description, send_to, document) values (?,?,?,?)`;
                        con.query(InsertQuery, [title, description, 1, documentPath], (err, data) => {
                            if (err) throw err;
                            if (data.affectedRows > 0) {

                                results.forEach((user) => {
                                    const insertNotificationSql = 'INSERT INTO notification_details (user_id, notification_id) VALUES (?, ?)';
                                    con.query(insertNotificationSql, [user.id, data.insertId], (err, result) => {
                                        if (err) throw err;
                                    });
                                    const emailSql = 'SELECT email, full_name FROM tbl_users WHERE id = ?';
                                    con.query(emailSql, [user.id], (err, emailResult) => {
                                        if (err) return console.error(err);
                                        if (emailResult.length > 0) {
                                            const Email = emailResult[0].email;
                                            const fullName = emailResult[0].full_name;
                                            const mailSubject = title;
                                            const content = `<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f4f4f4" style="font-family: Arial, sans-serif;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 8px; margin: 40px auto; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);">
        <tr>
          <td style="padding: 30px; color: #333333; font-size: 16px; line-height: 1.6;">
            <p style="margin-bottom: 20px;">Hi <strong>${fullName}</strong>,</p>
            <p style="margin-bottom: 20px;">${description}</p>
            <p style="margin-top: 40px;">Regards,<br><strong>AsiaDirect</strong></p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`;
                                            const attachments = req.files && req.files.length > 0
                                                ? req.files.map(file => ({
                                                    filename: file.originalname,
                                                    path: path.resolve(`public/documents/${file.filename}`)
                                                }))
                                                : [];
                                            sendMail(Email, mailSubject, content, attachments);
                                        }
                                    })
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

                const getUsersSql = 'SELECT id FROM tbl_users WHERE user_type = ? AND is_deleted = ?';

                con.query(getUsersSql, [3, 0], (err, results) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).send({
                            success: false,
                            message: "Database error"
                        });
                    }

                    if (results.length === 0) {
                        return res.status(400).send({
                            success: false,
                            message: "User not found"
                        });
                    }

                    const InsertQuery = `
            INSERT INTO tbl_notifications (title, description, send_to, document)
            VALUES (?, ?, ?, ?)
        `;

                    con.query(InsertQuery, [title, description, 2, documentPath], (err, data) => {
                        if (err) {
                            console.error(err);
                            return res.status(500).send({
                                success: false,
                                message: "Failed to send notification"
                            });
                        }

                        if (data.affectedRows > 0) {

                            results.forEach((user) => {

                                // insert notification_details
                                const insertNotificationSql =
                                    'INSERT INTO notification_details (user_id, notification_id) VALUES (?, ?)';

                                con.query(insertNotificationSql, [user.id, data.insertId], (err) => {
                                    if (err) console.error(err);
                                });

                                // get email & send mail
                                const emailSql = 'SELECT email, full_name FROM tbl_users WHERE id = ?';

                                con.query(emailSql, [user.id], (err, emailResult) => {
                                    if (err) return console.error(err);

                                    if (emailResult.length > 0) {

                                        const Email = emailResult[0].email;
                                        const fullName = emailResult[0].full_name;

                                        const content = `
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f4f4f4" style="font-family: Arial, sans-serif;">
<tr>
<td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;margin:40px auto;box-shadow:0 4px 10px rgba(0,0,0,0.05);">
<tr>
<td style="padding:30px;color:#333;font-size:16px;line-height:1.6;">
<p>Hi <strong>${fullName}</strong>,</p>
<p>${description}</p>
<p style="margin-top:40px;">
Regards,<br><strong>AsiaDirect</strong>
</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
`;

                                        const attachments = req.files && req.files.length > 0
                                            ? req.files.map(file => ({
                                                filename: file.originalname,
                                                path: path.resolve(`public/documents/${file.filename}`)
                                            }))
                                            : [];

                                        sendMail(Email, title, content, attachments);
                                    }
                                });
                            });

                            return res.status(200).send({
                                success: true,
                                message: "Send notification successfully"
                            });
                        } else {
                            return res.status(400).send({
                                success: false,
                                message: "Failed to send notification"
                            });
                        }
                    });
                });
            }
            else if (send_to == 3) {
                if (!user_id) {
                    res.status(400).send({
                        success: false,
                        message: "Please provide user_id"
                    })
                }
                else {
                    const InsertQuery = `insert into tbl_notifications (title, description, send_to, document) values (?,?,?,?)`;
                    await con.query(InsertQuery, [title, description, 3, documentPath], (err, data) => {
                        if (err) throw err;
                        if (data.affectedRows > 0) {
                            const insertNotificationSql = 'INSERT INTO notification_details (user_id, notification_id) VALUES (?, ?)';
                            con.query(insertNotificationSql, [user_id, data.insertId], (err, result) => {
                                if (err) throw err;
                            });

                            const emailSql = 'SELECT email, full_name FROM tbl_users WHERE id = ?';
                            con.query(emailSql, [user_id], (err, emailResult) => {
                                if (err) return console.error(err);
                                if (emailResult.length > 0) {
                                    const Email = emailResult[0].email;
                                    const fullName = emailResult[0].full_name;
                                    const mailSubject = title;
                                    const content = `<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f4f4f4" style="font-family: Arial, sans-serif;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 8px; margin: 40px auto; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);">
        <tr>
          <td style="padding: 30px; color: #333333; font-size: 16px; line-height: 1.6;">
            <p style="margin-bottom: 20px;">Hi <strong>${fullName}</strong>,</p>
            <p style="margin-bottom: 20px;">${description}</p>
            <p style="margin-top: 40px;">Regards,<br><strong>AsiaDirect</strong></p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`;
                                    const attachments = req.files && req.files.length > 0
                                        ? req.files.map(file => ({
                                            filename: file.originalname,
                                            path: path.resolve(`public/documents/${file.filename}`)
                                        }))
                                        : [];
                                    sendMail(Email, mailSubject, content, attachments);
                                }
                            })
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
            else if (send_to == 4) {
                if (!user_id) {
                    res.status(400).send({
                        success: false,
                        message: "Please provide user_id"
                    })
                }
                else {
                    const InsertQuery = `insert into tbl_notifications (title, description, send_to, document) values (?,?,?,?)`;
                    await con.query(InsertQuery, [title, description, 4, documentPath], (err, data) => {
                        if (err) throw err;
                        if (data.affectedRows > 0) {
                            const insertNotificationSql = 'INSERT INTO notification_details (user_id, notification_id) VALUES (?, ?)';
                            con.query(insertNotificationSql, [user_id, data.insertId], (err, result) => {
                                if (err) throw err;
                            });
                            const emailSql = 'SELECT email, full_name FROM tbl_users WHERE id = ?';
                            con.query(emailSql, [user_id], (err, emailResult) => {
                                if (err) return console.error(err);
                                if (emailResult.length > 0) {
                                    const Email = emailResult[0].email;
                                    const fullName = emailResult[0].full_name;
                                    const mailSubject = title;
                                    const content = `<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f4f4f4" style="font-family: Arial, sans-serif;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 8px; margin: 40px auto; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);">
        <tr>
          <td style="padding: 30px; color: #333333; font-size: 16px; line-height: 1.6;">
            <p style="margin-bottom: 20px;">Hi <strong>${fullName}</strong>,</p>
            <p style="margin-bottom: 20px;">${description}</p>
            <p style="margin-top: 40px;">Regards,<br><strong>AsiaDirect</strong></p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`;
                                    const attachments = req.files && req.files.length > 0
                                        ? req.files.map(file => ({
                                            filename: file.originalname,
                                            path: path.resolve(`public/documents/${file.filename}`)
                                        }))
                                        : [];
                                    sendMail(Email, mailSubject, content, attachments);
                                }
                            })
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
            else if (send_to == 5) {
                if (!user_id) {
                    return res.status(400).send({
                        success: false,
                        message: "Please provide comma-separated user IDs"
                    });
                }

                const userIds = user_id.split(',').map(id => id.trim()).filter(Boolean);

                const InsertQuery = `INSERT INTO tbl_notifications (title, description, send_to, document) VALUES (?, ?, ?,?)`;
                con.query(InsertQuery, [title, description, 6, documentPath], (err, data) => {
                    if (err) throw err;

                    if (data.affectedRows > 0) {
                        userIds.forEach((id) => {
                            const insertNotificationSql = 'INSERT INTO notification_details (user_id, notification_id) VALUES (?, ?)';
                            con.query(insertNotificationSql, [id, data.insertId], (err) => {
                                if (err) console.error(err);
                            });

                            // 📨 Send Email
                            const getUserEmailSql = 'SELECT email, full_name FROM tbl_users WHERE id = ?';
                            con.query(getUserEmailSql, [id], (err, userData) => {
                                if (!err && userData.length > 0) {
                                    const Email = userData[0].email;
                                    const fullName = userData[0].full_name;
                                    const mailSubject = title;
                                    const content = `
                           <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f4f4f4" style="font-family: Arial, sans-serif;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 8px; margin: 40px auto; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);">
        <tr>
          <td style="padding: 30px; color: #333333; font-size: 16px; line-height: 1.6;">
            <p style="margin-bottom: 20px;">Hi <strong>${fullName}</strong>,</p>
            <p style="margin-bottom: 20px;">${description}</p>
            <p style="margin-top: 40px;">Regards,<br><strong>AsiaDirect</strong></p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>

                        `;
                                    const attachments = req.files && req.files.length > 0
                                        ? req.files.map(file => ({
                                            filename: file.originalname,
                                            path: path.resolve(`public/documents/${file.filename}`)
                                        }))
                                        : [];
                                    sendMail(Email, mailSubject, content, attachments);
                                }
                            });
                        });

                        return res.status(200).send({
                            success: true,
                            message: "Notification sent to multiple users"
                        });
                    } else {
                        return res.status(400).send({
                            success: false,
                            message: "Failed to send notification"
                        });
                    }
                });
            }

            else if (send_to == 6) {
                const { batch_id } = req.body;
                if (!batch_id) {
                    return res.status(400).send({
                        success: false,
                        message: "Please provide batch_id"
                    });
                }

                const getUsersSql = `
        SELECT DISTINCT tbl_orders.client_id as user_id
        FROM freight_assig_to_batch
        INNER JOIN tbl_orders ON tbl_orders.id = freight_assig_to_batch.order_id
        WHERE batch_id = ?
    `;

                con.query(getUsersSql, [batch_id], (err, results) => {
                    if (err) throw err;

                    if (results.length === 0) {
                        return res.status(400).send({
                            success: false,
                            message: "No users found in the selected batch"
                        });
                    }

                    const InsertQuery = `INSERT INTO tbl_notifications (title, description, send_to, document) VALUES (?, ?, ?, ?)`;
                    con.query(InsertQuery, [title, description, 7, documentPath], (err, data) => {
                        if (err) throw err;

                        if (data.affectedRows > 0) {
                            results.forEach((user) => {
                                const userId = user.user_id;
                                const insertNotificationSql = 'INSERT INTO notification_details (user_id, notification_id) VALUES (?, ?)';
                                con.query(insertNotificationSql, [userId, data.insertId], (err) => {
                                    if (err) console.error(err);
                                });

                                // 📨 Send Email
                                const getUserEmailSql = 'SELECT email, full_name FROM tbl_users WHERE id = ?';
                                con.query(getUserEmailSql, [userId], (err, userData) => {
                                    if (!err && userData.length > 0) {
                                        const Email = userData[0].email;
                                        const fullName = userData[0].full_name;
                                        const mailSubject = title;
                                        const content = `<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f4f4f4" style="font-family: Arial, sans-serif;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 8px; margin: 40px auto; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);">
        <tr>
          <td style="padding: 30px; color: #333333; font-size: 16px; line-height: 1.6;">
            <p style="margin-bottom: 20px;">Hi <strong>${fullName}</strong>,</p>
            <p style="margin-bottom: 20px;">${description}</p>
            <p style="margin-top: 40px;">Regards,<br><strong>AsiaDirect</strong></p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>

                            `;
                                        const attachments = req.files && req.files.length > 0
                                            ? req.files.map(file => ({
                                                filename: file.originalname,
                                                path: path.resolve(`public/documents/${file.filename}`)
                                            }))
                                            : [];
                                        sendMail(Email, mailSubject, content, attachments);
                                    }
                                });
                            });

                            return res.status(200).send({
                                success: true,
                                message: "Notification sent to all batch users"
                            });
                        } else {
                            return res.status(400).send({
                                success: false,
                                message: "Failed to send notification"
                            });
                        }
                    });
                });
            }

            else if (send_to == 7) {

                const { send_whatsapp } = req.body;

                const getSuppliersSql = `
        SELECT id, name, email, phone_no, country_code
        FROM tbl_suppliers
        WHERE is_deleted = 0
    `;

                con.query(getSuppliersSql, (err, suppliers) => {
                    if (err) throw err;

                    if (suppliers.length === 0) {
                        return res.status(400).send({
                            success: false,
                            message: "No suppliers found"
                        });
                    }

                    // 📎 Document public URLs for WhatsApp
                    const media_url = documentPath
                        ? `${process.env.BASE_URL}/documents/${documentPath.split(',')[0]}`
                        : null;

                    const insertNotificationSql = `
            INSERT INTO tbl_notifications (title, description, send_to, document)
            VALUES (?, ?, ?, ?)
        `;
                    console.log(media_url)
                    con.query(
                        insertNotificationSql,
                        [title, description, 8, documentPath],
                        (err, data) => {
                            if (err) throw err;

                            if (data.affectedRows > 0) {

                                suppliers.forEach(async (supplier) => {

                                    // 🔹 notification_details (SUPPLIER)
                                    const insertDetailsSql = `
                            INSERT INTO notification_details 
                            (user_id, user_type, notification_id, send_whatsapp)
                            VALUES (?, ?, ?, ?)
                        `;

                                    con.query(
                                        insertDetailsSql,
                                        [
                                            supplier.id,
                                            2,
                                            data.insertId,
                                            send_whatsapp == 1 ? 1 : 0
                                        ],
                                        (err) => {
                                            if (err) console.error(err);
                                        }
                                    );

                                    // 📨 EMAIL (UNCHANGED)
                                    if (supplier.email) {

                                        const content = `<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f4f4f4" style="font-family: Arial, sans-serif;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 8px; margin: 40px auto; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);">
        <tr>
          <td style="padding: 30px; color: #333333; font-size: 16px; line-height: 1.6;">
            <p style="margin-bottom: 20px;">Hi <strong>${supplier.name}</strong>,</p>
            <p style="margin-bottom: 20px;">${description}</p>
            <p style="margin-top: 40px;">Regards,<br><strong>AsiaDirect</strong></p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

                                        const attachments =
                                            req.files && req.files.length > 0
                                                ? req.files.map(file => ({
                                                    filename: file.originalname,
                                                    path: path.resolve(`public/documents/${file.filename}`)
                                                }))
                                                : [];

                                        sendMail(
                                            supplier.email,
                                            title,
                                            content,
                                            attachments
                                        );
                                    }

                                    // 📲 WHATSAPP (ONLY IF BUTTON ENABLED)
                                    if (send_whatsapp == 1 && supplier.phone_no) {

                                        const whatsappTo = formatWhatsAppNumber(
                                            supplier.country_code,
                                            supplier.phone_no
                                        );

                                        if (!whatsappTo) return;

                                        try {
                                            await sendWhatsAppNotification(
                                                whatsappTo, // +9185xxxx
                                                "copy_system_notification",
                                                {
                                                    name: supplier.name,
                                                    title: title,
                                                    body: stripHtml(description) // MUST match template
                                                    // media_url: mediaUrl
                                                },
                                                media_url
                                            );
                                        } catch (err) {
                                            console.error(
                                                `WhatsApp failed for supplier ${supplier.id}:`,
                                                err.message
                                            );
                                        }
                                    }

                                });

                                return res.status(200).send({
                                    success: true,
                                    message: "Notification sent to all suppliers"
                                });

                            } else {
                                return res.status(400).send({
                                    success: false,
                                    message: "Failed to send notification"
                                });
                            }
                        }
                    );
                });
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

// const GetNotification = async (req, res) => {
//     try {

//         const { page = 1, limit = 10, search="" } = req.body;
//         const offset = (page - 1) * limit;

//         const selectQuery = `
//         SELECT
//             DISTINCT nd.id AS notification_id,
//             nd.title,
//             nd.description,
//             nd.document,
//             CASE
//                 WHEN nd.send_to = 1 THEN '1'
//                 WHEN nd.send_to = 2 THEN '2'
//                 WHEN nd.send_to IN (3, 4) THEN CONCAT(v.full_name)
//             END AS send_to,
//             nd.is_deleted,
//             nd.created_at
//         FROM
//             notification_details n
//         LEFT JOIN
//             tbl_notifications nd ON nd.id = n.notification_id
//         LEFT JOIN
//             tbl_users v ON n.user_id = v.id
//         WHERE nd.is_deleted='${0}' AND nd.send_to <> 5
//         ORDER BY
//             nd.created_at DESC
//             Limit ? OFFSET ?`;

//         const data = await new Promise((resolve, reject) => {
//             con.query(selectQuery, [limit, offset], (err, data) => {
//                 if (err) reject(err);
//                 else resolve(data);
//             });
//         });

//         if (data.length > 0) {

//             const total = await new Promise((resolve, reject) => {
//                 con.query(`SELECT COUNT(*) AS total FROM tbl_notifications WHERE is_deleted=0 AND send_to <> 5`, (err, rows) => {
//                     if (err) reject(err);
//                     else resolve(rows[0].total);
//                 });
//             });
//             const modifiedData = data.map(notification => ({
//                 id: notification.notification_id,
//                 title: notification.title,
//                 description: notification.description,
//                 send_to: notification.send_to,
//                 is_deleted: notification.is_deleted,
//                 document: notification.document
//                     ? notification.document.split(',').map(doc => doc.trim())
//                     : [],
//                 created_at: notification.created_at
//             }));

//             res.status(200).send({
//                 success: true,
//                 data: modifiedData,
//                 page,
//                 limit,
//                 total: total,
//                 totalPages: Math.ceil(total / limit)
//             });
//         } else {
//             res.status(400).send({
//                 success: false,
//                 message: "No notifications found"
//             });
//         }
//     } catch (error) {
//         res.status(500).send({
//             success: false,
//             message: error.message
//         });
//     }
// };

const GetNotification = async (req, res) => {
    try {

        const { page = 1, limit = 10, search = "" } = req.body;
        const offset = (page - 1) * limit;

        let searchQuery = "";
        let queryParams = [];

        if (search) {
            const words = search.trim().split(/\s+/); // split by space

            const conditions = [];

            words.forEach(word => {
                conditions.push(`(
            nd.title LIKE ? OR
            nd.description LIKE ? OR
            v.full_name LIKE ?
        )`);

                const searchValue = `%${word}%`;
                queryParams.push(searchValue, searchValue, searchValue);
            });

            // match ANY word
            searchQuery = `AND (${conditions.join(" OR ")})`;
        }

        const selectQuery = `
        SELECT
            DISTINCT nd.id AS notification_id,
            nd.title,
            nd.description,
            nd.document,
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
        WHERE 
            nd.is_deleted = 0 
            AND nd.send_to <> 5
            ${searchQuery}
        ORDER BY
            nd.created_at DESC
        LIMIT ? OFFSET ?`;

        const data = await new Promise((resolve, reject) => {
            con.query(selectQuery, [...queryParams, parseInt(limit), parseInt(offset)], (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });

        if (data.length > 0) {

            // COUNT QUERY WITH SEARCH
            const countQuery = `
                SELECT COUNT(DISTINCT nd.id) AS total
                FROM notification_details n
                LEFT JOIN tbl_notifications nd ON nd.id = n.notification_id
                LEFT JOIN tbl_users v ON n.user_id = v.id
                WHERE 
                    nd.is_deleted = 0 
                    AND nd.send_to <> 5
                    ${searchQuery}
            `;

            const total = await new Promise((resolve, reject) => {
                con.query(countQuery, queryParams, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows[0].total);
                });
            });

            const modifiedData = data.map(notification => ({
                id: notification.notification_id,
                title: notification.title,
                description: notification.description,
                send_to: notification.send_to,
                is_deleted: notification.is_deleted,
                document: notification.document
                    ? notification.document.split(',').map(doc => doc.trim())
                    : [],
                created_at: notification.created_at
            }));

            res.status(200).send({
                success: true,
                data: modifiedData,
                page: parseInt(page),
                limit: parseInt(limit),
                total: total,
                totalPages: Math.ceil(total / limit)
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
        limit = 10,
        user_id,
        user_type
    } = req.body;

    try {
        const conditions = [];
        const params = [];
        const ALL_ACCESS_USER_ID = 19855;

        /* ===================== ACCESS COUNTRY ===================== */
        let accessCountries = [];

        if (user_id && Number(user_id) !== ALL_ACCESS_USER_ID) {
            const userResult = await new Promise((resolve, reject) => {
                con.query(
                    `SELECT access_country FROM tbl_users WHERE id = ? AND is_deleted = 0`,
                    [user_id],
                    (err, rows) => {
                        if (err) return reject(err);
                        resolve(rows);
                    }
                );
            });

            if (userResult.length && userResult[0].access_country) {
                accessCountries = userResult[0].access_country
                    .split(',')
                    .map(id => Number(id.trim()));
            }
        }

        /* ===================== BASIC FILTERS ===================== */
        if (origin) {
            conditions.push(`f.collection_from = ?`);
            params.push(origin);
        }

        if (destination) {
            conditions.push(`f.delivery_to = ?`);
            params.push(destination);
        }

        if (startDate && endDate) {
            conditions.push(`DATE(tbl_orders.created_at) BETWEEN ? AND ?`);
            params.push(startDate, endDate);
        }

        if (freightType) {
            conditions.push(`f.freight = ?`);
            params.push(freightType);
        }

        if (freightSpeed) {
            conditions.push(`f.type = ?`);
            params.push(freightSpeed);
        }

        /* ===================== ACCESS CONTROL ===================== */
        if (Number(user_id) !== ALL_ACCESS_USER_ID && accessCountries.length) {

            const placeholders = accessCountries.map(() => '?').join(',');

            // STAFF
            if (Number(user_type) === 2) {
                conditions.push(`
                    (
                        f.client_id = ?
                        OR f.sales_representative = ?
                        OR (
                            f.collection_from IN (${placeholders})
                            OR f.delivery_to IN (${placeholders})
                        )
                    )
                `);
                params.push(user_id, user_id, ...accessCountries, ...accessCountries);
            }

            // ADMIN
            else if (Number(user_type) === 3) {
                conditions.push(`
                    (
                        f.collection_from IN (${placeholders})
                        OR f.delivery_to IN (${placeholders})
                    )
                `);
                params.push(...accessCountries, ...accessCountries);
            }
        }

        /* ===================== SEARCH ===================== */
        if (search) {
            const s = `%${search.trim()}%`;
            conditions.push(`(
                CONCAT('OR000', tbl_orders.id) LIKE ?
                OR tbl_orders.client_name LIKE ?
                OR cu.full_name LIKE ?
                OR tbl_orders.weight LIKE ?
                OR f.freight LIKE ?
                OR f.freight_number LIKE ?
                OR f.product_desc LIKE ?
                OR c.name LIKE ?
                OR co.name LIKE ?
            )`);
            params.push(s, s, s, s, s, s, s, s, s);
        }

        const whereClause = conditions.length
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

        const offset = (page - 1) * limit;

        /* ===================== COUNT QUERY ===================== */
        const countQuery = `
            SELECT COUNT(DISTINCT tbl_orders.id) AS total
            FROM tbl_orders
            LEFT JOIN tbl_users AS cu ON cu.id = tbl_orders.client_id
            LEFT JOIN tbl_freight AS f ON tbl_orders.freight_id = f.id
            LEFT JOIN countries AS c 
    ON c.id = COALESCE(f.collection_from, tbl_orders.collection_from)

LEFT JOIN countries AS co 
    ON co.id = COALESCE(f.delivery_to, tbl_orders.delivery_to)
            ${whereClause}
        `;

        con.query(countQuery, params, (countErr, countResult) => {
            if (countErr) {
                return res.status(500).send({
                    success: false,
                    message: "Count query failed",
                    error: countErr.message
                });
            }

            const total = countResult[0].total;

            /* ===================== DATA QUERY ===================== */
            const dataQuery = `
                SELECT
                    tbl_orders.*,
                    tbl_orders.id AS order_id,
                    CONCAT('OR000', tbl_orders.id) AS order_number,
                    tbl_orders.created_at AS order_created_date,

                    f.*,
                    cu.*,
                    cu.id AS user_id,

                    CASE 
                        WHEN tbl_orders.client_id = 0 THEN tbl_orders.client_name
                        ELSE cu.full_name
                    END AS client_name,

                    su.full_name AS sales_representative_name,
                    cu.client_number,
                    cu.email AS client_email,

                    c.name AS collection_from_country,
                    co.name AS delivery_to_country
                FROM tbl_orders
                LEFT JOIN tbl_users AS cu ON cu.id = tbl_orders.client_id
                LEFT JOIN tbl_freight AS f ON tbl_orders.freight_id = f.id
                LEFT JOIN tbl_users AS su ON su.id = f.sales_representative
               LEFT JOIN countries AS c 
    ON c.id = COALESCE(f.collection_from, tbl_orders.collection_from)

LEFT JOIN countries AS co 
    ON co.id = COALESCE(f.delivery_to, tbl_orders.delivery_to)
                ${whereClause}
                GROUP BY tbl_orders.id
                ORDER BY tbl_orders.id DESC
                LIMIT ? OFFSET ?
            `;

            const dataParams = [...params, Number(limit), Number(offset)];

            con.query(dataQuery, dataParams, (dataErr, data) => {
                if (dataErr) {
                    return res.status(500).send({
                        success: false,
                        message: "Data query failed",
                        error: dataErr.message
                    });
                }

                res.status(200).send({
                    success: true,
                    currentPage: Number(page),
                    totalPages: Math.ceil(total / limit),
                    totalRecords: total,
                    data
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

const assignWarehouseSupplierToOrder = (req, res) => {
    try {
        const {
            order_id,
            freight_id,
            supplier_id
        } = req.body;

        if (!order_id || !freight_id || !supplier_id) {
            return res.status(400).json({
                success: false,
                message: "order_id, freight_id and supplier_id are required"
            });
        }

        // 1️⃣ Validate supplier (warehouse type)
        const supplierSql = `
            SELECT id
            FROM tbl_suppliers
            WHERE id = ? AND user_type = 2 AND is_deleted = 0
        `;

        con.query(supplierSql, [supplier_id], (err, supplierResult) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "Supplier validation failed",
                    error: err
                });
            }

            if (supplierResult.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid warehouse supplier (user_type must be 2)"
                });
            }

            // 2️⃣ Check order exists
            const orderCheckSql = `
                SELECT id
                FROM tbl_orders
                WHERE id = ? AND freight_id = ?
            `;

            con.query(orderCheckSql, [order_id, freight_id], (err, orderResult) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: "Order check failed",
                        error: err
                    });
                }

                if (orderResult.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Order not found for given freight"
                    });
                }

                // 3️⃣ Assign warehouse supplier to order
                const updateSql = `
                    UPDATE tbl_orders
                    SET assign_warehouse_supplier_id = ?,
                        warehouse_status = ?
                    WHERE id = ? AND freight_id = ?
                `;

                con.query(
                    updateSql,
                    [
                        supplier_id,
                        1, // Assigned
                        order_id,
                        freight_id
                    ],
                    (err, updateResult) => {
                        if (err) {
                            return res.status(500).json({
                                success: false,
                                message: "Failed to assign warehouse supplier to order",
                                error: err
                            });
                        }

                        if (updateResult.affectedRows === 0) {
                            return res.status(400).json({
                                success: false,
                                message: "Order already assigned or invalid state"
                            });
                        }

                        return res.status(200).json({
                            success: true,
                            message: "Warehouse supplier successfully assigned to order"
                        });
                    }
                );
            });
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Unexpected server error",
            error
        });
    }
};

const getAllAssignedOrdersToWarehouse = (req, res) => {
    try {
        const {
            search = "",
            page = 1,
            limit = 10
        } = req.body;

        const offset = (page - 1) * limit;

        let condition = `
            WHERE o.assign_warehouse_supplier_id IS NOT NULL
        `;
        let params = [];

        if (search) {
            condition += `
                AND (
                    o.order_number LIKE ?
                    OR o.client_name LIKE ?
                    OR s.name LIKE ?
                    OR o.cargo_pickup_country LIKE ?
                    OR o.cargo_des_country LIKE ?
                )
            `;
            params.push(
                `%${search}%`,
                `%${search}%`,
                `%${search}%`,
                `%${search}%`,
                `%${search}%`
            );
        }

        // 1️⃣ Main Data Query
        const dataSql = `
            SELECT
                o.id AS order_id,
                o.order_number,
                o.freight_id,
                o.client_id,
                o.client_name,
                o.goods_description,
                o.dimensions,
                o.weight,
                o.date_of_collection,
                o.cargo_pickup_country,
                o.cargo_pickup_town,
                o.cargo_des_country,
                o.cargo_des_town,
                o.mode_of_transport,
                o.warehouse_status,
                o.track_status,
                o.created_at,

                s.id AS supplier_id,
                s.name AS supplier_name,
                s.email AS supplier_email,
                s.phone_no AS supplier_phone

            FROM tbl_orders o
            JOIN tbl_suppliers s
                ON s.id = o.assign_warehouse_supplier_id
                AND s.user_type = 2
                AND s.is_deleted = 0

            ${condition}
            ORDER BY o.created_at DESC
            LIMIT ? OFFSET ?
        `;

        con.query(
            dataSql,
            [...params, Number(limit), Number(offset)],
            (err, result) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: "Failed to fetch assigned warehouse orders",
                        error: err
                    });
                }

                // 2️⃣ Count Query
                const countSql = `
                    SELECT COUNT(*) AS total
                    FROM tbl_orders o
                    JOIN tbl_suppliers s
                        ON s.id = o.assign_warehouse_supplier_id
                        AND s.user_type = 2
                        AND s.is_deleted = 0
                    ${condition}
                `;

                con.query(countSql, params, (err, countResult) => {
                    if (err) {
                        return res.status(500).json({
                            success: false,
                            message: "Count query failed",
                            error: err
                        });
                    }

                    return res.status(200).json({
                        success: true,
                        message: "Assigned warehouse orders fetched successfully",
                        data: result,
                        total: countResult[0].total,
                        page: Number(page),
                        limit: Number(limit)
                    });
                });
            }
        );

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Unexpected server error",
            error
        });
    }
};

const getAllAssignedOrdersToWarehouseBySupplier = (req, res) => {
    try {
        const {
            supplier_id,
            search = "",
            page = 1,
            limit = 10
        } = req.body;

        if (!supplier_id) {
            return res.status(400).json({
                success: false,
                message: "supplier_id is required"
            });
        }

        const offset = (page - 1) * limit;
        const conditions = [`o.assign_warehouse_supplier_id = ?`];

        /* ===================== SEARCH ===================== */
        if (search && search.trim()) {
            const s = search.trim();
            conditions.push(`(
                CONCAT('OR000', o.id) LIKE '%${s}%'
                OR o.client_name LIKE '%${s}%'
                OR cu.full_name LIKE '%${s}%'
                OR o.weight LIKE '%${s}%'
                OR f.freight LIKE '%${s}%'
                OR f.freight_number LIKE '%${s}%'
                OR f.product_desc LIKE '%${s}%'
                OR c.name LIKE '%${s}%'
                OR co.name LIKE '%${s}%'
            )`);
        }

        const whereClause = `WHERE ${conditions.join(" AND ")}`;

        /* ===================== COUNT QUERY ===================== */
        const countSql = `
            SELECT COUNT(DISTINCT o.id) AS total
            FROM tbl_orders o
            LEFT JOIN tbl_freight f ON o.freight_id = f.id
            LEFT JOIN tbl_users cu ON cu.id = o.client_id
            LEFT JOIN countries c ON c.id = f.collection_from
            LEFT JOIN countries co ON co.id = f.delivery_to
            ${whereClause}
        `;

        con.query(countSql, [supplier_id], (countErr, countRes) => {
            if (countErr) {
                return res.status(500).json({
                    success: false,
                    message: "Count query failed",
                    error: countErr.message
                });
            }

            const total = countRes[0].total;

            /* ===================== DATA QUERY ===================== */
            const sql = `
                SELECT
                    o.*,
                    o.id AS order_id,
                    CONCAT('OR000', o.id) AS order_number,
                    o.created_at AS order_created_date,

                    f.*,
                    f.freight_number,

                    cu.id AS client_user_id,
                    cu.full_name AS client_full_name,
                    cu.email AS client_email,
                    cu.client_number,

                    su.full_name AS sales_representative_name,

                    s.id AS supplier_id,
                    s.name AS supplier_name,
                    s.email AS supplier_email,
                    s.phone_no AS supplier_phone,

                    c.name AS collection_from_country,
                    co.name AS delivery_to_country,

                    CASE
                        WHEN o.client_id = 0 THEN o.client_name
                        ELSE cu.full_name
                    END AS final_client_name

                FROM tbl_orders o
                LEFT JOIN tbl_freight f ON o.freight_id = f.id
                LEFT JOIN tbl_users cu ON cu.id = o.client_id
                LEFT JOIN tbl_users su ON su.id = f.sales_representative
                LEFT JOIN tbl_suppliers s 
                    ON s.id = o.assign_warehouse_supplier_id
                    AND s.user_type = 2
                    AND s.is_deleted = 0
                LEFT JOIN countries c ON c.id = f.collection_from
                LEFT JOIN countries co ON co.id = f.delivery_to

                ${whereClause}

                GROUP BY o.id
                ORDER BY o.id DESC
                LIMIT ? OFFSET ?
            `;

            con.query(sql, [supplier_id, Number(limit), Number(offset)], (err, result) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: "Failed to fetch assigned warehouse orders",
                        error: err.message
                    });
                }

                return res.status(200).json({
                    success: true,
                    message: "Assigned warehouse orders fetched successfully",
                    currentPage: Number(page),
                    totalPages: Math.ceil(total / limit),
                    totalRecords: total,
                    data: result
                });
            });
        });

    } catch (error) {
        return res.status(500).json({
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
                tbl_users.client_number AS client_number,
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
            return res.status(400).json({
                success: false,
                message: "Please provide freight_id"
            });
        }

        // 1. Get assigned supplier IDs from tbl_freight
        const freightQuery = `SELECT assign_id FROM tbl_freight
        WHERE id = ? AND is_deleted = 0`;

        con.query(freightQuery, [freight_id], (err, freightData) => {
            if (err) return res.status(500).json({ success: false, message: err.message });

            if (freightData.length === 0) {
                return res.status(400).json({ success: false, message: "Freight not found" });
            }

            const assign_id = freightData[0].assign_id;

            if (!assign_id) {
                return res.status(200).json({ success: true, data: [] });
            }

            // Convert "1,2,3" ➝ [1,2,3]
            const supplierIds = assign_id.split(",");

            // 2. Get supplier details
            const supplierQuery = `
    SELECT
        s.*,
        c.name AS country_name
    FROM tbl_suppliers s
    LEFT JOIN countries c ON c.id = s.country
    WHERE s.id IN (${supplierIds.map(() => "?").join(",")})`;

            con.query(supplierQuery, supplierIds, (err, supplierData) => {
                if (err) return res.status(500).json({ success: false, message: err.message });

                return res.status(200).json({
                    success: true,
                    data: supplierData
                });
            });
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


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

//         if (!order_id || !status) {
//             return res.status(400).send({
//                 success: false,
//                 message: "Please provide both order_id and status"
//             });
//         }

//         const datetime = new Date().toISOString().slice(0, 19).replace('T', ' ');

//         // Check if order exists
//         con.query(`SELECT * FROM tbl_orders WHERE id = ?`, [order_id], (err, orderData) => {
//             if (err) return res.status(500).send({ success: false, message: err.message });

//             if (orderData.length === 0) {
//                 return res.status(400).send({
//                     success: false,
//                     message: "Order ID doesn't exist"
//                 });
//             }

//             // Insert status update into order_track
//             con.query(`INSERT INTO order_track (order_id, status, description, created_at) VALUES (?, ?, ?, ?)`,
//                 [order_id, status, description, datetime],
//                 (err, insertTrackResult) => {
//                     if (err) return res.status(500).send({ success: false, message: err.message });

//                     // Get client_id
//                     con.query(`SELECT client_id FROM tbl_orders WHERE id = ?`, [order_id], (err, clientResult) => {
//                         if (err) return res.status(500).send({ success: false, message: err.message });

//                         const client_id = clientResult[0].client_id;

//                         // Insert notification
//                         const notificationMessage = `Order #OR000${order_id} has been ${status}. For more details, please track your order.`;
//                         con.query(`INSERT INTO tbl_notifications (title, description, send_to) VALUES (?, ?, ?)`,
//                             ["Order Status Update", notificationMessage, 4],
//                             (err, notificationResult) => {
//                                 if (err) return res.status(500).send({ success: false, message: err.message });

//                                 const notification_id = notificationResult.insertId;

//                                 // Link notification to client
//                                 con.query(`INSERT INTO notification_details (user_id, notification_id) VALUES (?, ?)`,
//                                     [client_id, notification_id],
//                                     (err) => {
//                                         if (err) return res.status(500).send({ success: false, message: err.message });

//                                         // Update order's current status
//                                         con.query(`UPDATE tbl_orders SET track_status = ? WHERE id = ?`,
//                                             [status, order_id],
//                                             (err) => {
//                                                 if (err) return res.status(500).send({ success: false, message: err.message });

//                                                 // Fetch user email and name
//                                                 con.query(`SELECT full_name, email, cellphone, telephone, country_code from tbl_users WHERE id = ?`, [client_id], (err, userData) => {
//                                                     if (err) return res.status(500).send({ success: false, message: err.message });

//                                                     const email = userData[0].email;
//                                                     const fullName = userData[0].full_name;
//                                                     const user_phoneNumber = userData[0].cellphone || userData[0].telephone;
//                                                     const user_countryCode = userData[0].country_code;
//                                                     const orderNumber = `OR000${order_id}`
//                                                     const message = getOrderStatusMessage(orderNumber, fullName, status);
//                                                     // 05-06-2025
//                                                     const smsResponse = sendSms(user_phoneNumber, message);
//                                                     /* const whatsappResponse = sendWhatsApp(user_phoneNumber, message); */
//                                                     // console.log(smsResponse);
//                                                     // console.log(whatsappResponse);
//                                                     ////////////   02/01/2026
//                                                     const templateName = getWhatsAppTemplateByStatus(status);

//                                                     if (user_phoneNumber && user_countryCode) {

//                                                         const formattedUserPhone = formatTwilioWhatsAppNumber(
//                                                             user_countryCode,
//                                                             user_phoneNumber
//                                                         );

//                                                         sendWhatsApp(
//                                                             formattedUserPhone,
//                                                             templateName,
//                                                             {
//                                                                 "1": fullName,
//                                                                 "2": orderNumber,
//                                                                 "3": status
//                                                             }
//                                                         );
//                                                     }

//                                                     const mailContent = `
// <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; background-color: #f9f9f9;">
//   <h2 style="color: #2c3e50; border-bottom: 1px solid #ccc; padding-bottom: 10px;">
//     Order Status: ${status}
//   </h2>

//   <p style="font-size: 16px; color: #333;">
//     Dear ${fullName},<br><br>
//     Your order status has been updated.
//   </p>

//   <p style="font-size: 16px; color: #333;">
//     <strong>Order Number:</strong> OR000${order_id}<br>
//     <strong>Current Status:</strong> ${status}
//   </p>

//   <p style="font-size: 16px; color: #333;">
//     Please log in to your dashboard for more information.
//   </p>

//   <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 20px;">

//   <p style="font-size: 14px; color: #777;">
//     Regards,<br>
//     <strong>Management System</strong>
//   </p>
// </div>`;

//                                                     // Send email
//                                                     sendMail(email, "Order Status Update", mailContent);
//                                                     // Step 1: Get freight_id from order
//                                                     con.query(`SELECT freight_id, client_id FROM tbl_orders WHERE id = ?`, [order_id], (err, freightResult) => {
//                                                         if (err) return res.status(500).send({ success: false, message: err.message });

//                                                         if (freightResult.length === 0) {
//                                                             return res.status(400).send({ success: false, message: "Freight not found for this order" });
//                                                         }

//                                                         const freight_id = freightResult[0].freight_id;
//                                                         const client_id = freightResult[0].client_id;

//                                                         // Step 2: Get sales_person_id from tbl_freights
//                                                         con.query(`SELECT sales_representative as sales_person_id FROM tbl_freight WHERE id = ?`, [freight_id], (err, salesPersonResult) => {
//                                                             if (err) return res.status(500).send({ success: false, message: err.message });

//                                                             const sales_person_id = salesPersonResult.length ? salesPersonResult[0].sales_person_id : null;

//                                                             // Step 3: Get sales person contact details
//                                                             con.query(`SELECT full_name, cellphone, email, country_code FROM tbl_users WHERE id = ? AND is_deleted = 0 AND status = 1`, [sales_person_id], (err, salesResult) => {
//                                                                 if (err) return res.status(500).send({ success: false, message: err.message });

//                                                                 const salesPersonPhone = salesResult.length ? salesResult[0].cellphone : null;
//                                                                 const salesPersonCountryCode = salesResult.length ? salesResult[0].country_code : null;
//                                                                 const salesEmail = salesResult.length ? salesResult[0].email : null;


//                                                                 // Step 4: Fetch Ops team
//                                                                 con.query(`SELECT email, cellphone, country_code FROM tbl_users WHERE user_type = 2 AND 
//                                                                     FIND_IN_SET(2, assigned_roles)
//                                                                     AND is_deleted = 0 AND status = 1`, (err, opsResults) => {
//                                                                     if (err) return res.status(500).send({ success: false, message: err.message });

//                                                                     const opsMembers = opsResults.filter(
//                                                                         row => row.cellphone && row.country_code
//                                                                     );
//                                                                     const opsEmails = opsResults.map(row => row.email).filter(Boolean);
//                                                                     const messageText = `*Shipment Status Updated*\n\nThe status of the shipment for client ${fullName} (Order No: OR000${order_id}) has been updated to: ${status}.\n\nPlease check the shipment details.`;
//                                                                     const opsMailContent = `<div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; background-color: #fff; border: 1px solid #ddd;">
//   <h3>Shipment Status Updated</h3>
//   <p>The status of the shipment for client ${fullName} (Order No: OR000${order_id}) has been updated to: <strong>${status}</strong>.</p>
//   <p>Please check the shipment details.</p>
//   <p style="font-size: 14px; color: #888;">
//     Regards,<br><strong>Management System</strong>
//   </p>
// </div>`;

//                                                                     // Send to sales person
//                                                                     if (salesPersonPhone) {

//                                                                         // 05-06-2025
//                                                                         sendSms(salesPersonPhone, messageText);
//                                                                         /* sendWhatsApp(salesPersonPhone, messageText); */
//                                                                         ///////////////  02/01/2025
//                                                                         // sendWhatsApp(salesPersonPhone, 'shipment_status_updated', {
//                                                                         //     "1": fullName,
//                                                                         //     "2": `OR000${order_id}`,
//                                                                         //     "3": status
//                                                                         // });

//                                                                         // 2/19/2026
//                                                                         if (salesPersonPhone && salesPersonCountryCode) {

//                                                                             const formattedSalesPhone = formatTwilioWhatsAppNumber(
//                                                                                 salesPersonCountryCode,
//                                                                                 salesPersonPhone
//                                                                             );

//                                                                             sendWhatsApp(
//                                                                                 formattedSalesPhone,
//                                                                                 'shipment_status_updated',
//                                                                                 {
//                                                                                     "1": fullName,
//                                                                                     "2": `OR000${order_id}`,
//                                                                                     "3": status
//                                                                                 }
//                                                                             );
//                                                                         }
//                                                                         sendMail(salesEmail, "Order Status Update", opsMailContent);


//                                                                     }

//                                                                     // Send to Ops team
//                                                                     // 05-06-2025
//                                                                     // opsPhones.forEach(phone => {
//                                                                     //     sendSms(phone, messageText);
//                                                                     //     //sendWhatsApp(phone, messageText);
//                                                                     //     // WhatsApp (template-based)
//                                                                     //     sendWhatsApp(phone, 'shipment_status_updated', {
//                                                                     //         "1": fullName,                  // Client Name
//                                                                     //         "2": `OR000${order_id}`,         // Order ID
//                                                                     //         "3": status                     // Shipment Status
//                                                                     //     });
//                                                                     // });

//                                                                     // 2/19/2026

//                                                                     for (const member of opsMembers) {

//                                                                         const formattedPhone = formatTwilioWhatsAppNumber(
//                                                                             member.country_code,
//                                                                             member.cellphone
//                                                                         );

//                                                                         sendWhatsApp(
//                                                                             formattedPhone,
//                                                                             'shipment_status_updated',
//                                                                             {
//                                                                                 "1": fullName,
//                                                                                 "2": `OR000${order_id}`,
//                                                                                 "3": status
//                                                                             }
//                                                                         );
//                                                                     }

//                                                                     opsEmails.forEach(email => {
//                                                                         sendMail(email, "Order Status Update", opsMailContent);
//                                                                     });

//                                                                 });
//                                                             });
//                                                         });
//                                                     });

//                                                     return res.status(200).send({
//                                                         success: true,
//                                                         message: "Order status updated and notifications sent."
//                                                     });

//                                                 });
//                                             });
//                                     });
//                             });
//                     });
//                 });
//         });
//     } catch (error) {
//         res.status(500).send({
//             success: false,
//             message: error.message
//         });
//     }
// };

const processNotifications = async (order_id, status, client_id) => {
    try {

        // Step A: Get user
        con.query(
            `SELECT full_name, email, cellphone, telephone, country_code FROM tbl_users WHERE id = ?`,
            [client_id],
            (err, userData) => {
                if (err || !userData.length) return;

                const user = userData[0];

                const email = user.email;
                const fullName = user.full_name;
                const user_phoneNumber = user.cellphone || user.telephone;
                const user_countryCode = user.country_code;
                const orderNumber = `OR000${order_id}`;

                const message = getOrderStatusMessage(orderNumber, fullName, status);

                // SMS
                try {
                    sendSms(user_phoneNumber, message);
                } catch (e) {
                    console.error("SMS error:", e);
                }

                // WhatsApp
                try {
                    const templateName = getWhatsAppTemplateByStatus(status);

                    if (user_phoneNumber && user_countryCode) {
                        const formattedUserPhone = formatTwilioWhatsAppNumber(
                            user_countryCode,
                            user_phoneNumber
                        );

                        sendWhatsApp(formattedUserPhone, templateName, {
                            "1": fullName,
                            "2": orderNumber,
                            "3": status
                        });
                    }
                } catch (e) {
                    console.error("WhatsApp error:", e);
                }

                // Email
                try {
                    sendMail(email, "Order Status Update", `Order ${status}`);
                } catch (e) {
                    console.error("Email error:", e);
                }

                // ---------------- OPS + SALES ----------------

                con.query(
                    `SELECT freight_id FROM tbl_orders WHERE id = ?`,
                    [order_id],
                    (err, freightResult) => {
                        if (err || !freightResult.length) return;

                        const freight_id = freightResult[0].freight_id;

                        con.query(
                            `SELECT sales_representative as sales_person_id FROM tbl_freight WHERE id = ?`,
                            [freight_id],
                            (err, salesPersonResult) => {

                                const sales_person_id = salesPersonResult?.[0]?.sales_person_id;

                                con.query(
                                    `SELECT full_name, cellphone, email, country_code 
                                     FROM tbl_users 
                                     WHERE id = ? AND is_deleted = 0 AND status = 1`,
                                    [sales_person_id],
                                    (err, salesResult) => {

                                        const sales = salesResult?.[0];

                                        const messageText =
                                            `*Shipment Status Updated*\n\nOrder ${orderNumber} → ${status}`;

                                        // Sales SMS
                                        try {
                                            if (sales?.cellphone) {
                                                sendSms(sales.cellphone, messageText);
                                            }
                                        } catch (e) { }

                                        // Sales WhatsApp
                                        try {
                                            if (sales?.cellphone && sales?.country_code) {
                                                const formatted = formatTwilioWhatsAppNumber(
                                                    sales.country_code,
                                                    sales.cellphone
                                                );

                                                sendWhatsApp(formatted, 'shipment_status_updated', {
                                                    "1": fullName,
                                                    "2": orderNumber,
                                                    "3": status
                                                });
                                            }
                                        } catch (e) { }

                                        // Ops team
                                        con.query(
                                            `SELECT email, cellphone, country_code 
                                             FROM tbl_users 
                                             WHERE user_type = 2 
                                             AND FIND_IN_SET(2, assigned_roles)
                                             AND is_deleted = 0 AND status = 1`,
                                            (err, opsResults) => {
                                                if (err) return;

                                                for (const member of opsResults) {
                                                    try {
                                                        const formattedPhone = formatTwilioWhatsAppNumber(
                                                            member.country_code,
                                                            member.cellphone
                                                        );

                                                        sendWhatsApp(formattedPhone, 'shipment_status_updated', {
                                                            "1": fullName,
                                                            "2": orderNumber,
                                                            "3": status
                                                        });
                                                    } catch (e) { }
                                                }

                                                opsResults.forEach(op => {
                                                    try {
                                                        if (op.email) {
                                                            sendMail(op.email, "Order Status Update", messageText);
                                                        }
                                                    } catch (e) { }
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
        );

    } catch (e) {
        console.error("Background process error:", e);
    }
};

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

        // Step 1: Check order exists
        con.query(`SELECT * FROM tbl_orders WHERE id = ?`, [order_id], (err, orderData) => {
            if (err) return res.status(500).send({ success: false, message: err.message });

            if (orderData.length === 0) {
                return res.status(400).send({
                    success: false,
                    message: "Order ID doesn't exist"
                });
            }

            const order = orderData[0];

            // Step 2: Insert tracking
            con.query(
                `INSERT INTO order_track (order_id, status, description, created_at) VALUES (?, ?, ?, ?)`,
                [order_id, status, description, datetime],
                (err) => {
                    if (err) return res.status(500).send({ success: false, message: err.message });

                    // Step 3: Notification insert
                    const notificationMessage =
                        `Order #OR000${order_id} has been ${status}. For more details, please track your order.`;

                    con.query(
                        `INSERT INTO tbl_notifications (title, description, send_to) VALUES (?, ?, ?)`,
                        ["Order Status Update", notificationMessage, 4],
                        (err, notificationResult) => {
                            if (err) return res.status(500).send({ success: false, message: err.message });

                            const notification_id = notificationResult.insertId;

                            con.query(
                                `INSERT INTO notification_details (user_id, notification_id) VALUES (?, ?)`,
                                [order.client_id, notification_id],
                                (err) => {
                                    if (err) return res.status(500).send({ success: false, message: err.message });

                                    // Step 4: Update order status
                                    con.query(
                                        `UPDATE tbl_orders SET track_status = ? WHERE id = ?`,
                                        [status, order_id],
                                        (err) => {
                                            if (err) return res.status(500).send({ success: false, message: err.message });

                                            //  SEND RESPONSE FIRST (fix 502)
                                            res.status(200).send({
                                                success: true,
                                                message: "Order status updated and notifications sent."
                                            });

                                            // -------------------------------
                                            //  BACKGROUND PROCESS (NO BLOCK)
                                            // -------------------------------
                                            setImmediate(() => {
                                                processNotifications(order_id, status, order.client_id);
                                            });
                                        }
                                    );
                                }
                            );
                        }
                    );
                }
            );
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

/////////// 02/01/2025
const getWhatsAppTemplateByStatus = (status) => {
    switch (status) {
        case 'Collected from supplier':
            return 'order_collected_supplier';
        case 'Delivered':
            return 'order_delivered';
        default:
            return 'order_status_update';
    }
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
                        message: "Order Number doesn't exist"
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


// const GetWarehouseOrders = async (req, res) => {
//     try {
//         const {
//             origin,
//             destination,
//             startDate,
//             endDate,
//             freightType,
//             freightSpeed,
//             user_id,
//             user_type,
//             search,
//             page = 1,
//             limit = 10
//         } = req.body;

//         if (!user_id) {
//             return res.status(400).send({
//                 success: false,
//                 message: "user_id is required"
//             });
//         }

//         const ALL_ACCESS_USERS = [1, 19855];

//         let condition = ` WHERE warehouse_assign_order.warehouse_status  = 1`;
//         let params = [];

//         /* ===== ACCESS COUNTRY ===== */
//         let accessCountries = [];

//         if (!ALL_ACCESS_USERS.includes(Number(user_id))) {
//             const rows = await new Promise((resolve, reject) => {
//                 con.query(
//                     `SELECT access_country FROM tbl_users WHERE id = ? AND is_deleted = 0`,
//                     [user_id],
//                     (err, rows) => {
//                         if (err) return reject(err);
//                         resolve(rows);
//                     }
//                 );
//             });

//             if (rows.length && rows[0].access_country) {
//                 accessCountries = rows[0].access_country
//                     .split(',')
//                     .map(id => Number(id.trim()))
//                     .filter(Boolean);
//             }
//         }

//         /* ---------- FILTERS ---------- */
//         if (origin) {
//             condition += ` AND COALESCE(tbl_freight.collection_from, tbl_orders.collection_from) = ?`;
//             params.push(origin);
//         }

//         if (destination) {
//             condition += ` AND COALESCE(tbl_freight.delivery_to, tbl_orders.delivery_to) = ?`;
//             params.push(destination);
//         }

//         if (startDate && endDate) {
//             condition += ` AND tbl_freight.created_at BETWEEN ? AND ?`;
//             params.push(startDate, endDate);
//         }

//         if (freightType) {
//             condition += ` AND tbl_freight.freight = ?`;
//             params.push(freightType);
//         }

//         if (freightSpeed) {
//             condition += ` AND tbl_freight.type = ?`;
//             params.push(freightSpeed);
//         }

//         /* ---------- MAIN ACCESS LOGIC (FIXED) ---------- */
//         if (
//             !ALL_ACCESS_USERS.includes(Number(user_id)) &&
//             accessCountries.length
//         ) {
//             const placeholders = accessCountries.map(() => '?').join(',');

//             if (user_type == 2) {
//                 const placeholders = accessCountries.map(() => '?').join(',');

//                 condition += `
//         AND (
//             tbl_freight.user_id = ?
//             OR tbl_freight.sales_representative = ?
//             OR (
//                 COALESCE(tbl_freight.collection_from, tbl_orders.collection_from) IN (${placeholders})
//                 OR COALESCE(tbl_freight.delivery_to, tbl_orders.delivery_to) IN (${placeholders})
//             )
//         )
//     `;

//                 params.push(
//                     user_id,
//                     user_id,
//                     ...accessCountries,
//                     ...accessCountries
//                 );
//             } else {
//                 condition += `
//                     AND (
//                         tbl_freight.collection_from IN (${placeholders})
//                         OR tbl_freight.delivery_to IN (${placeholders})
//                     )
//                 `;
//                 params.push(...accessCountries, ...accessCountries);
//             }
//         }

//         /* ---------- SEARCH ---------- */
//         if (search) {
//             condition += ` AND (
//                 CASE 
//                     WHEN tbl_orders.client_id = 0 THEN tbl_orders.client_name
//                     ELSE tbl_users.full_name
//                 END LIKE ?
//                 OR tbl_freight.freight_number LIKE ?
//                OR COALESCE(tbl_freight.product_desc, tbl_orders.goods_description) LIKE ?
//                 OR tbl_orders.client_name LIKE ?
//                 OR warehouse_tbl.warehouse_name LIKE ?
//                 OR batches.batch_number LIKE ?
//                 OR c.name LIKE ?
//                 OR co.name LIKE ?
//             )`;
//             const s = `%${search}%`;
//             params.push(s, s, s, s, s, s, s, s);
//         }

//         /* ---------- BASE QUERY ---------- */
//         const baseQueryWithoutGroup = `
//             FROM warehouse_assign_order

//             LEFT JOIN tbl_freight 
//                 ON warehouse_assign_order.freight_id = tbl_freight.id

//             LEFT JOIN shipping_estimate 
//                 ON warehouse_assign_order.freight_id = shipping_estimate.freight_id 
//                 AND tbl_freight.is_deleted = '0'

//             LEFT JOIN tbl_orders 
//                 ON warehouse_assign_order.order_id = tbl_orders.id

//             LEFT JOIN tbl_users 
//                 ON tbl_users.id = tbl_orders.client_id

//             INNER JOIN tbl_users AS login_user
//                 ON login_user.id = ?

//             LEFT JOIN batches 
//                 ON batches.id = warehouse_assign_order.batch_id

//             LEFT JOIN warehouse_tbl 
//                 ON warehouse_tbl.id = batches.warehouse_id

//             LEFT JOIN countries AS c 
//     ON c.id = COALESCE(tbl_freight.delivery_to, tbl_orders.delivery_to)

// LEFT JOIN countries AS co 
//     ON co.id = COALESCE(tbl_freight.collection_from, tbl_orders.collection_from)

//             LEFT JOIN (
//                 SELECT 
//                     warehouse_order_id,
//                     SUM(dimension) AS wp_total_dimension,
//                     SUM(weight) AS wp_total_weight,
//                     SUM(packages) AS wp_total_packages
//                 FROM warehouse_products
//                 GROUP BY warehouse_order_id
//             ) wp ON wp.warehouse_order_id = warehouse_assign_order.id

//             ${condition}
//         `;

//         params.unshift(user_id);

//         const countQuery = `
//             SELECT COUNT(DISTINCT warehouse_assign_order.id) AS total
//             ${baseQueryWithoutGroup}
//         `;

//         const totalResult = await new Promise((resolve, reject) => {
//             con.query(countQuery, params, (err, rows) => {
//                 if (err) return reject(err);
//                 resolve(rows);
//             });
//         });

//         const total = totalResult[0]?.total || 0;
//         const offset = (page - 1) * limit;

//         const query = `
//             SELECT 
//                 warehouse_assign_order.*,
//                 warehouse_assign_order.id AS warehouse_assign_order_id,
//                 warehouse_assign_order.costs_to_collect AS order_costs_to_collect,
//                 warehouse_assign_order.warehouse_cost AS order_warehouse_cost,

//                 tbl_freight.*,
//                 tbl_freight.id AS freight_ID,
//                 tbl_freight.freight AS Freight,
//                 tbl_freight.delivery_to AS country_delivery_to,
//                 tbl_freight.collection_from AS country_collection_form,
// COALESCE(tbl_freight.product_desc, tbl_orders.goods_description) AS product_desc,
//                 SUM(tbl_freight.dimension + IFNULL(wp.wp_total_dimension, 0)) AS total_warehouse_dimension,
//                 SUM(tbl_freight.weight + IFNULL(wp.wp_total_weight, 0)) AS total_warehouse_weight,
//                 SUM(tbl_freight.no_of_packages + IFNULL(wp.wp_total_packages, 0)) AS total_warehouse_noOfPackages,
//                 (COUNT(tbl_freight.id) + COUNT(wp.wp_total_packages)) AS total_freight,

//                 tbl_orders.*,
//                 batches.*,
//                 warehouse_tbl.*,
//                 shipping_estimate.id AS estimated_id,
//                 c.name AS delivery_to_name,
//                 co.name AS collection_from_name,

//                 CASE 
//                     WHEN tbl_orders.client_id = 0 THEN tbl_orders.client_name
//                     ELSE tbl_users.full_name
//                 END AS client_name

//             ${baseQueryWithoutGroup}
//             GROUP BY warehouse_assign_order.id
//             ORDER BY warehouse_assign_order.created_at DESC
//             LIMIT ? OFFSET ?
//         `;

//         const dataParams = [...params, limit, offset];

//         con.query(query, dataParams, (err, data) => {
//             if (err) {
//                 return res.status(500).send({
//                     success: false,
//                     message: err.message
//                 });
//             }

//             return res.status(200).send({
//                 success: true,
//                 data,
//                 total,
//                 page: Number(page),
//                 limit: Number(limit)
//             });
//         });

//     } catch (error) {
//         return res.status(500).send({
//             success: false,
//             message: error.message
//         });
//     }
// };

const GetWarehouseOrders = async (req, res) => {
    try {
        const {
            origin,
            destination,
            startDate,
            endDate,
            freightType,
            freightSpeed,
            user_id,
            user_type,
            search,
            page = 1,
            limit = 10
        } = req.body;

        if (!user_id) {
            return res.status(400).send({
                success: false,
                message: "user_id is required"
            });
        }

        const ALL_ACCESS_USERS = [1, 19855];

        let condition = ` WHERE warehouse_assign_order.warehouse_status = 1 `;
        let params = [];

        /* ===== ACCESS COUNTRY ===== */
        let accessCountries = [];

        if (!ALL_ACCESS_USERS.includes(Number(user_id))) {
            const rows = await new Promise((resolve, reject) => {
                con.query(
                    `SELECT access_country FROM tbl_users WHERE id = ? AND is_deleted = 0`,
                    [user_id],
                    (err, rows) => err ? reject(err) : resolve(rows)
                );
            });

            if (rows.length && rows[0].access_country) {
                accessCountries = rows[0].access_country
                    .split(',')
                    .map(id => Number(id.trim()))
                    .filter(Boolean);
            }
        }

        /* ---------- FILTERS (FIXED) ---------- */

        if (origin) {
            condition += ` AND COALESCE(tbl_freight.collection_from, tbl_orders.collection_from) = ?`;
            params.push(origin);
        }

        if (destination) {
            condition += ` AND COALESCE(tbl_freight.delivery_to, tbl_orders.delivery_to) = ?`;
            params.push(destination);
        }

        // FIXED DATE FILTER
        if (startDate && endDate) {
            condition += `
        AND (
          tbl_freight.created_at BETWEEN ? AND ?
          OR tbl_orders.created_at BETWEEN ? AND ?
        )
      `;
            params.push(startDate, endDate, startDate, endDate);
        }

        if (freightType) {
            condition += ` AND COALESCE(tbl_freight.freight, tbl_orders.freight) = ?`;
            params.push(freightType);
        }

        // FIXED freightSpeed
        if (freightSpeed) {
            condition += ` AND (tbl_freight.type = ? OR tbl_freight.id IS NULL)`;
            params.push(freightSpeed);
        }

        /* ---------- ACCESS CONTROL (FIXED) ---------- */
        if (!ALL_ACCESS_USERS.includes(Number(user_id)) && accessCountries.length) {

            const placeholders = accessCountries.map(() => '?').join(',');

            if (user_type == 2) {
                condition += `
          AND (
            tbl_freight.user_id = ?
            OR tbl_freight.sales_representative = ?
            OR (
              COALESCE(tbl_freight.collection_from, tbl_orders.collection_from) IN (${placeholders})
              OR COALESCE(tbl_freight.delivery_to, tbl_orders.delivery_to) IN (${placeholders})
            )
          )
        `;

                params.push(user_id, user_id, ...accessCountries, ...accessCountries);

            } else {
                condition += `
          AND (
            COALESCE(tbl_freight.collection_from, tbl_orders.collection_from) IN (${placeholders})
            OR COALESCE(tbl_freight.delivery_to, tbl_orders.delivery_to) IN (${placeholders})
          )
        `;
                params.push(...accessCountries, ...accessCountries);
            }
        }

        /* ---------- SEARCH ---------- */
        if (search) {
            condition += ` AND (
        (CASE 
          WHEN tbl_orders.client_id = 0 THEN tbl_orders.client_name
          ELSE tbl_users.full_name
        END LIKE ?)
        OR tbl_freight.freight_number LIKE ?
        OR COALESCE(tbl_freight.product_desc, tbl_orders.goods_description) LIKE ?
        OR tbl_orders.client_name LIKE ?
        OR warehouse_tbl.warehouse_name LIKE ?
        OR batches.batch_number LIKE ?
        OR c.name LIKE ?
        OR co.name LIKE ?
      )`;

            const s = `%${search}%`;
            params.push(s, s, s, s, s, s, s, s);
        }

        /* ---------- BASE QUERY ---------- */

        const baseQuery = `
      FROM warehouse_assign_order

      LEFT JOIN tbl_freight 
        ON warehouse_assign_order.freight_id = tbl_freight.id

      LEFT JOIN tbl_orders 
        ON warehouse_assign_order.order_id = tbl_orders.id

      LEFT JOIN tbl_users 
        ON tbl_users.id = tbl_orders.client_id

      LEFT JOIN batches 
        ON batches.id = warehouse_assign_order.batch_id

      LEFT JOIN warehouse_tbl 
        ON warehouse_tbl.id = batches.warehouse_id

      LEFT JOIN countries c
        ON c.id = COALESCE(tbl_freight.delivery_to, tbl_orders.delivery_to)

      LEFT JOIN countries co
        ON co.id = COALESCE(tbl_freight.collection_from, tbl_orders.collection_from)

      LEFT JOIN (
        SELECT 
          warehouse_order_id,
          SUM(IFNULL(dimension,0)) AS wp_total_dimension,
          SUM(IFNULL(weight,0)) AS wp_total_weight,
          SUM(IFNULL(packages,0)) AS wp_total_packages
        FROM warehouse_products
        GROUP BY warehouse_order_id
      ) wp ON wp.warehouse_order_id = warehouse_assign_order.id

      ${condition}
    `;

        /* ---------- COUNT ---------- */

        const countQuery = `
      SELECT COUNT(DISTINCT warehouse_assign_order.id) AS total
      ${baseQuery}
    `;

        const totalResult = await new Promise((resolve, reject) => {
            con.query(countQuery, params, (err, rows) => err ? reject(err) : resolve(rows));
        });

        const total = totalResult[0]?.total || 0;
        const offset = (page - 1) * limit;

        /* ---------- MAIN QUERY ---------- */

        const query = `
      SELECT 
        warehouse_assign_order.*,
           warehouse_assign_order.id as warehouse_assign_order_id,
        tbl_freight.*,
        tbl_orders.*,
        COALESCE(tbl_freight.delivery_to, tbl_orders.delivery_to) AS delivery_to,
COALESCE(tbl_freight.collection_from, tbl_orders.collection_from) AS collection_from,
        batches.batch_number,

        COALESCE(tbl_freight.freight, tbl_orders.freight) AS Freight,
        COALESCE(tbl_freight.product_desc, tbl_orders.goods_description) AS product_desc,

        SUM(IFNULL(tbl_freight.dimension,0) + IFNULL(wp.wp_total_dimension,0)) AS total_dimension,
        SUM(IFNULL(tbl_freight.weight,0) + IFNULL(wp.wp_total_weight,0)) AS total_weight,
        SUM(IFNULL(tbl_freight.no_of_packages,0) + IFNULL(wp.wp_total_packages,0)) AS total_packages,

        c.name AS delivery_to_name,
        co.name AS collection_from_name,

        CASE 
          WHEN tbl_orders.client_id = 0 THEN tbl_orders.client_name
          ELSE tbl_users.full_name
        END AS client_name

      ${baseQuery}
      GROUP BY warehouse_assign_order.id
      ORDER BY warehouse_assign_order.created_at DESC
      LIMIT ? OFFSET ?
    `;

        const dataParams = [...params, Number(limit), offset];

        con.query(query, dataParams, (err, data) => {
            if (err) {
                console.error("QUERY ERROR:", err);
                return res.status(500).send({
                    success: false,
                    message: err.message
                });
            }

            return res.status(200).send({
                success: true,
                data,
                total,
                page: Number(page),
                limit: Number(limit)
            });
        });

    } catch (error) {
        console.error(error);
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

const assignWarehouseOrderToSupplier = (req, res) => {
    try {
        const { order_id, freight_id, supplier_id } = req.body;

        if (!order_id || !freight_id || !supplier_id) {
            return res.status(400).json({
                success: false,
                message: "order_id, freight_id and supplier_id are required"
            });
        }

        /* ================= SUPPLIER VALIDATION ================= */
        const supplierSql = `
            SELECT id 
            FROM tbl_suppliers 
            WHERE id = ? AND is_deleted = 0
        `;

        con.query(supplierSql, [supplier_id], (err, supplierRows) => {
            if (err) return res.status(500).json({ success: false, message: err.message });

            if (supplierRows.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid supplier"
                });
            }

            /* ================= CHECK WAREHOUSE ORDER ================= */
            const warehouseOrderSql = `
                SELECT id, supplier_id
                FROM warehouse_assign_order
                WHERE order_id = ? AND freight_id = ? AND warehouse_status = 1
            `;

            con.query(warehouseOrderSql, [order_id, freight_id], (err, rows) => {
                if (err) return res.status(500).json({ success: false, message: err.message });

                if (rows.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Warehouse order not found"
                    });
                }

                const warehouseOrder = rows[0];

                /* ================= ALREADY ASSIGNED ================= */
                if (warehouseOrder.supplier_id) {
                    if (warehouseOrder.supplier_id == supplier_id) {
                        return res.status(400).json({
                            success: false,
                            message: "Order already assigned to this supplier"
                        });
                    }

                    return res.status(400).json({
                        success: false,
                        message: "Order already assigned to another supplier"
                    });
                }

                /* ================= UPDATE WAREHOUSE ASSIGN ================= */
                const updateWarehouseAssignSql = `
                    UPDATE warehouse_assign_order
                    SET supplier_id = ?
                    WHERE id = ?
                `;

                con.query(
                    updateWarehouseAssignSql,
                    [supplier_id, warehouseOrder.id],
                    (err) => {
                        if (err) {
                            return res.status(500).json({
                                success: false,
                                message: "Failed to assign supplier",
                                error: err.message
                            });
                        }

                        /* ================= UPDATE ORDER (REFERENCE) ================= */
                        const updateOrderSql = `
                            UPDATE tbl_orders
                            SET supplier_id = ?, warehouse_status = 1
                            WHERE id = ? AND freight_id = ?
                        `;

                        con.query(
                            updateOrderSql,
                            [supplier_id, order_id, freight_id],
                            () => {
                                return res.status(200).json({
                                    success: true,
                                    message: "Supplier successfully assigned to warehouse order"
                                });
                            }
                        );
                    }
                );
            });
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getAssignedOrdersBySupplier = async (req, res) => {
    try {
        const {
            supplier_id,
            search,
            page = 1,
            limit = 10
        } = req.body;

        if (!supplier_id) {
            return res.status(400).send({
                success: false,
                message: "supplier_id is required"
            });
        }

        let condition = `
            WHERE warehouse_assign_order.warehouse_status = '1'
            AND warehouse_assign_order.supplier_id = ?
            AND tbl_freight.is_deleted = '0'
        `;

        let params = [supplier_id];

        /* ---------- GLOBAL SEARCH ---------- */
        if (search) {
            condition += ` AND (
                CASE 
                    WHEN tbl_orders.client_id = 0 THEN tbl_orders.client_name
                    ELSE tbl_users.full_name
                END LIKE ?
                OR tbl_freight.freight_number LIKE ?
                OR tbl_freight.product_desc LIKE ?
                OR tbl_orders.client_name LIKE ?
                OR warehouse_tbl.warehouse_name LIKE ?
                OR batches.batch_number LIKE ?
                OR c.name LIKE ?
                OR co.name LIKE ?
            )`;

            const s = `%${search}%`;
            params.push(s, s, s, s, s, s, s, s);
        }

        /* ---------- BASE QUERY (EXACT SAME AS GetWarehouseOrders) ---------- */
        const baseQueryWithoutGroup = `
            FROM warehouse_assign_order

            LEFT JOIN tbl_freight 
                ON warehouse_assign_order.freight_id = tbl_freight.id

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

            LEFT JOIN (
                SELECT 
                    warehouse_order_id,
                    SUM(dimension) AS wp_total_dimension,
                    SUM(weight) AS wp_total_weight,
                    SUM(packages) AS wp_total_packages
                FROM warehouse_products
                GROUP BY warehouse_order_id
            ) wp ON wp.warehouse_order_id = warehouse_assign_order.id

            ${condition}
        `;

        const baseQuery = `
            ${baseQueryWithoutGroup}
            GROUP BY warehouse_assign_order.id
        `;

        /* ---------- COUNT ---------- */
        const countQuery = `
            SELECT COUNT(DISTINCT warehouse_assign_order.id) AS total
            ${baseQueryWithoutGroup}
        `;

        const totalResult = await new Promise((resolve, reject) => {
            con.query(countQuery, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });

        const total = totalResult[0]?.total || 0;
        const offset = (page - 1) * limit;

        /* ---------- DATA QUERY (EXACT SAME SELECT) ---------- */
        const query = `
            SELECT 
                warehouse_assign_order.*,
                warehouse_assign_order.id AS warehouse_assign_order_id,
                warehouse_assign_order.costs_to_collect AS order_costs_to_collect,
                warehouse_assign_order.warehouse_cost AS order_warehouse_cost,

                tbl_freight.*,
                tbl_freight.id AS freight_ID,
                tbl_freight.freight AS Freight,
                tbl_freight.delivery_to AS country_delivery_to,
                tbl_freight.collection_from AS country_collection_form,

                SUM(tbl_freight.dimension + IFNULL(wp.wp_total_dimension, 0)) AS total_warehouse_dimension,
                SUM(tbl_freight.weight + IFNULL(wp.wp_total_weight, 0)) AS total_warehouse_weight,
                SUM(tbl_freight.no_of_packages + IFNULL(wp.wp_total_packages, 0)) AS total_warehouse_noOfPackages,
                (COUNT(tbl_freight.id) + COUNT(wp.wp_total_packages)) AS total_freight,

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

            ${baseQuery}
            ORDER BY warehouse_assign_order.created_at DESC
            LIMIT ? OFFSET ?
        `;

        const dataParams = [...params, Number(limit), Number(offset)];

        con.query(query, dataParams, (err, data) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: err.message
                });
            }

            return res.status(200).send({
                success: true,
                data,
                total,
                page: Number(page),
                limit: Number(limit)
            });
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

// const getWarehouseOrderProduct = async (req, res) => {
//     try {
//         const { warehouse_assign_order_id } = req.body;

//         // Step 1: Fetch freight details first
//         con.query(
//             `
//             SELECT 
//                 product_desc AS product_description, 
//                 date AS date_received, 
//                 hazardous AS Hazardous, 
//                 package_type AS package_type, 
//                 no_of_packages AS packages, 
//                 dimension, 
//                 weight
//             FROM 
//                 tbl_freight
//             WHERE 
//                 id = (
//                     SELECT freight_id 
//                     FROM warehouse_assign_order 
//                     WHERE id = ?
//                 )
//             `,
//             [warehouse_assign_order_id],
//             (err, freightData) => {
//                 if (err) throw err;

//                 if (freightData.length === 0) {
//                     return res.status(400).send({
//                         success: false,
//                         message: "No freight data found for the given ID",
//                     });
//                 }

//                 // Step 2: Fetch warehouse product details
//                 con.query(
//                     `
//                     SELECT 
//                         warehouse_products.id as warehouse_products_id, 
//                         warehouse_products.warehouse_order_id, 
//                         warehouse_products.product_description, 
//                         warehouse_products.Hazardous, 
//                         warehouse_products.date_received, 
//                         warehouse_products.package_type, 
//                         warehouse_products.packages, 
//                         warehouse_products.dimension, 
//                         warehouse_products.weight, 
//                         warehouse_products.warehouse_ref, 
//                         warehouse_products.created,
//                         warehouse_products.tracking_number,
//                         warehouse_assign_order.costs_to_collect as order_costs_to_collect,
//                         warehouse_assign_order.warehouse_cost as order_warehouse_cost,
//                         warehouse_assign_order.freight_id
//                     FROM 
//                         warehouse_products
//                     LEFT JOIN 
//                         warehouse_assign_order 
//                         ON warehouse_assign_order.id = warehouse_products.warehouse_order_id
//                     WHERE 
//                         warehouse_products.warehouse_order_id = ?
//                     ORDER BY 
//                         warehouse_products.created DESC
//                     `,
//                     [warehouse_assign_order_id],
//                     (err, productsData) => {
//                         if (err) throw err;

//                         // Combine freight details into the productsData array
//                         const responseData = [
//                             {
//                                 ...freightData[0], // Freight details at the top
//                             },
//                             ...productsData, // Append all warehouse product data
//                         ];

//                         return res.status(200).send({
//                             success: true,
//                             data: responseData,
//                         });
//                     }
//                 );
//             }
//         );
//     } catch (error) {
//         // console.error("Error in getWarehouseOrderProduct:", error.message);
//         return res.status(500).send({
//             success: false,
//             message: error.message,
//         });
//     }
// };

const getWarehouseOrderProduct = async (req, res) => {
    try {
        const { warehouse_assign_order_id } = req.body;

        // Step 1: Get freight_id first
        con.query(
            `SELECT freight_id FROM warehouse_assign_order WHERE id = ?`,
            [warehouse_assign_order_id],
            (err, orderResult) => {
                if (err) {
                    return res.status(500).send({ success: false, message: err.message });
                }

                if (!orderResult.length) {
                    return res.status(404).send({
                        success: false,
                        message: "Order not found"
                    });
                }

                const freight_id = orderResult[0].freight_id;

                // Step 2: If NO freight → skip freight query
                const fetchProducts = () => {
                    con.query(
                        `
                        SELECT
                            warehouse_products.*,
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
                            warehouse_assign_order.costs_to_collect as order_costs_to_collect,
                            warehouse_assign_order.warehouse_cost as order_warehouse_cost,
                            warehouse_assign_order.freight_id
                        FROM warehouse_products
                        LEFT JOIN warehouse_assign_order 
                            ON warehouse_assign_order.id = warehouse_products.warehouse_order_id
                        WHERE warehouse_products.warehouse_order_id = ?
                        ORDER BY warehouse_products.created DESC
                        `,
                        [warehouse_assign_order_id],
                        (err, productsData) => {
                            if (err) {
                                return res.status(500).send({ success: false, message: err.message });
                            }

                            return res.status(200).send({
                                success: true,
                                data: productsData //  ONLY products
                            });
                        }
                    );
                };

                // Step 3: If freight exists → fetch freight + products
                if (freight_id && freight_id !== 0) {
                    con.query(
                        `
                        SELECT 
                            product_desc AS product_description, 
                            date AS date_received, 
                            hazardous AS Hazardous, 
                            package_type, 
                            no_of_packages AS packages, 
                            dimension, 
                            weight
                        FROM tbl_freight
                        WHERE id = ?
                        `,
                        [freight_id],
                        (err, freightData) => {
                            if (err) {
                                return res.status(500).send({ success: false, message: err.message });
                            }

                            // fetch products
                            con.query(
                                `
                                SELECT 
                                warehouse_products.*,
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
                                    warehouse_assign_order.costs_to_collect as order_costs_to_collect,
                                    warehouse_assign_order.warehouse_cost as order_warehouse_cost,
                                    warehouse_assign_order.freight_id
                                FROM warehouse_products
                                LEFT JOIN warehouse_assign_order 
                                    ON warehouse_assign_order.id = warehouse_products.warehouse_order_id
                                WHERE warehouse_products.warehouse_order_id = ?
                                ORDER BY warehouse_products.created DESC
                                `,
                                [warehouse_assign_order_id],
                                (err, productsData) => {
                                    if (err) {
                                        return res.status(500).send({ success: false, message: err.message });
                                    }

                                    const responseData = [
                                        ...(freightData.length ? [freightData[0]] : []),
                                        ...productsData
                                    ];

                                    return res.status(200).send({
                                        success: true,
                                        data: responseData
                                    });
                                }
                            );
                        }
                    );
                } else {
                    // No freight → only products
                    fetchProducts();
                }
            }
        );

    } catch (error) {
        return res.status(500).send({
            success: false,
            message: error.message,
        });
    }
};

// const updateWarehouseProduct = async (req, res) => {
//     try {
//         const {
//             warehouse_products_id, // Ensure this is passed to identify the product
//             product_description,
//             Hazardous,
//             date_received,
//             package_type,
//             packages,
//             dimension,
//             weight,
//             warehouse_ref
//         } = req.body;

//         if (!warehouse_products_id) {
//             return res.status(400).send({
//                 success: false,
//                 message: "Product ID is required for updating."
//             });
//         }

//         const query = `
//             UPDATE warehouse_products
//             SET 
//                 product_description = ?, 
//                 Hazardous = ?, 
//                 date_received = ?, 
//                 package_type = ?, 
//                 packages = ?, 
//                 dimension = ?, 
//                 weight = ?, 
//                 warehouse_ref = ?
//             WHERE id = ?`;

//         const values = [
//             product_description,
//             Hazardous,
//             date_received,
//             package_type,
//             packages,
//             dimension,
//             weight,
//             warehouse_ref,
//             warehouse_products_id // Ensure `product_id` is used in the WHERE clause
//         ];

//         con.query(query, values, (err, result) => {
//             if (err) throw err;

//             if (result.affectedRows === 0) {
//                 return res.status(404).send({
//                     success: false,
//                     message: "No product found with the given ID."
//                 });
//             }

//             res.status(200).send({
//                 success: true,
//                 message: "Warehouse Product Details Updated successfully"
//             });
//         });
//     } catch (error) {
//         res.status(500).send({
//             success: false,
//             message: error.message
//         });
//     }
// };

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
            ], async (err, result) => {
                if (err) {
                    return res.status(500).send({
                        success: false,
                        message: err.message
                    });
                }
                // if (req.files && req.files.document && req.files.document.length > 0) {
                //     // console.log("hii");
                //     const file = req.files.document[0];
                //     const documentName = req.body.documentName;


                //     const freightIds = await new Promise((resolve, reject) => {
                //         con.query(
                //             `SELECT freight_id FROM freight_assig_to_batch WHERE batch_id = ?`,
                //             [order.order_id],
                //             (err, result) => {
                //                 if (err) return reject(err);
                //                 if (result.length === 0) return reject(new Error("No freight_id found for order"));
                //                 resolve(result[0].freight_id);
                //             }
                //         );
                //     });
                //     for (const freightId of freightIds) {
                //         const freightNumber = await new Promise((resolve, reject) => {
                //             con.query(
                //                 `SELECT freight_number FROM tbl_freight WHERE id = ?`,
                //                 [freightId],
                //                 (err, result) => {
                //                     if (err) return reject(err);
                //                     if (result.length === 0) return reject(new Error("No freight_number found for freight_id"));
                //                     resolve(result[0].freight_number);
                //                 }
                //             );
                //         });

                //         const freightFolderId = await findOrCreateFolder(freightNumber);
                //         const googleFileId = await uploadToMatchingFolder(file, documentName, freightNumber);

                //         await new Promise((resolve, reject) => {
                //             con.query(
                //                 `INSERT INTO freight_doc (freight_id, document_name, document) VALUES (?, ?, ?)`,
                //                 [freightId, documentName, file.filename],
                //                 (err) => {
                //                     if (err) return reject(err);
                //                     resolve();
                //                 }
                //             );
                //         });
                //     }
                // }
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

/* const createBatch = async (req, res) => {
    try {
        const {
            batch_number,
            warehouse_id,
            date_first_received,
            ETD,
            total_days_storage,
            batch_name,
            is_exporImport,
            freight, // should be array of freight_ids
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

        //  1. Check if batch_number already exists
        const checkQuery = 'SELECT * FROM batches WHERE batch_number = ?';
        con.query(checkQuery, [batch_number], (err, result) => {
            if (err) {
                return res.status(500).send({ success: false, message: err.message });
            }

            if (result.length > 0) {
                return res.status(400).send({
                    success: false,
                    message: 'Batch number already exists'
                });
            }

            //  2. Insert new batch
            const insertQuery = `
                INSERT INTO batches (
                    batch_number, warehouse_id, date_first_received, ETD, total_days_storage, 
                    batch_name, is_exporImport, freight_option, freight_speed, 
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
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            con.query(insertQuery, [
                batch_number, warehouse_id, date_first_received, ETD, total_days_storage,
                batch_name, is_exporImport, freight_option, freight_speed,
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
                    return res.status(500).send({ success: false, message: err.message });
                }

                const batchId = result.insertId;

                // 3. Assign freights to batch
                if (freight && Array.isArray(freight)) {
                    freight.forEach(freightId => {
                        con.query(
                            `INSERT INTO freight_assig_to_batch (batch_id, freight_id) VALUES (?, ?)`,
                            [batchId, freightId],
                            (err) => {
                                if (err) console.error("Error linking freight:", err);
                            }
                        );
                    });
                }

                // 4. Handle uploaded documents
                if (req.files && Object.keys(req.files).length > 0) {
                    for (const fieldName of Object.keys(req.files)) {
                        const filesArray = req.files[fieldName];

                        filesArray.forEach(file => {
                            const originalName = file.originalname;
                            const savedName = file.filename;

                            // Insert into batch_documents
                            con.query(
                                `INSERT INTO batch_documents (batch_id, document_name, document_file) VALUES (?, ?, ?)`,
                                [batchId, originalName, savedName],
                                (err) => {
                                    if (err) console.error("Error inserting batch document:", err);
                                }
                            );

                            // For each freight, insert docs into freight_doc
                            if (freight && Array.isArray(freight)) {
                                freight.forEach(freightId => {
                                    con.query(
                                        `SELECT freight_number FROM tbl_freight WHERE id = ?`,
                                        [freightId],
                                        (err, freightRes) => {
                                            if (err) {
                                                console.error("Error fetching freight_number:", err);
                                                return;
                                            }

                                            if (freightRes.length > 0) {
                                                const freightNumber = freightRes[0].freight_number;
                                                con.query(
                                                    `INSERT INTO freight_doc (freight_id, freight_number, document_name, document_file) VALUES (?, ?, ?, ?)`,
                                                    [freightId, freightNumber, originalName, savedName],
                                                    (err) => {
                                                        if (err) console.error("Error inserting freight document:", err);
                                                    }
                                                );
                                            }
                                        }
                                    );
                                });
                            }
                        });
                    }
                }

                //  5. Respond success
                return res.status(201).send({
                    success: true,
                    message: 'Batch created successfully',
                    batchId: batchId
                });
            });
        });
    } catch (error) {
        return res.status(500).send({ success: false, message: error.message });
    }
};
 */

const getAllBatch = async (req, res) => {
    try {
        const getQuery = `
            SELECT b.*, 
                   b.origin_country_id AS origin_country, 
                   b.detination_country_id AS destination_country,
                   c.name AS des_country_name, 
                   co.name AS origin_country_name
            FROM batches AS b
            LEFT JOIN countries AS c ON c.id = b.detination_country_id
            LEFT JOIN countries AS co ON co.id = b.origin_country_id
            WHERE b.is_deleted = ?
            ORDER BY b.id DESC
        `;

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
                    message: 'No batches found',
                });
            }

            try {
                const updatedResults = await Promise.all(
                    results.map((result) => {
                        return new Promise((resolve, reject) => {
                            const getFreightQuery = `
                                SELECT 
                                    COUNT(tbl_freight.id) AS count_freight,
                                    SUM(tbl_freight.dimension) AS total_dimension,
                                    SUM(tbl_freight.weight) AS total_weight,
                                    SUM(tbl_freight.no_of_packages) AS total_packages
                                FROM freight_assig_to_batch
                                INNER JOIN tbl_freight 
                                    ON tbl_freight.id = freight_assig_to_batch.freight_id
                                WHERE freight_assig_to_batch.batch_id = ?
                            `;

                            con.query(getFreightQuery, [result.id], (err, data) => {
                                if (err) return reject(err);

                                const totals = data[0];

                                result.count_freight = totals.count_freight || 0;
                                result.total_freight_dimension = totals.total_dimension || 0;
                                result.total_freight_weight = totals.total_weight || 0;
                                result.total_freight_packages = totals.total_packages || 0;

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
                    message: 'Failed to fetch freight summary',
                    error: innerErr.message,
                });
            }
        });
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: 'Unexpected server error',
            error: error.message,
        });
    }
};

const NewGetAllBatch = async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.body;

        let condition = `WHERE b.is_deleted = ?`;
        let params = [0];

        // Add global search condition across multiple fields
        if (search) {
            condition += ` AND (
                c.name LIKE ?
                OR co.name LIKE ?
                OR b.id LIKE ?
                OR b.batch_number LIKE ?
                OR c.name LIKE ?
                OR b.origin_handler LIKE ?
                OR b.des_handler LIKE ?
                OR b.track_status LIKE ?
                OR b.freight LIKE ?
            )`;
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam);
        }

        // Build base query for joins and conditions
        const baseQuery = `
            FROM batches AS b
            LEFT JOIN countries AS c ON c.id = b.detination_country_id
            LEFT JOIN countries AS co ON co.id = b.origin_country_id
            ${condition}
        `;

        // Query for total count
        const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
        const totalResult = await new Promise((resolve, reject) => {
            con.query(countQuery, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
        const total = totalResult[0].total;

        // Calculate offset for pagination
        const offset = (page - 1) * limit;

        const getQuery = `
            SELECT b.*, 
                   b.origin_country_id AS origin_country, 
                   b.detination_country_id AS destination_country,
                   c.name AS des_country_name, 
                   co.name AS origin_country_name
            ${baseQuery}
            ORDER BY b.id DESC
            LIMIT ? OFFSET ?
        `;

        // Add limit and offset to params
        const dataParams = [...params, limit, offset];

        con.query(getQuery, dataParams, async (err, results) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: err.message,
                });
            }

            try {
                const updatedResults = await Promise.all(
                    results.map((result) => {
                        return new Promise((resolve, reject) => {
                            const getFreightQuery = `
                                SELECT 
                                    COUNT(tbl_freight.id) AS count_freight,
                                    SUM(tbl_freight.dimension) AS total_dimension,
                                    SUM(tbl_freight.weight) AS total_weight,
                                    SUM(tbl_freight.no_of_packages) AS total_packages
                                FROM freight_assig_to_batch
                                INNER JOIN tbl_freight 
                                    ON tbl_freight.id = freight_assig_to_batch.freight_id
                                WHERE freight_assig_to_batch.batch_id = ?
                            `;

                            con.query(getFreightQuery, [result.id], (err, data) => {
                                if (err) return reject(err);

                                const totals = data[0];

                                result.count_freight = totals.count_freight || 0;
                                result.total_freight_dimension = totals.total_dimension || 0;
                                result.total_freight_weight = totals.total_weight || 0;
                                result.total_freight_packages = totals.total_packages || 0;

                                resolve(result);
                            });
                        });
                    })
                );

                // Always return success with data (empty array if no records), total, page, limit
                return res.status(200).send({
                    success: true,
                    data: updatedResults,
                    total: total,
                    page: parseInt(page),
                    limit: parseInt(limit)
                });
            } catch (innerErr) {
                return res.status(500).send({
                    success: false,
                    message: 'Failed to fetch freight summary',
                    error: innerErr.message,
                });
            }
        });
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: 'Unexpected server error',
            error: error.message,
        });
    }
};

const getBatchList = async (req, res) => {
    try {
        const getQuery = `
            SELECT b.id, b.batch_number, b.batch_name
            FROM batches as b
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
                u.full_name AS client_Name,
                u.client_number AS client_number,
                ws.id as warehouse_assign_order_id
            FROM freight_assig_to_batch fa
            LEFT JOIN tbl_freight f ON fa.freight_id = f.id
            LEFT JOIN tbl_orders o ON fa.freight_id = o.freight_id
            LEFT JOIN order_delivery_details od ON od.order_id = o.id
            LEFT JOIN batches b ON b.id = fa.batch_id
            LEFT JOIN warehouse_tbl w ON w.id = b.warehouse_id
            LEFT JOIN warehouse_assign_order ws ON ws.order_id = o.id
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
        const {
            status,
            origin,
            destination,
            startDate,
            endDate,
            clearingType,
            user_id,
            user_type,
            search,
            page = 1,
            limit = 10
        } = req.body;

        if (!user_id) {
            return res.status(400).send({
                success: false,
                message: "user_id is required"
            });
        }

        const ALL_ACCESS_USERS = [1, 19855];

        /* ================= ACCESS COUNTRY ================= */
        let accessCountries = [];

        if (!ALL_ACCESS_USERS.includes(Number(user_id))) {
            const userResult = await new Promise((resolve, reject) => {
                con.query(
                    `SELECT access_country FROM tbl_users WHERE id = ? AND is_deleted = 0`,
                    [user_id],
                    (err, rows) => {
                        if (err) return reject(err);
                        resolve(rows);
                    }
                );
            });

            if (userResult.length && userResult[0].access_country) {
                accessCountries = userResult[0].access_country
                    .split(',')
                    .map(id => Number(id.trim()));
            }
        }

        let condition = `WHERE clearance_order.is_deleted = ?`;
        let params = [0];

        /* ---------------- FILTERS ---------------- */
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

        /* ---------------- ACCESS CONTROL ---------------- */
        if (!ALL_ACCESS_USERS.includes(Number(user_id)) && accessCountries.length) {

            const placeholders = accessCountries.map(() => '?').join(',');

            if (Number(user_type) === 2) {
                // STAFF → Assigned OR Sales Rep OR Country
                condition += `
                    AND (
                        tbl_clearance.added_user_id = ?
                        OR tbl_clearance.sales_representative = ?
                        OR (
                            tbl_clearance.loading_country IN (${placeholders})
                            OR tbl_clearance.discharge_country IN (${placeholders})
                        )
                    )
                `;
                params.push(user_id, user_id, ...accessCountries, ...accessCountries);

            } else {
                // NON-STAFF → Country only
                condition += `
                    AND (
                        tbl_clearance.loading_country IN (${placeholders})
                        OR tbl_clearance.discharge_country IN (${placeholders})
                    )
                `;
                params.push(...accessCountries, ...accessCountries);
            }
        }

        /* ---------------- SEARCH ---------------- */
        if (search) {
            condition += ` AND (
                tbl_users.full_name LIKE ?
                OR tbl_users.client_number LIKE ?
                OR a.name LIKE ?
                OR b.name LIKE ?
                OR clearance_order.id LIKE ?
                OR tbl_clearance.clearance_number LIKE ?
                OR clearance_order.order_status LIKE ?
            )`;
            const searchParam = `%${search}%`;
            params.push(
                searchParam,
                searchParam,
                searchParam,
                searchParam,
                searchParam,
                searchParam,
                searchParam
            );
        }

        /* ---------------- BASE QUERY ---------------- */
        const baseQuery = `
            FROM clearance_order

            INNER JOIN tbl_clearance
                ON tbl_clearance.id = clearance_order.clearance_id

            INNER JOIN tbl_users
                ON tbl_users.id = clearance_order.user_id

            INNER JOIN tbl_users AS login_user
                ON login_user.id = ?

            INNER JOIN countries AS a
                ON a.id = tbl_clearance.discharge_country

            INNER JOIN countries AS b
                ON b.id = tbl_clearance.loading_country

            ${condition}
        `;

        // login_user.id first
        params.unshift(user_id);

        /* ---------------- COUNT ---------------- */
        const countQuery = `
            SELECT COUNT(DISTINCT clearance_order.id) AS total
            ${baseQuery}
        `;

        const totalResult = await new Promise((resolve, reject) => {
            con.query(countQuery, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });

        const total = totalResult[0].total;
        const offset = (page - 1) * limit;

        /* ---------------- DATA QUERY ---------------- */
        const query = `
            SELECT 
                clearance_order.*,
                clearance_order.id AS clearance_id,

                tbl_clearance.*,

                a.name AS port_of_exit_name,
                b.name AS port_of_entry_name,

                tbl_users.full_name AS client_name,
                tbl_users.client_number AS client_number

            ${baseQuery}
            ORDER BY clearance_order.created_at DESC
            LIMIT ? OFFSET ?
        `;

        const dataParams = [...params, Number(limit), Number(offset)];

        con.query(query, dataParams, (err, data) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: err.message
                });
            }

            return res.status(200).send({
                success: true,
                data,
                total,
                page: Number(page),
                limit: Number(limit)
            });
        });

    } catch (error) {
        return res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

const getClerance = async (req, res) => {
    try {
        const {
            origin,
            destination,
            freight,   // tbl_clearance.freight
            status,
            startDate,
            endDate,
            user_id,
            user_type
        } = req.body;

        if (!origin || !destination || !freight) {
            return res.status(400).json({
                success: false,
                message: "origin, destination and freight are required"
            });
        }

        let condition = `WHERE clearance_order.is_deleted = 0 AND clearance_order.assign_to_shipment = 0`;
        let params = [];

        // Mandatory filters (ALL must match)
        condition += ` AND tbl_clearance.loading_country = ?`;
        params.push(origin);

        condition += ` AND tbl_clearance.discharge_country = ?`;
        params.push(destination);

        condition += ` AND tbl_clearance.freight = ?`;
        params.push(freight);

        // Optional filters
        if (status) {
            condition += ` AND clearance_order.order_status = ?`;
            params.push(status);
        }

        if (startDate && endDate) {
            condition += ` AND clearance_order.created_at BETWEEN ? AND ?`;
            params.push(startDate, endDate);
        }

        const All_access_USER_ID = 19855;

        // User based access
        if (user_type == 2 && user_id && user_id !== All_access_USER_ID) {
            condition += ` AND (tbl_clearance.added_user_id = ? OR tbl_clearance.sales_representative = ?)`;
            params.push(user_id, user_id);
        }

        const query = `
            SELECT 
                clearance_order.*, 
                clearance_order.id AS clearance_id, 
                tbl_clearance.*,
                a.name AS port_of_exit_name, 
                b.name AS port_of_entry_name, 
                tbl_users.full_name AS client_name,
                tbl_users.client_number AS client_number
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
            ORDER BY clearance_order.created_at DESC
        `;

        con.query(query, params, (err, data) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: err.message
                });
            }

            return res.status(200).json({
                success: true,
                count: data.length,
                data
            });
        });

    } catch (error) {
        res.status(500).json({
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

// const addWarehouse = async (req, res) => {
//     try {
//         const {
//             warehouse_number,
//             warehouse_name,
//             company_name,
//             warehouse_address,
//             town,
//             country,
//             email,
//             contact_person,
//             mobile_number,
//             user_id,
//             supplier_id,
//             user_type       // 1 = Asia warehouse, 2 = Supplier warehouse
//         } = req.body;

//         // **** Validation ****
//         if (!user_id || !user_type) {
//             return res.status(400).json({
//                 success: false,
//                 error: "user_id and user_type are required"
//             });
//         }

//         if (![1, 2].includes(Number(user_type))) {
//             return res.status(400).json({
//                 success: false,
//                 error: "Invalid user_type. Must be 1 (Asia) or 2 (Supplier)"
//             });
//         }

//         // Check if the warehouse_number already exists
//         const checkQuery = `
//             SELECT COUNT(*) AS count 
//             FROM warehouse_tbl 
//             WHERE warehouse_number = ?
//         `;

//         con.query(checkQuery, [warehouse_number], async (err, results) => {
//             if (err) {
//                 return res.status(500).json({ success: false, error: err.message });
//             }

//             if (results[0].count > 0) {
//                 return res.status(400).json({
//                     success: false,
//                     error: 'Warehouse number already exists'
//                 });
//             }

//             // Insert query including password column
//             const insertQuery = `
//                 INSERT INTO warehouse_tbl (
//                     warehouse_number, warehouse_name, company_name, warehouse_address, town,
//                     country, email, contact_person, mobile_number, user_id, user_type
//                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//             `;

//             con.query(insertQuery, [
//                 warehouse_number,
//                 warehouse_name,
//                 company_name,
//                 warehouse_address,
//                 town,
//                 country,
//                 email,
//                 contact_person,
//                 mobile_number,
//                 user_id,
//                 user_type
//             ], (err, results) => {
//                 if (err) {
//                     return res.status(500).json({ success: false, error: err.message });
//                 }

//                 res.status(200).json({
//                     success: true,
//                     message: 'Warehouse added successfully',
//                     warehouse_id: results.insertId
//                 });
//             });
//         });

//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: error.message
//         });
//     }
// };


const addWarehouse = async (req, res) => {
    try {
        const {
            warehouse_number,
            warehouse_name,
            company_name,
            warehouse_address,
            town,
            country,
            email,
            contact_person,
            mobile_number,
            user_id,
            supplier_id,
            user_type   // 1 = Asia warehouse, 2 = Supplier warehouse
        } = req.body;

        // **** Basic Validation ****
        if (!user_id || !user_type) {
            return res.status(400).json({
                success: false,
                error: "user_id and user_type are required"
            });
        }

        if (![1, 2].includes(Number(user_type))) {
            return res.status(400).json({
                success: false,
                error: "Invalid user_type. Must be 1 (Asia) or 2 (Supplier)"
            });
        }

        //  supplier_id required if user_type = 2
        if (Number(user_type) === 2 && !supplier_id) {
            return res.status(400).json({
                success: false,
                error: "supplier_id is required when user_type = 2"
            });
        }

        // **** Check duplicate warehouse_number ****
        const checkQuery = `
            SELECT COUNT(*) AS count 
            FROM warehouse_tbl 
            WHERE warehouse_number = ?
        `;

        con.query(checkQuery, [warehouse_number], (err, results) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    error: err.message
                });
            }

            if (results[0].count > 0) {
                return res.status(400).json({
                    success: false,
                    error: "Warehouse number already exists"
                });
            }

            // **** Insert Query ****
            const insertQuery = `
                INSERT INTO warehouse_tbl (
                    warehouse_number,
                    warehouse_name,
                    company_name,
                    warehouse_address,
                    town,
                    country,
                    email,
                    contact_person,
                    mobile_number,
                    user_id,
                    user_type,
                    supplier_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const values = [
                warehouse_number,
                warehouse_name,
                company_name,
                warehouse_address,
                town,
                country,
                email,
                contact_person,
                mobile_number,
                user_id,
                user_type,
                Number(user_type) === 2 ? supplier_id : null
            ];

            con.query(insertQuery, values, (err, results) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        error: err.message
                    });
                }

                return res.status(200).json({
                    success: true,
                    message: "Warehouse added successfully",
                    warehouse_id: results.insertId
                });
            });
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// const editWarehouse = async (req, res) => {
//     try {
//         const {
//             warehouse_number,
//             warehouse_name,
//             company_name,
//             warehouse_address,
//             town,
//             country,
//             email,
//             contact_person,
//             mobile_number,
//             user_id,
//             user_type,
//             warehouse_id
//         } = req.body;

//         if (!warehouse_id) {
//             return res.status(400).json({ success: false, error: "warehouse_id is required" });
//         }

//         // Validate user_type
//         if (user_type && ![1, 2].includes(Number(user_type))) {
//             return res.status(400).json({
//                 success: false,
//                 error: "Invalid user_type (1 = Asia, 2 = Supplier)"
//             });
//         }

//         // Check if warehouse_number already exists for another record
//         const checkQuery = `
//             SELECT COUNT(*) AS count 
//             FROM warehouse_tbl 
//             WHERE warehouse_number = ? 
//             AND id <> ?
//         `;

//         con.query(checkQuery, [warehouse_number, warehouse_id], (err, results) => {
//             if (err) {
//                 return res.status(500).json({ success: false, error: err.message });
//             }

//             if (results[0].count > 0) {
//                 return res.status(400).json({
//                     success: false,
//                     error: "Warehouse number already exists for another warehouse"
//                 });
//             }

//             // Update query with new fields
//             const updateQuery = `
//                 UPDATE warehouse_tbl SET
//                     warehouse_number = ?, 
//                     warehouse_name = ?, 
//                     company_name = ?,
//                     warehouse_address = ?, 
//                     town = ?, 
//                     country = ?, 
//                     email = ?, 
//                     contact_person = ?, 
//                     mobile_number = ?,
//                     user_id = ?,
//                     user_type = ?
//                 WHERE id = ?
//             `;

//             con.query(updateQuery, [
//                 warehouse_number,
//                 warehouse_name,
//                 company_name,
//                 warehouse_address,
//                 town,
//                 country,
//                 email,
//                 contact_person,
//                 mobile_number,
//                 user_id,
//                 user_type,
//                 warehouse_id
//             ], (err, results) => {
//                 if (err) {
//                     return res.status(500).json({ success: false, error: err.message });
//                 }

//                 if (results.affectedRows === 0) {
//                     return res.status(404).json({ success: false, error: "Warehouse not found" });
//                 }

//                 res.status(200).json({
//                     success: true,
//                     message: "Warehouse updated successfully"
//                 });
//             });
//         });

//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: error.message
//         });
//     }
// };

const editWarehouse = async (req, res) => {
    try {
        const {
            warehouse_id,
            warehouse_number,
            warehouse_name,
            company_name,
            warehouse_address,
            town,
            country,
            email,
            contact_person,
            mobile_number,
            user_id,
            user_type,
            supplier_id
        } = req.body;

        if (!warehouse_id) {
            return res.status(400).json({
                success: false,
                error: "warehouse_id is required"
            });
        }

        // Validate user_type
        if (user_type && ![1, 2].includes(Number(user_type))) {
            return res.status(400).json({
                success: false,
                error: "Invalid user_type (1 = Asia, 2 = Supplier)"
            });
        }

        // supplier_id required if user_type = 2
        if (Number(user_type) === 2 && !supplier_id) {
            return res.status(400).json({
                success: false,
                error: "supplier_id is required when user_type = 2"
            });
        }

        // Check duplicate only if warehouse_number provided
        const checkDuplicate = (callback) => {
            if (!warehouse_number) return callback();

            const checkQuery = `
                SELECT COUNT(*) AS count 
                FROM warehouse_tbl 
                WHERE warehouse_number = ? 
                AND id <> ?
            `;

            con.query(checkQuery, [warehouse_number, warehouse_id], (err, results) => {
                if (err) return callback(err);

                if (results[0].count > 0) {
                    return res.status(400).json({
                        success: false,
                        error: "Warehouse number already exists"
                    });
                }

                callback();
            });
        };

        checkDuplicate((err) => {
            if (err) {
                return res.status(500).json({ success: false, error: err.message });
            }

            const updateQuery = `
                UPDATE warehouse_tbl SET
                    warehouse_number = ?,
                    warehouse_name = ?,
                    company_name = ?,
                    warehouse_address = ?,
                    town = ?,
                    country = ?,
                    email = ?,
                    contact_person = ?,
                    mobile_number = ?,
                    user_id = ?,
                    user_type = ?,
                    supplier_id = ?
                WHERE id = ?
            `;

            const values = [
                warehouse_number,
                warehouse_name,
                company_name,
                warehouse_address,
                town,
                country,
                email,
                contact_person,
                mobile_number,
                user_id,
                user_type,
                Number(user_type) === 2 ? supplier_id : null,
                warehouse_id
            ];

            con.query(updateQuery, values, (err, results) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        error: err.message
                    });
                }

                if (results.affectedRows === 0) {
                    return res.status(404).json({
                        success: false,
                        error: "Warehouse not found"
                    });
                }

                res.status(200).json({
                    success: true,
                    message: "Warehouse updated successfully"
                });
            });
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// const getWarehouse = async (req, res) => {
//     try {
//         const query = `
//             SELECT 
//                 w.id,
//                 w.user_id,
//                 w.user_type,
//                 w.warehouse_number,
//                 w.warehouse_name,
//                 w.company_name,
//                 w.warehouse_address,
//                 w.town,
//                 w.country AS country_id,
//                 c.name AS country_name,
//                 w.contact,
//                 w.email,
//                 w.contact_person,
//                 w.mobile_number,
//                 w.created_at
//             FROM warehouse_tbl w
//             LEFT JOIN countries c ON w.country = c.id
//             ORDER BY w.id DESC
//         `;

//         con.query(query, (err, results) => {
//             if (err) {
//                 return res.status(500).json({
//                     success: false,
//                     message: 'Internal server error',
//                     error: err.message
//                 });
//             }

//             res.status(200).json({
//                 success: true,
//                 message: "Warehouse data fetched successfully",
//                 data: results
//             });
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: error.message
//         });
//     }
// };

const getWarehouse = async (req, res) => {
    try {
        const query = `
            SELECT 
                w.id AS warehouse_id,
                w.user_id,
                w.user_type,
                w.supplier_id,
                w.warehouse_number,
                w.warehouse_name,
                w.company_name,
                w.warehouse_address,
                w.town,
                w.country AS country_id,
                c.name AS country_name,
                w.email,
                w.contact_person,
                w.mobile_number,
                w.created_at
            FROM warehouse_tbl w
            LEFT JOIN countries c ON w.country = c.id
            ORDER BY w.id DESC
        `;

        con.query(query, (err, results) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "Internal server error",
                    error: err.message
                });
            }

            res.status(200).json({
                success: true,
                message: "Warehouse data fetched successfully",
                data: results
            });
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getWarehouseBySupplierId = async (req, res) => {
    try {
        const { supplier_id } = req.body;

        let query = `
            SELECT 
                w.id,
                w.user_id as supplier_id,
                w.user_type,
                w.warehouse_number,
                w.warehouse_name,
                w.company_name,
                w.warehouse_address,
                w.town,
                w.country,
                c.name AS country_name,
                w.contact,
                w.email,
                w.contact_person,
                w.mobile_number,
                w.created_at
            FROM warehouse_tbl w
            LEFT JOIN countries c ON c.id = w.country
        `;

        let params = [];

        if (supplier_id) {
            query += ` WHERE w.user_id = ?`;
            params.push(supplier_id);
        }

        con.query(query, params, (err, results) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "Internal server error",
                    error: err.message
                });
            }

            if (results.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "No warehouse data found"
                });
            }

            res.status(200).json({
                success: true,
                data: results
            });
        });

    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

const DeleteWarehouse = async (req, res) => {
    try {
        const { warehouse_id } = req.body;

        if (!warehouse_id) {
            return res.status(400).json({ success: false, error: "warehouse_id is required" });
        }

        const query = `DELETE FROM warehouse_tbl WHERE id = ?`;

        con.query(query, [warehouse_id], (err, results) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "Internal server error",
                    error: err.message
                });
            }

            if (results.affectedRows === 0) {
                return res.status(404).json({ success: false, message: "Warehouse not found" });
            }

            res.status(200).json({ success: true, message: "Warehouse deleted successfully" });
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


/* const editWarehouseDetails = async (req, res) => {
    try {
        const { warehouse_assign_id, order_id, freight_id, ware_receipt_no, tracking_number, warehouse_status, warehouse_collect, date_received, package_type, packages, dimension,
            weight, costs_to_collect, warehouse_cost, warehouse_dispatch, cost_to_dispatch } = req.body;
        // console.log(req.body);

        con.query(`update warehouse_assign_order set ware_receipt_no='${ware_receipt_no}', tracking_number='${tracking_number}', warehouse_status='${warehouse_status}', warehouse_collect='${warehouse_collect}', date_received='${date_received}',
                total_weight='${weight}', total_dimension='${dimension}',costs_to_collect='${costs_to_collect}',warehouse_cost='${warehouse_cost}',warehouse_dispatch='${warehouse_dispatch}',
                cost_to_dispatch='${cost_to_dispatch}'
            where id='${warehouse_assign_id}'`, (err, data) => {
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
} */


// const editWarehouseDetails = async (req, res) => {
//     try {
//         const {
//             warehouse_assign_id, order_id, freight_id, ware_receipt_no, tracking_number, warehouse_status,
//             warehouse_collect, date_received, package_type, no_of_packages, total_dimension, weight,
//             costs_to_collect, warehouse_cost, warehouse_dispatch, cost_to_dispatch,
//             courier_waybill_ref, dispatched_date, warehouse_comment, customer_ref, box_marking, hazardous,
//             hazard_description, package_comment, damage_goods, damaged_pkg_qty, damage_comment, supplier_company, supplier_person,
//             supplier_address, supplier_contact_no, warehouse_order_id, warehouse_storage, handling_required, handling_cost
//         } = req.body;
//         console.log(req.body); console.log(req.files);


//         // Step 1: Fetch old date_received
//         con.query(`SELECT date_received, order_id as warehouse_order_id FROM warehouse_assign_order WHERE id = ?`, [warehouse_assign_id], (err, oldResult) => {
//             if (err || oldResult.length === 0) return res.status(400).send({ success: false, message: "Warehouse record not found" });

//             const oldDateReceived = oldResult[0].date_received;
//             const warehouse_order_id = oldResult[0].warehouse_order_id;

//             // Step 2: Update records
//             con.query(`UPDATE warehouse_assign_order SET 
//                 ware_receipt_no = ?, tracking_number = ?, warehouse_status = ?, warehouse_collect = ?,
//                 date_received = ?, total_weight = ?, total_dimension = ?, costs_to_collect = ?, 
//                 warehouse_cost = ?, warehouse_dispatch = ?, cost_to_dispatch = ?,
//                 courier_waybill_ref = ?, dispatched_date = ?, warehouse_comment = ?, customer_ref = ?, box_marking = ?, hazardous = ?,
//             hazard_description = ?, package_comment = ?, damage_goods = ?, damaged_pkg_qty = ?, damage_comment = ?, supplier_company = ?, 
//             supplier_person = ?, supplier_address = ?, supplier_contact_no = ?, warehouse_order_id = ?, warehouse_storage = ?, 
//             handling_required = ?, handling_cost = ?, total_packeges =?
//                 WHERE id = ?`,
//                 [
//                     ware_receipt_no, tracking_number, warehouse_status, warehouse_collect,
//                     date_received, weight, total_dimension, costs_to_collect, warehouse_cost,
//                     warehouse_dispatch, cost_to_dispatch,
//                     courier_waybill_ref, dispatched_date, warehouse_comment, customer_ref, box_marking, hazardous,
//                     hazard_description, package_comment, damage_goods, damaged_pkg_qty, damage_comment, supplier_company, supplier_person,
//                     supplier_address, supplier_contact_no, warehouse_order_id, warehouse_storage, handling_required, handling_cost, no_of_packages,
//                     warehouse_assign_id
//                 ],
//                 (err) => {
//                     if (err) throw err;

//                     // Update tbl_orders
//                     con.query(`UPDATE tbl_orders SET dimensions = ?, weight = ? WHERE id = ?`,
//                         [total_dimension, weight, order_id]);

//                     // Update tbl_freight
//                     if (freight_id && freight_id !== 0) {
//                         con.query(
//                             `UPDATE tbl_freight SET no_of_packages = ?, package_type = ? WHERE id = ?`,
//                             [no_of_packages, package_type, freight_id]
//                         );
//                     }

//                     // === Send notification if date_received changed ===
//                     if (oldDateReceived !== date_received) {

//                         // Step 3: Get freight_id using order_id
//                         const orderQuery = `SELECT freight_id FROM tbl_orders WHERE id = ?`;
//                         con.query(orderQuery, [warehouse_order_id], (orderErr, orderResult) => {
//                             if (orderErr || orderResult.length === 0) {
//                                 console.log("Could not fetch freight info");
//                                 return;
//                             }

//                             const fetchedFreightId = orderResult[0].freight_id;

//                             // Step 4: Get sales person from tbl_freight
//                             const freightQuery = `SELECT sales_representative AS sales_person, freight_number FROM tbl_freight WHERE id = ?`;
//                             con.query(freightQuery, [fetchedFreightId], (freightErr, freightResult) => {
//                                 if (freightErr || freightResult.length === 0) {
//                                     console.log("Could not fetch sales person");
//                                     return;
//                                 }

//                                 const salesPersonId = freightResult[0].sales_person;
//                                 const freightNumber = freightResult[0].freight_number;

//                                 // Step 5: Get email of sales person
//                                 const userQuery = `SELECT email FROM tbl_users WHERE id = ?`;
//                                 con.query(userQuery, [salesPersonId], (userErr, userResult) => {
//                                     const salesPersonEmail = userResult?.[0]?.email || null;

//                                     // Step 6: Get Ops Team emails
//                                     const opsQuery = `SELECT email FROM tbl_users WHERE FIND_IN_SET(2, assigned_roles) AND status = 1 AND is_deleted = 0`;
//                                     con.query(opsQuery, async (opsErr, opsResult) => {
//                                         const opsEmails = opsResult.map(row => row.email);
//                                         const allRecipients = [...opsEmails];
//                                         if (salesPersonEmail) allRecipients.push(salesPersonEmail);

//                                         const subject = `New Warehouse Receipt`;
//                                         const htmlBody = `
//                                             <div style="font-family: Arial, sans-serif;">
//                                                 <h3>New Warehouse Receipt Notification</h3>
//                                                 <p><strong>Date Received</strong> has been updated for a warehouse entry:</p>
//                                                 <ul>
//                                                     <li><strong>Receipt No:</strong> ${ware_receipt_no}</li>
//                                                     <li><strong>Tracking No:</strong> ${tracking_number}</li>
//                                                     <li><strong>New Date Received:</strong> ${date_received}</li>
//                                                     <li><strong>Packages:</strong> ${no_of_packages} (${package_type})</li>
//                                                     <li><strong>Weight:</strong> ${weight} kg</li>
//                                                 </ul>
//                                                 <p>Please take necessary action.</p>
//                                                 <p>Regards,<br>Warehouse System</p>
//                                             </div>
//                                         `;

//                                         // Send email to all
//                                         for (const email of allRecipients) {
//                                             // if (email) await sendMail(email, subject, htmlBody);
//                                         }
//                                         // await findOrCreateFolder(freightNumber);

//                                         if (req.files && Object.keys(req.files).length > 0) {
//                                             for (const fieldName of Object.keys(req.files)) {
//                                                 const filesArray = req.files[fieldName];
//                                                 console.log(fieldName);
//                                                 console.log("hii");

//                                                 for (const file of filesArray) {
//                                                     // const documentName = req.body.documentName; // sent from Postman
//                                                     console.log(fieldName);

//                                                     await uploadToMatchingFolder(file, fieldName, freightNumber);

//                                                     // Save in DB
//                                                     const docQuery = `INSERT INTO freight_doc (freight_id, uploaded_by, document_name, document) 
//             VALUES (?, ?, ?, ?)`;
//                                                     await new Promise((resolve, reject) => {
//                                                         con.query(docQuery, [fetchedFreightId, 1, fieldName, file.filename], (err) => {
//                                                             if (err) return reject(err);
//                                                             resolve();
//                                                         });
//                                                     });
//                                                 }
//                                             }
//                                         }

//                                         // Response after notification
//                                         res.status(200).send({
//                                             success: true,
//                                             message: "Warehouse details updated and notifications sent."
//                                         });
//                                     });
//                                 });
//                             });
//                         });
//                     } else {
//                         const orderQuery = `SELECT freight_id FROM tbl_orders WHERE id = ?`;
//                         con.query(orderQuery, [warehouse_order_id], (orderErr, orderResult) => {
//                             if (orderErr || orderResult.length === 0) {
//                                 console.log("Could not fetch freight info");
//                                 return;
//                             }

//                             const fetchedFreightId = orderResult[0].freight_id;

//                             // Step 4: Get sales person and freightNumber
//                             const freightQuery = `SELECT freight_number FROM tbl_freight WHERE id = ?`;
//                             con.query(freightQuery, [fetchedFreightId], async (freightErr, freightResult) => {
//                                 if (freightErr || freightResult.length === 0) {
//                                     console.log("Could not fetch sales person");
//                                     return;
//                                 }
//                                 const freightNumber = freightResult[0].freight_number;
//                                 // await findOrCreateFolder(freightNumber);

//                                 if (req.files && Object.keys(req.files).length > 0) {
//                                     for (const fieldName in req.files) {
//                                         const filesArray = req.files[fieldName];

//                                         for (const file of filesArray) {
//                                             console.log("Processing:", fieldName, file.originalname);

//                                             const newPath = await uploadToMatchingFolder(file, fieldName, freightNumber);

//                                             const docQuery = `INSERT INTO freight_doc (freight_id, uploaded_by, document_name, document) VALUES (?, ?, ?, ?)`;
//                                             await new Promise((resolve, reject) => {
//                                                 con.query(docQuery, [fetchedFreightId, 1, file.originalname, file.filename], (err) => {
//                                                     if (err) return reject(err);
//                                                     resolve();
//                                                 });
//                                             });
//                                         }
//                                     }
//                                 } else {
//                                     console.log(" No files detected by Multer");
//                                 }
//                                 res.status(200).send({
//                                     success: true,
//                                     message: "Warehouse details updated (no notification sent)."
//                                 });
//                             })
//                         });
//                     };
//                 });
//         });
//     } catch (error) {
//         console.error(error);
//         res.status(500).send({
//             success: false,
//             message: error.message
//         });
//     }
// };

const saveWarehouseFiles = (files, warehouseId) => {
    return new Promise((resolve, reject) => {
        let fileValues = [];

        for (const fieldName in files) {
            const filesArray = files[fieldName];

            for (const file of filesArray) {
                fileValues.push([
                    warehouseId,
                    fieldName,
                    file.filename,   // OR use file.path (recommended)
                ]);
            }
        }

        if (fileValues.length === 0) return resolve();

        con.query(
            `INSERT INTO warehouse_files (warehouse_id, file_type, file_name) VALUES ?`,
            [fileValues],
            (err) => {
                if (err) return reject(err);
                resolve();
            }
        );
    });
};

const editWarehouseDetails = async (req, res) => {
    try {
        const {
            warehouse_assign_id, order_id, freight_id, ware_receipt_no, tracking_number, warehouse_status,
            warehouse_collect, date_received, package_type, no_of_packages, total_dimension, weight,
            costs_to_collect, warehouse_cost, warehouse_dispatch, cost_to_dispatch,
            courier_waybill_ref, dispatched_date, warehouse_comment, customer_ref, box_marking, hazardous,
            hazard_description, package_comment, damage_goods, damaged_pkg_qty, damage_comment, supplier_company, supplier_person,
            supplier_address, supplier_contact_no, warehouse_order_id, warehouse_storage, handling_required, handling_cost,
            client_id, good_description, freight, delivery_to, collection_from
        } = req.body;

        console.log(req.body);
        console.log(req.files);

        // Step 1: Fetch old date_received
        con.query(
            `SELECT date_received, order_id as warehouse_order_id FROM warehouse_assign_order WHERE id = ?`,
            [warehouse_assign_id],
            (err, oldResult) => {

                if (err || oldResult.length === 0) {
                    return res.status(400).send({ success: false, message: "Warehouse record not found" });
                }

                const oldDateReceived = oldResult[0].date_received;
                const warehouse_order_id_old = oldResult[0].warehouse_order_id;

                // Step 2: Update warehouse_assign_order (FIXED PARAM ORDER)
                con.query(
                    `UPDATE warehouse_assign_order SET 
                        ware_receipt_no = ?, tracking_number = ?, warehouse_status = ?, warehouse_collect = ?,
                        date_received = ?, total_weight = ?, total_dimension = ?, costs_to_collect = ?, 
                        warehouse_cost = ?, warehouse_dispatch = ?, cost_to_dispatch = ?,
                        courier_waybill_ref = ?, dispatched_date = ?, warehouse_comment = ?, customer_ref = ?, box_marking = ?, hazardous = ?,
                        hazard_description = ?, package_comment = ?, damage_goods = ?, damaged_pkg_qty = ?, damage_comment = ?, supplier_company = ?, 
                        supplier_person = ?, supplier_address = ?, supplier_contact_no = ?, warehouse_order_id = ?, warehouse_storage = ?, 
                        handling_required = ?, handling_cost = ?, total_packeges = ?
                    WHERE id = ?`,
                    [
                        ware_receipt_no, tracking_number, warehouse_status, warehouse_collect,
                        date_received, weight, total_dimension, costs_to_collect, warehouse_cost,
                        warehouse_dispatch, cost_to_dispatch,
                        courier_waybill_ref, dispatched_date, warehouse_comment, customer_ref, box_marking, hazardous,
                        hazard_description, package_comment, damage_goods, damaged_pkg_qty, damage_comment, supplier_company, supplier_person,
                        supplier_address, supplier_contact_no, warehouse_order_id || warehouse_order_id_old, warehouse_storage, handling_required, handling_cost, no_of_packages,
                        warehouse_assign_id //  FIXED POSITION
                    ],
                    async (err) => {

                        if (err) {
                            return res.status(500).send({ success: false, message: err.message });
                        }

                        // Update tbl_orders
                        con.query(
                            `UPDATE tbl_orders SET dimensions = ?, weight = ?, goods_description = ?, freight = ?, client_id = ?, collection_from = ?, delivery_to = ? WHERE id = ?`,
                            [total_dimension, weight, good_description, freight, client_id, collection_from, delivery_to, order_id]
                        );

                        //  UPDATE FREIGHT ONLY IF EXISTS
                        if (freight_id && freight_id !== 0) {
                            con.query(
                                `UPDATE tbl_freight SET no_of_packages = ?, package_type = ? WHERE id = ?`,
                                [no_of_packages, package_type, freight_id]
                            );
                        }

                        // ================================
                        // NOTIFICATION BLOCK
                        // ================================
                        if (oldDateReceived !== date_received) {

                            if (!freight_id || freight_id == 0) {

                                try {
                                    if (req.files && Object.keys(req.files).length > 0) {
                                        console.log("Saving warehouse files...");

                                        await saveWarehouseFiles(req.files, warehouse_assign_id);

                                        console.log("Files saved successfully");
                                    } else {
                                        console.log("No files found");
                                    }

                                    return res.status(200).send({
                                        success: true,
                                        message: "Warehouse updated (files saved to warehouse)."
                                    });

                                } catch (err) {
                                    console.error("FILE SAVE ERROR:", err);

                                    return res.status(500).send({
                                        success: false,
                                        message: err.message
                                    });
                                }
                            }

                            const orderQuery = `SELECT freight_id FROM tbl_orders WHERE id = ?`;

                            con.query(orderQuery, [order_id], (orderErr, orderResult) => {

                                if (orderErr || orderResult.length === 0) {
                                    return res.status(200).send({
                                        success: true,
                                        message: "Warehouse updated (freight not found)."
                                    });
                                }

                                const fetchedFreightId = orderResult[0].freight_id;

                                const freightQuery = `SELECT sales_representative AS sales_person, freight_number FROM tbl_freight WHERE id = ?`;

                                con.query(freightQuery, [fetchedFreightId], (freightErr, freightResult) => {

                                    if (freightErr || freightResult.length === 0) {
                                        return res.status(200).send({
                                            success: true,
                                            message: "Warehouse updated (no freight data)."
                                        });
                                    }

                                    const salesPersonId = freightResult[0].sales_person;
                                    const freightNumber = freightResult[0].freight_number;

                                    const userQuery = `SELECT email FROM tbl_users WHERE id = ?`;

                                    con.query(userQuery, [salesPersonId], (userErr, userResult) => {

                                        const salesPersonEmail = userResult?.[0]?.email || null;

                                        const opsQuery = `SELECT email FROM tbl_users WHERE FIND_IN_SET(2, assigned_roles) AND status = 1 AND is_deleted = 0`;

                                        con.query(opsQuery, async (opsErr, opsResult) => {

                                            const opsEmails = opsResult.map(row => row.email);
                                            const allRecipients = [...opsEmails];
                                            if (salesPersonEmail) allRecipients.push(salesPersonEmail);

                                            const subject = `New Warehouse Receipt`;

                                            const htmlBody = `
                                                <div>
                                                    <h3>New Warehouse Receipt</h3>
                                                    <p>Receipt No: ${ware_receipt_no}</p>
                                                    <p>Date Received: ${date_received}</p>
                                                </div>
                                            `;

                                            for (const email of allRecipients) {
                                                // await sendMail(email, subject, htmlBody);
                                            }

                                            //  FILE UPLOAD (SAFE)
                                            if (req.files && freightNumber) {
                                                for (const fieldName in req.files) {
                                                    const filesArray = req.files[fieldName];

                                                    for (const file of filesArray) {
                                                        await uploadToMatchingFolder(file, fieldName, freightNumber);

                                                        await new Promise((resolve, reject) => {
                                                            con.query(
                                                                `INSERT INTO freight_doc (freight_id, uploaded_by, document_name, document) VALUES (?, ?, ?, ?)`,
                                                                [fetchedFreightId, 1, fieldName, file.filename],
                                                                (err) => {
                                                                    if (err) return reject(err);
                                                                    resolve();
                                                                }
                                                            );
                                                        });
                                                    }
                                                }
                                            }

                                            return res.status(200).send({
                                                success: true,
                                                message: "Warehouse details updated and notifications sent."
                                            });
                                        });
                                    });
                                });
                            });

                        } else {

                            // =========================
                            // NO DATE CHANGE BLOCK
                            // =========================
                            if (!freight_id || freight_id == 0) {

                                try {
                                    if (req.files && Object.keys(req.files).length > 0) {
                                        console.log("Saving warehouse files...");

                                        await saveWarehouseFiles(req.files, warehouse_assign_id);

                                        console.log("Files saved successfully");
                                    } else {
                                        console.log("No files found");
                                    }

                                    return res.status(200).send({
                                        success: true,
                                        message: "Warehouse updated (files saved to warehouse)."
                                    });

                                } catch (err) {
                                    console.error("FILE SAVE ERROR:", err);

                                    return res.status(500).send({
                                        success: false,
                                        message: err.message
                                    });
                                }
                            }
                            const freightQuery = `SELECT freight_number FROM tbl_freight WHERE id = ?`;

                            con.query(freightQuery, [freight_id], async (err, result) => {

                                if (err || result.length === 0) {
                                    return res.status(200).send({
                                        success: true,
                                        message: "Warehouse updated (no freight data)."
                                    });
                                }

                                const freightNumber = result[0].freight_number;

                                if (req.files && freightNumber) {
                                    for (const fieldName in req.files) {
                                        const filesArray = req.files[fieldName];

                                        for (const file of filesArray) {
                                            await uploadToMatchingFolder(file, fieldName, freightNumber);

                                            await new Promise((resolve, reject) => {
                                                con.query(
                                                    `INSERT INTO freight_doc (freight_id, uploaded_by, document_name, document) VALUES (?, ?, ?, ?)`,
                                                    [freight_id, 1, fieldName, file.filename],
                                                    (err) => {
                                                        if (err) return reject(err);
                                                        resolve();
                                                    }
                                                );
                                            });
                                        }
                                    }
                                }

                                return res.status(200).send({
                                    success: true,
                                    message: "Warehouse details updated."
                                });
                            });
                        }
                    }
                );
            }
        );

    } catch (error) {
        console.error(error);
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

/* const addWarehouseProduct = async (req, res) => {
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
        if (!warehouse_order_id) {
            return res.status(400).send({
                success: true,
                message: "Provide Warehouse Order ID"
            })
        }
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
} */

// const addWarehouseProduct = async (req, res) => {
//     try {
//         const {
//             user_id,
//             added_by,
//             warehouse_order_id,
//             order_id,
//             product_description,
//             Hazardous,
//             date_received,
//             package_type,
//             packages,
//             dimension,
//             weight,
//             warehouse_ref,
//             freight,
//             groupage_batch_ref,
//             supplier,
//             warehouse_receipt_number,
//             tracking_number,
//             date_dspatched,
//             supplier_address,
//             warehouse_collect,
//             costs_to_collect,
//             port_of_loading,
//             warehouse_dispatch,
//             warehouse_cost,
//             cost_to_dispatch,
//             waybill_ref,
//             supplier_Email,
//             Supplier_Contact
//         } = req.body;

//         if (!warehouse_order_id) {
//             return res.status(400).send({
//                 success: false,
//                 message: "Provide Warehouse Order ID"
//             });
//         }

//         const insertQuery = `
//             INSERT INTO warehouse_products 
//             (user_id, order_id, added_by, warehouse_order_id, product_description, Hazardous, date_received, package_type, packages, dimension, weight, warehouse_ref, 
//             freight, groupage_batch_ref, supplier, warehouse_receipt_number, tracking_number, date_dspatched, supplier_address, warehouse_collect, 
//             costs_to_collect, port_of_loading, warehouse_dispatch, warehouse_cost, cost_to_dispatch, waybill_ref, supplier_Email, Supplier_Contact) 
//             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//         `;

//         const values = [
//             user_id,
//             order_id,
//             added_by,
//             warehouse_order_id,
//             product_description,
//             Hazardous,
//             date_received,
//             package_type,
//             packages,
//             dimension,
//             weight,
//             warehouse_ref,
//             freight,
//             groupage_batch_ref,
//             supplier,
//             warehouse_receipt_number,
//             tracking_number,
//             date_dspatched,
//             supplier_address,
//             warehouse_collect,
//             costs_to_collect,
//             port_of_loading,
//             warehouse_dispatch,
//             warehouse_cost,
//             cost_to_dispatch,
//             waybill_ref,
//             supplier_Email,
//             Supplier_Contact
//         ];

//         // Step 1: Insert the product
//         con.query(insertQuery, values, async (err, data) => {
//             if (err) throw err;

//             // Step 2: Get freight_id from order
//             const orderQuery = `SELECT freight_id FROM tbl_orders WHERE id = ?`;
//             con.query(orderQuery, [order_id], (orderErr, orderResult) => {
//                 if (orderErr || orderResult.length === 0) {
//                     return res.status(400).send({
//                         success: false,
//                         message: "Freight ID not found"
//                     });
//                 }

//                 const freightId = orderResult[0].freight_id;

//                 // Step 3: Get sales_person_id from tbl_freight
//                 const freightQuery = `SELECT sales_representative as sales_person, freight_number FROM tbl_freight WHERE id = ?`;
//                 con.query(freightQuery, [freightId], (freightErr, freightResult) => {
//                     if (freightErr || freightResult.length === 0) {
//                         console.log("Product added, but could not fetch sales person");
//                         return
//                     }

//                     const salesPersonId = freightResult[0].sales_person;
//                     const freightNumber = freightResult[0].freight_number;
//                     // Step 4: Get sales person email
//                     const userQuery = `SELECT email FROM tbl_users WHERE id = ?`;
//                     con.query(userQuery, [salesPersonId], (userErr, userResult) => {
//                         const salesPersonEmail = userResult && userResult.length > 0 ? userResult[0].email : null;

//                         // Step 5: Get Ops team emails (assumes role_id 2 = Ops)
//                         const opsQuery = `
//                             SELECT email FROM tbl_users 
//                             WHERE FIND_IN_SET(2, assigned_roles) AND status = 1 AND is_deleted = 0
//                         `;
//                         con.query(opsQuery, async (opsErr, opsResult) => {
//                             const opsEmails = opsResult.map(row => row.email);
//                             const allRecipients = [...opsEmails];
//                             if (salesPersonEmail) allRecipients.push(salesPersonEmail);

//                             const subject = `New Warehouse Entry Created by Customer`;
//                             const htmlBody = `
//                                 <div style="font-family: Arial, sans-serif;">
//                                     <h3>New Warehouse Entry Notification</h3>
//                                     <p>A new product has been added to the warehouse:</p>
//                                     <ul>
//                                         <li><strong>Warehouse Ref:</strong> ${warehouse_ref}</li>
//                                         <li><strong>Product:</strong> ${product_description}</li>
//                                         <li><strong>Packages:</strong> ${packages} (${package_type})</li>
//                                         <li><strong>Weight:</strong> ${weight} kg</li>
//                                         <li><strong>Date Received:</strong> ${date_received}</li>
//                                     </ul>
//                                     <p>Regards,<br> Management System</p>
//                                 </div>
//                             `;

//                             // Send mail to all recipients
//                             await Promise.all(allRecipients.map(email => {
//                                 // if (email) return sendMail(email, subject, htmlBody);
//                             }));

//                             // await findOrCreateFolder(freightNumber);
//                             console.log(req.files);

//                             if (req.files && Object.keys(req.files).length > 0) {
//                                 for (const fieldName of Object.keys(req.files)) {
//                                     const filesArray = req.files[fieldName];

//                                     for (const file of filesArray) {
//                                         // const documentName = req.body.documentName; // sent from Postman
//                                         console.log(fieldName);

//                                         await uploadToMatchingFolder(file, fieldName, freightNumber);

//                                         // Save in DB
//                                         const docQuery = `INSERT INTO freight_doc (freight_id, uploaded_by, document_name, document) VALUES (?, ?, ?, ?)`;
//                                         await new Promise((resolve, reject) => {
//                                             con.query(docQuery, [freightId, 1, fieldName, file.filename], (err) => {
//                                                 if (err) return reject(err);
//                                                 resolve();
//                                             });
//                                         });
//                                     }
//                                 }
//                             }

//                             res.status(200).send({
//                                 success: true,
//                                 message: "Warehouse Product added"
//                             });
//                         });
//                     });
//                 });
//             });
//         });

//     } catch (error) {
//         res.status(500).send({
//             success: false,
//             message: error.message
//         });
//     }
// };

const addWarehouseProduct = async (req, res) => {
    try {
        const {
            user_id,
            added_by,
            warehouse_order_id,
            order_id,
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

        if (!warehouse_order_id) {
            return res.status(400).send({
                success: false,
                message: "Provide Warehouse Order ID"
            });
        }

        const insertQuery = `
            INSERT INTO warehouse_products
            (user_id, order_id, added_by, warehouse_order_id, product_description, Hazardous, date_received, package_type, packages, dimension, weight, warehouse_ref,
            freight, groupage_batch_ref, supplier, warehouse_receipt_number, tracking_number, date_dspatched, supplier_address, warehouse_collect,
            costs_to_collect, port_of_loading, warehouse_dispatch, warehouse_cost, cost_to_dispatch, waybill_ref, supplier_Email, Supplier_Contact)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            user_id || 0,
            order_id || 0,
            added_by || 0,
            warehouse_order_id || 0,
            product_description || null,
            Hazardous || null,
            date_received || null,
            package_type || null,
            packages || null,
            dimension || null,
            weight || null,
            warehouse_ref || null,
            freight || null,
            groupage_batch_ref || null,
            supplier || null,
            warehouse_receipt_number || null,
            tracking_number || null,
            date_dspatched || null,
            supplier_address || null,
            warehouse_collect || null,
            costs_to_collect || null,
            port_of_loading || null,
            warehouse_dispatch || null,
            warehouse_cost || null,
            cost_to_dispatch || null,
            waybill_ref || null,
            supplier_Email || null,
            Supplier_Contact || null
        ];

        // Step 1: Insert the product
        con.query(insertQuery, values, async (err, data) => {
            if (err) throw err;

            // Step 2: Get freight_id from order
            const orderQuery = `SELECT freight_id FROM tbl_orders WHERE id = ?`;
            con.query(orderQuery, [order_id], (orderErr, orderResult) => {
                if (orderErr || orderResult.length === 0) {
                    return res.status(400).send({
                        success: false,
                        message: "Freight ID not found"
                    });
                }

                const freightId = orderResult[0].freight_id;

                // Step 3: Get sales_person_id from tbl_freight
                const freightQuery = `SELECT sales_representative as sales_person, freight_number FROM tbl_freight WHERE id = ?`;
                con.query(freightQuery, [freightId], (freightErr, freightResult) => {
                    if (freightErr || freightResult.length === 0) {
                        console.log("Product added, but could not fetch sales person");
                        return
                    }

                    const salesPersonId = freightResult[0].sales_person;
                    const freightNumber = freightResult[0].freight_number;
                    // Step 4: Get sales person email
                    const userQuery = `SELECT email FROM tbl_users WHERE id = ?`;
                    con.query(userQuery, [salesPersonId], (userErr, userResult) => {
                        const salesPersonEmail = userResult && userResult.length > 0 ? userResult[0].email : null;

                        // Step 5: Get Ops team emails (assumes role_id 2 = Ops)
                        const opsQuery = `
                            SELECT email FROM tbl_users
                            WHERE FIND_IN_SET(2, assigned_roles) AND status = 1 AND is_deleted = 0
                        `;
                        con.query(opsQuery, async (opsErr, opsResult) => {
                            const opsEmails = opsResult.map(row => row.email);
                            const allRecipients = [...opsEmails];
                            if (salesPersonEmail) allRecipients.push(salesPersonEmail);

                            const subject = `New Warehouse Entry Created by Customer`;
                            const htmlBody = `
                                <div style="font-family: Arial, sans-serif;">
                                    <h3>New Warehouse Entry Notification</h3>
                                    <p>A new product has been added to the warehouse:</p>
                                    <ul>
                                        <li><strong>Warehouse Ref:</strong> ${warehouse_ref}</li>
                                        <li><strong>Product:</strong> ${product_description}</li>
                                        <li><strong>Packages:</strong> ${packages} (${package_type})</li>
                                        <li><strong>Weight:</strong> ${weight} kg</li>
                                        <li><strong>Date Received:</strong> ${date_received}</li>
                                    </ul>
                                    <p>Regards,<br> Management System</p>
                                </div>
                            `;

                            // Send mail to all recipients
                            await Promise.all(allRecipients.map(email => {
                                // if (email) return sendMail(email, subject, htmlBody);
                            }));

                            // await findOrCreateFolder(freightNumber);
                            console.log(req.files);

                            if (req.files && Object.keys(req.files).length > 0) {
                                for (const fieldName of Object.keys(req.files)) {
                                    const filesArray = req.files[fieldName];

                                    for (const file of filesArray) {
                                        // const documentName = req.body.documentName; // sent from Postman
                                        console.log(fieldName);

                                        await uploadToMatchingFolder(file, fieldName, freightNumber);

                                        // Save in DB
                                        const docQuery = `INSERT INTO freight_doc (freight_id, uploaded_by, document_name, document) VALUES (?, ?, ?, ?)`;
                                        await new Promise((resolve, reject) => {
                                            con.query(docQuery, [freightId, 1, fieldName, file.filename], (err) => {
                                                if (err) return reject(err);
                                                resolve();
                                            });
                                        });
                                    }
                                }
                            }


                        });
                    });
                });
                res.status(200).send({
                    success: true,
                    message: "Warehouse Product added"
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

const getWarehouseProductById = (req, res) => {
    const { id } = req.body;

    const query = `SELECT * FROM warehouse_products WHERE id = ?`;

    con.query(query, [id], (err, result) => {
        if (err || result.length === 0) {
            return res.status(404).send({
                success: false,
                message: "Product not found"
            });
        }

        res.status(200).send({
            success: true,
            data: result[0]
        });
    });
};

const updateWarehouseProduct = (req, res) => {
    try {
        const { id } = req.body;

        const {
            product_description,
            Hazardous,
            date_received,
            package_type,
            packages,
            dimension,
            weight,
            supplier,
            warehouse_receipt_number,
            tracking_number,
            supplier_address,
            warehouse_collect,
            costs_to_collect,
            warehouse_dispatch,
            warehouse_cost,
            cost_to_dispatch,
            waybill_ref,
            supplier_Email,
            Supplier_Contact
        } = req.body;

        const updateQuery = `
            UPDATE warehouse_products SET
                product_description = ?,
                Hazardous = ?,
                date_received = ?,
                package_type = ?,
                packages = ?,
                dimension = ?,
                weight = ?,
                supplier = ?,
                warehouse_receipt_number = ?,
                tracking_number = ?,
                supplier_address = ?,
                warehouse_collect = ?,
                costs_to_collect = ?,
                warehouse_dispatch = ?,
                warehouse_cost = ?,
                cost_to_dispatch = ?,
                waybill_ref = ?,
                supplier_Email = ?,
                Supplier_Contact = ?
            WHERE id = ?
        `;

        const values = [
            product_description || null,
            Hazardous || null,
            date_received || null,
            package_type || null,
            packages || null,
            dimension || null,
            weight || null,
            supplier || null,
            warehouse_receipt_number || null,
            tracking_number || null,
            supplier_address || null,
            warehouse_collect || null,
            costs_to_collect || null,
            warehouse_dispatch || null,
            warehouse_cost || null,
            cost_to_dispatch || null,
            waybill_ref || null,
            supplier_Email || null,
            Supplier_Contact || null,
            id
        ];

        con.query(updateQuery, values, (err, result) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: err.message
                });
            }

            res.status(200).send({
                success: true,
                message: "Warehouse product updated"
            });
        });

    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

const deleteWarehouseProduct = (req, res) => {
    const { id } = req.body;

    const query = `DELETE FROM warehouse_products WHERE id = ?`;

    con.query(query, [id], (err, result) => {
        if (err) {
            return res.status(500).send({
                success: false,
                message: err.message
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).send({
                success: false,
                message: "Product not found"
            });
        }

        res.status(200).send({
            success: true,
            message: "Warehouse product deleted"
        });
    });
};

const updateWareHouseProductBySupplier = async (req, res) => {
    try {
        const {
            warehouse_product_id,
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

        if (!warehouse_product_id) {
            return res.status(400).send({
                success: false,
                message: "Warehouse Product ID is required"
            });
        }

        // 1️⃣ Check product exists
        const checkQuery = `SELECT * FROM warehouse_products WHERE id = ?`;
        con.query(checkQuery, [warehouse_product_id], async (err, result) => {
            if (err) throw err;

            if (result.length === 0) {
                return res.status(404).send({
                    success: false,
                    message: "Warehouse product not found"
                });
            }

            const existing = result[0];

            // 2️⃣ Update product
            const updateQuery = `
                UPDATE warehouse_products SET
                    product_description = ?,
                    Hazardous = ?,
                    date_received = ?,
                    package_type = ?,
                    packages = ?,
                    dimension = ?,
                    weight = ?,
                    warehouse_ref = ?,
                    freight = ?,
                    groupage_batch_ref = ?,
                    supplier = ?,
                    warehouse_receipt_number = ?,
                    tracking_number = ?,
                    date_dspatched = ?,
                    supplier_address = ?,
                    warehouse_collect = ?,
                    costs_to_collect = ?,
                    port_of_loading = ?,
                    warehouse_dispatch = ?,
                    warehouse_cost = ?,
                    cost_to_dispatch = ?,
                    waybill_ref = ?,
                    supplier_Email = ?,
                    Supplier_Contact = ?
                WHERE id = ?
            `;

            const values = [
                product_description ?? existing.product_description,
                Hazardous ?? existing.Hazardous,
                date_received ?? existing.date_received,
                package_type ?? existing.package_type,
                packages ?? existing.packages,
                dimension ?? existing.dimension,
                weight ?? existing.weight,
                warehouse_ref ?? existing.warehouse_ref,
                freight ?? existing.freight,
                groupage_batch_ref ?? existing.groupage_batch_ref,
                supplier ?? existing.supplier,
                warehouse_receipt_number ?? existing.warehouse_receipt_number,
                tracking_number ?? existing.tracking_number,
                date_dspatched ?? existing.date_dspatched,
                supplier_address ?? existing.supplier_address,
                warehouse_collect ?? existing.warehouse_collect,
                costs_to_collect ?? existing.costs_to_collect,
                port_of_loading ?? existing.port_of_loading,
                warehouse_dispatch ?? existing.warehouse_dispatch,
                warehouse_cost ?? existing.warehouse_cost,
                cost_to_dispatch ?? existing.cost_to_dispatch,
                waybill_ref ?? existing.waybill_ref,
                supplier_Email ?? existing.supplier_Email,
                Supplier_Contact ?? existing.Supplier_Contact,
                warehouse_product_id
            ];

            con.query(updateQuery, values, async (updateErr) => {
                if (updateErr) throw updateErr;

                // 3️⃣ Handle file uploads (if any)
                if (req.files && Object.keys(req.files).length > 0) {
                    const freightIdQuery = `SELECT order_id FROM warehouse_products WHERE id = ?`;

                    con.query(freightIdQuery, [warehouse_product_id], async (fidErr, fidResult) => {
                        if (!fidErr && fidResult.length > 0) {
                            const orderId = fidResult[0].order_id;

                            const orderQuery = `SELECT freight_id FROM tbl_orders WHERE id = ?`;
                            con.query(orderQuery, [orderId], async (oErr, oResult) => {
                                if (!oErr && oResult.length > 0) {
                                    const freightId = oResult[0].freight_id;

                                    for (const fieldName of Object.keys(req.files)) {
                                        const filesArray = req.files[fieldName];

                                        for (const file of filesArray) {

                                            await uploadToMatchingFolder(file, fieldName);

                                            const docQuery = `
                                                INSERT INTO freight_doc
                                                (freight_id, uploaded_by, document_name, document)
                                                VALUES (?, ?, ?, ?)
                                            `;

                                            await new Promise((resolve, reject) => {
                                                con.query(
                                                    docQuery,
                                                    [freightId, 1, fieldName, file.filename],
                                                    (err) => err ? reject(err) : resolve()
                                                );
                                            });
                                        }
                                    }
                                }
                            });
                        }
                    });
                }

                return res.status(200).send({
                    success: true,
                    message: "Warehouse product updated successfully"
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

/* const GetFreightImages = async (req, res) => {
    const { freight_id } = req.body;

    try {
        // Validate the freight ID
        if (!freight_id) {
            return res.status(400).send({ success: false, message: 'Freight ID is required' });
        }

        // Query to fetch documents associated with the provided freight ID
        const selectQuery = `SELECT * FROM freight_doc WHERE freight_id = ?`;

        con.query(selectQuery, [freight_id], (err, docs) => {
            if (err) {
                return res.status(500).send({ success: false, message: 'Database error' });
            }

            if (docs.length > 0) {
                const groupedDocuments = {};

                docs.forEach((doc) => {
                    // Normalize the document name for consistent grouping
                    const normalizedKey = doc.document_name.trim().toLowerCase();

                    if (!groupedDocuments[normalizedKey]) {
                        groupedDocuments[normalizedKey] = {
                            originalName: doc.document_name.trim(), // Store the original name
                            items: []
                        };
                    }

                    groupedDocuments[normalizedKey].items.push({
                        id: doc.id,
                        document_name: doc.document_name.trim(),
                        document: doc.document,
                        created_at: doc.created_at
                    });
                });

                // Convert grouped result back to original structure using original names
                const finalResult = {};
                for (const key in groupedDocuments) {
                    const group = groupedDocuments[key];
                    finalResult[group.originalName] = group.items;
                }

                return res.status(200).send({
                    success: true,
                    data: finalResult
                });
            } else {
                return res.status(400).send({ success: false, message: 'No images found for the given freight ID' });
            }
        });
    } catch (error) {
        return res.status(500).send({ success: false, message: error.message });
    }
};
 */

const GetFreightImages = async (req, res) => {
    const { freight_id, clearance_id, shipment_id, uploaded_by, warehouse_assign_order_id } = req.body;
    console.log(clearance_id);

    try {
        const finalResult = {};

        const groupDocuments = (docs, isClearance = false, isShipment = false) => {
            const groupedDocuments = {};

            docs.forEach((doc) => {
                const safeName = doc.document_name ? doc.document_name.trim() : "Uncategorized";
                const normalizedKey = safeName.toLowerCase();

                if (!groupedDocuments[normalizedKey]) {
                    groupedDocuments[normalizedKey] = {
                        originalName: safeName,
                        items: []
                    };
                }
                console.log(doc);

                groupedDocuments[normalizedKey].items.push({
                    id: doc.id,
                    document_name: safeName,
                    document: isClearance ? doc.document_file : isShipment ? doc.document_file : doc.document,
                    created_at: isClearance ? doc.uploaded_at : doc.created_at
                });
            });

            for (const key in groupedDocuments) {
                const group = groupedDocuments[key];
                finalResult[group.originalName] = group.items;
            }
        };


        const fetchFreightDocs = () => {
            return new Promise((resolve, reject) => {
                if (!freight_id) return resolve();
                let selectQuery = `SELECT * FROM freight_doc WHERE freight_id = ?`;
                let params = [freight_id];

                if (uploaded_by == 2) {   // apply filter only if uploaded_by=2
                    selectQuery += ` AND uploaded_by = ?`;
                    params.push(uploaded_by);
                }

                con.query(selectQuery, params, (err, docs) => {
                    if (err) return reject(err);
                    if (docs.length > 0) groupDocuments(docs, false);
                    resolve();
                });
            });
        };

        //  Clearance Docs
        const fetchClearanceDocs = () => {
            return new Promise((resolve, reject) => {
                if (!clearance_id) return resolve();
                let selectQuery = `SELECT * FROM clearance_docs WHERE clearance_id = ?`;
                let params = [clearance_id];

                if (uploaded_by == 2) {   //  filter only if 2
                    selectQuery += ` AND uploaded_by = ?`;
                    params.push(uploaded_by);
                }

                con.query(selectQuery, params, (err, docs) => {
                    if (err) return reject(err);
                    if (docs.length > 0) groupDocuments(docs, true);
                    resolve();
                });
            });
        };

        // Shipment Docs
        const fetchShipmentDocs = () => {
            return new Promise((resolve, reject) => {
                if (!shipment_id) return resolve();
                let selectQuery = `SELECT * FROM shipment_documents WHERE shipment_id = ?`;
                let params = [shipment_id];

                if (uploaded_by == 2) {   //  filter only if 2
                    selectQuery += ` AND uploaded_by = ?`;
                    params.push(uploaded_by);
                }

                con.query(selectQuery, params, (err, docs) => {
                    if (err) return reject(err);
                    if (docs.length > 0) groupDocuments(docs, false, true);
                    resolve();
                });
            });
        };

        const fetchWarehouseDocs = () => {
            return new Promise((resolve, reject) => {
                if (!warehouse_assign_order_id) return resolve();

                let selectQuery = `SELECT * FROM warehouse_files WHERE warehouse_id = ?`;
                let params = [warehouse_assign_order_id];

                con.query(selectQuery, params, (err, docs) => {
                    if (err) return reject(err);

                    if (docs.length > 0) {
                        const groupedDocuments = {};

                        docs.forEach((doc) => {
                            const safeName = doc.file_type ? doc.file_type.trim() : "Uncategorized";
                            const normalizedKey = safeName.toLowerCase();

                            if (!groupedDocuments[normalizedKey]) {
                                groupedDocuments[normalizedKey] = {
                                    originalName: safeName,
                                    items: []
                                };
                            }

                            groupedDocuments[normalizedKey].items.push({
                                id: doc.id,
                                document_name: safeName,
                                document: doc.file_name,
                                created_at: null // no date column in your table
                            });
                        });

                        for (const key in groupedDocuments) {
                            const group = groupedDocuments[key];
                            finalResult[group.originalName] = group.items;
                        }
                    }

                    resolve();
                });
            });
        };

        await Promise.all([fetchFreightDocs(), fetchClearanceDocs(), fetchShipmentDocs(), fetchWarehouseDocs()]);

        if (Object.keys(finalResult).length === 0) {
            return res.status(404).send({ success: false, message: 'No images found for the given IDs' });
        }

        return res.status(200).send({ success: true, data: finalResult });

    } catch (error) {
        return res.status(500).send({ success: false, message: error.message });
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

const ShipmentDocument = async (req, res) => {
    const { doc_id } = req.body;
    try {
        if (!doc_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide doc_id"
            });
        }
        await con.query(`DELETE FROM shipment_documents WHERE id='${doc_id}'`, (err, result) => {
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

const clearanceDocument = async (req, res) => {
    const { doc_id } = req.body;
    try {
        if (!doc_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide doc_id"
            });
        }
        await con.query(`DELETE FROM clearance_docs WHERE id='${doc_id}'`, (err, result) => {
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
    tbl_users.client_number AS client_number,
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

const revertMovedFreight = async (req, res) => {
    try {
        const { freight_id, batch_id } = req.body;

        // Check if freight is actually assigned to the batch
        const checkAssignmentQuery = `
            SELECT * FROM freight_assig_to_batch 
            WHERE freight_id = ? AND batch_id = ?
        `;
        con.query(checkAssignmentQuery, [freight_id, batch_id], (err, assignmentResult) => {
            if (err) {
                return res.status(500).send({ success: false, message: err.message });
            }

            if (assignmentResult.length === 0) {
                return res.status(400).send({ success: false, message: 'No such freight assigned to the batch' });
            }

            // Step 1: Delete from freight_assig_to_batch
            const deleteQuery = `
                DELETE FROM freight_assig_to_batch 
                WHERE freight_id = ? AND batch_id = ?
            `;
            con.query(deleteQuery, [freight_id, batch_id], (err, deleteResult) => {
                if (err) {
                    return res.status(500).send({ success: false, message: err.message });
                }

                // Step 2: Update tbl_freight.asigned_to_batch = 0
                const updateFreightQuery = `
                    UPDATE tbl_freight 
                    SET asigned_to_batch = 0 
                    WHERE id = ?
                `;
                con.query(updateFreightQuery, [freight_id], (err, updateResult) => {
                    if (err) {
                        return res.status(500).send({ success: false, message: err.message });
                    }

                    // Step 3: Reset warehouse assignment
                    const updateWarehouseQuery = `
                        UPDATE warehouse_assign_order 
                        SET assign_to_batch = 0, batch_id = NULL 
                        WHERE freight_id = ?
                    `;
                    con.query(updateWarehouseQuery, [freight_id], (err, warehouseUpdateResult) => {
                        if (err) {
                            return res.status(500).send({ success: false, message: err.message });
                        }

                        return res.status(200).send({
                            success: true,
                            message: 'Freight successfully removed from batch'
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


/* function checkAndNotifyEstimateOverdue() {
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
} */

function checkAndNotifyEstimateOverdue() {
    const freightQuery = `
      SELECT tbl_freight.freight_number, tbl_users.full_name
      FROM tbl_freight
      INNER JOIN tbl_users ON tbl_freight.client_id = tbl_users.id
      WHERE tbl_freight.status <> 4
        AND TIMESTAMPDIFF(HOUR, tbl_freight.created_at, NOW()) >= 72
    `;

    // Fetch overdue freight quotes
    con.query(freightQuery, function (err, freightResults) {
        if (err) {
            console.error('Database error (freight):', err);
            return;
        }

        if (freightResults.length === 0) {
            console.log('No overdue estimates found.');
            return;
        }

        // Now fetch all Estimate team members
        const estimateTeamQuery = `SELECT full_name, cellphone, telephone, country_code 
  FROM tbl_users 
  WHERE user_type = 2
    AND FIND_IN_SET(1, assigned_roles) AND cellphone IS NOT NULL AND is_deleted=0 AND status=1`;

        con.query(estimateTeamQuery, function (err, teamResults) {
            if (err) {
                console.error('Database error (team):', err);
                return;
            }

            if (teamResults.length === 0) {
                console.log('No Estimate team members found.');
                return;
            }

            // Loop over each overdue freight and send to all Estimate team members
            freightResults.forEach(freight => {
                // const message = `*Quote overdue*\n\nQuote for client *${freight.full_name}*\nFreight: *${freight.freight_number}* has not been issued in the past 72 hours.\nPlease act urgently.`;
                // 05-06-2025
                /* teamResults.forEach(member => {
                    sendWhatsApp(member.cellphone, message);
                }); */
                ////// 02/01/2025
                // teamResults.forEach(member => {
                //     sendWhatsApp(member.cellphone, 'freight_quote_overdue_alert_v2', {
                //         "1": freight.full_name,
                //         "2": freight.freight_number
                //     });
                // });

                // 2/19/2026
                teamResults.forEach(member => {

                    if (!member.cellphone || !member.country_code) {
                        // console.warn(`Missing phone/country code for ${member.full_name}`);
                        return;
                    }

                    const formattedPhone = formatTwilioWhatsAppNumber(
                        member.country_code,
                        member.cellphone
                    );

                    sendWhatsApp(
                        formattedPhone,
                        'freight_quote_overdue_alert_v2',
                        {
                            "1": freight.full_name,
                            "2": freight.freight_number
                        }
                    ).catch(err => {
                        console.error('WhatsApp send error:', err.message);
                    });
                });
            });
        });
    });
}

// Schedule to run every hour
cron.schedule('0 * * * *', function () {
    console.log('Running check for overdue estimates...');
    checkAndNotifyEstimateOverdue();
});

function checkAndNotifyOverdueQuotes() {
    const query = `
        SELECT
            f.freight_number,
            f.collection_from,     -- country ID
            c.full_name AS client_name,
            sp.full_name AS sales_person_name,
            sp.email AS sales_person_email,
            sp.cellphone AS sales_person_phone,
            sp.country_code AS sales_person_country_code
        FROM tbl_freight f
        INNER JOIN tbl_users c ON f.client_id = c.id
        LEFT JOIN tbl_users sp ON f.sales_representative = sp.id
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

            const subject = "Overdue Quote - Action Required";

            const emailMessage = `
            <div style="font-family: Arial; max-width: 600px; margin: auto; padding: 20px;">
                <h2>Overdue Quote Notification</h2>
                <p>A quote has not been updated within 10 days.</p>
                <p>
                    <strong>Freight Number:</strong> ${record.freight_number}<br>
                    <strong>Client Name:</strong> ${record.client_name}
                </p>
                <p>Please follow up accordingly.</p>
                <p>Regards,<br><strong>Management System</strong></p>
            </div>
            `;

            const whatsappTemplateData = {
                "1": record.freight_number,
                "2": record.client_name
            };

            //  Send to Sales Representative
            if (record.sales_person_email) {
                sendMail(record.sales_person_email, subject, emailMessage);
            }

            if (record.sales_person_phone && record.sales_person_country_code) {

                const formattedPhone = formatTwilioWhatsAppNumber(
                    record.sales_person_country_code,
                    record.sales_person_phone
                );

                if (formattedPhone) {
                    sendWhatsApp(
                        formattedPhone,
                        'quote_issued_follow_up_v2',
                        whatsappTemplateData
                    ).catch(err => {
                        console.error('Sales WhatsApp error:', err.message);
                    });
                }
            }

            //  Send to Operations Team (based on country ID)

            const teamQuery = `
                SELECT email, cellphone, country_code
                FROM tbl_users
                WHERE user_type = 2
                AND FIND_IN_SET(2, assigned_roles)
                AND is_deleted = 0
                AND status = 1
                AND country = ?
            `;

            con.query(teamQuery, [record.collection_from], (err, teamResults) => {

                if (err) {
                    console.error("Team fetch error:", err);
                    return;
                }

                teamResults.forEach(member => {

                    // Email
                    if (member.email) {
                        sendMail(member.email, subject, emailMessage);
                    }

                    // WhatsApp
                    if (member.cellphone && member.country_code) {

                        const formattedPhone = formatTwilioWhatsAppNumber(
                            member.country_code,
                            member.cellphone
                        );

                        if (formattedPhone) {
                            sendWhatsApp(
                                formattedPhone,
                                'quote_issued_follow_up_v2',
                                whatsappTemplateData
                            ).catch(err => {
                                console.error('Ops WhatsApp error:', err.message);
                            });
                        }
                    }

                });

            });

        });
    });
}

// run every day at 9 AM
cron.schedule('0 9 * * *', () => {
    console.log('Checking overdue quotes...');
    checkAndNotifyOverdueQuotes();
});


function checkAndSendUnbookedShipmentAlerts() {
    const unbookedQuery = `
        SELECT
            tbl_orders.id AS order_id,
            CONCAT('OR000', tbl_orders.id) AS order_number,
            tbl_users.full_name AS customer_name,
            tbl_orders.track_status,
            tbl_orders.created_at,
            tbl_freight.freight_number,
            tbl_freight.collection_from
        FROM tbl_orders
        INNER JOIN tbl_freight ON tbl_freight.id = tbl_orders.freight_id
        INNER JOIN tbl_users ON tbl_users.id = tbl_freight.client_id
        WHERE tbl_orders.track_status != 'Delivered'
          AND tbl_orders.created_at <= DATE_SUB(NOW(), INTERVAL 90 DAY)
    `;

    con.query(unbookedQuery, (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return;
        }

        if (results.length === 0) {
            console.log('No pending shipments older than 90 days');
            return;
        }

        results.forEach(order => {

            const mailSubject = 'Unbooked Shipment';

            const teamQuery = `
                SELECT full_name, email, cellphone, country_code
                FROM tbl_users
                WHERE user_type = 2
                AND FIND_IN_SET(2, assigned_roles)
                AND is_deleted = 0
                AND status = 1
                AND country = ?
            `;

            //  Match by country ID
            con.query(teamQuery, [order.collection_from], (teamErr, teamMembers) => {

                if (teamErr) {
                    console.error('Error fetching team members:', teamErr);
                    return;
                }

                if (teamMembers.length === 0) {
                    console.log(`No operations team found for country ID ${order.collection_from}`);
                    return;
                }

                teamMembers.forEach(member => {

                    const emailTemplate = `
                        <div style="font-family: Arial; max-width: 600px; margin: auto; padding: 20px;">
                            <h2>Unbooked Shipment Alert</h2>
                            <p>Hi <strong>${member.full_name}</strong>,</p>
                            <p>
                                Shipment for <strong>${order.customer_name}</strong><br>
                                Freight Number: <strong>${order.freight_number}</strong><br>
                                Order Number: <strong>${order.order_number}</strong>
                            </p>
                            <p>
                                This shipment has not been delivered for over 90 days.
                                Please review and take necessary action.
                            </p>
                            <p>Regards,<br><strong>Management System</strong></p>
                        </div>
                    `;

                    //  Send Email
                    if (member.email) {
                        sendMail(member.email, mailSubject, emailTemplate);
                    }

                    //  Send WhatsApp
                    if (member.cellphone && member.country_code) {

                        const formattedPhone = formatTwilioWhatsAppNumber(
                            member.country_code,
                            member.cellphone
                        );

                        if (formattedPhone) {
                            sendWhatsApp(
                                formattedPhone,
                                'unbooked_shipment_alert',
                                {
                                    "1": order.customer_name,
                                    "2": order.freight_number,
                                    "3": order.order_number
                                }
                            ).catch(err => {
                                console.error('WhatsApp send error:', err.message);
                            });
                        }
                    }

                    console.log(`Alert sent to ${member.full_name} for freight ${order.freight_number}`);
                });

            });

        });
    });
}


// OPTIONAL: schedule daily at midnight
cron.schedule('0 0 * * *', () => {
    console.log('Running daily unbooked shipment check...');
    checkAndSendUnbookedShipmentAlerts();
});

function checkAndSendUndownloadedBookingInstructions() {
    const undownloadedQuery = `
        SELECT 
            bi.order_id,
            f.freight_number,
            f.sales_representative as sales_person,
            u.full_name AS sales_name,
            u.email,
            u.cellphone,
            u.country_code,
            bi.created_at,
            bi.is_download,
            o.id as order_id
        FROM booking_instruction AS bi
        INNER JOIN tbl_orders AS o ON o.id = bi.order_id
        INNER JOIN tbl_freight AS f ON f.id = o.freight_id
        INNER JOIN tbl_users AS u ON u.id = f.sales_representative
        WHERE bi.is_download = 0
          AND bi.created_at <= DATE_SUB(NOW(), INTERVAL 5 DAY)
    `;

    con.query(undownloadedQuery, (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return;
        }

        if (results.length === 0) {
            console.log('No undownloaded booking instructions older than 5 days.');
            return;
        }

        results.forEach(record => {
            const { sales_name, email, cellphone, country_code, freight_number, created_at, order_id } = record;

            const mailSubject = 'Booking Instruction Not Shared With Client';

            const emailTemplate = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; background-color: #f9f9f9;">
                    <h2 style="color: #c0392b;">Booking Instruction Alert</h2>
                    <p style="font-size: 16px;">Hi <strong>${sales_name}</strong>,</p>
                    <p style="font-size: 16px;">
                        The booking instruction for <strong>Order Number: OROOO${order_id}</strong> created on <strong>${new Date(created_at).toLocaleDateString()}</strong>
                        has not been downloaded for over <strong>5 days</strong>.
                    </p>
                    <p>Please ensure it is shared with the client as soon as possible.</p>
                    <p style="font-size: 14px; color: #777;">Regards,<br><strong>Management System</strong></p>
                </div>
            `;

            const whatsappMessage = `*Booking Instruction Not Shared*\n\nThe booking instruction for *Freight Number: ${freight_number}* has not been downloaded for over 5 days since creation.\nPlease ensure it is shared with the client.`;

            // Send email
            if (email) sendMail(email, mailSubject, emailTemplate);

            // Send WhatsApp
            // 05-06-2025
            /* if (cellphone) sendWhatsApp(cellphone, whatsappMessage); */

            ///////////////// 02/01/2026
            // if (cellphone) {
            //     sendWhatsApp(cellphone, 'booking_instruction_not_shared', {
            //         "1": freight_number
            //     });
            // }

            // 2/19/2026
            if (cellphone && country_code) {

                const formattedPhone = formatTwilioWhatsAppNumber(
                    country_code,
                    cellphone
                );

                if (formattedPhone) {
                    sendWhatsApp(
                        formattedPhone,
                        'booking_instruction_not_shared',
                        {
                            "1": freight_number
                        }
                    ).catch(err => {
                        console.error('WhatsApp send error:', err.message);
                    });
                }
            }
            console.log(`Notification sent to ${sales_name} for freight number ${freight_number}`);
        });
    });
}


cron.schedule('0 0 * * *', () => {
    checkAndSendUndownloadedBookingInstructions();
});

function notifyUpcomingShipmentETA() {
    try {
        // 1. Sea Freight (10 days before) and Air Freight (1 day before)
        const seaQuery = `
      SELECT id, freight, waybill, ATD
      FROM tbl_shipments
      WHERE freight = 'Sea'
        AND DATE(ATD) = DATE_ADD(CURDATE(), INTERVAL 10 DAY)
        AND (notification_sent IS NULL OR notification_sent = 'no')
    `;
        const airQuery = `
      SELECT id, freight, waybill, ATD
      FROM tbl_shipments
      WHERE freight = 'Air'
        AND DATE(ATD) = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
        AND (notification_sent IS NULL OR notification_sent = 'no')
    `;
        const todayArrivalQuery = `
      SELECT id, freight, waybill, ATD
      FROM tbl_shipments
      WHERE DATE(ATD) = CURDATE()
        AND (notified_arrival IS NULL OR notified_arrival = 'no')
    `;

        con.query(seaQuery, (seaErr, seaResult) => {
            if (seaErr) return console.error("Sea query error:", seaErr);

            con.query(airQuery, (airErr, airResult) => {
                if (airErr) return console.error("Air query error:", airErr);

                con.query(todayArrivalQuery, (arriveErr, arrivalResult) => {
                    if (arriveErr) return console.error("Arrival today query error:", arriveErr);

                    const shipments = [
                        ...seaResult.map(s => ({ ...s, freight_mode: 'Sea Freight', type: 'reminder' })),
                        ...airResult.map(s => ({ ...s, freight_mode: 'Air Freight', type: 'reminder' })),
                        ...arrivalResult.map(s => ({ ...s, freight_mode: s.freight + ' Freight', type: 'arrival' }))
                    ];

                    if (shipments.length === 0) return;

                    // 2. Fetch Ops & Clearing team members
                    const teamQuery = `
            SELECT full_name, email, cellphone, country_code 
            FROM tbl_users 
            WHERE user_type = 2 
              AND (FIND_IN_SET(2, assigned_roles) OR FIND_IN_SET(3, assigned_roles))
              AND is_deleted = 0 AND status = 1
          `;
                    con.query(teamQuery, async (teamErr, teamMembers) => {
                        if (teamErr) return console.error("Team query error:", teamErr);
                        if (teamMembers.length === 0) return;

                        for (const shipment of shipments) {
                            const { id, freight, waybill, ATD, freight_mode, type } = shipment;
                            const etaDate = new Date(ATD).toDateString();

                            let subject = '';
                            let htmlBody = '';
                            let plainText = '';

                            if (type === 'reminder') {
                                const reminderTime = freight_mode === 'Sea Freight'
                                    ? 'in 10 days (Sea Freight)'
                                    : 'within 24 hours (Air Freight)';

                                subject = `Shipment "${freight} & ${waybill}" scheduled for arrival`;
                                htmlBody = `
                  <div style="font-family: Arial, sans-serif;">
                    <h3>Upcoming ${freight_mode} Shipment</h3>
                    <p>Dear Team,</p>
                    <p>The ${freight_mode.toLowerCase()} shipment <strong>${freight}</strong> 
                       with Waybill <strong>${waybill}</strong> is scheduled to arrive on 
                       <strong>${etaDate}</strong>.</p>
                    <p>This is a reminder as it's arriving ${reminderTime}.</p>
                    <p>Regards,<br>Management System</p>
                  </div>
                `;
                                plainText = `Reminder: ${freight_mode} shipment "${freight}" (Waybill: ${waybill}) is arriving ${reminderTime} on ${etaDate}.`;
                            } else if (type === 'arrival') {
                                subject = `Shipment "${freight} & ${waybill}" has arrived at Port`;
                                htmlBody = `
                  <div style="font-family: Arial, sans-serif;">
                    <h3>Shipment Arrived at Port</h3>
                    <p>Dear Team,</p>
                    <p>This is to inform you that the ${freight_mode.toLowerCase()} shipment 
                    <strong>${freight}</strong> with Waybill <strong>${waybill}</strong> has 
                    arrived at the port today <strong>${etaDate}</strong>.</p>
                    <p>Please initiate the required clearance and handling procedures.</p>
                    <p>Regards,<br>Logistics Notification System</p>
                  </div>
                `;
                                plainText = `ALERT: ${freight_mode} shipment "${freight}" (Waybill: ${waybill}) has arrived at the port today (${etaDate}). Please proceed with clearance.`;
                            }

                            for (const member of teamMembers) {
                                const { full_name, email, cellphone, country_code } = member;
                                if (email) await sendMail(email, subject, htmlBody);
                                // if (cellphone) {
                                //     // await sendWhatsApp(cellphone, plainText);

                                //     ////////////////  02/01/2025
                                // await sendSms(cellphone, plainText);

                                //     await sendWhatsApp(cellphone, 'shipment_status_notification', {
                                //         "1": full_name,
                                //         "2": freight_mode,
                                //         "3": freight,
                                //         "4": waybill,
                                //         "5": etaDate
                                //     });
                                // }
                                // 2/19/2026

                                if (cellphone && country_code) {

                                    await sendSms(cellphone, plainText);

                                    const formattedPhone = formatTwilioWhatsAppNumber(
                                        country_code,
                                        cellphone
                                    );

                                    if (formattedPhone) {

                                        try {

                                            await sendWhatsApp(
                                                formattedPhone,
                                                'shipment_status_notification',
                                                {
                                                    "1": full_name,
                                                    "2": freight_mode,
                                                    "3": freight,
                                                    "4": waybill,
                                                    "5": etaDate
                                                }
                                            );

                                        } catch (err) {
                                            console.error("WhatsApp error:", err.message);
                                        }
                                    }
                                }
                            }

                            if (type === 'reminder') {
                                con.query(
                                    `UPDATE tbl_shipments SET notification_sent = 'yes' WHERE id = ?`,
                                    [id],
                                    (updateErr) => {
                                        if (updateErr)
                                            console.error(`Failed to update reminder notification for ID ${id}:`, updateErr);
                                    }
                                );
                            } else if (type === 'arrival') {
                                con.query(
                                    `UPDATE tbl_shipments SET notified_arrival = 'yes' WHERE id = ?`,
                                    [id],
                                    (updateErr) => {
                                        if (updateErr)
                                            console.error(`Failed to update arrival notification for ID ${id}:`, updateErr);
                                    }
                                );
                            }

                        }

                        console.log(`Shipment notifications (reminder/arrival) sent for ${shipments.length} shipments.`);
                    });
                });
            });
        });

    } catch (err) {
        console.error("Error in notifyUpcomingShipmentETA:", err);
    }
}

// Run daily at 08:00 AM
cron.schedule('0 8 * * *', () => {
    notifyUpcomingShipmentETA();
});

function notifyUnreleasedShipmentsAfterArrival() {
    try {
        const unreleasedQuery = `
      SELECT id, freight, waybill, ATD, status
      FROM tbl_shipments
      WHERE DATE(ATD) = DATE_SUB(CURDATE(), INTERVAL 3 DAY)
        AND status != 'Customs Released'
        AND (notified_unreleased IS NULL OR notified_unreleased = 'no')
    `;

        con.query(unreleasedQuery, (err, shipments) => {
            if (err) return console.error("Unreleased query error:", err);
            if (shipments.length === 0) return;

            const teamQuery = `
        SELECT full_name, email, cellphone, country_code 
        FROM tbl_users 
        WHERE user_type = 2
          AND (FIND_IN_SET(2, assigned_roles) OR FIND_IN_SET(3, assigned_roles))
          AND is_deleted = 0 AND status = 1
      `;

            con.query(teamQuery, async (teamErr, teamMembers) => {
                if (teamErr) return console.error("Team query error:", teamErr);
                if (teamMembers.length === 0) return;

                for (const shipment of shipments) {
                    const { id, freight, waybill, ATD, status } = shipment;
                    const arrivalDate = new Date(ATD).toDateString();

                    const subject = `ALERT: Shipment "${freight} & ${waybill}" still not released after 3 days`;
                    const htmlBody = `
            <div style="font-family: Arial, sans-serif;">
              <h3>Shipment Delayed Release</h3>
              <p>Dear Team,</p>
              <p>The ${freight} shipment with Waybill <strong>${waybill}</strong> arrived at the port on 
              <strong>${arrivalDate}</strong>, but it is still not marked as <strong>Customs Released</strong>.</p>
              <p>Current status: <strong>${status}</strong></p>
              <p>Please investigate and take necessary actions immediately.</p>
              <p>Regards,<br>Logistics Notification System</p>
            </div>
          `;
                    const plainText = `ALERT: ${freight} shipment "${waybill}" arrived on ${arrivalDate} but is still not released. Status: ${status}.`;

                    for (const member of teamMembers) {
                        const { email, cellphone, country_code } = member;
                        if (email) await sendMail(email, subject, htmlBody);
                        // if (cellphone) {
                        //     // await sendWhatsApp(cellphone, plainText);
                        //     await sendSms(cellphone, plainText);

                        //     /////////////////  02/01/2025
                        //     sendWhatsApp(cellphone, 'shipment_release_status_update_v2', {
                        //         "1": "Team",
                        //         "2": freight,
                        //         "3": waybill,
                        //         "4": arrivalDate,
                        //         "5": status
                        //     });
                        // }

                        // 2/19/2026
                        if (cellphone && country_code) {

                            const formattedPhone = formatTwilioWhatsAppNumber(
                                country_code,
                                cellphone
                            );

                            if (formattedPhone) {

                                try {

                                    await sendSms(cellphone, plainText);

                                    await sendWhatsApp(
                                        formattedPhone,
                                        'shipment_release_status_update_v2',
                                        {
                                            "1": "Team",
                                            "2": freight,
                                            "3": waybill,
                                            "4": arrivalDate,
                                            "5": status
                                        }
                                    );

                                } catch (err) {
                                    console.error("Notification send error:", err.message);
                                }
                            }
                        }
                    }

                    // Mark as notified
                    con.query(
                        `UPDATE tbl_shipments SET notified_unreleased = 'yes' WHERE id = ?`,
                        [id],
                        (updateErr) => {
                            if (updateErr)
                                console.error(`Failed to update notified_unreleased for shipment ID ${id}:`, updateErr);
                        }
                    );
                }

                console.log(`Unreleased shipment alerts sent for ${shipments.length} shipments.`);
            });
        });
    } catch (err) {
        console.error("Error in notifyUnreleasedShipmentsAfterArrival:", err);
    }
}

// Run every day at 08:00 AM server time
cron.schedule('0 8 * * *', () => {
    console.log('🔔 Running cron job for unreleased shipments...');
    notifyUnreleasedShipmentsAfterArrival();
});


// const createFreightFolders = async (req, res) => {
//     try {
//         // Get offset and limit from query params, default to 0 and 500
//         const offset = parseInt(req.query.offset) || 0;
//         const limit = parseInt(req.query.limit) || 500;

//         con.query(
//             "SELECT freight_number FROM tbl_freight ORDER BY id LIMIT ? OFFSET ?",
//             [limit, offset],
//             async (err, results) => {
//                 if (err) {
//                     console.error(err);
//                     return res.status(500).json({ success: false, message: err.message });
//                 }

//                 if (!results.length) {
//                     return res.status(404).json({ success: false, message: "No freights found" });
//                 }
//                 console.log(results);

//                 // Create folders for each freight number
//                 await Promise.all(results.map(row => findOrCreateFolder(row.freight_number)));

//                 res.status(200).json({
//                     success: true,
//                     message: `Created folders for ${results.length} freights`,
//                     nextOffset: offset + results.length, results
//                 });
//             }
//         );
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ success: false, message: "Server error" });
//     }
// }

const createFreightFolders = async (req, res) => {
    try {
        // Get offset and limit from query params, default to 0 and 500
        const offset = parseInt(req.query.offset) || 0;
        const limit = parseInt(req.query.limit) || 500;

        con.query(
            "SELECT clearance_number FROM tbl_clearance ORDER BY id LIMIT ? OFFSET ?",
            [limit, offset],
            async (err, results) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ success: false, message: err.message });
                }

                if (!results.length) {
                    return res.status(404).json({ success: false, message: "No freights found" });
                }
                console.log(results);

                // Create folders for each freight number
                await Promise.all(results.map(row => findOrCreateFolder(row.freight_number)));

                res.status(200).json({
                    success: true,
                    message: `Created folders for ${results.length} freights`,
                    nextOffset: offset + results.length, results
                });
            }
        );
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error" });
    }
}

module.exports = {
    AdminLogin, ChangePassword, PrivacyPolicy, GetPrivacy, TermCondition, GetTerms, Addfreight,
    GetFreightAdmin, EditFreight, GetFreightById, DeleteFreight, AddCountryOrigin, getCountryOriginList,
    updateCountryOrigin, GetCountryById, DeleteCountry, clientListAddFreight, CountryListAddFreight,
    Shipping_Estimate, Shipping_Estimate_supplier, updateShippingEstimate, ShipEstimateList, GetShipEstimateById, DeleteShipEstimate,
    updateProfile, forgotPassword, ResetPassword, SendNotification, GetNotification, deleteNotification,
    ChangeStatusFreight, GetFreightCustomer, GetShipEstimateDetails, order_Details, OrderDetailsById,
    sendMessage, getMessagesList, getAllMessages, UpdateChatOnBack, UpdateChatOnEnter, countAll, countGraph,
    countofFreight, GetSupplerSelected, assignEstimatetoClient, UpdateOrderStatus, GetOrderStatus,
    StageOfShipment, socialMediaLinks, GetAllsocialLinks, getProfileAdmin, add_freight_to_warehouse, restore_order_from_warehouse,
    client_Shipping_Estimate, GetWarehouseOrders, DeleteWarehouseOrder, createBatch, getAllBatch, getBatchList, deleteBatch, UpdateOrderStatusesFromBatch, moveFreightToBatch, restoreOrderFromBatch,
    getFreightsByBatch, MoveToOrder, MoveToClearaneOrder, getCleranceOrder, getClerance, CompleteCleranceOrder, DeleteClearanceOrder,
    InprocessCleranceOrder, StillToCleranceOrder, addWarehouse, editWarehouse, getWarehouse, getWarehouseBySupplierId, DeleteWarehouse, editWarehouseDetails, GetCountries,
    GetCitiesByCountry, RevertOrder, addWarehouseProduct, getWarehouseOrderProduct, getWarehouseProductById, updateWarehouseProduct, deleteWarehouseProduct, updateClientWarehouseProduct, DeleteWarehouseProduct, GetFreightImages,
    DeleteDocument, clearanceDocument, ShipmentDocument, GetDeliveredOrder, OrderInvoiceList, revertMovedFreight, createFreightFolders, GetShipEstimateSupplierId, ApproveShippingEstimate,
    addEstimateShippingQuote, GetQuoteShipEstimateById, GetQuoteShipEstimateBySupplier, NewGetAllBatch, assignWarehouseSupplierToOrder, getAllAssignedOrdersToWarehouse, GetFreightAdminById,
    getAllAssignedOrdersToWarehouseBySupplier, assignWarehouseOrderToSupplier, getAssignedOrdersBySupplier, updateWareHouseProductBySupplier
}
