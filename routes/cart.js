const express = require('express')
const router = express.Router();
const { connection, findItemById, findItemByRefName } = require('../mongoose.js');
const mongoose = require('mongoose');
const CartItem = require('../models/CartItem');
const moment = require('moment')
const axios = require('axios').default

const secureAuth = async function (req, res, next) {
    const dragonflyToken = req.cookies["dragonfly-token"]
    const dragonflyAccount = await getDragonflyAccount(dragonflyToken)
    if (!dragonflyToken || !dragonflyAccount) return res.json({ error: true, message: 'You have to be logged in to purchase an item from the Dragonfly store.' });
    next()
}

router.use(secureAuth)

router.get('/', async (req, res) => {
    const token = req.cookies["dragonfly-token"]
    if (!token) {
        res.json({ error: true, message: 'You have to be logged in to purchase an item from the Dragonfly store.' });
        console.log('no dragonfly-token');
        return
    }
    const dragonflyAccount = await getDragonflyAccount(token)

    const cart = await CartItem.findOne({ uuid: dragonflyAccount.uuid })

    if (!cart) {
        res.send({ success: true, items: null, bonus: null })
    } else {
        res.send({ success: true, items: cart.items, bonus: cart.bonus })
    }
})

router.put('/add/:item_id', async (req, res) => {
    const token = req.cookies["dragonfly-token"]
    const dragonflyAccount = await getDragonflyAccount(token)
    const itemId = req.params.item_id.toString();
    const item = await findItemById(itemId)

    if (!item || !item.id) return res.send({ success: false, message: "Requested item not found" })
    let cart = await CartItem.findOne({ uuid: dragonflyAccount.uuid })

    if (!cart) {
        cart = new CartItem({
            uuid: dragonflyAccount.uuid,
            items: [item.id],
            bonus: null
        })
    } else {
        cart.items.push(item.id)
    }
    const saved = await cart.save()
    console.log(saved)

    res.send({ success: true })
})

router.delete('/remove/:item_id', async (req, res) => {
    const token = req.cookies["dragonfly-token"]
    const dragonflyAccount = await getDragonflyAccount(token)
    const itemId = req.params.item_id.toString();
    const item = await findItemById(itemId)

    if (!item || !item.id) return res.send({ success: false, message: "Requested item not found." })
    let cart = await CartItem.findOne({ uuid: dragonflyAccount.uuid })

    if (!cart) {
        return res.send({ success: false, message: "Your shopping cart is currently empty." })
    } else {
        const itemIndex = cart.items.indexOf(item.id);
        if (itemIndex > -1) {
            cart.items.splice(itemIndex, 1)
        } else {
            return res.send({ success: false, message: "This item could not be found in your shopping cart." })
        }
    }
    await cart.save()

    res.send({ success: true })
})

router.delete('/clear', async (req, res) => {
    const token = req.cookies["dragonfly-token"]
    const dragonflyAccount = await getDragonflyAccount(token)

    let cart = await CartItem.findOne({ uuid: dragonflyAccount.uuid })
    console.log(cart)
    if (!cart) {
        return res.send({ success: false, message: "Your shopping cart is currently empty." })
    }
    await CartItem.deleteOne({ uuid: dragonflyAccount.uuid })
    res.send({ success: true })
})

async function getDragonflyAccount(token) {
    let account;
    await axios.post('https://api.playdragonfly.net/v1/authentication/token', {}, {
        headers: {
            "Authorization": `Bearer ${token}`
        }
    })
        .then(result => {
            account = result.data
        })
        .catch(err => {
            if (err) console.log("err")
        })

    return account
}

module.exports = router
