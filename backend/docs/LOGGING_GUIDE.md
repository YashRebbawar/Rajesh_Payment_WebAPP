# 📊 Logging Guide

## Overview

Comprehensive logging has been added to track all authentication activities, especially Google OAuth flow.

## What's Being Logged

### User Registration
```
INFO - New user registered: user@example.com
WARNING - Registration attempt with existing email: user@example.com
```

### User Sign In
```
INFO - User signed in: user@example.com
WARNING - Failed sign in attempt for: user@example.com
```

### Google OAuth Flow
```
INFO - Initiating Google OAuth flow, redirect_uri: http://localhost:5000/auth/google/callback
INFO - Google OAuth callback received
INFO - Google OAuth successful for email: user@example.com
INFO - Creating new user from Google OAuth: user@example.com
INFO - Linking existing user to Google account: user@example.com
INFO - Existing Google user signed in: user@example.com
INFO - User session created, redirecting to landing page
ERROR - Google OAuth Error: [error details]
WARNING - Google OAuth attempt without configuration
```

### User Logout
```
INFO - User logged out: user@example.com
```

### Landing Page Access
```
INFO - User logged in: user@example.com
```

## How to View Logs

### In Console
When running the app with `python app.py`, all logs appear in the console:

```bash
python app.py
```

You'll see output like:
```
INFO:__main__:Initiating Google OAuth flow, redirect_uri: http://localhost:5000/auth/google/callback
INFO:__main__:Google OAuth callback received
INFO:__main__:Google OAuth successful for email: test@gmail.com
INFO:__main__:Creating new user from Google OAuth: test@gmail.com
INFO:__main__:User session created, redirecting to landing page
```

### Save to File (Optional)

To save logs to a file, add this to `app.py`:

```python
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)
```

## Testing Google OAuth with Logging

1. **Start the app:**
```bash
python app.py
```

2. **Watch the console for logs**

3. **Click Google sign-in button:**
   - You'll see: `INFO - Initiating Google OAuth flow`
   - If not configured: `WARNING - Google OAuth attempt without configuration`

4. **After Google authorization:**
   - You'll see: `INFO - Google OAuth callback received`
   - Then: `INFO - Google OAuth successful for email: [your-email]`
   - Then: `INFO - Creating new user from Google OAuth` or `INFO - Existing Google user signed in`
   - Finally: `INFO - User session created, redirecting to landing page`

5. **On landing page:**
   - You'll see: `INFO - User logged in: [your-email]`
   - User profile will be displayed instead of Sign In/Register buttons

## New User Flow

### After Successful Login (Email/Password or Google):

**Before:**
- Redirected to `/accounts` page

**Now:**
- Redirected to `/` (landing page)
- Sign In/Register buttons replaced with:
  - User email display
  - "My Accounts" button (goes to `/accounts`)
  - "Logout" button

### Landing Page States

**Not Logged In:**
```
┌─────────────────────────────┐
│  [Sign In]  [Register]      │
└─────────────────────────────┘
```

**Logged In:**
```
┌──────────────────────────────────────────┐
│  user@example.com  [My Accounts] [Logout]│
└──────────────────────────────────────────┘
```

## Troubleshooting with Logs

### Issue: Google OAuth not working

**Look for:**
```
WARNING - Google OAuth attempt without configuration
```
**Solution:** Set up Google OAuth credentials in `.env`

### Issue: User can't sign in

**Look for:**
```
WARNING - Failed sign in attempt for: user@example.com
```
**Solution:** Check password or verify user exists

### Issue: Duplicate registration

**Look for:**
```
WARNING - Registration attempt with existing email: user@example.com
```
**Solution:** User should sign in instead

### Issue: Google OAuth error

**Look for:**
```
ERROR - Google OAuth Error: [error details]
```
**Solution:** Check error details, verify redirect URI, check credentials

## Log Levels

- **INFO**: Normal operations (sign in, registration, OAuth flow)
- **WARNING**: Potential issues (failed attempts, missing config)
- **ERROR**: Actual errors (OAuth failures, exceptions)

## Production Logging

For production, consider:

1. **Use a logging service:**
   - AWS CloudWatch
   - Google Cloud Logging
   - Papertrail
   - Loggly

2. **Add more context:**
   - IP addresses
   - User agents
   - Timestamps
   - Request IDs

3. **Set appropriate log levels:**
   - Production: WARNING and above
   - Development: INFO and above
   - Debug: DEBUG and above

## Privacy Note

⚠️ **Important:** Logs contain user emails. In production:
- Never log passwords
- Consider hashing/masking emails
- Comply with GDPR/privacy regulations
- Secure log storage
- Set log retention policies
