const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Project = require('../models/Project');
const webodmService = require('../services/webodmService');


function logDebug(msg) {
    console.log(`[DEBUG] ${msg}`);
}
const axios = require('axios'); // Needed for proxy stream

// Multer Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// POST /api/projects - Create Project & Upload Images
router.post('/', upload.array('images'), async (req, res) => {
    console.log('[DEBUG] Received POST /api/projects');
    try {
        const { name, description } = req.body;
        const files = req.files;

        console.log(`[DEBUG] Name: ${name}, Files: ${files ? files.length : 0}`);

        if (!files || files.length === 0) {
            console.error('[DEBUG] No files uploaded');
            return res.status(400).json({ error: 'No images uploaded' });
        }

        // 1. Create Project in Local DB
        const newProject = new Project({
            name,
            description,
            status: 'PROCESSING', // Start as PROCESSING immediately
            images: files.map(f => f.path),
            processingStartedAt: new Date()
        });
        await newProject.save();
        console.log(`[DEBUG] Local Project Created: ${newProject._id}`);

        // 2. Process: Submit to WebODM (Synchronously)
        try {
            console.log(`[DEBUG] Starting WebODM Submission for ${newProject._id}`);

            // Create WebODM Project
            const odmProject = await webodmService.createProject(name, description);
            console.log(`[DEBUG] WebODM Project Created: ${odmProject.id}`);

            // Create WebODM Task
            const imagePaths = files.map(f => path.resolve(f.path));
            console.log(`[DEBUG] Preparing to upload ${imagePaths.length} images to Task...`);

            const odmTask = await webodmService.createTask(odmProject.id, imagePaths);
            console.log(`[DEBUG] WebODM Task Created: ${odmTask.id}`);

            // Update DB with Success
            newProject.odmTaskId = odmTask.id;
            newProject.odmProjectId = odmProject.id;
            newProject.odmProjectName = name;
            await newProject.save();
            console.log('[DEBUG] Project updated with WebODM IDs. Returning success.');

            // Return Success ONLY after successful submission
            res.status(201).json(newProject);

        } catch (err) {
            let errMsg = err.message;
            if (err.response && err.response.data) {
                errMsg += ` | WebODM Error: ${JSON.stringify(err.response.data)}`;
            }

            console.error(`[DEBUG] WebODM Process Failed: ${errMsg}`);

            newProject.status = 'FAILED';
            newProject.processingError = errMsg;
            await newProject.save();

            // Return Error to UI
            return res.status(500).json({ error: errMsg });
        }

    } catch (error) {
        console.error('[DEBUG] Server Route Error:', error);
        res.status(500).json({ error: 'Server Error' });
    }
});

// GET /api/projects - List All
router.get('/', async (req, res) => {
    try {
        let projects = await Project.find().sort({ createdAt: -1 });
        console.log(`[DEBUG] GET /projects found ${projects.length} docs`);

        // Sync Status for all PROCESSING projects
        await Promise.all(projects.map(async (project) => {
            if (project.odmTaskId && project.status === 'PROCESSING') {
                try {
                    const taskInfo = await webodmService.getTaskStatus(project.odmTaskId, project.odmProjectId);
                    let changed = false;

                    // Update Progress
                    // WebODM returns running_progress as a float 0.0-1.0
                    let percentage = 0;
                    if (taskInfo.running_progress !== undefined) {
                        percentage = Math.round(taskInfo.running_progress * 100);
                    } else if (taskInfo.progress !== undefined) {
                        percentage = taskInfo.progress;
                    }

                    console.log(`[DEBUG] Syncing ${project.name}: WebODM Progress=${taskInfo.running_progress} -> ${percentage}%`);

                    if (percentage !== project.progress) {
                        project.progress = percentage;
                        changed = true;
                    }

                    // Sync Extent (Bounds)
                    if (taskInfo.extent && taskInfo.extent.length === 4) {
                        // Check if different to avoid constant saves (simple check)
                        if (project.extent.length === 0 || project.extent[0] !== taskInfo.extent[0]) {
                            project.extent = taskInfo.extent;
                            changed = true;
                        }
                    }

                    if (taskInfo.status === 40) { // COMPLETED
                        project.status = 'COMPLETED';
                        project.progress = 100;
                        project.processingCompletedAt = new Date();
                        changed = true;
                    } else if (taskInfo.status === 50 || taskInfo.status === 30) { // FAILED
                        project.status = 'FAILED';
                        changed = true;
                    }

                    if (changed) await project.save();
                } catch (err) {
                    if (err.message === 'socket hang up' || err.code === 'ECONNRESET') {
                        console.log(`[WARN] Transient connection error syncing ${project._id} (will retry): ${err.message}`);
                    } else {
                        console.error(`Error syncing project ${project._id}:`, err.message);
                    }
                }
            }
        }));

        res.json(projects);
    } catch (error) {
        console.error('[ERROR] GET /projects failed:', error);
        res.status(500).json({ error: 'Server Error: ' + error.message });
    }
});

// GET /api/projects/:id - Get Detail & Sync Status
router.get('/:id', async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        // Sync Status if Processing
        if (project.odmTaskId && project.status === 'PROCESSING') {
            try {
                const taskInfo = await webodmService.getTaskStatus(project.odmTaskId, project.odmProjectId);
                let changed = false;

                // Update Progress
                let percentage = 0;
                if (taskInfo.running_progress !== undefined) {
                    percentage = Math.round(taskInfo.running_progress * 100);
                } else if (taskInfo.progress !== undefined) {
                    percentage = taskInfo.progress;
                }

                if (percentage !== project.progress) {
                    project.progress = percentage;
                    changed = true;
                }

                // Map WebODM status to our status
                if (taskInfo.status === 40) { // COMPLETED
                    project.status = 'COMPLETED';
                    project.progress = 100;
                    project.processingCompletedAt = new Date();

                    // Calculate Center & Zoom from Extent (if available)
                    // WebODM extent: [min_x, min_y, max_x, max_y] (Long, Lat)
                    if (taskInfo.extent && taskInfo.extent.length === 4) {
                        const [minLon, minLat, maxLon, maxLat] = taskInfo.extent;
                        const centerLat = (minLat + maxLat) / 2;
                        const centerLon = (minLon + maxLon) / 2;
                        project.center = [centerLat, centerLon];
                        project.zoom = 18; // Default to close zoom for drone imagery
                    }

                    changed = true;
                } else if (taskInfo.status === 50 || taskInfo.status === 30) { // FAILED
                    project.status = 'FAILED';
                    changed = true;
                }

                if (changed) await project.save();

            } catch (err) {
                console.error('Error syncing status:', err);
            }
        }

        res.json(project);
    } catch (error) {
        res.status(500).json({ error: 'Server Error' });
    }
});

// GET /api/projects/:id/tiles/:z/:x/:y.png - Proxy Tile Request
router.get('/:id/tiles/:z/:x/:y.png', async (req, res) => {
    try {
        const { id, z, x, y } = req.params;
        const project = await Project.findById(id);

        if (!project || !project.odmTaskId || !project.odmProjectId) {
            return res.status(404).send('Project or Task not found, or missing Project ID');
        }

        // Fetch tile from WebODM
        const headers = await webodmService.getHeaders();
        const tileUrl = `${process.env.WEBODM_URL}/api/projects/${project.odmProjectId}/tasks/${project.odmTaskId}/orthophoto/tiles/${z}/${x}/${y}.png`;

        try {
            const response = await axios({
                method: 'get',
                url: tileUrl,
                responseType: 'stream',
                headers: headers
            });
            // console.log(`[DEBUG] Serving Tile: ${z}/${x}/${y}`); // Uncomment for verbose tile logging
            response.data.pipe(res);
        } catch (axiosError) {
            if (axiosError.response && axiosError.response.status === 404) {
                return res.status(404).send('Tile not found');
            }
            console.error('Tile Proxy Error:', axiosError.message);
            res.status(500).send('Error fetching tile');
        }
    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).send('Server Error');
    }
});

// GET /api/projects/:id/model - Proxy 3D Model (GLB)
router.get('/:id/model', async (req, res) => {
    try {
        const { id } = req.params;
        const project = await Project.findById(id);

        if (!project || !project.odmTaskId || !project.odmProjectId) {
            return res.status(404).send('Project or Task not found');
        }

        const headers = await webodmService.getHeaders();
        // Asset name is typically 'textured_model.glb'
        // WebODM API: /api/projects/{pid}/tasks/{tid}/download/{asset}
        const modelUrl = `${process.env.WEBODM_URL}/api/projects/${project.odmProjectId}/tasks/${project.odmTaskId}/download/textured_model.glb`;

        try {
            const response = await axios({
                method: 'get',
                url: modelUrl,
                responseType: 'stream',
                headers: headers
            });

            res.setHeader('Content-Type', 'model/gltf-binary');
            response.data.pipe(res);
        } catch (axiosError) {
            console.error('Model Proxy Error:', axiosError.message);
            res.status(404).send('Model not found');
        }
    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).send('Server Error');
    }
});

const { spawn } = require('child_process');

// POST /api/projects/:id/detect - Run Object Detection
router.post('/:id/detect', async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        console.log(`[DEBUG] Starting Raw Detection for ${project.name} on ${project.images.length} images`);

        // execute detect_task.py (Strategy A - Stitched Orthophoto)
        // Detects on the map file directly.
        const pythonProcess = spawn('python', [
            'detect_task.py',
            '--task_id', project.odmTaskId,
            '--project_id', project.odmProjectId,
            '--model', '../best.pt'
        ], {
            cwd: path.resolve(__dirname, '..') // Run in 'server' folder
        });

        let stdoutData = '';
        let stderrData = '';

        pythonProcess.stdout.on('data', (data) => {
            stdoutData += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            stderrData += data.toString();
            console.error('[PYTHON ERR]', data.toString());
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.error('[DETECT FAIL]', stderrData);
                return res.status(500).json({ error: 'Detection failed', details: stderrData });
            }
            try {
                // Find JSON start/end if there's noise
                const jsonStr = stdoutData.trim();
                // Simple cleanup if mixed output
                const lastLine = jsonStr.split('\n').pop();
                const jsonResult = JSON.parse(lastLine);
                res.json(jsonResult);
            } catch (e) {
                console.error('JSON Parse Error:', e);
                console.log('Raw Output:', stdoutData);
                res.status(500).json({ error: 'Invalid output from detection script', raw: stdoutData });
            }
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
