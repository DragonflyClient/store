const express = require('express');
const router = express.Router();
const { connection, findItemById, findItemByRefName } = require('../mongoose.js');
const mongoose = require('mongoose');
const paypal = require('paypal-rest-sdk');
const stripe = require('stripe')(process.env.STRIPE_SECRET);
const Payment = require('../models/Payment');
const Referral = require('../models/Referral')
const nodemailer = require('nodemailer')
const moment = require('moment')
const axios = require('axios').default

const drgnNoreplyEmail = {
  user: process.env.DRGN_NOREPLY_EMAIL_USERNAME,
  password: process.env.DRGN_NOREPLY_EMAIL_PASSWORD
}

const drgnAdminEmail = {
  user: process.env.DRGN_ADMIN_EMAIL_USERNAME,
  password: process.env.DRGN_ADMIN_EMAIL_PASSWORD
}

paypal.configure({
  mode: 'sandbox', //sandbox or live
  client_id: process.env.PAYPAL_CLIENT_ID,
  client_secret: process.env.PAYPAL_CLIENT_SECRET,
});

router.get('/', (req, res) => {
  res.send('Ready to receive payments');
});

// Stripe payment route
router.post('/stripe/:item_id', async (req, res) => {
  const email = req.query.email
  console.log(email, 'payment route')
  const itemId = req.params.item_id.toString();
  const token = req.cookies['dragonfly-token'];
  if (!token) {
    res.json({ error: true, message: 'You have to be logged in to purchase an item from the Dragonfly store.' });
    console.log('no dragonfly-token');
    return
  }

  const refName = req.cookies['ref']
  const item = await findItemById(itemId);
  let itemPrice = item.price
  if (refName) {
    const ref = await findItemByRefName(refName)
    if (ref.type === "discount") itemPrice = item.price - (item.price / 100 * ref.amount);
    console.log(itemPrice, " | Item price + ", ref + " | Referral information")
  }
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: item.currency,
          product_data: {
            name: item.name,
            description: item.description,
          },
          unit_amount: itemPrice,
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      metadata: {
        item_id: itemId,
        dragonfly_token: token,
        email: email
      },
    },
    mode: 'payment',
    success_url: `${process.env.URL}/checkout/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.URL}/checkout/cancel`,
  });
  res.json({ id: session.id });

});

async function executePayment(paymentId, ref) {
  return await axios.post('https://api.playdragonfly.net/v1/store/execute_payment', {
    "paymentId": paymentId,
    "refName": ref
  }, {})
}

// Stripe success route
router.get('/stripe/success', async (req, res) => {
  const sessionId = req.query.session_id;
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const intent = await stripe.paymentIntents.retrieve(session.payment_intent);
  const ref = req.cookies['ref']

  let referral;
  let refAmount;
  if (await validRef(ref)) {
    referral = ref
    refAmount = await findItemByRefName(ref)
  }

  // check intent status
  if (intent.status !== 'succeeded') return res.render('error', {
    message: 'Payment did not succeed!', paymentId: intent.id,
    backUrl: referral ? `https://store.playdragonfly.net/ref/${referral}` : `https://store.playdragonfly.net/?ref=pay`
  });

  const itemId = intent.metadata.item_id;
  const email = intent.metadata.email
  const item = await findItemById(itemId);

  console.log(intent.amount_received, item.price, refAmount)

  // check if item was found
  if (item == null) return res.render('error', {
    message: 'Item not found!', paymentId: intent.id,
    backUrl: referral ? `https://store.playdragonfly.net/ref/${referral}` : `https://store.playdragonfly.net/?ref=pay`
  });

  if (refAmount) {
    if (refAmount.type == "discount") {
      if (intent.amount_received !== item.price - (((item.price) * refAmount.amount) / 100)) return res.render('error', {
        message: 'Incorrect price received!', paymentId: intent.id,
        backUrl: referral ? `https://store.playdragonfly.net/ref/${referral}` : `https://store.playdragonfly.net/?ref=pay`
      });
    } else {
      if (intent.amount_received !== item.price) return res.render('error', {
        message: 'Incorrect price received!', paymentId: intent.id,
        backUrl: referral ? `https://store.playdragonfly.net/ref/${referral}` : `https://store.playdragonfly.net/?ref=pay`
      });
    }
  }


  const token = req.cookies['dragonfly-token'];

  // check dragonfly token
  if (intent.metadata.dragonfly_token !== token)
    return res.render('error', {
      message: 'Invalid Dragonfly authentication token', paymentId: intent.id,
      backUrl: referral ? `https://store.playdragonfly.net/ref/${referral}` : `https://store.playdragonfly.net/?ref=pay`
    })

  console.log('Everything alright', 'Item price:', item.price, '| Received amount:', intent.amount_received);

  // Create new payment
  const newPayment = new Payment({
    provider: 'STRIPE',
    paymentId: intent.id,
    payerEmail: email,
    paymentState: intent.status,
    receivedAmount: intent.amount_received,
    receivedCurrency: intent.currency,
    creationDate: intent.created * 1000,
    dragonflyToken: token,
    itemId: item.id,
    itemName: item.name,
    itemPrice: item.price,
    itemCurrency: item.currency,
    ref: referral
  });

  newPayment.collection.findOne({ paymentId: intent.id }, function (err, payment) {
    // Only insert payment if it hasn't already been done
    if (!payment) {
      newPayment.save(async function (err) {
        if (err) return res.render('error', { message: err, paymentId: intent.id, backUrl: referral ? `https://store.playdragonfly.net/ref/${referral}` : `https://store.playdragonfly.net/?ref=pay` });

        console.log(referral, "RefLink")
        const execution = await executePayment(newPayment.paymentId, referral)
        if (execution.status === 200) {

          console.log("SUCCESS")
          if (email && email !== '') await sendEmail(newPayment, email)
          console.log(newPayment, newPayment.ref, "PAYMENT")
          if (newPayment.ref && refAmount.type === "bonus") await setRefBonus(newPayment)

          console.log('Payment executed successfully');
          res.render('success', { product: item.name, price: convertToEuros(item.price), port: process.env.PORT, backUrl: referral ? `https://store.playdragonfly.net/ref/${referral}` : `https://store.playdragonfly.net/?ref=pay` });
        } else {
          console.log('Payment execution failed: ' + execution.status + " - " + execution.data);
          res.render('error', { message: 'Payment execution failed! Please contact the Dragonfly support.', paymentId: intent.id, backUrl: referral ? `https://playdragonfly.net/ref/${referral}` : `https://store.playdragonfly.net/?ref=pay` })
        }
      });
    } else {
      console.log(referral)
      res.render('error', {
        message: 'The article has already been purchased with this payment ID.', paymentId: intent.id,
        backUrl: referral ? `https://store.playdragonfly.net/ref/${referral}` : `https://store.playdragonfly.net/?ref=pay`
      })
    }
  });
});

// PayPal payment route
router.post('/paypal/:item_id', async (req, res) => {
  const email = req.query.email
  console.log(email)
  // Get item from params
  const itemId = req.params.item_id.toString();
  const item = await findItemById(itemId);
  const token = req.cookies['dragonfly-token'];
  const refName = req.cookies['ref']

  if (!token) {
    console.log('no dragonfly-token');
    res.render('error', {
      message: 'You have to be logged in to purchase an item from the Dragonfly store.', paymentId: intent.id,
      backUrl: referral ? `https://store.playdragonfly.net/ref/${referral}` : `https://store.playdragonfly.net/?ref=pay`
    });
  } else {
    // Get item details from database
    if (item == null) {
      console.log('Item not found');
      res.send('Item not found');
    } else {
      let itemPrice = convertToEuros(item.price)
      if (refName) {
        const ref = await findItemByRefName(refName)
        console.log(ref, 'REF FROM DB')
        if (ref.type === "discount") itemPrice = convertToEuros(item.price) - (convertToEuros(item.price) / 100 * ref.amount);
        console.log(itemPrice, "ITEM PRICE")
      }

      console.log(itemPrice, "ITEM PRICE!!")
      console.log(`Creating payment with item ${item.name} and price ${itemPrice}`);
      const create_payment_json = {
        intent: 'sale',
        payer: {
          payment_method: 'paypal',
        },
        redirect_urls: {
          return_url: `${process.env.URL}/checkout/paypal/success?item_id=${itemId}&payerEmail=${email}`,
          cancel_url: `${process.env.URL}/checkout/cancel`,
        },
        transactions: [
          {
            item_list: {
              items: [
                {
                  name: item.name,
                  price: itemPrice,
                  sku: item.id,
                  currency: item.currency,
                  description: item.description,
                  quantity: 1,
                },
              ],
            },
            amount: {
              currency: item.currency,
              total: itemPrice,
            },
          },
        ],
      };

      // Open paypal payment
      paypal.payment.create(create_payment_json, function (error, payment) {
        if (error) {
          throw error;
        } else {
          for (let i = 0; i < payment.links.length; i++) {
            if (payment.links[i].rel === 'approval_url') {
              // Redirect to checkout
              res.redirect(payment.links[i].href);
            }
          }
        }
      });
    }
  }
});

// PayPal success route
router.get('/paypal/success', async (req, res) => {
  const payerId = req.query.PayerID;
  const payerEmail = req.query.payerEmail
  const paymentId = req.query.paymentId;
  const token = req.cookies['dragonfly-token'];
  const ref = req.cookies['ref']

  let referral;
  let refAmount;
  console.log(ref)
  if (ref && await validRef(ref)) {
    referral = ref
    refAmount = await findItemByRefName(ref)
  }
  console.log(payerEmail, 'PAYER-EMAIL!')

  let itemId = req.query.item_id;
  let item = await findItemById(itemId);
  let itemPrice;

  console.log(item.price, item)

  if (refAmount && refAmount.type == "discount") {
    itemPrice = (item.price - (((item.price) * refAmount.amount) / 100)) / 100
    console.log(itemPrice, "ITEM PRICE SUCCESS")
  } else {
    itemPrice = item.price / 100
  }


  // Set item details
  const execute_payment_json = {
    payer_id: payerId,
    transactions: [
      {
        amount: {
          currency: item.currency,
          total: itemPrice, // TODO: test this!!
        },
      },
    ],
  };

  console.log(execute_payment_json, execute_payment_json.transactions[0].amount.total, "PAYMENT DETAILS")

  // Execute paypal payment
  paypal.payment.execute(paymentId, execute_payment_json, async function (error, payment) {
    if (error) {
      console.log(error.response);
      res.render('error', {
        message: `${error.response.message}. Please try again later.`, paymentId: paymentId,
        backUrl: referral ? `https://store.playdragonfly.net/ref/${referral}` : `https://store.playdragonfly.net/?ref=pay`
      })
      throw error;
    } else {
      // Check if paid price is the same as the price from the db
      if (payment.transactions[0].amount.total == itemPrice) {
        console.log(
          'Everything alright',
          'Item Price:',
          itemPrice,
          '| Paypal price:',
          payment.transactions[0].amount.total
        );
        // Create new payment

        itemId = payment.transactions[0].item_list.items[0].sku;
        item = await findItemById(itemId);

        const newPayment = new Payment({
          provider: 'PAYPAL',
          paymentId: payment.id,
          payerEmail: payerEmail,
          paymentState: payment.state,
          receivedAmount: payment.transactions[0].amount.total * 100,
          receivedCurrency: payment.transactions[0].item_list.items[0].currency,
          creationDate: new Date(payment.create_time).getTime(),
          dragonflyToken: token,
          itemId: itemId,
          itemName: item.name,
          itemPrice: item.price,
          itemCurrency: item.currency,
          ref: referral
        });

        newPayment.collection.findOne({ paymentId: payment.id }, function (err, payment) {
          // Only insert payment if it hasn't already been done
          if (err) return console.log(err, "ERR")
          if (!payment) {
            newPayment.save(async function (err) {
              if (err) return res.render('error', {
                message: err, paymentId: paymentId,
                backUrl: referral ? `https://store.playdragonfly.net/ref/${referral}` : `https://store.playdragonfly.net/?ref=pay`
              });

              const execution = await executePayment(newPayment.paymentId, referral)
              if (execution.status === 200) {
                if (payerEmail && payerEmail !== '') await sendEmail(newPayment, payerEmail)
                if (newPayment.ref && refAmount.type === "bonus") await setRefBonus(newPayment)
                console.log('Payment executed successfully');
                res.render('success', {
                  product: item.name, price: itemPrice, port: process.env.PORT,
                  backUrl: referral ? `https://store.playdragonfly.net/ref/${referral}` : `https://store.playdragonfly.net/?ref=pay`
                });
              } else {
                console.log('Payment execution failed: ' + execution.status + " - " + execution.data);
                res.render('error', {
                  message: `Payment execution failed! Please contact the Dragonfly support.`, paymentId: paymentId,
                  backUrl: referral ? `https://store.playdragonfly.net/ref/${referral}` : `https://store.playdragonfly.net/?ref=pay`
                })
              }
            });
          } else {
            res.render('error', {
              message: `The article has already been purchased with this payment ID.`, paymentId: paymentId,
              backUrl: referral ? `https://store.playdragonfly.net/ref/${referral}` : `https://store.playdragonfly.net/?ref=pay`
            })
          }
        });
      } else {
        console.log('Not good', 'Item Price :', itemPrice, 'Paypal price', payment.transactions[0].amount.total);
      }
    }
  });
});

router.get('/cancel', (req, res) => res.send('Cancelled'));

// Send email with nodemailer
async function sendEmail(details, receiver) {
  console.log(receiver, 'RECEIVER EMAIL')
  // create reusable transporter object using the default SMTP transport
  let transporter = nodemailer.createTransport({
    pool: true,
    host: 'cmail01.mc-host24.de',
    port: 25,
    secure: false, // true for 465, false for other ports
    auth: {
      user: drgnNoreplyEmail.user, // generated ethereal user
      pass: drgnNoreplyEmail.password // generated ethereal password
    }
  });

  const username = await getUserByToken(details.dragonflyToken)

  // setup email data with unicode symbols
  let mailOptions = {
    from: `"Dragonfly Store" ${drgnNoreplyEmail.user}`, // sender address
    bcc: `${receiver}, admin@inceptioncloud.net`, // list of receivers
    subject: 'Order confirmation', // Subject line
    text: `Hey ${username}, thank you for purchasing ${details.itemName} from our Shop.`,
    html: `
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
</head>
<style>
    @import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&display=swap');

    * {
        font-family: Rubik;
    }

    * {
        font-size: 1rem;
    }

    a[href] {
        color: #15c;
    }

    b,
    strong {
        font-weight: 500;
    }
</style>

<body>
    <div>

        <table cellpadding="0" cellspacing="0" style="border-radius:4px;border:1px #ccc solid;font-size:12.8px"
            border="0" align="center">
            <tbody>
                <tr>
                    <td colspan="3" height="20"></td>
                </tr>
                <tr style="line-height:0px;">
                    <td width="100%" style="font-size:0px;" align="center" height="1">
                        <img width="40px" style="max-height:73px;width:160px" alt=""
                            src="https://playdragonfly.net/assets/Dragon.png" class="CToWUd hoverZoomLink">
                    </td>
                </tr>
                <tr>
                    <td>
                        <table cellpadding="0" cellspacing="0" style="line-height:25px" border="0" align="center">
                            <tbody>
                                <tr>
                                    <td colspan="3" height="20"></td>
                                </tr>
                                <tr>
                                    <td width="36"></td>
                                    <td width="454" align="left" valign="top">
                                        <p>Hey <b>${username}</b>,</p>
                                        <p><span>Thank you for your purchase! This email confirms that we have received
                                                your
                                                payment and you should receive your items soon. If you do not receive
                                                your
                                                items within the next hour, please contact our support. Please do not
                                                email
                                                Mojang.</span></p>

                                        <p>
                                            <strong>Order summary: </strong>
                                        </p>
                                        <p>
                                        </p>
                                        <ul>
                                            <li>1 <b>x</b> ${details.itemName}</li>
                                        </ul>
                                        <div><b>Total</b>: <b>${convertToEuros(details.receivedAmount).toFixed(2)} ${(details.receivedCurrency).toUpperCase()}</b></div>
                                        <p>For further questions we are available on our <a href="https://icnet.dev/discord">Discord</a> server and by <a href="mailto:support@playdragonfly.net">email</a>.
                                        </p>
                                        <a href="https://store.playdragonfly.net/" target="_blank">Shop</a> - <a href="https://ideas.playdragonfly.net/" target="_blank">Ideas</a> - <a href="https://playdragonfly.net/releasenotes" target="_blank">Updates</a>
                                    </td>
                                    <td width="36"></td>
                                </tr>
                                <tr>
                                    <td colspan="3" height="36"></td>
                                </tr>
                            </tbody>
                        </table>
                    </td>
                </tr>
            </tbody>
        </table>
        </div>
    </div>
</body>

</html>
` // html body
  };

  // send mail with defined transport object
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.log(error);
    }
    console.log('EMAIL SENT')
    console.log(moment().format('MMMM Do YYYY, h:mm:ss a') + " | " + `Message sent! Accepted Emails: ${info.accepted}, Rejected Emails: ${info.rejected}, Message time: ${info.messageTime}`);
  });
}

async function getUserByToken(token) {
  const response = await axios.post('https://api.playdragonfly.net/v1/authentication/token', {}, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  return response.data.username
  // https://api.playdragonfly.net/v1/authentication/cookie/token
}

function convertToEuros(cents) {
  return (cents / 100);
}

async function validRef(ref) {
  if (ref) {
    const refLink = await mongoose.connection.db.collection('ref-links').findOne({ name: ref.toString().toLowerCase() })
      .catch(err => console.log(err))

    if (refLink !== null) {
      return true
    } else {
      return false
    }
  }
}

async function setRefBonus(payment) {
  const refAmount = await findItemByRefName(payment.ref)
  console.log(refAmount, "REF AMOUNT")
  console.log(payment, payment.itemPrice)
  console.log((convertToEuros(payment.itemPrice).toFixed(2) / 100) * refAmount.amount)
  const newRef = new Referral({
    refName: payment.ref,
    amount: (convertToEuros(payment.itemPrice).toFixed(2) / 100) * refAmount.amount,
    article: payment.itemName,
    creationDate: new Date(payment.creationDate).getTime(),
  });

  newRef.collection.findOne({ refName: payment.ref }, async function (err, referral) {
    if (!referral) {
      newRef.save(function (err) {
        // if (err) console.log(err)
        if (err) console.log("ERR")
        console.log(`Saved ref bonus for ${payment.ref}`)
      });
    } else {
      await newRef.collection.updateOne({ refName: payment.ref }, { $set: { amount: referral.amount + (convertToEuros(payment.itemPrice).toFixed(2) / 100) * refAmount.amount } })
    }
  })
}
module.exports = router;
