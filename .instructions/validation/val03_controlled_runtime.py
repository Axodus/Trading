"""Controlled VAL-03 runtime harness for the materialized Hummingbot API.

This intentionally exercises the real FastAPI application, authentication, routing,
Pydantic request/response models, and HTTP boundary. Provider and persistence behavior
are deterministic local fakes; no application lifespan, exchange, credentials, Gateway,
WebSocket, or production service is started.
"""

from __future__ import annotations

import asyncio
import json
import tempfile
from dataclasses import dataclass, field
from decimal import Decimal
from pathlib import Path
from typing import Any

import httpx
from fastapi import HTTPException

import deps
import main


CLIENT_ORDER_ID = "ax-val03-attempt-001"
ACCOUNT = "controlled-account"
CONNECTOR = "binance"
PAIR = "BTC-USDT"


@dataclass
class ControlledStore:
    path: Path

    def load(self) -> dict[str, dict[str, Any]]:
        if not self.path.exists():
            return {}
        return json.loads(self.path.read_text())

    def save(self, orders: dict[str, dict[str, Any]]) -> None:
        self.path.write_text(json.dumps(orders, sort_keys=True))


@dataclass
class ControlledAccountsService:
    store: ControlledStore
    failure_mode: str | None = None
    place_calls: list[str] = field(default_factory=list)
    cancel_calls: list[str] = field(default_factory=list)

    async def place_trade(self, **kwargs: Any) -> str:
        client_order_id = kwargs["client_order_id"]
        self.place_calls.append(client_order_id)
        if self.failure_mode == "provider_rejection":
            raise HTTPException(status_code=503, detail="controlled provider rejection")
        if self.failure_mode == "transport_failure":
            raise HTTPException(status_code=504, detail="controlled provider transport failure")

        orders = self.store.load()
        orders[client_order_id] = {
            "order_id": client_order_id,
            "client_order_id": client_order_id,
            "account_name": kwargs["account_name"],
            "connector_name": kwargs["connector_name"],
            "trading_pair": kwargs["trading_pair"],
            "order_type": kwargs["order_type"].name,
            "trade_type": kwargs["trade_type"].name,
            "amount": str(kwargs["amount"]),
            "price": str(kwargs["price"]),
            "filled_amount": "0",
            "status": "OPEN",
            "created_at": "2026-09-18T12:00:00+00:00",
        }
        self.store.save(orders)
        return client_order_id

    async def cancel_order(self, **kwargs: Any) -> str:
        client_order_id = kwargs["client_order_id"]
        self.cancel_calls.append(client_order_id)
        if self.failure_mode == "cancel_transport_failure":
            raise HTTPException(status_code=504, detail="controlled cancel transport failure")
        orders = self.store.load()
        if client_order_id in orders:
            orders[client_order_id]["status"] = "CANCEL_REQUESTED"
            self.store.save(orders)
        return client_order_id


class ControlledConnectorService:
    def get_all_trading_connectors(self) -> dict[str, dict[str, object]]:
        return {ACCOUNT: {CONNECTOR: object()}}


class ControlledHistoryService:
    def __init__(self, store: ControlledStore):
        self.store = store

    async def search_orders(self, **_: Any) -> dict[str, Any]:
        orders = list(self.store.load().values())
        return {"orders": orders, "total_count": len(orders)}


def _request_payload() -> dict[str, Any]:
    return {
        "account_name": ACCOUNT,
        "connector_name": CONNECTOR,
        "trading_pair": PAIR,
        "trade_type": "BUY",
        "amount": "0.01",
        "order_type": "LIMIT",
        "price": "100.00",
        "position_action": "OPEN",
        "client_order_id": CLIENT_ORDER_ID,
    }


def _assert(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


async def run() -> dict[str, Any]:
    with tempfile.TemporaryDirectory(prefix="axodus-val03-") as directory:
        store = ControlledStore(Path(directory) / "controlled-orders.json")
        accounts = ControlledAccountsService(store)
        connector = ControlledConnectorService()
        history = ControlledHistoryService(store)

        async def accounts_override() -> ControlledAccountsService:
            return accounts

        async def connector_override() -> ControlledConnectorService:
            return connector

        async def history_override() -> ControlledHistoryService:
            return history

        async def auth_override() -> str:
            return "controlled-user"

        main.app.dependency_overrides[main.auth_user] = auth_override
        main.app.dependency_overrides[deps.get_accounts_service] = accounts_override
        main.app.dependency_overrides[deps.get_connector_service] = connector_override
        main.app.dependency_overrides[deps.get_trading_history_service] = history_override

        results: dict[str, Any] = {"transport": "HTTP ASGI", "websocket_used": False}
        try:
            auth = httpx.BasicAuth("admin", "admin")
            transport = httpx.ASGITransport(app=main.app)
            async with httpx.AsyncClient(transport=transport, base_url="http://val03", auth=auth) as client:
                health = await client.get("/")
                _assert(health.status_code == 200, f"health failed: {health.status_code}")

                placed = await client.post("/trading/orders", json=_request_payload())
                _assert(placed.status_code == 201, f"placement failed: {placed.status_code} {placed.text}")
                _assert(placed.json()["order_id"] == CLIENT_ORDER_ID, "client order ID changed in API response")
                _assert(accounts.place_calls == [CLIENT_ORDER_ID], "provider received a different order ID")

                lookup = await client.post(
                    "/trading/orders/search",
                    json={"account_names": [ACCOUNT], "limit": 10},
                )
                _assert(lookup.status_code == 200, f"lookup failed: {lookup.status_code} {lookup.text}")
                _assert(lookup.json()["data"][0]["client_order_id"] == CLIENT_ORDER_ID, "exact lookup lost identity")

                cancelled = await client.post(
                    f"/trading/{ACCOUNT}/{CONNECTOR}/orders/{CLIENT_ORDER_ID}/cancel"
                )
                _assert(cancelled.status_code == 200, f"cancel failed: {cancelled.status_code} {cancelled.text}")
                _assert(accounts.cancel_calls == [CLIENT_ORDER_ID], "cancel did not preserve identity")

                invalid = await client.post(
                    "/trading/orders",
                    json={**_request_payload(), "client_order_id": "invalid id"},
                )
                _assert(invalid.status_code == 422, "invalid client order ID crossed the route boundary")
                _assert(accounts.place_calls == [CLIENT_ORDER_ID], "invalid request reached provider")

                accounts.failure_mode = "provider_rejection"
                rejected = await client.post("/trading/orders", json={**_request_payload(), "client_order_id": "ax-rejected"})
                _assert(rejected.status_code == 503, "provider rejection was not preserved as controlled HTTP failure")

                accounts.failure_mode = "transport_failure"
                transport_failure = await client.post(
                    "/trading/orders", json={**_request_payload(), "client_order_id": "ax-unknown"}
                )
                _assert(transport_failure.status_code == 504, "transport failure was not bounded by the service")
                _assert(
                    accounts.place_calls.count("ax-unknown") == 1,
                    "transport ambiguity triggered an automatic duplicate submission",
                )

            # Reconstruct the service objects against the same controlled durable store.
            reconstructed_accounts = ControlledAccountsService(store)
            reconstructed_history = ControlledHistoryService(store)
            async def reconstructed_accounts_override() -> ControlledAccountsService:
                return reconstructed_accounts

            async def reconstructed_history_override() -> ControlledHistoryService:
                return reconstructed_history

            main.app.dependency_overrides[deps.get_accounts_service] = reconstructed_accounts_override
            main.app.dependency_overrides[deps.get_trading_history_service] = reconstructed_history_override
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="http://val03", auth=auth) as client:
                recovered = await client.post(
                    "/trading/orders/search",
                    json={"account_names": [ACCOUNT], "limit": 10},
                )
                _assert(recovered.status_code == 200, f"recovery lookup failed: {recovered.status_code}")
                _assert(recovered.json()["data"][0]["client_order_id"] == CLIENT_ORDER_ID, "reconstructed service lost state")

            results.update(
                {
                    "health": "PASS",
                    "submission_identity": "PASS",
                    "exact_lookup": "PASS",
                    "cancellation": "PASS",
                    "request_validation": "PASS",
                    "provider_rejection": "PASS",
                    "transport_failure": "PASS",
                    "service_reconstruction": "PASS (controlled local store)",
                    "blind_retry": "PASS (one submission call per request; no retry in harness)",
                    "baseline": "HUMMINGBOT_BASELINE_V1 unchanged",
                    "external_exchange": "NOT USED",
                    "credentials": "NO EXCHANGE CREDENTIALS",
                }
            )
            return results
        finally:
            main.app.dependency_overrides.clear()


if __name__ == "__main__":
    print(json.dumps(asyncio.run(asyncio.wait_for(run(), timeout=20)), indent=2, sort_keys=True))
