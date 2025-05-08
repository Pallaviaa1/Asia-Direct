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

const updateStaffPermission = async (req, res) => {
    try {
        const { staff_id, staff_permissions, user_type } = req.body;
        console.log(req.body);

        if (!staff_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide staff id"
            });
        }

        if (!Array.isArray(staff_permissions) || staff_permissions.length === 0) {
            return res.status(400).send({
                success: false,
                message: "Please provide valid staff permissions"
            });
        }

        const updateQuery = `UPDATE tbl_users SET staff_permissions=? WHERE id=?`;
        const queryParams = [staff_permissions.join(', '), staff_id];

        con.query(updateQuery, queryParams, (err, updateData) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: "Database error",
                    error: err.message
                });
            }

            if (updateData.affectedRows > 0) {
                res.status(200).send({
                    success: true,
                    message: "Details updated successfully"
                });
            } else {
                res.status(404).send({
                    success: false,
                    message: "No matching staff record found"
                });
            }
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};


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

const getStaffPermissionsById = async (req, res) => {
    try {
        const { staff_id } = req.body;

        if (!staff_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide staff id"
            });
        }

        const selectQuery = `SELECT staff_permissions FROM tbl_users WHERE id = ?`;

        con.query(selectQuery, [staff_id], (err, data) => {
            if (err) {
                console.error("Error fetching staff permissions:", err);
                return res.status(500).send({
                    success: false,
                    message: "Internal server error",
                    error: err.message
                });
            }

            if (data.length === 0) {
                return res.status(404).send({
                    success: false,
                    message: "Staff member not found",
                    data: []
                });
            }

            const staff_permissions = data[0].staff_permissions
                ? data[0].staff_permissions.split(',').map(role => role.trim())
                : [];

            const permissionsData = [];

            const fetchAllMenuRoutes = () => {
                return new Promise((resolve, reject) => {
                    const selectQuery1 = `
                        SELECT 
                            m.id, 
                            m.menu_name, 
                            m.created_at, 
                            r.id AS route_id, 
                            r.route_url, 
                            r.name AS route_name, 
                            r.created 
                        FROM 
                            tbl_menus m 
                        LEFT JOIN 
                            tbl_menu_routes r 
                        ON 
                            m.id = r.menu_id`;

                    con.query(selectQuery1, (err, newdata) => {
                        if (err) {
                            return reject(err);
                        }
                        resolve(newdata);
                    });
                });
            };

            fetchAllMenuRoutes()
                .then(allRoutes => {
                    const groupedMenus = {};

                    allRoutes.forEach(route => {
                        if (!groupedMenus[route.id]) {
                            groupedMenus[route.id] = {
                                id: route.id,
                                menu_name: route.menu_name,
                                created_at: route.created_at,
                                menu_Routes: []
                            };
                        }

                        groupedMenus[route.id].menu_Routes.push({
                            id: route.route_id,
                            route_url: route.route_url,
                            name: route.route_name,
                            created: route.created,
                            is_checked: staff_permissions.includes(route.route_id.toString()) ? 1 : 0
                        });
                    });

                    Object.values(groupedMenus).forEach(menu => {
                        const totalRoutes = menu.menu_Routes.length;
                        const checkedRoutes = menu.menu_Routes.filter(route => route.is_checked === 1).length;
                        menu.is_checked = checkedRoutes === totalRoutes && totalRoutes > 0 ? 1 : 0;
                        permissionsData.push(menu);
                    });

                    return res.status(200).send({
                        success: true,
                        data: permissionsData
                    });
                })
                .catch(err => {
                    console.error("Error fetching menu routes:", err);
                    return res.status(500).send({
                        success: false,
                        message: "Internal server error",
                        error: err.message
                    });
                });
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};


const CheckPermission = async (req, res) => {
    try {
        const { staff_id, route_url, user_type } = req.body;

        if (!staff_id || !route_url) {
            return res.status(400).send({
                success: false,
                message: "Please provide both staff_id and route_url"
            });
        }
        if (user_type == 1) {
            return res.status(200).send({
                success: true,
                message: "Permission granted (admin access)"
            });
        }
        const selectQuery = `SELECT staff_permissions FROM tbl_users WHERE id = ?`;

        con.query(selectQuery, [staff_id], (err, data) => {
            if (err) {
                console.error("Error checking staff permissions:", err);
                return res.status(500).send({
                    success: false,
                    message: "Internal server error",
                    error: err.message
                });
            }

            if (data.length === 0) {
                return res.status(400).send({
                    success: false,
                    message: "Staff member not found"
                });
            }
            // console.log(data);

            const staff_permissions = data[0].staff_permissions
                ? data[0].staff_permissions.split(',').map(role => role.trim())
                : [];

            const checkRouteQuery = `SELECT id FROM tbl_menu_routes WHERE route_url = ?`;

            con.query(checkRouteQuery, [route_url], (err, routeData) => {
                if (err) {
                    console.error("Error checking route:", err);
                    return res.status(500).send({
                        success: false,
                        message: "Internal server error",
                        error: err.message
                    });
                }
                // console.log(routeData);

                if (routeData.length === 0) {
                    return res.status(400).send({
                        success: false,
                        message: "Route not found or not assigned to any menu"
                    });
                }

                const routeId = routeData[0].id.toString();
                // console.log(staff_permissions);

                if (staff_permissions.includes(routeId)) {
                    return res.status(200).send({
                        success: true,
                        message: "Permission granted"
                    });
                } else {
                    return res.status(400).send({
                        success: false,
                        message: "Permission denied"
                    });
                }
            });
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};


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

const GetAllPermissions = async (req, res) => {
    try {
        con.query(`SELECT * FROM tbl_menus`, async (err, menus) => {
            if (err) throw err;

            if (menus.length > 0) {
                // Fetch routes for each menu item
                const menuPromises = menus.map(menu => {
                    return new Promise((resolve, reject) => {
                        con.query(`SELECT * FROM tbl_menu_routes WHERE menu_id=?`, [menu.id], (err, routes) => {
                            if (err) return reject(err);
                            menu.menu_Routes = routes; // Attach routes to the menu item
                            resolve(menu);
                        });
                    });
                });

                // Wait for all queries to finish
                const fullMenuData = await Promise.all(menuPromises);

                return res.status(200).send({
                    success: true,
                    data: fullMenuData
                });
            } else {
                return res.status(400).send({
                    success: false,
                    message: "Data does not exist"
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

module.exports = {
    AddStaff, DeleteStaff, GetStaffList, ChangeStatus, updateStaff, GetAllPermissions, updateStaffPermission, getStaffPermissionsById, CheckPermission
}