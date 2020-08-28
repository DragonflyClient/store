const express = require('express');
const checkoutRoute = require('./routes/checkout')
const connection = require('./mongoose')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const cors = require('cors')

const ejs = require('ejs');

const app = express();

// EJS middleware
app.set('view engine', 'ejs');
app.use(express.static('public'))

app.use(cors())
app.use(cookieParser())

// Body parser middleware
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

app.get('/', (req, res) => res.render('index'));

bodyParser.raw({ type: 'application/json' })
app.use('/checkout', checkoutRoute)


app.listen(process.env.PORT, () => console.log('Server Started on port ', process.env.PORT));
