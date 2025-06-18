from typing import Callable, Optional
import os
import sys
import threading
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from src.core.utils import OptionsType, ServerDefinition


class _ReloadHandler(FileSystemEventHandler):
    def __init__(self, restart_callback: Callable[[], None]):
        self.restart_callback = restart_callback

    def on_any_event(self, event):
        if event.src_path.endswith(".py"):
            print(f"🔄 Change detected: {event.src_path}")
            self.restart_callback()


def _start_file_watcher(restart_callback: Callable[[], None]):
    observer = Observer()
    handler = _ReloadHandler(restart_callback)
    observer.schedule(handler, path=".", recursive=True)
    observer.start()


class Server:
    def __init__(self, options: Optional[OptionsType] = {}):
        self._secret_options = options

    def start(self) -> Callable[[Callable[[str], None]], Callable[[str], None]]:
        def decorator(func: Callable[[str], None]):
            # Hot reload support
            def restart():
                print("♻️ Restarting server...")
                os.execv(sys.executable, [sys.executable] + sys.argv)

            threading.Thread(
                target=_start_file_watcher,
                args=(restart,),
                daemon=True
            ).start()

            tls = self._secret_options.get("tls")

            if not tls:
                ServerDefinition.create_http_server(
                    {
                        "port": self._secret_options.get("port", 2000),
                        "host": self._secret_options.get("host", "127.0.0.1"),
                    },
                    lambda url: func(url),
                )
            else:
                ServerDefinition.create_https_server(
                    {
                        "port": self._secret_options.get("port", 2000),
                        "host": self._secret_options.get("host", "127.0.0.1"),
                        "tls": {
                            "key": tls.get("key", ""),
                            "cert": tls.get("cert", "")
                        },
                    },
                    lambda url: func(url),
                )

            return func

        return decorator
