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

// ── APPS — fetch ALL pages so search works across full list ──
// GlobalSMS /api/public/app defaults to 10 per page.
// We loop through all pages and return the merged array.
app.get('/proxy/apps', async (req, res) => {
  const search = req.query.search || ''; // optional server-side filter
  try {
    let allApps = [];
    let page = 1;
    const limit = 100; // max per request
    let totalFetched = 0;
    let totalAvailable = Infinity;

    while (totalFetched < totalAvailable) {
      const url = `${BASE}/api/public/app?limit=${limit}&offset=${(page - 1) * limit}${search ? '&search=' + encodeURIComponent(search) : ''}`;
      const response = await fetch(url, {
        headers: { 'Authorization': req.headers.authorization, 'accept': '*/*' }
      });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({ error: `GlobalSMS returned ${response.status}`, detail: errText });
      }

      const data = await response.json();
      // GlobalSMS shape: { total: N, data: [...] }
      const pageApps = Array.isArray(data) ? data : (data.data || []);
      if (data.total !== undefined) totalAvailable = data.total;
      
      allApps = allApps.concat(pageApps);
      totalFetched = allApps.length;
      page++;

      // Stop if this page returned fewer than limit (last page)
      if (pageApps.length < limit) break;
    }

    return res.json({ total: allApps.length, data: allApps });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── VENDORS ──────────────────────────────────────────────
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


// ── GET NUMBERS FOR AN ORDER ─────────────────────────────


app.get('/proxy/order-numbers', async (req, res) => {
  const { order_uuid } = req.query;
  if (!order_uuid) return res.status(400).json({ error: 'order_uuid required' });

  try {
    const url = `${BASE}/api/public/number_by_token?token=${order_uuid}&order_uuid=${order_uuid}`;
    const response = await fetch(url, {
      headers: { 'Authorization': req.headers.authorization, 'accept': '*/*' }
    });
    const text = await response.text();

    if (!response.ok) {
      return res.status(response.status).json({ error: `GlobalSMS returned ${response.status}`, detail: text });
    }

    // Helper: extract plain phone string from nested object or plain string
    function extractPhone(val) {
      if (!val && val !== 0) return '';
      if (typeof val === 'string') return val;
      if (typeof val === 'number') return String(val);
      if (typeof val === 'object') {
        const inner = val.number || val.phone_number || val.num || val.value || val.data || '';
        return extractPhone(inner) || JSON.stringify(val);
      }
      return String(val);
    }

    let parsed = null;
    try { parsed = JSON.parse(text); } catch (_) { /* may be plain text */ }

    let numbers = [];
    if (parsed !== null) {
      const rows = Array.isArray(parsed) ? parsed : (parsed?.data || parsed?.results || []);
      numbers = rows.map(n => ({
        number:  extractPhone(n.number ?? n.phone_number ?? n.num ?? n),
        uuid:    n.uuid || n.number_uuid || n.order_number_uuid || '',
        app:     n.app_id || n.app || '',
        ordered: n.created_on || n.order_on || ''
      }));
    } else {
      // Plain text response e.g. "+16502002471"
      numbers = text.trim().split('\n').map(l => l.trim()).filter(Boolean).map(line => ({ number: line, uuid: '' }));
    }

    return res.json({ numbers, raw: text.trim() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET SMS — /api/public/getSmsByToken ──────────────────
// Per docs: token = Number UUID (the uuid field from /api/order_number/list)
// NOT the Order UUID. Response may be plain text code or JSON.
// FIX: removed call to undefined parseGlobalSMSResponse() — inline parse instead
app.get('/proxy/get-sms', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'token (number UUID) required' });
  try {
    const url = `${BASE}/api/public/getSmsByToken?token=${encodeURIComponent(token)}`;
    const response = await fetch(url, {
      headers: { 'Authorization': req.headers.authorization, 'accept': '*/*' }
    });
    const text = await response.text();

    if (!response.ok) {
      return res.status(response.status).json({ error: `GlobalSMS returned ${response.status}`, detail: text });
    }

    let parsed = null;
    try { parsed = JSON.parse(text); } catch (_) { parsed = text.trim(); }

    return res.json({ data: parsed, raw: text.trim() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── NOTE: GlobalSMS has NO cancel/refund API endpoint ────
// Pay Per SMS refunds are issued automatically when the number
// expires with no SMS delivered. Cancel manually at globalsms.io/dashboard.

app.listen(PORT, () => console.log('GlobalSMS Proxy running on port ' + PORT));
