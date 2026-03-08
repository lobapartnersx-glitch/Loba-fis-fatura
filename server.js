const express = require('express');
const path    = require('path');
const app     = express();
const PORT    = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Anthropic API proxy — CORS sorununu ortadan kaldırır
app.post('/api/claude', async (req, res) => {
  try {
    const { body, isPdf } = req.body;
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return res.status(401).json({ error: { message: 'API anahtarı sunucuda tanımlı değil.' } });
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
    if (!upstream.ok) return res.status(upstream.status).json(data);
    res.json(data);

  } catch (err) {
    res.status(500).json({ error: { message: 'Sunucu hatası: ' + err.message } });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log('Loba Fatura Okuyucu çalışıyor: port ' + PORT));
