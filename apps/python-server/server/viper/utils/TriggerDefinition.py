from typing import Callable, Dict

import pydantic


class TriggerDefinition:
    def __init__(self):
        self.triggers: Dict[str, list[Callable]] = {}

    def __call__(self, name: str, schema: pydantic.BaseModel = None):
        # Makes the instance itself callable like a decorator
        return self.trigger(name, schema)

    def trigger(self, name: str, schema: pydantic.BaseModel = None):
        """Decorator to register a trigger by name."""
        def decorator(func: Callable):
            self.triggers[name] = [func, schema]
            return func
        
        return decorator

    def get(self, name: str) -> Callable:
        return self.triggers.get(name)

    def all(self) -> Dict[str, Callable]:
        return self.triggers
