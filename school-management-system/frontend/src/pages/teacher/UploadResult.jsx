import React, { useEffect, useMemo, useState } from 'react';
import { useConfirm } from '../../context/ConfirmContext';
import api from '../../services/api';

/** Backend fallback helper */
function asList(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.data)) return payload.data;
    if (payload && Array.isArray(payload.results)) return payload.results;
    return [];
}

const EXAM_TYPES = [
    { value: 'unit_test', label: 'Unit Test' },
    { value: 'class_test', label: 'Class Test' },
    { value: 'mst', label: 'MST' },
    { value: 'final', label: 'Final Exam' },
];

const UploadResult = () => {
    const confirm = useConfirm();
    // UI View State
    const [view, setView] = useState('form'); // 'form' or 'list'

    // Data State
    const [exams, setExams] = useState([]);
    const [mySections, setMySections] = useState([]);
    const [students, setStudents] = useState([]);
    const [teacherSubjects, setTeacherSubjects] = useState([]);
    const [history, setHistory] = useState([]);
    
    // Form Selection state
    const [selectedSectionId, setSelectedSectionId] = useState('');
    const [examTypeFilter, setExamTypeFilter] = useState('');
    const [examId, setExamId] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [studentMarks, setStudentMarks] = useState({});
    
    // List Filtering state
    const [listSectionFilter, setListSectionFilter] = useState('');
    const [listTypeFilter, setListTypeFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Status state
    const [isPublished, setIsPublished] = useState(false);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [topError, setTopError] = useState('');

    // Load initial data: Teaching Sections & All Exams
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        (async () => {
            try {
                const [secRes, examsRes] = await Promise.all([
                    api.get('classes/teaching-sections/'),
                    api.get('academics/exams/')
                ]);
                if (cancelled) return;
                const secs = asList(secRes.data);
                setMySections(secs);
                setExams(asList(examsRes.data));
                
                if (secs.length === 1) {
                    setSelectedSectionId(String(secs[0].id));
                }
            } catch (err) {
                if (!cancelled) setTopError('Failed to load initial data.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // Load History when switching to list view
    useEffect(() => {
        if (view === 'list') {
            loadHistory();
        }
    }, [view]);

    const loadHistory = async () => {
        setLoading(true);
        try {
            const res = await api.get('academics/results/upload/');
            setHistory(asList(res.data));
        } catch (err) {
            setTopError('Failed to load upload history');
        } finally {
            setLoading(false);
        }
    };

    // Filtered History
    const filteredHistory = useMemo(() => {
        return history.filter(item => {
            const matchSection = !listSectionFilter || String(item.class_section) === String(listSectionFilter);
            const matchType = !listTypeFilter || item.exam_type === listTypeFilter;
            const matchSearch = !searchQuery || 
                item.student_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.subject_name?.toLowerCase().includes(searchQuery.toLowerCase());
            return matchSection && matchType && matchSearch;
        });
    }, [history, listSectionFilter, listTypeFilter, searchQuery]);

    // Filter exams by selected section and type (Form View)
    const availableExams = useMemo(() => {
        let filtered = exams || [];
        if (selectedSectionId) {
            filtered = filtered.filter(e => String(e.class_section) === String(selectedSectionId));
        }
        if (examTypeFilter) {
            filtered = filtered.filter(e => e.exam_type === examTypeFilter);
        }
        return filtered;
    }, [exams, selectedSectionId, examTypeFilter]);

    const selectedExam = useMemo(
        () => (exams || []).find((e) => String(e.id) === String(examId)) || null,
        [exams, examId]
    );

    // When section changes, reload subjects and students (Form View)
    useEffect(() => {
        if (!selectedSectionId) {
            setStudents([]);
            setTeacherSubjects([]);
            return;
        }
        setLoading(true);
        Promise.all([
            api.get(`students/by-class/${selectedSectionId}/`),
            api.get(`academics/class-sections/${selectedSectionId}/teacher-subjects/`)
        ]).then(([studRes, subRes]) => {
            setStudents(asList(studRes.data));
            const subs = asList(subRes.data);
            setTeacherSubjects(subs);
            if (subs.length > 0) setSelectedSubject(subs[0].name);
        }).catch(() => {
            setTopError('Failed to load class details');
        }).finally(() => setLoading(false));
    }, [selectedSectionId]);

    // Check publication status when exam is selected (Form View)
    useEffect(() => {
        if (!examId) {
            setIsPublished(false);
            return;
        }
        api.get(`academics/exams/${examId}/subject-status/`)
            .then(res => setIsPublished(!!res.data.is_published))
            .catch(() => setIsPublished(false));
    }, [examId]);

    const parseNumber = (v) => {
        if (v === '' || v === null || v === undefined) return null;
        const num = Number(v);
        return Number.isFinite(num) ? num : null;
    };

    const marksErrors = useMemo(() => {
        const errors = {};
        if (selectedStudentId) {
            const marks = parseNumber(studentMarks[selectedStudentId]);
            if (marks === null) {
                errors[selectedStudentId] = 'Marks are required';
            } else if (marks < 0) {
                errors[selectedStudentId] = 'Marks cannot be negative';
            } else {
                const examMax = parseNumber(selectedExam?.total_marks) || 100;
                if (marks > examMax) {
                    errors[selectedStudentId] = `Max marks: ${examMax}`;
                }
            }
        }
        return errors;
    }, [studentMarks, selectedStudentId, selectedExam]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isPublished) {
            alert('Results are already published and locked.');
            return;
        }
        if (!selectedSubject || !selectedStudentId || !examId) {
            setTopError('Please fill all required fields');
            return;
        }
        if (marksErrors[selectedStudentId]) {
            alert('Please fix marks errors before submitting');
            return;
        }

        const payload = {
            exam: examId,
            class_section: selectedSectionId,
            subject: selectedSubject,
            exam_type: selectedExam?.exam_type,
            max_marks: parseNumber(selectedExam?.total_marks) || 100,
            entries: [
                {
                    student: selectedStudentId,
                    marks: parseNumber(studentMarks[selectedStudentId]) || 0,
                },
            ],
        };

        setSubmitting(true);
        try {
            await api.post('academics/results/upload/', payload);
            alert('Results uploaded successfully!');
            // Optional: navigate to list or clear selection
            setStudentMarks({});
            setSelectedStudentId('');
        } catch (err) {
            setTopError(err?.response?.data?.error || 'Error uploading results');
        } finally {
            setSubmitting(false);
        }
    };

    const handlePublish = async () => {
        if (!examId) return;
        const ok = await confirm("Are you sure you want to publish these results? This will make them visible to students and lock further edits.");
        if (!ok) return;
        
        setSubmitting(true);
        try {
            await api.post(`academics/exams/${examId}/publish-results/`, { publish: true });
            setIsPublished(true);
            alert('Results published successfully!');
            if (view === 'list') loadHistory();
        } catch (err) {
            setTopError(err?.response?.data?.error || 'Failed to publish results');
        } finally {
            setSubmitting(false);
        }
    };

    const selectedStudent = useMemo(() => students.find(s => String(s.id) === String(selectedStudentId)), [students, selectedStudentId]);

    return (
        <div className="teacher-upload-page" style={{ padding: '32px', maxWidth: '1280px', margin: '0 auto', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
            <div className="teacher-upload-surface" style={{ backgroundColor: '#fff', borderRadius: '32px', padding: '40px', boxShadow: '0 25px 70px rgba(0,0,0,0.07)', border: '1px solid #f0f0f0' }}>
                
                {/* Header & Toggle */}
                <div className="teacher-upload-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', gap: '16px', flexWrap: 'wrap' }}>
                    <div>
                        <h1 style={{ fontSize: '32px', fontWeight: 900, color: '#111827', margin: 0, letterSpacing: '-0.025em' }}>Results Management</h1>
                        <p style={{ color: '#6b7280', marginTop: '12px', fontSize: '16px', fontWeight: 500 }}>
                            {view === 'form' ? 'Upload and verify student performance' : 'Monitor and track your uploaded records'}
                        </p>
                    </div>
                    
                    <div className="teacher-upload-toggle" style={{ display: 'flex', backgroundColor: '#f3f4f6', padding: '6px', borderRadius: '18px', border: '1px solid #e5e7eb' }}>
                        <button
                            onClick={() => setView('form')}
                            style={{ 
                                padding: '12px 28px', 
                                borderRadius: '14px', 
                                border: 'none', 
                                backgroundColor: view === 'form' ? '#fff' : 'transparent',
                                color: view === 'form' ? '#2563eb' : '#6b7280',
                                fontWeight: 800,
                                fontSize: '14px',
                                cursor: 'pointer',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: view === 'form' ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none'
                            }}
                        >
                            Upload Marks
                        </button>
                        <button
                            onClick={() => setView('list')}
                            style={{ 
                                padding: '12px 28px', 
                                borderRadius: '14px', 
                                border: 'none', 
                                backgroundColor: view === 'list' ? '#fff' : 'transparent',
                                color: view === 'list' ? '#2563eb' : '#6b7280',
                                fontWeight: 800,
                                fontSize: '14px',
                                cursor: 'pointer',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: view === 'list' ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none'
                            }}
                        >
                            View History
                        </button>
                    </div>
                </div>

                {topError && (
                    <div style={{ backgroundColor: '#fef2f2', color: '#dc2626', padding: '20px', borderRadius: '16px', marginBottom: '32px', fontWeight: 700, border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span>⚠️</span> {topError}
                        <button onClick={() => setTopError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 800 }}>✕</button>
                    </div>
                )}

                {view === 'form' ? (
                    /* UPLOAD FORM VIEW */
                    <form onSubmit={handleSubmit}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <label style={{ fontSize: '13px', fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>1. Select Class/Section</label>
                                <select
                                    value={selectedSectionId}
                                    onChange={(e) => { setSelectedSectionId(e.target.value); setExamId(''); }}
                                    style={{ padding: '16px 20px', borderRadius: '16px', border: '2px solid #e5e7eb', fontSize: '15px', fontWeight: 600, outline: 'none', transition: 'all 0.2s', backgroundColor: '#fff', cursor: 'pointer' }}
                                    required
                                >
                                    <option value="">-- Choose Assigned Class --</option>
                                    {mySections.map((s) => (
                                        <option key={s.id} value={String(s.id)}>{s.class_name} - {s.section_name}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <label style={{ fontSize: '13px', fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>2. Exam Category</label>
                                <select
                                    value={examTypeFilter}
                                    onChange={(e) => { setExamTypeFilter(e.target.value); setExamId(''); }}
                                    style={{ padding: '16px 20px', borderRadius: '16px', border: '2px solid #e5e7eb', fontSize: '15px', fontWeight: 600, outline: 'none', transition: 'all 0.2s', backgroundColor: '#fff' }}
                                >
                                    <option value="">All Categories</option>
                                    {EXAM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '32px', marginBottom: '40px', padding: '32px', backgroundColor: '#f8fafc', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <label style={{ fontSize: '13px', fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>3. Specific Exam</label>
                                <select
                                    value={examId}
                                    onChange={(e) => setExamId(e.target.value)}
                                    required
                                    disabled={!selectedSectionId || loading}
                                    style={{ padding: '16px 20px', borderRadius: '16px', border: '2px solid #e5e7eb', fontSize: '15px', fontWeight: 600, outline: 'none', backgroundColor: !selectedSectionId ? '#f1f5f9' : '#fff' }}
                                >
                                    <option value="">-- Choose Exam --</option>
                                    {availableExams.map((e) => (
                                        <option key={e.id} value={String(e.id)}>{e.name} (Max: {e.total_marks})</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <label style={{ fontSize: '13px', fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>4. Subject</label>
                                <select
                                    value={selectedSubject}
                                    onChange={(e) => setSelectedSubject(e.target.value)}
                                    required
                                    disabled={!selectedSectionId || isPublished}
                                    style={{ padding: '16px 20px', borderRadius: '16px', border: '2px solid #e5e7eb', fontSize: '15px', fontWeight: 600, outline: 'none', backgroundColor: !selectedSectionId ? '#f1f5f9' : '#fff' }}
                                >
                                    <option value="">-- Choose Subject --</option>
                                    {teacherSubjects.map((s) => (
                                        <option key={s.id} value={s.name}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="teacher-page-card" style={{ backgroundColor: '#fff', borderRadius: '24px', padding: '32px', border: '2px solid #f1f5f9' }}>
                            <div className="teacher-toolbar" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#1e293b' }}>Score Submission</h3>
                                <div className="teacher-upload-student-select" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '350px' }}>
                                    <select
                                        value={selectedStudentId}
                                        onChange={(e) => setSelectedStudentId(e.target.value)}
                                        required
                                        disabled={!selectedSectionId || students.length === 0}
                                        style={{ padding: '14px 20px', borderRadius: '14px', border: '2px solid #e5e7eb', fontSize: '15px', fontWeight: 600 }}
                                    >
                                        <option value="">-- Select Student --</option>
                                        {students.map((s) => (
                                            <option key={s.id} value={s.id}>{s.name} ({s.roll_number || 'No Roll'})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {selectedStudent ? (
                                <div className="teacher-upload-score-card" style={{ backgroundColor: '#fdfdfd', borderRadius: '20px', border: '1px solid #f1f5f9', padding: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', gap: '24px' }}>
                                    <div>
                                        <div style={{ fontWeight: 900, color: '#111827', fontSize: '20px' }}>{selectedStudent.name}</div>
                                        <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '6px', fontWeight: 600 }}>Roll Code: {selectedStudent.roll_number || 'N/A'} | Status: Record Pending</div>
                                    </div>
                                    <div className="teacher-upload-score-body" style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                                        <div className="teacher-upload-meta" style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Weightage</div>
                                            <div style={{ fontSize: '20px', fontWeight: 900, color: '#1e293b' }}>{selectedExam?.total_marks || 100}</div>
                                        </div>
                                        <div className="teacher-upload-score-divider" style={{ height: '40px', width: '1px', backgroundColor: '#e2e8f0' }}></div>
                                        <div>
                                            <input
                                                type="number"
                                                value={studentMarks[selectedStudentId] ?? ''}
                                                onChange={(e) => setStudentMarks(prev => ({ ...prev, [selectedStudentId]: e.target.value }))}
                                                placeholder="0.0"
                                                disabled={isPublished && !(['unit_test', 'class_test'].includes(selectedExam?.exam_type))}
                                                style={{ width: '120px', padding: '16px', borderRadius: '16px', border: `2px solid ${marksErrors[selectedStudentId] ? '#ef4444' : '#e5e7eb'}`, fontSize: '20px', fontWeight: 900, textAlign: 'center', outline: 'none' }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="teacher-upload-empty" style={{ textAlign: 'center', padding: '80px', border: '2px dashed #e2e8f0', borderRadius: '24px', color: '#94a3b8' }}>
                                    <div style={{ fontSize: '40px', marginBottom: '16px' }}>✍️</div>
                                    <div style={{ fontWeight: 700, fontSize: '18px' }}>Ready to log scores?</div>
                                    <p style={{ marginTop: '8px' }}>Select a student from the menu above to start recording performance</p>
                                </div>
                            )}
                        </div>

                        <div className="teacher-upload-actions" style={{ marginTop: '48px', display: 'flex', justifyContent: 'flex-end', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                             {isPublished && (
                                 <span style={{ 
                                     color: (['unit_test', 'class_test'].includes(selectedExam?.exam_type)) ? '#1d4ed8' : '#ef4444', 
                                     fontWeight: 800, 
                                     fontSize: '14px', 
                                     backgroundColor: (['unit_test', 'class_test'].includes(selectedExam?.exam_type)) ? '#dbeafe' : '#fef2f2', 
                                     padding: '8px 16px', 
                                     borderRadius: '12px' 
                                 }}>
                                    {(['unit_test', 'class_test'].includes(selectedExam?.exam_type)) 
                                        ? '📢 Some results are published. You can still upload others.' 
                                        : '🔒 Results are Published & Locked'}
                                 </span>
                             )}
                             
                             {/* Teacher Self-Publish Button for Unit/Class Tests */}
                             {(['unit_test', 'class_test'].includes(selectedExam?.exam_type)) && (
                                 <button
                                    type="button"
                                    onClick={handlePublish}
                                    disabled={submitting || loading || !examId}
                                    style={{ padding: '18px 32px', borderRadius: '18px', border: '2px solid #2563eb', backgroundColor: 'transparent', color: '#2563eb', fontSize: '16px', fontWeight: 800, cursor: 'pointer' }}
                                 >
                                     {isPublished ? 'Update Published Results' : 'Publish To Students'}
                                 </button>
                             )}

                             <button
                                type="submit"
                                disabled={submitting || loading || (isPublished && !(['unit_test', 'class_test'].includes(selectedExam?.exam_type))) || !selectedStudentId}
                                style={{ padding: '18px 48px', borderRadius: '18px', border: 'none', backgroundColor: (submitting || loading || (isPublished && !(['unit_test', 'class_test'].includes(selectedExam?.exam_type))) || !selectedStudentId) ? '#cbd5e1' : '#2563eb', color: '#fff', fontSize: '16px', fontWeight: 800, cursor: (submitting || loading || (isPublished && !(['unit_test', 'class_test'].includes(selectedExam?.exam_type))) || !selectedStudentId) ? 'not-allowed' : 'pointer', transition: 'all 0.3s ease', boxShadow: (submitting || loading || (isPublished && !(['unit_test', 'class_test'].includes(selectedExam?.exam_type))) || !selectedStudentId) ? 'none' : '0 10px 15px -3px rgba(37,99,235,0.4)' }}
                            >
                                {submitting ? 'Updating Database...' : 'Save Record'}
                            </button>
                        </div>
                    </form>
                ) : (
                    /* HISTORY LIST VIEW */
                    <div>
                        {/* List Filters */}
                        <div className="teacher-upload-filters" style={{ display: 'flex', gap: '16px', marginBottom: '32px', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: '240px' }}>
                                <input 
                                    type="text" 
                                    placeholder="Search by student or subject..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{ width: '100%', padding: '14px 20px', borderRadius: '14px', border: '2px solid #e5e7eb', fontSize: '15px', fontWeight: 600, outline: 'none' }}
                                />
                            </div>
                            <select
                                value={listSectionFilter}
                                onChange={(e) => setListSectionFilter(e.target.value)}
                                style={{ padding: '14px 20px', borderRadius: '14px', border: '2px solid #e5e7eb', fontSize: '14px', fontWeight: 700, outline: 'none', minWidth: '200px' }}
                            >
                                <option value="">All Classes</option>
                                {mySections.map(s => <option key={s.id} value={s.id}>{s.class_name} - {s.section_name}</option>)}
                            </select>
                            <select
                                value={listTypeFilter}
                                onChange={(e) => setListTypeFilter(e.target.value)}
                                style={{ padding: '14px 20px', borderRadius: '14px', border: '2px solid #e5e7eb', fontSize: '14px', fontWeight: 700, outline: 'none', minWidth: '180px' }}
                            >
                                <option value="">All Exam Types</option>
                                {EXAM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                            <button onClick={loadHistory} style={{ padding: '14px 20px', borderRadius: '14px', backgroundColor: '#fff', border: '2px solid #e5e7eb', cursor: 'pointer', fontWeight: 800 }}>🔄</button>
                        </div>

                        {loading && history.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '100px', fontWeight: 700 }}>Synchronizing data...</div>
                        ) : filteredHistory.length > 0 ? (
                            <div style={{ overflowX: 'auto', borderRadius: '20px', border: '1px solid #f0f0f0' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead style={{ backgroundColor: '#f9fafb' }}>
                                        <tr>
                                            <th style={{ padding: '20px', textAlign: 'left', fontSize: '13px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Student</th>
                                            <th style={{ padding: '20px', textAlign: 'left', fontSize: '13px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Subject</th>
                                            <th style={{ padding: '20px', textAlign: 'center', fontSize: '13px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Exam Type</th>
                                            <th style={{ padding: '20px', textAlign: 'center', fontSize: '13px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Score</th>
                                            <th style={{ padding: '20px', textAlign: 'center', fontSize: '13px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredHistory.map((item) => (
                                            <tr key={item.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                                                <td style={{ padding: '20px' }}>
                                                    <div style={{ fontWeight: 800, color: '#111827' }}>{item.student_name}</div>
                                                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', fontWeight: 600 }}>ID: {item.student}</div>
                                                </td>
                                                <td style={{ padding: '20px', fontWeight: 700, color: '#334155' }}>
                                                    {item.subject_name}
                                                </td>
                                                <td style={{ padding: '20px', textAlign: 'center' }}>
                                                    <span style={{ fontSize: '12px', fontWeight: 800, backgroundColor: '#f1f5f9', color: '#475569', padding: '6px 12px', borderRadius: '8px' }}>
                                                        {item.exam_type_display}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '20px', textAlign: 'center' }}>
                                                    <div style={{ fontWeight: 900, color: '#2563eb', fontSize: '18px' }}>{item.marks}</div>
                                                    <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>Max: {item.max_marks}</div>
                                                </td>
                                                <td style={{ padding: '20px', textAlign: 'center' }}>
                                                    <span style={{ 
                                                        fontSize: '11px', 
                                                        fontWeight: 900, 
                                                        color: item.is_locked ? '#166534' : '#ca8a04',
                                                        backgroundColor: item.is_locked ? '#dcfce7' : '#fef9c3',
                                                        padding: '6px 14px',
                                                        borderRadius: '10px',
                                                        display: 'inline-block'
                                                    }}>
                                                        {item.is_locked ? 'PUBLISHED' : 'PENDING'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="teacher-results-empty" style={{ textAlign: 'center', padding: '100px', backgroundColor: '#fff', borderRadius: '32px', border: '3px dashed #f1f5f9' }}>
                                <div style={{ fontSize: '48px', marginBottom: '20px' }}>📁</div>
                                <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#334155' }}>No match found</h3>
                                <p style={{ color: '#64748b', marginTop: '10px' }}>Try adjusting your search query or filters.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default UploadResult;
