import React, { useState } from 'react';
import { FiBell, FiGlobe, FiMapPin, FiSend } from 'react-icons/fi';
import { getFunctions, httpsCallable } from 'firebase/functions';

/**
 * Admin Notification Panel
 * Allows admins to send notifications to all users or specific regions
 */
export default function AdminNotificationPanel() {
    const [notificationType, setNotificationType] = useState('all'); // 'all' | 'regional'
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [cities, setCities] = useState('');
    const [countries, setCountries] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const functions = getFunctions();

    const handleSendNotification = async (e) => {
        e.preventDefault();
        setLoading(true);
        setResult(null);

        try {
            if (notificationType === 'all') {
                // Send to all users
                const sendToAll = httpsCallable(functions, 'sendNotificationToAll');
                const response = await sendToAll({
                    title,
                    body,
                    imageUrl: imageUrl || undefined,
                });

                setResult({
                    success: true,
                    message: `Notification sent to ${response.data.sent} users successfully!`,
                    details: response.data
                });
            } else {
                // Send to specific region
                const sendToRegion = httpsCallable(functions, 'sendNotificationToRegion');

                const citiesArray = cities.trim() ? cities.split(',').map(c => c.trim()) : [];
                const countriesArray = countries.trim() ? countries.split(',').map(c => c.trim()) : [];

                const response = await sendToRegion({
                    title,
                    body,
                    imageUrl: imageUrl || undefined,
                    cities: citiesArray.length > 0 ? citiesArray : undefined,
                    countries: countriesArray.length > 0 ? countriesArray : undefined,
                });

                setResult({
                    success: true,
                    message: `Notification sent to ${response.data.sent} users in the specified region!`,
                    details: response.data
                });
            }

            // Clear form
            setTitle('');
            setBody('');
            setImageUrl('');
            setCities('');
            setCountries('');
        } catch (error) {
            console.error('Error sending notification:', error);
            setResult({
                success: false,
                message: `Error: ${error.message}`
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-xl p-8 text-white mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <FiBell size={32} />
                    <h1 className="text-3xl font-bold">Send Notifications</h1>
                </div>
                <p className="text-indigo-100">
                    Send push notifications to all users or specific regions for festivals, offers, and announcements
                </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
                {/* Notification Type Selector */}
                <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
                    <button
                        className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${notificationType === 'all'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                        onClick={() => setNotificationType('all')}
                    >
                        <FiGlobe size={18} />
                        All Users
                    </button>
                    <button
                        className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${notificationType === 'regional'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                        onClick={() => setNotificationType('regional')}
                    >
                        <FiMapPin size={18} />
                        Specific Region
                    </button>
                </div>

                <form onSubmit={handleSendNotification} className="space-y-4">
                    {/* Title */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Notification Title *
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g., Diwali Special Offer!"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                            required
                        />
                    </div>

                    {/* Body */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Notification Message *
                        </label>
                        <textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            placeholder="e.g., Get 20% off on all services this Diwali!"
                            rows={4}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none"
                            required
                        />
                    </div>

                    {/* Image URL (Optional) */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Image URL (Optional)
                        </label>
                        <input
                            type="url"
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                            placeholder="https://example.com/image.jpg"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                        />
                    </div>

                    {/* Regional Filters */}
                    {notificationType === 'regional' && (
                        <div className="space-y-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                            <p className="text-sm font-bold text-indigo-900">
                                Regional Filters (at least one required)
                            </p>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Cities (comma-separated)
                                </label>
                                <input
                                    type="text"
                                    value={cities}
                                    onChange={(e) => setCities(e.target.value)}
                                    placeholder="e.g., Mumbai, Delhi, Bangalore"
                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Countries (comma-separated)
                                </label>
                                <input
                                    type="text"
                                    value={countries}
                                    onChange={(e) => setCountries(e.target.value)}
                                    placeholder="e.g., India, United States"
                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                                />
                            </div>

                            <p className="text-xs text-indigo-700">
                                💡 Tip: If both cities and countries are provided, only cities will be used
                            </p>
                        </div>
                    )}

                    {/* Result Message */}
                    {result && (
                        <div
                            className={`p-4 rounded-xl border ${result.success
                                    ? 'bg-green-50 border-green-200 text-green-800'
                                    : 'bg-red-50 border-red-200 text-red-800'
                                }`}
                        >
                            <p className="font-bold">{result.message}</p>
                            {result.details && (
                                <p className="text-sm mt-1">
                                    Sent: {result.details.sent} | Failed: {result.details.failed || 0} | Total: {result.details.total}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-4 rounded-xl shadow-lg hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <FiSend size={20} />
                                Send Notification
                            </>
                        )}
                    </button>
                </form>

                {/* Info Box */}
                <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                    <p className="text-sm text-blue-800 font-bold mb-2">📱 Notification Features:</p>
                    <ul className="text-xs text-blue-700 space-y-1">
                        <li>• Notifications are sent to all users who have enabled push notifications</li>
                        <li>• Regional notifications target users in specific cities or countries</li>
                        <li>• Invalid tokens are automatically cleaned up</li>
                        <li>• Notifications are sent in batches for optimal performance</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
