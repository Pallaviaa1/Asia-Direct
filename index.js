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

// Registered before route imports so a missing module still prints here.
// Winston's exception handler only writes logs/exceptions.log and then exits.
process.on('unhandledRejection', (reason) => {
  console.error('\n========== UNHANDLED REJECTION ==========');
  console.error(reason instanceof Error ? reason.stack : reason);
  console.error('=========================================\n');
  logger.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('\n========== APP CRASHED ==========');
  console.error(err && err.stack ? err.stack : err);
  console.error('=================================\n');
  process.exit(1);
});

const adminRoute = require('./routes/adminRoute');
const customerRoute = require('./routes/customerRoute');
const supplierRoute = require('./routes/supplierRoute');
const staffRoute = require('./routes/staffRoute');
const orderRoute = require('./routes/orderRoute');
const clearance_route = require('./routes/clearanceRoute');
const upload_route = require('./routes/uploadRoute')
const invoice_route = require('./routes/invoiceRoute')
const chatRoutes = require('./routes/chatRoute');
const warehouseTrackingRoute = require('./routes/warehouseTrackingRoute');
const verificationModule = require('./verification');

// Workspace AI (optional at boot — missing folder/deps must not crash the whole app)
let aiChatRoute = null;
let startAiChatCleanup = () => { };
let demoHtmlPath = null;
try {
  const ai = require('./ai');
  aiChatRoute = ai.router;
  startAiChatCleanup = ai.startCleanup;
  demoHtmlPath = ai.demoHtmlPath;
} catch (err) {
  console.error('Workspace AI failed to load (server will run without AI):', err.message);
}


var PORT = process.env.PORT || 7000

var cors = require('cors');
app.use(cors({
  origin: '*'
}));

// Verification routes: robust parser handling up to 50mb and auto-repairing unescaped newlines in Base64 JSON strings
app.use(['/api/verification', '/api/v1/third-party/verification'], express.text({ type: ['application/json', 'text/*'], limit: '50mb' }), (req, res, next) => {
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      req.body = JSON.parse(req.body);
      req._body = true;
    } catch (e) {
      try {
        const cleaned = req.body.replace(/[\r\n]+/g, '');
        req.body = JSON.parse(cleaned);
        req._body = true;
      } catch (err2) {
        // If still unparseable, continue to standard error handler
      }
    }
  }
  next();
});

app.use(bodyparser.json({ limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(bodyparser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// Workspace AI demo UI (lives under ai/demo; React app will replace this later)
if (demoHtmlPath) {
  app.get('/ai-chat.html', (req, res) => {
    res.sendFile(demoHtmlPath);
  });
}


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
    // ⚠️ Remove sendSms if you're not allowed to send SMS to India
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


// ✅ TEST WHATSAPP API
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
app.use('/api/warehouse', warehouseTrackingRoute);
app.use('/api', verificationModule.router);
if (aiChatRoute) {
  app.use('/api', aiChatRoute);
  // AI chat history: purge sessions past inactivity TTL (expires_at)
  startAiChatCleanup();
  console.log('Workspace AI routes enabled');
} else {
  console.warn('Workspace AI routes disabled — check ./ai folder and npm packages');
}

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    logger.warn('Malformed JSON body received:', err.message);
    return res.status(400).json({
      success: false,
      code: 'INVALID_JSON',
      message: 'Malformed JSON payload. If you pasted a Base64 image, ensure there are no unescaped line breaks or control characters inside the string.',
      error: err.message
    });
  }
  logger.error('Unhandled error:', err); // ✅ log all unhandled errors
  res.status(500).json({ message: 'Internal server error' });
});

// app.listen(PORT, (err) => {
//   if (err) {
//     logger.error('Server start error:', err); // ✅ log server error
//     throw err;
//   }
//   else {
//     console.log('server listing on port:', PORT);
//   }
// })

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


