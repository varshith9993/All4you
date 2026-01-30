// utils/uploadAudioToCloudinary.js
import { uploadFile } from './storage';

export async function uploadAudioToCloudinary(audioFileOrBlob) {
  try {
    // Ensure it's a File object if possible, R2 needs name/type
    let fileToUpload = audioFileOrBlob;
    if (audioFileOrBlob instanceof Blob && !audioFileOrBlob.name) {
      fileToUpload = new File([audioFileOrBlob], `audio_${Date.now()}.webm`, { type: audioFileOrBlob.type || 'audio/webm' });
    }

    const publicUrl = await uploadFile(fileToUpload, 'audio');
    return publicUrl;
  } catch (error) {
    console.error("R2 Audio Upload Error:", error);
    throw error;
  }
}
