import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import useAuthStore from "../../store/authStore";
import { useStudent } from "../../context/StudentContext";

const colors = {
  bg: "#f9fafb",
  card: "#ffffff",
  text: "#111827",
  muted: "#6b7280",
  border: "#e5e7eb",
  primary: "#2563eb",
  present: "#16a34a",
  late: "#f59e0b",
  absent: "#ef4444",
  holiday: "#9ca3af",
  warnBg: "#fff7ed",
  warnText: "#991b1b",
  shadow: "0 1px 6px rgba(16,24,40,0.06)",
};

function parseDateOnly(value) {
  if (typeof value !== "string") return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  return new Date(y, mo - 1, d);
}

function toDateKey(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatStatus(statusValue) {
  const s = (statusValue || "").toLowerCase();
  if (s === "present") return "Present";
  if (s === "late") return "Late";
  if (s === "absent") return "Absent";
  return (statusValue || "").toString();
}

function statusColor(statusValue) {
  const s = (statusValue || "").toLowerCase();
  if (s === "present") return colors.present;
  if (s === "late") return colors.late;
  if (s === "absent") return colors.absent;
  return "#111827";
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function MiniProgress({ percentage, height = 10 }) {
  const pct = clamp(Number(percentage) || 0, 0, 100);
  const isLow = pct < 75;
  return (
    <div
      className="dashboard-shell" style={{
        height,
        borderRadius: 999,
        backgroundColor: "#f3f4f6",
        border: `1px solid ${colors.border}`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          backgroundColor: isLow ? colors.absent : colors.primary,
          borderRadius: 999,
          transition: "width 300ms ease",
        }}
      />
    </div>
  );
}

function CircularProgress({ percentage }) {
  const pct = clamp(Number(percentage) || 0, 0, 100);
  const size = 56;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const isLow = pct < 75;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#e5e7eb"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={isLow ? colors.absent : colors.primary}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div>
        <div
          style={{ fontWeight: 1000, color: isLow ? colors.absent : "#111827" }}
        >
          {pct.toFixed(1)}%
        </div>
        <div style={{ fontSize: 12, fontWeight: 900, color: colors.muted }}>
          Overall
        </div>
      </div>
    </div>
  );
}

function Sparkline({ points, color = colors.primary }) {
  const width = 260;
  const height = 110;
  const padding = 10;
  if (!points || points.length < 2)
    return (
      <div style={{ color: colors.muted, fontWeight: 900, fontSize: 12 }}>
        No data
      </div>
    );
  const ys = points.map((p) => p.y);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 100);
  const xScale = (idx) =>
    padding + ((width - padding * 2) * idx) / (points.length - 1);
  const yScale = (y) =>
    height -
    padding -
    ((height - padding * 2) * (y - minY)) / (maxY - minY || 1);
  const linePath = points
    .map((p, i) => {
      const x = xScale(i);
      const y = yScale(p.y);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  const areaPath = `${linePath} L ${xScale(points.length - 1)} ${height - padding} L ${xScale(0)} ${height - padding} Z`;

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`}>
        {[0.25, 0.5, 0.75].map((ratio) => {
          const y = padding + (height - padding * 2) * ratio;
          return (
            <line
              key={ratio}
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              stroke="#e5e7eb"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          );
        })}
        <path d={areaPath} fill={color} opacity="0.12" />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
        />
        {points.map((p, i) => {
          const x = xScale(i);
          const y = yScale(p.y);
          return (
            <circle
              key={`${p.x}-${i}`}
              cx={x}
              cy={y}
              r="4.5"
              fill="#fff"
              stroke={color}
              strokeWidth="2"
            />
          );
        })}
      </svg>
    </div>
  );
}

function Icon({ children }) {
  return (
    <div
      style={{
        width: 34,
        height: 34,
        borderRadius: 12,
        backgroundColor: "#eef2ff",
        color: colors.primary,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div
      style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        border: `1px solid ${colors.border}`,
        boxShadow: colors.shadow,
        padding: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {icon}
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 1000,
              color: colors.muted,
              textTransform: "uppercase",
              letterSpacing: "0.03em",
            }}
          >
            {subtitle || ""}
          </div>
          <div style={{ fontWeight: 1000, color: colors.text }}>{title}</div>
        </div>
      </div>
    </div>
  );
}

function formatMoneyMaybe(v) {
  if (v === null || v === undefined) return "₹0";
  const n = Number(v);
  if (Number.isNaN(n)) return `₹${v}`;
  return `₹${n.toFixed(0)}`;
}

const dayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "light",
  );
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [assignmentSubmissions, setAssignmentSubmissions] = useState([]);
  const [exams, setExams] = useState([]);
  const [results, setResults] = useState([]);
  const [feeRecords, setFeeRecords] = useState([]);

  const { selectedStudentId, setSelectedStudentId } = useStudent();

  const fetchDashboardData = async (studentId) => {
    setLoading(true);
    try {
      const url = studentId
        ? `students/dashboard/?student_id=${studentId}`
        : "students/dashboard/";
      const res = await api.get(url);
      const data = res.data;

      setProfile(data.profile || null);
      setAttendance(data.attendance || []);
      setTimetable(data.timetable || []);
      setNotifications(data.notifications || []);
      setAssignments(data.assignments || []);
      setAssignmentSubmissions(data.assignment_submissions || []);
      setExams(data.exams || []);
      setResults(data.results || []);
      setFeeRecords(data.fees || []);

      if (!selectedStudentId && data.profile) {
        setSelectedStudentId(data.profile.id);
      }
    } catch (e) {
      console.error("Failed to fetch dashboard data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(selectedStudentId);
  }, [selectedStudentId]);

  useEffect(() => {
    localStorage.setItem("theme", theme);
  }, [theme]);

  const themeStyles = useMemo(() => {
    if (theme === "dark") {
      return {
        background: "#0b1220",
        cardBg: "#0f172a",
        cardBorder: "#23304a",
        text: "#e5e7eb",
        muted: "#9ca3af",
        shadow: "0 1px 10px rgba(0,0,0,0.35)",
      };
    }
    return {
      background: colors.bg,
      cardBg: colors.card,
      cardBorder: colors.border,
      text: colors.text,
      muted: colors.muted,
      shadow: colors.shadow,
    };
  }, [theme]);

  const attendanceMap = useMemo(() => {
    const map = new Map();
    (attendance || []).forEach((r) => {
      const d = parseDateOnly(r.date);
      if (!d) return;
      map.set(toDateKey(d), r);
    });
    return map;
  }, [attendance]);

  const overallAttendance = useMemo(() => {
    let present = 0;
    let absent = 0;
    (attendance || []).forEach((r) => {
      const v = (r.verification_status || "").toLowerCase();
      if (v === "pending") return; // ignore unverified punches
      if (v === "approved") {
        // Approved counts as present (late still shows as late via r.status when needed).
        const st = (r.status || "").toLowerCase();
        if (st === "present" || st === "late") present += 1;
        return;
      }
      if (v === "rejected") {
        absent += 1;
        return;
      }

      // Legacy fallback for records created before verification workflow.
      const st = (r.status || "").toLowerCase();
      if (st === "present" || st === "late") present += 1;
      else if (st === "absent") absent += 1;
    });
    const total = present + absent;
    const percentage = total ? (present / total) * 100 : 0;
    return { present, absent, total, percentage };
  }, [attendance]);

  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const todayAttendance = useMemo(
    () => attendanceMap.get(todayKey) || null,
    [attendanceMap, todayKey],
  );
  const todayPresence = useMemo(() => {
    if (!todayAttendance) return null;
    const v = (todayAttendance.verification_status || "").toLowerCase();
    if (v === "pending") return null;
    if (v === "rejected") return "Absent";
    if (v === "approved") return "Present";

    // Legacy fallback
    const st = (todayAttendance.status || "").toLowerCase();
    if (st === "absent") return "Absent";
    if (st === "present" || st === "late") return "Present";
    return null;
  }, [todayAttendance]);
  const todayIsLate = useMemo(() => {
    const v = (todayAttendance?.verification_status || "").toLowerCase();
    if (v === "pending") return false;
    if (v && v !== "approved") return false;
    const st = (todayAttendance?.status || "").toLowerCase();
    return st === "late";
  }, [todayAttendance]);

  const subjectsCount = useMemo(() => {
    const set = new Set(
      (timetable || []).map((t) => t.subject).filter(Boolean),
    );
    return set.size;
  }, [timetable]);

  const todayDayName = useMemo(() => dayNames[new Date().getDay()], []);
  const todayDayNumber = useMemo(() => {
    const d = new Date().getDay();
    return d === 0 ? 7 : d; // Sunday->7 (no timetable), Mon->1 ... Sat->6
  }, []);
  const todayTimetable = useMemo(() => {
    return (timetable || []).filter((t) => Number(t.day) === todayDayNumber);
  }, [timetable, todayDayNumber]);

  const currentClass = useMemo(() => {
    const toMinutes = (timeStr) => {
      if (!timeStr) return null;
      const parts = timeStr.toString().split(":");
      if (parts.length < 2) return null;
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (Number.isNaN(h) || Number.isNaN(m)) return null;
      return h * 60 + m;
    };
    const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
    return (
      todayTimetable.find((t) => {
        const startM = toMinutes(t.start_time);
        const endM = toMinutes(t.end_time);
        if (startM === null || endM === null) return false;
        return nowMins >= startM && nowMins <= endM;
      }) || null
    );
  }, [todayTimetable]);

  const unreadNotices = useMemo(
    () => (notifications || []).filter((n) => !n.is_read).slice(0, 3),
    [notifications],
  );
  const latestNotices = useMemo(
    () => (notifications || []).slice(0, 5),
    [notifications],
  );

  const assignmentSubmissionMap = useMemo(() => {
    const map = new Map();
    (assignmentSubmissions || []).forEach((s) =>
      map.set(Number(s.assignment_id), s),
    );
    return map;
  }, [assignmentSubmissions]);

  const assignmentsWithStatus = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const inDays = (d) => {
      const dt = parseDateOnly(d);
      if (!dt) return null;
      const t = new Date(
        dt.getFullYear(),
        dt.getMonth(),
        dt.getDate(),
      ).getTime();
      return Math.round((t - today.getTime()) / (1000 * 60 * 60 * 24));
    };

    return (assignments || []).map((a) => {
      const dueInDays = inDays(a.due_date);
      const submitted = assignmentSubmissionMap.get(Number(a.id))
        ? true
        : false;
      const status = submitted ? "Submitted" : "Pending";
      const subject = a.title?.includes("-")
        ? a.title.split("-")[0].trim()
        : "General";
      const isPendingSoon =
        !submitted && dueInDays !== null && dueInDays >= 0 && dueInDays <= 3;
      return { ...a, dueInDays, submitted, status, subject, isPendingSoon };
    });
  }, [assignments, assignmentSubmissionMap]);

  const upcomingExams = useMemo(() => {
    const today = new Date();
    const todayDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const toDate = (exam) => {
      const raw = exam.start_date || exam.date || exam.end_date;
      const d = parseDateOnly(String(raw || ""));
      return d;
    };

    return (exams || [])
      .map((e) => {
        const d = toDate(e);
        return { ...e, _examDate: d };
      })
      .filter((e) => e._examDate)
      .filter((e) => {
        const t = new Date(
          e._examDate.getFullYear(),
          e._examDate.getMonth(),
          e._examDate.getDate(),
        ).getTime();
        return t >= todayDate.getTime();
      })
      .sort((a, b) => a._examDate - b._examDate)
      .slice(0, 6);
  }, [exams]);

  const examsCount = upcomingExams.length;

  const latestResultsPreview = useMemo(() => {
    if (!results || results.length === 0) return null;
    // Results are ordered by exam start date desc; first exam_name block is the latest.
    const firstExamName = results[0].exam_name;
    const latestRows = results.filter((r) => r.exam_name === firstExamName);
    const avg = latestRows.length
      ? latestRows.reduce((s, r) => s + (Number(r.percentage) || 0), 0) /
        latestRows.length
      : 0;
    const grade = latestRows[0]?.grade || "";
    const statusText = latestRows[0]?.result_status || "";
    return {
      exam_name: firstExamName,
      avg,
      grade,
      statusText,
      rows: latestRows,
    };
  }, [results]);

  const resultsTrendPoints = useMemo(() => {
    if (!results || results.length === 0) return [];
    const examOrder = [];
    const seen = new Set();
    const groups = new Map(); // exam_id -> {sum,count,name}
    (results || []).forEach((r) => {
      const key = r.exam;
      if (!groups.has(key)) {
        groups.set(key, { sum: 0, count: 0, name: r.exam_name });
        if (!seen.has(key)) {
          examOrder.push(key);
          seen.add(key);
        }
      }
      const g = groups.get(key);
      g.sum += Number(r.percentage) || 0;
      g.count += 1;
    });
    const points = examOrder.slice(0, 8).map((key, idx) => {
      const g = groups.get(key);
      const y = g.count ? g.sum / g.count : 0;
      return { x: idx, y };
    });
    return points;
  }, [results]);

  const attendanceTrendPoints = useMemo(() => {
    // Weekly trend from last ~4 weeks.
    if (!attendance || attendance.length === 0) return [];
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(end);
    start.setDate(start.getDate() - 27);

    // Bucket by week index relative to start.
    const buckets = new Map(); // idx -> {marked, attended}
    (attendance || []).forEach((r) => {
      const d = parseDateOnly(r.date);
      if (!d) return;
      const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      if (dt < start.getTime() || dt > end.getTime()) return;
      const weekIdx = Math.floor(
        (dt - start.getTime()) / (1000 * 60 * 60 * 24 * 7),
      );
      const b = buckets.get(weekIdx) || { marked: 0, attended: 0 };
      b.marked += 1;
      const st = (r.status || "").toLowerCase();
      const attended = st === "present" || st === "late" ? 1 : 0;
      b.attended += attended;
      buckets.set(weekIdx, b);
    });

    const idxs = Array.from(buckets.keys())
      .sort((a, b) => a - b)
      .slice(0, 6);
    return idxs.map((idx, i) => {
      const b = buckets.get(idx);
      const y = b.marked ? (b.attended / b.marked) * 100 : 0;
      return { x: i, y };
    });
  }, [attendance]);

  const studentAlerts = useMemo(() => {
    const alerts = [];

    if (overallAttendance.total > 0 && overallAttendance.percentage < 75) {
      alerts.push({
        kind: "warning",
        title: "Low attendance",
        message: `Your attendance is ${overallAttendance.percentage.toFixed(1)}%. Please improve.`,
      });
    }

    const nextAssign = assignmentsWithStatus
      .filter((a) => a.status === "Pending")
      .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))[0];
    if (nextAssign) {
      alerts.push({
        kind: "info",
        title: "Assignment deadline",
        message: `${nextAssign.title} is due on ${nextAssign.due_date}.`,
      });
    }

    const nextExam = upcomingExams[0];
    if (nextExam) {
      const examDate =
        nextExam.start_date || nextExam.date || nextExam.end_date;
      alerts.push({
        kind: "info",
        title: "Exam reminder",
        message: `${nextExam.name} on ${examDate}.`,
      });
    }

    // Add unread notices on top.
    unreadNotices.forEach((n) => {
      alerts.push({
        kind: "notice",
        title: n.title,
        message: n.message,
      });
    });

    return alerts.slice(0, 6);
  }, [overallAttendance, assignmentsWithStatus, upcomingExams, unreadNotices]);

  const feeSummary = useMemo(() => {
    if (!feeRecords || feeRecords.length === 0) return null;
    // Prefer an unpaid/overdue record if exists.
    const unpaid = feeRecords.find((f) => f.status !== "paid") || feeRecords[0];
    const paidCount = feeRecords.filter((f) => f.status === "paid").length;
    return { unpaid, paidCount, totalRecords: feeRecords.length };
  }, [feeRecords]);

  const wrapperStyle =
    theme === "dark"
      ? {
          backgroundColor: themeStyles.background,
          color: themeStyles.text,
          minHeight: "calc(100vh - 60px)",
          padding: 20,
        }
      : {
          backgroundColor: themeStyles.background,
          color: themeStyles.text,
          minHeight: "calc(100vh - 60px)",
          padding: 20,
        };

  if (loading) {
    return (
      <div style={wrapperStyle}>
        <div style={{ fontWeight: 1000, marginBottom: 12 }}>
          Loading dashboard…
        </div>
        <div
          className="rg-autofit-sm" style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
          }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 120,
                borderRadius: 16,
                border: `1px solid ${themeStyles.cardBorder}`,
                backgroundColor: themeStyles.cardBg,
                boxShadow: themeStyles.shadow,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  const cardStyle = {
    backgroundColor: themeStyles.cardBg,
    border: `1px solid ${themeStyles.cardBorder}`,
    boxShadow: themeStyles.shadow,
    color: themeStyles.text,
  };
  const topCardStyle = { ...cardStyle, minHeight: 180 };
  const midCardStyle = { ...cardStyle, minHeight: 370 };
  const largeCardStyle = { ...cardStyle, minHeight: 420 };

  return (
    <div style={wrapperStyle}>
      <div
        style={{
          ...cardStyle,
          padding: 24,
          borderRadius: 20,
          marginBottom: 20,
          background: "linear-gradient(135deg, #fff 0%, #f8fafc 100%)",
          border: "none",
          position: "relative",
          overflow: "visible",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -30,
            right: -30,
            width: 200,
            height: 200,
            background: "rgba(37, 99, 235, 0.03)",
            borderRadius: "50%",
            zIndex: 0,
          }}
        ></div>
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                backgroundColor: colors.primary,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 1000,
                color: "#fff",
                fontSize: 24,
                boxShadow: "0 4px 12px rgba(37, 99, 235, 0.2)",
              }}
            >
              {profile?.name ? profile.name.slice(0, 1).toUpperCase() : "S"}
            </div>
            <div>
              <h1
                style={{
                  margin: 0,
                  fontWeight: 1000,
                  fontSize: 30,
                  letterSpacing: "-0.02em",
                  background:
                    "linear-gradient(90deg, #1e293b 0%, #2563eb 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Welcome Student Dashboard
              </h1>
              <p
                style={{
                  margin: "4px 0 0",
                  color: themeStyles.muted,
                  fontWeight: 900,
                  fontSize: 16,
                }}
              >
                Hello,{" "}
                <span style={{ color: colors.primary }}>
                  {profile?.name || "Student"}
                </span>
                !{" "}
                {profile
                  ? `(${profile.class_section_display || profile.class_name})`
                  : ""}
              </p>

              {profile?.admission_number ? (
                <div
                  style={{
                    marginTop: 2,
                    color: themeStyles.muted,
                    fontWeight: 900,
                    fontSize: 12,
                    opacity: 0.8,
                  }}
                >
                  Roll No: {profile.admission_number}
                </div>
              ) : null}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: `1px solid ${themeStyles.cardBorder}`,
                background: theme === "dark" ? "#0f172a" : "#fff",
                cursor: "pointer",
                fontWeight: 1000,
              }}
            >
              {theme === "dark" ? "Light" : "Dark"} Mode
            </button>

            <button
              type="button"
              onClick={() => {
                logout();
                localStorage.removeItem("selectedStudentId");
                navigate("/login");
              }}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "none",
                backgroundColor: colors.primary,
                color: "#fff",
                cursor: "pointer",
                fontWeight: 1000,
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div
        className="rg-12" style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        <div style={{ gridColumn: "span 6" }}>
          <Card style={{ ...topCardStyle }}>
            <SectionHeader
              icon={
                <Icon>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 8v4l2 2" />
                    <path d="M21 12a9 9 0 1 1-18 0a9 9 0 0 1 18 0z" />
                  </svg>
                </Icon>
              }
              title="Today’s Attendance"
              subtitle="Today"
            />
            <div
              style={{
                marginTop: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  fontWeight: 1000,
                  fontSize: 26,
                  color: todayAttendance
                    ? todayAttendance.verification_status?.toLowerCase() ===
                      "rejected"
                      ? colors.absent
                      : todayAttendance.verification_status?.toLowerCase() ===
                          "pending"
                        ? colors.late
                        : colors.present
                    : themeStyles.muted,
                }}
              >
                {todayPresence ||
                  (todayAttendance?.verification_status?.toLowerCase() ===
                  "pending"
                    ? "Pending"
                    : "—")}
              </div>
              <div
                style={{
                  width: 1,
                  height: 36,
                  backgroundColor: themeStyles.cardBorder,
                  display: "none",
                }}
              />
              <div
                style={{
                  color: themeStyles.muted,
                  fontWeight: 900,
                  fontSize: 13,
                }}
              >
                Marked Via: {todayAttendance?.marked_via || "—"}
                {todayIsLate ? (
                  <span
                    style={{
                      marginLeft: 10,
                      fontSize: 11,
                      fontWeight: 1000,
                      color: colors.late,
                    }}
                  >
                    Late
                  </span>
                ) : null}
              </div>
            </div>
          </Card>
        </div>

        <div style={{ gridColumn: "span 6" }}>
          <Card style={{ ...topCardStyle }}>
            <SectionHeader
              icon={
                <Icon>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 12h-4l-2 3-2-6-2 3H2" />
                    <path d="M5 21h14" />
                  </svg>
                </Icon>
              }
              title="Overall Attendance"
              subtitle="Progress"
            />
            <div style={{ marginTop: 10 }}>
              <CircularProgress percentage={overallAttendance.percentage} />
            </div>
            <div style={{ marginTop: 12 }}>
              <MiniProgress percentage={overallAttendance.percentage} />
            </div>
            {overallAttendance.total > 0 &&
            overallAttendance.percentage < 75 ? (
              <div
                style={{
                  marginTop: 12,
                  padding: "10px 12px",
                  borderRadius: 12,
                  backgroundColor: colors.warnBg,
                  border: `1px solid #fecaca`,
                  color: colors.warnText,
                  fontWeight: 900,
                }}
              >
                Warning: attendance below 75%
              </div>
            ) : null}
          </Card>
        </div>
      </div>

      {/* Main grid */}
      <div
        className="rg-12" style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        <div style={{ gridColumn: "span 7" }}>
          <Card style={{ ...largeCardStyle, height: "100%" }}>
            <SectionHeader
              icon={
                <Icon>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 10H3" />
                    <path d="M21 6H3" />
                    <path d="M21 14H3" />
                    <path d="M21 18H3" />
                  </svg>
                </Icon>
              }
              title="Today's Timetable"
              subtitle={todayDayName}
            />
            <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
              {todayTimetable.length ? (
                <>
                  {todayTimetable
                    .slice()
                    .sort((a, b) =>
                      String(a.start_time).localeCompare(String(b.start_time)),
                    )
                    .map((t) => {
                      const isCurrent =
                        currentClass && currentClass.id === t.id;
                      return (
                        <div
                          key={t.id}
                          style={{
                            padding: "16px",
                            borderRadius: 16,
                            border: `1px solid ${isCurrent ? colors.primary : themeStyles.cardBorder}`,
                            backgroundColor: isCurrent
                              ? theme === "dark"
                                ? "#1e293b"
                                : "#eff6ff"
                              : themeStyles.cardBg,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 12,
                            position: "relative",
                            transition: "transform 0.2s",
                            boxShadow: isCurrent
                              ? "0 4px 12px rgba(37, 99, 235, 0.1)"
                              : "none",
                          }}
                        >
                          {isCurrent && (
                            <div
                              style={{
                                position: "absolute",
                                left: 0,
                                top: "20%",
                                bottom: "20%",
                                width: 4,
                                backgroundColor: colors.primary,
                                borderRadius: "0 4px 4px 0",
                              }}
                            ></div>
                          )}
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              <div
                                style={{
                                  fontWeight: 1000,
                                  color: isCurrent
                                    ? colors.primary
                                    : themeStyles.text,
                                  fontSize: 15,
                                }}
                              >
                                {t.subject || "—"}
                              </div>
                              {isCurrent && (
                                <span
                                  style={{
                                    padding: "2px 8px",
                                    borderRadius: 99,
                                    backgroundColor: colors.primary,
                                    color: "#fff",
                                    fontSize: 10,
                                    fontWeight: 1000,
                                    textTransform: "uppercase",
                                    animation: "pulse 2s infinite",
                                  }}
                                >
                                  Live Now
                                </span>
                              )}
                            </div>
                            <div
                              style={{
                                marginTop: 4,
                                color: themeStyles.muted,
                                fontWeight: 900,
                                fontSize: 13,
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                              </svg>
                              {t.teacher_name || t.teacher || "—"}
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div
                              style={{
                                fontWeight: 1000,
                                color: isCurrent
                                  ? colors.primary
                                  : themeStyles.text,
                                fontSize: 14,
                              }}
                            >
                              {t.start_time_display || t.start_time}
                            </div>
                            <div
                              style={{
                                color: themeStyles.muted,
                                fontWeight: 900,
                                fontSize: 12,
                              }}
                            >
                              to {t.end_time_display || t.end_time}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  <button
                    type="button"
                    onClick={() => navigate("/student/timetable")}
                    style={{
                      marginTop: 8,
                      width: "100%",
                      padding: "12px",
                      borderRadius: 14,
                      border: `1px solid ${themeStyles.cardBorder}`,
                      backgroundColor: "transparent",
                      color: colors.primary,
                      cursor: "pointer",
                      fontWeight: 1000,
                      fontSize: 13,
                      transition: "all 0.2s",
                    }}
                    onMouseOver={(e) =>
                      (e.target.style.backgroundColor = "#eff6ff")
                    }
                    onMouseOut={(e) =>
                      (e.target.style.backgroundColor = "transparent")
                    }
                  >
                    View Full Weekly Schedule
                  </button>
                </>
              ) : (
                <div
                  style={{
                    padding: "40px 20px",
                    textAlign: "center",
                    color: themeStyles.muted,
                    backgroundColor: theme === "dark" ? "#0f172a" : "#f8fafc",
                    borderRadius: 20,
                    border: `2px dashed ${themeStyles.cardBorder}`,
                  }}
                >
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🗓️</div>
                  <div style={{ fontWeight: 1000, color: themeStyles.text }}>
                    No classes today
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 900, marginTop: 4 }}>
                    Enjoy your time or check other days
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/student/timetable")}
                    style={{
                      marginTop: 16,
                      padding: "8px 20px",
                      borderRadius: 12,
                      backgroundColor: colors.primary,
                      color: "#fff",
                      border: "none",
                      fontWeight: 1000,
                      cursor: "pointer",
                    }}
                  >
                    Check Weekly Timetable
                  </button>
                </div>
              )}
            </div>
          </Card>
        </div>

        <div style={{ gridColumn: "span 5" }}>
          <Card style={{ ...largeCardStyle }}>
            <SectionHeader
              icon={
                <Icon>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </Icon>
              }
              title="Notifications"
              subtitle="Holidays, exams & school notices (same inbox)"
            />
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {latestNotices.length ? (
                latestNotices.slice(0, 5).map((n) => {
                  const isImportant = !n.is_read;
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() =>
                        navigate(`/student/notifications#ntf-${n.id}`)
                      }
                      style={{
                        textAlign: "left",
                        padding: "12px 12px",
                        borderRadius: 14,
                        border: `1px solid ${isImportant ? "#f59e0b" : themeStyles.cardBorder}`,
                        backgroundColor: isImportant
                          ? "#fffbeb"
                          : themeStyles.cardBg,
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          alignItems: "flex-start",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 1000,
                            color: themeStyles.text,
                            lineHeight: 1.2,
                          }}
                        >
                          {n.title}
                          {isImportant ? (
                            <div
                              style={{
                                marginTop: 6,
                                fontSize: 11,
                                fontWeight: 1000,
                                color: "#b45309",
                              }}
                            >
                              Unread
                            </div>
                          ) : null}
                        </div>
                        <div
                          style={{
                            color: themeStyles.muted,
                            fontWeight: 900,
                            fontSize: 12,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {new Date(n.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div
                        style={{
                          marginTop: 8,
                          color: themeStyles.muted,
                          fontWeight: 800,
                          fontSize: 13,
                        }}
                      >
                        {n.message.length > 90
                          ? `${n.message.slice(0, 90)}…`
                          : n.message}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div
                  style={{
                    color: themeStyles.muted,
                    fontWeight: 900,
                    padding: 12,
                  }}
                >
                  No notifications yet.
                </div>
              )}
            </div>
          </Card>
        </div>

        <div style={{ gridColumn: "span 7" }}>
          <Card style={{ ...midCardStyle }}>
            <SectionHeader
              icon={
                <Icon>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M14 17v-4" />
                    <path d="M9 17v-2" />
                    <path d="M19 17v-7" />
                    <path d="M3 17V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v11" />
                  </svg>
                </Icon>
              }
              title="Assignments"
              subtitle="Recent"
            />
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {assignmentsWithStatus.length ? (
                assignmentsWithStatus
                  .slice()
                  .sort((a, b) =>
                    String(a.due_date).localeCompare(String(b.due_date)),
                  )
                  .slice(0, 5)
                  .map((a) => {
                    const isPending = a.status === "Pending";
                    return (
                      <div
                        key={a.id}
                        style={{
                          border: `1px solid ${isPending && a.isPendingSoon ? "#f59e0b" : themeStyles.cardBorder}`,
                          backgroundColor:
                            isPending && a.isPendingSoon
                              ? "#fffbeb"
                              : themeStyles.cardBg,
                          borderRadius: 14,
                          padding: "12px 12px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            flexWrap: "wrap",
                            alignItems: "flex-start",
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 1000 }}>{a.title}</div>
                            <div
                              style={{
                                marginTop: 4,
                                color: themeStyles.muted,
                                fontWeight: 900,
                                fontSize: 12,
                              }}
                            >
                              Subject: {a.subject}
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div
                              style={{
                                color: themeStyles.muted,
                                fontWeight: 900,
                                fontSize: 12,
                              }}
                            >
                              Due
                            </div>
                            <div style={{ fontWeight: 1000 }}>
                              {a.due_date || "—"}
                            </div>
                          </div>
                        </div>
                        <div
                          style={{
                            marginTop: 10,
                            display: "flex",
                            gap: 10,
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              padding: "6px 10px",
                              borderRadius: 999,
                              border: `1px solid ${isPending ? "#f59e0b" : "#16a34a"}`,
                              backgroundColor: isPending
                                ? "#fffbeb"
                                : "#ecfdf5",
                              color: isPending ? "#b45309" : colors.present,
                              fontWeight: 1000,
                              fontSize: 12,
                            }}
                          >
                            {a.status}
                          </span>
                          {a.file_url ? (
                            <a
                              href={a.file_url}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                color: colors.primary,
                                fontWeight: 1000,
                                textDecoration: "none",
                              }}
                            >
                              Download
                            </a>
                          ) : (
                            <div
                              style={{
                                color: themeStyles.muted,
                                fontWeight: 900,
                                fontSize: 12,
                              }}
                            >
                              No file
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
              ) : (
                <div
                  style={{
                    color: themeStyles.muted,
                    fontWeight: 900,
                    padding: 12,
                  }}
                >
                  No assignments yet.
                </div>
              )}
            </div>
          </Card>
        </div>

        <div style={{ gridColumn: "span 5" }}>
          <Card style={{ ...midCardStyle }}>
            <SectionHeader
              icon={
                <Icon>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8" />
                    <path d="M9 22h6" />
                    <path d="M12 17v5" />
                    <path d="M7 11l2 2 4-4" />
                  </svg>
                </Icon>
              }
              title="Attendance Summary"
              subtitle="Mini"
            />
            <div style={{ marginTop: 12 }}>
              <CircularProgress percentage={overallAttendance.percentage} />
            </div>
            <div style={{ marginTop: 12 }}>
              <MiniProgress percentage={overallAttendance.percentage} />
            </div>
            <div
              style={{
                marginTop: 10,
                display: "flex",
                gap: 10,
                justifyContent: "space-between",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  color: themeStyles.muted,
                  fontWeight: 900,
                  fontSize: 12,
                }}
              >
                Present: {overallAttendance.present}
              </div>
              <div
                style={{
                  color: themeStyles.muted,
                  fontWeight: 900,
                  fontSize: 12,
                }}
              >
                Absent: {overallAttendance.absent}
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                onClick={() => navigate("/student/attendance")}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: `1px solid ${themeStyles.cardBorder}`,
                  backgroundColor: theme === "dark" ? "#111827" : "#fff",
                  cursor: "pointer",
                  fontWeight: 1000,
                  color: colors.primary,
                }}
              >
                View Full Attendance
              </button>
            </div>

            <div style={{ marginTop: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontWeight: 1000 }}>Attendance Trend</div>
                  <div
                    style={{
                      color: themeStyles.muted,
                      fontWeight: 900,
                      fontSize: 12,
                    }}
                  >
                    Last ~4 weeks
                  </div>
                </div>
                <div
                  style={{
                    color: themeStyles.muted,
                    fontWeight: 900,
                    fontSize: 12,
                  }}
                >
                  SVG chart
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <Sparkline points={attendanceTrendPoints} />
              </div>
            </div>
          </Card>
        </div>

        <div style={{ gridColumn: "span 7" }}>
          <Card style={{ ...midCardStyle }}>
            <SectionHeader
              icon={
                <Icon>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7" />
                  </svg>
                </Icon>
              }
              title="Exams & Results Preview"
              subtitle="Preview"
            />
            <div
              className="rg-2" style={{
                marginTop: 12,
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 12,
              }}
            >
              <div
                style={{
                  border: `1px solid ${themeStyles.cardBorder}`,
                  borderRadius: 14,
                  padding: 12,
                  backgroundColor: themeStyles.cardBg,
                }}
              >
                <div style={{ fontWeight: 1000 }}>Upcoming Exams</div>
                <div style={{ marginTop: 6, display: "grid", gap: 10 }}>
                  {upcomingExams.length ? (
                    upcomingExams.slice(0, 3).map((e) => {
                      const dt = e.start_date || e.date || e.end_date;
                      return (
                        <div
                          key={e.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 1000, fontSize: 13 }}>
                              {e.name}
                            </div>
                            <div
                              style={{
                                color: themeStyles.muted,
                                fontWeight: 900,
                                fontSize: 12,
                              }}
                            >
                              {e.exam_type}
                            </div>
                          </div>
                          <div
                            style={{
                              color: themeStyles.muted,
                              fontWeight: 1000,
                              fontSize: 12,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {dt}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div
                      style={{
                        color: themeStyles.muted,
                        fontWeight: 900,
                        fontSize: 12,
                      }}
                    >
                      No upcoming exams.
                    </div>
                  )}
                </div>
              </div>

              <div
                style={{
                  border: `1px solid ${themeStyles.cardBorder}`,
                  borderRadius: 14,
                  padding: 12,
                  backgroundColor: themeStyles.cardBg,
                }}
              >
                <div style={{ fontWeight: 1000 }}>Latest Results</div>
                <div style={{ marginTop: 6 }}>
                  {latestResultsPreview ? (
                    <>
                      <div style={{ fontWeight: 1000, fontSize: 14 }}>
                        {latestResultsPreview.exam_name}
                      </div>
                      <div
                        style={{
                          marginTop: 8,
                          display: "flex",
                          gap: 10,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          style={{
                            padding: "6px 10px",
                            borderRadius: 999,
                            backgroundColor: "#eef2ff",
                            color: colors.primary,
                            fontWeight: 1000,
                            fontSize: 12,
                          }}
                        >
                          Avg {latestResultsPreview.avg.toFixed(2)}%
                        </span>
                        <span
                          style={{
                            padding: "6px 10px",
                            borderRadius: 999,
                            backgroundColor: "#f3f4f6",
                            color: themeStyles.text,
                            fontWeight: 1000,
                            fontSize: 12,
                          }}
                        >
                          {latestResultsPreview.grade} ·{" "}
                          {latestResultsPreview.statusText}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div
                      style={{
                        color: themeStyles.muted,
                        fontWeight: 900,
                        fontSize: 12,
                      }}
                    >
                      No results published yet.
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 1000, marginBottom: 6 }}>
                    Marks Trend
                  </div>
                  <Sparkline
                    points={resultsTrendPoints}
                    color={colors.primary}
                  />
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 14,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => navigate("/student/results")}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid " + themeStyles.cardBorder,
                  backgroundColor: theme === "dark" ? "#111827" : "#fff",
                  cursor: "pointer",
                  fontWeight: 1000,
                  color: colors.primary,
                }}
              >
                View Results
              </button>
              <button
                type="button"
                onClick={() => navigate("/student/notifications")}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "none",
                  backgroundColor: colors.primary,
                  cursor: "pointer",
                  fontWeight: 1000,
                  color: "#fff",
                }}
              >
                View Notifications
              </button>
            </div>
          </Card>
        </div>

        <div style={{ gridColumn: "span 5" }}>
          <Card style={{ ...midCardStyle }}>
            <SectionHeader
              icon={
                <Icon>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 1v22" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </Icon>
              }
              title="Fees Status"
              subtitle="Due"
            />
            <div style={{ marginTop: 12 }}>
              {feeSummary ? (
                <>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          color: themeStyles.muted,
                          fontWeight: 900,
                          fontSize: 12,
                          textTransform: "uppercase",
                        }}
                      >
                        Due Amount
                      </div>
                      <div
                        style={{
                          marginTop: 6,
                          fontWeight: 1000,
                          fontSize: 26,
                          color:
                            feeSummary.unpaid.status === "paid"
                              ? colors.present
                              : colors.absent,
                        }}
                      >
                        {formatMoneyMaybe(feeSummary.unpaid.due_amount)}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          color: themeStyles.muted,
                          fontWeight: 900,
                          fontSize: 12,
                          textTransform: "uppercase",
                        }}
                      >
                        Due Date
                      </div>
                      <div style={{ marginTop: 6, fontWeight: 1000 }}>
                        {feeSummary.unpaid.due_date || "—"}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "8px 12px",
                        borderRadius: 999,
                        border: `1px solid ${feeSummary.unpaid.status === "paid" ? "#16a34a" : "#ef4444"}`,
                        backgroundColor:
                          feeSummary.unpaid.status === "paid"
                            ? "#ecfdf5"
                            : "#fee2e2",
                        color:
                          feeSummary.unpaid.status === "paid"
                            ? colors.present
                            : colors.absent,
                        fontWeight: 1000,
                        fontSize: 12,
                      }}
                    >
                      {String(feeSummary.unpaid.status || "").toUpperCase()}
                    </span>
                  </div>
                </>
              ) : (
                <div
                  style={{
                    color: themeStyles.muted,
                    fontWeight: 900,
                    fontSize: 12,
                  }}
                >
                  No fee record found.
                </div>
              )}
            </div>
            <div style={{ marginTop: 14 }}>
              <button
                type="button"
                onClick={() => navigate("/student/fees")}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid " + themeStyles.cardBorder,
                  backgroundColor: theme === "dark" ? "#111827" : "#fff",
                  cursor: "pointer",
                  fontWeight: 1000,
                  color: colors.primary,
                }}
              >
                View Fee Details
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
