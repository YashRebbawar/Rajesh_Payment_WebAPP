from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from authlib.integrations.flask_client import OAuth
import os
import logging
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///printfree.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Google OAuth Config
app.config['GOOGLE_CLIENT_ID'] = os.getenv('GOOGLE_CLIENT_ID', '')
app.config['GOOGLE_CLIENT_SECRET'] = os.getenv('GOOGLE_CLIENT_SECRET', '')

db = SQLAlchemy(app)
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

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200))
    country = db.Column(db.String(50))
    partner_code = db.Column(db.String(50))
    google_id = db.Column(db.String(100), unique=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

with app.app_context():
    db.create_all()

@app.route('/')
def landing_page():
    user = None
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
        logger.info(f"User logged in: {user.email}")
    return render_template('landing.html', user=user)

@app.route('/signin')
def signin():
    return render_template('signin.html')

@app.route('/register')
def register():
    return render_template('register.html')

@app.route('/accounts')
def accounts():
    if 'user_id' not in session:
        return redirect(url_for('signin'))
    return render_template('accounts.html')

@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.json
    
    if User.query.filter_by(email=data['email']).first():
        logger.warning(f"Registration attempt with existing email: {data['email']}")
        return jsonify({'success': False, 'message': 'Email already registered'})
    
    user = User(
        email=data['email'],
        password=generate_password_hash(data['password']),
        country=data.get('country'),
        partner_code=data.get('partner_code')
    )
    db.session.add(user)
    db.session.commit()
    
    session['user_id'] = user.id
    logger.info(f"New user registered: {user.email}")
    return jsonify({'success': True})

@app.route('/api/signin', methods=['POST'])
def api_signin():
    data = request.json
    user = User.query.filter_by(email=data['email']).first()
    
    if user and check_password_hash(user.password, data['password']):
        session['user_id'] = user.id
        logger.info(f"User signed in: {user.email}")
        return jsonify({'success': True})
    
    logger.warning(f"Failed sign in attempt for: {data['email']}")
    return jsonify({'success': False, 'message': 'Invalid credentials'})

@app.route('/auth/google')
def google_login():
    if not google:
        logger.warning("Google OAuth attempt without configuration")
        return jsonify({'error': 'Google OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env file'}), 400
    redirect_uri = url_for('google_callback', _external=True, _scheme='http')
    # Force localhost instead of 127.0.0.1
    redirect_uri = redirect_uri.replace('127.0.0.1', 'localhost')
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
        
        user = User.query.filter_by(google_id=user_info['sub']).first()
        if not user:
            user = User.query.filter_by(email=user_info['email']).first()
            if user:
                logger.info(f"Linking existing user to Google account: {user.email}")
                user.google_id = user_info['sub']
            else:
                logger.info(f"Creating new user from Google OAuth: {user_info['email']}")
                user = User(
                    email=user_info['email'],
                    google_id=user_info['sub']
                )
                db.session.add(user)
            db.session.commit()
        else:
            logger.info(f"Existing Google user signed in: {user.email}")
        
        session['user_id'] = user.id
        logger.info(f"User session created, redirecting to landing page")
        return redirect(url_for('landing_page'))
    except Exception as e:
        logger.error(f"Google OAuth Error: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return redirect(url_for('signin'))

@app.route('/logout')
def logout():
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
        if user:
            logger.info(f"User logged out: {user.email}")
    session.pop('user_id', None)
    return redirect(url_for('landing_page'))

if __name__ == '__main__':
    app.run(debug=True)