from enum import Enum


class SERVER_INFO(Enum):
    PLATFORM = "python"


SERVER_INFO.PLATFORM


ALLOWED_EXTENSION_METHODS = {
    "inject_properties",
    "on_start",
    "on_request_begin",
    "on_request_end",
    "on_error"
}
