// Cloudflare Pages Function: the shared database for the house booking page.
// Routes (all under /api):
//   GET    /api/data           -> { houses:{id:doc}, trips:{id:doc}, bookings:{id:doc} }
//   PUT    /api/<coll>/<id>    -> create or replace one document (JSON body)
//   DELETE /api/<coll>/<id>    -> remove one document
// Storage is a D1 database bound to this project as DB. The table is created
// automatically on the first request, so there is no schema to run by hand.

const COLLECTIONS = new Set(['houses', 'trips', 'bookings']);
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_BODY_BYTES = 200 * 1024;

let tableReady = null;
function ensureTable(db) {
  if (!tableReady) {
    tableReady = db
      .prepare('CREATE TABLE IF NOT EXISTS docs (coll TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (coll, id))')
      .run()
      .catch((err) => { tableReady = null; throw err; });
  }
  return tableReady;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function onRequest({ request, env, params }) {
  if (!env.DB) {
    return json({ error: 'No D1 database is bound to this project. Add a binding named DB in the Pages project settings.' }, 500);
  }
  const parts = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const method = request.method;

  try {
    await ensureTable(env.DB);

    // Read everything.
    if (method === 'GET' && parts.length === 1 && parts[0] === 'data') {
      const { results } = await env.DB.prepare('SELECT coll, id, data FROM docs').all();
      const out = { houses: {}, trips: {}, bookings: {} };
      for (const row of results) {
        if (!out[row.coll]) continue;
        try { out[row.coll][row.id] = JSON.parse(row.data); } catch (e) { /* skip a corrupt row */ }
      }
      return json(out);
    }

    // Write or delete one document.
    if (parts.length === 2 && (method === 'PUT' || method === 'DELETE')) {
      const [coll, id] = parts;
      if (!COLLECTIONS.has(coll) || !ID_PATTERN.test(id)) return json({ error: 'Unknown collection or invalid id.' }, 400);

      if (method === 'DELETE') {
        await env.DB.prepare('DELETE FROM docs WHERE coll = ? AND id = ?').bind(coll, id).run();
        return json({ ok: true });
      }

      const text = await request.text();
      if (text.length > MAX_BODY_BYTES) return json({ error: 'Document is too large.' }, 413);
      let doc;
      try { doc = JSON.parse(text); } catch (e) { return json({ error: 'Body must be valid JSON.' }, 400); }
      if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return json({ error: 'Body must be a JSON object.' }, 400);
      if (doc.id !== id) return json({ error: 'Document id must match the URL.' }, 400);

      await env.DB
        .prepare('INSERT INTO docs (coll, id, data) VALUES (?, ?, ?) ON CONFLICT(coll, id) DO UPDATE SET data = excluded.data')
        .bind(coll, id, JSON.stringify(doc))
        .run();
      return json({ ok: true });
    }

    return json({ error: 'Not found.' }, 404);
  } catch (err) {
    return json({ error: 'Database error: ' + (err && err.message ? err.message : String(err)) }, 500);
  }
}
