import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../../services/api";
import { useStudent } from "../../context/StudentContext";

const Notifications = () => {
  const { selectedStudentId } = useStudent();
  const navigate = useNavigate();
  const location = useLocation();
  const base = location.pathname.startsWith("/teacher")
    ? "/teacher"
    : "/student";
  const [notifications, setNotifications] = useState([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  /** Full announcement detail modal (student / teacher) */
  const [announcementDetail, setAnnouncementDetail] = useState(null);
  const [announcementLoading, setAnnouncementLoading] = useState(false);
  const [announcementError, setAnnouncementError] = useState("");

  const loadNotifications = () => {
    setLoading(true);
    setLoadError("");
    api
      .get("communication/my/")
      .then((res) => setNotifications(res.data || []))
      .catch((err) => {
        const msg =
          err?.response?.data?.detail ||
          err?.response?.data?.error ||
          err?.message ||
          "Could not load notifications.";
        setLoadError(typeof msg === "string" ? msg : JSON.stringify(msg));
        setNotifications([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadNotifications();
    const timer = setInterval(loadNotifications, 15000);
    return () => clearInterval(timer);
  }, [selectedStudentId]);

  useEffect(() => {
    if (loading) return;
    const raw = (location.hash || "").replace(/^#/, "");
    if (!raw.startsWith("ntf-")) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(raw);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [loading, location.hash, notifications.length]);

  const inferFilter = (n) => {
    if (n.related_exam) return "exam";
    if (n.announcement_type === "holiday") return "holiday";
    if (n.announcement_type === "general") return "general";
    if (n.announcement_type === "exam") return "exam";
    const text = `${n.title || ""} ${n.message || ""}`.toLowerCase();
    if (
      text.includes("result") ||
      text.includes("marksheet") ||
      text.includes("marks")
    )
      return "result";
    if (
      text.includes("exam") ||
      text.includes("timetable") ||
      text.includes("schedule")
    )
      return "exam";
    return "announcement";
  };

  const iconByFilter = (f) => {
    if (f === "exam") return "📅";
    if (f === "result") return "📊";
    if (f === "holiday") return "🏖️";
    if (f === "general") return "📌";
    return "📢";
  };

  const timeAgo = (createdAt) => {
    const then = new Date(createdAt).getTime();
    const now = Date.now();
    const diffSec = Math.max(1, Math.floor((now - then) / 1000));
    if (diffSec < 60) return `${diffSec} sec ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? "s" : ""} ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay} day${diffDay > 1 ? "s" : ""} ago`;
  };

  const handleMarkAsRead = async (id) => {
    try {
      await api.patch(`communication/my/${id}/`, { is_read: true });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
    } catch (_) {}
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`communication/my/${id}/`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (_) {}
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post("communication/my/mark-all-read/");
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (_) {}
  };

  const openAnnouncementModal = async (notificationId, announcementId) => {
    if (!announcementId) return;
    setAnnouncementError("");
    setAnnouncementDetail(null);
    setAnnouncementLoading(true);
    try {
      window.history.replaceState(
        null,
        "",
        `${base}/notifications#ntf-${notificationId}`,
      );
      const res = await api.get(`announcements/${announcementId}/`);
      setAnnouncementDetail(res.data);
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.message ||
        "Could not load announcement.";
      setAnnouncementError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setAnnouncementLoading(false);
    }
  };

  const handleOpenNotification = (n) => {
    if (n.related_announcement) {
      openAnnouncementModal(n.id, n.related_announcement);
      return;
    }
    if (n.related_exam) {
      if (base === "/teacher") navigate("/teacher/upload-result");
      else navigate(`/student/exams?exam=${n.related_exam}`);
      return;
    }
    const f = inferFilter(n);
    if (f === "exam") {
      if (base === "/teacher") navigate("/teacher/upload-result");
      else navigate("/student/exams");
      return;
    }
    if (f === "result") {
      if (base === "/teacher") navigate("/teacher/upload-result");
      else navigate("/student/results");
      return;
    }
    if (base === "/teacher") navigate("/teacher/dashboard");
    else navigate("/student/dashboard");
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (notifications || []).filter((n) => {
      const f = inferFilter(n);
      if (filter !== "all" && f !== filter) return false;
      if (!q) return true;
      return `${n.title || ""} ${n.message || ""}`.toLowerCase().includes(q);
    });
  }, [notifications, query, filter]);

  const unread = filtered.filter((n) => !n.is_read);
  const read = filtered.filter((n) => n.is_read);

  const renderCard = (n, unreadCard) => {
    const f = inferFilter(n);
    return (
      <div
        key={n.id}
        id={`ntf-${n.id}`}
        className={`rounded-2xl border p-4 shadow-sm transition-all hover:scale-[1.01] hover:shadow-md scroll-mt-24 ${
          unreadCard
            ? "bg-blue-50/70 border-blue-100"
            : "bg-white border-gray-200 hover:bg-gray-50"
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="text-2xl leading-none mt-0.5">{iconByFilter(f)}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-gray-900 truncate">
                {n.title || "Notification"}
              </h3>
              <span
                className={`inline-flex h-2.5 w-2.5 rounded-full ${n.is_read ? "bg-gray-400" : "bg-blue-500"}`}
              />
            </div>
            <p className="mt-1 text-sm text-gray-600">{n.message}</p>
            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-gray-500">
              <span>{timeAgo(n.created_at)}</span>
              <span>{new Date(n.created_at).toLocaleString()}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {!n.is_read ? (
                <button
                  type="button"
                  onClick={() => handleMarkAsRead(n.id)}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Mark as Read
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => handleOpenNotification(n)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
              >
                View
              </button>
              <button
                type="button"
                onClick={() => handleDelete(n.id)}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-[calc(100vh-60px)] bg-gray-50 p-4 md:p-6">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Notifications
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Admin holidays & notices appear here — no separate announcements
              page
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadNotifications}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Mark All as Read
            </button>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px]">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              🔍
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notifications..."
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none ring-blue-500 focus:ring-2"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none ring-blue-500 focus:ring-2"
          >
            <option value="all">All</option>
            <option value="exam">Exams</option>
            <option value="result">Results</option>
            <option value="holiday">Holidays</option>
            <option value="general">General</option>
            <option value="announcement">Other</option>
          </select>
        </div>

        {loadError ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {loadError}
          </div>
        ) : null}

        <div className="mb-3 text-sm font-medium text-gray-600">
          {loading ? "Loading..." : `${filtered.length} notifications`}
        </div>

        {loading || loadError ? null : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <div className="text-4xl">🔔</div>
            <div className="mt-3 text-lg font-semibold text-gray-800">
              No notifications yet
            </div>
            <p className="mt-1 text-sm text-gray-500">
              New exam, result, and announcement updates will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {announcementLoading || announcementDetail || announcementError ? (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
                onClick={() => {
                  setAnnouncementDetail(null);
                  setAnnouncementError("");
                }}
                role="presentation"
              >
                <div
                  className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="announcement-detail-title"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2
                      id="announcement-detail-title"
                      className="pr-4 text-lg font-bold text-gray-900"
                    >
                      {announcementLoading
                        ? "Loading…"
                        : announcementDetail?.title || "Announcement"}
                    </h2>
                    <button
                      type="button"
                      onClick={() => {
                        setAnnouncementDetail(null);
                        setAnnouncementError("");
                      }}
                      className="rounded-lg px-2 py-1 text-sm font-semibold text-gray-500 hover:bg-gray-100"
                    >
                      ✕
                    </button>
                  </div>
                  {announcementLoading ? (
                    <p className="mt-4 text-sm text-gray-600">
                      Fetching full notice…
                    </p>
                  ) : announcementError ? (
                    <p className="mt-4 text-sm text-red-700">
                      {announcementError}
                    </p>
                  ) : announcementDetail ? (
                    <div className="mt-4 space-y-3 text-sm">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold uppercase text-violet-800">
                          {(announcementDetail.type || "").replace(/^./, (c) =>
                            c.toUpperCase(),
                          )}
                        </span>
                        {announcementDetail.is_pinned ? (
                          <span className="text-xs font-bold text-blue-600">
                            📌 Pinned
                          </span>
                        ) : null}
                        {announcementDetail.is_important ? (
                          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                            Important
                          </span>
                        ) : null}
                      </div>
                      <p className="whitespace-pre-wrap text-gray-700">
                        {announcementDetail.description || "—"}
                      </p>
                      <div className="border-t border-gray-100 pt-3 text-gray-600">
                        <div>
                          📅 {announcementDetail.start_date} →{" "}
                          {announcementDetail.end_date}
                        </div>
                        <div className="mt-1">
                          For:{" "}
                          {announcementDetail.target_audience === "all"
                            ? "Everyone"
                            : announcementDetail.target_audience === "students"
                              ? "Students"
                              : "Teachers"}
                          {announcementDetail.class_meta?.name
                            ? ` · Class: ${announcementDetail.class_meta.name}`
                            : ""}
                        </div>
                        {announcementDetail.created_by_name ? (
                          <div className="mt-1">
                            From: {announcementDetail.created_by_name}
                          </div>
                        ) : null}
                      </div>
                      {announcementDetail.attachment_url ? (
                        <a
                          href={announcementDetail.attachment_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
                        >
                          Open attachment
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="mt-6 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setAnnouncementDetail(null);
                        setAnnouncementError("");
                      }}
                      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-blue-700">
                  Unread Notifications
                </h2>
                <span className="text-xs text-gray-500">{unread.length}</span>
              </div>
              <div className="space-y-3">
                {unread.map((n) => renderCard(n, true))}
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">
                  Read Notifications
                </h2>
                <span className="text-xs text-gray-500">{read.length}</span>
              </div>
              <div className="space-y-3">
                {read.map((n) => renderCard(n, false))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
