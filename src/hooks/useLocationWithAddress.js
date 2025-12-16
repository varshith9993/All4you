import { useState, useEffect, useCallback } from "react";

const OPENCAGE_API_KEY = "43ac78a805af4868b01f3dc9dcae8556";

export function useLocationWithAddress() {
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);

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
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  }, []);

  const fetchAddress = async (lat, lon) => {
    setAddressLoading(true);
    try {
      const resp = await fetch(
        `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=${OPENCAGE_API_KEY}`
      );
      const data = await resp.json();
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
    } catch {
      setAddress(null);
    }
    setAddressLoading(false);
  };

  useEffect(() => {
    requestLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    location,
    address,
    error,
    loading,
    addressLoading,
    requestLocation,
  };
}
