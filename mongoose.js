require('dotenv/config')
const mongoose = require('mongoose')
mongoose.connect(`mongodb://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@45.85.219.34:27017/dragonfly`,
    { useNewUrlParser: true, useUnifiedTopology: true },
    console.log('Connected to DB'))

const connection = mongoose.connection

function findItemById(itemId) {
    return mongoose.connection.db.collection("shop-items").findOne({ id: itemId })
}

function findItemByRefName(name) {
    return mongoose.connection.db.collection("ref-links").findOne({ name: name })
}

exports.connection = connection
exports.findItemById = findItemById
exports.findItemByRefName = findItemByRefName