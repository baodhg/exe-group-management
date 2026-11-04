export interface StoredSession {
  accessToken: string;
  refreshToken: string;
}

export interface SessionStore {
  read(): StoredSession | null;
  write(session: StoredSession): void;
  clear(): void;
}

const storageKey = "exe-group.session";

export const browserSessionStore: SessionStore = {
  read() {
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as StoredSession) : null;
    } catch {
      return null;
    }
  },
  write(session) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(session));
    } catch {
      return;
    }
  },
  clear() {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      return;
    }
  },
};

export type Role = "Student" | "Lecturer" | "Administrator";

export interface SessionUser {
  userId: string;
  roles: Role[];
  expiresAt: number;
}

export function decodeUser(accessToken: string): SessionUser | null {
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) {
      return null;
    }

    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as {
      sub?: string;
      role?: string | string[];
      exp?: number;
    };
    const roles = (Array.isArray(json.role) ? json.role : json.role ? [json.role] : []) as Role[];
    return json.sub && json.exp ? { userId: json.sub, roles, expiresAt: json.exp * 1000 } : null;
  } catch {
    return null;
  }
}
