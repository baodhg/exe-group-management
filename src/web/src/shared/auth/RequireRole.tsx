import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { ForbiddenPage } from "../../features/system/SystemPage";
import { useAuth } from "./useAuth";
import type { Role } from "./sessionStore";

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!roles.some((role) => user.roles.includes(role))) {
    return <ForbiddenPage />;
  }

  return children;
}
