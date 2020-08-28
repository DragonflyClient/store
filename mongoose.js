require('dotenv/config')
const mongoose = require('mongoose')
mongoose.connect(`mongodb://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@45.85.219.34:27017/dragonfly`,
    { useNewUrlParser: true, useUnifiedTopology: true },
    console.log('Connected to DB'))

const connection = mongoose.connection

function findItemById(itemId) {
    return connection.db.collection("shop-items").findOne({ sku: itemId })
}

exports.connection = connection
exports.findItemById = findItemById