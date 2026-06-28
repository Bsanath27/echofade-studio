import os
import urllib.request
import ssl

def download_font():
    font_dir = "backend"
    if not os.path.exists(font_dir):
        os.makedirs(font_dir)
        
    font_url = "https://raw.githubusercontent.com/JulietaUla/Montserrat/master/fonts/ttf/Montserrat-Bold.ttf"
    font_path = os.path.join(font_dir, "Montserrat-Bold.ttf")
    
    print("Downloading Montserrat-Bold.ttf...")
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    with urllib.request.urlopen(font_url, context=ctx) as response, open(font_path, 'wb') as out_file:
        out_file.write(response.read())
        
    print(f"Font saved to {font_path}")

if __name__ == "__main__":
    download_font()
