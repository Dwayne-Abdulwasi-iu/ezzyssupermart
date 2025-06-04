// ezzys.js - All JavaScript from ezzys.html moved here

const API_BASE = 'http://localhost:3001/api';
let currentUser = null;
let products = [];

// --- Product Catalog ---
async function fetchProducts() {
    const res = await fetch(`${API_BASE}/products`);
    products = await res.json();
}

// Auto-update product catalog every 1 second (1000ms)
setInterval(renderCatalogProducts, 1000);
// --- Checkout Modal ---
function showCheckoutModal() {
    const checkout = document.getElementById('checkout');
    const backdrop = document.getElementById('checkout-modal-backdrop');
    if (checkout && backdrop) {
        checkout.classList.add('visible');
        backdrop.classList.add('active');
        checkout.scrollIntoView({ behavior: 'smooth' });
    }
}
function hideCheckoutModal() {
    const checkout = document.getElementById('checkout');
    const backdrop = document.getElementById('checkout-modal-backdrop');
    if (checkout && backdrop) {
        checkout.classList.remove('visible');
        backdrop.classList.remove('active');
    }
}
// --- Add to Cart Button in Product Cards ---
async function renderCatalogProducts() {
    await fetchProducts();
    const grid = document.getElementById('catalog-products');
    if (!grid) return;
    grid.innerHTML = '';
    // Get selected category filter
    const filter = document.getElementById('filter-category');
    const selectedCategory = filter ? filter.value : 'all';
    products.forEach(p => {
        if (selectedCategory !== 'all' && p.category !== selectedCategory) return;
        const div = document.createElement('div');
        div.className = 'product-card';
        div.innerHTML = `<img src="${p.img}" alt="${p.name}"><h3>${p.name}</h3><p>₦${p.price.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</p><small style='color:#888;'>${p.category ? p.category.charAt(0).toUpperCase() + p.category.slice(1) : ''}</small><br><button class='add-to-cart-btn' data-id='${p.id}' data-name='${p.name}' data-price='${p.price}' data-img='${p.img}' style='margin-top:0.7rem;background:#2d8f3c;color:#fff;border:none;border-radius:4px;padding:0.5rem 1.2rem;font-weight:700;cursor:pointer;'>Add to Cart</button>`;
        grid.appendChild(div);
    });
}
// Featured products with Add to Cart
async function renderFeaturedProducts() {
    await fetchProducts();
    const grid = document.getElementById('featured-products');
    if (!grid) return;
    grid.innerHTML = '';
    products.slice(0, 4).forEach(p => {
        const div = document.createElement('div');
        div.className = 'product-card';
        div.innerHTML = `<img src="${p.img}" alt="${p.name}"><h3>${p.name}</h3><p>₦${p.price.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</p><small style='color:#888;'>${p.category ? p.category.charAt(0).toUpperCase() + p.category.slice(1) : ''}</small><br><button class='add-to-cart-btn' data-id='${p.id}' data-name='${p.name}' data-price='${p.price}' data-img='${p.img}' style='margin-top:0.7rem;background:#2d8f3c;color:#fff;border:none;border-radius:4px;padding:0.5rem 1.2rem;font-weight:700;cursor:pointer;'>Add to Cart</button>`;
        grid.appendChild(div);
    });
}
// On page load, restore cart
window.addEventListener('DOMContentLoaded', function() {
    loadCartFromStorage();
    renderCart();
});
window.addEventListener('load', function() {
    loadCartFromStorage();
    renderCart();
});
// Live cart reload every 0.1 second
setInterval(function() {
    loadCartFromStorage();
    renderCart();
}, 100);
// --- Payment Summary Display ---
function displayPaymentSummary() {
    var select = document.getElementById('checkout-payment');
    var summary = document.getElementById('payment-method-summary');
    if (!select || !summary) return;
    var value = select.value;
    if (!value) { summary.style.display = 'none'; summary.innerHTML = ''; return; }
    summary.style.display = 'block';
    if (value === 'card') {
        summary.innerHTML = '<b>Credit/Debit Card (Paystack):</b> You will be redirected to Paystack to complete your payment securely with your card.';
    } else if (value === 'mobile') {
        summary.innerHTML = '<b>Mobile Payment:</b> You will receive instructions to complete your payment using your mobile wallet.';
    } else if (value === 'bank') {
        summary.innerHTML = '<b>Bank Transfer:</b> Bank account details will be provided after order placement.';
    } else if (value === 'cod') {
        summary.innerHTML = '<b>Cash on Delivery:</b> Pay with cash when your order is delivered.';
    }
}
// --- Checkout/Paystack Integration ---
async function submitOrder(e) {
    if (e) e.preventDefault();
    // Check if user is logged in
    var user = localStorage.getItem('ezzy_user');
    if (!user) {
        alert('You must be logged in to place an order. Please log in first.');
        return false;
    }
    var currentUser = JSON.parse(user);
    // Exclude out-of-stock items from cart for checkout
    const inStockCart = cart.filter(item => products.some(p => (p.id && p.id === item.id) || (!p.id && p.name === item.name)));
    if (inStockCart.length === 0) {
        alert('Your cart has no in-stock items to checkout.');
        return false;
    }
    const name = document.getElementById('checkout-name').value;
    const address = document.getElementById('checkout-address').value;
    const location = document.getElementById('checkout-location').value;
    const phone = document.getElementById('checkout-phone').value;
    const paymentMethod = document.getElementById('checkout-payment').value;
    const email = currentUser.email;
    const amount = inStockCart.reduce((sum, item) => sum + item.price * item.qty, 0);
    if (!paymentMethod) {
        alert('Please select a payment method.');
        return false;
    }
    if (paymentMethod === 'card') {
        var handler = PaystackPop.setup({
            key: 'pk_test_xxxxxxxxxxxxxxxxxxxxxxxx', // TODO: Replace with your public key
            email: email,
            amount: Math.round(amount * 100), // kobo
            currency: 'NGN',
            ref: 'ORD' + Math.floor(Math.random() * 1000000),
            metadata: {
                custom_fields: [
                    { display_name: name, variable_name: 'address', value: address },
                    { display_name: 'Precise Location', variable_name: 'location', value: location },
                    { display_name: 'Phone', variable_name: 'phone', value: phone }
                ]
            },
            callback: async function(response) {
                const orderId = response.reference;
                const order = {
                    id: orderId,
                    status: 'Paid - Preparing for delivery',
                    user: email,
                    items: inStockCart.map(item => ({ id: item.id, name: item.name, qty: item.qty, price: item.price })),
                    address,
                    location,
                    phone,
                    paymentRef: response.reference,
                    amount
                };
                await fetch(`${API_BASE}/orders`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(order)
                });
                document.getElementById('order-success').innerHTML = `<strong>Order placed and paid successfully! Your Order ID is <b>${orderId}</b>. Thank you for shopping with us.</strong>`;
                document.getElementById('order-success').style.display = 'block';
                setTimeout(() => {
                    document.getElementById('checkout').classList.remove('visible');
                    document.getElementById('checkout').classList.add('checkout-section');
                    document.getElementById('order-success').style.display = 'none';
                    if (typeof removeAllFromCart === 'function') {
                        removeAllFromCart();
                    } else {
                        cart = [];
                        saveCartToStorage();
                        renderCart();
                    }
                }, 2000);
            },
            onClose: function() {
                alert('Payment window closed. Order not completed.');
            }
        });
        handler.openIframe();
        return false;
    } else {
        // For other payment methods, just show a success message and simulate order placement
        const orderId = 'ORD' + Math.floor(Math.random() * 1000000);
        const order = {
            id: orderId,
            status: paymentMethod === 'cod' ? 'Pending - Cash on Delivery' : 'Pending - Awaiting Payment',
            user: email,
            items: inStockCart.map(item => ({ id: item.id, name: item.name, qty: item.qty, price: item.price })),
            address,
            location,
            phone,
            paymentRef: null,
            amount
        };
        await fetch(`${API_BASE}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(order)
        });
        document.getElementById('order-success').innerHTML = `<strong>Order placed! Your Order ID is <b>${orderId}</b>. Thank you for shopping with us.</strong>`;
        document.getElementById('order-success').style.display = 'block';
        setTimeout(() => {
            document.getElementById('checkout').classList.remove('visible');
            document.getElementById('checkout').classList.add('checkout-section');
            document.getElementById('order-success').style.display = 'none';
            clearCart(); // Clear the cart after order is placed
        }, 2000);
        return false;
    }
}
// Cart Icon in Navbar (moved from inline script)
document.addEventListener('DOMContentLoaded', function() {
    // Remove cart icon from navbar if present
    var cartIcon = document.getElementById('cart-navbar-icon-link');
    if (cartIcon) {
        cartIcon.remove();
    }
    // Auto-update product catalog every 1 second (1000ms)
    setInterval(renderCatalogProducts, 1000);
    var paymentSelect = document.getElementById('checkout-payment');
    if (paymentSelect) {
        paymentSelect.addEventListener('change', displayPaymentSummary);
    }
});
// --- Cart Logic ---
let cart = [];
function saveCartToStorage() {
    localStorage.setItem('ezzy_cart', JSON.stringify(cart));
}
function loadCartFromStorage() {
    const stored = localStorage.getItem('ezzy_cart');
    cart = stored ? JSON.parse(stored) : [];
}
function addToCart(product) {
    // Combine only if all properties match (id, name, price, img)
    const idx = cart.findIndex(item =>
        item.id === product.id &&
        item.name === product.name &&
        item.price === product.price &&
        item.img === product.img
    );
    if (idx !== -1) {
        cart[idx].qty += 1;
    } else {
        cart.push({ ...product, qty: 1 });
    }
    saveCartToStorage();
    renderCart();
}
function removeFromCart(productId, productName, productPrice, productImg) {
    cart = cart.filter(item =>
        !(item.id === productId &&
          item.name === productName &&
          item.price === productPrice &&
          item.img === productImg)
    );
    saveCartToStorage();
    renderCart();
}
function updateCartQty(productId, qty) {
    const idx = cart.findIndex(item => item.id === productId);
    if (idx !== -1 && qty > 0) {
        cart[idx].qty = qty;
        saveCartToStorage();
        renderCart();
    } else if (idx !== -1 && qty <= 0) {
        removeFromCart(productId);
    }
}
function getCartTotal() {
    return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}
function renderCart() {
    const cartItemsList = document.getElementById('cart-items-list');
    const cartTotal = document.getElementById('cart-total');
    if (!cartItemsList || !cartTotal) return;
    if (cart.length === 0) {
        cartItemsList.innerHTML = '<p>Your cart is empty.</p>';
        cartTotal.textContent = '';
        return;
    }
    // Get current product IDs
    const productIds = products.map(p => p.id || p.name);
    cartItemsList.innerHTML = '<ul style="list-style:none;padding:0;">' + cart.map(item => {
        // Check if product is still in inventory
        const inStock = products.some(p => (p.id && p.id === item.id) || (!p.id && p.name === item.name));
        return `
        <li style='margin-bottom:1rem;display:flex;align-items:center;gap:10px;'>
            <img src="${item.img}" alt="${item.name}" style="width:40px;height:30px;object-fit:cover;vertical-align:middle;margin-right:8px;">
            <b>${item.name}</b>
            <span>₦${item.price.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
            ${inStock ? '' : '<span style="color:red;font-weight:bold;margin-left:8px;">(Out of Stock)</span>'}
            <button class='qty-btn' onclick='decreaseQty("${item.id}", "${item.name.replace(/"/g, '&quot;')}", ${item.price}, "${item.img.replace(/"/g, '&quot;')}")' ${inStock ? '' : 'disabled'}>-</button>
            <input type='number' min='1' value='${item.qty}' style='width:40px;text-align:center;' onchange='updateCartQty("${item.id}", this.valueAsNumber)' ${inStock ? '' : 'disabled'}>
            <button class='qty-btn' onclick='increaseQty("${item.id}", "${item.name.replace(/"/g, '&quot;')}", ${item.price}, "${item.img.replace(/"/g, '&quot;')}")' ${inStock ? '' : 'disabled'}>+</button>
            <button class='remove-btn' onclick='removeFromCart("${item.id}", "${item.name.replace(/"/g, '&quot;')}", ${item.price}, "${item.img.replace(/"/g, '&quot;')}")'>Remove</button>
        </li>`;
    }).join('') + '</ul>';
    cartTotal.textContent = 'Total: ₦' + getCartTotal().toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2});
}
function increaseQty(productId, productName, productPrice, productImg) {
    const idx = cart.findIndex(item =>
        item.id === productId &&
        item.name === productName &&
        item.price === productPrice &&
        item.img === productImg
    );
    if (idx !== -1) {
        cart[idx].qty += 1;
        saveCartToStorage();
        renderCart();
    }
}
function decreaseQty(productId, productName, productPrice, productImg) {
    const idx = cart.findIndex(item =>
        item.id === productId &&
        item.name === productName &&
        item.price === productPrice &&
        item.img === productImg
    );
    if (idx !== -1) {
        if (cart[idx].qty > 1) {
            cart[idx].qty -= 1;
            saveCartToStorage();
            renderCart();
        } else {
            removeFromCart(productId, productName, productPrice, productImg);
        }
    }
}
document.addEventListener('DOMContentLoaded', function() {
    loadCartFromStorage();
    renderCart();
    document.getElementById('catalog-products').addEventListener('click', function(e) {
        if (e.target.classList.contains('add-to-cart-btn')) {
            const productId = e.target.getAttribute('data-id');
            const productName = e.target.getAttribute('data-name');
            const productPrice = parseFloat(e.target.getAttribute('data-price'));
            const productImg = e.target.getAttribute('data-img');
            const product = { id: productId, name: productName, price: productPrice, img: productImg };
            addToCart(product);
            // Give instant feedback
            e.target.textContent = 'Added!';
            e.target.disabled = true;
            setTimeout(() => {
                e.target.textContent = 'Add to Cart';
                e.target.disabled = false;
            }, 1200);
        }
    });
    // Make cart checkout button trigger checkout section
    var cartCheckoutBtn = document.getElementById('cart-checkout-btn');
    if (cartCheckoutBtn) {
        cartCheckoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            showCheckoutModal();
        });
    }
    var backdrop = document.getElementById('checkout-modal-backdrop');
    if (backdrop) {
        backdrop.addEventListener('click', hideCheckoutModal);
    }
    // Optionally, close modal on ESC key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') hideCheckoutModal();
    });
});
// Show shopping cart as a floating form in the middle of the page, width relative to products in it
const cartSection = document.getElementById('shopping-cart-section');
if (cartSection) {
    cartSection.style.display = 'none';
    cartSection.style.position = 'fixed';
    cartSection.style.top = '50%';
    cartSection.style.left = '50%';
    cartSection.style.right = 'auto';
    cartSection.style.transform = 'translate(-50%, -50%)';
    cartSection.style.zIndex = '2002';
    cartSection.style.background = '#fff';
    cartSection.style.boxShadow = '0 8px 32px rgba(0,0,0,0.18)';
    cartSection.style.borderRadius = '18px';
    cartSection.style.padding = '2.5rem 2.5rem 2rem 2.5rem';
    cartSection.style.maxWidth = '95vw';
    cartSection.style.minWidth = '340px';
    cartSection.style.width = 'auto';
    cartSection.style.maxHeight = '80vh';
    cartSection.style.overflowY = 'auto';
    cartSection.style.transition = 'box-shadow 0.2s, transform 0.2s, width 0.2s';
}
function updateCartWidth() {
    if (!cartSection) return;
    // Count number of products in cart
    const cart = JSON.parse(localStorage.getItem('ezzy_cart') || '[]');
    // Set width based on number of products (responsive)
    if (cart.length <= 2) {
        cartSection.style.width = '340px';
    } else if (cart.length <= 5) {
        cartSection.style.width = '420px';
    } else if (cart.length <= 8) {
        cartSection.style.width = '540px';
    } else {
        cartSection.style.width = '700px';
    }
}
// Call updateCartWidth whenever cart is rendered
const origRenderCart = typeof renderCart === 'function' ? renderCart : null;
window.renderCart = function() {
    if (origRenderCart) origRenderCart();
    updateCartWidth();
};
// Also update width on open
function createFloatingCartBtn() {
    if (document.getElementById('floating-cart-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'floating-cart-btn';
    btn.className = 'floating-cart-btn';
    btn.innerHTML = '🛒';
    btn.style.position = 'fixed';
    btn.style.left = '32px';
    btn.style.bottom = '32px';
    btn.style.zIndex = '1001';
    btn.style.background = '#2d8f3c';
    btn.style.color = '#fff';
    btn.style.border = 'none';
    btn.style.borderRadius = '50%';
    btn.style.width = '60px';
    btn.style.height = '60px';
    btn.style.boxShadow = '0 4px 16px rgba(45,143,60,0.15)';
    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
    btn.style.fontSize = '2.2rem';
    btn.style.cursor = 'pointer';
    btn.onclick = function() {
        window.open('cart.html', '_blank');
    };
    document.body.appendChild(btn);
}
function updateCartIconBadge() {
    let badge = document.getElementById('floating-cart-badge');
    if (!badge) {
        const btn = document.getElementById('floating-cart-btn');
        badge = document.createElement('span');
        badge.id = 'floating-cart-badge';
        badge.style.position = 'absolute';
        badge.style.top = '8px';
        badge.style.right = '8px';
        badge.style.background = '#ff4d4d';
        badge.style.color = '#fff';
        badge.style.borderRadius = '50%';
        badge.style.minWidth = '22px';
        badge.style.height = '22px';
        badge.style.fontSize = '1rem';
        badge.style.fontWeight = 'bold';
        badge.style.display = 'flex';
        badge.style.alignItems = 'center';
        badge.style.justifyContent = 'center';
        badge.style.boxShadow = '0 2px 6px rgba(0,0,0,0.12)';
        badge.style.pointerEvents = 'none';
        badge.style.lineHeight = '22px';
        badge.style.padding = '0 6px';
        if (btn) btn.appendChild(badge);
    }
    const cart = JSON.parse(localStorage.getItem('ezzy_cart') || '[]');
    const count = cart.reduce((sum, item) => sum + (item.qty || 1), 0);
    badge.textContent = count > 0 ? count : '';
    badge.style.display = count > 0 ? 'flex' : 'none';
}
// Update badge whenever cart is rendered or changed
const origRenderCart2 = typeof renderCart === 'function' ? renderCart : null;
window.renderCart = function() {
    if (origRenderCart2) origRenderCart2();
    updateCartIconBadge();
};
window.addEventListener('DOMContentLoaded', updateCartIconBadge);
window.addEventListener('DOMContentLoaded', function() {
    createFloatingCartBtn();
});
// Utility to clear the cart
function clearCart() {
    cart = [];
    saveCartToStorage();
    renderCart();
}
// Example usage: clearCart();
// You can call clearCart() from anywhere in your UI logic to empty the cart.
function removeAllFromCart() {
    cart = [];
    saveCartToStorage();
    renderCart();
}
