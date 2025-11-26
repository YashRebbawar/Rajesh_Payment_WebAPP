# 🔐 Google OAuth Setup Guide

## Current Status
Google OAuth is **optional**. The app works perfectly with email/password authentication without any setup.

## Error You're Seeing
The error occurs because Google OAuth credentials are not configured. This is normal and expected!

## Two Options:

### Option 1: Use Email/Password Only (Recommended for Testing)
**No setup needed!** Just use the email/password authentication:
1. Go to `/register`
2. Fill in the form
3. Click "Register" (not the Google button)
4. Done! ✅

### Option 2: Enable Google OAuth

#### Step 1: Get Google Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable **Google+ API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Google+ API"
   - Click "Enable"

4. Create OAuth 2.0 Credentials:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth 2.0 Client ID"
   - Application type: **Web application**
   - Name: PrintFree
   - Authorized redirect URIs: `http://localhost:5000/auth/google/callback`
   - Click "Create"

5. Copy your credentials:
   - Client ID (looks like: `xxxxx.apps.googleusercontent.com`)
   - Client Secret (looks like: `GOCSPX-xxxxx`)

#### Step 2: Configure Your App
1. Create a `.env` file in the `backend` folder:
```env
SECRET_KEY=your-random-secret-key-here
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret
DATABASE_URL=sqlite:///printfree.db
```

2. Restart the Flask app:
```bash
python app.py
```

#### Step 3: Test Google OAuth
1. Go to `/signin` or `/register`
2. Click the "Google" button
3. Sign in with your Google account
4. You'll be redirected to `/accounts`

## Troubleshooting

### "OAuth not configured" error
- Make sure `.env` file exists in the `backend` folder
- Check that `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
- Restart the Flask app after creating `.env`

### "Redirect URI mismatch" error
- In Google Cloud Console, make sure redirect URI is exactly: `http://localhost:5000/auth/google/callback`
- No trailing slash
- Must match exactly

### "Access blocked" error
- Make sure Google+ API is enabled
- Add your email as a test user in OAuth consent screen

## Production Setup

For production (e.g., deployed to Heroku, Railway, etc.):

1. Update redirect URI in Google Cloud Console:
```
https://yourdomain.com/auth/google/callback
```

2. Update `.env` with production domain

3. Make sure to use HTTPS (required by Google)

## Free Database Options

Once you're ready for production, consider these free databases:

| Service | Free Tier | Setup Time |
|---------|-----------|------------|
| **Supabase** | 500MB PostgreSQL | 5 min |
| **MongoDB Atlas** | 512MB | 5 min |
| **PlanetScale** | 5GB MySQL | 10 min |
| **Railway** | $5 credit/month | 3 min |

## Summary

✅ **For now**: Use email/password authentication (no setup needed)
✅ **Later**: Set up Google OAuth when you're ready to deploy

The app is fully functional without Google OAuth! 🚀
