import { createContext, useContext, useMemo, useState, useEffect } from 'react';
import api, { setAdminToken } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('escola_admin_token');
    const n = localStorage.getItem('escola_admin_name');
    if (t) {
      setAdminToken(t);
      setAdmin({ token: t, username: n || 'admin' });
    }
    setReady(true);
  }, []);

  const login = async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    setAdminToken(data.token);
    localStorage.setItem('escola_admin_name', data.admin.username);
    setAdmin({ ...data.admin, token: data.token });
    return data;
  };

  const logout = () => {
    setAdminToken(null);
    localStorage.removeItem('escola_admin_name');
    setAdmin(null);
  };

  const value = useMemo(
    () => ({
      admin,
      ready,
      login,
      logout,
      isAuthed: !!admin?.token,
    }),
    [admin, ready]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside provider');
  return ctx;
}
