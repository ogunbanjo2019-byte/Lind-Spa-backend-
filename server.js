const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');
const cors = require('cors');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');
const hasFrontend = fs.existsSync(path.join(PUBLIC_DIR, 'index.html'));
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5500,http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const DATA_DIR = path.join(__dirname, 'data');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.jsonl');

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: allowedOrigins }));
if (hasFrontend) app.use(express.static(PUBLIC_DIR));

const services = new Set([
  'Swedish Massage',
  'Deep Tissue Therapy',
  'Hot Stone & Hot Tub Sessions',
  'Relaxing Body Treatments',
  'Recovery Massage',
  'Customized Treatments'
]);

const durations = new Set(['30 minutes', '1 hour', '2 hours', '3 hours', 'Extended session']);
const prices = {
  '30 minutes': '$150',
  '1 hour': '$250',
  '2 hours': '$300',
  '3 hours': '$400',
  'Extended session': '$700'
};

function clean(value, max = 500) {
  return String(value ?? '').trim().replace(/[<>]/g, '').slice(0, max);
}

function validateBooking(body) {
  const booking = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    name: clean(body.name, 100),
    email: clean(body.email, 160).toLowerCase(),
    phone: clean(body.phone, 40),
    service: clean(body.service, 100),
    duration: clean(body.duration, 40),
    preferredDate: clean(body.preferredDate, 30),
    preferredTime: clean(body.preferredTime, 30),
    message: clean(body.message, 1000),
    paymentPreference: clean(body.paymentPreference, 80)
  };

  const errors = [];
  if (!booking.name) errors.push('Please enter your name.');
  if (!/^\S+@\S+\.\S+$/.test(booking.email)) errors.push('Please enter a valid email address.');
  if (!booking.phone) errors.push('Please enter a phone number.');
  if (!services.has(booking.service)) errors.push('Please select an available wellness service.');
  if (!durations.has(booking.duration)) errors.push('Please select an available session length.');
  if (!booking.preferredDate) errors.push('Please choose a preferred date.');
  if (!booking.preferredTime) errors.push('Please choose a preferred time.');

  return { booking, errors };
}

function emailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.BUSINESS_EMAIL);
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || 'true') === 'true',
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

function mailErrorDetails(error) {
  return JSON.stringify({
    message: error?.message || 'Unknown email delivery error',
    code: error?.code || null,
    responseCode: error?.responseCode || null,
    command: error?.command || null
  });
}

function bookingText(b) {
  return [
    `New booking inquiry #${b.id}`,
    '',
    `Name: ${b.name}`,
    `Email: ${b.email}`,
    `Phone: ${b.phone}`,
    `Service: ${b.service}`,
    `Session length: ${b.duration} (${prices[b.duration] || 'confirm price'})`,
    `Preferred date: ${b.preferredDate}`,
    `Preferred time: ${b.preferredTime}`,
    `Payment preference: ${b.paymentPreference || 'Not specified'}`,
    '',
    `Message: ${b.message || 'None'}`
  ].join('\n');
}

app.post('/api/bookings', async (req, res) => {
  const { booking, errors } = validateBooking(req.body);
  if (errors.length) return res.status(400).json({ ok: false, errors });

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.appendFileSync(BOOKINGS_FILE, JSON.stringify(booking) + '\n');

  let emailed = false;
  if (emailConfigured()) {
    try {
      const transporter = createTransporter();
      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: process.env.BUSINESS_EMAIL,
        replyTo: booking.email,
        subject: `Linda Spa booking inquiry — ${booking.name}`,
        text: bookingText(booking)
      });
      emailed = true;
    } catch (error) {
      console.error('Email delivery failed; inquiry remains saved locally:', mailErrorDetails(error));
    }
  }

  return res.status(201).json({
    ok: true,
    emailed,
    message: emailed
      ? 'Your inquiry was sent. Linda Spa will reply by email or phone to confirm availability.'
      : 'Your inquiry was saved locally. The business email is not configured yet, so please also call 862-251-5847.'
  });
});

app.post('/api/contact', async (req, res) => {
  const name = clean(req.body.name, 100);
  const email = clean(req.body.email, 160).toLowerCase();
  const message = clean(req.body.message, 1200);
  const errors = [];
  if (!name) errors.push('Please enter your name.');
  if (!/^\S+@\S+\.\S+$/.test(email)) errors.push('Please enter a valid email address.');
  if (!message) errors.push('Please enter a message.');
  if (errors.length) return res.status(400).json({ ok: false, errors });

  const contact = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), name, email, message };
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.appendFileSync(BOOKINGS_FILE, JSON.stringify({ type: 'contact', ...contact }) + '\n');
  let emailed = false;
  if (emailConfigured()) {
    try {
      await createTransporter().sendMail({
        from: process.env.SMTP_USER,
        to: process.env.BUSINESS_EMAIL,
        replyTo: email,
        subject: `Linda Spa contact message — ${name}`,
        text: `New contact message from ${name} (${email})\n\n${message}`
      });
      emailed = true;
    } catch (error) {
      console.error('Contact email delivery failed; message remains saved locally:', mailErrorDetails(error));
    }
  }
  return res.status(201).json({ ok: true, emailed, message: emailed ? 'Your message has been sent. Linda Spa will reply by email.' : 'Your message was saved locally. Please also call 862-251-5847.' });
});

app.get('/api/health', (_req, res) => res.json({ ok: true, emailConfigured: emailConfigured() }));

app.get('*', (_req, res) => {
  if (hasFrontend) return res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  return res.status(404).json({ ok: false, error: 'API route not found.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Linda Spa website running at http://localhost:${PORT}`);
  console.log(emailConfigured() ? 'SMTP email delivery is configured.' : 'SMTP not configured; inquiries will be saved to data/bookings.jsonl.');
});
