"""
Helper script to get the latest payment ID for testing
Run this after initiating a payment to get the payment_id for simulation
"""

from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URI = os.getenv('MONGO_URI')
client = MongoClient(MONGO_URI)
db = client.printfree

# Get the latest payment
latest_payment = db.payments.find_one(
    {'status': 'pending'},
    sort=[('created_at', -1)]
)

if latest_payment:
    print("\n" + "="*60)
    print("LATEST PENDING PAYMENT")
    print("="*60)
    print(f"\nPayment ID: {latest_payment['_id']}")
    print(f"Amount: {latest_payment['amount']} {latest_payment['currency']}")
    print(f"Status: {latest_payment['status']}")
    print(f"Created: {latest_payment['created_at']}")
    print("\n" + "="*60)
    print("COPY THIS PAYMENT ID TO TEST PAGE:")
    print("="*60)
    print(f"\n{latest_payment['_id']}\n")
    print("Go to: http://localhost:5000/test-payment")
    print("Paste the Payment ID and click 'Simulate Payment'")
    print("="*60 + "\n")
else:
    print("\n❌ No pending payments found.")
    print("Please initiate a payment first from the payment page.\n")

client.close()
