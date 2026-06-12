import React, { useEffect, useMemo, useState } from 'react';
import { useConfirm } from '../../context/ConfirmContext';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const getInitials = (name) => {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'S';
    const a = parts[0]?.[0] || '';
    const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : '';
    return `${a}${b}`.toUpperCase() || 'S';
};

const AdminSubjects = () => {
    const confirm = useConfirm();
    const navigate = useNavigate();

    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(false);

    const [classOptions, setClassOptions] = useState([]);
    const [teacherOptions, setTeacherOptions] = useState([]);

    const [classFilter, setClassFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [search, setSearch] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSubject, setEditingSubject] = useState(null);
    const [form, setForm] = useState({
        name: '',
        code: '',
        class_id: '',
        description: '',
        status: 'Active',
    });

    const inputStyle = {
        width: '100%',
        padding: '10px 12px',
        border: '1px solid #e5e7eb',
        borderRadius: '10px',
        fontSize: '13px',
        outline: 'none',
        boxSizing: 'border-box',
        backgroundColor: '#fff',
    };

    const labelStyle = {
        fontSize: '12px',
        color: '#6b7280',
        fontWeight: 700,
        marginBottom: '6px',
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
    };

    const openCreate = () => {
        setEditingSubject(null);
        setForm({
            name: '',
            code: '',
            class_id: classOptions[0]?.id || '',
            description: '',
            status: 'Active',
        });
        setIsModalOpen(true);
    };

    const openEdit = (s) => {
        setEditingSubject(s);
        setForm({
            name: s.name || '',
            code: s.code || '',
            class_id: s.class_ref?.id ? s.class_ref.id : s.class_ref || '',
            description: s.description || '',
            status: s.status || 'Active',
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingSubject(null);
    };

    const fetchMeta = async () => {
        const [classesRes, teachersRes] = await Promise.all([api.get('classes/main-classes/'), api.get('teachers/')]);
        setClassOptions(classesRes.data || []);
        setTeacherOptions(teachersRes.data || []);
    };

    const fetchSubjects = async () => {
        setLoading(true);
        try {
            const params = {};
            if (classFilter !== 'all') params.class_id = classFilter;
            if (statusFilter !== 'all') params.status = statusFilter;
            if (search.trim()) params.search = search.trim();

            const res = await api.get('subjects/', { params });
            setSubjects(res.data || []);
        } catch (e) {
            alert('Error fetching subjects');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMeta();
    }, []);

    useEffect(() => {
        fetchSubjects();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [classFilter, statusFilter, search]);

    const grouped = useMemo(() => {
        const map = new Map();
        subjects.forEach((s) => {
            const className = s.class_name || 'Unknown Class';
            if (!map.has(className)) map.set(className, []);
            map.get(className).push(s);
        });
        return Array.from(map.entries()).map(([className, items]) => ({
            className,
            items,
        }));
    }, [subjects]);

    const saveSubject = async (e) => {
        e.preventDefault();
        const payload = {
            name: form.name,
            code: form.code || null,
            class_id: form.class_id,
            description: form.description || null,
            status: form.status,
        };

        if (!payload.name || !payload.class_id) {
            alert('Subject name and Class are required');
            return;
        }

        try {
            if (editingSubject) {
                await api.patch(`subjects/${editingSubject.id}/`, payload);
            } else {
                await api.post('subjects/create/', payload);
            }
            await fetchSubjects();
            closeModal();
        } catch (err) {
            alert(err?.response?.data?.error || 'Error saving subject');
        }
    };

    const deleteSubject = async (subjectId) => {
        const ok = await confirm('Delete this subject?');
        if (!ok) return;
        try {
            await api.delete(`subjects/${subjectId}/`);
            await fetchSubjects();
        } catch (e) {
            alert('Error deleting subject');
        }
    };

    const subjectTable = (items) => {
        return (
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table style={{ width: '100%', minWidth: '620px', borderCollapse: 'collapse', backgroundColor: '#fff' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f2f4f7' }}>
                            <th style={{ padding: '12px 10px', textAlign: 'left' }}>Subject</th>
                            <th style={{ padding: '12px 10px', textAlign: 'left' }}>Code</th>
                            <th style={{ padding: '12px 10px', textAlign: 'left' }}>Status</th>
                            <th style={{ padding: '12px 10px', textAlign: 'left' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((s) => {
                            return (
                                <tr key={s.id} style={{ borderTop: '1px solid #eef2f7' }}>
                                    <td style={{ padding: '12px 10px', fontWeight: 800 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div
                                                style={{
                                                    width: '34px',
                                                    height: '34px',
                                                    borderRadius: '10px',
                                                    backgroundColor: '#2563eb',
                                                    color: '#fff',
                                                    fontWeight: 900,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}
                                            >
                                                {getInitials(s.name)}
                                            </div>
                                            <div>
                                                <div>{s.name}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px 10px' }}>{s.code || '-'}</td>
                                    <td style={{ padding: '12px 10px' }}>
                                        <span
                                            style={{
                                                display: 'inline-block',
                                                padding: '6px 10px',
                                                borderRadius: '999px',
                                                fontSize: '12px',
                                                fontWeight: 800,
                                                backgroundColor: s.status === 'Active' ? '#dcfce7' : '#fee2e2',
                                                color: s.status === 'Active' ? '#166534' : '#991b1b',
                                            }}
                                        >
                                            {s.status}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px 10px' }}>
                                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                            <button
                                                type="button"
                                                onClick={() => navigate(`/admin/subjects/${s.id}`)}
                                                style={{
                                                    padding: '8px 16px',
                                                    borderRadius: '8px',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    backgroundColor: '#f5f3ff',
                                                    color: '#6d28d9',
                                                    fontWeight: 800,
                                                }}
                                            >
                                                View
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => openEdit(s)}
                                                style={{
                                                    padding: '8px 16px',
                                                    borderRadius: '8px',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    backgroundColor: '#ecfdf5',
                                                    color: '#16a34a',
                                                    fontWeight: 800,
                                                }}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => deleteSubject(s.id)}
                                                style={{
                                                    padding: '8px 16px',
                                                    borderRadius: '8px',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    backgroundColor: '#fef2f2',
                                                    color: '#ef4444',
                                                    fontWeight: 800,
                                                }}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {items.length === 0 && (
                            <tr>
                                <td style={{ padding: '16px 10px', color: '#6b7280' }} colSpan={4}>
                                    No subjects found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 1000, color: '#0f172a' }}>Subjects</h1>
                    <div style={{ color: '#6b7280', fontSize: '13px', marginTop: '6px' }}>
                        Manage subjects class-wise for each academic grade.
                    </div>
                </div>

                <button
                    type="button"
                    onClick={openCreate}
                    style={{
                        padding: '10px 14px',
                        borderRadius: '12px',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: '#2563eb',
                        color: '#fff',
                        fontWeight: 900,
                        height: '40px',
                        whiteSpace: 'nowrap',
                    }}
                >
                    + Add Subject
                </button>
            </div>

            <div style={{ marginTop: '18px', display: 'grid', gridTemplateColumns: '1fr 220px 220px 1fr', gap: '12px' }}>
                <div>
                    <div style={labelStyle}>Search</div>
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Maths, Science..." style={inputStyle} />
                </div>
                <div>
                    <div style={labelStyle}>Class</div>
                    <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} style={inputStyle}>
                        <option value="all">All Classes</option>
                        {classOptions.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <div style={labelStyle}>Status</div>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={inputStyle}>
                        <option value="all">All</option>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                    </select>
                </div>
                <div style={{ alignSelf: 'end' }}>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                        <button
                            type="button"
                            onClick={() => {
                                setClassFilter('all');
                                setStatusFilter('all');
                                setSearch('');
                            }}
                            style={{
                                padding: '10px 14px',
                                borderRadius: '12px',
                                border: '1px solid #e5e7eb',
                                cursor: 'pointer',
                                backgroundColor: '#fff',
                                color: '#111827',
                                fontWeight: 900,
                            }}
                        >
                            Reset
                        </button>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '18px' }}>
                {loading ? (
                    <p style={{ color: '#6b7280' }}>Loading subjects...</p>
                ) : grouped.length === 0 ? (
                    <p style={{ color: '#6b7280' }}>No subjects found.</p>
                ) : (
                    grouped.map((g) => (
                        <div key={g.className} style={{ marginBottom: '22px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <h2 style={{ margin: 0, fontSize: '18px' }}>{g.className}</h2>
                                <div style={{ color: '#6b7280', fontSize: '13px', fontWeight: 700 }}>{g.items.length} subject(s)</div>
                            </div>
                            {subjectTable(g.items)}
                        </div>
                    ))
                )}
            </div>

            {isModalOpen && (
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
                            width: 'min(840px, 100%)',
                            backgroundColor: '#fff',
                            borderRadius: '16px',
                            padding: 'clamp(14px, 4vw, 18px)',
                            border: '1px solid #e5e7eb',
                            maxHeight: 'calc(100dvh - 24px)',
                            overflowY: 'auto',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                            <h3 style={{ margin: 0 }}>{editingSubject ? 'Edit Subject' : 'Add Subject'}</h3>
                            <button
                                type="button"
                                onClick={closeModal}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px' }}
                            >
                                ×
                            </button>
                        </div>

                        <form onSubmit={saveSubject} style={{ marginTop: '14px', display: 'grid', gap: '14px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '12px' }}>
                                <div>
                                    <div style={labelStyle}>Subject Name *</div>
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        style={inputStyle}
                                        required
                                    />
                                </div>
                                <div>
                                    <div style={labelStyle}>Subject Code (optional)</div>
                                    <input
                                        type="text"
                                        value={form.code}
                                        onChange={(e) => setForm({ ...form, code: e.target.value })}
                                        placeholder="MTH101"
                                        style={inputStyle}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '12px' }}>
                                <div>
                                    <div style={labelStyle}>Class *</div>
                                    <select
                                        value={form.class_id}
                                        onChange={(e) => setForm({ ...form, class_id: e.target.value })}
                                        style={inputStyle}
                                        required
                                    >
                                        {classOptions.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <div style={labelStyle}>Status</div>
                                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={inputStyle}>
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>


                            <div>
                                <div style={labelStyle}>Description (optional)</div>
                                <textarea
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }}
                                    placeholder="Short description about this subject..."
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    style={{
                                        padding: '10px 14px',
                                        borderRadius: '12px',
                                        border: '1px solid #e5e7eb',
                                        cursor: 'pointer',
                                        backgroundColor: '#fff',
                                        color: '#111827',
                                        fontWeight: 900,
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    style={{
                                        padding: '10px 14px',
                                        borderRadius: '12px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        backgroundColor: '#2563eb',
                                        color: '#fff',
                                        fontWeight: 900,
                                    }}
                                >
                                    {editingSubject ? 'Save Changes' : 'Create Subject'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminSubjects;
