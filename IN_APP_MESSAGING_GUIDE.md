# Firebase In-App Messaging Guide

We have integrated the Firebase In-App Messaging SDK into your application. This allows you to create targeted messages that appear when users are active in your app.

## 1. Code Integration (Completed)
The necessary initialization code has been added to `src/firebase.js`:
```javascript
import { getInAppMessaging } from "firebase/in_app_messaging";
const inAppMessaging = getInAppMessaging(app);
```
No further code changes are typically required to *display* messages. The SDK handles the display logic automatically.

## 2. Creating a Campaign
In-App Messaging is primarily managed through the Firebase Console.

1.  **Go to Firebase Console**:
    *   Navigate to your project in the [Firebase Console](https://console.firebase.google.com/).
    *   In the left sidebar, verify under **Engage** or **Run** section (depending on the new UI) for **In-App Messaging**.

2.  **Create your first campaign**:
    *   Click the **Create your first campaign** button.

3.  **Design your message**:
    *   **Style**: Choose between Card, Modal, Image only, or Top banner.
    *   **Content**: Upload images, add titles, and body text.
    *   **Buttons**: Configure action buttons (e.g., "Subscribe Now", "Watch Video").
        *   *Action URL*: You can use deep links or web URLs.

4.  **Target your users**:
    *   **Campaign Name**: Give it a recognizable name.
    *   **Target**: Select your app (Web app).
    *   **Audience**: You can target specific user properties, languages, or predictions (if enabled).

5.  **Scheduling**:
    *   **Start/End**: Set when the campaign runs.
    *   **Trigger**: Define *when* the message appears.
        *   Default is `on_foreground` (when the app opens).
        *   You can add custom events if you log them in Analytics.
    *   **Frequency limit**: Limit how often a user sees the message (e.g., "Once per device" or "Every 1 days").

6.  **Conversion events** (Optional):
    *   Track if the user performed the desired action (e.g., `app_store_subscription_convert`).

7.  **Review and Publish**:
    *   Click **Publish**.

## 3. Testing
To verify the message works before sending it to everyone:

1.  In the Firebase Console campaign editor, click **Test on Device**.
2.  You will need your **Installation ID (FID)**.
    *   To get this in your web app, you can temporarily log it in the console:
    ```javascript
    import { getInstallations, getId } from "firebase/installations";
    
    // Setup for debugging FID
    const installations = getInstallations(app);
    getId(installations).then((id) => {
      console.log("Firebase Installation ID:", id);
    });
    ```
3.  Enter the ID in the Firebase Console and click **Test**.
4.  Refresh or reopen your app to see the message.

## Troubleshooting
*   **Message not showing?**
    *   Check the **Frequency limit**. If you've seen it once, you might not see it again.
    *   Ensure the **Trigger** condition is met (try refreshing the page for `on_foreground`).
    *   Verify that `window` is active.

## Advanced: Programmatic Control
If you need to suppress messages (e.g., during a payment flow), you can do so programmatically:
```javascript
import { getInAppMessaging } from "firebase/in_app_messaging";
const inAppMessaging = getInAppMessaging(app);

// Suppress messages
inAppMessaging.isAutomaticDataCollectionEnabled = false;

// Re-enable
inAppMessaging.isAutomaticDataCollectionEnabled = true;

// Note: The web SDK currently has limited programmatic triggers compared to native Android/iOS
```
