import axios from "axios";
import FormData from "form-data";
import fs from "fs-extra";

let token = null;
const WEBODM_ADDR = process.argv.includes("--dev") ? "localhost" : process.env.WEBODM_ADDR;
console.log("WebODMService\t", WEBODM_ADDR);
const getHeaders = async () => {
	if (!token) {
		await login();
	}
	return {
		Authorization: `JWT ${token}`,
	};
};

const login = async () => {
	try {
		// console.log(process.env.WEBODM_PORT);
		const response = await axios.post(`http://${WEBODM_ADDR}:${process.env.WEBODM_PORT || 8000}/api/token-auth/`, {
			username: process.env.WEBODM_USER,
			password: process.env.WEBODM_PASS,
		});
		token = response.data.token;
		console.log("WebODM Authenticated");
	} catch (error) {
		console.error("WebODM Login Failed:", error.message);
		throw error;
	}
};

const createProject = async (name, description) => {
	const headers = await getHeaders();
	try {
		const response = await axios.post(
			`http://${WEBODM_ADDR}:${process.env.WEBODM_PORT || 8000}/api/projects/`,
			{
				name,
				description,
			},
			{ headers },
		);
		return response.data;
	} catch (error) {
		console.error("Create Project Failed:", error.response ? error.response.data : error.message);
		throw error;
	}
};

const createTask = async (projectId, imagePaths) => {
	const headers = await getHeaders();
	const form = new FormData();

	// WebODM NodeODM API options (can be customized)
	const options = [
		{ name: "dsm", value: true },
		{ name: "dtm", value: true },
		{ name: "orthophoto-resolution", value: 5 }, // 5 cm/px
	];
	form.append("options", JSON.stringify(options));
	form.append("processing_node", "node-odm-1");

	// Append Images
	imagePaths.forEach((imagePath) => {
		form.append("images", fs.createReadStream(imagePath));
	});

	try {
		const response = await axios.post(
			`http://${WEBODM_ADDR}:${process.env.WEBODM_PORT || 8000}/api/projects/${projectId}/tasks/`,
			form,
			{
				headers: {
					...headers,
					...form.getHeaders(),
				},
				maxBodyLength: Infinity,
				maxContentLength: Infinity,
				// auto_processing_node: true,
			},
		);
		return response.data;
	} catch (error) {
		console.error("Create Task Failed:", error.response ? error.response.data : error.message);
		throw error;
	}
};

const getTaskStatus = async (taskId, projectId) => {
	const headers = await getHeaders();
	try {
		const response = await axios.get(
			`http://${WEBODM_ADDR}:${process.env.WEBODM_PORT || 8000}/api/projects/${projectId}/tasks/${taskId}/`,
			{
				headers,
			},
		);
		return response.data;
	} catch (error) {
		console.error(`Get Status Failed (Task ${taskId}):`, error.message);
		throw error;
	}
};

const getTaskAssets = async (taskId, projectId) => {
	// This function might not be used directly often, but good to have
	const headers = await getHeaders();
	try {
		// This is generic, actual asset download needs specific endpoints
		const response = await axios.get(
			`http://${WEBODM_ADDR}:${process.env.WEBODM_PORT || 8000}/api/projects/${projectId}/tasks/${taskId}/`,
			{
				headers,
			},
		);
		return response.data; // The task object contains 'assets' list sometimes? Or we hit /download/
	} catch (error) {
		throw error;
	}
};

export default {
	getHeaders,
	createProject,
	createTask,
	getTaskStatus,
	getTaskAssets,
};
