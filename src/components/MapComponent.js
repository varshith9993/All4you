import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { FiMaximize, FiExternalLink, FiMapPin, FiPlus, FiMinus, FiX } from 'react-icons/fi';

// Icons need to be imported to work correctly with webpack/CRA
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';

// Fix for default marker icon
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconRetinaUrl: iconRetina,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28],
    shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Component to handle map center updates when coordinates change
function MapUpdater({ center }) {
    const map = useMap();
    useEffect(() => {
        map.setView(center);
        map.invalidateSize();
    }, [center, map]);
    return null;
}

// Controls nested inside MapContainer
function MapControls({ isFullScreen, onToggleFullScreen }) {
    const map = useMap();

    const handleZoomIn = (e) => {
        e.stopPropagation();
        map.zoomIn();
    };

    const handleZoomOut = (e) => {
        e.stopPropagation();
        map.zoomOut();
    };

    if (isFullScreen) {
        // Full Screen Mode Controls: Zoom on Right Side
        return (
            <div className="absolute top-20 right-4 flex flex-col gap-3 z-[400] pointer-events-none">
                <div className="flex flex-col bg-white/90 backdrop-blur-md rounded-xl shadow-lg border border-white/20 overflow-hidden pointer-events-auto">
                    <button
                        onClick={handleZoomIn}
                        className="p-3 text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-100/50 flex items-center justify-center"
                        aria-label="Zoom In"
                    >
                        <FiPlus size={20} />
                    </button>
                    <button
                        onClick={handleZoomOut}
                        className="p-3 text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors flex items-center justify-center"
                        aria-label="Zoom Out"
                    >
                        <FiMinus size={20} />
                    </button>
                </div>
            </div>
        );
    }

    // Inline Mode Controls: Zoom on Left, FullScreen on Right
    return (
        <>
            {/* Zoom Controls (Left Top) */}
            <div className="absolute top-4 left-4 z-[400] pointer-events-none">
                <div className="flex flex-col bg-white/90 backdrop-blur-md rounded-xl shadow-lg border border-white/20 overflow-hidden pointer-events-auto">
                    <button
                        onClick={handleZoomIn}
                        className="p-2.5 text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-100/50 flex items-center justify-center"
                        aria-label="Zoom In"
                    >
                        <FiPlus size={18} />
                    </button>
                    <button
                        onClick={handleZoomOut}
                        className="p-2.5 text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors flex items-center justify-center"
                        aria-label="Zoom Out"
                    >
                        <FiMinus size={18} />
                    </button>
                </div>
            </div>

            {/* Full Screen Toggle (Right Top) */}
            <div className="absolute top-4 right-4 z-[400] pointer-events-none">
                <button
                    onClick={onToggleFullScreen}
                    className="pointer-events-auto bg-white/90 backdrop-blur-md p-2.5 rounded-xl shadow-lg border border-white/20 text-gray-700 hover:bg-gray-50 active:scale-95 transition-all flex items-center justify-center"
                    aria-label="Enter Full Screen"
                >
                    <FiMaximize size={18} />
                </button>
            </div>
        </>
    );
}

export default function MapComponent({ latitude, longitude, address, className = "" }) {
    const [isFullScreen, setIsFullScreen] = useState(false);

    // Ensure latitude and longitude are valid numbers
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const hasCoordinates = !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;

    const defaultZoom = 14;
    const fullScreenZoom = 16;

    useEffect(() => {
        // Lock body scroll when in full screen
        if (isFullScreen) {
            document.body.style.overflow = 'hidden';
            document.body.style.touchAction = 'none';
        } else {
            document.body.style.overflow = 'auto';
            document.body.style.touchAction = 'auto';
        }
        return () => {
            document.body.style.overflow = 'auto';
            document.body.style.touchAction = 'auto';
        };
    }, [isFullScreen]);

    if (!hasCoordinates) {
        return (
            <div className={`bg-gray-50 p-6 rounded-2xl text-center text-gray-500 border border-gray-100 flex flex-col items-center justify-center ${className} h-40`}>
                <FiMapPin size={24} className="mb-2 opacity-50" />
                <p className="text-sm font-medium">Map View Unavailable</p>
                <p className="text-xs text-gray-400 mt-1">Provide location coordinates to view on map</p>
            </div>
        );
    }

    const position = [lat, lng];

    const toggleFullScreen = (e) => {
        if (e) e.stopPropagation();
        setIsFullScreen(!isFullScreen);
    };

    const openGoogleMaps = (e) => {
        if (e) e.stopPropagation();
        window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
    };

    const renderMap = (isFull = false) => (
        <MapContainer
            center={position}
            zoom={isFull ? fullScreenZoom : defaultZoom}
            style={{ height: '100%', width: '100%', zIndex: isFull ? 0 : 10, background: '#f8f9fa' }}
            scrollWheelZoom={isFull}
            dragging={true}
            touchZoom={true}
            doubleClickZoom={true}
            zoomControl={false} // Disable default zoom control
            attributionControl={false} // Clean look, minimal
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
            />
            <Marker position={position}>
                {address && <Popup>{address}</Popup>}
            </Marker>

            <MapUpdater center={position} />

            <MapControls isFullScreen={isFull} onToggleFullScreen={toggleFullScreen} />
        </MapContainer>
    );

    return (
        <>
            {/* Inline Map */}
            <div className={`relative rounded-2xl overflow-hidden shadow-sm border border-gray-200 bg-gray-100 h-64 w-full z-0 ${className}`}>
                {renderMap(false)}

                {/* External Link Button (Bottom) */}
                <div className="absolute bottom-3 right-3 left-3 z-[400] pointer-events-none">
                    <button
                        onClick={openGoogleMaps}
                        className="w-full bg-white/95 backdrop-blur-md p-3 rounded-xl shadow-lg hover:bg-white text-blue-600 font-bold transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 border border-blue-50 pointer-events-auto"
                    >
                        <FiExternalLink size={18} /> Open with Maps
                    </button>
                </div>
            </div>

            {/* Full Screen Overlay Portal */}
            {isFullScreen && createPortal(
                <div className="fixed inset-0 z-[9999] bg-white animate-fade-in flex flex-col touch-none">
                    {/* Header Bar - Authentic Mobile Look */}
                    <div className="absolute top-0 left-0 right-0 z-[500] p-4 pt-safe-top flex justify-between items-center pointer-events-none bg-gradient-to-b from-white/80 to-transparent">

                        {/* Close (Cross) Icon on Left Top */}
                        <button
                            onClick={toggleFullScreen}
                            className="pointer-events-auto bg-white/90 backdrop-blur-md w-10 h-10 flex items-center justify-center rounded-full shadow-md text-gray-800 hover:bg-white transition-transform active:scale-90 border border-gray-100"
                            aria-label="Close Full Screen"
                        >
                            <FiX size={22} />
                        </button>

                        {address && (
                            <div className="mx-4 px-4 py-2 bg-white/90 backdrop-blur-md rounded-full shadow-sm border border-gray-100 pointer-events-auto max-w-[200px] truncate text-sm font-semibold text-gray-700">
                                {address.split(',')[0]}
                            </div>
                        )}

                        <button
                            onClick={openGoogleMaps}
                            className="pointer-events-auto bg-blue-600/90 backdrop-blur-md w-10 h-10 flex items-center justify-center rounded-full shadow-lg text-white hover:bg-blue-600 transition-transform active:scale-90 border border-blue-500"
                        >
                            <FiExternalLink size={20} />
                        </button>
                    </div>

                    {/* Map Area */}
                    <div className="flex-1 w-full h-full relative" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                        {renderMap(true)}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
