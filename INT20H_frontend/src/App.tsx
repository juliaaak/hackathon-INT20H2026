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
    <div style={styles.wrapper}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&family=Sora:wght@400;600;700&display=swap');
        
        @keyframes slideInDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        * {
          font-family: 'Sora', system-ui, sans-serif;
        }
      `}</style>

      {/* Animated Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.logoContainer}>
            <span style={styles.logoBg}>🚁</span>
            <h1 style={styles.logo}>Wellness Tax Admin</h1>
          </div>
          <button onClick={handleLogout} style={styles.logoutBtn}>
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main style={styles.main}>
        <div style={styles.container}>
          {/* Import Section */}
          <div style={{ ...styles.section, animation: 'slideUp 0.6s ease-out' }}>
            <ImportCSV onSuccess={refresh} />
          </div>

          {/* Create Order Section */}
          <div style={{ ...styles.section, animation: 'slideUp 0.7s ease-out' }}>
            <CreateOrder onSuccess={refresh} />
          </div>

          {/* Orders Table Section */}
          <div style={{ ...styles.section, animation: 'slideUp 0.8s ease-out' }}>
            <OrdersTable refreshKey={refreshKey} />
          </div>
        </div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
    fontFamily: "'Sora', system-ui, sans-serif",
    position: "relative",
    overflow: "hidden",
  },

  header: {
    background: "rgba(255, 255, 255, 0.1)",
    backdropFilter: "blur(10px)",
    borderBottom: "1px solid rgba(255, 255, 255, 0.2)",
    padding: "20px 32px",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
    animation: "slideInDown 0.6s ease-out",
  },

  headerContent: {
    maxWidth: 1200,
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },

  logoContainer: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  logoBg: {
    fontSize: 28,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
    background: "linear-gradient(135deg, #667eea, #764ba2)",
    borderRadius: 12,
    boxShadow: "0 8px 16px rgba(102, 126, 234, 0.4)",
  },

  logo: {
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
    color: "#fff",
    letterSpacing: "-0.5px",
  },

  logoutBtn: {
    padding: "10px 20px",
    background: "rgba(255, 255, 255, 0.15)",
    color: "#fff",
    border: "1px solid rgba(255, 255, 255, 0.3)",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    transition: "all 0.3s ease",
    backdropFilter: "blur(10px)",
  },

  main: {
    padding: "40px 24px",
  },

  container: {
    maxWidth: 1200,
    margin: "0 auto",
  },

  section: {
    marginBottom: 24,
  },
};