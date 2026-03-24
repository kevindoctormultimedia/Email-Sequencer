import { createClient, Client } from '@libsql/client';

let client: Client | null = null;

export function getClient(): Client {
  if (!client) {
    if (process.env.TURSO_DATABASE_URL) {
      client = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
      });
    } else {
      client = createClient({
        url: 'file:./data/email-sequencer.db',
      });
    }
  }
  return client;
}

export async function initDb() {
  const c = getClient();
  await c.executeMultiple(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sequences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      website_maker_pattern TEXT,
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      domain TEXT,
      first_name TEXT DEFAULT '',
      last_name TEXT DEFAULT '',
      company TEXT DEFAULT '',
      website_maker TEXT,
      website_maker_confidence REAL DEFAULT 0,
      sequence_id INTEGER REFERENCES sequences(id) ON DELETE SET NULL,
      current_step INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','paused','completed','needs_review')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sequence_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sequence_id INTEGER NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
      step_order INTEGER NOT NULL,
      subject TEXT NOT NULL,
      body_html TEXT NOT NULL,
      delay_days INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ab_tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sequence_step_id INTEGER NOT NULL REFERENCES sequence_steps(id) ON DELETE CASCADE,
      variant_name TEXT NOT NULL,
      subject TEXT NOT NULL,
      body_html TEXT NOT NULL,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','winner','loser')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ab_test_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ab_test_id INTEGER NOT NULL REFERENCES ab_tests(id) ON DELETE CASCADE,
      contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      variant_name TEXT NOT NULL,
      sent_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sent_emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      sequence_step_id INTEGER REFERENCES sequence_steps(id) ON DELETE SET NULL,
      ab_variant_name TEXT,
      message_id TEXT,
      tracking_id TEXT UNIQUE,
      sent_at TEXT DEFAULT (datetime('now')),
      opened_at TEXT,
      open_count INTEGER DEFAULT 0,
      replied_at TEXT,
      forwarded_at TEXT,
      open_ip TEXT,
      open_user_agent TEXT,
      status TEXT DEFAULT 'sent' CHECK(status IN ('sent','opened','replied','bounced'))
    );

    CREATE TABLE IF NOT EXISTS ml_insights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sequence_id INTEGER REFERENCES sequences(id) ON DELETE CASCADE,
      insight_type TEXT NOT NULL,
      insight_data TEXT NOT NULL,
      confidence REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
    CREATE INDEX IF NOT EXISTS idx_contacts_sequence ON contacts(sequence_id);
    CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
    CREATE INDEX IF NOT EXISTS idx_sent_emails_tracking ON sent_emails(tracking_id);
    CREATE INDEX IF NOT EXISTS idx_sent_emails_contact ON sent_emails(contact_id);
    CREATE INDEX IF NOT EXISTS idx_sequence_steps_sequence ON sequence_steps(sequence_id);
  `);
}

export async function dbRun(sql: string, params: unknown[] = []) {
  const c = getClient();
  return await c.execute({ sql, args: params as any });
}

export async function dbAll(sql: string, params: unknown[] = []) {
  const c = getClient();
  const result = await c.execute({ sql, args: params as any });
  return result.rows;
}

export async function dbGet(sql: string, params: unknown[] = []) {
  const c = getClient();
  const result = await c.execute({ sql, args: params as any });
  return result.rows[0] || null;
}

export async function dbExec(sql: string) {
  const c = getClient();
  return await c.executeMultiple(sql);
}
