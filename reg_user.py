import firebase_admin
from firebase_admin import credentials, firestore, storage
import qrcode
import hashlib
import uuid
import json
import os
import random
import string

# 🔐 INIT FIREBASE
cred = credentials.Certificate("serviceaccountkey.json")
firebase_admin.initialize_app(cred, {
    'storageBucket': 'need-healing-61f13.appspot.com'
})

db = firestore.client()
bucket = storage.bucket()

# 🧾 INPUT AADHAAR
aadhar = input("Enter your Aadhaar Number (12 digits): ").strip()

if len(aadhar) != 12 or not aadhar.isdigit():
    print("❌ Invalid Aadhaar number")
    exit()

# 🔒 GENERATE SECURE PATIENT ID
salt = str(uuid.uuid4())
patient_id = hashlib.sha256((aadhar + salt).encode()).hexdigest()

# 🔑 
def generate_public_id():
    return "PAT-" + ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

public_id = generate_public_id()

#
aadhar_last4 = aadhar[-4:]

#  QR DATA
qr_payload = {
    "patient_id": patient_id,
    "public_id": public_id,   # 🔥 included for fallback
    "type": "health_access"
}

qr_data = json.dumps(qr_payload)


filename = f"{patient_id}.png"
img = qrcode.make(qr_data)
img.save(filename)


blob = bucket.blob(f"qr_codes/{filename}")
blob.upload_from_filename(filename)

blob.make_public()
qr_url = blob.public_url


db.collection("users").document(patient_id).set({
    "patient_id": patient_id,
    "public_id": public_id,
    "aadhar_last4": aadhar_last4,
    "qr_url": qr_url,
    "role": "patient",
    "created_at": firestore.SERVER_TIMESTAMP
})


db.collection("users").document(patient_id).collection("prescriptions")
db.collection("users").document(patient_id).collection("reports")


os.remove(filename)

# ✅ OUTPUT
print("\n✅ REGISTRATION SUCCESSFUL")
print("🆔 Patient ID:", patient_id)
print("🔑 Public ID (give this to doctor):", public_id)
print("🔗 QR URL:", qr_url)
print("🪪 Aadhaar Linked: ****" + aadhar_last4)