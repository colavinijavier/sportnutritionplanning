// SportNutritionPlanning — Auth module
// Wraps Supabase. Falls back to "guest mode" (localStorage only) if Supabase isn't configured.
//
// Usage:
//   await SNP.auth.init();
//   const user = await SNP.auth.getUser();      // null if not signed in
//   await SNP.auth.signInWithMagicLink(email);
//   await SNP.auth.signInWithGoogle();
//   await SNP.auth.signOut();
//   SNP.auth.onChange(callback);                // fires on auth state changes

(function (global) {
  const state = {
    client: null,
    user: null,
    config: null,
    listeners: [],
    ready: false
  };

  async function loadConfig() {
    try {
      const res = await fetch('/.netlify/functions/config');
      state.config = await res.json();
    } catch (e) {
      state.config = { supabase: { url: '', anonKey: '' }, features: { authEnabled: false } };
    }
  }

  async function loadSupabaseSDK() {
    if (window.supabase) return;
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function init() {
    if (state.ready) return;
    await loadConfig();
    if (!state.config.features || !state.config.features.authEnabled) {
      state.ready = true;
      notify();
      return;
    }
    await loadSupabaseSDK();
    state.client = window.supabase.createClient(state.config.supabase.url, state.config.supabase.anonKey);

    // Initial session
    const { data: { session } } = await state.client.auth.getSession();
    state.user = session?.user || null;

    // Subscribe to auth changes
    state.client.auth.onAuthStateChange((_evt, session) => {
      state.user = session?.user || null;
      notify();
    });

    state.ready = true;
    notify();
  }

  function isEnabled() {
    return !!(state.config && state.config.features && state.config.features.authEnabled);
  }

  async function signInWithMagicLink(email) {
    if (!state.client) throw new Error('Auth not configured');
    const redirectTo = window.location.origin + '/app.html';
    const { error } = await state.client.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    if (error) throw error;
  }

  async function signInWithPassword(email, password) {
    if (!state.client) throw new Error('Auth not configured');
    const { error } = await state.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signUpWithPassword(email, password) {
    if (!state.client) throw new Error('Auth not configured');
    const redirectTo = window.location.origin + '/app.html';
    const { error } = await state.client.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
    if (error) throw error;
  }

  async function signInWithGoogle() {
    if (!state.client) throw new Error('Auth not configured');
    const redirectTo = window.location.origin + '/app.html';
    const { error } = await state.client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (error) throw error;
  }

  async function signOut() {
    if (!state.client) return;
    await state.client.auth.signOut();
  }

  function getUser() { return state.user; }
  function getClient() { return state.client; }

  function onChange(cb) {
    state.listeners.push(cb);
    if (state.ready) cb(state.user);
    return () => { state.listeners = state.listeners.filter(l => l !== cb); };
  }
  function notify() { state.listeners.forEach(cb => { try { cb(state.user); } catch(e){} }); }

  global.SNP = global.SNP || {};
  global.SNP.auth = {
    init, isEnabled, getUser, getClient,
    signInWithMagicLink, signInWithPassword, signUpWithPassword, signInWithGoogle, signOut,
    onChange,
    get config() { return state.config; }
  };
})(window);
