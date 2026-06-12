import React, { useCallback, useEffect, useState } from 'react';
import { useConfirm } from '../../context/ConfirmContext';
import api from '../../services/api';

const emptyForm = () => ({
    title: '',
    description: '',
    type: 'holiday',
    start_date: '',
    end_date: '',
    target_audience: 'all',
    class_id: '',
    is_important: false,
    is_pinned: false,
});

function typeLabel(t) {
    if (t === 'holiday') return 'Holiday';
    if (t === 'exam') return 'Exam';
    return 'General';
}

function audienceLabel(a) {
    if (a === 'all') return 'All';
    if (a === 'students') return 'Students';
    return 'Teachers';
}

const AdminAnnouncements = () => {
    const confirm = useConfirm();
    const [list, setList] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [viewRow, setViewRow] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [file, setFile] = useState(null);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [activeOnly, setActiveOnly] = useState(false);
    const [error, setError] = useState('');
    const [banner, setBanner] = useState('');
    const [notifyBusyId, setNotifyBusyId] = useState(null);

    const load = useCallback(() => {
        setLoading(true);
        const params = new URLSearchParams();
        if (activeOnly) params.set('active_only', '1');
        if (filterType !== 'all') params.set('type', filterType);
        const q = params.toString();
        api.get(q ? `announcements/?${q}` : 'announcements/')
            .then((r) => setList(r.data || []))
            .catch(() => setList([]))
            .finally(() => setLoading(false));
    }, [activeOnly, filterType]);

    const searchNow = () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (activeOnly) params.set('active_only', '1');
        if (filterType !== 'all') params.set('type', filterType);
        if (search.trim()) params.set('search', search.trim());
        const q = params.toString();
        api.get(q ? `announcements/?${q}` : 'announcements/')
            .then((r) => setList(r.data || []))
            .catch(() => setList([]))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        api.get('classes/main-classes/').then((r) => setClasses(r.data || [])).catch(() => setClasses([]));
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const closeForm = () => {
        setForm(emptyForm());
        setFile(null);
        setEditingId(null);
        setShowForm(false);
        setError('');
    };

    const openCreate = () => {
        setViewRow(null);
        setForm(emptyForm());
        setFile(null);
        setEditingId(null);
        setError('');
        setShowForm(true);
    };

    const openEdit = (row) => {
        setViewRow(null);
        setEditingId(row.id);
        setForm({
            title: row.title || '',
            description: row.description || '',
            type: row.type || 'holiday',
            start_date: row.start_date || '',
            end_date: row.end_date || '',
            target_audience: row.target_audience || 'all',
            class_id: row.class_meta?.id ? String(row.class_meta.id) : '',
            is_important: !!row.is_important,
            is_pinned: !!row.is_pinned,
        });
        setFile(null);
        setError('');
        setShowForm(true);
    };

    const buildPayload = () => {
        const payload = {
            title: form.title.trim(),
            description: form.description.trim(),
            type: form.type,
            start_date: form.start_date,
            end_date: form.end_date,
            target_audience: form.target_audience,
            is_important: form.is_important,
            is_pinned: form.is_pinned,
        };
        if (form.class_id) payload.class_id = Number(form.class_id);
        else payload.class_id = null;
        return payload;
    };

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setBanner('');
        if (!form.title.trim() || !form.start_date || !form.end_date) {
            setError('Title, start date, and end date are required.');
            return;
        }
        setSaving(true);
        try {
            if (file) {
                const fd = new FormData();
                const p = buildPayload();
                Object.entries(p).forEach(([k, v]) => {
                    if (v === null || v === undefined) return;
                    if (typeof v === 'boolean') fd.append(k, v ? 'true' : 'false');
                    else fd.append(k, v);
                });
                fd.append('attachment', file);
                if (editingId) {
                    await api.patch(`announcements/${editingId}/`, fd);
                    setBanner('Announcement updated.');
                } else {
                    const res = await api.post('announcements/', fd);
                    const sent = res.data?.notifications_sent;
                    if (sent === 0 && res.data?.notifications_warning) {
                        setBanner(res.data.notifications_warning);
                    } else {
                        setBanner(
                            `Announcement created. Notifications sent to ${sent ?? 0} user(s).`,
                        );
                    }
                }
            } else if (editingId) {
                await api.patch(`announcements/${editingId}/`, buildPayload());
                setBanner('Announcement updated.');
            } else {
                const res = await api.post('announcements/', buildPayload());
                const sent = res.data?.notifications_sent;
                if (sent === 0 && res.data?.notifications_warning) {
                    setBanner(res.data.notifications_warning);
                } else {
                    setBanner(`Announcement created. Notifications sent to ${sent ?? 0} user(s).`);
                }
            }
            closeForm();
            load();
        } catch (err) {
            const d = err.response?.data;
            setError(typeof d === 'object' ? JSON.stringify(d) : d || err.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const remove = async (id) => {
        if (!(await confirm('Delete this announcement?'))) return;
        try {
            await api.delete(`announcements/${id}/`);
            load();
            if (editingId === id) closeForm();
            if (viewRow?.id === id) setViewRow(null);
        } catch (err) {
            setError(err.response?.data?.error || err.response?.data?.detail || 'Delete failed');
        }
    };

    const resendNotifications = async (id) => {
        setError('');
        setBanner('');
        setNotifyBusyId(id);
        try {
            const res = await api.post(`announcements/${id}/notify/`);
            const sent = res.data?.notifications_sent ?? 0;
            if (sent === 0 && res.data?.notifications_warning) {
                setBanner(res.data.notifications_warning);
            } else {
                setBanner(`Notifications sent to ${sent} user(s).`);
            }
        } catch (err) {
            const d = err.response?.data;
            setError(typeof d === 'object' ? JSON.stringify(d) : d || err.message || 'Notify failed');
        } finally {
            setNotifyBusyId(null);
        }
    };

    const formTitle = editingId ? 'Edit announcement' : 'New announcement';

    return (
        <div className="min-h-screen bg-slate-50 p-3 sm:p-4 md:p-8 overflow-x-hidden">
            <div className="mx-auto w-full max-w-4xl space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900">Announcements</h1>
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                            Shown only inside <strong>Notifications</strong> for students & teachers
                        </p>
                    </div>
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
                        {showForm ? (
                            <button
                                type="button"
                                onClick={closeForm}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 sm:w-auto"
                            >
                                Close
                            </button>
                        ) : null}
                        <button
                            type="button"
                            onClick={openCreate}
                            className="w-full rounded-2xl bg-school-navy px-5 py-3 text-sm font-black text-white shadow-lg shadow-school-navy/20 hover:opacity-95 sm:w-auto"
                        >
                            + Create announcement
                        </button>
                    </div>
                </div>

                {banner ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
                        {banner}
                    </div>
                ) : null}
                {error ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</div>
                ) : null}

                {showForm ? (
                    <form
                        onSubmit={submit}
                        className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm space-y-4 sm:p-6"
                    >
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                            <h2 className="text-lg font-black text-slate-900">{formTitle}</h2>
                            <button type="button" onClick={closeForm} className="text-sm font-bold text-slate-500 hover:text-slate-800">
                                Cancel
                            </button>
                        </div>

                        <div>
                            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Title</label>
                            <input
                                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-school-blue/40"
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                                placeholder="School Holiday Notice"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Description</label>
                            <textarea
                                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-school-blue/40 min-h-[100px]"
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                placeholder="School will remain closed..."
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Type</label>
                                <select
                                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold bg-white"
                                    value={form.type}
                                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                                >
                                    <option value="holiday">Holiday</option>
                                    <option value="exam">Exam</option>
                                    <option value="general">General</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Audience</label>
                                <select
                                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold bg-white"
                                    value={form.target_audience}
                                    onChange={(e) => setForm({ ...form, target_audience: e.target.value })}
                                >
                                    <option value="all">All</option>
                                    <option value="students">Students only</option>
                                    <option value="teachers">Teachers only</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Start date</label>
                                <input
                                    type="date"
                                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold"
                                    value={form.start_date}
                                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">End date</label>
                                <input
                                    type="date"
                                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold"
                                    value={form.end_date}
                                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Class (optional)</label>
                            <select
                                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold bg-white"
                                value={form.class_id}
                                onChange={(e) => setForm({ ...form, class_id: e.target.value })}
                            >
                                <option value="">All classes (students)</option>
                                {(classes || []).map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Attachment (optional)</label>
                            <input
                                type="file"
                                accept=".pdf,.png,.jpg,.jpeg,.webp"
                                className="mt-1 w-full text-sm font-semibold text-slate-600"
                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                            />
                        </div>

                        <div className="flex flex-wrap gap-4">
                            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.is_important}
                                    onChange={(e) => setForm({ ...form, is_important: e.target.checked })}
                                />
                                Important (highlight)
                            </label>
                            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.is_pinned}
                                    onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })}
                                />
                                Pin 📌
                            </label>
                        </div>

                        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">
                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full rounded-2xl bg-school-navy px-6 py-3 text-sm font-black text-white shadow-lg shadow-school-navy/20 hover:opacity-95 disabled:opacity-50 sm:w-auto"
                            >
                                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create + notify'}
                            </button>
                            <button
                                type="button"
                                onClick={closeForm}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 sm:w-auto"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                ) : null}

                {!showForm ? (
                    <div className="space-y-4">
                        <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">All announcements</h2>
                        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
                            <input
                                placeholder="Search…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold md:w-auto md:min-w-[180px]"
                            />
                            <button
                                type="button"
                                onClick={searchNow}
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 md:w-auto"
                            >
                                Search
                            </button>
                            <select
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold md:w-auto"
                            >
                                <option value="all">All types</option>
                                <option value="holiday">Holiday</option>
                                <option value="exam">Exam</option>
                                <option value="general">General</option>
                            </select>
                            <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
                                <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
                                Active only
                            </label>
                        </div>

                        {loading ? (
                            <div className="text-sm font-bold text-slate-500 py-10 text-center">Loading…</div>
                        ) : (
                            <div className="space-y-3">
                                {(list || []).length === 0 ? (
                                    <div className="rounded-3xl border border-dashed border-slate-200 bg-white py-16 text-center text-sm font-semibold text-slate-500">
                                        No announcements yet. Use <strong>Create announcement</strong> above.
                                    </div>
                                ) : (
                                    list.map((row) => (
                                        <div
                                            key={row.id}
                                            className={`rounded-3xl border p-4 shadow-sm sm:p-5 ${
                                                row.is_important ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-white'
                                            }`}
                                        >
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className="text-base font-black text-slate-900 break-words">{row.title}</h3>
                                                        {row.is_pinned ? (
                                                            <span className="text-xs font-black text-school-blue">📌 Pinned</span>
                                                        ) : null}
                                                        <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-black uppercase text-violet-700">
                                                            {typeLabel(row.type)}
                                                        </span>
                                                        {row.is_holiday_window ? (
                                                            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-black uppercase text-emerald-800">
                                                                Active holiday
                                                            </span>
                                                        ) : null}
                                                        {!row.is_active ? (
                                                            <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[11px] font-black text-slate-600">
                                                                Ended
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <p className="mt-2 text-sm font-semibold text-slate-600 line-clamp-2">{row.description}</p>
                                                    <div className="mt-2 text-xs font-bold text-slate-500">
                                                        📅 {row.start_date} → {row.end_date} · {audienceLabel(row.target_audience)}
                                                        {row.class_meta?.name ? ` · Class: ${row.class_meta.name}` : ''}
                                                    </div>
                                                </div>
                                                <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => setViewRow(row)}
                                                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                                                    >
                                                        View
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => openEdit(row)}
                                                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={notifyBusyId === row.id}
                                                        onClick={() => resendNotifications(row.id)}
                                                        className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
                                                        title="Create notification rows again (users may see duplicates)"
                                                    >
                                                        {notifyBusyId === row.id ? 'Sending…' : 'Notify again'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => remove(row.id)}
                                                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                ) : null}
            </div>

            {viewRow ? (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-3 backdrop-blur-sm sm:p-4"
                    onClick={() => setViewRow(null)}
                    role="presentation"
                >
                    <div
                        className="w-full max-w-lg max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-6"
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="view-announcement-title"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <h2 id="view-announcement-title" className="text-lg font-black text-slate-900 pr-4">
                                {viewRow.title}
                            </h2>
                            <button
                                type="button"
                                onClick={() => setViewRow(null)}
                                className="rounded-lg px-2 py-1 text-sm font-bold text-slate-500 hover:bg-slate-100"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-black uppercase text-violet-700">
                                {typeLabel(viewRow.type)}
                            </span>
                            {viewRow.is_pinned ? (
                                <span className="text-xs font-black text-school-blue">📌 Pinned</span>
                            ) : null}
                            {viewRow.is_important ? (
                                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-black text-amber-900">
                                    Important
                                </span>
                            ) : null}
                        </div>
                        <p className="mt-4 whitespace-pre-wrap text-sm font-semibold text-slate-700">{viewRow.description}</p>
                        <div className="mt-4 space-y-2 text-sm font-bold text-slate-600">
                            <div>
                                📅 {viewRow.start_date} → {viewRow.end_date}
                            </div>
                            <div>
                                Audience: {audienceLabel(viewRow.target_audience)}
                                {viewRow.class_meta?.name ? ` · Class: ${viewRow.class_meta.name}` : ''}
                            </div>
                            {viewRow.created_by_name ? <div>Created by: {viewRow.created_by_name}</div> : null}
                        </div>
                        {viewRow.attachment_url ? (
                            <a
                                href={viewRow.attachment_url}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-4 inline-flex rounded-xl bg-school-navy px-4 py-2.5 text-xs font-black text-white hover:opacity-95"
                            >
                                Download attachment
                            </a>
                        ) : null}
                        <div className="mt-6 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
                            <button
                                type="button"
                                onClick={() => {
                                    const r = viewRow;
                                    setViewRow(null);
                                    openEdit(r);
                                }}
                                className="rounded-xl bg-school-navy px-4 py-2.5 text-xs font-black text-white hover:opacity-95"
                            >
                                Edit
                            </button>
                            <button
                                type="button"
                                disabled={notifyBusyId === viewRow.id}
                                onClick={() => resendNotifications(viewRow.id)}
                                className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs font-black text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
                            >
                                {notifyBusyId === viewRow.id ? 'Sending…' : 'Notify again'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewRow(null)}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default AdminAnnouncements;
