import { useState, useCallback } from "react";
import { reverseGeocode } from "../utils/locationService";

export function useLocationWithAddress(apiKey, apiProvider) {
  // apiKey argument is kept for signature compatibility but ignored
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);

  const fetchAddress = useCallback(async (lat, lon) => {
    setAddressLoading(true);
    try {
      const data = await reverseGeocode(lat, lon, apiProvider);

      if (apiProvider === 'locationiq') {
        if (data && data.address) {
          const addr = data.address;
          setAddress({
            city: addr.city || addr.town || addr.village || "",
            place: addr.suburb || addr.neighbourhood || "",
            pincode: addr.postcode || "",
            formatted: data.display_name || "",
          });
        }
      } else {
        // Default to OpenCage (assumes 'opencage' or fallback)
        if (data && data.results && data.results.length > 0) {
          const comp = data.results[0].components;
          setAddress({
            city: comp.city || comp.town || comp.village || "",
            place: comp.suburb || comp.neighbourhood || "",
            pincode: comp.postcode || "",
            formatted: data.results[0].formatted,
          });
        } else {
          setAddress(null);
        }
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      setAddress(null);
    }
    setAddressLoading(false);
  }, [apiProvider]); // apiKey removed from dependency

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      return;
    }
    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setLocation(coords);
        setLoading(false);
        fetchAddress(coords.latitude, coords.longitude);
      },
      () => {
        setError(
          "Failed to access location. Turn on GPS/location for better location. For best location sit near a window or outdoors."
        );
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0,
      }
    );
  }, [fetchAddress]);

  // Removed auto-fetch useEffect to prevent unwanted permission prompts
  // useEffect(() => {
  //   requestLocation();
  // }, []);

  return {
    location,
    address,
    error,
    loading,
    addressLoading,
    requestLocation,
  };
}
