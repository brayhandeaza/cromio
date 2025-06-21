from src.typing import OnTriggerType
from src import Server
from src.utils.TriggerDefinition import TriggerDefinition

calculator = TriggerDefinition()


@calculator("add")
def sum(ctx: OnTriggerType):
    a = ctx.get("body").get("num1", 0)
    b = ctx.get("body").get("num2", 0)

    return a - b


server = Server()
server.register_trigger_definition(calculator)


# 5. Start server
@server.start()
def callback(url: str):
    print(f"🚀 Server is running at: {url}")
