import requests
res = requests.get("http://127.0.0.1:8000/api/search-lyrics", params={"q": "Without Me Eminem"})
results = res.json().get("results", [])
for r in results[:5]:
    print(f"Artist: {r.get('artistName')}, Title: {r.get('trackName')}, Has Synced: {bool(r.get('syncedLyrics'))}")
