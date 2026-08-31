import { Suspense, lazy } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import ProtectedRoute from "./ProtectedRoute";

const Login = lazy(() => import("../pages/auth/Login"));
const LandingPage = lazy(() => import("../pages/LandingPage"));
const MobileGateway = lazy(() => import("../pages/auth/MobileGateway"));
const SaaSLanding = lazy(() => import("../pages/SaaSLanding"));

const StudentDashboard = lazy(() => import("../pages/student/Dashboard"));
const Notifications = lazy(() => import("../pages/student/Notifications"));
const StudentProfile = lazy(() => import("../pages/student/Profile"));
const StudentResults = lazy(() => import("../pages/student/Results"));
const StudentAssignments = lazy(() => import("../pages/student/Assignments"));
const StudentFees = lazy(() => import("../pages/student/Fees"));
const StudentFinanceCards = lazy(() => import("../pages/student/FinanceCards"));
const StudentLedger = lazy(() => import("../pages/student/Ledger"));
const StudentAttendance = lazy(() => import("../pages/student/Attendance"));
const StudentHolidays = lazy(() => import("../pages/student/Holidays"));
const StudentMessaging = lazy(() => import("../pages/student/Messaging"));
const StudentSyllabus = lazy(() => import("../pages/student/Syllabus"));
const StudentExams = lazy(() => import("../pages/student/Exams"));
const StudentShops = lazy(() => import("../pages/student/Shops"));

const TeacherDashboard = lazy(() => import("../pages/teacher/Dashboard"));
const TeacherProfile = lazy(() => import("../pages/teacher/Profile"));
const TeacherStudents = lazy(() => import("../pages/teacher/Students"));
const MarkAttendance = lazy(() => import("../pages/teacher/MarkAttendance"));
const UploadResult = lazy(() => import("../pages/teacher/UploadResult"));
const TeacherAssignment = lazy(() => import("../pages/teacher/Assignment"));
const TeacherAssignmentList = lazy(() => import("../pages/teacher/AssignmentList"));
const TeacherMessaging = lazy(() => import("../pages/teacher/Messaging"));
const TeacherHolidays = lazy(() => import("../pages/teacher/Holidays"));
const TeacherSyllabus = lazy(() => import("../pages/teacher/Syllabus"));
const TeacherMyAttendance = lazy(() => import("../pages/teacher/MyAttendance"));

const AddStudent = lazy(() => import("../pages/admin/AddStudent"));
const AdminDashboard = lazy(() => import("../pages/admin/Dashboard"));
const AddTeacher = lazy(() => import("../pages/admin/AddTeacher"));
const AdminProfile = lazy(() => import("../pages/admin/Profile"));
const ManageStudents = lazy(() => import("../pages/admin/ManageStudents"));
const ManageTeachers = lazy(() => import("../pages/admin/ManageTeachers"));
const AdminClasses = lazy(() => import("../pages/admin/Classes"));
const AdminSubjects = lazy(() => import("../pages/admin/Subjects"));
const AssignTeacher = lazy(() => import("../pages/admin/AssignTeacher"));
const AdminExams = lazy(() => import("../pages/admin/Exams"));
const PublishResults = lazy(() => import("../pages/admin/PublishResults"));
const AdminFees = lazy(() => import("../pages/admin/Fees"));
const AdminFinanceCards = lazy(() => import("../pages/admin/FinanceCards"));
const AdminHolidays = lazy(() => import("../pages/admin/Holidays"));
const AdminAnnouncements = lazy(() => import("../pages/admin/Announcements"));
const AdminReports = lazy(() => import("../pages/admin/Reports"));
const ShopLocations = lazy(() => import("../pages/admin/ShopLocations"));
const BulkImport = lazy(() => import("../pages/admin/BulkImport"));
const SubjectDetails = lazy(() => import("../pages/admin/SubjectDetails"));
const AdminSyllabus = lazy(() => import("../pages/admin/Syllabus"));
const AdminMessaging = lazy(() => import("../pages/admin/Messaging"));
const BiometricMachines = lazy(() => import("../pages/admin/BiometricMachines"));
const AdminTeacherAttendance = lazy(() => import("../pages/admin/TeacherAttendance"));

const GalleryPage = lazy(() => import("../pages/common/Gallery"));
const TimeTable = lazy(() => import("../pages/common/TimeTable"));
const SuperAdminLogin = lazy(() => import("../pages/superadmin/Login"));
const SuperAdminDashboard = lazy(() => import("../pages/superadmin/Dashboard"));
const SuperAdminProfile = lazy(() => import("../pages/superadmin/Profile"));
const DealerManagement = lazy(() => import("../pages/superadmin/DealerManagement"));
const DealerLogin = lazy(() => import("../pages/dealer/Login"));
const DealerDashboard = lazy(() => import("../pages/dealer/Dashboard"));
const DealerProfile = lazy(() => import("../pages/dealer/Profile"));

const RouteLoader = () => (
  <div role="status" aria-live="polite" style={{ padding: "2rem", textAlign: "center" }}>
    Loading…
  </div>
);

const AppRoutes = () => {
  const isMobileApp = Capacitor.getPlatform() !== "web";
  const location = useLocation();
  const isAuthenticated = !!localStorage.getItem("access_token");
  const role = localStorage.getItem("user_role");

  if (isAuthenticated && role) {
    const path = location.pathname;
    const isGuestPage = 
      path === "/" || 
      path === "/login" ||
      path === "/superadmin/login" ||
      path === "/dealer-login" ||
      path.match(/^\/school\/[^/]+\/?$/) ||
      path.match(/^\/school\/[^/]+\/login\/?$/);

    if (isGuestPage) {
      if (role === "admin") return <Navigate to="/admin/dashboard" replace />;
      if (role === "teacher") return <Navigate to="/teacher/dashboard" replace />;
      if (role === "student") return <Navigate to="/student/dashboard" replace />;
      if (role === "superadmin") return <Navigate to="/superadmin/dashboard" replace />;
      if (role === "dealer") return <Navigate to="/dealer/dashboard" replace />;
    }
  }

  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
      <Route
        path="/"
        element={
          isMobileApp ? (
            localStorage.getItem("mobile_school_id") ? (
              <Navigate to={`/school/${localStorage.getItem("mobile_school_id")}/login`} replace />
            ) : (
              <MobileGateway />
            )
          ) : (
            <SaaSLanding />
          )
        }
      />
      <Route path="/school/:schoolId" element={<LandingPage />} />
      <Route path="/school/:schoolId/login" element={<Login />} />
      <Route path="/login" element={<Navigate to="/" replace />} />

      {/* Superadmin */}
      <Route path="/superadmin/login" element={<SuperAdminLogin />} />
      <Route
        path="/superadmin/*"
        element={
          <ProtectedRoute allowedRoles={["superadmin"]}>
            <Routes>
              <Route path="dashboard" element={<SuperAdminDashboard />} />
              <Route path="dealers" element={<DealerManagement />} />
              <Route path="biometric-machines" element={<BiometricMachines />} />
              <Route path="profile" element={<SuperAdminProfile />} />
            </Routes>
          </ProtectedRoute>
        }
      />

      {/* Dealer */}
      <Route path="/dealer-login" element={<DealerLogin />} />
      <Route
        path="/dealer/*"
        element={
          <ProtectedRoute allowedRoles={["dealer"]}>
            <Routes>
              <Route path="dashboard" element={<DealerDashboard />} />
              <Route path="profile" element={<DealerProfile />} />
            </Routes>
          </ProtectedRoute>
        }
      />

      {/* Student */}
      <Route
        path="/student/*"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <Routes>
              <Route path="dashboard" element={<StudentDashboard />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="exams" element={<StudentExams />} />
              <Route path="profile" element={<StudentProfile />} />
              <Route path="results" element={<StudentResults />} />
              <Route path="results/exam" element={<StudentResults />} />
              <Route path="results/mst" element={<StudentResults />} />
              <Route path="assignments" element={<StudentAssignments />} />
              <Route path="timetable" element={<TimeTable />} />
              <Route path="attendance" element={<StudentAttendance />} />
              <Route path="fees" element={<StudentFees />} />
              <Route path="finance-cards" element={<StudentFinanceCards />} />
              <Route path="ledger" element={<StudentLedger />} />
              <Route path="holidays" element={<StudentHolidays />} />
              <Route path="syllabus" element={<StudentSyllabus />} />
              <Route path="messaging" element={<StudentMessaging />} />
              <Route path="shops" element={<StudentShops />} />
              <Route path="gallery" element={<GalleryPage />} />
            </Routes>
          </ProtectedRoute>
        }
      />

      {/* Teacher */}
      <Route
        path="/teacher/*"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <Routes>
              <Route path="dashboard" element={<TeacherDashboard />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="profile" element={<TeacherProfile />} />
              <Route path="students" element={<TeacherStudents />} />
              <Route path="attendance" element={<MarkAttendance />} />
              <Route path="upload-result" element={<UploadResult />} />
              <Route path="assignment" element={<TeacherAssignment />} />
              <Route path="assignments" element={<TeacherAssignmentList />} />
              <Route path="syllabus" element={<TeacherSyllabus />} />
              <Route path="messaging" element={<TeacherMessaging />} />
              <Route path="holidays" element={<TeacherHolidays />} />
              <Route path="my-attendance" element={<TeacherMyAttendance />} />
              <Route path="timetable" element={<TimeTable />} />
              <Route path="gallery" element={<GalleryPage />} />
            </Routes>
          </ProtectedRoute>
        }
      />

      {/* Admin */}
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <Routes>
              <Route path="add-student" element={<AddStudent />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="add-teacher" element={<AddTeacher />} />
              <Route path="profile" element={<AdminProfile />} />
              <Route path="manage-students" element={<ManageStudents />} />
              <Route path="manage-teachers" element={<ManageTeachers />} />
              <Route path="classes" element={<AdminClasses />} />
              <Route path="assign-teacher" element={<AssignTeacher />} />
              <Route path="subjects" element={<AdminSubjects />} />
              <Route path="subjects/:subjectId" element={<SubjectDetails />} />
              <Route path="exams" element={<AdminExams />} />
              <Route path="publish-results" element={<PublishResults />} />
              <Route path="announcements" element={<AdminAnnouncements />} />
              <Route path="fees" element={<AdminFees />} />
              <Route path="finance-cards" element={<AdminFinanceCards />} />
              <Route path="holidays" element={<AdminHolidays />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="shops" element={<ShopLocations />} />
              <Route path="bulk-import" element={<BulkImport />} />
              <Route path="timetable" element={<TimeTable />} />
              <Route path="syllabus" element={<AdminSyllabus />} />
              <Route path="messaging" element={<AdminMessaging />} />
              <Route path="biometric-machines" element={<BiometricMachines />} />
              <Route path="teacher-attendance" element={<AdminTeacherAttendance />} />
              <Route path="gallery" element={<GalleryPage />} />
            </Routes>
          </ProtectedRoute>
        }
      />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
