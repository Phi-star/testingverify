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

// ── BALANCE ──────────────────────────────────────────────
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

// ── APPS ─────────────────────────────────────────────────
app.get('/proxy/apps', async (req, res) => {
  const endpoints = ['/api/public/apps', '/api/apps', '/api/public/services', '/api/services'];
  for (const ep of endpoints) {
    try {
      const response = await fetch(BASE + ep, {
        headers: { 'Authorization': req.headers.authorization, 'accept': '*/*' }
      });
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
    } catch (e) { continue; }
  }
  res.status(502).json({ error: 'All app endpoints failed' });
});

// ── VENDORS ──────────────────────────────────────────────
app.get('/proxy/vendors', async (req, res) => {
  const endpoints = ['/api/public/vendors', '/api/vendors'];
  for (const ep of endpoints) {
    try {
      const response = await fetch(BASE + ep, {
        headers: { 'Authorization': req.headers.authorization, 'accept': '*/*' }
      });
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
    } catch (e) { continue; }
  }
  res.status(502).json({ error: 'All vendor endpoints failed' });
});

// ── NUMBERS / AVAILABILITY ────────────────────────────────
app.get('/proxy/numbers', async (req, res) => {
  const { app_uuid, country, pay_method } = req.query;
  const endpoints = [
    `/api/public/numbers?app_uuid=${app_uuid}&country=${country}&pay_method=${pay_method}`,
    `/api/numbers?app_uuid=${app_uuid}&country=${country}&pay_method=${pay_method}`
  ];
  for (const ep of endpoints) {
    try {
      const response = await fetch(BASE + ep, {
        headers: { 'Authorization': req.headers.authorization, 'accept': '*/*' }
      });
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
    } catch (e) { continue; }
  }
  res.status(502).json({ error: 'All number endpoints failed' });
});

app.listen(PORT, () => console.log('GlobalSMS Proxy running on port ' + PORT));
