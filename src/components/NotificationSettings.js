import React, { useState, useEffect } from 'react';
import { FiBellOff, FiAlertCircle } from 'react-icons/fi';
import { requestNotificationPermission, checkNotificationPermission } from '../utils/fcmService';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

/**
 * Notification Settings Component
 * Shows ONLY if user denied permission or hasn't been asked yet
 * Once enabled, this component is hidden (users must use device settings to disable)
 */
export default function NotificationSettings() {
    const [permissionStatus, setPermissionStatus] = useState('checking');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [userLocation, setUserLocation] = useState(null);

    useEffect(() => {
        // Check current notification permission status
        const checkPermission = async () => {
            const status = await checkNotificationPermission();
            setPermissionStatus(status);
        };

        checkPermission();

        // Get user location data
        const fetchUserLocation = async () => {
            if (auth.currentUser) {
                try {
                    const profileDoc = await getDoc(doc(db, 'profiles', auth.currentUser.uid));
                    if (profileDoc.exists()) {
                        const data = profileDoc.data();
                        setUserLocation({
                            latitude: data.latitude,
                            longitude: data.longitude,
                            city: data.city,
                            country: data.country
                        });
                    }
                } catch (error) {
                    console.error('Error fetching user location:', error);
                }
            }
        };

        fetchUserLocation();
    }, []);

    const handleEnableNotifications = async () => {
        if (!auth.currentUser) {
            setMessage('Please log in to enable notifications');
            return;
        }

        setLoading(true);
        setMessage('');

        try {
            const token = await requestNotificationPermission(auth.currentUser.uid, userLocation);

            if (token) {
                setPermissionStatus('granted');
                setMessage('✅ Notifications enabled successfully!');

                // Hide the component after 2 seconds
                setTimeout(() => {
                    setPermissionStatus('granted');
                }, 2000);
            } else {
                setMessage('❌ Permission denied. You can enable notifications from your browser settings.');
            }
        } catch (error) {
            console.error('Error enabling notifications:', error);
            setMessage('❌ Error enabling notifications');
        } finally {
            setLoading(false);
        }
    };

    // Don't show component if permission is already granted
    if (permissionStatus === 'granted') {
        return null;
    }

    // Don't show while checking
    if (permissionStatus === 'checking') {
        return null;
    }

    // Only show if permission is 'default' (not asked) or 'denied'
    return (
        <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl shadow-sm p-6 border-2 border-orange-200">
            <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-orange-100">
                    <FiBellOff className="text-orange-600" size={24} />
                </div>

                <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-lg mb-1 flex items-center gap-2">
                        Enable Push Notifications
                        <FiAlertCircle className="text-orange-500" size={18} />
                    </h3>
                    <p className="text-sm text-gray-700 mb-4">
                        {permissionStatus === 'denied'
                            ? '⚠️ You previously denied notifications. Click below to enable them again.'
                            : '🔔 Stay updated with important notifications about messages, nearby posts, and offers!'}
                    </p>

                    <button
                        onClick={handleEnableNotifications}
                        disabled={loading}
                        className="bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold px-6 py-3 rounded-lg hover:opacity-90 transition-all disabled:opacity-50 text-sm shadow-md"
                    >
                        {loading ? 'Requesting Permission...' : '🔔 Enable Notifications Now'}
                    </button>

                    {message && (
                        <div className={`mt-3 text-sm font-medium ${message.includes('✅') ? 'text-green-600' : 'text-red-600'}`}>
                            {message}
                        </div>
                    )}

                    <div className="mt-4 p-4 bg-white/80 border border-orange-200 rounded-lg">
                        <p className="text-xs text-gray-700 leading-relaxed">
                            <span className="font-bold text-orange-700">📬 You'll receive notifications for:</span>
                            <br />
                            • 💬 New chat messages
                            <br />
                            • 📍 New posts within 75km of your location
                            <br />
                            • ⏰ Posts expiring soon (1 hour & 5 minutes before)
                            <br />
                            • ⭐ Reviews and replies
                            <br />
                            • 🎉 Festival offers and special announcements
                        </p>
                    </div>

                    {permissionStatus === 'denied' && (
                        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="text-xs text-yellow-800">
                                <span className="font-bold">💡 Tip:</span> If the button doesn't work, you may need to enable notifications from your browser settings manually.
                            </p>
                        </div>
                    )}

                    <div className="mt-3 text-xs text-gray-500">
                        ℹ️ Once enabled, you can disable notifications from your device settings.
                    </div>
                </div>
            </div>
        </div>
    );
}
