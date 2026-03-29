import Link from "next/link";
import type { CSSProperties } from "react";

const cardStyle: CSSProperties = {
  display: "block",
  padding: "24px",
  borderRadius: "16px",
  border: "1px solid #E2E8F0",
  background: "#FFFFFF",
  color: "#0F172A",
  textDecoration: "none",
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
};

export default function DashboardHome() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#F8FAFC",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        padding: "24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: "720px" }}>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <h1 style={{ margin: "0 0 8px", fontSize: "32px" }}>
            <span style={{ color: "#2563EB" }}>Fast</span>
            <span style={{ color: "#EF4444" }}>ER</span> Dashboard
          </h1>
          <p style={{ margin: 0, color: "#64748B" }}>
            Choose which operational view you want to open.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <Link href="/nurse" style={cardStyle}>
            <div style={{ fontSize: "14px", color: "#64748B", marginBottom: "8px" }}>
              Clinical review
            </div>
            <div style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px" }}>
              Nurse Dashboard
            </div>
            <div style={{ color: "#475569" }}>
              Review AI triage, adjust CTAS priority, and send patients to reception.
            </div>
          </Link>

          <Link href="/receptionist" style={cardStyle}>
            <div style={{ fontSize: "14px", color: "#64748B", marginBottom: "8px" }}>
              Front desk
            </div>
            <div style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px" }}>
              Receptionist Dashboard
            </div>
            <div style={{ color: "#475569" }}>
              View the verified queue, call patients, and monitor throughput.
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
