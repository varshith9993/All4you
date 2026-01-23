/**
 * Expiry Utility for Services, Workers, and Ads
 */

/**
 * Formats the expiry text based on the time remaining.
 * 
 * Rules:
 * - < 5 mins: "Expiring Now" (with special effect)
 * - < 1 hour: "Expires in X mins"
 * - < 24 hours: "Expires in X hours"
 * - Same day: "Expires today"
 * - Default: "Expires: dd/mm/yyyy"
 * 
 * @param {Date|Timestamp} expiry - The expiry date
 * @returns {object} { text, color, isExpiringNow, isExpiringSoon }
 */
export const formatExpiry = (expiry) => {
    if (!expiry) return { text: "", color: "text-gray-500", isExpiringNow: false, isExpiringSoon: false };

    try {
        const expiryDate = expiry.toDate ? expiry.toDate() : new Date(expiry);
        const now = new Date();
        const diffMs = expiryDate - now;

        if (diffMs <= 0) {
            return { text: "Expired", color: "text-red-600", isExpiringNow: false, isExpiringSoon: false };
        }

        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMins / 60);

        // Check if year is 9999 (Until I change)
        const year = expiryDate.getFullYear();
        if (year === 9999 || year > 9000) {
            return { text: "Expiry: NA", color: "text-red-600", isExpiringNow: false, isExpiringSoon: false };
        }

        if (diffMins < 5) {
            return { text: "Expiring Now", color: "text-red-600", isExpiringNow: true, isExpiringSoon: true };
        }

        if (diffMins < 60) {
            return { text: `Expires in ${diffMins} mins`, color: "text-red-600", isExpiringNow: false, isExpiringSoon: true };
        }

        if (diffHours < 24) {
            return { text: `Expires in ${diffHours} hours`, color: "text-orange-600", isExpiringNow: false, isExpiringSoon: false };
        }
        const day = String(expiryDate.getDate()).padStart(2, '0');
        const month = String(expiryDate.getMonth() + 1).padStart(2, '0');
        const yearNum = expiryDate.getFullYear();
        return { text: `Expires: ${day}/${month}/${yearNum}`, color: "text-blue-600", isExpiringNow: false, isExpiringSoon: false };

    } catch (error) {
        console.error("Error formatting expiry:", error);
        return { text: "Until: Unknown", color: "text-gray-500", isExpiringNow: false, isExpiringSoon: false };
    }
};
