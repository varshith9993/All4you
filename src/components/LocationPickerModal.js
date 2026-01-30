import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { FiX, FiMapPin, FiCheck, FiLoader, FiPlus, FiMinus, FiSearch, FiNavigation } from 'react-icons/fi';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix for default marker icon issue in Leaflet with React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});



// Component to handle map clicks and update marker position
function LocationMarker({ position, setPosition }) {
    const markerRef = useRef(null);
    const map = useMapEvents({
        click(e) {
            // Check if the click target is the map container itself or a tile
            // This prevents clicks on UI controls from moving the pin
            const target = e.originalEvent.target;
            if (target.closest('.leaflet-control') || target.closest('button') || target.closest('input')) {
                return;
            }

            setPosition(e.latlng);
            // Fly to a slightly offset position to account for UI overlays if needed, 
            // but for now centering on the click is standard behavior.
            map.flyTo(e.latlng, map.getZoom());
        },
    });

    const eventHandlers = {
        dragend() {
            const marker = markerRef.current;
            if (marker != null) {
                setPosition(marker.getLatLng());
            }
        },
    };

    useEffect(() => {
        if (position) {
            // When position updates (e.g. from search), fly to it
            // We use a high zoom level (18) to ensure the user sees 'where the pin went'
            map.flyTo(position, 18, {
                animate: true,
                duration: 1.5
            });
        }
    }, [position, map]);

    return position === null ? null : (
        <Marker
            draggable={true}
            eventHandlers={eventHandlers}
            position={position}
            ref={markerRef}
        />
    );
}

// Custom Zoom Controls Component
function ZoomControls({ onLocate }) {
    const map = useMap();

    const handleZoomIn = (e) => {
        e.stopPropagation();
        map.zoomIn();
    };

    const handleZoomOut = (e) => {
        e.stopPropagation();
        map.zoomOut();
    };

    const handleLocate = (e) => {
        e.stopPropagation();
        onLocate();
    };

    return (
        <div
            className="absolute top-4 right-4 z-[1000] flex flex-col gap-2 pointer-events-none"
        >
            <div
                className="flex flex-col bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 overflow-hidden pointer-events-auto"
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
                onDoubleClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
            >
                <button
                    onClick={handleLocate}
                    className="p-2 text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-100 flex items-center justify-center focus:outline-none text-indigo-600"
                    aria-label="My Location"
                    type="button"
                    title="My Location"
                >
                    <FiNavigation size={18} />
                </button>
                <button
                    onClick={handleZoomIn}
                    className="p-2 text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-100 flex items-center justify-center focus:outline-none"
                    aria-label="Zoom In"
                    type="button"
                >
                    <FiPlus size={18} />
                </button>
                <button
                    onClick={handleZoomOut}
                    className="p-2 text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors flex items-center justify-center focus:outline-none"
                    aria-label="Zoom Out"
                    type="button"
                >
                    <FiMinus size={18} />
                </button>
            </div>
        </div>
    );
}

export default function LocationPickerModal({ show, initialPosition, onConfirm, onCancel, apiKey, apiProvider }) {
    const [position, setPosition] = useState(null);
    const [address, setAddress] = useState({ area: '', city: '', pincode: '' });
    const [geocoding, setGeocoding] = useState(false);
    const [error, setError] = useState('');
    const [mapCenter, setMapCenter] = useState([20.5937, 78.9629]); // India center
    const [mapZoom, setMapZoom] = useState(5);
    const [mapReady, setMapReady] = useState(false);

    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [searching, setSearching] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Debounce ref
    const searchTimeoutRef = useRef(null);

    const handleSearch = (e) => {
        const query = e.target.value;
        setSearchQuery(query);
        setShowSuggestions(true);

        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (query.trim().length < 2) {
            setSuggestions([]);
            return;
        }

        searchTimeoutRef.current = setTimeout(async () => {
            setSearching(true);
            try {
                let formattedQuery = query;
                const pincodeMatch = query.match(/\b\d{6}\b/);
                const isPincode = pincodeMatch !== null;

                // If query contains a 6-digit Pincode, ensure we bias towards India strongly
                if (isPincode) {
                    // If it's JUST a pincode, help the API by adding 'India'
                    if (query.trim() === pincodeMatch[0]) {
                        formattedQuery = `${query}, India`;
                    }
                }

                let results = [];
                // Use backend proxy via locationService
                const data = await import('../utils/locationService').then(mod => mod.autocomplete(formattedQuery, apiProvider));

                if (apiProvider === 'locationiq') {
                    if (Array.isArray(data)) {
                        results = data.map(item => ({
                            display_name: item.display_name,
                            lat: item.lat,
                            lon: item.lon,
                            type: item.type,
                            address: item.address,
                            pincode: item.address?.postcode
                        }));
                    }
                } else {
                    // OpenCage
                    if (data && data.results) {
                        results = data.results.map(item => ({
                            display_name: item.formatted,
                            lat: item.geometry.lat,
                            lon: item.geometry.lng,
                            type: item.components._type || 'location',
                            pincode: item.components.postcode
                        }));
                    }
                }
                setSuggestions(results);
            } catch (error) {
                console.error("Search error:", error);
                setSuggestions([]);
            } finally {
                setSearching(false);
            }
        }, 400); // Reduced delay slightly for better responsiveness
    };

    const handleSelectSuggestion = (suggestion) => {
        const lat = parseFloat(suggestion.lat);
        const lng = parseFloat(suggestion.lon || suggestion.lng);

        if (!isNaN(lat) && !isNaN(lng)) {
            // First update position which will trigger map movement
            setPosition({ lat, lng });
            setMapCenter([lat, lng]);
            setMapZoom(18);
            setSearchQuery(suggestion.display_name);

            // Pre-fill address state immediately from search suggestion to avoid geocoding delay
            if (suggestion.address || suggestion.display_name) {
                let area = "";
                let city = "";
                let pincode = suggestion.pincode || "";

                if (suggestion.address) {
                    const addr = suggestion.address;
                    area = addr.suburb || addr.neighbourhood || addr.village || addr.residential || '';
                    city = addr.city || addr.town || addr.county || addr.state_district || '';
                    if (!pincode) pincode = addr.postcode || "";
                } else {
                    // Fallback for OpenCage or simpler results
                    const parts = suggestion.display_name.split(',');
                    area = parts[0]?.trim() || "";
                    city = parts[1]?.trim() || "";
                }

                setAddress({ area, city, pincode });
            }

            setShowSuggestions(false);
            setSuggestions([]);
        }
    };

    const getCurrentLocation = useCallback(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    setPosition({ lat, lng });
                    setMapCenter([lat, lng]);
                    setMapZoom(16);
                },
                (err) => {
                    console.error('Error getting current location:', err);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 20000,
                    maximumAge: 300000, // 5 minutes cache for faster load
                }
            );
        }
    }, []);

    // Initialize position when modal opens
    useEffect(() => {
        if (show) {
            // Small timeout to ensure modal is rendered before map initializes
            setTimeout(() => setMapReady(true), 100);

            if (initialPosition && initialPosition.lat && initialPosition.lng) {
                const lat = parseFloat(initialPosition.lat);
                const lng = parseFloat(initialPosition.lng);
                if (!isNaN(lat) && !isNaN(lng)) {
                    setPosition({ lat, lng });
                    setMapCenter([lat, lng]);
                    setMapZoom(15);
                } else {
                    getCurrentLocation();
                }
            } else {
                getCurrentLocation();
            }
        } else {
            setMapReady(false);
        }
    }, [show, initialPosition, getCurrentLocation]);

    const reverseGeocode = useCallback(async (lat, lng) => {
        setGeocoding(true);
        setError('');

        try {
            let area = '';
            let city = '';
            let pincode = '';

            // Use backend proxy via locationService
            const data = await import('../utils/locationService').then(mod => mod.reverseGeocode(lat, lng, apiProvider));

            if (apiProvider === 'locationiq') {
                if (data && data.address) {
                    const addr = data.address;
                    area = addr.suburb || addr.neighbourhood || addr.village || addr.residential || '';
                    city = addr.city || addr.town || addr.county || addr.state_district || '';
                    pincode = addr.postcode || '';
                }
            } else if (apiProvider === 'opencage') {
                if (data && data.results && data.results.length > 0) {
                    const comp = data.results[0].components;
                    area = comp.suburb || comp.neighbourhood || comp.village || comp.residential || '';
                    city = comp.city || comp.town || comp.county || comp.state_district || '';
                    pincode = comp.postcode || '';
                }
            } else {
                // Should not happen if backend defaults correctly, but safety check
                console.warn(`Unexpected API Provider: ${apiProvider}`);
            }

            setAddress({ area, city, pincode });

        } catch (err) {
            console.error('Geocoding error:', err);
            setError('Failed to fetch address. You can still use the coordinates.');
        } finally {
            setGeocoding(false);
        }
    }, [apiProvider]);

    // Reverse geocode when position changes
    useEffect(() => {
        if (position) {
            reverseGeocode(position.lat, position.lng);
        }
    }, [position, reverseGeocode]);

    const handleConfirm = () => {
        if (!position) {
            setError('Please select a location on the map');
            return;
        }

        onConfirm({
            lat: position.lat.toString(),
            lng: position.lng.toString(),
            area: address.area,
            city: address.city,
            pincode: address.pincode,
        });
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden relative">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-pink-50 flex-shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <FiMapPin className="text-indigo-600" />
                            Pin Your Location
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">Click or drag the marker to select your exact location</p>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-2 hover:bg-white/50 rounded-full transition-colors"
                        aria-label="Close"
                    >
                        <FiX size={24} className="text-gray-600" />
                    </button>
                </div>

                {/* Map Container - Flex 1 to fill available space */}
                <div className="flex-1 relative w-full h-full bg-gray-100">
                    {mapReady && (
                        <MapContainer
                            center={mapCenter}
                            zoom={mapZoom}
                            style={{ height: '100%', width: '100%' }}
                            scrollWheelZoom={true}
                            attributionControl={false}
                            zoomControl={false}
                        >
                            <TileLayer
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            <LocationMarker position={position} setPosition={setPosition} />
                            <ZoomControls onLocate={getCurrentLocation} />
                        </MapContainer>
                    )}

                    {!mapReady && (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                            <div className="flex flex-col items-center">
                                <FiLoader className="animate-spin mb-2" size={32} />
                                <span>Loading Map...</span>
                            </div>
                        </div>
                    )}

                    {/* Search Bar Overlay */}
                    <div className="absolute top-4 left-4 right-16 z-[1000] w-64 md:w-80">
                        <div className="relative">
                            <div className="relative bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 flex items-center overflow-hidden">
                                <div className="pl-3 text-gray-400">
                                    <FiSearch size={18} />
                                </div>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={handleSearch}
                                    onFocus={() => setShowSuggestions(true)}
                                    placeholder="Search city, area, pincode..."
                                    className="w-full py-3 px-3 bg-transparent border-none focus:ring-0 text-sm text-gray-700 placeholder-gray-400"
                                />
                                {searching && (
                                    <div className="pr-3 text-indigo-500">
                                        <FiLoader className="animate-spin" size={16} />
                                    </div>
                                )}
                                {searchQuery && (
                                    <button
                                        onClick={() => {
                                            setSearchQuery('');
                                            setSuggestions([]);
                                        }}
                                        className="pr-3 text-gray-400 hover:text-gray-600"
                                    >
                                        <FiX size={16} />
                                    </button>
                                )}
                            </div>

                            {/* Suggestions Dropdown */}
                            {showSuggestions && suggestions.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden max-h-60 overflow-y-auto divide-y divide-gray-50 animate-slide-up">
                                    {suggestions.map((item, index) => (
                                        <button
                                            key={index}
                                            onClick={() => handleSelectSuggestion(item)}
                                            className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-start gap-3 transition-colors border-b border-gray-50 last:border-0"
                                        >
                                            <div className="mt-0.5 bg-indigo-50 p-1.5 rounded-full text-indigo-600 flex-shrink-0">
                                                <FiMapPin size={14} />
                                            </div>
                                            <div className="flex flex-col overflow-hidden">
                                                <span className="text-sm font-medium text-gray-900 truncate">
                                                    {item.display_name.split(',')[0]}
                                                </span>
                                                <span className="text-xs text-gray-500 truncate">
                                                    {item.pincode && <span className="mr-1 font-semibold text-indigo-500">[{item.pincode}]</span>}
                                                    {item.display_name}
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Coordinates Display Overlay - Moved down slightly */}
                    {position && (
                        <div className="absolute bottom-6 left-4 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-4 max-w-xs z-[1000] border border-gray-200">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="font-semibold text-gray-700">Latitude:</span>
                                    <span className="text-gray-900 font-mono">{position.lat.toFixed(6)}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="font-semibold text-gray-700">Longitude:</span>
                                    <span className="text-gray-900 font-mono">{position.lng.toFixed(6)}</span>
                                </div>
                                {geocoding ? (
                                    <div className="flex items-center gap-2 text-sm text-indigo-600">
                                        <FiLoader className="animate-spin" size={14} />
                                        <span>Fetching address...</span>
                                    </div>
                                ) : (
                                    (address.city || address.area) && (
                                        <div className="pt-2 border-t border-gray-200">
                                            <p className="text-xs text-gray-600 font-medium leading-relaxed">
                                                {address.area && `${address.area}, `}
                                                {address.city}
                                                {address.pincode && ` - ${address.pincode}`}
                                            </p>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                    {error && (
                        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            {error}
                        </div>
                    )}
                    <div className="flex gap-3">
                        <button
                            onClick={onCancel}
                            className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={!position || geocoding}
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-pink-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <FiCheck size={18} />
                            Confirm Location
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
