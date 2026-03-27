// auth.js — JWT helpers for admin dashboard login
(function() {
  BS.auth = {
    getToken:   () => localStorage.getItem('bs_jwt') || '',
    setToken:   (t) => localStorage.setItem('bs_jwt', t),
    clearToken: () => localStorage.removeItem('bs_jwt'),
    isLoggedIn: () => !!localStorage.getItem('bs_jwt'),
  };
})();
