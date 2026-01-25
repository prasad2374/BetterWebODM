import React from 'react';
import { MapContainer, TileLayer, Rectangle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in React Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const MapViewer = ({ taskId, project }) => {
    // Use local backend proxy to fetch tiles authenticated
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const tileUrl = `${baseUrl}/projects/${taskId}/tiles/{z}/{x}/{y}.png`;

    const MapContent = () => {
        const map = useMap();
        const [bounds, setBounds] = React.useState(null);

        React.useEffect(() => {
            if (project && project.extent && project.extent.length === 4) {
                const [minLon, minLat, maxLon, maxLat] = project.extent;
                const b = [
                    [minLat, minLon],
                    [maxLat, maxLon]
                ];
                setBounds(b);
                try {
                    map.fitBounds(b);
                } catch (e) {
                    console.error("Error fitting bounds:", e);
                }
            }
        }, [project, map]);

        return (
            <>
                <TileLayer
                    attribution='&copy; Google Maps'
                    url="http://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}"
                />



                {/* Overlay the Orthophoto */}
                <TileLayer
                    url={tileUrl}
                    tms={true}
                    opacity={1}
                    maxZoom={21}
                />
            </>
        );
    };

    return (
        <div className="h-full w-full rounded-lg overflow-hidden shadow-inner border border-gray-300">
            <MapContainer center={[0, 0]} zoom={2} style={{ height: '100%', width: '100%' }}>
                <MapContent />
            </MapContainer>
        </div>
    );
};

export default MapViewer;
