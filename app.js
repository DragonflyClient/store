const express = require('express');

const checkoutRoute = require('./routes/checkout');
const referralRoute = require('./routes/referral')
const apiRoute = require('./routes/api/index')
const cartRoute = require('./routes/cart')

const connection = require('./mongoose');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios')

const MODE = process.env.MODE

const ejs = require('ejs');

const app = express();

// EJS middleware
app.set('view engine', 'ejs');
app.use(express.static('public'));

app.use(cors({ origin: ["https://playdragonfly.net", "https://dashboard.playdragonfly.net"], credentials: true }));
app.use(cookieParser());

// Body parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

bodyParser.raw({ type: 'application/json' });
app.use('/checkout', checkoutRoute);

app.use('/ref', referralRoute)

app.use('/api', apiRoute)

app.use('/cart', cartRoute)

// Security while development
app.get('/*', async (req, res) => {
    console.log(MODE)
    if (MODE === "DEVELOPMENT") {
        const dragonflyToken = req.cookies["dragonfly-token"]
        if (!dragonflyToken) return res.render("error", { message: 'Please login in order to see this content.', backUrl: "https://playdragonfly.net", paymentId: null })

        const result = await axios.post('https://api.playdragonfly.net/v1/authentication/token', {}, {
            headers: {
                "Authorization": `Bearer ${dragonflyToken}`
            }
        })
        if (result.data.permissionLevel <= 8) return res.render("error", { message: 'You don\'t have permission to access this resource.', backUrl: "https://playdragonfly.net", paymentId: null })
    }
    const shopItems = await mongoose.connection.db.collection('shop-items').find({});

    let items = [];
    await shopItems.forEach((item) => items.push(item));
    res.clearCookie('ref')
        .render('index', { shopItems: items, refName: null, refType: null })
})

app.get('/', async (req, res) => {
    const results = await mongoose.connection.db.collection('shop-items').find({});

    let items = [];
    await results.forEach((result) => items.push(result));
    res.clearCookie('ref')
        .render('index', { shopItems: items, refName: null, refType: null })

});
app.listen(process.env.PORT, () => console.log(`Server Started on ${process.env.URL}`));

