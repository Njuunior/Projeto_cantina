import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// Não forçar Content-Type globalmente: com `application/json` fixo o upload
// multipart (FormData) quebra e o Multer responde 400 ("Envie uma imagem...").
api.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    if (config.headers && typeof config.headers.set === 'function') {
      config.headers.delete('Content-Type');
    } else if (config.headers) {
      delete config.headers['Content-Type'];
    }
  }
  return config;
});

export function setAdminToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    localStorage.setItem('escola_admin_token', token);
  } else {
    delete api.defaults.headers.common.Authorization;
    localStorage.removeItem('escola_admin_token');
  }
}

const saved = localStorage.getItem('escola_admin_token');
if (saved) {
  api.defaults.headers.common.Authorization = `Bearer ${saved}`;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      delete api.defaults.headers.common.Authorization;
      localStorage.removeItem('escola_admin_token');
      localStorage.removeItem('escola_admin_name');
      if (window.location.pathname.startsWith('/admin')) {
        window.location.href = '/admin/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
