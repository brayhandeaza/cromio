from typing import Any, Callable, Dict, Optional, Set
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer
import socket
import ssl
import json
import os
import sys
import gzip
import base64
import threading
from src.core.types import OptionsType, TLSType


class Server:
    def __init__(self, options: Optional[OptionsType] = {}):
        self._secret_options = options or {}
        self._secret_trigger_handlers: dict[str, Callable] = {}
        self.triggers: Set[str] = set()
        self.global_middlewares: list[Callable] = []
        self.logs = False
        self.Logs = None
        self.extensions = None
        self.port = 0
        self.clients = {}

    def on_trigger(self, trigger_name: str, handler: Optional[Callable[[Dict[str, Any]], Any]] = None):
        def decorator(fn: Callable[[Dict[str, Any]], Any]):
            self.triggers.add(trigger_name)
            self._secret_trigger_handlers[trigger_name] = fn
            return fn

        return decorator if handler is None else decorator(handler)

    def _handle_request(self, body: Dict[str, Any], reply: Callable[[bytes], None]):
        trigger_name = body.get("trigger")
        payload = body.get("payload", {})

        # Special: decompress Base64 gzip inside payload["message"] if present
        if "message" in payload and isinstance(payload["message"], str):
            try:
                decoded = base64.b64decode(payload["message"])
                decompressed = gzip.decompress(decoded)
                # Replace payload with decompressed JSON object if possible
                payload = json.loads(decompressed.decode("utf-8"))
            except Exception as e:
                print(f"❗ Error decompressing payload message: {e}")

        if not trigger_name or trigger_name not in self._secret_trigger_handlers:
            error = gzip.compress(json.dumps({
                "error": f"Unknown or missing trigger: {trigger_name}"
            }).encode("utf-8"))
            return reply(error)

        context = {
            "trigger": trigger_name,
            "body": payload,
        }

        try:
            for middleware in self.global_middlewares:
                middleware(context)

            result = self._secret_trigger_handlers[trigger_name](context)
            
            compressed = gzip.compress(json.dumps(
                {"data": result}).encode("utf-8")
            )

            return reply(compressed)

        except Exception as e:
            err = gzip.compress(json.dumps({"error": str(e)}).encode("utf-8"))
            return reply(err)

    def start(self) -> Callable[[Callable[[str], None]], Callable[[str], None]]:
        def decorator(func: Callable[[str], None]):
            def restart():
                print("♻️ Restarting server...")
                os.execv(sys.executable, [sys.executable] + sys.argv)

            threading.Thread(target=self._start_file_watcher,
                             args=(restart,), daemon=True).start()

            def handle_incoming_request(payload: Dict[str, Any], reply: Callable[[bytes], None]):
                self._handle_request(payload, reply)

            server_config = {
                "port": self._secret_options.get("port", 2000),
                "host": self._secret_options.get("host", "127.0.0.1"),
                "handler": handle_incoming_request
            }

            tls = self._secret_options.get("tls")
            if tls:
                server_config["tls"] = {
                    "key": tls.get("key", ""),
                    "cert": tls.get("cert", "")
                }
                self._create_https_server(server_config, lambda url: func(url))
            else:
                self._create_http_server(server_config, lambda url: func(url))

            return func

        return decorator

    def _create_https_server(self, options: OptionsType, callback: Callable[[str], None]) -> str:
        HOST, PORT = options["host"], options["port"]
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.verify_mode = ssl.CERT_NONE
        context.load_cert_chain(
            certfile=options["tls"]["cert"],
            keyfile=options["tls"]["key"]
        )

        with socket.socket(socket.AF_INET, socket.SOCK_STREAM, 0) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind((HOST, PORT))
            sock.listen(options.get("backlog", 128))

            url = f"https://{HOST}:{PORT}"
            callback(url)

            while True:
                try:
                    conn, addr = sock.accept()

                    try:
                        ssock = context.wrap_socket(conn, server_side=True)
                    except ssl.SSLError as ssl_error:
                        print(
                            f"❌ TLS handshake failed from {addr}: {ssl_error}")
                        conn.close()
                        continue

                    data = ssock.recv(65536)
                    if not data:
                        ssock.close()
                        continue

                    request_line, json_body, headers = self._parse_http_request(
                        data)
                    method = request_line[0] if request_line else None
                    if method != "POST":
                        ssock.close()
                        continue

                    self._handle_request(
                        json_body or {},
                        lambda res: ssock.send(self._format_http_response(res))
                    )
                    ssock.close()

                except Exception as e:
                    print(f"‼️ Error handling new connection: {e}")

        return url

    def _create_http_server(self, options: OptionsType, callback: Callable[[str], None]) -> str:
        HOST, PORT = options.get("host", "0.0.0.0"), options.get("port", 2000)

        with socket.socket(socket.AF_INET, socket.SOCK_STREAM, 0) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind((HOST, PORT))
            sock.listen(options.get("backlog", 128))

            url = f"http://{HOST}:{PORT}"
            callback(url)

            while True:
                conn, addr = sock.accept()
                try:
                    first_byte = conn.recv(1, socket.MSG_PEEK)
                    if first_byte == b"\x16":  # TLS handshake
                        continue

                    data = conn.recv(65536)
                    if not data:
                        continue

                    request_line, json_body, headers = self._parse_http_request(
                        data)
                    method = request_line[0] if request_line else None
                    if method != "POST":
                        continue

                    self._handle_request(json_body or {}, lambda res: conn.send(
                        self._format_http_response(res)))
                except Exception as e:
                    print(f"❗ Error handling request from {addr}: {e}")
                finally:
                    conn.close()

        return url

    def _parse_http_request(self, data_bytes: bytes) -> tuple[Any, Any, Any]:
        try:
            parts = data_bytes.split(b"\r\n\r\n", 1)
            if len(parts) < 2:
                print("⚠️ Incomplete HTTP request received")
                return [None, None, None], {}, {}

            headers_part, body_part = parts
            header_lines = headers_part.decode(
                "utf-8", errors="replace").split("\r\n")
            request_line = header_lines[0].split()

            headers = {}
            for line in header_lines[1:]:
                if ": " in line:
                    k, v = line.split(": ", 1)
                    headers[k.lower()] = v

            json_body = {}
            try:
                # Detect gzip by magic number
                is_gzip = body_part[:2] == b"\x1f\x8b"

                if is_gzip:
                    decompressed = gzip.decompress(body_part)
                    json_body = json.loads(decompressed.decode("utf-8"))
                else:
                    json_body = json.loads(body_part.decode("utf-8"))
            except Exception as e:
                print(f"❌ Error decoding request body: {e}")
                json_body = {}

            return request_line, json_body, headers
        except Exception as e:
            print(f"‼️ Unexpected error parsing HTTP request: {e}")
            return [None, None, None], {}, {}

    def _format_http_response(self, body: bytes) -> bytes:
        # body is already gzip compressed bytes from _handle_request
        return (
            "HTTP/1.1 200 OK\r\n"
            f"Content-Length: {len(body)}\r\n"
            "Content-Type: application/json\r\n"
            "Content-Encoding: gzip\r\n"
            "Connection: close\r\n"
            "\r\n"
        ).encode("utf-8") + body

    def _start_file_watcher(self, restart_callback: Callable[[], None]):
        class _ReloadHandler(FileSystemEventHandler):
            def on_any_event(self, event):
                if event.src_path.endswith(".py"):
                    print(f"🔄 Change detected: {event.src_path}")
                    restart_callback()

        observer = Observer()
        handler = _ReloadHandler()
        observer.schedule(handler, path=".", recursive=True)
        observer.start()
