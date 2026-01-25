import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProject } from '../services/api';
import MapViewer from '../components/MapViewer';
import ModelViewer from '../components/ModelViewer';

const ProjectDetails = () => {
    const { id } = useParams();
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('2D'); // '2D' or '3D'

    useEffect(() => {
        const fetchProject = async () => {
            try {
                const { data } = await getProject(id);
                setProject(data);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchProject();
    }, [id]);

    if (loading) return <div className="p-8">Loading project details...</div>;
    if (!project) return <div className="p-8">Project not found</div>;

    return (
        <div className="h-screen flex flex-col text-white">
            <header className="absolute top-0 left-0 right-0 z-[2000] p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
                <div className="flex items-center space-x-6 pointer-events-auto">
                    <Link to="/" className="glass-button w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/20">
                        ←
                    </Link>
                    <div>
                        <h1 className="text-2xl font-light tracking-wide">{project.name}</h1>
                        <div className="flex items-center space-x-2 mt-1">
                            <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(74,222,128,0.8)]"></span>
                            <span className="text-xs text-gray-400 uppercase tracking-widest">{project.status}</span>
                        </div>
                    </div>
                </div>

                {project.status === 'COMPLETED' && (
                    <div className="flex bg-black/30 backdrop-blur-md rounded-full p-1 border border-white/10 pointer-events-auto">
                        <button
                            onClick={() => setViewMode('2D')}
                            className={`px-6 py-2 rounded-full text-xs font-medium tracking-widest transition-all ${viewMode === '2D' ? 'bg-white text-black shadow-lg' : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            ORTHO
                        </button>
                        <button
                            onClick={() => setViewMode('3D')}
                            className={`px-6 py-2 rounded-full text-xs font-medium tracking-widest transition-all ${viewMode === '3D' ? 'bg-white text-black shadow-lg' : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            MODEL
                        </button>
                    </div>
                )}
            </header>

            <div className="flex-1 relative bg-black">
                {/* Map Viewer / 3D Viewer Placeholders */}
                {project.status === 'COMPLETED' ? (
                    <div className="w-full h-full">
                        {viewMode === '2D' ? (
                            <MapViewer taskId={project._id} project={project} />
                        ) : (
                            <ModelViewer taskId={project._id} />
                        )}
                    </div>
                ) : project.status === 'FAILED' ? (
                    <div className="flex flex-col items-center justify-center h-full text-red-400">
                        <svg className="w-20 h-20 mb-6 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-2xl font-thin tracking-wide">PROCESSING FAILED</p>
                        <p className="mt-2 text-gray-500 font-light">The reconstruction engine encountered an error.</p>
                        <div className="mt-8 glass p-6 rounded-xl max-w-lg border-l-4 border-red-500/50">
                            <p className="text-xs font-mono text-red-300 break-all">
                                {project.processingError || 'Unknown system error. Check console logs.'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-white/50">
                        <div className="relative w-24 h-24 mb-8">
                            <div className="absolute inset-0 border-t-2 border-white rounded-full animate-spin"></div>
                            <div className="absolute inset-4 border-b-2 border-white/50 rounded-full animate-spin-reverse"></div>
                        </div>
                        <p className="text-xl font-light tracking-[0.2em] animate-pulse">PROCESSING DATA</p>
                        <p className="text-xs mt-3 text-gray-600 uppercase tracking-widest">Do not close this window</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProjectDetails;
