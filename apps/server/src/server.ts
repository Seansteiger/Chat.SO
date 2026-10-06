import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/index.js';
import { apiRouter } from './routes/index.js';
import { initSocketGateway } from './sockets/socket.gateway.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../uploads');

const app = express();
const server = http.createServer(app);

// Cross-Origin Resource Sharing
app.use(
  cors({
    origin: [config.clientUrl, 'http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  })
);

// Standard JSON parser (strict 1MB limit for control payloads; file binaries never pass through)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static uploaded assets for local development
app.use('/uploads', express.static(uploadsDir));

// API Routes
app.use('/api', apiRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize Socket.IO signaling gateway
initSocketGateway(server);

// Start listening
server.listen(config.port, () => {
  console.log(`[Chat.SO Server] Running on http://localhost:${config.port}`);
  console.log(`[Chat.SO Server] Client origin configured for ${config.clientUrl}`);
});

export { app, server };
