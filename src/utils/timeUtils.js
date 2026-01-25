

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

        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `Last Seen: ${day}/${month}/${year}`;
    } catch (error) {
        return "Offline";
    }
}

export function formatDateTime(dateObj) {
    if (!dateObj) return "";
    const date = dateObj.toDate ? dateObj.toDate() :
        dateObj instanceof Date ? dateObj :
            new Date(dateObj);

    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
    });
}
