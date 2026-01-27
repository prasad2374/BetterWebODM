import React, { useState } from 'react';

const DroneToolsModal = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState('height');

    // Height Calc State
    const [gsd, setGsd] = useState(4.62);
    const [heightResults, setHeightResults] = useState(null);
    const [heightLoading, setHeightLoading] = useState(false);

    // Focal/Analysis State
    const [focalLoading, setFocalLoading] = useState(false);
    const [focalResult, setFocalResult] = useState(null);
    const [analysisLoading, setAnalysisLoading] = useState(false);
    const [analysisResult, setAnalysisResult] = useState(null);

    const [models, setModels] = useState([]);
    const [selectedModel, setSelectedModel] = useState('');

    React.useEffect(() => {
        if (!isOpen) return;
        const fetchModels = async () => {
            try {
                const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
                const res = await fetch(`${baseUrl}/tools/models`);
                if (res.ok) {
                    const data = await res.json();
                    setModels(data);
                }
            } catch (e) {
                console.error("Failed to fetch models", e);
            }
        };
        fetchModels();
    }, [isOpen]);

    if (!isOpen) return null;

    const handleHeightCalc = async (e) => {
        e.preventDefault();
        setHeightLoading(true);
        try {
            const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
            const res = await fetch(`${baseUrl}/tools/calc-height`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gsd: parseFloat(gsd) })
            });
            const data = await res.json();
            setHeightResults(data);
        } catch (err) {
            console.error(err);
            alert("Error calculating height");
        } finally {
            setHeightLoading(false);
        }
    };

    const handleFileUpload = async (e, endpoint, setLoading, setResult) => {
        e.preventDefault();
        const files = e.target.files.files;
        if (!files || files.length === 0) return;

        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
            formData.append('images', files[i]);
        }
        if (selectedModel) {
            formData.append('model', selectedModel);
        }

        setLoading(true);
        setResult(null); // Reset previous result
        try {
            const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
            const res = await fetch(`${baseUrl}/tools/${endpoint}`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            setResult(data);
        } catch (err) {
            console.error(err);
            alert("Error processing files");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/80 backdrop-blur-sm">
            <div className="bg-black/90 border border-white/10 rounded-2xl w-full max-w-[95vw] h-[95vh] overflow-hidden flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <h2 className="text-xl font-light tracking-widest text-white">DRONE METRICS</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">✕</button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/10">
                    {['height', 'focal', 'analysis'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-4 text-xs uppercase tracking-widest font-medium transition-colors
                            ${activeTab === tab ? 'bg-white/10 text-white border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                        >
                            {tab === 'height' ? 'Flight Height' : tab === 'focal' ? 'Focal Estimator' : 'Drone Analysis'}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'height' && (
                        <div className="space-y-8">
                            <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm">
                                <span className="text-white font-medium">Flight Height Calculator:</span> Determine the optimal flight altitude to achieve a specific Ground Sample Distance (GSD) for various camera models.
                            </div>
                            <form onSubmit={handleHeightCalc} className="flex items-end gap-4">
                                <div className="flex-1">
                                    <label className="block text-xs uppercase text-gray-400 mb-2">Target GSD (cm/pixel)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={gsd}
                                        onChange={e => setGsd(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={heightLoading}
                                    className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-lg text-sm font-medium tracking-wide transition-colors disabled:opacity-50"
                                >
                                    {heightLoading ? 'Calculating...' : 'CALCULATE'}
                                </button>
                            </form>

                            {heightResults && (
                                <div className="space-y-4">
                                    <h3 className="text-sm font-medium text-gray-300">Optimal Flight Heights</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {heightResults.map((res, idx) => (
                                            <div key={idx} className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all">
                                                <div className="text-lg font-light text-blue-300 mb-1">{res.camera_name}</div>
                                                <div className="flex justify-between items-baseline">
                                                    <span className="text-3xl font-bold text-white">{res.optimum_height_m}<span className="text-sm font-normal text-gray-400 ml-1">m</span></span>
                                                    <div className="text-right text-xs text-gray-500">
                                                        <div>{res.focal_length_mm}mm focal</div>
                                                        <div>{res.image_width_px}px width</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'focal' && (
                        <div className="space-y-8">
                            <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm">
                                <span className="text-white font-medium">Metadata Analyzer:</span> Extract and analyze image EXIF data (Focal Length, Altitude) to calculate the effective Ground Sample Distance (GSD).
                            </div>
                            <form onSubmit={(e) => handleFileUpload(e, 'est-focal', setFocalLoading, setFocalResult)}>
                                <label className="block w-full cursor-pointer group">
                                    <div className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/20 rounded-xl group-hover:border-white/40 group-hover:bg-white/5 transition-all">
                                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                            <p className="mb-2 text-sm text-gray-400"><span className="font-semibold text-white">Click to upload</span> images for EXIF analysis</p>
                                            <p className="text-xs text-gray-500">JPG, PNG - view GSD and sensor data</p>
                                        </div>
                                        <input type="file" name="files" className="hidden" multiple accept="image/*" />
                                    </div>
                                </label>
                                <div className="mt-4 flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={focalLoading}
                                        className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-lg text-sm font-medium tracking-wide transition-colors disabled:opacity-50"
                                    >
                                        {focalLoading ? 'Processing...' : 'ANALYZE METADATA'}
                                    </button>
                                </div>
                            </form>

                            {focalResult && (
                                <div className="space-y-6 animate-fade-in">
                                    {!focalResult.success && (
                                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-center">
                                            {focalResult.message || "Failed to analyze images."}
                                        </div>
                                    )}

                                    {focalResult.details && (
                                        <div className="space-y-2">
                                            <h4 className="text-xs uppercase text-gray-500">Image Metadata & Calculated GSD</h4>
                                            <div className="bg-black/50 rounded-lg overflow-hidden border border-white/5">
                                                <table className="w-full text-left text-sm text-gray-400">
                                                    <thead className="bg-white/5 text-xs text-gray-300 uppercase">
                                                        <tr>
                                                            <th className="p-3">Image</th>
                                                            <th className="p-3">Camera</th>
                                                            <th className="p-3">Alt (m)</th>
                                                            <th className="p-3">Focal (mm)</th>
                                                            <th className="p-3 text-right">GSD (cm/px)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/5">
                                                        {focalResult.details.map((d, i) => (
                                                            <tr key={i} className="hover:bg-white/5">
                                                                <td className="p-3 font-mono text-white">{d.image}</td>
                                                                <td className="p-3">{d.camera || '-'}</td>
                                                                <td className="p-3 text-white">{d.altitude ? d.altitude.toFixed(2) : '-'}</td>
                                                                <td className="p-3 text-white">{d.focal_mm ? d.focal_mm.toFixed(2) : '-'}</td>
                                                                <td className="p-3 text-right font-bold text-green-400">{d.gsd_cm_px || '-'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'analysis' && (
                        <div className="space-y-8">
                            <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm">
                                <span className="text-white font-medium">Drone Analysis:</span> Run object detection on sample images to evaluate model performance (detections, confidence) and determine the best flight configuration.
                            </div>
                            <form onSubmit={(e) => handleFileUpload(e, 'analyze', setAnalysisLoading, setAnalysisResult)}>
                                <label className="block w-full cursor-pointer group">
                                    <div className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/20 rounded-xl group-hover:border-white/40 group-hover:bg-white/5 transition-all">
                                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                            <p className="mb-2 text-sm text-gray-400"><span className="font-semibold text-white">Click to upload</span> sample images</p>
                                            <p className="text-xs text-gray-500">JPG, PNG - Analyze for detections & quality</p>
                                        </div>
                                        <input type="file" name="files" className="hidden" multiple accept="image/*" />
                                    </div>
                                </label>
                                <div className="mt-4 flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={analysisLoading}
                                        className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-lg text-sm font-medium tracking-wide transition-colors disabled:opacity-50"
                                    >
                                        {analysisLoading ? 'Analyzing...' : 'RUN ANALYSIS'}
                                    </button>
                                </div>
                            </form>

                            {analysisResult && analysisResult.best_config && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
                                            <div className="text-xs text-gray-500 uppercase mb-1">Detections</div>
                                            <div className="text-3xl font-bold text-white">{analysisResult.best_config.detections}</div>
                                        </div>
                                        <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
                                            <div className="text-xs text-gray-500 uppercase mb-1">Avg Confidence</div>
                                            <div className="text-3xl font-bold text-blue-300">{(analysisResult.best_config.avg_conf).toFixed(4)}</div>
                                        </div>
                                        <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
                                            <div className="text-xs text-gray-500 uppercase mb-1">Calculated GSD</div>
                                            <div className="text-3xl font-bold text-green-300">{(analysisResult.best_config.gsd || 0).toFixed(2)} cm</div>
                                        </div>
                                    </div>

                                    <div className="p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-white/10 rounded-xl">
                                        <h3 className="text-lg font-light text-white mb-4">🏆 Best Performing Image</h3>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div className="text-gray-400">Filename</div><div className="text-white font-mono text-right">{analysisResult.best_config.image}</div>
                                            <div className="text-gray-400">Altitude</div><div className="text-white text-right">{analysisResult.best_config.alt_m} m</div>
                                            <div className="text-gray-400">Focal Length</div><div className="text-white text-right">{analysisResult.best_config.focal_mm ? analysisResult.best_config.focal_mm.toFixed(2) : 'N/A'} mm</div>
                                        </div>
                                    </div>

                                    {analysisResult.recommendations && (
                                        <div className="space-y-2">
                                            <h4 className="text-xs uppercase text-gray-500">Flight Height Recommendations (for Best GSD)</h4>
                                            <div className="bg-black/50 rounded-lg overflow-hidden border border-white/5">
                                                <table className="w-full text-left text-sm text-gray-400">
                                                    <tbody className="divide-y divide-white/5">
                                                        {analysisResult.recommendations.map((rec, i) => (
                                                            <tr key={i} className="hover:bg-white/5">
                                                                <td className="p-3 text-white">{rec.camera}</td>
                                                                <td className="p-3 text-right text-blue-300">Fly at {rec.opt_height} m</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DroneToolsModal;
