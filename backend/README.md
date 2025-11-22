# PrintFree Backend

Flask-based backend for the PrintFree trading account services application with complete authentication system.

## ✨ Features

- 🎨 **Exness-inspired UI** - Clean, professional design
- 🔐 **Email/Password Authentication** - Secure user registration and login
- 🌐 **Google OAuth** - One-click sign-in with Google
- 💾 **Database Integration** - SQLAlchemy ORM with SQLite (production-ready for PostgreSQL/MySQL)
- 🔒 **Password Security** - Hashing, validation, and strength requirements
- 📱 **Responsive Design** - Works on all devices
- ⚡ **Session Management** - Secure user sessions

## 🚀 Quick Start

1. **Install dependencies:**
```bash
pip install -r requirements.txt
```

2. **Run the application:**
```bash
python app.py
```

3. **Access the application:**
   - Landing: http://localhost:5000
   - Sign In: http://localhost:5000/signin
   - Register: http://localhost:5000/register
   - Accounts: http://localhost:5000/accounts

## 🔑 Google OAuth Setup (Optional)

**Note:** Google OAuth is optional. The app works perfectly with email/password authentication!

If you see an OAuth error, just use the email/password registration instead of the Google button.

To enable Google OAuth:
1. Get credentials from [Google Cloud Console](https://console.cloud.google.com/)
2. Create `.env` file:
```env
SECRET_KEY=your-secret-key
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```
3. Restart the app

See [GOOGLE_OAUTH_SETUP.md](GOOGLE_OAUTH_SETUP.md) for detailed instructions.

## 📋 Routes

- `/` - Landing page with hero section
- `/signin` - User sign in page
- `/register` - User registration page
- `/accounts` - Account type selector (protected)
- `/auth/google` - Google OAuth login
- `/logout` - User logout
- `/api/register` - Registration API endpoint
- `/api/signin` - Sign in API endpoint

## 🗄️ Free Database Options

| Service | Free Tier | Type |
|---------|-----------|------|
| **Supabase** | 500MB | PostgreSQL |
| **MongoDB Atlas** | 512MB | MongoDB |
| **PlanetScale** | 5GB | MySQL |
| **Railway** | $5/month | PostgreSQL |

## 📁 Project Structure

```
backend/
├── app.py                 # Flask app with auth routes
├── requirements.txt       # Dependencies
├── .env.example          # Environment template
├── templates/
│   ├── base.html         # Base template
│   ├── landing.html      # Landing page
│   ├── signin.html       # Sign in page ✨ NEW
│   ├── register.html     # Registration page ✨ NEW
│   └── accounts.html     # Account selector
└── static/css/
    └── style.css         # All styles
```

## 🔐 Security Features

- ✅ Password hashing with Werkzeug
- ✅ Session-based authentication
- ✅ Environment variables for secrets
- ✅ SQL injection protection (SQLAlchemy)
- ✅ Password strength requirements
- ✅ Secure OAuth implementation

## 📚 Documentation

- [QUICKSTART.md](QUICKSTART.md) - Get started in 2 minutes
- [SETUP_GUIDE.md](SETUP_GUIDE.md) - Detailed setup with database options
- [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) - Complete project overview

## 🎨 UI Screenshots

- **Landing Page**: Modern hero with trading dashboard visualization
- **Sign In**: Clean form with Google OAuth
- **Register**: Password validation with real-time feedback
- **Accounts**: Professional account type cards

## 🛠️ Tech Stack

- **Flask** - Web framework
- **SQLAlchemy** - Database ORM
- **Authlib** - OAuth integration
- **Werkzeug** - Password security
- **SQLite/PostgreSQL** - Database

## 📝 License

MIT License - Feel free to use for your projects!