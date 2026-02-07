import { auth } from '../firebase';
import axios from 'axios';
import { getFunctions, httpsCallable } from 'firebase/functions';

const PROJECT_ID = "g-maps-api-472115";
const REGION = "us-central1";
// Note: If you deploy to a different region, update this URL.
const GET_UPLOAD_URL_ENDPOINT = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/getUploadUrl`;

/**
 * Upload a file to Cloudflare R2 via Firebase Functions signing.
 * 
 * @param {File} file - The file object to upload
 * @param {string} folder - The folder path (default: 'uploads')
 * @returns {Promise<string>} - The public CDN URL of the uploaded file
 */
export async function uploadFile(file, folder = 'uploads') {
    if (!file) throw new Error("No file provided");

    try {
        // 1. Get Auth Token
        const user = auth.currentUser;
        if (!user) throw new Error("User must be logged in to upload");
        const token = await user.getIdToken();

        // 2. Get Signed URL from Backend
        const initRes = await axios.post(GET_UPLOAD_URL_ENDPOINT, {
            fileName: file.name,
            fileType: file.type,
            folder: folder
        }, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const { uploadUrl, publicUrl } = initRes.data;

        // 3. Upload File to R2 (Directly using PUT)
        await axios.put(uploadUrl, file, {
            headers: {
                'Content-Type': file.type
            }
        });

        return publicUrl;

    } catch (error) {
        console.error("Upload failed:", error);
        throw error;
    }
}


/**
 * Delete a file from Cloudflare R2
 * 
 * @param {string} publicUrlOrPath - The full public URL or relative path
 */
export async function deleteFile(publicUrlOrPath) {
    if (!publicUrlOrPath) return;

    try {
        // Extract relative path if full URL is given
        // Endpoint: https://pub-xxxx.r2.dev/folder/filename
        // Path: folder/filename
        let filePath = publicUrlOrPath;
        if (filePath.startsWith('http')) {
            const urlObj = new URL(filePath);
            // Remove the leading slash from pathname
            filePath = urlObj.pathname.substring(1);
        }

        const functions = getFunctions(undefined, REGION);
        const deleteFn = httpsCallable(functions, 'deleteFile');

        await deleteFn({ filePath });
        // File deleted successfully

    } catch (error) {
        console.error("Delete failed:", error);
        // Don't throw for delete, just log (soft fail)
    }
}
