import firebase_admin
from firebase_admin import credentials, firestore, storage
import qrcode
import hashlib
import uuid
import json
import os

# 🔐 STEP 1: Initialize Firebase
cred = credentials.Certificate("serviceaccountkey.json")
firebase_admin.initialize_app(cred, {
    'storageBucket': 'need-healing-61f13.appspot.com'
})

db = firestore.client()
bucket = storage.bucket()

# 🧾 STEP 2: Take Aadhaar input
aadhar = input("Enter your Aadhaar Number (12 digits): ").strip()

if len(aadhar) != 12 or not aadhar.isdigit():
    print("❌ Invalid Aadhaar number")
    exit()

# 🔒 STEP 3: Generate secure patient ID
salt = str(uuid.uuid4())
patient_id = hashlib.sha256((aadhar + salt).encode()).hexdigest()

# 🪪 Last 4 digits (for display)
aadhar_last4 = aadhar[-4:]

# 📷 STEP 4: Create QR data
qr_payload = {
    "patient_id": patient_id,
    "type": "health_access"
}

qr_data = json.dumps(qr_payload)

# 🖼️ STEP 5: Generate QR image
filename = f"{patient_id}.png"
img = qrcode.make(qr_data)
img.save(filename)

# ☁️ STEP 6: Upload to Firebase Storage
blob = bucket.blob(f"qr_codes/{filename}")
blob.upload_from_filename(filename)

# make public for demo
blob.make_public()
qr_url = blob.public_url

# 🗄️ STEP 7: Save to Firestore
db.collection("users").document(patient_id).set({
    "patient_id": patient_id,
    "aadhar_last4": aadhar_last4,
    "salt": salt,
    "qr_url": qr_url,
    "role": "patient",
    "created_at": firestore.SERVER_TIMESTAMP
})

# 🧹 STEP 8: Delete local file
os.remove(filename)

# ✅ DONE
print("\n✅ SUCCESS")
print("🆔 Patient ID:", patient_id)
print("🔗 QR URL:", qr_url)
print("🪪 Aadhaar Linked: ****" + aadhar_last4)