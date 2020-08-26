const express = require('express');
const checkoutRoute = require('./routes/checkout')
const connection = require('./mongoose')

const ejs = require('ejs');

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'))

app.get('/', (req, res) => res.render('index'));

app.use('/checkout', checkoutRoute)


app.listen(process.env.PORT, () => console.log('Server Started on port ', process.env.PORT));
