# 🧪 Testing Guide

## Quick Test (No Google OAuth Setup Needed)

### 1. Start the App
```bash
python app.py
```

### 2. Test Registration
1. Go to: http://localhost:5000/register
2. Fill in the form:
   - Country: United States
   - Email: test@printfree.com
   - Password: Test@123 (meets all requirements)
   - Check the US citizen checkbox
3. Click "Register" (yellow button)
4. You should be redirected to `/accounts`

### 3. Test Sign In
1. Go to: http://localhost:5000/signin
2. Enter:
   - Email: test@printfree.com
   - Password: Test@123
3. Click "Sign in"
4. You should be redirected to `/accounts`

### 4. Test Password Validation
1. Go to: http://localhost:5000/register
2. Start typing in the password field
3. Watch the validation indicators change:
   - ○ Gray = Not met
   - ● Green = Met

### 5. Test Protected Route
1. Go to: http://localhost:5000/accounts (without logging in)
2. You should be redirected to `/signin`

### 6. Test Logout
1. After logging in, go to: http://localhost:5000/logout
2. You should be redirected to landing page
3. Try accessing `/accounts` - should redirect to signin

## What About Google OAuth?

**Don't click the Google button yet!** It requires setup.

If you accidentally click it and see an error:
- This is normal - Google OAuth is not configured
- Just use email/password authentication instead
- See [GOOGLE_OAUTH_SETUP.md](GOOGLE_OAUTH_SETUP.md) to enable it later

## Test Accounts

Create these test accounts:

| Email | Password | Purpose |
|-------|----------|---------|
| test@printfree.com | Test@123 | Basic testing |
| admin@printfree.com | Admin@456 | Admin testing |
| user@printfree.com | User@789 | User testing |

## Features to Test

### UI Features
- [x] Responsive design (resize browser)
- [x] Password visibility toggle (eye icon)
- [x] Tab navigation (Sign in ↔ Register)
- [x] Partner code collapse/expand
- [x] Real-time password validation
- [x] Form validation
- [x] Hover effects on buttons

### Authentication Features
- [x] User registration
- [x] User login
- [x] Session management
- [x] Protected routes
- [x] Logout
- [x] Duplicate email prevention

### Security Features
- [x] Password hashing (check database)
- [x] Session security
- [x] Password requirements enforcement

## Database Check

To see registered users:
```bash
# Install SQLite browser or use Python
python
>>> from app import db, User
>>> users = User.query.all()
>>> for user in users:
...     print(f"Email: {user.email}, Created: {user.created_at}")
```

## Common Issues

### "Email already registered"
- Use a different email
- Or delete `printfree.db` and restart

### "Invalid credentials"
- Check email and password
- Password is case-sensitive

### Google OAuth error
- Don't use Google button without setup
- Use email/password instead

## Success Criteria

✅ Can register new user
✅ Can sign in with registered user
✅ Password validation works
✅ Protected routes redirect to signin
✅ Can logout successfully
✅ UI is responsive
✅ All animations work

## Next Steps

Once basic testing works:
1. Set up Google OAuth (optional)
2. Choose production database
3. Deploy to hosting service
4. Add email verification
5. Add password reset

---

**Everything working?** Great! Your authentication system is ready! 🎉
