const con = require('../config/database');
const { validationResult, Result } = require('express-validator');
const sendMail = require('../helpers/sendMail')
const rendomString = require('randomstring');
const XLSX = require('xlsx');
const fs = require('fs');

const updateLoadDetails = async (req, res) => {
    try {
        const { order_id, freight_id, date_of_colletion, product_desc, dimension, weight, commerical_invoice, cartons, customs_clearing, cargo_pickup_country,
            cargo_pickup_town, cargo_des_country, cargo_des_town, mode_of_transport, terms, shipper, special_comments, shipper_email,
            shipper_tel, shipper_address, freight_type } = req.body;
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
                const updateQuery = `UPDATE tbl_orders SET goods_description=?, dimensions=?, weight=?, date_of_collection=?, commerical_invoice=?, cartons=?,
                    customs_clearing=?,freight=?,cargo_pickup_country=?,cargo_pickup_town=?,cargo_des_country=?,
                    cargo_des_town=?,mode_of_transport=?, terms=?, shipper=?, special_comments=?, shipper_email=?, 
                    shipper_tel=?, shipper_address=?, freight_type=? WHERE id=?`;

                con.query(updateQuery, [product_desc, dimension, weight, date_of_colletion, commerical_invoice, cartons, customs_clearing, null, cargo_pickup_country,
                    cargo_pickup_town, cargo_des_country, cargo_des_town, mode_of_transport, terms, shipper, special_comments, shipper_email,
                    shipper_tel, shipper_address, freight_type, order_id], (err, result) => {
                        if (err) throw err;
                        if (result.affectedRows > 0) {
                            const updateQuery = `UPDATE tbl_freight SET product_desc=?, dimension=?, weight=?, freight=? WHERE id=?`;

                            con.query(updateQuery, [product_desc, dimension, weight, freight_type, freight_id], (err, result) => {
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
        const { order_id, status, date_dispatched, ETA, actual_delivery_date, freight_option, port_of_loading, port_of_discharge, co_loader, carrier, vessel, master_landing_bill, house_bill_landing, release_type, container_no, seal_no, local_handler, local_carrier,
            driver_name, vehicle_registration, comments, last_check_in, location_check_in, driver_license_id, days_to_arrival } = req.body;
        // console.log(req.body);
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
                        con.query(`UPDATE order_delivery_details SET client_id=?, freight_id=?, status=?, date_dispatched=?, ETA=?,
                        actual_delivery_date=?, freight_option=?, port_of_loading=?, port_of_discharge=?, co_loader=?,
                        carrier=?, vessel=?, master_landing_bill=?, house_bill_landing=?, release_type=?,
                        container_no=?, seal_no=?, local_handler=?, local_carrier=?, driver_name=?, vehicle_registration=?
                        , comments=?, last_check_in=?, location_check_in=?, driver_license_id=?, days_to_arrival=? WHERE id=?`,
                            [data[0].client_id, data[0].freight_id, status, date_dispatched, ETA, actual_delivery_date,
                                freight_option, port_of_loading, port_of_discharge, co_loader, carrier, vessel,
                                master_landing_bill, house_bill_landing, release_type, container_no, seal_no,
                                local_handler, local_carrier,
                                driver_name, vehicle_registration, comments,
                                last_check_in, location_check_in, driver_license_id, days_to_arrival, result[0].id], (err, updateData) => {
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
                        con.query(`INSERT INTO order_delivery_details(order_id, client_id, freight_id, status, date_dispatched, ETA, actual_delivery_date, freight_option, port_of_loading, port_of_discharge, co_loader, carrier, vessel, master_landing_bill, house_bill_landing, release_type, container_no, seal_no, local_handler, local_carrier,
                            driver_name, vehicle_registration, comments, last_check_in, location_check_in, driver_license_id, days_to_arrival) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [order_id, data[0].client_id, data[0].freight_id, status, date_dispatched, ETA, actual_delivery_date, freight_option, port_of_loading, port_of_discharge, co_loader, carrier, vessel, master_landing_bill, house_bill_landing, release_type, container_no, seal_no, local_handler, local_carrier,
                                driver_name, vehicle_registration, comments, last_check_in, location_check_in, driver_license_id, days_to_arrival], (err, InserData) => {
                                    if (err) throw err;
                                    if (InserData.affectedRows > 0) {
                                        return res.status(200).send({
                                            success: true,
                                            message: "Insert delivery details successfully"
                                        })
                                    }
                                    else {
                                        return res.status(400).send({
                                            success: false,
                                            message: "Failed to insert delivery details"
                                        })
                                    }
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
                INNER JOIN tbl_users on tbl_users.id=order_delivery_details.client_id 
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
                validatedRow.client_ref = userId || 0;

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
        const query = `SELECT id AS freight_id, client_ref AS client_id FROM tbl_freight 
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
            batch_name,
            freight_cost,
            costs_to_collect_des,
            costs_to_dispatch_des,
            warehouse_cost_des
        } = req.body;

        const sql = `
            UPDATE batches 
            SET 
                batch_number = ?, 
                warehouse_id = ?, 
                freight = ?, 
                date_start = ?, 
                total_weight = ?, 
                total_dimensions = ?, 
                dispatched = ?, 
                date_dispatch = ?, 
                time_in_storage = ?, 
                costs_to_collect = ?, 
                warehouse_cost = ?, 
                costs_to_dispatch = ?, 
                destination = ?, 
                waybill = ?, 
                agent = ?, 
                forwarding_agent = ?,
                batch_name = ?, 
            freight_cost = ?, 
            costs_to_collect_des = ?, 
            costs_to_dispatch_des = ?, 
            warehouse_cost_des= ?
            WHERE id = ?
        `;

        con.query(sql, [
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
            batch_name,
            freight_cost,
            costs_to_collect_des,
            costs_to_dispatch_des,
            warehouse_cost_des,
            batch_id
        ], (err, result) => {
            if (err) throw err;
            res.status(200).send({ success: true, message: 'Batch details updated successfully' });
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        })
    }
}

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


module.exports = {
    updateLoadDetails, updateDeliveryDetails, GetAllOrdersDetails, GetLoadingDetails,
    GetDeliveryDetails, UploadExcelShipment, UploadExcelShipmentOrder, UploadExcelFullOrderDetails,
    UploadExcelBatch, UploadExcelWarehouse, editBatch, deleteBatche
}