import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  withCredentials: true,
});

// Interceptor to handle tenant resolution via X-Tenant-ID header
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    // 1. Check URL query parameter ?tenant=xxx
    const urlParams = new URLSearchParams(window.location.search);
    let tenantId = urlParams.get('tenant');

    // 2. Check localStorage if not in URL
    if (!tenantId) {
      tenantId = localStorage.getItem('tenantId');
    }

    // 3. Inject header if tenantId exists
    if (tenantId) {
      config.headers['X-Tenant-ID'] = tenantId;
    }
  }
  return config;
});

// Interceptor to handle automatic token refreshing on 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If the error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken =
          typeof window !== 'undefined'
            ? localStorage.getItem('refreshToken')
            : null;

        if (refreshToken) {
          // Attempt to refresh the session
          const response = await axios.post(
            `${api.defaults.baseURL}/auth/refresh`,
            { refreshToken },
            { withCredentials: true },
          );

          // If successful, the backend sets a new 'jwt' cookie
          // We should also update the refreshToken in storage if it changed
          if (response.data.refreshToken) {
            localStorage.setItem('refreshToken', response.data.refreshToken);
          }

          return api(originalRequest);
        }
      } catch (_refreshError) {
        // Refresh failed (e.g. refresh token expired) -> clear state and redirect
        if (typeof window !== 'undefined') {
          localStorage.removeItem('refreshToken');
          document.cookie = 'isAuthenticated=; path=/; max-age=0';
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  },
);

export default api;
