import React, { useEffect, useState } from "react";
import api from "../../services/api";

const palette = {
  present: "#16a34a",
  absent: "#ef4444",
  late: "#f59e0b",
  muted: "#6b7280",
  border: "#e5e7eb",
  primary: "#2563eb",
  card: "#ffffff",
  bg: "#f9fafb",
  shadow: "0 1px 6px rgba(16,24,40,0.06)",
};

const MONTH_NAMES = ["", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

function SummaryCard({ label, value, color, icon }) {
  return (
    <div className="teacher-my-attendance-summary-card" style={{
      flex: "1 1 130px", minWidth: 130, background: palette.card,
      border: `1px solid ${palette.border}`, borderRadius: 16,
      padding: "18px 14px", boxShadow: palette.shadow, textAlign: "center",
    }}>
      <div style={{ fontSize: 26, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 1000, color: color || "#111827" }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 900, color: palette.muted, textTransform: "uppercase", letterSpacing: "0.03em", marginTop: 4 }}>{label}</div>
    </div>
  );
}

function CalendarDayCell({ day }) {
  if (!day) return <div style={{ flex: "1 1 calc(14.28% - 6px)", minWidth: 38, height: 42 }} />;

  const s = (day.status || "").toLowerCase();
  let bg = "#f9fafb";
  let color = "#9ca3af";
  let border = palette.border;
  if (s === "present") { bg = "#dcfce7"; color = palette.present; border = "#bbf7d0"; }
  else if (s === "absent") { bg = "#fee2e2"; color = palette.absent; border = "#fecaca"; }
  else if (s === "late") { bg = "#fef3c7"; color = palette.late; border = "#fde68a"; }

  return (
    <div title={`${day.date} — ${day.weekday}: ${s || "Not Marked"}`} style={{
      flex: "1 1 calc(14.28% - 6px)", minWidth: 38, height: 42,
      display: "flex", alignItems: "center", justifyContent: "center",
      borderRadius: 10, backgroundColor: bg, border: `1.5px solid ${border}`,
      color, fontWeight: 1000, fontSize: 13, cursor: "default",
      transition: "transform 0.15s", position: "relative",
    }}>
      {day.day}
      {s && (
        <span style={{
          position: "absolute", bottom: 2, right: 4, fontSize: 8, fontWeight: 900,
        }}>
          {s === "present" ? "✓" : s === "absent" ? "✕" : "⏰"}
        </span>
      )}
    </div>
  );
}

const MyAttendance = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [view, setView] = useState("calendar"); // 'calendar' or 'table'

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get("attendance/staff/my-attendance/", {
        params: { month, year },
      });
      setData(res.data || null);
    } catch { setData(null); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [month, year]);

  const summary = data?.summary || {};
  const calendar = data?.calendar || [];
  const daily = data?.daily || [];

  // Build calendar grid with weekday alignment
  const calendarGrid = [];
  if (calendar.length > 0) {
    const firstDay = new Date(calendar[0].date);
    const startWeekday = firstDay.getDay(); // 0=Sun
    for (let i = 0; i < startWeekday; i++) calendarGrid.push(null);
    calendar.forEach((d) => calendarGrid.push(d));
  }

  const goToPreviousMonth = () => {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  };

  const goToNextMonth = () => {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  };

  return (
    <div style={{ padding: 20, backgroundColor: palette.bg, minHeight: "calc(100vh - 60px)" }}>
      <style>{`
        .teacher-my-attendance-summary-strip {
          display: flex;
          gap: 12px;
          flex-wrap: nowrap;
          margin-bottom: 16px;
          overflow-x: auto;
          padding-bottom: 4px;
          -webkit-overflow-scrolling: touch;
        }
        .teacher-my-attendance-summary-card {
          flex: 1 1 0 !important;
          min-width: 0 !important;
        }
        @media (max-width: 640px) {
          .teacher-my-attendance-summary-strip {
            gap: 8px !important;
            margin-left: -2px;
            margin-right: -2px;
          }
          .teacher-my-attendance-summary-card {
            flex: 0 0 92px !important;
            min-width: 92px !important;
            padding: 10px 8px !important;
            border-radius: 12px !important;
          }
          .teacher-my-attendance-summary-card > div:first-child {
            font-size: 18px !important;
            margin-bottom: 2px !important;
          }
          .teacher-my-attendance-summary-card > div:nth-child(2) {
            font-size: 18px !important;
          }
          .teacher-my-attendance-summary-card > div:last-child {
            font-size: 8px !important;
            line-height: 1.15 !important;
            letter-spacing: 0 !important;
          }
        }
      `}</style>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontWeight: 1000 }}>📋 My Attendance</h1>
          <div style={{ marginTop: 4, color: palette.muted, fontWeight: 900, fontSize: 13 }}>
            View your attendance records and monthly summary.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={goToPreviousMonth} style={{
            width: 36, height: 36, borderRadius: 10, border: `1px solid ${palette.border}`,
            backgroundColor: "#fff", fontWeight: 1000, cursor: "pointer", fontSize: 16,
          }}>◀</button>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={{
            padding: "8px 12px", borderRadius: 10, border: `1px solid ${palette.border}`, fontWeight: 900,
          }}>
            {MONTH_NAMES.slice(1).map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{
            padding: "8px 12px", borderRadius: 10, border: `1px solid ${palette.border}`, fontWeight: 900,
          }}>
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button onClick={goToNextMonth} style={{
            width: 36, height: 36, borderRadius: 10, border: `1px solid ${palette.border}`,
            backgroundColor: "#fff", fontWeight: 1000, cursor: "pointer", fontSize: 16,
          }}>▶</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="teacher-my-attendance-summary-strip">
        <SummaryCard icon="✅" label="Present" value={summary.present ?? 0} color={palette.present} />
        <SummaryCard icon="❌" label="Absent" value={summary.absent ?? 0} color={palette.absent} />
        <SummaryCard icon="⏰" label="Late" value={summary.late ?? 0} color={palette.late} />
        <SummaryCard icon="📊" label="Attendance %" value={`${summary.attendance_pct ?? 0}%`} color={palette.primary} />
        <SummaryCard icon="📝" label="Total Marked" value={summary.total_marked ?? 0} />
      </div>

      {/* View Toggle */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        <button onClick={() => setView("calendar")} style={{
          padding: "10px 16px", borderRadius: 10, border: `1px solid ${palette.border}`,
          backgroundColor: view === "calendar" ? palette.primary : "#fff",
          color: view === "calendar" ? "#fff" : "#111827", fontWeight: 1000, cursor: "pointer",
        }}>📅 Calendar View</button>
        <button onClick={() => setView("table")} style={{
          padding: "10px 16px", borderRadius: 10, border: `1px solid ${palette.border}`,
          backgroundColor: view === "table" ? palette.primary : "#fff",
          color: view === "table" ? "#fff" : "#111827", fontWeight: 1000, cursor: "pointer",
        }}>📋 Table View</button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: palette.muted, fontWeight: 900 }}>Loading...</div>
      ) : !data ? (
        <div style={{
          textAlign: "center", padding: 40,
          background: palette.card, borderRadius: 16, border: `1px solid ${palette.border}`,
          color: palette.muted, fontWeight: 900,
        }}>No attendance data found for {MONTH_NAMES[month]} {year}.</div>
      ) : view === "calendar" ? (
        /* Calendar View */
        <div style={{
          background: palette.card, border: `1px solid ${palette.border}`, borderRadius: 16,
          padding: 16, boxShadow: palette.shadow,
        }}>
          <h3 style={{ margin: "0 0 12px", fontWeight: 1000 }}>
            {data.month_name} {data.year}
          </h3>
          {/* Weekday headers */}
          <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} style={{
                flex: "1 1 calc(14.28% - 6px)", minWidth: 38, textAlign: "center",
                fontWeight: 1000, fontSize: 11, color: palette.muted, textTransform: "uppercase",
                padding: "4px 0",
              }}>{d}</div>
            ))}
          </div>
          {/* Calendar grid */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {calendarGrid.map((day, idx) => (
              <CalendarDayCell key={idx} day={day} />
            ))}
          </div>
          {/* Legend */}
          <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap" }}>
            {[
              { label: "Present", color: palette.present, bg: "#dcfce7" },
              { label: "Absent", color: palette.absent, bg: "#fee2e2" },
              { label: "Late", color: palette.late, bg: "#fef3c7" },
              { label: "Not Marked", color: "#9ca3af", bg: "#f9fafb" },
            ].map((l) => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: l.bg, border: `1.5px solid ${l.color}` }} />
                <span style={{ fontSize: 12, fontWeight: 900, color: palette.muted }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Table View */
        <div style={{
          background: palette.card, border: `1px solid ${palette.border}`, borderRadius: 16,
          padding: 16, boxShadow: palette.shadow,
        }}>
          <h3 style={{ margin: "0 0 12px", fontWeight: 1000 }}>
            {data.month_name} {data.year} — Daily Records
          </h3>
          <div className="table-scroll"><table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#f1f5f9" }}>
                {["Date", "Day", "Status", "Punch In", "Punch Out", "Marked Via"].map((h) => (
                  <th key={h} style={{
                    padding: 10, textAlign: "left", color: palette.muted,
                    fontWeight: 1000, fontSize: 12,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {daily.length ? daily.map((d) => {
                const dateObj = new Date(d.date + "T00:00:00");
                const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });
                return (
                  <tr key={d.date} style={{ borderTop: `1px solid ${palette.border}` }}>
                    <td style={{ padding: 10, fontWeight: 1000 }}>{d.date}</td>
                    <td style={{ padding: 10, fontWeight: 900, color: palette.muted }}>{dayName}</td>
                    <td style={{ padding: 10 }}>
                      <span style={{
                        display: "inline-block", padding: "6px 14px", borderRadius: 999, fontWeight: 900, fontSize: 12,
                        backgroundColor: d.status === "present" ? "#dcfce7" : d.status === "absent" ? "#fee2e2" : d.status === "late" ? "#fef3c7" : "#f3f4f6",
                        color: d.status === "present" ? palette.present : d.status === "absent" ? palette.absent : d.status === "late" ? palette.late : "#111827",
                        border: `1px solid ${palette.border}`,
                      }}>
                        {d.status ? d.status.charAt(0).toUpperCase() + d.status.slice(1) : "—"}
                      </span>
                    </td>
                    <td style={{ padding: 10, fontWeight: 900, color: palette.muted, fontSize: 13 }}>
                      {d.punch_in_time ? new Date(d.punch_in_time).toLocaleTimeString() : "—"}
                    </td>
                    <td style={{ padding: 10, fontWeight: 900, color: palette.muted, fontSize: 13 }}>
                      {d.punch_out_time ? new Date(d.punch_out_time).toLocaleTimeString() : "—"}
                    </td>
                    <td style={{ padding: 10, fontWeight: 900, fontSize: 12 }}>
                      {d.marked_via ? (
                        <span style={{
                          padding: "4px 8px", borderRadius: 6,
                          backgroundColor: d.marked_via === "rfid" ? "#ede9fe" : "#f3f4f6",
                          color: d.marked_via === "rfid" ? "#7c3aed" : "#6b7280",
                          fontWeight: 1000, fontSize: 11, textTransform: "uppercase",
                        }}>{d.marked_via === "rfid" ? "🔑 RFID" : "✋ Manual"}</span>
                      ) : "—"}
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={6} style={{ padding: 14, color: palette.muted, fontWeight: 900 }}>
                  No records for this month.
                </td></tr>
              )}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
};

export default MyAttendance;
