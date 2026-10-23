import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

const projectUrl = process.env.SUPABASE_URL;
if (!projectUrl) throw new Error('SUPABASE_URL is required by the API');
const jwks = createRemoteJWKSet(new URL(`${projectUrl}/auth/v1/.well-known/jwks.json`));

export async function verifySupabaseToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, jwks, { issuer: `${projectUrl}/auth/v1`, audience: 'authenticated' });
  return payload;
}
