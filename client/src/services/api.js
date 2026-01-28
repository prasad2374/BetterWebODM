import axios from "axios";
const SERVER_ADDR = __USE_DEV_ADDR__ ? "localhost" : import.meta.env.VITE_SERVER_ADDR;
const API = axios.create({
	baseURL: `http://${SERVER_ADDR}:${import.meta.env.VITE_PORT || 8001}/api`,
});
// console.log(SERVER_ADDR)
// console.log(API.getUri())

export const getProjects = () => API.get("/projects");
export const getProject = (id) => API.get(`/projects/${id}`);
export const uploadProject = (formData) =>
	API.post("/projects", formData, {
		headers: {
			"Content-Type": "multipart/form-data",
		},
	});
