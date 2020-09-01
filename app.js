const express = require('express');
const checkoutRoute = require('./routes/checkout');
const connection = require('./mongoose');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const cors = require('cors');

const ejs = require('ejs');

const app = express();

// EJS middleware
app.set('view engine', 'ejs');
app.use(express.static('public'));

app.use(cors());
app.use(cookieParser());

// Body parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.get('/', async (req, res) => {
    const results = await mongoose.connection.db.collection('shop-items').find({});

    let items = [];
    await results.forEach((result) => items.push(result));
    console.log(items);
    res.render('index', { shopItems: items, test: 'hey!' });
});

bodyParser.raw({ type: 'application/json' });
app.use('/checkout', checkoutRoute);

app.listen(process.env.PORT, () => console.log(`Server Started on ${process.env.URL}`));

