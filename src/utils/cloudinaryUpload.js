/**
 * Uploads a given File object (image/video/audio/raw) to Cloudinary
 * resourceType can be 'image', 'video' (for audio too), 'raw', or 'auto'
 */
// Re-export R2 storage utility masked as Cloudinary for backward compatibility
import { uploadFile } from './storage';

export async function uploadToCloudinary(file, resourceType = "auto") {
  if (!file) throw new Error("No file provided for upload");

  // Map resourceType to folder if desired, or just use 'uploads'
  // We ignore resourceType for R2 as it handles everything generic
  const folder = resourceType === 'image' ? 'images' :
    resourceType === 'video' ? 'videos' :
      resourceType === 'raw' ? 'files' : 'uploads';

  try {
    const publicUrl = await uploadFile(file, folder);
    return publicUrl;
  } catch (error) {
    console.error("R2 Upload Error:", error);
    throw error;
  }
}

// Keep alias for backward compatibility if needed, or just export the new one
export const uploadImageToCloudinary = (file) => uploadToCloudinary(file, "image");

