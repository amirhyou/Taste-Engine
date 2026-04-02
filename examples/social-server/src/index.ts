import { serve } from '@hono/node-server';
import app, { coordinator } from './api/routes';
import { startWorker } from './worker/bullmq';
import { logger } from './observability/logger';

const port = process.env.PORT ? Number(process.env.PORT) : 3000;

// Start optional in-process worker for development (can be run separately in prod)
startWorker();

// Schedule periodic snapshots
setInterval(() => {
	void coordinator.snapshotAll();
}, 60_000);

process.on('unhandledRejection', (reason) => {
	logger.error({ reason }, 'process.unhandledRejection');
});

process.on('uncaughtException', (err) => {
	logger.fatal({ err }, 'process.uncaughtException');
});

serve({ fetch: app.fetch, port });

logger.info({ port }, 'social-server.listening');
