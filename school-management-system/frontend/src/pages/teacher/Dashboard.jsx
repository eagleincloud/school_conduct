import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, GraduationCap, ClipboardList, FileText, Award } from "lucide-react";
import api from "../../services/api";
import useAuthStore from "../../store/authStore";
import { resolveImageUrl } from "../../utils/helpers";

const palette = {
  bg: "#f8fafc",
  card: "#ffffff",
  border: "#e5e7eb",
  text: "#0f172a",
  muted: "#64748b",
  primary: "#2563eb",
  success: "#16a34a",
  danger: "#ef4444",
  warn: "#f59e0b",
  shadow: "0 1px 8px rgba(16,24,40,0.06)",
};

const sidebarItems = [
  { label: "Dashboard", path: "/teacher/dashboard" },
  { label: "My Classes", path: "/teacher/students" },
  { label: "Attendance", path: "/teacher/attendance" },
  { label: "Assignments", path: "/teacher/assignment" },
  { label: "Exams & Results", path: "/teacher/upload-result" },
  { label: "Timetable", path: "#timetable" },
  { label: "Messages", path: "/teacher/messaging" },
  { label: "Study Material", path: "#study-material" },
  { label: "Profile / Settings", path: "/teacher/profile" },
];

function toDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const dayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function MiniProgress({ value }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div
      className="dashboard-shell" style={{
        height: 9,
        borderRadius: 999,
        backgroundColor: "#f1f5f9",
        border: `1px solid ${palette.border}`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          backgroundColor: pct < 75 ? palette.danger : palette.primary,
          transition: "width 300ms ease",
        }}
      />
    </div>
  );
}

function Card({ children, style, ...rest }) {
  return (
    <div
      {...rest}
      style={{
        backgroundColor: palette.card,
        border: `1px solid ${palette.border}`,
        borderRadius: 16,
        padding: 16,
        boxShadow: palette.shadow,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Sparkline({ points }) {
  if (!points || points.length < 2) {
    return (
      <div style={{ color: palette.muted, fontWeight: 900, fontSize: 12 }}>
        No chart data
      </div>
    );
  }

  const width = 360;
  const height = 110;
  const pad = 12;
  const ys = points.map((p) => p.y);
  const minY = 0;
  const maxY = Math.max(100, ...ys);
  const xScale = (i) => pad + ((width - 2 * pad) * i) / (points.length - 1);
  const yScale = (y) =>
    height - pad - ((height - 2 * pad) * (y - minY)) / (maxY - minY || 1);

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(i)} ${yScale(p.y)}`)
    .join(" ");

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`}>
        <path
          d={path}
          fill="none"
          stroke={palette.primary}
          strokeWidth="3"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <circle
            key={`${p.x}-${i}`}
            cx={xScale(i)}
            cy={yScale(p.y)}
            r="4"
            fill="#fff"
            stroke={palette.primary}
            strokeWidth="2"
          />
        ))}
      </svg>
    </div>
  );
}

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");

  const [profile, setProfile] = useState(null);
  const [myClasses, setMyClasses] = useState([]);
  const [classStudentCount, setClassStudentCount] = useState({});
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));

  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [attendanceTrend, setAttendanceTrend] = useState([]);

  const [assignments, setAssignments] = useState([]);
  const [exams, setExams] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [messages, setMessages] = useState([]);
  const [subjects, setSubjects] = useState([]);

  const [shifts, setShifts] = useState([]);
  const [selectedShiftId, setSelectedShiftId] = useState("");
  const [galleryImages, setGalleryImages] = useState([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [currentGallerySlide, setCurrentGallerySlide] = useState(0);
  const galleryToken = localStorage.getItem('access_token');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get("teachers/profile/"),
      api.get("classes/teaching-sections/"),
      api.get("assignments/"),
      api.get("academics/exams/"),
      api.get("timetable/"),
      api.get("communication/my/"),
      api.get("subjects/", { params: { status: "Active" } }),
      api.get("timetable/shifts/"),
      api.get("timetable/user-shift/"),
    ])
      .then(
        async ([
          profileRes,
          teachingRes,
          assignRes,
          examsRes,
          timetableRes,
          messageRes,
          subjectsRes,
          shiftsRes,
          userShiftRes,
        ]) => {
          const teacherProfile = profileRes.data || null;
          const mine = teachingRes.data || [];
          setProfile(teacherProfile);
          setAssignments(assignRes.data || []);
          setExams(examsRes.data || []);
          setTimetable(timetableRes.data || []);
          setMessages(messageRes.data || []);
          setSubjects(subjectsRes.data || []);
          setShifts(shiftsRes.data || []);

          const preferredShiftId = userShiftRes.data?.shift_id;
          if (preferredShiftId) {
            setSelectedShiftId(String(preferredShiftId));
          } else if (shiftsRes.data?.length > 0) {
            setSelectedShiftId(String(shiftsRes.data[0].id));
          }

          setMyClasses(mine);

          if (mine.length > 0) {
            const defaultClassId = String(mine[0].id);
            setSelectedClassId(defaultClassId);
          }

          // Move setLoading(false) here so UI shows up while we fetch secondary data
          setLoading(false);

          // Fetch student counts in background (non-blocking)
          const counts = {};
          Promise.all(
            mine.map(async (c) => {
              try {
                const res = await api.get(`students/by-class/${c.id}/`);
                counts[c.id] = (res.data || []).length;
              } catch (_) {
                counts[c.id] = 0;
              }
            }),
          ).then(() => {
            setClassStudentCount({ ...counts });
          });
        },
      )
      .catch(() => setLoading(false));
  }, []);

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
      setCurrentGallerySlide(0);
      return undefined;
    }
    const timer = setInterval(() => {
      setCurrentGallerySlide((prev) => (prev + 1) % galleryImages.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [galleryImages]);

  useEffect(() => {
    if (!selectedClassId) {
      setAttendanceSummary(null);
      setAttendanceRows([]);
      setAttendanceTrend([]);
      return;
    }

    const loadClassAttendance = async (silent = false) => {
      try {
        const summaryRes = await api.get("attendance/class-summary/", {
          params: { class_section_id: selectedClassId, date: selectedDate },
        });
        const data = summaryRes.data || {};
        setAttendanceSummary(data.summary || null);
        setAttendanceRows(data.students || []);

        // Only fetch/rebuild 7-day trend on initial or full load to save API resources
        if (!silent) {
          const trendDays = 7;
          const base = new Date(selectedDate);
          const calls = [];
          for (let i = trendDays - 1; i >= 0; i--) {
            const d = new Date(base);
            d.setDate(base.getDate() - i);
            calls.push(
              api
                .get("attendance/class-summary/", {
                  params: {
                    class_section_id: selectedClassId,
                    date: toDateKey(d),
                  },
                })
                .then((res) => ({
                  x: toDateKey(d),
                  y: Number(res?.data?.summary?.attendance_percentage || 0),
                }))
                .catch(() => ({
                  x: toDateKey(d),
                  y: 0,
                })),
            );
          }
          const trend = await Promise.all(calls);
          setAttendanceTrend(trend);
        }
      } catch (_) {
        if (!silent) {
          setAttendanceSummary(null);
          setAttendanceRows([]);
          setAttendanceTrend([]);
        }
      }
    };

    loadClassAttendance();

    // Background polling for today's date
    const todayStr = toDateKey(new Date());
    let interval;
    if (selectedDate === todayStr) {
      interval = setInterval(() => {
        loadClassAttendance(true);
      }, 5000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [selectedClassId, selectedDate]);

  const totalStudents = useMemo(() => {
    return myClasses.reduce(
      (sum, c) => sum + Number(classStudentCount[c.id] || 0),
      0,
    );
  }, [myClasses, classStudentCount]);

  const pendingAssignments = useMemo(() => {
    const today = toDateKey(new Date());
    return (assignments || []).filter((a) => a.due_date >= today).length;
  }, [assignments]);

  const upcomingExams = useMemo(() => {
    const today = toDateKey(new Date());
    const classIds = new Set(myClasses.map((c) => c.id));
    return (exams || [])
      .filter((e) => classIds.has(e.class_section))
      .filter((e) => (e.start_date || e.date || e.end_date || "") >= today)
      .sort((a, b) =>
        String(a.start_date || a.date).localeCompare(
          String(b.start_date || b.date),
        ),
      );
  }, [exams, myClasses]);

  const todayDayNumber = useMemo(() => {
    const d = new Date().getDay();
    return d === 0 ? 7 : d; // Mon=1, Tue=2, ..., Sat=6, Sun=7
  }, []);

  const todayClasses = useMemo(() => {
    return (timetable || []).filter((t) => {
      const isToday = Number(t.day) === todayDayNumber;
      const isSelectedShift =
        !selectedShiftId || String(t.shift_ref) === selectedShiftId;
      return isToday && isSelectedShift;
    });
  }, [timetable, todayDayNumber, selectedShiftId]);

  const filteredSubjects = useMemo(() => {
    const assignedClassIds = new Set(myClasses.map((c) => c.class_id));
    return (subjects || []).filter((s) => assignedClassIds.has(s.class_ref));
  }, [subjects, myClasses]);

  const currentClass = useMemo(() => {
    const toMinutes = (timeStr) => {
      if (!timeStr) return null;
      const parts = String(timeStr).split(":");
      if (parts.length < 2) return null;
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      return h * 60 + m;
    };
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    return (
      todayClasses.find((t) => {
        const startM = toMinutes(t.start_time);
        const endM = toMinutes(t.end_time);
        if (startM === null || endM === null) return false;
        return nowMins >= startM && nowMins <= endM;
      }) || null
    );
  }, [todayClasses]);

  const filteredStudents = useMemo(() => {
    if (!searchText.trim()) return attendanceRows;
    const q = searchText.trim().toLowerCase();
    return (attendanceRows || []).filter(
      (s) =>
        (s.name || "").toLowerCase().includes(q) ||
        (s.admission_number || "").toLowerCase().includes(q),
    );
  }, [attendanceRows, searchText]);

  const recentActivity = useMemo(() => {
    const items = [];
    (messages || []).slice(0, 3).forEach((m) => {
      items.push({
        type: "message",
        title: m.title,
        time: m.created_at,
      });
    });
    (assignments || []).slice(0, 3).forEach((a) => {
      items.push({
        type: "assignment",
        title: `Assignment: ${a.title}`,
        time: a.created_at || a.due_date,
      });
    });
    (upcomingExams || []).slice(0, 2).forEach((e) => {
      items.push({
        type: "exam",
        title: `Upcoming exam: ${e.name}`,
        time: e.start_date || e.date,
      });
    });
    return items
      .sort((a, b) => String(b.time || "").localeCompare(String(a.time || "")))
      .slice(0, 7);
  }, [messages, assignments, upcomingExams]);

  const markAttendance = async (studentId, status) => {
    if (!selectedDate) return;
    try {
      await api.post("attendance/mark/", {
        student: studentId,
        date: selectedDate,
        status,
      });
      const res = await api.get("attendance/class-summary/", {
        params: { class_section_id: selectedClassId, date: selectedDate },
      });
      setAttendanceSummary(res.data?.summary || null);
      setAttendanceRows(res.data?.students || []);
    } catch (e) {
      console.warn("Could not mark attendance:", e);
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    const [h, m] = timeStr.split(":");
    const hr = parseInt(h);
    const ampm = hr >= 12 ? "PM" : "AM";
    const displayHr = hr % 12 || 12;
    return `${displayHr}:${m} ${ampm}`;
  };

  if (loading)
    return (
      <div
        style={{
          padding: "24px",
          backgroundColor: palette.bg,
          minHeight: "100vh",
        }}
      >
        <style>
          {`
                @keyframes shimmer { 0% { background-position: -1000px 0; } 100% { background-position: 1000px 0; } }
                .skeleton { background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%); background-size: 1000px 100%; animation: shimmer 2s infinite linear; border-radius: 12px; }
                `}
        </style>
        <div className="skeleton" style={{ height: 120, marginBottom: 20 }} />
        <div
          className="rg-4" style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
            marginBottom: 20,
          }}
        >
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" style={{ height: 100 }} />
          ))}
        </div>
        <div
          className="rg-split" style={{ display: "grid", gridTemplateColumns: "7fr 5fr", gap: 12 }}
        >
          <div className="skeleton" style={{ height: 400 }} />
          <div className="skeleton" style={{ height: 400 }} />
        </div>
      </div>
    );

  return (
    <div
      className="teacher-dashboard-page"
      style={{
        padding: 20,
        backgroundColor: palette.bg,
        minHeight: "calc(100vh - 60px)",
      }}
    >
      <style>{`
        .col-span-2 { grid-column: span 2; }
        .col-span-3 { grid-column: span 3; }
        .col-span-4 { grid-column: span 4; }
        .col-span-2 { grid-column: span 2; }
        .col-span-3 { grid-column: span 3; }
        .col-span-4 { grid-column: span 4; }
        .col-span-5 { grid-column: span 5; }
        .col-span-6 { grid-column: span 6; }
        .col-span-7 { grid-column: span 7; }
        .col-span-12 { grid-column: span 12; }

        .teacher-summary-grid {
          grid-template-columns: repeat(5, 1fr) !important;
        }

        .teacher-tile-button {
          background-color: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 12px !important;
          box-shadow: 0 1px 8px rgba(16,24,40,0.04);
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          outline: none;
          width: 100%;
          aspect-ratio: 1 / 1 !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: center !important;
          align-items: center !important;
          text-align: center !important;
          min-height: 0 !important;
        }
        .teacher-tile-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 24px -4px rgba(0, 0, 0, 0.04), 0 4px 12px -2px rgba(0, 0, 0, 0.02);
          border-color: #cbd5e1;
        }
        .teacher-tile-icon-wrapper {
          width: 36px !important;
          height: 36px !important;
          border-radius: 10px !important;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 6px !important;
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .teacher-tile-button:hover .teacher-tile-icon-wrapper {
          transform: scale(1.1) rotate(2deg);
        }

        .teacher-tile-button p.tile-label {
          font-size: 9px !important;
          font-weight: 800 !important;
          color: #64748b !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
          margin: 4px 0 0 0 !important;
          line-height: 1.3 !important;
        }
        .teacher-tile-button p.tile-value {
          font-size: 20px !important;
          font-weight: 1000 !important;
          color: #0f172a !important;
          margin: 4px 0 0 0 !important;
          line-height: 1 !important;
        }
        .teacher-tile-button p.tile-subtext {
          font-size: 8px !important;
          font-weight: 900 !important;
          color: #64748b !important;
          margin: 4px 0 0 0 !important;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          width: 100%;
          line-height: 1.2 !important;
        }

        .bg-blue-50 { background-color: #eff6ff !important; }
        .bg-indigo-50 { background-color: #eef2ff !important; }
        .bg-emerald-50 { background-color: #ecfdf5 !important; }
        .bg-amber-50 { background-color: #fffbeb !important; }
        .bg-violet-50 { background-color: #f5f3ff !important; }

        .text-blue-600 { color: #2563eb !important; }
        .text-indigo-600 { color: #4f46e5 !important; }
        .text-emerald-600 { color: #059669 !important; }
        .text-amber-600 { color: #d97706 !important; }
        .text-violet-600 { color: #7c3aed !important; }

        @media (max-width: 768px) {
          .hide-on-mobile {
            display: none !important;
          }
        }

        .teacher-dashboard-action-group {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          gap: 6px !important;
          flex-wrap: nowrap !important;
        }
        .teacher-dashboard-action-group > button {
          flex: 1 1 0% !important;
          margin: 0 !important;
          font-size: 11px !important;
          padding: 8px 4px !important;
          min-height: auto !important;
          white-space: nowrap !important;
          text-align: center !important;
        }

        .teacher-dashboard-timetable-row {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          gap: 12px !important;
        }

        .teacher-dashboard-title {
          margin: 0;
          font-weight: 1000;
          font-size: 28px;
          letter-spacing: -0.02em;
          background: linear-gradient(90deg, #1e293b 0%, #2563eb 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        @media (max-width: 1024px) {
          .teacher-main-grid > div {
            grid-column: span 12 !important;
          }
          .rg-split { 
            grid-template-columns: 1fr !important; 
          }
          .rg-4 { 
            grid-template-columns: repeat(2, 1fr) !important; 
          }
        }

        @media (max-width: 768px) {
          .teacher-main-grid > div {
            grid-column: span 12 !important;
          }
          .teacher-summary-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .teacher-summary-grid > * {
            grid-column: span 1 !important;
          }
          .teacher-quick-nav {
            display: flex !important;
            overflow-x: auto !important;
            scroll-behavior: smooth;
            -webkit-overflow-scrolling: touch;
            gap: 8px !important;
            padding-bottom: 4px;
            scrollbar-width: none;
          }
          .teacher-quick-nav::-webkit-scrollbar {
            display: none;
          }
          .teacher-quick-nav > button {
            flex: 0 0 auto !important;
            white-space: nowrap !important;
            min-width: max-content !important;
            padding: 8px 12px !important;
          }
          .teacher-quick-nav-card {
            padding: 10px !important;
          }
          .rg-split { 
            grid-template-columns: 1fr !important; 
          }
          .rg-4 { 
            grid-template-columns: repeat(2, 1fr) !important; 
          }
          .rg-2 {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 640px) {
          .teacher-main-grid > div {
            grid-column: span 12 !important;
          }
          .rg-split { 
            grid-template-columns: 1fr !important; 
          }
          .rg-4 { 
            grid-template-columns: 1fr !important; 
          }
          .rg-2 {
            grid-template-columns: 1fr !important;
          }
          .teacher-dashboard-title {
            font-size: 20px !important;
          }
          .teacher-dashboard-attendance-bar {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 8px !important;
          }
          .teacher-dashboard-attendance-filters {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 8px !important;
            width: 100% !important;
            margin-top: 4px;
          }
          .teacher-dashboard-attendance-filters > * {
            width: 100% !important;
            margin: 0 !important;
            min-height: 38px !important;
            padding: 8px 10px !important;
          }
          .teacher-toolbar {
            width: 100% !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 8px !important;
          }
          .teacher-header-search {
            width: 100% !important;
          }
          .teacher-toolbar-buttons {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 8px !important;
            width: 100% !important;
          }
          .teacher-toolbar-buttons > button {
            width: 100% !important;
            min-width: 0 !important;
            padding: 8px 4px !important;
            font-size: 11px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            white-space: nowrap !important;
            min-height: 38px !important;
          }
        }

        @media (max-width: 480px) {
          .teacher-timetable-item-card {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 8px !important;
          }
          .teacher-dashboard-timetable-meta {
            text-align: left !important;
            width: 100%;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 1px solid #f1f5f9;
            padding-top: 8px;
            margin-top: 4px;
          }
        }
      `}</style>
      {/* Top Header */}
      <Card
        className="teacher-dashboard-card"
        style={{
          marginBottom: 12,
          background: "linear-gradient(135deg, #fff 0%, #f1f5f9 100%)",
          border: "none",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -20,
            right: -20,
            width: 150,
            height: 150,
            background: "rgba(37, 99, 235, 0.05)",
            borderRadius: "50%",
            zIndex: 0,
          }}
        ></div>
        <div
          className="teacher-dashboard-header"
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
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div>
                <h1
                  className="teacher-dashboard-title"
                  style={{
                    margin: 0,
                    fontWeight: 1000,
                    letterSpacing: "-0.02em",
                    background:
                      "linear-gradient(90deg, #1e293b 0%, #2563eb 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  Welcome <span style={{ color: palette.primary }}>{localStorage.getItem("user_name") || profile?.user?.name || profile?.employee_id || "Teacher"}</span>
                </h1>
                <p
                  style={{
                    margin: "4px 0 0",
                    color: palette.muted,
                    fontWeight: 900,
                    fontSize: 15,
                  }}
                >
                  Have a productive day at school today.
                </p>
              </div>
            </div>
          </div>

          <div
            className="teacher-toolbar"
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <input
              className="teacher-header-search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search students..."
              style={{
                width: 220,
                padding: "10px 12px",
                borderRadius: 12,
                border: `1px solid ${palette.border}`,
                outline: "none",
                backgroundColor: "#fff",
              }}
            />
            <div className="teacher-toolbar-buttons">
              <button
                type="button"
                onClick={() => navigate("/teacher/messaging")}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: `1px solid ${palette.border}`,
                  backgroundColor: "#fff",
                  cursor: "pointer",
                  fontWeight: 1000,
                }}
              >
                Notifications ({messages.length})
              </button>
              <button
                type="button"
                onClick={() => navigate("/teacher/profile")}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: `1px solid ${palette.border}`,
                  backgroundColor: "#fff",
                  cursor: "pointer",
                  fontWeight: 1000,
                }}
              >
                Profile
              </button>
              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "none",
                  backgroundColor: palette.primary,
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
      </Card>

      {/* Sidebar Menu (quick navigation strip) */}
      <Card style={{ marginBottom: 12 }} className="teacher-quick-nav-card">
        <div
          className="teacher-quick-nav rg-autofit-sm" style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 10,
          }}
        >
          {sidebarItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                if (item.path.startsWith("#")) {
                  const id = item.path.replace("#", "");
                  const el = document.getElementById(id);
                  if (el)
                    el.scrollIntoView({ behavior: "smooth", block: "start" });
                  return;
                }
                navigate(item.path);
              }}
              style={{
                border: `1px solid ${palette.border}`,
                borderRadius: 12,
                padding: "10px 12px",
                backgroundColor: "#fff",
                cursor: "pointer",
                color: palette.text,
                fontWeight: 900,
                textAlign: "left",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Summary cards */}
      <div
        className="teacher-summary-grid" style={{
          display: "grid",
          gap: 12,
        }}
      >
        {[
          { label: 'Total Classes', value: myClasses.length, Icon: BookOpen, bg: 'bg-blue-50', text: 'text-blue-600', link: '/teacher/students' },
          { label: 'Total Students', value: totalStudents, Icon: GraduationCap, bg: 'bg-indigo-50', text: 'text-indigo-600', link: '/teacher/students' },
          { label: "Today's Attendance %", value: attendanceSummary ? `${Number(attendanceSummary.attendance_percentage || 0).toFixed(1)}%` : "0.0%", Icon: ClipboardList, bg: 'bg-emerald-50', text: 'text-emerald-600', link: '/teacher/attendance', isAttendance: true },
          { label: 'Pending Assignments', value: pendingAssignments, Icon: FileText, bg: 'bg-amber-50', text: 'text-amber-600', link: '/teacher/assignment' },
          { label: 'Upcoming Exams', value: upcomingExams.length, Icon: Award, bg: 'bg-violet-50', text: 'text-violet-600', link: '/teacher/upload-result', isExams: true },
        ].map((stat, i) => (
          <button
            key={i}
            type="button"
            onClick={() => navigate(stat.link)}
            className="teacher-tile-button"
          >
            <div className={`teacher-tile-icon-wrapper ${stat.bg}`}>
              <stat.Icon className={`h-5 w-5 ${stat.text}`} strokeWidth={2.4} />
            </div>
            <p className="tile-label">{stat.label}</p>
            <p
              className="tile-value"
              style={{
                color: stat.isAttendance && (attendanceSummary?.attendance_percentage || 0) < 75 ? palette.danger : undefined
              }}
            >
              {stat.value}
            </p>
            {stat.isAttendance && (
              <div style={{ marginTop: 6, width: '100%' }}>
                <MiniProgress value={attendanceSummary?.attendance_percentage || 0} />
              </div>
            )}
            {stat.isExams && (
              <p className="tile-subtext">
                {upcomingExams[0]
                  ? `${upcomingExams[0].name} on ${upcomingExams[0].start_date || upcomingExams[0].date}`
                  : "No upcoming exams"}
              </p>
            )}
          </button>
        ))}
      </div>

      <div
        className="teacher-main-grid" style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "repeat(12, minmax(0,1fr))",
          gap: 12,
        }}
      >


        {/* Right pane quick modules */}
        <Card className="col-span-5 hide-on-mobile">
          <div style={{ fontWeight: 1000, color: palette.text }}>
            Recent Activity
          </div>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {recentActivity.map((a, idx) => (
              <div
                key={`${a.type}-${idx}`}
                style={{
                  border: `1px solid ${palette.border}`,
                  borderRadius: 12,
                  padding: 10,
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 13 }}>{a.title}</div>
                <div
                  style={{
                    marginTop: 4,
                    color: palette.muted,
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  {a.type.toUpperCase()} • {String(a.time || "")}
                </div>
              </div>
            ))}
            {recentActivity.length === 0 ? (
              <div style={{ color: palette.muted, fontWeight: 900 }}>
                No activity yet.
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="col-span-4 hide-on-mobile">
          <div style={{ fontWeight: 1000, color: palette.text }}>
            My Classes
          </div>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {myClasses.map((c) => (
              <div
                key={c.id}
                style={{
                  border: `1px solid ${palette.border}`,
                  borderRadius: 12,
                  padding: 10,
                }}
              >
                <div style={{ fontWeight: 900 }}>
                  {c.class_name} - {c.section_name}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    color: palette.muted,
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  Students: {classStudentCount[c.id] || 0} | Room:{" "}
                  {c.room_number || "N/A"}
                </div>
              </div>
            ))}
            {myClasses.length === 0 ? (
              <div style={{ color: palette.muted, fontWeight: 900 }}>
                No classes assigned to you (class teacher or subject).
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="col-span-4 hide-on-mobile">
          <div style={{ fontWeight: 1000, color: palette.text }}>
            Assignments
          </div>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {(assignments || []).slice(0, 5).map((a) => (
              <div
                key={a.id}
                style={{
                  border: `1px solid ${palette.border}`,
                  borderRadius: 12,
                  padding: 10,
                }}
              >
                <div style={{ fontWeight: 900 }}>{a.title}</div>
                <div
                  style={{
                    marginTop: 4,
                    color: palette.muted,
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  Deadline: {a.due_date}
                </div>
              </div>
            ))}
            {(assignments || []).length === 0 ? (
              <div style={{ color: palette.muted, fontWeight: 900 }}>
                No assignments yet.
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="col-span-4 hide-on-mobile">
          <div style={{ fontWeight: 1000, color: palette.text }}>
            Exams & Results
          </div>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {upcomingExams.slice(0, 5).map((e) => (
              <div
                key={e.id}
                style={{
                  border: `1px solid ${palette.border}`,
                  borderRadius: 12,
                  padding: 10,
                }}
              >
                <div style={{ fontWeight: 900 }}>{e.name}</div>
                <div
                  style={{
                    marginTop: 4,
                    color: palette.muted,
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  {e.class_name} - {e.section_name} | {e.start_date || e.date}
                </div>
              </div>
            ))}
            {upcomingExams.length === 0 ? (
              <div style={{ color: palette.muted, fontWeight: 900 }}>
                No upcoming exams.
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="col-span-6" id="timetable">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 1000, color: palette.text }}>
              Today's Timetable
            </div>
            <div
              style={{
                display: "flex",
                gap: 4,
                backgroundColor: "#f1f5f9",
                padding: 4,
                borderRadius: 10,
              }}
            >
              {shifts.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedShiftId(String(s.id))}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 8,
                    fontSize: 10,
                    fontWeight: 1000,
                    border: "none",
                    backgroundColor:
                      selectedShiftId === String(s.id)
                        ? palette.primary
                        : "transparent",
                    color:
                      selectedShiftId === String(s.id) ? "#fff" : palette.muted,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  {s.name}
                </button>
              ))}
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 1000,
                color: palette.primary,
                backgroundColor: "#eff6ff",
                padding: "4px 10px",
                borderRadius: 8,
                textTransform: "uppercase",
              }}
            >
              {dayNames[todayDayNumber]}
            </span>
          </div>
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {todayClasses.length > 0 ? (
              todayClasses.map((t) => {
                const isLive = currentClass && currentClass.id === t.id;
                return (
                  <div
                    key={t.id}
                    className="teacher-timetable-item-card"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 14,
                      padding: "12px 16px",
                      borderRadius: 16,
                      backgroundColor: isLive ? "#eff6ff" : "#fff",
                      border: `1px solid ${isLive ? palette.primary : palette.border}`,
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      boxShadow: isLive
                        ? "0 4px 12px -2px rgba(59, 130, 246, 0.12)"
                        : "none",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      className="teacher-dashboard-timetable-row"
                      style={{ display: "flex", alignItems: "center", gap: 12 }}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          backgroundColor: isLive ? palette.primary : "#f8fafc",
                          color: isLive ? "#fff" : palette.muted,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 14,
                          fontWeight: 1000,
                        }}
                      >
                        {t.period_number}
                      </div>
                      <div>
                        <div
                          style={{
                            fontWeight: 1000,
                            color: palette.text,
                            fontSize: 14,
                          }}
                        >
                          {t.subject}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: palette.muted,
                            fontWeight: 900,
                          }}
                        >
                          {formatTime(t.start_time)} - {formatTime(t.end_time)}
                        </div>
                      </div>
                    </div>
                    <div className="teacher-dashboard-timetable-meta" style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontWeight: 1000,
                          color: isLive ? palette.primary : palette.text,
                          fontSize: 12,
                        }}
                      >
                        {t.class_name}-{t.section}
                      </div>
                      {isLive && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            justifyContent: "flex-end",
                            marginTop: 2,
                          }}
                        >
                          <div
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              backgroundColor: palette.primary,
                              boxShadow: "0 0 8px #2563eb",
                            }}
                          ></div>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 1000,
                              color: palette.primary,
                              textTransform: "uppercase",
                            }}
                          >
                            Live Now
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div
                style={{
                  padding: 20,
                  textAlign: "center",
                  border: `1px dashed ${palette.border}`,
                  borderRadius: 14,
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 8 }}>📅</div>
                <div
                  style={{
                    color: palette.muted,
                    fontWeight: 900,
                    fontSize: 13,
                  }}
                >
                  No classes scheduled for today
                </div>
                <button
                  onClick={() => navigate("/teacher/timetable")}
                  style={{
                    marginTop: 10,
                    color: palette.primary,
                    background: "none",
                    border: "none",
                    fontWeight: 1000,
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  View Full Schedule
                </button>
              </div>
            )}
          </div>
        </Card>

        <Card className="col-span-6 hide-on-mobile" id="study-material">
          <div style={{ fontWeight: 1000, color: palette.text }}>
            Study Material (Subject-wise)
          </div>
          <div
            className="rg-2" style={{
              marginTop: 12,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 10,
            }}
          >
            {(filteredSubjects || []).slice(0, 6).map((s) => (
              <div
                key={s.id}
                style={{
                  border: `1px solid ${palette.border}`,
                  borderRadius: 14,
                  padding: 12,
                  backgroundColor: "#f8fafc",
                  display: "flex",
                  flexDirection: "column",
                  minWidth: 0,
                }}
              >
                <div
                  style={{ 
                    fontWeight: 900, 
                    fontSize: 14, 
                    color: palette.text,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.name}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    minWidth: 0,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      color: palette.muted,
                      fontSize: 11,
                      fontWeight: 900,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    Class: {s.class_name}
                  </span>
                  <span
                    style={{
                      px: 2,
                      py: 0.5,
                      backgroundColor: "#fff",
                      border: `1px solid ${palette.border}`,
                      borderRadius: 6,
                      fontSize: 9,
                      fontWeight: 1000,
                      color: palette.success,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {s.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
            {(filteredSubjects || []).length === 0 ? (
              <div
                style={{
                  gridColumn: "span 2",
                  color: palette.muted,
                  fontWeight: 900,
                  textAlign: "center",
                  py: 10,
                }}
              >
                No active subjects found.
              </div>
            ) : null}
          </div>
        </Card>

        {/* School Gallery Highlights */}
        <Card className="col-span-12">
          <div style={{ fontWeight: 1000, color: palette.text }}>
            School Gallery Highlights
          </div>
          <div
            style={{
              marginTop: 4,
              color: palette.muted,
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            Auto-rotating moments from your school gallery
          </div>
          <div
            style={{
              marginTop: 12,
              height: 220,
              borderRadius: 16,
              border: `1px solid ${palette.border}`,
              backgroundColor: "#f8fafc",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {galleryLoading ? (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: palette.muted,
                  fontWeight: 1000,
                }}
              >
                Loading gallery...
              </div>
            ) : galleryImages.length === 0 ? (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  color: palette.muted,
                  fontWeight: 1000,
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 8, opacity: 0.3 }}>🖼️</div>
                No gallery images uploaded yet.
              </div>
            ) : (
              <>
                {galleryImages.map((img, idx) => (
                  <img
                    key={img.id}
                    src={`${resolveImageUrl(img.image_url)}${galleryToken ? `?token=${galleryToken}` : ''}`}
                    alt={img.title}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      transition: "opacity 700ms ease",
                      opacity: idx === currentGallerySlide ? 1 : 0,
                      userSelect: "none",
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                    onDragStart={(e) => e.preventDefault()}
                  />
                ))}
                <div
                  style={{
                    position: "absolute",
                    inset: "auto 0 0 0",
                    padding: 12,
                    background: "linear-gradient(to top, rgba(0,0,0,0.55), transparent)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-end",
                  }}
                >
                  <p
                    style={{
                      color: "#fff",
                      fontWeight: 1000,
                      fontSize: 14,
                      margin: 0,
                      textShadow: "0 1px 4px rgba(0,0,0,0.4)",
                    }}
                  >
                    {galleryImages[currentGallerySlide]?.title}
                  </p>
                  <div style={{ display: "flex", gap: 6 }}>
                    {galleryImages.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCurrentGallerySlide(idx)}
                        style={{
                          width: idx === currentGallerySlide ? 20 : 8,
                          height: 8,
                          borderRadius: 99,
                          border: "none",
                          backgroundColor:
                            idx === currentGallerySlide
                              ? "#fff"
                              : "rgba(255,255,255,0.4)",
                          cursor: "pointer",
                          transition: "all 300ms ease",
                          padding: 0,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default TeacherDashboard;
