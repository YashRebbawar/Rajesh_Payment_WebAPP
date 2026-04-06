# Browser Push Notifications Setup Guide

This guide explains how to enable and use browser push notifications in your PrintFree application.

## Overview

Browser push notifications allow your application to send real-time alerts to users even when they're not actively using the website. This is useful for:

- Payment status updates
- Account approvals
- MT credentials updates
- Support messages
- Important announcements

## Features Implemented

### 1. Service Worker (`service-worker.js`)
- Handles incoming push notifications
- Displays notifications to users
- Manages notification clicks and interactions
- Runs in the background even when the browser is closed

### 2. Notification Manager (`notification-manager.js`)
- Manages service worker registration
- Handles permission requests
- Manages push subscriptions
- Communicates with the backend

### 3. Notification Settings UI (`notification-settings-ui.js`)
- User-friendly interface to enable/disable notifications
- Shows current notification status
- Allows testing notifications
- Displays what types of notifications users will receive

### 4. Backend Endpoints (`app.py`)
- `/api/notifications/subscribe` - Register user for push notifications
- `/api/notifications/unsubscribe` - Unregister user from push notifications
- `/api/notifications/send-test` - Send a test notification

### 5. Push Notification Service (`push_notification_service.py`)
- Helper class for sending notifications from backend
- Methods for different notification types
- Bulk notification support
- Subscription management

## How to Use

### For Users

1. **Enable Notifications**
   - Navigate to the notification settings section
   - Click "Enable Notifications"
   - Grant permission when prompted by the browser
   - You'll see a confirmation message

2. **Test Notifications**
   - After enabling, click "Send Test" to verify notifications work
   - You should see a test notification appear

3. **Disable Notifications**
   - Click "Disable Notifications" to stop receiving push notifications
   - You can re-enable anytime

### For Developers

#### Sending Notifications from Backend

```python
from push_notification_service import PushNotificationService

# Initialize the service
notification_service = PushNotificationService(push_subscriptions_collection)

# Send payment notification
notification_service.send_payment_notification(
    user_id=user['_id'],
    payment_type='deposit',
    status='completed',
    amount=1000,
    currency='INR',
    account_nickname='My Trading Account'
)

# Send MT credentials notification
notification_service.send_mt_credentials_notification(
    user_id=user['_id'],
    account_nickname='My Trading Account',
    mt_login='12345678',
    mt_server='ExnessMT5-Demo'
)

# Send support message notification
notification_service.send_support_message_notification(
    user_id=user['_id'],
    admin_name='Support Team'
)

# Send bulk notification
user_ids = [user1['_id'], user2['_id'], user3['_id']]
stats = notification_service.send_bulk_notification(
    user_ids=user_ids,
    title='Important Update',
    body='Check your account for important updates',
    data={'url': '/my-accounts'}
)
```

#### Integrating with Existing Features

When approving payments, add notification:

```python
@app.route('/api/admin/approve-payment/<payment_id>', methods=['POST'])
def approve_payment(payment_id):
    # ... existing code ...
    
    # Send notification to user
    notification_service.send_payment_notification(
        user_id=payment['user_id'],
        payment_type=payment.get('type', 'deposit'),
        status='completed',
        amount=payment['amount'],
        currency=payment['currency'],
        account_nickname=account['nickname']
    )
    
    # ... rest of code ...
```

## Browser Compatibility

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome | ✅ Full | Desktop & Android |
| Firefox | ✅ Full | Desktop & Android |
| Safari | ⚠️ Limited | iOS 16+ only |
| Edge | ✅ Full | Desktop |
| Opera | ✅ Full | Desktop |
| IE | ❌ None | Not supported |

## Security Considerations

1. **HTTPS Required**: Push notifications only work over HTTPS (except localhost)
2. **CSRF Protection**: All notification endpoints are CSRF-protected
3. **User Consent**: Users must explicitly grant permission
4. **Subscription Storage**: Subscriptions are stored securely in MongoDB
5. **Data Privacy**: Subscription data is user-specific and encrypted

## Database Schema

### Push Subscriptions Collection

```javascript
{
    _id: ObjectId,
    user_id: ObjectId,           // Reference to user
    subscription: {
        endpoint: String,         // Push service endpoint
        keys: {
            p256dh: String,       // Encryption key
            auth: String          // Authentication key
        }
    },
    subscribed_at: DateTime,      // When subscription was created
    user_agent: String            // Browser/device info
}
```

## Troubleshooting

### Notifications Not Appearing

1. **Check Browser Settings**
   - Ensure notifications are enabled in browser settings
   - Check if the site has permission to send notifications

2. **Check Service Worker**
   - Open DevTools → Application → Service Workers
   - Verify service worker is registered and active

3. **Check Console**
   - Open DevTools → Console
   - Look for any error messages

4. **Test Subscription**
   - Use the "Send Test" button in notification settings
   - Check if test notification appears

### Permission Denied

If user clicks "Block" on permission prompt:
1. They need to manually enable notifications in browser settings
2. For Chrome: Settings → Privacy → Site Settings → Notifications
3. For Firefox: Preferences → Privacy → Permissions → Notifications

### Service Worker Not Registering

1. Ensure HTTPS is enabled (or localhost for development)
2. Check that `/static/js/service-worker.js` is accessible
3. Check browser console for registration errors

## Production Deployment

### For Render/Heroku

1. Ensure HTTPS is enabled (automatic on Render)
2. Service worker will be served from `/static/js/service-worker.js`
3. Push subscriptions will be stored in MongoDB

### For Custom Servers

1. Ensure HTTPS certificate is valid
2. Configure CORS if needed
3. Ensure `/static/js/service-worker.js` is accessible
4. MongoDB connection must be working

## Future Enhancements

1. **Web Push Protocol (RFC 8030)**
   - Implement actual push delivery using pywebpush
   - Support for different push services (FCM, APNs, etc.)

2. **Notification Preferences**
   - Allow users to customize which notifications they receive
   - Quiet hours/do not disturb settings

3. **Notification History**
   - Store notification history in database
   - Allow users to view past notifications

4. **Rich Notifications**
   - Add images and action buttons
   - Custom notification sounds

5. **Analytics**
   - Track notification delivery rates
   - Monitor user engagement with notifications

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review browser console for error messages
3. Check MongoDB for subscription records
4. Review application logs for backend errors
