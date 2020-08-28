const express = require('express')
const router = express.Router()
const { findItemById } = require('../mongoose.js')
const paypal = require('paypal-rest-sdk');
const stripe = require('stripe')(process.env.STRIPE_SECRET)
const Payment = require('../models/Payment')

paypal.configure({
    mode: 'sandbox', //sandbox or live
    client_id: process.env.PAYPAL_CLIENT_ID,
    client_secret: process.env.PAYPAL_CLIENT_SECRET,
});

router.get('/', (req, res) => {
    res.send('Ready to receive payments')
})

// Stripe payment route
router.post('/stripe/:item_id', async (req, res) => {
    const itemId = req.params.item_id.toString()
    const token = req.cookies['dragonfly-token']

    const item = await findItemById(itemId)
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
            {
                price_data: {
                    currency: item.currency,
                    product_data: {
                        name: item.name,
                        description: item.description
                    },
                    unit_amount: item.price,
                },
                quantity: 1,
            },
        ],
        payment_intent_data: {
            metadata: {
                item_id: itemId,
                dragonfly_token: token
            }
        },
        mode: "payment",
        success_url: `${process.env.URL}/checkout/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.URL}/checkout/cancel`,
    })
    res.json({ id: session.id });
})

// Stripe success route
router.get('/stripe/success', async (req, res) => {
    const sessionId = req.query.session_id
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const intent = await stripe.paymentIntents.retrieve(session.payment_intent);

    console.log(intent)

    // check intent status
    if (intent.status !== 'succeeded') return res.render('error', {message: 'Payment did not succeed!'});

    const itemId = intent.metadata.item_id
    const item = await findItemById(itemId)
    const itemPrice = convertToEuros(item.price)

    // check amount received
    if (!intent.amount_received === item.price) return res.render('error', {message: 'Incorrect price received!'});

    console.log('Everything alright', "Item price:", item.price, "| Received amount:", intent.amount_received)

    // Create new payment
    const newPayment = new Payment({
        provider: 'STRIPE',
        payId: intent.id,
        paymentState: intent.status,
        creationDate: intent.created,
        itemName: item.name,
        itemSku: item.id
    });

    newPayment.collection.findOne({payId: intent.id}, function (err, payment) {
        // Only insert payment if it hasn't already been done
        if (!payment) {
            newPayment.save(function (err) {
                if (err) return res.render('error', {message: err});
                console.log(item.name)
                console.log('Payment saved to database')
                res.render('success', {product: item.name, price: itemPrice, port: process.env.PORT});
            });
        } else {
            res.render('error', {message: 'The article has already been purchased with this payment ID.'});
        }
    })
});

// PayPal payment route
router.post('/paypal/:item_id', async (req, res) => {

    // Get item from params
    const itemId = req.params.item_id.toString()
    const item = await findItemById(itemId)

    // Get item details from database
    if (item == null) {
        console.log('Item not found')
        res.send('Item not found')
    } else {
        const itemPrice = convertToEuros(item.price)
        console.log(`Creating payment with item ${item.name} and price ${itemPrice}`)
        const create_payment_json = {
            intent: 'sale',
            payer: {
                payment_method: 'paypal',
            },
            redirect_urls: {
                return_url: `${process.env.URL}/checkout/paypal/success?item_id=${itemId}`,
                cancel_url: `${process.env.URL}/checkout/cancel`,
            },
            transactions: [
                {
                    item_list: {
                        items: [
                            {
                                name: item.name,
                                price: itemPrice,
                                sku: item.id,
                                currency: item.currency,
                                quantity: 1,
                            },
                        ],
                    },
                    amount: {
                        currency: item.currency,
                        total: itemPrice,
                    },
                    description: item.description,
                },
            ],
        };

        // Open paypal payment
        paypal.payment.create(create_payment_json, function (error, payment) {
            if (error) {
                throw error;
            } else {
                for (let i = 0; i < payment.links.length; i++) {
                    if (payment.links[i].rel === 'approval_url') {
                        // Redirect to checkout
                        res.redirect(payment.links[i].href);
                    }
                }
            }
        });
    }
});

// PayPal success route
router.get('/paypal/success', async (req, res) => {
    const payerId = req.query.PayerID;
    const paymentId = req.query.paymentId;

    const itemId = req.query.item_id
    const item = await findItemById(itemId)
    const itemPrice = convertToEuros(item.price)

    // Set item details
    const execute_payment_json = {
        payer_id: payerId,
        transactions: [
            {
                amount: {
                    currency: item.currency,
                    total: itemPrice,
                },
            },
        ],
    }

    // Execute paypal payment
    paypal.payment.execute(paymentId, execute_payment_json, function (error, payment) {
        if (error) {
            console.log(error.response);
            throw error;
        } else {
            // Check if paid price is the same as the price from the db
            if (payment.transactions[0].amount.total == itemPrice) {
                console.log('Everything alright', "Item Price:", itemPrice, "| Paypal price:", payment.transactions[0].amount.total)
                // Create new payment
                const newPayment = new Payment({
                    provider: 'PAYPAL',
                    payId: payment.id,
                    paymentState: payment.state,
                    creationDate: payment.create_time,
                    itemName: payment.transactions[0].item_list.items[0].name,
                    itemSku: payment.transactions[0].item_list.items[0].sku
                });

                newPayment.collection.findOne({ payId: payment.id }, function (err, payment) {
                    // Only insert payment if it hasn't already been done
                    if (!payment) {
                        newPayment.save(function (err) {
                            if (err) return res.render('error', { message: err });
                            console.log(item.name)
                            console.log('Payment saved to database')
                            res.render('success', { product: item.name, price: itemPrice, port: process.env.PORT });
                        });
                    } else {
                        res.render('error', { message: 'The article has already been purchased with this payment ID.' });
                    }
                })
            } else {
                console.log('Not good', "Item Price :", itemPrice, "Paypal price", payment.transactions[0].amount.total)
            }
        }
    });
});

router.get('/cancel', (req, res) => res.send('Cancelled'));

function convertToEuros(cents) {
    return cents / 100
}

module.exports = router