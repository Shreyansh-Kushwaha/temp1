"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        display: "inline-flex", alignItems: "center", gap: "6px",
        marginLeft: "8px", padding: "8px 16px", borderRadius: "9999px",
        background: "#FF6B1F", color: "white",
        fontSize: "13px", fontWeight: 600, border: "none", cursor: "pointer",
      }}
    >
      Print / Save PDF
    </button>
  );
}
