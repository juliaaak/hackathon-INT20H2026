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

  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => setResult(null), 6000);
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return () => clearTimeout(t);
  }, [result]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(""), 5000);
    return () => clearTimeout(t);
  }, [error]);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setError("");
  }

  async function handleCreate() {
    const lat = parseFloat(form.latitude);
    const lon = parseFloat(form.longitude);
    const sub = parseFloat(form.subtotal);
    if (isNaN(lat) || isNaN(lon) || isNaN(sub)) {
      setError("All fields are required and must be numbers");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const order = await createOrder({ latitude: lat, longitude: lon, subtotal: sub });
      setForm({ latitude: "", longitude: "", subtotal: "" });
      setResult(order);
      setTimeout(() => onSuccess(), 100);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.card}>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        
        @keyframes successPulse {
          0% { transform: scale(0.95); opacity: 0; }
          50% { transform: scale(1.02); }
          100% { transform: scale(1); opacity: 1; }
        }
        
        .input-focus:focus {
          outline: none !important;
          box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3) !important;
          transform: translateY(-2px) !important;
        }
      `}</style>

      <div style={styles.header}>
        <span style={styles.icon}>➕</span>
        <h3 style={styles.title}>Create Order Manually</h3>
      </div>

      <div style={styles.grid}>
        <label style={styles.label}>
          <span style={styles.labelText}>Latitude</span>
          <input
            className="input-focus"
            style={styles.input}
            type="number"
            step="any"
            placeholder="40.7128"
            value={form.latitude}
            onChange={(e) => set("latitude", e.target.value)}
          />
        </label>
        <label style={styles.label}>
          <span style={styles.labelText}>Longitude</span>
          <input
            className="input-focus"
            style={styles.input}
            type="number"
            step="any"
            placeholder="-74.0060"
            value={form.longitude}
            onChange={(e) => set("longitude", e.target.value)}
          />
        </label>
        <label style={styles.label}>
          <span style={styles.labelText}>Subtotal ($)</span>
          <input
            className="input-focus"
            style={styles.input}
            type="number"
            step="0.01"
            min="0.01"
            placeholder="120.00"
            value={form.subtotal}
            onChange={(e) => set("subtotal", e.target.value)}
          />
        </label>
      </div>

      {error && <p style={styles.error}>{error}</p>}

      <button
        onClick={handleCreate}
        disabled={loading}
        style={{
          ...styles.btn,
          ...(loading ? styles.btnLoading : {}),
          animation: error ? "shake 0.4s" : "none",
        }}
      >
        {loading ? "⏳ Creating..." : "Create Order"}
      </button>

      {result && (
        <div
          ref={resultRef}
          style={{
            ...styles.result,
            animation: "successPulse 0.5s ease-out",
          }}
        >
          <span style={styles.successIcon}>✅</span>
          <div style={styles.resultText}>
            <div style={styles.resultTitle}>Order created</div>
            <div style={styles.resultSub}>Order #{result.id} successfully created</div>
          </div>
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
    position: "relative",
    overflow: "hidden",
  },

  header: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
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

  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 16,
    marginBottom: 20,
  },

  label: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  labelText: {
    fontSize: 13,
    fontWeight: 600,
    color: "#4b5563",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },

  input: {
    padding: "12px 14px",
    border: "1.5px solid rgba(102, 126, 234, 0.2)",
    borderRadius: 10,
    fontSize: 14,
    color: "#1a1a2e",
    background: "rgba(255, 255, 255, 0.6)",
    transition: "all 0.3s ease",
    boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.05)",
  },

  error: {
    color: "#ef4444",
    fontSize: 13,
    marginBottom: 16,
    fontWeight: 500,
    padding: "10px 12px",
    background: "rgba(239, 68, 68, 0.1)",
    borderRadius: 8,
    margin: "0 0 16px 0",
  },

  btn: {
    width: "100%",
    padding: "13px 20px",
    background: "linear-gradient(135deg, #667eea, #764ba2)",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 600,
    boxShadow: "0 8px 24px rgba(102, 126, 234, 0.4)",
    transition: "all 0.3s ease",
    letterSpacing: "-0.3px",
  },

  btnLoading: {
    opacity: 0.8,
    transform: "scale(0.98)",
  },

  result: {
    marginTop: 16,
    padding: 16,
    background: "linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05))",
    borderRadius: 12,
    border: "1.5px solid rgba(34, 197, 94, 0.3)",
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  successIcon: {
    fontSize: 22,
    flexShrink: 0,
  },

  resultText: {
    flex: 1,
  },

  resultTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#15803d",
  },

  resultSub: {
    fontSize: 13,
    color: "#4b7c3d",
    marginTop: 2,
  },
};