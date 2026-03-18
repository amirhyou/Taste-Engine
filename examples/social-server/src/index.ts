import { serve } from '@hono/node-server';
import app from './api/routes';

const port = process.env.PORT ? Number(process.env.PORT) : 3000;

serve({ fetch: app.fetch, port });

console.log(`social-server listening on ${port}`);
