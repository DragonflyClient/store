const modalClose = document.querySelectorAll('.close');
console.log(document.querySelectorAll('.close'));

// Reset all inputs on page load
window.addEventListener('load', () => {
  const allInputs = document.querySelectorAll('input');
  allInputs.forEach((input) => {
    console.log(input);
    input.value = input.defaultValue || input.defaultChecked;
  });
});

modalClose.forEach((close) => {
  close.addEventListener('click', () => {
    const modals = document.querySelectorAll('.checkout-modal');
    modals.forEach((modal) => {
      modal.style.opacity = '0';
      setTimeout(() => {
        modal.style.display = 'none';
      }, 500);
    });
  });
});

const checkoutButtons = document.querySelectorAll('.btn-modal');

checkoutButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const itemSku = button.dataset.item;
    console.log('checkout');
    openCheckout(itemSku);
  });
});

function openCheckout(item) {
  const modal = document.getElementsByClassName(`checkout-modal-${item}`)[0];
  modal.style.opacity = '1';
  modal.style.display = 'block';

  const paymentMethodInputs = modal.querySelectorAll(`[name]`);
  const warningDiv = modal.querySelector('.payment-warning');

  const buyButton = modal.querySelector('.btn-checkout');

  let paymentMethod;
  paymentMethodInputs.forEach((input) => {
    console.log(input.checked, input.value);
    if (input.checked) {
      paymentMethod = input.value;
      console.log(paymentMethod, 'pmntmt');
    }
    input.addEventListener('change', (e) => {
      paymentMethod = e.target.value;
      console.log(paymentMethod);
      warningDiv.innerHTML = ``;
    });
  });
  buyButton.addEventListener('click', (e) => {
    const method = paymentMethod;
    const itemSku = e.target.dataset.item;

    if (method === 'card') {
      checkoutStripe(item);
    } else if (method == 'paypal') {
      createCheckout(itemSku, method);
    } else {
      warningDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> Please select a payment method`;
      console.log('Select payment method');
    }
  });
}

function redirectPost(url, data) {
  var form = document.createElement('form');
  document.body.appendChild(form);
  form.method = 'post';
  form.action = url;
  form.submit();
}

function createCheckout(item, payment) {
  console.log(payment);
  redirectPost(`http://localhost:1550/checkout/${payment}/${item}`);
}

// Stripe payment

// Create an instance of the Stripe object with your publishable API key
var stripe = Stripe(
  'pk_test_51HIeRJJiA7J6VkORo5vkIrE2RnoSJ40f9kTtHn8UlGPV2WBDEo7XQXpLrhR0bcsCJFMPDRjo1zi8fOv2gK540Kbj00PiHw81oE'
);
var checkoutButton = document.getElementById('checkout-button');

function checkoutStripe(itemSku) {
  // Create a new Checkout Session using the server-side endpoint you
  // created in step 3.
  fetch(`http://localhost:1550/checkout/stripe/${itemSku}`, {
    method: 'POST',
  })
    .then(function (response) {
      console.log('here');
      return response.json();
    })
    .then(function (session) {
      return stripe.redirectToCheckout({ sessionId: session.id });
    })
    .then(function (result) {
      // If `redirectToCheckout` fails due to a browser or network
      // error, you should display the localized error message to your
      // customer using `error.message`.
      if (result.error) {
        alert(result.error.message);
      }
    })
    .catch(function (error) {
      console.error('Error:', error);
    });
}
