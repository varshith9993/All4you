import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
    FiSettings,
    FiBell,
    FiHeart,
    FiSearch,
    FiFilter,
    FiBarChart2, // Sort icon
    FiUser,
    FiBriefcase, // Services
    FiGrid, // Ads
    FiMessageCircle, // Chats
    FiPlus,
    FiArrowLeft,
    FiMenu,
} from "react-icons/fi";

export default function Layout({
    children,
    title = "ServePure",
    showSearch = false,
    showFilter = false,
    showSort = false,
    searchValue = "",
    onSearchChange,
    onFilterClick,
    onSortClick,
    activeTab,
    showAddButton = false,
    onAddClick,
    showBack = false,
}) {
    const navigate = useNavigate();
    const location = useLocation();

    // Determine active tab if not provided
    const currentPath = location.pathname;
    const derivedActiveTab = activeTab ||
        (currentPath.includes("/workers") ? "workers" :
            currentPath.includes("/services") ? "services" :
                currentPath.includes("/ads") ? "ads" :
                    currentPath.includes("/chats") ? "chats" :
                        currentPath.includes("/profile") ? "profile" : "");

    return (
        <div className="flex flex-col min-h-screen bg-gray-50 max-w-md mx-auto shadow-2xl overflow-hidden relative">
            {/* Top Header */}
            <header className="sticky top-0 z-30 w-full glass border-b border-gray-200/50">
                <div className="px-4 py-3">
                    {/* Top Row: Brand/Back & Actions */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            {showBack && (
                                <button
                                    onClick={() => navigate(-1)}
                                    className="p-2 -ml-2 rounded-full hover:bg-gray-100/50 text-gray-700 transition-colors"
                                >
                                    <FiArrowLeft size={22} />
                                </button>
                            )}
                            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-pink-500 bg-clip-text text-transparent">
                                {title}
                            </h1>
                        </div>

                        <div className="flex items-center gap-3 text-gray-600">
                            <button
                                onClick={() => navigate("/favorites")}
                                className="p-2 rounded-full hover:bg-gray-100/50 hover:text-pink-500 transition-colors"
                            >
                                <FiHeart size={22} />
                            </button>
                            <button
                                onClick={() => navigate("/notifications")}
                                className="p-2 rounded-full hover:bg-gray-100/50 hover:text-indigo-500 transition-colors"
                            >
                                <FiBell size={22} />
                            </button>
                            <button
                                onClick={() => navigate("/settings")}
                                className="p-2 rounded-full hover:bg-gray-100/50 hover:text-gray-900 transition-colors"
                            >
                                <FiSettings size={22} />
                            </button>
                        </div>
                    </div>

                    {/* Second Row: Search & Filters (Conditional) */}
                    {showSearch && (
                        <div className="flex items-center gap-3 animate-fade-in">
                            <div className="relative flex-1">
                                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={searchValue}
                                    onChange={onSearchChange}
                                    className="w-full pl-10 pr-4 py-2.5 bg-white/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm"
                                />
                            </div>

                            {showFilter && (
                                <button
                                    onClick={onFilterClick}
                                    className="p-2.5 bg-white/50 border border-gray-200 rounded-xl text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all"
                                >
                                    <FiFilter size={20} />
                                </button>
                            )}

                            {showSort && (
                                <button
                                    onClick={onSortClick}
                                    className="p-2.5 bg-white/50 border border-gray-200 rounded-xl text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all"
                                >
                                    <FiBarChart2 size={20} className="rotate-90" />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto pb-24 scroll-smooth">
                {children}
            </main>

            {/* Floating Action Button (Add Work/Service/Ad) */}
            {showAddButton && (
                <div className="fixed bottom-20 right-4 z-20 animate-fade-in">
                    <button
                        onClick={onAddClick}
                        className="w-14 h-14 bg-gradient-to-r from-indigo-600 to-pink-600 rounded-full shadow-lg shadow-indigo-500/30 flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform"
                    >
                        <FiPlus size={28} />
                    </button>
                </div>
            )}

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 w-full max-w-md glass border-t border-gray-200/50 pb-safe z-30">
                <div className="flex justify-around items-center py-3">
                    <NavItem
                        icon={FiUser}
                        label="Workers"
                        isActive={derivedActiveTab === "workers"}
                        onClick={() => navigate("/workers")}
                    />
                    <NavItem
                        icon={FiBriefcase}
                        label="Services"
                        isActive={derivedActiveTab === "services"}
                        onClick={() => navigate("/services")}
                    />
                    <NavItem
                        icon={FiGrid}
                        label="Ads"
                        isActive={derivedActiveTab === "ads"}
                        onClick={() => navigate("/ads")}
                    />
                    <NavItem
                        icon={FiMessageCircle}
                        label="Chats"
                        isActive={derivedActiveTab === "chats"}
                        onClick={() => navigate("/chats")}
                    />
                    <NavItem
                        icon={FiUser}
                        label="Profile"
                        isActive={derivedActiveTab === "profile"}
                        onClick={() => navigate("/profile")}
                    />
                </div>
            </nav>
        </div>
    );
}

function NavItem({ icon: Icon, label, isActive, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`flex flex-col items-center gap-1 transition-all duration-300 ${isActive ? "text-indigo-600 scale-110" : "text-gray-400 hover:text-gray-600"
                }`}
        >
            <Icon size={isActive ? 24 : 22} className={isActive ? "fill-current" : ""} />
            <span className={`text-[10px] font-medium ${isActive ? "opacity-100" : "opacity-70"}`}>
                {label}
            </span>
        </button>
    );
}