const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: String,
    status: {
        type: String,
        enum: ['CREATED', 'UPLOADING', 'PROCESSING', 'COMPLETED', 'FAILED'],
        default: 'CREATED'
    },
    processingError: {
        type: String,
        default: null
    },
    progress: {
        type: Number,
        default: 0
    },
    extent: {
        type: [Number], // [minLon, minLat, maxLon, maxLat]
        default: []
    },
    images: [{
        type: String // Paths to local uploaded images
    }],
    odmTaskId: {
        type: String, // ID from WebODM API
        default: null
    },
    odmProjectId: {
        type: Number, // Project ID from WebODM API (Needed for tile access)
        default: null
    },
    odmProjectName: {
        type: String, // Project name in WebODM
    },
    center: {
        type: [Number], // [lat, lng]
        default: [0, 0]
    },
    zoom: {
        type: Number,
        default: 2
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    processingStartedAt: Date,
    processingCompletedAt: Date
});

module.exports = mongoose.model('Project', ProjectSchema);
