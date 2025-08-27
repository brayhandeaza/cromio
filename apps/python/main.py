from src.cromio.server import Server


server = Server()


@server.on_trigger("div")
def div(ctx: dict):
    body = ctx["body"]
    return body["num1"] / body["num2"]

@server.start(watch=True)
def start(url: str):
    print("Server started", url)
