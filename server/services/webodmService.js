const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

class WebODMService {
    constructor() {
        this.baseUrl = process.env.WEBODM_URL;
        this.username = process.env.WEBODM_USER;
        this.password = process.env.WEBODM_PASS;
        this.token = null;
    }

    async authenticate() {
        // Re-read env vars to ensure we have latest (if process env changes or we want to log them)
        // Hardcoded for debugging
        const user = 'Prasad';
        const pass = '1234';

        console.log(`[DEBUG] Authenticating with WebODM as: ${user}`);
        console.log(`[DEBUG] Auth Payload:`, JSON.stringify({ username: user, password: pass }));

        try {
            const response = await axios.post(`${this.baseUrl}/api/token-auth/`, {
                username: user,
                password: pass
            });
            this.token = response.data.token;
            console.log('WebODM Authentication Successful');
            return this.token;
        } catch (error) {
            const status = error.response ? error.response.status : 'Unknown';
            const data = error.response ? JSON.stringify(error.response.data) : error.message;
            console.error(`WebODM Auth Failed [${status}]:`, data);
            throw new Error(`Failed to authenticate with WebODM: ${data}`);
        }
    }

    async getHeaders() {
        if (!this.token) await this.authenticate();
        return {
            'Authorization': `JWT ${this.token}`
        };
    }

    async createProject(name, description) {
        try {
            const headers = await this.getHeaders();
            const response = await axios.post(`${this.baseUrl}/api/projects/`, {
                name: name,
                description: description || ''
            }, { headers });
            return response.data;
        } catch (error) {
            // Auto-recover token expiration
            if (error.response?.status === 401) {
                this.token = null;
                return this.createProject(name, description);
            }
            throw error;
        }
    }

    async createTask(projectId, imagePaths, options = []) {
        try {
            const headers = await this.getHeaders();
            const form = new FormData();

            // Add images
            imagePaths.forEach(path => {
                if (fs.existsSync(path)) {
                    form.append('images', fs.createReadStream(path));
                }
            });

            // Options to enforce GPU usage and high-quality reconstruction
            const defaultOptions = JSON.stringify([
                { name: "orthophoto-resolution", value: 5 },
                { name: "dsm", value: true },
                { name: "pc-quality", value: "medium" },
                { name: "feature-quality", value: "medium" },
                { name: "mesh-octree-depth", value: 10 }
            ]);

            form.append('options', defaultOptions);

            const response = await axios.post(
                `${this.baseUrl}/api/projects/${projectId}/tasks/`,
                form,
                {
                    headers: {
                        ...headers,
                        ...form.getHeaders()
                    }
                }
            );
            return response.data;
        } catch (error) {
            console.error('Task Creation Error:', error.response?.data || error.message);
            throw error;
        }
    }

    async getTaskStatus(taskId, projectId) {
        const headers = await this.getHeaders();
        let url = `${this.baseUrl}/api/tasks/${taskId}/`;
        if (projectId) {
            url = `${this.baseUrl}/api/projects/${projectId}/tasks/${taskId}/`;
        }
        try {
            const response = await axios.get(url, { headers });
            return response.data;
        } catch (error) {
            // Fallbrak: If global failed, maybe we should have tried project (or vice versa), 
            // but explicit is better.
            throw error;
        }
    }
    async getTaskAssets(taskId, projectId) {
        const headers = await this.getHeaders();
        let url = `${this.baseUrl}/api/tasks/${taskId}/assets/`;
        if (projectId) {
            url = `${this.baseUrl}/api/projects/${projectId}/tasks/${taskId}/assets/`;
        }
        try {
            const response = await axios.get(url, { headers });
            return response.data;
        } catch (error) {
            console.error('Failed to fetch assets:', error.message);
            throw error;
        }
    }
}

module.exports = new WebODMService();
