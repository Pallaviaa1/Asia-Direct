require('dotenv').config();
const express = require('express');
const app = express();
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

var PORT = process.env.PORT || 7000

var cors = require('cors');
app.use(cors({
  origin: '*'
}));

app.use(bodyparser.json());
app.use(express.json());
app.use(bodyparser.urlencoded({ extended: true }));
app.use(express.static('public'));
const message = "hii"
app.get('/', async (req, res) => {
  try {
    // ⚠️ Remove sendSms if you're not allowed to send SMS to India
    // await sendSms('+918340721420', message);

    const whatsappResponse = await sendWhatsApp('+918340721420', message);
    console.log('WhatsApp Response:', whatsappResponse.sid);
    // await sendSms('+918340721420', message);
    res.send('Welcome! WhatsApp message sent.');
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).send('Failed to send message');
  }
});

app.get('/check', (req, res) => {
  res.status(200).send('OK');
});


app.use('/api', adminRoute);
app.use('/api', customerRoute);
app.use('/api', supplierRoute);
app.use('/api', staffRoute);
app.use('/api', orderRoute);
app.use('/api', clearance_route);
app.use('/api', upload_route)
app.use('/api', invoice_route)


app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err); //  log all unhandled errors
  res.status(500).json({ message: 'Internal server error' });
});


app.listen(PORT, (err) => {
  if (err) {
    logger.error('Server start error:', err); //  log server error
    throw err;
  }
  else {
    console.log('server listing on port:', PORT);
    setTimeout(() => {
      console.log(`     ,     #_
        ~\\_  ####_        
       ~~  \\_#####\\
       ~~     \\###|
       ~~       \\#/ ___   
        ~~       V🔥~' '-> 
         ~~~    (Pallavi)
           ~~._.   _/
              _/ _/
            _/m/'`);
    }, 1000);

  }
})

// HANDLE UNCAUGHT EXCEPTIONS & PROMISE REJECTIONS
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', { message: err.message, stack: err.stack });
  process.exit(1);
});


