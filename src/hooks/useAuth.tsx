import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { backend } from "@/lib/backend";
import type { Profile, SessionUser } from "@/types/domain";

interface AuthState {
  loading: boolean;
  user: SessionUser | null;
  profile: Profile | null;
  isAdmin: boolean;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, fullName: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const load = useCallback(async (u: SessionUser | null) => {
    if (!u) {
      setProfile(null);
      setIsAdmin(false);
      return;
    }
    const [p, admin] = await Promise.all([
      backend.getProfile(u.id),
      backend.hasRole(u.id, "admin"),
    ]);
    setProfile(p);
    setIsAdmin(admin);
  }, []);

  const refresh = useCallback(async () => {
    const u = await backend.getSessionUser();
    setUser(u);
    await load(u);
  }, [load]);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { user: u, error } = await backend.signIn(email, password);
      if (error) return error;
      setUser(u);
      await load(u);
      return null;
    },
    [load],
  );

  const signUp = useCallback(
    async (email: string, password: string, fullName: string) => {
      const { user: u, error } = await backend.signUp(email, password, fullName);
      if (error) return error;
      setUser(u);
      await load(u);
      return null;
    },
    [load],
  );

  const signOut = useCallback(async () => {
    await backend.signOut();
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ loading, user, profile, isAdmin, refresh, signIn, signUp, signOut }),
    [loading, user, profile, isAdmin, refresh, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
