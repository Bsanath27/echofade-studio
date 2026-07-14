from fastapi import FastAPI, Form
from fastapi.testclient import TestClient

app = FastAPI()

@app.post("/test")
def test_endpoint(canvas_mode: bool = Form(False), show_intro: bool = Form(False)):
    return {"canvas": canvas_mode, "intro": show_intro}

client = TestClient(app)
res = client.post("/test", data={"canvas_mode": "false", "show_intro": "true"})
print(res.json())
