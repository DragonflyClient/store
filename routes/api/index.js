const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const axios = require('axios').default


router.get('/ref/info', async (req, res) => {
    const dragonflyToken = req.cookies["dragonfly-token"]
    if (!dragonflyToken) return res.send({ success: false, message: 'A dragonfly token is required' })
    const result = await axios.post('https://api.playdragonfly.net/v1/authentication/token', {}, {
        headers: {
            "Authorization": `Bearer ${dragonflyToken}`
        }
    })

    const collectionRefBonus = mongoose.connection.db.collection('ref-bonus')
    const collectionRefLinks = mongoose.connection.db.collection('ref-links')

    const dragonflyUUID = result.data.uuid

    const refLink = await collectionRefLinks.findOne({ uuid: dragonflyUUID })
    const refBonus = await collectionRefBonus.findOne({ refUUID: dragonflyUUID })

    if (!refBonus) return res.status(400).send({ success: false, message: `No bonus found for ${result.data.username}` })
    console.log(result.data, refBonus)

    res.status(200).send({ success: true, type: refLink.type, amount: refBonus.amount, creationDate: refBonus.creationDate })
})

router.post('/ref/type/:type', async (req, res) => {
    const type = req.params.type
    const dragonflyToken = req.cookies["dragonfly-token"]
    const validRefTypes = ["discount", "bonus"]

    if (!validRefTypes.includes(type)) return res.status(400).send({ message: "Invalid ref type" })

    if (!dragonflyToken) return res.send({ success: false, message: 'A dragonfly token is required' })

    const result = await axios.post('https://api.playdragonfly.net/v1/authentication/token', {}, {
        headers: {
            "Authorization": `Bearer ${dragonflyToken}`
        }
    })

    const dragonflyUUID = result.data.uuid

    const collectionRefLinks = mongoose.connection.db.collection('ref-links')
    const refLink = await collectionRefLinks.findOne({ uuid: dragonflyUUID })
    if (refLink.type === type) return res.status(200).send({ message: `Ref type already set to ${type}` })

    const updatedRefLink = await collectionRefLinks.findOneAndUpdate({ uuid: dragonflyUUID }, { $set: { type: type } })

    if (!refLink) return res.status(400).send({ message: `Referral with name ${dragonflyUUID} could not found` })
    console.log(updatedRefLink)
    res.send({ uuid: dragonflyUUID, type: type, ref: updatedRefLink.value })
})

module.exports = router