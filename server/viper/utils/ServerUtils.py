import pydantic
import socket
import ssl
import json
import gzip
import base64
import time
from typing import Any, Callable, Dict, Optional
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer
from viper.typing import OnTriggerType, OptionsType, CredentialsType


class ServerUtils:
    @staticmethod
    def combine_schema_with_core_schema(schema: pydantic.BaseModel):
        class CoreSchema(pydantic.BaseModel):
            language: str
            ip: str
            secret_key: Optional[str] = None

        if schema:
            class CoreSchema(pydantic.BaseModel):
                language: str
                ip: str

            class Schema(CoreSchema, schema):
                pass

            return Schema

        return CoreSchema

    @staticmethod
    def _validate_schema(server, trigger_name: str, payload: dict):
        schema = server.schemas.get(trigger_name)
        Schemas = ServerUtils.combine_schema_with_core_schema(schema)

        if Schemas:
            try:
                Schemas(**payload)
                return None
            except pydantic.ValidationError as e:
                error_messages = {
                    ".".join(str(i) for i in err["loc"]): err["msg"] for err in e.errors()
                }
                return {"error": {"messages": error_messages}}
        return None

    @staticmethod
    def _format_http_response(body: bytes) -> bytes:
        return (
            "HTTP/1.1 200 OK\r\n"
            f"Content-Length: {len(body)}\r\n"
            "Content-Type: application/json\r\n"
            "Content-Encoding: gzip\r\n"
            "Connection: close\r\n"
            "\r\n"
        ).encode("utf-8") + body

    @staticmethod
    def _parse_http_request(data_bytes: bytes) -> tuple[Any, Any, Any]:
        try:
            parts = data_bytes.split(b"\r\n\r\n", 1)
            if len(parts) < 2:
                print("⚠️ Incomplete HTTP request received")
                return [None, None, None], {}, {}

            headers_part, body_part = parts
            header_lines = headers_part.decode(
                "utf-8", errors="replace").split("\r\n")
            request_line = header_lines[0].split()
            headers = {
                k.lower(): v
                for line in header_lines[1:]
                if ": " in line
                for k, v in [line.split(": ", 1)]
            }

            is_gzip = body_part[:2] == b"\x1f\x8b"
            try:
                body = gzip.decompress(body_part) if is_gzip else body_part
                json_body = json.loads(body.decode("utf-8"))
            except Exception as e:
                print(f"❌ Error decoding request body: {e}")
                json_body = {}

            return request_line, json_body, headers
        except Exception as e:
            print(f"‼️ Unexpected error parsing HTTP request: {e}")
            return [None, None, None], {}, {}

    @staticmethod
    def start_file_watcher(restart_callback: Callable[[], None]):
        class ReloadHandler(FileSystemEventHandler):
            def on_any_event(self, event):
                if event.src_path.endswith(".py"):
                    print(f"🔄 Change detected: {event.src_path}")
                    restart_callback()

        observer = Observer()
        handler = ReloadHandler()
        observer.schedule(handler, path=".", recursive=True)
        observer.start()

    @staticmethod
    def validate_credentials(credentials: CredentialsType, server: Any) -> dict:
        if bool(server.clients) is False:
            return {
                "client": None,
                "passed": True,
                "message": None,
            }

        ip = credentials.get("ip", "*")
        language = credentials.get("language", "*")

        secret_key = credentials.get(
            "secretKey" if language == "nodejs" else "secret_key", None
        )

        client = server.clients.get(secret_key, None)
        client_ip = client.get("ip", "*")
        client_language = client.get("language", None)
        client_secret_key = client.get("secret_key", None)

        if (not client):
            return {
                "passed": False,
                "message": f"🚫 Authentication Failed: Client with ip={ip} not found in the list of authorized clients",
            }

        if (client_language != language and client_language != "*"):
            return {
                "passed": False,
                "message": f"🚫 Invalid Language: '{language}' is not allowed for ip={ip} — expected '{client.get("language")}'",
            }

        if (client_ip != ip and client_ip != "*"):
            return {
                "passed": False,
                "message": f"🚫 Authentication Failed: Client with ip={ip} not authorized to access the server",
            }

        if (client_secret_key != secret_key):
            return {
                "passed": False,
                "message": f"🚫 Authentication Failed: Client at ip={ip} provided an invalid {'secretKey' if language == 'nodejs' else 'secret_key'}",
            }

        return {
            "client": client,
            "passed": True,
            "message": None,
        }

    @staticmethod
    def handle_request(server, body: Dict[str, Any], reply: Callable[[bytes], None]):
        start = time.perf_counter()
        trigger_name = body.get("trigger", "")
        payload = body.get("payload", {})
        credentials = body.get("credentials", {})

        auth = ServerUtils.validate_credentials(credentials, server)
        if auth.get("passed", False):
            has_error = ServerUtils._validate_schema(
                server,
                trigger_name,
                payload={
                    **credentials,
                    **payload
                }
            )
            if has_error:
                server.extensions.trigger_hook("on_error", {
                    "request": {
                        "trigger": trigger_name,
                        "body": payload,
                        "client": {
                            "ip": credentials.get("ip"),
                            "language": credentials.get("language")
                        }
                    },
                    "server": server,
                    "error": has_error
                })
                return reply(gzip.compress(json.dumps(has_error).encode("utf-8")))

            if "message" in payload and isinstance(payload["message"], str):
                try:
                    decoded = base64.b64decode(payload["message"])
                    payload = json.loads(
                        gzip.decompress(decoded).decode("utf-8"))
                except Exception as e:
                    server.extensions.trigger_hook("on_error", {
                        "request": {
                            "trigger": trigger_name,
                            "body": payload,
                            "client": {
                                "ip": credentials.get("ip"),
                                "language": credentials.get("language")
                            }
                        },
                        "server": server,
                        "error": f"Error decompressing payload message: {e}"
                    })
                    print(f"❗ Error decompressing payload message: {e}")

            if not trigger_name or trigger_name not in server._secret_trigger_handlers:
                server.extensions.trigger_hook("on_error", {
                    "request": {
                        "trigger": trigger_name,
                        "body": payload,
                        "client": {
                            "ip": credentials.get("ip"),
                            "language": credentials.get("language")
                        }
                    },
                    "server": server,
                    "error": f"Unknown or missing trigger: {trigger_name}"
                })
                return reply(gzip.compress(json.dumps({"error": f"Unknown or missing trigger: {trigger_name}"}).encode("utf-8")))

            context = OnTriggerType(
                trigger=trigger_name, body=payload, credentials=credentials, server=server
            )

            server.extensions.trigger_hook("on_request_begin", {
                "request": {
                    "trigger": trigger_name,
                    "body": payload,
                    "client": {
                        "ip": credentials.get("ip"),
                        "language": credentials.get("language")
                    }
                },
                "server": server
            })

            try:
                for middleware in server.global_middlewares:
                    middleware(context)

                result = server._secret_trigger_handlers[trigger_name](context)
                compressed = gzip.compress(json.dumps(
                    {"data": result}).encode("utf-8"))

                server.extensions.trigger_hook("on_request_end", {
                    "request": {
                        "trigger": trigger_name,
                        "client": {
                            "ip": credentials.get("ip"),
                            "language": credentials.get("language")
                        },
                        "body": payload,
                    },
                    "server": server,
                    "response": {
                        "status": 200,
                        "data": result,
                        "performance": {
                            "size": len(compressed),
                            "time": time.perf_counter() - start
                        }
                    }
                })

                return reply(compressed)
            except Exception as e:
                server.extensions.trigger_hook("on_error", {
                    "request": {
                        "trigger": trigger_name,
                        "body": payload,
                        "client": {
                            "ip": credentials.get("ip"),
                            "language": credentials.get("language")
                        },
                    },
                    "server": server,
                    "error": str(e)
                })
                return reply(gzip.compress(json.dumps({"error": str(e)}).encode("utf-8")))

        else:
            message = auth.get("message")
            server.extensions.trigger_hook("on_error", {
                "request": {
                    "trigger": trigger_name,
                    "body": payload,
                    "client": {}
                },
                "server": server,
                "error": message
            })
            return reply(gzip.compress(json.dumps({"error": message}).encode("utf-8")))

    @staticmethod
    def start_server(server: Any, options: OptionsType, callback: Callable[[str], None]):
        HOST, PORT = options.get("host", "0.0.0.0"), options.get("port", 2000)
        is_tls = options.get("tls") is not None

        def serve(sock):
            url = f"{'https' if is_tls else 'http'}://{HOST}:{PORT}"
            callback(url)

            while True:
                try:
                    conn, addr = sock.accept()
                except Exception:
                    continue

                try:
                    if is_tls:
                        try:
                            conn = context.wrap_socket(conn, server_side=True)
                        except ssl.SSLError:
                            # TLS handshake failed — cannot send response
                            conn.close()
                            continue

                    else:
                        try:
                            first_byte = conn.recv(1, socket.MSG_PEEK)
                            if first_byte == b"\x16":
                                # TLS connection attempt to non-TLS server
                                conn.close()
                                continue
                        except Exception:
                            conn.close()
                            continue

                    data = conn.recv(65536)
                    if not data:
                        conn.close()
                        continue

                    request_line, json_body, headers = ServerUtils._parse_http_request(
                        data)
                    if request_line[0] != "POST":
                        conn.close()
                        continue

                    ServerUtils.handle_request(server, json_body or {}, lambda res: conn.send(
                        ServerUtils._format_http_response(res))
                    )

                except Exception as e:
                    try:
                        conn.send(
                            ServerUtils._format_http_response(
                                gzip.compress(json.dumps(
                                    {"error": f"Internal server error: {str(e)}"}
                                ).encode("utf-8"))
                            )
                        )
                    except Exception:
                        pass
                finally:
                    try:
                        conn.close()
                    except Exception:
                        pass

        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM, 0)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind((HOST, PORT))
        sock.listen(options.get("backlog", 128))

        if is_tls:
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            context.verify_mode = ssl.CERT_NONE
            context.load_cert_chain(
                certfile=options["tls"]["cert"],
                keyfile=options["tls"]["key"]
            )

        serve(sock)
