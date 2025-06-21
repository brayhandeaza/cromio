from src.typing import OnTriggerType
from src.extensions import Extension
from src import Server



# 2. Logger Extension
class LoggerExtension(Extension):
    def inject_properties(self, server):    
        return {
            "age": 10,
            "log": lambda msg: print(f"[LOG] {msg}")
        }


server = Server()


@server.on_trigger("add")
def sum(ctx: OnTriggerType):
    a = ctx.get("body").get("num1", 0)
    b = ctx.get("body").get("num2", 0)
    
    

    return a + b


# 5. Start server
@server.start()
def callback(url: str):
    print(f"🚀 Server is running at: {url}")
