import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../services/api";
import { useStudent } from "../../context/StudentContext";

const colors = {
  primary: "#2563eb",
  primaryLight: "#eff6ff",
  secondary: "#0f172a",
  success: "#10b981",
  successLight: "#ecfdf5",
  warning: "#f59e0b",
  warningLight: "#fffbeb",
  danger: "#ef4444",
  dangerLight: "#fef2f2",
  border: "#e2e8f0",
  text: "#1e293b",
  textMuted: "#64748b",
  white: "#ffffff",
  bg: "#f8fafc",
};

function parseYmd(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(
    parseInt(m[1], 10),
    parseInt(m[2], 10) - 1,
    parseInt(m[3], 10),
  );
}

export default function StudentExams() {
  const { selectedStudentId } = useStudent();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("exam");
  const highlightRef = useRef(null);

  const [exams, setExams] = useState([]);
  const [schedulesById, setSchedulesById] = useState({});
  const [loadingSched, setLoadingSched] = useState({});
  const [openExamIds, setOpenExamIds] = useState({});
  const [loading, setLoading] = useState(true);

  const loadSchedule = async (examId) => {
    if (schedulesById[examId]) return; // Already loaded
    setLoadingSched((prev) => ({ ...prev, [examId]: true }));
    try {
      const res = await api.get(`academics/exams/${examId}/schedule/`);
      setSchedulesById((prev) => ({ ...prev, [examId]: res.data || [] }));
    } catch {
      setSchedulesById((prev) => ({ ...prev, [examId]: [] }));
    } finally {
      setLoadingSched((prev) => ({ ...prev, [examId]: false }));
    }
  };

  useEffect(() => {
    setLoading(true);
    api
      .get("academics/exams/")
      .then((res) => {
        const list = res.data || [];
        const sorted = [...list].sort((a, b) => {
          const da = parseYmd(a.start_date || a.date);
          const db = parseYmd(b.start_date || b.date);
          if (!da && !db) return 0;
          if (!da) return 1;
          if (!db) return -1;
          return da - db;
        });
        setExams(sorted);
      })
      .finally(() => setLoading(false));
  }, [selectedStudentId]);

  useEffect(() => {
    if (!highlightId || !exams.length) return;
    const id = Number(highlightId);
    if (!Number.isFinite(id)) return;
    setOpenExamIds((prev) => ({ ...prev, [id]: true }));
    loadSchedule(id);
  }, [highlightId, exams]);

  useEffect(() => {
    if (highlightId && highlightRef.current) {
      highlightRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [highlightId, exams, schedulesById]);

  const today = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  const statusChip = (exam) => {
    const start = parseYmd(exam.start_date || exam.date);
    const end = parseYmd(exam.end_date || exam.start_date || exam.date);
    if (start && end) {
      if (today < start)
        return {
          label: "Upcoming",
          color: colors.primary,
          bg: colors.primaryLight,
        };
      if (today > end)
        return {
          label: "Finished",
          color: colors.textMuted,
          bg: colors.border,
        };
      return {
        label: "Ongoing",
        color: colors.warning,
        bg: colors.warningLight,
      };
    }
    return {
      label: exam.status || "—",
      color: colors.textMuted,
      bg: colors.bg,
    };
  };

  if (loading) {
    return (
      <div
        style={{
          padding: "40px",
          textAlign: "center",
          color: colors.textMuted,
          fontWeight: 700,
        }}
      >
        Synthesizing examination data...
      </div>
    );
  }

  if (!exams.length) {
    return (
      <div
        style={{
          padding: "60px 20px",
          textAlign: "center",
          border: `2px dashed ${colors.border}`,
          borderRadius: "24px",
          backgroundColor: colors.bg,
        }}
      >
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>📅</div>
        <h1
          style={{
            fontSize: "24px",
            fontWeight: 1000,
            color: colors.secondary,
          }}
        >
          No exams scheduled yet
        </h1>
        <p
          style={{ color: colors.textMuted, marginTop: "8px", fontWeight: 700 }}
        >
          When your timetable is published, you'll see it here.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ marginBottom: "32px" }}>
        <h1
          style={{
            fontSize: "36px",
            fontWeight: 1000,
            color: colors.secondary,
            letterSpacing: "-1px",
          }}
        >
          My Exams
        </h1>
        <p
          style={{
            color: colors.textMuted,
            marginTop: "6px",
            fontWeight: 700,
            fontSize: "15px",
          }}
        >
          View your upcoming assessments, dates, and subject-wise timetable.
        </p>
      </div>

      <div style={{ display: "grid", gap: "20px" }}>
        {exams.map((e) => {
          const chip = statusChip(e);
          const isHi = highlightId && String(e.id) === String(highlightId);
          const isOpen = openExamIds[e.id];

          return (
            <div
              key={e.id}
              ref={isHi ? highlightRef : null}
              style={{
                backgroundColor: colors.white,
                borderRadius: "24px",
                border: `1px solid ${isHi ? colors.primary : colors.border}`,
                boxShadow: isHi
                  ? `0 0 0 4px ${colors.primary}22`
                  : "0 4px 6px -1px rgba(0,0,0,0.05)",
                overflow: "hidden",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              <div style={{ padding: "24px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "16px",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        marginBottom: "8px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 1000,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          padding: "4px 10px",
                          borderRadius: "8px",
                          backgroundColor: chip.bg,
                          color: chip.color,
                        }}
                      >
                        {chip.label}
                      </span>
                      <span
                        style={{
                          color: colors.textMuted,
                          fontSize: "12px",
                          fontWeight: 800,
                        }}
                      >
                        {e.exam_type?.toUpperCase()}
                      </span>
                    </div>
                    <h2
                      style={{
                        fontSize: "22px",
                        fontWeight: 1000,
                        color: colors.secondary,
                        margin: 0,
                      }}
                    >
                      {e.name}
                    </h2>
                    <div
                      style={{
                        display: "flex",
                        gap: "16px",
                        marginTop: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: 700,
                          color: colors.text,
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        📅 {e.start_date}{" "}
                        <span style={{ color: colors.textMuted }}>→</span>{" "}
                        {e.end_date}
                      </div>
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: 700,
                          color: colors.text,
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        📊 {e.total_marks} Total Marks
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const next = !openExamIds[e.id];
                      setOpenExamIds((prev) => ({ ...prev, [e.id]: next }));
                      if (next) loadSchedule(e.id);
                    }}
                    style={{
                      padding: "12px 20px",
                      borderRadius: "12px",
                      border: "none",
                      backgroundColor: isOpen
                        ? colors.secondary
                        : colors.primary,
                      color: "#fff",
                      fontWeight: 900,
                      fontSize: "14px",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                  >
                    {isOpen ? "Hide Timetable" : "View Timetable"}
                  </button>
                </div>

                {e.description && (
                  <div
                    style={{
                      marginTop: "20px",
                      padding: "12px 16px",
                      borderRadius: "16px",
                      backgroundColor: colors.bg,
                      fontSize: "13px",
                      color: colors.textMuted,
                      fontWeight: 600,
                      lineHeight: "1.5",
                      borderLeft: `4px solid ${colors.primary}`,
                    }}
                  >
                    {e.description}
                  </div>
                )}

                {isOpen && (
                  <div
                    style={{
                      marginTop: "24px",
                      animation: "slideIn 0.3s ease-out",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "15px",
                        fontWeight: 1000,
                        color: colors.secondary,
                        marginBottom: "16px",
                      }}
                    >
                      Subject-wise Schedule
                    </div>
                    {loadingSched[e.id] ? (
                      <div
                        style={{
                          padding: "20px",
                          textAlign: "center",
                          color: colors.textMuted,
                        }}
                      >
                        Loading schedule...
                      </div>
                    ) : (schedulesById[e.id] || []).length === 0 ? (
                      <div
                        style={{
                          padding: "20px",
                          textAlign: "center",
                          color: colors.textMuted,
                          border: `1px dashed ${colors.border}`,
                          borderRadius: "16px",
                        }}
                      >
                        Timetable details are not yet available.
                      </div>
                    ) : (
                      <div
                        style={{
                          overflowX: "auto",
                          borderRadius: "16px",
                          border: `1px solid ${colors.border}`,
                        }}
                      >
                        <div className="table-scroll"><table
                          style={{ width: "100%", borderCollapse: "collapse" }}
                        >
                          <thead>
                            <tr style={{ backgroundColor: colors.bg }}>
                              <th
                                style={{
                                  padding: "12px 16px",
                                  textAlign: "left",
                                  fontSize: "12px",
                                  color: colors.textMuted,
                                  fontWeight: 800,
                                }}
                              >
                                SUBJECT
                              </th>
                              <th
                                style={{
                                  padding: "12px 16px",
                                  textAlign: "left",
                                  fontSize: "12px",
                                  color: colors.textMuted,
                                  fontWeight: 800,
                                }}
                              >
                                DATE
                              </th>
                              <th
                                style={{
                                  padding: "12px 16px",
                                  textAlign: "left",
                                  fontSize: "12px",
                                  color: colors.textMuted,
                                  fontWeight: 800,
                                }}
                              >
                                TIME
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {schedulesById[e.id].map((row) => (
                              <tr
                                key={row.id}
                                style={{
                                  borderTop: `1px solid ${colors.border}`,
                                }}
                              >
                                <td
                                  style={{
                                    padding: "14px 16px",
                                    fontWeight: 900,
                                    color: colors.text,
                                  }}
                                >
                                  {row.subject}
                                </td>
                                <td
                                  style={{
                                    padding: "14px 16px",
                                    fontWeight: 700,
                                    color: colors.text,
                                  }}
                                >
                                  {row.exam_date}
                                </td>
                                <td
                                  style={{
                                    padding: "14px 16px",
                                    fontWeight: 700,
                                    color: colors.primary,
                                  }}
                                >
                                  {row.start_time?.slice(0, 5)} –{" "}
                                  {row.end_time?.slice(0, 5)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table></div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
