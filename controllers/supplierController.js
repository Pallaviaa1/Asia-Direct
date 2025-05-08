const con = require('../config/database');
const { validationResult, Result } = require('express-validator');

const AddSupplier = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    try {
        const { supplier_name, supplier_email } = req.body;
        const selectQuery = `select * from tbl_suppliers where email=? and is_deleted=?`;
        await con.query(selectQuery, [supplier_email, 0], (err, data) => {
            if (err) throw err;
            if (data.length > 0) {
                res.status(400).send({
                    success: false,
                    message: "Email is already exists !"
                })
            }
            else {
                const insertQuery = `insert into tbl_suppliers (name, email) values (?, ?)`;
                con.query(insertQuery, [supplier_name, supplier_email], (err, result) => {
                    if (err) throw err;
                    if (result.affectedRows > 0) {
                        res.status(200).send({
                            success: true,
                            message: "Supplier added successfully"
                        })
                    }
                    else {
                        res.status(400).send({
                            success: false,
                            message: "Failed to add supplier"
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

const SupplierList = async (req, res) => {
    try {
        const selectQuery = `SELECT * FROM tbl_suppliers WHERE is_deleted=? ORDER BY created_at DESC`;
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
                    message: "No list Available"
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

const UpdateSupplier = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    try {
        const { supplier_id, supplier_email, supplier_name } = req.body;
        let sql = "Select * from tbl_suppliers where email = ? AND id <> ? AND is_deleted=?";
        await con.query(sql, [supplier_email, supplier_id, 0], (err, data) => {
            if (err) throw err;
            if (data.length > 0) {
                res.status(400).send({
                    success: false,
                    message: "Email already exists !"
                })
            }
            else {
                const updateQuery = `update tbl_suppliers set name=?, email=? where id=?`;
                con.query(updateQuery, [supplier_name, supplier_email, supplier_id], (err, updateData) => {
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

const GetSupplierFreights = async (req, res) => { 
    try {
        const { supplier_id } = req.body;
        if (!supplier_id) {
            res.status(400).send({
                success: false,
                message: "Please provide supplier id"
            })
        }
        else {
            const sqlQuery = `select  * from tbl_suppliers where id=?`;
            await con.query(sqlQuery, [supplier_id], (err, result) => {
                if (err) throw err;
                if (result.length > 0) {
                    const selectQuery = `SELECT tbl_freight.*, tbl_users.full_name AS client_name, 
                    countries.name AS country_of_origin,
                    tbl_suppliers.name AS assigned 
                    FROM tbl_freight 
                    INNER JOIN tbl_users ON tbl_users.id = tbl_freight.client_id 
                    INNER JOIN countries ON countries.id = tbl_freight.collection_from
                    INNER JOIN tbl_suppliers ON tbl_suppliers.id = tbl_freight.assign_id
                    WHERE tbl_freight.assign_id = ? AND tbl_freight.is_deleted = ? 
                    ORDER BY tbl_freight.created_at DESC`;
                    con.query(selectQuery, [supplier_id, 0], (err, data) => {
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
                                message: "No list available"
                            })
                        }
                    })
                }
                else {
                    res.status(400).send({
                        success: false,
                        message: "User id does not exist"
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
    AddSupplier, SupplierList, UpdateSupplier, GetSupplierByid, DeleteSupplier, GetSupplierFreights
}
