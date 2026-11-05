import type { Role } from "./sessionStore";

export function homeFor(roles: Role[]): string {
  if (roles.includes("Administrator")) {
    return "/admin";
  }

  if (roles.includes("Lecturer")) {
    return "/lecturer";
  }

  return "/student";
}
