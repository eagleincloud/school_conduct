import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import useAuthStore from "../../store/authStore";
import { useStudent } from "../../context/StudentContext";
import { 
  Clock, 
  Award, 
  Calendar, 
  ClipboardList, 
  FileText, 
  BookOpen, 
  User, 
  IndianRupee, 
  CreditCard, 
  Receipt, 
  Bell, 
  MessageSquare, 
  Umbrella, 
  Store, 
  Image 
} from "lucide-react";

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
  const [galleryImages, setGalleryImages] = useState([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const galleryToken = localStorage.getItem('access_token');

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

  useEffect(() => {
    const fetchGallery = async () => {
      setGalleryLoading(true);
      try {
        const res = await api.get('gallery/');
        setGalleryImages(Array.isArray(res?.data) ? res.data : []);
      } catch (e) {
        console.error('Gallery fetch error', e);
        setGalleryImages([]);
      } finally {
        setGalleryLoading(false);
      }
    };
    fetchGallery();
  }, []);

  useEffect(() => {
    if (!galleryImages.length) {
      setCurrentSlide(0);
      return undefined;
    }
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % galleryImages.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [galleryImages]);

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

  /* ── tile definitions ────────────────────────────────────────────── */
  const tileCategories = [
    {
      label: "Academics",
      tiles: [
        {
          id: "attendance",
          title: "Attendance",
          route: "/student/attendance",
          bg: "#eef2ff",
          color: "#4f46e5",
          badge: overallAttendance.total > 0 ? `${overallAttendance.percentage.toFixed(0)}%` : null,
          icon: <Clock size={26} strokeWidth={2.2} />,
        },
        {
          id: "results",
          title: "Results",
          route: "/student/results",
          bg: "#fef3c7",
          color: "#d97706",
          icon: <Award size={26} strokeWidth={2.2} />,
        },
        {
          id: "timetable",
          title: "Time Table",
          route: "/student/timetable",
          bg: "#dbeafe",
          color: "#2563eb",
          badge: todayTimetable.length > 0 ? `${todayTimetable.length}` : null,
          icon: <Calendar size={26} strokeWidth={2.2} />,
        },
        {
          id: "assignments",
          title: "Assignments",
          route: "/student/assignments",
          bg: "#fce7f3",
          color: "#db2777",
          badge: assignmentsWithStatus.filter((a) => a.status === "Pending").length > 0
            ? `${assignmentsWithStatus.filter((a) => a.status === "Pending").length}`
            : null,
          icon: <ClipboardList size={26} strokeWidth={2.2} />,
        },
        {
          id: "exams",
          title: "Exams",
          route: "/student/exams",
          bg: "#fef9c3",
          color: "#a16207",
          badge: examsCount > 0 ? `${examsCount}` : null,
          icon: <FileText size={26} strokeWidth={2.2} />,
        },
        {
          id: "syllabus",
          title: "Syllabus",
          route: "/student/syllabus",
          bg: "#e0e7ff",
          color: "#4338ca",
          icon: <BookOpen size={26} strokeWidth={2.2} />,
        },
        {
          id: "profile",
          title: "Profile",
          route: "/student/profile",
          bg: "#f0fdf4",
          color: "#16a34a",
          icon: <User size={26} strokeWidth={2.2} />,
        },
      ],
    },
    {
      label: "Finance",
      tiles: [
        {
          id: "fees",
          title: "Fees",
          route: "/student/fees",
          bg: "#fef2f2",
          color: "#dc2626",
          badge: feeSummary && feeSummary.unpaid.status !== "paid" ? "Due" : null,
          icon: <IndianRupee size={26} strokeWidth={2.2} />,
        },
        {
          id: "finance-cards",
          title: "Finance Cards",
          route: "/student/finance-cards",
          bg: "#f5f3ff",
          color: "#7c3aed",
          icon: <CreditCard size={26} strokeWidth={2.2} />,
        },
        {
          id: "ledger",
          title: "Ledger",
          route: "/student/ledger",
          bg: "#ecfdf5",
          color: "#059669",
          icon: <Receipt size={26} strokeWidth={2.2} />,
        },
      ],
    },
    {
      label: "Communication",
      tiles: [
        {
          id: "notifications",
          title: "Notifications",
          route: "/student/notifications",
          bg: "#fff7ed",
          color: "#ea580c",
          badge: unreadNotices.length > 0 ? `${unreadNotices.length}` : null,
          icon: <Bell size={26} strokeWidth={2.2} />,
        },
        {
          id: "messaging",
          title: "Messaging",
          route: "/student/messaging",
          bg: "#dbeafe",
          color: "#1d4ed8",
          icon: <MessageSquare size={26} strokeWidth={2.2} />,
        },
        {
          id: "holidays",
          title: "Holidays",
          route: "/student/holidays",
          bg: "#fdf4ff",
          color: "#a855f7",
          icon: <Umbrella size={26} strokeWidth={2.2} />,
        },
      ],
    },
    {
      label: "More",
      tiles: [
        {
          id: "shops",
          title: "Shops",
          route: "/student/shops",
          bg: "#fff1f2",
          color: "#e11d48",
          icon: <Store size={26} strokeWidth={2.2} />,
        },
        {
          id: "gallery",
          title: "Gallery",
          route: "/student/gallery",
          bg: "#f0fdfa",
          color: "#0d9488",
          icon: <Image size={26} strokeWidth={2.2} />,
        },
      ],
    },
  ];

  /* ── loading skeleton ──────────────────────────────────────────── */
  if (loading) {
    return (
      <div style={wrapperStyle}>
        <div className="student-tile-header-skeleton" style={{
          height: 100,
          borderRadius: 20,
          backgroundColor: themeStyles.cardBg,
          border: `1px solid ${themeStyles.cardBorder}`,
          marginBottom: 24,
        }} />
        <div className="student-tile-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="student-tile-skeleton"
              style={{
                height: 110,
                borderRadius: 20,
                backgroundColor: themeStyles.cardBg,
                border: `1px solid ${themeStyles.cardBorder}`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  /* ── main render ───────────────────────────────────────────────── */
  return (
    <div style={wrapperStyle}>
      {/* ── Greeting Header ────────────────────────────────────── */}
      <div
        className="student-tile-header"
        style={{
          padding: "20px 24px",
          borderRadius: 20,
          marginBottom: 20,
          background: theme === "dark"
            ? "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)"
            : "linear-gradient(135deg, #ffffff 0%, #f0f4ff 100%)",
          border: `1px solid ${theme === "dark" ? "#23304a" : "#e0e7ff"}`,
          boxShadow: theme === "dark"
            ? "0 2px 12px rgba(0,0,0,0.3)"
            : "0 2px 12px rgba(37, 99, 235, 0.06)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* decorative circle */}
        <div style={{
          position: "absolute",
          top: -40,
          right: -40,
          width: 180,
          height: 180,
          background: theme === "dark"
            ? "rgba(99, 102, 241, 0.06)"
            : "rgba(37, 99, 235, 0.04)",
          borderRadius: "50%",
          pointerEvents: "none",
        }} />

        {/* theme toggle button (top right) */}
        <button
          type="button"
          onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          className="student-tile-btn-secondary"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            padding: "8px 12px",
            borderRadius: 12,
            border: `1px solid ${theme === "dark" ? "#334155" : "#e2e8f0"}`,
            background: theme === "dark" ? "#1e293b" : "#fff",
            cursor: "pointer",
            fontWeight: 800,
            fontSize: 13,
            color: themeStyles.text,
            transition: "all 0.2s ease",
            zIndex: 10,
          }}
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>

        <div style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "linear-gradient(135deg, #6366f1 0%, #2563eb 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              color: "#fff",
              fontSize: 22,
              boxShadow: "0 4px 14px rgba(37, 99, 235, 0.3)",
              flexShrink: 0,
            }}>
              {profile?.name ? profile.name.slice(0, 1).toUpperCase() : "S"}
            </div>
            <div>
              <div style={{
                fontSize: 11,
                fontWeight: 800,
                color: theme === "dark" ? "#818cf8" : "#6366f1",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 2,
              }}>
                Hello
              </div>
              <h1 style={{
                margin: 0,
                fontWeight: 900,
                fontSize: 22,
                color: themeStyles.text,
                letterSpacing: "-0.01em",
                lineHeight: 1.2,
              }}>
                {profile?.name || "Student"}
              </h1>
              <p style={{
                margin: "2px 0 0",
                color: themeStyles.muted,
                fontWeight: 700,
                fontSize: 13,
              }}>
                Class: {profile?.class_section_display || profile?.class_name || "—"}
                {profile?.admission_number ? ` · Roll: ${profile.admission_number}` : ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Alerts Banner ──────────────────────────────────────── */}
      {studentAlerts.length > 0 && (
        <div className="student-tile-alerts" style={{
          marginBottom: 20,
          display: "flex",
          gap: 10,
          overflowX: "auto",
          paddingBottom: 4,
        }}>
          {studentAlerts.slice(0, 3).map((alert, idx) => (
            <div
              key={idx}
              style={{
                flex: "0 0 auto",
                padding: "10px 16px",
                borderRadius: 14,
                backgroundColor: alert.kind === "warning"
                  ? (theme === "dark" ? "#422006" : "#fff7ed")
                  : alert.kind === "notice"
                    ? (theme === "dark" ? "#1e3a5f" : "#eff6ff")
                    : (theme === "dark" ? "#1e293b" : "#f8fafc"),
                border: `1px solid ${
                  alert.kind === "warning" ? "#fdba74"
                  : alert.kind === "notice" ? "#93c5fd"
                  : themeStyles.cardBorder
                }`,
                display: "flex",
                alignItems: "center",
                gap: 8,
                minWidth: 200,
                maxWidth: 340,
              }}
            >
              <span style={{ fontSize: 16 }}>
                {alert.kind === "warning" ? "⚠️" : alert.kind === "notice" ? "🔔" : "ℹ️"}
              </span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 12, color: themeStyles.text }}>
                  {alert.title}
                </div>
                <div style={{ fontSize: 11, color: themeStyles.muted, fontWeight: 600, marginTop: 1 }}>
                  {alert.message.length > 60 ? alert.message.slice(0, 60) + "…" : alert.message}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tile Sections ──────────────────────────────────────── */}
      {tileCategories.map((category) => (
        <div key={category.label} style={{ marginBottom: 24 }}>
          <h2 style={{
            margin: "0 0 14px 4px",
            fontSize: 16,
            fontWeight: 900,
            color: themeStyles.text,
            letterSpacing: "-0.01em",
          }}>
            {category.label}
          </h2>
          <div className="student-tile-grid">
            {category.tiles.map((tile) => (
              <button
                key={tile.id}
                type="button"
                className="student-tile-item"
                onClick={() => navigate(tile.route)}
                style={{
                  background: theme === "dark" ? "#0f172a" : "#ffffff",
                  border: `1px solid ${theme === "dark" ? "#1e293b" : "#f1f5f9"}`,
                  borderRadius: 20,
                  padding: "20px 12px 16px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  cursor: "pointer",
                  position: "relative",
                  transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)",
                  boxShadow: theme === "dark"
                    ? "0 1px 4px rgba(0,0,0,0.3)"
                    : "0 1px 6px rgba(0,0,0,0.04)",
                  textDecoration: "none",
                  minHeight: 110,
                }}
              >
                {/* Badge */}
                {tile.badge && (
                  <span style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    padding: "2px 7px",
                    borderRadius: 99,
                    backgroundColor: tile.color,
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 900,
                    lineHeight: "16px",
                  }}>
                    {tile.badge}
                  </span>
                )}

                {/* Icon Container */}
                <div style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  backgroundColor: theme === "dark"
                    ? `${tile.color}18`
                    : tile.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: tile.color,
                  transition: "transform 0.25s ease",
                }}>
                  {tile.icon}
                </div>

                {/* Label */}
                <span style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: themeStyles.text,
                  textAlign: "center",
                  lineHeight: 1.2,
                }}>
                  {tile.title}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* ── Gallery Preview (compact) ──────────────────────────── */}
      {galleryImages.length > 0 && (
        <div style={{
          marginTop: 4,
          borderRadius: 20,
          overflow: "hidden",
          border: `1px solid ${theme === "dark" ? "#1e293b" : "#f1f5f9"}`,
          boxShadow: theme === "dark"
            ? "0 2px 10px rgba(0,0,0,0.3)"
            : "0 2px 10px rgba(0,0,0,0.04)",
          position: "relative",
          height: 180,
          background: theme === "dark" ? "#0f172a" : "#f8fafc",
        }}>
          {galleryImages.map((img, idx) => (
            <img
              key={img.id}
              src={`${img.image_url}${galleryToken ? `?token=${galleryToken}` : ''}`}
              alt={img.title}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transition: "opacity 700ms ease",
                opacity: idx === currentSlide ? 1 : 0,
                userSelect: "none",
              }}
              onContextMenu={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
            />
          ))}
          <div style={{
            position: "absolute",
            inset: "auto 0 0 0",
            padding: "10px 14px",
            background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}>
            <p style={{
              color: "#fff",
              fontWeight: 900,
              fontSize: 13,
              margin: 0,
              textShadow: "0 1px 4px rgba(0,0,0,0.5)",
            }}>
              {galleryImages[currentSlide]?.title}
            </p>
            <div style={{ display: "flex", gap: 5 }}>
              {galleryImages.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentSlide(idx)}
                  style={{
                    width: idx === currentSlide ? 18 : 7,
                    height: 7,
                    borderRadius: 99,
                    border: "none",
                    backgroundColor: idx === currentSlide ? "#fff" : "rgba(255,255,255,0.4)",
                    cursor: "pointer",
                    transition: "all 300ms ease",
                    padding: 0,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
