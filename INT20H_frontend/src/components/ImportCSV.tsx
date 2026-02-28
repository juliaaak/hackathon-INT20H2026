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
    setResult(null);
    setError("");
    setRowCount(null);
    setProcessed(0);
    setCancelled(false);
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
  }

  async function handleImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Please select a CSV file");
      return;
    }

    setError("");
    setResult(null);
    setProcessed(0);
    setCancelled(false);
    setLoading(true);
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
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>

      <div style={styles.header}>
        <span style={styles.icon}>📂</span>
        <h3 style={styles.title}>Import CSV</h3>
      </div>

      <p style={styles.hint}>
        Expected columns: <code style={styles.code}>id, longitude, latitude, timestamp, subtotal</code>
      </p>

      <div style={styles.row}>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          style={styles.fileInput}
          onChange={handleFileChange}
        />
        <button onClick={handleImport} disabled={loading} style={styles.btn}>
          {loading ? "📤 Importing..." : "Import"}
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
            <div
              style={{
                ...styles.progressFill,
                width: `${percent}%`,
              }}
            />
          </div>
          <div style={styles.progressLabel}>
            <span style={styles.progressText}>
              ⏳ {processed} / {rowCount} rows
            </span>
            <span style={styles.progressPercent}>{percent}%</span>
          </div>
          <p style={styles.progressHint}>
            Each row requires a geocoding request via Census API
          </p>
        </div>
      )}

      {cancelled && (
        <div
          style={{
            ...styles.banner,
            ...styles.cancelledBanner,
          }}
        >
          ⚠️ Import cancelled — {rolledBack} rows were removed from the database.
        </div>
      )}

      {error && (
        <div
          style={{
            ...styles.banner,
            ...styles.errorBanner,
          }}
        >
          ❌ {error}
        </div>
      )}

      {result && !cancelled && (
        <div
          style={{
            ...styles.resultBox,
            animation: "slideIn 0.4s ease-out",
          }}
        >
          <div style={styles.resultRow}>
            <span style={styles.successBadge}>✅ {result.success} imported</span>
            {result.failed > 0 && <span style={styles.failBadge}>❌ {result.failed} failed</span>}
            {rowCount !== null && <span style={styles.totalBadge}>{result.success} / {rowCount} rows</span>}
          </div>
          {result.errors.length > 0 && (
            <ul style={styles.errorList}>
              {result.errors.map((e, i) => (
                <li key={i} style={styles.errorItem}>
                  Row {e.original_id}: <span style={styles.errorMsg}>{e.error}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "rgba(255, 255, 255, 0.95)",
    backdropFilter: "blur(10px)",
    borderRadius: 16,
    padding: 28,
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
    border: "1px solid rgba(255, 255, 255, 0.5)",
  },

  header: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },

  icon: {
    fontSize: 24,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
    background: "linear-gradient(135deg, #667eea, #764ba2)",
    borderRadius: 12,
    boxShadow: "0 4px 12px rgba(102, 126, 234, 0.3)",
  },

  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    color: "#1a1a2e",
    letterSpacing: "-0.5px",
  },

  hint: {
    margin: "0 0 16px 0",
    color: "#6b7280",
    fontSize: 13,
  },

  code: {
    background: "rgba(102, 126, 234, 0.1)",
    padding: "2px 6px",
    borderRadius: 4,
    color: "#667eea",
    fontFamily: "monospace",
    fontSize: 12,
  },

  row: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    marginBottom: 16,
  },

  fileInput: {
    flex: 1,
    padding: "12px 14px",
    border: "1.5px solid rgba(102, 126, 234, 0.2)",
    borderRadius: 10,
    fontSize: 13,
    background: "rgba(255, 255, 255, 0.6)",
    boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.05)",
    cursor: "pointer",
  },

  btn: {
    padding: "12px 20px",
    background: "linear-gradient(135deg, #667eea, #764ba2)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontWeight: 600,
    fontSize: 13,
    boxShadow: "0 4px 12px rgba(102, 126, 234, 0.3)",
    transition: "all 0.3s ease",
  },

  cancelBtn: {
    padding: "12px 16px",
    background: "rgba(239, 68, 68, 0.1)",
    color: "#dc2626",
    border: "1.5px solid rgba(239, 68, 68, 0.3)",
    borderRadius: 10,
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontWeight: 600,
    fontSize: 13,
    transition: "all 0.3s ease",
  },

  progressWrap: {
    marginBottom: 16,
  },

  progressTrack: {
    height: 8,
    background: "rgba(0, 0, 0, 0.05)",
    borderRadius: 99,
    overflow: "hidden",
    marginBottom: 8,
    boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.05)",
  },

  progressFill: {
    height: "100%",
    background: "linear-gradient(90deg, #667eea, #764ba2)",
    borderRadius: 99,
    transition: "width 0.3s ease",
    boxShadow: "0 0 12px rgba(102, 126, 234, 0.5)",
  },

  progressLabel: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },

  progressText: {
    fontSize: 13,
    color: "#374151",
    fontWeight: 600,
  },

  progressPercent: {
    fontSize: 13,
    color: "#667eea",
    fontWeight: 700,
  },

  progressHint: {
    margin: 0,
    fontSize: 12,
    color: "#9ca3af",
  },

  banner: {
    marginBottom: 16,
    padding: "12px 14px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 500,
  },

  cancelledBanner: {
    background: "rgba(251, 191, 36, 0.1)",
    border: "1px solid rgba(251, 191, 36, 0.3)",
    color: "#92400e",
  },

  errorBanner: {
    background: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    color: "#dc2626",
  },

  resultBox: {
    padding: 14,
    background: "linear-gradient(135deg, rgba(34, 197, 94, 0.05), rgba(34, 197, 94, 0.02))",
    borderRadius: 10,
    border: "1.5px solid rgba(34, 197, 94, 0.3)",
  },

  resultRow: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 12,
  },

  successBadge: {
    color: "#16a34a",
    fontWeight: 700,
    fontSize: 13,
  },

  failBadge: {
    color: "#dc2626",
    fontWeight: 700,
    fontSize: 13,
  },

  totalBadge: {
    color: "#6b7280",
    fontSize: 12,
  },

  errorList: {
    margin: 0,
    paddingLeft: 16,
    fontSize: 12,
    color: "#666",
  },

  errorItem: {
    marginBottom: 4,
  },

  errorMsg: {
    color: "#dc2626",
    fontWeight: 500,
  },
};