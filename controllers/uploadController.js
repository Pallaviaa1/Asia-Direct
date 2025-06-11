const { google } = require('googleapis');
const path = require('path');
const { findOrCreateFolder, uploadFile } = require('../helpers/uploadDrive')
const con = require('../config/database');
const sendMail = require('../helpers/sendMail')

const UploadDocuments = async (req, res) => {
    const { FreightNumber } = req.body;
    const file = req.file;

    if (!FreightNumber || !file) {
        return res.status(400).send({ success: false, message: 'Transaction number and file are required' });
    }

    try {
        // Step 1: Find or create folder
        const folderId = await findOrCreateFolder(FreightNumber);

        // Step 2: Upload file to folder
        const { fileId, webViewLink } = await uploadFile(folderId, file.path, file.originalname);

        // Step 3: Save in DB
        const query = `
            INSERT INTO transaction_files 
            (freight_number, file_name, drive_file_id, file_link) 
            VALUES (?, ?, ?, ?)
        `;
        const values = [FreightNumber, file.originalname, fileId, webViewLink];
        await con.query(query, values);

        // Step 4: Success response
        return res.status(200).send({
            success: true,
            message: 'File uploaded and recorded successfully!',
            fileId,
            webViewLink,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send({
            success: false,
            message: error.message,
        });
    }
};


const AttachedShippingEstimate = async (req, res) => {
    const { freight_id, clearing_id } = req.body; // Transaction number from request
    const file = req.file; // Uploaded file
    console.log(file);

    if (!file) {
        return res.status(400).json({
            success: false,
            message: 'file are required',
        });
    }

    try {
        if (freight_id) {
            const updateQuery = `UPDATE tbl_freight SET attachment_Estimate = ? WHERE id = ?`;
            const updateParams = [file.filename, freight_id];

            // Execute the update query correctly
            const result = await con.query(updateQuery, updateParams);
            const selectQuery = `SELECT tbl_freight.freight_number, tbl_freight.client_id, us.full_name as sales_full_name, us.email as sale_email, u.full_name
                FROM tbl_freight
                INNER JOIN tbl_users as us ON us.id = tbl_freight.sales_representative
                INNER JOIN tbl_users as u ON u.id = tbl_freight.client_id
                WHERE tbl_freight.id = ?`;

            con.query(selectQuery, [freight_id], async (err, result) => {
                if (err) {
                    console.error("Error fetching freight number:", err);
                    return;
                }
                const freightNumber = result[0].freight_number;
                const Email = result[0].sale_email;  // send email to sales person
                const mailSubject = 'Estimate Issued';
                const content = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; background-color: #f9f9f9;">
            <h2 style="color: #2c3e50; border-bottom: 1px solid #ccc; padding-bottom: 10px;">Estimate Issued</h2>
        
            <p style="font-size: 16px; color: #333;">
              Hi <strong>${result[0].sales_full_name}</strong>,
            </p>
        
            <p style="font-size: 16px; color: #333;">
              Quote as attached has been issued for <strong>${result[0].full_name}</strong>.<br>
<strong>Freight Number:</strong> ${freightNumber}.<br>
Please forward this estimate to the client.

            </p>
        
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        
            <p style="font-size: 14px; color: #777;">
              Regards,<br>
              <strong>Management System</strong>
            </p>
          </div>
        `;

                sendMail(Email, mailSubject, content);
                const Subfolder = "Order Quotations"
                /* const folderId = await findOrCreateFolder(freightNumber, Subfolder);
                console.log(`📂 Folder ID: ${folderId}`);
                console.log(file);

                const { fileId, webViewLink } = await uploadFile(folderId.subfolderId, file); */
            })
            return res.status(200).json({
                success: true,
                message: "Attachment updated successfully",
                updated_freight_id: freight_id
            });
        }
        else {
            const updateQuery = `UPDATE tbl_clearance SET attachment_Estimate = ? WHERE id = ?`;
            const updateParams = [file.filename, clearing_id];

            // Execute the update query correctly
            const result = await con.query(updateQuery, updateParams);
            const selectQuery = `SELECT clearance_number FROM tbl_clearance WHERE id = ?`;

            con.query(selectQuery, [clearing_id], async (err, result) => {
                if (err) {
                    console.error("Error fetching clearance number:", err);
                    return;
                }

                // console.log(file);
                const Subfolder = "Clearance Quotations"

               /*  const clearanceNumber = result[0].clearance_number;
                const folderId = await findOrCreateFolder(clearanceNumber, Subfolder);
                console.log(`Folder ID: ${folderId}`);


                const { fileId, webViewLink } = await uploadFile(folderId, file); */
            })
            return res.status(200).json({
                success: true,
                message: "Attachment updated successfully",
                updated_clearing_id: clearing_id
            });
        }


    } catch (error) {
        console.error("Database Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};


const AttachedCustomOrderDoc = async (req, res) => {
    const { clearing_id } = req.body; // Transaction number from request
    const file = req.file; // Uploaded file
    console.log(file);

    if (!file) {
        return res.status(400).json({
            success: false,
            message: 'file are required',
        });
    }

    try {

        const updateQuery = `UPDATE clearance_order SET attachment_Estimate = ? WHERE clearance_id = ?`;
        const updateParams = [file.filename, clearing_id];

        // Execute the update query correctly
        const result = await con.query(updateQuery, updateParams);
        const selectQuery = `SELECT clearance_number FROM tbl_clearance WHERE id = ?`;

        con.query(selectQuery, [clearing_id], async (err, result) => {
            if (err) {
                console.error("Error fetching clearance number:", err);
                return;
            }

            // console.log(file);
            const Subfolder = "Clearance Doc"
            /* const clearanceNumber = result[0].clearance_number;
            const folderId = await findOrCreateFolder(clearanceNumber, Subfolder);
            console.log(`Folder ID: ${folderId}`);


            const { fileId, webViewLink } = await uploadFile(folderId, file); */
        })
        return res.status(200).json({
            success: true,
            message: "Attachment updated successfully",
            updated_clearing_id: clearing_id
        });



    } catch (error) {
        console.error("Database Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};



module.exports = {
    UploadDocuments, AttachedShippingEstimate, AttachedCustomOrderDoc
}
