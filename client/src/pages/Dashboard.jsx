import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getProjects } from "../services/api";
import UploadForm from "../components/UploadForm";
import Background3D from "../components/Background3D";
import DroneToolsModal from "../components/DroneToolsModal";

const Dashboard = () => {
	const [projects, setProjects] = useState([]);
	const [loading, setLoading] = useState(true);
	const [isToolsOpen, setIsToolsOpen] = useState(false);

	const fetchProjects = async () => {
		try {
			const { data } = await getProjects();
			setProjects(data);
			setLoading(false);
		} catch (error) {
			console.error("Failed to fetch projects", error);
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchProjects();

		// Poll every 5 seconds to update progress
		const interval = setInterval(() => {
			fetchProjects();
		}, 5000);

		return () => clearInterval(interval);
	}, []);

	return (
		<>
			<Background3D />
			<div className="container mx-auto px-4 py-8 relative z-10">
				<header className="mb-12 flex justify-between items-end">
					<div>
						<h1 className="text-6xl font-bold tracking-tighter mb-2 text-gradient letter-spacing-1">ZIIP</h1>
						<p className="text-gray-400 font-bold tracking-widest text-sm uppercase pl-1">
							Zero Infinity Intelligence Platform
						</p>
					</div>
					<div className="text-right hidden md:block">
						<div className="text-xs text-gray-500 uppercase tracking-widest mb-1">System Status</div>
						<div className="flex items-center justify-end space-x-2">
							<span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
							<span className="text-sm text-gray-300">Operational</span>
						</div>
					</div>
				</header>

				<div
					className="glass-card mb-12"
					style={{
						background: "rgba(255, 255, 255, 0.03)",
						backdropFilter: "blur(5px)",
						border: "1px solid rgba(255, 255, 255, 0.05)",
					}}>
					<UploadForm
						onUploadSuccess={fetchProjects}
						onOpenTools={() => setIsToolsOpen(true)}
					/>
				</div>

				<DroneToolsModal
					isOpen={isToolsOpen}
					onClose={() => setIsToolsOpen(false)}
				/>

				<div className="flex justify-between items-center mb-6">
					<h2 className="text-2xl font-light text-white tracking-wide">Recent Projects</h2>
				</div>

				{loading ?
					<div className="flex justify-center p-12">
						<div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
					</div>
				:	<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
						{projects.map((project) => (
							<Link
								to={`/project/${project._id}`}
								key={project._id}
								className="block group">
								<div className="glass-card border-none bg-white/5 hover:bg-white/10 transition-all duration-300 transform group-hover:-translate-y-1 h-full flex flex-col items-start text-left">
									<div className="flex justify-between items-start w-full mb-4">
										<div
											className={`w-3 h-3 rounded-full
                                        ${
																					project.status === "COMPLETED" ?
																						"bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]"
																					: project.status === "PROCESSING" ? "bg-blue-400 animate-pulse"
																					: project.status === "FAILED" ? "bg-red-400"
																					: "bg-gray-400"
																				}`}></div>
										<span className="text-xs font-mono text-gray-500">
											{new Date(project.createdAt).toLocaleDateString()}
										</span>
									</div>

									<h3 className="text-2xl font-light text-white mb-2 group-hover:text-blue-300 transition-colors">
										{project.name}
									</h3>
									<div className="w-full mb-6">
										<p className="text-gray-400 text-sm font-light mb-2 line-clamp-2">
											{project.description || "No description provided."}
										</p>

										{/* Progress Bar for Processing Projects */}
										{project.status === "PROCESSING" && (
											<div className="mt-4">
												<div className="flex justify-between text-xs mb-1">
													<span className="text-blue-300 uppercase tracking-widest">Processing</span>
													<span className="text-white font-mono">{project.progress || 0}%</span>
												</div>
												<div className="w-full bg-white/10 rounded-full h-1 overflow-hidden">
													<div
														className="bg-blue-400 h-1 rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(96,165,250,0.5)]"
														style={{ width: `${project.progress || 0}%` }}></div>
												</div>
											</div>
										)}
									</div>

									<div className="w-full pt-4 border-t border-white/5 flex justify-between items-center">
										<span className="text-xs uppercase tracking-widest text-gray-500">ID: {project._id.slice(-6)}</span>
										<span className="text-sm text-white/80 group-hover:translate-x-1 transition-transform">View →</span>
									</div>
								</div>
							</Link>
						))}

						{projects.length === 0 && (
							<div className="col-span-full py-12 text-center text-gray-500 font-light">
								No projects found. Initialize a new scan above.
							</div>
						)}
					</div>
				}
			</div>
		</>
	);
};
export default Dashboard;
