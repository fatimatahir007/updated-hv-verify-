from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

login_payload = {
    "identifier": "test12345@example.com",
    "password": "password123"
}
response = client.post("/auth/login", json=login_payload)
print(response.status_code)
if response.status_code == 200:
    token = response.json()["access_token"]
    res_me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    print(res_me.status_code)
    print(res_me.json())
