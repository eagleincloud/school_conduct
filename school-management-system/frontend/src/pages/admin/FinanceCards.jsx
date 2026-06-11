import React, { useEffect, useMemo, useState } from 'react';
import { useConfirm } from '../../context/ConfirmContext';
import api from '../../services/api';

const CLASS_NAMES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

const EMPTY_FORM = {
    class_name: '',
    registration_fee: '',
    admission_fee: '',
    tuition_fee: '',
    computer_fee: '',
    annual_charges: '',
    science_fee: '',
    sports_fee: '',
};

const cardStyle = {
    border: '1px solid #e5e7eb',
    borderRadius: 14,
    backgroundColor: '#fff',
    padding: 16,
};

const fieldStyle = {
    width: '100%',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    padding: '10px 12px',
};

const toNum = (value) => Number(value || 0);

const FinanceCards = () => {
    const confirm = useConfirm();
    const [cards, setCards] = useState([]);
    const [form, setForm] = useState(EMPTY_FORM);
    const [bulkRows, setBulkRows] = useState('');
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');
    const [error, setError] = useState('');
    const [uploadFile, setUploadFile] = useState(null);

    const showMsg = (text, isError = false) => {
        if (isError) {
            setError(text);
            setMsg('');
        } else {
            setMsg(text);
            setError('');
        }
        setTimeout(() => {
            setMsg('');
            setError('');
        }, 4000);
    };

    const loadCards = async () => {
        setLoading(true);
        try {
            const res = await api.get('fees/admin/class-fee-cards/');
            setCards(res.data || []);
        } catch (e) {
            showMsg(e?.response?.data?.error || 'Could not load finance cards', true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCards();
    }, []);

    const formTotal = useMemo(
        () =>
            toNum(form.registration_fee) +
            toNum(form.admission_fee) +
            toNum(form.tuition_fee) +
            toNum(form.computer_fee) +
            toNum(form.annual_charges) +
            toNum(form.science_fee) +
            toNum(form.sports_fee),
        [form]
    );

    const saveCard = async (e) => {
        e.preventDefault();
        try {
            await api.post('fees/admin/class-fee-cards/', form);
            setForm(EMPTY_FORM);
            showMsg('Finance fee card created');
            await loadCards();
        } catch (err) {
            const firstErr = err?.response?.data;
            showMsg(firstErr?.class_name?.[0] || firstErr?.error || 'Could not create card', true);
        }
    };

    const bootstrapCards = async () => {
        try {
            const res = await api.post('fees/admin/class-fee-cards/bootstrap/');
            showMsg(`Default classes ready. New cards: ${res.data.created}`);
            await loadCards();
        } catch (e) {
            showMsg(e?.response?.data?.error || 'Bootstrap failed', true);
        }
    };

    const uploadBulk = async () => {
        const rows = bulkRows
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
                const [class_name, registration_fee, admission_fee, tuition_fee, computer_fee, annual_charges, science_fee, sports_fee] = line.split(',').map((x) => x.trim());
                return {
                    class_name,
                    registration_fee: registration_fee || '0',
                    admission_fee: admission_fee || '0',
                    tuition_fee: tuition_fee || '0',
                    computer_fee: computer_fee || '0',
                    annual_charges: annual_charges || '0',
                    science_fee: science_fee || '0',
                    sports_fee: sports_fee || '0',
                };
            });
        if (rows.length === 0) {
            showMsg('Paste at least one CSV row', true);
            return;
        }
        try {
            const res = await api.post('fees/admin/class-fee-cards/upload/', { cards: rows });
            showMsg(`Uploaded ${res.data.count} fee cards`);
            setBulkRows('');
            await loadCards();
        } catch (e) {
            showMsg(e?.response?.data?.error || 'Bulk upload failed', true);
        }
    };

    const uploadFromFile = async () => {
        if (!uploadFile) {
            showMsg('Please choose a CSV or PDF file', true);
            return;
        }
        const fd = new FormData();
        fd.append('file', uploadFile);
        fd.append('file_type', 'csv');
        try {
            const res = await api.post('fees/admin/class-fee-cards/upload-file/', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            showMsg(`Uploaded ${res.data.count} fee cards from file`);
            setUploadFile(null);
            await loadCards();
        } catch (e) {
            showMsg(e?.response?.data?.error || 'File upload failed', true);
        }
    };

    const rollbackLastChange = async () => {
        if (!(await confirm('Rollback last finance card change?'))) return;
        try {
            const res = await api.post('fees/admin/class-fee-cards/rollback/');
            showMsg(`${res.data.message}. Restored ${res.data.restored_count} card(s).`);
            await loadCards();
        } catch (e) {
            showMsg(e?.response?.data?.error || 'Rollback failed', true);
        }
    };

    const deleteAllCards = async () => {
        if (!(await confirm('Delete all fee cards? You can restore using Rollback Last Change.'))) return;
        try {
            const res = await api.delete('fees/admin/class-fee-cards/delete-all/');
            showMsg(`${res.data.message}. Deleted ${res.data.deleted_count} row(s).`);
            await loadCards();
        } catch (e) {
            showMsg(e?.response?.data?.error || 'Delete all failed', true);
        }
    };

    return (
        <div style={{ padding: '24px', background: '#f8fafc', minHeight: 'calc(100vh - 60px)' }}>
            <style>
                {`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-up { animation: fadeIn 0.4s ease forwards; }
                .admin-card { transition: all 0.2s ease; }
                .admin-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
                .btn-premium {
                    transition: all 0.2s ease;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                }
                .btn-premium:hover {
                    transform: translateY(-1px);
                    filter: brightness(1.05);
                }
                .btn-premium:active {
                    transform: translateY(0);
                }
                `}
            </style>

            {/* Premium Header Card */}
            <div className="animate-up" style={{ 
                backgroundColor: '#fff', 
                padding: '28px', 
                borderRadius: '24px', 
                marginBottom: '20px', 
                boxShadow: '0 1px 12px rgba(16,24,40,0.08)',
                border: '1px solid #e5e7eb',
                background: 'linear-gradient(135deg, #fff 0%, #f8fafc 100%)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{ position: 'absolute', top: -30, right: -30, width: 200, height: 200, background: 'rgba(37, 99, 235, 0.03)', borderRadius: '50%', zIndex: 0 }}></div>
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                    <div>
                        <h1 style={{ margin: 0, fontWeight: 1000, fontSize: '32px', letterSpacing: '-0.02em', background: 'linear-gradient(90deg, #1e293b 0%, #2563eb 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            Finance Fee Cards
                        </h1>
                        <p style={{ margin: '8px 0 0', color: '#64748b', fontWeight: 900, fontSize: '15px' }}>
                            Define and manage class-wise fee structures, bulk upload configurations, and financial cards.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button className="btn-premium" onClick={bootstrapCards} style={{ padding: '10px 20px', borderRadius: '14px', border: 'none', backgroundColor: '#f0f9ff', color: '#0369a1', fontWeight: 1000, fontSize: '13px' }}>
                            Bootstrap Defaults
                        </button>
                        <button className="btn-premium" onClick={rollbackLastChange} style={{ padding: '10px 20px', borderRadius: '14px', border: '1px solid #e5e7eb', backgroundColor: '#fff', fontWeight: 1000, fontSize: '13px', color: '#64748b', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                            Rollback
                        </button>
                    </div>
                </div>
            </div>

            {msg && <div className="animate-up" style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 12, backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontWeight: 1000 }}>{msg}</div>}
            {error && <div className="animate-up" style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 12, backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontWeight: 1000 }}>{error}</div>}
            {loading && <div style={{ marginBottom: 16, color: '#64748b', fontWeight: 900 }}>Processing request...</div>}

            <div style={{ ...cardStyle, marginTop: 12 }}>
                <h3 style={{ marginTop: 0 }}>Create Single Card</h3>
                <form onSubmit={saveCard}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                        <select style={fieldStyle} value={form.class_name} onChange={(e) => setForm((p) => ({ ...p, class_name: e.target.value }))} required>
                            <option value="">Select Class</option>
                            {CLASS_NAMES.map((name) => (
                                <option key={name} value={name}>
                                    {name}
                                </option>
                            ))}
                        </select>
                        <input style={fieldStyle} placeholder="Registration Fee" type="number" value={form.registration_fee} onChange={(e) => setForm((p) => ({ ...p, registration_fee: e.target.value }))} />
                        <input style={fieldStyle} placeholder="Admission Fee" type="number" value={form.admission_fee} onChange={(e) => setForm((p) => ({ ...p, admission_fee: e.target.value }))} />
                        <input style={fieldStyle} placeholder="Tuition Fee" type="number" value={form.tuition_fee} onChange={(e) => setForm((p) => ({ ...p, tuition_fee: e.target.value }))} />
                        <input style={fieldStyle} placeholder="Computer Fee" type="number" value={form.computer_fee} onChange={(e) => setForm((p) => ({ ...p, computer_fee: e.target.value }))} />
                        <input style={fieldStyle} placeholder="Annual Charges" type="number" value={form.annual_charges} onChange={(e) => setForm((p) => ({ ...p, annual_charges: e.target.value }))} />
                        <input style={fieldStyle} placeholder="Science Fee" type="number" value={form.science_fee} onChange={(e) => setForm((p) => ({ ...p, science_fee: e.target.value }))} />
                        <input style={fieldStyle} placeholder="Sports Fee" type="number" value={form.sports_fee} onChange={(e) => setForm((p) => ({ ...p, sports_fee: e.target.value }))} />
                    </div>
                    <p style={{ marginTop: 10, marginBottom: 8, fontWeight: 700 }}>Total Fee: ₹{formTotal.toFixed(2)}</p>
                    <button type="submit" className="btn-premium" style={{ border: 'none', borderRadius: 12, padding: '12px 28px', backgroundColor: '#2563eb', color: '#fff', fontWeight: 1000, boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)' }}>
                        Create Card
                    </button>
                    <button type="button" className="btn-premium" onClick={bootstrapCards} style={{ marginLeft: 8, border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 28px', backgroundColor: '#fff', color: '#475569', fontWeight: 1000 }}>
                        Create Nursery to 12 Defaults
                    </button>
                </form>
            </div>

            <div style={{ ...cardStyle, marginTop: 12 }}>
                <h3 style={{ marginTop: 0 }}>Bulk Upload (CSV Lines)</h3>
                <p style={{ color: '#6b7280', fontSize: 13, marginTop: 0 }}>
                    Format: class,registration,admission,tuition,computer,annual,science,sports
                </p>
                <textarea
                    style={{ width: '100%', minHeight: 120, border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}
                    value={bulkRows}
                    onChange={(e) => setBulkRows(e.target.value)}
                    placeholder="Nursery,700,3300,2050,0,5200,0,0"
                />
                <div style={{ marginTop: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <button type="button" className="btn-premium" onClick={uploadBulk} style={{ border: 'none', borderRadius: 12, padding: '14px 28px', backgroundColor: '#10b981', color: '#fff', fontWeight: 1000, boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}>
                        Upload Cards
                    </button>
                    <button
                        type="button"
                        className="btn-premium"
                        onClick={deleteAllCards}
                        style={{ border: 'none', borderRadius: 12, padding: '14px 28px', backgroundColor: '#ef4444', color: '#fff', fontWeight: 1000, boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)' }}
                    >
                        Delete All Cards
                    </button>
                    <button
                        type="button"
                        className="btn-premium"
                        onClick={rollbackLastChange}
                        style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 28px', backgroundColor: '#fff', color: '#64748b', fontWeight: 1000, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                    >
                        Rollback Last Change
                    </button>
                </div>
            </div>

            <div style={{ ...cardStyle, marginTop: 12 }}>
                <h3 style={{ marginTop: 0 }}>Upload File (CSV)</h3>
                <p style={{ color: '#6b7280', fontSize: 13, marginTop: 0 }}>
                    CSV columns: class_name, registration_fee, admission_fee, tuition_fee, computer_fee, annual_charges, science_fee, sports_fee
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                        style={{ ...fieldStyle, width: 280, padding: '8px 10px' }}
                    />
                    <button type="button" className="btn-premium" onClick={uploadFromFile} style={{ border: 'none', borderRadius: 12, padding: '12px 28px', backgroundColor: '#eff6ff', color: '#2563eb', fontWeight: 1000 }}>
                        Upload File
                    </button>
                </div>
            </div>

            <div style={{ ...cardStyle, marginTop: 12 }}>
                <h3 style={{ marginTop: 0 }}>All Fee Cards</h3>
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <table style={{ width: '100%', minWidth: '980px', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f9fafb' }}>
                                <th style={{ textAlign: 'left', padding: 8 }}>Class Name</th>
                                <th style={{ textAlign: 'left', padding: 8 }}>Registration</th>
                                <th style={{ textAlign: 'left', padding: 8 }}>Admission</th>
                                <th style={{ textAlign: 'left', padding: 8 }}>Tuition</th>
                                <th style={{ textAlign: 'left', padding: 8 }}>Computer</th>
                                <th style={{ textAlign: 'left', padding: 8 }}>Annual</th>
                                <th style={{ textAlign: 'left', padding: 8 }}>Science</th>
                                <th style={{ textAlign: 'left', padding: 8 }}>Sports</th>
                                <th style={{ textAlign: 'left', padding: 8 }}>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cards.map((row) => (
                                <tr key={row.id} style={{ borderTop: '1px solid #eef2f7' }}>
                                    <td style={{ padding: 8, fontWeight: 700 }}>{row.class_name}</td>
                                    <td style={{ padding: 8 }}>₹{row.registration_fee}</td>
                                    <td style={{ padding: 8 }}>₹{row.admission_fee}</td>
                                    <td style={{ padding: 8 }}>₹{row.tuition_fee}</td>
                                    <td style={{ padding: 8 }}>₹{row.computer_fee}</td>
                                    <td style={{ padding: 8 }}>₹{row.annual_charges}</td>
                                    <td style={{ padding: 8 }}>₹{row.science_fee}</td>
                                    <td style={{ padding: 8 }}>₹{row.sports_fee}</td>
                                    <td style={{ padding: 8, fontWeight: 800 }}>₹{row.total_fee}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default FinanceCards;
