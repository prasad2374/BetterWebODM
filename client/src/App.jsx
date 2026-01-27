import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ProjectList from './pages/Dashboard';
import ProjectDetails from './pages/ProjectDetails';

function App() {
    return (
        <Router>
            <div className="min-h-screen font-sans">
                <Routes>
                    <Route path="/" element={<ProjectList />} />
                    <Route path="/project/:id" element={<ProjectDetails />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;
