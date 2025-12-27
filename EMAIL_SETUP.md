# Email Verification Template Instructions

To make your verification email look like a button and navigate users to the app, you need to configure the **Email Template** in the Firebase Console.

## 1. Configure Action URL (Crucial Step) ✨

This is what sends the user back to your app instead of a generic Firebase page.

1.  Go to the [Firebase Console](https://console.firebase.google.com/).
2.  Navigate to **Authentication** > **Templates**.
3.  Click on **Email address verification**.
4.  Click the **Edit** icon (pencil) next to the template.
5.  Look for **"Customize action URL"** (usually a link/icon).
6.  Set the Action URL to:
    ```
    https://servepure.web.app/verify-email
    ```
    *(Replace `servepure.web.app` with your actual deployed domain, or `http://localhost:3000/verify-email` if testing locally).*

## 2. Customize Email Content (The Button) 🎨

In the **Message body** section of the template editor, verify if it allows HTML. If it does, paste the following code to create a button:

```html
<div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
  <h2>Welcome to ServePure!</h2>
  <p>Please click the button below to verify your email and login to the app.</p>
  
  <br>
  
  <a href="%LINK%" style="
      background-color: #6366f1;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: bold;
      display: inline-block;
  ">
    Verify Account
  </a>
  
  <br><br>
  
  <p style="color: #666; font-size: 12px;">
    If the button doesn't work, copy and paste this link into your browser:<br>
    %LINK%
  </p>
</div>
```

**Note:** If the Firebase Console editor for your plan only allows text, simply use this text:
```
Welcome to ServePure!

Please click on the link below to login to the app:

%LINK%

Thanks!
```

## 3. How it Works Now
1.  User clicks the **Verify Account** button in email.
2.  They are sent to your app's `/verify-email` page.
3.  The app shows "Verifying Email...".
4.  Once verified, it automatically redirects them to the **Workers** page.
