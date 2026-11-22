// One-off: turns the old SQLite data (one owner) into SQL for Supabase.
// Run on the server:  sudo -u gullak node export-sqlite.cjs /var/lib/gullak/gullak.db > gullak-export.sql
// The output uses the placeholder __UID__ for the new Supabase user id.
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync(process.argv[2], { readOnly: true });
const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const UID = "'__UID__'";
const out = ['begin;'];

const users = db.prepare('select id from users').all();
if (users.length !== 1) throw new Error(`expected exactly one user, found ${users.length}`);
const old = users[0].id;

const key = db.prepare('select key_hash, key_hint, created_at, last_used_at from capture_keys where user_id = ?').get(old);
if (key) {
  out.push(
    `insert into public.capture_keys (user_id, key_hash, key_hint, created_at, last_used_at) values (${UID}, ${q(key.key_hash)}, ${q(key.key_hint)}, ${q(key.created_at)}, ${q(key.last_used_at)}) on conflict (user_id) do update set key_hash = excluded.key_hash, key_hint = excluded.key_hint, created_at = excluded.created_at, last_used_at = excluded.last_used_at;`,
  );
}

for (const s of db.prepare('select id, body, received_at, status, reason, created_at from sms_inbox where user_id = ?').all(old)) {
  out.push(
    `insert into public.sms_inbox (id, user_id, body, received_at, status, reason, created_at) values (${q(s.id)}, ${UID}, ${q(s.body)}, ${q(s.received_at)}, ${q(s.status)}, ${q(s.reason)}, ${q(s.created_at)}) on conflict (id) do nothing;`,
  );
}

const cols = 'id, sms_id, occurred_at, amount_paise, direction, payee, payee_key, merchant, vpa, category, category_source, bank, account, upi_ref, channel, source, note, hidden, dedupe_key, created_at';
for (const t of db.prepare(`select ${cols} from transactions where user_id = ?`).all(old)) {
  out.push(
    `insert into public.transactions (id, user_id, sms_id, occurred_at, amount, direction, payee, payee_key, merchant, vpa, category, category_source, bank, account, upi_ref, channel, source, note, hidden, dedupe_key, created_at) values (${[
      q(t.id),
      UID,
      q(t.sms_id),
      q(t.occurred_at),
      (Number(t.amount_paise) / 100).toFixed(2),
      q(t.direction),
      q(t.payee),
      q(t.payee_key),
      q(t.merchant),
      q(t.vpa),
      q(t.category),
      q(t.category_source),
      q(t.bank),
      q(t.account),
      q(t.upi_ref),
      q(t.channel),
      q(t.source),
      q(t.note),
      t.hidden ? 'true' : 'false',
      q(t.dedupe_key),
      q(t.created_at),
    ].join(', ')}) on conflict (user_id, dedupe_key) do nothing;`,
  );
}

for (const r of db.prepare('select payee_key, category, updated_at from payee_rules where user_id = ?').all(old)) {
  out.push(
    `insert into public.payee_rules (user_id, payee_key, category, updated_at) values (${UID}, ${q(r.payee_key)}, ${q(r.category)}, ${q(r.updated_at)}) on conflict (user_id, payee_key) do update set category = excluded.category;`,
  );
}

out.push('commit;');
process.stdout.write(out.join('\n') + '\n');
const count = (t) => db.prepare(`select count(*) n from ${t} where user_id = ?`).get(old).n;
console.error(`sms ${count('sms_inbox')}, transactions ${count('transactions')}, rules ${count('payee_rules')}, key ${key ? 'yes' : 'no'}`);
