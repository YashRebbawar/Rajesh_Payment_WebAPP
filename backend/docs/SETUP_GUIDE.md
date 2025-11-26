# PrintFree Authentication Setup Guide

## 🎯 Features Implemented
- ✅ Sign In page (Exness-style UI)
- ✅ Register page with password validation
- ✅ Google OAuth integration
- ✅ SQLite database for local development
- ✅ Session management
- ✅ Password hashing

## 📦 Installation

1. **Install dependencies:**
```bash
pip install -r requirements.txt
```

2. **Set up Google OAuth:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable Google+ API
   - Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:5000/auth/google/callback`
   - Copy Client ID and Client Secret

3. **Configure environment:**
   - Copy `.env.example` to `.env`
   - Add your Google credentials:
```
SECRET_KEY=your-random-secret-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

4. **Update app.py:**
   Replace the placeholder values:
```python
app.config['GOOGLE_CLIENT_ID'] = os.getenv('GOOGLE_CLIENT_ID')
app.config['GOOGLE_CLIENT_SECRET'] = os.getenv('GOOGLE_CLIENT_SECRET')
```

5. **Run the application:**
```bash
python app.py
```

## 🗄️ Free Database Options

### 1. **Supabase** (Recommended)
- **Free Tier:** 500MB database, 2GB bandwidth
- **Features:** PostgreSQL, built-in auth, real-time subscriptions
- **Setup:** https://supabase.com/
```python
# Install: pip install psycopg2-binary
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://user:pass@host:5432/dbname'
```

### 2. **MongoDB Atlas**
- **Free Tier:** 512MB storage
- **Features:** NoSQL, flexible schema
- **Setup:** https://www.mongodb.com/cloud/atlas
```python
# Install: pip install flask-pymongo
app.config['MONGO_URI'] = 'mongodb+srv://user:pass@cluster.mongodb.net/dbname'
```

### 3. **PlanetScale**
- **Free Tier:** 5GB storage, 1 billion row reads/month
- **Features:** MySQL-compatible, serverless
- **Setup:** https://planetscale.com/
```python
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql://user:pass@host/dbname'
```

### 4. **Firebase (Google)**
- **Free Tier:** 1GB storage, 10GB/month transfer
- **Features:** Real-time database, integrates with Google Auth
- **Setup:** https://firebase.google.com/
```python
# Install: pip install firebase-admin
```

### 5. **Railway**
- **Free Tier:** $5 credit/month (PostgreSQL)
- **Features:** Easy deployment, PostgreSQL
- **Setup:** https://railway.app/

## 🔐 Security Notes

1. **Never commit sensitive data:**
   - `.env` file is in `.gitignore`
   - Always use environment variables

2. **Production checklist:**
   - Change `SECRET_KEY` to a strong random value
   - Use HTTPS for OAuth callbacks
   - Set `app.run(debug=False)` in production
   - Use production database (not SQLite)

3. **Password requirements:**
   - 8-15 characters
   - Upper and lowercase letters
   - At least one number
   - At least one special character

## 📱 Routes

- `/` - Landing page
- `/signin` - Sign in page
- `/register` - Registration page
- `/accounts` - Account selection (requires login)
- `/auth/google` - Google OAuth login
- `/logout` - Logout

## 🎨 UI Features

- Clean, modern design matching Exness
- Responsive layout
- Password strength indicator
- Toggle password visibility
- Collapsible partner code field
- Google sign-in button with official branding

## 🚀 Next Steps

1. Set up Google OAuth credentials
2. Choose and configure a production database
3. Deploy to a hosting service (Heroku, Railway, Render)
4. Update OAuth redirect URIs for production domain
5. Add email verification (optional)
6. Add password reset functionality (optional)

## 📝 Database Schema

```sql
User Table:
- id (Primary Key)
- email (Unique)
- password (Hashed)
- country
- partner_code
- google_id (Unique, for OAuth)
- created_at
```

## 🐛 Troubleshooting

**Google OAuth not working:**
- Check redirect URI matches exactly
- Ensure Google+ API is enabled
- Verify credentials in app.py

**Database errors:**
- Delete `printfree.db` and restart app
- Check SQLAlchemy URI format

**Import errors:**
- Run `pip install -r requirements.txt`
- Check Python version (3.7+)
