import { useContext } from "react";
import { AuthContext, type AuthState } from "./authContext";

export function useAuth(): AuthState {
  const state = useContext(AuthContext);
  if (!state) {
    throw new Error("useAuth must be used inside <AuthProvider>.");
  }

  return state;
}
