# legacy/server

The first Gullak backend (Node 24 + Hono + SQLite on EC2). Superseded by Supabase.

It stays only until the first user's data has been copied into Supabase
(`infra/export-sqlite.cjs`) and `/ingest` is switched over (`infra/deploy.ps1 -Ingest supabase`).
Then delete this folder. Don't add features here.
