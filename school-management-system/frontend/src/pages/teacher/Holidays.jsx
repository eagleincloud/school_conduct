import React, { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import { useNavigate } from "react-router-dom";

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
  info: "#0ea5e9",
  shadow: "0 1px 12px rgba(16,24,40,0.08)",
};

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  border: `1px solid ${palette.border}`,
  borderRadius: "14px",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
  backgroundColor: "#fff",
  fontWeight: 900,
  transition: "all 0.2s",
};

const labelStyle = {
  fontSize: "11px",
  color: palette.muted,
  fontWeight: 1000,
  marginBottom: "6px",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatDateRange(h) {
  if (!h?.end_date || h.end_date === h.start_date) return h.start_date;
  return `${h.start_date} — ${h.end_date}`;
}

function parseDateOnly(value) {
  if (typeof value !== "string") {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const da = parseInt(m[3], 10);
  return new Date(y, mo - 1, da);
}

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const TeacherHolidays = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState("calendar");
  const [loading, setLoading] = useState(false);
  const [holidays, setHolidays] = useState([]);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterYear, setFilterYear] = useState(
    String(new Date().getFullYear()),
  );

  const now = new Date();
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [calYear, setCalYear] = useState(now.getFullYear());

  const [selectedDate, setSelectedDate] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const loadHolidays = async (params) => {
    setLoading(true);
    try {
      const res = await api.get("holidays/", { params });
      setHolidays(res.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "list") {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (filterType !== "all") params.type = filterType;
      if (filterMonth) params.month = filterMonth;
      if (filterYear) params.year = filterYear;
      loadHolidays(params).catch(() => {});
    }
  }, [tab, search, filterType, filterMonth, filterYear]);

  useEffect(() => {
    if (tab === "calendar") {
      loadHolidays({ month: calMonth, year: calYear }).catch(() => {});
    }
  }, [tab, calMonth, calYear]);

  const filteredHolidays = useMemo(() => {
    let list = holidays || [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (h) =>
          (h.title || "").toLowerCase().includes(q) ||
          (h.description || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [holidays, search]);

  const holidayByDay = useMemo(() => {
    const map = new Map();
    (holidays || []).forEach((h) => {
      const start = parseDateOnly(h.start_date);
      const end = parseDateOnly(h.end_date || h.start_date);
      if (!start || !end) return;
      const cursor = new Date(start);
      while (cursor <= end) {
        const key = toDateKey(cursor);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(h);
        cursor.setDate(cursor.getDate() + 1);
      }
    });
    return map;
  }, [holidays]);

  const daysInMonth = (y, m) => new Date(y, m, 0).getDate();
  const calendarCells = useMemo(() => {
    const first = new Date(calYear, calMonth - 1, 1);
    const jsDay = first.getDay();
    const mondayBased = (jsDay + 6) % 7;
    const totalDays = daysInMonth(calYear, calMonth);

    const cells = [];
    for (let i = 0; i < mondayBased; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) {
      const key = toDateKey(new Date(calYear, calMonth - 1, d));
      cells.push(key);
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [calMonth, calYear]);

  const openDetails = (d) => {
    setSelectedDate(d);
    setDetailsOpen(true);
  };

  const closeDetails = () => {
    setSelectedDate(null);
    setDetailsOpen(false);
  };

  return (
    <div
      style={{
        padding: "24px",
        backgroundColor: palette.bg,
        minHeight: "calc(100vh - 64px)",
      }}
    >
      <style>
        {`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .holiday-animate { animation: fadeIn 0.4s ease forwards; }
                .calendar-cell:hover { transform: scale(1.02); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
                `}
      </style>

      {/* Header */}
      <div
        style={{
          backgroundColor: palette.card,
          padding: "24px",
          borderRadius: "20px",
          marginBottom: "20px",
          boxShadow: palette.shadow,
          border: `1px solid ${palette.border}`,
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
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontWeight: 1000,
                fontSize: "30px",
                letterSpacing: "-0.02em",
                background: "linear-gradient(90deg, #1e293b 0%, #2563eb 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Holidays
            </h1>
            <p
              style={{
                margin: "8px 0 0",
                color: palette.muted,
                fontWeight: 900,
                fontSize: "15px",
              }}
            >
              Explore the upcoming holiday schedule and school breaks.
            </p>
          </div>
          <div
            style={{
              display: "flex",
              gap: "8px",
              backgroundColor: "#f1f5f9",
              padding: "4px",
              borderRadius: "14px",
            }}
          >
            <button
              type="button"
              onClick={() => setTab("calendar")}
              style={{
                padding: "10px 18px",
                borderRadius: "10px",
                border: "none",
                cursor: "pointer",
                backgroundColor:
                  tab === "calendar" ? palette.primary : "transparent",
                color: tab === "calendar" ? "#fff" : palette.muted,
                fontWeight: 1000,
                fontSize: "13px",
                transition: "all 0.2s",
              }}
            >
              Calendar View
            </button>
            <button
              type="button"
              onClick={() => setTab("list")}
              style={{
                padding: "10px 18px",
                borderRadius: "10px",
                border: "none",
                cursor: "pointer",
                backgroundColor:
                  tab === "list" ? palette.primary : "transparent",
                color: tab === "list" ? "#fff" : palette.muted,
                fontWeight: 1000,
                fontSize: "13px",
                transition: "all 0.2s",
              }}
            >
              Holiday List
            </button>
          </div>
        </div>
      </div>

      <div className="holiday-animate">
        {tab === "list" ? (
          <div
            style={{
              backgroundColor: palette.card,
              borderRadius: "20px",
              padding: "24px",
              boxShadow: palette.shadow,
              border: `1px solid ${palette.border}`,
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "16px",
                flexWrap: "wrap",
                alignItems: "flex-end",
                marginBottom: "24px",
              }}
            >
              <div style={{ flex: "1", minWidth: "240px" }}>
                <div style={labelStyle}>Search Holidays</div>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    ...inputStyle,
                    border: `1px solid ${palette.border}`,
                  }}
                  placeholder="Search title..."
                />
              </div>
              <div style={{ minWidth: "140px" }}>
                <div style={labelStyle}>Category</div>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  style={inputStyle}
                >
                  <option value="all">All Types</option>
                  <option value="Public">Public Holiday</option>
                  <option value="School">School Break</option>
                  <option value="Optional">Optional</option>
                </select>
              </div>
              <div style={{ minWidth: "140px" }}>
                <div style={labelStyle}>Month</div>
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Any Month</option>
                  {MONTH_NAMES.map((name, idx) => (
                    <option key={idx + 1} value={String(idx + 1)}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ width: "100px" }}>
                <div style={labelStyle}>Year</div>
                <input
                  type="number"
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              {loading ? (
                <div
                  style={{
                    padding: "40px",
                    textAlign: "center",
                    color: palette.muted,
                    fontWeight: 900,
                  }}
                >
                  Loading holidays...
                </div>
              ) : filteredHolidays.length === 0 ? (
                <div
                  style={{
                    padding: "60px",
                    textAlign: "center",
                    backgroundColor: "#f8fafc",
                    borderRadius: "16px",
                    border: `2px dashed ${palette.border}`,
                  }}
                >
                  <div style={{ fontSize: "40px", marginBottom: "12px" }}>
                    🏝️
                  </div>
                  <div style={{ fontWeight: 1000, color: palette.text }}>
                    No holidays found
                  </div>
                  <p
                    style={{
                      color: palette.muted,
                      margin: "8px 0 0",
                      fontWeight: 900,
                    }}
                  >
                    Try adjusting your filters or search term.
                  </p>
                </div>
              ) : (
                <div className="table-scroll"><table
                  style={{
                    width: "100%",
                    borderCollapse: "separate",
                    borderSpacing: "0 8px",
                  }}
                >
                  <thead>
                    <tr>
                      <th
                        style={{
                          padding: "0 12px 12px",
                          textAlign: "left",
                          color: palette.muted,
                          fontWeight: 1000,
                          fontSize: "11px",
                          textTransform: "uppercase",
                        }}
                      >
                        Holiday Title
                      </th>
                      <th
                        style={{
                          padding: "0 12px 12px",
                          textAlign: "left",
                          color: palette.muted,
                          fontWeight: 1000,
                          fontSize: "11px",
                          textTransform: "uppercase",
                        }}
                      >
                        Date / Duration
                      </th>
                      <th
                        style={{
                          padding: "0 12px 12px",
                          textAlign: "left",
                          color: palette.muted,
                          fontWeight: 1000,
                          fontSize: "11px",
                          textTransform: "uppercase",
                        }}
                      >
                        Category
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHolidays.map((h) => (
                      <tr key={h.id}>
                        <td
                          style={{
                            padding: "16px 12px",
                            backgroundColor: "#f8fafc",
                            borderTopLeftRadius: "14px",
                            borderBottomLeftRadius: "14px",
                            border: `1px solid ${palette.border}`,
                            borderRight: "none",
                          }}
                        >
                          <div
                            style={{ fontWeight: 1000, color: palette.text }}
                          >
                            {h.title}
                          </div>
                          {h.description && (
                            <div
                              style={{
                                fontSize: "12px",
                                color: palette.muted,
                                fontWeight: 800,
                                marginTop: "4px",
                              }}
                            >
                              {h.description.slice(0, 80)}...
                            </div>
                          )}
                        </td>
                        <td
                          style={{
                            padding: "16px 12px",
                            backgroundColor: "#f8fafc",
                            border: `1px solid ${palette.border}`,
                            borderLeft: "none",
                            borderRight: "none",
                            fontWeight: 1000,
                            color: palette.primary,
                          }}
                        >
                          {formatDateRange(h)}
                        </td>
                        <td
                          style={{
                            padding: "16px 12px",
                            backgroundColor: "#f8fafc",
                            borderTopRightRadius: "14px",
                            borderBottomRightRadius: "14px",
                            border: `1px solid ${palette.border}`,
                            borderLeft: "none",
                          }}
                        >
                          <span
                            style={{
                              padding: "6px 12px",
                              borderRadius: "8px",
                              fontSize: "11px",
                              fontWeight: 1000,
                              backgroundColor:
                                h.type === "Public"
                                  ? "#ecfdf5"
                                  : h.type === "School"
                                    ? "#eff6ff"
                                    : "#fefce8",
                              color:
                                h.type === "Public"
                                  ? "#065f46"
                                  : h.type === "School"
                                    ? "#1e40af"
                                    : "#854d0e",
                              textTransform: "uppercase",
                              letterSpacing: "0.02em",
                            }}
                          >
                            {h.type}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
            </div>
          </div>
        ) : (
          <div
            style={{
              backgroundColor: palette.card,
              borderRadius: "20px",
              padding: "24px",
              boxShadow: palette.shadow,
              border: `1px solid ${palette.border}`,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "16px",
                flexWrap: "wrap",
                marginBottom: "24px",
              }}
            >
              <div
                style={{ display: "flex", gap: "12px", alignItems: "center" }}
              >
                <select
                  value={calMonth}
                  onChange={(e) => setCalMonth(parseInt(e.target.value))}
                  style={{
                    ...inputStyle,
                    width: "160px",
                    backgroundColor: "#f8fafc",
                  }}
                >
                  {MONTH_NAMES.map((name, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      {name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={calYear}
                  onChange={(e) => setCalYear(parseInt(e.target.value))}
                  style={{
                    ...inputStyle,
                    width: "110px",
                    backgroundColor: "#f8fafc",
                  }}
                />
              </div>
              <div
                style={{
                  color: palette.muted,
                  fontSize: "13px",
                  fontWeight: 900,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: palette.primary,
                  }}
                ></div>
                Click a holiday to view details
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: "700px" }}>
                <div
                  className="rg-calendar" style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, 1fr)",
                    gap: "12px",
                    marginBottom: "12px",
                  }}
                >
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                    (d) => (
                      <div
                        key={d}
                        style={{
                          color: palette.muted,
                          fontWeight: 1000,
                          fontSize: "12px",
                          textTransform: "uppercase",
                          textAlign: "center",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {d}
                      </div>
                    ),
                  )}
                </div>
                <div
                  className="rg-calendar" style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, 1fr)",
                    gap: "12px",
                  }}
                >
                  {calendarCells.map((key, idx) => {
                    if (!key)
                      return (
                        <div
                          key={`empty-${idx}`}
                          style={{ minHeight: "90px" }}
                        />
                      );
                    const list = holidayByDay.get(key) || [];
                    const isHoliday = list.length > 0;
                    const isToday = key === toDateKey(new Date());
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => (isHoliday ? openDetails(key) : null)}
                        className="calendar-cell"
                        style={{
                          minHeight: "100px",
                          borderRadius: "18px",
                          border: `1px solid ${isHoliday ? palette.primary : palette.border}`,
                          backgroundColor: isHoliday
                            ? "#eff6ff"
                            : isToday
                              ? "#fff"
                              : "#fff",
                          cursor: isHoliday ? "pointer" : "default",
                          padding: "12px",
                          textAlign: "left",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                          position: "relative",
                        }}
                      >
                        <div
                          style={{
                            width: "100%",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 1000,
                                fontSize: "14px",
                                color: isToday ? palette.primary : palette.text,
                                width: "24px",
                                height: "24px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: "8px",
                                backgroundColor: isToday
                                  ? "#eff6ff"
                                  : "transparent",
                              }}
                            >
                              {parseInt(key.slice(-2), 10)}
                            </span>
                            {isToday && (
                              <span
                                style={{
                                  fontSize: "10px",
                                  color: palette.primary,
                                  fontWeight: 1000,
                                  textTransform: "uppercase",
                                }}
                              >
                                Today
                              </span>
                            )}
                          </div>
                          {isToday && (
                            <div
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                backgroundColor: palette.primary,
                              }}
                            ></div>
                          )}
                        </div>
                        {isHoliday && (
                          <div
                            style={{
                              fontSize: "10px",
                              fontWeight: 1000,
                              color: palette.primary,
                              background: "#fff",
                              padding: "4px 8px",
                              borderRadius: "8px",
                              border: `1px solid #bfdbfe`,
                              width: "100%",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {list[0].title}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {detailsOpen && selectedDate && (
        <div
          onClick={closeDetails}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="holiday-animate"
            style={{
              width: "min(500px, 100%)",
              backgroundColor: "#fff",
              borderRadius: "24px",
              padding: "28px",
              boxShadow:
                "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              border: `1px solid ${palette.border}`,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontWeight: 1000, fontSize: "20px" }}>
                  Holiday Details
                </h3>
                <div
                  style={{
                    color: palette.muted,
                    fontWeight: 900,
                    fontSize: "13px",
                    marginTop: "4px",
                  }}
                >
                  {new Date(parseDateOnly(selectedDate)).toLocaleDateString(
                    "en-US",
                    {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    },
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={closeDetails}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "10px",
                  backgroundColor: "#f1f5f9",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: palette.muted,
                  fontWeight: 1000,
                  fontSize: "18px",
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: "grid", gap: "16px" }}>
              {(holidayByDay.get(selectedDate) || []).map((h) => (
                <div
                  key={h.id}
                  style={{
                    border: `1px solid ${palette.border}`,
                    borderRadius: "18px",
                    padding: "16px",
                    backgroundColor: "#f8fafc",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 1000,
                        color: palette.text,
                        fontSize: "16px",
                      }}
                    >
                      {h.title}
                    </div>
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: "999px",
                        fontSize: "10px",
                        fontWeight: 1000,
                        backgroundColor:
                          h.type === "Public"
                            ? "#f0fdf4"
                            : h.type === "School"
                              ? "#eff6ff"
                              : "#fff7ed",
                        color:
                          h.type === "Public"
                            ? "#16a34a"
                            : h.type === "School"
                              ? "#2563eb"
                              : "#ea580c",
                      }}
                    >
                      {h.type}
                    </span>
                  </div>
                  <div
                    style={{
                      marginTop: "8px",
                      color: palette.primary,
                      fontSize: "13px",
                      fontWeight: 1000,
                    }}
                  >
                    📅 {formatDateRange(h)}
                  </div>
                  {h.description && (
                    <div
                      style={{
                        marginTop: "12px",
                        color: palette.muted,
                        fontSize: "13px",
                        fontWeight: 800,
                        lineHeight: "1.5",
                        padding: "12px",
                        backgroundColor: "#fff",
                        borderRadius: "12px",
                        border: `1px solid ${palette.border}`,
                      }}
                    >
                      {h.description}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={closeDetails}
              style={{
                width: "100%",
                marginTop: "24px",
                padding: "12px",
                borderRadius: "14px",
                border: "none",
                backgroundColor: palette.primary,
                color: "#fff",
                fontWeight: 1000,
                cursor: "pointer",
                boxShadow: "0 4px 6px -1px rgba(37, 99, 235, 0.2)",
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherHolidays;
