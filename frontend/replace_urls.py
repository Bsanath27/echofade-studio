import glob
import re

for file in glob.glob("src/components/*.jsx"):
    with open(file, "r") as f:
        content = f.read()
    
    if "const API =" not in content and "http://127.0.0.1:8000" in content:
        content = content.replace("export default function", "const API = import.meta.env.VITE_API_URL || \"http://127.0.0.1:8000\"\n\nexport default function")
    
    content = content.replace("\"http://127.0.0.1:8000/api/", "`${API}/api/")
    content = content.replace("\"http://127.0.0.1:8000", "`${API}")
    content = content.replace("`http://127.0.0.1:8000/api/", "`${API}/api/")
    content = content.replace("`http://127.0.0.1:8000${", "`${API}${")
    content = content.replace("'http://127.0.0.1:8000/api/", "`${API}/api/")
    
    # replace 'http://127.0.0.1:8000/api/...' with `${API}/api/...`
    content = re.sub(r"'http://127.0.0.1:8000/api/([a-zA-Z0-9_-]+)'", r"`${API}/api/\1`", content)
    
    with open(file, "w") as f:
        f.write(content)
