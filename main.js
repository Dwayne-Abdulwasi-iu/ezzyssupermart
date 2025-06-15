const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// --- File paths ---
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CONTACT_FILE = path.join(DATA_DIR, 'contact-messages.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

function readJson(file) {
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; }
}
function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// --- Products ---
app.get('/api/products', (req, res) => {
  res.json(readJson(PRODUCTS_FILE));
});
app.post('/api/products', (req, res) => {
  const { name, price, img, category } = req.body;
  if (!name || !img || !category || !price) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }
  const products = readJson(PRODUCTS_FILE);
  products.push({ name, price, img, category });
  writeJson(PRODUCTS_FILE, products);
  res.json({ success: true });
});
app.put('/api/products/:idx', (req, res) => {
  const idx = parseInt(req.params.idx);
  let products = readJson(PRODUCTS_FILE);
  if (isNaN(idx) || idx < 0 || idx >= products.length) {
    return res.status(404).json({ success: false, message: 'Product not found.' });
  }
  products[idx] = req.body;
  writeJson(PRODUCTS_FILE, products);
  res.json({ success: true });
});
app.delete('/api/products/:idx', (req, res) => {
  const idx = parseInt(req.params.idx);
  let products = readJson(PRODUCTS_FILE);
  if (isNaN(idx) || idx < 0 || idx >= products.length) {
    return res.status(404).json({ success: false, message: 'Product not found.' });
  }
  products.splice(idx, 1);
  writeJson(PRODUCTS_FILE, products);
  res.json({ success: true });
});

// --- Orders ---
app.get('/api/orders', (req, res) => {
  res.json(readJson(ORDERS_FILE));
});
app.post('/api/orders', (req, res) => {
  const order = req.body;
  if (!order || !order.items || !order.user) {
    return res.status(400).json({ success: false, message: 'Invalid order.' });
  }
  if (!order.created) order.created = Date.now();
  const orders = readJson(ORDERS_FILE);
  orders.push(order);
  writeJson(ORDERS_FILE, orders);
  res.json({ success: true });
});

// --- Users ---
app.post('/api/signup', (req, res) => {
  const { name, email, password, created } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }
  const users = readJson(USERS_FILE);
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ success: false, message: 'Email already registered.' });
  }
  users.push({ name, email, password, created: created || Date.now() });
  writeJson(USERS_FILE, users);
  res.json({ success: true });
});
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Missing email or password.' });
  }
  const users = readJson(USERS_FILE);
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }
  const { password: _, ...userSafe } = user;
  res.json({ success: true, user: userSafe });
});

// --- Contact ---
app.post('/api/contact', (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }
  const messages = readJson(CONTACT_FILE);
  messages.push({ name, email, message, created: Date.now() });
  writeJson(CONTACT_FILE, messages);
  res.json({ success: true });
});

// --- Default route ---
app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));

app.listen(PORT, () => console.log(`Vitto backend (file-based) running on http://localhost:${PORT}`));
