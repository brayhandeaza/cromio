from src import Server


server = Server()


@server.on_trigger("add")
def sum(ctx: dict):
    body: dict = ctx.get("body", {})

    a = body.get("num1", 0)
    b = body.get("num2", 0)

    return a + b


@server.start()
def callback(url: str):
    print(f"🚀 Server is running at: {url}")
