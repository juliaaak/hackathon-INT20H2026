import { useState } from "react";
import { login } from "../api";

interface Props {
  onLogin: () => void;
}

export default function Login({ onLogin }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError("");
    setLoading(true);
    try {
      const token = await login(password);
      localStorage.setItem("token", token);
      onLogin();
    } catch {
      setError("Wrong password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.wrapper}>
      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-8px);
          }
        }
        
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
      `}</style>

      <div style={styles.bg} />

      <div
        style={{
          ...styles.box,
          animation: "fadeInScale 0.6s ease-out",
        }}
      >
        <div
          style={{
            ...styles.logo,
            animation: "float 3s ease-in-out infinite",
          }}
        >
          🚁
        </div>

        <h1 style={styles.title}>Wellness Tax Admin</h1>
        <p style={styles.subtitle}>Manage your drone delivery taxes with ease</p>

        <div style={styles.formGroup}>
          <label style={styles.label}>Enter Admin Password</label>
          <input
            type="password"
            placeholder="•••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            style={{
              ...styles.input,
              animation: error ? "shake 0.4s" : "none",
            }}
          />
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            ...styles.btn,
            ...(loading ? styles.btnLoading : {}),
          }}
        >
          {loading ? "🔐 Verifying..." : "Login"}
        </button>

        <p style={styles.footer}>
          Secure access only. All actions are logged.
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
    fontFamily: "'Sora', system-ui, sans-serif",
    position: "relative",
    overflow: "hidden",
  },

  bg: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(circle at 20% 50%, rgba(102, 126, 234, 0.2) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(240, 147, 251, 0.2) 0%, transparent 50%)",
    pointerEvents: "none",
  },

  box: {
    background: "rgba(255, 255, 255, 0.95)",
    backdropFilter: "blur(10px)",
    padding: 40,
    borderRadius: 20,
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
    border: "1px solid rgba(255, 255, 255, 0.5)",
    minWidth: 360,
    textAlign: "center",
    position: "relative",
    zIndex: 10,
  },

  logo: {
    fontSize: 48,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 80,
    height: 80,
    background: "linear-gradient(135deg, #667eea, #764ba2)",
    borderRadius: 16,
    boxShadow: "0 12px 32px rgba(102, 126, 234, 0.4)",
    marginBottom: 20,
  },

  title: {
    margin: "0 0 8px 0",
    fontSize: 26,
    fontWeight: 700,
    color: "#1a1a2e",
    letterSpacing: "-0.5px",
  },

  subtitle: {
    margin: "0 0 28px 0",
    fontSize: 14,
    color: "#6b7280",
    fontWeight: 500,
  },

  formGroup: {
    marginBottom: 20,
    textAlign: "left",
  },

  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "#4b5563",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },

  input: {
    width: "100%",
    padding: "14px 16px",
    fontSize: 16,
    borderRadius: 12,
    border: "1.5px solid rgba(102, 126, 234, 0.2)",
    background: "rgba(255, 255, 255, 0.6)",
    boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.05)",
    boxSizing: "border-box",
    transition: "all 0.3s ease",
    color: "#1a1a2e",
    letterSpacing: "-0.3px",
  },

  error: {
    color: "#dc2626",
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
    padding: "14px 20px",
    background: "linear-gradient(135deg, #667eea, #764ba2)",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 12px 32px rgba(102, 126, 234, 0.4)",
    transition: "all 0.3s ease",
    letterSpacing: "-0.3px",
    marginBottom: 12,
  },

  btnLoading: {
    opacity: 0.8,
    transform: "scale(0.98)",
  },

  footer: {
    margin: 0,
    fontSize: 11,
    color: "#9ca3af",
    fontWeight: 500,
  },
};