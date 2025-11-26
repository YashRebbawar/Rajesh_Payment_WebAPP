# 🔧 Google OAuth Troubleshooting

## Error: "400 Bad Request"

This error means Google OAuth is **not properly configured**. Here's how to fix it:

## Quick Fix

### Option 1: Use Email/Password (Recommended)
**Don't use the Google button!** Use email/password authentication instead:
1. Go to `/register`
2. Fill the form
3. Click yellow "Register" button (NOT Google)
4. ✅ Works perfectly!

### Option 2: Properly Configure Google OAuth

#### Step 1: Check if OAuth is configured
When you start the app, look for this log:
```bash
python app.py
```

**If you see:**
```
WARNING:__main__:Google OAuth not configured - GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing
```
→ OAuth is NOT configured (this is your issue)

**If you see:**
```
INFO:__main__:Google OAuth configured successfully
```
→ OAuth IS configured

#### Step 2: Create `.env` file
Create a file named `.env` in the `backend` folder:

```env
SECRET_KEY=your-random-secret-key-here
GOOGLE_CLIENT_ID=your-actual-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-actual-client-secret
DATABASE_URL=sqlite:///printfree.db
```

**Important:** Replace with REAL credentials from Google Cloud Console!

#### Step 3: Get Real Google Credentials

1. Go to https://console.cloud.google.com/
2. Create a new project
3. Enable "Google+ API"
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Application type: **Web application**
6. Authorized redirect URIs: `http://localhost:5000/auth/google/callback`
7. Copy the Client ID and Client Secret
8. Paste them in `.env` file

#### Step 4: Restart the app
```bash
python app.py
```

Look for:
```
INFO:__main__:Google OAuth configured successfully
```

#### Step 5: Test Google OAuth
1. Click "Sign In" → "Google"
2. Watch console logs:
```
INFO:__main__:Initiating Google OAuth flow
INFO:__main__:Google OAuth callback received
INFO:__main__:Request args: ImmutableMultiDict([('code', '...')])
INFO:__main__:Google OAuth successful for email: yourname@gmail.com
```

## Common Issues

### Issue 1: No `.env` file
**Symptom:** `WARNING: Google OAuth not configured`
**Solution:** Create `.env` file with real credentials

### Issue 2: Wrong credentials in `.env`
**Symptom:** `ERROR: Google OAuth Error: 400 Bad Request`
**Solution:** Get real credentials from Google Cloud Console

### Issue 3: Redirect URI mismatch
**Symptom:** Google shows "redirect_uri_mismatch" error
**Solution:** In Google Cloud Console, set redirect URI to exactly:
```
http://localhost:5000/auth/google/callback
```

### Issue 4: Google+ API not enabled
**Symptom:** OAuth fails silently
**Solution:** Enable Google+ API in Google Cloud Console

## Detailed Logs

With the new logging, you'll see exactly what's happening:

### Successful OAuth Flow:
```bash
INFO:__main__:Initiating Google OAuth flow, redirect_uri: http://localhost:5000/auth/google/callback
INFO:__main__:Google OAuth callback received
INFO:__main__:Request args: ImmutableMultiDict([('code', '4/0AY0e-g7...')])
INFO:__main__:Google OAuth successful for email: test@gmail.com
INFO:__main__:Creating new user from Google OAuth: test@gmail.com
INFO:__main__:User session created, redirecting to landing page
INFO:__main__:User logged in: test@gmail.com
```

### Failed OAuth (Not Configured):
```bash
WARNING:__main__:Google OAuth not configured - GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing
WARNING:__main__:Google OAuth attempt without configuration
```

### Failed OAuth (Wrong Credentials):
```bash
INFO:__main__:Google OAuth callback received
INFO:__main__:Request args: ImmutableMultiDict([('error', 'access_denied')])
ERROR:__main__:Google OAuth error in callback: access_denied
```

## Summary

✅ **For now:** Use email/password (no setup needed)
✅ **Later:** Set up real Google OAuth credentials when ready

The app works perfectly without Google OAuth! 🚀

## Need Help?

Check these files:
- `GOOGLE_OAUTH_SETUP.md` - Detailed setup guide
- `LOGGING_GUIDE.md` - Understanding logs
- `TESTING_GUIDE.md` - Testing without OAuth
