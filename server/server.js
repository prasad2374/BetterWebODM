import cors from "cors";
import "dotenv/config";
import express from "express";
import { connect } from "mongoose";
import path from "path";
import projectRoute from "./routes/projects";
import toolsRoute from "./routes/tools";
const app = express();
const PORT = process.env.WEBODM_PORT || 5000;

const WEBODM_ADDR = process.argv[1] === "--dev" ? "localhost" : process.env.WEBODM_ADDR;
console.log("--- Startup Config Check ---");
console.log("MONGO_URI:", process.env.MONGO_URI);
console.log("WEBODM_URL:", WEBODM_ADDR);
console.log("WEBODM_USER:", process.env.WEBODM_USER ? process.env.WEBODM_USER : "MISSING");
console.log("WEBODM_PASS:", process.env.WEBODM_PASS ? "****" : "MISSING");
console.log("----------------------------");

// Middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Database Connection
connect(process.env.MONGO_URI || "mongodb://localhost:27017/webodm-custom")
	.then((conn) => console.log("MongoDB Connected to:", conn.connection.name))
	.catch((err) => console.error("MongoDB Connection Error:", err));

// Routes
app.use("/api/projects", projectRoute);
app.use("/api/tools", toolsRoute);

app.get("/", (req, res) => {
	res.send("WebODM Custom Backend Running");
});

// Start Server
app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});
