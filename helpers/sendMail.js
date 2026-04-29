// const nodemailer = require('nodemailer');
// const {SMTP_MAIL,SMTP_PASSWORD}=process.env;

// const sendMail= async (email,mailSubject,content)=>
// {try {
//    const transport= nodemailer.createTransport({
//         host:'smtp.gmail.com',
//         port:587,
//         secure:false,
//         requireTLS:true,
//         auth:
//         {
//             user:SMTP_MAIL,
//             pass:SMTP_PASSWORD
//         }
//     })

//     const mailOptions={
//         from:`AsiaDirect <${SMTP_MAIL}>`,
//         to:email,
//         subject:mailSubject,
//         html:content
//     }

//     transport.sendMail(mailOptions)

// } catch (error) {
//     console.log(error.message);
// }
// }

// module.exports=sendMail;

const nodemailer = require('nodemailer');
const { SMTP_MAIL, SMTP_PASSWORD } = process.env;

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
        user: SMTP_MAIL,
        pass: SMTP_PASSWORD,
    },
    pool: true,           // keep connection alive
    maxConnections: 1,    // only 1 active connection
    maxMessages: 3,       // limit messages per connection
    rateDelta: 20000,     // time window in ms (20s)
    rateLimit: 3,         // max 3 emails per 20s
});

const sendMail = async (email, mailSubject, content, attachments = []) => {
    try {
        const mailOptions = {
            from: `AsiaDirect <${SMTP_MAIL}>`,
            to: email,
            subject: mailSubject,
            html: content,
            attachments
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent:', info.response);

        return { success: true, info };
    } catch (error) {
        console.error('Email error:', error.message);

        // Optionally retry on temporary Gmail errors (421, 450, 451, 452)
        if (error.responseCode && [421, 450, 451, 452].includes(error.responseCode)) {
            console.log('Temporary error, will retry in 30s...');
            setTimeout(() => sendMail(email, mailSubject, content), 30000);
        }

        return { success: false, error: error.message };
    }
};

module.exports = sendMail;
