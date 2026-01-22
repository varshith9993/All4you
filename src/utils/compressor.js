import imageCompression from 'browser-image-compression';

/**
 * Compresses an image file efficiently while maintaining quality.
 * Skips SVG files as they shouldn't be rasterized/compressed this way.
 * 
 * @param {File} file - The file to compress
 * @returns {Promise<File>} - The compressed file or original if compression skipped/failed
 */
export async function compressImage(file, customOptions = {}) {
    // 1. Skip if not an image
    if (!file.type || !file.type.startsWith('image/')) {
        return file;
    }

    // 2. Skip SVG files (they are vector and shouldn't be compressed by rasterizer)
    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
        return file;
    }

    // 3. Compression Options
    // - maxSizeMB: Target file size in MB. 0.8MB is good for web.
    // - maxWidthOrHeight: Resize excessively large images (e.g. 4K uploads). 
    //   1920px is standard HD and good for most UI needs.
    // - useWebWorker: Run in background thread to avoid freezing UI.
    const defaultOptions = {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: file.type // Preserve original type (e.g. image/png)
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
        console.error("Image compression failed, using original file:", error);
        return file;
    }
}

/**
 * Aggressive compression for Profile Images.
 * Requirement: <99kb and small dimensions (e.g. 500x500).
 * Quality is secondary to size and speed.
 */
export async function compressProfileImage(file) {
    if (!file || !file.type.startsWith('image/')) return file;

    // SVGs usually don't need compression, but if they are huge we might want to checks. 
    // For now assuming SVGs are fine or handled by general logic.
    if (file.type === 'image/svg+xml') return file;

    const options = {
        maxSizeMB: 0.09, // ~90KB (User asked for <99kb)
        maxWidthOrHeight: 500, // Small round icon, 500px is plenty (retina friendly)
        useWebWorker: true,
        fileType: file.type
    };

    try {
        const compressed = await imageCompression(file, options);
        // Safety check: if compression somehow made it larger (rare), return original
        return compressed.size > file.size ? file : compressed;
    } catch (err) {
        console.warn("Profile compression failed, falling back to standard:", err);
        return compressImage(file, { maxSizeMB: 0.2 });
    }
}

/**
 * General purpose compressor entry point.
 * Can be extended for Audio/Video compression if libraries are added.
 * Current implementation focuses on Image compression as it gives highest storage/bandwidth wins.
 * 
 * @param {File} file 
 * @param {Object} customOptions - Optional overrides for compression settings
 * @returns {Promise<File>}
 */
export async function compressFile(file, customOptions = {}) {
    if (!file) return null;

    if (file.type.startsWith('image/')) {
        return await compressImage(file, customOptions);
    }

    // Audio/PDF compression client-side is complex and requires heavy WASM libraries (ffmpeg.wasm).
    // For now, we return these files as-is to ensure functionality.
    // If we need to "compress" them, we might just enforce strict size limits in validation.
    return file;
}
