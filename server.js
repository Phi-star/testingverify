const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE = 'https://api.globalsms.io';

app.use(cors());
app.use(express.json());

// ── Serve the explorer HTML ──────────────────────────────
app.use(express.static('public'));

// ── LOGIN ────────────────────────────────────────────────
app.post('/proxy/login', async (req, res) => {
  try {
    const response = await fetch(BASE + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'accept': '*/*' },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── BALANCE (JWT decode — /api/users/me not publicly accessible) ──
app.get('/proxy/me', async (req, res) => {
  try {
    const response = await fetch(BASE + '/api/users/me', {
      headers: { 'Authorization': req.headers.authorization, 'accept': '*/*' }
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── APPS — correct endpoint: /api/public/app ─────────────
app.get('/proxy/apps', async (req, res) => {
  try {
    const response = await fetch(BASE + '/api/public/app', {
      headers: { 'Authorization': req.headers.authorization, 'accept': '*/*' }
    });
    if (response.ok) {
      const data = await response.json();
      return res.json(data);
    }
    const errText = await response.text();
    res.status(response.status).json({ error: `GlobalSMS returned ${response.status}`, detail: errText });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── VENDORS — correct endpoint: /api/public/vendor ───────
app.get('/proxy/vendors', async (req, res) => {
  try {
    const response = await fetch(BASE + '/api/public/vendor', {
      headers: { 'Authorization': req.headers.authorization, 'accept': '*/*' }
    });
    if (response.ok) {
      const data = await response.json();
      return res.json(data);
    }
    const errText = await response.text();
    res.status(response.status).json({ error: `GlobalSMS returned ${response.status}`, detail: errText });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── NUMBER COUNT — /api/number/num_count/{app_uuid}?country=US ──
// Returns: [{total, used, unused}, ...per-vendor entries]
app.get('/proxy/numbers', async (req, res) => {
  const { app_uuid, country = 'US', pay_method = 'pay_per_activation' } = req.query;
  if (!app_uuid) return res.status(400).json({ error: 'app_uuid required' });
  try {
    const url = `${BASE}/api/number/num_count/${encodeURIComponent(app_uuid)}?country=${country}`;
    const response = await fetch(url, {
      headers: { 'Authorization': req.headers.authorization, 'accept': '*/*' }
    });
    if (response.ok) {
      const data = await response.json();
      return res.json(data);
    }
    const errText = await response.text();
    res.status(response.status).json({ error: `GlobalSMS returned ${response.status}`, detail: errText });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── BUY NUMBER — /api/orders/create_number_order ────────
// Body: { app_uuid:[], count, duration, condition, pay_method, type, country, vendor_uuid }
app.post('/proxy/buy', async (req, res) => {
  try {
    const response = await fetch(BASE + '/api/orders/create_number_order', {
      method: 'POST',
      headers: {
        'Authorization': req.headers.authorization,
        'Content-Type': 'application/json',
        'accept': '*/*'
      },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log('GlobalSMS Proxy running on port ' + PORT));
