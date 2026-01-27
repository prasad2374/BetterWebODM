const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Configure Multer for temp storage
const tempDir = path.join(__dirname, '..', 'temp_tools');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Create a unique subfolder for each request to avoid collisions?
        // For simplicity, just use tempDir, but clean up carefully.
        // Better: create a random sub-directory per request.
        cb(null, tempDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

const TOOLS_DIR = path.join(__dirname, '..', 'tools');
// We assume best.pt is in the root of the server or project. 
// Based on previous file exploration, it was in CustomApp/best.pt 
// or CustomApp/server/best.pt?
// In detect_task.py it used `../best.pt` relative to `server/`.
// So it is in CustomApp/best.pt.
// We are in CustomApp/server/routes/tools.js -> ../.. is server/ -> ../../../ is CustomApp/ ?
// Wait, __dirname is CustomApp/server/routes
// .. is CustomApp/server
// ../.. is CustomApp/
const MODEL_PATH = path.resolve(__dirname, '../../best.pt');

// Helper to run python script
const runPython = (scriptName, args, res) => {
    const scriptPath = path.join(TOOLS_DIR, scriptName);
    const py = spawn('python', [scriptPath, ...args]);

    let stdoutData = '';
    let stderrData = '';

    py.stdout.on('data', (data) => stdoutData += data.toString());
    py.stderr.on('data', (data) => stderrData += data.toString());

    py.on('close', (code) => {
        if (code !== 0) {
            console.error(`Error running ${scriptName}:`, stderrData);
            return res.status(500).json({ error: 'Tool execution failed', details: stderrData });
        }
        try {
            const json = JSON.parse(stdoutData.trim());
            res.json(json);
        } catch (e) {
            console.error('JSON Parse Error:', e);
            console.log('Raw Output:', stdoutData);
            res.status(500).json({ error: 'Invalid output from tool', raw: stdoutData });
        }
    });
};

// GET /api/tools/models
router.get('/models', (req, res) => {
    try {
        // Models are in d:\WebODM\odm_data_bellus-master\odm_data_bellus-master\models\yolo11 models
        // Relative to CustomApp/server/routes (where this file is potentially running, wait tools.js is in routes?)
        // Yes, tools.js is in CustomApp/server/routes.
        // So ../../../models/yolo11 models
        const modelsPath = path.resolve(__dirname, '../../../models/yolo11 models');
        if (!fs.existsSync(modelsPath)) {
            return res.json([]);
        }
        const files = fs.readdirSync(modelsPath).filter(f => f.endsWith('.pt'));
        res.json(files);
    } catch (e) {
        console.error("Error listing models:", e);
        res.status(500).json({ error: "Failed to list models" });
    }
});

// POST /api/tools/calc-height
router.post('/calc-height', (req, res) => {
    const { gsd } = req.body;
    if (!gsd) return res.status(400).json({ error: 'GSD is required' });
    runPython('calc_height.py', ['--gsd', gsd], res);
});

// POST /api/tools/est-focal
router.post('/est-focal', upload.array('images'), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No images uploaded' });
    }

    const modelName = req.body.model;
    let modelArg = MODEL_PATH;
    if (modelName) {
        modelArg = path.resolve(__dirname, '../../../models/yolo11 models', modelName);
    }

    // We need to pass a directory. 
    // Since multer puts all files in tempDir mixed with others, this is tricky if concurrent.
    // Solution: Create a unique subdir for this batch.
    // BUT multer runs before this handler.
    // Workaround: We pass tempDir, but the script filters by the files we just uploaded?
    // Or simpler: Move files to a unique folder now.

    const batchId = Date.now().toString();
    const batchDir = path.join(tempDir, batchId);
    fs.mkdirSync(batchDir);

    req.files.forEach(f => {
        const newPath = path.join(batchDir, f.filename);
        fs.renameSync(f.path, newPath);
    });

    const cleanup = () => {
        fs.rm(batchDir, { recursive: true, force: true }, (err) => {
            if (err) console.error("Cleanup error:", err);
        });
    };

    const py = spawn('python', [
        path.join(TOOLS_DIR, 'est_focal.py'),
        '--dir', batchDir,
        '--model', modelArg
    ]);

    let stdoutData = '';
    let stderrData = '';

    py.stdout.on('data', (data) => stdoutData += data.toString());
    py.stderr.on('data', (data) => stderrData += data.toString());

    py.on('close', (code) => {
        cleanup(); // Cleanup after run
        if (code !== 0) {
            console.error(`Error running est_focal.py:`, stderrData);
            return res.status(500).json({ error: 'Analysis failed', details: stderrData });
        }
        try {
            const json = JSON.parse(stdoutData.trim());
            res.json(json);
        } catch (e) {
            console.error('JSON Parse Error:', e);
            res.status(500).json({ error: 'Invalid output', raw: stdoutData });
        }
    });
});

// POST /api/tools/analyze
router.post('/analyze', upload.array('images'), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No images uploaded' });
    }

    const modelName = req.body.model;
    let modelArg = MODEL_PATH;
    if (modelName) {
        modelArg = path.resolve(__dirname, '../../../models/yolo11 models', modelName);
    }

    const batchId = Date.now().toString();
    const batchDir = path.join(tempDir, batchId);
    fs.mkdirSync(batchDir);

    req.files.forEach(f => {
        const newPath = path.join(batchDir, f.filename);
        fs.renameSync(f.path, newPath);
    });

    const cleanup = () => {
        fs.rm(batchDir, { recursive: true, force: true }, (err) => {
            if (err) console.error("Cleanup error:", err);
        });
    };

    const py = spawn('python', [
        path.join(TOOLS_DIR, 'analyze.py'),
        '--dir', batchDir,
        '--model', modelArg
    ]);

    let stdoutData = '';
    let stderrData = '';

    py.stdout.on('data', (data) => stdoutData += data.toString());
    py.stderr.on('data', (data) => stderrData += data.toString());

    py.on('close', (code) => {
        cleanup();
        if (code !== 0) {
            console.error(`Error running analyze.py:`, stderrData);
            return res.status(500).json({ error: 'Analysis failed', details: stderrData });
        }
        try {
            const json = JSON.parse(stdoutData.trim());
            res.json(json);
        } catch (e) {
            console.error('JSON Parse Error:', e);
            res.status(500).json({ error: 'Invalid output', raw: stdoutData });
        }
    });
});

module.exports = router;
