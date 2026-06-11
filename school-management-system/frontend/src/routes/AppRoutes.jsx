import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import Login from "../pages/auth/Login";
import LandingPage from "../pages/LandingPage";
import ProtectedRoute from "./ProtectedRoute";
import MobileGateway from "../pages/auth/MobileGateway";

// Student
import StudentDashboard from "../pages/student/Dashboard";
import Notifications from "../pages/student/Notifications";
import StudentProfile from "../pages/student/Profile";
import StudentResults from "../pages/student/Results";
import StudentAssignments from "../pages/student/Assignments";
import StudentTimetable from "../pages/student/Timetable";
import StudentFees from "../pages/student/Fees";
import StudentFinanceCards from "../pages/student/FinanceCards";
import StudentLedger from "../pages/student/Ledger";
import StudentAttendance from "../pages/student/Attendance";
import StudentHolidays from "../pages/student/Holidays";
import StudentMessaging from "../pages/student/Messaging";
import StudentSyllabus from "../pages/student/Syllabus";
import StudentExams from "../pages/student/Exams";
import GalleryPage from "../pages/common/Gallery";

// Teacher
import TeacherDashboard from "../pages/teacher/Dashboard";
import TeacherProfile from "../pages/teacher/Profile";
import TeacherStudents from "../pages/teacher/Students";
import MarkAttendance from "../pages/teacher/MarkAttendance";
import UploadResult from "../pages/teacher/UploadResult";
import TeacherAssignment from "../pages/teacher/Assignment";
import TeacherAssignmentList from "../pages/teacher/AssignmentList";
import TeacherMessaging from "../pages/teacher/Messaging";
import TeacherHolidays from "../pages/teacher/Holidays";
import TeacherSyllabus from "../pages/teacher/Syllabus";
import TeacherMyAttendance from "../pages/teacher/MyAttendance";

// Admin
import AddStudent from "../pages/admin/AddStudent";
import AdminDashboard from "../pages/admin/Dashboard";
import AddTeacher from "../pages/admin/AddTeacher";
import AdminProfile from "../pages/admin/Profile";
import ManageStudents from "../pages/admin/ManageStudents";
import ManageTeachers from "../pages/admin/ManageTeachers";
import AdminClasses from "../pages/admin/Classes";
import AdminSubjects from "../pages/admin/Subjects";
import AssignTeacher from "../pages/admin/AssignTeacher";
import AdminExams from "../pages/admin/Exams";
import PublishResults from "../pages/admin/PublishResults";
import AdminFees from "../pages/admin/Fees";
import AdminFinanceCards from "../pages/admin/FinanceCards";
import AdminHolidays from "../pages/admin/Holidays";
import AdminAnnouncements from "../pages/admin/Announcements";
import AdminReports from "../pages/admin/Reports";
import ShopLocations from "../pages/admin/ShopLocations";
import StudentShops from "../pages/student/Shops";
import BulkImport from "../pages/admin/BulkImport";
import SubjectDetails from "../pages/admin/SubjectDetails";
import TimeTable from "../pages/common/TimeTable";
import AdminSyllabus from "../pages/admin/Syllabus";
import AdminMessaging from "../pages/admin/Messaging";
import BiometricMachines from "../pages/admin/BiometricMachines";
import AdminTeacherAttendance from "../pages/admin/TeacherAttendance";

import SaaSLanding from "../pages/SaaSLanding";
import SuperAdminLogin from "../pages/superadmin/Login";
import SuperAdminDashboard from "../pages/superadmin/Dashboard";
import SuperAdminProfile from "../pages/superadmin/Profile";
import DealerManagement from "../pages/superadmin/DealerManagement";

import DealerLogin from "../pages/dealer/Login";
import DealerDashboard from "../pages/dealer/Dashboard";
import DealerProfile from "../pages/dealer/Profile";

const AppRoutes = () => {
  const isMobileApp = Capacitor.getPlatform() !== "web";

  return (
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
  );
};

export default AppRoutes;
