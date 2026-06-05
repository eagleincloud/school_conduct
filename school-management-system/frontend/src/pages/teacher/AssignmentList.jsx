import React, { useEffect, useMemo, useState } from 'react';
import { useConfirm } from '../../context/ConfirmContext';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const palette = {
    bg: '#f8fafc',
    card: '#ffffff',
    border: '#e5e7eb',
    text: '#0f172a',
    muted: '#64748b',
    primary: '#2563eb',
    success: '#16a34a',
    danger: '#ef4444',
    warn: '#f59e0b',
    info: '#0ea5e9',
    shadow: '0 1px 12px rgba(16,24,40,0.08)',
};

const pageSize = 8;

const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    border: `1px solid ${palette.border}`,
    borderRadius: '12px',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box',
    backgroundColor: '#fff',
    fontWeight: 900,
};

const labelStyle = {
    fontSize: '11px',
    color: palette.muted,
    fontWeight: 1000,
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
};

function parseDateOnly(v) {
    if (!v) return null;
    const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function getStatus(a) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = parseDateOnly(a?.due_date);
    if (!due) return 'Closed';
    return due.getTime() >= today.getTime() ? 'Active' : 'Closed';
}

export default function TeacherAssignmentList() {
    const confirm = useConfirm();
    const navigate = useNavigate();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [q, setQ] = useState('');
    const [classFilter, setClassFilter] = useState('');
    const [subjectFilter, setSubjectFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [page, setPage] = useState(1);
    const [viewRow, setViewRow] = useState(null);
    const [editRow, setEditRow] = useState(null);
    const [saving, setSaving] = useState(false);
    const [viewSubmissions, setViewSubmissions] = useState([]);
    const [loadingSubmissions, setLoadingSubmissions] = useState(false);

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await api.get('assignments/');
            setRows((res.data || []).map((a) => ({ ...a, computed_status: getStatus(a) })));
        } catch (e) {
            setError(e?.response?.data?.error || 'Could not load assignments.');
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const summary = useMemo(() => {
        const total = rows.length;
        const active = rows.filter((r) => r.computed_status === 'Active').length;
        const totalSubmissions = rows.reduce((acc, r) => acc + (r.submission_count || 0), 0);
        return { total, active, totalSubmissions };
    }, [rows]);

    const classOptions = useMemo(
        () => Array.from(new Set(rows.map((r) => `${r.class_name || ''}-${r.section_name || ''}`))).filter(Boolean),
        [rows]
    );
    const subjectOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.subject || ''))).filter(Boolean), [rows]);

    const filtered = useMemo(() => {
        const f = rows.filter((r) => {
            const title = String(r.title || '').toLowerCase();
            if (q && !title.includes(q.toLowerCase())) return false;
            const cls = `${r.class_name || ''}-${r.section_name || ''}`;
            if (classFilter && cls !== classFilter) return false;
            if (subjectFilter && r.subject !== subjectFilter) return false;
            if (statusFilter && r.computed_status !== statusFilter) return false;
            const due = parseDateOnly(r.due_date);
            if (fromDate && due && due < parseDateOnly(fromDate)) return false;
            if (toDate && due && due > parseDateOnly(toDate)) return false;
            return true;
        });
        return f.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    }, [rows, q, classFilter, subjectFilter, statusFilter, fromDate, toDate]);

    useEffect(() => {
        setPage(1);
    }, [q, classFilter, subjectFilter, statusFilter, fromDate, toDate]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

    const onDelete = async (id) => {
        if (!(await confirm('Delete this assignment?'))) return;
        try {
            await api.delete(`assignments/${id}/`);
            await load();
        } catch (e) {
            alert(e?.response?.data?.error || 'Delete failed');
        }
    };

    const onSaveEdit = async () => {
        if (!editRow) return;
        setSaving(true);
        try {
            await api.patch(`assignments/${editRow.id}/`, {
                title: editRow.title,
                subject: editRow.subject,
                start_date: editRow.start_date || null,
                due_date: editRow.due_date,
                total_marks: editRow.total_marks,
                submission_type: editRow.submission_type,
                description: editRow.description || '',
                instructions: editRow.instructions || '',
            });
            setEditRow(null);
            await load();
        } catch (e) {
            alert(e?.response?.data?.error || 'Update failed');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ padding: '24px', backgroundColor: palette.bg, minHeight: 'calc(100vh - 64px)' }}>
            <style>
                {`
                @keyframes slideUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
                .animate-up { animation: slideUp 0.4s ease forwards; }
                .hover-scale { transition: transform 0.2s; }
                .hover-scale:hover { transform: scale(1.01); }
                `}
            </style>

            {/* Header Section */}
            <div style={{ 
                backgroundColor: palette.card, 
                padding: '24px', 
                borderRadius: '20px', 
                marginBottom: '20px', 
                boxShadow: palette.shadow,
                border: `1px solid ${palette.border}`,
                background: 'linear-gradient(135deg, #fff 0%, #f8fafc 100%)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{ position: 'absolute', top: -30, right: -30, width: 200, height: 200, background: 'rgba(37, 99, 235, 0.03)', borderRadius: '50%', zIndex: 0 }}></div>
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <div>
                        <h1 style={{ margin: 0, fontWeight: 1000, fontSize: '30px', letterSpacing: '-0.02em', background: 'linear-gradient(90deg, #1e293b 0%, #2563eb 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            My Assignments
                        </h1>
                        <p style={{ margin: '8px 0 0', color: palette.muted, fontWeight: 900, fontSize: '15px' }}>Manage and track assignments created by you.</p>
                    </div>
                    <button 
                        onClick={() => navigate('/teacher/assignment')} 
                        style={{ 
                            border: 'none', 
                            background: palette.primary, 
                            color: '#fff', 
                            borderRadius: '14px', 
                            padding: '12px 24px', 
                            fontWeight: 1000, 
                            cursor: 'pointer',
                            fontSize: '14px',
                            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
                            transition: 'all 0.2s'
                        }}
                    >
                        + Create New Assignment
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="animate-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                <div style={{ backgroundColor: palette.card, borderRadius: '18px', padding: '20px', border: `1px solid ${palette.border}`, boxShadow: palette.shadow }}>
                    <div style={{ fontSize: '11px', color: palette.muted, fontWeight: 1000, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Assignments</div>
                    <div style={{ marginTop: '10px', fontSize: '28px', fontWeight: 1000, color: palette.text }}>{summary.total}</div>
                </div>
                <div style={{ backgroundColor: palette.card, borderRadius: '18px', padding: '20px', border: `1px solid ${palette.border}`, boxShadow: palette.shadow }}>
                    <div style={{ fontSize: '11px', color: palette.muted, fontWeight: 1000, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Assignments</div>
                    <div style={{ marginTop: '10px', fontSize: '28px', fontWeight: 1000, color: palette.success }}>{summary.active}</div>
                </div>
                <div style={{ backgroundColor: palette.card, borderRadius: '18px', padding: '20px', border: `1px solid ${palette.border}`, boxShadow: palette.shadow }}>
                    <div style={{ fontSize: '11px', color: palette.muted, fontWeight: 1000, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Submissions</div>
                    <div style={{ marginTop: '10px', fontSize: '28px', fontWeight: 1000, color: palette.primary }}>{summary.totalSubmissions}</div>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="animate-up" style={{ backgroundColor: palette.card, borderRadius: '18px', padding: '16px', border: `1px solid ${palette.border}`, boxShadow: palette.shadow, marginBottom: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title..." style={{ ...inputStyle, backgroundColor: '#f8fafc' }} />
                <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} style={{ ...inputStyle, backgroundColor: '#f8fafc' }}>
                    <option value="">All Classes</option>
                    {classOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} style={{ ...inputStyle, backgroundColor: '#f8fafc' }}>
                    <option value="">All Subjects</option>
                    {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...inputStyle, backgroundColor: '#f8fafc' }}>
                    <option value="">All Status</option>
                    <option value="Active">Active</option>
                    <option value="Closed">Closed</option>
                </select>
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ ...inputStyle, backgroundColor: '#f8fafc' }} />
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ ...inputStyle, backgroundColor: '#f8fafc' }} />
            </div>

            {/* Assignments Table */}
            <div className="animate-up" style={{ backgroundColor: palette.card, borderRadius: '20px', border: `1px solid ${palette.border}`, boxShadow: palette.shadow, overflow: 'hidden' }}>
                {error && <div style={{ padding: '16px', color: palette.danger, fontWeight: 1000, backgroundColor: '#fef2f2', borderBottom: `1px solid ${palette.border}` }}>{error}</div>}
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1100px' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: `1px solid ${palette.border}` }}>
                                {['Assignment Title', 'Subject', 'Class', 'Due Date', 'Marks', 'Submissions', 'Status', 'Actions'].map((h) => (
                                    <th key={h} style={{ textAlign: 'left', padding: '16px', fontSize: '11px', fontWeight: 1000, color: palette.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: palette.muted, fontWeight: 900 }}>Loading assignments...</td></tr>
                            ) : paged.length ? (
                                paged.map((r) => (
                                    <tr key={r.id} className="hover-scale" style={{ borderBottom: `1px solid ${palette.border}`, backgroundColor: '#fff' }}>
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ fontWeight: 1000, color: palette.text, fontSize: '14px' }}>{r.title}</div>
                                            <div style={{ fontSize: '11px', color: palette.muted, fontWeight: 900, marginTop: '2px' }}>Added: {new Date(r.created_at).toLocaleDateString()}</div>
                                        </td>
                                        <td style={{ padding: '16px', fontWeight: 900, color: palette.text }}>{r.subject}</td>
                                        <td style={{ padding: '16px', fontWeight: 900 }}>
                                            <span style={{ backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '8px', fontSize: '12px' }}>{r.class_name}-{r.section_name}</span>
                                        </td>
                                        <td style={{ padding: '16px', fontWeight: 1000, color: palette.primary }}>{r.due_date}</td>
                                        <td style={{ padding: '16px', fontWeight: 1000 }}>{r.total_marks}</td>
                                        <td style={{ padding: '16px' }}>
                                            <span style={{ fontWeight: 1000, color: r.submission_count > 0 ? palette.success : palette.muted }}>
                                                {r.submission_count} Submitted
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <span style={{ 
                                                padding: '6px 12px', 
                                                borderRadius: '999px', 
                                                fontSize: '11px', 
                                                fontWeight: 1000, 
                                                backgroundColor: r.computed_status === 'Active' ? '#f0fdf4' : '#fef2f2',
                                                color: r.computed_status === 'Active' ? palette.success : palette.danger,
                                                border: `1px solid ${r.computed_status === 'Active' ? '#bbf7d0' : '#fecaca'}`
                                            }}>
                                                {r.computed_status}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button 
                                                    onClick={async () => {
                                                        setViewRow(r);
                                                        setLoadingSubmissions(true);
                                                        try {
                                                            const res = await api.get(`assignments/${r.id}/submissions/`);
                                                            setViewSubmissions(res.data || []);
                                                        } catch (e) {
                                                            console.error(e);
                                                        } finally {
                                                            setLoadingSubmissions(false);
                                                        }
                                                    }} 
                                                    style={{ border: `1px solid ${palette.border}`, background: '#fff', borderRadius: '10px', padding: '8px 12px', cursor: 'pointer', fontWeight: 1000, fontSize: '12px' }}
                                                >
                                                    View
                                                </button>
                                                <button onClick={() => setEditRow({ ...r })} style={{ border: 'none', background: palette.success, color: '#fff', borderRadius: '10px', padding: '8px 12px', cursor: 'pointer', fontWeight: 1000, fontSize: '12px' }}>Edit</button>
                                                <button onClick={() => onDelete(r.id)} style={{ border: 'none', background: palette.danger, color: '#fff', borderRadius: '10px', padding: '8px 12px', cursor: 'pointer', fontWeight: 1000, fontSize: '12px' }}>Delete</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={8} style={{ padding: '60px', textAlign: 'center', color: palette.muted, fontWeight: 1000 }}>No assignments found matching your criteria.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderTop: `1px solid ${palette.border}` }}>
                    <div style={{ color: palette.muted, fontWeight: 900, fontSize: '13px' }}>Showing {paged.length} of {filtered.length} assignments</div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={{ padding: '8px 16px', border: `1px solid ${palette.border}`, borderRadius: '10px', background: '#fff', cursor: 'pointer', fontWeight: 1000, fontSize: '13px', opacity: page <= 1 ? 0.5 : 1 }}>Prev</button>
                        <div style={{ padding: '0 12px', fontWeight: 1000, color: palette.text }}>Page {page} / {totalPages}</div>
                        <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} style={{ padding: '8px 16px', border: `1px solid ${palette.border}`, borderRadius: '10px', background: '#fff', cursor: 'pointer', fontWeight: 1000, fontSize: '13px', opacity: page >= totalPages ? 0.5 : 1 }}>Next</button>
                    </div>
                </div>
            </div>

            {/* View Modal */}
            {viewRow && (
                <div onClick={() => setViewRow(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', zIndex: 1000 }}>
                    <div onClick={(e) => e.stopPropagation()} className="animate-up" style={{ width: 'min(760px, 100%)', background: '#fff', borderRadius: '24px', padding: '30px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', border: `1px solid ${palette.border}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                            <div>
                                <h3 style={{ margin: 0, fontWeight: 1000, fontSize: '22px' }}>Assignment Overview</h3>
                                <div style={{ color: palette.primary, fontWeight: 1000, fontSize: '14px', marginTop: '4px' }}>{viewRow.title}</div>
                            </div>
                            <button onClick={() => setViewRow(null)} style={{ width: 32, height: 32, borderRadius: '10px', backgroundColor: '#f1f5f9', border: 'none', cursor: 'pointer', fontSize: '20px', fontWeight: 1000, color: palette.muted }}>×</button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', backgroundColor: '#f8fafc', padding: '20px', borderRadius: '18px', border: `1px solid ${palette.border}` }}>
                            <div><div style={labelStyle}>Subject</div><div style={{ fontWeight: 1000 }}>{viewRow.subject}</div></div>
                            <div><div style={labelStyle}>Class & Section</div><div style={{ fontWeight: 1000 }}>{viewRow.class_name}-{viewRow.section_name}</div></div>
                            <div><div style={labelStyle}>Due Date</div><div style={{ fontWeight: 1000, color: palette.danger }}>{viewRow.due_date}</div></div>
                            <div><div style={labelStyle}>Marks</div><div style={{ fontWeight: 1000 }}>{viewRow.total_marks}</div></div>
                        </div>

                        {viewRow.description && (
                            <div style={{ marginTop: '20px' }}>
                                <div style={labelStyle}>Description</div>
                                <div style={{ color: palette.text, fontSize: '14px', fontWeight: 800, lineHeight: '1.6', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '14px', border: `1px solid ${palette.border}` }}>
                                    {viewRow.description}
                                </div>
                            </div>
                        )}

                        <div style={{ marginTop: '24px', borderTop: `1px solid ${palette.border}`, paddingTop: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h4 style={{ margin: 0, fontWeight: 1000 }}>Student Submissions</h4>
                                <span style={{ backgroundColor: palette.primary, color: '#fff', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 1000 }}>{viewSubmissions.length} Total</span>
                            </div>

                            {loadingSubmissions ? (
                                <div style={{ padding: '20px', textAlign: 'center', color: palette.muted, fontWeight: 900 }}>Loading submissions...</div>
                            ) : viewSubmissions.length ? (
                                <div style={{ maxHeight: '240px', overflowY: 'auto', border: `1px solid ${palette.border}`, borderRadius: '14px' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                                            <tr>
                                                <th style={{ textAlign: 'left', padding: '12px', fontSize: '11px', fontWeight: 1000, color: palette.muted }}>STUDENT NAME</th>
                                                <th style={{ textAlign: 'left', padding: '12px', fontSize: '11px', fontWeight: 1000, color: palette.muted }}>ROLL NO</th>
                                                <th style={{ textAlign: 'left', padding: '12px', fontSize: '11px', fontWeight: 1000, color: palette.muted }}>SUBMISSION DATE</th>
                                                <th style={{ textAlign: 'center', padding: '12px', fontSize: '11px', fontWeight: 1000, color: palette.muted }}>FILE</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {viewSubmissions.map((s) => (
                                                <tr key={s.id} style={{ borderTop: `1px solid ${palette.border}` }}>
                                                    <td style={{ padding: '12px', fontWeight: 1000, fontSize: '13px' }}>{s.student_name}</td>
                                                    <td style={{ padding: '12px', fontSize: '13px', fontWeight: 900 }}>{s.student_roll}</td>
                                                    <td style={{ padding: '12px', fontSize: '12px', fontWeight: 800 }}>{new Date(s.submission_date).toLocaleString()}</td>
                                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                                        {s.file_url ? (
                                                            <a href={s.file_url} target="_blank" rel="noreferrer" style={{ color: palette.primary, fontWeight: 1000, fontSize: '12px', textDecoration: 'none', border: `1px solid ${palette.primary}`, padding: '4px 8px', borderRadius: '6px' }}>Open</a>
                                                        ) : <span style={{ color: palette.muted, fontSize: '12px' }}>-</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div style={{ padding: '30px', textAlign: 'center', color: palette.muted, fontWeight: 900, backgroundColor: '#f8fafc', borderRadius: '14px' }}>No submissions received yet.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editRow && (
                <div onClick={() => setEditRow(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', zIndex: 1000 }}>
                    <div onClick={(e) => e.stopPropagation()} className="animate-up" style={{ width: 'min(760px, 100%)', background: '#fff', borderRadius: '24px', padding: '30px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', border: `1px solid ${palette.border}` }}>
                        <h3 style={{ marginTop: 0, fontWeight: 1000, fontSize: '22px', marginBottom: '20px' }}>Update Assignment</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                            <div><div style={labelStyle}>Assignment Title</div><input value={editRow.title || ''} onChange={(e) => setEditRow((p) => ({ ...p, title: e.target.value }))} style={inputStyle} /></div>
                            <div><div style={labelStyle}>Subject</div><input value={editRow.subject || ''} onChange={(e) => setEditRow((p) => ({ ...p, subject: e.target.value }))} style={inputStyle} /></div>
                            <div><div style={labelStyle}>Start Date</div><input type="date" value={editRow.start_date || ''} onChange={(e) => setEditRow((p) => ({ ...p, start_date: e.target.value }))} style={inputStyle} /></div>
                            <div><div style={labelStyle}>Due Date</div><input type="date" value={editRow.due_date || ''} onChange={(e) => setEditRow((p) => ({ ...p, due_date: e.target.value }))} style={inputStyle} /></div>
                            <div><div style={labelStyle}>Total Marks</div><input type="number" value={editRow.total_marks || ''} onChange={(e) => setEditRow((p) => ({ ...p, total_marks: e.target.value }))} style={inputStyle} /></div>
                            <div><div style={labelStyle}>Submission Mode</div>
                                <select value={editRow.submission_type || 'online'} onChange={(e) => setEditRow((p) => ({ ...p, submission_type: e.target.value }))} style={inputStyle}>
                                    <option value="online">Online Upload</option>
                                    <option value="offline">Offline Submission</option>
                                </select>
                            </div>
                        </div>
                        <div style={{ marginTop: '16px' }}>
                            <div style={labelStyle}>Detailed Description</div>
                            <textarea value={editRow.description || ''} onChange={(e) => setEditRow((p) => ({ ...p, description: e.target.value }))} style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }} />
                        </div>
                        <div style={{ marginTop: '16px' }}>
                            <div style={labelStyle}>Student Instructions</div>
                            <textarea value={editRow.instructions || ''} onChange={(e) => setEditRow((p) => ({ ...p, instructions: e.target.value }))} style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} />
                        </div>
                        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button onClick={() => setEditRow(null)} style={{ border: `1px solid ${palette.border}`, background: '#fff', borderRadius: '12px', padding: '12px 20px', cursor: 'pointer', fontWeight: 1000 }}>Cancel</button>
                            <button onClick={onSaveEdit} disabled={saving} style={{ border: 'none', background: palette.primary, color: '#fff', borderRadius: '12px', padding: '12px 24px', cursor: 'pointer', fontWeight: 1000, boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)' }}>{saving ? 'Saving...' : 'Save Changes'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


