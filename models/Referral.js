const mongoose = require('mongoose')

const ReferralSchema = mongoose.Schema({
    refName: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    article: {
        type: String
    },
    creationDate: {
        type: Number,
        required: true
    }
})


module.exports = mongoose.model('Referral', ReferralSchema, 'ref-bonus')