const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

console.log('--- Startup Config Check ---');
console.log('MONGO_URI:', process.env.MONGO_URI ? 'Set' : 'MISSING');
console.log('WEBODM_URL:', process.env.WEBODM_URL);
console.log('WEBODM_USER:', process.env.WEBODM_USER ? process.env.WEBODM_USER : 'MISSING');
console.log('WEBODM_PASS:', process.env.WEBODM_PASS ? '****' : 'MISSING');
console.log('----------------------------');

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/webodm-custom')
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error('MongoDB Connection Error:', err));

// Routes
app.use('/api/projects', require('./routes/projects'));

app.get('/', (req, res) => {
    res.send('WebODM Custom Backend Running');
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
