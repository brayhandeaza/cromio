from pydantic import BaseModel
from src.core.extensions import Extension
from src.core import Server


class LoggerExtension(Extension):
    def inject_properties(self, server):
        return {
            "age": 10,
            "log": lambda msg: print(f"[LOG] {msg}")
        }


# Example usage
server = Server()

# Add LoggerExtension
server.add_extension(LoggerExtension())


class UserSchema(BaseModel):
    num1: int
    num2: int


@server.on_trigger("add", schema=UserSchema)
def sum(ctx: dict):
    body: dict = ctx.get("body", {})

    server.age = 20 + server.age
    server.log(f"Hello {server.age}")  # [LOG] Hello

    a = body.get("num1", 0)
    b = body.get("num2", 0)

    return a + b


@server.start()
def callback(url: str):
    print(f"🚀 Server is running at: {url}")
