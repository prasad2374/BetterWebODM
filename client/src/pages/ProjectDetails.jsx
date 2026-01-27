import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import MapViewer from "../components/MapViewer";
import ModelViewer from "../components/ModelViewer";
import { getProject } from "../services/api";

const ProjectDetails = () => {
	const { id } = useParams();
	const [project, setProject] = useState(null);
	const [loading, setLoading] = useState(true);
	const [viewMode, setViewMode] = useState("2D"); // '2D' or '3D'
	const [detecting, setDetecting] = useState(false);
	const [detections, setDetections] = useState(null);
	const [showingDetections, setShowingDetections] = useState(false);

	const [selectedClasses, setSelectedClasses] = useState(new Set());
	const [availableClasses, setAvailableClasses] = useState([]);
	const [classCounts, setClassCounts] = useState({});
	const [isFilterOpen, setIsFilterOpen] = useState(false);

	// Model Selection
	const [models, setModels] = useState([]);
	const [selectedModel, setSelectedModel] = useState("");
	const WEBODM_ADDR = process.argv.includes("--dev") ? "localhost" : import.meta.env.VITE_WEBODM_ADDR;

	useEffect(() => {
		const fetchModels = async () => {
			try {
				const baseUrl = `http://${WEBODM_ADDR}:${process.env.VITE_PORT}`;
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
	}, []);

	const filterContainedBoxes = (features) => {
		if (!features || features.length === 0) return features;

		// 1. Compute bounds key for each feature
		const withBounds = features.map((f, index) => {
			const coords = f.geometry.coordinates[0]; // Ring
			const lons = coords.map((c) => c[0]);
			const lats = coords.map((c) => c[1]);
			return {
				feature: f,
				index,
				minLon: Math.min(...lons),
				maxLon: Math.max(...lons),
				minLat: Math.min(...lats),
				maxLat: Math.max(...lats),
			};
		});

		const toRemove = new Set();

		for (let i = 0; i < withBounds.length; i++) {
			for (let j = 0; j < withBounds.length; j++) {
				if (i === j) continue;

				const a = withBounds[i];
				const b = withBounds[j];

				// Check A inside B (Nested Box Removal)
				// Relaxed comparison slightly for float precision if needed, but strict >= should work for straight subset
				if (a.minLon >= b.minLon && a.maxLon <= b.maxLon && a.minLat >= b.minLat && a.maxLat <= b.maxLat) {
					// A is inside B
					// Handle Identical: Remove duplicate (keep first encountered/lower index)
					if (
						Math.abs(a.minLon - b.minLon) < 1e-9 &&
						Math.abs(a.maxLon - b.maxLon) < 1e-9 &&
						Math.abs(a.minLat - b.minLat) < 1e-9 &&
						Math.abs(a.maxLat - b.maxLat) < 1e-9
					) {
						if (i > j) toRemove.add(i);
					} else {
						// A is strictly inside B
						// Determine if we should only remove if same class?
						// User said: "remove the bounding box that is inside" - implies generally bad nested detection.
						// But if user wants to see "Tank" in "Parking Lot", we shouldn't remove.
						// However, typically YOLO doesn't output hierarchy.
						// "if 4 coordinates... present completely inside... remove" - instruction is blanket.
						toRemove.add(i);
					}
				}
			}
		}

		return features.filter((_, i) => !toRemove.has(i));
	};

	const handleRunDetection = async () => {
		if (showingDetections) {
			setShowingDetections(false);
			setDetections(null);
			return;
		}

		setDetecting(true);
		try {
			// const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:${process.env.VITE_PORT}/api';
			const res = await fetch(`http://${WEBODM_ADDR}:${process.env.VITE_PORT}/projects/${id}/detect`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ model: selectedModel }),
			});
			if (!res.ok) throw new Error("Detection failed");
			const rawData = await res.json();

			// --- FILTER NESTED BOXES ---
			let data = { ...rawData };
			if (data.features) {
				data.features = filterContainedBoxes(data.features);
			}

			// 1. Calculate Counts
			const counts = {};
			const detectedClasses = new Set();

			if (data && data.features) {
				data.features.forEach((f) => {
					const label = f.properties.label;
					counts[label] = (counts[label] || 0) + 1;
					detectedClasses.add(label);
				});
			}
			setClassCounts(counts);

			// 2. Determine Available Classes
			let allModelClasses = new Set();
			if (data && data.model_classes) {
				if (typeof data.model_classes === "object" && !Array.isArray(data.model_classes)) {
					Object.values(data.model_classes).forEach((c) => allModelClasses.add(c));
				} else if (Array.isArray(data.model_classes)) {
					data.model_classes.forEach((c) => allModelClasses.add(c));
				}
			}
			detectedClasses.forEach((c) => allModelClasses.add(c));

			const sortedClasses = Array.from(allModelClasses).sort();
			setAvailableClasses(sortedClasses);

			// 3. Set Initial Selection -> ONLY detected classes
			setSelectedClasses(detectedClasses);

			setDetections(data);
			setShowingDetections(true);
			setViewMode("2D");
		} catch (e) {
			console.error(e);
			alert("Error running detection: " + e.message);
		} finally {
			setDetecting(false);
		}
	};

	const toggleClass = (cls) => {
		const next = new Set(selectedClasses);
		if (next.has(cls)) {
			next.delete(cls);
		} else {
			next.add(cls);
		}
		setSelectedClasses(next);
	};

	const filteredDetections = React.useMemo(() => {
		if (!detections) return null;
		return {
			...detections,
			features: detections.features.filter((f) => selectedClasses.has(f.properties.label)),
		};
	}, [detections, selectedClasses]);

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
					<Link
						to="/"
						className="glass-button w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/20">
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

				<div className="flex pointer-events-auto space-x-4">
					{/* Class Filter Dropdown */}
					{showingDetections && availableClasses.length > 0 && (
						<div className="relative">
							<button
								onClick={() => setIsFilterOpen(!isFilterOpen)}
								className="px-6 py-2 rounded-full text-xs font-medium tracking-widest bg-black/30 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-colors">
								FILTER ▾
							</button>

							{isFilterOpen && (
								<div className="absolute top-full right-0 mt-2 w-56 bg-black/90 backdrop-blur-md rounded-xl border border-white/10 shadow-xl overflow-hidden py-1 z-50 max-h-96 overflow-y-auto">
									{availableClasses.map((cls) => {
										const count = classCounts[cls] || 0;
										return (
											<button
												key={cls}
												onClick={() => toggleClass(cls)}
												className="w-full text-left px-4 py-2 text-xs font-mono hover:bg-white/10 flex items-center justify-between transition-colors group">
												<span className={`${selectedClasses.has(cls) ? "text-white" : "text-gray-500"} flex-1`}>
													{cls} <span className="text-gray-600 ml-1">({count})</span>
												</span>
												{selectedClasses.has(cls) && <span className="text-green-400">✓</span>}
											</button>
										);
									})}
								</div>
							)}
						</div>
					)}

					{project.status === "COMPLETED" && (
						<div className="flex bg-black/30 backdrop-blur-md rounded-full p-1 border border-white/10 space-x-1">
							<button
								onClick={() => setViewMode("2D")}
								className={`px-5 py-2 rounded-full text-xs font-medium tracking-widest transition-all ${
									viewMode === "2D" ? "bg-white text-black shadow-lg" : "text-gray-400 hover:text-white"
								}`}>
								ORTHO
							</button>
							<button
								onClick={() => setViewMode("3D")}
								className={`px-5 py-2 rounded-full text-xs font-medium tracking-widest transition-all ${
									viewMode === "3D" ? "bg-white text-black shadow-lg" : "text-gray-400 hover:text-white"
								}`}>
								MODEL
							</button>

							<div className="relative group/models">
								<select
									className="appearance-none bg-black/30 backdrop-blur-md rounded-l-full pl-4 pr-8 py-2 text-xs font-medium tracking-widest border border-white/10 hover:bg-white/10 transition-colors focus:outline-none text-white cursor-pointer"
									value={selectedModel}
									onChange={(e) => setSelectedModel(e.target.value)}>
									<option
										value=""
										className="bg-black text-gray-400">
										Default Model
									</option>
									{models.map((m) => (
										<option
											key={m}
											value={m}
											className="bg-black text-white">
											{m}
										</option>
									))}
								</select>
								<div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-xs text-gray-400">
									▼
								</div>
							</div>

							<button
								onClick={handleRunDetection}
								disabled={detecting}
								className={`px-5 py-2 rounded-r-full text-xs font-medium tracking-widest transition-all -ml-1 border-l border-white/10 ${
									showingDetections ?
										"bg-yellow-400 text-black shadow-lg"
									:	"bg-black/30 backdrop-blur-md text-gray-400 hover:text-white hover:bg-white/10 border border-white/10"
								}`}>
								{detecting ? "RUNNING..." : "DETECTION"}
							</button>
						</div>
					)}
				</div>
			</header>

			<div className="flex-1 relative bg-black">
				{/* Map Viewer / 3D Viewer Placeholders */}
				{project.status === "COMPLETED" ?
					<div className="w-full h-full">
						{viewMode === "2D" ?
							<MapViewer
								taskId={project._id}
								project={project}
								detections={filteredDetections}
							/>
						:	<ModelViewer taskId={project._id} />}
					</div>
				: project.status === "FAILED" ?
					<div className="flex flex-col items-center justify-center h-full text-red-400">
						<svg
							className="w-20 h-20 mb-6 opacity-80"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth="1"
								d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<p className="text-2xl font-thin tracking-wide">PROCESSING FAILED</p>
						<p className="mt-2 text-gray-500 font-light">The reconstruction engine encountered an error.</p>
						<div className="mt-8 glass p-6 rounded-xl max-w-lg border-l-4 border-red-500/50">
							<p className="text-xs font-mono text-red-300 break-all">
								{project.processingError || "Unknown system error. Check console logs."}
							</p>
						</div>
					</div>
				:	<div className="flex flex-col items-center justify-center h-full text-white/50">
						<div className="relative w-24 h-24 mb-8">
							<div className="absolute inset-0 border-t-2 border-white rounded-full animate-spin"></div>
							<div className="absolute inset-4 border-b-2 border-white/50 rounded-full animate-spin-reverse"></div>
						</div>
						<p className="text-xl font-light tracking-[0.2em] animate-pulse">PROCESSING DATA</p>
						<p className="text-xs mt-3 text-gray-600 uppercase tracking-widest">Do not close this window</p>
					</div>
				}
			</div>
		</div>
	);
};

export default ProjectDetails;
