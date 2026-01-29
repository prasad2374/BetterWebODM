import "dotenv/config";
import mongoose from "mongoose";
import Project from "./models/Project.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/webodm-custom";

mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log("Connected to DB");
        const project = await Project.findOne().sort({ createdAt: -1 });
        if (project) {
            console.log("\n--- Latest Project ---");
            console.log("ID:", project._id);
            console.log("Name:", project.name);
            console.log("Status:", project.status);
            console.log("ODM Project ID:", project.odmProjectId);
            console.log("ODM Task ID:", project.odmTaskId);
            console.log("Extent:", project.extent);
            console.log("Progress:", project.progress);
        } else {
            console.log("No projects found.");
        }
        process.exit();
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
