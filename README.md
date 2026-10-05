# Linda Spa Wellness Centre

A plain-local full-stack, multi-section wellness website built with standard HTML, CSS, JavaScript, and a small Node/Express backend.

## Run locally

```bash
cd /home/ubuntu/linda-spa
npm install
npm start
```

Open `http://localhost:3000`.

## Email delivery

The booking form always saves inquiries to `data/bookings.jsonl`. To also email each inquiry to the business inbox:

1. Copy `.env.example` to `.env`.
2. Set `BUSINESS_EMAIL`, `SMTP_USER`, and `SMTP_PASS`.
3. For Gmail, use a Gmail App Password rather than your normal account password.
4. Restart the server.

The backend sets `replyTo` to the visitor's email address so the business can reply directly from Gmail.

## Payments

This implementation does not collect payment details or automatically charge visitors. The form records a preferred payment method for follow-up confirmation. Before adding a payment provider, verify business licensing, local requirements, and provider policies.

## Files

- `server.js` — Express server, validation, local persistence, optional SMTP delivery
- `public/index.html` — responsive multi-section wellness-centre interface with Home, About, Services, Pricing, Gallery, Booking, Contact, and chatbot
- `public/styles.css` — visual system and responsive layout
- `public/app.js` — navigation, booking/contact submission, and Linda Spa Assistant chatbot behavior
- `data/bookings.jsonl` — local inquiry log created at runtime

## Pages

- `index.html` — Home
- `about.html` — About Linda Spa
- `services.html` — Services
- `pricing.html` — Pricing and payment-method badges
- `gallery.html` — Gallery
- `booking.html` — Booking form
- `contact.html` — Contact form

Navigation links use normal relative HTML links, so each item opens a separate page. Payment badges identify PayPal, Apple Pay, Cash App, Bitcoin, and Chime.

## Separate frontend and backend hosting

The backend supports CORS through the `CORS_ORIGIN` environment variable. On Render, set it to the exact HTTPS URL of the separately hosted frontend, for example `https://linda-spa.pages.dev`.

Before loading `app.js` in the separately hosted frontend, define the backend URL:

```html
<script>window.LINDA_API_URL = 'https://your-linda-spa-backend.onrender.com';</script>
<script src="./app.js"></script>
```

The frontend then sends bookings to the backend endpoints `/api/bookings` and `/api/contact`.
