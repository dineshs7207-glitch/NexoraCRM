import type { FastifyReply, FastifyRequest } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fromSupabaseUrl } from '@supabase/server';
import { createContextClient, verifyCredentials } from '@supabase/server/core';

const projectUrl = process.env.SUPABASE_URL;
if (!projectUrl) throw new Error('SUPABASE_URL is required by the API');
const issuer = fromSupabaseUrl(projectUrl);

export interface AuthUser {
  id: string;
  email?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Supabase client acting as the caller, so row level security applies. */
    supabase: SupabaseClient;
    user: AuthUser;
  }
}

function bearer(header: string | undefined) {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/** preHandler for routes that need a signed-in user. Verifies the Supabase JWT against the project's JWKS. */
export async function requireUser(request: FastifyRequest, reply: FastifyReply) {
  const { data: auth, error } = await verifyCredentials(
    { token: bearer(request.headers.authorization), apikey: null },
    { auth: 'user', issuer, audience: 'authenticated' },
  );
  if (error || !auth?.userClaims || !auth.token) {
    return reply.code(error?.status ?? 401).send({ message: error?.message ?? 'Sign in required' });
  }
  request.user = { id: auth.userClaims.id, email: auth.userClaims.email };
  request.supabase = createContextClient({ auth: { token: auth.token, keyName: auth.keyName } });
}
