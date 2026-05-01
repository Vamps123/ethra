const API_BASE = import.meta.env.MODE === 'development' ? '/api' : '/api';

async function request(path, options = {}) {
  const token = localStorage.getItem('taskToken');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(API_BASE + path, {
    ...options,
    headers,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw body.error || body || 'API error';
  }
  return response.json();
}

export const auth = {
  signup: data => request('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
  login: data => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
};

export const projects = {
  list: () => request('/projects'),
  create: data => request('/projects', { method: 'POST', body: JSON.stringify(data) }),
  addMember: (projectId, data) => request(`/projects/${projectId}/members`, { method: 'POST', body: JSON.stringify(data) }),
};

export const tasks = {
  list: () => request('/tasks'),
  create: data => request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  update: (taskId, data) => request(`/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify(data) }),
};

export const dashboard = {
  summary: () => request('/dashboard'),
};

export const me = {
  profile: () => request('/users/me'),
};
