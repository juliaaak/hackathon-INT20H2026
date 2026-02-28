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
  const [filters, setFilters] = useState({ state: "", min_total: "", max_total: "" });
  const [expanded, setExpanded] = useState<number | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await getOrders({ page, limit: 20, ...filters });
      setData(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, filters, refreshKey]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  function setFilter(key: string, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  return (
    <div style={styles.card}>
      <h3 style={styles.title}>📋 Orders</h3>

      {/* Filters */}
      <div style={styles.filters}>
        <input style={styles.filterInput} placeholder="State (e.g. NY)" value={filters.state} onChange={(e) => setFilter("state", e.target.value)} />
        <input style={styles.filterInput} type="number" placeholder="Min total" value={filters.min_total} onChange={(e) => setFilter("min_total", e.target.value)} />
        <input style={styles.filterInput} type="number" placeholder="Max total" value={filters.max_total} onChange={(e) => setFilter("max_total", e.target.value)} />
        <button onClick={fetchOrders} style={styles.refreshBtn}>🔄 Refresh</button>
        <button
            onClick={async () => {
                if (!confirm("Видалити всі замовлення?")) return;
                await clearOrders();
                fetchOrders();
            }}
            style={{ ...styles.refreshBtn, color: "red" }}
            >
            🗑️ Clear all
        </button>
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {loading && <p style={{ color: "#666" }}>Loading...</p>}

      {data && (
        <>
          <p style={{ color: "#666", fontSize: 14, marginBottom: 8 }}>
            {data.total} orders total
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
                    <tr key={o.id} style={styles.row}>
                      <td style={styles.td}>{o.id}</td>
                      <td style={styles.td}>{o.timestamp?.slice(0, 19).replace("T", " ")}</td>
                      <td style={styles.td}>{o.tax_region}</td>
                      <td style={styles.td}>${o.subtotal.toFixed(2)}</td>
                      <td style={styles.td}>{(o.composite_tax_rate * 100).toFixed(3)}%</td>
                      <td style={styles.td}>${o.tax_amount.toFixed(2)}</td>
                      <td style={{ ...styles.td, fontWeight: 600 }}>${o.total_amount.toFixed(2)}</td>
                      <td style={styles.td}>
                        <button onClick={() => setExpanded(expanded === o.id ? null : o.id)} style={styles.expandBtn}>
                          {expanded === o.id ? "▲" : "▼"}
                        </button>
                      </td>
                    </tr>
                    {expanded === o.id && (
                      <tr key={`${o.id}-detail`}>
                        <td colSpan={9} style={styles.detailCell}>
                          <div style={styles.detailGrid}>
                            <span>📍 Lat: {o.latitude.toFixed(6)}</span>
                            <span>📍 Lon: {o.longitude.toFixed(6)}</span>
                            <span>State rate: {(o.state_rate * 100).toFixed(3)}%</span>
                            <span>County rate: {(o.county_rate * 100).toFixed(3)}%</span>
                            <span>City rate: {(o.city_rate * 100).toFixed(3)}%</span>
                            <span>Special rate: {(o.special_rate * 100).toFixed(3)}%</span>
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
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={styles.pageBtn}>← Prev</button>
              <span style={{ fontSize: 14 }}>Page {page} / {data.pages}</span>
              <button disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)} style={styles.pageBtn}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: { background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.08)" },
  title: { margin: "0 0 16px", color: "#1a1a2e" },
  filters: { display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  filterInput: { padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, width: 140 },
  refreshBtn: { padding: "8px 16px", background: "#f3f4f6", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  headerRow: { background: "#f9fafb" },
  th: { padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb" },
  row: { borderBottom: "1px solid #f3f4f6" },
  td: { padding: "10px 12px", color: "#374151" },
  expandBtn: { background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#6b7280" },
  detailCell: { background: "#f9fafb", padding: "12px 16px" },
  detailGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, fontSize: 13, color: "#4b5563" },
  pagination: { display: "flex", gap: 12, alignItems: "center", justifyContent: "center", marginTop: 16 },
  pageBtn: { padding: "8px 16px", background: "#f3f4f6", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer" },
};