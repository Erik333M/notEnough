import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { api, type ApiUser } from '../api/client';
import { secureDelete, secureGet, secureSet } from '../lib/secure';
import { readJSON, removeKey, storageKeys, writeJSON } from '../lib/storage';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

type AuthResult =
  | { ok: true }
  | { ok: false; field: 'name' | 'email' | 'password' | 'network'; message: string };

type AuthContextValue = {
  status: AuthStatus;
  user: ApiUser | null;
  token: string | null;
  /** True when running on a cached session because the server was unreachable. */
  offline: boolean;
  register: (name: string, email: string, password: string) => Promise<AuthResult>;
  login: (email: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  rename: (name: string) => Promise<AuthResult>;
  deleteAccount: () => Promise<void>;
  /** Called by the sync layer when the server rejects the token. */
  invalidateSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Authentication against the API, with a deliberate offline rule:
 *
 *   first sign-in requires the server; after that the session survives without it.
 *
 * The token lives in SecureStore (Keychain / Keystore), the profile in
 * AsyncStorage. On boot we validate the token against `/me`; if that request
 * fails because the network is down we open the app on the cached profile and
 * flag `offline`. Only an actual 401 signs the user out — otherwise a flaky
 * train tunnel would log people out of their own fitness data.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<ApiUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [storedToken, cachedUser] = await Promise.all([
        secureGet<string | null>(storageKeys.token, null),
        readJSON<ApiUser | null>(storageKeys.cachedUser, null),
      ]);

      if (cancelled || !mounted.current) return;

      if (!storedToken) {
        setStatus('signedOut');
        return;
      }

      // Open immediately on the cached profile, then confirm in the background:
      // a valid session should never wait on a network round trip to paint.
      if (cachedUser) {
        setUser(cachedUser);
        setToken(storedToken);
        setStatus('signedIn');
      }

      const result = await api.me(storedToken);
      if (cancelled || !mounted.current) return;

      if (result.ok) {
        setUser(result.data.user);
        setToken(storedToken);
        setOffline(false);
        setStatus('signedIn');
        void writeJSON(storageKeys.cachedUser, result.data.user);
        return;
      }

      if (result.error.kind === 'offline') {
        if (cachedUser) {
          setOffline(true);
          setStatus('signedIn');
        } else {
          // Token but no cached profile and no server: nothing to show.
          setStatus('signedOut');
        }
        return;
      }

      // 401 or any other definitive rejection — the session is genuinely dead.
      await secureDelete(storageKeys.token);
      await removeKey(storageKeys.cachedUser);
      setUser(null);
      setToken(null);
      setStatus('signedOut');
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const acceptSession = useCallback(async (nextToken: string, nextUser: ApiUser) => {
    await Promise.all([
      secureSet(storageKeys.token, nextToken),
      writeJSON(storageKeys.cachedUser, nextUser),
    ]);
    if (!mounted.current) return;
    setToken(nextToken);
    setUser(nextUser);
    setOffline(false);
    setStatus('signedIn');
  }, []);

  const register = useCallback<AuthContextValue['register']>(
    async (name, email, password) => {
      const result = await api.register(name.trim(), email.trim(), password);
      if (result.ok) {
        await acceptSession(result.data.token, result.data.user);
        return { ok: true };
      }
      return {
        ok: false,
        field: result.error.field ?? (result.error.kind === 'offline' ? 'network' : 'email'),
        message: result.error.message,
      };
    },
    [acceptSession],
  );

  const login = useCallback<AuthContextValue['login']>(
    async (email, password) => {
      const result = await api.login(email.trim(), password);
      if (result.ok) {
        await acceptSession(result.data.token, result.data.user);
        return { ok: true };
      }
      return {
        ok: false,
        field: result.error.field ?? (result.error.kind === 'offline' ? 'network' : 'password'),
        message: result.error.message,
      };
    },
    [acceptSession],
  );

  const clearSession = useCallback(async () => {
    await Promise.all([secureDelete(storageKeys.token), removeKey(storageKeys.cachedUser)]);
    if (!mounted.current) return;
    setUser(null);
    setToken(null);
    setOffline(false);
    setStatus('signedOut');
  }, []);

  const rename = useCallback<AuthContextValue['rename']>(
    async (name) => {
      if (!token) {
        return { ok: false, field: 'network', message: 'Sign in again to change your name.' };
      }
      const result = await api.updateName(token, name.trim());
      if (!result.ok) {
        return {
          ok: false,
          field: result.error.field ?? (result.error.kind === 'offline' ? 'network' : 'name'),
          message: result.error.message,
        };
      }
      await writeJSON(storageKeys.cachedUser, result.data.user);
      if (mounted.current) setUser(result.data.user);
      return { ok: true };
    },
    [token],
  );

  const deleteAccount = useCallback(async () => {
    const activeToken = token;
    const activeUser = user;
    if (activeToken) await api.deleteAccount(activeToken);
    if (activeUser) {
      await Promise.all([
        removeKey(storageKeys.appState(activeUser.id)),
        removeKey(storageKeys.syncStamp(activeUser.id)),
      ]);
    }
    await clearSession();
  }, [clearSession, token, user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      token,
      offline,
      register,
      login,
      logout: clearSession,
      rename,
      deleteAccount,
      invalidateSession: clearSession,
    }),
    [status, user, token, offline, register, login, clearSession, rename, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
