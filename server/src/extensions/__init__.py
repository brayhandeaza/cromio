from typing import Dict, List, Any, Protocol, runtime_checkable


class Extension:
    def inject_properties(self, server):
        return {"log": lambda msg: print(f"[LOG] {msg}")}

    def on_start(self, context):
        pass

    def on_request_begin(self, context):
        pass

    def on_request_end(self, context):
        pass

    def on_error(self, context):
        pass


@runtime_checkable
class ExtensionSpec(Protocol):
    def inject_properties(self, server): ...
    def on_start(self, context): ...
    def on_request_begin(self, context): ...
    def on_request_end(self, context): ...
    def on_error(self, context): ...


class Extensions:
    def __init__(self) -> None:
        self.extensions: List[Any] = []

    def use_extension(self, ext: Any) -> None:
        self.extensions.append(ext)

    def trigger_hook(self, name: str, context: Dict[str, Any] = {}) -> None:
        for ext in self.extensions:
            hook = getattr(ext, name, None)
            if callable(hook):
                hook(dict(context))  # pass a shallow copy
