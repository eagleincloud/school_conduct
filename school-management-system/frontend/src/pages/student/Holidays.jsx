import React, { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import { useStudent } from "../../context/StudentContext";

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  fontSize: "13px",
  outline: "none",
  boxSizing: "border-box",
  backgroundColor: "#fff",
};

const labelStyle = {
  fontSize: "12px",
  color: "#6b7280",
  fontWeight: 800,
  marginBottom: "6px",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const cardStyle = {
  backgroundColor: "#fff",
  borderRadius: "16px",
  border: "1px solid #e5e7eb",
  padding: "18px",
  boxShadow: "0 1px 6px rgba(16,24,40,0.06)",
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
  // DRF DateField generally comes as `YYYY-MM-DD`. Using `new Date(value)` may interpret it in UTC
  // and cause timezone shifts. We parse it as local date to keep calendar cells consistent.
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
  // Local `YYYY-MM-DD` key (NOT UTC-based `toISOString()`), used for Map lookups + rendering.
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const StudentHolidays = () => {
  const { selectedStudentId } = useStudent();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, search, filterType, filterMonth, filterYear, selectedStudentId]);

  useEffect(() => {
    if (tab === "calendar") {
      loadHolidays({ month: calMonth, year: calYear }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, calMonth, calYear, selectedStudentId]);

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
        background: "#f8fafc",
        minHeight: "calc(100vh - 60px)",
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
              Holidays
            </h1>
            <p
              style={{
                margin: "8px 0 0",
                color: "#64748b",
                fontWeight: 900,
                fontSize: "15px",
              }}
            >
              View upcoming school holidays and public breaks for your class.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: "12px",
              background: "#f1f5f9",
              padding: "6px",
              borderRadius: "16px",
            }}
          >
            <button
              type="button"
              onClick={() => setTab("calendar")}
              style={{
                padding: "10px 20px",
                borderRadius: "12px",
                border: "none",
                cursor: "pointer",
                backgroundColor: tab === "calendar" ? "#fff" : "transparent",
                color: tab === "calendar" ? "#2563eb" : "#64748b",
                fontWeight: 1000,
                fontSize: "14px",
                boxShadow:
                  tab === "calendar" ? "0 2px 8px rgba(0,0,0,0.05)" : "none",
                transition: "all 0.2s",
              }}
            >
              Calendar View
            </button>
            <button
              type="button"
              onClick={() => setTab("list")}
              style={{
                padding: "10px 20px",
                borderRadius: "12px",
                border: "none",
                cursor: "pointer",
                backgroundColor: tab === "list" ? "#fff" : "transparent",
                color: tab === "list" ? "#2563eb" : "#64748b",
                fontWeight: 1000,
                fontSize: "14px",
                boxShadow:
                  tab === "list" ? "0 2px 8px rgba(0,0,0,0.05)" : "none",
                transition: "all 0.2s",
              }}
            >
              Holiday List
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: "16px" }}>
        {tab === "list" && (
          <div style={cardStyle}>
            <div
              style={{
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
                alignItems: "flex-end",
              }}
            >
              <div style={{ minWidth: "240px" }}>
                <div style={labelStyle}>Search</div>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={inputStyle}
                  placeholder="Diwali..."
                />
              </div>
              <div>
                <div style={labelStyle}>Type</div>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  style={inputStyle}
                >
                  <option value="all">All</option>
                  <option value="Public">Public</option>
                  <option value="School">School</option>
                  <option value="Optional">Optional</option>
                </select>
              </div>
              <div>
                <div style={labelStyle}>Month</div>
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">All</option>
                  {MONTH_NAMES.map((name, idx) => {
                    const m = idx + 1;
                    return (
                      <option key={m} value={String(m)}>
                        {name}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <div style={labelStyle}>Year</div>
                <input
                  type="number"
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ marginTop: "16px", overflowX: "auto" }}>
              {loading ? (
                <p style={{ color: "#6b7280", fontWeight: 900 }}>Loading...</p>
              ) : holidays.length === 0 ? (
                <p style={{ color: "#6b7280", fontWeight: 900 }}>
                  No holidays found.
                </p>
              ) : (
                <div className="table-scroll"><table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f2f4f7" }}>
                      <th style={{ padding: "12px 10px", textAlign: "left" }}>
                        Title
                      </th>
                      <th style={{ padding: "12px 10px", textAlign: "left" }}>
                        Date / Range
                      </th>
                      <th style={{ padding: "12px 10px", textAlign: "left" }}>
                        Type
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {holidays.map((h) => (
                      <tr key={h.id} style={{ borderTop: "1px solid #eef2f7" }}>
                        <td style={{ padding: "12px 10px", fontWeight: 900 }}>
                          {h.title}
                        </td>
                        <td style={{ padding: "12px 10px", fontWeight: 800 }}>
                          {formatDateRange(h)}
                        </td>
                        <td style={{ padding: "12px 10px" }}>
                          <span
                            style={{
                              padding: "4px 10px",
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
        )}

        {tab === "calendar" && (
          <div style={cardStyle}>
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
                <div style={labelStyle}>Calendar Month</div>
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <select
                    value={calMonth}
                    onChange={(e) => setCalMonth(parseInt(e.target.value))}
                    style={{ ...inputStyle, width: "160px" }}
                  >
                    {MONTH_NAMES.map((name, idx) => {
                      const m = idx + 1;
                      return (
                        <option key={m} value={m}>
                          {name}
                        </option>
                      );
                    })}
                  </select>
                  <input
                    type="number"
                    value={calYear}
                    onChange={(e) => setCalYear(parseInt(e.target.value))}
                    style={{ ...inputStyle, width: "160px" }}
                  />
                </div>
              </div>
              <div
                style={{ color: "#6b7280", fontSize: "13px", fontWeight: 900 }}
              >
                Click a holiday date to view details
              </div>
            </div>

            <div style={{ marginTop: "14px", overflowX: "auto" }}>
              <div
                className="rg-calendar" style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                  gap: "10px",
                }}
              >
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <div
                    key={d}
                    style={{
                      color: "#6b7280",
                      fontWeight: 1000,
                      fontSize: "12px",
                      textTransform: "uppercase",
                    }}
                  >
                    {d}
                  </div>
                ))}
                {calendarCells.map((key, idx) => {
                  if (!key)
                    return (
                      <div key={`empty-${idx}`} style={{ height: "70px" }} />
                    );
                  const list = holidayByDay.get(key) || [];
                  const isHoliday = list.length > 0;
                  const isToday = key === toDateKey(new Date());
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => (isHoliday ? openDetails(key) : null)}
                      style={{
                        height: "70px",
                        borderRadius: "14px",
                        border: `1px solid ${isHoliday ? "#7c3aed" : "#e5e7eb"}`,
                        backgroundColor: isHoliday ? "#f5f3ff" : "#fff",
                        cursor: isHoliday ? "pointer" : "default",
                        color: "#111827",
                        padding: "10px",
                        textAlign: "left",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "4px",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 1000,
                          fontSize: "13px",
                          width: "100%",
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>{parseInt(key.slice(-2), 10)}</span>
                        {isToday ? (
                          <span
                            style={{
                              fontSize: "11px",
                              color: "#16a34a",
                              fontWeight: 1000,
                            }}
                          >
                            Today
                          </span>
                        ) : null}
                      </div>
                      {isHoliday ? (
                        <div
                          style={{
                            fontSize: "11px",
                            fontWeight: 1000,
                            color: "#4c1d95",
                          }}
                        >
                          {list[0].title}
                        </div>
                      ) : (
                        <div style={{ fontSize: "11px" }}>&nbsp;</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {detailsOpen && selectedDate && (
        <div
          onClick={closeDetails}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "18px",
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(680px, 100%)",
              backgroundColor: "#fff",
              borderRadius: "16px",
              padding: "18px",
              border: "1px solid #e5e7eb",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <h3 style={{ margin: 0 }}>Holiday Details</h3>
              <button
                type="button"
                onClick={closeDetails}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "18px",
                }}
              >
                ×
              </button>
            </div>
            <div
              style={{ marginTop: "8px", color: "#6b7280", fontWeight: 900 }}
            >
              {selectedDate}
            </div>

            <div style={{ marginTop: "14px", display: "grid", gap: "12px" }}>
              {(holidayByDay.get(selectedDate) || []).map((h) => (
                <div
                  key={h.id}
                  style={{
                    border: "1px solid #eef2f7",
                    borderRadius: "14px",
                    padding: "12px",
                    backgroundColor: "#fafafa",
                  }}
                >
                  <div style={{ fontWeight: 1000, color: "#111827" }}>
                    {h.title}
                  </div>
                  <div
                    style={{
                      marginTop: "6px",
                      color: "#6b7280",
                      fontSize: "13px",
                      fontWeight: 900,
                    }}
                  >
                    {formatDateRange(h)} • {h.type}
                  </div>
                  {h.description ? (
                    <div
                      style={{
                        marginTop: "10px",
                        color: "#374151",
                        fontSize: "13px",
                        fontWeight: 800,
                      }}
                    >
                      {h.description}
                    </div>
                  ) : null}
                </div>
              ))}
              {(holidayByDay.get(selectedDate) || []).length === 0 ? (
                <p style={{ color: "#6b7280", fontWeight: 900 }}>
                  No holidays found for this day.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentHolidays;
