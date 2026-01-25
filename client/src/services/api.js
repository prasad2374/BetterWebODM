import axios from 'axios';

const API = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

export const getProjects = () => API.get('/projects');
export const getProject = (id) => API.get(`/projects/${id}`);
export const uploadProject = (formData) => API.post('/projects', formData, {
    headers: {
        'Content-Type': 'multipart/form-data',
    },
});
