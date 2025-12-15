from pymongo import MongoClient
from urllib.parse import quote_plus
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

client = MongoClient(MONGO_URI)
db = client.printfree

# Delete all user data except users collection
db.trading_accounts.delete_many({})
db.payments.delete_many({})
db.notifications.delete_many({})

print("✓ Deleted all trading accounts")
print("✓ Deleted all payments")
print("✓ Deleted all notifications")
print("✓ Users collection preserved")
