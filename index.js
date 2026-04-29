require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);

const bodyparser = require('body-parser');
require('./config/database');
const { sendSms, sendWhatsApp } = require('./helpers/twilioService');
const logger = require('./logger');

const adminRoute = require('./routes/adminRoute');
const customerRoute = require('./routes/customerRoute');
const supplierRoute = require('./routes/supplierRoute');
const staffRoute = require('./routes/staffRoute');
const orderRoute = require('./routes/orderRoute');
const clearance_route = require('./routes/clearanceRoute');
const upload_route = require('./routes/uploadRoute')
const invoice_route = require('./routes/invoiceRoute')
const chatRoutes = require('./routes/chatRoute');


var PORT = process.env.PORT || 7000

var cors = require('cors');
app.use(cors({
  origin: '*'
}));

app.use(bodyparser.json());
app.use(express.json());
app.use(bodyparser.urlencoded({ extended: true }));
app.use(express.static('public'));


// ============================
// SOCKET.IO SETUP
// ============================
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
global.io = io; 
// Socket logic
require('./socket/chat.socket')(io);

const message = "hii"
app.get('/check', async (req, res) => {
  try {
    // Remove sendSms if you're not allowed to send SMS to India
    // await sendSms('+918340721420', message);

    const whatsappResponse = await sendWhatsApp('+918341721421', message);
    console.log('WhatsApp Response:', whatsappResponse.sid);
    // await sendSms('+918340721420', message);
    res.send('Welcome! WhatsApp message sent.');
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).send('Failed to send message');
  }
});

app.get('/', async (req, res) => {
  try {
    // Optional: your WhatsApp/SMS logic here
    // const whatsappResponse = await sendWhatsApp('+918340721420', message);
    // console.log('WhatsApp Response:', whatsappResponse.sid);

    // Serve HTML page
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Coming Soon</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: "Arial", sans-serif;
            background: linear-gradient(135deg, #0f172a, #1e293b);
            color: #fff;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            text-align: center;
          }
          .container {
            max-width: 600px;
            padding: 20px;
          }
          h1 {
            font-size: 3rem;
            margin-bottom: 20px;
          }
          p {
            font-size: 1.2rem;
            margin-bottom: 15px;
          }
          .contact {
            margin-top: 25px;
            font-size: 1rem;
          }
          .contact a {
            color: #38bdf8;
            text-decoration: none;
          }
          .contact a:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🚀 Coming Soon</h1>
          <p>We are working hard to bring you something amazing!</p>
          <div class="contact">
            <p>📞 Phone: <a href="tel:+97450318183">00974 50318183</a></p>
            <p>📧 Email: <a href="mailto:contact@sisccltd.com">contact@sisccltd.com</a></p>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Failed to load page');
  }
});


// TEST WHATSAPP API
app.get('/api/test-whatsapp', async (req, res) => {
  try {
    const testFreight = {
      full_name: 'ABC Logistics Pvt Ltd',
      freight_number: 'FRG-789456'
    };

    const testMember = {
      cellphone: '+918859932237'
    };

    console.log('Testing WhatsApp API...');

    const result = await sendWhatsApp(
      testMember.cellphone,
      'quote_issued_follow_up_v2',
      {
        "1": testFreight.full_name,
        "2": testFreight.freight_number,
        "3": "Pallavi"
      }
    );

    res.status(200).json({
      success: true,
      message: 'WhatsApp test message sent',
      response: result
    });

  } catch (error) {
    console.error('WhatsApp test error:', error);

    res.status(500).json({
      success: false,
      message: 'WhatsApp test failed',
      error: error.message
    });
  }
});

app.use('/api', adminRoute);
app.use('/api', customerRoute);
app.use('/api', supplierRoute);
app.use('/api', staffRoute);
app.use('/api', orderRoute);
app.use('/api', clearance_route);
app.use('/api', upload_route)
app.use('/api', invoice_route)
app.use('/api', chatRoutes);

app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err); //  log all unhandled errors
  res.status(500).json({ message: 'Internal server error' });
});

// app.listen(PORT, (err) => {
//   if (err) {
//     logger.error('Server start error:', err); //  log server error
//     throw err;
//   }
//   else {
//     console.log('server listing on port:', PORT);
//   }
// })

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


// HANDLE UNCAUGHT EXCEPTIONS & PROMISE REJECTIONS
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', { message: err.message, stack: err.stack });
  process.exit(1);
});


