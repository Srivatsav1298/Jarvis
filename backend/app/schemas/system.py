"""System metric schemas."""
from datetime import datetime

from app.schemas.common import APIModel


class NetworkMetrics(APIModel):
    connected: bool
    type: str = "unknown"
    down_mbps: float = 0.0
    up_mbps: float = 0.0
    latency_ms: float | None = None
    ssid: str | None = None


class BatteryMetrics(APIModel):
    percent: float | None = None
    charging: bool | None = None
    present: bool = False


class SystemMetrics(APIModel):
    cpu_percent: float
    cpu_count: int | None = None
    ram_percent: float
    ram_used_gb: float
    ram_total_gb: float
    storage_percent: float
    storage_used_gb: float
    storage_total_gb: float
    battery: BatteryMetrics | None = None
    gpu: float | None = None
    temp: float | None = None
    network: NetworkMetrics | None = None
    api_latency_ms: float | None = None
    collected_at: datetime


class AssistantStatus(APIModel):
    """Runtime capability snapshot for the assistant UI and diagnostics."""

    provider: str
    model: str
    provider_healthy: bool | None = None
    degraded: bool = False
    live_tools_enabled: bool
    voice_enabled: bool
    voice_engine: str
    voice_profile: str
