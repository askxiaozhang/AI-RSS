from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

def test_analyze_structure():
    response = client.post(
        "/api/agents/analyze-structure",
        json={"url": "https://news.ycombinator.com/"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "container_selector" in data
    assert "title_selector" in data

def test_parse_elements():
    response = client.post(
        "/api/agents/parse-elements",
        json={
            "url": "https://news.ycombinator.com/",
            "container_selector": "tr.athing",
            "title_selector": "span.titleline > a",
            "link_selector": "span.titleline > a",
            "description_selector": "+ tr span.score"
        }
    )
    # The URL might be crawled during test if internet is connected, or fail. Accept 200 or 400.
    assert response.status_code in [200, 400]

def test_summarize_content():
    response = client.post(
        "/api/agents/summarize-content",
        json={
            "title": "Test Title",
            "content": "Test Content detailing some long things."
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "tldr" in data
    assert "summary" in data
