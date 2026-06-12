import React, { useEffect, useMemo, useState } from 'react';
import { useConfirm } from '../../context/ConfirmContext';
import api from '../../services/api';

const card = {
    backgroundColor: '#fff',
    borderRadius: '14px',
    border: '1px solid #e5e7eb',
    padding: '16px',
    boxShadow: '0 1px 6px rgba(16,24,40,0.06)',
};

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

const AdminFees = () => {
    const confirm = useConfirm();
    const [dashboard, setDashboard] = useState(null);
    const [structures, setStructures] = useState([]);
    const [mainClasses, setMainClasses] = useState([]);
    const [students, setStudents] = useState([]);
    const [studentFees, setStudentFees] = useState([]);
    const [classFilter, setClassFilter] = useState('');
    const [studentFilter, setStudentFilter] = useState('');
    const [searchStudent, setSearchStudent] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const [structureForm, setStructureForm] = useState({
        class_ref: '',
        fee_type: 'School Fee',
        amount: '',
        due_date: '',
        description: '',
    });
    const [editingStructureId, setEditingStructureId] = useState(null);

    const [selectedFeeId, setSelectedFeeId] = useState('');
    const [syncClassId, setSyncClassId] = useState('');
    const [assignStudentId, setAssignStudentId] = useState('');

    const showMsg = (text) => {
        setMessage(text);
        if (text) window.setTimeout(() => setMessage(''), 4000);
    };

    const loadAll = async () => {
        setLoading(true);
        try {
            const [dashRes, structRes, classRes, studRes] = await Promise.all([
                api.get('fees/admin/dashboard/'),
                api.get('fees/admin/structures/'),
                api.get('classes/main-classes/'),
                api.get('students/'),
            ]);
            setDashboard(dashRes.data);
            setStructures(structRes.data);
            setMainClasses(classRes.data);
            setStudents(studRes.data);
            await loadStudentFees();
        } catch (e) {
            showMsg(e.response?.data?.error || 'Failed to load finance data', true);
        } finally {
            setLoading(false);
        }
    };

    const loadStudentFees = async () => {
        const params = {};
        if (classFilter) params.class_id = classFilter;
        if (studentFilter) params.student_id = studentFilter;
        const res = await api.get('fees/admin/student-fees/', { params });
        setStudentFees(res.data);
    };

    useEffect(() => {
        loadAll();
    }, []);

    useEffect(() => {
        loadStudentFees();
    }, [classFilter, studentFilter]);

    const selectedRecord = useMemo(
        () => studentFees.find((r) => String(r.id) === String(selectedFeeId)),
        [studentFees, selectedFeeId]
    );

    const fullRecordPayments = useMemo(() => {
        if (!selectedRecord?.payments) return [];
        return selectedRecord.payments;
    }, [selectedRecord]);

    const filteredStudentFees = useMemo(() => {
        const q = searchStudent.trim().toLowerCase();
        if (!q) return studentFees;
        return studentFees.filter((row) => {
            const name = (row.student_name || '').toLowerCase();
            const cls = (row.class_display || '').toLowerCase();
            return name.includes(q) || cls.includes(q);
        });
    }, [studentFees, searchStudent]);

    const studentsForAssignDropdown = useMemo(() => {
        if (!syncClassId) return students;
        const selectedClass = mainClasses.find((c) => String(c.id) === String(syncClassId));
        const selectedName = (selectedClass?.name || '').toLowerCase();
        if (!selectedName) return students;
        return students.filter((s) => ((s.class_name || '').toLowerCase().includes(selectedName)));
    }, [students, mainClasses, syncClassId]);

    const refreshSelectedWithPayments = async () => {
        if (!selectedFeeId) return;
        try {
            const res = await api.get(`fees/admin/student-fees/${selectedFeeId}/`);
            setStudentFees((prev) =>
                prev.map((row) => (String(row.id) === String(selectedFeeId) ? { ...row, ...res.data } : row))
            );
        } catch (_) {}
    };

    useEffect(() => {
        refreshSelectedWithPayments();
    }, [selectedFeeId]);

    const saveStructure = async (e) => {
        e.preventDefault();
        try {
            const amount = Number(structureForm.amount || 0);
            const tuition = structureForm.fee_type === 'School Fee' ? amount : 0;
            const exam = structureForm.fee_type === 'Exam Fee' ? amount : 0;
            const transport = structureForm.fee_type === 'Transport Fee' ? amount : 0;
            const payload = {
                class_ref: structureForm.class_ref,
                tuition_fees: String(tuition),
                exam_fees: String(exam),
                other_charges: String(transport),
                due_date: structureForm.due_date,
                description: structureForm.description,
            };
            if (editingStructureId) {
                await api.patch(`fees/admin/structures/${editingStructureId}/`, payload);
                showMsg('Fee structure updated');
            } else {
                await api.post('fees/admin/structures/', payload);
                showMsg('Fee structure created');
            }
            setEditingStructureId(null);
            setStructureForm({
                class_ref: '',
                fee_type: 'School Fee',
                amount: '',
                due_date: '',
                description: '',
            });
            await loadAll();
        } catch (err) {
            showMsg(err.response?.data?.error || JSON.stringify(err.response?.data) || 'Save failed', true);
        }
    };

    const editStructure = (s) => {
        let feeType = 'School Fee';
        let amount = s.tuition_fees;
        if (Number(s.exam_fees || 0) > 0) {
            feeType = 'Exam Fee';
            amount = s.exam_fees;
        } else if (Number(s.other_charges || 0) > 0) {
            feeType = 'Transport Fee';
            amount = s.other_charges;
        }
        setEditingStructureId(s.id);
        setStructureForm({
            class_ref: s.class_ref,
            fee_type: feeType,
            amount,
            due_date: s.due_date,
            description: s.description || '',
        });
    };

    const deleteStructure = async (id) => {
        if (!(await confirm('Delete this fee structure? This will also remove linked student fee records for this class.'))) return;
        try {
            await api.delete(`fees/admin/structures/${id}/?force=1`);
            showMsg('Deleted');
            await loadAll();
        } catch (err) {
            showMsg(err.response?.data?.error || 'Delete failed', true);
        }
    };

    const syncClass = async () => {
        if (!syncClassId) return;
        try {
            const res = await api.post('fees/admin/sync-class/', { class_id: syncClassId });
            showMsg(`Synced: ${res.data.created} new records`);
            await loadStudentFees();
        } catch (err) {
            showMsg(err.response?.data?.error || 'Sync failed', true);
        }
    };

    const assignStudentFee = async () => {
        if (!assignStudentId) return;
        try {
            await api.post('fees/admin/student-fees/create/', { student_id: assignStudentId });
            showMsg('Student fee record ready');
            await loadStudentFees();
        } catch (err) {
            showMsg(err.response?.data?.error || 'Assign failed', true);
        }
    };

    const downloadReceipt = async (paymentId) => {
        try {
            const res = await api.get(`fees/admin/receipt/${paymentId}/`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `fee_receipt_${paymentId}.pdf`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (_) {
            showMsg('Receipt download failed', true);
        }
    };

    const exportCsv = async () => {
        try {
            const params = classFilter ? { class_id: classFilter } : {};
            const res = await api.get('fees/admin/export/csv/', { params, responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = 'student_fees.csv';
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (_) {
            showMsg('Export failed', true);
        }
    };

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 1000, color: '#0f172a' }}>Finance Management</h1>
                    <p style={{ margin: '8px 0 0', color: '#6b7280', fontSize: '14px' }}>
                        Define fee structure, assign fees, verify student payments, and monitor due records.
                    </p>
                </div>
                {message ? (
                    <div style={{ fontWeight: 800, color: message.includes('fail') || message.includes('Failed') ? '#b91c1c' : '#166534' }}>{message}</div>
                ) : null}
            </div>

            {loading && <p style={{ color: '#6b7280' }}>Loading…</p>}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginTop: '20px' }}>
                <div style={card}>
                    <div style={labelStyle}>Total Fees</div>
                    <div style={{ fontSize: '22px', fontWeight: 900 }}>₹{dashboard?.total_fees_scheduled ?? '—'}</div>
                </div>
                <div style={card}>
                    <div style={labelStyle}>Total Paid</div>
                    <div style={{ fontSize: '22px', fontWeight: 900, color: '#166534' }}>₹{dashboard?.total_paid ?? '—'}</div>
                </div>
                <div style={card}>
                    <div style={labelStyle}>Total Due</div>
                    <div style={{ fontSize: '22px', fontWeight: 900, color: '#b45309' }}>₹{dashboard?.total_due ?? '—'}</div>
                </div>
                <div style={card}>
                    <div style={labelStyle}>Overdue Payments</div>
                    <div style={{ fontSize: '22px', fontWeight: 900, color: '#b91c1c' }}>{dashboard?.overdue_records ?? '—'}</div>
                </div>
            </div>

            <div style={{ ...card, marginTop: '18px' }}>
                <h2 style={{ margin: '0 0 12px', fontSize: '18px' }}>Fee structure (class-wise)</h2>
                <form onSubmit={saveStructure} style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                    <div>
                        <div style={labelStyle}>Class</div>
                        <select
                            value={structureForm.class_ref}
                            onChange={(e) => setStructureForm({ ...structureForm, class_ref: e.target.value })}
                            style={inputStyle}
                            required
                            disabled={!!editingStructureId}
                        >
                            <option value="">-- Select --</option>
                            {mainClasses.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <div style={labelStyle}>Fee Type</div>
                        <select value={structureForm.fee_type} onChange={(e) => setStructureForm({ ...structureForm, fee_type: e.target.value })} style={inputStyle} required>
                            <option value="School Fee">School Fee</option>
                            <option value="Exam Fee">Exam Fee</option>
                            <option value="Transport Fee">Transport Fee</option>
                        </select>
                    </div>
                    <div>
                        <div style={labelStyle}>Amount</div>
                        <input type="number" step="0.01" value={structureForm.amount} onChange={(e) => setStructureForm({ ...structureForm, amount: e.target.value })} style={inputStyle} required />
                    </div>
                    <div>
                        <div style={labelStyle}>Due date</div>
                        <input type="date" value={structureForm.due_date} onChange={(e) => setStructureForm({ ...structureForm, due_date: e.target.value })} style={inputStyle} required />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                        <div style={labelStyle}>Description (optional)</div>
                        <input type="text" value={structureForm.description} onChange={(e) => setStructureForm({ ...structureForm, description: e.target.value })} style={inputStyle} />
                    </div>
                    <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button type="submit" style={{ padding: '12px 24px', borderRadius: '12px', border: 'none', backgroundColor: '#2563eb', color: '#fff', fontWeight: 900, cursor: 'pointer', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)' }}>
                            {editingStructureId ? 'Update structure' : 'Save structure'}
                        </button>
                        {editingStructureId ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setEditingStructureId(null);
                                    setStructureForm({
                                        class_ref: '',
                                        fee_type: 'School Fee',
                                        amount: '',
                                        due_date: '',
                                        description: '',
                                    });
                                }}
                                style={{ padding: '12px 18px', borderRadius: '12px', border: '1px solid #e5e7eb', backgroundColor: '#fff', fontWeight: 900, cursor: 'pointer' }}
                            >
                                Cancel edit
                            </button>
                        ) : null}
                    </div>
                </form>

                <div style={{ marginTop: '16px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <table style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f2f4f7' }}>
                                <th style={{ padding: '10px', textAlign: 'left' }}>Class</th>
                                <th style={{ padding: '10px', textAlign: 'left' }}>Total</th>
                                <th style={{ padding: '10px', textAlign: 'left' }}>Fee Breakdown</th>
                                <th style={{ padding: '10px', textAlign: 'left' }}>Due date</th>
                                <th style={{ padding: '10px', textAlign: 'left' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {structures.map((s) => (
                                <tr key={s.id} style={{ borderTop: '1px solid #eef2f7' }}>
                                    <td style={{ padding: '10px', fontWeight: 800 }}>{s.class_name}</td>
                                    <td style={{ padding: '10px' }}>₹{s.total_fees}</td>
                                    <td style={{ padding: '10px', fontSize: '13px', color: '#4b5563' }}>
                                        ₹{s.tuition_fees} / ₹{s.exam_fees} / ₹{s.other_charges}
                                    </td>
                                    <td style={{ padding: '10px' }}>{s.due_date}</td>
                                    <td style={{ padding: '10px' }}>
                                        <button type="button" onClick={() => editStructure(s)} style={{ marginRight: '8px', padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#eff6ff', color: '#2563eb', fontWeight: 800, cursor: 'pointer' }}>
                                            Edit
                                        </button>
                                        <button type="button" onClick={() => deleteStructure(s.id)} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#fef2f2', color: '#ef4444', fontWeight: 800, cursor: 'pointer' }}>
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div style={{ ...card, marginTop: '18px' }}>
                <h2 style={{ margin: '0 0 12px', fontSize: '18px' }}>Assign Fees</h2>
                <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', alignItems: 'end' }}>
                    <div>
                        <div style={labelStyle}>Class</div>
                        <select value={syncClassId} onChange={(e) => setSyncClassId(e.target.value)} style={inputStyle}>
                            <option value="">-- Select Class --</option>
                            {mainClasses.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <div style={labelStyle}>Student (optional)</div>
                        <select value={assignStudentId} onChange={(e) => setAssignStudentId(e.target.value)} style={inputStyle}>
                            <option value="">Assign to all students in selected class</option>
                                {studentsForAssignDropdown.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name} ({s.class_name})
                                    </option>
                                ))}
                        </select>
                    </div>
                    <button
                        type="button"
                        onClick={() => (assignStudentId ? assignStudentFee() : syncClass())}
                        style={{ padding: '10px 24px', borderRadius: '12px', border: 'none', backgroundColor: '#2563eb', color: '#fff', fontWeight: 900, cursor: 'pointer', height: '40px', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)' }}
                    >
                        Assign Fee
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: '18px', marginTop: '18px' }}>
                <div style={card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <h2 style={{ margin: 0, fontSize: '18px' }}>Fee Records</h2>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: '160px' }}>
                                <option value="">All classes</option>
                                {mainClasses.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                            <input
                                value={searchStudent}
                                onChange={(e) => setSearchStudent(e.target.value)}
                                placeholder="Search student..."
                                style={{ ...inputStyle, width: '220px' }}
                            />
                            <button type="button" onClick={exportCsv} style={{ padding: '10px 16px', borderRadius: '10px', border: 'none', backgroundColor: '#ecfdf5', color: '#166534', fontWeight: 800, cursor: 'pointer' }}>
                                Export CSV
                            </button>
                        </div>
                    </div>

                    <div style={{ marginTop: '14px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        <table style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f2f4f7' }}>
                                    <th style={{ padding: '10px', textAlign: 'left' }}>Select</th>
                                    <th style={{ padding: '10px', textAlign: 'left' }}>Student</th>
                                    <th style={{ padding: '10px', textAlign: 'left' }}>Class</th>
                                    <th style={{ padding: '10px', textAlign: 'left' }}>Total</th>
                                    <th style={{ padding: '10px', textAlign: 'left' }}>Paid</th>
                                    <th style={{ padding: '10px', textAlign: 'left' }}>Due</th>
                                    <th style={{ padding: '10px', textAlign: 'left' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStudentFees.map((row) => {
                                    const overdue = row.overdue && row.status !== 'paid';
                                    return (
                                        <tr
                                            key={row.id}
                                            style={{
                                                borderTop: '1px solid #eef2f7',
                                                backgroundColor: overdue ? '#fef2f2' : selectedFeeId === String(row.id) ? '#eff6ff' : 'transparent',
                                            }}
                                        >
                                            <td style={{ padding: '10px' }}>
                                                <input
                                                    type="radio"
                                                    name="feePick"
                                                    checked={selectedFeeId === String(row.id)}
                                                    onChange={() => setSelectedFeeId(String(row.id))}
                                                />
                                            </td>
                                            <td style={{ padding: '10px', fontWeight: 800 }}>{row.student_name}</td>
                                            <td style={{ padding: '10px', fontSize: '13px' }}>{row.class_display}</td>
                                            <td style={{ padding: '10px' }}>₹{row.total_fees}</td>
                                            <td style={{ padding: '10px' }}>₹{row.amount_paid}</td>
                                            <td style={{ padding: '10px', fontWeight: 800 }}>₹{row.due_amount}</td>
                                            <td style={{ padding: '10px' }}>
                                                <span
                                                    style={{
                                                        display: 'inline-block',
                                                        padding: '6px 10px',
                                                        borderRadius: '999px',
                                                        fontSize: '12px',
                                                        fontWeight: 900,
                                                        backgroundColor: row.status === 'paid' ? '#dcfce7' : row.status === 'partial' ? '#fef9c3' : '#fee2e2',
                                                        color: row.status === 'paid' ? '#166534' : row.status === 'partial' ? '#854d0e' : '#991b1b',
                                                    }}
                                                >
                                                    {row.status}
                                                </span>
                                                {overdue ? <span style={{ marginLeft: '8px', fontSize: '12px', color: '#b91c1c', fontWeight: 900 }}>OVERDUE</span> : null}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div style={{ display: 'grid', gap: '16px' }}>
                    <div style={card}>
                        <h2 style={{ margin: '0 0 12px', fontSize: '18px' }}>Payment history</h2>
                        {!selectedFeeId ? (
                            <p style={{ color: '#6b7280' }}>Select a student fee record to view transactions.</p>
                        ) : (
                            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                                <table style={{ width: '100%', minWidth: '680px', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#f2f4f7' }}>
                                            <th style={{ padding: '10px', textAlign: 'left' }}>Date</th>
                                            <th style={{ padding: '10px', textAlign: 'left' }}>Amount</th>
                                            <th style={{ padding: '10px', textAlign: 'left' }}>Mode</th>
                                            <th style={{ padding: '10px', textAlign: 'left' }}>Txn ID</th>
                                            <th style={{ padding: '10px', textAlign: 'left' }}>Receipt</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(fullRecordPayments || []).map((p) => (
                                            <tr key={p.id} style={{ borderTop: '1px solid #eef2f7' }}>
                                                <td style={{ padding: '10px' }}>{p.payment_date}</td>
                                                <td style={{ padding: '10px', fontWeight: 800 }}>₹{p.amount}</td>
                                                <td style={{ padding: '10px' }}>{p.payment_mode}</td>
                                                <td style={{ padding: '10px', fontSize: '13px' }}>{p.transaction_id || '—'}</td>
                                                <td style={{ padding: '10px' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => downloadReceipt(p.id)}
                                                        style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', backgroundColor: '#f5f3ff', color: '#6d28d9', fontWeight: 800, cursor: 'pointer' }}
                                                    >
                                                        PDF
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {(!fullRecordPayments || fullRecordPayments.length === 0) && <p style={{ color: '#6b7280', marginTop: '10px' }}>No payments yet.</p>}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminFees;
