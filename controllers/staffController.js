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
        const { staff_name, staff_email, new_password, roles, country, phone_no, country_code, access_country } = req.body;
        console.log(req.body);

        const accessCountryValue = Array.isArray(access_country)
            ? access_country.join(',')
            : access_country;

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

                const insertQuery = `INSERT INTO tbl_users (full_name, email, password, user_type, assigned_roles, country, cellphone, country_code, access_country)
                                     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                con.query(insertQuery, [staff_name, staff_email, encrypassword, 2, assignedRoles, country, phone_no, country_code, accessCountryValue], (err, insertdata) => {
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
        const { staff_id, staff_name, email, roles, password, country, phone_no, country_code, access_country } = req.body;
        // console.log(req.body);

        if (!staff_id || !email || !staff_name) {
            return res.status(400).send({
                success: false,
                message: "Please provide staff id, email, and staff name"
            });
        }

        const accessCountryValue = Array.isArray(access_country)
            ? access_country.join(',')
            : access_country;

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
            const queryParams = [staff_name, email, roles.join(', '), country, phone_no, country_code, accessCountryValue, staff_id]; // Join roles into a string

            if (password) {
                // If password is provided, include it in the update query
                const encrypassword = await hashPassword(password);
                updateQuery = `UPDATE tbl_users SET full_name = ?, email = ?, assigned_roles = ?, password = ?,
                country=?, cellphone=?, country_code=?, access_country=? WHERE id = ?`;
                queryParams.splice(3, 0, encrypassword); // Insert password into the queryParams
            } else {
                // If no password, skip updating the password
                updateQuery = `UPDATE tbl_users SET full_name = ?, email = ?, assigned_roles = ?,
                country=?, cellphone=?, country_code=?, access_country=? WHERE id = ?`;
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

// const GetStaffList = async (req, res) => {
//     try {
//         const selectQuery = `
//             SELECT 
//                 u.id, 
//                 u.full_name, 
//                 u.email, 
//                 u.status, 
//                 u.assigned_roles, 
//                 u.country, 
//                 u.country_code,
//                 u.access_country,
//                 u.cellphone AS phone_no, 
//                 u.created_at, 
//                 u.updated_at, 
//                 c.name AS country_name
//             FROM tbl_users AS u
//             LEFT JOIN countries AS c ON c.id = u.country
//             WHERE u.user_type = ? AND u.is_deleted = ?
//             ORDER BY u.created_at DESC
//         `;

//         con.query(selectQuery, [2, 0], async (err, data) => {
//             if (err) {
//                 return res.status(500).send({
//                     success: false,
//                     message: err.message,
//                     data: []
//                 });
//             }

//             if (!data.length) {
//                 return res.status(400).send({
//                     success: false,
//                     message: "No List Available",
//                     data: []
//                 });
//             }

//             /* STEP 1: collect all access_country IDs */
//             const allCountryIds = new Set();
//             data.forEach(item => {
//                 if (item.access_country) {
//                     item.access_country
//                         .split(',')
//                         .map(id => id.trim())
//                         .filter(Boolean)
//                         .forEach(id => allCountryIds.add(Number(id)));
//                 }
//             });

//             /* STEP 2: fetch country names */
//             let countryMap = {};
//             if (allCountryIds.size > 0) {
//                 const countryQuery = `
//                     SELECT id, name 
//                     FROM countries 
//                     WHERE id IN (?)
//                 `;

//                 con.query(countryQuery, [[...allCountryIds]], (err, rows) => {
//                     if (err) {
//                         return res.status(500).send({
//                             success: false,
//                             message: err.message,
//                             data: []
//                         });
//                     }

//                     rows.forEach(c => {
//                         countryMap[c.id] = c.name;
//                     });

//                     /* STEP 3: final mapping */
//                     const modifiedData = data.map(item => {
//                         const accessCountryArr = item.access_country
//                             ? item.access_country
//                                 .split(',')
//                                 .map(id => id.trim())
//                                 .filter(Boolean)
//                             : [];

//                         return {
//                             ...item,
//                             assigned_roles: item.assigned_roles
//                                 ? item.assigned_roles.split(',').map(r => r.trim())
//                                 : [],
//                             access_country: accessCountryArr,
//                             access_country_name: accessCountryArr.map(
//                                 id => countryMap[id] || null
//                             )
//                         };
//                     });

//                     res.status(200).send({
//                         success: true,
//                         data: modifiedData
//                     });
//                 });
//             } else {
//                 /* No access_country case */
//                 const modifiedData = data.map(item => ({
//                     ...item,
//                     assigned_roles: item.assigned_roles
//                         ? item.assigned_roles.split(',').map(r => r.trim())
//                         : [],
//                     access_country: [],
//                     access_country_name: []
//                 }));

//                 res.status(200).send({
//                     success: true,
//                     data: modifiedData
//                 });
//             }
//         });
//     } catch (error) {
//         res.status(500).send({
//             success: false,
//             message: error.message,
//             data: []
//         });
//     }
// };

const GetStaffList = async (req, res) => {
    try {
        const selectQuery = `SELECT 
    u.id, 
    u.full_name, 
    u.email, 
    u.status, 
    u.assigned_roles, 
    u.country, 
    u.country_code, 
    u.cellphone as phone_no, 
    u.created_at, 
    u.updated_at, 
    c.name AS country_name
FROM tbl_users AS u
LEFT JOIN countries AS c ON c.id = u.country
WHERE u.user_type = ? AND u.is_deleted = ?
ORDER BY u.created_at DESC;
`;

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
};

const NewStaffList = async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.body;

        let condition = `WHERE u.user_type = ? AND u.is_deleted = ?`;
        let params = [2, 0];

        if (search) {
            condition += ` AND (
                u.full_name LIKE ?
                OR u.email LIKE ?
                OR u.cellphone LIKE ?
                OR c.name LIKE ?
            )`;
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam, searchParam);
        }

        const baseQuery = `
            FROM tbl_users AS u
            LEFT JOIN countries AS c ON c.id = u.country
            ${condition}
        `;

        const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
        const totalResult = await new Promise((resolve, reject) => {
            con.query(countQuery, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
        const total = totalResult[0].total;

        const offset = (page - 1) * limit;

        const selectQuery = `SELECT 
            u.id, 
            u.full_name, 
            u.email, 
            u.status, 
            u.assigned_roles, 
            u.country, 
            u.country_code,
            u.access_country, 
            u.cellphone as phone_no, 
            u.created_at, 
            u.updated_at, 
            c.name AS country_name
        ${baseQuery}
        ORDER BY u.created_at DESC
        LIMIT ? OFFSET ?`;

        const dataParams = [...params, limit, offset];

        con.query(selectQuery, dataParams, async (err, data) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: err.message,
                    data: []
                });
            }

            /* STEP 1: collect all access_country IDs */
            let allCountryIds = new Set();
            data.forEach(item => {
                if (item.access_country) {
                    item.access_country
                        .split(',')
                        .forEach(id => allCountryIds.add(id.trim()));
                }
            });

            /* STEP 2: fetch country names */
            let countryMap = {};
            if (allCountryIds.size > 0) {
                const countryIds = [...allCountryIds];
                const countryQuery = `
                    SELECT id, name 
                    FROM countries 
                    WHERE id IN (?)
                `;

                const countryRows = await new Promise((resolve, reject) => {
                    con.query(countryQuery, [countryIds], (err, rows) => {
                        if (err) return reject(err);
                        resolve(rows);
                    });
                });

                countryRows.forEach(c => {
                    countryMap[c.id] = c.name;
                });
            }

            /* STEP 3: final response mapping */
            const modifiedData = data.map(item => {
                const accessCountryArr = item.access_country
                    ? item.access_country.split(',').map(id => id.trim())
                    : [];

                return {
                    ...item,
                    assigned_roles: item.assigned_roles
                        ? item.assigned_roles.split(',').map(r => r.trim())
                        : [],
                    access_country: accessCountryArr,
                    access_country_name: accessCountryArr.map(
                        id => countryMap[id] || null
                    )
                };
            });

            res.status(200).send({
                success: true,
                data: modifiedData,
                total,
                page: parseInt(page),
                limit: parseInt(limit)
            });
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message,
            data: []
        });
    }
};

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

const getStaffNewFreight = (req, res) => {
    const { staff_id, from, to } = req.body;

    let condition = `
        WHERE tbl_freight.is_deleted = 0
        AND tbl_freight.sales_representative = ?
    `;
    let params = [staff_id];

    if (from && to) {
        condition += ` AND DATE(tbl_freight.created_at) BETWEEN ? AND ?`;
        params.push(from, to);
    }

    const sql = `
        SELECT 
            COUNT(*) AS total_new_freight
        FROM tbl_freight
        ${condition}
    `;

    con.query(sql, params, (err, rows) => {
        if (err) {
            return res.status(500).send({ success: false, message: err.message });
        }

        res.status(200).send({
            success: true,
            data: rows[0]
        });
    });
};

const getStaffConfirmedOrders = (req, res) => {
    const { staff_id, from, to } = req.body;

    let condition = `
        WHERE tbl_freight.order_status = 1
        AND tbl_freight.sales_representative = ?
    `;
    let params = [staff_id];

    if (from && to) {
        condition += ` AND DATE(tbl_freight.confirmed_at) BETWEEN ? AND ?`;
        params.push(from, to);
    }

    const sql = `
        SELECT COUNT(*) AS confirmed_orders
        FROM tbl_freight
        ${condition}
    `;

    con.query(sql, params, (err, rows) => {
        if (err) {
            return res.status(500).send({ success: false, message: err.message });
        }

        res.status(200).send({
            success: true,
            data: rows[0]
        });
    });
};

const getStaffDeliveryUpdateTime = (req, res) => {
    const { staff_id, from, to } = req.body;

    let condition = ` WHERE updated_by = ? `;
    let params = [staff_id];

    if (from && to) {
        condition += ` AND DATE(created_at) BETWEEN ? AND ? `;
        params.push(from, to);
    }

    const sql = `
        SELECT 
            AVG(time_diff) AS avg_minutes
        FROM (
            SELECT 
                TIMESTAMPDIFF(
                    MINUTE,
                    MIN(created_at),
                    MAX(created_at)
                ) AS time_diff
            FROM tbl_delivery_status_history
            ${condition}
            GROUP BY freight_id
        ) AS t
    `;

    con.query(sql, params, (err, rows) => {
        if (err) {
            return res.status(500).send({
                success: false,
                message: err.message
            });
        }

        res.status(200).send({
            success: true,
            data: {
                avg_delivery_update_time_minutes: rows[0].avg_minutes || 0
            }
        });
    });
};

const getStaffKpiDashboard = (req, res) => {
    const { staff_id } = req.body;

    /* ================= NEW FREIGHT TODAY ================= */
    const newFreightSql = `
        SELECT COUNT(*) AS total
        FROM tbl_freight
        WHERE is_deleted = 0
        AND sales_representative = ?
        AND DATE(created_at) = CURDATE()
    `;

    /* ================= CONFIRMED ORDERS TODAY ================= */
    const confirmedSql = `
        SELECT COUNT(*) AS total
        FROM tbl_freight
        WHERE order_status = 1
        AND sales_representative = ?
        AND DATE(confirmed_at) = CURDATE()
    `;

    /* ================= AVG DELIVERY UPDATE TIME ================= */
    const deliveryTimeSql = `
        SELECT AVG(time_diff) AS avg_minutes
        FROM (
            SELECT 
                TIMESTAMPDIFF(
                    MINUTE,
                    MIN(created_at),
                    MAX(created_at)
                ) AS time_diff
            FROM tbl_delivery_status_history
            WHERE updated_by = ?
            GROUP BY freight_id
        ) t
    `;

    con.query(newFreightSql, [staff_id], (err, nf) => {
        if (err) {
            return res.status(500).send({ success: false, message: err.message });
        }

        con.query(confirmedSql, [staff_id], (err, co) => {
            if (err) {
                return res.status(500).send({ success: false, message: err.message });
            }

            con.query(deliveryTimeSql, [staff_id], (err, dt) => {
                if (err) {
                    return res.status(500).send({ success: false, message: err.message });
                }

                res.status(200).send({
                    success: true,
                    data: {
                        newFreightToday: nf[0].total,
                        confirmedOrdersToday: co[0].total,
                        avgDeliveryUpdateMinutes: dt[0].avg_minutes || 0
                    }
                });
            });
        });
    });
};

const GetStaffKpiData = async (req, res) => {
    try {
        const { user_id } = req.body;

        if (!user_id) {
            return res.status(400).json({
                success: false,
                message: "user_id is required"
            });
        }

        /* ================= VALIDATE STAFF ================= */
        const staff = await new Promise((resolve, reject) => {
            con.query(
                `SELECT id FROM tbl_users 
                 WHERE id = ? 
                 AND user_type = '2' 
                 AND is_deleted = 0`,
                [user_id],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows);
                }
            );
        });

        if (!staff.length) {
            return res.status(403).json({
                success: false,
                message: "Only staff (user_type 2) allowed"
            });
        }

        /* ================= FREIGHT KPI ================= */
        const freightKPI = await new Promise((resolve, reject) => {
            con.query(`
                SELECT 
                    COUNT(id) AS total_freight,
                    SUM(weight) AS total_weight,
                    SUM(dimension) AS total_dimension,
                    SUM(no_of_packages) AS total_packages,
                    SUM(CASE WHEN isConfirmed = 1 THEN 1 ELSE 0 END) AS confirmed_freight
                FROM tbl_freight
                WHERE 
                    (user_id = ? OR sales_representative = ?)
                    AND is_deleted = 0
            `, [user_id, user_id], (err, rows) => {
                if (err) return reject(err);
                resolve(rows[0]);
            });
        });

        /* ================= ORDER KPI ================= */
        const orderKPI = await new Promise((resolve, reject) => {
            con.query(`
                SELECT COUNT(o.id) AS total_orders
                FROM tbl_orders o
                INNER JOIN tbl_freight f ON f.id = o.freight_id
                WHERE 
                    (f.user_id = ? OR f.sales_representative = ?)
            `, [user_id, user_id], (err, rows) => {
                if (err) return reject(err);
                resolve(rows[0]);
            });
        });

        /* ================= BATCH KPI ================= */
        const batchKPI = await new Promise((resolve, reject) => {
            con.query(`
                SELECT COUNT(DISTINCT fab.batch_id) AS total_batches
                FROM freight_assig_to_batch fab
                INNER JOIN tbl_freight f ON f.id = fab.freight_id
                WHERE 
                    (f.user_id = ? OR f.sales_representative = ?)
            `, [user_id, user_id], (err, rows) => {
                if (err) return reject(err);
                resolve(rows[0]);
            });
        });

        /* ================= WAREHOUSE KPI ================= */
        const warehouseKPI = await new Promise((resolve, reject) => {
            con.query(`
                SELECT 
                    COUNT(id) AS total_warehouse_assignments,
                    SUM(total_weight) AS total_warehouse_weight,
                    SUM(total_dimension) AS total_warehouse_dimension
                FROM warehouse_assign_order
                WHERE added_by = ?
            `, [user_id], (err, rows) => {
                if (err) return reject(err);
                resolve(rows[0]);
            });
        });

        return res.status(200).json({
            success: true,
            data: {
                freight: {
                    total_freight: freightKPI.total_freight || 0,
                    confirmed_freight: freightKPI.confirmed_freight || 0,
                    total_weight: freightKPI.total_weight || 0,
                    total_dimension: freightKPI.total_dimension || 0,
                    total_packages: freightKPI.total_packages || 0
                },
                orders: {
                    total_orders: orderKPI.total_orders || 0
                },
                batches: {
                    total_batches: batchKPI.total_batches || 0
                },
                warehouse: {
                    total_warehouse_assignments: warehouseKPI.total_warehouse_assignments || 0,
                    total_warehouse_weight: warehouseKPI.total_warehouse_weight || 0,
                    total_warehouse_dimension: warehouseKPI.total_warehouse_dimension || 0
                }
            }
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// const assignFreightToStaff = async (req, res) => {
//     try {
//         const { freight_id, staff_id } = req.body;

//         if (!freight_id || !staff_id) {
//             return res.status(400).send({
//                 success: false,
//                 message: "freight_id and staff_id are required"
//             });
//         }

//         //Check staff exists (user_type = 2)
//         con.query(
//             `SELECT id
//              FROM tbl_users
//              WHERE id = ?
//              AND user_type = 2
//              AND status = 1
//              AND is_deleted = 0`,
//             [staff_id],
//             (err, staffResult) => {

//                 if (err)
//                     return res.status(500).send({
//                         success: false,
//                         message: err.message
//                     });

//                 if (staffResult.length === 0) {
//                     return res.status(404).send({
//                         success: false,
//                         message: "Staff not found or inactive"
//                     });
//                 }

//                 //Check freight exists
//                 con.query(
//                     `SELECT sales_representative
//                      FROM tbl_freight
//                      WHERE id = ?
//                      AND is_deleted = 0`,
//                     [freight_id],
//                     (err, freightResult) => {

//                         if (err)
//                             return res.status(500).send({
//                                 success: false,
//                                 message: err.message
//                             });

//                         if (freightResult.length === 0) {
//                             return res.status(404).send({
//                                 success: false,
//                                 message: "Freight not found"
//                             });
//                         }

//                         // if (freightResult[0].staff_task_assign_id) {
//                         //     return res.status(409).send({
//                         //         success: false,
//                         //         message: "Staff already assigned to this freight"
//                         //     });
//                         // }

//                         // Assign staff to freight
//                         con.query(
//                             `UPDATE tbl_freight
//                              SET sales_representative = ?,
//                                  updated_at = NOW()
//                              WHERE id = ?`,
//                             [staff_id, freight_id],
//                             (err) => {
//                                 if (err) {
//                                     return res.status(500).send({
//                                         success: false,
//                                         message: err.message
//                                     });
//                                 }

//                                 con.query(`Insert into tasks () values()`)

//                                 return res.status(200).send({
//                                     success: true,
//                                     message: "Staff assigned to freight successfully"
//                                 });
//                             }
//                         );
//                     }
//                 );
//             }
//         );

//     } catch (error) {
//         return res.status(500).send({
//             success: false,
//             message: error.message
//         });
//     }
// };


const assignFreightToStaff = async (req, res) => {
    try {
        const { freight_id, staff_id } = req.body;

        if (!freight_id || !staff_id) {
            return res.status(400).send({
                success: false,
                message: "freight_id and staff_id are required"
            });
        }

        // CHECK STAFF
        con.query(
            `SELECT id
             FROM tbl_users
             WHERE id = ?
             AND user_type = 2
             AND status = 1
             AND is_deleted = 0`,
            [staff_id],
            (err, staffResult) => {

                if (err)
                    return res.status(500).send({
                        success: false,
                        message: err.message
                    });

                if (staffResult.length === 0) {
                    return res.status(404).send({
                        success: false,
                        message: "Staff not found or inactive"
                    });
                }

                //  GET FREIGHT WITH PRIORITY
                con.query(
                    `SELECT id, sales_representative, priority
                     FROM tbl_freight
                     WHERE id = ?
                     AND is_deleted = 0`,
                    [freight_id],
                    (err, freightResult) => {

                        if (err)
                            return res.status(500).send({
                                success: false,
                                message: err.message
                            });

                        if (freightResult.length === 0) {
                            return res.status(404).send({
                                success: false,
                                message: "Freight not found"
                            });
                        }

                        const freight = freightResult[0];

                        //  UPDATE FREIGHT ASSIGNMENT
                        con.query(
                            `UPDATE tbl_freight
                             SET sales_representative = ?,
                                 updated_at = NOW()
                             WHERE id = ?`,
                            [staff_id, freight_id],
                            (err) => {

                                if (err) {
                                    return res.status(500).send({
                                        success: false,
                                        message: err.message
                                    });
                                }

                                //  INSERT TASK WITH FREIGHT PRIORITY
                                con.query(
                                    `INSERT INTO tasks
                                     (title, description, task_type, assigned_to, priority, reference_id, created_at)
                                     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
                                    [
                                        `Freight Task`,
                                        `Handle freight process`,
                                        'freight',
                                        staff_id,
                                        freight.priority || 'medium',
                                        freight_id
                                    ],
                                    (err) => {

                                        if (err) {
                                            return res.status(500).send({
                                                success: false,
                                                message: err.message
                                            });
                                        }

                                        return res.status(200).send({
                                            success: true,
                                            message: "Freight assigned & task created successfully"
                                        });
                                    }
                                );
                            }
                        );
                    }
                );
            }
        );

    } catch (error) {
        return res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

const assignClearanceToStaff = async (req, res) => {
    try {
        const { clearance_id, staff_id } = req.body;

        if (!clearance_id || !staff_id) {
            return res.status(400).send({
                success: false,
                message: "clearance_id and staff_id are required"
            });
        }

        // CHECK STAFF
        con.query(
            `SELECT id
             FROM tbl_users
             WHERE id = ?
             AND user_type = 2
             AND status = 1
             AND is_deleted = 0`,
            [staff_id],
            (err, staffResult) => {

                if (err)
                    return res.status(500).send({
                        success: false,
                        message: err.message
                    });

                if (staffResult.length === 0) {
                    return res.status(404).send({
                        success: false,
                        message: "Staff not found or inactive"
                    });
                }

                // GET CLEARANCE WITH PRIORITY
                con.query(
                    `SELECT id, sales_representative
                     FROM tbl_clearance
                     WHERE id = ?
                     AND is_deleted = 0`,
                    [clearance_id],
                    (err, clearanceResult) => {

                        if (err)
                            return res.status(500).send({
                                success: false,
                                message: err.message
                            });

                        if (clearanceResult.length === 0) {
                            return res.status(404).send({
                                success: false,
                                message: "Clearance not found"
                            });
                        }

                        const clearance = clearanceResult[0];

                        // DUPLICATE TASK CHECK
                        con.query(
                            `SELECT id FROM tasks 
                             WHERE reference_id = ? 
                             AND task_type = 'clearance'
                             AND status != 'completed'`,
                            [clearance_id],
                            (err, existingTask) => {

                                if (err)
                                    return res.status(500).send({
                                        success: false,
                                        message: err.message
                                    });

                                // if (existingTask.length > 0) {
                                //     return res.status(200).send({
                                //         success: true,
                                //         message: "Task already exists for this clearance"
                                //     });
                                // }

                                // UPDATE CLEARANCE ASSIGNMENT
                                con.query(
                                    `UPDATE tbl_clearance
                                     SET sales_representative = ?,
                                         updated_at = NOW()
                                     WHERE id = ?`,
                                    [staff_id, clearance_id],
                                    (err) => {



                                        if (err) {
                                            return res.status(500).send({
                                                success: false,
                                                message: err.message
                                            });
                                        }

                                        // CREATE TASK WITH CLEARANCE PRIORITY
                                        con.query(
                                            `INSERT INTO tasks
                                             (title, description, task_type, assigned_to, priority, reference_id, created_at)
                                             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
                                            [
                                                `Clearance Task`,
                                                `Handle clearance process`,
                                                'clearance',
                                                staff_id,
                                                'Low',
                                                clearance_id
                                            ],
                                            (err) => {

                                                if (err) {
                                                    return res.status(500).send({
                                                        success: false,
                                                        message: err.message
                                                    });
                                                }

                                                return res.status(200).send({
                                                    success: true,
                                                    message: "Clearance assigned & task created successfully"
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

    } catch (error) {
        return res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

const getAllAssignedClearanceSatff = async (req, res) => {
    try {
        let { page = 1, limit = 10 } = req.body;

        page = parseInt(page) || 1;
        limit = parseInt(limit) || 10;
        const offset = (page - 1) * limit;

        // Fetch assigned freights from tasks
        const query = `
            SELECT 
                t.id AS task_id,
                t.task_type,
                t.reference_id as clearance_id,
                t.assigned_to AS staff_id,
                t.priority,
                t.notes as notes,
                t.status AS task_status,
                t.created_at AS task_created_at,
                t.updated_at AS task_updated_at,
 t.action_required AS action_required,
  t.due_date AS due_date,
                c.clearance_number,
                c.freight,
                c.created_at AS clearance_created_at,

                s.full_name AS staff_name,
                s.email AS staff_email,
                s.cellphone AS staff_phone,
                s.country AS staff_country

            FROM tasks t
            INNER JOIN tbl_clearance c
                ON c.id = t.reference_id
            INNER JOIN tbl_users s
                ON s.id = t.assigned_to
            WHERE t.task_type = 'clearance'
                AND c.is_deleted = 0
                AND s.is_deleted = 0
            ORDER BY t.created_at DESC
            LIMIT ? OFFSET ?;
        `;

        con.query(query, [limit, offset], (err, tasks) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: err.message
                });
            }

            // Total assigned freight tasks for pagination
            const countQuery = `
                SELECT COUNT(*) AS total
                FROM tasks t
                INNER JOIN tbl_clearance c
                    ON c.id = t.reference_id
                INNER JOIN tbl_users s
                    ON s.id = t.assigned_to
                WHERE t.task_type = 'clearance'
                    AND c.is_deleted = 0
                    AND s.is_deleted = 0;
            `;

            con.query(countQuery, (err, countResult) => {
                if (err) {
                    return res.status(500).send({
                        success: false,
                        message: err.message
                    });
                }

                return res.status(200).send({
                    success: true,
                    page,
                    limit,
                    total: countResult[0].total,
                    total_assigned_freights: tasks.length,
                    data: tasks
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

const getFreightsByStaffId = async (req, res) => {
    try {
        const { staff_id } = req.body;

        if (!staff_id) {
            return res.status(400).send({
                success: false,
                message: "supplier_id is required"
            });
        }

        const query = `
            SELECT 
                f.*,

                tu.id AS staff_id,
                tu.full_name AS staff_name,
                tu.email AS staff_email,
                tu.cellphone as phone_no,
                tu.country_code,
                tu.country

            FROM tbl_freight f
            INNER JOIN tbl_users tu 
                ON tu.id = f.staff_assign_id
            WHERE 
                f.staff_assign_id = ?
                AND f.is_deleted = 0
                AND tu.is_deleted = 0
            ORDER BY f.created_at DESC
        `;

        con.query(query, [staff_id], (err, result) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: err.message
                });
            }

            return res.status(200).send({
                success: true,
                count: result.length,
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

const getAllAssignedFreightsSatff = async (req, res) => {
    try {
        let { page = 1, limit = 10 } = req.body;

        page = parseInt(page) || 1;
        limit = parseInt(limit) || 10;
        const offset = (page - 1) * limit;

        // Fetch assigned freights from tasks
        const query = `
            SELECT 
                t.id AS task_id,
                t.task_type,
                t.reference_id as freight_id,
                t.assigned_to AS staff_id,
                t.priority,
                t.notes as notes,
                t.status AS task_status,
                t.created_at AS task_created_at,
                t.updated_at AS task_updated_at,
                 t.action_required AS action_required,
                  t.due_date AS due_date,
                f.freight_number,
                f.freight,
                f.created_at AS freight_created_at,

                s.full_name AS staff_name,
                s.email AS staff_email,
                s.cellphone AS staff_phone,
                s.country AS staff_country

            FROM tasks t
            INNER JOIN tbl_freight f
                ON f.id = t.reference_id
            INNER JOIN tbl_users s
                ON s.id = t.assigned_to
            WHERE t.task_type = 'freight'
                AND f.is_deleted = 0
                AND s.is_deleted = 0
            ORDER BY t.created_at DESC
            LIMIT ? OFFSET ?;
        `;

        con.query(query, [limit, offset], (err, tasks) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: err.message
                });
            }

            // Total assigned freight tasks for pagination
            const countQuery = `
                SELECT COUNT(*) AS total
                FROM tasks t
                INNER JOIN tbl_freight f
                    ON f.id = t.reference_id
                INNER JOIN tbl_users s
                    ON s.id = t.assigned_to
                WHERE t.task_type = 'freight'
                    AND f.is_deleted = 0
                    AND s.is_deleted = 0;
            `;

            con.query(countQuery, (err, countResult) => {
                if (err) {
                    return res.status(500).send({
                        success: false,
                        message: err.message
                    });
                }

                return res.status(200).send({
                    success: true,
                    page,
                    limit,
                    total: countResult[0].total,
                    total_assigned_freights: tasks.length,
                    data: tasks
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

// const createCustomTask = async (req, res) => {
//     try {
//         const { task_title, description, staff_id, priority, due_date, action_required } = req.body;

//         // Basic validation
//         if (!task_title || !staff_id) {
//             return res.status(400).send({
//                 success: false,
//                 message: "task_title and staff_id are required"
//             });
//         }

//         // Validate action_required if provided
//         const allowedActions = ['call', 'email', 'meeting', 'attend'];
//         if (action_required && !allowedActions.includes(action_required)) {
//             return res.status(400).send({
//                 success: false,
//                 message: `Invalid action_required. Allowed values: ${allowedActions.join(', ')}`
//             });
//         }

//         // Optional: validate due_date format (basic check)
//         if (due_date && isNaN(Date.parse(due_date))) {
//             return res.status(400).send({
//                 success: false,
//                 message: "Invalid due_date format. Use YYYY-MM-DD."
//             });
//         }

//         // Check if staff exists and is active
//         con.query(
//             `SELECT id, full_name 
//              FROM tbl_users 
//              WHERE id = ? AND user_type = 2 AND status = 1 AND is_deleted = 0`,
//             [staff_id],
//             (err, staffResult) => {
//                 if (err) return res.status(500).send({ success: false, message: err.message });
//                 if (staffResult.length === 0) {
//                     return res.status(404).send({ success: false, message: "Staff not found or inactive" });
//                 }

//                 // Insert into tasks table
//                 const insertQuery = `
//                     INSERT INTO tasks 
//                     (title, description, assigned_to, task_type, priority, status, due_date, action_required, created_at, updated_at)
//                     VALUES (?, ?, ?, 'custom', ?, 'pending', ?, ?, NOW(), NOW())
//                 `;

//                 con.query(
//                     insertQuery,
//                     [
//                         task_title, 
//                         description || "", 
//                         staff_id, 
//                         priority || "Medium", 
//                         due_date || null, 
//                         action_required || null
//                     ],
//                     (err, result) => {
//                         if (err) return res.status(500).send({ success: false, message: err.message });

//                         return res.status(201).send({
//                             success: true,
//                             message: "Custom task created and assigned successfully",
//                             task_id: result.insertId
//                         });
//                     }
//                 );
//             }
//         );

//     } catch (error) {
//         return res.status(500).send({
//             success: false,
//             message: error.message
//         });
//     }
// };

const createCustomTask = async (req, res) => {
    try {
        const { task_title, description, staff_id, priority, due_date, action_required } = req.body;

        // Basic validation
        if (!task_title || !staff_id) {
            return res.status(400).send({
                success: false,
                message: "task_title and staff_id are required"
            });
        }

        // Validate action_required if provided
        const allowedActions = ['call', 'email', 'meeting', 'attend'];
        if (action_required && !allowedActions.includes(action_required)) {
            return res.status(400).send({
                success: false,
                message: `Invalid action_required. Allowed values: ${allowedActions.join(', ')}`
            });
        }

        // Optional: validate due_date format (basic check)
        if (due_date && isNaN(Date.parse(due_date))) {
            return res.status(400).send({
                success: false,
                message: "Invalid due_date format. Use YYYY-MM-DD."
            });
        }

        // Check if staff exists and is active
        con.query(
            `SELECT id, full_name 
             FROM tbl_users 
             WHERE id = ? AND user_type = 2 AND status = 1 AND is_deleted = 0`,
            [staff_id],
            (err, staffResult) => {
                if (err) return res.status(500).send({ success: false, message: err.message });
                if (staffResult.length === 0) {
                    return res.status(404).send({ success: false, message: "Staff not found or inactive" });
                }

                // Insert into tasks table
                const insertQuery = `
                    INSERT INTO tasks 
                    (title, description, assigned_to, task_type, priority, status, due_date, action_required, created_at, updated_at)
                    VALUES (?, ?, ?, 'custom', ?, 'pending', ?, ?, NOW(), NOW())
                `;

                con.query(
                    insertQuery,
                    [
                        task_title,
                        description || "",
                        staff_id,
                        priority || "Medium",
                        due_date || null,
                        action_required || null
                    ],
                    (err, result) => {
                        if (err) return res.status(500).send({ success: false, message: err.message });

                        return res.status(201).send({
                            success: true,
                            message: "Custom task created and assigned successfully",
                            task_id: result.insertId
                        });
                    }
                );
            }
        );

    } catch (error) {
        return res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

// const getAllCustomTasks = async (req, res) => {
//     try {
//         const { page = 1, limit = 10 } = req.body;
//         const offset = (page - 1) * limit;

//         // Query to fetch tasks with assigned staff details
//         const query = `
//             SELECT 
//                 t.id AS task_id,
//                 t.title as task_title,
//                 t.description,
//                 t.priority,
//                 t.status as task_status,
//                 t.notes as notes,
//                 t.due_date,
//                 t.created_at,
//                 t.updated_at,

//                 s.id AS staff_id,
//                 s.full_name AS staff_name,
//                 s.email AS staff_email,
//                 s.cellphone AS staff_phone,
//                 s.country AS staff_country

//             FROM tasks t
//             INNER JOIN tbl_users s ON s.id = t.assigned_to
//             WHERE 
//                 t.task_type = 'custom'
//                 AND s.is_deleted = 0
//             ORDER BY t.created_at DESC
//             LIMIT ? OFFSET ?
//         `;

//         con.query(query, [parseInt(limit), parseInt(offset)], (err, result) => {
//             if (err) {
//                 return res.status(500).send({ success: false, message: err.message });
//             }

//             // Total count for pagination
//             const countQuery = `SELECT COUNT(*) AS total FROM tasks WHERE task_type = 'custom'`;

//             con.query(countQuery, (err, total) => {
//                 if (err) return res.status(500).send({ success: false, message: err.message });

//                 return res.status(200).send({
//                     success: true,
//                     total_tasks: result.length,
//                     data: result,
//                     page,
//                     limit,
//                     total: total[0].total
//                 });
//             });
//         });

//     } catch (error) {
//         return res.status(500).send({ success: false, message: error.message });
//     }
// };

const getAllCustomTasks = async (req, res) => {
    try {
        let { page = 1, limit = 10 } = req.body;

        page = parseInt(page);
        limit = parseInt(limit);
        const offset = (page - 1) * limit;

        // Main query
        const dataQuery = `
            SELECT 
                t.id AS task_id,
                t.title AS task_title,
                t.description,
                t.priority,
                t.status AS task_status,
                 t.action_required AS action_required,
                t.notes,
                t.due_date,
                t.created_at,
                t.updated_at,

                s.id AS staff_id,
                s.full_name AS staff_name,
                s.email AS staff_email,
                s.cellphone AS staff_phone,
                s.country AS staff_country

            FROM tasks t
            JOIN tbl_users s ON s.id = t.assigned_to
            WHERE 
                t.task_type = 'custom'
                AND s.is_deleted = 0
            ORDER BY t.created_at DESC
            LIMIT ? OFFSET ?
        `;

        // Count query (IMPORTANT: same JOIN conditions)
        const countQuery = `
            SELECT COUNT(*) AS total
            FROM tasks t
            JOIN tbl_users s ON s.id = t.assigned_to
            WHERE 
                t.task_type = 'custom'
                AND s.is_deleted = 0
        `;

        // Promisify queries
        const queryAsync = (sql, params = []) => {
            return new Promise((resolve, reject) => {
                con.query(sql, params, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });
        };

        // Run queries in parallel 🚀
        const [data, countResult] = await Promise.all([
            queryAsync(dataQuery, [limit, offset]),
            queryAsync(countQuery)
        ]);

        return res.status(200).send({
            success: true,
            data,
            total: countResult[0].total,
            page,
            limit,
            total_pages: Math.ceil(countResult[0].total / limit)
        });

    } catch (error) {
        return res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

const updateTaskStatus = async (req, res) => {
    try {
        const { task_id, task_status, notes, due_date, action_required } = req.body;

        if (!task_id) {
            return res.status(400).send({
                success: false,
                message: "task_id is required"
            });
        }

        // Validate action_required
        const allowedActions = ['call', 'email', 'meeting', 'attend'];
        if (action_required && !allowedActions.includes(action_required)) {
            return res.status(400).send({
                success: false,
                message: `Invalid action_required. Allowed values: ${allowedActions.join(', ')}`
            });
        }

        // Validate due_date
        if (due_date && isNaN(Date.parse(due_date))) {
            return res.status(400).send({
                success: false,
                message: "Invalid due_date format (use YYYY-MM-DD)"
            });
        }

        // Check if task exists
        con.query(
            `SELECT id FROM tasks WHERE id = ?`,
            [task_id],
            (err, taskResult) => {
                if (err) {
                    return res.status(500).send({
                        success: false,
                        message: err.message
                    });
                }

                if (taskResult.length === 0) {
                    return res.status(404).send({
                        success: false,
                        message: "Task not found"
                    });
                }

                // =========================
                // BUILD DYNAMIC UPDATE QUERY
                // =========================
                let updateFields = [];
                let updateValues = [];

                if (task_status) {
                    updateFields.push("status = ?");
                    updateValues.push(task_status);
                }

                if (notes !== undefined) {
                    updateFields.push("notes = ?");
                    updateValues.push(notes);
                }

                if (due_date) {
                    updateFields.push("due_date = ?");
                    updateValues.push(due_date);
                }

                if (action_required) {
                    updateFields.push("action_required = ?");
                    updateValues.push(action_required);
                }

                // Always update timestamp
                updateFields.push("updated_at = NOW()");

                updateValues.push(task_id);

                const updateQuery = `
                    UPDATE tasks 
                    SET ${updateFields.join(", ")}
                    WHERE id = ?
                `;

                con.query(updateQuery, updateValues, (err) => {
                    if (err) {
                        return res.status(500).send({
                            success: false,
                            message: err.message
                        });
                    }

                    return res.status(200).send({
                        success: true,
                        message: "Task updated successfully"
                    });
                });
            }
        );

    } catch (error) {
        return res.status(500).send({
            success: false,
            message: error.message
        });
    }
};


const getTasksByStaffId = async (req, res) => {
    try {
        let { staff_id, page = 1, limit = 10, status, task_type } = req.body;

        if (!staff_id) {
            return res.status(400).send({
                success: false,
                message: "staff_id is required"
            });
        }

        page = parseInt(page) || 1;
        limit = parseInt(limit) || 10;
        const offset = (page - 1) * limit;

        //  Dynamic filters
        let conditions = `t.assigned_to = ?`;
        let params = [staff_id];

        if (status) {
            conditions += ` AND t.status = ?`;
            params.push(status);
        }

        if (task_type) {
            conditions += ` AND t.task_type = ?`;
            params.push(task_type);
        }

        const query = `
            SELECT 
                t.id AS task_id,
                t.title,
                t.description,
                t.task_type,
                t.priority,
                t.status,
                t.notes,
                t.due_date,
                t.reference_id,
                t.created_at,
                t.updated_at,

                f.freight_number,
                c.clearance_number

            FROM tasks t

            LEFT JOIN tbl_freight f 
                ON f.id = t.reference_id AND t.task_type = 'freight'

            LEFT JOIN tbl_clearance c 
                ON c.id = t.reference_id AND t.task_type = 'clearance'

            WHERE ${conditions}
            ORDER BY t.created_at DESC
            LIMIT ? OFFSET ?
        `;

        params.push(limit, offset);

        con.query(query, params, (err, result) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: err.message
                });
            }

            // Count query
            const countQuery = `
                SELECT COUNT(*) AS total
                FROM tasks t
                WHERE ${conditions}
            `;

            con.query(countQuery, params.slice(0, params.length - 2), (err, countResult) => {
                if (err) {
                    return res.status(500).send({
                        success: false,
                        message: err.message
                    });
                }

                return res.status(200).send({
                    success: true,
                    page,
                    limit,
                    total: countResult[0].total,
                    total_tasks: result.length,
                    data: result
                });
            });
        });

    } catch (error) {
        return res.status(500).send({
            success: false,
            message: error.messageshipping_estimate_id
        });
    }
};

const addTaskComment = async (req, res) => {
    try {
        const { task_id, user_id, comment } = req.body;

        if (!task_id || !user_id || !comment) {
            return res.status(400).send({
                success: false,
                message: "task_id, user_id and comment are required"
            });
        }

        // check task exists
        con.query(
            `SELECT id FROM tasks WHERE id = ?`,
            [task_id],
            (err, taskResult) => {
                if (err) return res.status(500).send({ success: false, message: err.message });

                if (taskResult.length === 0) {
                    return res.status(404).send({
                        success: false,
                        message: "Task not found"
                    });
                }

                // insert comment
                con.query(
                    `INSERT INTO task_comments (task_id, user_id, comment)
                     VALUES (?, ?, ?)`,
                    [task_id, user_id, comment],
                    (err) => {
                        if (err) {
                            return res.status(500).send({
                                success: false,
                                message: err.message
                            });
                        }

                        return res.status(200).send({
                            success: true,
                            message: "Comment added successfully"
                        });
                    }
                );
            }
        );

    } catch (error) {
        return res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

const getTaskComments = async (req, res) => {
    try {
        const { task_id } = req.body;

        if (!task_id) {
            return res.status(400).send({
                success: false,
                message: "task_id is required"
            });
        }

        const query = `
            SELECT 
                tc.id,
                tc.comment,
                tc.created_at,

                u.id AS user_id,
                u.full_name,
                u.user_type

            FROM task_comments tc
            INNER JOIN tbl_users u ON u.id = tc.user_id
            WHERE tc.task_id = ?
            ORDER BY tc.created_at ASC
        `;

        con.query(query, [task_id], (err, result) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: err.message
                });
            }

            return res.status(200).send({
                success: true,
                total_comments: result.length,
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

// const ClientKPIModule = async (req, res) => {
//     try {
//         const query = `
//         SELECT 
//             u.id AS client_id,
//             u.full_name,

//             -- Total Orders
//             COUNT(DISTINCT o.id) AS total_orders,

//             -- Total Freight
//             COUNT(DISTINCT f.id) AS total_freight,

//             -- Total Delivered Orders
//             COUNT(DISTINCT CASE 
//                 WHEN o.track_status = 'Delivered' THEN o.id
//             END) AS total_delivered,

//             --  Total Amount (ONLY converted freights, NO duplication)
//             COALESCE(SUM(DISTINCT f_amount.amount), 0) AS total_amount

//         FROM tbl_users u

//         -- Freight
//         LEFT JOIN tbl_freight f 
//             ON f.client_id = u.id 
//             AND f.is_deleted = 0

//         -- Orders (ONLY valid link)
//         LEFT JOIN tbl_orders o 
//             ON o.freight_id = f.id

//         --  Amount per freight (safe mapping)
//         LEFT JOIN (
//             SELECT 
//                 f.id AS freight_id,
//                 esq.sumofRoe AS amount
//             FROM tbl_freight f
//             LEFT JOIN estimate_shipping_quote esq 
//                 ON esq.id = f.shipping_estimate_id
//         ) AS f_amount 
//             ON f_amount.freight_id = f.id

//         --  Only freights that are converted into orders
//         WHERE f.id IN (
//             SELECT DISTINCT freight_id 
//             FROM tbl_orders
//         )

//         GROUP BY u.id, u.full_name
//         ORDER BY total_amount DESC
//         `;

//         con.query(query, (err, results) => {
//             if (err) {
//                 console.error("KPI Error:", err);
//                 return res.status(500).json({
//                     success: false,
//                     message: "Database query failed",
//                     error: err.message
//                 });
//             }

//             return res.status(200).json({
//                 success: true,
//                 data: results
//             });
//         });

//     } catch (error) {
//         console.error("Unexpected Error:", error);
//         return res.status(500).json({
//             success: false,
//             message: "Internal server error",
//             error: error.message
//         });
//     }
// };

const ClientKPIModule = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const search = req.query.search || "";

        const dataQuery = `
        SELECT 
            u.id AS client_id,
            u.full_name,

            COUNT(DISTINCT f.id) AS total_freight,
            COUNT(DISTINCT o.id) AS total_orders,

            COUNT(DISTINCT CASE 
                WHEN o.track_status = 'Delivered' THEN o.id
            END) AS total_delivered,

            COALESCE(ROUND(SUM(f_amount.amount), 2), 0) AS total_amount,

            MAX(f_amount.is_new) AS is_new

        FROM tbl_users u

        LEFT JOIN tbl_freight f 
            ON f.client_id = u.id 
            AND f.is_deleted = 0

        LEFT JOIN tbl_orders o 
            ON o.freight_id = f.id

        LEFT JOIN (
            SELECT 
                f.id AS freight_id,

                COALESCE(
                    esq.sumofRoe,
                    se.total_amount,
                    0
                ) AS amount,

                CASE 
                    WHEN esq.sumofRoe IS NOT NULL THEN 1
                    ELSE 0
                END AS is_new

            FROM tbl_freight f

            LEFT JOIN estimate_shipping_quote esq 
                ON esq.id = f.shipping_estimate_id

            LEFT JOIN shipping_estimate se 
                ON se.freight_id = f.id

        ) AS f_amount 
            ON f_amount.freight_id = f.id

        WHERE f.id IN (
            SELECT DISTINCT freight_id FROM tbl_orders
        )

        ${search ? `AND u.full_name LIKE ?` : ""}

        GROUP BY u.id, u.full_name

        ORDER BY is_new DESC, total_amount DESC

        LIMIT ? OFFSET ?
        `;

        const countQuery = `
        SELECT COUNT(*) AS total FROM (
            SELECT u.id
            FROM tbl_users u
            LEFT JOIN tbl_freight f 
                ON f.client_id = u.id 
                AND f.is_deleted = 0
            WHERE f.id IN (
                SELECT DISTINCT freight_id FROM tbl_orders
            )
            ${search ? `AND u.full_name LIKE ?` : ""}
            GROUP BY u.id
        ) AS t
        `;

        const searchParam = `%${search}%`;

        con.query(countQuery, search ? [searchParam] : [], (countErr, countResult) => {
            if (countErr) {
                console.error("Count Error:", countErr);
                return res.status(500).json({ success: false });
            }

            const totalRecords = countResult[0].total;
            const totalPages = Math.ceil(totalRecords / limit);

            const queryParams = search
                ? [searchParam, limit, offset]
                : [limit, offset];

            con.query(dataQuery, queryParams, (err, results) => {
                if (err) {
                    console.error("KPI Error:", err);
                    return res.status(500).json({
                        success: false,
                        message: "Database query failed",
                        error: err.message
                    });
                }

                return res.status(200).json({
                    success: true,
                    data: results,
                    pagination: {
                        currentPage: page,
                        limit,
                        totalRecords,
                        totalPages
                    }
                });
            });
        });

    } catch (error) {
        console.error("Unexpected Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

module.exports = {
    AddStaff, DeleteStaff, GetStaffList, ChangeStatus, updateStaff, GetAllPermissions, updateStaffPermission,
    getStaffPermissionsById, CheckPermission, NewStaffList, getStaffNewFreight, getStaffConfirmedOrders,
    getStaffDeliveryUpdateTime, getStaffKpiDashboard, GetStaffKpiData, assignFreightToStaff, getFreightsByStaffId,
    getAllAssignedFreightsSatff, assignClearanceToStaff, createCustomTask, getAllAssignedClearanceSatff, getAllCustomTasks, updateTaskStatus,
    getTasksByStaffId, addTaskComment, getTaskComments, ClientKPIModule
}
