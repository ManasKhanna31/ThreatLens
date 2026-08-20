// src/services/api.js
import axios from 'axios';

// Use the Render backend in production, and localhost in development
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://threatlens-backend-elq7.onrender.com/api/v1' 
    : 'http://127.0.0.1:8001/api/v1');
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

export const getApiErrorMessage = (error, fallback = 'Something went wrong.') => {
  const detail = error?.response?.data?.detail;

  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item?.msg && item?.loc) {
          const loc = Array.isArray(item.loc) ? item.loc.join(' > ') : item.loc;
          return `${loc}: ${item.msg}`;
        }
        if (item?.msg) return item.msg;
        return null;
      })
      .filter(Boolean)
      .join(' | ') || fallback;
  }

  if (detail && typeof detail === 'object') {
    if (detail.msg) return detail.msg;
    try {
      return JSON.stringify(detail);
    } catch {
      return fallback;
    }
  }

  const message = error?.response?.data?.message || error?.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
};

// Add this to test the connection and add auth token
api.interceptors.request.use(request => {
  const token = localStorage.getItem('token');
  if (token) {
    request.headers.Authorization = `Bearer ${token}`;
  }
  console.log('Request:', request.method.toUpperCase(), request.url);
  return request;
});

api.interceptors.response.use(
  response => {
    console.log('Response:', response.status, response.data);
    return response;
  },
  error => {
    // Only log loud errors if it's not a standard 401 (Unauthorized)
    if (!error.response || error.response.status !== 401) {
      console.error('API Error:', error.message);
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
      }
    }
    return Promise.reject(error);
  }
);

export const analyzeLog = async (logText) => {
  try {
    console.log('Analyzing log:', logText.substring(0, 50) + '...');
    const response = await api.post('/analysis/analyze', { log: logText });
    return response.data;
  } catch (error) {
    console.error('Analysis failed:', error);
    throw error;
  }
};

export const parseLog = async (logText) => {
  try {
    const response = await api.post('/logs/parse', { log: logText });
    return response.data;
  } catch (error) {
    console.error('Parse failed:', error);
    throw error;
  }
};

export const getMitreTechnique = async (techId) => {
  try {
    const response = await api.get(`/mitre/technique/${techId}`);
    return response.data;
  } catch (error) {
    console.error('MITRE fetch failed:', error);
    throw error;
  }
};

export default api;
