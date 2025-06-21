/* const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const CREDENTIALS_PATH = path.resolve(__dirname, '../credentials.json');
const TOKEN_PATH = path.resolve(__dirname, '../token.json');

let driveClient = null;

// Authenticate Google Drive
const authenticateGoogleDrive = async () => {
    if (driveClient) return driveClient;

    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
    // console.log(credentials.web);
    // console.log(token);
    const { client_secret, client_id, redirect_uris } = credentials.web;


    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    // console.log(oAuth2Client);

    oAuth2Client.setCredentials(token);
    driveClient = google.drive({ version: 'v3', auth: oAuth2Client });
    // console.log(driveClient);

    return driveClient;
};

// Find or create folder
const findOrCreateFolder = async (folderName) => {
    console.log(folderName);

    const drive = await authenticateGoogleDrive();
    // console.log(drive);

    const query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

    const response = await drive.files.list({ q: query, fields: 'files(id, name)' });
    // console.log(response);

    if (response.data.files.length > 0) {
        console.log(` Folder already exists with ID: ${response.data.files[0].id}`);
        return response.data.files[0].id;
    } else {
        const fileMetadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
        };

        const folder = await drive.files.create({ resource: fileMetadata, fields: 'id' });
        console.log(` Folder created with ID: ${folder.data.id}`);
        return folder.data.id;
    }
};

// Upload multiple files to Google Drive
const uploadFile = async (folderId, files) => {
    const drive = await authenticateGoogleDrive();
    const uploadResults = [];
    // console.log(files);
    // console.log(folderId);


    // for (const file of files) {
    const { path, originalname } = files;
    console.log(` Uploading file: ${originalname}`);

    const fileMetadata = {
        name: originalname,
        parents: [folderId],
    };

    const media = {
        mimeType: 'application/octet-stream',
        body: fs.createReadStream(path),
    };

    const response = await drive.files.create({
        resource: fileMetadata,
        media,
        fields: 'id, webViewLink',
    });
    // console.log(response);

    // fs.unlinkSync(path); // Delete temp file

    console.log(` File uploaded with ID: ${response.data.id}`);
    console.log(` View link: ${response.data.webViewLink}`);

    uploadResults.push({ fileId: response.data.id, webViewLink: response.data.webViewLink });
    // }
    // console.log(uploadResults);

    return uploadResults;
};

module.exports = { findOrCreateFolder, uploadFile };
 */

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const CREDENTIALS_PATH = path.resolve(__dirname, '../credentials.json');
const TOKEN_PATH = path.resolve(__dirname, '../token.json');

let driveClient = null;

// Authenticate Google Drive
const authenticateGoogleDrive = async () => {
    if (driveClient) return driveClient;

    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
    const { client_secret, client_id, redirect_uris } = credentials.web;

    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    oAuth2Client.setCredentials(token);
    driveClient = google.drive({ version: 'v3', auth: oAuth2Client });

    return driveClient;
};

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

const findOrCreateFolder = async (freightNumber) => {
    const drive = await authenticateGoogleDrive();

    // Create or find the main freight folder
    const freightFolderId = await createFolderIfNotExists(freightNumber);

    // Loop through first-level folders
    for (const [mainFolder, subFolders] of Object.entries(nestedFolderStructure)) {
        const mainSubFolderId = await createFolderIfNotExists(mainFolder, freightFolderId);

        for (const sub of subFolders) {
            await createFolderIfNotExists(sub, mainSubFolderId);
            // console.log(` Created: ${freightNumber}/${mainFolder}/${sub}`);
        }
    }

    // console.log(" Entire folder structure created.");
};


// Find or create folder (supports parent and subfolder)
/* const findOrCreateFolder = async (freightNumber, subfolderName) => {
    const drive = await authenticateGoogleDrive();

    // Create or find the main freight folder
    const freightFolderId = await createFolderIfNotExists(freightNumber);

    // Create or find the subfolder inside the freight folder
    const subfolderId = await createFolderIfNotExists(subfolderName, freightFolderId);

    console.log(` Folder structure created: ${freightNumber} -> ${subfolderName}`);
    return { freightFolderId, subfolderId };
}; */

// Helper function to check or create folder
const createFolderIfNotExists = async (folderName, parentFolderId = null) => {
    const drive = await authenticateGoogleDrive();

    let query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    if (parentFolderId) {
        query += ` and '${parentFolderId}' in parents`;
    }

    const response = await drive.files.list({ q: query, fields: 'files(id, name)' });

    if (response.data.files.length > 0) {
        console.log(` Folder "${folderName}" already exists with ID: ${response.data.files[0].id}`);
        return response.data.files[0].id;
    } else {
        const fileMetadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: parentFolderId ? [parentFolderId] : [],
        };

        const folder = await drive.files.create({ resource: fileMetadata, fields: 'id' });
        console.log(` Folder "${folderName}" created with ID: ${folder.data.id}`);
        return folder.data.id;
    }
};

// Upload multiple files to Google Drive
const uploadFile = async (folderId, files) => {
    console.log(folderId, files, "hii");

    const drive = await authenticateGoogleDrive();
    const uploadResults = [];

    const { path, originalname } = files;
    console.log(` Uploading file: ${originalname}`);

    const fileMetadata = {
        name: originalname,
        parents: [folderId],
    };

    const media = {
        mimeType: 'application/octet-stream',
        body: fs.createReadStream(path),
    };

    const response = await drive.files.create({
        resource: fileMetadata,
        media,
        fields: 'id, webViewLink',
    });

    console.log(` File uploaded with ID: ${response.data.id}`);
    console.log(` View link: ${response.data.webViewLink}`);

    uploadResults.push({ fileId: response.data.id, webViewLink: response.data.webViewLink });

    return uploadResults;
};

const uploadToSpecificPath = async (freightNumber, mainFolder, subFolder, file) => {
    const drive = await authenticateGoogleDrive();

    // Create or find freight folder
    const freightFolderId = await createFolderIfNotExists(freightNumber);

    // Create or find main folder (e.g., Quotations)
    const mainFolderId = await createFolderIfNotExists(mainFolder, freightFolderId);

    // Create or find subfolder (e.g., AD_Quotations)
    const subFolderId = await createFolderIfNotExists(subFolder, mainFolderId);

    // Upload file to the correct folder
    const result = await uploadFile(subFolderId, file);
    return result;
};


module.exports = { findOrCreateFolder, uploadFile, createFolderIfNotExists, uploadToSpecificPath };

// Example usage
// (Uncomment this section for testing)
// const freightNumber = 'Freight_12345';
// const subfolderName = 'Documents';
// findOrCreateFolder(freightNumber, subfolderName)
//     .then(({ freightFolderId, subfolderId }) => {
//         console.log(`Main Folder ID: ${freightFolderId}`);
//         console.log(`Subfolder ID: ${subfolderId}`);
//     })
//     .catch((error) => {
//         console.error(' Error:', error.message);
//     });


// Let me know if you want me to adjust anything! 
