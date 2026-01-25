import React, { useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars, Sparkles, Cloud } from '@react-three/drei';
import * as THREE from 'three';

function Rig() {
    const { camera, mouse } = useThree();
    useFrame(() => {
        // Subtle Parallax
        camera.position.x += (mouse.x * 2 - camera.position.x) * 0.02;
        camera.position.y += (-mouse.y * 2 - camera.position.y) * 0.02;
        camera.lookAt(0, 0, 0);
    });
    return null;
}

const Background3D = () => {
    return (
        <div className="fixed inset-0 z-[-1] bg-black">
            {/* Deep Space Gradient */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#0B0B15] via-[#000000] to-black z-[0]" />

            <Canvas camera={{ position: [0, 0, 10], fov: 60 }}>
                <fog attach="fog" args={['#000000', 5, 30]} />

                {/* Dense, shiny starfield */}
                <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
                <Sparkles count={500} scale={20} size={2} speed={0.4} opacity={0.5} color="#ffffff" />

                {/* Subtle Clouds for depth */}
                <Cloud opacity={0.1} speed={0.2} width={10} depth={1.5} segments={20} position={[0, 0, -10]} color="#1e1e2e" />

                <Rig />
            </Canvas>
        </div>
    );
};

export default Background3D;
