from typing import Callable, Dict, List, Any


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
