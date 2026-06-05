import React, { useEffect, useMemo, useState } from 'react';
import { useConfirm } from '../../context/ConfirmContext';
import api from '../../services/api';

const PAGE_SIZE = 8;

const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString();
};

const yearsBucket = (n) => {
    if (n == null || n === '' || Number.isNaN(Number(n))) return 'Unknown';
    const v = Number(n);
    if (v <= 1) return '0-1';
    if (v <= 3) return '2-3';
    if (v <= 5) return '4-5';
    return '6+';
};

const csvValue = (value) => {
    if (value == null) return '';
    const text = String(value);
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
};

const ManageTeachers = () => {
    const confirm = useConfirm();
    const [teachers, setTeachers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busyDeleteId, setBusyDeleteId] = useState(null);
    const [page, setPage] = useState(1);
    const [viewRow, setViewRow] = useState(null);
    const [editRow, setEditRow] = useState(null);
    const [savingEdit, setSavingEdit] = useState(false);

    const defaultFilters = {
        status: '',
        gender: '',
        specialization: '',
        experience: '',
        qualification: '',
        search: '',
    };
    const [draftFilters, setDraftFilters] = useState(defaultFilters);
    const [appliedFilters, setAppliedFilters] = useState(defaultFilters);

    const loadTeachers = async () => {
        setLoading(true);
        try {
            const res = await api.get('teachers/');
            setTeachers(res.data || []);
        } catch {
            setTeachers([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTeachers();
    }, []);

    const teachersWithMeta = useMemo(() => (
        (teachers || []).map((t) => ({
            ...t,
            experienceLabel: yearsBucket(t.experience_years),
            statusLabel: t.status || 'Active',
            genderLabel: t.gender || 'Unknown',
            specializationLabel: t.subject_specialization || 'N/A',
            qualificationLabel: t.qualification || 'N/A',
        }))
    ), [teachers]);

    const options = useMemo(() => {
        const uniq = (arr) => [...new Set(arr.filter(Boolean))];
        return {
            status: uniq(teachersWithMeta.map((t) => t.statusLabel)),
            gender: uniq(teachersWithMeta.map((t) => t.genderLabel)),
            specialization: uniq(teachersWithMeta.map((t) => t.specializationLabel)),
            experience: ['0-1', '2-3', '4-5', '6+', 'Unknown'],
            qualification: uniq(teachersWithMeta.map((t) => t.qualificationLabel)),
        };
    }, [teachersWithMeta]);

    const filtered = useMemo(() => {
        const q = (appliedFilters.search || '').trim().toLowerCase();
        return teachersWithMeta.filter((t) => {
            if (appliedFilters.status && t.statusLabel !== appliedFilters.status) return false;
            if (appliedFilters.gender && t.genderLabel !== appliedFilters.gender) return false;
            if (appliedFilters.specialization && t.specializationLabel !== appliedFilters.specialization) return false;
            if (appliedFilters.experience && t.experienceLabel !== appliedFilters.experience) return false;
            if (appliedFilters.qualification && t.qualificationLabel !== appliedFilters.qualification) return false;
            if (q) {
                const haystack = [
                    t.employee_id, t.name, t.email, t.phone_number, t.subject_specialization, t.qualification,
                ].join(' ').toLowerCase();
                if (!haystack.includes(q)) return false;
            }
            return true;
        });
    }, [teachersWithMeta, appliedFilters]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const pagedRows = filtered.slice(start, start + PAGE_SIZE);

    const pageNumbers = useMemo(() => {
        const nums = [];
        for (let i = 1; i <= totalPages; i += 1) nums.push(i);
        return nums;
    }, [totalPages]);

    const applySearch = () => {
        setAppliedFilters(draftFilters);
        setPage(1);
    };

    const clearAll = () => {
        setDraftFilters(defaultFilters);
        setAppliedFilters(defaultFilters);
        setPage(1);
    };

    const downloadCsv = () => {
        const rows = filtered || [];
        if (!rows.length) {
            window.alert('No teacher data to download.');
            return;
        }
        const headers = [
            'Employee ID',
            'Teacher Name',
            'Specialization',
            'Email',
            'Phone',
            'Gender',
            'DOB',
            'Qualification',
            'Experience',
            'Joining Date',
            'Status',
        ];
        const lines = [headers.map(csvValue).join(',')];
        rows.forEach((t) => {
            lines.push(
                [
                    t.employee_id || '',
                    t.name || '',
                    t.specializationLabel || '',
                    t.email || '',
                    t.phone_number || '',
                    t.genderLabel || '',
                    formatDate(t.dob),
                    t.qualificationLabel || '',
                    t.experience_years ?? '',
                    formatDate(t.joining_date),
                    t.statusLabel || '',
                ].map(csvValue).join(',')
            );
        });
        const csv = '\ufeff' + lines.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const stamp = new Date().toISOString().slice(0, 10);
        const a = document.createElement('a');
        a.href = url;
        a.download = `teachers-${stamp}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    const handleDelete = async (row) => {
        const ok = await confirm(`Delete teacher "${row?.name}"?`);
        if (!ok) return;
        setBusyDeleteId(row.id);
        try {
            await api.delete(`teachers/delete/${row.id}/`);
            await loadTeachers();
        } catch (e) {
            window.alert(e?.response?.data?.error || 'Failed to delete teacher.');
        } finally {
            setBusyDeleteId(null);
        }
    };

    const saveEdit = async (e) => {
        e.preventDefault();
        if (!editRow) return;
        setSavingEdit(true);
        try {
            await api.patch(`teachers/update/${editRow.id}/`, {
                email: editRow.email || '',
                name: editRow.name || '',
                employee_id: editRow.employee_id || '',
                subject_specialization: editRow.subject_specialization || '',
                phone_number: editRow.phone_number || '',
                gender: editRow.gender || '',
                dob: editRow.dob || null,
                qualification: editRow.qualification || '',
                experience_years: editRow.experience_years === '' ? null : editRow.experience_years,
                joining_date: editRow.joining_date || null,
                role: editRow.role || 'Subject Teacher',
                status: editRow.status || 'Active',
            });
            setEditRow(null);
            await loadTeachers();
        } catch (e2) {
            window.alert(e2?.response?.data?.error || 'Failed to update teacher.');
        } finally {
            setSavingEdit(false);
        }
    };

    const shellCard = {
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 18,
        boxShadow: '0 8px 20px rgba(15, 23, 42, 0.06)',
        padding: 20,
    };

    const th = {
        textAlign: 'left',
        fontSize: 13,
        fontWeight: 800,
        color: '#475569',
        padding: '13px 12px',
        whiteSpace: 'nowrap',
        background: '#f1f5f9',
    };

    const td = {
        fontSize: 14,
        color: '#0f172a',
        padding: '13px 12px',
        borderTop: '1px solid #e2e8f0',
        whiteSpace: 'nowrap',
    };

    const selectStyle = {
        minWidth: 140,
        padding: '11px 13px',
        border: '1px solid #d1d5db',
        borderRadius: 10,
        fontSize: 14,
        backgroundColor: '#fff',
    };

    return (
        <div style={{ padding: 24, background: '#f1f5f9', minHeight: '100%' }}>
            <div style={shellCard}>
                <h1 style={{ margin: 0, fontSize: 30, color: '#0f172a' }}>Teacher Management</h1>

                <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {[
                        ['status', 'Status', options.status],
                        ['gender', 'Gender', options.gender],
                        ['specialization', 'Specialization', options.specialization],
                        ['experience', 'Experience', options.experience],
                        ['qualification', 'Qualification', options.qualification],
                    ].map(([key, label, opts]) => (
                        <select
                            key={key}
                            value={draftFilters[key]}
                            onChange={(e) => setDraftFilters((p) => ({ ...p, [key]: e.target.value }))}
                            style={selectStyle}
                        >
                            <option value="">{label}</option>
                            {(opts || []).map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                    ))}

                    <button
                        type="button"
                        onClick={applySearch}
                        style={{ ...selectStyle, minWidth: 100, background: '#1d4ed8', color: '#fff', cursor: 'pointer', fontWeight: 700 }}
                    >
                        Search
                    </button>
                    <button
                        type="button"
                        onClick={clearAll}
                        style={{ ...selectStyle, minWidth: 100, background: '#fff', color: '#475569', cursor: 'pointer', fontWeight: 700 }}
                    >
                        Clear All
                    </button>
                    <button
                        type="button"
                        onClick={downloadCsv}
                        style={{ ...selectStyle, minWidth: 130, background: '#ecfdf5', color: '#166534', borderColor: '#86efac', cursor: 'pointer', fontWeight: 700 }}
                    >
                        Download CSV
                    </button>
                </div>

                <div style={{ marginTop: 14, position: 'relative', maxWidth: 420 }}>
                    <span style={{ position: 'absolute', left: 12, top: 10, color: '#94a3b8' }}>🔍</span>
                    <input
                        value={draftFilters.search}
                        onChange={(e) => setDraftFilters((p) => ({ ...p, search: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') applySearch(); }}
                        placeholder="Search teacher..."
                        style={{
                            width: '100%',
                            padding: '10px 12px 10px 34px',
                            border: '1px solid #d1d5db',
                            borderRadius: 10,
                            background: '#fff',
                            fontSize: 14,
                        }}
                    />
                </div>
            </div>

            <div style={{ ...shellCard, marginTop: 14, padding: 0, overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: 18, color: '#64748b' }}>Loading teachers...</div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 1420 }}>
                        <thead>
                                <tr>
                                    <th style={th}>S.No</th>
                                    <th style={th}>Employee ID</th>
                                    <th style={th}>Teacher Name</th>
                                    <th style={th}>Specialization</th>
                                    <th style={th}>Email</th>
                                    <th style={th}>Phone</th>
                                    <th style={th}>Gender</th>
                                    <th style={th}>DOB</th>
                                    <th style={th}>Qualification</th>
                                    <th style={th}>Experience</th>
                                    <th style={th}>Joining Date</th>
                                    <th style={th}>Role</th>
                                    <th style={th}>Status</th>
                                    <th style={th}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                                {pagedRows.length === 0 ? (
                                    <tr><td colSpan={13} style={{ ...td, textAlign: 'center', padding: 20 }}>No teachers found.</td></tr>
                                ) : pagedRows.map((t, idx) => (
                                    <tr key={t.id} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                        <td style={td}>{start + idx + 1}</td>
                                        <td style={td}>{t.employee_id || '—'}</td>
                                        <td style={{ ...td, fontWeight: 700 }}>{t.name || '—'}</td>
                                        <td style={td}>{t.specializationLabel}</td>
                                        <td style={td}>{t.email || '—'}</td>
                                        <td style={td}>{t.phone_number || '—'}</td>
                                        <td style={td}>{t.genderLabel}</td>
                                        <td style={td}>{formatDate(t.dob)}</td>
                                        <td style={td}>{t.qualificationLabel}</td>
                                        <td style={td}>{t.experience_years ?? '—'}</td>
                                        <td style={td}>{formatDate(t.joining_date)}</td>
                                        <td style={td}>
                                            <span 
                                                style={{ 
                                                    padding: '4px 8px', 
                                                    borderRadius: 6, 
                                                    fontSize: 12, 
                                                    fontWeight: 700,
                                                    backgroundColor: t.role === 'Class Teacher' ? '#eff6ff' : '#f8fafc',
                                                    color: t.role === 'Class Teacher' ? '#1d4ed8' : '#64748b',
                                                    border: `1px solid ${t.role === 'Class Teacher' ? '#bfdbfe' : '#e2e8f0'}`
                                                }}
                                            >
                                                {t.role || 'Subject Teacher'}
                                            </span>
                                        </td>
                                        <td style={td}>
                                            <span
                                                style={{
                                                    padding: '4px 10px',
                                                    borderRadius: 999,
                                                    fontWeight: 700,
                                                    fontSize: 11,
                                                    color: String(t.statusLabel).toLowerCase() === 'active' ? '#166534' : '#991b1b',
                                                    backgroundColor: String(t.statusLabel).toLowerCase() === 'active' ? '#dcfce7' : '#fee2e2',
                                                    border: `1px solid ${String(t.statusLabel).toLowerCase() === 'active' ? '#86efac' : '#fecaca'}`,
                                                }}
                                            >
                                                {t.statusLabel}
                                            </span>
                                        </td>
                                        <td style={td}>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <button type="button" title="View" onClick={() => setViewRow(t)} style={{ border: '1px solid #dbeafe', background: '#eff6ff', borderRadius: 8, cursor: 'pointer', padding: '6px 9px' }}>👁️</button>
                                                <button type="button" title="Edit" onClick={() => setEditRow({ ...t })} style={{ border: '1px solid #d1fae5', background: '#ecfdf5', borderRadius: 8, cursor: 'pointer', padding: '6px 9px' }}>✏️</button>
                                                <button type="button" title="Delete" disabled={busyDeleteId === t.id} onClick={() => handleDelete(t)} style={{ border: '1px solid #fecaca', background: '#fff1f2', borderRadius: 8, cursor: 'pointer', padding: '6px 9px', opacity: busyDeleteId === t.id ? 0.6 : 1 }}>🗑️</button>
                                            </div>
                                        </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderTop: '1px solid #e2e8f0', background: '#fff' }}>
                    <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ ...selectStyle, minWidth: 95, cursor: 'pointer', opacity: currentPage === 1 ? 0.5 : 1 }}>Previous</button>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                        {pageNumbers.map((n) => (
                            <button
                                key={n}
                                type="button"
                                onClick={() => setPage(n)}
                                style={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: 8,
                                    border: n === currentPage ? '1px solid #2563eb' : '1px solid #d1d5db',
                                    background: n === currentPage ? '#2563eb' : '#fff',
                                    color: n === currentPage ? '#fff' : '#334155',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                }}
                            >
                                {n}
                            </button>
                        ))}
                    </div>
                    <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ ...selectStyle, minWidth: 95, cursor: 'pointer', opacity: currentPage === totalPages ? 0.5 : 1 }}>Next</button>
                </div>
            </div>

            {viewRow && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }}>
                    <div style={{ width: '100%', maxWidth: 560, borderRadius: 16, background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 16px 40px rgba(2,6,23,0.2)', padding: 18 }}>
                        <h3 style={{ marginTop: 0, marginBottom: 12 }}>Teacher Details</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
                            <div><b>Name:</b> {viewRow.name || '—'}</div>
                            <div><b>Employee ID:</b> {viewRow.employee_id || '—'}</div>
                            <div><b>Email:</b> {viewRow.email || '—'}</div>
                            <div><b>Phone:</b> {viewRow.phone_number || '—'}</div>
                            <div><b>Specialization:</b> {viewRow.specializationLabel}</div>
                            <div><b>Qualification:</b> {viewRow.qualificationLabel}</div>
                            <div><b>Experience:</b> {viewRow.experience_years ?? '—'}</div>
                            <div><b>Role:</b> {viewRow.role || 'Subject Teacher'}</div>
                            <div><b>Status:</b> {viewRow.statusLabel}</div>
                        </div>
                        <div style={{ marginTop: 16, textAlign: 'right' }}>
                            <button type="button" onClick={() => setViewRow(null)} style={{ ...selectStyle, minWidth: 90, cursor: 'pointer' }}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {editRow && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 55 }}>
                    <form onSubmit={saveEdit} style={{ width: '100%', maxWidth: 760, borderRadius: 16, background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 16px 40px rgba(2,6,23,0.2)', padding: 18 }}>
                        <h3 style={{ marginTop: 0, marginBottom: 12 }}>Edit Teacher</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <input value={editRow.name || ''} onChange={(e) => setEditRow((p) => ({ ...p, name: e.target.value }))} placeholder="Full name" style={selectStyle} />
                            <input value={editRow.employee_id || ''} onChange={(e) => setEditRow((p) => ({ ...p, employee_id: e.target.value }))} placeholder="Employee ID" style={selectStyle} />
                            <input value={editRow.email || ''} onChange={(e) => setEditRow((p) => ({ ...p, email: e.target.value }))} placeholder="Email" style={selectStyle} />
                            <input value={editRow.phone_number || ''} onChange={(e) => setEditRow((p) => ({ ...p, phone_number: e.target.value }))} placeholder="Phone number" style={selectStyle} />
                            <input value={editRow.subject_specialization || ''} onChange={(e) => setEditRow((p) => ({ ...p, subject_specialization: e.target.value }))} placeholder="Specialization" style={selectStyle} />
                            <input value={editRow.qualification || ''} onChange={(e) => setEditRow((p) => ({ ...p, qualification: e.target.value }))} placeholder="Qualification" style={selectStyle} />
                            <input type="number" min="0" value={editRow.experience_years ?? ''} onChange={(e) => setEditRow((p) => ({ ...p, experience_years: e.target.value }))} placeholder="Experience years" style={selectStyle} />
                            <input type="date" value={editRow.joining_date || ''} onChange={(e) => setEditRow((p) => ({ ...p, joining_date: e.target.value }))} style={selectStyle} />
                            <input type="date" value={editRow.dob || ''} onChange={(e) => setEditRow((p) => ({ ...p, dob: e.target.value }))} style={selectStyle} />
                            <select value={editRow.gender || ''} onChange={(e) => setEditRow((p) => ({ ...p, gender: e.target.value }))} style={selectStyle}>
                                <option value="">Gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                            <select value={editRow.status || 'Active'} onChange={(e) => setEditRow((p) => ({ ...p, status: e.target.value }))} style={selectStyle}>
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                            <select value={editRow.role || 'Subject Teacher'} onChange={(e) => setEditRow((p) => ({ ...p, role: e.target.value }))} style={selectStyle}>
                                <option value="Subject Teacher">Subject Teacher</option>
                                <option value="Class Teacher">Class Teacher</option>
                            </select>
                        </div>
                        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                            <button type="button" onClick={() => setEditRow(null)} style={{ ...selectStyle, minWidth: 90, cursor: 'pointer' }}>Cancel</button>
                            <button type="submit" disabled={savingEdit} style={{ ...selectStyle, minWidth: 90, cursor: 'pointer', background: '#1d4ed8', color: '#fff', borderColor: '#1d4ed8', opacity: savingEdit ? 0.7 : 1 }}>{savingEdit ? 'Saving...' : 'Save'}</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default ManageTeachers;
