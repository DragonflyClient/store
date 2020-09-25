const express = require('express');
const router = express.Router();
const { connection, findItemById } = require('../mongoose.js');
const mongoose = require('mongoose');
const Referral = require('../models/Referral');
const axios = require('axios').default

const MODE = process.env.MODE

router.get('/*/:partner', async (req, res) => {
    console.log(MODE)
    if (MODE === "DEVELOPMENT") {
        const dragonflyToken = req.cookies["dragonfly-token"]
        if (!dragonflyToken) return res.render("error", { message: 'Please login in order to see this content.', backUrl: "https://playdragonfly.net", paymentId: null })

        const result = await axios.post('https://api.playdragonfly.net/v1/authentication/token', {}, {
            headers: {
                "Authorization": `Bearer ${dragonflyToken}`
            }
        })
        if (result.data.permissionLevel <= 8) return res.render("error", { message: 'You don\'t have permission to access this resource.', backUrl: "https://playdragonfly.net", paymentId: null })
    }
    // Normally render page
    const partner = req.params.partner
    const refLink = await mongoose.connection.db.collection('ref-links').findOne({ name: partner.toString().toLowerCase() });

    if (refLink !== null) {

        const itemsCollection = await mongoose.connection.db.collection('shop-items').find({});

        let items = [];
        await itemsCollection.forEach((result) => items.push(result));
        res
            .cookie('ref', refLink.name, { expires: new Date(Date.now() + 3600000), sameSite: "Lax" })
            .status(201)
            .render('index', { shopItems: items, refName: partner, refType: refLink.type, refAmount: refLink.amount })
    } else {
        res.status(404)
            .clearCookie('ref', { domain: "store.playdragonfly.net" })
            .redirect('/')
    }
})

router.get('/:partner', async (req, res) => {
    const partner = req.params.partner
    const refLink = await mongoose.connection.db.collection('ref-links').findOne({ name: partner.toString().toLowerCase() });

    if (refLink !== null) {

        const itemsCollection = await mongoose.connection.db.collection('shop-items').find({});

        let items = [];
        await itemsCollection.forEach((result) => items.push(result));
        res
            .cookie('ref', refLink.name, { expires: new Date(Date.now() + 3600000), sameSite: "Lax" })
            .status(201)
            .render('index', { shopItems: items, refName: partner, refType: refLink.type, refAmount: refLink.amount })
    } else {
        res.status(404)
            .clearCookie('ref', { domain: "store.playdragonfly.net" })
            .redirect('/')
    }
})
module.exports = router