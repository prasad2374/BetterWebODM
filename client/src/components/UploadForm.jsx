import React, { useState } from 'react';
import { uploadProject } from '../services/api';

const UploadForm = ({ onUploadSuccess }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [files, setFiles] = useState([]);
    const [upgrading, setUpgrading] = useState(false);
    const [error, setError] = useState(null);

    const handleFileChange = (e) => {
        setFiles(e.target.files);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name || files.length === 0) {
            setError('Name and Images are required');
            return;
        }

        setUpgrading(true);
        setError(null);

        const formData = new FormData();
        formData.append('name', name);
        formData.append('description', description);
        for (let i = 0; i < files.length; i++) {
            formData.append('images', files[i]);
        }

        try {
            await uploadProject(formData);
            setUpgrading(false);
            setName('');
            setDescription('');
            setFiles([]);
            if (onUploadSuccess) onUploadSuccess();
        } catch (err) {
            console.error(err);
            const serverError = err.response && err.response.data && err.response.data.error;
            setError(serverError || 'Upload failed. Check console.');
            setUpgrading(false);
        }
    };

    return (
        <div className="text-white">
            <h2 className="text-2xl font-light mb-8 text-gradient tracking-wide">Initialize New Scan</h2>
            {error && <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-3 mb-6 rounded-lg backdrop-blur-sm">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2">Project Name</label>
                        <input
                            type="text"
                            className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white placeholder-gray-600 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all font-light"
                            value={name} onChange={e => setName(e.target.value)}
                            placeholder="e.g. Sector 7 Survey"
                        />
                    </div>
                    <div>
                        <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2">Description</label>
                        <input
                            type="text"
                            className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white placeholder-gray-600 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all font-light"
                            value={description} onChange={e => setDescription(e.target.value)}
                            placeholder="Mission parameters..."
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2">Sensor Data (Images)</label>
                    <div className="relative border border-dashed border-white/20 rounded-xl p-8 hover:bg-white/5 transition-colors group text-center cursor-pointer">
                        <input
                            type="file" multiple accept="image/*"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={handleFileChange}
                        />
                        <div className="flex flex-col items-center">
                            <span className="text-4xl mb-3 opacity-50">📷</span>
                            <span className="text-sm text-gray-300 font-light group-hover:text-white transition-colors">
                                {files.length > 0 ? `${files.length} images selected` : "Drag sensor data here or click to upload"}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="pt-4 flex justify-end">
                    <button
                        type="submit"
                        disabled={upgrading}
                        className={`glass-button py-3 px-10 text-sm tracking-widest uppercase font-medium ${upgrading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {upgrading ? 'Initializing...' : 'Start Processing'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default UploadForm;
