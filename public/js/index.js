const modalClose = document.querySelectorAll('.close');

// Get the modal
const modalVideo = document.getElementById("modal-video");

// Get the image and insert it inside the modal - use its "alt" text as a caption
const images = document.querySelectorAll(".show-video");
const modalVideoPreview = document.getElementById("modal-video-preview");
const captionText = document.getElementById("caption-video");

images.forEach(img => {
  img.onclick = function () {
    modalVideo.style.opacity = "1"
    modalVideo.style.display = "block"
    modalVideoPreview.src = this.dataset.source;
    captionText.innerHTML = this.dataset.caption;
  }
})

// Get the <span> element that closes the modal
const span = document.getElementsByClassName("close")[0];

// When the user clicks on <span> (x), close the modal
span.onclick = function () {
  modalVideo.style.opacity = "0"
  setTimeout(function () {
    modalVideo.style.display = "none";
  }, 300)
}

console.log(document.querySelectorAll('.close'));

// Reset all inputs on page load
window.addEventListener('load', () => {
  const allInputs = document.querySelectorAll('input');
  allInputs.forEach((input) => {
    console.log(input);
    if (input.type !== "text" && input.type !== "email") {
      input.value = input.defaultValue || input.defaultChecked;

    }
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

  const paymentMethodInputs = modal.querySelectorAll(`.payment-input`);
  const emailInput = modal.querySelector('.payment-email')
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
      if (warningDiv.textContent.indexOf('Please select a payment method') > -1) {
        warningDiv.innerText = ``;
      }
    });
  });
  buyButton.addEventListener('click', (e) => {
    const method = paymentMethod;
    const itemSku = e.target.dataset.item;
    const emailAddress = emailInput.value

    fetch("https://api.playdragonfly.net/v1/authentication/cookie/token", {
      method: 'POST',
      credentials: 'include'
    }).then(res => {
      if (res.status === 200) {
        res.json().then(res => {
          console.log(res)
          if (res.success) {
            if (method === 'card') checkoutStripe(itemSku, emailAddress);
            else if (method == 'paypal') createCheckout(itemSku, method, emailAddress);
            else {
              warningDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> Please select a payment method`;
              console.log('Select payment method');
            }
          }
          else {
            console.log(res.error, 'not logged in'); warningDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> You have to be logged in to purchase an item from the Dragonfly store.'
          }
        })
      } else {
        console.log(res.error)
        warningDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Internal server error. Please try again later.'
      }
    })


  });
}

function redirectPost(url, data) {
  var form = document.createElement('form');
  document.body.appendChild(form);
  form.method = 'post';
  form.action = url;
  form.submit();
}

function createCheckout(item, payment, email) {
  console.log(payment);
  redirectPost(`https://store.playdragonfly.net/checkout/${payment}/${item}?email=${email}`);
}

// Stripe payment

// Create an instance of the Stripe object with your publishable API key
var stripe = Stripe(
  'pk_test_51HIeRJJiA7J6VkORo5vkIrE2RnoSJ40f9kTtHn8UlGPV2WBDEo7XQXpLrhR0bcsCJFMPDRjo1zi8fOv2gK540Kbj00PiHw81oE'
);
var checkoutButton = document.getElementById('checkout-button');

function checkoutStripe(itemSku, email) {
  // Create a new Checkout Session using the server-side endpoint you
  // created in step 3.
  fetch(`https://store.playdragonfly.net//checkout/stripe/${itemSku}?email=${email}`, {
    method: 'POST',
  })
    .then(function (response) {
      return response.json();
    })
    .then(function (session) {
      console.log(session.error)
      if (session.error) {
        location.href = 'https://playdragonfly.net/login?ref=https://store.playdragonfly.net'
        console.log('Error')
      } else {
        stripe.redirectToCheckout({ sessionId: session.id })
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
    })
}
