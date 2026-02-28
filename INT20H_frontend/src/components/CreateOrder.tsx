import { useState } from "react";
import { createOrder, Order } from "../api";

interface Props {
  onSuccess: () => void;
}

export default function CreateOrder({ onSuccess }: Props) {
  const [form, setForm] = useState({ latitude: "", longitude: "", subtotal: "" });
  const [result, setResult] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setError(""); setResult(null);
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
      setResult(order);
      setForm({ latitude: "", longitude: "", subtotal: "" });
      onSuccess();
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
      {error && <p style={{ color: "red", marginTop: 8 }}>{error}</p>}
      <button onClick={handleCreate} disabled={loading} style={styles.btn}>
        {loading ? "Creating..." : "Create Order"}
      </button>
      {result && (
        <div style={styles.result}>
          <strong>✅ Order #{result.id} created</strong>
          <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 14 }}>
            <span>ZIP: {result.zip_code ?? "N/A"}</span>
            <span>Region: {result.tax_region}</span>
            <span>Tax rate: {(result.composite_tax_rate * 100).toFixed(3)}%</span>
            <span>Tax: ${result.tax_amount.toFixed(2)}</span>
            <span>Subtotal: ${result.subtotal.toFixed(2)}</span>
            <span><strong>Total: ${result.total_amount.toFixed(2)}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: { background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.08)", marginBottom: 24 },
  title: { margin: "0 0 16px", color: "#1a1a2e" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 },
  label: { display: "flex", flexDirection: "column", gap: 4, fontSize: 14, fontWeight: 500 },
  input: { padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14 },
  btn: { marginTop: 16, padding: "10px 24px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" },
  result: { marginTop: 12, padding: 12, background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0" },
};