# Real-Time Payment Gateway Integration Guide

## Overview
This payment gateway integration provides a complete QR code-based payment flow with admin approval workflow.

## Features

### 1. **QR Code Payment Modal**
- When user clicks "Pay Now", a popup appears with:
  - Amount to be paid
  - QR code for payment
  - Real-time payment status tracking

### 2. **Payment Flow**
```
User clicks Pay → QR Modal opens → User scans QR → Payment completed → 
Success message → Admin notification → Admin approves → Balance updated
```

### 3. **Admin Notification System**
- Admins receive real-time notifications when payments are received
- Pending payments section shows at top of admin dashboard
- Auto-refresh every 10 seconds for new notifications

### 4. **User Experience**
- After payment: "We will set up your account in a while and let you know"
- User receives notification when admin approves
- Balance automatically updated after approval

## Testing the Integration

### Step 1: Make a Payment
1. Login as a regular user
2. Go to "My Accounts"
3. Click "Deposit" on any account
4. Enter amount and click "Pay Now"
5. QR modal will appear with payment details

### Step 2: Simulate Payment (For Testing)
Since we don't have a real payment gateway yet, use the test page:

1. Open browser: `http://localhost:5000/test-payment`
2. Copy the payment ID from the QR modal (it's in the QR code data)
3. Or check browser console for the payment_id
4. Paste it in the test page
5. Click "Simulate QR Payment Completion"

### Step 3: Admin Approval
1. Login as admin
2. Go to admin dashboard
3. You'll see pending payment notification at the top
4. Click "Approve" button
5. User's balance will be updated

### Step 4: Verify User Balance
1. Login as the user again
2. Check "My Accounts"
3. Balance should be updated with the approved amount

## API Endpoints

### Payment Initiation
```
POST /api/payment/initiate
Body: {
  "account_id": "account_id",
  "amount": 100.00,
  "currency": "USD"
}
Response: {
  "success": true,
  "payment_id": "payment_id"
}
```

### Payment Status Check
```
GET /api/payment/status/{payment_id}
Response: {
  "success": true,
  "status": "pending|completed|approved|failed"
}
```

### Simulate Payment (Testing Only)
```
POST /api/payment/simulate/{payment_id}
Response: {
  "success": true
}
```

### Admin: Get Notifications
```
GET /api/admin/notifications
Response: {
  "success": true,
  "notifications": [...]
}
```

### Admin: Approve Payment
```
POST /api/admin/approve-payment/{payment_id}
Response: {
  "success": true
}
```

### User: Get Notifications
```
GET /api/user/notifications
Response: {
  "success": true,
  "notifications": [...]
}
```

## Database Collections

### payments
```javascript
{
  _id: ObjectId,
  user_id: ObjectId,
  account_id: ObjectId,
  amount: Number,
  currency: String,
  status: "pending|completed|approved|failed",
  qr_scanned: Boolean,
  created_at: DateTime,
  completed_at: DateTime,
  approved_at: DateTime,
  approved_by: ObjectId
}
```

### notifications
```javascript
{
  _id: ObjectId,
  type: "payment_received|payment_approved",
  payment_id: ObjectId,
  user_id: ObjectId,
  user_email: String,
  account_nickname: String,
  amount: Number,
  currency: String,
  status: "pending_approval|approved",
  message: String,
  read: Boolean,
  created_at: DateTime,
  approved_at: DateTime
}
```

## Integration with Real Payment Gateway

To integrate with a real payment gateway (like Razorpay, Stripe, PayPal):

### 1. Replace QR Code Generation
In `payment.html`, replace the QR code generation with your gateway's payment link:

```javascript
// Instead of generating QR with payment data
const qrData = `PAYMENT:${accountId}:${amount}:${currency}:${Date.now()}`;

// Use your payment gateway URL
const paymentUrl = `https://your-gateway.com/pay?amount=${amount}&ref=${paymentId}`;
```

### 2. Add Webhook Handler
Create a webhook endpoint to receive payment confirmations:

```python
@app.route('/webhook/payment', methods=['POST'])
def payment_webhook():
    # Verify webhook signature
    # Extract payment details
    # Update payment status
    # Notify admin
    pass
```

### 3. Update Payment Status
Replace the simulate endpoint with real webhook processing:

```python
# In webhook handler
payments_collection.update_one(
    {'_id': ObjectId(payment_id)},
    {'$set': {
        'status': 'completed',
        'gateway_transaction_id': transaction_id,
        'completed_at': datetime.utcnow()
    }}
)
```

## Security Considerations

1. **Payment Verification**: Always verify payment on server-side
2. **Webhook Security**: Validate webhook signatures
3. **Amount Validation**: Double-check amounts before crediting
4. **Admin Authentication**: Ensure only admins can approve payments
5. **Audit Trail**: Log all payment operations

## Customization

### Change Minimum Deposit
In `payment.html` and `app.py`:
```python
if amount < 10:  # Change this value
```

### Modify Polling Interval
In `payment.html`:
```javascript
}, 3000); // Change polling interval (milliseconds)
```

### Auto-refresh Admin Dashboard
In `admin-dashboard.html`:
```javascript
}, 10000); // Change refresh interval (milliseconds)
```

## Troubleshooting

### QR Modal Not Showing
- Check browser console for errors
- Ensure QRCode.js library is loaded
- Verify payment initiation API is working

### Payment Status Not Updating
- Check polling is running (browser console)
- Verify payment_id is correct
- Check server logs for errors

### Admin Not Receiving Notifications
- Verify notification document is created
- Check admin dashboard auto-refresh is working
- Ensure admin is logged in

### Balance Not Updated After Approval
- Check payment approval API response
- Verify account_id is correct
- Check MongoDB for balance update

## Next Steps

1. **Email Notifications**: Add email alerts for payment events
2. **SMS Notifications**: Integrate SMS for critical updates
3. **Payment History**: Create a page showing all transactions
4. **Refund System**: Add ability to refund payments
5. **Multiple Payment Methods**: Support cards, UPI, wallets, etc.
6. **Currency Conversion**: Handle multi-currency payments
7. **Payment Analytics**: Dashboard with payment statistics

## Support

For issues or questions:
1. Check server logs: `backend/app.py` logging
2. Check browser console for frontend errors
3. Verify MongoDB collections are created
4. Test with the test-payment page first
