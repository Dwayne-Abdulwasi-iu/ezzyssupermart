// server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/vitto', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch((err) => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// --- Mongoose Schemas ---
const userSchema = new mongoose.Schema({ username: String, email: String, password: String, role: String, resetToken: String, resetTokenExpiry: Date, otp: String, otpExpiry: Date });
const menuSchema = new mongoose.Schema({ name: String, price: Number, category: String, image: String });
const orderSchema = new mongoose.Schema({ id: String, items: Array, customer: Object, payment: Object, status: String, date: String });
const paymentSchema = new mongoose.Schema({ orderId: String, amount: Number, method: String, status: String, date: String });

const User = mongoose.model('User', userSchema);
const Menu = mongoose.model('Menu', menuSchema);
const Order = mongoose.model('Order', orderSchema);
const Payment = mongoose.model('Payment', paymentSchema);

// --- Nodemailer Setup ---
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Multer setup for image uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + ext);
  }
});
const upload = multer({ storage });

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- AUTH ---
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ $or: [{ email }, { username: email }], password });
  if (user) {
    res.json({ token: uuidv4(), user: { id: user._id, username: user.username, role: user.role } });
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
});

app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (await User.findOne({ email })) {
    return res.status(400).json({ message: 'Email already exists' });
  }
  const newUser = new User({ username, email, password, role: 'customer' });
  await newUser.save();
  res.json({ message: 'Registration successful' });
});

// --- MENU ---
app.get('/admin/menu', async (req, res) => {
  const items = await Menu.find();
  res.json(items);
});
// Add menu item with image upload
app.post('/admin/menu', upload.single('image'), async (req, res) => {
  const { name, price, category } = req.body;
  let imageUrl = req.body.image || '';
  if (req.file) {
    imageUrl = `/uploads/${req.file.filename}`;
  }
  const newItem = new Menu({ name, price: Number(price), category, image: imageUrl });
  await newItem.save();
  res.json({ message: 'Item added', item: newItem });
});
// Update menu item with optional image upload
app.put('/admin/menu/:id', upload.single('image'), async (req, res) => {
  const { name, price, category } = req.body;
  let imageUrl = req.body.image || '';
  if (req.file) {
    imageUrl = `/uploads/${req.file.filename}`;
  }
  const item = await Menu.findByIdAndUpdate(
    req.params.id,
    { name, price: Number(price), category, image: imageUrl },
    { new: true }
  );
  if (item) res.json({ message: 'Item updated', item });
  else res.status(404).json({ message: 'Item not found' });
});
app.delete('/admin/menu/:id', async (req, res) => {
  await Menu.findByIdAndDelete(req.params.id);
  res.json({ message: 'Item deleted' });
});

// --- ORDERS ---
app.get('/admin/orders', async (req, res) => {
  const allOrders = await Order.find();
  console.log('DEBUG: All order IDs in DB:', allOrders.map(o => o.id)); // DEBUG
  res.json(allOrders);
});
app.post('/api/order', async (req, res) => {
  const { items, customer, payment } = req.body;
  const orderId = 'ORD-' + Math.floor(Math.random()*1000000);
  const order = new Order({ id: orderId, items, customer, payment, status: 'Preparing', date: new Date().toISOString() });
  await order.save();
  console.log('Order created:', order); // DEBUG: Log the full order object
  // Send order confirmation email
  if (customer && customer.email) {
    transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: customer.email,
      subject: 'Order Confirmation',
      text: `Thank you for your order! Your order ID is ${orderId}.`
    });
  }
  res.json({ message: 'Order placed', order });
});
app.put('/admin/orders/:id/status', async (req, res) => {
  const { status } = req.body;
  const order = await Order.findOneAndUpdate({ id: req.params.id }, { status }, { new: true });
  if (order) {
    // Send status update email to user if email exists
    if (order.customer && order.customer.email) {
      let emailText = `Dear ${order.customer.name || 'Customer'},\n\nYour order #${order.id} status has been updated to: ${status}.`;
      if (status === 'Preparing') {
        emailText = `Dear ${order.customer.name || 'Customer'},\n\nYour order #${order.id} is now being prepared. We'll notify you when it's ready!\n\nThank you for choosing Vitto Restaurant!`;
      } else if (status === 'Ready') {
        emailText = `Dear ${order.customer.name || 'Customer'},\n\nYour order #${order.id} is ready for pickup or delivery!`;
      } else if (status === 'Out for Delivery') {
        emailText = `Dear ${order.customer.name || 'Customer'},\n\nYour order #${order.id} is out for delivery. It will arrive soon!`;
      } else if (status === 'Completed') {
        emailText = `Dear ${order.customer.name || 'Customer'},\n\nYour order #${order.id} has been completed. Enjoy your meal!`;
      } else if (status === 'Cancelled') {
        emailText = `Dear ${order.customer.name || 'Customer'},\n\nYour order #${order.id} has been cancelled. If you have questions, please contact us.`;
      }
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: order.customer.email,
        subject: 'Order Status Update',
        text: emailText
      });
    }
    res.json({ message: 'Order status updated', order });
  } else {
    res.status(404).json({ message: 'Order not found' });
  }
});
// Send order details and status to user email
app.post('/admin/orders/:id/send-email', async (req, res) => {
  // Print all order _id values for debugging
  const allOrders = await Order.find();
  console.log('DEBUG: All order _id in DB:', allOrders.map(o => o._id.toString()));
  console.log('DEBUG: All order id in DB:', allOrders.map(o => o.id));
  // Try to find by id (string) or _id (ObjectId)
  let order = await Order.findOne({ id: req.params.id });
  if (!order) {
    // Try by MongoDB _id if not found by id
    try {
      order = await Order.findById(req.params.id);
    } catch (e) {
      // Ignore invalid ObjectId errors
    }
  }
  console.log('Looking for order ID:', req.params.id);
  console.log('Order found:', order);
  if (!order || !order.customer || !order.customer.email) {
    return res.status(404).json({ message: 'Order or customer email not found.' });
  }
  let itemsList = order.items.map(i => `${i.quantity || 1} x ${i.name}`).join(', ');
  let emailText = `Dear ${order.customer.name || 'Customer'},\n\nHere are your order details:\n\nOrder ID: ${order.id}\nStatus: ${order.status}\nDate: ${new Date(order.date).toLocaleString()}\nItems: ${itemsList}\n`;
  if (order.customer.address) emailText += `Delivery Address: ${order.customer.address}\n`;
  if (order.customer.contact) emailText += `Contact: ${order.customer.contact}\n`;
  emailText += `\nThank you for choosing Vitto Restaurant!`;
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: order.customer.email,
      subject: 'Your Order Details - Vitto Restaurant',
      text: emailText
    });
    res.json({ message: 'Order details email sent to user.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to send email.' });
  }
});
// Send order details by customer name, contact, and email
app.post('/admin/orders/send-email-by-customer', async (req, res) => {
  const { name, contact, email } = req.body;
  if (!email) return res.status(400).json({ message: 'Customer email required.' });
  // Find the most recent order for this customer (by email, optionally name/contact)
  let order = await Order.findOne({ 'customer.email': email }).sort({ date: -1 });
  if (!order && name) {
    order = await Order.findOne({ 'customer.name': name, 'customer.contact': contact }).sort({ date: -1 });
  }
  if (!order) {
    return res.status(404).json({ message: 'Order for this customer not found.' });
  }
  let itemsList = order.items.map(i => `${i.quantity || 1} x ${i.name}`).join(', ');
  let emailText = `Dear ${order.customer.name || 'Customer'},\n\nHere are your order details:\n\nOrder ID: ${order.id}\nStatus: ${order.status}\nDate: ${new Date(order.date).toLocaleString()}\nItems: ${itemsList}\n`;
  if (order.customer.address) emailText += `Delivery Address: ${order.customer.address}\n`;
  if (order.customer.contact) emailText += `Contact: ${order.customer.contact}\n`;
  emailText += `\nThank you for choosing Vitto Restaurant!`;
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: order.customer.email,
      subject: 'Your Order Details - Vitto Restaurant',
      text: emailText
    });
    res.json({ message: 'Order details email sent to user.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to send email.' });
  }
});

// --- PAYMENTS ---
app.get('/admin/payments', async (req, res) => {
  const allPayments = await Payment.find();
  res.json(allPayments);
});
app.post('/api/payment', async (req, res) => {
  const { orderId, amount, method, status } = req.body;
  const payment = new Payment({ orderId, amount, method, status, date: new Date().toISOString() });
  await payment.save();
  res.json({ message: 'Payment recorded' });
});

// --- ANALYTICS ---
app.get('/analytics', async (req, res) => {
  const payments = await Payment.find();
  const totalRevenue = payments.filter(p => p.status === 'Completed').reduce((sum, p) => sum + p.amount, 0);
  const refunds = payments.filter(p => p.status === 'Refunded').length;
  const cardPayments = payments.filter(p => p.method === 'Card').length;
  const paypalPayments = payments.filter(p => p.method === 'PayPal').length;
  res.json({ totalRevenue, refunds, cardPayments, paypalPayments, totalTransactions: payments.length });
});
app.get('/monthly-report', async (req, res) => {
  const payments = await Payment.find();
  const totalRevenue = payments.filter(p => p.status === 'Completed').reduce((sum, p) => sum + p.amount, 0);
  const refunds = payments.filter(p => p.status === 'Refunded').length;
  const cardPayments = payments.filter(p => p.method === 'Card').length;
  const paypalPayments = payments.filter(p => p.method === 'PayPal').length;
  res.json({ totalRevenue, refunds, cardPayments, paypalPayments, totalTransactions: payments.length });
});

// --- CONTACT ---
app.post('/api/contact', async (req, res) => {
  const { name, email, message } = req.body;
  // Send contact email
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_USER,
    subject: 'New Contact Message',
    text: `From: ${name} <${email}>\n${message}`
  });
  res.json({ message: 'Message received! We will contact you soon.' });
});

// --- PASSWORD RESET WITH OTP ONLY ---
// Remove any previous /api/forgot-password or reset link logic above this point.
// Request password reset (send OTP)
app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: 'No user with that email.' });
  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  user.otp = otp;
  user.otpExpiry = Date.now() + 1000 * 60 * 10; // 10 minutes
  user.resetToken = undefined;
  user.resetTokenExpiry = undefined;
  await user.save();
  // Send OTP email ONLY
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: user.email,
    subject: 'Vitto Password Reset OTP',
    text: `Your OTP for password reset is: ${otp}\nThis code is valid for 10 minutes.`
  });
  res.json({ message: 'OTP sent! Check your email.' });
});

// Verify OTP and reset password
app.post('/api/reset-password-otp', async (req, res) => {
  const { email, otp, password } = req.body;
  const user = await User.findOne({ email, otp, otpExpiry: { $gt: Date.now() } });
  if (!user) return res.status(400).json({ message: 'Invalid or expired OTP.' });
  user.password = password;
  user.otp = undefined;
  user.otpExpiry = undefined;
  await user.save();
  res.json({ message: 'Password reset! You can now log in.' });
});

// --- DEFAULT ROUTE ---
app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));

app.listen(PORT, () => console.log(`Vitto backend running on http://localhost:${PORT}`));
