/**
 * Location Service with Automatic Fallback
 * 
 * Primary: Cloudflare Worker (when deployed)
 * Fallback: Firebase Functions (always available)
 * 
 * Features:
 * - Automatic fallback if Worker fails
 * - API key rotation via backend
 * - No API keys exposed to frontend
 * - Optimized for speed
 */

import { getFunctions, httpsCallable } from "firebase/functions";

// Cloudflare Worker URL (will be used when deployed)
const WORKER_URL = 'https://location-api.aerosigil.workers.dev';

// Firebase Functions fallback
const functions = getFunctions();

/**
 * Reverse Geocode: Get address from Latitude and Longitude.
 * Tries Cloudflare Worker first, falls back to Firebase Functions.
 * 
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} provider - 'locationiq' or 'opencage'
 * @returns {Promise<object>} - The geocoding response data
 */
export const reverseGeocode = async (lat, lon, provider = 'locationiq') => {
    // Try Cloudflare Worker first (with timeout)
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

        const response = await fetch(WORKER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'reverseGeocode',
                lat,
                lon,
            }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            console.log('✅ Using Cloudflare Worker');
            return await response.json();
        }
    } catch (error) {
        console.log('⚠️ Worker unavailable, using Firebase fallback');
    }

    // Fallback to Firebase Functions
    try {
        console.log(`🔄 Using Firebase Functions (${provider})`);
        const reverseGeocodeFn = httpsCallable(functions, 'reverseGeocode');
        const response = await reverseGeocodeFn({ lat, lon, provider });
        return response.data;
    } catch (error) {
        console.error("Reverse Geocoding Error:", error);
        throw new Error('Failed to fetch location data. Please check your internet connection.');
    }
};

/**
 * Autocomplete: Search for places.
 * Tries Cloudflare Worker first, falls back to Firebase Functions.
 * 
 * @param {string} query - Search query
 * @param {string} provider - 'locationiq' or 'opencage'
 * @returns {Promise<object>} - The autocomplete response data
 */
export const autocomplete = async (query, provider = 'locationiq') => {
    // Try Cloudflare Worker first (with timeout)
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

        const response = await fetch(WORKER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'autocomplete',
                query,
            }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            console.log('✅ Using Cloudflare Worker');
            return await response.json();
        }
    } catch (error) {
        console.log('⚠️ Worker unavailable, using Firebase fallback');
    }

    // Fallback to Firebase Functions
    try {
        console.log(`🔄 Using Firebase Functions (${provider})`);
        const autocompleteFn = httpsCallable(functions, 'autocomplete');
        const response = await autocompleteFn({ query, provider });
        return response.data;
    } catch (error) {
        console.error("Autocomplete Error:", error);
        throw new Error('Failed to fetch autocomplete data. Please check your internet connection.');
    }
};
