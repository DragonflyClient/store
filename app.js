const express = require('express');
const credentials = require("./creds");

const mongoose = require('mongoose')
mongoose.connect(`mongodb://${credentials.db.username}:${credentials.db.password}@45.85.219.34:27017/dragonfly`,
  { useNewUrlParser: true, useUnifiedTopology: true },
  console.log('Connected to DB'))

const connection = mongoose.connection
const paypal = require('paypal-rest-sdk');
const Payment = require('./models/Payment')

const ejs = require('ejs');

paypal.configure({
  mode: 'sandbox', //sandbox or live
  client_id: 'AZ2PIM52fwyyGplIFsyxOby4VNAs9FsemN2aeoOczniDRqpzHoJWxBJkyICcmWuGYQVU_M5BSFVo1T5z',
  client_secret: 'EKCpsBMeOYdnADAoZEVdRdhKT9NKeoaMaKg34ZsCLHxzOZAd8n4zgN5SA7FC9kwQGC3w-FMWN55Eqred',
});

const app = express();

app.set('view engine', 'ejs');

app.get('/', (req, res) => res.render('index'));

app.post('/pay/:item', (req, res) => {
  const item = req.params.item.toString()

  connection.db.collection("shop-items", function (err, collection) {
    collection.find({ sku: item }).toArray(function (err, data) {
      if (data.length < 1) {
        console.log('Item not found')
        res.send('Item not found')
      } else {
        const itemDetails = data[0]
        const itemPrice = convertToEuros(itemDetails.price)
        console.log(itemPrice)
        console.log(data[0].name)
        const create_payment_json = {
          intent: 'sale',
          payer: {
            payment_method: 'paypal',
          },
          redirect_urls: {
            return_url: `http://localhost:3000/success?itemSku=${item}`,
            cancel_url: 'http://localhost:3000/cancel',
          },
          transactions: [
            {
              item_list: {
                items: [
                  {
                    name: itemDetails.name,
                    price: itemPrice,
                    sku: itemDetails.sku,
                    currency: itemDetails.currency,
                    quantity: 1,
                  },
                ],
              },
              amount: {
                currency: itemDetails.currency,
                total: itemPrice,
              },
              description: 'Hat for the best team ever',
            },
          ],
        };
        paypal.payment.create(create_payment_json, function (error, payment) {
          if (error) {
            throw error;
          } else {
            for (let i = 0; i < payment.links.length; i++) {
              if (payment.links[i].rel === 'approval_url') {
                res.redirect(payment.links[i].href);
              }
            }
          }
        });
      }
    })
  });
});

app.get('/success', (req, res) => {
  const payerId = req.query.PayerID;
  const paymentId = req.query.paymentId;
  const itemId = req.query.itemSku

  connection.db.collection("shop-items", function (err, collection) {
    collection.find({ sku: itemId }).toArray(function (err, data) {
      const itemDetails = data[0]
      const itemPrice = convertToEuros(itemDetails.price)
      const execute_payment_json = {
        payer_id: payerId,
        transactions: [
          {
            amount: {
              currency: itemDetails.currency,
              total: itemPrice,
            },
          },
        ],
      };


      paypal.payment.execute(paymentId, execute_payment_json, function (error, payment) {
        if (error) {
          console.log(error.response);
          throw error;
        } else {
          // console.log(JSON.stringify(payment));

          //
          if (payment.transactions[0].amount.total == itemPrice) {
            console.log('Everything alright', "Item Price :", itemPrice, "Paypal price", payment.transactions[0].amount.total)
          } else {
            console.log('Not good', "Item Price :", itemPrice, "Paypal price", payment.transactions[0].amount.total)
          }

          const newPayment = new Payment({
            payId: payment.id,
            paymentState: payment.state,
            creationDate: payment.create_time,
            itemName: payment.transactions[0].item_list.items[0].name,
            itemSku: payment.transactions[0].item_list.items[0].sku
          });

          newPayment.collection.findOne({ payId: payment.id }, function (err, payment) {
            if (payment.length == 0) {
              newPayment.save(function (err) {
                if (err) return handleError(err);
                console.log('Payment saved to database')
                res.send('Success');
              });
            } else {
              res.send('Already in db');
            }
          })
        }
      });
    })
  })
});

app.get('/cancel', (req, res) => res.send('Cancelled'));

function convertToEuros(cents) {
  return cents / 100
}

function eurosToCents(euros) {
  return euros * 100
}

app.listen(3000, () => console.log('Server Started'));
