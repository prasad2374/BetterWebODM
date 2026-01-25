import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Stage } from '@react-three/drei';

const Model = ({ url }) => {
    const { scene } = useGLTF(url);
    return <primitive object={scene} />;
};

const ModelViewer = ({ taskId }) => {
    // Backend proxy URL for the model
    const modelUrl = `http://localhost:5000/api/projects/${taskId}/model`;

    return (
        <div className="h-full w-full bg-gray-900 rounded-lg overflow-hidden shadow-inner border border-gray-700 relative">
            <Canvas shadows dpr={[1, 2]} camera={{ fov: 50 }}>
                <Suspense fallback={null}>
                    <Stage environment="city" intensity={0.6}>
                        <Model url={modelUrl} />
                    </Stage>
                </Suspense>
                <OrbitControls autoRotate={false} />
            </Canvas>

            <div className="absolute bottom-4 left-4 bg-black/50 text-white px-3 py-1 rounded text-sm pointer-events-none">
                Left Click: Rotate | Right Click: Pan | Scroll: Zoom
            </div>
        </div>
    );
};

export default ModelViewer;
