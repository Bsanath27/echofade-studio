import requests
data = {"num": 60.0, "bool": False, "str": "hello"}
req = requests.Request('POST', 'http://example.com', data=data, files={"file": ("test.jpg", b"123")})
prepped = req.prepare()
print(prepped.body.decode('utf-8', errors='ignore'))
