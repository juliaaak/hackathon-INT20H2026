// Orders router: handles CSV import, manual creation, listing, and deletion
import { Router, Request, Response } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { runQuery, queryAll, queryOne, getMaxId } from "./db";
import { calculateTax, coordsToZip, isInNewYork } from "./tax";
import { authMiddleware } from "./auth";

const router = Router();
// Accept files up to 10MB in memory
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authMiddleware);

// GET /orders — paginated list with optional filters: state, min_total, max_total
router.get("/", (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
  const offset = (page - 1) * limit;

  const filters: string[] = [];
  const params: any[] = [];

  if (req.query.state) {
    const s = String(req.query.state).toUpperCase();
    filters.push("state = ?");
    params.push(s === "NEW YORK" ? "NY" : s);
  }
  if (req.query.min_total) { filters.push("total_amount >= ?"); params.push(parseFloat(req.query.min_total as string)); }
  if (req.query.max_total) { filters.push("total_amount <= ?"); params.push(parseFloat(req.query.max_total as string)); }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const total = (queryOne(`SELECT COUNT(*) as cnt FROM orders ${where}`, params) as any)?.cnt ?? 0;
  const orders = queryAll(`SELECT * FROM orders ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);

  res.json({ total, page, limit, pages: Math.ceil(total / limit), orders });
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
  // Reject orders outside NY — our license only covers New York State
  if (!isInNewYork(lat, lon)) { res.status(422).json({ error: "Coordinates outside New York State" }); return; }

  const zip = await coordsToZip(lat, lon);
  const tax = calculateTax(sub, zip, lat, lon);
  const ts = timestamp || new Date().toISOString();
  const newId = getMaxId() + 1;

  const id = runQuery(
    `INSERT INTO orders (id, latitude, longitude, subtotal, timestamp, zip_code, state, tax_region,
      state_rate, county_rate, city_rate, special_rate, composite_tax_rate, tax_amount, total_amount)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [newId, lat, lon, sub, ts, tax.zip_code, tax.state, tax.tax_region,
     tax.state_rate, tax.county_rate, tax.city_rate, tax.special_rate,
     tax.composite_tax_rate, tax.tax_amount, tax.total_amount]
  );

  res.status(201).json(queryOne("SELECT * FROM orders WHERE id = ?", [id]));
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

  for (const row of rows) {
    try {
      const lat = parseFloat(row.latitude), lon = parseFloat(row.longitude), sub = parseFloat(row.subtotal);
      if (isNaN(lat) || isNaN(lon) || isNaN(sub)) throw new Error("Invalid numbers");
      if (sub <= 0) throw new Error("subtotal must be positive");
      if (!isInNewYork(lat, lon)) throw new Error("Coordinates outside New York State");

      const zip = await coordsToZip(lat, lon);
      const tax = calculateTax(sub, zip, lat, lon);
      const ts = row.timestamp || new Date().toISOString();
      const csvId = parseInt(row.id);

      // INSERT OR REPLACE preserves original CSV id and handles re-imports
      const id = runQuery(
        `INSERT OR REPLACE INTO orders (id, latitude, longitude, subtotal, timestamp, zip_code, state, tax_region,
          state_rate, county_rate, city_rate, special_rate, composite_tax_rate, tax_amount, total_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [csvId, lat, lon, sub, ts, tax.zip_code, tax.state, tax.tax_region,
         tax.state_rate, tax.county_rate, tax.city_rate, tax.special_rate,
         tax.composite_tax_rate, tax.tax_amount, tax.total_amount]
      );
      success.push({ id, original_id: row.id });
    } catch (e: any) {
      failed.push({ original_id: row.id, error: e.message });
    }
  }

  res.json({ success: success.length, failed: failed.length, errors: failed.slice(0, 20) });
});

// DELETE /orders — clear all orders from the database
router.delete("/", (req: Request, res: Response) => {
  runQuery("DELETE FROM orders", []);
  res.json({ ok: true });
});

export default router;