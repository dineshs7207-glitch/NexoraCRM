import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import type { Profile } from '@nexora/shared';
import { requireUser } from './supabase.js';

const origins = (process.env.WEB_ORIGINS ?? 'http://localhost:5173').split(',').map((o) => o.trim());

const app = Fastify({ logger: true });
await app.register(helmet);
await app.register(cors, { origin: origins, allowedHeaders: ['authorization', 'content-type'] });
await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
app.get('/health', async () => ({ status: 'ok' }));

// The caller's own profile, read through their RLS-scoped client.
app.get('/me', { preHandler: requireUser }, async (request, reply) => {
  const { data, error } = await request.supabase
    .from('profiles')
    .select('id, full_name, work_email, role, team, manager_id, scope, active')
    .eq('id', request.user.id)
    .maybeSingle<Profile>();
  if (error) return reply.code(500).send({ message: error.message });
  if (!data?.active) return reply.code(403).send({ message: 'No active profile for this account' });
  return data;
});

const port = Number(process.env.PORT ?? 4000);
await app.listen({ port, host: '0.0.0.0' });
