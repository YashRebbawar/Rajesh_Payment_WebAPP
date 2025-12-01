from pymongo import MongoClient
from werkzeug.security import generate_password_hash
from urllib.parse import quote_plus
from datetime import datetime
from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URI = os.getenv('MONGO_URI')

if 'mongodb+srv://' in MONGO_URI and '@' in MONGO_URI:
    prefix = MONGO_URI.split('://')[0] + '://'
    rest = MONGO_URI.split('://', 1)[1]
    if '@' in rest:
        creds, host = rest.split('@', 1)
        if ':' in creds:
            username, password = creds.split(':', 1)
            MONGO_URI = f"{prefix}{quote_plus(username)}:{quote_plus(password)}@{host}"

client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000, tlsAllowInvalidCertificates=True)
db = client.printfree
users_collection = db.users

admin_email = "rppawar1811@gmail.com"
admin_password = "Test@9823707060@4110"

existing_admin = users_collection.find_one({'email': admin_email})

if existing_admin:
    users_collection.update_one(
        {'email': admin_email},
        {'$set': {
            'password': generate_password_hash(admin_password),
            'is_admin': True
        }}
    )
    print(f"Admin user updated: {admin_email}")
else:
    users_collection.delete_many({'email': admin_email})
    admin_doc = {
        'email': admin_email,
        'password': generate_password_hash(admin_password),
        'is_admin': True,
        'country': None,
        'partner_code': None,
        'created_at': datetime.utcnow()
    }
    users_collection.insert_one(admin_doc)
    print(f"Admin user created: {admin_email}")

print("Admin setup complete!")
