from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

payload = {
    "identifier": "test12345@example.com",
    "password": "password123"
}

response = client.post("/auth/login", json=payload)
print(response.status_code)
print(response.json())
