import os
import sys
import threading
import pydantic
from typing import Any, Callable, Dict, List, Optional, Set, TypeVar, Generic, TypedDict
from viper.extensions.utils import Extensions
from viper.typing import ClientsType, TLSType
from viper.utils import Utils

T = TypeVar("T", bound=Dict[str, Any])


class OptionsType(TypedDict, total=False):
    tls: Optional[TLSType]
    port: Optional[int]
    backlog: Optional[int]
    clients: Optional[List[ClientsType]]


class Server(Generic[T]):
    def __init__(self, tls: Optional[TLSType] = None, host: Optional[str] = "localhost", port: Optional[int] = 2000, backlog: Optional[int] = 128, clients: Optional[List[ClientsType]] = None):
        self.tls = tls
        self.port = port or 2000
        self.host = host or "localhost"
        self.backlog = backlog or 128
        self.clients:  Dict[str, dict] = {}

        if isinstance(clients, list):
            for client in clients:

                if "secret_key" not in client:
                    raise ValueError("'name' is required for each client")

                elif client.get("secret_key") in self.clients:
                    raise ValueError(
                        f"Client cannot have the same secret_key: {client.get('secret_key')[:10]}...")

                self.clients[client.get('secret_key')] = client

        self._secret_trigger_handlers: dict[str, Callable] = {}
        self.triggers: Set[str] = set()
        self.global_middlewares: list[Callable] = []
        self.extensions = Extensions()
        self._schema = None
        self.schemas: dict[str, pydantic.BaseModel] = {}

    def on_trigger(self, trigger_name: str, handler: Optional[Callable[[Dict[str, Any]], Any]] = None, schema: pydantic.BaseModel = None):
        if schema:
            self.schemas[trigger_name] = schema

        def decorator(fn: Callable[[Dict[str, Any]], Any]):
            self.triggers.add(trigger_name)
            self._secret_trigger_handlers[trigger_name] = fn
            return fn

        return decorator if handler is None else decorator(handler)

    def register_trigger_definition(self, definition):
        triggers: Dict[str, list[Callable]] = definition.all()

        for name, handlers in triggers.items():
            handler, schema = handlers
            self.triggers.add(name)
            self._secret_trigger_handlers[name] = handler

            if schema:
                self.schemas[name] = schema

    def add_extension(self, *exts):
        for ext in exts:
            inject = getattr(ext, "inject_properties", None)

            if callable(inject):
                injected = inject(self)
                for key, value in injected.items():
                    setattr(self, key, value)

            self.extensions.use_extension(ext)

    def start(self, watch: bool = False) -> Callable[[Callable[[str], None]], Callable[[str], None]]:
        def decorator(func: Callable[[str], None]):
            if watch:
                def restart():
                    print("\n♻️ Restarting server...")
                    os.execv(sys.executable, [sys.executable] + sys.argv)

                threading.Thread(
                    target=Utils.start_file_watcher,
                    args=(restart,),
                    daemon=True
                ).start()

            def handle_incoming_request(payload: Dict[str, Any], reply: Callable[[bytes], None]):
                Utils.handle_request(self, payload, reply)

            server_config = {
                "port": self.port,
                "host": self.host,
                "tls": self.tls,
                "handler": handle_incoming_request,
            }

            Utils.start_server(self, server_config, func)
            return func

        self.extensions.trigger_hook("on_start", {"server": self})
        return decorator
