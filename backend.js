const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// --- Products ---
const PRODUCTS_FILE = path.join(__dirname, 'products.json');
function readProducts() {
    if (!fs.existsSync(PRODUCTS_FILE)) return [];
    try { return JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8')); } catch { return []; }
}
function writeProducts(products) {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
}
app.get('/api/products', (req, res) => {
    res.json(readProducts());
});
app.post('/api/products', (req, res) => {
    const { name, price, img, category } = req.body;
    if (!name || !img || !category || !price) {
        return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }
    const products = readProducts();
    products.push({ name, price, img, category });
    writeProducts(products);
    res.json({ success: true });
});
app.put('/api/products/:idx', (req, res) => {
    const idx = parseInt(req.params.idx);
    let products = readProducts();
    if (isNaN(idx) || idx < 0 || idx >= products.length) {
        return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    products[idx] = req.body;
    writeProducts(products);
    res.json({ success: true });
});
app.delete('/api/products/:idx', (req, res) => {
    const idx = parseInt(req.params.idx);
    let products = readProducts();
    if (isNaN(idx) || idx < 0 || idx >= products.length) {
        return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    products.splice(idx, 1);
    writeProducts(products);
    res.json({ success: true });
});

// --- Orders ---
const ORDERS_FILE = path.join(__dirname, 'orders.json');
function readOrders() {
    if (!fs.existsSync(ORDERS_FILE)) return [];
    try { return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8')); } catch { return []; }
}
function writeOrders(orders) {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}
app.get('/api/orders', (req, res) => {
    res.json(readOrders());
});
app.post('/api/orders', (req, res) => {
    const order = req.body;
    if (!order || !order.items || !order.user) {
        return res.status(400).json({ success: false, message: 'Invalid order.' });
    }
    // Add created date if not present
    if (!order.created) {
        order.created = Date.now();
    }
    const orders = readOrders();
    orders.push(order);
    writeOrders(orders);
    res.json({ success: true });
});
app.put('/api/orders/accept/:id', async (req, res) => {
    const id = req.params.id;
    let orders = readOrders();
    const idx = orders.findIndex(o => o.id == id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Order not found.' });
    orders[idx].status = 'Accepted';
    writeOrders(orders);
    // Send email to user if possible
    try {
        const order = orders[idx];
        let userEmail = '';
        if (order.user && typeof order.user === 'object' && order.user.email) userEmail = order.user.email;
        else if (typeof order.user === 'string') userEmail = order.user;
        if (userEmail) {
            await sendOrderAcceptedEmail(userEmail, order);
            console.log('Order accepted email sent to', userEmail);
        }
        res.json({ success: true });
    } catch (e) {
        // Log and return error details to frontend
        console.error('Failed to send order accepted email:', e);
        res.status(500).json({ success: false, message: 'Failed to send order accepted email', error: e && e.message ? e.message : e });
    }
});
app.put('/api/orders/decline/:id', async (req, res) => {
    const id = req.params.id;
    let orders = readOrders();
    const idx = orders.findIndex(o => o.id == id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Order not found.' });
    orders[idx].status = 'Declined';
    writeOrders(orders);
    // Send decline email to user if possible
    try {
        const order = orders[idx];
        let userEmail = '';
        if (order.user && typeof order.user === 'object' && order.user.email) userEmail = order.user.email;
        else if (typeof order.user === 'string') userEmail = order.user;
        if (userEmail) {
            await sendOrderDeclinedEmail(userEmail, order);
            console.log('Order declined email sent to', userEmail);
        }
        res.json({ success: true });
    } catch (e) {
        console.error('Failed to send order declined email:', e);
        // Notify admin that order was declined and user will be informed by email
        res.status(500).json({ success: false, message: 'Order has been declined. The user will be notified by email.' });
    }
});
app.get('/api/orders/accepted', (req, res) => {
    const orders = readOrders().filter(o => o.status && o.status.toLowerCase().includes('accepted'));
    res.json(orders);
});
app.get('/api/orders/declined', (req, res) => {
    const orders = readOrders().filter(o => o.status && o.status.toLowerCase().includes('declined'));
    res.json(orders);
});

// --- Deals (proxy to deals backend) ---
const http = require('http');
app.use('/api/deals', (req, res) => {
    const options = {
        hostname: 'localhost',
        port: 3002,
        path: '/api/deals' + (req.url || ''),
        method: req.method,
        headers: req.headers
    };
    const proxy = http.request(options, function (pres) {
        res.writeHead(pres.statusCode, pres.headers);
        pres.pipe(res, { end: true });
    });
    proxy.on('error', (err) => {
        res.status(502).json({ success: false, message: 'Proxy error: ' + err.message });
    });
    req.pipe(proxy, { end: true });
});

// --- Users (Signup & Login) ---
const USERS_FILE = path.join(__dirname, 'users.json');
function readUsers() {
    if (!fs.existsSync(USERS_FILE)) return [];
    try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch { return []; }
}
function writeUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}
app.post('/api/signup', (req, res) => {
    const { name, email, password, created } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }
    const users = readUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
        return res.status(409).json({ success: false, message: 'Email already registered.' });
    }
    users.push({ name, email, password, created: created || Date.now() });
    writeUsers(users);
    res.json({ success: true });
});
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Missing email or password.' });
    }
    const users = readUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }
    // Do not send password back
    const { password: _, ...userSafe } = user;
    res.json({ success: true, user: userSafe });
});

// --- Customers ---
app.get('/api/customers', (req, res) => {
    const users = readUsers();
    // Only return name, email, and created fields (do NOT include password)
    const customers = users.map(u => ({ name: u.name, email: u.email, created: u.created }));
    res.json(customers);
});

// --- (Optional) Serve static files for frontend ---
app.use(express.static(__dirname));

// --- Email sending utility (using nodemailer) ---
const EMAIL_FROM = 'ezzyssupermart@gmail.com'; // Change to your sender email
const EMAIL_PASS = 'qezeifhcrwravhti'; // Use an app password or env var
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: EMAIL_FROM,
        pass: EMAIL_PASS
    }
});
function sendOrderAcceptedEmail(to, order) {
    const itemsList = (order.items || []).map(item => `${item.qty} × ${item.name} @ ₦${item.price.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`).join('<br>');
    const html = `
        <h2>Your Order Has Been Accepted!</h2>
        <p>Dear ${order.user && order.user.name ? order.user.name : order.user && order.user.email ? order.user.email : order.user || ''},</p>
        <p>Your order <b>${order.id || ''}</b> has been <b>accepted</b> and is being prepared for delivery.</p>
        <h3>Order Details:</h3>
        <ul>
            <li><b>Order ID:</b> ${order.id || ''}</li>
            <li><b>Date:</b> ${order.created ? new Date(order.created).toLocaleString() : ''}</li>
            <li><b>Address:</b> ${order.address || ''}</li>
            <li><b>Phone:</b> ${order.phone || ''}</li>
            <li><b>Amount:</b> ₦${order.amount ? order.amount.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2}) : ''}</li>
        </ul>
        <h4>Items:</h4>
        <div>${itemsList}</div>
        <p>Thank you for shopping with Ezzys Supermart!</p>
    `;
    return transporter.sendMail({
        from: EMAIL_FROM,
        to,
        subject: 'Your Order Has Been Accepted – Ezzys Supermart',
        html
    });
}
function sendOrderDeclinedEmail(to, order) {
    const html = `
        <h2>Your Order Was Declined</h2>
        <p>Dear ${order.user && order.user.name ? order.user.name : order.user && order.user.email ? order.user.email : order.user || ''},</p>
        <p>We regret to inform you that your order <b>${order.id || ''}</b> was <b>declined</b>. If you have any questions, please contact us.</p>
        <h3>Order Details:</h3>
        <ul>
            <li><b>Order ID:</b> ${order.id || ''}</li>
            <li><b>Date:</b> ${order.created ? new Date(order.created).toLocaleString() : ''}</li>
            <li><b>Amount:</b> ₦${order.amount ? order.amount.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2}) : ''}</li>
        </ul>
        <p>Thank you for considering Ezzys Supermart.</p>
    `;
    return transporter.sendMail({
        from: EMAIL_FROM,
        to,
        subject: 'Your Order Was Declined – Ezzys Supermart',
        html
    });
}

// --- Email test endpoint for debugging ---
app.post('/api/test-email', async (req, res) => {
    const { to } = req.body;
    if (!to) return res.status(400).json({ success: false, message: 'Missing recipient email.' });
    try {
        await transporter.sendMail({
            from: EMAIL_FROM,
            to,
            subject: 'Test Email from Ezzys Supermart',
            html: '<h2>This is a test email from Ezzys Supermart backend.</h2>'
        });
        res.json({ success: true });
    } catch (e) {
        console.error('Test email failed:', e);
        res.status(500).json({ success: false, message: 'Test email failed', error: e && e.stack ? e.stack : e.toString() });
    }
});

// --- Contact Messages ---
const CONTACT_FILE = path.join(__dirname, 'contact-messages.json');
function readContactMessages() {
    if (!fs.existsSync(CONTACT_FILE)) return [];
    try { return JSON.parse(fs.readFileSync(CONTACT_FILE, 'utf8')); } catch { return []; }
}
function writeContactMessages(messages) {
    fs.writeFileSync(CONTACT_FILE, JSON.stringify(messages, null, 2));
}
app.post('/api/contact', (req, res) => {
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
        return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }
    const messages = readContactMessages();
    messages.push({ name, email, message, created: Date.now() });
    writeContactMessages(messages);
    res.json({ success: true });
});

// --- Admin Email Verification ---
const adminCodeStore = { code: null, expires: null };
app.post('/api/admin-send-code', async (req, res) => {
    const { email } = req.body;
    if (email !== 'ezzyssupermart@gmail.com') {
        return res.status(403).json({ success: false, message: 'Unauthorized email.' });
    }
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return res.status(400).json({ success: false, message: 'Invalid email.' });
    }
    // Generate a 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    adminCodeStore.code = code;
    adminCodeStore.expires = Date.now() + 10 * 60 * 1000; // 10 minutes
    try {
        await transporter.sendMail({
            from: EMAIL_FROM,
            to: email,
            subject: 'Your Ezzys Supermart Admin Login Code',
            html: `<h2>Your Admin Login Code</h2><p>Your verification code is: <b>${code}</b></p><p>This code will expire in 10 minutes.</p>`
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to send email', error: e && e.message ? e.message : e });
    }
});
app.post('/api/admin-verify-code', (req, res) => {
    const { code } = req.body;
    if (!adminCodeStore.code || !adminCodeStore.expires || Date.now() > adminCodeStore.expires) {
        return res.status(400).json({ success: false, message: 'Code expired. Please request a new code.' });
    }
    if (code === adminCodeStore.code) {
        adminCodeStore.code = null;
        adminCodeStore.expires = null;
        return res.json({ success: true });
    } else {
        return res.status(401).json({ success: false, message: 'Incorrect code.' });
    }
});

// --- Password Reset (Forgot Password) ---
const passwordResetCodes = {};

app.post('/api/request-password-reset', async (req, res) => {
    const { email } = req.body;
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return res.status(400).json({ success: false, message: 'Invalid email.' });
    }
    const users = readUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
        // For security, do not reveal if email exists
        return res.json({ success: true });
    }
    // Generate a 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    passwordResetCodes[email.toLowerCase()] = {
        code,
        expires: Date.now() + 15 * 60 * 1000 // 15 minutes
    };
    try {
        await transporter.sendMail({
            from: EMAIL_FROM,
            to: email,
            subject: 'Your Ezzys Supermart Password Reset Code',
            html: `<h2>Password Reset Code</h2><p>Your code is: <b>${code}</b></p><p>This code will expire in 15 minutes.</p>`
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to send reset code', error: e && e.message ? e.message : e });
    }
});

app.post('/api/reset-password', (req, res) => {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
        return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }
    const entry = passwordResetCodes[email.toLowerCase()];
    if (!entry || entry.code !== code || Date.now() > entry.expires) {
        return res.status(400).json({ success: false, message: 'Invalid or expired code.' });
    }
    // Update password
    const users = readUsers();
    const idx = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
    if (idx === -1) {
        return res.status(400).json({ success: false, message: 'User not found.' });
    }
    users[idx].password = newPassword;
    writeUsers(users);
    delete passwordResetCodes[email.toLowerCase()];
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log('Main backend running on port', PORT);
});
