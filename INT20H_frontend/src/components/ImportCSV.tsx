import { useState, useRef } from "react";
import { importOrders, ImportResult } from "../api";

interface Props {
  onSuccess: () => void;
}

export default function ImportCSV({ onSuccess }: Props) {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setError("Please select a CSV file"); return; }
    setError(""); setResult(null); setLoading(true);
    try {
      const res = await importOrders(file);
      setResult(res);
      if (res.success > 0) onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.card}>
      <h3 style={styles.title}>📂 Import CSV</h3>
      <p style={styles.hint}>Expected columns: <code>id, longitude, latitude, timestamp, subtotal</code></p>
      <div style={styles.row}>
        <input ref={fileRef} type="file" accept=".csv" style={styles.fileInput} />
        <button onClick={handleImport} disabled={loading} style={styles.btn}>
          {loading ? "Importing..." : "Import"}
        </button>
      </div>
      {error && <p style={{ color: "red", marginTop: 8 }}>{error}</p>}
      {result && (
        <div style={styles.result}>
          <span style={{ color: "#16a34a" }}>✅ {result.success} imported</span>
          {result.failed > 0 && <span style={{ color: "red", marginLeft: 16 }}>❌ {result.failed} failed</span>}
          {result.errors.length > 0 && (
            <ul style={{ marginTop: 8, fontSize: 13, color: "#666" }}>
              {result.errors.map((e, i) => (
                <li key={i}>Row {e.original_id}: {e.error}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: { background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.08)", marginBottom: 24 },
  title: { margin: "0 0 8px", color: "#1a1a2e" },
  hint: { margin: "0 0 16px", color: "#666", fontSize: 14 },
  row: { display: "flex", gap: 12, alignItems: "center" },
  fileInput: { flex: 1, padding: "8px", border: "1px solid #ddd", borderRadius: 8 },
  btn: { padding: "10px 20px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap" },
  result: { marginTop: 12, padding: 12, background: "#f9fafb", borderRadius: 8 },
};