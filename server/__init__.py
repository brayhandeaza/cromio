import json
from src.core import Server


# Example usage
server = Server({
    # "tls": {
    #     "key": "./server.key",
    #     "cert": "./server.crt"
    # }
})


@server.on_trigger("add")
def sum(ctx: dict):
    body: dict = ctx.get("payload", {})
    
    
    a = body.get("num1", 0)
    b = body.get("num2", 0)
    
    print(f"Adding {a} + {b}")
    return a + b

@server.start()
def callback(url: str):
    print(f"🚀 Server is running at: {url}")
