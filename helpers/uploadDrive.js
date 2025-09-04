

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

// const CREDENTIALS_PATH = path.resolve(__dirname, '../credentials.json');
// const TOKEN_PATH = path.resolve(__dirname, '../token.json');

// let driveClient = null;

// // Authenticate Google Drive
// const authenticateGoogleDrive = async () => {
//     if (driveClient) return driveClient;

//     const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
//     const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
//     const { client_secret, client_id, redirect_uris } = credentials.web;

//     const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
//     oAuth2Client.setCredentials(token);
//     driveClient = google.drive({ version: 'v3', auth: oAuth2Client });

//     return driveClient;
// };

const CREDENTIALS_PATH = path.resolve(__dirname, '../credentials.json');
const TOKEN_PATH = path.resolve(__dirname, '../token.json');

let driveClient = null;

// Scopes for Google Drive
const SCOPES = ['https://www.googleapis.com/auth/drive'];

// Load client secrets
const loadCredentials = () => {
    const content = fs.readFileSync(CREDENTIALS_PATH);
    return JSON.parse(content).web;
};

// Get new token if missing or invalid
const getNewToken = async (oAuth2Client) => {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline', // gives refresh token
        scope: SCOPES,
    });

    console.log('Authorize this app by visiting this url:', authUrl);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const code = await new Promise((resolve) => {
        rl.question('Enter the code from that page here: ', (answer) => {
            rl.close();
            resolve(answer);
        });
    });

    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    // Save the token for later use
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
    console.log('Token stored to', TOKEN_PATH);
};

// Authenticate Google Drive
const authenticateGoogleDrive = async () => {
    if (driveClient) return driveClient;

    const { client_id, client_secret, redirect_uris } = loadCredentials();
    const oAuth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirect_uris[0]
    );

    // Try to load existing token
    try {
        const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
        oAuth2Client.setCredentials(token);
    } catch (err) {
        // Token missing or invalid, get a new one
        await getNewToken(oAuth2Client);
    }

    // Auto-save new refresh token if issued
    oAuth2Client.on('tokens', (tokens) => {
        if (tokens.refresh_token) {
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
            console.log('Refresh token updated.');
        }
    });

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
        "AD_Invoice",
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
    return freightFolderId; 
    // console.log(" Entire folder structure created.");
};




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

// const uploadToSpecificPath = async (freightNumber, mainFolder, subFolder, file) => {
//     const drive = await authenticateGoogleDrive();

//     // Create or find freight folder
//     const freightFolderId = await createFolderIfNotExists(freightNumber);

//     // Create or find main folder (e.g., Quotations)
//     const mainFolderId = await createFolderIfNotExists(mainFolder, freightFolderId);

//     // Create or find subfolder (e.g., AD_Quotations)
//     const subFolderId = await createFolderIfNotExists(subFolder, mainFolderId);

//     // Upload file to the correct folder
//     const result = await uploadFile(subFolderId, file);
//     return result;
// };

// Upload to specific path without recreating main freight folder
const uploadToSpecificPath = async (freightNumber, mainFolder, subFolder, file) => {
    // First, find or create the main freight folder by name
    const freightFolderId = await createFolderIfNotExists(freightNumber);

    // Create or find main folder (e.g., "Supplier Invoices") under freight folder
    const mainFolderId = await createFolderIfNotExists(mainFolder, freightFolderId);

    // Create or find subfolder (e.g., "Invoice, Packing List") under main folder
    const subFolderId = await createFolderIfNotExists(subFolder, mainFolderId);

    // Upload file to the correct subfolder
    const result = await uploadFile(subFolderId, file);

    return result;
};

const findFolderId = async (folderName, parentId = null) => {
    try {
        const drive = await authenticateGoogleDrive(); // ✅ get the authenticated client

        const res = await drive.files.list({
            q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}'` +
                (parentId ? ` and '${parentId}' in parents` : ''),
            fields: 'files(id, name)',
            spaces: 'drive'
        });
        if (res.data.files.length > 0) {
            return res.data.files[0].id;
        }
        return null;
    } catch (err) {
        console.error('Error finding folder:', err);
        return null;
    }
};

module.exports = { findOrCreateFolder, uploadFile, createFolderIfNotExists, uploadToSpecificPath, findFolderId };

