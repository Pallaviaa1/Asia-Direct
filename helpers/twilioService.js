// twilioService.js

const twilio = require('twilio');
const { Account_SID, Auth_Token, Twilio_phone_number, Twilio_Whatsapp_number } = process.env;

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
const sendWhatsApp = (to, body) => {
     console.log(to);
    console.log(Twilio_Whatsapp_number);
    return client.messages.create({
        body: body,
        from: `whatsapp:${Twilio_Whatsapp_number}`, // Your Twilio WhatsApp number
        // to: `whatsapp:${to}`, // WhatsApp number to send the message
        to: `whatsapp:${to}`, // WhatsApp number to send the message

    })
        .then((message) => {
            console.log(`WhatsApp message sent: ${message.sid}`);
            return message;
        })
        .catch((error) => {
            console.error(`Error sending WhatsApp message: ${error.message}`);
            throw error;
        });
};

module.exports = { sendSms, sendWhatsApp };
