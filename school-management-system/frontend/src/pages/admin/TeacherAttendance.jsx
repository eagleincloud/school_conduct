import React, { useEffect, useState, useMemo } from "react";
import {
  ChartNoAxesCombined,
  CheckCircle,
  ClipboardCheck,
  Clock,
  Save,
  UserCheck,
  UsersRound,
  X,
  XCircle,
} from "lucide-react";
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

function StatusBadge({ status }) {
  const s = (status || "").toLowerCase();
  let bg = "#f3f4f6";
  let color = "#111827";
  let label = "Unmarked";
  if (s === "present") { bg = "#dcfce7"; color = palette.present; label = "Present"; }
  else if (s === "absent") { bg = "#fee2e2"; color = palette.absent; label = "Absent"; }
  else if (s === "late") { bg = "#fef3c7"; color = palette.late; label = "Late"; }
  return (
    <span style={{
      display: "inline-block", padding: "6px 14px", borderRadius: 999,
      backgroundColor: bg, border: `1px solid ${palette.border}`,
      color, fontWeight: 900, fontSize: 12,
    }}>{label}</span>
  );
}

function SummaryCard({ label, value, color, Icon }) {
  return (
    <div style={{
      flex: "1 1 140px", minWidth: 140, background: palette.card,
      border: `1px solid ${palette.border}`, borderRadius: 16,
      padding: "18px 16px", boxShadow: palette.shadow, textAlign: "center",
    }}>
      <div style={{ marginBottom: 4, display: "flex", justifyContent: "center", color: color || palette.primary }}>
        <Icon size={28} strokeWidth={2.4} />
      </div>
      <div style={{ fontSize: 28, fontWeight: 1000, color: color || "#111827" }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 900, color: palette.muted, textTransform: "uppercase", letterSpacing: "0.03em", marginTop: 4 }}>{label}</div>
    </div>
  );
}

const TeacherAttendance = () => {
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [sheet, setSheet] = useState(null);
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState({ type: "", message: "" });
  const [search, setSearch] = useState("");

  // Monthly summary
  const [showMonthly, setShowMonthly] = useState(false);
  const [monthlySummary, setMonthlySummary] = useState(null);
  const [monthlyMonth, setMonthlyMonth] = useState(new Date().getMonth() + 1);
  const [monthlyYear, setMonthlyYear] = useState(new Date().getFullYear());

  const isEditable = !!sheet?.is_editable;

  const loadSheet = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get("attendance/staff/sheet/", { params: { date } });
      setSheet(res.data || null);
      setRows((res.data?.teachers || []).map((t) => ({ ...t, status: t.status || "" })));
    } catch {
      if (!silent) { setSheet(null); setRows([]); }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadMonthlySummary = async () => {
    try {
      const res = await api.get("attendance/staff/summary/", {
        params: { date, month: monthlyMonth, year: monthlyYear },
      });
      setMonthlySummary(res.data?.monthly || null);
    } catch { setMonthlySummary(null); }
  };

  useEffect(() => { loadSheet(); }, [date]);

  useEffect(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    if (date !== todayStr) return;
    const interval = setInterval(() => loadSheet(true), 5000);
    return () => clearInterval(interval);
  }, [date]);

  useEffect(() => {
    if (showMonthly) loadMonthlySummary();
  }, [showMonthly, monthlyMonth, monthlyYear]);

  const setTeacherStatus = (teacherId, status) => {
    if (!isEditable) return;
    setRows((prev) => prev.map((r) => (r.teacher_id === teacherId ? { ...r, status } : r)));
  };

  const markAllPresent = () => {
    if (!isEditable) return;
    setRows((prev) => prev.map((r) => ({ ...r, status: "present" })));
  };

  const saveAttendance = async () => {
    if (!isEditable) {
      setSaveStatus({ type: "error", message: "Past attendance records are view-only." });
      setTimeout(() => setSaveStatus({ type: "", message: "" }), 4000);
      return;
    }
    setSaving(true);
    setSaveStatus({ type: "", message: "" });
    try {
      const res = await api.post("attendance/staff/save/", {
        date,
        rows: rows.map((r) => ({ teacher_id: r.teacher_id, status: r.status })),
      });
      await loadSheet();
      const savedCount = Number(res?.data?.saved || 0);
      setSaveStatus({ type: "success", message: `Saved! ${savedCount} teacher(s) updated.` });
      setTimeout(() => setSaveStatus({ type: "", message: "" }), 4000);
    } catch (e) {
      setSaveStatus({ type: "error", message: e?.response?.data?.error || "Could not save." });
      setTimeout(() => setSaveStatus({ type: "", message: "" }), 4000);
    } finally { setSaving(false); }
  };

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => r.name?.toLowerCase().includes(q) || r.employee_id?.toLowerCase().includes(q));
  }, [rows, search]);

  const summary = sheet?.summary || {};

  return (
    <div style={{ padding: 20, backgroundColor: palette.bg, minHeight: "calc(100vh - 60px)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontWeight: 1000, display: "flex", alignItems: "center", gap: 10 }}>
            <UserCheck size={28} strokeWidth={2.4} />
            Teacher & Staff Attendance
          </h1>
          <div style={{ marginTop: 4, color: palette.muted, fontWeight: 900, fontSize: 13 }}>
            Mark attendance for teachers and staff. Past dates are view-only.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 1000, color: palette.muted, textTransform: "uppercase", letterSpacing: "0.03em" }}>Select Date</div>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{
              padding: "10px 12px", borderRadius: 12, border: `1px solid ${palette.border}`,
              backgroundColor: "#fff", fontWeight: 900,
            }} />
          </div>
          <button onClick={() => setShowMonthly(!showMonthly)} style={{
            padding: "10px 16px", borderRadius: 12, border: `1px solid ${palette.border}`,
            backgroundColor: showMonthly ? palette.primary : "#fff",
            color: showMonthly ? "#fff" : "#111827", fontWeight: 1000, cursor: "pointer",
          }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              {showMonthly ? <X size={16} strokeWidth={2.5} /> : <ChartNoAxesCombined size={16} strokeWidth={2.5} />}
              {showMonthly ? "Close Summary" : "Monthly Summary"}
            </span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <SummaryCard Icon={UsersRound} label="Total Staff" value={summary.total_teachers ?? 0} />
        <SummaryCard Icon={CheckCircle} label="Present" value={summary.present ?? 0} color={palette.present} />
        <SummaryCard Icon={XCircle} label="Absent" value={summary.absent ?? 0} color={palette.absent} />
        <SummaryCard Icon={Clock} label="Late" value={summary.late ?? 0} color={palette.late} />
        <SummaryCard Icon={ClipboardCheck} label="Marked" value={summary.marked ?? 0} />
      </div>

      {/* Monthly Summary Panel */}
      {showMonthly && (
        <div style={{
          background: palette.card, border: `1px solid ${palette.border}`, borderRadius: 16,
          padding: 16, boxShadow: palette.shadow, marginBottom: 16,
        }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontWeight: 1000, display: "flex", alignItems: "center", gap: 8 }}>
              <ChartNoAxesCombined size={20} strokeWidth={2.4} />
              Monthly Summary
            </h3>
            <select value={monthlyMonth} onChange={(e) => setMonthlyMonth(Number(e.target.value))} style={{
              padding: "8px 12px", borderRadius: 10, border: `1px solid ${palette.border}`, fontWeight: 900,
            }}>
              {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
            <select value={monthlyYear} onChange={(e) => setMonthlyYear(Number(e.target.value))} style={{
              padding: "8px 12px", borderRadius: 10, border: `1px solid ${palette.border}`, fontWeight: 900,
            }}>
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button onClick={loadMonthlySummary} style={{
              padding: "8px 14px", borderRadius: 10, border: "none",
              backgroundColor: palette.primary, color: "#fff", fontWeight: 1000, cursor: "pointer",
            }}>Load</button>
          </div>

          {monthlySummary?.teacher_stats?.length ? (
            <div className="table-scroll"><table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f1f5f9" }}>
                  {["Name", "Employee ID", "Present", "Absent", "Late", "Total Marked", "Attendance %"].map((h) => (
                    <th key={h} style={{ padding: 10, textAlign: "left", color: palette.muted, fontWeight: 1000, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthlySummary.teacher_stats.map((t) => (
                  <tr key={t.teacher_id} style={{ borderTop: `1px solid ${palette.border}` }}>
                    <td style={{ padding: 10, fontWeight: 1000 }}>{t.name}</td>
                    <td style={{ padding: 10, fontWeight: 900, color: palette.muted, fontSize: 13 }}>{t.employee_id}</td>
                    <td style={{ padding: 10, fontWeight: 1000, color: palette.present }}>{t.present}</td>
                    <td style={{ padding: 10, fontWeight: 1000, color: palette.absent }}>{t.absent}</td>
                    <td style={{ padding: 10, fontWeight: 1000, color: palette.late }}>{t.late}</td>
                    <td style={{ padding: 10, fontWeight: 900 }}>{t.total_marked}</td>
                    <td style={{ padding: 10, fontWeight: 1000 }}>
                      <span style={{
                        padding: "4px 10px", borderRadius: 8,
                        backgroundColor: t.attendance_pct >= 90 ? "#dcfce7" : t.attendance_pct >= 75 ? "#fef3c7" : "#fee2e2",
                        color: t.attendance_pct >= 90 ? palette.present : t.attendance_pct >= 75 ? palette.late : palette.absent,
                        fontWeight: 1000, fontSize: 12,
                      }}>{t.attendance_pct}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          ) : (
            <div style={{ color: palette.muted, fontWeight: 900, fontSize: 13 }}>
              No monthly data available. Select month/year and click Load.
            </div>
          )}
        </div>
      )}

      {/* Main Attendance Card */}
      <div style={{
        backgroundColor: palette.card, border: `1px solid ${palette.border}`, borderRadius: 16,
        padding: 16, boxShadow: palette.shadow,
      }}>
        {/* Card Header with actions */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 1000, fontSize: 16 }}>Staff Attendance Sheet</div>
            <div style={{ marginTop: 3, color: palette.muted, fontWeight: 900, fontSize: 13 }}>
              {date} — {isEditable ? "Editable (Today)" : "View Only (Past Date)"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {/* Search */}
            <input
              type="text" placeholder="Search by name or ID..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: "10px 12px", borderRadius: 12, border: `1px solid ${palette.border}`,
                backgroundColor: "#fff", fontWeight: 900, minWidth: 200,
              }}
            />
            {isEditable && (
              <>
                <button type="button" onClick={markAllPresent} style={{
                  padding: "10px 14px", borderRadius: 10, border: `1px solid ${palette.border}`,
                  backgroundColor: "#fff", fontWeight: 1000, cursor: "pointer",
                }}>Mark All Present</button>
                <button type="button" onClick={saveAttendance} disabled={saving} style={{
                  padding: "10px 14px", borderRadius: 10, border: "none",
                  backgroundColor: palette.primary, color: "#fff", fontWeight: 1000,
                  cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1,
                }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    {!saving && <Save size={16} strokeWidth={2.5} />}
                    {saving ? "Saving..." : "Save Attendance"}
                  </span>
                </button>
              </>
            )}
            {saveStatus.message && (
              <span style={{
                padding: "8px 12px", borderRadius: 10,
                backgroundColor: saveStatus.type === "success" ? "#dcfce7" : "#fee2e2",
                color: saveStatus.type === "success" ? palette.present : palette.absent,
                fontWeight: 900, fontSize: 12,
                border: `1px solid ${saveStatus.type === "success" ? "#bbf7d0" : "#fecaca"}`,
              }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {saveStatus.type === "success" ? (
                    <CheckCircle size={15} strokeWidth={2.5} />
                  ) : (
                    <XCircle size={15} strokeWidth={2.5} />
                  )}
                  {saveStatus.message}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* View-only banner */}
        {!isEditable && sheet && (
          <div style={{
            marginTop: 10, border: "1px solid #fde68a", background: "#fffbeb",
            color: "#a16207", borderRadius: 10, padding: "8px 10px", fontWeight: 900, fontSize: 12,
          }}>
            This is a previous date record. You can view attendance but cannot edit or change it.
          </div>
        )}

        {/* Teacher Table */}
        <div style={{ marginTop: 12, overflowX: "auto" }}>
          <div className="table-scroll"><table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#f1f5f9" }}>
                {["Teacher Name", "Employee ID", "Punch In", "Punch Out", "Via", "Status", ...(isEditable ? ["Action"] : [])].map((h) => (
                  <th key={h} style={{
                    padding: 12, textAlign: "left", color: palette.muted,
                    fontWeight: 1000, fontSize: 12,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: 14, color: palette.muted, fontWeight: 900 }}>Loading...</td></tr>
              ) : filteredRows.length ? (
                filteredRows.map((t) => (
                  <tr key={t.teacher_id} style={{ borderTop: `1px solid ${palette.border}` }}>
                    <td style={{ padding: 12, fontWeight: 1000 }}>{t.name}</td>
                    <td style={{ padding: 12, fontWeight: 900, color: palette.muted, fontSize: 13 }}>{t.employee_id}</td>
                    <td style={{ padding: 12, fontWeight: 900, color: palette.muted, fontSize: 13 }}>
                      {t.punch_in_time ? new Date(t.punch_in_time).toLocaleTimeString() : "—"}
                    </td>
                    <td style={{ padding: 12, fontWeight: 900, color: palette.muted, fontSize: 13 }}>
                      {t.punch_out_time ? new Date(t.punch_out_time).toLocaleTimeString() : "—"}
                    </td>
                    <td style={{ padding: 12, fontWeight: 900, fontSize: 12 }}>
                      {t.marked_via ? (
                        <span style={{
                          padding: "4px 8px", borderRadius: 6,
                          backgroundColor: t.marked_via === "rfid" ? "#ede9fe" : "#f3f4f6",
                          color: t.marked_via === "rfid" ? "#7c3aed" : "#6b7280",
                          fontWeight: 1000, fontSize: 11, textTransform: "uppercase",
                        }}>{t.marked_via === "rfid" ? "🔑 RFID" : "✋ Manual"}</span>
                      ) : "—"}
                    </td>
                    <td style={{ padding: 12 }}><StatusBadge status={t.status} /></td>
                    {isEditable && (
                      <td style={{ padding: 12, whiteSpace: "nowrap" }}>
                        <button type="button" onClick={() => setTeacherStatus(t.teacher_id, "present")} style={{
                          padding: "8px 12px", marginRight: 6, borderRadius: 10, border: "none",
                          backgroundColor: "#16a34a", color: "#fff", fontWeight: 1000, cursor: "pointer",
                        }}>P</button>
                        <button type="button" onClick={() => setTeacherStatus(t.teacher_id, "absent")} style={{
                          padding: "8px 12px", marginRight: 6, borderRadius: 10, border: "none",
                          backgroundColor: "#ef4444", color: "#fff", fontWeight: 1000, cursor: "pointer",
                        }}>A</button>
                        <button type="button" onClick={() => setTeacherStatus(t.teacher_id, "late")} style={{
                          padding: "8px 12px", borderRadius: 10, border: "none",
                          backgroundColor: "#f59e0b", color: "#fff", fontWeight: 1000, cursor: "pointer",
                        }}>L</button>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr><td colSpan={7} style={{ padding: 14, color: palette.muted, fontWeight: 900 }}>
                  {search ? "No teachers match your search." : "No teachers found for this school."}
                </td></tr>
              )}
            </tbody>
          </table></div>
        </div>
      </div>
    </div>
  );
};

export default TeacherAttendance;
