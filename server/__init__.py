from src.core import Server


# Example usage
server = Server({
    "tls": {
        # "key": "../key.pem", "cert": "../cert.pem"
    }
})


@server.start()
def callback(url: str):
    print(f"🚀 Server is running at: {url}")
