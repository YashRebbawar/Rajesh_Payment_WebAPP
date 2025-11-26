# 🍃 MongoDB Atlas Setup Guide

## Quick Setup (5 minutes)

### Step 1: Create MongoDB Atlas Account
1. Go to https://www.mongodb.com/cloud/atlas/register
2. Sign up for free (no credit card required)
3. Choose **FREE** tier (M0 Sandbox - 512MB)

### Step 2: Create a Cluster
1. After login, click **"Build a Database"**
2. Choose **FREE** tier (M0)
3. Select a cloud provider and region (closest to you)
4. Click **"Create"** (takes 1-3 minutes)

### Step 3: Create Database User
1. Click **"Database Access"** in left sidebar
2. Click **"Add New Database User"**
3. Choose **"Password"** authentication
4. Username: `printfree_user` (or any name)
5. Password: Generate a strong password (save it!)
6. Database User Privileges: **"Read and write to any database"**
7. Click **"Add User"**

### Step 4: Allow Network Access
1. Click **"Network Access"** in left sidebar
2. Click **"Add IP Address"**
3. Click **"Allow Access from Anywhere"** (for development)
   - IP: `0.0.0.0/0`
4. Click **"Confirm"**

### Step 5: Get Connection String
1. Click **"Database"** in left sidebar
2. Click **"Connect"** on your cluster
3. Choose **"Connect your application"**
4. Driver: **Python**, Version: **3.12 or later**
5. Copy the connection string:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

### Step 6: Configure Your App
1. Create `.env` file in `backend` folder:
   ```env
   SECRET_KEY=your-secret-key-here
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   MONGO_URI=mongodb+srv://printfree_user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/printfree?retryWrites=true&w=majority
   ```

2. Replace in connection string:
   - `<username>` → your database username
   - `<password>` → your database password
   - Add `/printfree` before the `?` (database name)

### Step 7: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 8: Run the App
```bash
python app.py
```

## ✅ What's Stored in MongoDB

### User Document Structure
```json
{
  "_id": "ObjectId",
  "email": "user@example.com",
  "password": "hashed_password",
  "country": "United States",
  "partner_code": "ABC123",
  "google_id": "google_user_id",
  "created_at": "2024-01-01T00:00:00Z"
}
```

### For Manual Registration:
- ✅ Email
- ✅ Hashed password
- ✅ Country
- ✅ Partner code (optional)
- ✅ Created timestamp

### For Google OAuth:
- ✅ Email (from Google)
- ✅ Google ID
- ✅ Created timestamp
- ❌ No password (uses Google auth)

## 🔍 View Your Data

### Option 1: MongoDB Atlas UI
1. Go to your cluster
2. Click **"Browse Collections"**
3. Select `printfree` database → `users` collection
4. See all registered users

### Option 2: MongoDB Compass (Desktop App)
1. Download: https://www.mongodb.com/try/download/compass
2. Connect using your connection string
3. Browse `printfree.users` collection

### Option 3: Python Script
```python
from pymongo import MongoClient

client = MongoClient("your_mongo_uri")
db = client.printfree
users = db.users.find()

for user in users:
    print(f"Email: {user['email']}, Created: {user['created_at']}")
```

## 🧪 Test the Integration

### Test 1: Manual Registration
1. Go to http://localhost:5000/register
2. Fill the form and submit
3. Check MongoDB Atlas → users collection
4. You should see the new user with hashed password

### Test 2: Google OAuth
1. Set up Google OAuth credentials
2. Go to http://localhost:5000/signin
3. Click "Google" button
4. Sign in with Google
5. Check MongoDB Atlas → users collection
6. You should see the new user with google_id

### Test 3: Sign In
1. Go to http://localhost:5000/signin
2. Enter registered email and password
3. Should redirect to landing page with profile

## 🔒 Security Best Practices

### Production Checklist:
- [ ] Use strong database password
- [ ] Restrict IP addresses (not 0.0.0.0/0)
- [ ] Enable MongoDB Atlas encryption
- [ ] Use environment variables (never commit .env)
- [ ] Enable MongoDB Atlas backup
- [ ] Set up monitoring and alerts

## 📊 MongoDB Atlas Free Tier Limits

- **Storage**: 512 MB
- **RAM**: Shared
- **Connections**: 500 concurrent
- **Backup**: Manual only
- **Perfect for**: Development and small apps

## 🚀 Upgrade Options

When you need more:
- **M10** ($0.08/hour) - 2GB RAM, 10GB storage
- **M20** ($0.20/hour) - 4GB RAM, 20GB storage
- **M30** ($0.54/hour) - 8GB RAM, 40GB storage

## 🆘 Troubleshooting

### Error: "Authentication failed"
- Check username and password in connection string
- Make sure user has correct privileges

### Error: "Connection timeout"
- Check Network Access settings
- Make sure IP is whitelisted (0.0.0.0/0 for dev)

### Error: "pymongo not found"
- Run: `pip install pymongo dnspython`

### Error: "Database not found"
- MongoDB creates database automatically on first write
- Just run the app and register a user

## 📝 Connection String Format

```
mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/DATABASE?retryWrites=true&w=majority
```

Example:
```
mongodb+srv://printfree_user:MyPass123@cluster0.abc123.mongodb.net/printfree?retryWrites=true&w=majority
```

## ✨ Benefits of MongoDB Atlas

✅ **Free tier** - No credit card needed
✅ **Cloud-hosted** - No local setup
✅ **Automatic backups** - Data safety
✅ **Scalable** - Upgrade when needed
✅ **Global** - Deploy anywhere
✅ **Secure** - Built-in encryption

---

**Ready to use!** 🎉

Your app now stores all user data in MongoDB Atlas, including both manual registrations and Google OAuth logins.
