#!/usr/bin/env python3
"""Ponte WebSocket: ACR122U -> frontend da cantina."""

from __future__ import annotations

import asyncio
import json
import threading
import time

import websockets

from reader import find_acr_reader, poll_cards

HOST = "127.0.0.1"
PORT = 8765
DEBOUNCE_SEC = 2.0


class RfidBridge:
    def __init__(self) -> None:
        self.clients: set = set()
        self.loop: asyncio.AbstractEventLoop | None = None
        self.running = True
        self.last_uid: str | None = None
        self.last_time = 0.0
        self.reader_name: str | None = None

    def reader_status(self) -> dict:
        reader = find_acr_reader()
        self.reader_name = str(reader) if reader else None
        return {
            "type": "status",
            "connected": reader is not None,
            "reader": self.reader_name,
        }

    async def register(self, websocket) -> None:
        self.clients.add(websocket)
        await websocket.send(json.dumps(self.reader_status()))
        try:
            await websocket.wait_closed()
        finally:
            self.clients.discard(websocket)

    async def broadcast(self, payload: dict) -> None:
        if not self.clients:
            return
        message = json.dumps(payload)
        dead = []
        for client in self.clients:
            try:
                await client.send(message)
            except Exception:
                dead.append(client)
        for client in dead:
            self.clients.discard(client)

    def on_card(self, uid: str) -> None:
        now = time.time()
        if uid == self.last_uid and now - self.last_time < DEBOUNCE_SEC:
            return
        self.last_uid = uid
        self.last_time = now
        if self.loop:
            asyncio.run_coroutine_threadsafe(
                self.broadcast({"type": "card", "uid": uid}),
                self.loop,
            )

    def status_loop(self) -> None:
        while self.running:
            payload = self.reader_status()
            if self.loop:
                asyncio.run_coroutine_threadsafe(self.broadcast(payload), self.loop)
            time.sleep(3)

    def should_run(self) -> bool:
        return self.running


async def main() -> None:
    bridge = RfidBridge()
    bridge.loop = asyncio.get_running_loop()

    threading.Thread(target=poll_cards, args=(bridge.on_card, bridge.should_run), daemon=True).start()
    threading.Thread(target=bridge.status_loop, daemon=True).start()

    async def handler(websocket) -> None:
        await bridge.register(websocket)

    async with websockets.serve(handler, HOST, PORT):
        reader = find_acr_reader()
        if reader:
            print(f"RFID bridge em ws://{HOST}:{PORT} — leitor: {reader}")
        else:
            print(f"RFID bridge em ws://{HOST}:{PORT} — aguardando leitor ACR122...")
        await asyncio.Future()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Bridge encerrado.")
