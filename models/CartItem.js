const mongoose = require('mongoose')

const CartItemSchema = mongoose.Schema({
    uuid: {
        type: String,
        required: true
    },
    items: {
        type: [String],
        required: true
    },
    bonus: {
        type: String
    }
})


module.exports = mongoose.model('CartItem', CartItemSchema, 'store-cart')