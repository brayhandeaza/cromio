from typing import Callable, Dict


class TriggerDefinition:
    def __init__(self):
        self.triggers: Dict[str, Callable] = {}
        
    def __call__(self, name: str):
        # Makes the instance itself callable like a decorator
        return self.trigger(name)

    def trigger(self, name: str):
        """Decorator to register a trigger by name."""
        def decorator(func: Callable):
            self.triggers[name] = func
            return func
        return decorator

    def get(self, name: str) -> Callable:
        return self.triggers.get(name)

    def all(self) -> Dict[str, Callable]:
        return self.triggers



    
    