from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from werkzeug.security import generate_password_hash, check_password_hash
from authlib.integrations.flask_client import OAuth
from pymongo import MongoClient
from bson.objectid import ObjectId
from urllib.parse import quote_plus
import os
import logging
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
app.config['SESSION_COOKIE_SECURE'] = False
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_TYPE'] = 'filesystem'

# MongoDB Atlas Config
MONGO_URI = os.getenv('MONGO_URI')
if not MONGO_URI or MONGO_URI.strip() == '':
    logger.error("MONGO_URI not set in .env file")
    logger.error("Please set up MongoDB Atlas and add MONGO_URI to .env")
    logger.error("See MONGODB_SETUP.md for instructions")
    raise Exception("MongoDB connection required. Please configure MONGO_URI in .env file")

try:
    # Handle URL encoding for special characters in password
    if 'mongodb+srv://' in MONGO_URI and '@' in MONGO_URI:
        prefix = MONGO_URI.split('://')[0] + '://'
        rest = MONGO_URI.split('://', 1)[1]
        if '@' in rest:
            creds, host = rest.split('@', 1)
            if ':' in creds:
                username, password = creds.split(':', 1)
                MONGO_URI = f"{prefix}{quote_plus(username)}:{quote_plus(password)}@{host}"
    
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000, tlsAllowInvalidCertificates=True)
    client.server_info()  # Test connection
    logger.info("MongoDB connected successfully")
except Exception as e:
    logger.error(f"MongoDB connection failed: {e}")
    logger.error("Please check your MONGO_URI in .env file")
    logger.error("Make sure username, password, and cluster address are correct")
    raise Exception(f"Failed to connect to MongoDB: {e}")

db = client.printfree
users_collection = db.users
accounts_collection = db.trading_accounts
payments_collection = db.payments
notifications_collection = db.notifications

# Google OAuth Config
app.config['GOOGLE_CLIENT_ID'] = os.getenv('GOOGLE_CLIENT_ID', '')
app.config['GOOGLE_CLIENT_SECRET'] = os.getenv('GOOGLE_CLIENT_SECRET', '')

oauth = OAuth(app)

# Only register Google OAuth if credentials are provided
if app.config['GOOGLE_CLIENT_ID'] and app.config['GOOGLE_CLIENT_SECRET']:
    logger.info("Google OAuth configured successfully")
    google = oauth.register(
        name='google',
        client_id=app.config['GOOGLE_CLIENT_ID'],
        client_secret=app.config['GOOGLE_CLIENT_SECRET'],
        server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
        client_kwargs={'scope': 'openid email profile'}
    )
else:
    logger.warning("Google OAuth not configured - GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing")
    google = None

# Create indexes for MongoDB
users_collection.create_index('email', unique=True)
users_collection.create_index('google_id', unique=True, sparse=True)
accounts_collection.create_index('user_id')
accounts_collection.create_index([('user_id', 1), ('nickname', 1)])

def get_current_user():
    """Helper function to get current user from session"""
    if 'user_id' in session:
        try:
            return users_collection.find_one({'_id': ObjectId(session['user_id'])})
        except:
            session.pop('user_id', None)
    return None

@app.route('/')
def landing_page():
    user = get_current_user()
    if user:
        logger.info(f"User logged in: {user['email']}")
    return render_template('landing.html', user=user)

@app.route('/signin')
def signin():
    user = get_current_user()
    return render_template('signin.html', user=user)

@app.route('/register')
def register():
    user = get_current_user()
    return render_template('register.html', user=user)

@app.route('/my-accounts')
def my_accounts():
    user = get_current_user()
    if not user:
        return redirect(url_for('signin'))
    if user.get('is_admin'):
        return redirect(url_for('admin_dashboard'))
    accounts = list(accounts_collection.find({'user_id': user['_id']}).sort('created_at', -1))
    return render_template('my-accounts.html', user=user, accounts=accounts)

@app.route('/accounts')
def accounts():
    user = get_current_user()
    if not user:
        return redirect(url_for('signin'))
    return render_template('accounts.html', user=user)

@app.route('/account-setup/<account_type>')
def account_setup(account_type):
    user = get_current_user()
    if not user:
        return redirect(url_for('signin'))
    valid_types = ['standard', 'pro', 'raw-spread', 'zero']
    if account_type not in valid_types:
        return redirect(url_for('accounts'))
    return render_template('account-setup.html', account_type=account_type, user=user)

@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.json
    
    if users_collection.find_one({'email': data['email']}):
        logger.warning(f"Registration attempt with existing email: {data['email']}")
        return jsonify({'success': False, 'message': 'Email already registered'})
    
    user_doc = {
        'email': data['email'],
        'password': generate_password_hash(data['password']),
        'country': data.get('country'),
        'partner_code': data.get('partner_code'),
        'google_id': None,
        'created_at': datetime.now(timezone.utc)
    }
    result = users_collection.insert_one(user_doc)
    
    logger.info(f"New user registered: {data['email']}")
    return jsonify({'success': True, 'redirect': '/signin'})

@app.route('/api/signin', methods=['POST'])
def api_signin():
    data = request.json
    user = users_collection.find_one({'email': data['email']})
    
    if user and user.get('password') and check_password_hash(user['password'], data['password']):
        session['user_id'] = str(user['_id'])
        logger.info(f"User signed in: {user['email']}")
        redirect_url = '/admin/dashboard' if user.get('is_admin') else '/my-accounts'
        return jsonify({'success': True, 'redirect': redirect_url})
    
    logger.warning(f"Failed sign in attempt for: {data['email']}")
    return jsonify({'success': False, 'message': 'Invalid credentials'})

@app.route('/auth/google')
def google_login():
    if not google:
        logger.warning("Google OAuth attempt without configuration")
        return jsonify({'error': 'Google OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env file'}), 400
    redirect_uri = url_for('google_callback', _external=True)
    logger.info(f"Initiating Google OAuth flow, redirect_uri: {redirect_uri}")
    logger.info(f"Client ID: {app.config['GOOGLE_CLIENT_ID'][:20]}...")
    return google.authorize_redirect(redirect_uri)

@app.route('/auth/google/callback')
def google_callback():
    try:
        logger.info("Google OAuth callback received")
        logger.info(f"Request args: {request.args}")
        logger.info(f"Request URL: {request.url}")
        
        # Check if error in callback
        if 'error' in request.args:
            error_desc = request.args.get('error_description', 'No description')
            logger.error(f"Google OAuth error: {request.args.get('error')} - {error_desc}")
            return redirect(url_for('signin'))
        
        # Check if code is present
        if 'code' not in request.args:
            logger.error("No authorization code in callback")
            logger.error(f"Available args: {list(request.args.keys())}")
            return redirect(url_for('signin'))
        
        logger.info("Exchanging code for token...")
        token = google.authorize_access_token()
        logger.info("Token received, getting user info...")
        user_info = token.get('userinfo')
        logger.info(f"Google OAuth successful for email: {user_info['email']}")
        
        user = users_collection.find_one({'google_id': user_info['sub']})
        if not user:
            user = users_collection.find_one({'email': user_info['email']})
            if user:
                logger.info(f"Linking existing user to Google account: {user['email']}")
                users_collection.update_one(
                    {'_id': user['_id']},
                    {'$set': {'google_id': user_info['sub']}}
                )
            else:
                logger.info(f"Creating new user from Google OAuth: {user_info['email']}")
                user_doc = {
                    'email': user_info['email'],
                    'google_id': user_info['sub'],
                    'password': None,
                    'country': None,
                    'partner_code': None,
                    'created_at': datetime.now(timezone.utc)
                }
                result = users_collection.insert_one(user_doc)
                user = users_collection.find_one({'_id': result.inserted_id})
        else:
            logger.info(f"Existing Google user signed in: {user['email']}")
        
        session['user_id'] = str(user['_id'])
        logger.info(f"User session created, redirecting to {'admin dashboard' if user.get('is_admin') else 'my accounts page'}")
        return redirect(url_for('admin_dashboard') if user.get('is_admin') else url_for('my_accounts'))
    except Exception as e:
        logger.error(f"Google OAuth Error: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return redirect(url_for('signin'))

@app.route('/api/update-name', methods=['POST'])
def update_name():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'message': 'Not authenticated'})
    
    data = request.json
    new_name = data.get('name', '').strip()
    
    if not new_name:
        return jsonify({'success': False, 'message': 'Name cannot be empty'})
    
    users_collection.update_one(
        {'_id': user['_id']},
        {'$set': {'name': new_name}}
    )
    logger.info(f"User {user['email']} updated name to: {new_name}")
    return jsonify({'success': True})

@app.route('/api/account-setup', methods=['POST'])
def account_setup_api():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'message': 'Not authenticated'})
    
    data = request.json
    account_doc = {
        'user_id': user['_id'],
        'account_type': data['account_type'],
        'currency': data['currency'],
        'nickname': data['nickname'],
        'leverage': data['leverage'],
        'platform': data['platform'],
        'trading_password': data['password'],
        'created_at': datetime.now(timezone.utc)
    }
    accounts_collection.insert_one(account_doc)
    logger.info(f"Account created for user {user['email']}: {data['nickname']}")
    return jsonify({'success': True, 'redirect': '/my-accounts'})

@app.route('/payment/<account_id>')
def payment(account_id):
    user = get_current_user()
    if not user:
        return redirect(url_for('signin'))
    try:
        account = accounts_collection.find_one({'_id': ObjectId(account_id), 'user_id': user['_id']})
        if not account:
            return redirect(url_for('my_accounts'))
        return render_template('payment.html', user=user, account=account)
    except:
        return redirect(url_for('my_accounts'))

@app.route('/api/payment/initiate', methods=['POST'])
def initiate_payment():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'message': 'Not authenticated'})
    
    data = request.json
    try:
        account = accounts_collection.find_one({
            '_id': ObjectId(data['account_id']),
            'user_id': user['_id']
        })
        
        if not account:
            return jsonify({'success': False, 'message': 'Account not found'})
        
        amount = float(data['amount'])
        currency = data['currency']
        min_amount = 1 if currency == 'INR' else 10
        if amount < min_amount:
            return jsonify({'success': False, 'message': f'Minimum deposit is {min_amount} {currency}'})
        
        # Create payment record
        payment_doc = {
            'user_id': user['_id'],
            'account_id': ObjectId(data['account_id']),
            'amount': amount,
            'currency': data['currency'],
            'reference': data.get('reference', ''),
            'status': 'pending',
            'created_at': datetime.now(timezone.utc),
            'qr_scanned': False
        }
        result = payments_collection.insert_one(payment_doc)
        
        logger.info(f"Payment initiated for user {user['email']}: {amount} {data['currency']}")
        return jsonify({'success': True, 'payment_id': str(result.inserted_id)})
    except Exception as e:
        logger.error(f"Payment initiation error: {e}")
        return jsonify({'success': False, 'message': 'Payment processing failed'})

@app.route('/api/payment/status/<payment_id>', methods=['GET'])
def payment_status(payment_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'message': 'Not authenticated'})
    
    try:
        payment = payments_collection.find_one({
            '_id': ObjectId(payment_id),
            'user_id': user['_id']
        })
        
        if not payment:
            return jsonify({'success': False, 'message': 'Payment not found'})
        
        return jsonify({'success': True, 'status': payment['status']})
    except Exception as e:
        logger.error(f"Payment status error: {e}")
        return jsonify({'success': False, 'message': 'Error checking status'})

@app.route('/api/payment/webhook', methods=['POST'])
def payment_webhook():
    """Webhook endpoint for payment gateway to notify payment completion"""
    try:
        data = request.json
        # Verify webhook signature if your payment gateway provides one
        # webhook_secret = os.getenv('PAYMENT_WEBHOOK_SECRET')
        # if not verify_webhook_signature(request, webhook_secret):
        #     return jsonify({'success': False, 'message': 'Invalid signature'}), 401
        
        payment_id = data.get('payment_id')
        transaction_id = data.get('transaction_id')
        status = data.get('status')
        
        if not payment_id:
            return jsonify({'success': False, 'message': 'Missing payment_id'}), 400
        
        payment = payments_collection.find_one({'_id': ObjectId(payment_id)})
        if not payment:
            return jsonify({'success': False, 'message': 'Payment not found'}), 404
        
        if status == 'success':
            # Update payment status
            payments_collection.update_one(
                {'_id': ObjectId(payment_id)},
                {'$set': {
                    'status': 'completed',
                    'qr_scanned': True,
                    'transaction_id': transaction_id,
                    'completed_at': datetime.now(timezone.utc)
                }}
            )
            
            # Create admin notification
            user = users_collection.find_one({'_id': payment['user_id']})
            account = accounts_collection.find_one({'_id': payment['account_id']})
            
            notification_doc = {
                'type': 'payment_received',
                'payment_id': ObjectId(payment_id),
                'user_id': payment['user_id'],
                'user_email': user['email'],
                'account_nickname': account['nickname'],
                'amount': payment['amount'],
                'currency': payment['currency'],
                'status': 'pending_approval',
                'created_at': datetime.now(timezone.utc)
            }
            notifications_collection.insert_one(notification_doc)
            
            logger.info(f"Payment webhook received - Payment completed: {payment_id}")
            return jsonify({'success': True}), 200
        else:
            # Handle failed payment
            payments_collection.update_one(
                {'_id': ObjectId(payment_id)},
                {'$set': {'status': 'failed', 'failed_at': datetime.now(timezone.utc)}}
            )
            logger.warning(f"Payment webhook received - Payment failed: {payment_id}")
            return jsonify({'success': True}), 200
            
    except Exception as e:
        logger.error(f"Payment webhook error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/payment/simulate/<payment_id>', methods=['POST'])
def simulate_payment(payment_id):
    """Simulate QR payment completion - In production, this would be triggered by payment gateway webhook"""
    try:
        payment = payments_collection.find_one({'_id': ObjectId(payment_id)})
        if not payment:
            return jsonify({'success': False, 'message': 'Payment not found'})
        
        # Update payment status
        payments_collection.update_one(
            {'_id': ObjectId(payment_id)},
            {'$set': {'status': 'completed', 'qr_scanned': True, 'completed_at': datetime.now(timezone.utc)}}
        )
        
        # Create admin notification
        user = users_collection.find_one({'_id': payment['user_id']})
        account = accounts_collection.find_one({'_id': payment['account_id']})
        
        notification_doc = {
            'type': 'payment_received',
            'payment_id': ObjectId(payment_id),
            'user_id': payment['user_id'],
            'user_email': user['email'],
            'account_nickname': account['nickname'],
            'amount': payment['amount'],
            'currency': payment['currency'],
            'reference': payment.get('reference', ''),
            'status': 'pending_approval',
            'created_at': datetime.now(timezone.utc)
        }
        notifications_collection.insert_one(notification_doc)
        
        logger.info(f"Payment completed and admin notified: {payment_id}")
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Payment simulation error: {e}")
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/admin/notifications', methods=['GET'])
def get_admin_notifications():
    user = get_current_user()
    if not user or not user.get('is_admin'):
        return jsonify({'success': False, 'message': 'Unauthorized'})
    
    notifications = list(notifications_collection.find({'status': 'pending_approval'}).sort('created_at', -1))
    for notif in notifications:
        notif['_id'] = str(notif['_id'])
        notif['payment_id'] = str(notif['payment_id'])
        notif['user_id'] = str(notif['user_id'])
    
    return jsonify({'success': True, 'notifications': notifications})

@app.route('/api/admin/approve-payment/<payment_id>', methods=['POST'])
def approve_payment(payment_id):
    user = get_current_user()
    if not user or not user.get('is_admin'):
        return jsonify({'success': False, 'message': 'Unauthorized'})
    
    try:
        payment = payments_collection.find_one({'_id': ObjectId(payment_id)})
        if not payment:
            return jsonify({'success': False, 'message': 'Payment not found'})
        
        # Update account balance
        account = accounts_collection.find_one({'_id': payment['account_id']})
        current_balance = account.get('balance', 0.0)
        new_balance = current_balance + payment['amount']
        
        accounts_collection.update_one(
            {'_id': payment['account_id']},
            {'$set': {'balance': new_balance}}
        )
        
        # Update payment status
        payments_collection.update_one(
            {'_id': ObjectId(payment_id)},
            {'$set': {'status': 'approved', 'approved_at': datetime.now(timezone.utc), 'approved_by': user['_id']}}
        )
        
        # Update notification
        notifications_collection.update_one(
            {'payment_id': ObjectId(payment_id)},
            {'$set': {'status': 'approved', 'approved_at': datetime.now(timezone.utc)}}
        )
        

        
        logger.info(f"Admin {user['email']} approved payment {payment_id}")
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Payment approval error: {e}")
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/user/notifications', methods=['GET'])
def get_user_notifications():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'message': 'Not authenticated'})
    
    notifications = list(notifications_collection.find({
        'user_id': user['_id'],
        'type': 'payment_approved'
    }).sort('created_at', -1).limit(10))
    
    for notif in notifications:
        notif['_id'] = str(notif['_id'])
        notif['user_id'] = str(notif['user_id'])
    
    return jsonify({'success': True, 'notifications': notifications})

@app.route('/admin/dashboard')
def admin_dashboard():
    user = get_current_user()
    if not user or not user.get('is_admin'):
        return redirect(url_for('signin'))
    
    all_users = list(users_collection.find({'is_admin': {'$ne': True}}).sort('created_at', -1))
    all_accounts = list(accounts_collection.find().sort('created_at', -1))
    pending_payments = list(notifications_collection.find({'status': 'pending_approval'}).sort('created_at', -1))
    
    user_accounts_map = {}
    for account in all_accounts:
        user_id = str(account['user_id'])
        if user_id not in user_accounts_map:
            user_accounts_map[user_id] = []
        user_accounts_map[user_id].append(account)
    
    return render_template('admin-dashboard.html', user=user, all_users=all_users, user_accounts_map=user_accounts_map, pending_payments=pending_payments)

@app.route('/api/admin/delete-user/<user_id>', methods=['DELETE'])
def delete_user(user_id):
    user = get_current_user()
    if not user or not user.get('is_admin'):
        return jsonify({'success': False, 'message': 'Unauthorized'})
    
    try:
        accounts_collection.delete_many({'user_id': ObjectId(user_id)})
        users_collection.delete_one({'_id': ObjectId(user_id)})
        logger.info(f"Admin {user['email']} deleted user {user_id}")
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Error deleting user: {e}")
        return jsonify({'success': False, 'message': str(e)})

@app.route('/test-payment')
def test_payment():
    """Test page for simulating QR payments"""
    return render_template('test-payment.html')

@app.route('/payment-flow-demo')
def payment_flow_demo():
    """Visual demo of payment flow"""
    return render_template('payment-flow-demo.html')

@app.route('/logout')
def logout():
    if 'user_id' in session:
        try:
            user = users_collection.find_one({'_id': ObjectId(session['user_id'])})
            if user:
                logger.info(f"User logged out: {user['email']}")
        except:
            pass
    session.pop('user_id', None)
    return redirect(url_for('landing_page', status='loggedout'))

if __name__ == '__main__':
    app.run(debug=True)
