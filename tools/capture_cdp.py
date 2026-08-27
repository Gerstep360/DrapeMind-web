"""Capture a deterministic responsive screenshot from a Chromium CDP endpoint."""

import argparse
import base64
import json
import time
import urllib.request
from pathlib import Path

from websockets.sync.client import connect


def discover_page(port: int) -> str:
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list", timeout=1) as response:
                pages = json.load(response)
            page = next(item for item in pages if item["type"] == "page")
            return page["webSocketDebuggerUrl"]
        except (OSError, StopIteration):
            time.sleep(0.25)
    raise RuntimeError("CDP did not expose a page before the timeout")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--url", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--width", type=int, default=390)
    parser.add_argument("--height", type=int, default=844)
    parser.add_argument("--login", action="store_true")
    parser.add_argument("--post-login-url")
    parser.add_argument("--ai-message")
    args = parser.parse_args()

    sequence = 0
    browser_events: list[dict] = []
    with connect(discover_page(args.port), max_size=None) as socket:
        def command(method: str, params: dict | None = None) -> dict:
            nonlocal sequence
            sequence += 1
            socket.send(json.dumps({"id": sequence, "method": method, "params": params or {}}))
            while True:
                message = json.loads(socket.recv())
                if message.get("id") == sequence:
                    if "error" in message:
                        raise RuntimeError(message["error"])
                    return message.get("result", {})
                browser_events.append(message)

        command("Page.enable")
        command("Runtime.enable")
        command(
            "Emulation.setDeviceMetricsOverride",
            {
                "width": args.width,
                "height": args.height,
                "deviceScaleFactor": 1,
                "mobile": True,
            },
        )
        command("Page.navigate", {"url": args.url})
        time.sleep(3)
        if args.login:
            command(
                "Runtime.evaluate",
                {
                    "expression": """
                        (() => {
                          const setValue = (id, value) => {
                            const input = document.getElementById(id);
                            const setter = Object.getOwnPropertyDescriptor(
                              HTMLInputElement.prototype, 'value'
                            ).set;
                            setter.call(input, value);
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                          };
                          setValue('email', 'admin@drapemind.local');
                          setValue('password', 'visual-password');
                          document.querySelector('form button[type=submit]').click();
                        })()
                    """,
                },
            )
            time.sleep(3)
            if args.post_login_url:
                command("Page.navigate", {"url": args.post_login_url})
                time.sleep(3)
            if args.ai_message:
                command(
                    "Runtime.evaluate",
                    {
                        "expression": f"""
                            (() => {{
                              const input = document.getElementById('ai-prompt');
                              const setter = Object.getOwnPropertyDescriptor(
                                HTMLTextAreaElement.prototype, 'value'
                              ).set;
                              setter.call(input, {json.dumps(args.ai_message)});
                              input.dispatchEvent(new Event('input', {{ bubbles: true }}));
                              input.focus();
                            }})()
                        """,
                    },
                )
                time.sleep(0.5)
                command(
                    "Input.dispatchKeyEvent",
                    {
                        "type": "keyDown",
                        "key": "Enter",
                        "code": "Enter",
                        "windowsVirtualKeyCode": 13,
                        "nativeVirtualKeyCode": 13,
                    },
                )
                command(
                    "Input.dispatchKeyEvent",
                    {
                        "type": "keyUp",
                        "key": "Enter",
                        "code": "Enter",
                        "windowsVirtualKeyCode": 13,
                        "nativeVirtualKeyCode": 13,
                    },
                )
                time.sleep(3)
        command("Runtime.evaluate", {"expression": "window.scrollTo(0, 0)"})
        time.sleep(0.2)
        metrics = command(
            "Runtime.evaluate",
            {
                "expression": (
                    "JSON.stringify({innerWidth,innerHeight,scrollY,"
                    "scrollWidth:document.documentElement.scrollWidth,"
                    "scrollHeight:document.documentElement.scrollHeight,"
                    "href:location.href,"
                    "navigationType:performance.getEntriesByType('navigation')[0]?.type,"
                    "messageCount:document.querySelectorAll('.message').length,"
                    "toolCount:document.querySelectorAll('.tool-rail li').length})"
                ),
                "returnByValue": True,
            },
        )
        screenshot = command(
            "Page.captureScreenshot",
            {"format": "png", "fromSurface": True, "captureBeyondViewport": False},
        )
        args.output.write_bytes(base64.b64decode(screenshot["data"]))
        print(metrics["result"]["value"])
        exceptions = [
            event.get("params", {}).get("exceptionDetails", {})
            for event in browser_events
            if event.get("method") == "Runtime.exceptionThrown"
        ]
        if exceptions:
            print(json.dumps({"exceptions": exceptions}))
        try:
            command("Browser.close")
        except Exception:
            pass


if __name__ == "__main__":
    main()
