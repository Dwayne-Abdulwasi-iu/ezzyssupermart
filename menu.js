// menu.js
// Menu rendering, filtering, and add-to-cart logic

const API_BASE = (window.API_BASE_URL || "https://ezzyssupermart.onrender.com");
const categories = ['All'];
let allMenuItems = [];
let currentSearch = '';
let currentCategory = 'All';

async function fetchMenuItems() {
  const response = await fetch(`${API_BASE}/admin/menu`);
  allMenuItems = await response.json();
  // Update categories dynamically
  const uniqueCats = Array.from(new Set(allMenuItems.map(item => item.category)));
  categories.length = 1;
  categories.push(...uniqueCats);
  renderFilters();
  renderMenu();
  renderProductNameList(); // update product name list
}

function renderFilters() {
  const filtersDiv = document.getElementById('menu-filters');
  if (!filtersDiv) return;
  filtersDiv.innerHTML = categories.map(cat =>
    `<button type="button" class="filter-btn" data-category="${cat}">${cat}</button>`
  ).join('');
  filtersDiv.querySelectorAll('button').forEach(btn => {
    btn.onclick = () => {
      currentCategory = btn.dataset.category;
      renderMenu();
    };
  });
}

function renderMenu() {
  const grid = document.getElementById('menu-grid');
  if (!grid) return;
  let filtered = allMenuItems;
  if (currentCategory !== 'All') {
    filtered = filtered.filter(i => i.category === currentCategory);
  }
  if (currentSearch.trim()) {
    const searchLower = currentSearch.trim().toLowerCase();
    filtered = filtered.filter(i =>
      i.name.toLowerCase().includes(searchLower) ||
      (i.category && i.category.toLowerCase().includes(searchLower))
    );
  }
  grid.innerHTML = filtered.length ? filtered.map(item => `
    <div class="menu-item">
      <img src="${item.image ? (item.image.startsWith('http') ? item.image : API_BASE + item.image) : 'https://via.placeholder.com/210x140?text=No+Image'}" alt="${item.name}">
      <h3>${item.name}</h3>
      <p class="price">₦${item.price.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</p>
      <button onclick="addToCart('${item._id}')">Add to Cart</button>
    </div>
  `).join('') : '<p style="grid-column:1/-1;text-align:center;">No menu items found.</p>';
  renderProductNameList(); // update product name list on filter/search
}

function renderProductNameList() {
  const list = document.getElementById('product-name-list');
  if (!list) return;
  // Get unique product names (case-insensitive)
  const uniqueNames = Array.from(new Set(allMenuItems.map(i => i.name.trim().toLowerCase())));
  // Map back to original case for display (first match)
  const displayNames = uniqueNames.map(nameLower => {
    const match = allMenuItems.find(i => i.name.trim().toLowerCase() === nameLower);
    return match ? match.name.trim() : nameLower;
  });
  list.innerHTML = displayNames.length
    ? displayNames.map(name => `<li>${name}</li>`).join('')
    : '<li style="color:#888;">No products available</li>';
}

function addToCart(id) {
  const item = allMenuItems.find(i => i._id === id);
  if (!item) return;
  let cart = JSON.parse(localStorage.getItem('cart')) || [];
  let existing = cart.find(i => i._id === id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ ...item, quantity: 1 });
  }
  localStorage.setItem('cart', JSON.stringify(cart));
  alert(`${item.name} added to cart!`);
  // After adding a product to the cart, call this to update the badge live
  if (window.updateCartCountBadge) window.updateCartCountBadge();
}

document.addEventListener('DOMContentLoaded', () => {
  fetchMenuItems();
  const searchInput = document.getElementById('menu-search');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      currentSearch = this.value;
      renderMenu();
    });
  }
});
