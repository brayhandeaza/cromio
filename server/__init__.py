from src.core import Server


class LoggerExtension:
    def inject_properties(self, server):
        return {"log": lambda msg: print(f"[LOG] {msg}")}

    def on_request_begin(self, context):
        print("Request started")


# Example usage
server = Server()

server.add_extension(LoggerExtension())


@server.on_trigger("add")
def sum(ctx: dict):
    body: dict = ctx.get("body", {})
    
    server.log(f"Hello")  # [LOG] Hello

    a = body.get("num1", 0)
    b = body.get("num2", 0)

    return a + b


@server.start()
def callback(url: str):
    print(f"🚀 Server is running at: {url}")
