const mongoose = require('mongoose')

const ReferralSchema = mongoose.Schema({
    refName: {
        type: String,
        required: true
    },
    refUUID: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    count: {
        type: Number,
        required: true,
        default: 1
    },
    creationDate: {
        type: Number,
        required: true
    }
})


module.exports = mongoose.model('Referral', ReferralSchema, 'ref-bonus')