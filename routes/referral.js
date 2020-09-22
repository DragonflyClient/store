const express = require('express');
const router = express.Router();
const { connection, findItemById } = require('../mongoose.js');
const mongoose = require('mongoose');
const Referral = require('../models/Referral')

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

router.post('/type/:name/:type', async (req, res) => {
    const { name, type } = req.params
    const validRefTypes = ["discount", "bonus"]
    console.log(validRefTypes.includes(type))
    if (!validRefTypes.includes(type)) return res.status(400).send({ message: "Invalid ref type" })

    const collectionRefLinks = mongoose.connection.db.collection('ref-links')
    const refLink = await collectionRefLinks.findOne({ name: name })
    if (refLink.type === type) return res.status(200).send({ message: `Ref type already set to ${type}` })

    const updatedRefLink = await collectionRefLinks.findOneAndUpdate({ name: name }, { $set: { type: type } })

    if (!refLink) return res.status(400).send({ message: `Referral with name ${name} could not found` })
    console.log(updatedRefLink)
    res.send({ name: name, type: type, ref: updatedRefLink })
})

module.exports = router