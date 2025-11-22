# 🚀 Quick Start Guide

## Minimal Setup (Without Google OAuth)

1. **Install dependencies:**
```bash
pip install -r requirements.txt
```

2. **Run the app:**
```bash
python app.py
```

3. **Access the application:**
   - Landing: http://localhost:5000
   - Sign In: http://localhost:5000/signin
   - Register: http://localhost:5000/register

That's it! The app will work with email/password authentication using SQLite database.

## Add Google Sign-In (Optional)

1. **Get Google OAuth credentials:**
   - Visit: https://console.cloud.google.com/
   - Create project → Enable Google+ API → Create OAuth 2.0 credentials
   - Redirect URI: `http://localhost:5000/auth/google/callback`

2. **Create `.env` file:**
```env
SECRET_KEY=your-random-secret-key-here
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

3. **Restart the app**

## Test Accounts

Create a test account:
- Email: test@printfree.com
- Password: Test@123
- Country: United States

## Free Database Options for Production

| Service | Free Tier | Best For |
|---------|-----------|----------|
| **Supabase** | 500MB PostgreSQL | Full-featured apps |
| **MongoDB Atlas** | 512MB | Flexible schema |
| **PlanetScale** | 5GB MySQL | High traffic |
| **Railway** | $5/month credit | Easy deployment |

## Production Deployment

Replace SQLite with PostgreSQL:
```python
# In app.py or .env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

## 📸 Screenshots

- **Landing Page**: Modern hero section with trading dashboard
- **Sign In**: Clean form with Google OAuth button
- **Register**: Password validation with real-time feedback
- **Accounts**: Professional account type selector
