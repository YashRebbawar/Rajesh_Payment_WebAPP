# Exness Payment App

A comprehensive web application for managing MT5 trading accounts with integrated payment processing, user authentication, and admin dashboard. Built with Flask and MongoDB.

## 📋 Overview

Exness Payment App is a full-stack trading account management platform that enables users to:
- Create and manage multiple MT5 trading accounts
- Process deposits and withdrawals
- Track payment status in real-time
- Communicate with support via integrated chat
- Submit testimonials and feedback

Admins can:
- Manage user accounts and trading accounts
- Process and approve/reject payments
- Update MT5 credentials for user accounts
- Monitor platform statistics and commission earnings
- Communicate with users through chat

## ✨ Key Features

### User Features
- **Authentication**: Email/password registration and login with Google OAuth support
- **Account Management**: Create up to 3 MT5 trading accounts with different account types (Standard, Pro, Raw Spread, Zero)
- **Payment Processing**: 
  - Deposit funds via IMPS or USDT
  - Withdraw funds via UPI or Bank Transfer
  - Upload payment screenshots for verification
  - Real-time payment status tracking
- **Notifications**: Receive updates on account creation, payment status, and MT5 credentials
- **Live Chat**: Direct communication with support team
- **Testimonials**: Share trading experience and feedback

### Admin Features
- **Dashboard**: Comprehensive admin panel with user and account management
- **Payment Management**: Review, approve, or reject pending payments and withdrawals
- **Account Management**: Update MT5 credentials, manage account balances and leverage
- **User Management**: View all users, delete accounts, manage testimonials
- **Statistics**: Track total users, deposits, platform fees, and monthly commission
- **Chat System**: Communicate with users for support and inquiries
- **Notifications**: Real-time alerts for new accounts, payments, and withdrawals

## 🏗️ Architecture

### Backend
- **Framework**: Flask (Python)
- **Database**: MongoDB Atlas
- **Authentication**: Session-based with Google OAuth integration
- **Security**: Password hashing, secure session management, input validation

### Frontend
- **HTML/CSS/JavaScript**: Responsive design
- **Templates**: Jinja2 templating engine
- **Static Assets**: CSS, JavaScript, images, and videos

## 📁 Project Structure

```
Exness Payment App/
├── backend/
│   ├── app.py                    # Main Flask application
│   ├── requirements.txt          # Python dependencies
│   ├── .env.example             # Environment variables template
│   ├── .env                      # Environment configuration (local)
│   ├── .env.production          # Production environment config
│   ├── Procfile                 # Deployment configuration
│   ├── INSTALL.bat              # Windows installation script
│   ├── create_admin.py          # Admin user creation script
│   ├── clear_user_data.py       # Data cleanup utility
│   ├── instance/
│   │   └── printfree.db         # SQLite database (local)
│   ├── templates/               # HTML templates
│   │   ├── base.html            # Base template
│   │   ├── landing.html         # Landing page
│   │   ├── signin.html          # Sign in page
│   │   ├── register.html        # Registration page
│   │   ├── my-accounts.html     # User accounts page
│   │   ├── accounts.html        # Account type selector
│   │   ├── account-setup.html   # Account creation form
│   │   ├── payment.html         # Payment page
│   │   ├── withdrawal.html      # Withdrawal page
│   │   ├── admin-dashboard.html # Admin dashboard
│   │   └── ...
│   └── static/                  # Static assets
│       ├── css/                 # Stylesheets
│       ├── js/                  # JavaScript files
│       ├── images/              # Image assets
│       └── videos/              # Video assets
├── Procfile                     # Root deployment config
├── requirements.txt             # Root dependencies
└── README.md                    # This file
```

## 🚀 Getting Started

### Prerequisites
- Python 3.8+
- MongoDB Atlas account (free tier available)
- Google OAuth credentials (optional)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd "Exness Payment App"
```

2. **Set up environment variables**
```bash
cd backend
cp .env.example .env
```

3. **Configure .env file**
```env
SECRET_KEY=your-secret-key-here
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/printfree
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
RENDER_URL=http://localhost:5000
PORT=5000
```

4. **Install dependencies**
```bash
pip install -r requirements.txt
```

5. **Run the application**
```bash
python app.py
```

6. **Access the application**
   - Landing: http://localhost:5000
   - Sign In: http://localhost:5000/signin
   - Register: http://localhost:5000/register

## 🔐 Authentication

### Email/Password Authentication
- Users can register with email and password
- Password requirements: 8-15 characters, uppercase, lowercase, number, special character
- Passwords are hashed using Werkzeug security

### Google OAuth
- Optional one-click sign-in with Google
- Automatically creates account if email doesn't exist
- Links existing accounts to Google ID

## 💳 Payment System

### Deposit Methods
- **IMPS**: INR deposits (₹1,000-₹100,000 for Standard, ₹50,000-₹100,000 for others)
- **USDT**: Crypto deposits ($100-$10,000)
- Fee: 1.4% of deposit amount

### Withdrawal Methods
- **UPI**: $10-$50 per withdrawal
- **Bank Transfer**: Minimum $50
- Requires IFSC code and bank account number

### Payment Flow
1. User initiates payment/withdrawal
2. Payment record created with "pending" status
3. User uploads screenshot (for deposits)
4. Admin reviews and approves/rejects
5. Payment status updated and user notified

## 📊 Database Schema

### Collections
- **users**: User accounts with authentication data
- **trading_accounts**: MT5 trading accounts
- **payments**: Deposit and withdrawal transactions
- **notifications**: System notifications for users and admins
- **chats**: Support chat messages
- **testimonials**: User testimonials and reviews

## 🛠️ API Endpoints

### Authentication
- `POST /api/register` - User registration
- `POST /api/signin` - User login
- `POST /api/forgot-password` - Password reset
- `GET /auth/google` - Google OAuth login
- `GET /auth/google/callback` - OAuth callback
- `GET /logout` - User logout

### Accounts
- `GET /api/account-count` - Get user's account count
- `POST /api/account-setup` - Create new trading account
- `POST /api/admin/update-account-mt/<account_id>` - Update MT5 credentials
- `POST /api/admin/update-account-details/<account_id>` - Update account details
- `POST /api/admin/update-account-balance/<account_id>` - Update account balance

### Payments
- `POST /api/payment/initiate` - Initiate deposit
- `POST /api/payment/upload-screenshot/<payment_id>` - Upload payment proof
- `POST /api/payment/simulate/<payment_id>` - Submit payment for approval
- `GET /api/payment/status/<payment_id>` - Check payment status
- `POST /api/payment/webhook` - Payment gateway webhook

### Withdrawals
- `POST /api/withdrawal/initiate` - Initiate withdrawal
- `GET /api/withdrawal/saved-credentials` - Get saved withdrawal details
- `POST /api/withdrawal/save-credentials` - Save withdrawal details

### Admin
- `GET /api/admin/notifications` - Get pending approvals
- `POST /api/admin/approve-payment/<payment_id>` - Approve payment
- `POST /api/admin/reject-payment/<payment_id>` - Reject payment
- `GET /api/admin/commission-stats` - Get platform statistics
- `DELETE /api/admin/delete-user/<user_id>` - Delete user account

### Chat
- `POST /api/chat/send` - Admin sends message
- `GET /api/chat/messages/<user_id>` - Get chat history
- `POST /api/chat/user-send` - User sends message
- `GET /api/chat/user-messages` - Get user chat history
- `GET /api/chat/admin-users` - Get users with chat history

### Testimonials
- `POST /api/testimonials` - Submit testimonial
- `GET /api/stats` - Get platform statistics

## 🔒 Security Features

- ✅ Password hashing with Werkzeug
- ✅ Session-based authentication with secure cookies
- ✅ MongoDB injection protection
- ✅ CSRF protection via session tokens
- ✅ Input validation and sanitization
- ✅ File upload validation (image formats only)
- ✅ Rate limiting on sensitive endpoints
- ✅ Secure OAuth implementation

## 📈 Deployment

### Render.com
The application is configured for deployment on Render.com:

1. Connect your GitHub repository
2. Set environment variables in Render dashboard
3. Deploy using the provided Procfile

### Environment Variables
```env
SECRET_KEY=<generate-secure-key>
MONGO_URI=<mongodb-atlas-connection-string>
GOOGLE_CLIENT_ID=<google-oauth-id>
GOOGLE_CLIENT_SECRET=<google-oauth-secret>
RENDER_URL=<your-render-app-url>
PORT=5000
```

## 🧹 Maintenance

### Automatic Cleanup
- Chats and notifications older than 2 days are automatically deleted
- Cleanup runs every hour to maintain database performance

### Manual Cleanup
```bash
python clear_user_data.py
```

### Create Admin User
```bash
python create_admin.py
```

## 📝 Configuration Files

### .env.example
Template for environment variables. Copy to `.env` and fill in your values.

### .env.production
Production-specific configuration for deployment environments.

### Procfile
Deployment configuration for Render.com and Heroku.

## 🐛 Troubleshooting

### MongoDB Connection Issues
- Verify MONGO_URI in .env file
- Check MongoDB Atlas IP whitelist
- Ensure credentials are URL-encoded if they contain special characters

### Google OAuth Not Working
- Verify GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
- Check redirect URI matches in Google Cloud Console
- Ensure RENDER_URL is set correctly

### Payment Processing Issues
- Check payment method limits
- Verify account type and currency settings
- Review admin notifications for pending approvals

## 📞 Support

For issues or questions:
1. Check the troubleshooting section
2. Review application logs
3. Contact admin through the chat system

## 📄 License

This project is proprietary and confidential.

## 🙏 Acknowledgments

- Flask framework and community
- MongoDB for database services
- Google for OAuth implementation
- Render.com for hosting platform
