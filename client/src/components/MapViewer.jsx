import React from 'react';
import { MapContainer, TileLayer, Rectangle, GeoJSON, useMap } from 'react-leaflet';
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

const MapViewer = ({ taskId, project, detections }) => {
    // Use local backend proxy to fetch tiles authenticated
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const tileUrl = `${baseUrl}/projects/${taskId}/tiles/{z}/{x}/{y}.png`;

    return (
        <div className="h-full w-full rounded-lg overflow-hidden shadow-inner border border-gray-300 group">
            <MapContainer center={[0, 0]} zoom={2} style={{ height: '100%', width: '100%' }}>
                <MapContent project={project} detections={detections} tileUrl={tileUrl} />
            </MapContainer>
        </div>
    );
};

const MapContent = ({ project, detections, tileUrl }) => {
    const map = useMap();
    const [bounds, setBounds] = React.useState(null);
    const [mousePos, setMousePos] = React.useState(null);
    const [initialFitDone, setInitialFitDone] = React.useState(false);

    const [sliderValue, setSliderValue] = React.useState(50);
    const boxRef = React.useRef(null);

    // --- Grid Layer ---
    React.useEffect(() => {
        if (!map) return;

        // Custom Grid implementation
        const CanvasGrid = L.GridLayer.extend({
            createTile: function (coords) {
                var tile = L.DomUtil.create('canvas', 'leaflet-tile');
                var ctx = tile.getContext('2d');
                var size = this.getTileSize();
                tile.width = size.x;
                tile.height = size.y;

                // Draw borders
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 15]); // Wider gap
                ctx.beginPath();

                // Draw all 4 sides simply
                ctx.moveTo(0, 0);
                ctx.lineTo(size.x, 0);
                ctx.lineTo(size.x, size.y);
                ctx.lineTo(0, size.y);
                ctx.lineTo(0, 0);

                ctx.stroke();
                return tile;
            }
        });
        const grid = new CanvasGrid({ zIndex: 1000, pointerEvents: 'none' });
        map.addLayer(grid);

        // --- Mouse Move for Cursor Pos ---
        const onMouseMove = (e) => {
            setMousePos(e.latlng);
        };
        map.on('mousemove', onMouseMove);

        return () => {
            map.removeLayer(grid);
            map.off('mousemove', onMouseMove);
        };
    }, [map]);

    React.useEffect(() => {
        if (project && project.extent && project.extent.length === 4) {
            const [minLon, minLat, maxLon, maxLat] = project.extent;
            const b = [
                [minLat, minLon],
                [maxLat, maxLon]
            ];
            setBounds(b);

            // Only fit bounds once or if project changes significantly
            if (!initialFitDone) {
                try {
                    map.fitBounds(b);
                    setInitialFitDone(true);
                } catch (e) {
                    console.error("Error fitting bounds:", e);
                }
            }
        }
    }, [project, map, initialFitDone]);

    return (
        <>
            <TileLayer
                attribution='&copy; Google Maps'
                url="http://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}"
                maxNativeZoom={20}
                maxZoom={25}
            />

            {/* Detections Layer (YOLOv11 Results) */}
            {detections && (
                <GeoJSON
                    key={JSON.stringify(detections)}
                    data={detections}
                    style={() => ({
                        color: '#ef4444',
                        weight: 2,
                        fillColor: '#ef4444',
                        fillOpacity: 0.2
                    })}
                    onEachFeature={(feature, layer) => {
                        const p = feature.properties;
                        if (p && p.label) {
                            layer.bindPopup(p.label); // simplified for brevity in this view
                        }
                    }}
                />
            )}

            {/* Overlay the Orthophoto */}
            {bounds && (
                <TileLayer
                    url={tileUrl}
                    tms={false}
                    opacity={1}
                    maxNativeZoom={20}
                    maxZoom={25}
                    bounds={bounds}
                    minZoom={15}
                />
            )}

            {/* Cursor Position Display */}
            {mousePos && (
                <div className="leaflet-bottom leaflet-right m-4 z-[1000] pointer-events-none">
                    <div className="bg-black/70 backdrop-blur text-white px-3 py-1 rounded text-xs font-mono border border-white/20">
                        {mousePos.lat.toFixed(6)}, {mousePos.lng.toFixed(6)}
                    </div>
                </div>
            )}

        </>
    );
};

export default MapViewer;
