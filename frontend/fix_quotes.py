import glob
import re

for file in glob.glob("src/components/*.jsx"):
    with open(file, "r") as f:
        content = f.read()
    
    # Replace malformed backtick-then-single-quote strings like `${API}/api/render'
    # with proper template literals `${API}/api/render`
    content = re.sub(r"`(\$\{API\}[^`]+)'", r"`\1`", content)
    
    with open(file, "w") as f:
        f.write(content)
