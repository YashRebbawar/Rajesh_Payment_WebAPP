# 🔧 Fix "Access blocked: This app's request is invalid"

## Problem
Google is rejecting the OAuth request because the redirect URI doesn't match.

## Solution

### Step 1: Check Your Redirect URI
When you start the app, look at the console log:
```bash
INFO:__main__:Initiating Google OAuth flow, redirect_uri: http://localhost:5000/auth/google/callback
```

Copy this EXACT URL: `http://localhost:5000/auth/google/callback`

### Step 2: Update Google Cloud Console

1. Go to https://console.cloud.google.com/
2. Select your project
3. Go to **"APIs & Services"** → **"Credentials"**
4. Click on your OAuth 2.0 Client ID
5. Under **"Authorized redirect URIs"**, add EXACTLY:
   ```
   http://localhost:5000/auth/google/callback
   ```
   
   **Important:**
   - No trailing slash `/`
   - Must be `http://` (not `https://` for localhost)
   - Port must be `5000`
   - Path must be `/auth/google/callback`

6. Click **"Save"**

### Step 3: Wait 5 Minutes
Google takes a few minutes to update the settings.

### Step 4: Test Again
1. Restart your Flask app:
   ```bash
   python app.py
   ```

2. Try Google sign-in again

## Common Mistakes

❌ **Wrong:** `http://localhost:5000/auth/google/callback/` (trailing slash)
✅ **Correct:** `http://localhost:5000/auth/google/callback`

❌ **Wrong:** `https://localhost:5000/auth/google/callback` (https)
✅ **Correct:** `http://localhost:5000/auth/google/callback`

❌ **Wrong:** `http://127.0.0.1:5000/auth/google/callback` (IP address)
✅ **Correct:** `http://localhost:5000/auth/google/callback`

## Alternative: Use Email/Password

If you don't want to set up Google OAuth right now:
1. Go to `/register`
2. Fill the form
3. Click the yellow "Register" button (NOT Google)
4. Works perfectly! ✅

## Verify Setup

After updating Google Cloud Console, check the logs:
```bash
python app.py
```

You should see:
```
INFO:__main__:Google OAuth configured successfully
INFO:__main__:Initiating Google OAuth flow, redirect_uri: http://localhost:5000/auth/google/callback
```

Then when you click Google sign-in, you should see:
```
INFO:__main__:Google OAuth callback received
INFO:__main__:Request args: ImmutableMultiDict([('code', '...')])
INFO:__main__:Google OAuth successful for email: yourname@gmail.com
```

## Still Not Working?

### Check OAuth Consent Screen
1. Go to **"APIs & Services"** → **"OAuth consent screen"**
2. Add your email as a test user
3. Make sure app is in "Testing" mode

### Check API is Enabled
1. Go to **"APIs & Services"** → **"Library"**
2. Search for "Google+ API"
3. Make sure it's **Enabled**

### Check Credentials
Make sure your `.env` file has the correct credentials:
```env
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnop
```

## Quick Test Checklist

- [ ] Redirect URI in Google Console: `http://localhost:5000/auth/google/callback`
- [ ] No trailing slash in redirect URI
- [ ] Google+ API is enabled
- [ ] Your email is added as test user
- [ ] `.env` file has correct credentials
- [ ] Waited 5 minutes after saving changes
- [ ] Restarted Flask app

If all checked, Google OAuth should work! 🎉
