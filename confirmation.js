// confirmation.js
document.addEventListener("DOMContentLoaded", () => {
    let order = JSON.parse(localStorage.getItem("orderDetails"));
    let orderSummary = document.getElementById("order-summary");
    let orderIdSpan = document.getElementById("order-id");
    let deliveryTimeSpan = document.getElementById("delivery-time");
    if (!order) {
        orderSummary.innerHTML = '<p>No order found. Please place an order first.</p>';
        orderIdSpan.textContent = '-';
        deliveryTimeSpan.textContent = '-';
        return;
    }
    // Generate a simple order ID (could be improved with backend)
    let orderId = 'VT' + Math.floor(Math.random() * 900000 + 100000);
    orderIdSpan.textContent = orderId;
    // Calculate delivery time: from order date to 30 min later
    let orderDate = new Date(order.date);
    let minDelivery = orderDate;
    let maxDelivery = new Date(orderDate.getTime() + 30 * 60000);
    let options = { hour: '2-digit', minute: '2-digit' };
    deliveryTimeSpan.textContent = `${minDelivery.toLocaleTimeString([], options)} - ${maxDelivery.toLocaleTimeString([], options)}`;
    // Render order summary
    let itemsHtml = order.items.map(item =>
        `<li>${item.quantity} × ${item.name} <span style="float:right">₦${(item.price * item.quantity).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></li>`
    ).join('');
    let subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    let tax = +(subtotal * 0.08).toFixed(2);
    let total = +(subtotal + tax).toFixed(2);
    orderSummary.innerHTML = `
        <h3>Thank you, ${order.customer.name}!</h3>
        <ul style="list-style:none; padding:0; margin-bottom:1rem;">${itemsHtml}</ul>
        <p><strong>Delivery Address:</strong> ${order.customer.address}</p>
        <p><strong>Contact:</strong> ${order.customer.contact}</p>
        <p>Subtotal: ₦${subtotal.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}<br>Tax (8%): ₦${tax.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}<br><strong>Total: ₦${total.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</strong></p>
    `;
});
// CTA button logic
function trackOrder() {
    alert('Order tracking is not available in this demo.');
}
function goHome() {
    window.location.href = 'index.html';
}
