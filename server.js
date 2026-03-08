const express = require('express');
const path    = require('path');
const fetch   = require('node-fetch');
const app     = express();
const PORT    = process.env.PORT || 3000;

// Büyük base64 görseller için limit artırıldı
app.use((req, res, next) => {
  express.json({ limit: '100mb' })(req, res, (err) => {
    if (err) return res.status(400).json({ error: { message: 'İstek çok büyük.' } });
    next();
  });
});

// Anthropic API proxy
app.post('/api/claude', async (req, res) => {
  console.log('>> /api/claude isteği geldi');

  // Timeout: 120 saniye
  req.setTimeout(120000);
  res.setTimeout(120000);

  try {
    const { body, isPdf } = req.body || {};
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) return res.status(401).json({ error: { message: 'ANTHROPIC_API_KEY tanımlı değil.' } });
    if (!body)   return res.status(400).json({ error: { message: 'body boş.' } });

    const headers = {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    };
    if (isPdf) headers['anthropic-beta'] = 'pdfs-2024-09-25';

    console.log('Anthropic isteği gönderiliyor...');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 110000);

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: headers,
      body:    JSON.stringify(body),
      signal:  controller.signal,
    });

    clearTimeout(timeout);

    const rawText = await upstream.text();
    console.log('Anthropic status:', upstream.status, '| Yanıt uzunluğu:', rawText.length);

    let data;
    try {
      data = JSON.parse(rawText);
    } catch(e) {
      console.error('JSON parse hatası. Ham yanıt:', rawText.slice(0, 500));
      return res.status(500).json({ error: { message: 'Anthropic geçersiz yanıt döndürdü: ' + rawText.slice(0, 200) } });
    }

    if (!upstream.ok) return res.status(upstream.status).json(data);
    res.json(data);

  } catch (err) {
    console.error('Proxy hatası:', err.message);
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: { message: 'Zaman aşımı — görsel çok büyük olabilir, daha küçük bir dosya deneyin.' } });
    }
    res.status(500).json({ error: { message: 'Sunucu hatası: ' + err.message } });
  }
});

// Statik dosyalar
app.use(express.static(path.join(__dirname)));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const server = app.listen(PORT, () => {
  console.log('✅ Loba Fatura çalışıyor: port ' + PORT);
  console.log('🔑 API Key:', process.env.ANTHROPIC_API_KEY ? 'TANIMLI ✓' : 'EKSİK ✗');
});

// Server timeout 2 dakika
server.timeout = 120000;
server.keepAliveTimeout = 120000;

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

    const rawText = await upstream.text();
    console.log('Anthropic ham yanıt (ilk 300):', rawText.slice(0, 300));

    let data;
    try {
      data = JSON.parse(rawText);
    } catch(e) {
      return res.status(500).json({ error: { message: 'Anthropic geçersiz yanıt: ' + rawText.slice(0,200) } });
    }

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
