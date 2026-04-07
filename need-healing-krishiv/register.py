import firebase_admin
from firebase_admin import credentials, firestore, storage
import qrcode
import hashlib
import json
import os
import random
import string

# 🔐 INIT FIREBASE
cred = credentials.Certificate("serviceaccountkey.json")
firebase_admin.initialize_app(cred, {
    'storageBucket': 'YOUR-PROJECT-ID.appspot.com' # UPDATE THIS
})

db = firestore.client()
bucket = storage.bucket()

# 🧾 INPUT AADHAAR
print("\n--- MediVault Patient Registration ---")
aadhar = input("Enter your Aadhaar Number (12 digits): ").strip()

if len(aadhar) != 12 or not aadhar.isdigit():
    print("❌ Invalid Aadhaar number")
    exit()
    
name = input("Enter Patient Full Name: ").strip()

# 🔒 GENERATE SECURE PATIENT ID (No salt, so frontend can match it)
patient_id = hashlib.sha256(aadhar.encode()).hexdigest()

# 🔑 GENERATE PUBLIC ID
def generate_public_id():
    return "PAT-" + ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

public_id = generate_public_id()
aadhar_last4 = aadhar[-4:]

# 📱 QR DATA
qr_payload = {
    "patient_id": patient_id,
    "public_id": public_id,   
    "type": "health_access"
}

qr_data = json.dumps(qr_payload)
filename = f"{patient_id}.png"
img = qrcode.make(qr_data)
img.save(filename)

print("\n⏳ Uploading to Firebase...")

# UPLOAD TO STORAGE
blob = bucket.blob(f"qr_codes/{filename}")
blob.upload_from_filename(filename)
blob.make_public()
qr_url = blob.public_url

# SAVE TO FIRESTORE
db.collection("users").document(patient_id).set({
    "name": name,
    "patient_id": patient_id,
    "public_id": public_id,
    "aadhar_last4": aadhar_last4,
    "qr_url": qr_url,
    "role": "patient",
    "created_at": firestore.SERVER_TIMESTAMP
})

# CLEANUP
os.remove(filename)

# ✅ OUTPUT
print("\n✅ REGISTRATION SUCCESSFUL")
print(f"👤 Name: {name}")
print(f"🆔 Patient ID: {patient_id[:8]}...")
print(f"🔑 Public ID (give this to doctor): {public_id}")
print(f"🔗 QR URL: {qr_url}")
print(f"🪪 Aadhaar Linked: **** {aadhar_last4}\n")