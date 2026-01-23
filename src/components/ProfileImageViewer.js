import React from 'react';
import { FiX } from 'react-icons/fi';
import defaultAvatar from "../assets/images/default_profile.svg";

export default function ProfileImageViewer({ show, onClose, imageUrl, username }) {
    if (!show) return null;

    return (
        <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black/95 animate-fade-in backdrop-blur-sm">
            {/* Close Button */}
            <button
                onClick={onClose}
                className="absolute top-6 right-6 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all z-[80]"
            >
                <FiX size={28} />
            </button>

            {/* Content Container */}
            <div className="flex flex-col items-center p-8 animate-scale-up">
                {/* Glowing Effect Container */}
                <div className="relative mb-8 group">
                    {/* Glow Ring */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>

                    {/* The Image */}
                    <div className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-full overflow-hidden border-4 border-gray-900 bg-gray-800 flex items-center justify-center shadow-2xl">
                        <img
                            src={imageUrl || defaultAvatar}
                            alt={username}
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.src = defaultAvatar; }}
                        />
                    </div>
                </div>

                {/* Username */}
                <h2 className="text-3xl font-bold text-white tracking-wider text-center drop-shadow-lg bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    {username || "User"}
                </h2>
            </div>
        </div>
    );
}

// Add simple CSS animation for the modal if not present globally
// .animate-scale-up { animation: scaleUp 0.3s ease-out forwards; }
// @keyframes scaleUp { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
