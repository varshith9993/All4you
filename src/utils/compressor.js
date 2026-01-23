import imageCompression from 'browser-image-compression';

/**
 * Compresses an image file efficiently while maintaining quality.
 * Skips SVG files as they shouldn't be rasterized/compressed this way.
 * 
 * @param {File} file - The file to compress
 * @param {Object} customOptions - Overrides for compression
 * @param {string} typeLabel - Label for logging (e.g., 'POST', 'CHAT')
 * @returns {Promise<File>} - The compressed file or original if compression skipped/failed
 */
export async function compressImage(file, customOptions = {}, typeLabel = 'IMAGE') {
    // 1. Skip if not an image
    if (!file.type || !file.type.startsWith('image/')) {
        return file;
    }

    // 2. Skip SVG files (they are vector and shouldn't be compressed by rasterizer)
    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
        return file;
    }


    // 3. Compression Options
    const defaultOptions = {
        maxSizeMB: 0.23, // Targeted < 240KB (Strict optimization)
        maxWidthOrHeight: 1200,
        useWebWorker: true,
        fileType: file.type
    };

    const options = { ...defaultOptions, ...customOptions };

    try {
        const compressedFile = await imageCompression(file, options);

        // If somehow compressed file is larger (can happen with already optimized images), return original
        if (compressedFile.size > file.size) {
            return file;
        }

        return compressedFile;
    } catch (error) {
        return file;
    }
}

/**
 * Aggressive compression for Profile Images.
 * Requirement: <50kb and 500x500 dimensions.
 */
export async function compressProfileImage(file) {
    if (!file || !file.type.startsWith('image/')) return file;
    if (file.type === 'image/svg+xml') return file;

    const options = {
        maxSizeMB: 0.045, // Target ~46KB to stay safely under 50KB
        maxWidthOrHeight: 500,
        useWebWorker: true,
        fileType: file.type
    };

    try {
        const compressed = await imageCompression(file, options);
        return compressed.size > file.size ? file : compressed;
    } catch (err) {
        return compressImage(file, { maxSizeMB: 0.1 }, 'PROFILE-FALLBACK');
    }
}

/**
 * General purpose compressor entry point.
 * 
 * @param {File} file 
 * @param {Object} customOptions 
 * @param {string} typeLabel
 * @returns {Promise<File>}
 */
export async function compressFile(file, customOptions = {}, typeLabel = 'GENERAL') {
    if (!file) return null;

    if (file.type.startsWith('image/')) {
        return await compressImage(file, customOptions, typeLabel);
    }

    // Audio/PDF: Currently returned as-is. 
    // Client-side compression for these is extremely resource intensive (ffmpeg.wasm).
    return file;
}
