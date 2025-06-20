from typing import Any, Callable, Dict, Optional, Set, TypedDict


class TLSType(TypedDict):
    cert: str
    key: str


class OptionsType(TypedDict, total=False):
    host: Optional[str]
    port: Optional[int]
    backlog: Optional[int]
    tls: Optional[TLSType]

