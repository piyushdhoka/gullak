// GET /functions/v1/config: public settings the app needs before/after sign-in.
// { vapidPublicKey, shortcutUrl }. Deployed with JWT verification off (nothing private here).

import { CORS, json, vapidKeys } from '../_shared/server.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const { publicKey } = await vapidKeys();
  const shortcut = Deno.env.get('SHORTCUT_URL') ?? '';
  return json(200, {
    vapidPublicKey: publicKey,
    shortcutUrl: shortcut.startsWith('https://www.icloud.com/shortcuts/') ? shortcut : null,
  });
});
