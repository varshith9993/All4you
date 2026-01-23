/**
 * Uploads a given File object (image/video/audio/raw) to Cloudinary
 * resourceType can be 'image', 'video' (for audio too), 'raw', or 'auto'
 */
export async function uploadToCloudinary(file, resourceType = "auto") {
  if (!file) throw new Error("No file provided for upload");

  // Cloudinary URL structure: https://api.cloudinary.com/v1_1/<cloud_name>/<resource_type>/upload
  const url = `https://api.cloudinary.com/v1_1/devs4x2aa/${resourceType}/upload`;
  const preset = "ml_default";

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", preset);

  try {
    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Cloudinary upload failed with status ${response.status}`);
    }

    const data = await response.json();
    if (!data.secure_url) {
      throw new Error("Cloudinary response missing secure_url");
    }

    return data.secure_url;
  } catch (error) {
    throw error;
  }
}

// Keep alias for backward compatibility if needed, or just export the new one
export const uploadImageToCloudinary = (file) => uploadToCloudinary(file, "image");

