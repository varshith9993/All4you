import imageCompression from 'browser-image-compression';

/**
 * Compresses an image file efficiently while maintaining quality.
 * Skips SVG files as they shouldn't be rasterized/compressed this way.
 * 
 * @param {File} file - The file to compress
 * @returns {Promise<File>} - The compressed file or original if compression skipped/failed
 */
export async function compressImage(file) {
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
    const options = {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: file.type // Preserve original type (e.g. image/png)
    };

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
 * General purpose compressor entry point.
 * Can be extended for Audio/Video compression if libraries are added.
 * Current implementation focuses on Image compression as it gives highest storage/bandwidth wins.
 * 
 * @param {File} file 
 * @returns {Promise<File>}
 */
export async function compressFile(file) {
    if (!file) return null;

    if (file.type.startsWith('image/')) {
        return await compressImage(file);
    }

    // Audio/PDF compression client-side is complex and requires heavy WASM libraries (ffmpeg.wasm).
    // For now, we return these files as-is to ensure functionality.
    // If we need to "compress" them, we might just enforce strict size limits in validation.
    return file;
}
