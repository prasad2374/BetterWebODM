import axios from "axios";
import "dotenv/config";

const WEBODM_ADDR = process.env.WEBODM_ADDR || "localhost";
const WEBODM_PORT = process.env.WEBODM_PORT || 8000;
const USER = process.env.WEBODM_USER || "admin";
const PASS = process.env.WEBODM_PASS || "admin";

const getNodes = async () => {
    try {
        // 1. Auth
        const authRes = await axios.post(`http://${WEBODM_ADDR}:${WEBODM_PORT}/api/token-auth/`, {
            username: USER,
            password: PASS,
        });
        const token = authRes.data.token;
        console.log("Authenticated.");

        // 2. Fetch Nodes
        const nodesRes = await axios.get(`http://${WEBODM_ADDR}:${WEBODM_PORT}/api/processingnodes/`, {
            headers: { Authorization: `JWT ${token}` },
        });

        console.log("\n--- Processing Nodes ---");
        nodesRes.data.forEach(node => {
            console.log(`Name: ${node.hostname || node.id} (Alias: ${node.label || "None"})`);
            console.log(`ID:   ${node.id}`);
            console.log(`Status: ${node.online ? "Online" : "Offline"}`);
            console.log("------------------------");
        });

    } catch (e) {
        console.error("Error:", e.message);
        if (e.response) console.error(e.response.data);
    }
};

getNodes();
