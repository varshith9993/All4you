import React, { useEffect } from 'react';
import { FiCheckCircle, FiAlertCircle } from 'react-icons/fi';

export default function ActionMessageModal({ isOpen, onClose, title, message, type = 'success', onOk }) {
    // Lock body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleOk = () => {
        onClose();
        if (onOk) onOk();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in" style={{ zIndex: 9999 }}>
            <div className="bg-white p-6 rounded-[30px] shadow-2xl max-w-sm w-full text-center relative animate-slide-up border border-gray-100">
                <div className={`mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center ${type === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    {type === 'success' ? <FiCheckCircle size={28} /> : <FiAlertCircle size={28} />}
                </div>
                <h3 className="font-bold text-xl text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-600 text-sm mb-6 leading-relaxed">{message}</p>
                <button
                    onClick={handleOk}
                    className={`w-full py-3.5 rounded-xl font-bold text-white transition-all transform active:scale-95 ${type === 'success' ? 'bg-gradient-to-r from-pink-500 to-indigo-600 px-4 py-6 mb-4 shadow-lg shadow-pink-500/30 hover:opacity-90' : 'bg-gradient-to-r from-red-600 to-pink-600 shadow-lg shadow-red-500/30 hover:opacity-90'}`}
                >
                    OK
                </button>
            </div>
        </div>
    );
}
