from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_status_endpoint():
    response = client.get("/api/v1/status")
    assert response.status_code == 200
    assert response.json() == {
        "status": "connected",
        "version": "0.1.0",
        "team": "이니셔티브 (Initiative)",
        "message": "Backend is ready to lead the data valuation standard."
    }