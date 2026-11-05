import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { LoginPage } from "../features/auth/LoginPage";
import { AdminHomePage } from "../features/home/AdminHomePage";
import { MyCoursesPage } from "../features/home/MyCoursesPage";
import { SemestersPage } from "../features/semesters/SemestersPage";
import { AuthProvider } from "../shared/auth/AuthProvider";
import { RequireRole } from "../shared/auth/RequireRole";
import { AppLayout } from "../shared/layout/AppLayout";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<AppLayout />}>
              <Route path="/student" element={<RequireRole roles={["Student"]}><MyCoursesPage area="student" /></RequireRole>} />
              <Route path="/lecturer" element={<RequireRole roles={["Lecturer"]}><MyCoursesPage area="lecturer" /></RequireRole>} />
              <Route path="/admin" element={<RequireRole roles={["Administrator"]}><AdminHomePage /></RequireRole>} />
              <Route path="/admin/semesters" element={<RequireRole roles={["Administrator"]}><SemestersPage /></RequireRole>} />
            </Route>
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
