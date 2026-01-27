import axios from "axios";
const WEBODM_ADDR = __USE_DEV_ADDR__ ? "localhost" : import.meta.env.VITE_WEBODM_ADDR;
const API = axios.create({
	baseURL: `http://${WEBODM_ADDR}:${import.meta.env.VITE_PORT}/api`,
});
console.log(WEBODM_ADDR)
console.log(API.getUri())

export const getProjects = () => API.get("/projects");
export const getProject = (id) => API.get(`/projects/${id}`);
export const uploadProject = (formData) =>
	API.post("/projects", formData, {
		headers: {
			"Content-Type": "multipart/form-data",
		},
	});
