// admin.js
// Set API_BASE to use the correct backend address and port
// Use a global API base URL for Render deployment
const API_BASE = (window.API_BASE_URL || "https://ezzyssupermart.onrender.com");

function showSection(sectionId) {
    document.querySelectorAll("section").forEach(sec => sec.style.display = "none");
    document.getElementById(sectionId).style.display = "block";
    // Show menu-list section if menu is selected
    if (sectionId === 'menu') {
      document.getElementById('menu-list').style.display = 'block';
      renderAllMenuItems();
    } else {
      document.getElementById('menu-list').style.display = 'none';
    }
    if (sectionId === 'preparing-orders') fetchPreparingOrders();
    if (sectionId === 'ready-orders') fetchReadyOrders();
    if (sectionId === 'out-for-delivery-orders') fetchOutForDeliveryOrders();
    if (sectionId === 'completed-orders') fetchCompletedOrders();
    if (sectionId === 'cancelled-orders') fetchCancelledOrders();
}

// Fetch menu items from backend
async function fetchMenu() {
    const response = await fetch(`${API_BASE}/menu`); // changed from /admin/menu to /menu
    const menuItems = await response.json();
    document.getElementById("menu-items").innerHTML = menuItems.map(item => `
        <p id="menu-item-${item._id}">
          <span class="menu-item-name">${item.name}</span> - ₦<span class="menu-item-price">${item.price}</span> <span class="menu-item-category">(${item.category})</span>
          ${item.image ? `<img src="${item.image}" alt="${item.name}" style="height:32px;vertical-align:middle;margin-left:8px;border-radius:4px;">` : ''}
          <button onclick="editItem('${item._id}', '${item.name.replace(/'/g, "&#39;")}', ${item.price}, '${item.category}', '${item.image ? item.image.replace(/'/g, "&#39;") : ''}')">Edit</button>
          <button onclick="deleteItem('${item._id}')">Delete</button>
        </p>
        <form id="edit-form-${item._id}" class="admin-form edit-form" style="display:none; margin-top:8px;">
          <input type="text" value="${item.name}" class="admin-input" name="editName" required>
          <input type="number" value="${item.price}" class="admin-input price-input" name="editPrice" step="0.01" required>
          <select name="editCategory" class="admin-input" required title="Category">
            <option value="Starters" ${item.category==='Starters'?'selected':''}>Starters</option>
            <option value="Mains" ${item.category==='Mains'?'selected':''}>Mains</option>
            <option value="Desserts" ${item.category==='Desserts'?'selected':''}>Desserts</option>
            <option value="Drinks" ${item.category==='Drinks'?'selected':''}>Drinks</option>
          </select>
          <input type="url" value="${item.image || ''}" class="admin-input" name="editImage" placeholder="Image URL">
          <button type="submit">Save</button>
          <button type="button" onclick="cancelEdit('${item._id}')">Cancel</button>
        </form>
    `).join("");
    // Attach submit listeners for edit forms
    menuItems.forEach(item => {
      const form = document.getElementById(`edit-form-${item._id}`);
      if (form) {
        form.onsubmit = async function(e) {
          e.preventDefault();
          const name = form.editName.value.trim();
          const price = parseFloat(form.editPrice.value);
          const category = form.editCategory.value;
          // Support file upload for edit
          const imageInput = form.querySelector('input[type="file"]');
          const formData = new FormData();
          formData.append('name', name);
          formData.append('price', price);
          formData.append('category', category);
          if (imageInput && imageInput.files && imageInput.files[0]) {
            formData.append('image', imageInput.files[0]);
          } else {
            formData.append('image', item.image || '');
          }
          await fetch(`${API_BASE}/menu/${item._id}`, {
            method: 'PUT',
            body: formData
          });
          fetchMenu();
          renderAllMenuItems();
        };
      }
    });
}

// Show edit form for a menu item
window.editItem = function(id, name, price, category, image) {
  document.getElementById(`edit-form-${id}`).style.display = 'flex';
  document.getElementById(`menu-item-${id}`).style.display = 'none';
};

// Cancel edit
window.cancelEdit = function(id) {
  document.getElementById(`edit-form-${id}`).style.display = 'none';
  document.getElementById(`menu-item-${id}`).style.display = 'flex';
};

// Fetch orders from backend
async function fetchOrders(searchTerm = '') {
    const response = await fetch(`${API_BASE}/orders`);
    let orders = await response.json();
    // Sort orders by date descending (newest first)
    orders.sort((a, b) => new Date(b.date) - new Date(a.date));
    // Filter by search term if provided
    if (searchTerm && searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        orders = orders.filter(order => {
            // Search by product name
            const hasProduct = order.items && order.items.some(i => (i.name || '').toLowerCase().includes(term));
            // Search by order id
            const hasId = (order.id && order.id.toLowerCase().includes(term)) || (order._id && order._id.toLowerCase().includes(term));
            // Search by username
            const hasUsername = order.customer && order.customer.name && order.customer.name.toLowerCase().includes(term);
            // Search by phone
            const hasPhone = order.customer && order.customer.contact && order.customer.contact.toLowerCase().includes(term);
            // Search by email
            const hasEmail = order.customer && order.customer.email && order.customer.email.toLowerCase().includes(term);
            // Search by total order amount
            const total = order.items ? order.items.reduce((sum, i) => sum + (i.price * (i.quantity || 1)), 0) : 0;
            const hasAmount = !isNaN(Number(term)) && (Math.abs(total - Number(term)) < 0.01);
            return hasProduct || hasId || hasUsername || hasPhone || hasEmail || hasAmount;
        });
    }
    document.getElementById("orders-list").innerHTML = orders.length ? orders.map(order => `
        <div class="admin-order-row${order.status === 'Preparing' ? ' preparing-highlight' : ''}">
          <span><strong>Order #${order.id}</strong> - ${order.status} (${new Date(order.date).toLocaleString()})</span>
          <button onclick="showOrderDetails('${order.id}')">View Details</button>
          <button onclick="showStatusUpdate('${order.id}', '${order.status}')">Update Status</button>
        </div>
    `).join("") : '<p style="color:#888;">No orders found.</p>';
}

// Add search bar for order tracking
function addOrderTrackingSearchBar() {
    const ordersSection = document.getElementById('orders');
    if (!ordersSection) return;
    let searchBar = document.createElement('input');
    searchBar.type = 'text';
    searchBar.placeholder = 'Search orders by product, ID, username, phone, amount, or email...';
    searchBar.className = 'admin-order-search';
    searchBar.style = 'margin-bottom:12px;width:100%;max-width:400px;padding:8px;';
    ordersSection.insertBefore(searchBar, ordersSection.children[1]);
    searchBar.addEventListener('input', function() {
        fetchOrders(this.value);
    });
}

window.addEventListener('DOMContentLoaded', function() {
    addOrderTrackingSearchBar();
});

// Fetch and render orders by status for each new section
async function fetchAndRenderOrdersByStatus(status, containerId, searchTerm = '') {
  const response = await fetch(`${API_BASE}/orders`);
  const orders = await response.json();
  let filtered = orders.filter(order => order.status === status);
  // Sort by date descending (newest first)
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  if (searchTerm && searchTerm.trim()) {
    const term = searchTerm.trim().toLowerCase();
    filtered = filtered.filter(order => {
      // Search by product name
      const hasProduct = order.items && order.items.some(i => (i.name || '').toLowerCase().includes(term));
      // Search by order id
      const hasId = (order.id && order.id.toLowerCase().includes(term)) || (order._id && order._id.toLowerCase().includes(term));
      // Search by username
      const hasUsername = order.customer && order.customer.name && order.customer.name.toLowerCase().includes(term);
      // Search by phone
      const hasPhone = order.customer && order.customer.contact && order.customer.contact.toLowerCase().includes(term);
      // Search by email
      const hasEmail = order.customer && order.customer.email && order.customer.email.toLowerCase().includes(term);
      // Search by total order amount
      const total = order.items ? order.items.reduce((sum, i) => sum + (i.price * (i.quantity || 1)), 0) : 0;
      const hasAmount = !isNaN(Number(term)) && (Math.abs(total - Number(term)) < 0.01);
      return hasProduct || hasId || hasUsername || hasPhone || hasEmail || hasAmount;
    });
  }
  // Only show Update Status button for Track Orders (containerId === 'orders-list')
  document.getElementById(containerId).innerHTML = filtered.length ? filtered.map(order => `
    <div class="admin-order-row">
      <span><strong>Order #${order.id}</strong> - ${order.status} (${new Date(order.date).toLocaleString()})</span>
      <button class="view-details-btn" data-order-id="${order.id}" data-order-oid="${order._id}">View Details</button>
      ${containerId === 'orders-list' ? `<button onclick=\"showStatusUpdate('${order.id}', '${order.status}')\">Update Status</button>` : ''}
    </div>
  `).join("") : '<p style="color:#888;">No orders found.</p>';

  // Attach event listeners for View Details (for dynamically created buttons)
  setTimeout(() => {
    document.querySelectorAll(`#${containerId} .view-details-btn`).forEach(btn => {
      btn.onclick = function() {
        // Try both id and _id for robustness
        const orderId = this.getAttribute('data-order-id');
        const orderOid = this.getAttribute('data-order-oid');
        window.showOrderDetails(orderId, orderOid);
      };
    });
  }, 0);
}

// Functions to fetch each status
async function fetchPreparingOrders() { await fetchAndRenderOrdersByStatus('Preparing', 'preparing-orders-list'); }
async function fetchReadyOrders() { await fetchAndRenderOrdersByStatus('Ready', 'ready-orders-list'); }
async function fetchOutForDeliveryOrders() { await fetchAndRenderOrdersByStatus('Out for Delivery', 'out-for-delivery-orders-list'); }
async function fetchCompletedOrders() { await fetchAndRenderOrdersByStatus('Completed', 'completed-orders-list'); }
async function fetchCancelledOrders() { await fetchAndRenderOrdersByStatus('Cancelled', 'cancelled-orders-list'); }

window.showOrderDetails = function(orderId, orderOid) {
  fetch(`${API_BASE}/orders`).then(res => res.json()).then(orders => {
    // Try to find by id or _id (string or ObjectId)
    let order = orders.find(o => o.id === orderId || o._id === orderId || o._id === orderOid);
    if (!order) {
      // Try loose comparison for _id (sometimes types differ)
      order = orders.find(o => String(o._id) === String(orderId) || String(o._id) === String(orderOid));
    }
    if (!order) return alert('Order details not found.');
    let html = `<div><strong>Order ID:</strong> ${order.id}</div>`;
    html += `<div><strong>MongoDB _id:</strong> ${order._id}</div>`;
    html += `<div><strong>Status:</strong> ${order.status}</div>`;
    html += `<div><strong>Date:</strong> ${new Date(order.date).toLocaleString()}</div>`;
    if (order.customer) {
      html += `<div><strong>Customer:</strong> ${order.customer.name || ''} (${order.customer.email || order.customer.contact || ''})</div>`;
      html += `<div><strong>Contact Number:</strong> ${order.customer.contact || ''}</div>`;
      html += `<div><strong>Email:</strong> ${order.customer.email || ''}</div>`;
    }
    if (order.items && order.items.length) {
      html += `<div><strong>Items:</strong><ul style='margin:0 0 0 1.2em;'>` +
        order.items.map(i => `
          <li style='margin-bottom:0.7em;'>
            <div><strong>${i.name}</strong></div>
            ${i.image ? `<img src="${i.image.startsWith('http') ? i.image : API_BASE.replace('/api','') + i.image}" alt="${i.name}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;margin:6px 0;">` : ''}
          </li>
        `).join('') +
        `</ul></div>`;
    }
    // Add Send Email button (by customer info)
    html += `<button id="send-order-email-btn">Send Email</button>`;
    document.getElementById('order-details-content').innerHTML = html;
    document.getElementById('order-details-panel').classList.add('active');

    // Use customer info for sending email
    document.getElementById('send-order-email-btn').onclick = function() {
      fetch(`${API_BASE}/orders/send-email-by-customer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: order.customer.name,
          contact: order.customer.contact,
          email: order.customer.email
        })
      })
      .then(res => res.json())
      .then(data => {
        alert(data.message || 'Email sent!');
      })
      .catch(() => {
        alert('Failed to send email.');
      });
    };
  });
};

window.closeOrderDetails = function() {
  document.getElementById('order-details-panel').classList.remove('active');
};

// Fetch monthly report analytics
async function fetchMonthlyReport() {
    const response = await fetch("/monthly-report");
    const data = await response.json();
    new Chart(document.getElementById("monthlyReportChart"), {
        type: "bar",
        data: {
            labels: ["Total Revenue", "Refunds"],
            datasets: [{
                data: [data.totalRevenue, data.refunds],
                backgroundColor: ["#4CAF50", "#FF5722"]
            }]
        }
    });
}

function downloadPDF() {
    window.location.href = "/export-report";
}

// Add menu item with image upload
const addMenuForm = document.getElementById('add-menu-form');
if (addMenuForm) {
  addMenuForm.onsubmit = async function(e) {
    e.preventDefault();
    const name = document.getElementById('itemName').value.trim();
    const price = parseFloat(document.getElementById('itemPrice').value);
    const category = document.getElementById('itemCategory').value;
    const imageInput = document.getElementById('itemImage');
    const formData = new FormData();
    formData.append('name', name);
    formData.append('price', price);
    formData.append('category', category);
    if (imageInput.files && imageInput.files[0]) {
      formData.append('image', imageInput.files[0]);
    }
    await fetch(`${API_BASE}/menu`, {
      method: 'POST',
      body: formData
    });
    addMenuForm.reset();
    fetchMenu();
    renderAllMenuItems();
  };
}

// Image preview for add menu form
const imageInput = document.getElementById('itemImage');
const addMenuFormEl = document.getElementById('add-menu-form');
if (imageInput && addMenuFormEl) {
  let previewImg = document.createElement('img');
  previewImg.id = 'add-image-preview';
  previewImg.style.display = 'none';
  previewImg.style.maxWidth = '100px';
  previewImg.style.margin = '10px 0';
  imageInput.parentNode.insertBefore(previewImg, imageInput.nextSibling);
  imageInput.addEventListener('change', function() {
    if (this.files && this.files[0]) {
      const reader = new FileReader();
      reader.onload = function(e) {
        previewImg.src = e.target.result;
        previewImg.style.display = 'block';
      };
      reader.readAsDataURL(this.files[0]);
    } else {
      previewImg.style.display = 'none';
      previewImg.src = '';
    }
  });
}

// Delete menu item
async function deleteItem(id) {
  await fetch(`${API_BASE}/menu/${id}`, { method: 'DELETE' });
  fetchMenu();
}

// Order status update logic
const orderStatusDiv = document.getElementById('order-status-update');
const updateStatusForm = document.getElementById('update-status-form');
let currentOrderId = null;

function showStatusUpdate(orderId, currentStatus) {
  currentOrderId = orderId;
  document.getElementById('updateOrderId').value = orderId;
  document.getElementById('updateOrderStatus').value = currentStatus;
  orderStatusDiv.classList.add('active');
}

if (updateStatusForm) {
  updateStatusForm.onsubmit = async function(e) {
    e.preventDefault();
    const orderId = document.getElementById('updateOrderId').value;
    const status = document.getElementById('updateOrderStatus').value;
    await fetch(`${API_BASE}/orders/` + orderId + '/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    orderStatusDiv.classList.remove('active');
    fetchOrders();
  };
}

// Display all menu items in the Menu Item List section
async function renderAllMenuItems() {
  const response = await fetch(`${API_BASE}/menu`);
  const menuItems = await response.json();
  document.getElementById('all-menu-items').innerHTML = menuItems.length
    ? `<div class="admin-menu-list">${menuItems.map(item => `
        <div class="admin-menu-card" id="menu-list-item-${item._id}">
          ${item.image ? `<img src="${item.image.startsWith('http') ? item.image : API_BASE + item.image}" alt="${item.name}" class="admin-menu-img">` : ''}
          <div><strong>${item.name}</strong></div>
          <div>Category: ${item.category}</div>
          <div>Price: ₦${item.price}</div>
          <button onclick="editListItem('${item._id}', '${item.name.replace(/'/g, "&#39;")}', ${item.price}, '${item.category}', '${item.image ? item.image.replace(/'/g, "&#39;") : ''}')">Edit</button>
          <button onclick="deleteItem('${item._id}'); renderAllMenuItems();">Delete</button>
          <form id="edit-list-form-${item._id}" class="admin-form edit-form" style="display:none; margin-top:8px;">
            <input type="text" value="${item.name}" class="admin-input" name="editName" required>
            <input type="number" value="${item.price}" class="admin-input price-input" name="editPrice" step="0.01" required>
            <select name="editCategory" class="admin-input" required title="Category">
              <option value="Starters" ${item.category==='Starters'?'selected':''}>Starters</option>
              <option value="Mains" ${item.category==='Mains'?'selected':''}>Mains</option>
              <option value="Desserts" ${item.category==='Desserts'?'selected':''}>Desserts</option>
              <option value="Drinks" ${item.category==='Drinks'?'selected':''}>Drinks</option>
            </select>
            <input type="file" class="admin-input" name="editImage" accept="image/*">
            <button type="submit">Save</button>
            <button type="button" onclick="cancelListEdit('${item._id}')">Cancel</button>
          </form>
        </div>
      `).join('')}</div>`
    : '<p>No menu items found.</p>';
  // Attach submit listeners for edit forms
  menuItems.forEach(item => {
    const form = document.getElementById(`edit-list-form-${item._id}`);
    if (form) {
      form.onsubmit = async function(e) {
        e.preventDefault();
        const name = form.editName.value.trim();
        const price = parseFloat(form.editPrice.value);
        const category = form.editCategory.value;
        const imageInput = form.editImage;
        const formData = new FormData();
        formData.append('name', name);
        formData.append('price', price);
        formData.append('category', category);
        if (imageInput.files && imageInput.files[0]) {
          formData.append('image', imageInput.files[0]);
        } else {
          formData.append('image', item.image || '');
        }
        await fetch(`${API_BASE}/menu/${item._id}`, {
          method: 'PUT',
          body: formData
        });
        renderAllMenuItems();
      };
    }
  });
}

window.editListItem = function(id, name, price, category, image) {
  document.getElementById(`edit-list-form-${id}`).style.display = 'flex';
  document.getElementById(`menu-list-item-${id}`).querySelector('button[onclick^="editListItem"]').style.display = 'none';
  document.getElementById(`menu-list-item-${id}`).querySelector('button[onclick^="deleteItem"]').style.display = 'none';
};

window.cancelListEdit = function(id) {
  document.getElementById(`edit-list-form-${id}`).style.display = 'none';
  document.getElementById(`menu-list-item-${id}`).querySelector('button[onclick^="editListItem"]').style.display = 'inline-block';
  document.getElementById(`menu-list-item-${id}`).querySelector('button[onclick^="deleteItem"]').style.display = 'inline-block';
};

// Add search bar and logic for each order status section
function addOrderSearchBar(sectionId, listId, status) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  let searchBar = document.createElement('input');
  searchBar.type = 'text';
  searchBar.placeholder = 'Search orders by product, ID, username, phone, amount, or email...';
  searchBar.className = 'admin-order-search';
  searchBar.style = 'margin-bottom:12px;width:100%;max-width:400px;padding:8px;';
  section.insertBefore(searchBar, section.children[1]);
  searchBar.addEventListener('input', function() {
    fetchAndRenderOrdersByStatus(status, listId, this.value);
  });
}

// Add search bars after DOM loads
window.addEventListener('DOMContentLoaded', function() {
  addOrderSearchBar('preparing-orders', 'preparing-orders-list', 'Preparing');
  addOrderSearchBar('ready-orders', 'ready-orders-list', 'Ready');
  addOrderSearchBar('out-for-delivery-orders', 'out-for-delivery-orders-list', 'Out for Delivery');
  addOrderSearchBar('completed-orders', 'completed-orders-list', 'Completed');
  addOrderSearchBar('cancelled-orders', 'cancelled-orders-list', 'Cancelled');
});

// Fetch sales report by product name
async function fetchSalesReport(productName = '') {
  const response = await fetch(`${API_BASE}/orders`);
  const orders = await response.json();
  // Flatten all items from all orders
  let allItems = [];
  orders.forEach(order => {
    if (order.items && Array.isArray(order.items)) {
      allItems = allItems.concat(order.items.map(i => ({
        name: i.name,
        quantity: i.quantity || 1
      })));
    }
  });
  // Filter by product name if provided
  if (productName && productName.trim()) {
    const term = productName.trim().toLowerCase();
    allItems = allItems.filter(i => i.name && i.name.toLowerCase().includes(term));
  }
  // Aggregate sales by product name
  const salesMap = {};
  allItems.forEach(i => {
    if (!salesMap[i.name]) salesMap[i.name] = 0;
    salesMap[i.name] += i.quantity;
  });
  // Render report
  const reportHtml = Object.keys(salesMap).length ?
    `<table class="sales-report-table"><thead><tr><th>Product</th><th>Quantity Sold</th></tr></thead><tbody>` +
    Object.entries(salesMap).map(([name, qty]) => `<tr><td>${name}</td><td>${qty}</td></tr>`).join('') +
    `</tbody></table>` : '<p style="color:#888;">No sales found for this product.</p>';
  document.getElementById('sales-report-content').innerHTML = reportHtml;
}

// Add search bar for sales report
function addSalesReportSearchBar() {
  const container = document.getElementById('sales-report-section');
  if (!container) return;
  let searchBar = document.createElement('input');
  searchBar.type = 'text';
  searchBar.placeholder = 'Filter by product name...';
  searchBar.className = 'admin-order-search';
  searchBar.style = 'margin-bottom:12px;width:100%;max-width:400px;padding:8px;';
  container.insertBefore(searchBar, container.firstChild);
  searchBar.addEventListener('input', function() {
    fetchSalesReport(this.value);
  });
}

// Call this after DOM loads
window.addEventListener('DOMContentLoaded', function() {
  addSalesReportSearchBar();
  fetchSalesReport();
});

// Export/Print Sales Report
function exportSalesReport() {
  const reportContent = document.getElementById('sales-report-content');
  if (!reportContent) return;
  const printWindow = window.open('', '', 'width=800,height=600');
  printWindow.document.write('<html><head><title>Sales Report</title>');
  printWindow.document.write('<style>body{font-family:sans-serif;}table{border-collapse:collapse;width:100%;}th,td{border:1px solid #ccc;padding:8px;}th{background:#f5f5f5;}</style>');
  printWindow.document.write('</head><body>');
  printWindow.document.write('<h2>Sales Report</h2>');
  printWindow.document.write(reportContent.innerHTML);
  printWindow.document.write('</body></html>');
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

// Initial load
showSection('menu');
fetchMenu();
fetchOrders();
fetchMonthlyReport();
renderAllMenuItems();
