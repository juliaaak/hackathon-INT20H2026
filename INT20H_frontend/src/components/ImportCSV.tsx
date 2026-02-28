import { useState, useRef, useEffect } from "react";
import { ImportResult } from "../api";

interface Props {
  onSuccess: () => void;
}

export default function ImportCSV({ onSuccess }: Props) {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [rolledBack, setRolledBack] = useState(0);
  const [error, setError] = useState("");
  const [rowCount, setRowCount] = useState<number | null>(null);
  const [processed, setProcessed] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!cancelled) return;
    const t = setTimeout(() => setCancelled(false), 5000);
    return () => clearTimeout(t);
  }, [cancelled]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(""), 5000);
    return () => clearTimeout(t);
  }, [error]);

  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => setResult(null), 5000);
    return () => clearTimeout(t);
  }, [result]);

  function handleFileChange() {
    setResult(null); setError(""); setRowCount(null);
    setProcessed(0); setCancelled(false);
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim().length > 0);
      setRowCount(Math.max(0, lines.length - 1));
    };
    reader.readAsText(file);
  }

  async function handleCancel() {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;

    const token = localStorage.getItem("token") || "";
    await fetch("/api/orders/import/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sessionId }),
    });
    // UI will update when backend sends "cancelled" event through the stream
  }

  async function handleImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setError("Please select a CSV file"); return; }

    setError(""); setResult(null); setProcessed(0);
    setCancelled(false); setLoading(true);
    sessionIdRef.current = null;

    try {
      const token = localStorage.getItem("token") || "";
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/orders/import/stream", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (!res.ok || !res.body) throw new Error("Import failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const json = JSON.parse(line.slice(5).trim());

          if (json.type === "session") {
            sessionIdRef.current = json.sessionId;
          } else if (json.type === "progress") {
            setProcessed(json.processed);
            // Refresh table every 25 rows so new records appear in real time
            if (json.processed % 25 === 0) onSuccess();
          } else if (json.type === "cancelled") {
            setRolledBack(json.rolledBack);
            setCancelled(true);
            onSuccess();
          } else if (json.type === "done") {
            setResult({ success: json.success, failed: json.failed, errors: json.errors });
            if (json.success > 0) onSuccess();
          }
        }
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      sessionIdRef.current = null;
    }
  }

  const percent = rowCount ? Math.round((processed / rowCount) * 100) : 0;

  return (
    <div style={styles.card}>
      <h3 style={styles.title}>📂 Import CSV</h3>
      <p style={styles.hint}>Expected columns: <code>id, longitude, latitude, timestamp, subtotal</code></p>

      <div style={styles.row}>
        <input ref={fileRef} type="file" accept=".csv" style={styles.fileInput} onChange={handleFileChange} />
        <button onClick={handleImport} disabled={loading} style={styles.btn}>
          {loading ? "Importing..." : "Import"}
        </button>
        {loading && (
          <button onClick={handleCancel} style={styles.cancelBtn}>
            ✕ Cancel
          </button>
        )}
      </div>

      {loading && rowCount !== null && (
        <div style={styles.progressWrap}>
          <div style={styles.progressTrack}>
            <div style={{ ...styles.progressFill, width: `${percent}%` }} />
          </div>
          <p style={styles.progressText}>
            ⏳ {processed} / {rowCount} rows processed ({percent}%)
          </p>
          <p style={styles.progressHint}>
            Each row requires a geocoding request via Census API
          </p>
        </div>
      )}

      {cancelled && (
        <div style={styles.cancelledBanner}>
          ⚠️ Import cancelled — {rolledBack} rows were removed from the database.
        </div>
      )}

      {error && <p style={{ color: "red", marginTop: 8 }}>{error}</p>}

      {result && !cancelled && (
        <div style={styles.result}>
          <div style={styles.resultRow}>
            <span style={styles.successBadge}>✅ {result.success} imported</span>
            {result.failed > 0 && <span style={styles.failBadge}>❌ {result.failed} failed</span>}
            {rowCount !== null && <span style={styles.totalBadge}>{result.success} / {rowCount} rows</span>}
          </div>
          {result.errors.length > 0 && (
            <ul style={styles.errorList}>
              {result.errors.map((e, i) => <li key={i}>Row {e.original_id}: {e.error}</li>)}
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
  cancelBtn: { padding: "10px 16px", background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap", fontWeight: 500 },
  progressWrap: { marginTop: 16 },
  progressTrack: { height: 8, background: "#e5e7eb", borderRadius: 99, overflow: "hidden", marginBottom: 8 },
  progressFill: { height: "100%", background: "linear-gradient(90deg, #4f46e5, #818cf8)", borderRadius: 99, transition: "width 0.3s ease" },
  progressText: { margin: "0 0 4px", fontSize: 14, color: "#374151", fontWeight: 500 },
  progressHint: { margin: 0, fontSize: 12, color: "#9ca3af" },
  cancelledBanner: { marginTop: 12, padding: "10px 14px", background: "#fef9c3", border: "1px solid #fde68a", borderRadius: 8, fontSize: 14, color: "#92400e" },
  result: { marginTop: 12, padding: 12, background: "#f9fafb", borderRadius: 8 },
  resultRow: { display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" },
  successBadge: { color: "#16a34a", fontWeight: 500 },
  failBadge: { color: "#dc2626", fontWeight: 500 },
  totalBadge: { color: "#6b7280", fontSize: 13 },
  errorList: { marginTop: 8, fontSize: 13, color: "#666", paddingLeft: 16 },
};