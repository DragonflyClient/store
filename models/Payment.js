const mongoose = require('mongoose')

const PaymentSchema = mongoose.Schema({
    payId: {
        type: String,
        required: true
    },
    paymentState: {
        type: String,
        required: true
    },
    creationDate: {
        type: String,
        required: true
    },
    itemName: {
        type: String,
        required: true
    },
    itemSku: {
        type: String,
        required: true
    }
})


module.exports = mongoose.model('Payment', PaymentSchema, 'payments')