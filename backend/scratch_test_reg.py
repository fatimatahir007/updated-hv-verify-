from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

payload = {
    "full_name": "New User Name",
    "email": "test12345@example.com",
    "password": "password123",
    "cnic": "1111111111111",
    "district": "Peshawar"
}

response = client.post("/auth/register", json=payload)
print(response.status_code)
print(response.json())
