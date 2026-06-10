import React, { useEffect, useState } from 'react';
import api from '../../services/api';

const AddStudent = () => {
    const [formData, setFormData] = useState({
        email: '', password: '', confirm_password: '',
        first_name: '', last_name: '', name: '',
        admission_number: '',
        roll_number: '',
        class_id: '', section_id: ''
        ,
        dob: '',
        gender: '',
        blood_group: '',
        father_name: '',
        mother_name: '',
        father_contact: '',
        mother_contact: '',
        bus_no: '',
        address: '',
        date_of_admission: '',
        category: '',
        rfid_code: '',
    });
    const [mainClasses, setMainClasses] = useState([]);
    const [mainSections, setMainSections] = useState([]);
    const [message, setMessage] = useState('');
    const [students, setStudents] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fatherPhoneDigits = (formData.father_contact || '').replace(/\D/g, '').slice(0, 10);
    const motherPhoneDigits = (formData.mother_contact || '').replace(/\D/g, '').slice(0, 10);
    const selectedSection = mainSections.find((s) => String(s.id) === String(formData.section_id));
    const rollPreview = selectedSection?.name ? `101${String(selectedSection.name).trim().charAt(0).toUpperCase()}` : 'Auto (e.g. 101A)';
    const admissionPreview = (() => {
        const used = new Set(
            (students || [])
            .map((s) => {
                const m = String(s.admission_number || '').toUpperCase().match(/^ADM(\d+)$/);
                return m ? parseInt(m[1], 10) : null;
            })
            .filter((n) => Number.isFinite(n))
        );
        let next = 101;
        while (used.has(next)) next += 1;
        return `ADM${next}`;
    })();

    const inputStyle = {
        width: '100%',
        padding: '12px 14px',
        border: '1px solid #e5e7eb',
        borderRadius: '10px',
        fontSize: '14px',
        outline: 'none',
        boxSizing: 'border-box',
    };

    const labelStyle = {
        fontSize: '12px',
        color: '#6b7280',
        fontWeight: 600,
        marginBottom: '6px',
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
    };

    const fetchStudents = async () => {
        try {
            const res = await api.get('students/');
            setStudents(res.data);
        } catch (e) {
            setStudents([]);
        }
    };

    useEffect(() => {
        api.get('classes/main-classes/').then(res => setMainClasses(res.data)).catch(() => {});
        api.get('classes/main-sections/').then(res => setMainSections(res.data)).catch(() => {});
    }, []);

    useEffect(() => {
        fetchStudents();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        const password = formData.password || '';
        const confirm = formData.confirm_password || '';
        if (password !== confirm) {
            setMessage('Error: Password and confirm password do not match.');
            return;
        }
        if (fatherPhoneDigits.length !== 10) {
            setMessage('Error: Father\'s contact number must be exactly 10 digits.');
            return;
        }
        setIsSubmitting(true);
        try {
            // `name` kept for backward compatibility; backend also uses first/last.
            const payload = { ...formData };

            // Backend requires `username`, but UI me username input nahi hai.
            // Generate username from first/last; fallback to email local-part.
            const first = (formData.first_name || '').trim();
            const last = (formData.last_name || '').trim();
            const generatedFromName = `${first}.${last}`
                .replace(/\s+/g, '')
                .replace(/[^a-zA-Z0-9.]/g, '')
                .toLowerCase();
            const emailLocal = (formData.email || '')
                .split('@')[0]
                .trim()
                .toLowerCase();

            // Prefer email-local-part (typically unique). Fallback to first/last.
            payload.username = emailLocal ? emailLocal : (generatedFromName && generatedFromName !== '.' ? generatedFromName : 'student');

            payload.name = `${formData.first_name} ${formData.last_name}`.trim();
            payload.father_contact = fatherPhoneDigits ? `+91${fatherPhoneDigits}` : '';
            payload.mother_contact = motherPhoneDigits ? `+91${motherPhoneDigits}` : '';
            await api.post('students/admin-create/', payload);
            setMessage('Student created successfully!');
            await fetchStudents();
            setFormData({
                email: '',
                password: '',
                confirm_password: '',
                first_name: '',
                last_name: '',
                name: '',
                admission_number: '',
                roll_number: '',
                class_id: '',
                section_id: '',
                dob: '',
                gender: '',
                blood_group: '',
                father_name: '',
                mother_name: '',
                father_contact: '',
                mother_contact: '',
                bus_no: '',
                address: '',
                date_of_admission: '',
                category: '',
                rfid_code: '',
            });
        } catch (err) {
            setMessage(err?.response?.data?.error ? `Error: ${err.response.data.error}` : 'Error creating student.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div style={{ padding: '20px' }}>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    marginBottom: '10px',
                }}
            >
                <div>
                    <h1
                        style={{
                            margin: 0,
                            fontSize: '32px',
                            fontWeight: 1000,
                            color: '#0f172a',
                            lineHeight: 1.1,
                        }}
                    >
                        Add Student
                    </h1>
                    <p
                        style={{
                            margin: '8px 0 0',
                            color: '#64748b',
                            fontSize: '14px',
                            fontWeight: 700,
                        }}
                    >
                        Register a new student with admission, guardian, and class details.
                    </p>
                </div>
            </div>

                <div
                    style={{
                        border: '1px solid #e5e7eb',
                        padding: '22px',
                        width: '100%',
                        backgroundColor: '#fff',
                        borderRadius: '16px',
                        marginTop: '18px',
                    }}
                >
                    <h3 style={{ margin: '0 0 12px', color: '#111827', fontSize: '18px', fontWeight: 900 }}>
                        Section: Student Information
                    </h3>
                    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '18px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <div style={labelStyle}>First Name <span style={{ color: '#dc2626' }}>*</span></div>
                            <input
                                type="text"
                                placeholder="First Name"
                                value={formData.first_name}
                                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                style={inputStyle}
                                required
                            />
                        </div>
                        <div>
                            <div style={labelStyle}>Last Name <span style={{ color: '#dc2626' }}>*</span></div>
                            <input
                                type="text"
                                placeholder="Last Name"
                                value={formData.last_name}
                                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                style={inputStyle}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <div style={labelStyle}>Email <span style={{ color: '#dc2626' }}>*</span></div>
                        <input
                            type="email"
                            placeholder="Email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            style={inputStyle}
                            required
                        />
                    </div>

                    <div>
                        <div style={labelStyle}>Password <span style={{ color: '#dc2626' }}>*</span></div>
                        <input
                            type="password"
                            placeholder="Password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            style={inputStyle}
                            required
                        />
                    </div>

                    <div>
                        <div style={labelStyle}>Confirm Password <span style={{ color: '#dc2626' }}>*</span></div>
                        <input
                            type="password"
                            placeholder="Confirm Password"
                            value={formData.confirm_password || ''}
                            onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                            style={inputStyle}
                            required
                        />
                    </div>

                    <div>
                        <div style={labelStyle}>Admission Number (Auto Generated)</div>
                        <input
                            type="text"
                            value={admissionPreview}
                            readOnly
                            style={{ ...inputStyle, backgroundColor: '#f9fafb', color: '#6b7280' }}
                        />
                    </div>

                    <div>
                        <div style={labelStyle}>Roll Number (Auto Generated)</div>
                        <input
                            type="text"
                            value={rollPreview}
                            readOnly
                            style={{ ...inputStyle, backgroundColor: '#f9fafb', color: '#6b7280' }}
                        />
                    </div>

                    <div>
                        <div style={labelStyle}>Date of Birth (DOB) <span style={{ color: '#dc2626' }}>*</span></div>
                        <input
                            type="date"
                            value={formData.dob}
                            onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                            style={inputStyle}
                            required
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <div style={labelStyle}>Gender <span style={{ color: '#dc2626' }}>*</span></div>
                        <select
                                value={formData.gender}
                                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                                required
                                style={inputStyle}
                            >
                                <option value="">-- Select Gender --</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div>
                            <div style={labelStyle}>Blood Group</div>
                            <select
                                value={formData.blood_group}
                                onChange={(e) => setFormData({ ...formData, blood_group: e.target.value })}
                                style={inputStyle}
                            >
                                <option value="">-- Select Blood Group --</option>
                                <option value="A+">A+</option>
                                <option value="A-">A-</option>
                                <option value="B+">B+</option>
                                <option value="B-">B-</option>
                                <option value="AB+">AB+</option>
                                <option value="AB-">AB-</option>
                                <option value="O+">O+</option>
                                <option value="O-">O-</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <div style={labelStyle}>Father's Name <span style={{ color: '#dc2626' }}>*</span></div>
                            <input
                                type="text"
                                placeholder="Father's Name"
                                value={formData.father_name}
                                onChange={(e) => setFormData({ ...formData, father_name: e.target.value })}
                                style={inputStyle}
                                required
                            />
                        </div>
                        <div>
                            <div style={labelStyle}>Mother's Name <span style={{ color: '#dc2626' }}>*</span></div>
                            <input
                                type="text"
                                placeholder="Mother's Name"
                                value={formData.mother_name}
                                onChange={(e) => setFormData({ ...formData, mother_name: e.target.value })}
                                style={inputStyle}
                                required
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <div style={labelStyle}>Father's Contact <span style={{ color: '#dc2626' }}>*</span></div>
                            <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: '8px' }}>
                                <input
                                    type="text"
                                    value="+91"
                                    disabled
                                    style={{ ...inputStyle, textAlign: 'center', backgroundColor: '#f9fafb', color: '#6b7280' }}
                                />
                                <input
                                    type="tel"
                                    inputMode="numeric"
                                    pattern="[0-9]{10}"
                                    placeholder="10-digit number"
                                    value={fatherPhoneDigits}
                                    onChange={(e) => {
                                        const digits = (e.target.value || '').replace(/\D/g, '').slice(0, 10);
                                        setFormData({ ...formData, father_contact: digits });
                                    }}
                                    style={inputStyle}
                                    required
                                />
                            </div>
                        </div>
                        <div>
                            <div style={labelStyle}>Mother's Contact <span style={{ color: '#dc2626' }}>*</span></div>
                            <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: '8px' }}>
                                <input
                                    type="text"
                                    value="+91"
                                    disabled
                                    style={{ ...inputStyle, textAlign: 'center', backgroundColor: '#f9fafb', color: '#6b7280' }}
                                />
                                <input
                                    type="tel"
                                    inputMode="numeric"
                                    pattern="[0-9]{10}"
                                    placeholder="10-digit number"
                                    value={motherPhoneDigits}
                                    onChange={(e) => {
                                        const digits = (e.target.value || '').replace(/\D/g, '').slice(0, 10);
                                        setFormData({ ...formData, mother_contact: digits });
                                    }}
                                    style={inputStyle}
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <div style={labelStyle}>Bus No. (Optional)</div>
                        <input
                            type="text"
                            placeholder="e.g. Bus 5"
                            value={formData.bus_no}
                            onChange={(e) => setFormData({ ...formData, bus_no: e.target.value })}
                            style={inputStyle}
                        />
                    </div>

                    <div>
                        <div style={labelStyle}>Residential Address <span style={{ color: '#dc2626' }}>*</span></div>
                        <input
                            type="text"
                            placeholder="Residential Address"
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            style={inputStyle}
                            required
                        />
                    </div>

                    <div>
                        <div style={labelStyle}>Date of Admission <span style={{ color: '#dc2626' }}>*</span></div>
                        <input
                            type="date"
                            value={formData.date_of_admission}
                            onChange={(e) => setFormData({ ...formData, date_of_admission: e.target.value })}
                            style={inputStyle}
                            required
                        />
                    </div>

                    <div>
                        <div style={labelStyle}>Category <span style={{ color: '#dc2626' }}>*</span></div>
                        <select
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            style={inputStyle}
                            required
                        >
                            <option value="">-- Select Category --</option>
                            <option value="General">General</option>
                            <option value="OBC">OBC</option>
                            <option value="SC">SC</option>
                            <option value="ST">ST</option>
                            <option value="EWS">EWS</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>

                    <div>
                        <div style={labelStyle}>RFID Code (Biometric Machine ID)</div>
                        <input
                            type="text"
                            placeholder="Enter RFID code (e.g. RFID_123)"
                            value={formData.rfid_code}
                            onChange={(e) => setFormData({ ...formData, rfid_code: e.target.value })}
                            style={inputStyle}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <div style={labelStyle}>Class <span style={{ color: '#dc2626' }}>*</span></div>
                            <select
                                value={formData.class_id}
                                onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                                required
                                style={inputStyle}
                            >
                                <option value="">-- Select Class --</option>
                                {mainClasses.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <div style={labelStyle}>Section <span style={{ color: '#dc2626' }}>*</span></div>
                            <select
                                value={formData.section_id}
                                onChange={(e) => setFormData({ ...formData, section_id: e.target.value })}
                                required
                                style={inputStyle}
                            >
                                <option value="">-- Select Section --</option>
                                {mainSections.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        style={{ backgroundColor: '#2563eb', color: '#fff', padding: '14px 20px', border: 'none', cursor: 'pointer', borderRadius: '12px', width: '100%', fontWeight: 1000, boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)', opacity: isSubmitting ? 0.7 : 1 }}
                    >
                        {isSubmitting ? 'Creating Student...' : 'Create Student'}
                    </button>
                </form>
                {message && <p style={{ color: message.startsWith('Error') ? '#dc2626' : 'green' }}>{message}</p>}
            </div>
        </div>
    );
};

export default AddStudent;


