import { useCallback, useMemo, useState, type ReactNode } from "react";
import { createApiClient } from "../api/apiClient";
import { AuthContext, type AuthState } from "./authContext";
import { browserSessionStore, decodeUser, type SessionUser, type StoredSession } from "./sessionStore";

function currentUser(): SessionUser | null {
  const session = browserSessionStore.read();
  return session ? decodeUser(session.accessToken) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(currentUser);

  const signOut = useCallback(() => {
    browserSessionStore.clear();
    setUser(null);
  }, []);

  const api = useMemo(
    () => createApiClient({ store: browserSessionStore, onSignedOut: () => setUser(null) }),
    [],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await api.post<StoredSession>("/api/v1/auth/login", { email, password });
      browserSessionStore.write(result.data);
      const signedIn = decodeUser(result.data.accessToken);
      if (!signedIn) {
        throw new Error("The access token could not be read.");
      }

      setUser(signedIn);
      return signedIn;
    },
    [api],
  );

  const value = useMemo<AuthState>(
    () => ({ api, user, signIn, signOut, hasRole: (role) => user?.roles.includes(role) ?? false }),
    [api, user, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
