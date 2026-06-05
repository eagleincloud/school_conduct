import React, { useEffect, useMemo, useState } from "react";
import api from "../../services/api";

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
  }, [tab, search, filterType, filterMonth, filterYear]);

  useEffect(() => {
    if (tab === "calendar") {
      loadHolidays({ month: calMonth, year: calYear }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, calMonth, calYear]);

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
    <div style={{ padding: "20px" }}>
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
          <h1 style={{ margin: 0 }}>Holidays</h1>
          <p
            style={{
              margin: "8px 0 0",
              color: "#6b7280",
              fontWeight: 800,
              fontSize: "13px",
            }}
          >
            Holidays for your class (calendar + list).
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="button"
            onClick={() => setTab("list")}
            style={{
              padding: "10px 14px",
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
              cursor: "pointer",
              backgroundColor: tab === "list" ? "#2563eb" : "#fff",
              color: tab === "list" ? "#fff" : "#111827",
              fontWeight: 900,
            }}
          >
            Holiday List
          </button>
          <button
            type="button"
            onClick={() => setTab("calendar")}
            style={{
              padding: "10px 14px",
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
              cursor: "pointer",
              backgroundColor: tab === "calendar" ? "#2563eb" : "#fff",
              color: tab === "calendar" ? "#fff" : "#111827",
              fontWeight: 900,
            }}
          >
            Calendar View
          </button>
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
                  {Array.from({ length: 12 }).map((_, idx) => {
                    const m = idx + 1;
                    return (
                      <option key={m} value={String(m)}>
                        {m}
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
                        <td style={{ padding: "12px 10px" }}>{h.type}</td>
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
                    {Array.from({ length: 12 }).map((_, idx) => {
                      const m = idx + 1;
                      return (
                        <option key={m} value={m}>
                          {m}
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
