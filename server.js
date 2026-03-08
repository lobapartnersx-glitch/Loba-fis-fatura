const express = require('express');
const path    = require('path');
const fetch   = require('node-fetch');
const app     = express();
const PORT    = process.env.PORT || 3000;

// ÖNEMLİ: JSON body parse — /api/claude'dan ÖNCE tanımlanmalı
app.use((req, res, next) => {
  express.json({ limit: '50mb' })(req, res, (err) => {
    if (err) {
      console.error('JSON parse hatası:', err.message);
      return res.status(400).json({ error: { message: 'Geçersiz istek.' } });
    }
    next();
  });
});

// Anthropic API proxy — statik dosyalardan ÖNCE tanımla
app.post('/api/claude', async (req, res) => {
  console.log('>> /api/claude isteği geldi');
  try {
    const { body, isPdf } = req.body || {};
    const apiKey = process.env.ANTHROPIC_API_KEY;

    console.log('API Key var mı:', !!apiKey);
    console.log('isPdf:', isPdf);

    if (!apiKey) {
      return res.status(401).json({ error: { message: 'ANTHROPIC_API_KEY tanımlı değil.' } });
    }
    if (!body) {
      return res.status(400).json({ error: { message: 'body boş geldi.' } });
    }

    const headers = {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    };
    if (isPdf) headers['anthropic-beta'] = 'pdfs-2024-09-25';

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: headers,
      body:    JSON.stringify(body),
    });

    const data = await upstream.json();
    console.log('Anthropic yanıt status:', upstream.status);
    if (!upstream.ok) return res.status(upstream.status).json(data);
    res.json(data);

  } catch (err) {
    console.error('Proxy hatası:', err.message);
    res.status(500).json({ error: { message: 'Sunucu hatası: ' + err.message } });
  }
});

// Statik dosyalar
app.use(express.static(path.join(__dirname)));

// Ana sayfa
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log('✅ Loba Fatura çalışıyor: port ' + PORT);
  console.log('🔑 API Key:', process.env.ANTHROPIC_API_KEY ? 'TANIMLI ✓' : 'EKSİK ✗');
});
