<script>
    // Set the API base URL for all frontend scripts to use the deployed backend
    window.API_BASE_URL = "https://ezzyssupermart.onrender.com";
    </script>
document.getElementById('checkout-form').onsubmit = async function(e) {
  // Require login before placing order
  if (!localStorage.getItem('token')) {
    alert('You must be logged in to place an order.');
    window.location.href = 'login.html';
    return false;
  }
  e.preventDefault();
  let cart = JSON.parse(localStorage.getItem('cart')) || [];
  if (cart.length === 0) {
    alert('Your cart is empty!');
    return;
  }
  let order = {
    items: cart,
    customer: {
      name: this.name.value,
      address: this.address.value,
      contact: this.contact.value,
      email: this.customerEmail.value || (JSON.parse(localStorage.getItem('user'))?.email || ''),
      payment: this.payment.value
    },
    payment: {
      method: this.payment.value,
      amount: cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
      status: 'Pending'
    },
    date: new Date().toISOString()
  };
  // Send order to backend
  const res = await fetch('http://localhost:3001/api/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order)
  });
  if (res.ok) {
    localStorage.setItem('orderDetails', JSON.stringify(order));
    localStorage.removeItem('cart');
    window.location.href = 'order-confirmation.html';
  } else {
    alert('Failed to place order. Please try again.');
  }
};

// Assuming this code is in order-confirmation.html
let order = JSON.parse(localStorage.getItem('orderDetails'));
if (order) {
    let subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    let tax = +(subtotal * 0.08).toFixed(2);
    let total = +(subtotal + tax).toFixed(2);
    document.getElementById('order-summary').innerHTML = `
      <h3>Order Details</h3>
      <ul style="list-style:none; padding:0; margin-bottom:1rem;">
        ${order.items.map(item => `<li>${item.quantity} × ${item.name} <span style="float:right">₦${(item.price * item.quantity).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></li>`).join('')}
      </ul>
      <div>Subtotal: ₦${subtotal.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
      <div>Tax (8%): ₦${tax.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
      <div><strong>Total: ₦${total.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</strong></div>
    `;
}