const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/drive'];
const TOKEN_PATH = 'token.json';

const authorize = (credentials, callback) => {
    const { client_secret, client_id, redirect_uris } = credentials.web;

    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return getNewToken(oAuth2Client, callback);
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client);
    });
};

const getNewToken = (oAuth2Client, callback) => {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent', // force Google to return refresh_token
        scope: SCOPES,
    });

    console.log('Authorize this app by visiting this URL:', authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) {
                console.error('Error retrieving access token', err);
                return;
            }

            // Load existing tokens if they exist
            let existingTokens = {};
            if (fs.existsSync(TOKEN_PATH)) {
                existingTokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
            }

            // Merge tokens → don’t lose refresh_token if missing in new response
            const mergedTokens = { ...existingTokens, ...token };

            oAuth2Client.setCredentials(mergedTokens);

            fs.writeFile(TOKEN_PATH, JSON.stringify(mergedTokens, null, 2), (err) => {
                if (err) console.error(err);
                console.log('Token stored to', TOKEN_PATH);
            });

            callback(oAuth2Client);
        });
    });
};


fs.readFile('credentials.json', (err, content) => {
    if (err) return console.error('Error loading client secret file:', err);
    authorize(JSON.parse(content), (auth) => {
        console.log('Authorization successful!');
    });
});
