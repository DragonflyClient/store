const express = require('express')
const router = express.Router()
const connection = require('../mongoose.js')
const paypal = require('paypal-rest-sdk');
const stripe = require('stripe')(process.env.STRIPE_SECRET)
const Payment = require('../models/Payment')

const endpointSecret = 'whsec_NNT8GUETHNZQzqzfdE0ELtclDkurLtF7';

paypal.configure({
    mode: 'sandbox', //sandbox or live
    client_id: process.env.PAYPAL_CLIENT_ID,
    client_secret: process.env.PAYPAL_CLIENT_SECRET,
});

router.get('/', (req, res) => {
    res.send('Ready to receive payments')
})

// PayPal payment route
router.post('/paypal/:item', (req, res) => {

    // Get item from params
    const item = req.params.item.toString()

    // Get item details from database
    connection.db.collection("shop-items", function (err, collection) {
        collection.find({ sku: item }).toArray(function (err, data) {
            if (data.length < 1) {
                console.log('Item not found')
                res.send('Item not found')
            } else {
                const itemDetails = data[0]
                const itemPrice = convertToEuros(itemDetails.price)
                console.log(`Creating payment with item ${data[0].name} and price ${itemPrice}`)
                const create_payment_json = {
                    intent: 'sale',
                    payer: {
                        payment_method: 'paypal',
                    },
                    redirect_urls: {
                        return_url: `${process.env.URL}/checkout/success?itemSku=${item}`,
                        cancel_url: `${process.env.URL}/checkout/cancel`,
                    },
                    transactions: [
                        {
                            item_list: {
                                items: [
                                    {
                                        name: itemDetails.name,
                                        price: itemPrice,
                                        sku: itemDetails.sku,
                                        currency: itemDetails.currency,
                                        quantity: 1,
                                    },
                                ],
                            },
                            amount: {
                                currency: itemDetails.currency,
                                total: itemPrice,
                            },
                            description: 'Hat for the best team ever',
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
        })
    });
});

// Stripe payment route
router.post('/stripe/:item', async (req, res) => {
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
            {
                price_data: {
                    currency: "eur",
                    product_data: {
                        name: "T-shirt",
                        description: 'Ein cooles T-Shirt zum anziehen!'
                    },
                    unit_amount: 2000,
                },
                quantity: 1,
            },
        ],
        mode: "payment",
        success_url: "https://example.com/success",
        cancel_url: "https://example.com/cancel",
    })
    res.json({ id: session.id });
})

router.get('/success', (req, res) => {
    const payerId = req.query.PayerID;
    const paymentId = req.query.paymentId;
    const itemId = req.query.itemSku

    // Find details of bought item in database
    connection.db.collection("shop-items", function (err, collection) {
        collection.find({ sku: itemId }).toArray(function (err, data) {
            const itemDetails = data[0]
            const itemPrice = convertToEuros(itemDetails.price)
            // Set item details
            const execute_payment_json = {
                payer_id: payerId,
                transactions: [
                    {
                        amount: {
                            currency: itemDetails.currency,
                            total: itemPrice,
                        },
                    },
                ],
            };

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
                                    if (err) return handleError(err);
                                    console.log(data[0].name)
                                    console.log('Payment saved to database')
                                    res.render('success', { product: data[0].name, price: itemPrice, port: process.env.PORT });
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
        })
    })
});

router.get('/cancel', (req, res) => res.send('Cancelled'));

function convertToEuros(cents) {
    return cents / 100
}

module.exports = router