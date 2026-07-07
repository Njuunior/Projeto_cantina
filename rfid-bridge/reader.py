"""Leitura de UID via leitor ACS ACR122U (PC/SC)."""

from __future__ import annotations

import time
from typing import Callable, Optional

from smartcard.System import readers
from smartcard.util import toHexString

GET_UID = [0xFF, 0xCA, 0x00, 0x00, 0x00]
POLL_IDLE_SEC = 0.15
POLL_AFTER_READ_SEC = 0.5
POLL_ERROR_SEC = 0.35


def normalize_uid(raw: str) -> str:
    return raw.replace(" ", "").upper()


def find_acr_reader():
    available = readers()
    if not available:
        return None
    for reader in available:
        if "ACR122" in str(reader).upper():
            return reader
    return available[0]


def read_uid(connection) -> Optional[str]:
    data, sw1, sw2 = connection.transmit(GET_UID)
    if sw1 == 0x90 and sw2 == 0x00 and data:
        return normalize_uid(toHexString(data))
    return None


def poll_cards(on_card: Callable[[str], None], should_run: Callable[[], bool]) -> None:
    """Loop contínuo: emite UID sempre que um cartão é detectado."""
    while should_run():
        reader = find_acr_reader()
        if not reader:
            time.sleep(1)
            continue

        connection = reader.createConnection()
        try:
            connection.connect()
            uid = read_uid(connection)
            if uid:
                on_card(uid)
                time.sleep(POLL_AFTER_READ_SEC)
        except Exception:
            time.sleep(POLL_ERROR_SEC)
        finally:
            try:
                connection.disconnect()
            except Exception:
                pass

        time.sleep(POLL_IDLE_SEC)
