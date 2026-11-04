import { NavLink, Outlet, useNavigate } from "react-router";
import { useAuth } from "../auth/useAuth";

const links = [
  { to: "/student", label: "Sinh viên", role: "Student" },
  { to: "/lecturer", label: "Giảng viên", role: "Lecturer" },
  { to: "/admin", label: "Quản trị", role: "Administrator" },
  { to: "/admin/semesters", label: "Học kỳ", role: "Administrator" },
] as const;

export function AppLayout() {
  const { user, hasRole, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="shell">
      <header className="topbar">
        <strong>EXE Group Management</strong>
        <nav>
          {links
            .filter((link) => hasRole(link.role))
            .map((link) => (
              <NavLink key={link.to} to={link.to} end>
                {link.label}
              </NavLink>
            ))}
        </nav>
        <span className="who">{user?.roles.join(", ")}</span>
        <button
          type="button"
          onClick={() => {
            signOut();
            navigate("/login");
          }}
        >
          Đăng xuất
        </button>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
