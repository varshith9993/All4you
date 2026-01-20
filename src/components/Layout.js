import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useLayoutCache } from "../contexts/GlobalDataCacheContext";
import {
    FiStar,
    FiBell,
    FiSettings,
    FiUser,
    FiUsers,
    FiList,
    FiGrid,
    FiMessageCircle,
    FiChevronLeft,
} from "react-icons/fi";

/**
 * Unified Layout component for ServePure.
 * Replicates the exact navigation structure used in Workers, Services, Ads, Chats, and Profile pages.
 * 
 * @param {ReactNode} children - The main content of the page.
 * @param {string} title - The title displayed in the header.
 * @param {string} activeTab - Manual override for active tab ('workers', 'services', 'ads', 'chats', 'profile').
 * @param {boolean} showBack - Whether to show a back button in the header.
 * @param {ReactNode} headerExtra - Slot for search, filter, and sort controls.
 * @param {ReactNode} subHeader - Slot for active filters, phase tabs, or secondary navigation.
 */
export default function Layout({
    children,
    title,
    activeTab,
    showBack = false,
    headerExtra,
    subHeader,
}) {
    const navigate = useNavigate();
    const location = useLocation();

    // OPTIMIZATION: Use global cache instead of creating 5 listeners on every page load
    // This eliminates ~50% of unnecessary Firestore reads from repeated listener subscriptions
    const { hasUnreadChats, hasUnreadNotifs, markNotificationsViewed, currentUserId } = useLayoutCache();

    // Clear notification dot when on the notifications page
    useEffect(() => {
        if (location.pathname === '/notifications' && currentUserId) {
            markNotificationsViewed();
        }
    }, [location.pathname, currentUserId, markNotificationsViewed]);


    // Navigation Items
    const navItems = [
        { path: "/workers", icon: FiUsers, label: "Workers" },
        { path: "/services", icon: FiList, label: "Services" },
        { path: "/ads", icon: FiGrid, label: "Ads" },
        { path: "/chats", icon: FiMessageCircle, label: "Chats", showDot: hasUnreadChats },
        { path: "/profile", icon: FiUser, label: "Profile" }
    ];

    // Helper to determine if a path is active
    const isTabActive = (itemPath) => {
        const currentPath = location.pathname;

        // Support manual override via activeTab prop
        if (activeTab) {
            return activeTab === itemPath.slice(1) || (activeTab === "profile" && itemPath === "/profile");
        }

        // Exact match for most paths
        if (currentPath === itemPath) return true;

        // Special case for profile
        if (itemPath === "/profile" && currentPath === "/profile") return true;

        return false;
    };

    return (
        <div className="flex flex-col min-h-screen bg-white" style={{ maxWidth: 480, margin: "0 auto" }}>
            {/* --- Top Navigation Bar (Header) --- */}
            <header className="flex flex-col px-4 py-3 border-b bg-white shadow-sm sticky top-0 z-30">
                {/* Top Row: Title & Action Icons */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 overflow-hidden">
                        {showBack && (
                            <button
                                onClick={() => navigate(-1)}
                                className="p-1 -ml-1 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
                                aria-label="Back"
                            >
                                <FiChevronLeft size={24} />
                            </button>
                        )}
                        <h1 className="font-bold text-xl text-blue-600 truncate tracking-tight">
                            {title || "ServePure"}
                        </h1>
                    </div>

                    <div className="flex items-center space-x-4 flex-shrink-0">
                        <button
                            onClick={() => navigate('/favorites')}
                            className="hover:text-blue-600 transition-colors"
                            aria-label="Favorites"
                        >
                            <FiStar size={22.5} />
                        </button>
                        <button
                            onClick={() => navigate('/notifications')}
                            className="relative hover:text-blue-600 transition-colors"
                            aria-label="Notifications"
                        >
                            <FiBell size={22.5} />
                            {hasUnreadNotifs && (
                                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-600 rounded-full border border-white"></span>
                            )}
                        </button>
                        <button
                            onClick={() => navigate('/settings')}
                            className="hover:text-blue-600 transition-colors"
                            aria-label="Settings"
                        >
                            <FiSettings size={22.5} />
                        </button>
                    </div>
                </div>

                {/* Optional Section for Search, Filter, Sort controls */}
                {headerExtra && (
                    <div className="flex items-center gap-2">
                        {headerExtra}
                    </div>
                )}

                {/* Optional Section for Active Filters or Category Tabs */}
                {subHeader}
            </header>

            {/* --- Main Content Area --- */}
            <main className="flex-1">
                {children}
            </main>

            {/* --- Bottom Navigation Bar --- */}
            <nav
                className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around items-center py-2 shadow-md z-30"
                style={{ maxWidth: 480, margin: "0 auto" }}
            >
                {navItems.map(({ path, icon: Icon, label, showDot }) => (
                    <button
                        key={path}
                        onClick={() => navigate(path)}
                        className={`flex flex-col items-center transition-colors relative ${isTabActive(path)
                            ? "text-blue-600 font-bold"
                            : "text-gray-400 hover:text-gray-600"
                            }`}
                    >
                        <div className="relative">
                            <Icon size={24} />
                            {showDot && (
                                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-red-600 rounded-full border border-white"></span>
                            )}
                        </div>
                        <span className="text-xs mt-1">{label}</span>
                    </button>
                ))}
            </nav>
        </div>
    );
}