import { createContext } from "react";
import type { ApiClient } from "../api/apiClient";
import type { Role, SessionUser } from "./sessionStore";

export interface AuthState {
  api: ApiClient;
  user: SessionUser | null;
  sessionEnded: boolean;
  signIn(email: string, password: string): Promise<SessionUser>;
  signOut(): void;
  reloadUser(): Promise<void>;
  hasRole(role: Role): boolean;
}

export const AuthContext = createContext<AuthState | null>(null);
