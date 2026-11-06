import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { Toaster } from "@/components/ui/sonner";
import { LoginPage } from "../features/auth/LoginPage";
import { catalogs } from "../features/admin/catalogs";
import { DialogsProvider } from "../features/common/dialogs";
import { ConnectionStatus } from "../features/realtime/ConnectionStatus";
import { NotificationBell } from "../features/realtime/NotificationBell";
import { RealtimeProvider } from "../features/realtime/RealtimeProvider";
import { AuthProvider } from "../shared/auth/AuthProvider";
import { RequireRole } from "../shared/auth/RequireRole";
import { AppLayout } from "../shared/layout/AppLayout";

const AdminCoursePage = lazy(() => import("../features/admin/AdminCoursePage").then((module) => ({ default: module.AdminCoursePage })));
const CatalogPage = lazy(() => import("../features/admin/CatalogPage").then((module) => ({ default: module.CatalogPage })));
const CoursesPage = lazy(() => import("../features/admin/CoursesPage").then((module) => ({ default: module.CoursesPage })));
const GroupTypesPage = lazy(() => import("../features/admin/GroupTypesPage").then((module) => ({ default: module.GroupTypesPage })));
const UsersPage = lazy(() => import("../features/admin/UsersPage").then((module) => ({ default: module.UsersPage })));
const AdminHomePage = lazy(() => import("../features/home/AdminHomePage").then((module) => ({ default: module.AdminHomePage })));
const NotificationsPage = lazy(() => import("../features/realtime/NotificationsPage").then((module) => ({ default: module.NotificationsPage })));
const LecturerCoursePage = lazy(() => import("../features/lecturer/LecturerCoursePage").then((module) => ({ default: module.LecturerCoursePage })));
const RoomPage = lazy(() => import("../features/rooms/RoomPage").then((module) => ({ default: module.RoomPage })));
const SemestersPage = lazy(() => import("../features/semesters/SemestersPage").then((module) => ({ default: module.SemestersPage })));
const SkillsPage = lazy(() => import("../features/student/SkillsPage").then((module) => ({ default: module.SkillsPage })));
const StudentCoursePage = lazy(() => import("../features/student/StudentCoursePage").then((module) => ({ default: module.StudentCoursePage })));
const MyCoursesPage = lazy(() => import("../features/home/MyCoursesPage").then((module) => ({ default: module.MyCoursesPage })));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RealtimeProvider>
          <DialogsProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route element={<AppLayout actions={<NotificationBell />} status={<ConnectionStatus />} />}>
                  <Route path="/student" element={<RequireRole roles={["Student"]}><MyCoursesPage area="student" /></RequireRole>} />
                  <Route path="/student/courses/:courseId" element={<RequireRole roles={["Student"]}><StudentCoursePage /></RequireRole>} />
                  <Route path="/student/semesters/:semesterId/skills" element={<RequireRole roles={["Student"]}><SkillsPage /></RequireRole>} />
                  <Route path="/notifications" element={<RequireRole roles={["Student", "Lecturer", "Administrator"]}><NotificationsPage /></RequireRole>} />
                  <Route path="/rooms/:roomId" element={<RequireRole roles={["Student", "Lecturer", "Administrator"]}><RoomPage /></RequireRole>} />
                  <Route path="/lecturer" element={<RequireRole roles={["Lecturer"]}><MyCoursesPage area="lecturer" /></RequireRole>} />
                  <Route path="/lecturer/courses/:courseId" element={<RequireRole roles={["Lecturer"]}><LecturerCoursePage /></RequireRole>} />
                  <Route path="/admin" element={<RequireRole roles={["Administrator"]}><AdminHomePage /></RequireRole>} />
                  <Route path="/admin/semesters" element={<RequireRole roles={["Administrator"]}><SemestersPage /></RequireRole>} />
                  <Route path="/admin/subjects" element={<RequireRole roles={["Administrator"]}><CatalogPage key="subjects" config={catalogs.subjects} /></RequireRole>} />
                  <Route path="/admin/majors" element={<RequireRole roles={["Administrator"]}><CatalogPage key="majors" config={catalogs.majors} /></RequireRole>} />
                  <Route path="/admin/skills" element={<RequireRole roles={["Administrator"]}><CatalogPage key="skills" config={catalogs.skills} /></RequireRole>} />
                  <Route path="/admin/group-types" element={<RequireRole roles={["Administrator"]}><GroupTypesPage /></RequireRole>} />
                  <Route path="/admin/users" element={<RequireRole roles={["Administrator"]}><UsersPage /></RequireRole>} />
                  <Route path="/admin/courses" element={<RequireRole roles={["Administrator"]}><CoursesPage /></RequireRole>} />
                  <Route path="/admin/courses/:courseId" element={<RequireRole roles={["Administrator"]}><AdminCoursePage /></RequireRole>} />
                </Route>
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </BrowserRouter>
            <Toaster position="bottom-right" closeButton />
          </DialogsProvider>
        </RealtimeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
