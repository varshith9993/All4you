/**
 * Cloudflare Worker for Location API - OPTIMIZED
 * 
 * Features:
 * - Automatic key rotation on rate limit (429)
 * - Cross-provider fallback (LocationIQ → OpenCage)
 * - Response caching (1 hour)
 * - 2-second timeout per request (faster)
 * - Optimized CPU time (<3ms target)
 * - CORS support
 * - Prevents duplicate requests
 */

export default {
    async fetch(request, env, ctx) {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: corsHeaders(),
            });
        }

        // Only allow POST requests
        if (request.method !== 'POST') {
            return jsonResponse({ error: 'Method not allowed' }, 405);
        }

        try {
            const { action, lat, lon, query } = await request.json();

            // Validate input
            if (!action) {
                return jsonResponse({ error: 'Action is required' }, 400);
            }

            // Create cache key
            const cacheKey = new Request(
                `https://cache/${action}/${lat || query}/${lon || ''}`,
                request
            );

            // Try cache first
            const cache = caches.default;
            let cachedResponse = await cache.match(cacheKey);

            if (cachedResponse) {
                const body = await cachedResponse.json();
                return jsonResponse(body, 200, true); // Cache HIT
            }

            // Cache miss - fetch from API
            let response;
            if (action === 'reverseGeocode') {
                response = await handleReverseGeocode(lat, lon, env);
            } else if (action === 'autocomplete') {
                response = await handleAutocomplete(query, env);
            } else {
                return jsonResponse({ error: 'Invalid action' }, 400);
            }

            // Cache successful responses
            if (response.status === 200) {
                ctx.waitUntil(cache.put(cacheKey, response.clone()));
            }

            return response;
        } catch (error) {
            console.error('Worker error:', error);
            return jsonResponse({ error: 'Internal server error', details: error.message }, 500);
        }
    },
};

/**
 * Handle reverse geocoding with optimized key rotation
 */
async function handleReverseGeocode(lat, lon, env) {
    if (!lat || !lon) {
        return jsonResponse({ error: 'Latitude and longitude are required' }, 400);
    }

    // Try LocationIQ keys first (4 keys)
    const locationiqKeys = [
        env.LOCATIONIQ_KEY_1,
        env.LOCATIONIQ_KEY_2,
        env.LOCATIONIQ_KEY_3,
        env.LOCATIONIQ_KEY_4,
    ];

    for (let i = 0; i < locationiqKeys.length; i++) {
        const key = locationiqKeys[i];
        if (!key) continue;

        const url = `https://us1.locationiq.com/v1/reverse.php?key=${key}&lat=${lat}&lon=${lon}&format=json`;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout

            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                return jsonResponse(data);
            }

            if (response.status === 429) {
                continue; // Try next key
            }
        } catch (error) {
            // Timeout or network error - try next key
            continue;
        }
    }

    // All LocationIQ keys exhausted, try OpenCage (3 keys)
    const opencageKeys = [
        env.OPENCAGE_KEY_1,
        env.OPENCAGE_KEY_2,
        env.OPENCAGE_KEY_3,
    ];

    for (let i = 0; i < opencageKeys.length; i++) {
        const key = opencageKeys[i];
        if (!key) continue;

        const url = `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=${key}&no_annotations=1`;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout

            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                return jsonResponse(data);
            }

            if (response.status === 429) {
                continue;
            }
        } catch (error) {
            // Timeout or network error - try next key
            continue;
        }
    }

    // All keys exhausted
    return jsonResponse(
        { error: 'All API keys exhausted. Please try again later.' },
        503
    );
}

/**
 * Handle autocomplete with optimized key rotation
 */
async function handleAutocomplete(query, env) {
    if (!query) {
        return jsonResponse({ error: 'Query is required' }, 400);
    }

    // Try LocationIQ keys first (4 keys)
    const locationiqKeys = [
        env.LOCATIONIQ_KEY_1,
        env.LOCATIONIQ_KEY_2,
        env.LOCATIONIQ_KEY_3,
        env.LOCATIONIQ_KEY_4,
    ];

    for (let i = 0; i < locationiqKeys.length; i++) {
        const key = locationiqKeys[i];
        if (!key) continue;

        const url = `https://api.locationiq.com/v1/autocomplete.php?key=${key}&q=${encodeURIComponent(query)}&limit=5&format=json&countrycodes=in&dedupe=1`;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout

            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                return jsonResponse(data);
            }

            if (response.status === 429) {
                continue;
            }
        } catch (error) {
            // Timeout or network error - try next key
            continue;
        }
    }

    // Try OpenCage for autocomplete (3 keys)
    const opencageKeys = [
        env.OPENCAGE_KEY_1,
        env.OPENCAGE_KEY_2,
        env.OPENCAGE_KEY_3,
    ];

    for (let i = 0; i < opencageKeys.length; i++) {
        const key = opencageKeys[i];
        if (!key) continue;

        const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${key}&limit=5&countrycode=in&no_annotations=1`;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout

            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                return jsonResponse(data);
            }

            if (response.status === 429) {
                continue;
            }
        } catch (error) {
            // Timeout or network error - try next key
            continue;
        }
    }

    // All keys exhausted
    return jsonResponse(
        { error: 'All API keys exhausted. Please try again later.' },
        503
    );
}

/**
 * CORS headers
 */
function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };
}

/**
 * Helper function to create JSON response with CORS headers and caching
 */
function jsonResponse(data, status = 200, cacheHit = false) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(),
            'Cache-Control': status === 200 ? 'public, max-age=3600' : 'no-cache',
            'X-Cache': cacheHit ? 'HIT' : 'MISS',
        },
    });
}
