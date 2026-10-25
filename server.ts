import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isDev = process.env.NODE_ENV !== 'production';

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // API Route: Google Sheets CSV Proxy (bypasses browser CORS restrictions)
  app.get('/api/sheets/fetch', async (req: Request, res: Response) => {
    try {
      const sheetUrl = (req.query.url as string) || '';
      if (!sheetUrl) {
        return res.status(400).json({ ok: false, error: 'Google E-Tablo URL parametresi eksik.' });
      }

      // Extract Sheet ID
      const idMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      const sheetId = idMatch ? idMatch[1] : null;

      if (!sheetId) {
        return res.status(400).json({ ok: false, error: 'Geçersiz Google E-Tablo bağlantısı. Link "/spreadsheets/d/..." formatında olmalıdır.' });
      }

      // Extract GID (tab id)
      const gidMatch = sheetUrl.match(/[#&?]gid=([0-9]+)/);
      const gid = gidMatch ? gidMatch[1] : '0';

      // Build CSV export URL
      const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
      
      const response = await fetch(exportUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/csv,text/plain,*/*'
        },
        redirect: 'follow',
      });

      if (!response.ok) {
        return res.status(response.status).json({
          ok: false,
          error: `Google E-Tabloya erişilemedi (${response.status}). Lütfen tablonun paylaşım ayarını 'Bağlantıya sahip olan herkes görüntüleyebilir' olarak ayarlayın.`
        });
      }

      const csvText = await response.text();
      return res.json({ ok: true, csv: csvText, bytes: csvText.length });
    } catch (error: any) {
      console.error('Sheets proxy error:', error);
      return res.status(500).json({ ok: false, error: error.message || 'E-Tablo verisi çekilirken sunucu hatası oluştu.' });
    }
  });

  // API Route: Optional Google Apps Script Webhook append proxy
  app.post('/api/sheets/append', async (req: Request, res: Response) => {
    try {
      const { webhookUrl, rowData } = req.body;
      if (!webhookUrl || !rowData) {
        return res.status(400).json({ ok: false, error: 'webhookUrl ve rowData parametreleri gereklidir.' });
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rowData),
        redirect: 'follow'
      });

      const responseText = await response.text();
      return res.json({ ok: response.ok, response: responseText });
    } catch (error: any) {
      console.error('Webhook append error:', error);
      return res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT} in ${isDev ? 'development' : 'production'} mode`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
