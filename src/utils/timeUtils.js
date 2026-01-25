export function formatLastSeen(lastSeen) {
    if (!lastSeen) return "Never online";
    try {
        let date = lastSeen.toDate ? lastSeen.toDate() :
            lastSeen.seconds ? new Date(lastSeen.seconds * 1000) :
                new Date(lastSeen);

        const now = new Date();

        // Check if timestamp is in the future (invalid)
        if (date > now) {
            return `Last Seen: Unknown`;
        }

        const diffMs = now - date;
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffSecs < 60) return "Last Seen: just now";
        if (diffMins < 60) return `Last Seen: ${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
        if (diffHours < 24) return `Last Seen: ${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
        if (diffDays === 1) return `Last Seen: yesterday`;
        if (diffDays < 7) return `Last Seen: ${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

        // Use locale-aware date formatting for older timestamps
        return `Last Seen: ${date.toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        })}`;
    } catch (error) {
        return "Offline";
    }
}

export function formatDateTime(dateObj) {
    if (!dateObj) return "";
    const date = dateObj.toDate ? dateObj.toDate() :
        dateObj.seconds ? new Date(dateObj.seconds * 1000) :
            dateObj instanceof Date ? dateObj :
                new Date(dateObj);

    // Using undefined as the first argument ensures it uses the user's browser locale
    return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
    });
}

