# 🎓 School Conduct — Multi-Tenant School Management System (ERP & Mobile)

[![Django](https://img.shields.io/badge/Django-5.2+-092E20?style=for-the-badge&logo=django&logoColor=white)](https://www.djangoproject.com/)
[![Django REST Framework](https://img.shields.io/badge/DRF-3.15+-red?style=for-the-badge&logo=django&logoColor=white)](https://www.django-rest-framework.org/)
[![React](https://img.shields.io/badge/React-18.2+-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.2+-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Capacitor](https://img.shields.io/badge/Capacitor-8.4+-119EFF?style=for-the-badge&logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![Android](https://img.shields.io/badge/Android-APK%20%2F%20AAB-3DDC84?style=for-the-badge&logo=android&logoColor=white)](https://developer.android.com/)
[![License](https://img.shields.io/badge/License-Proprietary-blue?style=for-the-badge)](#)

---

## 📌 Overview

**School Conduct** is an enterprise-grade, multi-tenant School Management ERP and Mobile ecosystem designed for educational institutions, academies, and school chains. It streamlines every aspect of school operations — including academic planning, fee accounting, biometric attendance with direct hardware push, dynamic PDF report card generation, real-time communication, and native Android background push notifications.

---

## 🌟 Key Architecture & Highlights

```
                       +-----------------------------+
                       |    Super Admin & Dealer     |
                       |       SaaS Dashboard        |
                       +--------------+--------------+
                                      |
             +------------------------+------------------------+
             |                                                 |
+------------v------------+                       +------------v------------+
|   School Management     |                       |   Biometric Devices     |
|   (Admin / Principal)   |                       |   (SBXPC / ZKTeco / M50)|
+------------+------------+                       +------------+------------+
             |                                                 | TCP Push (Port 5555)
             |                                                 v
+------------v------------+                       +------------+------------+
|  Teachers & Faculty     | <===================> | Django REST Framework   |
+------------+------------+      REST APIs        | Backend + PostgreSQL/   |
             |                   JWT Auth         | SQLite Database         |
+------------v------------+                       +------------+------------+
|   Students & Parents    |                                    ^
|  (Web & Android App)    | <==================================+
+-------------------------+      Native Background Sync (5s Polling)
```

- **Multi-Tenant SaaS Foundation**: Complete isolation of schools/branches with customizable domains/subdomains, branding, and tenant-level configurations.
- **Hardware-Integrated Biometrics**: Built-in high-performance TCP XML direct-push server (Port `5555`) to receive live punches from biometric devices (M50, SBXPC, ZKTeco) without requiring LAN middleware.
- **Native Android Notification System**: Lightweight, zero-third-party-dependency background service built inside Capacitor Android with foreground polling, high-priority heads-up banners, sound, and vibration.
- **Automated Marksheet & PDF Engine**: ReportLab-powered dynamic student report card generation with customizable grade systems, remarks, signatures, and school letterheads.
- **Robust Role-Based Access Control (RBAC)**: Secure access tailored for Super Admins, Franchise Dealers, School Admins, Teachers, Students, and Parents.

---

## 👥 Role-Based Modules & Features

### 🏢 1. Super Admin Portal
- Multi-school tenant provisioning and domain mapping.
- Global analytics, active school licenses, and dealer management.
- Subscription billing and package allocations.

### 💼 2. Dealer / Reseller Portal
- Regional onboarded schools overview.
- Revenue tracking, commissions, and dealer performance metrics.
- Instant tenant onboarding assist.

### 🏫 3. School Admin & Management
- **Academic Setup**: Academic years, classes, sections, subjects, and curriculum tracks.
- **Student & Staff Management**: Profile management, bulk CSV student/teacher upload, document archival.
- **Biometric & Attendance Management**: Real-time punch monitor, manual punch overrides, leave approval workflows, and teacher/student monthly attendance sheets.
- **Fee Management**: Custom fee structures, installment schedules, online/offline fee collection, automated receipts, discount waivers, and balance tracking.
- **Timetable & Scheduling**: Class-wise and teacher-wise period scheduling with conflict detection.
- **Examinations & Grading**: Exam timetable creation, multi-term marks recording, tabulation sheets, and instant PDF marksheet export.
- **Communication & Circulars**: Broadcast notices, targeted announcements (All/Teachers/Students), event calendar, and school photo gallery.

### 👨‍🏫 4. Teacher Portal
- Daily student attendance marking (subject-wise or class-wise).
- Assignment posting with file attachments, deadlines, and online grading.
- Syllabus progress tracking and lesson completion logs.
- Class timetable view and leave application portal.
- Student doubt resolution and direct chat with students/parents.

### 🎓 5. Student & Parent Portal
- **Dashboard**: Quick snapshot of attendance percentage, upcoming exams, homework, and fee status.
- **Academics**: View homework assignments, syllabus completion status, and timetable.
- **Attendance**: Detailed calendar view showing present, absent, holiday, and late marks.
- **Fees**: View pending installments, download payment receipts, and review fee history.
- **Exams & Report Cards**: Access exam date sheets and download term marksheets (PDF).
- **Communication**: Receive real-time circulars, submit doubts to subject teachers, and browse school gallery memories.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Backend Framework** | [Django 5.2+](https://www.djangoproject.com/) • [Django REST Framework](https://www.django-rest-framework.org/) |
| **Authentication** | [SimpleJWT (JSON Web Tokens)](https://django-rest-framework-simplejwt.readthedocs.io/) |
| **Frontend Framework** | [React 18.2](https://react.dev/) • [Vite](https://vitejs.dev/) • [React Router v7](https://reactrouter.com/) |
| **State Management & UI** | [Zustand](https://github.com/pmndrs/zustand) • [Lucide Icons](https://lucide.dev/) • [Recharts](https://recharts.org/) • [React Hot Toast](https://react-hot-toast.com/) |
| **Mobile Runtime** | [Capacitor 8.4](https://capacitorjs.com/) (Native Android SDK, APK & AAB) |
| **Database** | [PostgreSQL](https://www.postgresql.org/) (Production) • [SQLite](https://www.sqlite.org/) (Local Dev) |
| **Media & Asset Storage** | [Cloudinary](https://cloudinary.com/) (Media & Static uploads) |
| **PDF Generation** | [ReportLab](https://www.reportlab.com/) |
| **Hardware / IoT** | Custom TCP/XML Server (`pyzk`, plain socket listener on Port 5555) |
| **Production Web Server** | [Gunicorn](https://gunicorn.org/) • [WhiteNoise](https://whitenoise.readthedocs.io/) • [Nginx](https://nginx.org/) |

---

## 📂 Project Structure

```text
school-management-system/
├── backend/                        # Django REST API Backend
│   ├── academics/                  # Exams, grading, syllabus, and marksheets
│   ├── accounts/                   # User authentication, profiles, and JWT
│   ├── announcements/              # School notices and broadcast feeds
│   ├── assignments/                # Homework creation, submission & grading
│   ├── attendance/                 # Student/teacher attendance & punch logs
│   ├── biometric_bridge.py         # Biometric hardware sync script
│   ├── bulk_upload/                # CSV import tools for users & data
│   ├── classes/                    # Class and section configurations
│   ├── communication/              # Notifications, messaging & doubts
│   ├── config/                     # Django root settings, URLs, and ASGI/WSGI
│   ├── dealers/                    # SaaS reseller/dealer management
│   ├── enquiries/                  # Admission enquiries & leads
│   ├── fees/                       # Fee heads, collection, and receipts
│   ├── gallery/                    # School image & event albums
│   ├── holidays/                   # Academic calendar & holiday lists
│   ├── leaves/                     # Staff & student leave workflows
│   ├── reports/                    # Administrative analytics & exports
│   ├── scripts/                    # Management scripts & automation
│   ├── shops/                      # Uniform/book inventory management
│   ├── students/                   # Student models & profiles
│   ├── subjects/                   # Subject configurations & allocations
│   ├── syllabus/                   # Chapter-wise curriculum planning
│   ├── teachers/                   # Teacher profiles & allocations
│   ├── tenants/                    # Multi-tenancy isolation logic
│   ├── timetable/                  # Class & teacher schedule engines
│   ├── manage.py                   # Django management CLI
│   └── requirements.txt            # Python dependencies
│
├── frontend/                       # React + Vite Single Page Application
│   ├── android/                    # Native Android Capacitor Project
│   ├── public/                     # Static icons, logos, and manifests
│   ├── src/
│   │   ├── components/             # Reusable UI widgets, tables, modals
│   │   ├── context/                # React context providers
│   │   ├── hooks/                  # Custom React hooks
│   │   ├── layouts/                # Role-specific dashboard layouts
│   │   ├── pages/
│   │   │   ├── admin/              # School admin screens
│   │   │   ├── auth/               # Login, forgot password screens
│   │   │   ├── common/             # Shared profile & settings screens
│   │   │   ├── dealer/             # Dealer portal screens
│   │   │   ├── student/            # Student & parent portal screens
│   │   │   ├── superadmin/         # SaaS master admin screens
│   │   │   ├── teacher/            # Teacher portal screens
│   │   │   └── LandingPage.jsx     # Public school/product landing page
│   │   ├── routes/                 # App route definitions & guards
│   │   ├── services/               # Axios API service layers
│   │   ├── store/                  # Zustand global state stores
│   │   └── utils/                  # Formatters, helpers, and constants
│   ├── package.json                # NPM packages & build scripts
│   └── vite.config.js              # Vite configuration
│
├── BIOMETRIC_DIRECT_PUSH.md        # Biometric hardware integration guide
├── MOBILE_NOTIFICATIONS.md         # Native Android background service docs
└── requirements.txt                # Root requirements
```

---

## 🚀 Getting Started (Local Development)

### 📋 Prerequisites
- **Python**: `3.10` or higher
- **Node.js**: `18.x` or higher (with `npm`)
- **Android Studio** (Optional, for building Android APK/AAB)

---

### 1️⃣ Backend Setup

1. **Navigate to the backend folder**:
   ```bash
   cd school-management-system/backend
   ```

2. **Create and activate a virtual environment**:
   ```bash
   # Windows (PowerShell)
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1

   # Linux / macOS
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and fill in the necessary keys:
   ```bash
   cp .env.example .env
   ```
   *Key variables:*
   ```env
   SECRET_KEY=your-django-secret-key
   DEBUG=True
   ALLOWED_HOSTS=*
   DATABASE_URL=sqlite:///db.sqlite3
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

5. **Run Migrations & Seed Data**:
   ```bash
   python manage.py migrate
   python manage.py createsuperuser
   ```

6. **Start the Development Server**:
   ```bash
   python manage.py runserver 0.0.0.0:8000
   ```
   *The API will be live at `http://localhost:8000/api/`*

---

### 2️⃣ Frontend Setup

1. **Navigate to the frontend folder**:
   ```bash
   cd ../frontend
   ```

2. **Install Node modules**:
   ```bash
   npm install
   ```

3. **Start the Vite Dev Server**:
   ```bash
   npm run dev
   ```
   *The Web application will open at `http://localhost:5173/`*

---

### 3️⃣ Biometric Direct Push Service (Port 5555)

For live biometric attendance integration:
```bash
python manage.py run_biometric_tcp_server
```
*Make sure TCP Port `5555` is open in your server firewall / AWS Security Group.*

---

## 📱 Mobile App (Android Build & Sync)

The application includes a fully configured Capacitor Android project with background notification polling.

1. **Build the frontend bundle**:
   ```bash
   cd frontend
   npm run build
   ```

2. **Sync with Android container**:
   ```bash
   npx cap sync android
   ```

3. **Open in Android Studio & Build APK/AAB**:
   ```bash
   npx cap open android
   ```
   *From Android Studio: `Build` -> `Generate Signed Bundle / APK`*

---

## 🔐 Security & Reliability Best Practices

- **Token-Based JWT Security**: Stateless authentication with automatic token refresh on client and background services.
- **Tenant Data Isolation**: Database queries strictly filter across `tenant` context to ensure zero cross-school data exposure.
- **Biometric De-duplication**: Strict timestamp and device serial hashing prevent duplicate punch entries from unstable internet connections.
- **Fault-Tolerant Native Sync**: Custom `BackgroundNotificationService` runs as a sticky foreground service with low battery overhead and exponential recovery.

---

## 📄 Documentation Links
- [Biometric Hardware Integration (Direct TCP)](./BIOMETRIC_DIRECT_PUSH.md)
- [Native Android Background Notification Architecture](./MOBILE_NOTIFICATIONS.md)

---

## 👨‍💻 Author & Support

Developed with ❤️ by **Eagle in Cloud** / **School Conduct Team**.  
For support, customization, or inquiries, please contact the development team.
