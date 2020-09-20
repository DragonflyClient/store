const express = require('express');
const router = express.Router();
const { connection, findItemById } = require('../mongoose.js');
const mongoose = require('mongoose');

router.get('/:partner', async (req, res) => {
    const partner = req.params.partner
    const refLink = await mongoose.connection.db.collection('ref-links').findOne({ name: partner.toString().toLowerCase() });
    // let refs = [];
    console.log(refLink)

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