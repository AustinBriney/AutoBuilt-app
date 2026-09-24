import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, setAuthToken } from './api.js';

const AuthContext = createContext(null);

const TOKEN_KEY = 'ab-token';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [business, setBusiness] = useState(undefined); // undefined = still checking
  const [error, setError] = useState(null);

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  useEffect(() => {
    if (!token) {
      setBusiness(null);
      return;
    }
    api.me()
      .then((res) => setBusiness(res.business))
      .catch(() => {
        // Stored token is expired/invalid — clear it and drop back to Login.
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setBusiness(null);
      });
  }, [token]);

  const finishAuth = useCallback((res) => {
    localStorage.setItem(TOKEN_KEY, res.token);
    setToken(res.token);
    setBusiness(res.business);
  }, []);

  const login = useCallback(async (email, password) => {
    setError(null);
    try {
      const res = await api.login({ email, password });
      finishAuth(res);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  }, [finishAuth]);

  const signup = useCallback(async (businessName, email, password) => {
    setError(null);
    try {
      const res = await api.signup({ businessName, email, password });
      finishAuth(res);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  }, [finishAuth]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setBusiness(null);
  }, []);

  const refreshBusiness = useCallback(() => {
    if (!token) return;
    return api.me().then((res) => setBusiness(res.business));
  }, [token]);

  return (
    <AuthContext.Provider value={{ token, business, error, login, signup, logout, refreshBusiness, setError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
