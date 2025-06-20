from typing import Any, Awaitable, Callable, Dict, Literal, Optional, TypedDict


class CredentialsType(TypedDict):
    ip: Optional[str]
    language: Optional[Literal['nodejs', 'python', '*']]


class ClientType(CredentialsType, total=False):
    name: Optional[str]


ClientType = Dict[str, Any]

TriggerHandler = Dict[str, Callable[
    [Any, ClientType, Callable[[Any], None]],
    Awaitable[Any]
]]
