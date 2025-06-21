from typing import Any, Dict, List, Optional, Set, TypedDict


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


    
class OnTriggerType(TypedDict):
    body: Dict[str, Any]
    credentials: Dict[str, Any]
    trigger: str

