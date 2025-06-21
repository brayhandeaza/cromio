from typing import Any, Dict, List, Optional, TYPE_CHECKING, TypedDict, Generic, TypeVar

if TYPE_CHECKING:
    from src import Server  # Only for type hints, not actual import
    
    # TypeVar for body schema
T = TypeVar("T", bound=Dict[str, Any])

class TLSType(TypedDict):
    cert: str
    key: str
    
class Clients(TypedDict):
    name: Optional[str]
    language: Optional[str]
    ip: Optional[str]


class OptionsType(TypedDict, total=False):
    tls: Optional[TLSType]
    port: Optional[int]
    backlog: Optional[int]
    clients: Optional[List[Clients]]

class CredentialsType(TypedDict):
    secret_key: Optional[str]
    language: Optional[str]
    ip: Optional[str]
    

class OnTriggerType(TypedDict):
    body: dict
    credentials: dict
    trigger: str
    server: 'Server[T]'