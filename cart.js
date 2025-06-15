// cart.js
// Set API_BASE to use the Render backend URL or allow override
const API_BASE = (window.API_BASE_URL || "https://ezzyssupermart.onrender.com");

function getCart() {
  return JSON.parse(localStorage.getItem('cart')) || [];
}
function saveCart(cart) {
  localStorage.setItem('cart', JSON.stringify(cart));
}
function renderCart() {
  const cart = getCart();
  const cartItems = document.getElementById('cart-items');
  const cartSummary = document.getElementById('cart-summary');
  if (!cartItems || !cartSummary) return;
  if (cart.length === 0) {
    cartItems.innerHTML = '<p>Your cart is empty.</p>';
    cartSummary.innerHTML = '';
    return;
  }
  cartItems.innerHTML = cart.map(item => `
    <div class="cart-item">
      <img src="${item.image}" alt="${item.name}">
      <div class="cart-item-details">
        <strong>${item.name}</strong><br>
        ₦${item.price} x <input type="number" min="1" value="${item.quantity}" onchange="updateQuantity(${item.id}, this.value)">
      </div>
      <div class="cart-item-controls">
        <button onclick="removeFromCart(${item.id})">Remove</button>
      </div>
    </div>
  `).join('');
  let subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  let tax = +(subtotal * 0.08).toFixed(2);
  let total = +(subtotal + tax).toFixed(2);
  cartSummary.innerHTML = `
    <p>Subtotal: ₦${subtotal.toFixed(2)}</p>
    <p>Tax (8%): ₦${tax.toFixed(2)}</p>
    <p><strong>Total: ₦${total.toFixed(2)}</strong></p>
  `;
}
function updateQuantity(id, qty) {
  let cart = getCart();
  let item = cart.find(i => i.id === id);
  if (item) item.quantity = parseInt(qty);
  saveCart(cart);
  renderCart();
}
// Update remove button logic to remove one product at a time
function removeFromCart(productId) {
  let cart = [];
  try {
    cart = JSON.parse(localStorage.getItem('cart')) || [];
  } catch (e) {}
  const idx = cart.findIndex(item => item.id === productId);
  if (idx !== -1) {
    if (cart[idx].quantity && cart[idx].quantity > 1) {
      cart[idx].quantity -= 1;
    } else {
      cart.splice(idx, 1);
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    renderCart();
    if (window.updateCartCountBadge) window.updateCartCountBadge();
  }
}
// Check login status and require login for checkout
function isLoggedIn() {
  return !!localStorage.getItem('token');
}

document.addEventListener('DOMContentLoaded', function() {
  // Hide checkout form if not logged in
  const checkoutForm = document.getElementById('checkout-form');
  if (checkoutForm && !isLoggedIn()) {
    checkoutForm.style.display = 'none';
    const loginMsg = document.createElement('div');
    loginMsg.className = 'error';
    loginMsg.innerHTML = 'You must <a href="login.html">log in</a> to place an order.';
    checkoutForm.parentNode.insertBefore(loginMsg, checkoutForm);
  }
  renderCart();
});
