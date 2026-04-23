import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import router from './api/index';
import { startScheduler } from './scheduler/index';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const app = express();
app.use(helmet());
app.use(express.json());
app.use(router);

const server = app.listen(PORT, () => {
  console.log(`[server] Listening on http://localhost:${PORT}`);
  console.log(`[server] Visit http://localhost:${PORT}/auth/hubspot to connect HubSpot`);
});

// Start cron scheduler only in non-test environments
if (process.env.NODE_ENV !== 'test') {
  startScheduler();
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[server] SIGTERM received, shutting down...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('[server] SIGINT received, shutting down...');
  server.close(() => process.exit(0));
});

export { app };
