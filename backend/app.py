from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from authlib.integrations.flask_client import OAuth
from pymongo import MongoClient
from bson.objectid import ObjectId
from urllib.parse import quote_plus
import os
import logging
import base64
from datetime import datetime, timezone, timedelta

def get_current_utc_time():
    """Helper to get current Indian Standard Time"""
    ist = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist)
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
if not app.config['SECRET_KEY']:
    raise ValueError('SECRET_KEY environment variable is required')
app.config['SESSION_COOKIE_SECURE'] = False
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_TYPE'] = 'filesystem'
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024  # 5MB max file size

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
    
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=10000, tlsAllowInvalidCertificates=True, retryWrites=False)
    logger.info("MongoDB client initialized")
except Exception as e:
    logger.error(f"MongoDB client initialization failed: {e}")
    logger.error("Please check your MONGO_URI in .env file")
    logger.error("Make sure username, password, and cluster address are correct")
    raise Exception(f"Failed to initialize MongoDB client: {e}")

db = client.printfree
users_collection = db.users
accounts_collection = db.trading_accounts
payments_collection = db.payments
notifications_collection = db.notifications
chats_collection = db.chats

# Google OAuth Config
app.config['GOOGLE_CLIENT_ID'] = os.getenv('GOOGLE_CLIENT_ID')
app.config['GOOGLE_CLIENT_SECRET'] = os.getenv('GOOGLE_CLIENT_SECRET')

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

try:
    users_collection.create_index('email', unique=True)
    try:
        users_collection.drop_index('google_id_1')
    except:
        pass
    users_collection.create_index('google_id', sparse=True)
    accounts_collection.create_index('user_id')
    accounts_collection.create_index([('user_id', 1), ('nickname', 1)])
    chats_collection.create_index([('user_id', 1), ('admin_id', 1)])
    chats_collection.create_index('created_at')
    logger.info("Database indexes created successfully")
except Exception as e:
    logger.warning(f"Could not create indexes on startup: {e}. They will be created on first use.")

def get_current_user():
    """Helper function to get current user from session"""
    if 'user_id' in session:
        try:
            return users_collection.find_one({'_id': ObjectId(session['user_id'])})
        except (ValueError, Exception) as e:
            logger.error(f"Error retrieving user from session: {e}")
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
    pending_payments = list(payments_collection.find({'user_id': user['_id'], 'status': 'pending'}).sort('created_at', -1))
    return render_template('my-accounts.html', user=user, accounts=accounts, pending_payments=pending_payments)

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
    
    country_map = {'AF': 'Afghanistan', 'AL': 'Albania', 'DZ': 'Algeria', 'AD': 'Andorra', 'AO': 'Angola', 'AG': 'Antigua and Barbuda', 'AR': 'Argentina', 'AM': 'Armenia', 'AU': 'Australia', 'AT': 'Austria', 'AZ': 'Azerbaijan', 'BS': 'Bahamas', 'BH': 'Bahrain', 'BD': 'Bangladesh', 'BB': 'Barbados', 'BY': 'Belarus', 'BE': 'Belgium', 'BZ': 'Belize', 'BJ': 'Benin', 'BT': 'Bhutan', 'BO': 'Bolivia', 'BA': 'Bosnia and Herzegovina', 'BW': 'Botswana', 'BR': 'Brazil', 'BN': 'Brunei', 'BG': 'Bulgaria', 'BF': 'Burkina Faso', 'BI': 'Burundi', 'KH': 'Cambodia', 'CM': 'Cameroon', 'CA': 'Canada', 'CV': 'Cape Verde', 'CF': 'Central African Republic', 'TD': 'Chad', 'CL': 'Chile', 'CN': 'China', 'CO': 'Colombia', 'KM': 'Comoros', 'CG': 'Congo', 'CR': 'Costa Rica', 'HR': 'Croatia', 'CU': 'Cuba', 'CY': 'Cyprus', 'CZ': 'Czech Republic', 'DK': 'Denmark', 'DJ': 'Djibouti', 'DM': 'Dominica', 'DO': 'Dominican Republic', 'EC': 'Ecuador', 'EG': 'Egypt', 'SV': 'El Salvador', 'GQ': 'Equatorial Guinea', 'ER': 'Eritrea', 'EE': 'Estonia', 'ET': 'Ethiopia', 'FJ': 'Fiji', 'FI': 'Finland', 'FR': 'France', 'GA': 'Gabon', 'GM': 'Gambia', 'GE': 'Georgia', 'DE': 'Germany', 'GH': 'Ghana', 'GR': 'Greece', 'GD': 'Grenada', 'GT': 'Guatemala', 'GN': 'Guinea', 'GW': 'Guinea-Bissau', 'GY': 'Guyana', 'HT': 'Haiti', 'HN': 'Honduras', 'HK': 'Hong Kong', 'HU': 'Hungary', 'IS': 'Iceland', 'IN': 'India', 'ID': 'Indonesia', 'IR': 'Iran', 'IQ': 'Iraq', 'IE': 'Ireland', 'IL': 'Israel', 'IT': 'Italy', 'JM': 'Jamaica', 'JP': 'Japan', 'JO': 'Jordan', 'KZ': 'Kazakhstan', 'KE': 'Kenya', 'KI': 'Kiribati', 'KP': 'North Korea', 'KR': 'South Korea', 'KW': 'Kuwait', 'KG': 'Kyrgyzstan', 'LA': 'Laos', 'LV': 'Latvia', 'LB': 'Lebanon', 'LS': 'Lesotho', 'LR': 'Liberia', 'LY': 'Libya', 'LI': 'Liechtenstein', 'LT': 'Lithuania', 'LU': 'Luxembourg', 'MO': 'Macao', 'MK': 'Macedonia', 'MG': 'Madagascar', 'MW': 'Malawi', 'MY': 'Malaysia', 'MV': 'Maldives', 'ML': 'Mali', 'MT': 'Malta', 'MH': 'Marshall Islands', 'MQ': 'Martinique', 'MR': 'Mauritania', 'MU': 'Mauritius', 'MX': 'Mexico', 'FM': 'Micronesia', 'MD': 'Moldova', 'MC': 'Monaco', 'MN': 'Mongolia', 'ME': 'Montenegro', 'MA': 'Morocco', 'MZ': 'Mozambique', 'MM': 'Myanmar', 'NA': 'Namibia', 'NR': 'Nauru', 'NP': 'Nepal', 'NL': 'Netherlands', 'NZ': 'New Zealand', 'NI': 'Nicaragua', 'NE': 'Niger', 'NG': 'Nigeria', 'NO': 'Norway', 'OM': 'Oman', 'PK': 'Pakistan', 'PW': 'Palau', 'PS': 'Palestine', 'PA': 'Panama', 'PG': 'Papua New Guinea', 'PY': 'Paraguay', 'PE': 'Peru', 'PH': 'Philippines', 'PL': 'Poland', 'PT': 'Portugal', 'QA': 'Qatar', 'RE': 'Reunion', 'RO': 'Romania', 'RU': 'Russia', 'RW': 'Rwanda', 'KN': 'Saint Kitts and Nevis', 'LC': 'Saint Lucia', 'VC': 'Saint Vincent and the Grenadines', 'WS': 'Samoa', 'SM': 'San Marino', 'ST': 'Sao Tome and Principe', 'SA': 'Saudi Arabia', 'SN': 'Senegal', 'RS': 'Serbia', 'SC': 'Seychelles', 'SL': 'Sierra Leone', 'SG': 'Singapore', 'SK': 'Slovakia', 'SI': 'Slovenia', 'SB': 'Solomon Islands', 'SO': 'Somalia', 'ZA': 'South Africa', 'SS': 'South Sudan', 'ES': 'Spain', 'LK': 'Sri Lanka', 'SD': 'Sudan', 'SR': 'Suriname', 'SZ': 'Swaziland', 'SE': 'Sweden', 'CH': 'Switzerland', 'SY': 'Syria', 'TW': 'Taiwan', 'TJ': 'Tajikistan', 'TZ': 'Tanzania', 'TH': 'Thailand', 'TL': 'Timor-Leste', 'TG': 'Togo', 'TO': 'Tonga', 'TT': 'Trinidad and Tobago', 'TN': 'Tunisia', 'TR': 'Turkey', 'TM': 'Turkmenistan', 'TV': 'Tuvalu', 'UG': 'Uganda', 'UA': 'Ukraine', 'AE': 'United Arab Emirates', 'GB': 'United Kingdom', 'US': 'United States', 'UY': 'Uruguay', 'UZ': 'Uzbekistan', 'VU': 'Vanuatu', 'VE': 'Venezuela', 'VN': 'Vietnam', 'YE': 'Yemen', 'ZM': 'Zambia', 'ZW': 'Zimbabwe'}
    
    user_doc = {
        'email': data['email'],
        'password': generate_password_hash(data['password']),
        'country': country_map.get(data.get('country'), data.get('country')),
        'created_at': get_current_utc_time()
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
    render_url = os.getenv('RENDER_URL', 'https://printfree.onrender.com/')
    redirect_uri = f'{render_url}/auth/google/callback'
    logger.info(f"Initiating Google OAuth flow, redirect_uri: {redirect_uri}")
    logger.info(f"Client ID: {app.config['GOOGLE_CLIENT_ID'][:20] if app.config['GOOGLE_CLIENT_ID'] else 'NOT SET'}...")
    logger.info(f"Client Secret: {'SET' if app.config['GOOGLE_CLIENT_SECRET'] else 'NOT SET'}")
    try:
        return google.authorize_redirect(redirect_uri)
    except Exception as e:
        logger.error(f"Google authorize_redirect failed: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return redirect(url_for('signin'))

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
                    'country': None,
                    'created_at': get_current_utc_time()
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

@app.route('/api/account-count', methods=['GET'])
def get_account_count():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'message': 'Not authenticated'})
    
    count = accounts_collection.count_documents({'user_id': user['_id']})
    return jsonify({'success': True, 'count': count, 'limit': 3})

@app.route('/api/account-setup', methods=['POST'])
def account_setup_api():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'message': 'Not authenticated'})
    
    account_count = accounts_collection.count_documents({'user_id': user['_id']})
    if account_count >= 3:
        return jsonify({'success': False, 'message': 'You have reached the maximum limit of 3 accounts. Please delete an existing account to create a new one.'})
    
    data = request.json
    account_doc = {
        'user_id': user['_id'],
        'account_type': data['account_type'],
        'currency': data['currency'],
        'nickname': data['nickname'],
        'leverage': data['leverage'],
        'platform': data['platform'],
        'trading_password': data['password'],
        'created_at': get_current_utc_time()
    }
    result = accounts_collection.insert_one(account_doc)
    
    # Create admin notification for new account
    notification_doc = {
        'type': 'new_account_opened',
        'user_id': user['_id'],
        'user_email': user['email'],
        'user_name': user.get('name', user['email'].split('@')[0]),
        'account_id': result.inserted_id,
        'account_nickname': data['nickname'],
        'account_type': data['account_type'],
        'currency': data['currency'],
        'platform': data['platform'],
        'status': 'unread',
        'created_at': get_current_utc_time()
    }
    notifications_collection.insert_one(notification_doc)
    
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
    except (ValueError, Exception) as e:
        logger.error(f"Payment page error: {e}")
        return redirect(url_for('my_accounts'))

@app.route('/withdrawal/<account_id>')
def withdrawal(account_id):
    user = get_current_user()
    if not user:
        return redirect(url_for('signin'))
    try:
        account = accounts_collection.find_one({'_id': ObjectId(account_id), 'user_id': user['_id']})
        if not account:
            return redirect(url_for('my_accounts'))
        return render_template('withdrawal.html', user=user, account=account)
    except (ValueError, Exception) as e:
        logger.error(f"Withdrawal page error: {e}")
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
        
        # For USD accounts, force currency to INR
        if account['currency'] == 'USD':
            currency = 'INR'
        
        # Create payment record
        payment_doc = {
            'user_id': user['_id'],
            'account_id': ObjectId(data['account_id']),
            'amount': amount,
            'currency': currency,
            'reference': data.get('reference', ''),
            'type': 'deposit',
            'status': 'pending',
            'created_at': get_current_utc_time(),
            'screenshot': None
        }
        result = payments_collection.insert_one(payment_doc)
        
        logger.info(f"Payment initiated for user {user['email']}: {amount} {currency}")
        return jsonify({'success': True, 'payment_id': str(result.inserted_id)})
    except Exception as e:
        logger.error(f"Payment initiation error: {e}")
        return jsonify({'success': False, 'message': 'Payment processing failed'})

@app.route('/api/withdrawal/initiate', methods=['POST'])
def initiate_withdrawal():
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
        balance = account.get('balance', 0.0)
        
        if amount <= 0:
            return jsonify({'success': False, 'message': 'Invalid amount'})
        
        if amount > balance:
            return jsonify({'success': False, 'message': 'Insufficient balance'})
        
        # Create withdrawal record
        withdrawal_doc = {
            'user_id': user['_id'],
            'account_id': ObjectId(data['account_id']),
            'amount': amount,
            'currency': data['currency'],
            'upi_id': data.get('upi_id'),
            'type': 'withdrawal',
            'status': 'pending',
            'created_at': get_current_utc_time()
        }
        result = payments_collection.insert_one(withdrawal_doc)
        
        # Create admin notification
        notification_doc = {
            'type': 'withdrawal_requested',
            'withdrawal_id': result.inserted_id,
            'user_id': user['_id'],
            'user_email': user['email'],
            'account_nickname': account['nickname'],
            'amount': amount,
            'currency': data['currency'],
            'upi_id': data.get('upi_id'),
            'status': 'pending_approval',
            'created_at': get_current_utc_time()
        }
        notifications_collection.insert_one(notification_doc)
        
        logger.info(f"Withdrawal initiated for user {user['email']}: {amount} {data['currency']}")
        return jsonify({'success': True, 'withdrawal_id': str(result.inserted_id)})
    except Exception as e:
        logger.error(f"Withdrawal initiation error: {e}")
        return jsonify({'success': False, 'message': 'Withdrawal processing failed'})

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
            # Keep payment status as 'pending' until admin approves it
            payments_collection.update_one(
                {'_id': ObjectId(payment_id)},
                {'$set': {
                    'transaction_id': transaction_id,
                    'submitted_at': get_current_utc_time()
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
                'created_at': get_current_utc_time()
            }
            notifications_collection.insert_one(notification_doc)
            
            logger.info(f"Payment webhook received - Payment completed: {payment_id}")
            return jsonify({'success': True}), 200
        else:
            # Handle failed payment
            payments_collection.update_one(
                {'_id': ObjectId(payment_id)},
                {'$set': {'status': 'failed', 'failed_at': get_current_utc_time()}}
            )
            logger.warning(f"Payment webhook received - Payment failed: {payment_id}")
            return jsonify({'success': True}), 200
            
    except Exception as e:
        logger.error(f"Payment webhook error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/payment/upload-screenshot/<payment_id>', methods=['POST'])
def upload_screenshot(payment_id):
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
        
        if 'screenshot' not in request.files:
            return jsonify({'success': False, 'message': 'No file uploaded'})
        
        file = request.files['screenshot']
        if file.filename == '':
            return jsonify({'success': False, 'message': 'No file selected'})
        
        # Read and encode file as base64
        file_data = file.read()
        if len(file_data) > 5 * 1024 * 1024:  # 5MB limit
            return jsonify({'success': False, 'message': 'File too large (max 5MB)'})
        
        screenshot_base64 = base64.b64encode(file_data).decode('utf-8')
        
        # Update payment with screenshot
        payments_collection.update_one(
            {'_id': ObjectId(payment_id)},
            {'$set': {'screenshot': screenshot_base64}}
        )
        
        logger.info(f"Screenshot uploaded for payment {payment_id}")
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Screenshot upload error: {e}")
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/payment/simulate/<payment_id>', methods=['POST'])
def simulate_payment(payment_id):
    """Simulate QR payment completion - In production, this would be triggered by payment gateway webhook"""
    try:
        payment = payments_collection.find_one({'_id': ObjectId(payment_id)})
        if not payment:
            return jsonify({'success': False, 'message': 'Payment not found'})
        
        # Keep payment status as 'pending' until admin approves it
        payments_collection.update_one(
            {'_id': ObjectId(payment_id)},
            {'$set': {'submitted_at': get_current_utc_time()}}
        )
        
        # Create admin notification
        user = users_collection.find_one({'_id': payment['user_id']})
        account = accounts_collection.find_one({'_id': payment['account_id']})
        
        notification_doc = {
            'type': 'payment_received',
            'payment_id': ObjectId(payment_id),
            'user_id': payment['user_id'],
            'user_email': user['email'],
            'user_name': user.get('name'),
            'account_nickname': account['nickname'],
            'amount': payment['amount'],
            'currency': payment['currency'],
            'reference': payment.get('reference', ''),
            'screenshot': payment.get('screenshot'),
            'status': 'pending_approval',
            'created_at': get_current_utc_time()
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
        if 'payment_id' in notif:
            notif['payment_id'] = str(notif['payment_id'])
        if 'withdrawal_id' in notif:
            notif['withdrawal_id'] = str(notif['withdrawal_id'])
        notif['user_id'] = str(notif['user_id'])
    
    return jsonify({'success': True, 'notifications': notifications})

@app.route('/api/admin/new-account-notifications', methods=['GET'])
def get_new_account_notifications():
    user = get_current_user()
    if not user or not user.get('is_admin'):
        return jsonify({'success': False, 'message': 'Unauthorized'})
    
    notifications = list(notifications_collection.find({'type': 'new_account_opened', 'status': 'unread'}).sort('created_at', -1))
    for notif in notifications:
        notif['_id'] = str(notif['_id'])
        notif['user_id'] = str(notif['user_id'])
        notif['account_id'] = str(notif['account_id'])
    
    return jsonify({'success': True, 'notifications': notifications})

@app.route('/api/admin/new-user-notifications', methods=['GET'])
def get_new_user_notifications():
    user = get_current_user()
    if not user or not user.get('is_admin'):
        return jsonify({'success': False, 'message': 'Unauthorized'})
    
    # Get users with unread MT credential updates
    notifications = list(notifications_collection.find({
        'type': 'new_account_opened',
        'status': 'unread'
    }).sort('created_at', -1))
    
    # Group by user_id to get unique users with new accounts
    user_ids = set()
    result = []
    for notif in notifications:
        user_id = str(notif['user_id'])
        if user_id not in user_ids:
            user_ids.add(user_id)
            result.append({
                'user_id': user_id,
                'account_id': str(notif['account_id'])
            })
    
    return jsonify({'success': True, 'notifications': result})
@app.route('/api/admin/mark-account-notification-read/<notification_id>', methods=['POST'])
def mark_account_notification_read(notification_id):
    user = get_current_user()
    if not user or not user.get('is_admin'):
        return jsonify({'success': False, 'message': 'Unauthorized'})
    
    try:
        notifications_collection.update_one(
            {'_id': ObjectId(notification_id)},
            {'$set': {'status': 'read', 'read_at': get_current_utc_time()}}
        )
        logger.info(f"Admin {user['email']} marked notification {notification_id} as read")
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Error marking notification as read: {e}")
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/admin/reject-payment/<payment_id>', methods=['POST'])
def reject_payment(payment_id):
    user = get_current_user()
    if not user or not user.get('is_admin'):
        return jsonify({'success': False, 'message': 'Unauthorized'})
    
    try:
        payment = payments_collection.find_one({'_id': ObjectId(payment_id)})
        if not payment:
            return jsonify({'success': False, 'message': 'Payment not found'})
        
        # Update payment status
        payments_collection.update_one(
            {'_id': ObjectId(payment_id)},
            {'$set': {'status': 'rejected', 'rejected_at': get_current_utc_time(), 'rejected_by': user['_id']}}
        )
        
        # Update notification - handle both payment_id and withdrawal_id
        notifications_collection.update_one(
            {'$or': [{'payment_id': ObjectId(payment_id)}, {'withdrawal_id': ObjectId(payment_id)}]},
            {'$set': {'status': 'rejected', 'rejected_at': get_current_utc_time()}}
        )
        
        logger.info(f"Admin {user['email']} rejected payment {payment_id}")
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Payment rejection error: {e}")
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/admin/approve-payment/<payment_id>', methods=['POST'])
def approve_payment(payment_id):
    user = get_current_user()
    if not user or not user.get('is_admin'):
        return jsonify({'success': False, 'message': 'Unauthorized'})
    
    try:
        payment = payments_collection.find_one({'_id': ObjectId(payment_id)})
        if not payment:
            return jsonify({'success': False, 'message': 'Payment not found'})
        
        account = accounts_collection.find_one({'_id': payment['account_id']})
        
        # For USD accounts (deposits in INR), don't auto-update balance
        if account['currency'] != 'USD' or payment.get('type') == 'withdrawal':
            current_balance = account.get('balance', 0.0)
            if payment.get('type') == 'withdrawal':
                new_balance = current_balance - payment['amount']
            else:
                new_balance = current_balance + payment['amount']
            
            accounts_collection.update_one(
                {'_id': payment['account_id']},
                {'$set': {'balance': new_balance}}
            )
        
        # Update payment status to completed when admin approves
        payments_collection.update_one(
            {'_id': ObjectId(payment_id)},
            {'$set': {'status': 'completed', 'approved_at': get_current_utc_time(), 'approved_by': user['_id']}}
        )
        
        # Update notification - handle both payment_id and withdrawal_id
        notifications_collection.update_one(
            {'$or': [{'payment_id': ObjectId(payment_id)}, {'withdrawal_id': ObjectId(payment_id)}]},
            {'$set': {'status': 'approved', 'approved_at': get_current_utc_time()}}
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
    
    notifications = []
    
    # Get MT credential update notifications
    mt_notifications = list(notifications_collection.find({
        'user_id': user['_id'],
        'type': 'mt_credentials_updated'
    }).sort('created_at', -1).limit(10))
    
    for notif in mt_notifications:
        notifications.append({
            '_id': str(notif['_id']),
            'type': 'mt_credentials_updated',
            'account_nickname': notif['account_nickname'],
            'mt_login': notif['mt_login'],
            'mt_server': notif['mt_server'],
            'created_at': notif['created_at'].isoformat()
        })
    
    # Get payment notifications
    user_payments = list(payments_collection.find({
        'user_id': user['_id'],
        'status': {'$in': ['completed', 'rejected']}
    }).sort('created_at', -1).limit(10))
    
    for payment in user_payments:
        account = accounts_collection.find_one({'_id': payment['account_id']})
        payment_type = payment.get('type', 'deposit')
        notifications.append({
            '_id': str(payment['_id']),
            'type': 'account_status',
            'payment_type': payment_type,
            'status': payment['status'],
            'account_nickname': account['nickname'] if account else 'Unknown',
            'amount': payment['amount'],
            'currency': payment['currency'],
            'created_at': payment.get('approved_at' if payment['status'] == 'completed' else 'rejected_at', payment['created_at']).isoformat()
        })
    
    notifications.sort(key=lambda x: x['created_at'], reverse=True)
    return jsonify({'success': True, 'notifications': notifications[:10], 'count': len(notifications[:10])})

@app.route('/admin/dashboard')
def admin_dashboard():
    user = get_current_user()
    if not user or not user.get('is_admin'):
        return redirect(url_for('signin'))
    
    all_users = list(users_collection.find({'is_admin': {'$ne': True}}).sort('created_at', -1))
    all_accounts = list(accounts_collection.find().sort('created_at', -1))
    pending_payments = list(notifications_collection.find({'status': 'pending_approval'}).sort('created_at', -1))
    
    # Enrich pending payments with current user data and account_id
    for payment in pending_payments:
        payment_user = users_collection.find_one({'_id': payment['user_id']})
        if payment_user:
            payment['user_name'] = payment_user.get('name', payment_user['email'].split('@')[0])
            payment['user_email'] = payment_user['email']
        
        # Get account_id from payment record
        if 'payment_id' in payment:
            payment_record = payments_collection.find_one({'_id': payment['payment_id']})
            if payment_record:
                payment['account_id'] = str(payment_record['account_id'])
        elif 'withdrawal_id' in payment:
            payment_record = payments_collection.find_one({'_id': payment['withdrawal_id']})
            if payment_record:
                payment['account_id'] = str(payment_record['account_id'])
    
    user_accounts_map = {}
    for account in all_accounts:
        user_id = str(account['user_id'])
        if user_id not in user_accounts_map:
            user_accounts_map[user_id] = []
        user_accounts_map[user_id].append(account)
    
    return render_template('admin-dashboard.html', user=user, all_users=all_users, user_accounts_map=user_accounts_map, pending_payments=pending_payments)

@app.route('/api/admin/update-account-mt/<account_id>', methods=['POST'])
def update_account_mt(account_id):
    user = get_current_user()
    if not user or not user.get('is_admin'):
        return jsonify({'success': False, 'message': 'Unauthorized'})
    
    try:
        data = request.json
        account = accounts_collection.find_one({'_id': ObjectId(account_id)})
        if not account:
            return jsonify({'success': False, 'message': 'Account not found'})
        
        accounts_collection.update_one(
            {'_id': ObjectId(account_id)},
            {'$set': {
                'mt_login': data.get('mt_login'),
                'mt_server': data.get('mt_server'),
                'mt_updated_at': get_current_utc_time(),
                'mt_updated_by': user['_id']
            }}
        )
        
        # Mark new account notification as read
        notifications_collection.update_one(
            {'type': 'new_account_opened', 'account_id': ObjectId(account_id), 'status': 'unread'},
            {'$set': {'status': 'read', 'read_at': get_current_utc_time()}}
        )
        
        # Create notification for user
        notification_doc = {
            'type': 'mt_credentials_updated',
            'user_id': account['user_id'],
            'account_id': ObjectId(account_id),
            'account_nickname': account['nickname'],
            'mt_login': data.get('mt_login'),
            'mt_server': data.get('mt_server'),
            'status': 'unread',
            'created_at': get_current_utc_time()
        }
        notifications_collection.insert_one(notification_doc)
        
        logger.info(f"Admin {user['email']} updated MT details for account {account_id}")
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Error updating account MT: {e}")
        return jsonify({'success': False, 'message': str(e)})

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
    
# Updated get_user_notifications to include MT credentials

@app.route('/api/withdrawal/status/<withdrawal_id>', methods=['GET'])
def get_withdrawal_status(withdrawal_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'message': 'Not authenticated'})
    
    try:
        withdrawal = payments_collection.find_one({
            '_id': ObjectId(withdrawal_id),
            'user_id': user['_id'],
            'upi_id': {'$exists': True}
        })
        
        if not withdrawal:
            return jsonify({'success': False, 'message': 'Withdrawal not found'})
        
        return jsonify({
            'success': True,
            'status': withdrawal['status'],
            'amount': withdrawal['amount'],
            'currency': withdrawal['currency']
        })
    except Exception as e:
        logger.error(f"Withdrawal status error: {e}")
        return jsonify({'success': False, 'message': 'Error checking status'})


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
        except (ValueError, Exception) as e:
            logger.error(f"Error during logout: {e}")
    session.pop('user_id', None)
    return redirect(url_for('landing_page', status='loggedout'))

@app.route('/api/chat/send', methods=['POST'])
def send_chat_message():
    user = get_current_user()
    if not user or not user.get('is_admin'):
        return jsonify({'success': False, 'message': 'Unauthorized'})
    
    data = request.json
    message = data.get('message', '').strip()
    other_user_id = data.get('user_id')
    
    if not message or not other_user_id:
        return jsonify({'success': False, 'message': 'Invalid message or user'})
    
    try:
        chat_doc = {
            'user_id': ObjectId(other_user_id),
            'admin_id': user['_id'],
            'sender_id': user['_id'],
            'message': message,
            'created_at': get_current_utc_time(),
            'read': False
        }
        result = chats_collection.insert_one(chat_doc)
        logger.info(f"Chat message sent from {user['email']} to user {other_user_id}")
        return jsonify({'success': True, 'message_id': str(result.inserted_id)})
    except Exception as e:
        logger.error(f"Chat send error: {e}")
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/chat/messages/<user_id>', methods=['GET'])
def get_chat_messages(user_id):
    admin = get_current_user()
    if not admin or not admin.get('is_admin'):
        return jsonify({'success': False, 'message': 'Unauthorized'})
    
    try:
        messages = list(chats_collection.find({
            '$or': [
                {'user_id': ObjectId(user_id), 'admin_id': admin['_id']},
                {'user_id': admin['_id'], 'admin_id': ObjectId(user_id)}
            ]
        }).sort('created_at', 1))
        
        chats_collection.update_many(
            {'user_id': ObjectId(user_id), 'admin_id': admin['_id'], 'read': False},
            {'$set': {'read': True}}
        )
        
        for msg in messages:
            msg['_id'] = str(msg['_id'])
            msg['sender_id'] = str(msg['sender_id'])
            msg['user_id'] = str(msg['user_id'])
            msg['admin_id'] = str(msg['admin_id'])
        
        return jsonify({'success': True, 'messages': messages})
    except Exception as e:
        logger.error(f"Get messages error: {e}")
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/chat/user-send', methods=['POST'])
def user_send_chat_message():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'message': 'Not authenticated'})
    
    data = request.json
    message = data.get('message', '').strip()
    
    if not message:
        return jsonify({'success': False, 'message': 'Message cannot be empty'})
    
    try:
        admin = users_collection.find_one({'is_admin': True})
        if not admin:
            return jsonify({'success': False, 'message': 'No admin available'})
        
        chat_doc = {
            'user_id': user['_id'],
            'admin_id': admin['_id'],
            'sender_id': user['_id'],
            'message': message,
            'created_at': get_current_utc_time(),
            'read': False
        }
        result = chats_collection.insert_one(chat_doc)
        logger.info(f"Chat message sent from user {user['email']} to admin")
        return jsonify({'success': True, 'message_id': str(result.inserted_id)})
    except Exception as e:
        logger.error(f"User chat send error: {e}")
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/chat/user-messages', methods=['GET'])
def get_user_chat_messages():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'message': 'Not authenticated'})
    
    try:
        admin = users_collection.find_one({'is_admin': True})
        if not admin:
            return jsonify({'success': True, 'messages': []})
        
        messages = list(chats_collection.find({
            '$or': [
                {'user_id': user['_id'], 'admin_id': admin['_id']},
                {'user_id': admin['_id'], 'admin_id': user['_id']}
            ]
        }).sort('created_at', 1))
        
        chats_collection.update_many(
            {'sender_id': admin['_id'], 'user_id': user['_id'], 'read': False},
            {'$set': {'read': True}}
        )
        
        for msg in messages:
            msg['_id'] = str(msg['_id'])
            msg['sender_id'] = str(msg['sender_id'])
            msg['user_id'] = str(msg['user_id'])
            msg['admin_id'] = str(msg['admin_id'])
        
        return jsonify({'success': True, 'messages': messages})
    except Exception as e:
        logger.error(f"Get user messages error: {e}")
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/chat/admin-users', methods=['GET'])
def get_admin_chat_users():
    admin = get_current_user()
    if not admin or not admin.get('is_admin'):
        return jsonify({'success': False, 'message': 'Unauthorized'})
    
    try:
        chat_users = chats_collection.aggregate([
            {'$match': {'admin_id': admin['_id']}},
            {'$group': {'_id': '$user_id', 'last_message_time': {'$max': '$created_at'}, 'unread_count': {'$sum': {'$cond': [{'$eq': ['$read', False]}, 1, 0]}}}},
            {'$sort': {'last_message_time': -1}}
        ])
        
        users_list = []
        for chat_user in chat_users:
            user = users_collection.find_one({'_id': chat_user['_id']})
            if user:
                users_list.append({
                    'user_id': str(user['_id']),
                    'email': user['email'],
                    'name': user.get('name', user['email'].split('@')[0]),
                    'unread_count': chat_user['unread_count']
                })
        
        return jsonify({'success': True, 'users': users_list})
    except Exception as e:
        logger.error(f"Get admin chat users error: {e}")
        return jsonify({'success': False, 'message': str(e)})


@app.route('/api/chat/unread-count', methods=['GET'])
def get_unread_count():
    admin = get_current_user()
    if not admin or not admin.get('is_admin'):
        return jsonify({'success': False, 'message': 'Unauthorized'})
    
    try:
        unread_users = chats_collection.aggregate([
            {'$match': {'admin_id': admin['_id'], 'read': False}},
            {'$group': {'_id': '$user_id'}}
        ])
        
        unread_user_ids = [str(doc['_id']) for doc in unread_users]
        return jsonify({'success': True, 'unread_users': unread_user_ids})
    except Exception as e:
        logger.error(f"Get unread count error: {e}")
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/admin/latest-new-account', methods=['GET'])
def get_latest_new_account():
    user = get_current_user()
    if not user or not user.get('is_admin'):
        return jsonify({'success': False, 'message': 'Unauthorized'})
    
    try:
        notification = notifications_collection.find_one(
            {'type': 'new_account_opened', 'status': 'unread'},
            sort=[('created_at', -1)]
        )
        
        if not notification:
            return jsonify({'success': False, 'message': 'No new accounts found'})
        
        account = accounts_collection.find_one({'_id': notification['account_id']})
        if not account:
            return jsonify({'success': False, 'message': 'Account not found'})
        
        return jsonify({
            'success': True,
            'account': {
                '_id': str(account['_id']),
                'nickname': account['nickname'],
                'platform': account['platform'],
                'account_type': account['account_type'],
                'currency': account['currency'],
                'created_at': account['created_at'].isoformat()
            }
        })
    except Exception as e:
        logger.error(f"Error getting latest new account: {e}")
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/admin/update-account-balance/<account_id>', methods=['POST'])
def update_account_balance(account_id):
    user = get_current_user()
    if not user or not user.get('is_admin'):
        return jsonify({'success': False, 'message': 'Unauthorized'})
    
    try:
        data = request.json
        account = accounts_collection.find_one({'_id': ObjectId(account_id)})
        if not account:
            return jsonify({'success': False, 'message': 'Account not found'})
        
        new_balance = float(data.get('balance', 0))
        accounts_collection.update_one(
            {'_id': ObjectId(account_id)},
            {'$set': {'balance': new_balance}}
        )
        
        logger.info(f"Admin {user['email']} updated balance for account {account_id} to {new_balance}")
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Error updating account balance: {e}")
        return jsonify({'success': False, 'message': str(e)})
    
@app.route('/api/admin/update-account-details/<account_id>', methods=['POST'])
def update_account_details(account_id):
    user = get_current_user()
    if not user or not user.get('is_admin'):
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    try:
        try:
            obj_id = ObjectId(account_id)
        except Exception as e:
            logger.error(f"Invalid account_id format: {account_id} - {e}")
            return jsonify({'success': False, 'message': 'Invalid account ID format'}), 400
        
        data = request.json
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        account = accounts_collection.find_one({'_id': obj_id})
        if not account:
            logger.warning(f"Account not found: {account_id}")
            return jsonify({'success': False, 'message': 'Account not found'}), 404
        
        update_data = {}
        if 'password' in data:
            update_data['trading_password'] = data['password']
        if 'leverage' in data:
            update_data['leverage'] = data['leverage']
        
        if update_data:
            result = accounts_collection.update_one(
                {'_id': obj_id},
                {'$set': update_data}
            )
            logger.info(f"Admin {user['email']} updated account {account_id} details. Modified: {result.modified_count}")
        else:
            logger.warning(f"No update data provided for account {account_id}")
        
        return jsonify({'success': True}), 200
    except Exception as e:
        logger.error(f"Error updating account details: {e}", exc_info=True)
        return jsonify({'success': False, 'message': str(e)}), 500
    
@app.route('/health')
def health_check():
    """Health check endpoint for Render"""
    return jsonify({'status': 'ok'}), 200

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)



