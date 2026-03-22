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
import re
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
    
    client = MongoClient(
        MONGO_URI,
        serverSelectionTimeoutMS=30000,
        connectTimeoutMS=30000,
        socketTimeoutMS=30000,
        maxPoolSize=10,
        minPoolSize=2,
        maxIdleTimeMS=45000,
        retryWrites=False,
        tlsAllowInvalidCertificates=True,
        retryReads=True
    )
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
testimonials_collection = db.testimonials

PASSWORD_SPECIAL_RE = r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]"

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
    try:
        chats_collection.drop_index('created_at_1')
    except:
        pass
    chats_collection.create_index('created_at', expireAfterSeconds=172800)
    try:
        notifications_collection.drop_index('created_at_1')
    except:
        pass
    notifications_collection.create_index('created_at', expireAfterSeconds=172800)
    testimonials_collection.create_index('user_id', unique=True)
    testimonials_collection.create_index([('is_active', 1), ('created_at', -1)])
    logger.info("Database indexes created successfully")
except Exception as e:
    logger.warning(f"Could not create indexes on startup: {e}. They will be created on first use.")

DEFAULT_TESTIMONIALS = [
    {
        'name': 'Ahmed Al-Mansouri',
        'city': 'Dubai',
        'rating': 5,
        'comment': "Finally, an MT5 provider without account freeze issues. I've been trading freely for over 2 years now - absolutely game-changing."
    },
    {
        'name': 'Priya Sharma',
        'city': 'Mumbai',
        'rating': 5,
        'comment': "Hassle-free setup, instant funding, and a professional MT5 platform. PrintFree is the best trading partner I've found. Highly recommended!"
    },
    {
        'name': 'Mohammed Hassan',
        'city': 'Cairo',
        'rating': 5,
        'comment': 'Best Dubai-based MT5 provider bar none. Reliable infrastructure, secure withdrawals, and excellent support team around the clock.'
    }
]

ANALYTICS_SPEC_SECTIONS = [
    {
        'id': 'kpis',
        'eyebrow': 'Top Row',
        'title': 'Core KPI Cards',
        'description': 'High-signal counters for the first fold of the analytics board.',
        'widgets': [
            {
                'type': 'card',
                'title': 'Total Users',
                'metric': 'Count of all non-admin users',
                'why': 'Shows total customer base size.',
                'query': """db.users.aggregate([
  { $match: { is_admin: { $ne: true } } },
  { $count: "total_users" }
])"""
            },
            {
                'type': 'card',
                'title': 'New Users This Month',
                'metric': 'Non-admin users created in the active month',
                'why': 'Measures acquisition momentum.',
                'query': """db.users.aggregate([
  {
    $match: {
      is_admin: { $ne: true },
      created_at: { $gte: monthStart, $lt: monthEnd }
    }
  },
  { $count: "new_users_this_month" }
])"""
            },
            {
                'type': 'card',
                'title': 'Total Trading Accounts',
                'metric': 'Count of all account records',
                'why': 'Shows total account inventory under management.',
                'query': """db.trading_accounts.aggregate([
  { $count: "total_accounts" }
])"""
            },
            {
                'type': 'card',
                'title': 'Pending Approvals',
                'metric': 'Pending deposits and withdrawals combined',
                'why': 'Highlights immediate operational workload.',
                'query': """db.notifications.aggregate([
  { $match: { status: "pending_approval" } },
  { $count: "pending_approvals" }
])"""
            },
            {
                'type': 'card',
                'title': 'Platform Fee Earned',
                'metric': 'Sum of completed deposit fee_amount',
                'why': 'Tracks realized revenue.',
                'query': """db.payments.aggregate([
  {
    $match: {
      type: "deposit",
      status: "completed"
    }
  },
  {
    $group: {
      _id: null,
      platform_fee_earned: { $sum: "$fee_amount" }
    }
  }
])"""
            },
            {
                'type': 'card',
                'title': 'Unread Support Threads',
                'metric': 'Unique user threads with unread admin messages',
                'why': 'Shows support backlog without inflating counts per message.',
                'query': """db.chats.aggregate([
  { $match: { read: false } },
  { $group: { _id: "$user_id" } },
  { $count: "unread_support_threads" }
])"""
            }
        ]
    },
    {
        'id': 'user-charts',
        'eyebrow': 'Acquisition',
        'title': 'User Analytics',
        'description': 'User growth, geography, signup source, and onboarding completion.',
        'widgets': [
            {
                'type': 'chart',
                'title': 'User Growth by Day',
                'chart_title': 'Daily User Signups',
                'metric': 'Daily non-admin user registrations',
                'why': 'Core acquisition trend chart.',
                'query': """db.users.aggregate([
  {
    $match: {
      is_admin: { $ne: true },
      created_at: { $gte: rangeStart, $lt: rangeEnd }
    }
  },
  {
    $group: {
      _id: {
        $dateToString: { format: "%Y-%m-%d", date: "$created_at" }
      },
      users: { $sum: 1 }
    }
  },
  { $sort: { _id: 1 } }
])"""
            },
            {
                'type': 'chart',
                'title': 'Users by Country',
                'chart_title': 'Country Distribution of Registered Users',
                'metric': 'User counts grouped by country',
                'why': 'Shows strongest markets for targeting and support coverage.',
                'query': """db.users.aggregate([
  {
    $match: {
      is_admin: { $ne: true },
      country: { $nin: [null, ""] }
    }
  },
  { $group: { _id: "$country", users: { $sum: 1 } } },
  { $sort: { users: -1 } },
  { $limit: 10 }
])"""
            },
            {
                'type': 'card',
                'title': 'Email vs Google Signup Split',
                'metric': 'Registration source mix',
                'why': 'Shows whether OAuth setup is driving adoption.',
                'query': """db.users.aggregate([
  { $match: { is_admin: { $ne: true } } },
  {
    $group: {
      _id: {
        $cond: [
          { $ifNull: ["$google_id", false] },
          "google_oauth",
          "email_password"
        ]
      },
      users: { $sum: 1 }
    }
  },
  { $sort: { users: -1 } }
])"""
            },
            {
                'type': 'table',
                'title': 'Users With No Account Yet',
                'chart_title': 'Signup Without Account Creation',
                'metric': 'Users who registered but never opened an account',
                'why': 'Best conversion recovery list for sales/admin follow-up.',
                'query': """db.users.aggregate([
  { $match: { is_admin: { $ne: true } } },
  {
    $lookup: {
      from: "trading_accounts",
      localField: "_id",
      foreignField: "user_id",
      as: "accounts"
    }
  },
  { $match: { "accounts.0": { $exists: false } } },
  {
    $project: {
      email: 1,
      name: 1,
      country: 1,
      created_at: 1
    }
  },
  { $sort: { created_at: -1 } }
])"""
            }
        ]
    },
    {
        'id': 'account-ops',
        'eyebrow': 'Provisioning',
        'title': 'Account Analytics',
        'description': 'Tracks account mix, MT readiness, and balance oversight.',
        'widgets': [
            {
                'type': 'chart',
                'title': 'Accounts by Type',
                'chart_title': 'Account Mix by Product Type',
                'metric': 'Count grouped by standard / pro / raw-spread / zero',
                'why': 'Shows product demand.',
                'query': """db.trading_accounts.aggregate([
  { $group: { _id: "$account_type", accounts: { $sum: 1 } } },
  { $sort: { accounts: -1 } }
])"""
            },
            {
                'type': 'chart',
                'title': 'Accounts by Platform and Currency',
                'chart_title': 'Platform-Currency Mix',
                'metric': 'Count by platform and currency',
                'why': 'Helps operational planning for platform and payment rails.',
                'query': """db.trading_accounts.aggregate([
  {
    $group: {
      _id: {
        platform: "$platform",
        currency: "$currency"
      },
      accounts: { $sum: 1 }
    }
  },
  { $sort: { accounts: -1 } }
])"""
            },
            {
                'type': 'card',
                'title': 'Accounts Missing MT Credentials',
                'metric': 'Accounts where mt_login or mt_server is missing',
                'why': 'Directly maps to setup backlog.',
                'query': """db.trading_accounts.aggregate([
  {
    $match: {
      $or: [
        { mt_login: { $in: [null, ""] } },
        { mt_server: { $in: [null, ""] } }
      ]
    }
  },
  { $count: "accounts_missing_mt_credentials" }
])"""
            },
            {
                'type': 'table',
                'title': 'Awaiting MT Setup Queue',
                'chart_title': 'Open MT Provisioning Queue',
                'metric': 'Newest accounts that still need MT credentials',
                'why': 'Operational action list for admins.',
                'query': """db.trading_accounts.aggregate([
  {
    $match: {
      $or: [
        { mt_login: { $in: [null, ""] } },
        { mt_server: { $in: [null, ""] } }
      ]
    }
  },
  {
    $lookup: {
      from: "users",
      localField: "user_id",
      foreignField: "_id",
      as: "user"
    }
  },
  { $unwind: "$user" },
  {
    $project: {
      nickname: 1,
      account_type: 1,
      platform: 1,
      created_at: 1,
      user_email: "$user.email"
    }
  },
  { $sort: { created_at: -1 } }
])"""
            },
            {
                'type': 'card',
                'title': 'Average Account Balance',
                'metric': 'Average balance across accounts with a balance field',
                'why': 'Quick health check on funded account base.',
                'query': """db.trading_accounts.aggregate([
  { $match: { balance: { $type: "number" } } },
  {
    $group: {
      _id: null,
      average_balance: { $avg: "$balance" },
      total_balance: { $sum: "$balance" }
    }
  }
])"""
            }
        ]
    },
    {
        'id': 'payments',
        'eyebrow': 'Money In',
        'title': 'Deposit Analytics',
        'description': 'Revenue, method split, throughput, and approval efficiency for deposits.',
        'widgets': [
            {
                'type': 'chart',
                'title': 'Deposit Volume by Day',
                'chart_title': 'Completed Deposit Volume Trend',
                'metric': 'Daily completed deposit amount',
                'why': 'Shows business flow and seasonality.',
                'query': """db.payments.aggregate([
  {
    $match: {
      type: "deposit",
      status: "completed",
      approved_at: { $gte: rangeStart, $lt: rangeEnd }
    }
  },
  {
    $group: {
      _id: {
        $dateToString: { format: "%Y-%m-%d", date: "$approved_at" }
      },
      amount: { $sum: "$amount" },
      fee: { $sum: "$fee_amount" },
      count: { $sum: 1 }
    }
  },
  { $sort: { _id: 1 } }
])"""
            },
            {
                'type': 'chart',
                'title': 'Deposits by Payment Method',
                'chart_title': 'Deposit Mix by Payment Rail',
                'metric': 'Count and amount by upi / imps / usdt',
                'why': 'Shows which rails carry volume and fee yield.',
                'query': """db.payments.aggregate([
  {
    $match: {
      type: "deposit",
      status: "completed"
    }
  },
  {
    $group: {
      _id: "$payment_method",
      amount: { $sum: "$amount" },
      fee: { $sum: "$fee_amount" },
      count: { $sum: 1 }
    }
  },
  { $sort: { amount: -1 } }
])"""
            },
            {
                'type': 'card',
                'title': 'Average Deposit Amount',
                'metric': 'Average completed deposit ticket size',
                'why': 'Useful for pricing, support load, and fraud review.',
                'query': """db.payments.aggregate([
  {
    $match: {
      type: "deposit",
      status: "completed"
    }
  },
  {
    $group: {
      _id: null,
      avg_amount: { $avg: "$amount" },
      max_amount: { $max: "$amount" },
      min_amount: { $min: "$amount" }
    }
  }
])"""
            },
            {
                'type': 'card',
                'title': 'Pending Deposit Value',
                'metric': 'Total amount and fees tied up in pending deposits',
                'why': 'Shows near-term approval impact.',
                'query': """db.payments.aggregate([
  {
    $match: {
      type: "deposit",
      status: "pending"
    }
  },
  {
    $group: {
      _id: null,
      pending_amount: { $sum: "$amount" },
      pending_fee: { $sum: "$fee_amount" },
      pending_count: { $sum: 1 }
    }
  }
])"""
            },
            {
                'type': 'card',
                'title': 'Average Deposit Approval Time',
                'metric': 'Average minutes from submitted_at or created_at to approved_at',
                'why': 'Measures ops speed and customer experience.',
                'query': """db.payments.aggregate([
  {
    $match: {
      type: "deposit",
      status: "completed",
      approved_at: { $exists: true }
    }
  },
  {
    $project: {
      duration_minutes: {
        $divide: [
          {
            $subtract: [
              "$approved_at",
              { $ifNull: ["$submitted_at", "$created_at"] }
            ]
          },
          1000 * 60
        ]
      }
    }
  },
  {
    $group: {
      _id: null,
      avg_minutes: { $avg: "$duration_minutes" }
    }
  }
])"""
            }
        ]
    },
    {
        'id': 'withdrawals',
        'eyebrow': 'Money Out',
        'title': 'Withdrawal Analytics',
        'description': 'Tracks completed, pending, rejected, and method-level withdrawal activity.',
        'widgets': [
            {
                'type': 'chart',
                'title': 'Withdrawal Volume by Day',
                'chart_title': 'Completed Withdrawal Trend',
                'metric': 'Daily completed withdrawal amount',
                'why': 'Shows capital outflow and customer payout behavior.',
                'query': """db.payments.aggregate([
  {
    $match: {
      type: "withdrawal",
      status: "completed",
      approved_at: { $gte: rangeStart, $lt: rangeEnd }
    }
  },
  {
    $group: {
      _id: {
        $dateToString: { format: "%Y-%m-%d", date: "$approved_at" }
      },
      amount: { $sum: "$amount" },
      count: { $sum: 1 }
    }
  },
  { $sort: { _id: 1 } }
])"""
            },
            {
                'type': 'chart',
                'title': 'Withdrawal Method Split',
                'chart_title': 'Withdrawals by UPI vs Bank Transfer',
                'metric': 'Amount and count by payout method',
                'why': 'Useful for payout operations planning.',
                'query': """db.payments.aggregate([
  {
    $match: {
      type: "withdrawal",
      status: "completed"
    }
  },
  {
    $group: {
      _id: "$payment_method",
      amount: { $sum: "$amount" },
      count: { $sum: 1 }
    }
  },
  { $sort: { amount: -1 } }
])"""
            },
            {
                'type': 'card',
                'title': 'Pending Withdrawal Queue',
                'metric': 'Pending withdrawal count and amount',
                'why': 'Shows payout backlog.',
                'query': """db.payments.aggregate([
  {
    $match: {
      type: "withdrawal",
      status: "pending"
    }
  },
  {
    $group: {
      _id: null,
      pending_amount: { $sum: "$amount" },
      pending_count: { $sum: 1 }
    }
  }
])"""
            },
            {
                'type': 'card',
                'title': 'Rejected Withdrawals',
                'metric': 'Rejected payout count and amount',
                'why': 'Surfaces friction and policy issues.',
                'query': """db.payments.aggregate([
  {
    $match: {
      type: "withdrawal",
      status: "rejected"
    }
  },
  {
    $group: {
      _id: null,
      rejected_amount: { $sum: "$amount" },
      rejected_count: { $sum: 1 }
    }
  }
])"""
            }
        ]
    },
    {
        'id': 'ops-support',
        'eyebrow': 'Service Desk',
        'title': 'Operations and Support',
        'description': 'Combines admin queue health, support backlog, and user experience signals.',
        'widgets': [
            {
                'type': 'table',
                'title': 'Oldest Pending Approval',
                'chart_title': 'Aging Pending Approvals',
                'metric': 'Oldest unresolved pending_approval notifications',
                'why': 'Makes SLA breaches visible immediately.',
                'query': """db.notifications.aggregate([
  { $match: { status: "pending_approval" } },
  {
    $project: {
      type: 1,
      user_email: 1,
      account_nickname: 1,
      created_at: 1,
      age_minutes: {
        $divide: [
          { $subtract: [now, "$created_at"] },
          1000 * 60
        ]
      }
    }
  },
  { $sort: { created_at: 1 } },
  { $limit: 20 }
])"""
            },
            {
                'type': 'table',
                'title': 'Users With Unread Chats',
                'chart_title': 'Unread Support Threads',
                'metric': 'Users grouped with unread_count',
                'why': 'Lets admins prioritize support responses.',
                'query': """db.chats.aggregate([
  { $match: { read: false } },
  {
    $group: {
      _id: "$user_id",
      unread_count: { $sum: 1 },
      last_message_at: { $max: "$created_at" }
    }
  },
  {
    $lookup: {
      from: "users",
      localField: "_id",
      foreignField: "_id",
      as: "user"
    }
  },
  { $unwind: "$user" },
  {
    $project: {
      unread_count: 1,
      last_message_at: 1,
      user_email: "$user.email",
      user_name: "$user.name"
    }
  },
  { $sort: { unread_count: -1, last_message_at: -1 } }
])"""
            },
            {
                'type': 'card',
                'title': 'Testimonials Submitted',
                'metric': 'Users who completed the testimonial flow',
                'why': 'Soft trust/engagement signal.',
                'query': """db.users.aggregate([
  {
    $match: {
      is_admin: { $ne: true },
      testimonial_submitted: true
    }
  },
  { $count: "testimonial_submitters" }
])"""
            },
            {
                'type': 'chart',
                'title': 'Average Testimonial Rating',
                'chart_title': 'Customer Rating Distribution',
                'metric': 'Average rating and rating buckets from active testimonials',
                'why': 'Qualitative sentiment in a quantitative format.',
                'query': """db.testimonials.aggregate([
  { $match: { is_active: true } },
  {
    $group: {
      _id: "$rating",
      testimonials: { $sum: 1 },
      avg_rating: { $avg: "$rating" }
    }
  },
  { $sort: { _id: 1 } }
])"""
            }
        ]
    }
]

def get_current_user():
    """Helper function to get current user from session"""
    if 'user_id' in session:
        try:
            return users_collection.find_one({'_id': ObjectId(session['user_id'])})
        except (ValueError, Exception) as e:
            logger.error(f"Error retrieving user from session: {e}")
            session.pop('user_id', None)
    return None

def check_db_connection():
    """Check if database connection is alive"""
    try:
        client.admin.command('ping')
        return True
    except Exception as e:
        logger.warning(f"Database connection check failed: {e}")
        return False

def should_prompt_for_testimonial(user):
    return bool(user and not user.get('is_admin') and not user.get('testimonial_submitted'))

def get_active_testimonials(limit=6):
    raw_testimonials = list(
        testimonials_collection.find({'is_active': True})
        .sort([('display_order', 1), ('created_at', -1)])
        .limit(limit)
    )
    if not raw_testimonials:
        return DEFAULT_TESTIMONIALS[:limit]

    testimonials = []
    for testimonial in raw_testimonials:
        testimonials.append({
            'name': testimonial.get('name', 'PrintFree Trader'),
            'city': testimonial.get('city', 'Global'),
            'rating': int(testimonial.get('rating', 5)),
            'comment': testimonial.get('comment', '')
        })
    return testimonials

@app.context_processor
def inject_global_template_flags():
    show_testimonial_prompt = bool(session.get('show_testimonial_prompt'))
    if show_testimonial_prompt:
        session['show_testimonial_prompt'] = False
    return {
        'show_testimonial_prompt': show_testimonial_prompt,
    }

def get_admin_analytics_spec():
    return ANALYTICS_SPEC_SECTIONS

def build_daily_series(raw_rows, start_dt, days, value_keys):
    series_map = {row['_id']: row for row in raw_rows}
    labels = []
    series = {key: [] for key in value_keys}

    for offset in range(days):
        current_day = start_dt + timedelta(days=offset)
        date_key = current_day.strftime('%Y-%m-%d')
        labels.append(current_day.strftime('%d %b'))
        row = series_map.get(date_key, {})
        for key in value_keys:
            series[key].append(round(float(row.get(key, 0) or 0), 2))

    return {'labels': labels, 'series': series}

def normalize_grouped_rows(rows, label_builder=None, value_keys=None):
    items = []
    for row in rows:
        raw_label = row.get('_id')
        label = label_builder(raw_label) if label_builder else raw_label
        item = {'label': label or 'Unknown'}
        for key in value_keys or []:
            item[key] = round(float(row.get(key, 0) or 0), 2)
        items.append(item)
    return items

def get_window_config(window, now):
    normalized = (window or 'daily').lower()
    if normalized == 'monthly':
        current_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        year = current_month_start.year
        month = current_month_start.month - 11
        while month <= 0:
            month += 12
            year -= 1
        return {
            'key': 'monthly',
            'label': 'Last 12 months',
            'bucket_count': 12,
            'range_start': current_month_start.replace(year=year, month=month),
            'bucket_key': lambda dt: (dt.year, dt.month),
            'bucket_label': lambda key: datetime(key[0], key[1], 1).strftime('%b %Y')
        }
    if normalized == 'weekly':
        current_week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        range_start = current_week_start - timedelta(weeks=11)
        return {
            'key': 'weekly',
            'label': 'Last 12 weeks',
            'bucket_count': 12,
            'range_start': range_start,
            'bucket_key': lambda dt: ((dt - timedelta(days=dt.weekday())).year, (dt - timedelta(days=dt.weekday())).month, (dt - timedelta(days=dt.weekday())).day),
            'bucket_label': lambda key: datetime(key[0], key[1], key[2]).strftime('%d %b')
        }
    range_start = (now - timedelta(days=13)).replace(hour=0, minute=0, second=0, microsecond=0)
    return {
        'key': 'daily',
        'label': 'Last 14 days',
        'bucket_count': 14,
        'range_start': range_start,
        'bucket_key': lambda dt: (dt.year, dt.month, dt.day),
        'bucket_label': lambda key: datetime(key[0], key[1], key[2]).strftime('%d %b')
    }

def build_windowed_series(rows, window_config, date_field, value_fields):
    buckets = []
    counts = window_config['bucket_count']
    start = window_config['range_start']
    key_fn = window_config['bucket_key']
    label_fn = window_config['bucket_label']

    if window_config['key'] == 'monthly':
        cursor = start
        for _ in range(counts):
            buckets.append(key_fn(cursor))
            if cursor.month == 12:
                cursor = cursor.replace(year=cursor.year + 1, month=1)
            else:
                cursor = cursor.replace(month=cursor.month + 1)
    elif window_config['key'] == 'weekly':
        cursor = start
        for _ in range(counts):
            buckets.append(key_fn(cursor))
            cursor = cursor + timedelta(weeks=1)
    else:
        cursor = start
        for _ in range(counts):
            buckets.append(key_fn(cursor))
            cursor = cursor + timedelta(days=1)

    aggregated = {bucket: {field: 0 for field in value_fields} for bucket in buckets}
    for row in rows:
        dt = row.get(date_field)
        if not dt:
            continue
        bucket = key_fn(dt)
        if bucket not in aggregated:
            continue
        for field in value_fields:
            aggregated[bucket][field] += float(row.get(field, 0) or 0)

    return {
        'labels': [label_fn(bucket) for bucket in buckets],
        'series': {
            field: [round(aggregated[bucket][field], 2) for bucket in buckets]
            for field in value_fields
        }
    }

def ensure_ist_datetime(value):
    if not value:
        return None
    ist = timezone(timedelta(hours=5, minutes=30))
    if value.tzinfo is None:
        return value.replace(tzinfo=ist)
    return value.astimezone(ist)

def calculate_platform_fee(payment):
    if payment is None:
        return 0.0

    if payment.get('fee_amount') is not None:
        try:
            return round(float(payment.get('fee_amount') or 0), 2)
        except (TypeError, ValueError):
            pass

    payment_method = str(payment.get('payment_method') or '').lower()
    currency = str(payment.get('currency') or '').upper()
    fee_rate = 0.019 if payment_method == 'usdt' or currency == 'USDT' else 0.014

    try:
        amount = float(payment.get('amount') or 0)
    except (TypeError, ValueError):
        amount = 0

    return round(amount * fee_rate, 2)

@app.after_request
def add_cache_control(response):
    """Add cache control headers to prevent caching of authentication pages"""
    if request.endpoint in ['signin', 'register', 'my_accounts', 'admin_dashboard']:
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, private, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    return response

def validate_password_policy(password):
    """Validate password against shared policy and return (is_valid, message)."""
    if password is None:
        return False, 'Password is required'

    if not isinstance(password, str):
        return False, 'Password must be a string'

    if len(password) < 8 or len(password) > 15:
        return False, 'Password must be between 8 and 15 characters'

    has_lower = any(c.islower() for c in password)
    has_upper = any(c.isupper() for c in password)
    has_digit = any(c.isdigit() for c in password)

    has_special = re.search(PASSWORD_SPECIAL_RE, password) is not None

    if not (has_lower and has_upper):
        return False, 'Password must include at least one uppercase and one lowercase letter'
    if not has_digit:
        return False, 'Password must include at least one number'
    if not has_special:
        return False, 'Password must include at least one special character'

    return True, None

@app.route('/')
def landing_page():
    user = get_current_user()
    if user:
        logger.info(f"User logged in: {user['email']}")
    testimonials = get_active_testimonials()
    return render_template('landing.html', user=user, testimonials=testimonials)

@app.route('/signin')
def signin():
    user = get_current_user()
    if user:
        return redirect(url_for('admin_dashboard') if user.get('is_admin') else url_for('my_accounts'))
    response = render_template('signin.html', user=user)
    return response

@app.route('/register')
def register():
    user = get_current_user()
    if user:
        return redirect(url_for('admin_dashboard') if user.get('is_admin') else url_for('my_accounts'))
    response = render_template('register.html', user=user)
    return response

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

    is_valid_password, password_error = validate_password_policy(data.get('password'))
    if not is_valid_password:
        return jsonify({'success': False, 'message': password_error}), 400
    
    if users_collection.find_one({'email': data['email']}):
        logger.warning(f"Registration attempt with existing email: {data['email']}")
        return jsonify({'success': False, 'message': 'Email already registered'})
    
    country_map = {'AF': 'Afghanistan', 'AL': 'Albania', 'DZ': 'Algeria', 'AD': 'Andorra', 'AO': 'Angola', 'AG': 'Antigua and Barbuda', 'AR': 'Argentina', 'AM': 'Armenia', 'AU': 'Australia', 'AT': 'Austria', 'AZ': 'Azerbaijan', 'BS': 'Bahamas', 'BH': 'Bahrain', 'BD': 'Bangladesh', 'BB': 'Barbados', 'BY': 'Belarus', 'BE': 'Belgium', 'BZ': 'Belize', 'BJ': 'Benin', 'BT': 'Bhutan', 'BO': 'Bolivia', 'BA': 'Bosnia and Herzegovina', 'BW': 'Botswana', 'BR': 'Brazil', 'BN': 'Brunei', 'BG': 'Bulgaria', 'BF': 'Burkina Faso', 'BI': 'Burundi', 'KH': 'Cambodia', 'CM': 'Cameroon', 'CA': 'Canada', 'CV': 'Cape Verde', 'CF': 'Central African Republic', 'TD': 'Chad', 'CL': 'Chile', 'CN': 'China', 'CO': 'Colombia', 'KM': 'Comoros', 'CG': 'Congo', 'CR': 'Costa Rica', 'HR': 'Croatia', 'CU': 'Cuba', 'CY': 'Cyprus', 'CZ': 'Czech Republic', 'DK': 'Denmark', 'DJ': 'Djibouti', 'DM': 'Dominica', 'DO': 'Dominican Republic', 'EC': 'Ecuador', 'EG': 'Egypt', 'SV': 'El Salvador', 'GQ': 'Equatorial Guinea', 'ER': 'Eritrea', 'EE': 'Estonia', 'ET': 'Ethiopia', 'FJ': 'Fiji', 'FI': 'Finland', 'FR': 'France', 'GA': 'Gabon', 'GM': 'Gambia', 'GE': 'Georgia', 'DE': 'Germany', 'GH': 'Ghana', 'GR': 'Greece', 'GD': 'Grenada', 'GT': 'Guatemala', 'GN': 'Guinea', 'GW': 'Guinea-Bissau', 'GY': 'Guyana', 'HT': 'Haiti', 'HN': 'Honduras', 'HK': 'Hong Kong', 'HU': 'Hungary', 'IS': 'Iceland', 'IN': 'India', 'ID': 'Indonesia', 'IR': 'Iran', 'IQ': 'Iraq', 'IE': 'Ireland', 'IL': 'Israel', 'IT': 'Italy', 'JM': 'Jamaica', 'JP': 'Japan', 'JO': 'Jordan', 'KZ': 'Kazakhstan', 'KE': 'Kenya', 'KI': 'Kiribati', 'KP': 'North Korea', 'KR': 'South Korea', 'KW': 'Kuwait', 'KG': 'Kyrgyzstan', 'LA': 'Laos', 'LV': 'Latvia', 'LB': 'Lebanon', 'LS': 'Lesotho', 'LR': 'Liberia', 'LY': 'Libya', 'LI': 'Liechtenstein', 'LT': 'Lithuania', 'LU': 'Luxembourg', 'MO': 'Macao', 'MK': 'Macedonia', 'MG': 'Madagascar', 'MW': 'Malawi', 'MY': 'Malaysia', 'MV': 'Maldives', 'ML': 'Mali', 'MT': 'Malta', 'MH': 'Marshall Islands', 'MQ': 'Martinique', 'MR': 'Mauritania', 'MU': 'Mauritius', 'MX': 'Mexico', 'FM': 'Micronesia', 'MD': 'Moldova', 'MC': 'Monaco', 'MN': 'Mongolia', 'ME': 'Montenegro', 'MA': 'Morocco', 'MZ': 'Mozambique', 'MM': 'Myanmar', 'NA': 'Namibia', 'NR': 'Nauru', 'NP': 'Nepal', 'NL': 'Netherlands', 'NZ': 'New Zealand', 'NI': 'Nicaragua', 'NE': 'Niger', 'NG': 'Nigeria', 'NO': 'Norway', 'OM': 'Oman', 'PK': 'Pakistan', 'PW': 'Palau', 'PS': 'Palestine', 'PA': 'Panama', 'PG': 'Papua New Guinea', 'PY': 'Paraguay', 'PE': 'Peru', 'PH': 'Philippines', 'PL': 'Poland', 'PT': 'Portugal', 'QA': 'Qatar', 'RE': 'Reunion', 'RO': 'Romania', 'RU': 'Russia', 'RW': 'Rwanda', 'KN': 'Saint Kitts and Nevis', 'LC': 'Saint Lucia', 'VC': 'Saint Vincent and the Grenadines', 'WS': 'Samoa', 'SM': 'San Marino', 'ST': 'Sao Tome and Principe', 'SA': 'Saudi Arabia', 'SN': 'Senegal', 'RS': 'Serbia', 'SC': 'Seychelles', 'SL': 'Sierra Leone', 'SG': 'Singapore', 'SK': 'Slovakia', 'SI': 'Slovenia', 'SB': 'Solomon Islands', 'SO': 'Somalia', 'ZA': 'South Africa', 'SS': 'South Sudan', 'ES': 'Spain', 'LK': 'Sri Lanka', 'SD': 'Sudan', 'SR': 'Suriname', 'SZ': 'Swaziland', 'SE': 'Sweden', 'CH': 'Switzerland', 'SY': 'Syria', 'TW': 'Taiwan', 'TJ': 'Tajikistan', 'TZ': 'Tanzania', 'TH': 'Thailand', 'TL': 'Timor-Leste', 'TG': 'Togo', 'TO': 'Tonga', 'TT': 'Trinidad and Tobago', 'TN': 'Tunisia', 'TR': 'Turkey', 'TM': 'Turkmenistan', 'TV': 'Tuvalu', 'UG': 'Uganda', 'UA': 'Ukraine', 'AE': 'United Arab Emirates', 'GB': 'United Kingdom', 'US': 'United States', 'UY': 'Uruguay', 'UZ': 'Uzbekistan', 'VU': 'Vanuatu', 'VE': 'Venezuela', 'VN': 'Vietnam', 'YE': 'Yemen', 'ZM': 'Zambia', 'ZW': 'Zimbabwe'}
    
    user_doc = {
        'email': data['email'],
        'password': generate_password_hash(data['password']),
        'country': country_map.get(data.get('country'), data.get('country')),
        'created_at': get_current_utc_time(),
        'testimonial_submitted': False
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
        session['show_testimonial_prompt'] = should_prompt_for_testimonial(user)
        logger.info(f"User signed in: {user['email']}")
        redirect_url = '/admin/dashboard' if user.get('is_admin') else '/my-accounts'
        return jsonify({'success': True, 'redirect': redirect_url})
    
    logger.warning(f"Failed sign in attempt for: {data['email']}")
    return jsonify({'success': False, 'message': 'Invalid credentials'})

@app.route('/api/forgot-password', methods=['POST'])
def api_forgot_password():
    data = request.json or {}
    email = (data.get('email') or '').strip().lower()
    new_password = data.get('new_password')
    confirm_password = data.get('confirm_password')

    if not email:
        return jsonify({'success': False, 'message': 'Email is required'}), 400

    if new_password != confirm_password:
        return jsonify({'success': False, 'message': 'Passwords do not match'}), 400

    is_valid_password, password_error = validate_password_policy(new_password)
    if not is_valid_password:
        return jsonify({'success': False, 'message': password_error}), 400

    user = users_collection.find_one({'email': email})
    if not user:
        logger.warning(f"Forgot-password attempt for non-existing email: {email}")
        return jsonify({'success': False, 'message': 'Email is not registered'}), 404

    users_collection.update_one(
        {'_id': user['_id']},
        {'$set': {'password': generate_password_hash(new_password)}}
    )
    logger.info(f"Password reset completed for: {email}")
    return jsonify({'success': True, 'message': 'Password reset successful. Please sign in.'})

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
                    'created_at': get_current_utc_time(),
                    'testimonial_submitted': False
                }
                result = users_collection.insert_one(user_doc)
                user = users_collection.find_one({'_id': result.inserted_id})
        else:
            logger.info(f"Existing Google user signed in: {user['email']}")
        
        session['user_id'] = str(user['_id'])
        session['show_testimonial_prompt'] = should_prompt_for_testimonial(user)
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

@app.route('/api/testimonials', methods=['POST'])
def submit_testimonial():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'message': 'Not authenticated'}), 401

    if user.get('is_admin'):
        return jsonify({'success': False, 'message': 'Admins cannot submit testimonials'}), 403

    if user.get('testimonial_submitted'):
        session['show_testimonial_prompt'] = False
        return jsonify({'success': False, 'message': 'Testimonial already submitted'}), 409

    data = request.json or {}
    name = (data.get('name') or '').strip()
    city = (data.get('city') or '').strip()
    comment = (data.get('comment') or '').strip()
    rating = data.get('rating')

    if not name:
        return jsonify({'success': False, 'message': 'Name is required'}), 400
    if not city:
        return jsonify({'success': False, 'message': 'City is required'}), 400
    if not comment:
        return jsonify({'success': False, 'message': 'Feedback is required'}), 400
    if len(comment) < 15:
        return jsonify({'success': False, 'message': 'Feedback must be at least 15 characters'}), 400

    try:
        rating = int(rating)
    except (TypeError, ValueError):
        return jsonify({'success': False, 'message': 'Rating is required'}), 400

    if rating < 1 or rating > 5:
        return jsonify({'success': False, 'message': 'Rating must be between 1 and 5'}), 400

    testimonial_doc = {
        'user_id': user['_id'],
        'user_email': user['email'],
        'name': name,
        'city': city,
        'rating': rating,
        'comment': comment,
        'is_active': True,
        'display_order': 999,
        'created_at': get_current_utc_time()
    }

    testimonials_collection.update_one(
        {'user_id': user['_id']},
        {'$set': testimonial_doc},
        upsert=True
    )
    users_collection.update_one(
        {'_id': user['_id']},
        {'$set': {'testimonial_submitted': True}}
    )
    session['show_testimonial_prompt'] = False

    logger.info(f"Testimonial submitted by user {user['email']}")
    return jsonify({'success': True, 'message': 'Testimonial submitted successfully'})

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

    is_valid_password, password_error = validate_password_policy(data.get('password'))
    if not is_valid_password:
        return jsonify({'success': False, 'message': password_error}), 400

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
        payment_method = (data.get('payment_method') or 'imps').lower()

        if payment_method == 'usdt':
            if amount < 100 or amount > 10000:
                return jsonify({'success': False, 'message': 'USDT deposit amount must be between 100 and 10000'})
            currency = 'USDT'
            fee_rate = 0.019
        elif payment_method in ['imps']:
            min_amount = 1000 if account.get('account_type') == 'standard' else 50000
            max_amount = 100000
            if amount < min_amount or amount > max_amount:
                return jsonify({'success': False, 'message': f'{payment_method.upper()} deposit amount must be between {min_amount} and {max_amount}'})
            currency = 'INR' if account['currency'] == 'USD' else account['currency']
            fee_rate = 0.014
        else:
            return jsonify({'success': False, 'message': 'Invalid payment method'})
        
        # Create payment record
        payment_doc = {
            'user_id': user['_id'],
            'account_id': ObjectId(data['account_id']),
            'amount': amount,
            'currency': currency,
            'payment_method': payment_method,
            'fee_rate': fee_rate,
            'fee_amount': round(amount * fee_rate, 2),
            'charged_amount': round(amount + (amount * fee_rate), 2),
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
        
        payment_method = data.get('payment_method', 'upi')
        
        upi_pattern = re.compile(r'^[a-zA-Z0-9._-]+@[a-zA-Z]{3,}$')
        bank_account_pattern = re.compile(r'^\d{9,18}$')
        ifsc_pattern = re.compile(r'^[A-Z]{4}0[A-Z0-9]{6}$')

        if payment_method == 'upi':
            if amount < 10 or amount > 50:
                return jsonify({'success': False, 'message': 'UPI withdrawal amount must be between $10 and $50'})
            upi_id = (data.get('upi_id') or '').strip()
            if not upi_pattern.match(upi_id):
                return jsonify({'success': False, 'message': 'Please enter a valid UPI ID'})
        else:
            if amount < 50:
                return jsonify({'success': False, 'message': 'Bank transfer withdrawal amount must be at least $50'})
            bank_account = (data.get('bank_account') or '').strip()
            ifsc_code = (data.get('ifsc_code') or '').strip().upper()
            if not bank_account_pattern.match(bank_account):
                return jsonify({'success': False, 'message': 'Please enter a valid bank account number'})
            if not ifsc_pattern.match(ifsc_code):
                return jsonify({'success': False, 'message': 'Please enter a valid IFSC code'})
        
        if amount > balance:
            return jsonify({'success': False, 'message': 'Insufficient balance'})
        
        # Create withdrawal record
        withdrawal_doc = {
            'user_id': user['_id'],
            'account_id': ObjectId(data['account_id']),
            'amount': amount,
            'currency': data['currency'],
            'payment_method': payment_method,
            'type': 'withdrawal',
            'status': 'pending',
            'created_at': get_current_utc_time()
        }
        
        if payment_method == 'upi':
            withdrawal_doc['upi_id'] = upi_id
        else:
            withdrawal_doc['bank_account'] = bank_account
            withdrawal_doc['ifsc_code'] = ifsc_code
        
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
            'payment_method': payment_method,
            'status': 'pending_approval',
            'created_at': get_current_utc_time()
        }
        
        if payment_method == 'upi':
            notification_doc['upi_id'] = upi_id
        else:
            notification_doc['bank_account'] = bank_account
            notification_doc['ifsc_code'] = ifsc_code
        
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
        
        # Validate file extension
        allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.heic', '.heif'}
        file_ext = os.path.splitext(file.filename)[1].lower()
        if file_ext not in allowed_extensions:
            return jsonify({'success': False, 'message': 'Invalid file format. Supported: JPG, PNG, GIF, BMP, WEBP, SVG, HEIC, HEIF'})
        
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
        
        # Validate screenshot is uploaded
        if not payment.get('screenshot'):
            return jsonify({'success': False, 'message': 'Screenshot is required to submit payment'})
        
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

@app.route('/admin/analytics')
def admin_analytics():
    user = get_current_user()
    if not user or not user.get('is_admin'):
        return redirect(url_for('signin'))

    return render_template('admin-analytics.html', user=user)

@app.route('/api/admin/analytics/summary', methods=['GET'])
def get_admin_analytics_summary():
    user = get_current_user()
    if not user or not user.get('is_admin'):
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401

    try:
        now = get_current_utc_time()
        window = request.args.get('window', 'daily').lower()
        window_config = get_window_config(window, now)
        range_start = window_config['range_start']
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)

        total_users = users_collection.count_documents({'is_admin': {'$ne': True}})
        new_users_in_window = users_collection.count_documents({
            'is_admin': {'$ne': True},
            'created_at': {'$gte': range_start}
        })
        total_accounts = accounts_collection.count_documents({})
        new_accounts_in_window = accounts_collection.count_documents({'created_at': {'$gte': range_start}})
        pending_approvals = notifications_collection.count_documents({'status': 'pending_approval'})

        completed_deposits_all = list(payments_collection.find(
            {'type': 'deposit', 'status': 'completed'},
            {'amount': 1, 'currency': 1, 'payment_method': 1, 'fee_amount': 1, 'approved_at': 1}
        ))
        completed_deposits_window = [
            payment for payment in completed_deposits_all
            if ensure_ist_datetime(payment.get('approved_at')) and ensure_ist_datetime(payment.get('approved_at')) >= range_start
        ]
        completed_deposits_today = [
            payment for payment in completed_deposits_all
            if ensure_ist_datetime(payment.get('approved_at')) and ensure_ist_datetime(payment.get('approved_at')) >= day_start
        ]
        completed_deposits_week = [
            payment for payment in completed_deposits_all
            if ensure_ist_datetime(payment.get('approved_at')) and ensure_ist_datetime(payment.get('approved_at')) >= week_start
        ]
        completed_deposits_month = [
            payment for payment in completed_deposits_all
            if ensure_ist_datetime(payment.get('approved_at')) and ensure_ist_datetime(payment.get('approved_at')) >= month_start
        ]

        total_platform_fee_earned = round(sum(calculate_platform_fee(payment) for payment in completed_deposits_all), 2)
        platform_fee_earned = round(sum(calculate_platform_fee(payment) for payment in completed_deposits_window), 2)
        fee_today = round(sum(calculate_platform_fee(payment) for payment in completed_deposits_today), 2)
        fee_this_week = round(sum(calculate_platform_fee(payment) for payment in completed_deposits_week), 2)
        fee_this_month = round(sum(calculate_platform_fee(payment) for payment in completed_deposits_month), 2)

        unread_threads = list(chats_collection.aggregate([
            {'$match': {'admin_id': user['_id'], 'read': False}},
            {'$group': {'_id': '$user_id'}},
            {'$count': 'value'}
        ]))
        unread_support_threads = unread_threads[0]['value'] if unread_threads else 0

        pending_deposit_docs = list(payments_collection.find(
            {'type': 'deposit', 'status': 'pending'},
            {'amount': 1, 'currency': 1, 'payment_method': 1, 'fee_amount': 1}
        ))
        pending_deposits = {
            'amount': round(sum(float(doc.get('amount') or 0) for doc in pending_deposit_docs), 2),
            'count': len(pending_deposit_docs),
            'fee': round(sum(calculate_platform_fee(doc) for doc in pending_deposit_docs), 2)
        }

        avg_deposit_result = list(payments_collection.aggregate([
            {'$match': {'type': 'deposit', 'status': 'completed', 'approved_at': {'$gte': range_start}}},
            {'$group': {'_id': None, 'amount': {'$avg': '$amount'}}}
        ]))
        average_deposit_amount = round(float(avg_deposit_result[0]['amount']), 2) if avg_deposit_result else 0

        average_fee_per_transaction = round(
            (sum(calculate_platform_fee(payment) for payment in completed_deposits_window) / len(completed_deposits_window))
            if completed_deposits_window else 0,
            2
        )

        highest_fee_payment = max(
            completed_deposits_window,
            key=lambda payment: calculate_platform_fee(payment),
            default=None
        )

        pending_withdrawal_result = list(payments_collection.aggregate([
            {'$match': {'type': 'withdrawal', 'status': 'pending'}},
            {'$group': {'_id': None, 'amount': {'$sum': '$amount'}, 'count': {'$sum': 1}}}
        ]))
        pending_withdrawals = pending_withdrawal_result[0] if pending_withdrawal_result else {'amount': 0, 'count': 0}

        testimonials_submitted = users_collection.count_documents({
            'is_admin': {'$ne': True},
            'testimonial_submitted': True
        })

        user_growth_rows = list(users_collection.find(
            {'is_admin': {'$ne': True}, 'created_at': {'$gte': range_start}},
            {'created_at': 1}
        ))

        users_by_country_rows = list(users_collection.aggregate([
            {'$match': {'is_admin': {'$ne': True}, 'country': {'$nin': [None, '']}, 'created_at': {'$gte': range_start}}},
            {'$group': {'_id': '$country', 'users': {'$sum': 1}}},
            {'$sort': {'users': -1}},
            {'$limit': 8}
        ]))

        accounts_by_type_rows = list(accounts_collection.aggregate([
            {'$match': {'created_at': {'$gte': range_start}}},
            {'$group': {'_id': '$account_type', 'accounts': {'$sum': 1}}},
            {'$sort': {'accounts': -1}}
        ]))

        accounts_by_platform_currency_rows = list(accounts_collection.aggregate([
            {'$match': {'created_at': {'$gte': range_start}}},
            {'$group': {'_id': {'platform': '$platform', 'currency': '$currency'}, 'accounts': {'$sum': 1}}},
            {'$sort': {'accounts': -1}},
            {'$limit': 8}
        ]))

        deposit_volume_rows = list(payments_collection.find(
            {'type': 'deposit', 'status': 'completed', 'approved_at': {'$gte': range_start}},
            {'approved_at': 1, 'amount': 1}
        ))

        deposits_by_method_rows = list(payments_collection.aggregate([
            {'$match': {'type': 'deposit', 'status': 'completed', 'approved_at': {'$gte': range_start}}},
            {
                '$group': {
                    '_id': '$payment_method',
                    'amount': {'$sum': '$amount'},
                    'count': {'$sum': 1},
                    'fee': {'$sum': {'$ifNull': ['$fee_amount', 0]}}
                }
            },
            {'$sort': {'amount': -1}}
        ]))

        withdrawal_volume_rows = list(payments_collection.find(
            {'type': 'withdrawal', 'status': 'completed', 'approved_at': {'$gte': range_start}},
            {'approved_at': 1, 'amount': 1}
        ))

        fee_trend_rows = completed_deposits_window

        withdrawals_by_method_rows = list(payments_collection.aggregate([
            {'$match': {'type': 'withdrawal', 'status': 'completed', 'approved_at': {'$gte': range_start}}},
            {
                '$group': {
                    '_id': '$payment_method',
                    'amount': {'$sum': '$amount'},
                    'count': {'$sum': 1}
                }
            },
            {'$sort': {'amount': -1}}
        ]))

        return jsonify({
            'success': True,
            'generated_at': now.isoformat(),
            'window': window_config['key'],
            'window_label': window_config['label'],
            'cards': [
                {
                    'id': 'total_users',
                    'title': 'Total Users',
                    'value': total_users,
                    'format': 'number',
                    'context': f'{new_users_in_window} added in selected window'
                },
                {
                    'id': 'total_accounts',
                    'title': 'Total Trading Accounts',
                    'value': total_accounts,
                    'format': 'number',
                    'context': f'{new_accounts_in_window} created in selected window'
                },
                {
                    'id': 'pending_approvals',
                    'title': 'Pending Approvals',
                    'value': pending_approvals,
                    'format': 'number',
                    'context': 'Deposits and withdrawals awaiting action'
                },
                {
                    'id': 'platform_fee_earned',
                    'title': 'Platform Fee Earned',
                    'value': platform_fee_earned,
                    'format': 'currency',
                    'currency_symbol': '₹',
                    'context': 'Completed deposit fees in selected window'
                },
                {
                    'id': 'unread_support_threads',
                    'title': 'Unread Support Threads',
                    'value': unread_support_threads,
                    'format': 'number',
                    'context': 'Threads with unread messages for this admin'
                },
                {
                    'id': 'testimonials_submitted',
                    'title': 'Testimonials Submitted',
                    'value': testimonials_submitted,
                    'format': 'number',
                    'context': 'Users who completed the testimonial flow'
                },
                {
                    'id': 'pending_deposits',
                    'title': 'Pending Deposit Value',
                    'value': round(float(pending_deposits.get('amount', 0) or 0), 2),
                    'format': 'currency',
                    'currency_symbol': '₹',
                    'context': f"{int(pending_deposits.get('count', 0) or 0)} pending deposits"
                },
                {
                    'id': 'avg_deposit',
                    'title': 'Average Deposit Amount',
                    'value': average_deposit_amount,
                    'format': 'currency',
                    'currency_symbol': '₹',
                    'context': 'Completed deposits in selected window'
                },
                {
                    'id': 'pending_withdrawals',
                    'title': 'Pending Withdrawal Queue',
                    'value': round(float(pending_withdrawals.get('amount', 0) or 0), 2),
                    'format': 'currency',
                    'currency_symbol': '$',
                    'context': f"{int(pending_withdrawals.get('count', 0) or 0)} pending withdrawals"
                }
            ],
            'fee_cards': [
                {
                    'id': 'fee_total',
                    'title': 'Total Platform Fee Earned',
                    'value': total_platform_fee_earned,
                    'format': 'currency',
                    'currency_symbol': '₹',
                    'context': f"{platform_fee_earned:.2f} in selected {window_config['key']} window"
                },
                {
                    'id': 'fee_today',
                    'title': 'Fee Earned Today',
                    'value': fee_today,
                    'format': 'currency',
                    'currency_symbol': '₹',
                    'context': 'Today'
                },
                {
                    'id': 'fee_week',
                    'title': 'Fee Earned This Week',
                    'value': fee_this_week,
                    'format': 'currency',
                    'currency_symbol': '₹',
                    'context': 'Current week'
                },
                {
                    'id': 'fee_month',
                    'title': 'Fee Earned This Month',
                    'value': fee_this_month,
                    'format': 'currency',
                    'currency_symbol': '₹',
                    'context': 'Current month'
                },
                {
                    'id': 'fee_pending',
                    'title': 'Pending Platform Fee',
                    'value': round(float(pending_deposits.get('fee', 0) or 0), 2),
                    'format': 'currency',
                    'currency_symbol': '₹',
                    'context': f"{int(pending_deposits.get('count', 0) or 0)} pending deposits"
                },
                {
                    'id': 'fee_average',
                    'title': 'Average Fee Per Transaction',
                    'value': average_fee_per_transaction,
                    'format': 'currency',
                    'currency_symbol': '₹',
                    'context': 'Completed deposits in selected window'
                },
                {
                    'id': 'fee_highest',
                    'title': 'Highest Fee Transaction',
                    'value': round(float((highest_fee_payment or {}).get('fee_amount', 0) or 0), 2),
                    'format': 'currency',
                    'currency_symbol': '₹',
                    'context': (
                        f"{str((highest_fee_payment or {}).get('payment_method') or 'N/A').upper()} on "
                        f"{round(float((highest_fee_payment or {}).get('amount', 0) or 0), 2)} "
                        f"{str((highest_fee_payment or {}).get('currency') or '')}"
                    ) if highest_fee_payment else 'No completed deposits in selected window'
                }
            ],
            'charts': {
                'user_growth': build_windowed_series(
                    [{**row, 'users': 1} for row in user_growth_rows],
                    window_config,
                    'created_at',
                    ['users']
                ),
                'users_by_country': normalize_grouped_rows(users_by_country_rows, value_keys=['users']),
                'accounts_by_type': normalize_grouped_rows(accounts_by_type_rows, value_keys=['accounts']),
                'accounts_by_platform_currency': normalize_grouped_rows(
                    accounts_by_platform_currency_rows,
                    label_builder=lambda value: f"{(value or {}).get('platform', 'Unknown')} / {(value or {}).get('currency', 'Unknown')}",
                    value_keys=['accounts']
                ),
                'deposit_volume': build_windowed_series(
                    [{**row, 'count': 1} for row in deposit_volume_rows],
                    window_config,
                    'approved_at',
                    ['amount', 'count']
                ),
                'deposits_by_method': normalize_grouped_rows(deposits_by_method_rows, value_keys=['amount', 'count', 'fee']),
                'withdrawal_volume': build_windowed_series(
                    [{**row, 'count': 1} for row in withdrawal_volume_rows],
                    window_config,
                    'approved_at',
                    ['amount', 'count']
                ),
                'withdrawals_by_method': normalize_grouped_rows(withdrawals_by_method_rows, value_keys=['amount', 'count']),
                'fee_growth': build_windowed_series(
                    [{**row, 'fee': calculate_platform_fee(row)} for row in fee_trend_rows],
                    window_config,
                    'approved_at',
                    ['fee']
                )
            }
        })
    except Exception as e:
        logger.error(f"Error building admin analytics summary: {e}", exc_info=True)
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/analytics/tables', methods=['GET'])
def get_admin_analytics_tables():
    user = get_current_user()
    if not user or not user.get('is_admin'):
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401

    try:
        now = get_current_utc_time()

        users_no_account_rows = list(users_collection.aggregate([
            {'$match': {'is_admin': {'$ne': True}}},
            {
                '$lookup': {
                    'from': 'trading_accounts',
                    'localField': '_id',
                    'foreignField': 'user_id',
                    'as': 'accounts'
                }
            },
            {'$match': {'accounts.0': {'$exists': False}}},
            {
                '$project': {
                    'email': 1,
                    'name': {'$ifNull': ['$name', {'$arrayElemAt': [{'$split': ['$email', '@']}, 0]}]},
                    'country': {'$ifNull': ['$country', 'Unknown']},
                    'created_at': 1
                }
            },
            {'$sort': {'created_at': -1}},
            {'$limit': 8}
        ]))

        awaiting_mt_rows = list(accounts_collection.aggregate([
            {
                '$match': {
                    '$or': [
                        {'mt_login': {'$in': [None, '']}},
                        {'mt_server': {'$in': [None, '']}}
                    ]
                }
            },
            {
                '$lookup': {
                    'from': 'users',
                    'localField': 'user_id',
                    'foreignField': '_id',
                    'as': 'user'
                }
            },
            {'$unwind': '$user'},
            {
                '$project': {
                    'nickname': 1,
                    'account_type': 1,
                    'platform': 1,
                    'currency': 1,
                    'created_at': 1,
                    'user_email': '$user.email'
                }
            },
            {'$sort': {'created_at': -1}},
            {'$limit': 8}
        ]))

        pending_approval_rows = list(notifications_collection.aggregate([
            {'$match': {'status': 'pending_approval'}},
            {
                '$project': {
                    'type': 1,
                    'user_email': {'$ifNull': ['$user_email', 'Unknown']},
                    'account_nickname': {'$ifNull': ['$account_nickname', 'Unknown']},
                    'amount': {'$ifNull': ['$amount', 0]},
                    'currency': {'$ifNull': ['$currency', '']},
                    'created_at': 1
                }
            },
            {'$sort': {'created_at': 1}},
            {'$limit': 8}
        ]))

        unread_chat_rows = list(chats_collection.aggregate([
            {'$match': {'admin_id': user['_id'], 'read': False}},
            {
                '$group': {
                    '_id': '$user_id',
                    'unread_count': {'$sum': 1},
                    'last_message_at': {'$max': '$created_at'}
                }
            },
            {
                '$lookup': {
                    'from': 'users',
                    'localField': '_id',
                    'foreignField': '_id',
                    'as': 'user'
                }
            },
            {'$unwind': '$user'},
            {
                '$project': {
                    'user_email': '$user.email',
                    'user_name': {'$ifNull': ['$user.name', {'$arrayElemAt': [{'$split': ['$user.email', '@']}, 0]}]},
                    'unread_count': 1,
                    'last_message_at': 1
                }
            },
            {'$sort': {'unread_count': -1, 'last_message_at': -1}},
            {'$limit': 8}
        ]))

        def iso_or_none(value):
            normalized = ensure_ist_datetime(value)
            return normalized.isoformat() if normalized else None

        return jsonify({
            'success': True,
            'tables': {
                'users_no_account': [
                    {
                        'name': row.get('name') or row.get('email', '').split('@')[0],
                        'email': row.get('email'),
                        'country': row.get('country') or 'Unknown',
                        'created_at': iso_or_none(row.get('created_at'))
                    }
                    for row in users_no_account_rows
                ],
                'awaiting_mt_setup': [
                    {
                        'nickname': row.get('nickname') or 'Unnamed',
                        'user_email': row.get('user_email'),
                        'account_type': row.get('account_type') or 'Unknown',
                        'platform': row.get('platform') or 'Unknown',
                        'currency': row.get('currency') or 'Unknown',
                        'created_at': iso_or_none(row.get('created_at'))
                    }
                    for row in awaiting_mt_rows
                ],
                'aging_pending_approvals': [
                    {
                        'type': 'Withdrawal' if row.get('type') == 'withdrawal_requested' else 'Deposit',
                        'user_email': row.get('user_email'),
                        'account_nickname': row.get('account_nickname'),
                        'amount': round(float(row.get('amount', 0) or 0), 2),
                        'currency': row.get('currency'),
                        'created_at': iso_or_none(row.get('created_at')),
                        'age_minutes': round((now - ensure_ist_datetime(row.get('created_at'))).total_seconds() / 60, 1) if row.get('created_at') else None
                    }
                    for row in pending_approval_rows
                ],
                'unread_support_threads': [
                    {
                        'user_name': row.get('user_name') or row.get('user_email', '').split('@')[0],
                        'user_email': row.get('user_email'),
                        'unread_count': int(row.get('unread_count', 0) or 0),
                        'last_message_at': iso_or_none(row.get('last_message_at'))
                    }
                    for row in unread_chat_rows
                ]
            }
        })
    except Exception as e:
        logger.error(f"Error building admin analytics tables: {e}", exc_info=True)
        return jsonify({'success': False, 'message': str(e)}), 500

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

@app.route('/api/withdrawal/saved-credentials', methods=['GET'])
def get_saved_credentials():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'message': 'Not authenticated'})
    
    try:
        user_data = users_collection.find_one({'_id': user['_id']})
        return jsonify({
            'success': True,
            'upi_id': user_data.get('saved_upi_id'),
            'bank_account': user_data.get('saved_bank_account'),
            'ifsc_code': user_data.get('saved_ifsc_code')
        })
    except Exception as e:
        logger.error(f"Error fetching saved credentials: {e}")
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/withdrawal/save-credentials', methods=['POST'])
def save_withdrawal_credentials():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'message': 'Not authenticated'})
    
    try:
        data = request.json
        update_data = {}
        if data.get('upi_id'):
            update_data['saved_upi_id'] = data['upi_id']
        else:
            update_data['saved_upi_id'] = None
        if data.get('bank_account'):
            update_data['saved_bank_account'] = data['bank_account']
            update_data['saved_ifsc_code'] = data.get('ifsc_code')
        else:
            update_data['saved_bank_account'] = None
            update_data['saved_ifsc_code'] = None
        
        users_collection.update_one({'_id': user['_id']}, {'$set': update_data})
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Error saving credentials: {e}")
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
        except (ValueError, Exception) as e:
            logger.error(f"Error during logout: {e}")
    session.pop('user_id', None)
    session.pop('show_testimonial_prompt', None)
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

@app.route('/api/admin/chat-users-with-pending', methods=['GET'])
def get_chat_users_with_pending():
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
                pending_count = chat_user['unread_count']
                if pending_count > 0:
                    users_list.append({
                        'user_id': str(user['_id']),
                        'email': user['email'],
                        'name': user.get('name', user['email'].split('@')[0]),
                        'pending_count': pending_count
                    })
        
        return jsonify({'success': True, 'users': users_list})
    except Exception as e:
        logger.error(f"Error getting chat users with pending: {e}")
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
            is_valid_password, password_error = validate_password_policy(data.get('password'))
            if not is_valid_password:
                return jsonify({'success': False, 'message': password_error}), 400
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
    
@app.route('/api/stats')
def get_stats():
    """Get real-time stats for landing page"""
    try:
        total_users = users_collection.count_documents({'is_admin': {'$ne': True}})
        
        completed_payments = list(payments_collection.aggregate([
            {'$match': {'status': 'completed', 'type': 'deposit'}},
            {'$group': {'_id': None, 'total': {'$sum': '$amount'}}}
        ]))
        
        total_deposited = completed_payments[0]['total'] if completed_payments else 0
        
        return jsonify({
            'success': True,
            'total_users': total_users,
            'total_deposited': round(total_deposited, 2)
        })
    except Exception as e:
        logger.error(f"Error fetching stats: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/commission-stats', methods=['GET'])
def get_commission_stats():
    """Get total platform fees (1.4% of all completed deposits)"""
    user = get_current_user()
    if not user or not user.get('is_admin'):
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    try:
        year = request.args.get('year', type=int)
        month = request.args.get('month', type=int)
        
        total_deposits = list(payments_collection.aggregate([
            {'$match': {'status': 'completed', 'type': 'deposit'}},
            {'$group': {'_id': None, 'total': {'$sum': '$amount'}}}
        ]))
        
        total_amount = total_deposits[0]['total'] if total_deposits else 0
        platform_fee = total_amount * 0.014
        transaction_count = payments_collection.count_documents({'status': 'completed', 'type': 'deposit'})
        
        pending_deposits = list(payments_collection.aggregate([
            {'$match': {'status': 'pending', 'type': 'deposit'}},
            {'$group': {'_id': None, 'total': {'$sum': '$amount'}}}
        ]))
        
        pending_total = pending_deposits[0]['total'] if pending_deposits else 0
        pending_fee = pending_total * 0.014
        
        # Calculate monthly commission
        now = get_current_utc_time()
        if year and month:
            month_start = now.replace(year=year, month=month, day=1, hour=0, minute=0, second=0, microsecond=0)
            if month == 12:
                month_end = month_start.replace(year=year+1, month=1)
            else:
                month_end = month_start.replace(month=month+1)
        else:
            month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            month_end = None
        
        match_query = {'status': 'completed', 'type': 'deposit', 'approved_at': {'$gte': month_start}}
        if month_end:
            match_query['approved_at']['$lt'] = month_end
        
        monthly_deposits = list(payments_collection.aggregate([
            {'$match': match_query},
            {'$group': {'_id': None, 'total': {'$sum': '$amount'}}}
        ]))
        
        monthly_amount = monthly_deposits[0]['total'] if monthly_deposits else 0
        monthly_fee = monthly_amount * 0.014
        
        return jsonify({
            'success': True,
            'total_deposits': round(total_amount, 2),
            'platform_fee': round(platform_fee, 2),
            'transaction_count': transaction_count,
            'pending_deposits': round(pending_total, 2),
            'pending_fee': round(pending_fee, 2),
            'monthly_deposits': round(monthly_amount, 2),
            'monthly_fee': round(monthly_fee, 2)
        })
    except Exception as e:
        logger.error(f"Error fetching commission stats: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/users-no-account-type', methods=['GET'])
def get_users_no_account_type():
    user = get_current_user()
    if not user or not user.get('is_admin'):
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    try:
        users_with_accounts = set(doc['user_id'] for doc in accounts_collection.find({}, {'user_id': 1}))
        users_with_no_type = []
        for u in users_collection.find({'is_admin': {'$ne': True}, '_id': {'$nin': list(users_with_accounts)}}):
            users_with_no_type.append({
                'user_id': str(u['_id']),
                'email': u['email'],
                'name': u.get('name', u['email'].split('@')[0])
            })
        return jsonify({'success': True, 'count': len(users_with_no_type), 'users': users_with_no_type})
    except Exception as e:
        logger.error(f"Error fetching users with no account type: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

def cleanup_old_chats_and_notifications():
    """Delete chats and notifications older than 2 days"""
    try:
        cutoff_time = get_current_utc_time() - timedelta(days=2)
        chats_result = chats_collection.delete_many({'created_at': {'$lt': cutoff_time}})
        notifications_result = notifications_collection.delete_many({'created_at': {'$lt': cutoff_time}})
        if chats_result.deleted_count > 0 or notifications_result.deleted_count > 0:
            logger.info(f"Cleanup: Deleted {chats_result.deleted_count} chats and {notifications_result.deleted_count} notifications")
    except Exception as e:
        logger.error(f"Cleanup error: {e}")

@app.before_request
def periodic_cleanup():
    """Run cleanup on every request (lightweight check)"""
    if not hasattr(app, 'last_cleanup'):
        app.last_cleanup = get_current_utc_time()
    
    current_time = get_current_utc_time()
    if (current_time - app.last_cleanup).total_seconds() > 3600:
        cleanup_old_chats_and_notifications()
        app.last_cleanup = current_time

@app.route('/health')
def health_check():
    """Health check endpoint for Render"""
    db_status = 'ok' if check_db_connection() else 'unavailable'
    status_code = 200 if db_status == 'ok' else 503
    return jsonify({'status': 'ok', 'database': db_status}), status_code

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)



