// Simple backend for product deals
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());

const DEALS_FILE = path.join(__dirname, 'deals.json');

function readDeals() {
    if (!fs.existsSync(DEALS_FILE)) return [];
    try {
        return JSON.parse(fs.readFileSync(DEALS_FILE, 'utf8'));
    } catch {
        return [];
    }
}
function writeDeals(deals) {
    fs.writeFileSync(DEALS_FILE, JSON.stringify(deals, null, 2));
}

// --- Deals API ---
app.get('/api/deals', (req, res) => {
    res.json(readDeals());
});

app.post('/api/deals', (req, res) => {
    const { name, description, dealPrice, oldPrice, img } = req.body;
    if (!name || !img || !dealPrice) {
        return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }
    const deals = readDeals();
    deals.push({ name, description, dealPrice, oldPrice, img });
    writeDeals(deals);
    res.json({ success: true });
});

app.delete('/api/deals/:idx', (req, res) => {
    const idx = parseInt(req.params.idx);
    let deals = readDeals();
    if (isNaN(idx) || idx < 0 || idx >= deals.length) {
        return res.status(404).json({ success: false, message: 'Deal not found.' });
    }
    deals.splice(idx, 1);
    writeDeals(deals);
    res.json({ success: true });
});

// --- (Optional) Serve static files for frontend ---
app.use(express.static(__dirname));

app.listen(PORT, '0.0.0.0', () => {
    console.log('Deals backend running on port', PORT);
});
