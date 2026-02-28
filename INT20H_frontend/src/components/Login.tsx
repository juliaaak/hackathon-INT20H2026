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
    <div style={styles.wrap}>
      <div style={styles.box}>
        <h2 style={{ marginBottom: 24, color: "#1a1a2e" }}>🚁 Wellness Tax Admin</h2>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          style={styles.input}
        />
        {error && <p style={{ color: "red", margin: "8px 0" }}>{error}</p>}
        <button onClick={handleSubmit} disabled={loading} style={styles.btn}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f5f5f5" },
  box: { background: "#fff", padding: 40, borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.1)", minWidth: 320, textAlign: "center" },
  input: { width: "100%", padding: "10px 14px", fontSize: 16, borderRadius: 8, border: "1px solid #ddd", marginBottom: 8, boxSizing: "border-box" },
  btn: { width: "100%", padding: "12px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, fontSize: 16, cursor: "pointer" },
};