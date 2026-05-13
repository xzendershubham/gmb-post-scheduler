import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
// Load environment variables (handled by top-level import)

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Import API handlers
import gmbAuth from './api/gmb-auth';
import gmbCallback from './api/gmb-callback';
import gmbLocations from './api/gmb-locations';
import publishPosts from './api/publish-posts';

// Map API routes
app.all('/api/gmb-auth', (req, res) => gmbAuth(req as any, res as any));
app.all('/api/gmb-callback', (req, res) => gmbCallback(req as any, res as any));
app.all('/api/gmb-locations', (req, res) => gmbLocations(req as any, res as any));
app.all('/api/publish-posts', (req, res) => publishPosts(req as any, res as any));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API server is running' });
});

app.listen(port, () => {
  console.log(`API server listening at http://localhost:${port}`);
  
  // Local Cron: Run publishPosts every 10 minutes
  const CRON_INTERVAL = 10 * 60 * 1000;
  console.log(`Local sync cron initialized. Interval: ${CRON_INTERVAL / 60000} minutes.`);
  
  setInterval(async () => {
    console.log('Running local sync cron...');
    try {
      // Mock request/response for the handler
      const mockReq = { 
        headers: { 'x-cron-secret': process.env.CRON_SECRET },
        query: {} 
      };
      const mockRes = {
        status: (code: number) => ({ json: (o: any) => console.log(`Cron Status ${code}:`, o) }),
        json: (o: any) => console.log('Cron Result:', o)
      };
      await publishPosts(mockReq as any, mockRes as any);
    } catch (err) {
      console.error('Local cron failed:', err);
    }
  }, CRON_INTERVAL);
});
