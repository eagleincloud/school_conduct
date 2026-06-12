import React, { useEffect, useMemo, useState } from 'react';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import { useConfirm } from '../../context/ConfirmContext';
import api from '../../services/api';

const AssignTeacher = () => {
    const confirm = useConfirm();
    const [classes, setClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [sections, setSections] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [allSections, setAllSections] = useState([]); // Added for filtering

    const [classFilter, setClassFilter] = useState('all');
    const [sectionFilter, setSectionFilter] = useState('all'); // Added for granular filtering
    const [teacherFilter, setTeacherFilter] = useState('all');
    const [teacherSearch, setTeacherSearch] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        class_id: '',
        section_id: '',
        subject_id: '',
        teacher_id: '',
        role: 'Subject Teacher',
    });
    const [editingId, setEditingId] = useState(null);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const inputStyle = {
        width: '100%',
        padding: '10px 12px',
        border: '1px solid #e5e7eb',
        borderRadius: '10px',
        fontSize: '14px',
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

    const fetchMeta = async () => {
        const [classRes, teacherRes, sectionsRes] = await Promise.all([
            api.get('classes/main-classes/'),
            api.get('teachers/'),
            api.get('classes/admin-sections/'),
        ]);
        setClasses(classRes.data || []);
        setTeachers(teacherRes.data || []);
        setAllSections(sectionsRes.data || []);
    };

    const fetchAssignments = async () => {
        setLoading(true);
        try {
            const params = {};
            if (classFilter !== 'all') params.class_id = classFilter;
            const res = await api.get('subjects/teacher-assignments/', { params });
            setAssignments(res.data || []);
        } catch (err) {
            setAssignments([]);
        } finally {
            setLoading(false);
        }
    };

    const filteredAssignments = useMemo(() => {
        let list = [...assignments];
        if (sectionFilter !== 'all') {
            list = list.filter(a => String(a.section) === String(sectionFilter));
        }
        if (teacherFilter !== 'all') {
            list = list.filter(a => String(a.teacher) === String(teacherFilter));
        }
        return list;
    }, [assignments, sectionFilter, teacherFilter]);

    const fetchSectionsForForm = async (classId) => {
        if (!classId) {
            setSections([]);
            return;
        }
        try {
            const res = await api.get('classes/admin-sections/', { params: { class_id: classId } });
            setSections(res.data || []);
        } catch (err) {
            setSections([]);
        }
    };

    const fetchSubjectsForForm = async (classId) => {
        if (!classId) {
            setSubjects([]);
            return;
        }
        try {
            const res = await api.get('subjects/', { params: { class_id: classId, status: 'Active' } });
            setSubjects(res.data || []);
        } catch (err) {
            setSubjects([]);
        }
    };

    useEffect(() => {
        fetchMeta();
    }, []);

    useEffect(() => {
        fetchAssignments();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [classFilter]);

    useEffect(() => {
        if (formData.class_id) {
            fetchSubjectsForForm(formData.class_id);
            fetchSectionsForForm(formData.class_id);
        } else {
            setSubjects([]);
            setSections([]);
        }
    }, [formData.class_id]);

    const filteredTeachers = useMemo(() => {
        const q = teacherSearch.trim().toLowerCase();
        let list = [...teachers];
        
        if (q) {
            list = list.filter((t) => {
                const name = (t.name || '').toLowerCase();
                const emp = (t.employee_id || '').toLowerCase();
                const spec = (t.subject_specialization || '').toLowerCase();
                return name.includes(q) || emp.includes(q) || spec.includes(q);
            });
        }

        if (formData.subject_id) {
            const selectedSubject = subjects.find(s => String(s.id) === String(formData.subject_id));
            if (selectedSubject) {
                const subName = selectedSubject.name.toLowerCase();
                list.sort((a, b) => {
                    const aMatch = (a.subject_specialization || '').toLowerCase().includes(subName);
                    const bMatch = (b.subject_specialization || '').toLowerCase().includes(subName);
                    if (aMatch && !bMatch) return -1;
                    if (!aMatch && bMatch) return 1;
                    return 0;
                });
            }
        }

        return list;
    }, [teachers, teacherSearch, formData.subject_id, subjects]);

    const resetForm = () => {
        setFormData({ class_id: '', section_id: '', subject_id: '', teacher_id: '', role: 'Subject Teacher' });
        setEditingId(null);
        setTeacherSearch('');
        setIsModalOpen(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');

        if (!formData.class_id || !formData.subject_id || !formData.teacher_id) {
            setMessage('Error: Class, Subject and Teacher are required.');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                class_id: Number(formData.class_id),
                section: formData.section_id ? Number(formData.section_id) : null,
                subject_id: Number(formData.subject_id),
                teacher_id: Number(formData.teacher_id),
                role: formData.role,
            };

            if (editingId) {
                await api.patch(`subjects/teacher-assignments/${editingId}/`, payload);
                setMessage('Assignment updated successfully.');
            } else {
                await api.post('subjects/teacher-assignments/', payload);
                setMessage('Teacher assigned successfully.');
            }
            await fetchAssignments();
            resetForm();
        } catch (err) {
            setMessage(`Error: ${err?.response?.data?.error || 'Unable to save assignment.'}`);
        } finally {
            setSaving(false);
        }
    };

    const startEdit = async (row) => {
        setEditingId(row.id);
        setFormData({
            class_id: String(row.class_ref),
            section_id: row.section ? String(row.section) : '',
            subject_id: String(row.subject),
            teacher_id: String(row.teacher),
            role: row.role || 'Subject Teacher',
        });
        setTeacherSearch(`${row.teacher_name || ''}`.trim());
        await Promise.all([
            fetchSubjectsForForm(row.class_ref),
            fetchSectionsForForm(row.class_ref)
        ]);
        setIsModalOpen(true);
    };

    const deleteAssignment = async (id) => {
        const ok = await confirm('Delete this assignment?');
        if (!ok) return;
        try {
            await api.delete(`subjects/teacher-assignments/${id}/`);
            setMessage('Assignment deleted successfully.');
            await fetchAssignments();
        } catch (err) {
            setMessage(`Error: ${err?.response?.data?.error || 'Unable to delete assignment.'}`);
        }
    };

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 1000, color: '#0f172a' }}>Teacher Assignments</h1>
                    <div style={{ color: '#6b7280', marginTop: '6px', fontSize: '13px', fontWeight: 700 }}>
                        Manage which teachers are responsible for which subjects and classes.
                    </div>
                </div>
                <button
                    onClick={() => { resetForm(); setIsModalOpen(true); }}
                    style={{
                        padding: '12px 20px',
                        borderRadius: '12px',
                        border: 'none',
                        backgroundColor: '#2563eb',
                        color: '#fff',
                        fontWeight: 900,
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
                        transition: 'all 0.2s'
                    }}
                >
                    + Add New Assignment
                </button>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ minWidth: '220px' }}>
                    <div style={labelStyle}>Filter by Class & Section</div>
                    <select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)} style={inputStyle}>
                        <option value="all">All Classes & Sections</option>
                        {allSections.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.class_name} - {s.section_name}
                            </option>
                        ))}
                    </select>
                </div>
                <div style={{ minWidth: '220px' }}>
                    <div style={labelStyle}>Filter by Teacher</div>
                    <select value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)} style={inputStyle}>
                        <option value="all">All Teachers</option>
                        {teachers.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.name} ({t.employee_id})
                            </option>
                        ))}
                    </select>
                </div>
                <button
                    onClick={() => { setClassFilter('all'); setSectionFilter('all'); setTeacherFilter('all'); }}
                    style={{
                        padding: '10px 16px',
                        borderRadius: '10px',
                        border: '1px solid #e5e7eb',
                        backgroundColor: '#fff',
                        color: '#374151',
                        fontWeight: 700,
                        cursor: 'pointer',
                        height: '42px'
                    }}
                >
                    Reset Filters
                </button>
            </div>

            {message && (
                <div style={{ 
                    marginTop: '20px', 
                    padding: '12px 16px', 
                    borderRadius: '10px', 
                    backgroundColor: message.startsWith('Error:') ? '#fef2f2' : '#f0fdf4',
                    color: message.startsWith('Error:') ? '#991b1b' : '#166534',
                    border: `1px solid ${message.startsWith('Error:') ? '#fecaca' : '#bbf7d0'}`,
                    fontWeight: 700,
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    maxWidth: 'fit-content'
                }}>
                    {message.startsWith('Error:') ? (
                        <TriangleAlert size={16} strokeWidth={2.4} />
                    ) : (
                        <CircleCheck size={16} strokeWidth={2.4} />
                    )}
                    {message}
                </div>
            )}

            <div style={{ marginTop: '20px', backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <table style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                                <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', color: '#64748b' }}>Class & Section</th>
                                <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', color: '#64748b' }}>Subject</th>
                                <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', color: '#64748b' }}>Teacher</th>
                                <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', color: '#64748b' }}>Role</th>
                                <th style={{ padding: '16px 20px', textAlign: 'right', fontSize: '13px', color: '#64748b' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading assignments...</td></tr>
                            ) : filteredAssignments.length === 0 ? (
                                <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No assignments found for the selected filters.</td></tr>
                            ) : (
                                filteredAssignments.map((row) => (
                                    <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ fontWeight: 800, color: '#1e293b' }}>{row.class_name}</div>
                                            <div style={{ fontSize: '12px', color: '#64748b' }}>{row.section_name || 'All Sections'}</div>
                                        </td>
                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ fontWeight: 700, color: '#334155' }}>{row.subject_name}</div>
                                        </td>
                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ fontWeight: 700, color: '#334155' }}>{row.teacher_name}</div>
                                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>ID: {row.employee_id}</div>
                                        </td>
                                        <td style={{ padding: '16px 20px' }}>
                                            <span style={{ 
                                                padding: '4px 10px', 
                                                borderRadius: '8px', 
                                                fontSize: '11px',
                                                fontWeight: 800,
                                                backgroundColor: row.role === 'Class Teacher' ? '#dcfce7' : '#f1f5f9',
                                                color: row.role === 'Class Teacher' ? '#166534' : '#475569',
                                                textTransform: 'uppercase'
                                            }}>
                                                {row.role}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                <button
                                                    onClick={() => startEdit(row)}
                                                    style={{ border: 'none', background: '#eff6ff', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', color: '#2563eb', fontWeight: 700 }}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => deleteAssignment(row.id)}
                                                    style={{ border: 'none', background: '#fef2f2', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', color: '#ef4444', fontWeight: 700 }}
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

            {isModalOpen && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '12px', overflowY: 'auto' }}>
                    <div style={{ backgroundColor: '#fff', borderRadius: '20px', width: 'min(600px, 100%)', maxHeight: 'calc(100dvh - 24px)', overflowY: 'auto', padding: 'clamp(16px, 4vw, 24px)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>{editingId ? 'Edit Assignment' : 'New Teacher Assignment'}</h2>
                            <button onClick={resetForm} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#94a3b8' }}>×</button>
                        </div>
                        
                        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '16px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '12px' }}>
                                <div>
                                    <div style={labelStyle}>Class</div>
                                    <select
                                        value={formData.class_id}
                                        onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                                        style={inputStyle}
                                        required
                                    >
                                        <option value="">-- Select --</option>
                                        {classes.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                                    </select>
                                </div>
                                <div>
                                    <div style={labelStyle}>Section</div>
                                    <select
                                        value={formData.section_id}
                                        onChange={(e) => setFormData({ ...formData, section_id: e.target.value })}
                                        style={inputStyle}
                                        disabled={!formData.class_id}
                                    >
                                        <option value="">-- All Sections --</option>
                                        {sections.map((s) => (<option key={s.id} value={s.id}>{s.section_name}</option>))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <div style={labelStyle}>Subject</div>
                                <select
                                    value={formData.subject_id}
                                    onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
                                    style={inputStyle}
                                    required
                                    disabled={!formData.class_id}
                                >
                                    <option value="">{formData.class_id ? '-- Select Subject --' : 'Select class first'}</option>
                                    {subjects.map((s) => (<option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>))}
                                </select>
                            </div>

                            <div>
                                <div style={labelStyle}>Teacher Search</div>
                                <input
                                    type="text"
                                    placeholder="Search by name, ID or specialization..."
                                    value={teacherSearch}
                                    onChange={(e) => setTeacherSearch(e.target.value)}
                                    style={{ ...inputStyle, marginBottom: '8px' }}
                                />
                                <div style={labelStyle}>Select Teacher</div>
                                <select
                                    value={formData.teacher_id}
                                    onChange={(e) => setFormData({ ...formData, teacher_id: e.target.value })}
                                    style={inputStyle}
                                    required
                                >
                                    <option value="">-- Select Teacher --</option>
                                    {filteredTeachers.map((t) => {
                                        const selectedSubject = subjects.find(s => String(s.id) === String(formData.subject_id));
                                        const isSpecialized = selectedSubject && (t.subject_specialization || '').toLowerCase().includes(selectedSubject.name.toLowerCase());
                                        return (
                                            <option key={t.id} value={t.id} style={{ fontWeight: isSpecialized ? 800 : 400 }}>
                                                {t.name} ({t.employee_id}) {isSpecialized ? '★' : ''}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            <div>
                                <div style={labelStyle}>Assignment Role</div>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    style={inputStyle}
                                    required
                                >
                                    <option value="Subject Teacher">Subject Teacher</option>
                                    <option value="Class Teacher">Class Teacher</option>
                                </select>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', backgroundColor: '#2563eb', color: '#fff', fontWeight: 900, cursor: 'pointer' }}
                                >
                                    {saving ? 'Saving...' : editingId ? 'Update Assignment' : 'Create Assignment'}
                                </button>
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #e5e7eb', backgroundColor: '#fff', color: '#374151', fontWeight: 700, cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssignTeacher;
