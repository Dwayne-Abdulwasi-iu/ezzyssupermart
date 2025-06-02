# Ezzys Supermart

A full-stack shopping cart and admin system for Ezzys Supermart, featuring:
- User login/signup
- Product catalog and management
- Shopping cart with floating cart icon
- Order placement and management
- Deals management
- Customer management
- Contact form and admin message view
- Email notifications for order status
- Modern, responsive UI

## Features
- **Frontend:** HTML, CSS, JavaScript (no framework)
- **Backend:** Node.js (Express), JSON file storage
- **Admin Panel:** Manage products, deals, orders, customers, and contact messages
- **Cart:** Add/remove items, floating cart icon (bottom left), persistent via localStorage
- **Order:** Place orders, choose payment method, receive email notifications
- **Contact:** Users can send messages, admin can view all messages

## Local Development

### Prerequisites
- [Node.js](https://nodejs.org/) (v14+ recommended)

### Setup
1. **Clone or copy this folder.**
2. Install dependencies:
   ```sh
   npm install
   ```
3. Start the main backend:
   ```sh
   node backend.js
   ```
4. Start the deals backend (in a new terminal):
   ```sh
   node product-deals-backend.js
   ```
5. Open `ezzys.html` in your browser (or use Live Server in VS Code).

### Default URLs
- Main site: `ezzys.html`
- Admin panel: `admin-panel.html`
- Cart: `cart.html`
- Deals: `deals.html`
- Contact: `contact.html`
- Login: `login.html`

## Deployment (Free Online Hosting)

### Backend (Node.js API)
- Deploy to [Render](https://render.com/), [Railway](https://railway.app/), [Glitch](https://glitch.com/), or [Replit](https://replit.com/).
- Set environment variables for any secrets (e.g., Gmail credentials for nodemailer).
- Update `API_BASE` in `ezzys.js` to your deployed backend URL.

### Frontend (Static Files)
- Deploy to [Vercel](https://vercel.com/), [Netlify](https://netlify.com/), or [GitHub Pages](https://pages.github.com/).
- Make sure all API calls point to your backend URL.

## Configuration
- **Email:** Update the sender email and app password in `backend.js` for order notifications.
- **API URLs:** Change `API_BASE` in `ezzys.js` if deploying online.

## Notes
- All data is stored in local JSON files (no database required).
- CORS is enabled for local and cloud development.
- For production, secure your credentials and consider using a real database.

## License
MIT

---

**Enjoy using Ezzys Supermart!**
