const con = require('../config/database');
const { validationResult, Result } = require('express-validator');
const bcrypt = require('bcryptjs');
const sendMail = require('../helpers/sendMail')
const rendomString = require('randomstring');

async function hashPassword(password) {
    return await bcrypt.hash(password, 10);
}

const AddStaff = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    try {
        const { staff_name, staff_email, new_password, roles } = req.body;
        // console.log(req.body);

        var encrypassword = await hashPassword(new_password);
        await con.query(`SELECT * FROM tbl_users WHERE email='${staff_email}' AND is_deleted='0' AND user_type='2'`, (err, result) => {
            if (err) throw err;
            if (result.length > 0) {
                res.status(400).send({
                    success: false,
                    message: "Email already exists!"
                });
            } else {
                // Join roles into a comma-separated string
                const assignedRoles = roles.join(', ');

                const insertQuery = `INSERT INTO tbl_users (full_name, email, password, user_type, assigned_roles)
                                     VALUES(?, ?, ?, ?, ?)`;
                con.query(insertQuery, [staff_name, staff_email, encrypassword, 2, assignedRoles], (err, insertdata) => {
                    if (err) throw err;
                    if (insertdata.affectedRows > 0) {
                        res.status(200).send({
                            success: true,
                            message: "Staff added successfully"
                        });
                    } else {
                        res.status(400).send({
                            success: false,
                            message: "Failed to add staff"
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
}


const updateStaff = async (req, res) => {
    try {
        const { staff_id, staff_name, email, roles, password } = req.body;
        // console.log(req.body);

        if (!staff_id || !email || !staff_name) {
            return res.status(400).send({
                success: false,
                message: "Please provide staff id, email, and staff name"
            });
        }

        // Check if email already exists for another user
        let sql = "SELECT * FROM tbl_users WHERE email = ? AND id <> ? AND is_deleted = 0 AND user_type= 2";
        await con.query(sql, [email, staff_id], async (err, data) => {
            if (err) throw err;
            // console.log(data);

            if (data.length > 0) {
                return res.status(400).send({
                    success: false,
                    message: "Email already exists!"
                });
            }

            // Update details
            let updateQuery;
            const queryParams = [staff_name, email, roles.join(', '), staff_id]; // Join roles into a string

            if (password) {
                // If password is provided, include it in the update query
                const encrypassword = await hashPassword(password);
                updateQuery = `UPDATE tbl_users SET full_name = ?, email = ?, assigned_roles = ?, password = ? WHERE id = ?`;
                queryParams.splice(3, 0, encrypassword); // Insert password into the queryParams
            } else {
                // If no password, skip updating the password
                updateQuery = `UPDATE tbl_users SET full_name = ?, email = ?, assigned_roles = ? WHERE id = ?`;
            }

            con.query(updateQuery, queryParams, (err, updateData) => {
                if (err) throw err;

                if (updateData.affectedRows > 0) {
                    res.status(200).send({
                        success: true,
                        message: "Details updated successfully"
                    });
                } else {
                    res.status(400).send({
                        success: false,
                        message: "Failed to update details"
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
}


const GetStaffList = async (req, res) => {
    try {
        const selectQuery = `SELECT id, full_name, email, status, assigned_roles, created_at, updated_at 
                             FROM tbl_users 
                             WHERE user_type=? AND is_deleted=? 
                             ORDER BY created_at DESC`;

        await con.query(selectQuery, [2, 0], (err, data) => {
            if (err) throw err;

            if (data.length > 0) {
                const modifiedData = data.map(item => ({
                    ...item,
                    assigned_roles: item.assigned_roles ? item.assigned_roles.split(',').map(role => role.trim()) : []
                }));

                res.status(200).send({
                    success: true,
                    data: modifiedData
                });
            } else {
                res.status(400).send({
                    success: false,
                    message: "No List Available",
                    data: []
                });
            }
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message,
            data: []
        });
    }
}

function getAssignedRoleLabel(role) {
    if (!role || role === "0") {
        return "No assigned roles";
    } else {
        const roles = role.split(',').map(Number); // Convert to array of numbers
        if (roles.includes(1) || roles.includes(2) || roles.includes(3)) {
            // At least one of the roles 1, 2, or 3 is present
            return "Quoting clerk, Operation controller, Customs clerk";
        } else {
            return "Unknown role";
        }
    }
}

const DeleteStaff = async (req, res) => {
    try {
        const { staff_id } = req.body;
        if (!staff_id) {
            res.status(400).send({
                success: false,
                message: "Please enter staff id"
            })
        }
        else {
            const selectQuery = `select is_deleted from tbl_users where id=?`;
            await con.query(selectQuery, [staff_id], (err, result) => {
                if (err) throw err;
                if (result.length > 0) {
                    if (result[0].is_deleted == 1) {
                        res.status(400).send({
                            success: false,
                            message: "Staff already deleted"
                        })
                    }
                    else {
                        const updateQuery = `update tbl_users set is_deleted=? where id=?`;
                        con.query(updateQuery, [1, staff_id], (err, data) => {
                            if (err) throw err;
                            if (data.affectedRows > 0) {
                                res.status(200).send({
                                    success: true,
                                    message: "Staff deleted successfully"
                                })
                            }
                            else {
                                res.status(400).send({
                                    success: false,
                                    message: "Failed to delete staff"
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

const ChangeStatus = async (req, res) => {
    try {
        const { user_id } = req.body;
        if (!user_id) {
            res.status(400).send({
                success: false,
                message: "Please provide user id"
            })
        }
        else {
            await con.query(`select status from tbl_users where id='${user_id}' and is_deleted='${0}'`, (err, data) => {

                if (err) throw err;

                if (data.length > 0) {
                    var status = 0
                    if (data[0].status == 1) {
                        status = 0;
                    }
                    else {
                        status = 1;
                    }
                    con.query(`update tbl_users set status='${status}' where id='${user_id}'`, (err, updateData) => {

                        if (err) throw err;
                        if (updateData.affectedRows > 0) {
                            res.status(200).send({
                                success: true,
                                message: "Update status successfully"
                            })
                        }
                        else {
                            res.status(400).send({
                                success: false,
                                message: "Failed to update status"
                            })
                        }
                    })
                }
                else {
                    res.status(400).send({
                        success: false,
                        message: "Id does not exist"
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

module.exports = {
    AddStaff, DeleteStaff, GetStaffList, ChangeStatus, updateStaff
}