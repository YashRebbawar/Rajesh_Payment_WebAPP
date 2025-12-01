# QR Payment Integration Guide

## How Payment Verification Works

### Current Flow:
1. **User initiates payment** → Creates payment record with status "pending"
2. **QR code displayed** → User scans QR code with payment app
3. **Payment gateway processes** → User completes payment in their app
4. **Webhook notification** → Payment gateway calls your webhook endpoint
5. **Status updated** → Payment status changes to "completed"
6. **User notified** → Success modal shows: "We will set up your account in a while and let you know"
7. **Admin approval** → Admin reviews and approves the payment
8. **Funds credited** → Balance added to user's account

## Webhook Endpoint

**URL:** `https://yourdomain.com/api/payment/webhook`
**Method:** POST

### Expected Payload from Payment Gateway:
```json
{
  "payment_id": "67890abcdef123456",
  "transaction_id": "TXN123456789",
  "status": "success",
  "amount": 100.00,
  "currency": "USD",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Response:
```json
{
  "success": true
}
```

## Integration Steps

### 1. Configure Your Payment Gateway

Most QR payment gateways (like Razorpay, Stripe, PayPal, etc.) require:

1. **Register webhook URL** in their dashboard:
   - URL: `https://yourdomain.com/api/payment/webhook`
   - Events: `payment.success`, `payment.failed`

2. **Get webhook secret** for signature verification
3. **Add to .env file**:
   ```
   PAYMENT_WEBHOOK_SECRET=your_webhook_secret_here
   ```

### 2. Generate Dynamic QR Codes (Optional Enhancement)

Currently using static QR image. For production, generate dynamic QR codes:

```python
# Install: pip install qrcode pillow

import qrcode
from io import BytesIO
import base64

@app.route('/api/payment/qr/<payment_id>', methods=['GET'])
def generate_qr(payment_id):
    payment = payments_collection.find_one({'_id': ObjectId(payment_id)})
    if not payment:
        return jsonify({'error': 'Payment not found'}), 404
    
    # Create payment URL with your gateway
    payment_url = f"upi://pay?pa=merchant@upi&pn=YourBusiness&am={payment['amount']}&cu={payment['currency']}&tn=Payment_{payment_id}"
    
    # Generate QR code
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(payment_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to base64
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    img_str = base64.b64encode(buffer.getvalue()).decode()
    
    return jsonify({'qr_code': f'data:image/png;base64,{img_str}'})
```

### 3. Update Frontend to Use Dynamic QR

In `payment.html`, replace static image:

```javascript
async function showQRModal(amount, currency, accountId) {
    const modal = document.getElementById('qr-modal');
    document.getElementById('qr-amount').textContent = amount.toFixed(2);
    document.getElementById('qr-currency').textContent = currency;
    
    // Get payment ID first
    const paymentId = await initiatePayment(accountId, amount, currency);
    
    // Fetch dynamic QR code
    const qrResponse = await fetch(`/api/payment/qr/${paymentId}`);
    const qrData = await qrResponse.json();
    document.querySelector('.qr-code-image').src = qrData.qr_code;
    
    modal.style.display = 'block';
}
```

## Testing

### Test with Simulation Endpoint:

```bash
# Simulate successful payment
curl -X POST http://localhost:5000/api/payment/simulate/PAYMENT_ID
```

### Test Webhook Locally:

```bash
# Use ngrok to expose local server
ngrok http 5000

# Configure webhook URL in payment gateway:
# https://your-ngrok-url.ngrok.io/api/payment/webhook

# Test webhook:
curl -X POST http://localhost:5000/api/payment/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "payment_id": "PAYMENT_ID",
    "transaction_id": "TXN123",
    "status": "success"
  }'
```

## Popular Payment Gateway Integration

### UPI (India) - Razorpay
```python
import razorpay

client = razorpay.Client(auth=(os.getenv('RAZORPAY_KEY'), os.getenv('RAZORPAY_SECRET')))

# Create QR code
qr_code = client.qr_code.create({
    "type": "upi_qr",
    "name": "Payment",
    "usage": "single_use",
    "fixed_amount": True,
    "payment_amount": amount * 100,  # in paise
    "description": f"Deposit to {account['nickname']}"
})
```

### PayPal QR Code
```python
import paypalrestsdk

paypalrestsdk.configure({
    "mode": "sandbox",  # or "live"
    "client_id": os.getenv('PAYPAL_CLIENT_ID'),
    "client_secret": os.getenv('PAYPAL_SECRET')
})

payment = paypalrestsdk.Payment({
    "intent": "sale",
    "payer": {"payment_method": "paypal"},
    "transactions": [{
        "amount": {"total": str(amount), "currency": currency},
        "description": "Account deposit"
    }],
    "redirect_urls": {
        "return_url": "http://yourdomain.com/payment/success",
        "cancel_url": "http://yourdomain.com/payment/cancel"
    }
})
```

### Stripe Payment Links
```python
import stripe

stripe.api_key = os.getenv('STRIPE_SECRET_KEY')

payment_link = stripe.PaymentLink.create(
    line_items=[{
        "price_data": {
            "currency": currency.lower(),
            "product_data": {"name": "Account Deposit"},
            "unit_amount": int(amount * 100),
        },
        "quantity": 1,
    }],
    metadata={"payment_id": str(payment_id)}
)
```

## Security Best Practices

1. **Verify webhook signatures** - Always validate requests from payment gateway
2. **Use HTTPS** - Never expose webhook endpoint over HTTP
3. **Idempotency** - Handle duplicate webhook calls gracefully
4. **Rate limiting** - Protect webhook endpoint from abuse
5. **Logging** - Log all webhook events for audit trail

## Environment Variables

Add to `.env`:
```
# Payment Gateway Configuration
PAYMENT_GATEWAY=razorpay  # or stripe, paypal, etc.
PAYMENT_WEBHOOK_SECRET=your_webhook_secret
RAZORPAY_KEY=your_key
RAZORPAY_SECRET=your_secret
```

## Current Implementation Status

✅ Payment initiation
✅ QR code display
✅ Status polling (every 3 seconds)
✅ Success notification with message
✅ Admin notification system
✅ Webhook endpoint ready
⚠️ Static QR code (needs dynamic generation)
⚠️ Webhook signature verification (commented out)

## Next Steps

1. Choose your payment gateway provider
2. Register for API credentials
3. Configure webhook URL in their dashboard
4. Implement dynamic QR code generation
5. Add webhook signature verification
6. Test in sandbox/test mode
7. Deploy to production with HTTPS
8. Monitor webhook logs
