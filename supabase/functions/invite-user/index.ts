// Invites a teammate: creates their account, gives them a profile with the chosen role and team,
// and emails them a link to choose a password. When the email can't be sent (Supabase's built-in
// mailer only reaches the project's own members), it returns the link for the admin to share instead.
import { withSupabase } from 'npm:@supabase/server@1.9.2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });

// Data scope each role starts with; matches ROLE_SCOPE in the web app.
const SCOPES: Record<string, 'all' | 'team' | 'own'> = { admin: 'all', manager: 'team', sales_rep: 'own', viewer: 'all' };

const handler = withSupabase({ auth: 'user' }, async (req, ctx) => {
  const admin = ctx.supabaseAdmin;
  const callerId = ctx.userClaims?.id;
  const { data: me } = await admin.from('profiles').select('role, active').eq('id', callerId).maybeSingle();
  if (!me?.active || !['owner', 'admin'].includes(me.role)) return json({ error: 'Only owners and admins can invite teammates.' }, 403);

  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? '').trim().toLowerCase();
  const role = String(body.role ?? '');
  const team = String(body.team ?? '').trim() || null;
  const redirectTo = typeof body.redirectTo === 'string' ? body.redirectTo : undefined;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Enter a valid email address.' }, 400);
  if (!Object.hasOwn(SCOPES, role)) return json({ error: 'Pick a role.' }, 400);

  const { data: existing } = await admin.from('profiles').select('id').eq('work_email', email).maybeSingle();
  if (existing) return json({ error: `${email} is already on the team.` }, 409);

  const fullName = email.split('@')[0];
  const meta = { full_name: fullName, team };
  let user;
  let link: string | null = null;
  const sent = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: meta });
  if (sent.data.user) user = sent.data.user;
  else {
    // No email went out. Make a link instead: an invite for a new account, or a sign-in link
    // for someone who already created an account on their own (for example with Google).
    let made = await admin.auth.admin.generateLink({ type: 'invite', email, options: { redirectTo, data: meta } });
    if (made.error) made = await admin.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo } });
    if (made.error) return json({ error: made.error.message }, 400);
    user = made.data.user;
    link = made.data.properties.action_link;
  }

  const { error } = await admin
    .from('profiles')
    .upsert({ id: user.id, full_name: fullName, work_email: email, role, team, scope: SCOPES[role], active: true });
  if (error) return json({ error: error.message }, 500);
  return json({ id: user.id, emailed: !link, link });
});

Deno.serve((req) => (req.method === 'OPTIONS' ? new Response('ok', { headers: cors }) : handler(req)));
