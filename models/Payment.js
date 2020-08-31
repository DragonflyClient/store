const mongoose = require('mongoose')

const PaymentSchema = mongoose.Schema({
    provider: {
        type: String,
        required: true
    },
    paymentId: {
        type: String,
        required: true
    },
    paymentState: {
        type: String,
        required: true
    },
    receivedAmount: {
        type: Number,
        required: true
    },
    receivedCurrency: {
        type: String,
        required: true
    },
    creationDate: {
        type: Number,
        required: true
    },
    dragonflyToken: {
        type: String,
        required: true
    },
    itemId: {
        type: String,
        required: true
    },
    itemName: {
        type: String,
        required: true
    },
    itemPrice: {
        type: Number,
        required: true
    },
    itemCurrency: {
        type: String,
        required: true
    }
})

/*
const newPayment = new Payment({
        provider: 'STRIPE',
        paymentId: intent.id,
        paymentState: intent.status,
        receivedAmount: intent.amount_received,
        receivedCurrency: intent.currency,
        creationDate: intent.created,
        dragonfly_token: token,
        itemId: item.id,
        itemName: item.name,
        itemPrice: item.price,
        itemCurrency: item.currency
    });
 */


module.exports = mongoose.model('Payment', PaymentSchema, 'payments')