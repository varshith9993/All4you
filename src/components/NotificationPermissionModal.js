import React from 'react';
import { FiBell } from 'react-icons/fi';

export default function NotificationPermissionModal({ isOpen, onClose, onEnable }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 flex flex-col items-center text-center shadow-xl transform transition-all scale-100">

                {/* Bell Icon with shiny effect */}
                <div className="mb-4 relative">
                    <div className="w-16 h-16 bg-yellow-100/50 rounded-full flex items-center justify-center relative z-10">
                        <FiBell size={32} className="text-yellow-500 fill-yellow-500" />
                    </div>
                    {/* Decorative particles */}
                    <div className="absolute top-0 right-0 w-2 h-2 bg-blue-400 rounded-full animate-ping" style={{ animationDuration: '2s' }}></div>
                    <div className="absolute bottom-2 left-0 w-1.5 h-1.5 bg-red-400 rounded-full animate-ping" style={{ animationDelay: '0.5s', animationDuration: '2.5s' }}></div>
                </div>

                <h3 className="text-gray-900 font-bold text-lg mb-2 leading-tight">
                    Want to be notified about your orders and amazing offers?
                </h3>

                {/* Divider */}
                <div className="w-full h-px bg-gray-100 my-4"></div>

                <div className="w-full flex flex-col gap-3">
                    <button
                        onClick={onEnable}
                        className="w-full py-2.5 text-green-600 font-bold text-base hover:bg-green-50 rounded-xl transition-colors"
                    >
                        Enable notifications
                    </button>

                    <button
                        onClick={onClose}
                        className="w-full py-2.5 text-gray-500 font-medium text-sm hover:text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                    >
                        No, thanks
                    </button>
                </div>
            </div>
        </div>
    );
}
