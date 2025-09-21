import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearToken, setToken } from '../api';

const AuthContext = createContext({
  user: null,
  loading: true,
  signIn: async () => {},
  register: async () => {},
  signOut: async () => {}
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await api('/me');
        setUser(data.user);
      } catch (err) {
        await clearToken();
        setUser(null);
        const isMissingToken = err?.status === 401 && String(err?.message).toLowerCase() === 'missing token';
        setBootError(isMissingToken ? null : err?.message || 'Request failed');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      bootError,
      signIn: async ({ email, password }) => {
        const data = await api('/auth/login', {
          method: 'POST',
          body: { email, password }
        });
        await setToken(data.token);
        setUser(data.user);
        setBootError(null);
        return data.user;
      },
      register: async ({ email, password, role }) => {
        const data = await api('/auth/register', {
          method: 'POST',
          body: { email, password, role }
        });
        await setToken(data.token);
        setUser(data.user);
        setBootError(null);
        return data.user;
      },
      signOut: async () => {
        await clearToken();
        setUser(null);
        setBootError(null);
      }
    }),
    [user, loading, bootError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
