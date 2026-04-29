const con = require('../config/database');
const { validationResult, Result } = require('express-validator');
const bcrypt = require('bcryptjs');
async function hashPassword(password) {
    return await bcrypt.hash(password, 10);
}

const AddSupplier = (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }

    try {
        const {
            supplier_name,
            supplier_email,
            password,
            country,
            country_code,
            phone_no,
            user_type = 1   // default supplier
        } = req.body;

        const selectQuery = `
            SELECT id FROM tbl_suppliers 
            WHERE email = ? AND is_deleted = 0
        `;

        con.query(selectQuery, [supplier_email], async (err, data) => {
            if (err) {
                return res.status(500).json({ success: false, message: err.message });
            }

            if (data.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "Email already exists!"
                });
            }

            // Hash password
            const encryptedPassword = await hashPassword(password);

            const insertQuery = `
                INSERT INTO tbl_suppliers 
                (name, email, password, country, country_code, phone_no, user_type)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;

            con.query(
                insertQuery,
                [
                    supplier_name,
                    supplier_email,
                    encryptedPassword,
                    country,
                    country_code,
                    phone_no,
                    user_type
                ],
                (err, result) => {
                    if (err) {
                        return res.status(500).json({ success: false, message: err.message });
                    }

                    return res.status(200).json({
                        success: true,
                        message: "Supplier added successfully",
                        supplier_id: result.insertId,
                        user_type: user_type
                    });
                }
            );
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const LoginSupplier = (req, res) => {
    const { email, password } = req.body;

    const query = `SELECT * FROM tbl_suppliers WHERE email=? AND is_deleted=0`;

    con.query(query, [email], (err, rows) => {
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        }

        if (rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid email"
            });
        }

        const supplier = rows[0];

        // Password Check
        const isMatch = bcrypt.compareSync(password, supplier.password);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "Invalid password"
            });
        }

        // Determine login type
        let loginType = "";
        if (supplier.user_type == 1) {
            loginType = "Supplier Login successfully";
        } else if (supplier.user_type == 2) {
            loginType = "Warehouse Login successfully";
        }

        res.status(200).json({
            success: true,
            message: loginType,
            data: {
                id: supplier.id,
                name: supplier.name,
                email: supplier.email,
                user_type: supplier.user_type
            }
        });
    });
};

const SupplierList = async (req, res) => {
    try {
        const selectQuery = `
            SELECT 
                tbl_suppliers.id, 
                tbl_suppliers.name, 
                tbl_suppliers.email, 
                tbl_suppliers.country, 
                tbl_suppliers.country_code, 
                tbl_suppliers.phone_no, 
                c.name AS country_name
            FROM tbl_suppliers
            LEFT JOIN countries c ON c.id = tbl_suppliers.country
            WHERE tbl_suppliers.is_deleted = ?
            ORDER BY tbl_suppliers.created_at DESC
        `;

        // Wrap in a promise
        const data = await new Promise((resolve, reject) => {
            con.query(selectQuery, [0], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });

        if (data.length > 0) {
            res.status(200).send({
                success: true,
                data: data
            });
        } else {
            res.status(400).send({
                success: false,
                message: "No list Available"
            });
        }

    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

const getSupplierList = async (req, res) => {
    try {
        const selectQuery = `
            SELECT 
                tbl_suppliers.id, 
                tbl_suppliers.name, 
                tbl_suppliers.email, 
                tbl_suppliers.country, 
                tbl_suppliers.country_code, 
                tbl_suppliers.phone_no, 
                c.name AS country_name
            FROM tbl_suppliers
            LEFT JOIN countries c ON c.id = tbl_suppliers.country
            WHERE tbl_suppliers.is_deleted = ? and user_type = 1
            ORDER BY tbl_suppliers.created_at DESC
        `;

        // Wrap in a promise
        const data = await new Promise((resolve, reject) => {
            con.query(selectQuery, [0], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });

        if (data.length > 0) {
            res.status(200).send({
                success: true,
                data: data
            });
        } else {
            res.status(400).send({
                success: false,
                message: "No list Available"
            });
        }

    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

const getWarehouseSupplierList = async (req, res) => {
    try {
        const selectQuery = `
            SELECT 
                tbl_suppliers.id, 
                tbl_suppliers.name, 
                tbl_suppliers.email, 
                tbl_suppliers.country, 
                tbl_suppliers.country_code, 
                tbl_suppliers.phone_no, 
                c.name AS country_name
            FROM tbl_suppliers
            LEFT JOIN countries c ON c.id = tbl_suppliers.country
            WHERE tbl_suppliers.is_deleted = ? and user_type = 2
            ORDER BY tbl_suppliers.created_at DESC
        `;

        // Wrap in a promise
        const data = await new Promise((resolve, reject) => {
            con.query(selectQuery, [0], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });

        if (data.length > 0) {
            res.status(200).send({
                success: true,
                data: data
            });
        } else {
            res.status(400).send({
                success: false,
                message: "No list Available"
            });
        }

    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

const NewSupplierList = async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.body;

        let condition = `WHERE tbl_suppliers.is_deleted = ?`;
        let params = [0];

        // Add global search condition across multiple fields
        if (search) {
            condition += ` AND (
                tbl_suppliers.name LIKE ?
                OR tbl_suppliers.email LIKE ?
                OR tbl_suppliers.country LIKE ? 
                OR tbl_suppliers.phone_no LIKE ?
                OR c.name LIKE ?
            )`;
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam, searchParam, searchParam);
        }

        // Build base query for joins and conditions
        const baseQuery = `
            FROM tbl_suppliers
            LEFT JOIN countries c ON c.id = tbl_suppliers.country
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

        const selectQuery = `
            SELECT 
                tbl_suppliers.id, 
                tbl_suppliers.name, 
                tbl_suppliers.email, 
                tbl_suppliers.country, 
                tbl_suppliers.country_code, 
                tbl_suppliers.phone_no, 
                c.name AS country_name
            ${baseQuery}
            ORDER BY tbl_suppliers.created_at DESC
            LIMIT ? OFFSET ?
        `;

        // Add limit and offset to params
        const dataParams = [...params, limit, offset];

        // Wrap in a promise
        const data = await new Promise((resolve, reject) => {
            con.query(selectQuery, dataParams, (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });

        // Always return success with data (empty array if no records), total, page, limit
        res.status(200).send({
            success: true,
            data: data,
            total: total,
            page: parseInt(page),
            limit: parseInt(limit)
        });

    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

const UpdateSupplier = async (req, res) => {
    try {
        const {
            supplier_id,
            supplier_email,
            supplier_name,
            country,
            country_code,
            phone_no,
            password
        } = req.body;

        if (!supplier_id || !supplier_email || !supplier_name) {
            return res.status(400).send({
                success: false,
                message: "supplier_id, supplier_email, and supplier_name are required"
            });
        }

        let profile = req.file ? req.file.filename : null;

        // 1️⃣ Check email already exists for another supplier
        const checkEmailSql = `
            SELECT id
            FROM tbl_suppliers
            WHERE email = ? AND id <> ? AND is_deleted = 0
        `;

        con.query(checkEmailSql, [supplier_email, supplier_id], async (err, data) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: "Email check failed",
                    error: err
                });
            }

            if (data.length > 0) {
                return res.status(400).send({
                    success: false,
                    message: "Email already exists!"
                });
            }

            // 2️⃣ Build update query dynamically
            let updateQuery = `
                UPDATE tbl_suppliers
                SET name = ?, email = ?, country = ?, country_code = ?, phone_no = ?
            `;
            let params = [supplier_name, supplier_email, country, country_code, phone_no];

            // profile update
            if (profile) {
                updateQuery += `, profile = ?`;
                params.push(profile);
            }

            // password update (optional)
            if (password) {
                const hashedPassword = await bcrypt.hash(password, 10);
                updateQuery += `, password = ?`;
                params.push(hashedPassword);
            }

            updateQuery += ` WHERE id = ?`;
            params.push(supplier_id);

            // 3️⃣ Execute update
            con.query(updateQuery, params, (err, updateData) => {
                if (err) {
                    return res.status(500).send({
                        success: false,
                        message: "Failed to update supplier",
                        error: err
                    });
                }

                if (updateData.affectedRows > 0) {
                    return res.status(200).send({
                        success: true,
                        message: "Supplier details updated successfully"
                    });
                } else {
                    return res.status(400).send({
                        success: false,
                        message: "No changes made or invalid supplier_id"
                    });
                }
            });
        });

    } catch (error) {
        return res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

const GetSupplierByid = async (req, res) => {
    try {
        const { supplier_id } = req.body;
        if (!supplier_id) {
            res.status(400).send({
                success: false,
                message: "Please provide supplier id"
            })
        }
        else {
            const selectQuery = `select * from tbl_suppliers where id=?`;
            await con.query(selectQuery, [supplier_id], (err, data) => {
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

const DeleteSupplier = async (req, res) => {
    try {
        const { supplier_id } = req.body;
        if (!supplier_id) {
            res.status(400).send({
                success: false,
                message: "Please provide supplier id"
            })
        }
        else {
            const selectQuery = `select is_deleted from tbl_suppliers where id=?`;
            await con.query(selectQuery, [supplier_id], (err, data) => {
                if (err) throw err;
                if (data.length > 0) {
                    if (data[0].is_deleted == 1) {
                        res.status(400).send({
                            success: false,
                            message: "Supplier is already deleted"
                        })
                    }
                    else {
                        const updateQuery = `update tbl_suppliers set is_deleted=? where id=?`;
                        con.query(updateQuery, [1, supplier_id], (err, result) => {
                            if (err) throw err;
                            if (result.affectedRows > 0) {
                                res.status(200).send({
                                    success: true,
                                    message: "Supplier deleted successfully"
                                })
                            }
                            else {
                                res.status(400).send({
                                    success: false,
                                    message: "Failed to delete supplier"
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

const assignFreightToSupplier = async (req, res) => {
    try {
        const { freight_id, supplier_id } = req.body;

        if (!freight_id || !supplier_id) {
            return res.status(400).send({
                success: false,
                message: "freight_id and supplier_id are required"
            });
        }

        con.query(
            `SELECT id FROM tbl_suppliers WHERE id=? AND is_deleted=0`,
            [supplier_id],
            (err, supplierResult) => {
                if (err) return res.status(500).send({ success: false, message: err.message });

                if (supplierResult.length === 0) {
                    return res.status(404).send({
                        success: false,
                        message: "Supplier not found"
                    });
                }

                con.query(
                    `SELECT supplier_task_assign_id 
                     FROM tbl_freight 
                     WHERE id=? AND is_deleted=0`,
                    [freight_id],
                    (err, freightResult) => {
                        if (err) return res.status(500).send({ success: false, message: err.message });

                        if (freightResult.length === 0) {
                            return res.status(404).send({
                                success: false,
                                message: "Freight not found"
                            });
                        }

                        if (freightResult[0].supplier_task_assign_id) {
                            return res.status(409).send({
                                success: false,
                                message: "Supplier already assigned to this freight"
                            });
                        }

                        con.query(
                            `UPDATE tbl_freight 
                             SET supplier_task_assign_id=?, updated_at=NOW()
                             WHERE id=?`,
                            [supplier_id, freight_id],
                            (err) => {
                                if (err) {
                                    return res.status(500).send({
                                        success: false,
                                        message: err.message
                                    });
                                }

                                return res.status(200).send({
                                    success: true,
                                    message: "Supplier assigned to freight successfully"
                                });
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

const getFreightsBySupplier = async (req, res) => {
    try {
        const { supplier_id } = req.body;

        if (!supplier_id) {
            return res.status(400).send({
                success: false,
                message: "supplier_id is required"
            });
        }

        const query = `
            SELECT 
                f.*,

                s.id AS supplier_id,
                s.name AS supplier_name,
                s.email AS supplier_email,
                s.phone_no,
                s.country

            FROM tbl_freight f
            INNER JOIN tbl_suppliers s 
                ON s.id = f.supplier_task_assign_id
            WHERE 
                f.supplier_task_assign_id = ?
                AND f.is_deleted = 0
                AND s.is_deleted = 0
            ORDER BY f.created_at DESC
        `;

        con.query(query, [supplier_id], (err, result) => {
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

const getAllAssignedFreightsForAdmin = async (req, res) => {
    try {
        const query = `
            SELECT 
                f.*,

                s.id       AS supplier_id,
                s.name     AS supplier_name,
                s.email    AS supplier_email,
                s.phone_no AS supplier_phone,
                s.country  AS supplier_country

            FROM tbl_freight f
            INNER JOIN tbl_suppliers s 
                ON s.id = f.supplier_task_assign_id
            WHERE 
                f.supplier_task_assign_id IS NOT NULL
                AND f.is_deleted = 0
                AND s.is_deleted = 0
            ORDER BY f.created_at DESC
        `;

        con.query(query, (err, result) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: err.message
                });
            }

            return res.status(200).send({
                success: true,
                total_assigned_freights: result.length,
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

const updateSupplierStatusOfFreight = async (req, res) => {
    try {
        const {
            freight_id,
            assign_supplier_status,
            user_id,
            user_type
        } = req.body;

        if (!freight_id || assign_supplier_status === undefined) {
            return res.status(400).send({
                success: false,
                message: "freight_id and assign_supplier_status are required"
            });
        }

        /* ===== VALIDATE STATUS ===== */
        const validStatus = [0, 1, 2];
        if (!validStatus.includes(Number(assign_supplier_status))) {
            return res.status(400).send({
                success: false,
                message: "Invalid assign_supplier_status (0=Pending,1=Accept,2=Reject)"
            });
        }

        /* ===== ALL ACCESS USERS ===== */
        const ALL_ACCESS_USERS = [1, 19855];

        /* ===== CHECK FREIGHT EXISTS ===== */
        let checkQuery = `
            SELECT id, supplier_task_assign_id
            FROM tbl_freight
            WHERE id = ? AND is_deleted = 0
        `;

        con.query(checkQuery, [freight_id], (err, freightData) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: err.message
                });
            }

            if (freightData.length === 0) {
                return res.status(404).send({
                    success: false,
                    message: "Freight not found"
                });
            }

            const freight = freightData[0];

            /* ===== PERMISSION CHECK ===== */
            if (
                !ALL_ACCESS_USERS.includes(Number(user_id)) &&
                user_type == 2 &&
                freight.supplier_task_assign_id != user_id
            ) {
                return res.status(403).send({
                    success: false,
                    message: "You are not authorized to update this freight"
                });
            }

            /* ===== UPDATE QUERY ===== */
            const updateQuery = `
                UPDATE tbl_freight
                SET 
                    assign_supplier_status = ?,
                    updated_at = NOW()
                WHERE id = ?
            `;

            con.query(
                updateQuery,
                [assign_supplier_status, freight_id],
                (updateErr, result) => {
                    if (updateErr) {
                        return res.status(500).send({
                            success: false,
                            message: updateErr.message
                        });
                    }

                    return res.status(200).send({
                        success: true,
                        message: "Supplier status updated successfully",
                        data: {
                            freight_id,
                            assign_supplier_status
                        }
                    });
                }
            );
        });

    } catch (error) {
        return res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

const GetSupplierFreights = (req, res) => {
    const supplier_id = parseInt(req.body.supplier_id);

    if (!supplier_id)
        return res.status(400).json({ success: false, message: "supplier_id required" });

    const query = `
        SELECT 
            f.*, 
            u.full_name AS client_name, 
            u.client_number AS client_number, 
            s.id AS estimate_id,
            c.name AS delivery_to_name, 
            co.name AS collection_from_name,
            esq.id as quote_estimate_id,
            esq.is_approved
        FROM tbl_freight f
        LEFT JOIN estimate_shipping_quote esq on esq.freight_id = f.id
        LEFT JOIN shipping_estimate s ON s.freight_id = f.id 
        LEFT JOIN tbl_users u ON u.id = f.client_id
        LEFT JOIN countries AS c ON c.id = f.delivery_to
        LEFT JOIN countries AS co ON co.id = f.collection_from
        WHERE FIND_IN_SET(?, f.assign_id) > 0
          AND f.is_deleted = 0
        GROUP BY f.id
        ORDER BY f.created_at DESC
    `;

    con.query(query, [supplier_id], (err, data) => {
        if (err) return res.status(500).json({ success: false, message: err.message });

        res.status(200).json({ success: true, data });
    });
};

const AssignSuppliersToFreight = (req, res) => {
    const { freight_id, supplier_ids } = req.body;

    if (!freight_id || !supplier_ids || !Array.isArray(supplier_ids) || supplier_ids.length === 0) {
        return res.status(400).json({
            success: false,
            message: "freight_id and supplier_ids array are required"
        });
    }

    // 1 Check if freight exists
    const checkFreightQuery = `SELECT * FROM tbl_freight WHERE id = ? AND is_deleted = 0`;
    con.query(checkFreightQuery, [freight_id], (err, freightData) => {
        if (err) return res.status(500).json({ success: false, message: err.message });

        if (freightData.length === 0) {
            return res.status(400).json({ success: false, message: "Freight not found" });
        }

        // 2 Convert supplier_ids array to comma-separated string
        const supplierString = supplier_ids.join(",");

        // 3 Update freight assign_id
        const updateQuery = `UPDATE tbl_freight SET assign_id = ? WHERE id = ?`;
        con.query(updateQuery, [supplierString, freight_id], (err, result) => {
            if (err) return res.status(500).json({ success: false, message: err.message });

            return res.status(200).json({
                success: true,
                message: "Suppliers assigned successfully",
                freight_id: freight_id,
                assigned_suppliers: supplier_ids
            });
        });
    });
};

const GetSupplierProfile = async (req, res) => {
    try {
        const { supplier_id } = req.body;

        if (!supplier_id) {
            return res.status(400).send({
                success: false,
                message: "supplier_id is required"
            });
        }

        const query = `
            SELECT 
                s.id as supplier_id,
                s.name,
                s.email,
                s.country,
                s.country_code,
                c.name as country_name,
                s.phone_no,
                s.user_type,
                s.profile,
                s.created_at
            FROM tbl_suppliers s left join countries c ON s.country = c.id
            WHERE s.id = ? AND s.is_deleted = 0
        `;

        con.query(query, [supplier_id], (err, data) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: err.message
                });
            }

            if (data.length === 0) {
                return res.status(404).send({
                    success: false,
                    message: "Supplier not found"
                });
            }

            return res.status(200).send({
                success: true,
                data: data[0]
            });
        });

    } catch (error) {
        return res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

const UpdateSupplierProfile = async (req, res) => {
    try {
        const {
            supplier_id,
            name,
            email,
            country,
            country_code,
            phone_no,
            password
        } = req.body;
        // console.log(req.body);
        // console.log(req.file);
        if (!supplier_id) {
            return res.status(400).send({
                success: false,
                message: "supplier_id is required"
            });
        }

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Please enter the email"
            });
        }

        if (email) {
            const emailCheckQuery = `
                SELECT id 
                FROM tbl_suppliers 
                WHERE email = ? 
                AND id != ? 
                AND is_deleted = 0
            `;

            const emailExists = await new Promise((resolve, reject) => {
                con.query(emailCheckQuery, [email, supplier_id], (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows.length > 0);
                });
            });

            if (emailExists) {
                return res.status(400).send({
                    success: false,
                    message: "Email already exists"
                });
            }
        }

        let updateFields = [];
        let params = [];

        if (name) {
            updateFields.push("name = ?");
            params.push(name);
        }

        if (email) {
            updateFields.push("email = ?");
            params.push(email);
        }

        if (country) {
            updateFields.push("country = ?");
            params.push(country);
        }

        if (country_code) {
            updateFields.push("country_code = ?");
            params.push(country_code);
        }

        if (phone_no) {
            updateFields.push("phone_no = ?");
            params.push(phone_no);
        }

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updateFields.push("password = ?");
            params.push(hashedPassword);
        }

        if (req.file) {
            updateFields.push("profile = ?");
            params.push(req.file.filename);
        }

        if (updateFields.length === 0) {
            return res.status(400).send({
                success: false,
                message: "Nothing to update"
            });
        }

        params.push(supplier_id);

        const query = `
            UPDATE tbl_suppliers
            SET ${updateFields.join(", ")}
            WHERE id = ? AND is_deleted = 0
        `;

        con.query(query, params, (err, result) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: err.message
                });
            }

            return res.status(200).send({
                success: true,
                message: "Supplier profile updated successfully"
            });
        });

    } catch (error) {
        return res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

// important
// const createOrderAndWarehouse = (req, res) => {
//     const {
//         goods_description,
//         ware_receipt_no,
//         total_dimension,
//         total_weight,
//         cartons,
//         express_no,
//         supplier_contact,
//         CBM,
//         warehousing_date,
//         collection_from,
//         delivery_to,
//         client_name,
//         supplier_id,
//         freight,
//         // new keys
//         courier_waybill_ref,
//         date_entry_created,
//         dispatched_date,
//         // package info
//         customer_ref,
//         box_marking,
//         package_type,
//         hazardous,
//         total_packeges,
//         hazard_description,
//         package_comment,
//         // damages
//         damage_goods,
//         damaged_pkg_qty,
//         damage_packed,
//         damage_comment,

//         supplier_company,
//         supplier_person,
//         supplier_address,
//         //cargo handling
//         warehouse_order_id,
//         warehouse_collect,
//         costs_to_collect,
//         warehouse_storage,
//         warehouse_cost,
//         handling_required,
//         handling_cost,
//         warehouse_dispatch,
//         cost_to_dispatch,
//         warehouse_comment,

//         added_by,

//     } = req.body;
//     console.log(req.body);
//     console.log(req.files);
//     const productImages = req.files?.product_images || [];
//     const damageImages = req.files?.damage_images || [];
//     const documents = req.files?.documents || [];

//     let calculatedDays = null;

//     if (warehousing_date && dispatched_date) {

//         const startDate = new Date(warehousing_date);
//         const endDate = new Date(dispatched_date);

//         // remove time portion
//         startDate.setHours(0, 0, 0, 0);
//         endDate.setHours(0, 0, 0, 0);

//         if (endDate < startDate) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Dispatch date cannot be before warehouse date"
//             });
//         }

//         const diffTime = endDate.getTime() - startDate.getTime();

//         calculatedDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
//     }
//     // Check that at least one field is provided
//     if (
//         !goods_description &&
//         !ware_receipt_no &&
//         !express_no &&
//         !total_dimension &&
//         !total_weight &&
//         !cartons &&
//         !supplier_contact &&
//         !CBM &&
//         !warehousing_date &&
//         !collection_from &&
//         !delivery_to &&
//         !client_name &&
//         !freight &&
//         !courier_waybill_ref &&
//         !date_entry_created &&
//         !dispatched_date &&
//         !customer_ref &&
//         !box_marking &&
//         !package_type &&
//         !hazardous &&
//         !total_packeges &&
//         !hazard_description &&
//         !package_comment &&
//         // damages
//         !damage_goods &&
//         !damaged_pkg_qty &&
//         !damage_packed &&
//         !damage_comment &&

//         !supplier_company &&
//         !supplier_person &&
//         !supplier_address &&
//         //cargo handling
//         !warehouse_order_id &&
//         !warehouse_collect &&
//         !costs_to_collect &&
//         !warehouse_storage &&
//         !warehouse_cost &&
//         !handling_required &&
//         !handling_cost &&
//         !warehouse_dispatch &&
//         !cost_to_dispatch &&
//         !warehouse_comment
//     ) {
//         return res.status(400).send({
//             success: false,
//             message: "At least one product detail is required"
//         });
//     }
//     // if (!supplier_id) {
//     //     return res.status(400).send({
//     //         success: false,
//     //         message: "Supplier ID is required"
//     //     });
//     // }

//     //  Insert order directly
//     con.query(
//         `INSERT INTO tbl_orders
//      (goods_description, dimensions, weight, warehouse_status, cartons, CBM, collection_from, delivery_to, client_name, supplier_id, freight_type, added_by )
//      VALUES (?,?,?,?,?,?,?,?,?,?, ?, ?)`,
//         [
//             goods_description || null,
//             total_dimension || null,
//             total_weight || null,
//             1,
//             cartons || 0,
//             CBM || null,
//             collection_from || 0,
//             delivery_to || 0,
//             client_name || null,
//             supplier_id || 0,
//             freight || null,
//             added_by || 1,
//         ],
//         (err, orderResult) => {
//             if (err) {
//                 console.error(err);
//                 return res.status(500).send({
//                     success: false,
//                     message: "Failed to create order"
//                 });
//             }

//             const order_id = orderResult.insertId;

//             // Assign order to warehouse
//             con.query(
//                 `INSERT INTO warehouse_assign_order
// (order_id, ware_receipt_no, warehouse_status, express_no, supplier_contact_no,
// total_dimension, total_weight, warehousing_date, supplier_id, added_by,
// courier_waybill_ref, date_entry_created, dispatched_date, days_in_warehouse, warehouse_comment,

// customer_ref, box_marking, package_type, hazardous, total_packeges,
// hazard_description, package_comment,

// damage_goods, damaged_pkg_qty, damage_packed, damage_comment,

// supplier_company, supplier_person, supplier_address, warehouse_order_id,

// warehouse_collect, costs_to_collect, warehouse_storage, warehouse_cost,
// handling_required, handling_cost, warehouse_dispatch, cost_to_dispatch)

// VALUES (?,?,?,?,?,?,?,?,?, ?,?,?,?,?,?,
// ?,?,?,?,?,?,
// ?,?,?,?,?,
// ?,?,?,
// ?,?,?,?,?,?,?,?,?)`,
//                 [
//                     order_id,
//                     ware_receipt_no || null,
//                     1,
//                     express_no || null,
//                     supplier_contact || null,
//                     total_dimension || 0,
//                     total_weight || 0,
//                     warehousing_date || null,
//                     supplier_id || 0,
//                     added_by || 1,
//                     courier_waybill_ref || null,
//                     date_entry_created || null,
//                     dispatched_date || null,
//                     calculatedDays || 0,
//                     warehouse_comment || null,

//                     customer_ref || null,
//                     box_marking || null,
//                     package_type || null,
//                     hazardous || null,
//                     total_packeges || null,
//                     hazard_description || null,
//                     package_comment || null,

//                     damage_goods || null,
//                     damaged_pkg_qty || null,
//                     damage_packed || null,
//                     damage_comment || null,

//                     supplier_company || null,
//                     supplier_person || null,
//                     supplier_address || null,
//                     warehouse_order_id || null,
//                     warehouse_collect || null,
//                     costs_to_collect || null,
//                     warehouse_storage || null,
//                     warehouse_cost || null,
//                     handling_required || null,
//                     handling_cost || null,
//                     warehouse_dispatch || null,
//                     cost_to_dispatch || null
//                 ],
//                 (err, result) => {

//                     if (err) {
//                         console.error(err);
//                         return res.status(500).send({
//                             success: false,
//                             message: "Failed to assign order to warehouse"
//                         });
//                     }

//                     const warehouseId = result.insertId;

//                     const year = new Date().getFullYear();

//                     const warehouseNumber = `WH-${year}-${String(warehouseId).padStart(5, "0")}`;

//                     // update warehouse number
//                     con.query(
//                         `UPDATE warehouse_assign_order SET warehouse_number=? WHERE id=?`,
//                         [warehouseNumber, warehouseId],
//                         (err) => {

//                             if (err) {
//                                 console.error(err);
//                             }
//                             const saveFiles = (files, type) => {

//                                 if (!files.length) return;

//                                 const values = files.map(file => [
//                                     warehouseId,
//                                     type,
//                                     file.filename
//                                 ]);

//                                 con.query(
//                                     `INSERT INTO warehouse_files (warehouse_id, file_type, file_name) VALUES ?`,
//                                     [values],
//                                     (err) => {
//                                         if (err) console.error("File insert error:", err);
//                                     }
//                                 );
//                             };
//                             saveFiles(productImages, "product");
//                             saveFiles(damageImages, "damage");
//                             saveFiles(documents, "document");
//                             return res.status(200).send({
//                                 success: true,
//                                 message: "Order created and added to warehouse successfully",
//                                 order_id,
//                                 warehouse_number: warehouseNumber
//                             });
//                         }
//                     );
//                 }
//             );
//         });
// };


const createOrderAndWarehouse = (req, res) => {
    const {
        supplier_id,
        warehouse_id,
        warehouse_order_id,
        courier_waybill_ref,
        dispatch_date,
        date_received,

        customer_name,
        customer_ref,
        destination_country,
        collection_from,
        box_marking,
        goods_description,
        package_type,
        hazardous,
        hazard_description,
        total_packages,
        total_cbm,
        total_weight,
        package_comment,

        damaged_goods,
        damaged_pkg_qty,
        damage_comment,

        supplier_company,
        supplier_person,
        supplier_contact,
        supplier_address,

        warehouse_collect,
        costs_to_collect,
        warehouse_storage,
        warehouse_cost,
        handling_required,
        handling_cost,
        warehouse_dispatch,
        cost_to_dispatch,

        warehouse_comment,
        added_by
    } = req.body;
    console.log(req.body)

    const productImages = req.files?.product_images || [];
    const damageImages = req.files?.damage_images || [];
    const documents = req.files?.documents || [];

    const sql = `
        INSERT INTO supplier_warehouse_orders (supplier_id,
            warehouse_id, warehouse_order_id, courier_waybill_ref, dispatch_date, date_received,

            customer_name, customer_ref, destination_country, collection_from,
            box_marking, goods_description, package_type,
            hazardous, hazard_description, total_packages,
            total_cbm, total_weight, package_comment,

            damaged_goods, damaged_pkg_qty, damage_comment,

            supplier_company, supplier_person, supplier_contact, supplier_address,

            warehouse_collect, costs_to_collect,
            warehouse_storage, warehouse_cost,
            handling_required, handling_cost,
            warehouse_dispatch, cost_to_dispatch,
            warehouse_comment, added_by
        )
        VALUES (?,?,?,?,?,?,?,
                ?,?,?,?, ?,?,
                ?,?,?,?,
                ?,?,?,
                ?,?,?,
                ?,?,?,
                ?,?, ?,?,
                ?,?,?,?,
                ?,?)
    `;
    const values = [
        supplier_id,
        warehouse_id || null,
        warehouse_order_id || null,
        courier_waybill_ref || null,
        dispatch_date || null,
        date_received || null,
        customer_name || null,
        customer_ref || null,
        destination_country || null,
        collection_from || null,
        box_marking || null,
        goods_description || null,
        package_type || null,
        hazardous || 0,
        hazard_description || null,
        total_packages || 0,
        total_cbm || 0,
        total_weight || 0,
        package_comment || null,

        damaged_goods || 0,
        damaged_pkg_qty || 0,
        damage_comment || null,

        supplier_company || null,
        supplier_person || null,
        supplier_contact || null,
        supplier_address || null,

        warehouse_collect || 0,
        costs_to_collect || 0,
        warehouse_storage || 0,
        warehouse_cost || 0,
        handling_required || 0,
        handling_cost || 0,
        warehouse_dispatch || 0,
        cost_to_dispatch || 0,

        warehouse_comment || null,
        added_by || 1
    ];

    con.query(sql, values, (err, result) => {

        if (err) {
            console.error(err);
            return res.status(500).json({
                success: false,
                message: "Insert failed"
            });
        }

        const id = result.insertId;

        // //  Generate Warehouse Number
        // const year = new Date().getFullYear();
        // const warehouseNumber = `WH-${year}-${String(id).padStart(5, "0")}`;

        // con.query(
        //     `UPDATE supplier_warehouse_orders SET warehouse_number=? WHERE id=?`,
        //     [warehouseNumber, id]
        // );

        //  Save Files
        const saveFiles = (files, type) => {
            if (!files.length) return;

            const values = files.map(file => [
                id,
                type,
                file.filename
            ]);

            con.query(
                `INSERT INTO supplier_warehouse_files 
                (supplier_warehouse_id, file_type, file_name) VALUES ?`,
                [values]
            );
        };

        saveFiles(productImages, "product");
        saveFiles(damageImages, "damage");
        saveFiles(documents, "document");

        const warehouse_order_id = result.insertId;

        const productSql = `
    INSERT INTO supplier_warehouse_products (
        supplier_warehouse_id,
        product_description,
        hazardous,
        date_received,
        package_type,
        packages,
        dimension,
        weight,
       date_dispatched,
        supplier_address,
        warehouse_collect,
        costs_to_collect,
        added_by,
        warehouse_cost
    )
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`;

        const productValues = [
            warehouse_order_id, // link with order
            goods_description || null,
            hazardous || 0,
            date_received || null,
            package_type || null,
            total_packages || 0,
            total_cbm || null,
            total_weight || 0,
            dispatch_date || null,
            supplier_address || null,
            warehouse_collect || null,
            costs_to_collect || null,
            added_by || 1,
            warehouse_cost || null
        ];

        con.query(productSql, productValues, (err) => {
            if (err) {
                console.error("Product insert error:", err);
            }
        });

        return res.status(200).json({
            success: true,
            message: "Supplier warehouse order created",
            id
        });
    });
};

// const updateOrderAndWarehouse = (req, res) => {

//     const {
//         order_id,
//         goods_description,
//         ware_receipt_no,
//         total_dimension,
//         total_weight,
//         cartons,
//         express_no,
//         supplier_contact_no,
//         CBM,
//         warehousing_date,
//         collection_from,
//         delivery_to,
//         client_name,
//         supplier_id,
//         freight,

//         courier_waybill_ref,
//         date_entry_created,
//         dispatched_date,
//         days_in_warehouse,

//         customer_ref,
//         box_marking,
//         package_type,
//         hazardous,
//         total_packeges,
//         hazard_description,
//         package_comment,

//         damage_goods,
//         damaged_pkg_qty,
//         damage_packed,
//         damage_comment,

//         supplier_company,
//         supplier_person,
//         supplier_address,
//         warehouse_order_id,

//         warehouse_collect,
//         costs_to_collect,
//         warehouse_storage,
//         warehouse_cost,
//         handling_required,
//         handling_cost,
//         warehouse_dispatch,
//         cost_to_dispatch,
//         warehouse_comment,
//         added_by

//     } = req.body;

//     const productImages = req.files?.product_images || [];
//     const damageImages = req.files?.damage_images || [];
//     const documents = req.files?.documents || [];

//     if (!order_id) {
//         return res.status(400).send({
//             success: false,
//             message: "Order ID is required"
//         });
//     }

//     if (!supplier_id) {
//         return res.status(400).send({
//             success: false,
//             message: "Supplier ID is required"
//         });
//     }

//     // =========================
//     // CHECK ORDER
//     // =========================

//     con.query(
//         `SELECT id FROM tbl_orders WHERE id=?`,
//         [order_id],
//         (err, result) => {

//             if (err) {
//                 console.error(err);
//                 return res.status(500).send({ success: false, message: "DB error" });
//             }

//             if (result.length === 0) {
//                 return res.status(404).send({
//                     success: false,
//                     message: "Order not found"
//                 });
//             }

//             // =========================
//             // UPDATE ORDER
//             // =========================

//             con.query(
//                 `UPDATE tbl_orders SET
//                 goods_description=?,
//                 dimensions=?,
//                 weight=?,
//                 cartons=?,
//                 CBM=?,
//                 collection_from=?,
//                 delivery_to=?,
//                 client_name=?,
//                 supplier_id=?,
//                 freight_type=?,
//                 added_by=?
//                 WHERE id=?`,
//                 [
//                     goods_description || null,
//                     total_dimension || null,
//                     total_weight || null,
//                     cartons || 0,
//                     CBM || null,
//                     collection_from || 0,
//                     delivery_to || 0,
//                     client_name || null,
//                     supplier_id,
//                     freight || null,
//                     added_by || 1,
//                     order_id
//                 ],
//                 (err) => {

//                     if (err) {
//                         console.error(err);
//                         return res.status(500).send({
//                             success: false,
//                             message: "Order update failed"
//                         });
//                     }

//                     // =========================
//                     // GET WAREHOUSE ID
//                     // =========================

//                     con.query(
//                         `SELECT id FROM warehouse_assign_order WHERE order_id=?`,
//                         [order_id],
//                         (err, warehouse) => {

//                             if (err) {
//                                 console.error(err);
//                                 return res.status(500).send({
//                                     success: false,
//                                     message: "Warehouse lookup error"
//                                 });
//                             }

//                             let warehouseId;

//                             // =========================
//                             // UPDATE WAREHOUSE
//                             // =========================

//                             if (warehouse.length) {

//                                 warehouseId = warehouse[0].id;

//                                 con.query(
//                                     `UPDATE warehouse_assign_order SET
//                                     ware_receipt_no=?,
//                                     express_no=?,
//                                     supplier_contact_no=?,
//                                     total_dimension=?,
//                                     total_weight=?,
//                                     warehousing_date=?,
//                                     supplier_id=?,
//                                     courier_waybill_ref=?,
//                                     date_entry_created=?,
//                                     dispatched_date=?,
//                                     days_in_warehouse=?,
//                                     warehouse_comment=?,
//                                     customer_ref=?,
//                                     box_marking=?,
//                                     package_type=?,
//                                     hazardous=?,
//                                     total_packeges=?,
//                                     hazard_description=?,
//                                     package_comment=?,
//                                     damage_goods=?,
//                                     damaged_pkg_qty=?,
//                                     damage_packed=?,
//                                     damage_comment=?,
//                                     supplier_company=?,
//                                     supplier_person=?,
//                                     supplier_address=?,
//                                     warehouse_order_id=?,
//                                     warehouse_collect=?,
//                                     costs_to_collect=?,
//                                     warehouse_storage=?,
//                                     warehouse_cost=?,
//                                     handling_required=?,
//                                     handling_cost=?,
//                                     warehouse_dispatch=?,
//                                     cost_to_dispatch=?,
//                                     added_by=?
//                                     WHERE order_id=?`,
//                                     [
//                                         ware_receipt_no,
//                                         express_no,
//                                         supplier_contact_no,
//                                         total_dimension,
//                                         total_weight,
//                                         warehousing_date,
//                                         supplier_id,
//                                         courier_waybill_ref,
//                                         date_entry_created,
//                                         dispatched_date,
//                                         days_in_warehouse,
//                                         warehouse_comment,
//                                         customer_ref,
//                                         box_marking,
//                                         package_type,
//                                         hazardous,
//                                         total_packeges,
//                                         hazard_description,
//                                         package_comment,
//                                         damage_goods,
//                                         damaged_pkg_qty,
//                                         damage_packed,
//                                         damage_comment,
//                                         supplier_company,
//                                         supplier_person,
//                                         supplier_address,
//                                         warehouse_order_id,
//                                         warehouse_collect,
//                                         costs_to_collect,
//                                         warehouse_storage,
//                                         warehouse_cost,
//                                         handling_required,
//                                         handling_cost,
//                                         warehouse_dispatch,
//                                         cost_to_dispatch,
//                                         added_by,
//                                         order_id
//                                     ],
//                                     (err) => {

//                                         if (err) {
//                                             console.error(err);
//                                             return res.status(500).send({
//                                                 success: false,
//                                                 message: "Warehouse update failed"
//                                             });
//                                         }

//                                         saveWarehouseFiles(warehouseId);
//                                     }
//                                 );

//                             } else {

//                                 // CREATE warehouse if not exists

//                                 con.query(
//                                     `INSERT INTO warehouse_assign_order
//                                     (order_id,warehouse_status,supplier_id,added_by)
//                                     VALUES (?,?,?,?)`,
//                                     [order_id, 1, supplier_id, 2],
//                                     (err, result) => {

//                                         if (err) {
//                                             console.error(err);
//                                             return res.status(500).send({
//                                                 success: false,
//                                                 message: "Warehouse create failed"
//                                             });
//                                         }

//                                         warehouseId = result.insertId;

//                                         saveWarehouseFiles(warehouseId);
//                                     }
//                                 );

//                             }

//                             // =========================
//                             // SAVE FILES
//                             // =========================

//                             const saveWarehouseFiles = (warehouseId) => {

//                                 const saveFiles = (files, type) => {

//                                     if (!files.length) return;

//                                     const values = files.map(file => [
//                                         warehouseId,
//                                         type,
//                                         file.filename
//                                     ]);

//                                     con.query(
//                                         `INSERT INTO warehouse_files
//                                         (warehouse_id,file_type,file_name)
//                                         VALUES ?`,
//                                         [values],
//                                         (err) => {
//                                             if (err) {
//                                                 console.error("File save error:", err);
//                                             }
//                                         }
//                                     );

//                                 }

//                                 saveFiles(productImages, "product");
//                                 saveFiles(damageImages, "damage");
//                                 saveFiles(documents, "document");

//                                 return res.status(200).send({
//                                     success: true,
//                                     message: "Order & warehouse updated successfully"
//                                 });

//                             }

//                         }
//                     );

//                 }
//             );

//         }
//     );

// };

const updateOrderAndWarehouse = (req, res) => {
    const {
        id,

        warehouse_order_id,
        courier_waybill_ref,
        dispatch_date,
        date_received,

        customer_name,
        customer_ref,
        destination_country,
        collection_from,
        box_marking,
        goods_description,
        package_type,
        hazardous,
        hazard_description,
        total_packages,
        total_cbm,
        total_weight,
        package_comment,

        damaged_goods,
        damaged_pkg_qty,
        damage_comment,

        supplier_company,
        supplier_person,
        supplier_contact,
        supplier_address,

        warehouse_collect,
        costs_to_collect,
        warehouse_storage,
        warehouse_cost,
        handling_required,
        handling_cost,
        warehouse_dispatch,
        cost_to_dispatch,

        warehouse_comment,
        added_by

    } = req.body;

    const productImages = req.files?.product_images || [];
    const damageImages = req.files?.damage_images || [];
    const documents = req.files?.documents || [];

    // Check ID
    if (!id) {
        return res.status(400).json({
            success: false,
            message: "ID is required"
        });
    }

    if (date_received && dispatch_date) {
        const start = new Date(date_received);
        const end = new Date(dispatch_date);

        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);

        if (end < start) {
            return res.status(400).json({
                success: false,
                message: "Dispatch date cannot be before received date"
            });
        }

        const diff = end - start;
        days = Math.floor(diff / (1000 * 60 * 60 * 24));
    }
    // =========================
    // CHECK RECORD
    // =========================
    con.query(
        `SELECT id FROM supplier_warehouse_orders WHERE id=?`,
        [id],
        (err, result) => {

            if (err) {
                console.error(err);
                return res.status(500).json({ success: false, message: "DB error" });
            }

            if (result.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Record not found"
                });
            }

            // =========================
            // UPDATE MAIN TABLE
            // =========================
            const sql = `
                UPDATE supplier_warehouse_orders SET
                warehouse_order_id=?,
                courier_waybill_ref=?,
                dispatch_date=?,
                date_received=?,

                customer_name=?,
                customer_ref=?,
                destination_country=?,
                collection_from=?,
                box_marking=?,
                goods_description=?,
                package_type=?,
                hazardous=?,
                hazard_description=?,
                total_packages=?,
                total_cbm=?,
                total_weight=?,
                package_comment=?,

                damaged_goods=?,
                damaged_pkg_qty=?,
                damage_comment=?,

                supplier_company=?,
                supplier_person=?,
                supplier_contact=?,
                supplier_address=?,

                warehouse_collect=?,
                costs_to_collect=?,
                warehouse_storage=?,
                warehouse_cost=?,
                handling_required=?,
                handling_cost=?,
                warehouse_dispatch=?,
                cost_to_dispatch=?,

                warehouse_comment=?,
                added_by=?
                WHERE id=?
            `;

            const values = [
                warehouse_order_id || null,
                courier_waybill_ref || null,
                dispatch_date || null,
                date_received || null,
                customer_name || null,
                customer_ref || null,
                destination_country || null,
                collection_from || null,
                box_marking || null,
                goods_description || null,
                package_type || null,
                hazardous || 0,
                hazard_description || null,
                total_packages || 0,
                total_cbm || 0,
                total_weight || 0,
                package_comment || null,

                damaged_goods || 0,
                damaged_pkg_qty || 0,
                damage_comment || null,

                supplier_company || null,
                supplier_person || null,
                supplier_contact || null,
                supplier_address || null,

                warehouse_collect || 0,
                costs_to_collect || 0,
                warehouse_storage || 0,
                warehouse_cost || 0,
                handling_required || 0,
                handling_cost || 0,
                warehouse_dispatch || 0,
                cost_to_dispatch || 0,

                warehouse_comment || null,
                added_by || 1,
                id
            ];

            con.query(sql, values, (err) => {

                if (err) {
                    console.error(err);
                    return res.status(500).json({
                        success: false,
                        message: "Update failed"
                    });
                }

                // =========================
                // SAVE FILES
                // =========================
                const saveFiles = (files, type) => {

                    if (!files.length) return;

                    const values = files.map(file => [
                        id,
                        type,
                        file.filename
                    ]);

                    con.query(
                        `INSERT INTO supplier_warehouse_files 
                        (supplier_warehouse_id, file_type, file_name) VALUES ?`,
                        [values],
                        (err) => {
                            if (err) console.error("File save error:", err);
                        }
                    );
                };

                saveFiles(productImages, "product");
                saveFiles(damageImages, "damage");
                saveFiles(documents, "document");

                return res.status(200).json({
                    success: true,
                    message: "Supplier warehouse order updated successfully"
                });
            });
        }
    );
};

// const GetSupplierCreatedWarehouseOrders = (req, res) => {
//     try {
//         const { supplier_id, warehouse_status, page = 1, limit = 10 } = req.query;

//         const offset = (page - 1) * limit;

//         let whereClause = `WHERE o.added_by=${2}`;   // allows easy AND conditions
//         let queryParams = [];

//         if (supplier_id) {
//             whereClause += ` AND o.supplier_id = ?`;
//             queryParams.push(supplier_id);
//         }

//         if (warehouse_status !== undefined) {
//             whereClause += ` AND w.warehouse_status = ?`;
//             queryParams.push(warehouse_status);
//         }


//         const query = `
//             SELECT
//                 o.id AS order_id,
//                 o.goods_description,
//                 o.dimensions,
//                 o.weight,
//                 o.cartons,
//                 o.CBM,
//                 o.collection_from,
//                 o.delivery_to,
//                 o.client_name,
//                 o.freight_type,
//                 o.created_at,
//                 c.name AS delivery_to_name,
//                 co.name AS collection_from_name,
//                 w.id AS warehouse_id,
//                 w.ware_receipt_no,
//                 w.express_no,
//                 w.supplier_contact_no,
//                 w.total_dimension,
//                 w.total_weight,
//                 w.warehousing_date,
//                 w.warehouse_status

//             FROM tbl_orders o
//             INNER JOIN warehouse_assign_order w
//                 ON o.id = w.order_id
//             LEFT JOIN countries AS c
//                 ON c.id = o.delivery_to

//             LEFT JOIN countries AS co
//                 ON co.id = o.collection_from
//             ${whereClause}
//             ORDER BY o.id DESC
//             LIMIT ? OFFSET ?
//         `;

//         queryParams.push(parseInt(limit), parseInt(offset));

//         con.query(query, queryParams, (err, results) => {
//             if (err) {
//                 console.error(err);
//                 return res.status(500).json({
//                     success: false,
//                     message: "Failed to fetch warehouse orders"
//                 });
//             }

//             return res.status(200).json({
//                 success: true,
//                 count: results.length,
//                 page: parseInt(page),
//                 limit: parseInt(limit),
//                 data: results
//             });
//         });

//     } catch (err) {
//         res.status(500).json({
//             success: false,
//             message: err.message
//         });
//     }
// };


//================= FACILITIES MANAGEMENT ==================//

//================= Customs Clearing Agent ================= // 

// const GetSupplierCreatedWarehouseOrders = async (req, res) => {
//     try {

//         const {
//             supplier_id,
//             warehouse_status,
//             user_id,
//             page = 1,
//             limit = 10
//         } = req.query;

//         const pageNo = Number(page);
//         const pageSize = Number(limit);
//         const offset = (pageNo - 1) * pageSize;

//         const ALL_ACCESS_USERS = [1, 19855];

//         let whereClause = `WHERE o.added_by = 2`;
//         let queryParams = [];

//         /* SUPPLIER FILTER */
//         if (supplier_id) {
//             whereClause += ` AND o.supplier_id = ?`;
//             queryParams.push(supplier_id);
//         }

//         if (warehouse_status !== undefined) {
//             whereClause += ` AND w.warehouse_status = ?`;
//             queryParams.push(warehouse_status);
//         }

//         /* ACCESS COUNTRY LOGIC */

//         let accessCountries = [];

//         if (!ALL_ACCESS_USERS.includes(Number(user_id))) {

//             const userRows = await new Promise((resolve, reject) => {

//                 con.query(
//                     `SELECT access_country FROM tbl_users WHERE id=? AND is_deleted=0`,
//                     [user_id],
//                     (err, rows) => {

//                         if (err) return reject(err);
//                         resolve(rows);

//                     }
//                 );

//             });

//             if (userRows.length && userRows[0].access_country) {

//                 accessCountries = userRows[0].access_country
//                     .split(',')
//                     .map(id => Number(id.trim()));

//             }

//             if (accessCountries.length) {

//                 const placeholders = accessCountries.map(() => '?').join(',');

//                 whereClause += `
//                     AND (
//                         o.collection_from IN (${placeholders})
//                         OR o.delivery_to IN (${placeholders})
//                     )
//                 `;

//                 queryParams.push(...accessCountries, ...accessCountries);

//             }

//         }

//         /* COUNT QUERY */

//         const countQuery = `
//             SELECT COUNT(DISTINCT o.id) AS total
//             FROM tbl_orders o
//             INNER JOIN warehouse_assign_order w 
//                 ON o.id = w.order_id
//             ${whereClause}
//         `;

//         const totalResult = await new Promise((resolve, reject) => {

//             con.query(countQuery, queryParams, (err, rows) => {

//                 if (err) return reject(err);
//                 resolve(rows);

//             });

//         });

//         const total = totalResult[0]?.total || 0;

//         /* MAIN DATA QUERY */

//         const query = `
//             SELECT
//                 o.id AS order_id,
//                 o.goods_description,
//                 o.dimensions,
//                 o.weight,
//                 o.cartons,
//                 o.CBM,
//                 o.collection_from,
//                 o.delivery_to,
//                 o.client_name,
//                 o.freight_type,
//                 o.created_at,

//                 c.name AS delivery_to_name,
//                 co.name AS collection_from_name,

//                 w.id AS warehouse_id,
//                 w.ware_receipt_no,
//                 w.express_no,
//                 w.supplier_contact_no,
//                 w.total_dimension,
//                 w.total_weight,
//                 w.warehousing_date,
//                 w.warehouse_status,
//                 w.warehouse_number,

//                 w.courier_waybill_ref,
//                 w.date_entry_created,
//                 w.dispatched_date,
//                 w.days_in_warehouse,

//                 w.customer_ref,
//                 w.box_marking,
//                 w.package_type,
//                 w.hazardous,
//                 w.total_packeges,
//                 w.hazard_description,
//                 w.package_comment,

//                 w.damage_goods,
//                 w.damaged_pkg_qty,
//                 w.damage_packed,
//                 w.damage_comment,

//                 w.supplier_company,
//                 w.supplier_person,
//                 w.supplier_address,
//                 w.warehouse_order_id,

//                 w.warehouse_collect,
//                 w.costs_to_collect,
//                 w.warehouse_storage,
//                 w.warehouse_cost,
//                 w.handling_required,
//                 w.handling_cost,
//                 w.warehouse_dispatch,
//                 w.cost_to_dispatch,
//                 w.warehouse_comment,

//                 wp.id AS product_id,
//                 wp.product_description,
//                 wp.Hazardous,
//                 wp.date_received,
//                 wp.package_type,
//                 wp.packages,
//                 wp.dimension AS product_dimension,
//                 wp.weight AS product_weight,
//                 wp.warehouse_ref,
//                 wp.freight,
//                 wp.groupage_batch_ref,
//                 wp.warehouse_receipt_number,
//                 wp.tracking_number,
//                 wp.date_dspatched,

//                 wf.id AS file_id,
//                 wf.file_type,
//                 wf.file_name

//             FROM tbl_orders o

//             INNER JOIN warehouse_assign_order w
//                 ON o.id = w.order_id

//             LEFT JOIN warehouse_products wp
//                 ON wp.warehouse_order_id = w.id

//             LEFT JOIN warehouse_files wf
//                 ON wf.warehouse_id = w.id

//             LEFT JOIN countries c
//                 ON c.id = o.delivery_to

//             LEFT JOIN countries co
//                 ON co.id = o.collection_from

//             ${whereClause}

//             ORDER BY o.id DESC
//             LIMIT ? OFFSET ?
//         `;

//         const dataParams = [...queryParams, pageSize, offset];

//         const rows = await new Promise((resolve, reject) => {

//             con.query(query, dataParams, (err, rows) => {

//                 if (err) return reject(err);
//                 resolve(rows);

//             });

//         });

//         /* GROUPING */

//         const ordersMap = {};

//         rows.forEach(row => {

//             if (!ordersMap[row.order_id]) {

//                 ordersMap[row.order_id] = {

//                     order_id: row.order_id,
//                     goods_description: row.goods_description,
//                     dimensions: row.dimensions,
//                     weight: row.weight,
//                     cartons: row.cartons,
//                     CBM: row.CBM,
//                     collection_from: row.collection_from,
//                     delivery_to: row.delivery_to,
//                     client_name: row.client_name,
//                     freight_type: row.freight_type,
//                     created_at: row.created_at,

//                     delivery_to_name: row.delivery_to_name,
//                     collection_from_name: row.collection_from_name,

//                     warehouse_id: row.warehouse_id,
//                     warehouse_number: row.warehouse_number,
//                     ware_receipt_no: row.ware_receipt_no,
//                     express_no: row.express_no,
//                     supplier_contact_no: row.supplier_contact_no,
//                     total_dimension: row.total_dimension,
//                     total_weight: row.total_weight,
//                     warehousing_date: row.warehousing_date,
//                     warehouse_status: row.warehouse_status,

//                     courier_waybill_ref: row.courier_waybill_ref,
//                     date_entry_created: row.date_entry_created,
//                     dispatched_date: row.dispatched_date,
//                     days_in_warehouse: row.days_in_warehouse,

//                     customer_ref: row.customer_ref,
//                     box_marking: row.box_marking,
//                     package_type: row.package_type,
//                     hazardous: row.hazardous,
//                     total_packeges: row.total_packeges,
//                     hazard_description: row.hazard_description,
//                     package_comment: row.package_comment,

//                     damage_goods: row.damage_goods,
//                     damaged_pkg_qty: row.damaged_pkg_qty,
//                     damage_packed: row.damage_packed,
//                     damage_comment: row.damage_comment,

//                     supplier_company: row.supplier_company,
//                     supplier_person: row.supplier_person,
//                     supplier_address: row.supplier_address,
//                     warehouse_order_id: row.warehouse_order_id,

//                     warehouse_collect: row.warehouse_collect,
//                     costs_to_collect: row.costs_to_collect,
//                     warehouse_storage: row.warehouse_storage,
//                     warehouse_cost: row.warehouse_cost,
//                     handling_required: row.handling_required,
//                     handling_cost: row.handling_cost,
//                     warehouse_dispatch: row.warehouse_dispatch,
//                     cost_to_dispatch: row.cost_to_dispatch,
//                     warehouse_comment: row.warehouse_comment,


//                     products: [],
//                     files: []

//                 };

//             }

//             /* PRODUCTS */

//             if (row.product_id) {

//                 ordersMap[row.order_id].products.push({

//                     id: row.product_id,
//                     product_description: row.product_description,
//                     Hazardous: row.Hazardous,
//                     date_received: row.date_received,
//                     package_type: row.package_type,
//                     packages: row.packages,
//                     dimension: row.product_dimension,
//                     weight: row.product_weight,
//                     warehouse_ref: row.warehouse_ref,
//                     freight: row.freight,
//                     groupage_batch_ref: row.groupage_batch_ref,
//                     warehouse_receipt_number: row.warehouse_receipt_number,
//                     tracking_number: row.tracking_number,
//                     date_dspatched: row.date_dspatched

//                 });

//             }

//             /* FILES */

//             if (row.file_id) {

//                 ordersMap[row.order_id].files.push({

//                     id: row.file_id,
//                     type: row.file_type,
//                     file: row.file_name

//                 });

//             }

//         });

//         return res.status(200).json({

//             success: true,
//             total,
//             page: pageNo,
//             limit: pageSize,
//             data: Object.values(ordersMap)

//         });

//     } catch (err) {

//         return res.status(500).json({
//             success: false,
//             message: err.message
//         });

//     }
// };

// const GetSupplierCreatedWarehouseOrders = async (req, res) => {
//     try {
//         const {
//             supplier_id,
//             page = 1,
//             limit = 10
//         } = req.body;

//         const pageNo = Number(page);
//         const pageSize = Number(limit);
//         const offset = (pageNo - 1) * pageSize;

//         // Build WHERE clause dynamically
//         let whereClause = `WHERE 1=1`;
//         let queryParams = [];

//         if (supplier_id) {
//             whereClause += ` AND s.supplier_id = ?`;
//             queryParams.push(supplier_id);
//         }

//         // COUNT query for total records
//         const countQuery = `
//             SELECT COUNT(*) AS total
//             FROM supplier_warehouse_orders s
//             ${whereClause}
//         `;

//         const totalResult = await new Promise((resolve, reject) => {
//             con.query(countQuery, queryParams, (err, rows) => {
//                 if (err) return reject(err);
//                 resolve(rows);
//             });
//         });

//         const total = totalResult[0]?.total || 0;

//         // MAIN QUERY
//         const query = `
//             SELECT 
//                 s.*,
//                CASE 
//   WHEN s.date_received IS NULL THEN 0

//   WHEN b.date_dispatch IS NOT NULL 
//     THEN GREATEST(DATEDIFF(b.date_dispatch, s.date_received), 0)

//   WHEN s.dispatch_date IS NOT NULL 
//     THEN GREATEST(DATEDIFF(s.dispatch_date, s.date_received), 0)

//   ELSE 
//     GREATEST(DATEDIFF(CURDATE(), s.date_received), 0)

// END AS days_in_warehouse,
//                 c.name AS destination_country_name,
//                 cd.name AS collection_country_name,
//                 w.warehouse_name,
//                 w.warehouse_number,
//                 f.id AS file_id,
//                 f.file_type,
//                 f.file_name,
//                 su.name as supplier_name,
//                 o.order_number
//             FROM supplier_warehouse_orders s
//             LEFT JOIN countries c ON c.id = s.destination_country
//             LEFT JOIN countries cd ON cd.id = s.collection_from
//             LEFT JOIN warehouse_tbl w ON w.id = s.warehouse_id
//             LEFT JOIN supplier_warehouse_files f ON f.supplier_warehouse_id = s.id
//             LEFT JOIN tbl_suppliers su ON su.id = s.supplier_id
//             LEFT JOIN tbl_orders o ON o.id = s.order_id
//             LEFT JOIN batches b ON b.id = s.batch_id
//             ${whereClause}
//             ORDER BY s.created_at DESC
//             LIMIT ? OFFSET ?
//         `;

//         const dataParams = [...queryParams, pageSize, offset];

//         const rows = await new Promise((resolve, reject) => {
//             con.query(query, dataParams, (err, rows) => {
//                 if (err) return reject(err);
//                 resolve(rows);
//             });
//         });

//         // Use Map to preserve order
//         const map = new Map();

//         rows.forEach(row => {
//             if (!map.has(row.id)) {
//                 map.set(row.id, {
//                     id: row.id,
//                     supplier_id: row.supplier_id,
//                     warehouse_id: row.warehouse_id,
//                     client_id: row.client_id,
//                     order_id: row.order_id,
//                     batch_id: row.batch_id,
//                     warehouse_name: row.warehouse_name,
//                     warehouse_number: row.warehouse_number,
//                     order_number: row.order_number,
//                     destination_country: row.destination_country,
//                     destination_country_name: row.destination_country_name,
//                     collection_from_name: row.collection_country_name,
//                     collection_from: row.collection_from,
//                     warehouse_order_id: row.warehouse_order_id,
//                     courier_waybill_ref: row.courier_waybill_ref,
//                     dispatch_date: row.dispatch_date,
//                     date_received: row.date_received,
//                     days_in_warehouse: row.days_in_warehouse,

//                     customer_name: row.customer_name,
//                     customer_ref: row.customer_ref,

//                     box_marking: row.box_marking,
//                     goods_description: row.goods_description,
//                     package_type: row.package_type,
//                     hazardous: row.hazardous,
//                     hazard_description: row.hazard_description,
//                     total_packages: row.total_packages,
//                     total_cbm: row.total_cbm,
//                     total_weight: row.total_weight,
//                     package_comment: row.package_comment,

//                     damaged_goods: row.damaged_goods,
//                     damaged_pkg_qty: row.damaged_pkg_qty,
//                     damage_comment: row.damage_comment,

//                     supplier_company: row.supplier_company,
//                     supplier_person: row.supplier_person,
//                     supplier_contact: row.supplier_contact,
//                     supplier_address: row.supplier_address,
//                     supplier_name: row.supplier_name,
//                     warehouse_collect: row.warehouse_collect,
//                     costs_to_collect: row.costs_to_collect,
//                     warehouse_storage: row.warehouse_storage,
//                     warehouse_cost: row.warehouse_cost,
//                     handling_required: row.handling_required,
//                     handling_cost: row.handling_cost,
//                     warehouse_dispatch: row.warehouse_dispatch,
//                     cost_to_dispatch: row.cost_to_dispatch,

//                     warehouse_comment: row.warehouse_comment,
//                     created_at: row.created_at,
//                     move_to_adminWarhouse: row.move_to_adminWarhouse,

//                     files: []
//                 });
//             }

//             // Push files if exist
//             if (row.file_id) {
//                 map.get(row.id).files.push({
//                     id: row.file_id,
//                     type: row.file_type,
//                     file: row.file_name
//                 });
//             }
//         });

//         return res.status(200).json({
//             success: true,
//             total,
//             page: pageNo,
//             limit: pageSize,
//             data: Array.from(map.values())
//         });

//     } catch (err) {
//         return res.status(500).json({
//             success: false,
//             message: err.message
//         });
//     }
// };

const GetSupplierCreatedWarehouseOrders = async (req, res) => {
    try {
        const {
            supplier_id,
            page = 1,
            limit = 10
        } = req.body;

        const pageNo = Number(page);
        const pageSize = Number(limit);
        const offset = (pageNo - 1) * pageSize;

        // =========================
        // WHERE CLAUSE
        // =========================
        let whereClause = `WHERE 1=1`;
        let queryParams = [];

        if (supplier_id) {
            whereClause += ` AND s.supplier_id = ?`;
            queryParams.push(supplier_id);
        }

        // =========================
        // COUNT QUERY
        // =========================
        const countQuery = `
            SELECT COUNT(*) AS total
            FROM supplier_warehouse_orders s
            ${whereClause}
        `;

        const totalResult = await new Promise((resolve, reject) => {
            con.query(countQuery, queryParams, (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });

        const total = totalResult[0]?.total || 0;

        // =========================
        // MAIN QUERY (NO FILE JOIN)
        // =========================
        const query = `
            SELECT 
                s.*,

                CASE 
                    WHEN s.date_received IS NULL THEN 0

                    WHEN b.date_dispatch IS NOT NULL 
                        THEN GREATEST(DATEDIFF(b.date_dispatch, s.date_received), 0)

                    WHEN s.dispatch_date IS NOT NULL 
                        THEN GREATEST(DATEDIFF(s.dispatch_date, s.date_received), 0)

                    ELSE 
                        GREATEST(DATEDIFF(CURDATE(), s.date_received), 0)
                END AS days_in_warehouse,

                c.name AS destination_country_name,
                cd.name AS collection_country_name,
                w.warehouse_name,
                w.warehouse_number,
                su.name as supplier_name,
                o.order_number,
               COALESCE(b.batch_number, '') AS batch_number

            FROM supplier_warehouse_orders s

            LEFT JOIN countries c ON c.id = s.destination_country
            LEFT JOIN countries cd ON cd.id = s.collection_from
            LEFT JOIN warehouse_tbl w ON w.id = s.warehouse_id
            LEFT JOIN tbl_suppliers su ON su.id = s.supplier_id
            LEFT JOIN tbl_orders o ON o.id = s.order_id
            LEFT JOIN batches b ON b.id = NULLIF(s.batch_id, 0)

            ${whereClause}

            ORDER BY s.created_at DESC
            LIMIT ? OFFSET ?
        `;

        const dataParams = [...queryParams, pageSize, offset];

        const rows = await new Promise((resolve, reject) => {
            con.query(query, dataParams, (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });

        // =========================
        // FETCH FILES SEPARATELY
        // =========================
        const ids = rows.map(r => r.id);

        let fileMap = new Map();

        if (ids.length > 0) {
            const fileQuery = `
                SELECT 
                    id,
                    supplier_warehouse_id,
                    file_type,
                    file_name
                FROM supplier_warehouse_files
                WHERE supplier_warehouse_id IN (?)
            `;

            const files = await new Promise((resolve, reject) => {
                con.query(fileQuery, [ids], (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows);
                });
            });

            files.forEach(file => {
                if (!fileMap.has(file.supplier_warehouse_id)) {
                    fileMap.set(file.supplier_warehouse_id, []);
                }

                fileMap.get(file.supplier_warehouse_id).push({
                    id: file.id,
                    type: file.file_type,
                    file: file.file_name
                });
            });
        }

        // =========================
        // FORMAT FINAL RESPONSE
        // =========================
        const result = rows.map(row => ({
            id: row.id,
            supplier_id: row.supplier_id,
            warehouse_id: row.warehouse_id,
            client_id: row.client_id,
            order_id: row.order_id,
            batch_id: row.batch_id,
            batch_number: row.batch_number || "",
            warehouse_name: row.warehouse_name,
            warehouse_number: row.warehouse_number,
            order_number: row.order_number,

            destination_country: row.destination_country,
            destination_country_name: row.destination_country_name,
            collection_from_name: row.collection_country_name,
            collection_from: row.collection_from,

            warehouse_order_id: row.warehouse_order_id,
            courier_waybill_ref: row.courier_waybill_ref,

            dispatch_date: row.dispatch_date,
            date_received: row.date_received,
            days_in_warehouse: row.days_in_warehouse,

            customer_name: row.customer_name,
            customer_ref: row.customer_ref,

            box_marking: row.box_marking,
            goods_description: row.goods_description,
            package_type: row.package_type,
            hazardous: row.hazardous,
            hazard_description: row.hazard_description,

            total_packages: row.total_packages,
            total_cbm: row.total_cbm,
            total_weight: row.total_weight,

            package_comment: row.package_comment,
            damaged_goods: row.damaged_goods,
            damaged_pkg_qty: row.damaged_pkg_qty,
            damage_comment: row.damage_comment,

            supplier_company: row.supplier_company,
            supplier_person: row.supplier_person,
            supplier_contact: row.supplier_contact,
            supplier_address: row.supplier_address,
            supplier_name: row.supplier_name,

            warehouse_collect: row.warehouse_collect,
            costs_to_collect: row.costs_to_collect,
            warehouse_storage: row.warehouse_storage,
            warehouse_cost: row.warehouse_cost,
            handling_required: row.handling_required,
            handling_cost: row.handling_cost,
            warehouse_dispatch: row.warehouse_dispatch,
            cost_to_dispatch: row.cost_to_dispatch,

            warehouse_comment: row.warehouse_comment,
            created_at: row.created_at,
            move_to_adminWarhouse: row.move_to_adminWarhouse,

            files: fileMap.get(row.id) || []
        }));

        // =========================
        // RESPONSE
        // =========================
        return res.status(200).json({
            success: true,
            total,
            page: pageNo,
            limit: pageSize,
            data: result
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

const addSupplierWarehouseProduct = async (req, res) => {
    try {
        const {
            supplier_warehouse_id,
            product_description,
            hazardous,
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
            date_dispatched,

            supplier_address,

            warehouse_collect,
            costs_to_collect,
            port_of_loading,

            warehouse_dispatch,
            warehouse_cost,
            cost_to_dispatch,

            waybill_ref,

            supplier_email,
            supplier_contact,

            added_by
        } = req.body;

        //  Validation
        if (!supplier_warehouse_id) {
            return res.status(400).json({
                success: false,
                message: "supplier_warehouse_id required"
            });
        }

        const sql = `
            INSERT INTO supplier_warehouse_products (
                supplier_warehouse_id,
                product_description, hazardous, date_received,
                package_type, packages, dimension, weight,

                warehouse_ref, freight, groupage_batch_ref,

                supplier, warehouse_receipt_number,
                tracking_number, date_dispatched,

                supplier_address,

                warehouse_collect, costs_to_collect,
                port_of_loading,

                warehouse_dispatch, warehouse_cost, cost_to_dispatch,

                waybill_ref,
                supplier_email, supplier_contact,

                added_by
            )
            VALUES (?,?,?,?,?,?,?,?,
                    ?,?,?,
                    ?,?,?,?,
                    ?,
                    ?,?,?,
                    ?,?,?,
                    ?,?,?,
                    ?)
        `;

        const values = [
            supplier_warehouse_id,

            product_description || null,
            hazardous || 0,
            date_received || null,

            package_type || null,
            packages || 0,
            dimension || null,
            weight || 0,

            warehouse_ref || null,
            freight || null,
            groupage_batch_ref || null,

            supplier || null,
            warehouse_receipt_number || null,
            tracking_number || null,
            date_dispatched || null,

            supplier_address || null,

            warehouse_collect || 0,
            costs_to_collect || 0,
            port_of_loading || null,

            warehouse_dispatch || 0,
            warehouse_cost || 0,
            cost_to_dispatch || 0,

            waybill_ref || null,
            supplier_email || null,
            supplier_contact || null,

            added_by || 1
        ];

        con.query(sql, values, (err, result) => {

            if (err) {
                console.error(err);
                return res.status(500).json({
                    success: false,
                    message: "Insert failed"
                });
            }

            return res.status(200).json({
                success: true,
                message: "Supplier warehouse product added",
                id: result.insertId
            });
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const updateSupplierWarehouseProduct = async (req, res) => {
    try {

        const {
            id, //  product id (IMPORTANT)
            product_description,
            hazardous,
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
            date_dispatched,

            supplier_address,

            warehouse_collect,
            costs_to_collect,
            port_of_loading,

            warehouse_dispatch,
            warehouse_cost,
            cost_to_dispatch,

            waybill_ref,

            supplier_email,
            supplier_contact,

            added_by
        } = req.body;

        //  Validation
        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Product id required"
            });
        }

        const sql = `
            UPDATE supplier_warehouse_products SET
                product_description=?,
                hazardous=?,
                date_received=?,

                package_type=?,
                packages=?,
                dimension=?,
                weight=?,

                warehouse_ref=?,
                freight=?,
                groupage_batch_ref=?,

                supplier=?,
                warehouse_receipt_number=?,
                tracking_number=?,
                date_dispatched=?,

                supplier_address=?,

                warehouse_collect=?,
                costs_to_collect=?,
                port_of_loading=?,

                warehouse_dispatch=?,
                warehouse_cost=?,
                cost_to_dispatch=?,

                waybill_ref=?,
                supplier_email=?,
                supplier_contact=?,

                added_by=?

            WHERE id=?
        `;

        const values = [
            product_description || null,
            hazardous || 0,
            date_received || null,

            package_type || null,
            packages || 0,
            dimension || null,
            weight || 0,

            warehouse_ref || null,
            freight || null,
            groupage_batch_ref || null,

            supplier || null,
            warehouse_receipt_number || null,
            tracking_number || null,
            date_dispatched || null,

            supplier_address || null,

            warehouse_collect || 0,
            costs_to_collect || 0,
            port_of_loading || null,

            warehouse_dispatch || 0,
            warehouse_cost || 0,
            cost_to_dispatch || 0,

            waybill_ref || null,
            supplier_email || null,
            supplier_contact || null,

            added_by || 1,

            id //  WHERE condition
        ];

        con.query(sql, values, (err, result) => {

            if (err) {
                console.error(err);
                return res.status(500).json({
                    success: false,
                    message: "Update failed"
                });
            }

            return res.status(200).json({
                success: true,
                message: "Supplier warehouse product updated"
            });
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getSupplierWarehouseProducts = async (req, res) => {
    try {

        const { supplier_warehouse_id } = req.query;

        if (!supplier_warehouse_id) {
            return res.status(400).json({
                success: false,
                message: "supplier_warehouse_id required"
            });
        }

        const sql = `
            SELECT 
                id,
                supplier_warehouse_id,

                product_description,
                hazardous,
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
                date_dispatched,

                supplier_address,

                warehouse_collect,
                costs_to_collect,
                port_of_loading,

                warehouse_dispatch,
                warehouse_cost,
                cost_to_dispatch,

                waybill_ref,
                supplier_email,
                supplier_contact,

                added_by,
                created_at

            FROM supplier_warehouse_products
            WHERE supplier_warehouse_id = ?
            ORDER BY id DESC
        `;

        con.query(sql, [supplier_warehouse_id], (err, rows) => {

            if (err) {
                console.error(err);
                return res.status(500).json({
                    success: false,
                    message: "Fetch failed"
                });
            }

            return res.status(200).json({
                success: true,
                total: rows.length,
                data: rows
            });

        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


const getSupplierWarehouses = async (req, res) => {
    try {

        const { supplier_id } = req.query;

        let whereClause = `WHERE 1=1`;
        let queryParams = [];

        //  Supplier filter
        if (supplier_id) {
            whereClause += ` AND w.supplier_id = ?`;
            queryParams.push(supplier_id);
        }

        // MAIN QUERY (NO PAGINATION)
        const query = `
            SELECT 
                w.id,
                w.warehouse_name,
                w.warehouse_number,
                w.country,
                c.name AS country_name

            FROM warehouse_tbl w

            LEFT JOIN countries c 
                ON c.id = w.country

            ${whereClause}

            ORDER BY w.warehouse_name ASC
        `;

        const rows = await new Promise((resolve, reject) => {
            con.query(query, queryParams, (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });

        return res.status(200).json({
            success: true,
            data: rows
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

const GetNotificationSupplier = async (req, res) => {
    try {
        const { supplier_id } = req.body;

        if (!supplier_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide supplier id"
            });
        }

        /* ===== HELPER: STRIP HTML TAGS (CKEditor FIX) ===== */
        const stripHtml = (html) => {
            if (!html) return "";
            return html.replace(/<[^>]*>/g, '').trim();
        };

        const getNotificationsSql = `
            SELECT 
                notification_details.*, 
                notification_details.user_id AS supplier_id, 
                tbl_notifications.title, 
                tbl_notifications.description,
                tbl_notifications.document
            FROM notification_details
            INNER JOIN tbl_notifications 
                ON notification_details.notification_id = tbl_notifications.id
            WHERE notification_details.user_id = ?
              AND notification_details.user_type = 2
              AND tbl_notifications.is_deleted = ?
              AND notification_details.is_deleted = ?
            ORDER BY notification_details.created_at DESC
        `;

        con.query(getNotificationsSql, [supplier_id, 0, 0], (err, results) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: err.message
                });
            }

            if (!results.length) {
                return res.status(200).json({
                    success: true,
                    message: "No notification found",
                    data: [],
                    unseenCount: 0
                });
            }

            /* ===== UNSEEN COUNT LOGIC ===== */
            let unseenCount = 0;
            let foundLastSeen = false;

            for (let i = results.length - 1; i >= 0; i--) {
                const notification = results[i];

                if (notification.is_seen === 1) {
                    foundLastSeen = true;
                    unseenCount = 0;
                } else if (foundLastSeen) {
                    unseenCount++;
                }
            }

            if (!foundLastSeen) {
                unseenCount = results.length;
            }

            /* ===== FORMAT RESPONSE ===== */
            const modifiedResults = results.map(notification => ({
                ...notification,
                description: stripHtml(notification.description), // 🔥 HTML REMOVED
                document: notification.document
                    ? notification.document.split(',').map(doc => doc.trim())
                    : []
            }));

            return res.status(200).json({
                success: true,
                message: "",
                data: modifiedResults,
                unseenCount
            });
        });

    } catch (error) {
        return res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

const addCustomsClearingAgent = (req, res) => {
    try {
        const { name, email, phone, address, contact, country_id } = req.body;

        if (!name || !email) {
            return res.status(400).json({
                success: false,
                message: "name and email are required"
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Invalid email format"
            });
        }

        const checkEmailQuery = `
            SELECT id 
            FROM tbl_customs_clearing_agents 
            WHERE email = ? AND is_deleted = 0
            LIMIT 1
        `;

        con.query(checkEmailQuery, [email], (checkErr, checkResult) => {
            if (checkErr) {
                return res.status(500).json({
                    success: false,
                    message: "Internal server error",
                    error: checkErr.message
                });
            }

            if (checkResult.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: "Email already exists"
                });
            }

            const insertQuery = `
                INSERT INTO tbl_customs_clearing_agents
                (name, email, phone, address, contact_person, country_id)
                VALUES (?, ?, ?, ?, ?, ?)
            `;

            con.query(
                insertQuery,
                [name, email, phone, address, contact, country_id],
                (err, result) => {
                    if (err) {
                        return res.status(500).json({
                            success: false,
                            message: "Internal server error",
                            error: err.message
                        });
                    }

                    res.status(200).json({
                        success: true,
                        message: "Customs Clearing Agent added successfully",
                        id: result.insertId
                    });
                }
            );
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getCustomsClearingAgents = (req, res) => {
    try {
        let { search, page, limit } = req.body;

        page = page ? parseInt(page) : 1;
        limit = limit ? parseInt(limit) : 10;
        const offset = (page - 1) * limit;

        let whereCondition = `WHERE cca.is_deleted = 0`;
        let searchParams = [];

        if (search) {
            whereCondition += `
                AND (
                    cca.name LIKE ?
                    OR cca.email LIKE ?
                    OR cca.phone LIKE ?
                    OR cca.contact_person LIKE ?
                    OR cca.address LIKE ?
                    OR c.name LIKE ?
                )
            `;
            const searchValue = `%${search}%`;
            searchParams.push(
                searchValue,
                searchValue,
                searchValue,
                searchValue,
                searchValue,
                searchValue
            );
        }

        /* ================= COUNT QUERY ================= */
        const countQuery = `
            SELECT COUNT(*) AS total
            FROM tbl_customs_clearing_agents cca
            LEFT JOIN countries c ON cca.country_id = c.id
            ${whereCondition}
        `;

        con.query(countQuery, searchParams, (countErr, countResult) => {
            if (countErr) {
                return res.status(500).json({
                    success: false,
                    message: "Internal server error",
                    error: countErr.message
                });
            }

            const totalRecords = countResult[0].total;
            const totalPages = Math.ceil(totalRecords / limit);

            /* ================= DATA QUERY ================= */
            const dataQuery = `
                SELECT
                    cca.id,
                    cca.name,
                    cca.email,
                    cca.phone,
                    cca.address,
                    cca.contact_person AS contact,
                    cca.country_id,
                    c.name AS country_name,
                    cca.created_at
                FROM tbl_customs_clearing_agents cca
                LEFT JOIN countries c ON cca.country_id = c.id
                ${whereCondition}
                ORDER BY cca.id DESC
                LIMIT ? OFFSET ?
            `;

            con.query(
                dataQuery,
                [...searchParams, limit, offset],
                (dataErr, results) => {
                    if (dataErr) {
                        return res.status(500).json({
                            success: false,
                            message: "Internal server error",
                            error: dataErr.message
                        });
                    }

                    return res.status(200).json({
                        success: true,
                        message: "Customs Clearing Agents fetched successfully",
                        data: results,
                        total_records: totalRecords,
                        total: totalPages,
                        page: page,
                        limit: limit
                    });
                }
            );
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getCustomsClearingAgentById = (req, res) => {
    try {
        const { id } = req.body;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "id is required"
            });
        }

        const query = `
            SELECT
            cca.*,
            c.name AS country_name
            FROM tbl_customs_clearing_agents cca
            LEFT JOIN countries c ON cca.country_id = c.id
            WHERE cca.id = ? AND cca.is_deleted = 0
        `;

        con.query(query, [id], (err, results) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "Internal server error",
                    error: err.message
                });
            }

            res.status(200).json({
                success: true,
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

const updateCustomsClearingAgent = (req, res) => {
    try {
        const { id, name, email, phone, address, contact, country_id } = req.body;
        console.log(req.body);
        if (!id || !name) {
            return res.status(400).json({
                success: false,
                message: "id and name are required"
            });
        }

        const query = `
            UPDATE tbl_customs_clearing_agents
            SET 
                name = ?,
                email = ?,
                phone = ?,
                address = ?,
                contact_person = ?,
                country_id = ?
            WHERE id = ? AND is_deleted = 0
        `;

        con.query(
            query,
            [name, email, phone, address, contact, country_id, id],
            (err, result) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: "Internal server error",
                        error: err.message
                    });
                }

                res.status(200).json({
                    success: true,
                    message: "Customs Clearing Agent updated successfully"
                });
            }
        );

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const deleteCustomsClearingAgent = (req, res) => {
    try {
        const { id } = req.body;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "id is required"
            });
        }

        const query = `
            UPDATE tbl_customs_clearing_agents
            SET is_deleted = 1
            WHERE id = ?
        `;

        con.query(query, [id], (err) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "Internal server error",
                    error: err.message
                });
            }

            res.status(200).json({
                success: true,
                message: "Customs Clearing Agent deleted successfully"
            });
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ================= Freight Forwarder ================= //

const addFreightForwarder = (req, res) => {
    try {
        const { name, email, phone, address, contact, country_id } = req.body;

        if (!name || !email) {
            return res.status(400).json({
                success: false,
                message: "name and email are required"
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Invalid email format"
            });
        }

        const checkEmail = `
            SELECT id FROM tbl_freight_forwarders
            WHERE email = ? AND is_deleted = 0 LIMIT 1
        `;

        con.query(checkEmail, [email], (e1, r1) => {
            if (e1) {
                return res.status(500).json({
                    success: false,
                    message: "Internal server error",
                    error: e1.message
                });
            }

            if (r1.length) {
                return res.status(409).json({
                    success: false,
                    message: "Email already exists"
                });
            }

            const insertQ = `
                INSERT INTO tbl_freight_forwarders
                (name, email, phone, address, contact_person, country_id)
                VALUES (?, ?, ?, ?, ?, ?)
            `;

            con.query(
                insertQ,
                [name, email, phone, address, contact, country_id],
                (e2, r2) => {
                    if (e2) {
                        return res.status(500).json({
                            success: false,
                            message: "Internal server error",
                            error: e2.message
                        });
                    }

                    res.status(200).json({
                        success: true,
                        message: "Freight Forwarder added successfully",
                        id: r2.insertId
                    });
                }
            );
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const getFreightForwarders = (req, res) => {
    try {
        let { search, page, limit } = req.body;

        page = page ? parseInt(page) : 1;
        limit = limit ? parseInt(limit) : 10;
        const offset = (page - 1) * limit;

        let whereCond = `WHERE ff.is_deleted = 0`;
        let params = [];

        if (search) {
            whereCond += `
                AND (
                    ff.name LIKE ?
                    OR ff.email LIKE ?
                    OR ff.phone LIKE ?
                    OR ff.contact_person LIKE ?
                    OR ff.address LIKE ?
                    OR c.name LIKE ?
                )
            `;
            const s = `%${search}%`;
            params.push(s, s, s, s, s, s);
        }

        const countQ = `
            SELECT COUNT(*) AS total
            FROM tbl_freight_forwarders ff
            LEFT JOIN countries c ON ff.country_id = c.id
            ${whereCond}
        `;

        con.query(countQ, params, (e1, r1) => {
            if (e1) {
                return res.status(500).json({
                    success: false,
                    message: "Internal server error",
                    error: e1.message
                });
            }

            const totalRecords = r1[0].total;
            const totalPages = Math.ceil(totalRecords / limit);

            const dataQ = `
                SELECT
                    ff.id,
                    ff.name,
                    ff.email,
                    ff.phone,
                    ff.address,
                    ff.contact_person AS contact,
                    ff.country_id,
                    c.name AS country_name,
                    ff.created_at
                FROM tbl_freight_forwarders ff
                LEFT JOIN countries c ON ff.country_id = c.id
                ${whereCond}
                ORDER BY ff.id DESC
                LIMIT ? OFFSET ?
            `;

            con.query(dataQ, [...params, limit, offset], (e2, rows) => {
                if (e2) {
                    return res.status(500).json({
                        success: false,
                        message: "Internal server error",
                        error: e2.message
                    });
                }

                res.status(200).json({
                    success: true,
                    message: "Freight Forwarders fetched successfully",
                    data: rows,
                    total_records: totalRecords,
                    total: totalPages,
                    page,
                    limit
                });
            });
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const getFreightForwarderById = (req, res) => {
    try {
        const { id } = req.body;

        if (!id) {
            return res.status(400).json({ success: false, message: "id is required" });
        }

        const q = `
            SELECT
                ff.*,
                c.name AS country_name
            FROM tbl_freight_forwarders ff
            LEFT JOIN countries c ON ff.country_id = c.id
            WHERE ff.id = ? AND ff.is_deleted = 0
        `;

        con.query(q, [id], (e, r) => {
            if (e) {
                return res.status(500).json({
                    success: false,
                    message: "Internal server error",
                    error: e.message
                });
            }

            res.status(200).json({
                success: true,
                data: r.length ? r[0] : null
            });
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const updateFreightForwarder = (req, res) => {
    try {
        const { id, name, email, phone, address, contact, country_id } = req.body;

        if (!id || !name || !email) {
            return res.status(400).json({
                success: false,
                message: "id, name and email are required"
            });
        }

        const q = `
            UPDATE tbl_freight_forwarders
            SET
                name = ?,
                email = ?,
                phone = ?,
                address = ?,
                contact_person = ?,
                country_id = ?
            WHERE id = ? AND is_deleted = 0
        `;

        con.query(
            q,
            [name, email, phone, address, contact, country_id, id],
            (e) => {
                if (e) {
                    return res.status(500).json({
                        success: false,
                        message: "Internal server error",
                        error: e.message
                    });
                }

                res.status(200).json({
                    success: true,
                    message: "Freight Forwarder updated successfully"
                });
            }
        );

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const deleteFreightForwarder = (req, res) => {
    try {
        const { id } = req.body;

        if (!id) {
            return res.status(400).json({ success: false, message: "id is required" });
        }

        const q = `
            UPDATE tbl_freight_forwarders
            SET is_deleted = 1
            WHERE id = ?
        `;

        con.query(q, [id], (e) => {
            if (e) {
                return res.status(500).json({
                    success: false,
                    message: "Internal server error",
                    error: e.message
                });
            }

            res.status(200).json({
                success: true,
                message: "Freight Forwarder deleted successfully"
            });
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};


// ============================= Shipping Line ======================= //

const addGroupageHandler = (req, res) => {
    try {
        const { name, email, phone, address, contact, country_id } = req.body;

        if (!name || !email) {
            return res.status(400).json({
                success: false,
                message: "name and email are required"
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Invalid email format"
            });
        }

        const checkEmail = `
            SELECT id FROM tbl_groupage_handlers
            WHERE email = ? AND is_deleted = 0
            LIMIT 1
        `;

        con.query(checkEmail, [email], (e1, r1) => {
            if (e1) {
                return res.status(500).json({
                    success: false,
                    message: "Internal server error",
                    error: e1.message
                });
            }

            if (r1.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: "Email already exists"
                });
            }

            const insertQ = `
                INSERT INTO tbl_groupage_handlers
                (name, email, phone, address, contact_person, country_id)
                VALUES (?, ?, ?, ?, ?, ?)
            `;

            con.query(
                insertQ,
                [name, email, phone, address, contact, country_id],
                (e2, r2) => {
                    if (e2) {
                        return res.status(500).json({
                            success: false,
                            message: "Internal server error",
                            error: e2.message
                        });
                    }

                    res.status(200).json({
                        success: true,
                        message: "Groupage Handler added successfully",
                        id: r2.insertId
                    });
                }
            );
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const getGroupageHandlers = (req, res) => {
    try {
        let { search, page, limit } = req.body;

        page = page ? parseInt(page) : 1;
        limit = limit ? parseInt(limit) : 10;
        const offset = (page - 1) * limit;

        let whereCond = `WHERE gh.is_deleted = 0`;
        let params = [];

        if (search) {
            whereCond += `
                AND (
                    gh.name LIKE ?
                    OR gh.email LIKE ?
                    OR gh.phone LIKE ?
                    OR gh.contact_person LIKE ?
                    OR gh.address LIKE ?
                    OR c.name LIKE ?
                )
            `;
            const s = `%${search}%`;
            params.push(s, s, s, s, s, s);
        }

        const countQ = `
            SELECT COUNT(*) AS total
            FROM tbl_groupage_handlers gh
            LEFT JOIN countries c ON gh.country_id = c.id
            ${whereCond}
        `;

        con.query(countQ, params, (e1, r1) => {
            if (e1) {
                return res.status(500).json({
                    success: false,
                    message: "Internal server error",
                    error: e1.message
                });
            }

            const totalRecords = r1[0].total;
            const totalPages = Math.ceil(totalRecords / limit);

            const dataQ = `
                SELECT
                    gh.id,
                    gh.name,
                    gh.email,
                    gh.phone,
                    gh.address,
                    gh.contact_person AS contact,
                    gh.country_id,
                    c.name AS country_name,
                    gh.created_at
                FROM tbl_groupage_handlers gh
                LEFT JOIN countries c ON gh.country_id = c.id
                ${whereCond}
                ORDER BY gh.id DESC
                LIMIT ? OFFSET ?
            `;

            con.query(dataQ, [...params, limit, offset], (e2, rows) => {
                if (e2) {
                    return res.status(500).json({
                        success: false,
                        message: "Internal server error",
                        error: e2.message
                    });
                }

                res.status(200).json({
                    success: true,
                    message: "Groupage Handler fetched successfully",
                    data: rows,
                    total_records: totalRecords,
                    total: totalPages,
                    page,
                    limit
                });
            });
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const getGroupageHandlerById = (req, res) => {
    try {
        const { id } = req.body;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "id is required"
            });
        }

        const q = `
            SELECT
                sl.*,
                c.name AS country_name
            FROM tbl_groupage_handlers sl
            LEFT JOIN countries c ON sl.country_id = c.id
            WHERE sl.id = ? AND sl.is_deleted = 0
        `;

        con.query(q, [id], (e, r) => {
            if (e) {
                return res.status(500).json({
                    success: false,
                    message: "Internal server error",
                    error: e.message
                });
            }

            res.status(200).json({
                success: true,
                data: r
            });
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const updateGroupageHandler = (req, res) => {
    try {
        const { id, name, email, phone, address, contact, country_id } = req.body;

        if (!id || !name || !email) {
            return res.status(400).json({
                success: false,
                message: "id, name and email are required"
            });
        }

        const q = `
            UPDATE tbl_groupage_handlers
            SET
                name = ?,
                email = ?,
                phone = ?,
                address = ?,
                contact_person = ?,
                country_id = ?
            WHERE id = ? AND is_deleted = 0
        `;

        con.query(
            q,
            [name, email, phone, address, contact, country_id, id],
            (e) => {
                if (e) {
                    return res.status(500).json({
                        success: false,
                        message: "Internal server error",
                        error: e.message
                    });
                }

                res.status(200).json({
                    success: true,
                    message: "Groupage Handler updated successfully"
                });
            }
        );

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const deleteGroupageHandler = (req, res) => {
    try {
        const { id } = req.body;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "id is required"
            });
        }

        const q = `
            UPDATE tbl_groupage_handlers
            SET is_deleted = 1
            WHERE id = ?
        `;

        con.query(q, [id], (e) => {
            if (e) {
                return res.status(500).json({
                    success: false,
                    message: "Internal server error",
                    error: e.message
                });
            }

            res.status(200).json({
                success: true,
                message: "Groupage Handler deleted successfully"
            });
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// =================== Transporter ================== //

const addTransporter = (req, res) => {
    try {
        const { name, email, phone, address, contact, country_id } = req.body;

        if (!name || !email) {
            return res.status(400).json({
                success: false,
                message: "name and email are required"
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Invalid email format"
            });
        }

        const checkEmail = `
            SELECT id FROM tbl_transporters
            WHERE email = ? AND is_deleted = 0
            LIMIT 1
        `;

        con.query(checkEmail, [email], (e1, r1) => {
            if (e1) {
                return res.status(500).json({
                    success: false,
                    message: "Internal server error",
                    error: e1.message
                });
            }

            if (r1.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: "Email already exists"
                });
            }

            const insertQ = `
                INSERT INTO tbl_transporters
                (name, email, phone, address, contact_person, country_id)
                VALUES (?, ?, ?, ?, ?, ?)
            `;

            con.query(
                insertQ,
                [name, email, phone, address, contact, country_id],
                (e2, r2) => {
                    if (e2) {
                        return res.status(500).json({
                            success: false,
                            message: "Internal server error",
                            error: e2.message
                        });
                    }

                    res.status(200).json({
                        success: true,
                        message: "Transporter added successfully",
                        id: r2.insertId
                    });
                }
            );
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const getTransporters = (req, res) => {
    try {
        let { search, page, limit } = req.body;

        page = page ? parseInt(page) : 1;
        limit = limit ? parseInt(limit) : 10;
        const offset = (page - 1) * limit;

        let whereCond = `WHERE t.is_deleted = 0`;
        let params = [];

        if (search) {
            whereCond += `
                AND (
                    t.name LIKE ?
                    OR t.email LIKE ?
                    OR t.phone LIKE ?
                    OR t.contact_person LIKE ?
                    OR t.address LIKE ?
                    OR c.name LIKE ?
                )
            `;
            const s = `%${search}%`;
            params.push(s, s, s, s, s, s);
        }

        const countQ = `
            SELECT COUNT(*) AS total
            FROM tbl_transporters t
            LEFT JOIN countries c ON t.country_id = c.id
            ${whereCond}
        `;

        con.query(countQ, params, (e1, r1) => {
            if (e1) {
                return res.status(500).json({
                    success: false,
                    message: "Internal server error",
                    error: e1.message
                });
            }

            const totalRecords = r1[0].total;
            const totalPages = Math.ceil(totalRecords / limit);

            const dataQ = `
                SELECT
                    t.id,
                    t.name,
                    t.email,
                    t.phone,
                    t.address,
                    t.contact_person AS contact,
                    t.country_id,
                    c.name AS country_name,
                    t.created_at
                FROM tbl_transporters t
                LEFT JOIN countries c ON t.country_id = c.id
                ${whereCond}
                ORDER BY t.id DESC
                LIMIT ? OFFSET ?
            `;

            con.query(dataQ, [...params, limit, offset], (e2, rows) => {
                if (e2) {
                    return res.status(500).json({
                        success: false,
                        message: "Internal server error",
                        error: e2.message
                    });
                }

                res.status(200).json({
                    success: true,
                    message: "Transporters fetched successfully",
                    data: rows,
                    total_records: totalRecords,
                    total: totalPages,
                    page,
                    limit
                });
            });
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const getTransporterById = (req, res) => {
    try {
        const { id } = req.body;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "id is required"
            });
        }

        const q = `
            SELECT
                t.*,
                c.name AS country_name
            FROM tbl_transporters t
            LEFT JOIN countries c ON t.country_id = c.id
            WHERE t.id = ? AND t.is_deleted = 0
        `;

        con.query(q, [id], (e, r) => {
            if (e) {
                return res.status(500).json({
                    success: false,
                    message: "Internal server error",
                    error: e.message
                });
            }

            res.status(200).json({
                success: true,
                data: r.length ? r[0] : null
            });
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const updateTransporter = (req, res) => {
    try {
        const { id, name, email, phone, address, contact, country_id } = req.body;

        if (!id || !name || !email) {
            return res.status(400).json({
                success: false,
                message: "id, name and email are required"
            });
        }

        const q = `
            UPDATE tbl_transporters
            SET
                name = ?,
                email = ?,
                phone = ?,
                address = ?,
                contact_person = ?,
                country_id = ?
            WHERE id = ? AND is_deleted = 0
        `;

        con.query(
            q,
            [name, email, phone, address, contact, country_id, id],
            (e) => {
                if (e) {
                    return res.status(500).json({
                        success: false,
                        message: "Internal server error",
                        error: e.message
                    });
                }

                if (q.affectedRows === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Transporter not found"
                    });
                }

                res.status(200).json({
                    success: true,
                    message: "Transporter updated successfully"
                });
            }
        );

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const deleteTransporter = (req, res) => {
    try {
        const { id } = req.body;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "id is required"
            });
        }

        const q = `
            UPDATE tbl_transporters
            SET is_deleted = 1
            WHERE id = ?
        `;

        con.query(q, [id], (e) => {
            if (e) {
                return res.status(500).json({
                    success: false,
                    message: "Internal server error",
                    error: e.message
                });
            }

            res.status(200).json({
                success: true,
                message: "Transporter deleted successfully"
            });
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const AddTask = (req, res) => {

    const { title, description, priority, task_for_type, task_for_id, created_by } = req.body;

    if (!title || !priority || !task_for_type || !created_by) {
        return res.status(400).send({
            success: false,
            message: "title, priority, task_for_type, created_by required"
        });
    }

    const validPriority = ['Low', 'Medium', 'High'];
    if (!validPriority.includes(priority)) {
        return res.status(400).send({
            success: false,
            message: "Invalid priority"
        });
    }

    const validTaskTypes = ['self', 'supplier', 'staff'];
    if (!validTaskTypes.includes(task_for_type)) {
        return res.status(400).send({
            success: false,
            message: "Invalid task_for_type"
        });
    }

    if (task_for_type !== 'self' && !task_for_id) {
        return res.status(400).send({
            success: false,
            message: "task_for_id required"
        });
    }

    const insertData = {
        title,
        description,
        priority,
        task_for_type,
        task_for_id: task_for_type === 'self' ? null : task_for_id,
        created_by
    };

    con.query(
        "INSERT INTO tbl_tasks SET ?",
        insertData,
        (err, result) => {

            if (err) {
                return res.status(500).send({
                    success: false,
                    message: err.message
                });
            }

            res.status(200).send({
                success: true,
                message: "Task added successfully",
                task_id: result.insertId
            });
        }
    );
};

const staffTaskList = (req, res) => {

    const { staff_id, search, page = 1, limit = 10 } = req.body;

    const offset = (page - 1) * limit;

    let condition = `
        WHERE t.task_for_type = 'staff'
        AND t.task_for_id = ?
    `;

    let params = [staff_id];

    if (search) {
        condition += `
            AND (
                t.title LIKE ?
                OR t.description LIKE ?
                OR t.priority LIKE ?
            )
        `;
        const s = `%${search}%`;
        params.push(s, s, s);
    }

    const countQuery = `
        SELECT COUNT(*) as total
        FROM tbl_tasks t
        ${condition}
    `;

    con.query(countQuery, params, (err, countRows) => {

        if (err) return res.status(500).send({ success: false, message: err.message });

        const total = countRows[0].total;

        const dataQuery = `
            SELECT 
                t.id,
                t.title,
                t.description,
                t.priority,
                t.created_at,
                u.full_name as created_by_name
            FROM tbl_tasks t
            LEFT JOIN tbl_users u ON u.id = t.created_by
            ${condition}
            ORDER BY t.created_at DESC
            LIMIT ? OFFSET ?
        `;

        con.query(
            dataQuery,
            [...params, Number(limit), Number(offset)],
            (err, rows) => {

                if (err) {
                    return res.status(500).send({
                        success: false,
                        message: err.message
                    });
                }

                res.send({
                    success: true,
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    data: rows
                });

            }
        );

    });

};

const supplierTaskList = (req, res) => {

    const { supplier_id, search, page = 1, limit = 10 } = req.body;

    const offset = (page - 1) * limit;

    let condition = `
        WHERE t.task_for_type = 'supplier'
        AND t.task_for_id = ?
    `;

    let params = [supplier_id];

    if (search) {
        condition += `
            AND (
                t.title LIKE ?
                OR t.description LIKE ?
                OR t.priority LIKE ?
            )
        `;
        const s = `%${search}%`;
        params.push(s, s, s);
    }

    const countQuery = `
        SELECT COUNT(*) as total
        FROM tbl_tasks t
        ${condition}
    `;

    con.query(countQuery, params, (err, countRows) => {

        if (err) return res.status(500).send({ success: false, message: err.message });

        const total = countRows[0].total;

        const dataQuery = `
            SELECT 
                t.id,
                t.title,
                t.description,
                t.priority,
                t.created_at,
                u.full_name as created_by_name
            FROM tbl_tasks t
            LEFT JOIN tbl_users u ON u.id = t.created_by
            ${condition}
            ORDER BY t.created_at DESC
            LIMIT ? OFFSET ?
        `;

        con.query(
            dataQuery,
            [...params, Number(limit), Number(offset)],
            (err, rows) => {

                if (err) {
                    return res.status(500).send({
                        success: false,
                        message: err.message
                    });
                }

                res.send({
                    success: true,
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    data: rows
                });

            }
        );

    });

};

const adminTaskList = (req, res) => {

    const { search, page = 1, limit = 10 } = req.body;

    const offset = (page - 1) * limit;

    let condition = `WHERE 1=1`;
    let params = [];

    if (search) {
        condition += `
            AND (
                t.title LIKE ?
                OR t.description LIKE ?
                OR t.priority LIKE ?
                OR s.name LIKE ?
                OR staff.full_name LIKE ?
            )
        `;
        const s = `%${search}%`;
        params.push(s, s, s, s, s);
    }

    const countQuery = `
        SELECT COUNT(*) as total
        FROM tbl_tasks t
        LEFT JOIN tbl_suppliers s 
            ON s.id = t.task_for_id AND t.task_for_type='supplier'
        LEFT JOIN tbl_users staff 
            ON staff.id = t.task_for_id AND t.task_for_type='staff'
        ${condition}
    `;

    con.query(countQuery, params, (err, countRows) => {

        if (err) return res.status(500).send({ success: false, message: err.message });

        const total = countRows[0].total;

        const dataQuery = `
            SELECT 
                t.id,
                t.title,
                t.description,
                t.priority,
                t.task_for_type,
                s.name as supplier_name,
                staff.full_name as staff_name,
                t.created_at
            FROM tbl_tasks t
            LEFT JOIN tbl_suppliers s 
                ON s.id = t.task_for_id AND t.task_for_type='supplier'
            LEFT JOIN tbl_users staff 
                ON staff.id = t.task_for_id AND t.task_for_type='staff'
            ${condition}
            ORDER BY t.created_at DESC
            LIMIT ? OFFSET ?
        `;

        con.query(
            dataQuery,
            [...params, Number(limit), Number(offset)],
            (err, rows) => {

                if (err) {
                    return res.status(500).send({
                        success: false,
                        message: err.message
                    });
                }

                res.send({
                    success: true,
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    data: rows
                });

            }
        );

    });

};


// later
/* const adminProcessSupplierWarehouse = (req, res) => {
    try {

        const {
            supplier_warehouse_id,
            client_id,
            create_new_order,   // 1 = yes, 0 = no
            order_id,           // required if no
            batch_id,
            added_by
        } = req.body;

        if (!supplier_warehouse_id) {
            return res.status(400).json({
                success: false,
                message: "supplier_warehouse_id required"
            });
        }

        // =========================
        // GET SUPPLIER WAREHOUSE DATA
        // =========================

        con.query(
            `SELECT * FROM supplier_warehouse_orders WHERE id=?`,
            [supplier_warehouse_id],
            (err, rows) => {

                if (err) {
                    console.error(err);
                    return res.status(500).json({ success: false, message: "DB error" });
                }

                if (!rows.length) {
                    return res.status(404).json({
                        success: false,
                        message: "Record not found"
                    });
                }

                const data = rows[0];

                // =========================
                // CASE 1: CREATE NEW ORDER
                // =========================

                if (Number(create_new_order) === 1) {

                    con.query(
                        `INSERT INTO tbl_orders
                        (goods_description, dimensions, weight, warehouse_status, cartons, CBM,
                        collection_from, delivery_to, client_name, supplier_id, freight_type, added_by)
                        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
                        [
                            data.goods_description || null,
                            data.total_cbm || null,
                            data.total_weight || null,
                            1,
                            data.total_packages || 0,
                            data.total_cbm || null,
                            data.collection_from || 0,
                            data.destination_country || 0,
                            data.customer_name || null,
                            data.supplier_id || 0,
                            null,
                            added_by || 1
                        ],
                        (err, orderResult) => {

                            if (err) {
                                console.error(err);
                                return res.status(500).json({
                                    success: false,
                                    message: "Order create failed"
                                });
                            }

                            const newOrderId = orderResult.insertId;

                            // =========================
                            // CREATE WAREHOUSE ASSIGN
                            // =========================

                            con.query(
                                `INSERT INTO warehouse_assign_order
                                (order_id, warehouse_status, supplier_id,
                                courier_waybill_ref, date_entry_created, dispatched_date, days_in_warehouse,
                                warehouse_comment, customer_ref, box_marking, package_type, hazardous,
                                total_packeges, hazard_description, package_comment,
                                damage_goods, damaged_pkg_qty, damage_comment,
                                supplier_company, supplier_person, supplier_address,
                                warehouse_order_id, warehouse_collect, costs_to_collect,
                                warehouse_storage, warehouse_cost, handling_required, handling_cost,
                                warehouse_dispatch, cost_to_dispatch, added_by)
                                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                                [
                                    newOrderId,
                                    1,
                                    data.supplier_id,

                                    data.courier_waybill_ref,
                                    data.date_entry_created,
                                    data.dispatch_date,
                                    data.days_in_warehouse,

                                    data.warehouse_comment,
                                    data.customer_ref,
                                    data.box_marking,
                                    data.package_type,
                                    data.hazardous,

                                    data.total_packages,
                                    data.hazard_description,
                                    data.package_comment,

                                    data.damaged_goods,
                                    data.damaged_pkg_qty,
                                    data.damage_comment,

                                    data.supplier_company,
                                    data.supplier_person,
                                    data.supplier_address,

                                    data.warehouse_order_id,
                                    data.warehouse_collect,
                                    data.costs_to_collect,

                                    data.warehouse_storage,
                                    data.warehouse_cost,
                                    data.handling_required,
                                    data.handling_cost,

                                    data.warehouse_dispatch,
                                    data.cost_to_dispatch,
                                    added_by || 1
                                ],
                                (err, warehouseResult) => {

                                    if (err) {
                                        console.error(err);
                                        return res.status(500).json({
                                            success: false,
                                            message: "Warehouse assign failed"
                                        });
                                    }

                                    const warehouseId = warehouseResult.insertId;

                                    // =========================
                                    // UPDATE SUPPLIER TABLE
                                    // =========================

                                    con.query(
                                        `UPDATE supplier_warehouse_orders 
                                        SET client_id=?, order_id=?, warehouse_id=?, batch_id=?
                                        WHERE id=?`,
                                        [
                                            client_id || null,
                                            newOrderId,
                                            warehouseId,
                                            batch_id || 0,
                                            supplier_warehouse_id
                                        ]
                                    );

                                    return res.status(200).json({
                                        success: true,
                                        message: "Order created & linked",
                                        order_id: newOrderId,
                                        warehouse_id: warehouseId
                                    });

                                }
                            );

                        }
                    );

                } else {

                    // =========================
                    // CASE 2: USE EXISTING ORDER
                    // =========================

                    if (!order_id) {
                        return res.status(400).json({
                            success: false,
                            message: "order_id required when not creating new"
                        });
                    }

                    con.query(
                        `UPDATE supplier_warehouse_orders 
                        SET client_id=?, order_id=?, batch_id=?
                        WHERE id=?`,
                        [
                            client_id || null,
                            order_id,
                            batch_id || 0,
                            supplier_warehouse_id
                        ],
                        (err) => {

                            if (err) {
                                console.error(err);
                                return res.status(500).json({
                                    success: false,
                                    message: "Update failed"
                                });
                            }

                            return res.status(200).json({
                                success: true,
                                message: "Linked to existing order"
                            });

                        }
                    );

                }

            }
        );

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
}; */

const adminUpdateSupplierWarehouse = (req, res) => {
    try {

        const {
            supplier_warehouse_id,
            client_id,
            order_id,
            batch_id,
            customer_ref,
            order_action   // 1 = create new, 2 = existing
        } = req.body;

        if (!supplier_warehouse_id) {
            return res.status(400).json({
                success: false,
                message: "supplier_warehouse_id required"
            });
        }

        //  Validation based on admin decision
        if (order_action?.toLowerCase() === "no" && !order_id) {
            return res.status(400).json({
                success: false,
                message: "order_id is required when selecting an existing order"
            });
        }

        const sql = `
            UPDATE supplier_warehouse_orders SET
                client_id = ?,
                order_id = ?,
                batch_id = ?,
                customer_ref = ?,
                order_action = ?
            WHERE id = ?
        `;

        const values = [
            client_id || null,
            order_id || null,
            batch_id || null,
            customer_ref || null,   // fixed (was 1, now null)
            order_action || null,
            supplier_warehouse_id
        ];

        con.query(sql, values, (err) => {

            if (err) {
                console.error(err);
                return res.status(500).json({
                    success: false,
                    message: "Update failed"
                });
            }

            return res.status(200).json({
                success: true,
                message: "Supplier warehouse order updated successfully"
            });

        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};

// const MoveSupplierWarehouseOrder = (req, res) => {
//     try {
//         const { supplier_warehouse_id, user_id } = req.body;

//         if (!supplier_warehouse_id) {
//             return res.status(400).json({
//                 success: false,
//                 message: "supplier_warehouse_id required"
//             });
//         }

//         // =========================
//         // GET SUPPLIER ORDER
//         // =========================

//         con.query(
//             `SELECT * FROM supplier_warehouse_orders WHERE id=?`,
//             [supplier_warehouse_id],
//             (err, rows) => {

//                 if (err) return res.status(500).json({ success: false, message: "DB error" });

//                 if (!rows.length) {
//                     return res.status(404).json({
//                         success: false,
//                         message: "Record not found"
//                     });
//                 }

//                 const data = rows[0];

//                 // =========================
//                 // IF EXISTING ORDER → SKIP
//                 // =========================

//                 if (data.order_action?.toLowerCase() === "no") {
//                     // return res.status(200).json({
//                     //     success: true,
//                     //     message: "Already linked with existing order"
//                     // });

//                      con.query(
//                                     `SELECT * FROM supplier_warehouse_products WHERE supplier_warehouse_id=?`,
//                                     [supplier_warehouse_id],
//                                     (err, products) => {

//                                         if (products && products.length) {

//                                             const values = products.map(p => [
//                                                 data.client_id || null,
//                                                 data.order_id,
//                                                 supplier_warehouse_id,
//                                                 p.product_description,
//                                                 p.hazardous,
//                                                 p.date_received,
//                                                 p.package_type,
//                                                 p.packages,
//                                                 p.dimension,
//                                                 p.weight,
//                                                 p.warehouse_ref,
//                                                 p.freight,
//                                                 p.groupage_batch_ref,
//                                                 p.supplier,
//                                                 p.warehouse_receipt_number,
//                                                 p.tracking_number,
//                                                 p.date_dispatched,
//                                                 p.supplier_address,
//                                                 p.supplier_email,
//                                                 p.supplier_contact,
//                                                 p.warehouse_collect,
//                                                 p.costs_to_collect,
//                                                 p.port_of_loading,
//                                                 p.warehouse_dispatch,
//                                                 p.warehouse_cost,
//                                                 p.cost_to_dispatch,
//                                                 p.waybill_ref,
//                                                 user_id
//                                             ]);

//                                             con.query(
//                                                 `INSERT INTO warehouse_products
//                                                 (user_id, order_id, warehouse_order_id, product_description, Hazardous,
//                                                 date_received, package_type, packages, dimension, weight,
//                                                 warehouse_ref, freight, groupage_batch_ref, supplier,
//                                                 warehouse_receipt_number, tracking_number, date_dspatched,
//                                                 supplier_address, supplier_Email, Supplier_Contact,
//                                                 warehouse_collect, costs_to_collect, port_of_loading,
//                                                 warehouse_dispatch, warehouse_cost, cost_to_dispatch,
//                                                 waybill_ref, added_by)
//                                                 VALUES ?`,
//                                                 [values]
//                                             );
//                                         }
//                                     })
//                 }

//                 // =========================
//                 // CREATE ORDER
//                 // =========================

//                 con.query(
//                     `INSERT INTO tbl_orders
//                     (goods_description, dimensions, weight, warehouse_status, cartons, CBM,
//                     collection_from, delivery_to, client_name, supplier_id, freight_type, added_by)
//                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
//                     [
//                         data.goods_description,
//                         data.total_cbm,
//                         data.total_weight,
//                         1,
//                         data.total_packages,
//                         data.total_cbm,
//                         data.collection_from,
//                         data.destination_country,
//                         data.customer_name,
//                         data.supplier_id,
//                         null,
//                         user_id
//                     ],
//                     (err, orderResult) => {

//                         if (err) return res.status(500).json({ success: false, message: "Order failed" });

//                         const order_id = orderResult.insertId;

//                         // =========================
//                         // CREATE WAREHOUSE
//                         // =========================

//                         con.query(
//                             `INSERT INTO warehouse_assign_order
//                             (order_id, warehouse_status, supplier_id,
//                             courier_waybill_ref, date_entry_created, dispatched_date, days_in_warehouse,
//                             warehouse_comment, customer_ref, box_marking, package_type, hazardous,
//                             total_packeges, hazard_description, package_comment,
//                             damage_goods, damaged_pkg_qty, damage_comment,
//                             supplier_company, supplier_person, supplier_address,
//                             warehouse_order_id, warehouse_collect, costs_to_collect,
//                             warehouse_storage, warehouse_cost, handling_required, handling_cost,
//                             warehouse_dispatch, cost_to_dispatch, added_by)
//                             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
//                             [
//                                 order_id,
//                                 1,
//                                 data.supplier_id,
//                                 data.courier_waybill_ref,
//                                 data.date_entry_created,
//                                 data.dispatch_date,
//                                 data.days_in_warehouse,

//                                 data.warehouse_comment,
//                                 data.customer_ref,
//                                 data.box_marking,
//                                 data.package_type,
//                                 data.hazardous,

//                                 data.total_packages,
//                                 data.hazard_description,
//                                 data.package_comment,

//                                 data.damaged_goods,
//                                 data.damaged_pkg_qty,
//                                 data.damage_comment,

//                                 data.supplier_company,
//                                 data.supplier_person,
//                                 data.supplier_address,

//                                 data.warehouse_order_id,
//                                 data.warehouse_collect,
//                                 data.costs_to_collect,

//                                 data.warehouse_storage,
//                                 data.warehouse_cost,
//                                 data.handling_required,
//                                 data.handling_cost,

//                                 data.warehouse_dispatch,
//                                 data.cost_to_dispatch,
//                                user_id
//                             ],
//                             (err, warehouseResult) => {

//                                 if (err) return res.status(500).json({ success: false, message: "Warehouse failed" });

//                                 const warehouseId = warehouseResult.insertId;

//                                 // =========================
//                                 // GENERATE WAREHOUSE NUMBER
//                                 // =========================

//                                 const year = new Date().getFullYear();
//                                 const warehouseNumber = `WH-${year}-${String(warehouseId).padStart(5, "0")}`;

//                                 con.query(
//                                     `UPDATE warehouse_assign_order SET warehouse_number=? WHERE id=?`,
//                                     [warehouseNumber, warehouseId]
//                                 );

//                                 // =========================
//                                 // 🔥 MOVE PRODUCTS
//                                 // =========================

//                                 con.query(
//                                     `SELECT * FROM supplier_warehouse_products WHERE supplier_warehouse_id=?`,
//                                     [supplier_warehouse_id],
//                                     (err, products) => {

//                                         if (products && products.length) {

//                                             const values = products.map(p => [
//                                                 0,
//                                                 order_id,
//                                                 supplier_warehouse_id,
//                                                 p.product_description,
//                                                 p.hazardous,
//                                                 p.date_received,
//                                                 p.package_type,
//                                                 p.packages,
//                                                 p.dimension,
//                                                 p.weight,
//                                                 p.warehouse_ref,
//                                                 p.freight,
//                                                 p.groupage_batch_ref,
//                                                 p.supplier,
//                                                 p.warehouse_receipt_number,
//                                                 p.tracking_number,
//                                                 p.date_dispatched,
//                                                 p.supplier_address,
//                                                 p.supplier_email,
//                                                 p.supplier_contact,
//                                                 p.warehouse_collect,
//                                                 p.costs_to_collect,
//                                                 p.port_of_loading,
//                                                 p.warehouse_dispatch,
//                                                 p.warehouse_cost,
//                                                 p.cost_to_dispatch,
//                                                 p.waybill_ref,
//                                                user_id
//                                             ]);

//                                             con.query(
//                                                 `INSERT INTO warehouse_products
//                                                 (user_id, order_id, warehouse_order_id, product_description, Hazardous,
//                                                 date_received, package_type, packages, dimension, weight,
//                                                 warehouse_ref, freight, groupage_batch_ref, supplier,
//                                                 warehouse_receipt_number, tracking_number, date_dspatched,
//                                                 supplier_address, supplier_Email, Supplier_Contact,
//                                                 warehouse_collect, costs_to_collect, port_of_loading,
//                                                 warehouse_dispatch, warehouse_cost, cost_to_dispatch,
//                                                 waybill_ref, added_by)
//                                                 VALUES ?`,
//                                                 [values]
//                                             );
//                                         }

//                                         // =========================
//                                         // UPDATE SUPPLIER TABLE
//                                         // =========================

//                                         con.query(
//                                             `UPDATE supplier_warehouse_orders 
//                                             SET order_id=?, warehouse_id=? 
//                                             WHERE id=?`,
//                                             [order_id, warehouseId, supplier_warehouse_id]
//                                         );

//                                         return res.status(200).json({
//                                             success: true,
//                                             message: "Order + Warehouse + Products created",
//                                             order_id,
//                                             warehouse_id: warehouseId,
//                                             warehouse_number: warehouseNumber
//                                         });

//                                     }
//                                 );

//                             }
//                         );

//                     }
//                 );

//             }
//         );

//     } catch (error) {

//         return res.status(500).json({
//             success: false,
//             message: error.message
//         });

//     }
// };


// const MoveSupplierWarehouseOrder = (req, res) => {
//     try {
//         const { supplier_warehouse_id, user_id } = req.body;

//         if (!supplier_warehouse_id) {
//             return res.status(400).json({
//                 success: false,
//                 message: "supplier_warehouse_id required"
//             });
//         }


//         // =========================
//         // GET SUPPLIER ORDER
//         // =========================
//         con.query(
//             `SELECT * FROM supplier_warehouse_orders WHERE id=?`,
//             [supplier_warehouse_id],
//             (err, rows) => {

//                 if (err) {
//                     console.error(err);
//                     return res.status(500).json({ success: false, message: "DB error" });
//                 }

//                 if (!rows.length) {
//                     return res.status(404).json({
//                         success: false,
//                         message: "Record not found"
//                     });
//                 }

//                 if (rows[0].move_to_adminWarhouse === 1) {
//                     return res.status(404).json({
//                         success: false,
//                         message: "Already move to Admin Warehouse Order"
//                     });
//                 }

//                 con.query(
//                     `UPDATE supplier_warehouse_orders SET move_to_adminWarhouse=? WHERE id=?`,
//                     [1, supplier_warehouse_id]
//                 );

//                 const data = rows[0];

//                 //  normalize value
//                 const action = (data.order_action || "").trim().toLowerCase();

//                 // ====================================================
//                 //  CASE 1: EXISTING ORDER (order_action = NO)
//                 // ====================================================
//                 if (action === "no") {

//                     if (!data.order_id) {
//                         return res.status(400).json({
//                             success: false,
//                             message: "order_id required for existing order"
//                         });
//                     }

//                     //  STEP 1: GET WAREHOUSE ORDER ID FROM ACTUAL TABLE
//                     con.query(
//                         `SELECT id FROM warehouse_assign_order WHERE order_id=? ORDER BY id DESC LIMIT 1`,
//                         [data.order_id],
//                         (err, warehouseRows) => {

//                             if (err) {
//                                 console.error(err);
//                                 return res.status(500).json({
//                                     success: false,
//                                     message: "Warehouse fetch failed"
//                                 });
//                             }

//                             if (!warehouseRows.length) {
//                                 return res.status(400).json({
//                                     success: false,
//                                     message: "No warehouse found for this order_id"
//                                 });
//                             }

//                             const warehouseId = warehouseRows[0].id; // warehouse_order_id

//                             // =========================
//                             // MOVE FILES
//                             // =========================
//                             con.query(
//                                 `SELECT * FROM supplier_warehouse_files WHERE supplier_warehouse_id=?`,
//                                 [supplier_warehouse_id],
//                                 (err, files) => {

//                                     if (err) {
//                                         console.error("File fetch error:", err);
//                                     }

//                                     if (files && files.length) {

//                                         const fileValues = files.map(f => [
//                                             warehouseId,   // 👈 IMPORTANT (new warehouse id)
//                                             f.file_type,
//                                             f.file_name
//                                         ]);

//                                         con.query(
//                                             `INSERT INTO warehouse_files (warehouse_id, file_type, file_name)
//                  VALUES ?`,
//                                             [fileValues],
//                                             (err) => {
//                                                 if (err) {
//                                                     console.error("File insert error:", err);
//                                                 }
//                                             }
//                                         );
//                                     }
//                                 }
//                             );

//                             // =========================
//                             // GET PRODUCTS
//                             // =========================
//                             con.query(
//                                 `SELECT * FROM supplier_warehouse_products WHERE supplier_warehouse_id=?`,
//                                 [supplier_warehouse_id],
//                                 (err, products) => {

//                                     if (err) {
//                                         console.error(err);
//                                         return res.status(500).json({
//                                             success: false,
//                                             message: "Product fetch failed"
//                                         });
//                                     }

//                                     if (products.length) {

//                                         const values = products.map(p => [
//                                             data.client_id || null,
//                                             data.order_id,
//                                             warehouseId,   //  FIXED (IMPORTANT)
//                                             p.product_description,
//                                             p.hazardous,
//                                             p.date_received,
//                                             p.package_type,
//                                             p.packages,
//                                             p.dimension,
//                                             p.weight,
//                                             p.warehouse_ref,
//                                             p.freight,
//                                             p.groupage_batch_ref,
//                                             p.supplier,
//                                             p.warehouse_receipt_number,
//                                             p.tracking_number,
//                                             p.date_dispatched,
//                                             p.supplier_address,
//                                             p.supplier_email,
//                                             p.supplier_contact,
//                                             p.warehouse_collect,
//                                             p.costs_to_collect,
//                                             p.port_of_loading,
//                                             p.warehouse_dispatch,
//                                             p.warehouse_cost,
//                                             p.cost_to_dispatch,
//                                             p.waybill_ref,
//                                             user_id || 1
//                                         ]);

//                                         con.query(
//                                             `INSERT INTO warehouse_products
//                             (user_id, order_id, warehouse_order_id, product_description, Hazardous,
//                             date_received, package_type, packages, dimension, weight,
//                             warehouse_ref, freight, groupage_batch_ref, supplier,
//                             warehouse_receipt_number, tracking_number, date_dspatched,
//                             supplier_address, supplier_Email, Supplier_Contact,
//                             warehouse_collect, costs_to_collect, port_of_loading,
//                             warehouse_dispatch, warehouse_cost, cost_to_dispatch,
//                             waybill_ref, added_by)
//                             VALUES ?`,
//                                             [values],
//                                             (err) => {
//                                                 if (err) console.error("Insert product error:", err);
//                                             }
//                                         );


//                                         con.query(
//                                             `UPDATE supplier_warehouse_orders SET move_to_adminWarhouse=? WHERE id=?`,
//                                             [1, supplier_warehouse_id]
//                                         );
//                                     }

//                                     return res.status(200).json({
//                                         success: true,
//                                         message: "Products added to existing warehouse order"
//                                     });
//                                 }
//                             );
//                         }
//                     );

//                     return;
//                 }

//                 // ====================================================
//                 //  INVALID CASE
//                 // ====================================================
//                 if (action !== "yes") {
//                     return res.status(400).json({
//                         success: false,
//                         message: "Invalid order_action (must be yes or no)"
//                     });
//                 }

//                 // ====================================================
//                 //  CASE 2: CREATE NEW ORDER (order_action = YES)
//                 // ====================================================
//                 con.query(
//                     `INSERT INTO tbl_orders
//                     (client_id, goods_description, dimensions, weight, warehouse_status, cartons, CBM,
//                     collection_from, delivery_to, client_name, supplier_id, freight_type, added_by)
//                     VALUES (?, ?,?,?,?,?,?,?,?,?,?,?,?)`,
//                     [
//                         data.client_id,
//                         data.goods_description,
//                         data.total_cbm,
//                         data.total_weight,
//                         1,
//                         data.total_packages,
//                         data.total_cbm,
//                         data.collection_from,
//                         data.destination_country,
//                         data.customer_name,
//                         data.supplier_id,
//                         null,
//                         user_id || 1
//                     ],
//                     (err, orderResult) => {

//                         if (err) {
//                             console.error(err);
//                             return res.status(500).json({ success: false, message: "Order creation failed" });
//                         }

//                         const order_id = orderResult.insertId;

//                         // =========================
//                         // CREATE WAREHOUSE
//                         // =========================
//                         con.query(
//                             `INSERT INTO warehouse_assign_order
//     (order_id, warehouse_status, supplier_id,
//     courier_waybill_ref, date_entry_created, dispatched_date,
//     warehouse_comment, customer_ref, box_marking, package_type, hazardous,
//     total_packeges, hazard_description, package_comment,
//     damage_goods, damaged_pkg_qty, damage_comment,
//     supplier_company, supplier_person, supplier_address,

//     batch_id, assign_to_batch, 

//     warehouse_order_id, warehouse_collect, costs_to_collect,
//     warehouse_storage, warehouse_cost, handling_required, handling_cost,
//     warehouse_dispatch, cost_to_dispatch, added_by)

//     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,
//             ?,?,
//             ?,?,?,?,?,?,?,?,?,?)`,
//                             [
//                                 order_id,
//                                 1,
//                                 data.supplier_id,
//                                 data.courier_waybill_ref,
//                                 data.date_entry_created,
//                                 data.dispatch_date,

//                                 data.warehouse_comment,
//                                 data.customer_ref,
//                                 data.box_marking,
//                                 data.package_type,
//                                 data.hazardous,

//                                 data.total_packages,
//                                 data.hazard_description,
//                                 data.package_comment,

//                                 data.damaged_goods,
//                                 data.damaged_pkg_qty,
//                                 data.damage_comment,

//                                 data.supplier_company,
//                                 data.supplier_person,
//                                 data.supplier_address,

//                                 //  LOGIC HERE
//                                 data.batch_id || null,
//                                 data.batch_id ? 1 : 0,

//                                 data.warehouse_order_id,
//                                 data.warehouse_collect,
//                                 data.costs_to_collect,

//                                 data.warehouse_storage,
//                                 data.warehouse_cost,
//                                 data.handling_required,
//                                 data.handling_cost,

//                                 data.warehouse_dispatch,
//                                 data.cost_to_dispatch,
//                                 user_id || 1
//                             ],
//                             (err, warehouseResult) => {

//                                 if (err) {
//                                     console.error(err);
//                                     return res.status(500).json({ success: false, message: "Warehouse creation failed", error: err.message });
//                                 }

//                                 const warehouseId = warehouseResult.insertId;

//                                 // =========================
//                                 // MOVE FILES
//                                 // =========================
//                                 con.query(
//                                     `SELECT * FROM supplier_warehouse_files WHERE supplier_warehouse_id=?`,
//                                     [supplier_warehouse_id],
//                                     (err, files) => {

//                                         if (err) {
//                                             console.error("File fetch error:", err);
//                                         }

//                                         if (files && files.length) {

//                                             const fileValues = files.map(f => [
//                                                 warehouseId,   //  IMPORTANT (new warehouse id)
//                                                 f.file_type,
//                                                 f.file_name
//                                             ]);

//                                             con.query(
//                                                 `INSERT INTO warehouse_files (warehouse_id, file_type, file_name)
//                  VALUES ?`,
//                                                 [fileValues],
//                                                 (err) => {
//                                                     if (err) {
//                                                         console.error("File insert error:", err);
//                                                     }
//                                                 }
//                                             );
//                                         }
//                                     }
//                                 );

//                                 // Generate warehouse number
//                                 // const year = new Date().getFullYear();
//                                 // const warehouseNumber = `WH-${year}-${String(warehouseId).padStart(5, "0")}`;

//                                 // con.query(
//                                 //     `UPDATE warehouse_assign_order SET warehouse_number=? WHERE id=?`,
//                                 //     [warehouseNumber, warehouseId]
//                                 // );

//                                 // =========================
//                                 // MOVE PRODUCTS
//                                 // =========================
//                                 con.query(
//                                     `SELECT * FROM supplier_warehouse_products WHERE supplier_warehouse_id=?`,
//                                     [supplier_warehouse_id],
//                                     (err, products) => {

//                                         if (products && products.length) {

//                                             const values = products.map(p => [
//                                                 data.client_id || null,
//                                                 order_id,
//                                                 warehouseId,
//                                                 p.product_description,
//                                                 p.hazardous,
//                                                 p.date_received,
//                                                 p.package_type,
//                                                 p.packages,
//                                                 p.dimension,
//                                                 p.weight,
//                                                 p.warehouse_ref,
//                                                 p.freight,
//                                                 p.groupage_batch_ref,
//                                                 p.supplier,
//                                                 p.warehouse_receipt_number,
//                                                 p.tracking_number,
//                                                 p.date_dispatched,
//                                                 p.supplier_address,
//                                                 p.supplier_email,
//                                                 p.supplier_contact,
//                                                 p.warehouse_collect,
//                                                 p.costs_to_collect,
//                                                 p.port_of_loading,
//                                                 p.warehouse_dispatch,
//                                                 p.warehouse_cost,
//                                                 p.cost_to_dispatch,
//                                                 p.waybill_ref,
//                                                 user_id || 1
//                                             ]);

//                                             con.query(
//                                                 `INSERT INTO warehouse_products
//                                                 (user_id, order_id, warehouse_order_id, product_description, Hazardous,
//                                                 date_received, package_type, packages, dimension, weight,
//                                                 warehouse_ref, freight, groupage_batch_ref, supplier,
//                                                 warehouse_receipt_number, tracking_number, date_dspatched,
//                                                 supplier_address, supplier_Email, Supplier_Contact,
//                                                 warehouse_collect, costs_to_collect, port_of_loading,
//                                                 warehouse_dispatch, warehouse_cost, cost_to_dispatch,
//                                                 waybill_ref, added_by)
//                                                 VALUES ?`,
//                                                 [values]
//                                             );

//                                             con.query(
//                                                 `UPDATE supplier_warehouse_orders SET move_to_adminWarhouse=? WHERE id=?`,
//                                                 [1, supplier_warehouse_id]
//                                             );
//                                         }

//                                         // UPDATE SUPPLIER TABLE
//                                         con.query(
//                                             `UPDATE supplier_warehouse_orders 
//                                             SET order_id=?, warehouse_id=? 
//                                             WHERE id=?`,
//                                             [order_id, warehouseId, supplier_warehouse_id]
//                                         );

//                                         return res.status(200).json({
//                                             success: true,
//                                             message: "Order + Warehouse + Products created",
//                                             order_id,
//                                             warehouse_id: warehouseId
//                                         });

//                                     }
//                                 );

//                             }
//                         );

//                     }
//                 );

//             }
//         );

//     } catch (error) {
//         return res.status(500).json({
//             success: false,
//             message: error.message
//         });
//     }
// };

// const MoveSupplierWarehouseOrder = (req, res) => {
//     try {
//         const { supplier_warehouse_id, user_id } = req.body;

//         if (!supplier_warehouse_id) {
//             return res.status(400).json({
//                 success: false,
//                 message: "supplier_warehouse_id required"
//             });
//         }

//         con.beginTransaction(err => {
//             if (err) {
//                 return res.status(500).json({ success: false, message: err.message });
//             }

//             // =========================
//             // GET ORDER
//             // =========================
//             con.query(
//                 `SELECT * FROM supplier_warehouse_orders WHERE id=?`,
//                 [supplier_warehouse_id],
//                 (err, rows) => {

//                     if (err) return rollback(err);
//                     if (!rows.length) return rollbackMsg("Record not found");

//                     const data = rows[0];

//                     if (data.move_to_adminWarhouse === 1) {
//                         return rollbackMsg("Already moved");
//                     }

//                     const action = (data.order_action || "").trim().toLowerCase();

//                     // ====================================================
//                     // CASE 1: EXISTING ORDER
//                     // ====================================================
//                     if (action === "no") {

//                         if (!data.order_id) {
//                             return rollbackMsg("order_id required");
//                         }

//                         con.query(
//                             `SELECT id FROM warehouse_assign_order WHERE order_id=? ORDER BY id DESC LIMIT 1`,
//                             [data.order_id],
//                             (err, warehouseRows) => {

//                                 if (err) return rollback(err);
//                                 if (!warehouseRows.length) return rollbackMsg("No warehouse found");

//                                 const warehouseId = warehouseRows[0].id;

//                                 moveFilesAndProducts(data, warehouseId, data.order_id, () => {
//                                     success("Products added to existing warehouse");
//                                 });
//                             }
//                         );

//                         return;
//                     }

//                     // ====================================================
//                     // INVALID
//                     // ====================================================
//                     if (action !== "yes") {
//                         return rollbackMsg("Invalid order_action");
//                     }

//                     // ====================================================
//                     // CASE 2: CREATE NEW ORDER
//                     // ====================================================
//                     con.query(
//                         `INSERT INTO tbl_orders
//                     (client_id, goods_description, dimensions, weight, warehouse_status, cartons, CBM,
//                     collection_from, delivery_to, client_name, supplier_id, freight_type, added_by)
//                     VALUES (?, ?,?,?,?,?,?,?,?,?,?,?,?)`,
//                         [
//                             data.client_id,
//                             data.goods_description,
//                             data.total_cbm,
//                             data.total_weight,
//                             1,
//                             data.total_packages,
//                             data.total_cbm,
//                             data.collection_from,
//                             data.destination_country,
//                             data.customer_name,
//                             data.supplier_id,
//                             null,
//                             user_id || 1
//                         ],
//                         (err, orderResult) => {

//                             if (err) return rollback(err);

//                             const order_id = orderResult.insertId;

//                             con.query(
//                                 `INSERT INTO warehouse_assign_order
//                             (order_id, warehouse_status, supplier_id,
//                             courier_waybill_ref, date_entry_created, dispatched_date,
//                             warehouse_comment, customer_ref, box_marking, package_type, hazardous,
//                             total_packeges, hazard_description, package_comment,
//                             damage_goods, damaged_pkg_qty, damage_comment,
//                             supplier_company, supplier_person, supplier_address, supplier_contact_no,
//                             batch_id, assign_to_batch,
//                             warehouse_order_id, warehouse_collect, costs_to_collect,
//                             warehouse_storage, warehouse_cost, handling_required, handling_cost,
//                             warehouse_dispatch, cost_to_dispatch, added_by)
//                             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,
//                                     ?,?,
//                                     ?,?,?,?,?,?,?,?,?,?,?)`,
//                                 [
//                                     order_id,
//                                     1,
//                                     data.supplier_id,
//                                     data.courier_waybill_ref,
//                                     data.date_entry_created,
//                                     data.dispatch_date,
//                                     data.warehouse_comment,
//                                     data.customer_ref,
//                                     data.box_marking,
//                                     data.package_type,
//                                     data.hazardous,
//                                     data.total_packages,
//                                     data.hazard_description,
//                                     data.package_comment,
//                                     data.damaged_goods,
//                                     data.damaged_pkg_qty,
//                                     data.damage_comment,
//                                     data.supplier_company,
//                                     data.supplier_person,
//                                     data.supplier_address,
//                                     data.supplier_contact,
//                                     data.batch_id || null,
//                                     data.batch_id ? 1 : 0,
//                                     data.warehouse_order_id,
//                                     data.warehouse_collect,
//                                     data.costs_to_collect,
//                                     data.warehouse_storage,
//                                     data.warehouse_cost,
//                                     data.handling_required,
//                                     data.handling_cost,
//                                     data.warehouse_dispatch,
//                                     data.cost_to_dispatch,
//                                     user_id || 1
//                                 ],
//                                 (err, warehouseResult) => {

//                                     if (err) return rollback(err);

//                                     const warehouseId = warehouseResult.insertId;

//                                     moveFilesAndProducts(data, warehouseId, order_id, () => {

//                                         // update supplier table
//                                         con.query(
//                                             `UPDATE supplier_warehouse_orders 
//                                          SET order_id=?, warehouse_id=? 
//                                          WHERE id=?`,
//                                             [order_id, warehouseId, supplier_warehouse_id],
//                                             (err) => {
//                                                 if (err) return rollback(err);

//                                                 success("Order + Warehouse + Products created", {
//                                                     order_id,
//                                                     warehouse_id: warehouseId
//                                                 });
//                                             }
//                                         );

//                                     });
//                                 }
//                             );
//                         }
//                     );

//                     // ====================================================
//                     // COMMON FUNCTION
//                     // ====================================================
//                     function moveFilesAndProducts(data, warehouseId, order_id, done) {

//                         // FILES
//                         con.query(
//                             `SELECT * FROM supplier_warehouse_files WHERE supplier_warehouse_id=?`,
//                             [supplier_warehouse_id],
//                             (err, files) => {

//                                 if (err) return rollback(err);

//                                 if (files.length) {
//                                     const fileValues = files.map(f => [
//                                         warehouseId,
//                                         f.file_type,
//                                         f.file_name
//                                     ]);

//                                     con.query(
//                                         `INSERT INTO warehouse_files (warehouse_id, file_type, file_name) VALUES ?`,
//                                         [fileValues],
//                                         (err) => {
//                                             if (err) return rollback(err);
//                                             moveProducts();
//                                         }
//                                     );
//                                 } else {
//                                     moveProducts();
//                                 }
//                             }
//                         );

//                         function moveProducts() {
//                             con.query(
//                                 `SELECT * FROM supplier_warehouse_products WHERE supplier_warehouse_id=?`,
//                                 [supplier_warehouse_id],
//                                 (err, products) => {

//                                     if (err) return rollback(err);

//                                     if (!products.length) {
//                                         return rollbackMsg("No products found");
//                                     }

//                                     const values = products.map(p => [
//                                         data.client_id || null,
//                                         order_id,
//                                         warehouseId,
//                                         p.product_description,
//                                         p.hazardous,
//                                         p.date_received,
//                                         p.package_type,
//                                         p.packages,
//                                         p.dimension,
//                                         p.weight,
//                                         p.warehouse_ref,
//                                         p.freight,
//                                         p.groupage_batch_ref,
//                                         p.supplier,
//                                         p.warehouse_receipt_number,
//                                         p.tracking_number,
//                                         p.date_dispatched,
//                                         p.supplier_address,
//                                         p.supplier_email,
//                                         p.supplier_contact,
//                                         p.warehouse_collect,
//                                         p.costs_to_collect,
//                                         p.port_of_loading,
//                                         p.warehouse_dispatch,
//                                         p.warehouse_cost,
//                                         p.cost_to_dispatch,
//                                         p.waybill_ref,
//                                         user_id || 1
//                                     ]);

//                                     con.query(
//                                         `INSERT INTO warehouse_products VALUES ?`,
//                                         [values],
//                                         (err) => {
//                                             if (err) return rollback(err);

//                                             done();
//                                         }
//                                     );
//                                 }
//                             );
//                         }
//                     }

//                     // ====================================================
//                     // SUCCESS
//                     // ====================================================
//                     function success(message, extra = {}) {
//                         con.query(
//                             `UPDATE supplier_warehouse_orders SET move_to_adminWarhouse=1 WHERE id=?`,
//                             [supplier_warehouse_id],
//                             (err) => {
//                                 if (err) return rollback(err);

//                                 con.commit(err => {
//                                     if (err) return rollback(err);

//                                     res.status(200).json({
//                                         success: true,
//                                         message,
//                                         ...extra
//                                     });
//                                 });
//                             }
//                         );
//                     }

//                     // ====================================================
//                     // ROLLBACK HELPERS
//                     // ====================================================
//                     function rollback(err) {
//                         console.error(err);
//                         return con.rollback(() => {
//                             res.status(500).json({
//                                 success: false,
//                                 message: err.message
//                             });
//                         });
//                     }

//                     function rollbackMsg(msg) {
//                         return con.rollback(() => {
//                             res.status(400).json({
//                                 success: false,
//                                 message: msg
//                             });
//                         });
//                     }

//                 }
//             );
//         });
//     }
//     catch (error) {
//         return res.status(500).json({
//             success: false,
//             message: error.message
//         });
//     }
// };

// const AllOrderNumbers = async (req, res) => {
//     try {
//         con.query(
//             `SELECT 
//                 o.id AS order_id, 
//                 f.freight_number AS freight_number, 
//                 CONCAT('OR000', o.id) AS order_number
//              FROM tbl_orders AS o
//              LEFT JOIN tbl_freight AS f ON o.freight_id = f.id
//              ORDER BY o.id DESC`,
//             (err, data) => {
//                 if (err) {
//                     return res.status(500).send({
//                         success: false,
//                         message: err.message
//                     });
//                 }

//                 res.status(200).send({
//                     success: true,
//                     data: data
//                 });
//             }
//         );
//     } catch (error) {
//         res.status(500).send({
//             success: false,
//             message: error.message
//         });
//     }
// };

// const AllOrderNumbers = async (req, res) => {
//     try {
//         con.query(
//             `SELECT 
//                 o.id AS order_id, 
//                 f.freight_number AS freight_number, 
//                 CONCAT('OR000', o.id) AS order_number
//              FROM tbl_orders AS o

//              INNER JOIN warehouse_assign_order AS wao 
//                 ON o.id = wao.order_id

//              LEFT JOIN tbl_freight AS f 
//                 ON o.freight_id = f.id

//              ORDER BY o.id DESC`,

//             (err, data) => {
//                 if (err) {
//                     return res.status(500).send({
//                         success: false,
//                         message: err.message
//                     });
//                 }

//                 res.status(200).send({
//                     success: true,
//                     data: data
//                 });
//             }
//         );
//     } catch (error) {
//         res.status(500).send({
//             success: false,
//             message: error.message
//         });
//     }
// };

// const AllOrderNumbers = async (req, res) => {
//     try {
//         const { client_id } = req.query; // or req.params / req.body

//         if (!client_id) {
//             return res.status(400).send({
//                 success: false,
//                 message: "Provide Client ID"
//             })
//         }

//         let query = `
//             SELECT 
//                 o.id AS order_id, 
//                 f.freight_number AS freight_number, 
//                 CONCAT('OR000', o.id) AS order_number
//             FROM tbl_orders AS o

//             INNER JOIN warehouse_assign_order AS wao 
//                 ON o.id = wao.order_id

//             LEFT JOIN tbl_freight AS f 
//                 ON o.freight_id = f.id
//         `;

//         // Apply filter only if client_id is provided
//         if (client_id) {
//             query += ` WHERE o.client_id = ?`;
//         }

//         query += ` ORDER BY o.id DESC`;

//         con.query(query, client_id ? [client_id] : [], (err, data) => {
//             if (err) {
//                 return res.status(500).send({
//                     success: false,
//                     message: err.message
//                 });
//             }

//             res.status(200).send({
//                 success: true,
//                 data: data
//             });
//         });

//     } catch (error) {
//         res.status(500).send({
//             success: false,
//             message: error.message
//         });
//     }
// };

// const AllWarehouseBatchNumbers = async (req, res) => {
//     try {
//         con.query(
//             `SELECT 
//                 b.id AS batch_id, 
//                 b.batch_number AS batch_number
//              FROM batches AS b
//              ORDER BY b.id DESC`,
//             (err, data) => {
//                 if (err) {
//                     return res.status(500).send({
//                         success: false,
//                         message: err.message
//                     });
//                 }

//                 res.status(200).send({
//                     success: true,
//                     data: data
//                 });
//             }
//         );
//     } catch (error) {
//         res.status(500).send({
//             success: false,
//             message: error.message
//         });
//     }
// };

const MoveSupplierWarehouseOrder = (req, res) => {
    const { supplier_warehouse_id, user_id } = req.body;

    if (!supplier_warehouse_id) {
        return res.status(400).json({
            success: false,
            message: "supplier_warehouse_id required"
        });
    }

    con.query(
        `SELECT * FROM supplier_warehouse_orders WHERE id=?`,
        [supplier_warehouse_id],
        (err, dataRows) => {

            if (err) {
                return res.status(500).json({ success: false, message: err.message });
            }

            if (!dataRows.length) {
                return res.status(400).json({ success: false, message: "Record not found" });
            }

            const data = dataRows[0];

            if (data.move_to_adminWarhouse === 1) {
                return res.status(400).json({ success: false, message: "Already moved" });
            }

            // =========================
            // STEP 1: ORDER CHECK / CREATE
            // =========================
            con.query(
                `SELECT * FROM tbl_orders WHERE id=?`,
                [data.order_id],
                (err, orderRows) => {

                    if (err) {
                        return res.status(500).json({ success: false, message: err.message });
                    }

                    if (!orderRows.length) {

                        con.query(
                            `INSERT INTO tbl_orders
                            (client_id, goods_description, dimensions, weight, warehouse_status, cartons, CBM,
                            collection_from, delivery_to, client_name, supplier_id, freight_type, added_by)
                            VALUES (?, ?,?,?,?,?,?,?,?,?,?,?,?)`,
                            [
                                data.client_id,
                                data.goods_description,
                                data.total_cbm,
                                data.total_weight,
                                1,
                                data.total_packages,
                                data.total_cbm,
                                data.collection_from,
                                data.destination_country,
                                data.customer_name,
                                data.supplier_id,
                                null,
                                user_id || 1
                            ],
                            (err, orderResult) => {

                                if (err) {
                                    return res.status(500).json({ success: false, message: err.message });
                                }

                                const order_id = orderResult.insertId;
                                handleWarehouse(order_id);
                            }
                        );

                    } else {
                        handleWarehouse(data.order_id, data);
                    }
                }
            );

            // =========================
            // STEP 2: WAREHOUSE CHECK / CREATE
            // =========================
            function handleWarehouse(order_id, data) {

                con.query(
                    `SELECT id FROM warehouse_assign_order WHERE order_id=? ORDER BY id DESC LIMIT 1`,
                    [order_id],
                    (err, warehouseRows) => {

                        if (err) {
                            return res.status(500).json({ success: false, message: err.message });
                        }

                        if (!warehouseRows.length) {

                            con.query(
                                `INSERT INTO warehouse_assign_order
                                (order_id, warehouse_status, supplier_id,
                                courier_waybill_ref, date_entry_created, dispatched_date,
                                warehouse_comment, customer_ref, box_marking, package_type, hazardous,
                                total_packeges, hazard_description, package_comment,
                                damage_goods, damaged_pkg_qty, damage_comment,
                                supplier_company, supplier_person, supplier_address, supplier_contact_no,
                                batch_id, assign_to_batch,
                                warehouse_order_id, warehouse_collect, costs_to_collect,
                                warehouse_storage, warehouse_cost, handling_required, handling_cost,
                                warehouse_dispatch, cost_to_dispatch, added_by)
                                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,
                                        ?,?,
                                        ?,?,?,?,?,?,?,?,?,?,?)`,
                                [
                                    order_id,
                                    1,
                                    data.supplier_id,
                                    data.courier_waybill_ref,
                                    data.date_entry_created,
                                    data.dispatch_date,
                                    data.warehouse_comment,
                                    data.customer_ref,
                                    data.box_marking,
                                    data.package_type,
                                    data.hazardous,
                                    data.total_packages,
                                    data.hazard_description,
                                    data.package_comment,
                                    data.damaged_goods,
                                    data.damaged_pkg_qty,
                                    data.damage_comment,
                                    data.supplier_company,
                                    data.supplier_person,
                                    data.supplier_address,
                                    data.supplier_contact,
                                    data.batch_id || null,
                                    data.batch_id ? 1 : 0,
                                    data.warehouse_order_id,
                                    data.warehouse_collect,
                                    data.costs_to_collect,
                                    data.warehouse_storage,
                                    data.warehouse_cost,
                                    data.handling_required,
                                    data.handling_cost,
                                    data.warehouse_dispatch,
                                    data.cost_to_dispatch,
                                    user_id || 1
                                ],
                                (err, warehouseResult) => {

                                    if (err) {
                                        return res.status(500).json({ success: false, message: err.message });
                                    }

                                    const warehouseId = warehouseResult.insertId;
                                    moveFilesAndProducts(data, warehouseId, order_id);
                                }
                            );

                            con.query(`UPDATE tbl_orders SET warehouse_status=?, client_name=? WHERE id=?`,
                                [1, data.customer_name, order_id]
                            );

                        } else {

                            const warehouseId = warehouseRows[0].id;
                            moveFilesAndProducts(data, warehouseId, order_id);
                        }
                    }
                );
            }

            // =========================
            // STEP 3: MOVE FILES + PRODUCTS
            // =========================
            function moveFilesAndProducts(data, warehouseId, order_id) {

                con.query(
                    `SELECT * FROM supplier_warehouse_files WHERE supplier_warehouse_id=?`,
                    [supplier_warehouse_id],
                    (err, files) => {

                        if (err) {
                            return res.status(500).json({ success: false, message: err.message });
                        }

                        const fileValues = files.map(f => [
                            warehouseId,
                            f.file_type,
                            f.file_name
                        ]);

                        if (fileValues.length) {
                            con.query(
                                `INSERT INTO warehouse_files (warehouse_id, file_type, file_name) VALUES ?`,
                                [fileValues],
                                (err) => {
                                    if (err) {
                                        return res.status(500).json({ success: false, message: err.message });
                                    }
                                    moveProducts();
                                }
                            );
                        } else {
                            moveProducts();
                        }
                    }
                );

                function moveProducts() {

                    con.query(
                        `SELECT * FROM supplier_warehouse_products WHERE supplier_warehouse_id=?`,
                        [supplier_warehouse_id],
                        (err, products) => {

                            if (err) {
                                return res.status(500).json({ success: false, message: err.message });
                            }

                            if (!products.length) {
                                return res.status(400).json({
                                    success: false,
                                    message: "No products found"
                                });
                            }

                            // ❗ FIXED: REMOVED client_id (NOT IN YOUR TABLE)
                            const values = products.map(p => [
                                data.order_id,          // user_id column (as per your OLD schema)
                                order_id,
                                warehouseId,
                                p.product_description,
                                p.hazardous,
                                p.date_received,
                                p.package_type,
                                p.packages,
                                p.dimension,
                                p.weight,
                                p.warehouse_ref,
                                p.freight,
                                p.groupage_batch_ref,
                                p.supplier,
                                p.warehouse_receipt_number,
                                p.tracking_number,
                                p.date_dispatched,
                                p.supplier_address,
                                p.supplier_email,
                                p.supplier_contact,
                                p.warehouse_collect,
                                p.costs_to_collect,
                                p.port_of_loading,
                                p.warehouse_dispatch,
                                p.warehouse_cost,
                                p.cost_to_dispatch,
                                p.waybill_ref,
                                user_id || 1
                            ]);

                            con.query(
                                `INSERT INTO warehouse_products
                                (user_id, order_id, warehouse_order_id, product_description, Hazardous,
                                date_received, package_type, packages, dimension, weight,
                                warehouse_ref, freight, groupage_batch_ref, supplier,
                                warehouse_receipt_number, tracking_number, date_dspatched,
                                supplier_address, supplier_Email, Supplier_Contact,
                                warehouse_collect, costs_to_collect, port_of_loading,
                                warehouse_dispatch, warehouse_cost, cost_to_dispatch,
                                waybill_ref, added_by)
                                VALUES ?`,
                                [values],
                                (err) => {

                                    if (err) {
                                        return res.status(500).json({ success: false, message: err.message });
                                    }

                                    con.query(
                                        `UPDATE supplier_warehouse_orders 
                                         SET order_id=?, admin_warehouseOrder_id=?, move_to_adminWarhouse=1 
                                         WHERE id=?`,
                                        [order_id, warehouseId, supplier_warehouse_id],
                                        (err) => {

                                            if (err) {
                                                return res.status(500).json({ success: false, message: err.message });
                                            }

                                            return res.status(200).json({
                                                success: true,
                                                message: "Order + Warehouse + Products processed successfully",
                                                order_id,
                                                warehouse_id: warehouseId
                                            });
                                        }
                                    );
                                }
                            );
                        }
                    );
                }
            }
        }
    );
};

const AllOrderNumbers = async (req, res) => {
    try {
        const { client_id } = req.query;

        // Validate client_id
        if (!client_id) {
            return res.status(400).send({
                success: false,
                message: "Provide Client ID"
            });
        }

        const query = `
            SELECT 
                o.id AS order_id, 
                f.freight_number AS freight_number, 
                CONCAT('OR000', o.id) AS order_number
            FROM tbl_orders AS o
            
            LEFT JOIN tbl_freight AS f 
                ON o.freight_id = f.id
            
            WHERE o.client_id = ?
            AND (
                o.track_status IS NULL 
                OR o.track_status = ''
            )
            
            ORDER BY o.id DESC
        `;

        con.query(query, [client_id], (err, data) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: err.message
                });
            }

            return res.status(200).send({
                success: true,
                data: data
            });
        });

    } catch (error) {
        return res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

const AllWarehouseBatchNumbers = async (req, res) => {
    try {
        const query = `
      SELECT 
        b.id AS batch_id,
        b.batch_number,
        b.batch_name   --  groupage number
      FROM batches AS b
      WHERE 
        b.is_deleted = 0
        AND (b.track_status IS NULL OR b.track_status = '')
      ORDER BY b.id DESC
    `;

        con.query(query, (err, data) => {
            if (err) {
                return res.status(500).send({
                    success: false,
                    message: err.message
                });
            }

            res.status(200).send({
                success: true,
                count: data.length,
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

module.exports = {
    AddSupplier, SupplierList, getSupplierList, getWarehouseSupplierList, UpdateSupplier, GetSupplierByid, DeleteSupplier, GetSupplierFreights, LoginSupplier, AssignSuppliersToFreight,
    assignFreightToSupplier, getFreightsBySupplier, getAllAssignedFreightsForAdmin, updateSupplierStatusOfFreight, NewSupplierList, createOrderAndWarehouse, GetSupplierCreatedWarehouseOrders, getSupplierWarehouses,
    addCustomsClearingAgent, getCustomsClearingAgents, getCustomsClearingAgentById, updateCustomsClearingAgent,
    deleteCustomsClearingAgent, addFreightForwarder, getFreightForwarders, getFreightForwarderById, updateFreightForwarder,
    deleteFreightForwarder, addGroupageHandler, getGroupageHandlers, getGroupageHandlerById, updateGroupageHandler, deleteGroupageHandler,
    addTransporter, getTransporters, getTransporterById, updateTransporter, deleteTransporter, GetSupplierProfile,
    UpdateSupplierProfile, GetNotificationSupplier, updateOrderAndWarehouse, AddTask, staffTaskList, supplierTaskList, adminTaskList, addSupplierWarehouseProduct,
    updateSupplierWarehouseProduct, getSupplierWarehouseProducts, adminUpdateSupplierWarehouse, MoveSupplierWarehouseOrder, AllOrderNumbers, AllWarehouseBatchNumbers
}
