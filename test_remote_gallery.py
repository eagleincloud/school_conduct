import requests

def main():
    base_url = "http://13.233.140.195/api/"
    
    # 1. Login
    print("Logging in to remote server...")
    login_res = requests.post(f"{base_url}auth/login/", json={
        "username": "shiv",
        "password": "admin123"
    })
    
    if login_res.status_code != 200:
        print(f"Login failed: {login_res.status_code}")
        print(login_res.text)
        return
        
    data = login_res.json()
    token = data.get("access")
    print(f"Login successful. Token starts with: {token[:15]}...")
    
    # 2. Get Gallery list
    print("\nFetching gallery images list...")
    headers = {"Authorization": f"Bearer {token}"}
    gallery_res = requests.get(f"{base_url}gallery/", headers=headers)
    
    if gallery_res.status_code != 200:
        print(f"Gallery fetch failed: {gallery_res.status_code}")
        print(gallery_res.text)
        return
        
    images = gallery_res.json()
    print(f"Found {len(images)} images in gallery.")
    for img in images:
        print(f"ID: {img['id']} | Title: {img['title']} | Image URL: {img['image_url']}")
        
        # 3. Test fetching the image
        img_url = f"{img['image_url']}?token={token}"
        print(f"  Testing GET: {img_url}")
        test_res = requests.get(img_url)
        print(f"  Response status: {test_res.status_code}")
        print(f"  Response content-type: {test_res.headers.get('Content-Type')}")
        print(f"  Response length: {len(test_res.content)} bytes")
        if test_res.status_code != 200:
            print(f"  Response text snippet: {test_res.text[:150]}")

if __name__ == "__main__":
    main()
