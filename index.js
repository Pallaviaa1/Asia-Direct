require('dotenv').config();
const express = require('express');
const app = express();
const bodyparser = require('body-parser');
require('./config/database');

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

app.get('/', (req, res) => {
    res.send('welcome')
})



app.use('/api', adminRoute);
app.use('/api', customerRoute);
app.use('/api', supplierRoute);
app.use('/api', staffRoute);
app.use('/api', orderRoute);
app.use('/api', clearance_route);
app.use('/api', upload_route)
app.use('/api', invoice_route)

app.listen(PORT, (err) => {
    if (err) throw err;
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
