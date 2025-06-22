import pydantic
from typing import Any, Callable, Dict, Optional, Set, TypeVar, Generic
from viper.constants import ALLOWED_EXTENSION_METHODS
from viper.extensions import Extensions
from viper.typing import OptionsType
from viper.utils import Utils

T = TypeVar("T", bound=Dict[str, Any])


class Server(Generic[T]):
    def __init__(self, options: Optional[OptionsType] = {}):
        self._secret_options = options or {}
        self._secret_trigger_handlers: dict[str, Callable] = {}
        self.triggers: Set[str] = set()
        self.global_middlewares: list[Callable] = []
        self.extensions = Extensions()
        self.port = options.get("port", 2000)
        self.clients = options.get("clients", [])
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

    def add_extension(self, ext):
        # user_methods = {
        #     name for name in dir(ext)
        #     if callable(getattr(ext, name)) and not name.startswith("__")
        # }

        # extra_methods = user_methods - ALLOWED_EXTENSION_METHODS
        # if extra_methods:
        #     raise ValueError(
        #         f"Invalid extension methods {', '.join(extra_methods)}")

        inject = getattr(ext, "inject_properties", None)
        if callable(inject):
            injected = inject(self)
            for key, value in injected.items():
                setattr(self, key, value)

        self.extensions.use_extension(ext)

    def start(self) -> Callable[[Callable[[str], None]], Callable[[str], None]]:
        def decorator(func: Callable[[str], None]):
            def handle_incoming_request(payload: Dict[str, Any], reply: Callable[[bytes], None]):
                Utils.handle_request(self, payload, reply)

            server_config = {
                "port": self._secret_options.get("port", 2000),
                "host": self._secret_options.get("host", "127.0.0.1"),
                "handler": handle_incoming_request,
                "tls": self._secret_options.get("tls")
            }

            Utils.start_server(self, server_config, func)
            return func

        self.extensions.trigger_hook("on_start", {"server": self})
        return decorator
