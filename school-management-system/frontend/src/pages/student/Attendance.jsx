import React, { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import { useStudent } from "../../context/StudentContext";

const colors = {
  present: "#16a34a",
  late: "#f59e0b",
  absent: "#ef4444",
  holiday: "#9ca3af",
  border: "#e5e7eb",
  muted: "#6b7280",
  primary: "#2563eb",
  bg: "#ffffff",
  card: "#fff",
};

const labelStyle = {
  fontSize: "12px",
  color: colors.muted,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const cardStyle = {
  backgroundColor: colors.card,
  borderRadius: "16px",
  border: `1px solid ${colors.border}`,
  padding: "16px",
  boxShadow: "0 1px 6px rgba(16,24,40,0.06)",
};

function parseDateOnly(value) {
  // Backend sends DateField as `YYYY-MM-DD`.
  // Using `new Date(value)` may interpret as UTC and shift dates by timezone.
  if (typeof value !== "string") return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  return new Date(y, mo - 1, d);
}

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
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

function formatAttendanceStatus(rec) {
  const v = (rec?.verification_status || "").toLowerCase();
  if (v === "pending") return "Pending";
  if (v === "approved") {
    const st = (rec?.status || "").toLowerCase();
    if (st === "late") return "Late";
    return "Present";
  }
  if (v === "rejected") return "Absent";
  // Fallback for legacy records (no verification_status).
  return formatStatus(rec?.status);
}

function statusColorForAttendance(rec) {
  const v = (rec?.verification_status || "").toLowerCase();
  if (v === "pending") return colors.late; // yellow
  if (v === "approved") {
    const st = (rec?.status || "").toLowerCase();
    return st === "late" ? colors.late : colors.present;
  }
  if (v === "rejected") return colors.absent;
  // Fallback for legacy records (no verification_status).
  return statusColor(rec?.status);
}

function isPending(rec) {
  return (rec?.verification_status || "").toLowerCase() === "pending";
}

function isApproved(rec) {
  const v = (rec?.verification_status || "").toLowerCase();
  if (v) return v === "approved";
  // legacy fallback
  const st = (rec?.status || "").toLowerCase();
  return st === "present" || st === "late";
}

function isRejected(rec) {
  const v = (rec?.verification_status || "").toLowerCase();
  if (v) return v === "rejected";
  // legacy fallback
  return (rec?.status || "").toLowerCase() === "absent";
}

function CircularProgress({ percentage }) {
  const pct = Math.max(0, Math.min(100, Number(percentage) || 0));
  const size = 64;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const isLow = pct < 75;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
          stroke={isLow ? colors.absent : colors.present}
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
          style={{
            fontWeight: 1000,
            fontSize: "18px",
            color: isLow ? colors.absent : "#166534",
          }}
        >
          {pct.toFixed(1)}%
        </div>
        <div style={{ color: colors.muted, fontWeight: 900, fontSize: "12px" }}>
          Attendance
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ percentage }) {
  const pct = Math.max(0, Math.min(100, Number(percentage) || 0));
  const isLow = pct < 75;
  return (
    <div
      style={{
        height: 10,
        borderRadius: 999,
        backgroundColor: "#f3f4f6",
        overflow: "hidden",
        border: `1px solid ${colors.border}`,
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          backgroundColor: isLow ? colors.absent : colors.present,
          borderRadius: 999,
        }}
      />
    </div>
  );
}

const StudentAttendance = () => {
  const now = new Date();
  const { selectedStudentId } = useStudent();
  const [attendance, setAttendance] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(false);

  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [filterDate, setFilterDate] = useState(""); // optional YYYY-MM-DD

  const [reportPeriod, setReportPeriod] = useState("monthly"); // monthly|yearly
  const [reportMonth, setReportMonth] = useState(calMonth);
  const [reportYear, setReportYear] = useState(calYear);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    Promise.allSettled([
      api.get("attendance/my-attendance/"),
      api.get("timetable/"),
    ])
      .then((results) => {
        if (!mounted) return;

        const [attendanceResult, timetableResult] = results;
        if (attendanceResult.status === "fulfilled") {
          setAttendance(attendanceResult.value?.data || []);
        } else {
          setAttendance([]);
        }

        if (timetableResult.status === "fulfilled") {
          setTimetable(timetableResult.value?.data || []);
        } else {
          setTimetable([]);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [selectedStudentId]);

  useEffect(() => {
    setHolidays([]);
    api
      .get("holidays/", { params: { month: calMonth, year: calYear } })
      .then((res) => setHolidays(res.data || []));
  }, [calMonth, calYear]);

  const attendanceMap = useMemo(() => {
    const map = new Map(); // dateKey => record
    (attendance || []).forEach((r) => {
      const d = parseDateOnly(r.date);
      if (!d) return;
      map.set(toDateKey(d), r);
    });
    return map;
  }, [attendance]);

  const holidayByDay = useMemo(() => {
    const set = new Set();
    (holidays || []).forEach((h) => {
      const start = parseDateOnly(h.start_date);
      const end = parseDateOnly(h.end_date || h.start_date);
      if (!start || !end) return;
      const cur = new Date(start);
      cur.setHours(0, 0, 0, 0);
      const last = new Date(end);
      last.setHours(0, 0, 0, 0);
      while (cur <= last) {
        set.add(toDateKey(cur));
        cur.setDate(cur.getDate() + 1);
      }
    });
    return set;
  }, [holidays]);

  const daysInMonth = (y, m) => new Date(y, m, 0).getDate();
  const totalDays = daysInMonth(calYear, calMonth);
  const calendarCells = useMemo(() => {
    const first = new Date(calYear, calMonth - 1, 1);
    const jsDay = first.getDay(); // 0 Sunday .. 6 Saturday
    const mondayBased = (jsDay + 6) % 7; // 0 for Monday

    const cells = [];
    for (let i = 0; i < mondayBased; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) {
      cells.push(toDateKey(new Date(calYear, calMonth - 1, d)));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [calMonth, calYear, totalDays]);

  const monthRecords = useMemo(() => {
    const filtered = [];
    const startKeyDate = new Date(calYear, calMonth - 1, 1);
    const endKeyDate = new Date(calYear, calMonth - 1, totalDays);
    const startTime = startKeyDate.getTime();
    const endTime = endKeyDate.getTime();

    (attendance || []).forEach((r) => {
      const d = parseDateOnly(r.date);
      if (!d) return;
      const t = d.getTime();
      if (t < startTime || t > endTime) return;
      filtered.push(r);
    });

    filtered.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    return filtered;
  }, [attendance, calMonth, calYear, totalDays]);

  const overview = useMemo(() => {
    const presentDays = monthRecords.filter((r) => isApproved(r)).length;
    const absentDays = monthRecords.filter((r) => isRejected(r)).length;
    const totalMarkedDays = presentDays + absentDays;
    const attendancePercentage = totalMarkedDays
      ? (presentDays / totalMarkedDays) * 100
      : 0;
    return { presentDays, absentDays, totalMarkedDays, attendancePercentage };
  }, [monthRecords]);

  const showLowAlert =
    overview.attendancePercentage > 0 && overview.attendancePercentage < 75;

  const dailyRows = useMemo(() => {
    let rows = monthRecords
      .slice()
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    if (filterDate) {
      rows = rows.filter((r) => r.date === filterDate);
    }
    return rows;
  }, [monthRecords, filterDate]);

  const timetableByDay = useMemo(() => {
    const map = new Map(); // day -> [entries]
    (timetable || []).forEach((t) => {
      const arr = map.get(t.day) || [];
      arr.push(t);
      map.set(t.day, arr);
    });
    return map;
  }, [timetable]);

  const subjectRows = useMemo(() => {
    const dayNames = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    const totals = new Map(); // subject -> {present, total}

    for (let d = 1; d <= totalDays; d++) {
      const cur = new Date(calYear, calMonth - 1, d);
      const key = toDateKey(cur);
      if (holidayByDay.has(key)) continue;

      const rec = attendanceMap.get(key);
      if (!rec) continue; // skip days without attendance record

      // JS getDay(): 0=Sunday..6=Saturday. We need timetable day keys: Monday..Sunday.
      const dayName = dayNames[(cur.getDay() + 6) % 7];
      const entries = timetableByDay.get(dayName) || [];
      if (!entries.length) continue;

      if (isPending(rec)) continue;

      entries.forEach((t) => {
        const s = t.subject;
        const current = totals.get(s) || { present: 0, total: 0 };
        current.total += 1;
        if (isApproved(rec)) current.present += 1;
        totals.set(s, current);
      });
    }

    const rows = [];
    totals.forEach((v, subject) => {
      rows.push({
        subject_name: subject,
        present_classes: v.present,
        total_classes: v.total,
        percentage: v.total ? (v.present / v.total) * 100 : 0,
      });
    });
    rows.sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
    return rows;
  }, [
    attendanceMap,
    calMonth,
    calYear,
    holidayByDay,
    timetableByDay,
    totalDays,
  ]);

  const attendanceTrendPoints = useMemo(() => {
    // Build week-wise points for a clean sparkline.
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const points = [];

    const weekBuckets = new Map(); // idx -> {marked, attended}
    for (let d = 1; d <= totalDays; d++) {
      const cur = new Date(calYear, calMonth - 1, d);
      const key = toDateKey(cur);
      if (holidayByDay.has(key)) continue;

      const rec = attendanceMap.get(key);
      if (!rec) continue;

      if (isPending(rec)) continue;
      const attended = isApproved(rec) ? 1 : 0;
      const weekIdx = Math.floor((d - 1) / 7);
      const bucket = weekBuckets.get(weekIdx) || { marked: 0, attended: 0 };
      bucket.marked += 1;
      bucket.attended += attended;
      weekBuckets.set(weekIdx, bucket);
    }

    Array.from(weekBuckets.keys())
      .sort((a, b) => a - b)
      .forEach((idx) => {
        const b = weekBuckets.get(idx);
        const pct = b.marked ? (b.attended / b.marked) * 100 : 0;
        points.push({ x: idx, y: pct });
      });

    return points;
  }, [attendanceMap, calMonth, calYear, holidayByDay, totalDays]);

  const downloadReport = async () => {
    try {
      const params = {
        period: reportPeriod,
        year: reportYear,
      };
      if (reportPeriod === "monthly") params.month = reportMonth;

      const res = await api.get("attendance/my/report/pdf/", {
        params,
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      const fileName = `attendance_report_${reportPeriod}_${reportPeriod === "monthly" ? `${reportMonth}_${reportYear}` : reportYear}.pdf`;
      a.href = url;
      a.download = fileName;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert("Could not download attendance report.");
    }
  };

  return (
    <div
      style={{
        padding: "24px",
        backgroundColor: "#f9fafb",
        minHeight: "calc(100vh - 80px)",
      }}
    >
      <style>
        {`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-up { animation: fadeIn 0.4s ease forwards; }
                `}
      </style>

      {/* Premium Header Card */}
      <div
        className="animate-up"
        style={{
          backgroundColor: "#fff",
          padding: "28px",
          borderRadius: "24px",
          marginBottom: "20px",
          boxShadow: "0 1px 12px rgba(16,24,40,0.08)",
          border: "1px solid #e5e7eb",
          background: "linear-gradient(135deg, #fff 0%, #f8fafc 100%)",
          position: "relative",
          overflow: "hidden",
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
            gap: "20px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontWeight: 1000,
                fontSize: "32px",
                letterSpacing: "-0.02em",
                background: "linear-gradient(90deg, #1e293b 0%, #2563eb 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Attendance Dashboard
            </h1>
            <p
              style={{
                margin: "8px 0 0",
                color: colors.muted,
                fontWeight: 900,
                fontSize: "15px",
              }}
            >
              Monitor your presence, view subject-wise analysis, and download
              academic reports.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: "12px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "#fff",
                padding: "6px 12px",
                borderRadius: "16px",
                border: "1px solid #e5e7eb",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  color: "#64748b",
                  fontWeight: 900,
                  textTransform: "uppercase",
                }}
              >
                Month
              </span>
              <select
                value={calMonth}
                onChange={(e) => setCalMonth(parseInt(e.target.value, 10))}
                style={{
                  padding: "6px 4px",
                  border: "none",
                  background: "transparent",
                  fontWeight: 1000,
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                {Array.from({ length: 12 }).map((_, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {new Date(2000, idx).toLocaleString("default", {
                      month: "long",
                    })}
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "#fff",
                padding: "6px 12px",
                borderRadius: "16px",
                border: "1px solid #e5e7eb",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  color: "#64748b",
                  fontWeight: 900,
                  textTransform: "uppercase",
                }}
              >
                Year
              </span>
              <input
                type="number"
                value={calYear}
                onChange={(e) => setCalYear(parseInt(e.target.value, 10))}
                style={{
                  width: "80px",
                  padding: "6px 4px",
                  border: "none",
                  background: "transparent",
                  fontWeight: 1000,
                  outline: "none",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {showLowAlert ? (
        <div
          style={{
            marginTop: "14px",
            border: `1px solid #fecaca`,
            background: "#fff7ed",
            padding: "12px 14px",
            borderRadius: "14px",
            color: "#991b1b",
            fontWeight: 1000,
            display: "flex",
            gap: "10px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              borderRadius: 999,
              backgroundColor: colors.absent,
            }}
          />
          Your attendance is below 75%. Please take care and improve attendance.
        </div>
      ) : null}

      <div className="attendance-grid">
        <div className="attendance-card-half" style={cardStyle}>
          <CircularProgress percentage={overview.attendancePercentage} />
          <div style={{ marginTop: 12 }}>
            <ProgressBar percentage={overview.attendancePercentage} />
          </div>
          <div
            style={{
              marginTop: 10,
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{ color: colors.primary, fontWeight: 900, fontSize: "12px" }}
            >
              Total Days: {overview.totalMarkedDays}
            </div>
            <div
              style={{ color: colors.present, fontWeight: 900, fontSize: "12px" }}
            >
              Present: {overview.presentDays}
            </div>
            <div
              style={{ color: colors.absent, fontWeight: 900, fontSize: "12px" }}
            >
              Absent: {overview.absentDays}
            </div>
          </div>
          <div
            style={{
              marginTop: 8,
              color: colors.muted,
              fontWeight: 900,
              fontSize: "12px",
            }}
          >
            Attendance % = (Present Days / Total Days) * 100
          </div>
        </div>

        <div className="attendance-card-sixth attendance-sec-metrics" style={cardStyle}>
          <div style={{ ...labelStyle }}>Total Days</div>
          <div
            style={{
              marginTop: 8,
              fontWeight: 1000,
              fontSize: "26px",
              color: "#111827",
            }}
          >
            {overview.totalMarkedDays}
          </div>
          <div
            style={{
              marginTop: 8,
              color: colors.muted,
              fontWeight: 900,
              fontSize: "12px",
            }}
          >
            Present + Absent
          </div>
        </div>

        <div className="attendance-card-sixth attendance-sec-metrics" style={cardStyle}>
          <div style={{ ...labelStyle }}>Total Present Days</div>
          <div
            style={{
              marginTop: 8,
              fontWeight: 1000,
              fontSize: "26px",
              color: colors.present,
            }}
          >
            {overview.presentDays}
          </div>
          <div
            style={{
              marginTop: 8,
              color: colors.muted,
              fontWeight: 900,
              fontSize: "12px",
            }}
          >
            Includes Late
          </div>
        </div>

        <div className="attendance-card-sixth attendance-sec-metrics" style={cardStyle}>
          <div style={{ ...labelStyle }}>Total Absent Days</div>
          <div
            style={{
              marginTop: 8,
              fontWeight: 1000,
              fontSize: "26px",
              color: colors.absent,
            }}
          >
            {overview.absentDays}
          </div>
          <div
            style={{
              marginTop: 8,
              color: colors.muted,
              fontWeight: 900,
              fontSize: "12px",
            }}
          >
            Marked as Absent
          </div>
        </div>

        <div className="attendance-card-sixth attendance-sec-metrics" style={cardStyle}>
          <div style={{ ...labelStyle }}>Attendance %</div>
          <div
            style={{
              marginTop: 8,
              fontWeight: 1000,
              fontSize: "26px",
              color:
                overview.attendancePercentage < 75
                  ? colors.absent
                  : colors.present,
            }}
          >
            {overview.attendancePercentage.toFixed(1)}%
          </div>
          <div
            style={{
              marginTop: 8,
              color: colors.muted,
              fontWeight: 900,
              fontSize: "12px",
            }}
          >
            Monthly
          </div>
        </div>

        <div className="attendance-card-full attendance-sec-trend" style={cardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={labelStyle}>Attendance Trend</div>
              <div style={{ marginTop: 6, fontWeight: 1000, color: "#111827" }}>
                {calMonth}/{calYear}
              </div>
            </div>
            <div
              style={{ color: colors.muted, fontWeight: 900, fontSize: "12px" }}
            >
              Week-wise attended percentage (Present + Late)
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            {attendanceTrendPoints.length ? (
              <TrendSparkline points={attendanceTrendPoints} />
            ) : (
              <div
                style={{
                  color: colors.muted,
                  fontWeight: 900,
                  fontSize: "13px",
                }}
              >
                No attendance data for this month.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="attendance-grid">
        <div className="attendance-card-seventh attendance-sec-daily" style={cardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={labelStyle}>Daily Attendance</div>
              <div style={{ marginTop: 6, fontWeight: 1000, color: "#111827" }}>
                Date and Status
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: "10px",
                alignItems: "flex-end",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={labelStyle}>Filter Date (optional)</div>
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "12px",
                    border: `1px solid ${colors.border}`,
                    background: "#fff",
                    fontWeight: 900,
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => setFilterDate("")}
                style={{
                  padding: "10px 12px",
                  borderRadius: "12px",
                  border: `1px solid ${colors.border}`,
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: 1000,
                  color: colors.primary,
                  height: 42,
                }}
              >
                Clear
              </button>
            </div>
          </div>

          <div style={{ marginTop: 12, overflowX: "auto" }}>
            <div className="table-scroll"><table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f2f4f7" }}>
                  <th
                    style={{
                      padding: "12px 10px",
                      textAlign: "left",
                      color: colors.muted,
                      fontWeight: 1000,
                      fontSize: 12,
                    }}
                  >
                    Date
                  </th>
                  <th
                    style={{
                      padding: "12px 10px",
                      textAlign: "left",
                      color: colors.muted,
                      fontWeight: 1000,
                      fontSize: 12,
                    }}
                  >
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={2}
                      style={{
                        padding: 14,
                        color: colors.muted,
                        fontWeight: 900,
                      }}
                    >
                      Loading...
                    </td>
                  </tr>
                ) : dailyRows.length ? (
                  dailyRows.map((r) => (
                    <tr
                      key={r.id}
                      style={{ borderTop: `1px solid ${colors.border}` }}
                    >
                      <td style={{ padding: "12px 10px", fontWeight: 900 }}>
                        {r.date}
                      </td>
                      <td style={{ padding: "12px 10px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "6px 10px",
                            borderRadius: 999,
                            backgroundColor: "#f3f4f6",
                            border: `1px solid ${colors.border}`,
                            color: statusColorForAttendance(r),
                            fontWeight: 1000,
                            fontSize: 12,
                          }}
                        >
                          {formatAttendanceStatus(r)}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={2}
                      style={{
                        padding: 14,
                        color: colors.muted,
                        fontWeight: 900,
                      }}
                    >
                      No attendance records for this month.
                    </td>
                  </tr>
                )}
              </tbody>
            </table></div>
          </div>
        </div>

        <div className="attendance-card-fifth" style={cardStyle}>
          <div style={labelStyle}>Monthly Calendar</div>
          <div style={{ marginTop: 6, fontWeight: 1000, color: "#111827" }}>
            {calMonth}/{calYear}
          </div>

          <div
            style={{
              marginTop: 10,
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <LegendItem label="Pending" color={colors.late} />
            <LegendItem label="Present" color={colors.present} />
            <LegendItem label="Late" color={colors.late} />
            <LegendItem label="Absent" color={colors.absent} />
            <LegendItem label="Holiday" color={colors.holiday} />
          </div>

          <div style={{ marginTop: 12, overflowX: "auto" }}>
            <div className="rg-calendar">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div
                  key={d}
                  style={{
                    color: colors.muted,
                    fontWeight: 1000,
                    fontSize: 12,
                    textTransform: "uppercase",
                  }}
                >
                  {d}
                </div>
              ))}

              {calendarCells.map((key, idx) => {
                if (!key)
                  return <div key={`empty-${idx}`} className="rg-calendar-cell empty" style={{ height: 46 }} />;

                const rec = attendanceMap.get(key);
                const isHoliday = holidayByDay.has(key);
                const v = (rec?.verification_status || "").toLowerCase();
                const st = (rec?.status || "").toLowerCase();

                const borderColor = isHoliday
                  ? colors.holiday
                  : v === "pending"
                    ? colors.late
                    : v === "rejected"
                      ? colors.absent
                      : st === "present"
                        ? colors.present
                        : st === "late"
                          ? colors.late
                          : st === "absent"
                            ? colors.absent
                            : colors.border;

                const bg = isHoliday
                  ? "#f3f4f6"
                  : v === "pending"
                    ? "#fffbeb"
                    : v === "rejected"
                      ? "#fef2f2"
                      : st === "present"
                        ? "#ecfdf5"
                        : st === "late"
                          ? "#fffbeb"
                          : st === "absent"
                            ? "#fef2f2"
                            : "#fff";

                const text = isHoliday
                  ? "H"
                  : rec
                    ? (v === "pending"
                        ? "Pending"
                        : formatAttendanceStatus(rec)
                      ).split(" ")[0]
                    : "";
                const dayNum = parseInt(key.slice(-2), 10);

                return (
                  <div
                    key={key}
                    className="rg-calendar-cell"
                    style={{
                      height: 46,
                      borderRadius: 12,
                      border: `1px solid ${borderColor}`,
                      backgroundColor: bg,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      padding: "8px 8px",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 1000,
                        color: "#111827",
                        fontSize: 12,
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>{dayNum}</span>
                      {key === toDateKey(new Date()) ? (
                        <span
                          style={{
                            fontSize: 10,
                            color: colors.primary,
                            fontWeight: 1000,
                          }}
                        >
                          Today
                        </span>
                      ) : null}
                    </div>
                    <div
                      className="calendar-status-text"
                      style={{
                        fontSize: 10,
                        fontWeight: 1000,
                        color: isHoliday ? colors.muted : borderColor,
                        textAlign: "center",
                        marginTop: 2,
                      }}
                    >
                      {text ? text : " "}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="attendance-card-full attendance-sec-subjects" style={cardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={labelStyle}>Subject-wise Attendance</div>
              <div style={{ marginTop: 6, fontWeight: 1000, color: "#111827" }}>
                Based on your weekly timetable (Present + Late = attended)
              </div>
            </div>
            <div style={{ color: colors.muted, fontWeight: 900, fontSize: 12 }}>
              Holidays are excluded from subject-wise calculation
            </div>
          </div>

          <div style={{ marginTop: 12, overflowX: "auto" }}>
            <div className="table-scroll"><table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f2f4f7" }}>
                  <th
                    style={{
                      padding: "12px 10px",
                      textAlign: "left",
                      color: colors.muted,
                      fontWeight: 1000,
                      fontSize: 12,
                    }}
                  >
                    Subject
                  </th>
                  <th
                    style={{
                      padding: "12px 10px",
                      textAlign: "left",
                      color: colors.muted,
                      fontWeight: 1000,
                      fontSize: 12,
                    }}
                  >
                    Present
                  </th>
                  <th
                    style={{
                      padding: "12px 10px",
                      textAlign: "left",
                      color: colors.muted,
                      fontWeight: 1000,
                      fontSize: 12,
                    }}
                  >
                    Total Classes
                  </th>
                  <th
                    style={{
                      padding: "12px 10px",
                      textAlign: "left",
                      color: colors.muted,
                      fontWeight: 1000,
                      fontSize: 12,
                    }}
                  >
                    Percentage
                  </th>
                </tr>
              </thead>
              <tbody>
                {subjectRows.length ? (
                  subjectRows.map((row) => (
                    <tr
                      key={row.subject_name}
                      style={{ borderTop: `1px solid ${colors.border}` }}
                    >
                      <td style={{ padding: "12px 10px", fontWeight: 1000 }}>
                        {row.subject_name}
                      </td>
                      <td
                        style={{
                          padding: "12px 10px",
                          fontWeight: 900,
                          color: colors.present,
                        }}
                      >
                        {row.present_classes}
                      </td>
                      <td
                        style={{
                          padding: "12px 10px",
                          fontWeight: 900,
                          color: colors.muted,
                        }}
                      >
                        {row.total_classes}
                      </td>
                      <td style={{ padding: "12px 10px" }}>
                        <div
                          style={{
                            fontWeight: 1000,
                            marginBottom: 8,
                            fontSize: 13,
                            color: "#111827",
                          }}
                        >
                          {row.percentage.toFixed(1)}%
                        </div>
                        <ProgressBar percentage={row.percentage} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        padding: 14,
                        color: colors.muted,
                        fontWeight: 900,
                      }}
                    >
                      Subject-wise attendance not available for this month (no
                      timetable/attendance records matched).
                    </td>
                  </tr>
                )}
              </tbody>
            </table></div>
          </div>
        </div>

        <div className="attendance-card-full" style={cardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={labelStyle}>Download Report (PDF)</div>
              <div style={{ marginTop: 6, fontWeight: 1000, color: "#111827" }}>
                Monthly / Yearly attendance summary
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: "10px",
                alignItems: "flex-end",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={labelStyle}>Period</div>
                <select
                  value={reportPeriod}
                  onChange={(e) => {
                    const v = e.target.value;
                    setReportPeriod(v);
                    if (v === "monthly") {
                      setReportMonth(calMonth);
                      setReportYear(calYear);
                    } else {
                      setReportYear(calYear);
                    }
                  }}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "12px",
                    border: `1px solid ${colors.border}`,
                    background: "#fff",
                    fontWeight: 900,
                  }}
                >
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              {reportPeriod === "monthly" ? (
                <div>
                  <div style={labelStyle}>Month</div>
                  <select
                    value={reportMonth}
                    onChange={(e) =>
                      setReportMonth(parseInt(e.target.value, 10))
                    }
                    style={{
                      padding: "10px 12px",
                      borderRadius: "12px",
                      border: `1px solid ${colors.border}`,
                      background: "#fff",
                      fontWeight: 900,
                    }}
                  >
                    {Array.from({ length: 12 }).map((_, idx) => {
                      const m = idx + 1;
                      return (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      );
                    })}
                  </select>
                </div>
              ) : null}
              <div>
                <div style={labelStyle}>Year</div>
                <input
                  type="number"
                  value={reportYear}
                  onChange={(e) => setReportYear(parseInt(e.target.value, 10))}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "12px",
                    border: `1px solid ${colors.border}`,
                    background: "#fff",
                    fontWeight: 900,
                    width: 130,
                  }}
                />
              </div>
              <button
                type="button"
                onClick={downloadReport}
                style={{
                  padding: "12px 14px",
                  borderRadius: "12px",
                  border: "none",
                  backgroundColor: colors.primary,
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 1000,
                  height: 44,
                  whiteSpace: "nowrap",
                }}
              >
                Download PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function LegendItem({ label, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          backgroundColor: color,
          display: "inline-block",
        }}
      />
      <span style={{ color: colors.muted, fontWeight: 1000, fontSize: 12 }}>
        {label}
      </span>
    </div>
  );
}

function TrendSparkline({ points }) {
  // Draw a simple SVG sparkline from week-wise points.
  const width = 680;
  const height = 120;
  const padding = 18;

  const ys = points.map((p) => p.y);
  const minY = 0;
  const maxY = ys.length ? Math.max(100, ...ys) : 100;

  const xs = points.map((_, idx) => idx);
  const minX = 0;
  const maxX = Math.max(1, xs.length - 1);

  const xScale = (i) =>
    padding + ((width - padding * 2) * (i - minX)) / (maxX - minX);
  const yScale = (y) =>
    height -
    padding -
    ((height - padding * 2) * (y - minY)) / (maxY - minY || 1);

  const linePath = points
    .map((p, idx) => {
      const x = xScale(idx);
      const y = yScale(p.y);
      return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`}>
        <path
          d={linePath}
          fill="none"
          stroke="#2563eb"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {points.map((p, idx) => {
          const x = xScale(idx);
          const y = yScale(p.y);
          return (
            <g key={`${p.x}-${idx}`}>
              <circle
                cx={x}
                cy={y}
                r="4.5"
                fill="#ffffff"
                stroke="#2563eb"
                strokeWidth="2"
              />
            </g>
          );
        })}
        <text
          x={padding}
          y={height - 6}
          fontSize="11"
          fill="#6b7280"
          fontWeight="900"
        >
          Low
        </text>
        <text
          x={padding}
          y={padding + 6}
          fontSize="11"
          fill="#6b7280"
          fontWeight="900"
        >
          100%
        </text>
      </svg>
    </div>
  );
}

export default StudentAttendance;
