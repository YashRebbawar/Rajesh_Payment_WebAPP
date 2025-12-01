# Quick Start: Payment Gateway Testing

## 🚀 Quick Test (5 Minutes)

### 1. Start the Application
```bash
cd backend
python app.py
```

### 2. Create Test Accounts

#### Create Admin Account
```bash
python create_admin.py
```
Enter admin email and password.

#### Create Regular User
1. Go to `http://localhost:5000/register`
2. Register a new user
3. Login with the credentials

### 3. Create Trading Account
1. After login, click "Open Account"
2. Choose any account type (e.g., Standard)
3. Fill in the details:
   - Currency: USD
   - Nickname: My Test Account
   - Leverage: 1:100
   - Platform: MT5
   - Password: any password
4. Click "Create Account"

### 4. Test Payment Flow

#### Step A: Initiate Payment
1. Go to "My Accounts"
2. Click "Deposit" on your account
3. Enter amount: `100`
4. Click "Pay Now"
5. **QR Modal appears** with:
   - Amount: 100 USD
   - QR Code
   - "Waiting for payment..." status

#### Step B: Simulate Payment (Testing)
1. Open new tab: `http://localhost:5000/test-payment`
2. Look at the QR modal in the first tab
3. Open browser console (F12)
4. Find the payment_id in the console logs or network tab
5. Copy the payment_id
6. Paste it in the test-payment page
7. Click "Simulate QR Payment Completion"
8. You should see: "✓ Payment simulated successfully!"

#### Step C: Check Success Modal
1. Go back to the payment tab
2. After 3 seconds, the QR modal closes
3. **Success modal appears** with:
   - ✓ "Payment Received!"
   - "We will set up your account in a while..."
   - "You'll receive a notification once admin approves"

#### Step D: Admin Approval
1. Logout from user account
2. Login as admin
3. Go to admin dashboard
4. **See pending payment notification** at the top:
   - Shows user email
   - Shows amount (100 USD)
   - Shows account nickname
   - Shows timestamp
5. Click "Approve" button
6. Confirm approval
7. Payment disappears from pending list

#### Step E: Verify Balance Update
1. Logout from admin
2. Login as the regular user
3. Go to "My Accounts"
4. **Balance is now 100.00 USD** (updated!)

## 🎯 Expected Results

### User Experience
- ✅ Smooth payment modal with QR code
- ✅ Real-time status updates
- ✅ Success confirmation message
- ✅ Balance updated after admin approval

### Admin Experience
- ✅ Instant notification of new payment
- ✅ Clear payment details
- ✅ One-click approval
- ✅ Auto-refresh for new payments

## 📊 Check Database

### View Payments
```javascript
// In MongoDB Compass or Shell
db.payments.find().pretty()
```

Expected document:
```javascript
{
  _id: ObjectId("..."),
  user_id: ObjectId("..."),
  account_id: ObjectId("..."),
  amount: 100,
  currency: "USD",
  status: "approved",
  qr_scanned: true,
  created_at: ISODate("..."),
  completed_at: ISODate("..."),
  approved_at: ISODate("..."),
  approved_by: ObjectId("...")
}
```

### View Notifications
```javascript
db.notifications.find().pretty()
```

Expected documents:
```javascript
// Admin notification
{
  type: "payment_received",
  payment_id: ObjectId("..."),
  user_email: "user@example.com",
  amount: 100,
  status: "approved"
}

// User notification
{
  type: "payment_approved",
  user_id: ObjectId("..."),
  message: "Your deposit of 100 USD has been approved...",
  read: false
}
```

## 🔧 Troubleshooting

### QR Modal Not Appearing
**Problem**: Clicking "Pay Now" does nothing

**Solution**:
1. Open browser console (F12)
2. Check for JavaScript errors
3. Verify QRCode.js is loaded:
   ```
   View Page Source → Search for "qrcodejs"
   ```
4. Clear browser cache and reload

### Payment ID Not Found
**Problem**: Test page says "Payment not found"

**Solution**:
1. Check the payment was created:
   ```javascript
   db.payments.find().sort({created_at: -1}).limit(1)
   ```
2. Copy the correct `_id` from the document
3. Make sure you're using the ObjectId string

### Admin Not Seeing Notification
**Problem**: Admin dashboard shows no pending payments

**Solution**:
1. Check payment status:
   ```javascript
   db.payments.findOne({_id: ObjectId("payment_id")})
   ```
2. Verify status is "completed" (not "pending")
3. Check notifications collection:
   ```javascript
   db.notifications.find({status: "pending_approval"})
   ```
4. Refresh admin dashboard (F5)

### Balance Not Updated
**Problem**: After approval, balance still shows 0.00

**Solution**:
1. Check account document:
   ```javascript
   db.trading_accounts.findOne({_id: ObjectId("account_id")})
   ```
2. Verify `balance` field exists and has correct value
3. Logout and login again
4. Check browser console for errors

## 🎨 Customization Tips

### Change QR Code Size
In `payment.html`:
```javascript
new QRCode(document.getElementById('qr-code'), {
    text: qrData,
    width: 250,  // Change this
    height: 250, // Change this
    ...
});
```

### Change Polling Speed
In `payment.html`:
```javascript
}, 3000); // 3 seconds - make it faster (1000) or slower (5000)
```

### Change Success Message
In `payment.html`:
```html
<p>We will set up your account in a while and let you know.</p>
<!-- Change to your custom message -->
```

### Add Sound Notification
In `admin-dashboard.html`:
```javascript
// In auto-refresh interval
if (data.notifications.length > currentCount) {
    new Audio('/static/notification.mp3').play();
    location.reload();
}
```

## 📱 Mobile Testing

1. Find your local IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
2. Access from phone: `http://YOUR_IP:5000`
3. Test QR scanning with phone camera
4. Verify responsive design

## 🔐 Security Notes

⚠️ **This is a development/testing setup**

For production:
1. Replace simulate endpoint with real payment gateway webhook
2. Add payment signature verification
3. Use HTTPS for all payment pages
4. Add rate limiting on payment endpoints
5. Implement proper error handling
6. Add transaction logging
7. Set up payment reconciliation

## 📞 Need Help?

Common issues:
- **Port 5000 in use**: Change port in `app.py`
- **MongoDB connection failed**: Check `.env` file
- **QRCode.js not loading**: Check internet connection
- **Session expired**: Login again

Check logs:
```bash
# Server logs show in terminal where you ran python app.py
# Look for lines starting with "INFO" or "ERROR"
```

## ✅ Success Checklist

- [ ] Application running on localhost:5000
- [ ] Admin account created
- [ ] Regular user registered and logged in
- [ ] Trading account created
- [ ] Payment initiated (QR modal appears)
- [ ] Payment simulated (test page)
- [ ] Success modal appears
- [ ] Admin sees notification
- [ ] Admin approves payment
- [ ] User balance updated

**All checked?** 🎉 Your payment gateway is working perfectly!

## 🚀 Next Steps

1. Read `PAYMENT_GATEWAY_GUIDE.md` for detailed documentation
2. Integrate real payment gateway (Razorpay/Stripe)
3. Add email notifications
4. Create payment history page
5. Add refund functionality
6. Implement payment analytics
