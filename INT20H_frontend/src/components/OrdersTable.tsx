import { getOrders, OrdersResponse, clearOrders } from "../api";
import React, { useEffect, useState, useCallback } from "react";

interface Props {
  refreshKey: number;
}

export default function OrdersTable({ refreshKey }: Props) {
  const [data, setData] = useState<OrdersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ region: "", min_total: "", max_total: "" });
  const [expanded, setExpanded] = useState<number | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getOrders({ page, limit: 20, ...filters });
      setData(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, filters, refreshKey]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  function setFilter(key: string, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

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
        
        tr:hover {
          background: rgba(102, 126, 234, 0.05);
          transition: background 0.2s ease;
        }
      `}</style>

      <div style={styles.header}>
        <span style={styles.icon}>📋</span>
        <h3 style={styles.title}>Orders</h3>
      </div>

      {/* Filters */}
      <div style={styles.filters}>
        <input
          style={{ ...styles.filterInput, width: 200 }}
          placeholder="Region (e.g. Bronx, Queens)"
          value={filters.region}
          onChange={(e) => setFilter("region", e.target.value)}
        />
        <input
          style={styles.filterInput}
          type="number"
          placeholder="Min total"
          value={filters.min_total}
          onChange={(e) => setFilter("min_total", e.target.value)}
        />
        <input
          style={styles.filterInput}
          type="number"
          placeholder="Max total"
          value={filters.max_total}
          onChange={(e) => setFilter("max_total", e.target.value)}
        />
        <button onClick={fetchOrders} style={styles.refreshBtn}>
          🔄 Refresh
        </button>
        <button
          onClick={async () => {
            if (!confirm("Delete all orders?")) return;
            await clearOrders();
            fetchOrders();
          }}
          style={{ ...styles.refreshBtn, ...styles.deleteBtn }}
        >
          🗑️ Clear all
        </button>
      </div>

      {error && <p style={styles.error}>{error}</p>}
      {loading && <p style={styles.loading}>Loading orders...</p>}

      {data && (
        <>
          <p style={styles.info}>
            {data.total} order{data.total !== 1 ? "s" : ""} total
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.headerRow}>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>Timestamp</th>
                  <th style={styles.th}>Region</th>
                  <th style={styles.th}>Subtotal</th>
                  <th style={styles.th}>Tax Rate</th>
                  <th style={styles.th}>Tax</th>
                  <th style={styles.th}>Total</th>
                  <th style={styles.th}>Details</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((o) => (
                  <React.Fragment key={o.id}>
                    <tr style={styles.row}>
                      <td style={styles.td}>{o.id}</td>
                      <td style={styles.td}>{o.timestamp?.slice(0, 19).replace("T", " ")}</td>
                      <td style={styles.td}>{o.tax_region}</td>
                      <td style={styles.td}>${o.subtotal.toFixed(2)}</td>
                      <td style={styles.td}>{(o.composite_tax_rate * 100).toFixed(3)}%</td>
                      <td style={styles.td}>${o.tax_amount.toFixed(2)}</td>
                      <td style={{ ...styles.td, ...styles.totalCell }}>
                        ${o.total_amount.toFixed(2)}
                      </td>
                      <td style={styles.td}>
                        <button
                          onClick={() =>
                            setExpanded(expanded === o.id ? null : o.id)
                          }
                          style={styles.expandBtn}
                        >
                          {expanded === o.id ? "▲" : "▼"}
                        </button>
                      </td>
                    </tr>
                    {expanded === o.id && (
                      <tr key={`${o.id}-detail`}>
                        <td colSpan={8} style={styles.detailCell}>
                          <div style={styles.detailGrid}>
                            <span style={styles.detailItem}>
                              📍 Lat: <strong>{o.latitude.toFixed(6)}</strong>
                            </span>
                            <span style={styles.detailItem}>
                              📍 Lon: <strong>{o.longitude.toFixed(6)}</strong>
                            </span>
                            <span style={styles.detailItem}>
                              State rate: <strong>{(o.state_rate * 100).toFixed(3)}%</strong>
                            </span>
                            <span style={styles.detailItem}>
                              County rate: <strong>{(o.county_rate * 100).toFixed(3)}%</strong>
                            </span>
                            <span style={styles.detailItem}>
                              City rate: <strong>{(o.city_rate * 100).toFixed(3)}%</strong>
                            </span>
                            <span style={styles.detailItem}>
                              Special rate: <strong>{(o.special_rate * 100).toFixed(3)}%</strong>
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.pages > 1 && (
            <div style={styles.pagination}>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                style={styles.pageBtn}
              >
                ← Prev
              </button>
              <span style={styles.pageInfo}>
                Page {page} / {data.pages}
              </span>
              <button
                disabled={page >= data.pages}
                onClick={() => setPage((p) => p + 1)}
                style={styles.pageBtn}
              >
                Next →
              </button>
            </div>
          )}
        </>
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
    marginBottom: 20,
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

  filters: {
    display: "flex",
    gap: 8,
    marginBottom: 16,
    flexWrap: "wrap",
  },

  filterInput: {
    padding: "10px 12px",
    border: "1.5px solid rgba(102, 126, 234, 0.2)",
    borderRadius: 10,
    fontSize: 13,
    width: 140,
    background: "rgba(255, 255, 255, 0.6)",
    boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.05)",
    transition: "all 0.3s ease",
  },

  refreshBtn: {
    padding: "10px 16px",
    background: "rgba(102, 126, 234, 0.1)",
    border: "1.5px solid rgba(102, 126, 234, 0.3)",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    color: "#667eea",
    transition: "all 0.3s ease",
  },

  deleteBtn: {
    background: "rgba(239, 68, 68, 0.1)",
    borderColor: "rgba(239, 68, 68, 0.3)",
    color: "#dc2626",
  },

  error: {
    color: "#dc2626",
    fontSize: 13,
    marginBottom: 16,
    padding: "10px 12px",
    background: "rgba(239, 68, 68, 0.1)",
    borderRadius: 8,
    margin: "0 0 16px 0",
  },

  loading: {
    color: "#6b7280",
    fontSize: 13,
    textAlign: "center",
    padding: "20px",
  },

  info: {
    color: "#6b7280",
    fontSize: 13,
    marginBottom: 12,
    fontWeight: 500,
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },

  headerRow: {
    background: "linear-gradient(90deg, rgba(102, 126, 234, 0.05), rgba(118, 75, 162, 0.05))",
  },

  th: {
    padding: "12px 12px",
    textAlign: "left",
    fontWeight: 700,
    color: "#667eea",
    borderBottom: "2px solid rgba(102, 126, 234, 0.2)",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },

  row: {
    borderBottom: "1px solid rgba(0, 0, 0, 0.05)",
    transition: "background 0.2s ease",
  },

  td: {
    padding: "12px 12px",
    color: "#374151",
  },

  totalCell: {
    fontWeight: 700,
    color: "#16a34a",
  },

  expandBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 12,
    color: "#667eea",
    fontWeight: 700,
    transition: "all 0.3s ease",
    padding: 0,
  },

  detailCell: {
    background: "linear-gradient(90deg, rgba(102, 126, 234, 0.05), transparent)",
    padding: "16px 12px",
  },

  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
    fontSize: 12,
    color: "#4b5563",
  },

  detailItem: {
    padding: "8px 10px",
    background: "rgba(255, 255, 255, 0.5)",
    borderRadius: 8,
  },

  pagination: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },

  pageBtn: {
    padding: "10px 16px",
    background: "rgba(102, 126, 234, 0.1)",
    border: "1.5px solid rgba(102, 126, 234, 0.3)",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    color: "#667eea",
    transition: "all 0.3s ease",
  },

  pageInfo: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: 600,
  },
};