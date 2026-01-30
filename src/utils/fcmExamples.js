/**
 * FCM Notification Usage Examples for AeroSigil
 * 
 * This file contains practical examples of how to use the FCM notification system
 * in different scenarios throughout your app.
 */

import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();

// ============================================================================
// EXAMPLE 1: Send Festival Notification to All Users
// ============================================================================

export const sendDiwaliNotification = async () => {
    const sendToAll = httpsCallable(functions, 'sendNotificationToAll');

    try {
        const result = await sendToAll({
            title: '🪔 Happy Diwali! 🪔',
            body: 'Celebrate with 25% OFF on all services. Limited time offer!',
            imageUrl: 'https://your-cdn.com/diwali-banner.jpg',
            data: {
                offerCode: 'DIWALI25',
                validUntil: '2024-11-15'
            }
        });

        console.log(`Diwali notification sent to ${result.data.sent} users`);
        return result.data;
    } catch (error) {
        console.error('Error sending Diwali notification:', error);
        throw error;
    }
};

// ============================================================================
// EXAMPLE 2: Send Regional Festival Notification
// ============================================================================

export const sendRegionalFestivalNotification = async (cities, festivalName, offerDetails) => {
    const sendToRegion = httpsCallable(functions, 'sendNotificationToRegion');

    try {
        const result = await sendToRegion({
            title: `🎉 ${festivalName} Special!`,
            body: offerDetails,
            cities: cities, // e.g., ['Mumbai', 'Pune', 'Nagpur']
            imageUrl: 'https://your-cdn.com/festival-banner.jpg'
        });

        console.log(`Regional notification sent to ${result.data.sent} users in ${cities.join(', ')}`);
        return result.data;
    } catch (error) {
        console.error('Error sending regional notification:', error);
        throw error;
    }
};

// Example usage:
// sendRegionalFestivalNotification(
//   ['Mumbai', 'Pune', 'Nagpur'],
//   'Ganesh Chaturthi',
//   'Get 30% OFF on all worker services during Ganesh Chaturthi!'
// );

// ============================================================================
// EXAMPLE 3: Send Targeted Offer to Specific User
// ============================================================================

export const sendPersonalizedOffer = async (userId, userName, offerDetails) => {
    const sendToUser = httpsCallable(functions, 'sendNotificationToUser');

    try {
        const result = await sendToUser({
            userId: userId,
            title: `🎁 Special Offer for ${userName}!`,
            body: offerDetails,
            url: '/offers/personalized',
            imageUrl: 'https://your-cdn.com/vip-offer.jpg',
            data: {
                userId: userId,
                offerType: 'personalized',
                priority: 'high'
            }
        });

        console.log('Personalized offer sent successfully');
        return result.data;
    } catch (error) {
        console.error('Error sending personalized offer:', error);
        throw error;
    }
};

// ============================================================================
// EXAMPLE 4: Send New Feature Announcement
// ============================================================================

export const announceNewFeature = async (featureName, description) => {
    const sendToAll = httpsCallable(functions, 'sendNotificationToAll');

    try {
        const result = await sendToAll({
            title: `🚀 New Feature: ${featureName}`,
            body: description,
            imageUrl: 'https://your-cdn.com/new-feature.jpg',
            data: {
                type: 'feature_announcement',
                featureName: featureName,
                learnMoreUrl: '/features/new'
            }
        });

        console.log(`Feature announcement sent to ${result.data.sent} users`);
        return result.data;
    } catch (error) {
        console.error('Error sending feature announcement:', error);
        throw error;
    }
};

// ============================================================================
// EXAMPLE 5: Send Country-Specific Notification
// ============================================================================

export const sendCountryNotification = async (countries, title, body) => {
    const sendToRegion = httpsCallable(functions, 'sendNotificationToRegion');

    try {
        const result = await sendToRegion({
            title: title,
            body: body,
            countries: countries, // e.g., ['India', 'United States']
        });

        console.log(`Country notification sent to ${result.data.sent} users`);
        return result.data;
    } catch (error) {
        console.error('Error sending country notification:', error);
        throw error;
    }
};

// Example usage:
// sendCountryNotification(
//   ['India'],
//   'Independence Day Sale! 🇮🇳',
//   'Celebrate with 50% OFF on all services. Jai Hind!'
// );

// ============================================================================
// EXAMPLE 6: Send Maintenance Notification
// ============================================================================

export const sendMaintenanceNotification = async (startTime, endTime) => {
    const sendToAll = httpsCallable(functions, 'sendNotificationToAll');

    try {
        const result = await sendToAll({
            title: '⚠️ Scheduled Maintenance',
            body: `AeroSigil will be under maintenance from ${startTime} to ${endTime}. We apologize for any inconvenience.`,
            data: {
                type: 'maintenance',
                startTime: startTime,
                endTime: endTime
            }
        });

        console.log(`Maintenance notification sent to ${result.data.sent} users`);
        return result.data;
    } catch (error) {
        console.error('Error sending maintenance notification:', error);
        throw error;
    }
};

// ============================================================================
// EXAMPLE 7: Send Welcome Notification to New User
// ============================================================================

export const sendWelcomeNotification = async (userId, userName) => {
    const sendToUser = httpsCallable(functions, 'sendNotificationToUser');

    try {
        const result = await sendToUser({
            userId: userId,
            title: `Welcome to AeroSigil, ${userName}! 🎉`,
            body: 'Start exploring nearby services and workers. Your journey begins now!',
            url: '/workers',
            imageUrl: 'https://your-cdn.com/welcome-banner.jpg',
            data: {
                type: 'welcome',
                isNewUser: 'true'
            }
        });

        console.log('Welcome notification sent successfully');
        return result.data;
    } catch (error) {
        console.error('Error sending welcome notification:', error);
        throw error;
    }
};

// ============================================================================
// EXAMPLE 8: Send Reminder Notification
// ============================================================================

export const sendReminderNotification = async (userId, reminderType, details) => {
    const sendToUser = httpsCallable(functions, 'sendNotificationToUser');

    const titles = {
        'post_expiring': '⏰ Your Post is Expiring Soon!',
        'incomplete_profile': '📝 Complete Your Profile',
        'pending_review': '⭐ Rate Your Recent Service'
    };

    try {
        const result = await sendToUser({
            userId: userId,
            title: titles[reminderType] || 'Reminder',
            body: details,
            data: {
                type: 'reminder',
                reminderType: reminderType
            }
        });

        console.log('Reminder notification sent successfully');
        return result.data;
    } catch (error) {
        console.error('Error sending reminder notification:', error);
        throw error;
    }
};

// ============================================================================
// EXAMPLE 9: Send Seasonal Offer (Multiple Cities)
// ============================================================================

export const sendSeasonalOffer = async (season, cities, discount) => {
    const sendToRegion = httpsCallable(functions, 'sendNotificationToRegion');

    try {
        const result = await sendToRegion({
            title: `${season} Special Offer! ❄️`,
            body: `Enjoy ${discount}% OFF on all services this ${season}!`,
            cities: cities,
            imageUrl: 'https://your-cdn.com/seasonal-banner.jpg',
            data: {
                season: season,
                discount: discount.toString(),
                validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            }
        });

        console.log(`Seasonal offer sent to ${result.data.sent} users in ${cities.length} cities`);
        return result.data;
    } catch (error) {
        console.error('Error sending seasonal offer:', error);
        throw error;
    }
};

// Example usage:
// sendSeasonalOffer('Winter', ['Delhi', 'Chandigarh', 'Jaipur'], 20);

// ============================================================================
// EXAMPLE 10: Batch Send Personalized Notifications
// ============================================================================

export const sendBatchPersonalizedNotifications = async (userNotifications) => {
    const sendToUser = httpsCallable(functions, 'sendNotificationToUser');

    try {
        const results = await Promise.allSettled(
            userNotifications.map(notification =>
                sendToUser({
                    userId: notification.userId,
                    title: notification.title,
                    body: notification.body,
                    url: notification.url,
                    data: notification.data
                })
            )
        );

        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        console.log(`Batch notifications: ${successful} sent, ${failed} failed`);
        return { successful, failed, total: userNotifications.length };
    } catch (error) {
        console.error('Error sending batch notifications:', error);
        throw error;
    }
};

// Example usage:
// sendBatchPersonalizedNotifications([
//   {
//     userId: 'user1',
//     title: 'Special Offer!',
//     body: 'You have a special offer waiting!',
//     url: '/offers/user1'
//   },
//   {
//     userId: 'user2',
//     title: 'Premium Upgrade',
//     body: 'Upgrade to premium for exclusive benefits!',
//     url: '/premium'
//   }
// ]);

// ============================================================================
// INTEGRATION EXAMPLES
// ============================================================================

/**
 * Example: Integrate with your existing code
 * 
 * 1. In your admin dashboard:
 */
// import { sendDiwaliNotification } from './utils/fcmExamples';
// 
// const handleSendDiwaliOffer = async () => {
//   try {
//     const result = await sendDiwaliNotification();
//     alert(`Notification sent to ${result.sent} users!`);
//   } catch (error) {
//     alert('Failed to send notification');
//   }
// };

/**
 * 2. In your user registration flow:
 */
// import { sendWelcomeNotification } from './utils/fcmExamples';
// 
// const handleUserSignup = async (userId, userName) => {
//   // ... your signup logic ...
//   
//   // Send welcome notification
//   setTimeout(() => {
//     sendWelcomeNotification(userId, userName);
//   }, 5000); // Wait 5 seconds after signup
// };

/**
 * 3. In your regional marketing campaign:
 */
// import { sendRegionalFestivalNotification } from './utils/fcmExamples';
// 
// const launchMumbaiCampaign = async () => {
//   await sendRegionalFestivalNotification(
//     ['Mumbai', 'Navi Mumbai', 'Thane'],
//     'Mumbai Festival',
//     'Special 40% discount for Mumbai users during the festival!'
//   );
// };

export default {
    sendDiwaliNotification,
    sendRegionalFestivalNotification,
    sendPersonalizedOffer,
    announceNewFeature,
    sendCountryNotification,
    sendMaintenanceNotification,
    sendWelcomeNotification,
    sendReminderNotification,
    sendSeasonalOffer,
    sendBatchPersonalizedNotifications
};
