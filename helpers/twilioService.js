// twilioService.js

const twilio = require('twilio');
const { Account_SID, Auth_Token, Twilio_phone_number, Twilio_Whatsapp_number } = process.env;
const templates = require('./whatsappTemplates');

// Your Twilio account SID and Auth Token from the Twilio Console

console.log('SID:', Account_SID);
console.log('TOKEN:', Auth_Token);

const accountSid = Account_SID;
const authToken = Auth_Token;

// Create a Twilio client
const client = twilio(accountSid, authToken);

// Function to send SMS
const sendSms = (to, body) => {
    console.log(to);
    console.log(Twilio_phone_number);

    return client.messages.create({
        body: body,
        from: Twilio_phone_number, // Your Twilio phone number
        to: `${to}`,
    })
        .then((message) => {
            console.log(`SMS sent: ${message.sid}`);
            return message;
        })
        .catch((error) => {
            console.error(`Error sending SMS: ${error.message}`);
            throw error;
        });
};

// Function to send WhatsApp message
// const sendWhatsApp = (to, body) => {
//     console.log(to);
//     console.log(Twilio_Whatsapp_number);
//     return client.messages.create({
//         contentSid: "HX1c031a5f3480d2d41f7cd64ee7c8fb2a",
//         contentVariables: JSON.stringify(body),
//         from: `whatsapp:${Twilio_Whatsapp_number}`, // Your Twilio WhatsApp number
//         // to: `whatsapp:${to}`, // WhatsApp number to send the message
//         to: `whatsapp:${to}`, // WhatsApp number to send the message

//     })
//         .then((message) => {
//             console.log(`WhatsApp message sent: ${message.sid}`);
//             return message;
//         })
//         .catch((error) => {
//             console.error(`Error sending WhatsApp message: ${error.message}`);
//             throw error;
//         });
// };

// test

// const sendWhatsApp = (to, variables) => {
//     return client.messages.create({
//         to: `whatsapp:${to}`,
//         messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
//         contentSid: 'HX1c031a5f3480d2d41f7cd64ee7c8fb2a',
//         contentVariables: JSON.stringify(variables)
//     })
//         .then((message) => {
//             console.log(`WhatsApp message sent: ${message.sid}`);
//             return message;
//         })
//         .catch((error) => {
//             console.error(`Error sending WhatsApp message: ${error.message}`);
//             throw error;
//         });
// };


const sendWhatsApp = (to, templateKey, variables = {}) => {
    const contentSid = templates[templateKey];

    if (!contentSid) {
        throw new Error(`Invalid WhatsApp template key: ${templateKey}`);
    }

    return client.messages.create({
        to: `whatsapp:${to}`,
        messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
        contentSid,
        contentVariables: JSON.stringify(variables)
    })
        .then(message => {
            console.log(`WhatsApp sent [${templateKey}]: ${message.sid}`);
            return message;
        })
        .catch(error => {
            console.error(`WhatsApp error [${templateKey}]:`, error.message);
            throw error;
        });
};

// const sendWhatsAppNotification = (to, templateKey, variables = {}) => {
//     const contentSid = templates[templateKey];

//     if (!contentSid) {
//         throw new Error(`Invalid WhatsApp template key: ${templateKey}`);
//     }

//     return client.messages.create({
//         to: `whatsapp:${to}`,
//         messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
//         contentSid,
//         contentVariables: JSON.stringify(variables)
//     })
//         .then(message => {
//             console.log(`WhatsApp sent [${templateKey}]: ${message.sid}`);
//             return message;
//         })
//         .catch(error => {
//             console.error(`WhatsApp error [${templateKey}]:`, error.message);
//             throw error;
//         });
// };

const sendWhatsAppNotification = async (
    to,
    templateKey,
    variables = {}
) => {
    const contentSid = templates[templateKey];

    if (!contentSid) {
        throw new Error(`Invalid WhatsApp template key: ${templateKey}`);
    }

    const payload = {
        to: `whatsapp:${to}`,
        messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
        contentSid,
        contentVariables: JSON.stringify(variables)
    };

    try {
        const message = await client.messages.create(payload);

        console.log(`WhatsApp sent [${templateKey}]: ${message.sid}`);
        console.log(`➡ To: ${to}`);

        return message;
    } catch (error) {
        console.error(`WhatsApp error [${templateKey}]`);
        console.error(`➡ To: ${to}`);
        console.error(error.message);
        throw error;
    }
};

module.exports = { sendSms, sendWhatsApp, sendWhatsAppNotification };
