import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const requiresBootstrap = false;

  const loadProfile = async (session) => {
    if (!session?.user) {
      setToken(null);
      setUser(null);
      return;
    }
    const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', session.user.id).maybeSingle();
    setToken(session.access_token);
    setUser({ _id: session.user.id, name: profile?.full_name || session.user.email, email: session.user.email, role: profile?.role || 'teacher' });
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setToken(null);
    setUser(null);
    setLoading(false);
  };

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => mounted && loadProfile(session).finally(() => mounted && setLoading(false)));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      loadProfile(session).finally(() => setLoading(false));
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  const login = async (credentials) => {
    const { data, error } = await supabase.auth.signInWithPassword(credentials);
    if (error) throw error;
    await loadProfile(data.session);
    return data.session.user;
  };

  const bootstrapAdmin = async (payload) => {
    const { data, error } = await supabase.auth.signUp({ email: payload.email, password: payload.password, options: { data: { full_name: payload.name } } });
    if (error) throw error;
    return data.user;
  };

  const registerUser = async (payload) => {
    const { data, error } = await supabase.functions.invoke('create-staff', { body: payload });
    if (error) throw error;
    if (data?.message) throw new Error(data.message);
    return data.user;
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        isAuthenticated: Boolean(token && user),
        requiresBootstrap,
        login,
        logout,
        bootstrapAdmin,
        registerUser,
        refreshBootstrapStatus: async () => {}
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
};
