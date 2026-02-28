import { useState, useEffect, useRef } from "react";
import { createOrder, Order } from "../api";

interface Props {
  onSuccess: () => void;
}

export default function CreateOrder({ onSuccess }: Props) {
  const [form, setForm] = useState({ latitude: "", longitude: "", subtotal: "" });
  const [result, setResult] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  // Auto-clear result after 6 seconds
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => setResult(null), 6000);
    // Scroll result into view
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return () => clearTimeout(t);
  }, [result]);

  // Auto-clear error after 5 seconds
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(""), 5000);
    return () => clearTimeout(t);
  }, [error]);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setError("");
    // Don't clear result here — let the user see it while editing next order
  }

  async function handleCreate() {
    const lat = parseFloat(form.latitude);
    const lon = parseFloat(form.longitude);
    const sub = parseFloat(form.subtotal);
    if (isNaN(lat) || isNaN(lon) || isNaN(sub)) {
      setError("All fields are required and must be numbers"); return;
    }
    setLoading(true); setError(""); setResult(null);
    try {
      const order = await createOrder({ latitude: lat, longitude: lon, subtotal: sub });
      setForm({ latitude: "", longitude: "", subtotal: "" });
      setResult(order);
      // Delay table refresh so this component's state isn't wiped by parent re-render
      setTimeout(() => onSuccess(), 100);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.card}>
      <h3 style={styles.title}>➕ Create Order Manually</h3>
      <div style={styles.grid}>
        <label style={styles.label}>
          Latitude
          <input style={styles.input} type="number" step="any" placeholder="40.7128" value={form.latitude} onChange={(e) => set("latitude", e.target.value)} />
        </label>
        <label style={styles.label}>
          Longitude
          <input style={styles.input} type="number" step="any" placeholder="-74.0060" value={form.longitude} onChange={(e) => set("longitude", e.target.value)} />
        </label>
        <label style={styles.label}>
          Subtotal ($)
          <input style={styles.input} type="number" step="0.01" min="0.01" placeholder="120.00" value={form.subtotal} onChange={(e) => set("subtotal", e.target.value)} />
        </label>
      </div>

      {error && <p style={{ color: "#dc2626", marginTop: 8, fontWeight: 500 }}>{error}</p>}

      <button onClick={handleCreate} disabled={loading} style={loading ? { ...styles.btn, opacity: 0.7 } : styles.btn}>
        {loading ? "⏳ Creating..." : "Create Order"}
      </button>

      {result && (
        <div ref={resultRef} style={styles.result}>
          <div style={styles.resultHeader}>✅ Order created</div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: { background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.08)", marginBottom: 24 },
  title: { margin: "0 0 16px", color: "#1a1a2e" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 },
  label: { display: "flex", flexDirection: "column", gap: 4, fontSize: 14, fontWeight: 500, color: "#374151" },
  input: { padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, color: "#111" },
  btn: { marginTop: 16, padding: "10px 24px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 15, fontWeight: 500 },
  result: { marginTop: 16, padding: 16, background: "#f0fdf4", borderRadius: 10, border: "2px solid #86efac" },
  resultHeader: { fontSize: 16, fontWeight: 700, color: "#15803d" },
};