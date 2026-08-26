import httpx

def main():
    urls = [
        "http://127.0.0.1:8000/docs",
        "http://192.168.1.12:8000/docs"
    ]
    for url in urls:
        try:
            res = httpx.get(url, timeout=5.0)
            print(f"GET {url} -> Status: {res.status_code}")
        except Exception as e:
            print(f"GET {url} -> Failed: {e}")

if __name__ == "__main__":
    main()
