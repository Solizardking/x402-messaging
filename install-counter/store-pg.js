import pg from 'pg';
export async function createPgStore(connectionString) {
  const pool = new pg.Pool({ connectionString, max: 3, ssl: /render\.com/.test(connectionString) ? { rejectUnauthorized: false } : undefined });
  await pool.query(`CREATE TABLE IF NOT EXISTS installs (install_id uuid PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now())`);
  return {
    async add(id) { const r = await pool.query('INSERT INTO installs(install_id) VALUES ($1) ON CONFLICT DO NOTHING', [id]); return { created: r.rowCount === 1 }; },
    async remove(id) { const r = await pool.query('DELETE FROM installs WHERE install_id=$1', [id]); return r.rowCount === 1; },
    async stats() {
      const t = await pool.query(`SELECT count(*)::int total, count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int last24h FROM installs`);
      const d = await pool.query(`SELECT to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD') d, count(*)::int n FROM installs GROUP BY 1 ORDER BY 1`);
      return { total: t.rows[0].total, last24h: t.rows[0].last24h, byDay: Object.fromEntries(d.rows.map((r) => [r.d, r.n])) };
    },
  };
}
