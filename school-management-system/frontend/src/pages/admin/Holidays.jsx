import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useConfirm } from '../../context/ConfirmContext';
import api from '../../services/api';

const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box',
    backgroundColor: '#fff',
};

const labelStyle = {
    fontSize: '12px',
    color: '#6b7280',
    fontWeight: 800,
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
};

const cardStyle = {
    backgroundColor: '#fff',
    borderRadius: '16px',
    border: '1px solid #e5e7eb',
    padding: '18px',
    boxShadow: '0 1px 6px rgba(16,24,40,0.06)',
};

const MONTH_NAMES = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

function formatDateRange(h) {
    if (!h?.end_date || h.end_date === h.start_date) return h.start_date;
    return `${h.start_date} — ${h.end_date}`;
}

function parseDateOnly(value) {
    // DRF DateField generally comes as `YYYY-MM-DD`. Using `new Date(value)` may interpret it in UTC
    // and cause timezone shifts. We parse it as local date to keep calendar cells consistent.
    if (typeof value !== 'string') {
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
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

const AdminHolidays = () => {
    const confirm = useConfirm();
    const [viewportWidth, setViewportWidth] = useState(() =>
        typeof window === 'undefined' ? 1024 : window.innerWidth,
    );
    const [tab, setTab] = useState('list'); // 'list' | 'calendar'

    const [holidays, setHolidays] = useState([]);
    const [loading, setLoading] = useState(false);

    const [classes, setClasses] = useState([]);

    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [filterMonth, setFilterMonth] = useState('');
    const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));
    const [sortDir, setSortDir] = useState('asc'); // asc|desc

    const now = new Date();
    const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
    const [calYear, setCalYear] = useState(now.getFullYear());

    const [selectedDate, setSelectedDate] = useState(null); // 'YYYY-MM-DD'
    const [detailsOpen, setDetailsOpen] = useState(false);

    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formError, setFormError] = useState('');

    const [form, setForm] = useState({
        title: '',
        start_date: '',
        end_date: '',
        description: '',
        type: 'Public',
        allClasses: true,
        applicable_class_ids: [],
    });
    const isMobile = viewportWidth < 640;

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const handleResize = () => setViewportWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const openCreate = () => {
        setEditingId(null);
        setFormError('');
        setForm({
            title: '',
            start_date: '',
            end_date: '',
            description: '',
            type: 'Public',
            allClasses: true,
            applicable_class_ids: [],
        });
        setModalOpen(true);
    };

    const openEdit = (h) => {
        setEditingId(h.id);
        setFormError('');
        setForm({
            title: h.title || '',
            start_date: h.start_date || '',
            end_date: h.end_date || '',
            description: h.description || '',
            type: h.type || 'Public',
            allClasses: !h.applicable_classes || h.applicable_classes.length === 0,
            applicable_class_ids: (h.applicable_classes || []).map((c) => c.id),
        });
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditingId(null);
        setFormError('');
    };

    const closeDetails = () => {
        setDetailsOpen(false);
        setSelectedDate(null);
    };

    const fetchClasses = async () => {
        const res = await api.get('classes/main-classes/');
        setClasses(res.data || []);
    };

    const loadHolidays = async (params) => {
        setLoading(true);
        try {
            const res = await api.get('holidays/', { params });
            setHolidays(res.data || []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClasses();
    }, []);

    useEffect(() => {
        if (tab !== 'list') return;
        const params = {};
        if (search.trim()) params.search = search.trim();
        if (filterType !== 'all') params.type = filterType;
        if (filterMonth) params.month = filterMonth;
        if (filterYear) params.year = filterYear;
        loadHolidays(params).catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, search, filterType, filterMonth, filterYear]);

    useEffect(() => {
        if (tab !== 'calendar') return;
        const params = { month: calMonth, year: calYear };
        loadHolidays(params).catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, calMonth, calYear]);

    const sortedHolidays = useMemo(() => {
        const copy = [...holidays];
        copy.sort((a, b) => {
            if (!a.start_date || !b.start_date) return 0;
            const da = new Date(a.start_date).getTime();
            const db = new Date(b.start_date).getTime();
            return sortDir === 'asc' ? da - db : db - da;
        });
        return copy;
    }, [holidays, sortDir]);

    const holidayByDay = useMemo(() => {
        const map = new Map(); // dateString => [holidays]
        const coversDate = (h, d) => {
            const start = new Date(h.start_date);
            const end = new Date(h.end_date || h.start_date);
            const dd = new Date(d);
            dd.setHours(0, 0, 0, 0);
            const s = new Date(start);
            const e = new Date(end);
            s.setHours(0, 0, 0, 0);
            e.setHours(0, 0, 0, 0);
            return dd >= s && dd <= e;
        };

        sortedHolidays.forEach((h) => {
            if (!h.start_date) return;
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
        return { map, coversDate };
    }, [sortedHolidays]);

    const daysInMonth = (y, m) => new Date(y, m, 0).getDate();
    const buildCalendarCells = () => {
        const first = new Date(calYear, calMonth - 1, 1);
        const sundayBased = first.getDay(); // 0 Sunday .. 6 Saturday
        const totalDays = daysInMonth(calYear, calMonth);

        const cells = [];
        for (let i = 0; i < sundayBased; i++) cells.push(null);
        for (let d = 1; d <= totalDays; d++) {
            const key = toDateKey(new Date(calYear, calMonth - 1, d));
            cells.push(key);
        }
        while (cells.length % 7 !== 0) cells.push(null);
        return cells;
    };

    const calendarCells = useMemo(() => buildCalendarCells(), [calMonth, calYear]);
    const calendarWeeks = useMemo(() => {
        const weeks = [];
        for (let i = 0; i < calendarCells.length; i += 7) {
            weeks.push(calendarCells.slice(i, i + 7));
        }
        return weeks;
    }, [calendarCells]);

    const classLabel = (hc) => (hc?.applicable_classes?.length ? hc.applicable_classes.map((c) => c.name).join(', ') : 'All Classes');
    const visibleMonthLabel = `${MONTH_NAMES[calMonth - 1]} ${calYear}`;

    const goToPreviousMonth = () => {
        if (calMonth === 1) {
            setCalMonth(12);
            setCalYear((prev) => prev - 1);
            return;
        }
        setCalMonth((prev) => prev - 1);
    };

    const goToNextMonth = () => {
        if (calMonth === 12) {
            setCalMonth(1);
            setCalYear((prev) => prev + 1);
            return;
        }
        setCalMonth((prev) => prev + 1);
    };

    const submitHoliday = async (e) => {
        e.preventDefault();
        setFormError('');

        if (!form.title.trim()) return setFormError('Title is required');
        if (!form.start_date) return setFormError('start_date is required');

        const payload = {
            title: form.title.trim(),
            start_date: form.start_date,
            end_date: form.end_date ? form.end_date : null,
            description: form.description || null,
            type: form.type,
            applicable_class_ids: form.allClasses ? [] : form.applicable_class_ids,
        };

        try {
            if (editingId) {
                await api.patch(`holidays/${editingId}/`, payload);
            } else {
                await api.post('holidays/', payload);
            }
            setModalOpen(false);
            setEditingId(null);
            // Refresh both views
            setCalMonth(new Date().getMonth() + 1);
            setCalYear(new Date().getFullYear());
            loadHolidays({}).catch(() => {});
            // eslint-disable-next-line no-alert
            alert('Holiday saved successfully');
        } catch (err) {
            setFormError(err?.response?.data?.error || 'Failed to save holiday');
        }
    };

    const deleteHoliday = async (id) => {
        const ok = await confirm('Delete this holiday?');
        if (!ok) return;
        try {
            await api.delete(`holidays/${id}/`);
            loadHolidays({}).catch(() => {});
        } catch (e) {
            // eslint-disable-next-line no-alert
            alert('Error deleting holiday');
        }
    };

    const exportCsv = async () => {
        try {
            const params = {};
            if (search.trim()) params.search = search.trim();
            if (filterType !== 'all') params.type = filterType;
            if (filterMonth) params.month = filterMonth;
            if (filterYear) params.year = filterYear;

            const res = await api.get('holidays/export/csv/', { params, responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = 'holidays.csv';
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            // eslint-disable-next-line no-alert
            alert('Export failed');
        }
    };

    return (
        <div style={{ padding: isMobile ? '12px' : '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: isMobile ? '20px' : '32px', fontWeight: 1000, color: '#0f172a' }}>Holidays & Events</h1>
                    <p style={{ margin: '8px 0 0', color: '#6b7280', fontWeight: 800, fontSize: '13px' }}>Manage holidays and see them on a calendar.</p>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch', flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
                        <button
                            type="button"
                            onClick={() => setTab('list')}
                            style={{
                                padding: isMobile ? '10px 12px' : '10px 14px',
                                borderRadius: '12px',
                                border: '1px solid #e5e7eb',
                                cursor: 'pointer',
                                backgroundColor: tab === 'list' ? '#2563eb' : '#fff',
                                color: tab === 'list' ? '#fff' : '#111827',
                                fontWeight: 900,
                                flex: isMobile ? '1 1 0' : '0 0 auto',
                            }}
                        >
                            Holiday List
                        </button>
                        <button
                            type="button"
                            onClick={() => setTab('calendar')}
                            style={{
                                padding: isMobile ? '10px 12px' : '10px 14px',
                                borderRadius: '12px',
                                border: '1px solid #e5e7eb',
                                cursor: 'pointer',
                                backgroundColor: tab === 'calendar' ? '#2563eb' : '#fff',
                                color: tab === 'calendar' ? '#fff' : '#111827',
                                fontWeight: 900,
                                flex: isMobile ? '1 1 0' : '0 0 auto',
                            }}
                        >
                            Calendar View
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={openCreate}
                        style={{
                            padding: '10px 16px',
                            borderRadius: '12px',
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: '#2563eb',
                            color: '#fff',
                            fontWeight: 1000,
                            height: '40px',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
                            width: isMobile ? '100%' : 'auto',
                        }}
                    >
                        + Add Holiday
                    </button>
                </div>
            </div>

            <div style={{ marginTop: '16px' }}>
                {tab === 'list' && (
                    <div style={cardStyle}>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                <div style={{ minWidth: isMobile ? '100%' : '240px', flex: isMobile ? '1 1 100%' : '0 1 auto' }}>
                                    <div style={labelStyle}>Search</div>
                                    <input
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Diwali, Christmas..."
                                        style={inputStyle}
                                    />
                                </div>
                                <div style={{ minWidth: isMobile ? 'calc(50% - 6px)' : '0' }}>
                                    <div style={labelStyle}>Type</div>
                                    <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={inputStyle}>
                                        <option value="all">All</option>
                                        <option value="Public">Public</option>
                                        <option value="School">School</option>
                                        <option value="Optional">Optional</option>
                                    </select>
                                </div>
                                <div style={{ minWidth: isMobile ? 'calc(50% - 6px)' : '0' }}>
                                    <div style={labelStyle}>Month</div>
                                    <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} style={inputStyle}>
                                        <option value="">All</option>
                                        {MONTH_NAMES.map((name, idx) => {
                                            const m = idx + 1;
                                            return <option key={m} value={String(m)}>{name}</option>;
                                        })}
                                    </select>
                                </div>
                                <div style={{ minWidth: isMobile ? '100%' : '0' }}>
                                    <div style={labelStyle}>Year</div>
                                    <input value={filterYear} onChange={(e) => setFilterYear(e.target.value)} type="number" style={inputStyle} />
                                </div>
                            </div>

                            <div style={{ minWidth: isMobile ? 'calc(50% - 6px)' : '0' }}>
                                <div style={labelStyle}>Sort</div>
                                <select value={sortDir} onChange={(e) => setSortDir(e.target.value)} style={inputStyle}>
                                    <option value="asc">Oldest first</option>
                                    <option value="desc">Newest first</option>
                                </select>
                            </div>
                            <div style={{ width: isMobile ? 'calc(50% - 6px)' : 'auto' }}>
                                <div style={labelStyle}>&nbsp;</div>
                                <button
                                    type="button"
                                    onClick={exportCsv}
                                    style={{
                                        padding: '10px 14px',
                                        borderRadius: '12px',
                                        border: '1px solid #e5e7eb',
                                        cursor: 'pointer',
                                        backgroundColor: '#f8fafc',
                                        color: '#334155',
                                        fontWeight: 900,
                                        height: '40px',
                                        width: isMobile ? '100%' : 'auto',
                                    }}
                                >
                                    Export CSV
                                </button>
                            </div>
                        </div>

                        <div style={{ marginTop: '16px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                            <table style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f2f4f7' }}>
                                        <th style={{ padding: '12px 10px', textAlign: 'left' }}>Title</th>
                                        <th style={{ padding: '12px 10px', textAlign: 'left' }}>Date / Range</th>
                                        <th style={{ padding: '12px 10px', textAlign: 'left' }}>Type</th>
                                        <th style={{ padding: '12px 10px', textAlign: 'left' }}>Applicable Classes</th>
                                        <th style={{ padding: '12px 10px', textAlign: 'left' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} style={{ padding: '14px', color: '#6b7280', fontWeight: 900 }}>
                                                Loading...
                                            </td>
                                        </tr>
                                    ) : sortedHolidays.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} style={{ padding: '14px', color: '#6b7280', fontWeight: 900 }}>
                                                No holidays found.
                                            </td>
                                        </tr>
                                    ) : (
                                        sortedHolidays.map((h) => (
                                            <tr key={h.id} style={{ borderTop: '1px solid #eef2f7' }}>
                                                <td style={{ padding: '12px 10px', fontWeight: 900 }}>{h.title}</td>
                                                <td style={{ padding: '12px 10px', color: '#374151', fontWeight: 800 }}>{formatDateRange(h)}</td>
                                                <td style={{ padding: '12px 10px' }}>
                                                    <span
                                                        style={{
                                                            display: 'inline-block',
                                                            padding: '6px 10px',
                                                            borderRadius: '999px',
                                                            backgroundColor: h.type === 'Public' ? '#dbeafe' : h.type === 'School' ? '#dcfce7' : '#fef9c3',
                                                            color: '#111827',
                                                            fontWeight: 1000,
                                                            fontSize: '12px',
                                                        }}
                                                    >
                                                        {h.type}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '12px 10px', color: '#374151', fontSize: '13px', fontWeight: 800 }}>
                                                    {h.applicable_classes && h.applicable_classes.length > 0 ? h.applicable_classes.map((c) => c.name).join(', ') : 'All Classes'}
                                                </td>
                                                <td style={{ padding: '12px 10px' }}>
                                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => openEdit(h)}
                                                            style={{
                                                                padding: '8px 16px',
                                                                borderRadius: '8px',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                backgroundColor: '#ecfdf5',
                                                                color: '#16a34a',
                                                                fontWeight: 900,
                                                            }}
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => deleteHoliday(h.id)}
                                                            style={{
                                                                padding: '8px 16px',
                                                                borderRadius: '8px',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                backgroundColor: '#fef2f2',
                                                                color: '#ef4444',
                                                                fontWeight: 900,
                                                            }}
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {tab === 'calendar' && (
                    <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: isMobile ? '18px 20px 10px' : '24px 32px 12px' }}>
                            <div style={{ fontSize: isMobile ? '44px' : '56px', lineHeight: 1, fontWeight: 1000, color: '#000' }}>
                                {MONTH_NAMES[calMonth - 1]}
                            </div>
                        </div>

                        <div style={{ borderTop: '1px solid #a1a1aa', borderBottom: '1px solid #a1a1aa', padding: isMobile ? '10px 12px' : '12px 18px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', alignItems: 'center' }}>
                                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
                                    <div
                                        key={`${d}-${idx}`}
                                        style={{
                                            textAlign: 'center',
                                            color: idx === 0 || idx === 6 ? '#7a7a7a' : '#111827',
                                            fontWeight: 900,
                                            fontSize: isMobile ? '13px' : '15px',
                                        }}
                                    >
                                        {d}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            {calendarWeeks.map((week, weekIndex) => (
                                <div
                                    key={`week-${weekIndex}`}
                                    style={{
                                        minHeight: isMobile ? '118px' : '138px',
                                        borderBottom: weekIndex === calendarWeeks.length - 1 ? 'none' : '1px solid #e5e7eb',
                                        paddingTop: weekIndex === 0 ? (isMobile ? '12px' : '16px') : 0,
                                    }}
                                >
                                    {weekIndex === 0 ? (
                                        <div style={{ padding: isMobile ? '0 20px 8px' : '0 30px 10px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ color: '#ff3b30', fontWeight: 1000, fontSize: isMobile ? '26px' : '30px', lineHeight: 1 }}>
                                                    {MONTH_NAMES[calMonth - 1].slice(0, 3)}
                                                </div>
                                                <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }} />
                                            </div>
                                        </div>
                                    ) : null}

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
                                        {week.map((key, dayIndex) => {
                                            if (!key) {
                                                return <div key={`empty-${weekIndex}-${dayIndex}`} />;
                                            }

                                            const dayHolidays = holidayByDay.map.get(key) || [];
                                            const isHoliday = dayHolidays.length > 0;
                                            const isSelected = selectedDate === key && detailsOpen;

                                            return (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() => {
                                                        if (!isHoliday) return;
                                                        setSelectedDate(key);
                                                        setDetailsOpen(true);
                                                    }}
                                                    style={{
                                                        border: 'none',
                                                        background: 'transparent',
                                                        cursor: isHoliday ? 'pointer' : 'default',
                                                        padding: isMobile ? '8px 4px 10px' : '10px 6px 12px',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        justifyContent: 'flex-start',
                                                        gap: isMobile ? '12px' : '14px',
                                                        color: dayIndex === 0 || dayIndex === 6 ? '#8e8e93' : '#000',
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            width: isSelected ? (isMobile ? '50px' : '56px') : 'auto',
                                                            height: isSelected ? (isMobile ? '50px' : '56px') : 'auto',
                                                            borderRadius: '999px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            backgroundColor: isSelected ? '#ff3b30' : 'transparent',
                                                            color: isSelected ? '#fff' : dayIndex === 0 || dayIndex === 6 ? '#8e8e93' : '#000',
                                                            fontWeight: 1000,
                                                            fontSize: isMobile ? '24px' : '26px',
                                                            lineHeight: 1,
                                                        }}
                                                    >
                                                        {parseInt(key.slice(-2), 10)}
                                                    </div>

                                                    <div style={{ minHeight: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                        {dayHolidays.length === 1 ? (
                                                            <span
                                                                style={{
                                                                    width: isMobile ? '10px' : '12px',
                                                                    height: isMobile ? '10px' : '12px',
                                                                    borderRadius: '999px',
                                                                    backgroundColor: dayHolidays[0].type === 'Public' ? '#ececec' : dayHolidays[0].type === 'School' ? '#5ac8fa' : '#ffd60a',
                                                                    opacity: 0.95,
                                                                }}
                                                            />
                                                        ) : null}
                                                        {dayHolidays.length >= 2 ? (
                                                            <span
                                                                style={{
                                                                    width: isMobile ? '20px' : '24px',
                                                                    height: isMobile ? '10px' : '12px',
                                                                    borderRadius: '999px',
                                                                    background: 'linear-gradient(90deg, #7bdcb5 0%, #5ac8fa 100%)',
                                                                    opacity: 0.95,
                                                                }}
                                                            />
                                                        ) : null}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Details popup */}
            {detailsOpen && selectedDate && (
                <div
                    onClick={closeDetails}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '12px',
                        zIndex: 9999,
                        overflowY: 'auto',
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: 'min(780px, 100%)',
                            backgroundColor: '#fff',
                            borderRadius: '16px',
                            padding: 'clamp(14px, 4vw, 18px)',
                            border: '1px solid #e5e7eb',
                            maxHeight: 'calc(100dvh - 24px)',
                            overflowY: 'auto',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                            <h3 style={{ margin: 0 }}>Holiday Details</h3>
                            <button type="button" onClick={closeDetails} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px' }}>
                                ×
                            </button>
                        </div>
                        <div style={{ marginTop: '8px', color: '#6b7280', fontWeight: 900 }}>
                            {selectedDate}
                        </div>

                        <div style={{ marginTop: '14px', display: 'grid', gap: '12px' }}>
                            {(holidayByDay.map.get(selectedDate) || []).map((h) => (
                                <div key={h.id} style={{ border: '1px solid #eef2f7', borderRadius: '14px', padding: '12px', backgroundColor: '#fafafa' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                                        <div>
                                            <div style={{ fontWeight: 1000, color: '#111827' }}>{h.title}</div>
                                            <div style={{ marginTop: '6px', color: '#6b7280', fontSize: '13px', fontWeight: 900 }}>
                                                {formatDateRange(h)} • {h.type}
                                            </div>
                                        </div>
                                        <div>
                                            <span
                                                style={{
                                                    display: 'inline-block',
                                                    padding: '6px 10px',
                                                    borderRadius: '999px',
                                                    backgroundColor: h.type === 'Public' ? '#dbeafe' : h.type === 'School' ? '#dcfce7' : '#fef9c3',
                                                    color: '#111827',
                                                    fontWeight: 1000,
                                                    fontSize: '12px',
                                                }}
                                            >
                                                {h.type}
                                            </span>
                                        </div>
                                    </div>
                                    {h.description ? (
                                        <div style={{ marginTop: '10px', color: '#374151', fontSize: '13px', fontWeight: 800 }}>
                                            {h.description}
                                        </div>
                                    ) : null}
                                    <div style={{ marginTop: '10px', color: '#6b7280', fontSize: '13px', fontWeight: 900 }}>
                                        Applies: {h.applicable_classes && h.applicable_classes.length ? h.applicable_classes.map((c) => c.name).join(', ') : 'All Classes'}
                                    </div>
                                </div>
                            ))}
                            {(holidayByDay.map.get(selectedDate) || []).length === 0 ? (
                                <p style={{ color: '#6b7280', fontWeight: 900 }}>No holiday details found.</p>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit modal */}
            {modalOpen && (
                <div
                    onClick={closeModal}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '12px',
                        zIndex: 9999,
                        overflowY: 'auto',
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: 'min(880px, 100%)',
                            backgroundColor: '#fff',
                            borderRadius: '16px',
                            padding: 'clamp(14px, 4vw, 18px)',
                            border: '1px solid #e5e7eb',
                            maxHeight: 'calc(100dvh - 24px)',
                            overflowY: 'auto',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                            <h3 style={{ margin: 0 }}>{editingId ? 'Edit Holiday' : 'Add Holiday'}</h3>
                            <button type="button" onClick={closeModal} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px' }}>
                                ×
                            </button>
                        </div>

                        {formError ? <div style={{ marginTop: '10px', color: '#b91c1c', fontWeight: 1000, fontSize: '13px' }}>{formError}</div> : null}

                        <form onSubmit={submitHoliday} style={{ marginTop: '14px', display: 'grid', gap: '14px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '12px' }}>
                                <div>
                                    <div style={labelStyle}>Holiday Title *</div>
                                    <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={inputStyle} required />
                                </div>
                                <div>
                                    <div style={labelStyle}>Holiday Type</div>
                                    <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={inputStyle}>
                                        <option value="Public">Public</option>
                                        <option value="School">School</option>
                                        <option value="Optional">Optional</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '12px' }}>
                                <div>
                                    <div style={labelStyle}>Start Date *</div>
                                    <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} style={inputStyle} required />
                                </div>
                                <div>
                                    <div style={labelStyle}>End Date (optional)</div>
                                    <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} style={inputStyle} />
                                </div>
                            </div>

                            <div>
                                <div style={labelStyle}>Description (optional)</div>
                                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }} placeholder="Why is this holiday?" />
                            </div>

                            <div style={{ borderTop: '1px solid #eef2f7', paddingTop: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                    <div style={{ fontWeight: 1000, color: '#111827' }}>Applicable For</div>
                                    <label style={{ display: 'flex', gap: '10px', alignItems: 'center', fontWeight: 900, color: '#374151', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={form.allClasses}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                setForm({ ...form, allClasses: checked, applicable_class_ids: checked ? [] : form.applicable_class_ids });
                                            }}
                                        />
                                        All Classes
                                    </label>
                                </div>

                                {!form.allClasses ? (
                                    <div style={{ marginTop: '12px' }}>
                                        <div style={labelStyle}>Select Classes</div>
                                        <select
                                            multiple
                                            value={form.applicable_class_ids.map(String)}
                                            onChange={(e) => {
                                                const values = Array.from(e.target.selectedOptions).map((o) => Number(o.value));
                                                setForm({ ...form, applicable_class_ids: values });
                                            }}
                                            style={{ ...inputStyle, minHeight: '140px' }}
                                        >
                                            {classes.map((c) => (
                                                <option key={c.id} value={c.id}>
                                                    {c.name}
                                                </option>
                                            ))}
                                        </select>
                                        <div style={{ marginTop: '6px', color: '#6b7280', fontSize: '12px', fontWeight: 900 }}>
                                            Tip: hold Ctrl (or Cmd) to select multiple classes
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ marginTop: '12px', color: '#6b7280', fontSize: '13px', fontWeight: 900 }}>
                                        This holiday applies to all classes.
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
                                <button type="button" onClick={closeModal} style={{ padding: '10px 14px', borderRadius: '12px', border: '1px solid #e5e7eb', backgroundColor: '#fff', cursor: 'pointer', fontWeight: 1000 }}>
                                    Cancel
                                </button>
                                <button type="submit" style={{ padding: '10px 14px', borderRadius: '12px', border: 'none', backgroundColor: '#16a34a', cursor: 'pointer', color: '#fff', fontWeight: 1000 }}>
                                    {editingId ? 'Save Changes' : 'Add Holiday'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminHolidays;
