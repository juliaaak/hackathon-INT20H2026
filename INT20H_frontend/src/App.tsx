import { useState } from "react";
import Login from "./components/Login";
import ImportCSV from "./components/ImportCSV";
import CreateOrder from "./components/CreateOrder";
import OrdersTable from "./components/OrdersTable";
import { logout } from "./api";

export default function App() {
  const [authed, setAuthed] = useState(!!localStorage.getItem("token"));
  const [refreshKey, setRefreshKey] = useState(0);

  function refresh() { setRefreshKey((k) => k + 1); }

  async function handleLogout() {
    await logout();
    localStorage.removeItem("token");
    setAuthed(false);
  }

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  return (
    <div style={styles.wrap}>
      <header style={styles.header}>
        <h1 style={styles.logo}>🚁 Wellness Tax Admin</h1>
        <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
      </header>
      <main style={styles.main}>
        <ImportCSV onSuccess={refresh} />
        <CreateOrder onSuccess={refresh} />
        <OrdersTable refreshKey={refreshKey} />
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { minHeight: "100vh", background: "#f5f5f5", fontFamily: "system-ui, sans-serif" },
  header: { background: "#1a1a2e", color: "#fff", padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  logo: { margin: 0, fontSize: 20 },
  logoutBtn: { padding: "8px 16px", background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, cursor: "pointer" },
  main: { maxWidth: 1200, margin: "0 auto", padding: "32px 24px" },
};