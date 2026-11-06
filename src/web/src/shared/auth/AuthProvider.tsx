import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { createApiClient, loginPath } from "../api/apiClient";
import { AuthContext, type AuthState } from "./authContext";
import { browserSessionStore, decodeUser, type SessionUser, type StoredSession } from "./sessionStore";

function currentUser(): SessionUser | null {
  const session = browserSessionStore.read();
  return session ? decodeUser(session.accessToken) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<SessionUser | null>(currentUser);
  const [sessionEnded, setSessionEnded] = useState(false);

  const forgetUser = useCallback(() => {
    queryClient.clear();
    setUser(null);
  }, [queryClient]);

  const api = useMemo(
    () => createApiClient({
        store: browserSessionStore,
        onSignedOut: () => {
          setSessionEnded(true);
          forgetUser();
        },
      }),
    [forgetUser],
  );

  const signOut = useCallback(() => {
    setSessionEnded(false);
    void api.signOut();
    forgetUser();
  }, [api, forgetUser]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await api.post<StoredSession>(loginPath, { email, password });
      browserSessionStore.write(result.data);
      const signedIn = decodeUser(result.data.accessToken);
      if (!signedIn) {
        throw new Error("The access token could not be read.");
      }

      setSessionEnded(false);
      setUser(signedIn);
      return signedIn;
    },
    [api],
  );

  const reloadUser = useCallback(async () => {
    const session = await api.renewSession();
    const renewed = session && decodeUser(session.accessToken);
    if (renewed) {
      setUser(renewed);
    }

    return Boolean(renewed);
  }, [api]);

  const value = useMemo<AuthState>(
    () => ({ api, user, sessionEnded, signIn, signOut, reloadUser, hasRole: (role) => user?.roles.includes(role) ?? false }),
    [api, user, sessionEnded, signIn, signOut, reloadUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
