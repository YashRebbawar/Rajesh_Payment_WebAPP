# 📁 Project Structure

```
backend/
├── app.py                      # Main Flask application with auth routes
├── requirements.txt            # Python dependencies
├── .env.example               # Environment variables template
├── .gitignore                 # Git ignore rules
├── README.md                  # Project documentation
├── SETUP_GUIDE.md            # Detailed setup instructions
├── QUICKSTART.md             # Quick start guide
├── PROJECT_STRUCTURE.md      # This file
│
├── templates/                 # HTML templates
│   ├── base.html             # Base template with common structure
│   ├── landing.html          # Landing page with hero section
│   ├── signin.html           # Sign in page (NEW)
│   ├── register.html         # Registration page (NEW)
│   └── accounts.html         # Account type selector
│
└── static/                    # Static assets
    └── css/
        └── style.css         # All styles including auth pages

Database (auto-generated):
└── printfree.db              # SQLite database (gitignored)
```

## 🎯 Key Files

### **app.py**
- Flask routes for all pages
- User authentication (register, login, logout)
- Google OAuth integration
- Database models (User table)
- Session management

### **templates/signin.html**
- Clean sign-in form
- Email and password fields
- Google sign-in button
- Password visibility toggle
- Tab navigation to register

### **templates/register.html**
- Registration form with validation
- Country selector
- Real-time password strength checker
- Partner code (collapsible)
- US citizen declaration checkbox
- Google sign-up button

### **static/css/style.css**
- Landing page styles
- Account selector styles
- **NEW:** Auth page styles (Exness-inspired)
- Responsive design
- Animations and transitions

## 🔄 User Flow

```
Landing Page (/)
    ↓
Sign In (/signin) ←→ Register (/register)
    ↓                      ↓
    └──── Login Success ───┘
              ↓
    Account Selection (/accounts)
```

## 🗄️ Database Schema

```sql
User {
  id: INTEGER PRIMARY KEY
  email: STRING UNIQUE NOT NULL
  password: STRING (hashed)
  country: STRING
  partner_code: STRING
  google_id: STRING UNIQUE
  created_at: DATETIME
}
```

## 🎨 Design Features

✅ Exness-inspired clean UI
✅ Yellow (#ffd500) brand color
✅ Smooth animations
✅ Responsive layout
✅ Password strength indicator
✅ Form validation
✅ Google OAuth branding
✅ Professional typography

## 🔐 Security Features

✅ Password hashing (Werkzeug)
✅ Session management
✅ CSRF protection (Flask default)
✅ Environment variables for secrets
✅ SQL injection protection (SQLAlchemy ORM)
✅ Secure password requirements

## 📦 Dependencies

- **Flask**: Web framework
- **Flask-SQLAlchemy**: Database ORM
- **Authlib**: OAuth integration
- **python-dotenv**: Environment variables
- **Werkzeug**: Password hashing (included with Flask)

## 🚀 Deployment Ready

- Environment variables configured
- Database migrations ready
- Production settings template
- Security best practices
- Scalable architecture
