import { serve } from '@hono/node-server';
import app, { coordinator } from './api/routes';
import { startWorker } from './worker/bullmq';

const port = process.env.PORT ? Number(process.env.PORT) : 3000;

// Start optional in-process worker for development (can be run separately in prod)
startWorker();

// Schedule periodic snapshots
setInterval(() => {
	void coordinator.snapshotAll();
}, 60_000);

serve({ fetch: app.fetch, port });

console.log(`social-server listening on ${port}`);
