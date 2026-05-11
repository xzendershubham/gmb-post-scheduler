import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
// Load environment variables (handled by top-level import)

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

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
});
