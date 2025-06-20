from typing import Any, Callable, TypedDict, Optional
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer
import socket
import ssl
import json


class TLSType(TypedDict):
    cert: str
    key: str


class OptionsType(TypedDict, total=False):
    host: Optional[str]
    port: Optional[int]
    backlog: Optional[int]
    tls: Optional[TLSType]


class ServerDefinition:
    @staticmethod
    def create_https_server(options: OptionsType, callback: Callable[[str], None]) -> str:
        HOST, PORT = options["host"], options["port"]

        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(
            certfile=options.get("tls").get("cert"),
            keyfile=options.get("tls").get("key"),
        )

        with socket.socket(socket.AF_INET, socket.SOCK_STREAM, 0) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind((HOST, PORT))
            sock.listen(options.get("backlog", 128))

            url = f"https://{HOST}:{PORT}"
            callback(url)

            with context.wrap_socket(sock, server_side=True) as ssock:
                while True:
                    conn, addr = ssock.accept()
                    try:
                        data = conn.recv(4096)
                        if not data:
                            continue

                        request_line, body = ServerDefinition.parse_http_request(
                            data
                        )

                        method = request_line[0]
                        if method != "POST":
                            continue

                        print(json.dumps({"body": body},  indent=4))

                        response_body = "Received your request.\n"
                        response = (
                            "HTTP/1.1 200 OK\r\n"
                            f"Content-Length: {len(response_body)}\r\n"
                            "Content-Type: text/plain\r\n"
                            "Connection: close\r\n"
                            "\r\n" + response_body
                        )
                        conn.send(response.encode("utf-8"))

                    except Exception as e:
                        print(f"❗ Error handling request from {addr}: {e}")
                    finally:
                        conn.close()

        return url

    @staticmethod
    def create_http_server(options: OptionsType, callback: Callable[[str], None]) -> str:
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
                    if first_byte == b"\x16":
                        continue

                    data = conn.recv(4096)
                    if not data:
                        continue

                    request_line, headers, json_body = ServerDefinition.parse_http_request(
                        data
                    )

                    method = request_line[0]
                    if method != "POST":
                        continue

                    print(
                        json.dumps(
                            {
                                "request_line": request_line,
                                "headers": headers,
                                "json_body": json_body,
                            },
                            indent=4,
                        )
                    )

                    response_body = "Received your request.\n"
                    response = (
                        "HTTP/1.1 200 OK\r\n"
                        f"Content-Length: {len(response_body)}\r\n"
                        "Content-Type: text/plain\r\n"
                        "Connection: close\r\n"
                        "\r\n" + response_body
                    )
                    conn.send(response.encode("utf-8"))

                except Exception as e:
                    print(f"❗ Error handling request from {addr}: {e}")

                finally:
                    conn.close()

        return url

    @staticmethod
    def parse_http_request(data_bytes: bytes) -> tuple[Any, ...]:
        try:
            data = data_bytes.decode("utf-8")

            # Split headers and body
            parts = data.split("\r\n\r\n", 1)
            body_part = parts[1] if len(parts) > 1 else ""
            header_part = parts[0]

            # Split request line and headers
            lines = header_part.split("\r\n")
            request_line = lines[0]
            header_lines = lines[1:]

            # Parse request line
            method, path, http_version = request_line.split()

            # Parse headers into dict
            headers = {}
            for line in header_lines:
                if ": " in line:
                    key, val = line.split(": ", 1)
                    headers[key.lower()] = val.strip()

            # Parse JSON body if applicable
            json_body = None
            if headers.get("content-type", "").startswith("application/json") and body_part:
                json_body = json.loads(body_part)

            return [method, path, http_version], json_body, headers

        except (UnicodeDecodeError, ValueError, json.JSONDecodeError) as e:
            return [None, None, None], None, None





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