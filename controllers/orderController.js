const con = require('../config/database');
const { validationResult, Result } = require('express-validator');
const sendMail = require('../helpers/sendMail')
const rendomString = require('randomstring');
const XLSX = require('xlsx');
const fs = require('fs');
const moment = require('moment');
const { features } = require('process');
const { log } = require('console');
const { resolve } = require('path');

const updateLoadDetails = async (req, res) => {
    try {
        const { order_id, freight_id, date_of_colletion, CBM, freight_product_desc, freight_dimension, freight_weight, commerical_invoice, cartons, customs_clearing, cargo_pickup_country,
            cargo_pickup_town, cargo_des_country, cargo_des_town, mode_of_transport, terms, shipper, special_comments, shipper_email,
            shipper_tel, shipper_address, freight_freightType } = req.body;


        console.log(req.body);

        if (!order_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide order id"
            })
        }
        if (!date_of_colletion) {
            return res.status(400).send({
                success: false,
                message: "Please enter date of collection"
            })
        }
        if (!cartons) {
            return res.status(400).send({
                success: false,
                message: "please enter cartons"
            })
        }
        await con.query(`select id from tbl_orders where id ='${order_id}'`, (err, data) => {
            if (err) throw err;
            if (data.length > 0) {
                const updateQuery = `UPDATE tbl_orders SET goods_description=?, CBM=?, dimensions=?, weight=?, date_of_collection=?, commerical_invoice=?, cartons=?,
                    customs_clearing=?,freight=?,cargo_pickup_country=?,cargo_pickup_town=?,cargo_des_country=?,
                    cargo_des_town=?,mode_of_transport=?, terms=?, shipper=?, special_comments=?, shipper_email=?, 
                    shipper_tel=?, shipper_address=?, freight_type=? WHERE id=?`;

                con.query(updateQuery, [freight_product_desc, CBM, freight_dimension, freight_weight, date_of_colletion, commerical_invoice, cartons, customs_clearing, null, cargo_pickup_country,
                    cargo_pickup_town, cargo_des_country, cargo_des_town, mode_of_transport, terms, shipper, special_comments, shipper_email,
                    shipper_tel, shipper_address, freight_freightType, order_id], (err, result) => {
                        if (err) throw err;
                        if (result.affectedRows > 0) {
                            const updateQuery = `UPDATE tbl_freight SET product_desc=?, dimension=?, weight=?, freight=? WHERE id=?`;

                            con.query(updateQuery, [freight_product_desc, freight_dimension, freight_weight, freight_freightType, freight_id], (err, result) => {
                                if (err) throw err;
                            })

                            res.status(200).send({
                                success: true,
                                message: "Successfully update loading details"
                            })
                        }
                        else {
                            res.status(400).send({
                                success: false,
                                message: "Failed to update loading details"
                            })
                        }
                    })
            }
            else {
                res.status(400).send({
                    success: false,
                    message: "Order id does not exist"
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

const updateDeliveryDetails = async (req, res) => {
    try {
        const { order_id, status, date_dispatched, ETA, actual_delivery_date, freight_option, port_of_loading, port_of_discharge, Carrier_code, co_loader, carrier, vessel, master_landing_bill, house_bill_landing, release_type, container_no, seal_no, local_handler, local_carrier,
            driver_name, vehicle_registration, comments, last_check_in, location_check_in, driver_license_id, days_to_arrival, Delivery_Instruction, cargo_pickup } = req.body;
        console.log(req.body);
        if (!order_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide order id"
            })
        }
        if (!date_dispatched) {
            return res.status(400).send({
                success: false,
                message: "Please enter date of dispatched"
            })
        }
        if (!ETA) {
            return res.status(400).send({
                success: false,
                message: "Please enter eta"
            })
        }
        if (!actual_delivery_date) {
            return res.status(400).send({
                success: false,
                message: "Please enter actual date of delivery"
            })
        }
        await con.query(`select * from tbl_orders where id='${order_id}'`, (err, data) => {
            if (err) throw err;
            if (data.length > 0) {
                con.query(`select id from order_delivery_details WHERE order_id='${order_id}'`, (err, result) => {
                    if (err) throw err;
                    if (result.length > 0) {
                        //  console.log(data[0].client_id);
                        //  console.log(data[0].freight_id);
                        con.query(`UPDATE order_delivery_details SET client_id=?, Carrier_code=?, freight_id=?, status=?, date_dispatched=?, ETA=?,
                        actual_delivery_date=?, freight_option=?, port_of_loading=?, port_of_discharge=?, co_loader=?,
                        carrier=?, vessel=?, master_landing_bill=?, house_bill_landing=?, release_type=?,
                        container_no=?, seal_no=?, local_handler=?, local_carrier=?, driver_name=?, vehicle_registration=?
                        , comments=?, last_check_in=?, location_check_in=?, driver_license_id=?, days_to_arrival=?, Delivery_Instruction=?, cargo_pickup=? WHERE id=?`,
                            [data[0].client_id, Carrier_code, data[0].freight_id, status, date_dispatched, ETA, actual_delivery_date,
                                freight_option, port_of_loading, port_of_discharge, co_loader, carrier, vessel,
                                master_landing_bill, house_bill_landing, release_type, container_no, seal_no,
                                local_handler, local_carrier,
                                driver_name, vehicle_registration, comments,
                                last_check_in, location_check_in, driver_license_id, days_to_arrival, Delivery_Instruction, cargo_pickup, result[0].id], (err, updateData) => {
                                    if (err) throw err;
                                    if (updateData.affectedRows > 0) {
                                        return res.status(200).send({
                                            success: true,
                                            message: "Update delivery details successfully"
                                        })
                                    }
                                    else {
                                        return res.status(400).send({
                                            success: false,
                                            message: "Failed to update delivery details"
                                        })
                                    }
                                })
                    }
                    else {
                        const query = `
                            INSERT INTO order_delivery_details (
                                order_id, client_id, freight_id, status, date_dispatched, ETA, actual_delivery_date, 
                                freight_option, port_of_loading, port_of_discharge, co_loader, carrier, vessel, 
                                master_landing_bill, house_bill_landing, release_type, container_no, seal_no, 
                                local_handler, local_carrier, driver_name, vehicle_registration, comments, 
                                last_check_in, location_check_in, driver_license_id, days_to_arrival, 
                                Delivery_Instruction, cargo_pickup, Carrier_code
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `;

                        const values = [
                            order_id,
                            data[0].client_id || "",
                            data[0].freight_id || "",
                            status || "",
                            date_dispatched || "",
                            ETA || "",
                            actual_delivery_date || "",
                            freight_option || "",
                            port_of_loading || "",
                            port_of_discharge || "",
                            co_loader || "",
                            carrier || " ",
                            vessel || " ",
                            master_landing_bill || "",
                            house_bill_landing || "",
                            release_type || "",
                            container_no || "",
                            seal_no || "",
                            local_handler || "",
                            local_carrier || "",
                            driver_name || "",
                            vehicle_registration || "",
                            comments || "",
                            last_check_in || "",
                            location_check_in || "",
                            driver_license_id || "",
                            days_to_arrival || "",
                            Delivery_Instruction || "",
                            cargo_pickup || "",
                            Carrier_code || ""
                        ];

                        con.query(query, values, (err, InserData) => {
                            if (err) {
                                console.error("Error inserting delivery details:", err.message);
                                return res.status(500).send({
                                    success: false,
                                    message: "An error occurred while inserting delivery details",
                                    error: err.message,
                                });
                            }

                            if (InserData.affectedRows > 0) {
                                console.log("Delivery details inserted successfully:", InserData);
                                return res.status(200).send({
                                    success: true,
                                    message: "Insert delivery details successfully",
                                });
                            } else {
                                console.warn("Failed to insert delivery details.");
                                return res.status(400).send({
                                    success: false,
                                    message: "Failed to insert delivery details",
                                });
                            }
                        });
                    }

                })
            }
            else {
                res.status(400).send({
                    success: false,
                    message: "Order id doesn't exist"
                })
            }
        })
    }
    catch (error) {
        // console.log(error.message);
        res.status(500).send({
            success: false,
            message: error.message
        })
    }
}

const GetAllOrdersDetails = async (req, res) => {
    try {
        const { order_id } = req.body;
        if (!order_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide order id"
            })
        }
        await con.query(`select * from tbl_orders where id='${order_id}'`, (err, data) => {
            if (err) throw err;
            if (data.length > 0) {
                con.query(`select tbl_orders.*, tbl_orders.id as order_id, tbl_users.full_name, tbl_users.email, tbl_freight.date, 
                tbl_freight.product_desc, tbl_freight.date, tbl_freight.type, tbl_freight.freight, tbl_freight.incoterm, 
                tbl_freight.dimension, tbl_freight.weight, tbl_freight.quote_document, tbl_freight.no_of_packages
                 from tbl_orders
                INNER JOIN tbl_freight on tbl_freight.id=tbl_orders.freight_id
                INNER JOIN tbl_users on tbl_users.id=tbl_orders.client_id
                where tbl_orders.id='${order_id}'`, (err, data) => {
                    if (err) throw err;
                    if (data.length > 0) {
                        //  console.log(data);
                        con.query(`select * from order_delivery_details where order_id='${order_id}'`, (err, result) => {
                            if (err) throw err;
                            // console.log(result);
                            if (result.length > 0) {
                                var values = {
                                    id: data[0].id,
                                    freight_id: data[0].freight_id,
                                    date_of_collection: data[0].date_of_collection,
                                    client_id: data[0].client_id,
                                    commerical_invoice: data[0].commerical_invoice,
                                    cartons: data[0].cartons,
                                    customs_clearing: data[0].customs_clearing,
                                    freight: data[0].freight,
                                    cargo_pickup_country: data[0].cargo_pickup_country,
                                    cargo_pickup_town: data[0].cargo_pickup_town,
                                    cargo_des_country: data[0].cargo_des_country,
                                    cargo_des_town: data[0].cargo_des_town,
                                    mode_of_transport: data[0].mode_of_transport,
                                    terms: data[0].terms,
                                    shipper: data[0].shipper,
                                    special_comments: data[0].special_comments,
                                    shipper_email: data[0].shipper_email,
                                    shipper_tel: data[0].shipper_tel,
                                    shipper_address: data[0].shipper_address,
                                    created_at: data[0].created_at,
                                    updated_at: data[0].updated_at,
                                    order_id: data[0].order_id,
                                    full_name: data[0].full_name,
                                    email: data[0].email,
                                    date: data[0].date,
                                    product_desc: data[0].product_desc,
                                    type: data[0].type,
                                    incoterm: data[0].incoterm,
                                    dimension: data[0].dimension,
                                    weight: data[0].weight,
                                    quote_document: data[0].quote_document,
                                    no_of_packages: data[0].no_of_packages,//
                                    status: result[0].status,
                                    date_dispatched: result[0].date_dispatched,
                                    ETA: result[0].ETA,
                                    actual_delivery_date: result[0].actual_delivery_date,
                                    freight_option: result[0].freight_option,
                                    port_of_loading: result[0].port_of_loading,
                                    port_of_discharge: result[0].port_of_discharge,
                                    co_loader: result[0].co_loader,
                                    carrier: result[0].carrier,
                                    vessel: result[0].vessel,
                                    master_landing_bill: result[0].master_landing_bill,
                                    house_bill_landing: result[0].house_bill_landing,
                                    release_type: result[0].release_type,
                                    container_no: result[0].container_no,
                                    seal_no: result[0].seal_no,
                                    local_handler: result[0].local_handler,
                                    local_carrier: result[0].local_carrier,
                                    driver_name: result[0].driver_name,
                                    vehicle_registration: result[0].vehicle_registration,
                                    comments: result[0].comments,
                                    last_check_in: result[0].last_check_in,
                                    location_check_in: result[0].location_check_in,
                                    driver_license_id: result[0].driver_license_id,
                                }
                                res.status(200).send({
                                    success: true,
                                    data: values
                                })
                            }
                            else {
                                var values = {
                                    id: data[0].id,
                                    freight_id: data[0].freight_id,
                                    date_of_collection: data[0].date_of_collection,
                                    client_id: data[0].client_id,
                                    commerical_invoice: data[0].commerical_invoice,
                                    cartons: data[0].cartons,
                                    customs_clearing: data[0].customs_clearing,
                                    freight: data[0].freight,
                                    cargo_pickup_country: data[0].cargo_pickup_country,
                                    cargo_pickup_town: data[0].cargo_pickup_town,
                                    cargo_des_country: data[0].cargo_des_country,
                                    cargo_des_town: data[0].cargo_des_town,
                                    mode_of_transport: data[0].mode_of_transport,
                                    terms: data[0].terms,
                                    shipper: data[0].shipper,
                                    special_comments: data[0].special_comments,
                                    shipper_email: data[0].shipper_email,
                                    shipper_tel: data[0].shipper_tel,
                                    shipper_address: data[0].shipper_address,
                                    created_at: data[0].created_at,
                                    updated_at: data[0].updated_at,
                                    order_id: data[0].order_id,
                                    full_name: data[0].full_name,
                                    email: data[0].email,
                                    date: data[0].date,
                                    product_desc: data[0].product_desc,
                                    type: data[0].type,
                                    incoterm: data[0].incoterm,
                                    dimension: data[0].dimension,
                                    weight: data[0].weight,
                                    quote_document: data[0].quote_document,
                                    no_of_packages: data[0].no_of_packages,//
                                    status: "",
                                    date_dispatched: "",
                                    ETA: "",
                                    actual_delivery_date: "",
                                    freight_option: "",
                                    port_of_loading: "",
                                    port_of_discharge: "",
                                    co_loader: "",
                                    carrier: "",
                                    vessel: "",
                                    master_landing_bill: "",
                                    house_bill_landing: "",
                                    release_type: "",
                                    container_no: "",
                                    seal_no: "",
                                    local_handler: "",
                                    local_carrier: "",
                                    driver_name: "",
                                    vehicle_registration: "",
                                    comments: "",
                                    last_check_in: "",
                                    location_check_in: "",
                                    driver_license_id: ""
                                }
                                res.status(200).send({
                                    success: true,
                                    data: values
                                })
                            }

                        })

                    }
                    else {
                        res.status(400).send({
                            success: false,
                            message: "No List available"
                        })
                    }
                })
            }
            else {
                res.status(400).send({
                    success: false,
                    message: "Order id doesn't exist"
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

const GetLoadingDetails = async (req, res) => {
    try {
        const { order_id } = req.body;
        if (!order_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide order id"
            })
        }
        await con.query(`select * from tbl_orders where id='${order_id}'`, (err, data) => {
            if (err) throw err;
            if (data.length > 0) {
                con.query(`select tbl_orders.*, tbl_orders.goods_description as product_desc,  tbl_orders.dimensions as dimension, tbl_freight.product_desc as freight_product_desc,
                    tbl_freight.freight as freight_freightType, tbl_freight.dimension as freight_dimension, tbl_freight.weight as freight_weight  from tbl_orders
                    LEFT JOIN tbl_freight ON tbl_freight.id = tbl_orders.freight_id
                    where tbl_orders.id='${order_id}'`, (err, data) => {
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
                            message: "No List available"
                        })
                    }
                })
            }
            else {
                res.status(400).send({
                    success: false,
                    message: "Order id doesn't exist"
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

const GetDeliveryDetails = async (req, res) => {
    try {
        const { order_id } = req.body;
        if (!order_id) {
            return res.status(400).send({
                success: false,
                message: "Please provide order id"
            })
        }
        await con.query(`select * from tbl_orders where id='${order_id}'`, (err, data) => {
            if (err) throw err;
            if (data.length > 0) {
                con.query(`select order_delivery_details.*, tbl_users.full_name from order_delivery_details
                LEFT JOIN tbl_users on tbl_users.id=order_delivery_details.client_id 
                where order_id='${order_id}'`, (err, data) => {
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
                            message: "No List available"
                        })
                    }
                })
            }
            else {
                res.status(400).send({
                    success: false,
                    message: "Order id doesn't exist"
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



const fieldMapping = {
    'Serial Number': 'serial_number',
    'Product Description': 'product_desc',
    'Date': 'date',
    'Type': 'type',
    'Freight': 'freight',
    'Incoterm': 'incoterm',
    'Dimension': 'dimension',
    'Weight': 'weight',
    'Quote Received': 'quote_received',
    'Client Quoted': 'client_quoted',
    'Status': 'status',
    'Comment': 'comment',
    'No. of Packages': 'no_of_packages',
    'Package Type': 'package_type',
    'Commodity': 'commodity',
    'Hazardous': 'hazardous',
    'Industry': 'industry',
    'Country': 'collection_from',
    'Place of Receipt / Supplier Address': 'supplier_address',
    'Port of Loading': 'port_of_loading',
    'Port of Discharge': 'post_of_discharge',
    'Place of Delivery': 'place_of_delivery',
    'Ready for Collection': 'ready_for_collection',
    'Frequency from Port of Loading': 'loading_frequency',
    'Estimated Transit Time': 'transit_time',
    'Contact': 'contact',
    'Client Name': 'client_name'
};

// Convert Excel serial date to JavaScript Date
const excelDateToJSDate = (excelDate) => {
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + (excelDate - 1) * 86400000).toISOString().split('T')[0];
};

const statusMapping = {
    'Pending': 0,
    'Accepted': 1,
    'Declined': 2,
    'Partial': 3
};

const getCountryIdByName = async (countryName) => {
    return new Promise((resolve, reject) => {
        con.query('SELECT id FROM countries WHERE LOWER(name) = LOWER(?)', [countryName], (err, rows) => {
            if (err) {
                // console.error('Error fetching country ID:', err);
                reject(err);
            } else {
                resolve(rows.length > 0 ? rows[0].id : null);
            }
        });
    });
};

const validateAndTransformData = async (row) => {
    const transformedRow = {};
    for (const [excelField, dbField] of Object.entries(fieldMapping)) {
        let value = row[excelField] !== undefined && row[excelField] !== null ? row[excelField] : '';

        // Handle date formatting
        if (excelField === 'Date') {
            if (typeof value === 'number') {
                value = excelDateToJSDate(value);
            } else if (typeof value === 'string') {
                const [month, day, year] = value.split('-').map(num => parseInt(num, 10));
                if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
                    const dateObject = new Date(year, month - 1, day);
                    value = dateObject.toISOString().split('T')[0];
                } else {
                    // console.error(`Invalid date format: ${value}`);
                    value = '';
                }
            } else if (value instanceof Date) {
                value = value.toISOString().split('T')[0];
            } else {
                // console.error(`Unexpected type for date value: ${typeof value}`);
                value = '';
            }
        }

        if (excelField === 'Status' && value in statusMapping) {
            value = statusMapping[value];
        }

        transformedRow[dbField] = value;
    }

    // Fetch and assign country ID based on country name
    const countryId = await getCountryIdByName(transformedRow.collection_from);
    transformedRow.collection_from = countryId || 0; // Use 0 if no match is found

    transformedRow.added_by = 1; // Assuming this field should be statically set
    return transformedRow;
};

const generateFreightNumber = async (lastFreightNumber) => {
    let sequenceNumber = 1;
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0'); // Months are zero-indexed

    if (lastFreightNumber) {
        const lastYearMonth = lastFreightNumber.slice(2, 8); // Extract the year and month (e.g., '202406')
        const currentYearMonth = `${year}${month}`;

        if (lastYearMonth === currentYearMonth) {
            const lastSequencePart = parseInt(lastFreightNumber.slice(-3)); // Extract last 3 digits
            sequenceNumber = lastSequencePart + 1;
        }
    }

    // Format the freight number as F-YYYYMMNNN
    return `F-${year}${month}${sequenceNumber.toString().padStart(3, '0')}`;
};

const getUserIdByContact = async (contact) => {
    return new Promise((resolve, reject) => {
        con.query('SELECT id FROM tbl_users WHERE cellphone = ?', [contact], (err, rows) => {
            if (err) {
                // console.error('Error fetching user ID:', err);
                reject(err);
            } else {
                resolve(rows.length > 0 ? rows[0].id : null);
            }
        });
    });
};

const UploadExcelShipment = async (req, res) => {
    const file = req.file;
    if (!file) {
        return res.status(400).send({ success: false, message: 'No file uploaded' });
    }

    const workbook = XLSX.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    try {
        let lastFreightNumber = null;
        // Fetch the last freight number before processing the rows
        const [rows] = await new Promise((resolve, reject) => {
            con.query('SELECT freight_number FROM tbl_freight ORDER BY id DESC LIMIT 1', (err, rows) => {
                if (err) {
                    // console.error('Error fetching last freight number:', err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });

        if (rows && rows.length > 0) {
            lastFreightNumber = rows[0].freight_number;
        }

        const transformedData = [];
        for (const row of data) {
            try {
                // console.log(row);

                const validatedRow = await validateAndTransformData(row);
                const freightNumber = await generateFreightNumber(lastFreightNumber);
                lastFreightNumber = freightNumber; // Update lastFreightNumber for next iteration
                validatedRow.freight_number = freightNumber;

                const userId = await getUserIdByContact(validatedRow.contact);
                validatedRow.client_id = userId || 0;

                // Explicitly remove 'contact' field before inserting into database
                delete validatedRow.contact;

                // Add to transformed data array
                transformedData.push(validatedRow);
            } catch (error) {
                // console.error('Validation error:', error.message);
            }
        }

        // Insert data into database
        for (const row of transformedData) {
            const query = 'INSERT INTO tbl_freight SET ?';
            await new Promise((resolve, reject) => {
                con.query(query, row, (error) => {
                    if (error) {
                        // console.error('Error inserting data:', error);
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });
        }

        fs.unlink(file.path, (err) => {
            if (err) console.error('Error deleting file:', err);
        });

        const checkQuery = `SELECT * FROM All_Upload_Excel WHERE file_type="Freight_Excel"`;
        const [uploadRows] = await new Promise((resolve, reject) => {
            con.query(checkQuery, (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });

        if (uploadRows.length === 0) {
            const insertUploadQuery = 'INSERT INTO All_Upload_Excel (file, file_type) VALUES (?, ?)';
            await new Promise((resolve, reject) => {
                con.query(insertUploadQuery, [req.file.filename, "Freight_Excel"], (error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });
        } else {
            const updateUploadQuery = 'UPDATE All_Upload_Excel SET file = ? WHERE file_type = "Freight_Excel"';
            await new Promise((resolve, reject) => {
                con.query(updateUploadQuery, [req.file.filename], (error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });
        }

        res.status(200).send({ success: true, message: 'File uploaded and data inserted' });
    } catch (error) {
        // console.error('Unexpected error:', error.message);
        res.status(500).send({ success: false, message: error.message });
    }
};

const OrderfieldMapping = {
    'Trans Serial': 'trans_serial',
    'Trans Reference': 'trans_reference',
    'Date of collection': 'date_of_collection',
    'Upload Commercial Invoice': 'commerical_invoice',
    'Cartons': 'cartons',
    'Customs Clearing': 'customs_clearing',
    'Freight': 'freight',
    'Cargo Pick up_Country': 'cargo_pickup_country',
    'Cargo Pick up_Town': 'cargo_pickup_town',
    'Cargo Destination_Country': 'cargo_des_country',
    'Cargo Destination_Town': 'cargo_des_town',
    'Mode of Transport': 'mode_of_transport',
    'Terms': 'terms',
    'Shipper': 'shipper',
    'Special Comments': 'special_comments',
    'Shipper email': 'shipper_email',
    'Shipper Tel': 'shipper_tel',
    'Shipper address': 'shipper_address',
    'Dimensions (Cbm)': 'dimensions',
    'Weight (Kgs)': 'weight',
    'Client Name': 'client_name',
    'Goods Description': 'goods_description'
};

// Convert Excel serial date to JavaScript Date
const excelDateJSDate = (excelDate) => {
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + (excelDate - 1) * 86400000).toISOString().split('T')[0];
};

// Validate and transform data according to field mapping
const validateAndTransformOrderData = async (row) => {
    const transformedRow = {};
    for (const [excelField, dbField] of Object.entries(OrderfieldMapping)) {
        let value = row[excelField] !== undefined && row[excelField] !== null ? row[excelField] : '';

        // Handle date formatting for 'Date of collection'
        if (excelField === 'Date of collection') {
            if (typeof value === 'number') {
                // Convert Excel serial date to JavaScript Date
                value = excelDateJSDate(value);
            } else if (typeof value === 'string') {
                // Handle the case where the value is a string in the expected format
                const [month, day, year] = value.split('-').map(num => parseInt(num, 10));
                if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
                    const dateObject = new Date(year, month - 1, day);
                    value = dateObject.toISOString().split('T')[0]; // Format: 'YYYY-MM-DD'
                } else {
                    // console.error(`Invalid date format: ${value}`);
                    value = ''; // Set to empty string or handle error as needed
                }
            } else if (value instanceof Date) {
                // Handle case where the value is already a Date object
                value = value.toISOString().split('T')[0]; // Format: 'YYYY-MM-DD'
            } else {
                // console.error(`Unexpected type for date value: ${typeof value}`);
                value = ''; // Set to empty string or handle error as needed
            }
        }

        transformedRow[dbField] = value;
    }
    return transformedRow;
};

const getFreightIdAndClientId = async (clientName, goodsDescription) => {
    // Replace undefined values with empty strings
    const safeClientName = clientName || '';
    const safeGoodsDescription = goodsDescription || '';

    return new Promise((resolve, reject) => {
        const query = `SELECT id AS freight_id, client_id AS client_id FROM tbl_freight 
                       WHERE client_name = ? AND product_desc = ?`;
        con.query(query, [safeClientName, safeGoodsDescription], (err, rows) => {
            if (err) {
                // console.error('Error fetching freight_id and client_id:', err);
                reject(err);
            } else {
                resolve(rows.length > 0 ? rows[0] : { freight_id: 0, client_id: 0 });
            }
        });
    });
};

const UploadExcelShipmentOrder = async (req, res) => {
    const file = req.file;
    if (!file) {
        return res.status(400).send({ success: false, message: 'No file uploaded' });
    }

    const workbook = XLSX.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    try {
        const transformedData = [];
        for (const row of data) {
            try {
                const validatedRow = await validateAndTransformOrderData(row);

                const clientName = row['Client Name'];
                const goodsDescription = row['Goods Description'];

                const { freight_id, client_id } = await getFreightIdAndClientId(clientName, goodsDescription);
                validatedRow.freight_id = freight_id;
                validatedRow.client_id = client_id;
                transformedData.push(validatedRow);
            } catch (error) {
                // console.error('Validation error:', error.message);
                // Continue processing the next row even if validation fails for the current row
                transformedData.push(row); // Add the raw row data
            }
        }

        // Insert data into database
        for (const row of transformedData) {
            const query = 'INSERT INTO tbl_orders SET ?';
            await new Promise((resolve, reject) => {
                con.query(query, row, (error) => {
                    if (error) {
                        // console.error('Error inserting data:', error);
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });
        }

        fs.unlink(file.path, (err) => {
            if (err) console.error('Error deleting file:', err);
        });
        con.query(`SELECT * FROM All_Upload_Excel WHERE file_type = "Order_Excel"`, (err, rows) => {
            if (err) throw err;

            if (rows.length === 0) {
                // Insert new record if not found
                const query = 'INSERT INTO All_Upload_Excel (file, file_type) VALUES (?, ?)';
                con.query(query, [req.file.filename, "Order_Excel"], (error) => {
                    if (error) throw error;
                });
            } else {
                // Update the existing record
                const query = 'UPDATE All_Upload_Excel SET file = ? WHERE file_type = "Order_Excel"';
                con.query(query, [req.file.filename], (error) => {
                    if (error) throw error;
                });
            }
        });
        res.send({ success: true, message: 'File uploaded and data inserted' });
    } catch (error) {
        // console.error('Unexpected error:', error.message);
        res.status(500).send({ success: false, message: error.message });
    }
};

const FullOrderFieldMapping = {
    'Trans Reference': 'trans_reference',
    'Status': 'status',
    'Date Dispatched': 'date_dispatched',
    'ETA': 'ETA',
    'Actual Date of Delivery': 'actual_delivery_date',
    'Freight Option': 'freight_option',
    'Port of Loading': 'port_of_loading',
    'Port of Discharge': 'port_of_discharge',
    'Co-Loader': 'co_loader',
    'Carrier': 'carrier',
    'Vessel': 'vessel',
    'Master Bill of Lading': 'master_landing_bill',
    'House Bill of Lading': 'house_bill_landing',
    'Release Type': 'release_type',
    'Container No': 'container_no',
    'Seal No': 'seal_no',
    'Local Handler': 'local_handler',
    'Local Carrier': 'local_carrier',
    'Driver Name': 'driver_name',
    'Vehicle Registration': 'vehicle_registration',
    'Comments': 'comments',
    'Last check-in': 'last_check_in',
    'Location Check-in': 'location_check_in',
    'Driver License / ID': 'driver_license_id',
    'Days to arrival': 'days_to_arrival'
};

const excelDateJSDates = (excelDate) => {
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + (excelDate - 1) * 86400000).toISOString().split('T')[0];
};

const validateAndTransformFullOrderData = async (row) => {
    const transformedRow = {};
    for (const [excelField, dbField] of Object.entries(FullOrderFieldMapping)) {
        let value = row[excelField] !== undefined && row[excelField] !== null ? row[excelField] : '';

        // Handle date formatting
        if (['Date Dispatched', 'Actual Date of Delivery', 'ETA'].includes(excelField)) {
            if (typeof value === 'number') {
                value = excelDateJSDates(value);
            } else if (typeof value === 'string') {
                const [month, day, year] = value.split('-').map(num => parseInt(num, 10));
                if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
                    const dateObject = new Date(year, month - 1, day);
                    value = dateObject.toISOString().split('T')[0];
                } else {
                    // console.error(`Invalid date format: ${value}`);
                    value = '';
                }
            } else if (value instanceof Date) {
                value = value.toISOString().split('T')[0];
            } else {
                // console.error(`Unexpected type for date value: ${typeof value}`);
                value = '';
            }
        }

        transformedRow[dbField] = value;
    }
    return transformedRow;
};

const getOrderID = async (trans_reference) => {
    return new Promise((resolve, reject) => {
        const query = `SELECT id AS order_id, freight_id, client_id FROM tbl_orders WHERE trans_reference = ?`;
        con.query(query, [trans_reference], (err, rows) => {
            if (err) {
                // console.error('Error fetching order_id:', err);
                reject(err);
            } else {
                resolve(rows.length > 0 ? rows[0] : { order_id: 0 });
            }
        });
    });
};

const UploadExcelFullOrderDetails = async (req, res) => {
    const file = req.file;
    if (!file) {
        return res.status(400).send({ success: false, message: 'No file uploaded' });
    }

    const workbook = XLSX.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    try {
        const transformedData = [];
        for (const row of data) {
            try {
                const validatedRow = await validateAndTransformFullOrderData(row);

                const trans_reference = row['Trans Reference'];
                const { freight_id, client_id, order_id } = await getOrderID(trans_reference);

                validatedRow.freight_id = freight_id;
                validatedRow.client_id = client_id;
                validatedRow.order_id = order_id;
                transformedData.push(validatedRow);
            } catch (error) {
                // console.error('Validation error:', error.message);
                // Add the raw row data in case of validation error
                transformedData.push(row);
            }
        }

        // Insert data into database
        for (const row of transformedData) {
            const query = 'INSERT INTO order_delivery_details SET ?';
            await new Promise((resolve, reject) => {
                con.query(query, row, (error) => {
                    if (error) {
                        // console.error('Error inserting data:', error);
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });
        }

        fs.unlink(file.path, (err) => {
            if (err) console.error('Error deleting file:', err);
        });

        res.send({ success: true, message: 'File uploaded and data inserted' });
    } catch (error) {
        // console.error('Unexpected error:', error.message);
        res.status(500).send({ success: false, message: error.message });
    }
};


const BatchFieldMapping = {
    'Groupage Batch number': 'batch_number',
    'Freight': 'freight',
    'Date Start': 'date_start',
    'Total Weight': 'total_weight',
    'Total Dimensions': 'total_dimensions',
    'Dispatched': 'dispatched',
    'Date Dispatch': 'date_dispatch',
    'Time in Storage': 'time_in_storage',
    'Costs to Collect': 'costs_to_collect',
    'Warehouse Cost': 'warehouse_cost',
    'Costs to Dispatch': 'costs_to_dispatch',
    'Destination': 'destination',
    'Waybill / Bill of lading': 'waybill',
    'Agent': 'agent',
    'Forwarding Agent': 'forwarding_agent'
};

const excelDateJSDatesData = (excelDate) => {
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + (excelDate - 1) * 86400000).toISOString().split('T')[0];
};

const validateAndTransformBatchData = async (row) => {
    const transformedRow = {};
    for (const [excelField, dbField] of Object.entries(BatchFieldMapping)) {
        let value = row[excelField] !== undefined && row[excelField] !== null ? row[excelField] : '';

        // Handle date formatting
        if (['Date Start', 'Date Dispatch'].includes(excelField)) {
            if (typeof value === 'number') {
                value = excelDateJSDatesData(value);
            } else if (typeof value === 'string') {
                const [month, day, year] = value.split('-').map(num => parseInt(num, 10));
                if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
                    const dateObject = new Date(year, month - 1, day);
                    value = dateObject.toISOString().split('T')[0];
                } else {
                    // console.error(`Invalid date format: ${value}`);
                    value = '';
                }
            } else if (value instanceof Date) {
                value = value.toISOString().split('T')[0];
            } else {
                // console.error(`Unexpected type for date value: ${typeof value}`);
                value = '';
            }
        }

        transformedRow[dbField] = value;
    }
    return transformedRow;
};

const UploadExcelBatch = async (req, res) => {
    const file = req.file;
    if (!file) {
        return res.status(400).send({ success: false, message: 'No file uploaded' });
    }

    const workbook = XLSX.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    try {
        const transformedData = [];
        for (const row of data) {
            try {
                const validatedRow = await validateAndTransformBatchData(row);
                transformedData.push(validatedRow);
            } catch (error) {
                // console.error('Validation error:', error.message);
                transformedData.push(row);
            }
        }

        // Insert data into database
        for (const row of transformedData) {
            const queryCheck = 'SELECT COUNT(*) AS count FROM batches WHERE batch_number = ?';
            const batchNumber = row.batch_number;

            const batchExists = await new Promise((resolve, reject) => {
                con.query(queryCheck, [batchNumber], (error, results) => {
                    if (error) {
                        // console.error('Error checking batch number:', error);
                        reject(error);
                    } else {
                        resolve(results[0].count > 0);
                    }
                });
            });

            if (batchExists) {
                // console.log(`Duplicate batch number found: ${batchNumber}. Skipping insertion.`);
                continue;
            }

            const queryInsert = 'INSERT INTO batches SET ?';
            await new Promise((resolve, reject) => {
                con.query(queryInsert, row, (error) => {
                    if (error) {
                        // console.error('Error inserting data:', error);
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });
        }

        fs.unlink(file.path, (err) => {
            if (err) console.error('Error deleting file:', err);
        });
        con.query(`SELECT * FROM All_Upload_Excel WHERE file_type = "Batch_Excel"`, (err, rows) => {
            if (err) throw err;

            if (rows.length === 0) {
                // Insert new record if not found
                const query = 'INSERT INTO All_Upload_Excel (file, file_type) VALUES (?, ?)';
                con.query(query, [req.file.filename, "Batch_Excel"], (error) => {
                    if (error) throw error;
                });
            } else {
                // Update the existing record
                const query = 'UPDATE All_Upload_Excel SET file = ? WHERE file_type = "Batch_Excel"';
                con.query(query, [req.file.filename], (error) => {
                    if (error) throw error;
                });
            }
        });
        res.send({ success: true, message: 'File uploaded and data inserted' });
    } catch (error) {
        // console.error('Unexpected error:', error.message);
        res.status(500).send({ success: false, message: error.message });
    }
};

const WarehouseFieldMapping = {
    'Serial Number': 'serial_number',
    'Groupage Batch Reference': 'batch_number',
    'Warehouse Receipt Number': 'ware_receipt_no',
    'Tracking number': 'tracking_number',
    'Date Received': 'date_received',
    'Warehouse Collect': 'warehouse_collect'
};

const validateAndTransformWarehouseData = async (row) => {
    const transformedRow = {};
    for (const [excelField, dbField] of Object.entries(WarehouseFieldMapping)) {
        let value = row[excelField] !== undefined && row[excelField] !== null ? row[excelField] : '';

        // Handle date formatting
        if (excelField === 'Date Received') {
            if (typeof value === 'number') {
                value = excelDateJSDatesData(value); // Assuming this is a function to convert Excel date to JS date
            } else if (typeof value === 'string') {
                const [month, day, year] = value.split('-').map(num => parseInt(num, 10));
                if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
                    const dateObject = new Date(year, month - 1, day);
                    value = dateObject.toISOString().split('T')[0];
                } else {
                    // console.error(`Invalid date format: ${value}`);
                    value = '';
                }
            } else if (value instanceof Date) {
                value = value.toISOString().split('T')[0];
            } else {
                // console.error(`Unexpected type for date value: ${typeof value}`);
                value = '';
            }
        }

        transformedRow[dbField] = value;
    }
    return transformedRow;
};

const UploadExcelWarehouse = async (req, res) => {
    const file = req.file;
    if (!file) {
        return res.status(400).send({ success: false, message: 'No file uploaded' });
    }

    const workbook = XLSX.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    try {
        const transformedData = [];
        for (const row of data) {
            try {
                const validatedRow = await validateAndTransformWarehouseData(row);
                transformedData.push(validatedRow);
            } catch (error) {
                // console.error('Validation error:', error.message);
                transformedData.push(row);
            }
        }

        // Insert data into database
        for (const row of transformedData) {
            // Fetch order_id and freight_id from tbl_orders
            const querySelectOrder = 'SELECT id as order_id, freight_id FROM tbl_orders WHERE trans_serial = ?';
            const serialNumber = row.serial_number;

            const orderData = await new Promise((resolve, reject) => {
                con.query(querySelectOrder, [serialNumber], (error, results) => {
                    if (error) {
                        // console.error('Error fetching order data:', error);
                        reject(error);
                    } else if (results.length === 0) {
                        // console.log(`No matching order found for serial number: ${serialNumber}`);
                        resolve(null);
                    } else {
                        resolve(results[0]);
                    }
                });
            });

            if (!orderData) {
                continue; // Skip insertion if no matching order data is found
            }

            // Fetch batch_id from tbl_batch
            const querySelectBatch = 'SELECT id as batch_id, warehouse_id FROM batches WHERE batch_number = ?';
            const batchNumber = row.batch_number;

            const batchData = await new Promise((resolve, reject) => {
                con.query(querySelectBatch, [batchNumber], (error, results) => {
                    if (error) {
                        // console.error('Error fetching batch data:', error);
                        reject(error);
                    } else if (results.length === 0) {
                        // console.log(`No matching batch found for batch number: ${batchNumber}`);
                        resolve(null);
                    } else {
                        resolve(results[0]);
                    }
                });
            });

            if (!batchData) {
                continue; // Skip insertion if no matching batch data is found
            }

            const queryInsert = 'INSERT INTO warehouse_assign_order SET ?';
            const insertData = {
                order_id: orderData.order_id,
                freight_id: orderData.freight_id,
                batch_id: batchData.batch_id,
                warehouse_id: batchData.warehouse_id,
                ware_receipt_no: row.ware_receipt_no,
                tracking_number: row.tracking_number,
                date_received: row.date_received,
                warehouse_collect: row.warehouse_collect,
                warehouse_status: 1
            };

            await new Promise((resolve, reject) => {
                con.query(queryInsert, insertData, (error) => {
                    if (error) {
                        // console.error('Error inserting data:', error);
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });
        }

        fs.unlink(file.path, (err) => {
            if (err) console.error('Error deleting file:', err);
        });
        con.query(`SELECT * FROM All_Upload_Excel WHERE file_type = "Warehouse_Excel"`, (err, rows) => {
            if (err) throw err;

            if (rows.length === 0) {
                // Insert new record if not found
                const query = 'INSERT INTO All_Upload_Excel (file, file_type) VALUES (?, ?)';
                con.query(query, [req.file.filename, "Warehouse_Excel"], (error) => {
                    if (error) throw error;
                });
            } else {
                // Update the existing record
                const query = 'UPDATE All_Upload_Excel SET file = ? WHERE file_type = "Warehouse_Excel"';
                con.query(query, [req.file.filename], (error) => {
                    if (error) throw error;
                });
            }
        });
        res.send({ success: true, message: 'File uploaded and data inserted' });
    } catch (error) {
        // console.error('Unexpected error:', error.message);
        res.status(500).send({ success: false, message: error.message });
    }
};

const editBatch = async (req, res) => {
    try {
        const {
            batch_id,
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

        const sql = `
            UPDATE batches 
            SET 
                batch_number = ?, 
                warehouse_id = ?, 
                date_first_received = ?, 
                ETD = ?, 
                total_days_storage = ?, 
                batch_name = ?, 
                is_exporImport = ?, 
                freight = ?, 
                freight_option = ?, 
                freight_speed = ?, 
                collection_warehouse = ?, 
                delivery_warehouse = ?, 
                origin_country_id = ?, 
                detination_country_id = ?, 
                port_loading = ?, 
                port_discharge = ?, 
                collection_address = ?, 
                delivery_address = ?, 
                origin_handler = ?, 
                des_handler = ?, 
                costs_to_collect = ?, 
                warehouse_cost = ?, 
                origin_doc_costs = ?, 
                origin_oncarriage_costs = ?, 
                origin_Incidental_costs = ?, 
                costs_to_collect_des = ?, 
                warehouse_cost_des = ?, 
                des_doc_costs = ?, 
                des_oncarriage_costs = ?, 
                des_Incidental_costs = ?, 
                freight_cost = ?, 
                no_of_shipments = ?, 
                nature_of_good = ?, 
                type_of_packaging = ?, 
                total_boxes = ?, 
                volumentric_weight = ?, 
                total_weight = ?, 
                total_dimensions = ?, 
                master_waybill = ?, 
                house_waybill = ?, 
                carrier = ?, 
                vessel = ?, 
                container_no = ?, 
                devy_port_of_loading = ?, 
                devy_port_of_discharge = ?, 
                devy_final_des = ?, 
                origin_carrier = ?, 
                des_carrier = ?, 
                registration_number = ?, 
                comment = ?
            WHERE id = ?
        `;

        con.query(sql, [
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
            comment || null,
            batch_id
        ], (err, result) => {
            if (err) throw err;

            console.log(req.file);

            if (req.file) {
                const updateQuery = `UPDATE batches SET attachment = ? WHERE id = ?`;
                con.query(updateQuery, [req.file.filename, batch_id], (err, updateData) => {
                    if (err) {
                        throw err;
                    }
                });
            } else {
                console.log('No file provided for update.');
            }

            res.status(200).send({ success: true, message: 'Batch details updated successfully' });
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
};

const deleteBatche = async (req, res) => {
    try {
        const { batch_id } = req.body;

        const sql = 'DELETE FROM batches WHERE id = ?';

        con.query(sql, [batch_id], (err, result) => {
            if (err) throw err;
            res.status(200).send({ success: true, message: 'Batch deleted successfully' });
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        })
    }
}


const fieldMappingData = {
    'A': 'document_number',
    'B': 'customer_name',
    'C': 'customer_ref',
    'D': 'date',
    'E': 'total'
};

// Helper function to parse dates
const parseDate = (dateString) => {
    if (!dateString) return null;
    if (!isNaN(dateString)) {
        return moment('1899-12-30').add(Number(dateString), 'days').format('YYYY-MM-DD');
    }

    const possibleFormats = ['DD/MM/YYYY', 'MM-DD-YYYY', 'YYYY/MM/DD', 'YYYY-MM-DD', 'DD-MM-YYYY'];
    for (const format of possibleFormats) {
        const parsedDate = moment(dateString, format, true);
        if (parsedDate.isValid()) return parsedDate.format('YYYY-MM-DD');
    }
    return null;
};

// Validate and transform data
const validateAndTransformDatas = async (row) => {
    const transformedRow = {};
    for (const [excelField, dbField] of Object.entries(fieldMappingData)) {
        transformedRow[dbField] = dbField === 'date' ? parseDate(row[excelField]) : (row[excelField] || '');
    }
    return transformedRow;
};

// Upload and insert data while skipping duplicates
const UploadSageInvoiceLlist = async (req, res) => {
    const file = req.file;
    console.log(file)
    if (!file) return res.status(400).send({ success: false, message: 'No file uploaded' });

    const workbook = XLSX.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: ['A', 'B', 'C', 'D', 'E'], defval: '' });
    console.log(data);

    try {
        let transformedData = [];

        for (const row of data) {
            try {
                const validatedRow = await validateAndTransformDatas(row);
                const isAllEmpty = Object.values(validatedRow).every(value => value === '' || value === null);
                if (!isAllEmpty) {
                    transformedData.push(validatedRow);
                } else {
                    console.log('Skipping empty row:', row);
                }
            } catch (error) {
                console.error('Validation error:', error.message);
            }
        }

        // Skip duplicates before inserting
        const uniqueData = [];
        const seen = new Set();

        for (const row of transformedData) {
            if (!seen.has(row.document_number)) {
                seen.add(row.document_number);
                uniqueData.push(row);
            } else {
                console.log('Duplicate skipped:', row.document_number);
            }
        }

        // Insert unique data into the database
        for (const row of uniqueData) {
            const insertQuery = 'INSERT INTO sage_invoice_list SET ?';
            con.query(insertQuery, row, (err) => {
                if (err) console.error('Error inserting data:', err.message, 'Data:', row);
                else console.log('Row inserted:', row);
            });
        }

        fs.unlink(file.path, (err) => {
            if (err) console.error('Error deleting file', err);
        });

        res.send({ success: true, message: 'File uploaded and data inserted (duplicates skipped)' });

    } catch (error) {
        res.status(500).send({ success: false, message: error.message });
    }
};



/* const GetSageInvoiceList = async (req, res) => {
    try {
        const { order_ID, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        // let offset = 0
        let query;
        let countQuery;
        let queryParams = [];
        let countParams = [];

        if (order_ID) {
            // Get only available sage_invoice_id except those assigned to other orders (except the current one)
            query = `
                SELECT * FROM sage_invoice_list 
                WHERE id NOT IN (
                    SELECT DISTINCT sage_invoice_id FROM tbl_orders 
                    WHERE sage_invoice_id IS NOT NULL AND id != ?
                ) 
                OR id = (SELECT sage_invoice_id FROM tbl_orders WHERE id = ?) 
                ORDER BY document_number DESC 
                LIMIT ? OFFSET ?;
            `;
            countQuery = `
                SELECT COUNT(*) AS total FROM sage_invoice_list 
                WHERE id NOT IN (
                    SELECT DISTINCT sage_invoice_id FROM tbl_orders 
                    WHERE sage_invoice_id IS NOT NULL AND id != ?
                ) 
                OR id = (SELECT sage_invoice_id FROM tbl_orders WHERE id = ?);
            `;
            queryParams = [order_ID, order_ID, parseInt(limit), parseInt(offset)];
            countParams = [order_ID, order_ID];
        } else {
            // If no order_ID, count all sage invoices
            query = `SELECT * FROM sage_invoice_list ORDER BY document_number DESC LIMIT ? OFFSET ?;`;
            countQuery = `SELECT COUNT(*) AS total FROM sage_invoice_list;`;
            queryParams = [parseInt(limit), parseInt(offset)];
        }

        // Execute count query first
        con.query(countQuery, countParams, (err, countResult) => {
            if (err) {
                console.error("Database error (count query):", err.message);
                return res.status(500).send({ success: false, message: "Database query failed." });
            }

            const totalRecords = countResult[0].total;
            const totalPages = Math.ceil(totalRecords / limit);

            // Execute main data query
            con.query(query, queryParams, (err, data) => {
                if (err) {
                    console.error("Database error:", err.message);
                    return res.status(500).send({ success: false, message: "Database query failed." });
                }

                res.status(200).send({
                    success: true,
                    data,
                    pagination: {
                        totalRecords,
                        totalPages,
                        currentPage: parseInt(page),
                        pageSize: parseInt(limit),
                    }
                });
            });
        });

    } catch (error) {
        console.error("Unexpected error:", error.message);
        res.status(500).send({ success: false, message: "An unexpected error occurred." });
    }
}; */

const GetSageInvoiceList = async (req, res) => {
    try {
        const { order_ID, search, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        let query;
        let countQuery;
        let queryParams = [];
        let countParams = [];

        let searchCondition = "";
        if (search) {
            searchCondition = `AND (customer_name LIKE ? OR document_number LIKE ? OR customer_ref LIKE ?)`;
        }

        if (order_ID) {
            // Get available sage_invoice_id except those assigned to other orders
            query = `
                SELECT * FROM sage_invoice_list 
                WHERE (id NOT IN (
                    SELECT DISTINCT sage_invoice_id FROM tbl_orders 
                    WHERE sage_invoice_id IS NOT NULL AND id != ?
                ) OR id = (SELECT sage_invoice_id FROM tbl_orders WHERE id = ?))
                ${search ? searchCondition : ""}
                ORDER BY document_number DESC 
                LIMIT ? OFFSET ?;
            `;

            countQuery = `
                SELECT COUNT(*) AS total FROM sage_invoice_list 
                WHERE (id NOT IN (
                    SELECT DISTINCT sage_invoice_id FROM tbl_orders 
                    WHERE sage_invoice_id IS NOT NULL AND id != ?
                ) OR id = (SELECT sage_invoice_id FROM tbl_orders WHERE id = ?))
                ${search ? searchCondition : ""};
            `;

            queryParams = search
                ? [order_ID, order_ID, `%${search}%`, `%${search}%`, `%${search}%`, parseInt(limit), parseInt(offset)]
                : [order_ID, order_ID, parseInt(limit), parseInt(offset)];

            countParams = search
                ? [order_ID, order_ID, `%${search}%`, `%${search}%`, `%${search}%`]
                : [order_ID, order_ID];
        } else {
            // Fetch all invoices with optional search
            query = `
                SELECT * FROM sage_invoice_list 
                WHERE 1 ${search ? searchCondition : ""}
                ORDER BY document_number DESC 
                LIMIT ? OFFSET ?;
            `;

            countQuery = `
                SELECT COUNT(*) AS total FROM sage_invoice_list 
                WHERE 1 ${search ? searchCondition : ""};
            `;

            queryParams = search
                ? [`%${search}%`, `%${search}%`, `%${search}%`, parseInt(limit), parseInt(offset)]
                : [parseInt(limit), parseInt(offset)];

            countParams = search
                ? [`%${search}%`, `%${search}%`, `%${search}%`]
                : [];
        }

        // Execute count query first
        con.query(countQuery, countParams, (err, countResult) => {
            if (err) {
                console.error("Database error (count query):", err.message);
                return res.status(500).json({ success: false, message: "Database query failed." });
            }

            const totalRecords = countResult[0].total;
            const totalPages = Math.ceil(totalRecords / limit);

            // Execute main data query
            con.query(query, queryParams, (err, data) => {
                if (err) {
                    console.error("Database error:", err.message);
                    return res.status(500).json({ success: false, message: "Database query failed." });
                }

                res.status(200).json({
                    success: true,
                    data,
                    pagination: {
                        totalRecords,
                        totalPages,
                        currentPage: parseInt(page),
                        pageSize: parseInt(limit),
                    }
                });
            });
        });

    } catch (error) {
        console.error("Unexpected error:", error.message);
        res.status(500).json({ success: false, message: "An unexpected error occurred." });
    }
};

const fieldMappingDatalist = {
    'A': 'date',
    'B': 'bank_ref',
    'C': 'description_on_receipt',
    'D': 'receipt'
};

// Helper function to parse dates
const ParseDate = (dateString) => {
    if (!dateString) return null;

    if (!isNaN(dateString)) {
        return moment('1899-12-30').add(Number(dateString), 'days').format('YYYY-MM-DD');
    }

    const possibleFormats = ['DD/MM/YYYY', 'MM-DD-YYYY', 'YYYY/MM/DD', 'YYYY-MM-DD', 'DD-MM-YYYY'];
    for (const format of possibleFormats) {
        const parsedDate = moment(dateString, format, true);
        if (parsedDate.isValid()) {
            return parsedDate.format('YYYY-MM-DD');
        }
    }

    return null;
};

// Validate and transform data
const validateandTransformDatas = async (row) => {
    const transformedRow = {};

    for (const [excelField, dbField] of Object.entries(fieldMappingDatalist)) {
        if (dbField === 'date') {
            transformedRow[dbField] = ParseDate(row[excelField]);
        } else {
            transformedRow[dbField] = row[excelField] !== undefined && row[excelField] !== null ? row[excelField] : '';
        }
    }

    // Convert receipt value to a number
    const receiptValue = parseFloat(transformedRow.receipt) || 0;

    if (receiptValue < 0) {
        transformedRow.payment = receiptValue; // Store the exact negative value
        transformedRow.receipt = ''; // Clear receipt field
    } else {
        transformedRow.payment = ''; // Clear payment field
    }

    return transformedRow;
};


const UploadCashbookList = async (req, res) => {
    const file = req.file;
    if (!file) {
        return res.status(400).send({ success: false, message: 'No file uploaded' });
    }

    const workbook = XLSX.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: "A" });

    try {
        const transformedData = [];
        for (const row of data) {
            try {
                const validatedRow = await validateandTransformDatas(row);

                // Skip rows where all fields are empty
                const isAllEmpty = Object.values(validatedRow).every(value => value === '' || value === null);
                if (!isAllEmpty) {
                    transformedData.push(validatedRow);
                } else {
                    console.log('Skipping row with all empty columns:', row);
                }
            } catch (error) {
                console.error('Validation error:', error.message);
            }
        }

        // Insert data into tbl_cashbook
        for (const row of transformedData) {
            const query = 'INSERT INTO tbl_cashbook SET ?';
            con.query(query, row, (error, results) => {
                if (error) {
                    console.error('Error inserting data:', error.message, 'Data:', row);
                } else {
                    console.log('Row inserted successfully:', row);
                }
            });
        }

        // Delete uploaded file after processing
        fs.unlink(file.path, (err) => {
            if (err) console.error('Error deleting file', err);
        });

        // Insert or update the file record in All_Upload_Excel
        con.query(`SELECT * FROM All_Upload_Excel WHERE file_type = "Cashbook_Excel"`, (err, rows) => {
            if (err) throw err;

            if (rows.length === 0) {
                con.query('INSERT INTO All_Upload_Excel (file, file_type) VALUES (?, ?)', [req.file.filename, "Cashbook_Excel"], (error) => {
                    if (error) throw error;
                });
            } else {
                con.query('UPDATE All_Upload_Excel SET file = ? WHERE file_type = "Cashbook_Excel"', [req.file.filename], (error) => {
                    if (error) throw error;
                });
            }
        });

        res.send({ success: true, message: 'File uploaded and data inserted' });
    } catch (error) {
        res.status(500).send({ success: false, message: error.message });
    }
};


const GetCashbookList = async (req, res) => {
    try {
        const { page = 1, limit = 10, search } = req.query;
        const offset = (page - 1) * limit;
        let queryParams = [parseInt(limit), parseInt(offset)];
        let countParams = [];

        let searchCondition = "";
        if (search) {
            searchCondition = `WHERE bank_ref LIKE ? OR description_on_receipt LIKE ? OR receipt LIKE ? OR payment LIKE ?`;
            queryParams = [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, parseInt(limit), parseInt(offset)];
            countParams = [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`];
        }

        // Query to fetch paginated results
        const query = `
            SELECT * FROM tbl_cashbook 
            ${search ? searchCondition : ""}
            ORDER BY id DESC 
            LIMIT ? OFFSET ?;
        `;

        // Query to get total records count
        const countQuery = `
            SELECT COUNT(*) AS total FROM tbl_cashbook 
            ${search ? searchCondition : ""};
        `;

        // First, get the total record count
        con.query(countQuery, countParams, (err, countResult) => {
            if (err) {
                console.error("Database error (count query):", err.message);
                return res.status(500).json({ success: false, message: "Database query failed." });
            }

            const totalRecords = countResult[0].total;
            const totalPages = Math.ceil(totalRecords / limit);

            // Now, fetch paginated data
            con.query(query, queryParams, (err, data) => {
                if (err) {
                    console.error("Database error:", err.message);
                    return res.status(500).json({ success: false, message: "Database query failed." });
                }

                res.status(200).json({
                    success: true,
                    data,
                    pagination: {
                        totalRecords,
                        totalPages,
                        currentPage: parseInt(page),
                        pageSize: parseInt(limit),
                    }
                });
            });
        });

    } catch (error) {
        console.error("Unexpected error:", error.message);
        res.status(500).json({ success: false, message: "An unexpected error occurred." });
    }
};

const GetSageInvoiceDetails = async (req, res) => {
    try {
        const { sage_invoice_id } = req.body;
        const query = `SELECT * FROM sage_invoice_list where id='${sage_invoice_id}'`;
        con.query(query, (err, data) => {
            if (err) throw err;
            res.status(200).send({ success: true, data: data[0] });
        });
    } catch (error) {
        res.status(500).send({ success: false, message: error.message });
    }
}

const checkNumber = async (req, res) => {
    try {
        const { str } = req.body;
        const result = (str) => {
            let str1 = str.toString()
            let RevStr = str.split("").reverse().join("")
            if (RevStr == str1) {
                return true
            }
            else {
                return false
            }
        }
        let resData = result(str)
        if (resData === true) {
            res.send("Palindrom")
        }
        else {
            res.send("not palindrom")
        }

    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        })
    }
}


const TransactionAllocation = async (req, res) => {
    try {
        const { date, userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "User ID is required."
            });
        }

        const currentDate = new Date();
        const currentYearMonth = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;
        const selectedYearMonth = date ? date : currentYearMonth;

        const dateRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
        if (!dateRegex.test(selectedYearMonth)) {
            return res.status(400).json({
                success: false,
                message: "Invalid date format. Please provide 'YYYY-MM'."
            });
        }

        // Query to calculate previous balance
        const query = `
        SELECT 
            COALESCE((SELECT SUM(i.invoice_amt) 
                      FROM tbl_invoices i 
                      WHERE i.client_id = ? 
                      AND DATE_FORMAT(i.date, '%Y-%m') < ?), 0) 
            - 
            COALESCE((SELECT SUM(c.receipt) 
                      FROM tbl_cashbook c 
                      WHERE c.customer_id = ? 
                      AND DATE_FORMAT(c.date, '%Y-%m') < ?
                      AND c.order_id IS NOT NULL), 0) 
            AS prev_balance`;

        con.query(query, [userId, selectedYearMonth, userId, selectedYearMonth], (err, result) => {
            if (err) {
                console.error("Database Error:", err);
                return res.status(500).json({
                    success: false,
                    message: "Failed to fetch previous balance.",
                    error: err.sqlMessage || err.message
                });
            }

            const prevBalance = result[0]?.prev_balance ?? 0;
            let transactions = [];

            // Push opening balance as first entry
            transactions.push({
                description: "Opening Balance",
                date: null,
                Debit: 0,
                Credit: 0,
                order_id: null,
                balance: prevBalance
            });

            // Query to fetch invoices and cashbook transactions sorted by date
            const transactionQuery = `
            (SELECT  CASE 
        WHEN invoice_amt > 0 THEN 'Debit'  
        ELSE 'Credit' 
    END AS description, date AS date, invoice_amt AS Debit, 0 AS Credit, null AS order_id
             FROM tbl_invoices 
             WHERE client_id = ? 
             AND DATE_FORMAT(date, '%Y-%m') = ?)
            
            UNION ALL
            
            (SELECT 
                CASE 
    WHEN c.receipt < 0 THEN 'Debit'  
    ELSE 'Credit'
END AS description, 
c.date, 
CASE 
    WHEN c.receipt < 0 THEN ABS(c.receipt) 
    ELSE 0 
END AS Debit,
CASE 
    WHEN c.receipt > 0 THEN c.receipt 
    ELSE 0 
END AS Credit
,
                c.order_id
            FROM tbl_cashbook c
            WHERE c.customer_id = ?  
            AND DATE_FORMAT(c.date, '%Y-%m') = ? 
            AND c.order_id IS NOT NULL)

            ORDER BY date ASC;
            `;

            con.query(transactionQuery, [userId, selectedYearMonth, userId, selectedYearMonth], (err, transactionsResult) => {
                if (err) {
                    console.error("Database Error:", err);
                    return res.status(500).json({
                        success: false,
                        message: "Failed to fetch transactions.",
                        error: err.sqlMessage || err.message
                    });
                }

                let runningBalance = prevBalance;

                transactionsResult.forEach(entry => {
                    runningBalance += entry.Debit;
                    runningBalance -= entry.Credit;
                    entry.balance = runningBalance;
                    transactions.push(entry);
                });

                const outstandingBalance = transactions.length > 0 ? transactions[transactions.length - 1].balance : 0;

                res.status(200).json({
                    success: true,
                    data: transactions,
                    outstanding_balance: outstandingBalance
                });
            });
        });

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};


/* const AddOrUpdateBookingInstruction = async (req, res) => {
    try {
        const {
            id, // booking_instruction_id for update (if present)
            order_id,
            bk_shipper, bk_ship_add, bk_ship_contact, bk_ship_tel_email, bk_ship_poNo,
            bk_ship_custCode, bk_ship_regNum, bk_ship_refNo, bk_consignee, bk_consg_add,
            bk_consg_notfParty, bk_consg_ContPersn, bk_consg_tel, bk_consg_portDischg,
            bk_xdoc_provider, bk_comm_Invoice, bk_count_CommInv, bk_packing_list,
            bk_custm_doc, bk_trasprt_doc, bk_MSDS, bk_CuntyTrd_SADC, bk_letter_credit,
            bk_track_contPersn, bk_podDoc_contPersn, bk_exprt_modTransport, bk_comTerm_sales,
            bk_Instru_origin, bk_Instru_des, bk_Insur_cover, bk_estim_supp, bk_estim_ref,
            bk_org_exptCharge, bk_charges_destination, bk_intenFreig_charge, bk_duties_taxes, bk_hazard_cargo,
            bk_cargo_packed, bk_battery_MSDS, bk_cnsolid_mulShipp, bk_preship_insp,
            bk_export_Import, bk_coll_dddress, bk_opening_times, bk_conName_tel,
            bk_loading_facilities, bk_desc_goods, bk_handling_req
        } = req.body;
        console.log(req.body);

        if (id) {
            // 🟢 UPDATE
            const updateQuery = `
                UPDATE booking_instruction SET
                    order_id=?, bk_shipper=?, bk_ship_add=?, bk_ship_contact=?, bk_ship_tel_email=?, bk_ship_poNo=?,
                    bk_ship_custCode=?, bk_ship_regNum=?, bk_ship_refNo=?, bk_consignee=?, bk_consg_add=?,
                    bk_consg_notfParty=?, bk_consg_ContPersn=?, bk_consg_tel=?, bk_consg_portDischg=?,
                    bk_xdoc_provider=?, bk_comm_Invoice=?, bk_count_CommInv=?, bk_packing_list=?,
                    bk_custm_doc=?, bk_trasprt_doc=?, bk_MSDS=?, bk_CuntyTrd_SADC=?, bk_letter_credit=?,
                    bk_track_contPersn=?, bk_podDoc_contPersn=?, bk_exprt_modTransport=?, bk_comTerm_sales=?,
                    bk_Instru_origin=?, bk_Instru_des=?, bk_Insur_cover=?, bk_estim_supp=?, bk_estim_ref=?,
                    bk_org_exptCharge=?, bk_charges_destination=?, bk_intenFreig_charge=?, bk_duties_taxes=?, bk_hazard_cargo=?,
                    bk_cargo_packed=?, bk_battery_MSDS=?, bk_cnsolid_mulShipp=?, bk_preship_insp=?,
                    bk_export_Import=?, bk_coll_dddress=?, bk_opening_times=?, bk_conName_tel=?,
                    bk_loading_facilities=?, bk_desc_goods=?, bk_handling_req=?
                WHERE id=?
            `;

            const values = [
                order_id, bk_shipper, bk_ship_add, bk_ship_contact, bk_ship_tel_email, bk_ship_poNo,
                bk_ship_custCode, bk_ship_regNum, bk_ship_refNo, bk_consignee, bk_consg_add,
                bk_consg_notfParty, bk_consg_ContPersn, bk_consg_tel, bk_consg_portDischg,
                bk_xdoc_provider, bk_comm_Invoice, bk_count_CommInv, bk_packing_list,
                bk_custm_doc, bk_trasprt_doc, bk_MSDS, bk_CuntyTrd_SADC, bk_letter_credit,
                bk_track_contPersn, bk_podDoc_contPersn, bk_exprt_modTransport, bk_comTerm_sales,
                bk_Instru_origin, bk_Instru_des, bk_Insur_cover, bk_estim_supp, bk_estim_ref,
                bk_org_exptCharge, bk_charges_destination, bk_intenFreig_charge, bk_duties_taxes, bk_hazard_cargo,
                bk_cargo_packed, bk_battery_MSDS, bk_cnsolid_mulShipp, bk_preship_insp,
                bk_export_Import, bk_coll_dddress, bk_opening_times, bk_conName_tel,
                bk_loading_facilities, bk_desc_goods, bk_handling_req,
                id // for WHERE id=?
            ];

            con.query(updateQuery, values, (err, result) => {
                if (err) throw err;
                if (result.affectedRows > 0) {
                    res.status(200).send({
                        success: true,
                        message: "Booking instruction updated successfully"
                    });
                } else {
                    res.status(400).send({
                        success: false,
                        message: "No booking instruction found to update"
                    });
                }
            });
        } else {
            // 🟢 INSERT
            const insertQuery = `
                INSERT INTO booking_instruction (
                    order_id, bk_shipper, bk_ship_add, bk_ship_contact, bk_ship_tel_email, bk_ship_poNo, bk_ship_custCode, bk_ship_regNum, bk_ship_refNo, bk_consignee, 
                    bk_consg_add, bk_consg_notfParty, bk_consg_ContPersn, bk_consg_tel, bk_consg_portDischg, bk_xdoc_provider, bk_comm_Invoice, bk_count_CommInv, bk_packing_list, bk_custm_doc,
                    bk_trasprt_doc, bk_MSDS, bk_CuntyTrd_SADC, bk_letter_credit,
                    bk_track_contPersn, bk_podDoc_contPersn, bk_exprt_modTransport, bk_comTerm_sales, bk_Instru_origin, bk_Instru_des, bk_Insur_cover, bk_estim_supp, bk_estim_ref,
                    bk_org_exptCharge, bk_charges_destination, bk_intenFreig_charge, bk_duties_taxes, bk_hazard_cargo,
                    bk_cargo_packed, bk_battery_MSDS, 
                    bk_cnsolid_mulShipp, bk_preship_insp,
                    bk_export_Import, bk_coll_dddress, bk_opening_times, bk_conName_tel,
                    bk_loading_facilities, bk_desc_goods, bk_handling_req 
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?, ?
                )
            `;

            const values = [
                order_id, bk_shipper, bk_ship_add, bk_ship_contact, bk_ship_tel_email, bk_ship_poNo,
                bk_ship_custCode, bk_ship_regNum, bk_ship_refNo, bk_consignee, bk_consg_add,
                bk_consg_notfParty, bk_consg_ContPersn, bk_consg_tel, bk_consg_portDischg,
                bk_xdoc_provider, bk_comm_Invoice, bk_count_CommInv, bk_packing_list,
                bk_custm_doc, bk_trasprt_doc, bk_MSDS, bk_CuntyTrd_SADC, bk_letter_credit,
                bk_track_contPersn, bk_podDoc_contPersn, bk_exprt_modTransport, bk_comTerm_sales,
                bk_Instru_origin, bk_Instru_des, bk_Insur_cover, bk_estim_supp, bk_estim_ref,
                bk_org_exptCharge, bk_charges_destination, bk_intenFreig_charge, bk_duties_taxes, bk_hazard_cargo,
                bk_cargo_packed, bk_battery_MSDS, bk_cnsolid_mulShipp, bk_preship_insp,
                bk_export_Import, bk_coll_dddress, bk_opening_times, bk_conName_tel,
                bk_loading_facilities, bk_desc_goods, bk_handling_req
            ].map(v => (v != null ? v : ""));


            con.query(insertQuery, values, (err, result) => {
                if (err) throw err;
                if (result.affectedRows > 0) {
                    res.status(200).send({
                        success: true,
                        message: "Booking instruction added successfully"
                    });
                } else {
                    res.status(400).send({
                        success: false,
                        message: "Failed to add booking instruction"
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
 */

const AddOrUpdateBookingInstruction = async (req, res) => {
    try {
        const {
            order_id, // check by this
            bk_shipper, bk_ship_add, bk_ship_contact, bk_ship_tel_email, bk_ship_poNo,
            bk_ship_custCode, bk_ship_regNum, bk_ship_refNo, bk_consignee, bk_consg_add,
            bk_consg_notfParty, bk_consg_ContPersn, bk_consg_tel, bk_consg_portDischg,
            bk_xdoc_provider, bk_comm_Invoice, bk_count_CommInv, bk_packing_list,
            bk_custm_doc, bk_trasprt_doc, bk_MSDS, bk_CuntyTrd_SADC, bk_letter_credit,
            bk_track_contPersn, bk_podDoc_contPersn, bk_exprt_modTransport, bk_comTerm_sales,
            bk_Instru_origin, bk_Instru_des, bk_Insur_cover, bk_estim_supp, bk_estim_ref,
            bk_org_exptCharge, bk_charges_destination, bk_intenFreig_charge, bk_duties_taxes, bk_hazard_cargo,
            bk_cargo_packed, bk_battery_MSDS, bk_cnsolid_mulShipp, bk_preship_insp,
            bk_export_Import, bk_coll_dddress, bk_opening_times, bk_conName_tel,
            bk_loading_facilities, bk_desc_goods, bk_handling_req
        } = req.body;

        // Ensure all values fallback to empty string if null/undefined
        const values = [
            order_id, bk_shipper, bk_ship_add, bk_ship_contact, bk_ship_tel_email, bk_ship_poNo,
            bk_ship_custCode, bk_ship_regNum, bk_ship_refNo, bk_consignee, bk_consg_add,
            bk_consg_notfParty, bk_consg_ContPersn, bk_consg_tel, bk_consg_portDischg,
            bk_xdoc_provider, bk_comm_Invoice, bk_count_CommInv, bk_packing_list,
            bk_custm_doc, bk_trasprt_doc, bk_MSDS, bk_CuntyTrd_SADC, bk_letter_credit,
            bk_track_contPersn, bk_podDoc_contPersn, bk_exprt_modTransport, bk_comTerm_sales,
            bk_Instru_origin, bk_Instru_des, bk_Insur_cover, bk_estim_supp, bk_estim_ref,
            bk_org_exptCharge, bk_charges_destination, bk_intenFreig_charge, bk_duties_taxes, bk_hazard_cargo,
            bk_cargo_packed, bk_battery_MSDS, bk_cnsolid_mulShipp, bk_preship_insp,
            bk_export_Import, bk_coll_dddress, bk_opening_times, bk_conName_tel,
            bk_loading_facilities, bk_desc_goods, bk_handling_req
        ].map(v => v != null ? v : "");

        // Check if booking_instruction exists for order_id
        con.query(`SELECT id FROM booking_instruction WHERE order_id = ?`, [order_id], (err, rows) => {
            if (err) throw err;

            if (rows.length > 0) {
                // UPDATE existing record
                const updateQuery = `
                    UPDATE booking_instruction SET
                        bk_shipper=?, bk_ship_add=?, bk_ship_contact=?, bk_ship_tel_email=?, bk_ship_poNo=?,
                        bk_ship_custCode=?, bk_ship_regNum=?, bk_ship_refNo=?, bk_consignee=?, bk_consg_add=?,
                        bk_consg_notfParty=?, bk_consg_ContPersn=?, bk_consg_tel=?, bk_consg_portDischg=?,
                        bk_xdoc_provider=?, bk_comm_Invoice=?, bk_count_CommInv=?, bk_packing_list=?,
                        bk_custm_doc=?, bk_trasprt_doc=?, bk_MSDS=?, bk_CuntyTrd_SADC=?, bk_letter_credit=?,
                        bk_track_contPersn=?, bk_podDoc_contPersn=?, bk_exprt_modTransport=?, bk_comTerm_sales=?,
                        bk_Instru_origin=?, bk_Instru_des=?, bk_Insur_cover=?, bk_estim_supp=?, bk_estim_ref=?,
                        bk_org_exptCharge=?, bk_charges_destination=?, bk_intenFreig_charge=?, bk_duties_taxes=?, bk_hazard_cargo=?,
                        bk_cargo_packed=?, bk_battery_MSDS=?, bk_cnsolid_mulShipp=?, bk_preship_insp=?,
                        bk_export_Import=?, bk_coll_dddress=?, bk_opening_times=?, bk_conName_tel=?,
                        bk_loading_facilities=?, bk_desc_goods=?, bk_handling_req=?
                    WHERE order_id=?
                `;
                const updateValues = values.slice(1).concat(order_id); // skip order_id for SET, but pass it in WHERE
                con.query(updateQuery, updateValues, (err, result) => {
                    if (err) throw err;
                    res.status(200).send({ success: true, message: "Booking instruction updated successfully" });
                });
            } else {
                // INSERT new record
                const insertQuery = `
                    INSERT INTO booking_instruction (
                        order_id, bk_shipper, bk_ship_add, bk_ship_contact, bk_ship_tel_email, bk_ship_poNo, bk_ship_custCode, bk_ship_regNum, bk_ship_refNo, bk_consignee, 
                        bk_consg_add, bk_consg_notfParty, bk_consg_ContPersn, bk_consg_tel, bk_consg_portDischg, bk_xdoc_provider, bk_comm_Invoice, bk_count_CommInv, bk_packing_list, bk_custm_doc,
                        bk_trasprt_doc, bk_MSDS, bk_CuntyTrd_SADC, bk_letter_credit,
                        bk_track_contPersn, bk_podDoc_contPersn, bk_exprt_modTransport, bk_comTerm_sales, bk_Instru_origin, bk_Instru_des, bk_Insur_cover, bk_estim_supp, bk_estim_ref,
                        bk_org_exptCharge, bk_charges_destination, bk_intenFreig_charge, bk_duties_taxes, bk_hazard_cargo,
                        bk_cargo_packed, bk_battery_MSDS, 
                        bk_cnsolid_mulShipp, bk_preship_insp,
                        bk_export_Import, bk_coll_dddress, bk_opening_times, bk_conName_tel,
                        bk_loading_facilities, bk_desc_goods, bk_handling_req
                    ) VALUES (
                        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
                        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
                        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?, ?, ?, ?, ?
                    )
                `;
                con.query(insertQuery, values, (err, result) => {
                    if (err) throw err;
                    res.status(200).send({ success: true, message: "Booking instruction added successfully" });
                });
            }
        });
    } catch (error) {
        res.status(500).send({ success: false, message: error.message });
    }
};

const GetBookingInstructionById = (req, res) => {
    const { order_id } = req.body;

    if (!order_id) {
        return res.status(400).send({
            success: false,
            message: "Booking instruction order_id is required"
        });
    }

    const query = "SELECT * FROM booking_instruction WHERE order_id = ?";

    con.query(query, [order_id], (err, result) => {
        if (err) {
            return res.status(500).send({
                success: false,
                message: err.message
            });
        }

        if (result.length > 0) {
            res.status(200).send({
                success: true,
                data: result[0]
            });
        } else {
            res.status(400).send({
                success: false,
                message: "Booking instruction not found"
            });
        }
    });
};


module.exports = {
    updateLoadDetails, updateDeliveryDetails, GetAllOrdersDetails, GetLoadingDetails,
    GetDeliveryDetails, UploadExcelShipment, UploadExcelShipmentOrder, UploadExcelFullOrderDetails,
    UploadExcelBatch, UploadExcelWarehouse, editBatch, deleteBatche, UploadSageInvoiceLlist, GetSageInvoiceList, UploadCashbookList,
    GetCashbookList, GetSageInvoiceDetails, checkNumber, TransactionAllocation, AddOrUpdateBookingInstruction, GetBookingInstructionById
}