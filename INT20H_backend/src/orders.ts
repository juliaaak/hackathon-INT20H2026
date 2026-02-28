// Orders router: handles CSV import, manual creation, listing, and deletion
import { Router, Request, Response } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { runQuery, queryAll, queryOne, getMaxId } from "./db";
import { calculateTax, isInNewYork } from "./tax";
import { authMiddleware } from "./auth";

const router = Router();
// Accept files up to 10MB in memory
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Registry of active import sessions: sessionId → cancel function
const importSessions = new Map<string, () => void>();

router.use(authMiddleware);

// GET /orders — paginated list with optional filters: region (partial match), min_total, max_total
router.get("/", (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
  const offset = (page - 1) * limit;

  const filters: string[] = [];
  const params: any[] = [];

  // Case-insensitive partial match on tax_region.
  // e.g. "bronx" → "New York City (Bronx)"
  //      "york"  → all 5 NYC boroughs at once
  //      "county" → all county-level orders
  if (req.query.region) {
    filters.push("LOWER(tax_region) LIKE LOWER(?)");
    params.push(`%${String(req.query.region).trim()}%`);
  }
  if (req.query.min_total) {
    filters.push("total_amount >= ?");
    params.push(parseFloat(req.query.min_total as string));
  }
  if (req.query.max_total) {
    filters.push("total_amount <= ?");
    params.push(parseFloat(req.query.max_total as string));
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const total = (queryOne(`SELECT COUNT(*) as cnt FROM orders ${where}`, params) as any)?.cnt ?? 0;
  const orders = queryAll(`SELECT * FROM orders ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);

  const parsed = orders.map((o) => ({
    ...o,
    jurisdictions: safeParseJson(o.jurisdictions, []),
  }));

  res.json({ total, page, limit, pages: Math.ceil(total / limit), orders: parsed });
});

// POST /orders — manually create a single order, tax is calculated immediately
router.post("/", async (req: Request, res: Response) => {
  const { latitude, longitude, subtotal, timestamp } = req.body;
  if (latitude == null || longitude == null || subtotal == null) {
    res.status(400).json({ error: "Missing required fields: latitude, longitude, subtotal" }); return;
  }
  const lat = parseFloat(latitude), lon = parseFloat(longitude), sub = parseFloat(subtotal);
  if (isNaN(lat) || isNaN(lon) || isNaN(sub)) { res.status(400).json({ error: "Invalid numbers" }); return; }
  if (sub <= 0) { res.status(400).json({ error: "subtotal must be positive" }); return; }
  if (!isInNewYork(lat, lon)) { res.status(422).json({ error: "Coordinates outside New York State" }); return; }

  const tax = await calculateTax(sub, null, lat, lon);
  const ts = timestamp || new Date().toISOString();
  const newId = getMaxId() + 1;

  const id = runQuery(
    `INSERT INTO orders (id, latitude, longitude, subtotal, timestamp, zip_code, state, tax_region,
      county_fips, state_rate, county_rate, city_rate, special_rate, composite_tax_rate,
      tax_amount, total_amount, jurisdictions, import_session_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [newId, lat, lon, sub, ts, tax.zip_code, tax.state, tax.tax_region,
     tax.county_fips,
     tax.state_rate, tax.county_rate, tax.city_rate, tax.special_rate,
     tax.composite_tax_rate, tax.tax_amount, tax.total_amount,
     JSON.stringify(tax.jurisdictions), null]
  );

  const order = queryOne("SELECT * FROM orders WHERE id = ?", [id]);
  res.status(201).json({
    ...order,
    jurisdictions: safeParseJson(order?.jurisdictions, []),
  });
});

// POST /orders/import/stream — same as /import but streams progress via SSE
// Each processed row emits: data: {"type":"progress","processed":N}
// Final event emits:        data: {"type":"done","success":N,"failed":N,"errors":[...]}
router.post("/import/stream", upload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }

  let rows: any[];
  try {
    rows = parse(req.file.buffer.toString("utf-8"), { columns: true, skip_empty_lines: true, trim: true });
  } catch (e: any) {
    res.status(400).json({ error: "Invalid CSV: " + e.message }); return;
  }

  // Set SSE headers — keep connection open for streaming
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const success: any[] = [], failed: any[] = [];
  let processed = 0;
  let cancelRequested = false;
  const BATCH_SIZE = 5;

  // Generate unique session ID for this import
  const sessionId = `${Date.now()}-${Math.random()}`;

  // Register cancel function so POST /orders/import/cancel can trigger it
  importSessions.set(sessionId, () => { cancelRequested = true; });
  send({ type: "session", sessionId });

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    if (cancelRequested) break;

    const batch = rows.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (row) => {
        const lat = parseFloat(row.latitude), lon = parseFloat(row.longitude), sub = parseFloat(row.subtotal);
        if (isNaN(lat) || isNaN(lon) || isNaN(sub)) throw new Error("Invalid numbers");
        if (sub <= 0) throw new Error("subtotal must be positive");
        if (!isInNewYork(lat, lon)) throw new Error("Coordinates outside New York State");

        const tax = await calculateTax(sub, null, lat, lon);
        const ts = row.timestamp || new Date().toISOString();
        const csvId = parseInt(row.id);

        return { row, csvId, lat, lon, ts, tax };
      })
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const row = batch[j];

      if (result.status === "rejected") {
        failed.push({ original_id: row.id, error: result.reason?.message ?? String(result.reason) });
      } else {
        const { csvId, lat, lon, ts, tax } = result.value;
        
        // Check if order already exists
        const existing = queryOne("SELECT id FROM orders WHERE id = ?", [csvId]);
        
        if (existing) {
          // Update existing order, preserving its original import_session_id
          runQuery(
            `UPDATE orders SET latitude = ?, longitude = ?, subtotal = ?, timestamp = ?, zip_code = ?, state = ?,
              tax_region = ?, county_fips = ?, state_rate = ?, county_rate = ?, city_rate = ?, special_rate = ?,
              composite_tax_rate = ?, tax_amount = ?, total_amount = ?, jurisdictions = ?
             WHERE id = ?`,
            [lat, lon, parseFloat(row.subtotal), ts, tax.zip_code, tax.state, tax.tax_region,
             tax.county_fips, tax.state_rate, tax.county_rate, tax.city_rate, tax.special_rate,
             tax.composite_tax_rate, tax.tax_amount, tax.total_amount, JSON.stringify(tax.jurisdictions), csvId]
          );
        } else {
          // Insert new order with session ID
          runQuery(
            `INSERT INTO orders (id, latitude, longitude, subtotal, timestamp, zip_code, state,
              tax_region, county_fips, state_rate, county_rate, city_rate, special_rate,
              composite_tax_rate, tax_amount, total_amount, jurisdictions, import_session_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [csvId, lat, lon, parseFloat(row.subtotal), ts, tax.zip_code, tax.state, tax.tax_region,
             tax.county_fips, tax.state_rate, tax.county_rate, tax.city_rate, tax.special_rate,
             tax.composite_tax_rate, tax.tax_amount, tax.total_amount, JSON.stringify(tax.jurisdictions), sessionId]
          );
        }
        
        success.push({ id: csvId, original_id: row.id });
      }

      processed++;
      const importedId = result.status === "fulfilled" ? result.value.csvId : null;
      send({ type: "progress", processed, id: importedId });
    }
  }

  if (cancelRequested) {
    // Rollback: delete ONLY orders with this session ID (newly inserted ones)
    const rolledBack = queryOne(
      `SELECT COUNT(*) as cnt FROM orders WHERE import_session_id = ?`,
      [sessionId]
    ) as any;
    const count = rolledBack?.cnt ?? 0;
    
    runQuery(`DELETE FROM orders WHERE import_session_id = ?`, [sessionId]);
    send({ type: "cancelled", rolledBack: count });
  } else {
    send({ type: "done", success: success.length, failed: failed.length, errors: failed.slice(0, 20) });
  }
  importSessions.delete(sessionId);
  res.end();
});

// POST /orders/import — bulk import from CSV file, preserves original IDs
router.post("/import", upload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }

  let rows: any[];
  try {
    rows = parse(req.file.buffer.toString("utf-8"), { columns: true, skip_empty_lines: true, trim: true });
  } catch (e: any) {
    res.status(400).json({ error: "Invalid CSV: " + e.message }); return;
  }

  const success: any[] = [], failed: any[] = [];

  // Process rows in parallel batches — Census Geocoder calls are I/O-bound,
  // so concurrent requests cut total import time significantly.
  // Batch size of 5 is a safe balance between speed and API rate limits.
  const BATCH_SIZE = 5;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (row) => {
        const lat = parseFloat(row.latitude), lon = parseFloat(row.longitude), sub = parseFloat(row.subtotal);
        if (isNaN(lat) || isNaN(lon) || isNaN(sub)) throw new Error("Invalid numbers");
        if (sub <= 0) throw new Error("subtotal must be positive");
        if (!isInNewYork(lat, lon)) throw new Error("Coordinates outside New York State");

        const tax = await calculateTax(sub, null, lat, lon);
        const ts = row.timestamp || new Date().toISOString();
        const csvId = parseInt(row.id);

        return { row, csvId, lat, lon, ts, tax };
      })
    );

    // Write results to DB sequentially (sql.js is single-threaded)
    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const row = batch[j];

      if (result.status === "rejected") {
        failed.push({ original_id: row.id, error: result.reason?.message ?? String(result.reason) });
        continue;
      }

      const { csvId, lat, lon, ts, tax } = result.value;
      
      // Check if order already exists
      const existing = queryOne("SELECT id FROM orders WHERE id = ?", [csvId]);
      
      if (existing) {
        // Update existing order
        runQuery(
          `UPDATE orders SET latitude = ?, longitude = ?, subtotal = ?, timestamp = ?, zip_code = ?, state = ?,
            tax_region = ?, county_fips = ?, state_rate = ?, county_rate = ?, city_rate = ?, special_rate = ?,
            composite_tax_rate = ?, tax_amount = ?, total_amount = ?, jurisdictions = ?
           WHERE id = ?`,
          [lat, lon, parseFloat(row.subtotal), ts, tax.zip_code, tax.state, tax.tax_region,
           tax.county_fips, tax.state_rate, tax.county_rate, tax.city_rate, tax.special_rate,
           tax.composite_tax_rate, tax.tax_amount, tax.total_amount, JSON.stringify(tax.jurisdictions), csvId]
        );
      } else {
        // Insert new order without session ID (for non-streaming import)
        runQuery(
          `INSERT INTO orders (id, latitude, longitude, subtotal, timestamp, zip_code, state,
            tax_region, county_fips, state_rate, county_rate, city_rate, special_rate,
            composite_tax_rate, tax_amount, total_amount, jurisdictions, import_session_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [csvId, lat, lon, parseFloat(row.subtotal), ts, tax.zip_code, tax.state, tax.tax_region,
           tax.county_fips, tax.state_rate, tax.county_rate, tax.city_rate, tax.special_rate,
           tax.composite_tax_rate, tax.tax_amount, tax.total_amount, JSON.stringify(tax.jurisdictions), null]
        );
      }
      
      success.push({ id: csvId, original_id: row.id });
    }
  }

  res.json({ success: success.length, failed: failed.length, errors: failed.slice(0, 20) });
});

// POST /orders/import/cancel — signal an active import session to stop
router.post("/import/cancel", (req: Request, res: Response) => {
  const { sessionId } = req.body;
  const cancel = importSessions.get(sessionId);
  if (!cancel) { res.status(404).json({ error: "Session not found or already finished" }); return; }
  cancel();
  res.json({ ok: true });
});

// POST /orders/rollback — delete specific order IDs (used when import is cancelled)
router.post("/rollback", (req: Request, res: Response) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "ids must be a non-empty array" }); return;
  }
  const placeholders = ids.map(() => "?").join(", ");
  runQuery(`DELETE FROM orders WHERE id IN (${placeholders})`, ids);
  res.json({ ok: true, deleted: ids.length });
});

// DELETE /orders — clear all orders from the database
router.delete("/", (req: Request, res: Response) => {
  runQuery("DELETE FROM orders", []);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeParseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value !== "string") return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

export default router;