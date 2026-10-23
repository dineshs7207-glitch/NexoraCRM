import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';

const app = Fastify({ logger: true });
await app.register(helmet);
await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
app.get('/health', async () => ({ status: 'ok' }));

const port = Number(process.env.PORT ?? 4000);
await app.listen({ port, host: '0.0.0.0' });
