"""MetricsProvider abstraction and the local (psutil) implementation."""
import time
from abc import ABC, abstractmethod
from datetime import UTC, datetime

from app.schemas.system import BatteryMetrics, NetworkMetrics, SystemMetrics


class MetricsProvider(ABC):
    @abstractmethod
    async def snapshot(self) -> SystemMetrics: ...


class LocalMetricsProvider(MetricsProvider):
    """Reads real host metrics via an injectable psutil-like module."""

    def __init__(self, psutil=None, monotonic=None) -> None:
        import psutil as _psutil  # lazy import keeps module importable pre-install
        self._psutil = psutil or _psutil
        self._monotonic = monotonic if monotonic is not None else time.monotonic
        net = self._psutil.net_io_counters()
        self._prev = net
        self._prev_at = self._monotonic()

    async def snapshot(self) -> SystemMetrics:
        ps = self._psutil
        now = self._monotonic()
        net = ps.net_io_counters()
        dt = max(now - self._prev_at, 0.0001)
        down_mbps = max(0.0, (net.bytes_recv - self._prev.bytes_recv) * 8 / 1_000_000 / dt)
        up_mbps = max(0.0, (net.bytes_sent - self._prev.bytes_sent) * 8 / 1_000_000 / dt)
        self._prev, self._prev_at = net, now

        vm = ps.virtual_memory()
        du = ps.disk_usage("/")
        batt = ps.sensors_battery()
        iface, ifstats = None, None
        for name, stats in ps.net_if_stats().items():
            if stats.isup:
                iface, ifstats = name, stats
                break

        return SystemMetrics(
            cpu_percent=float(ps.cpu_percent(interval=None)),
            cpu_count=int(ps.cpu_count() or 0),
            ram_percent=float(vm.percent),
            ram_used_gb=round(vm.used / 2**30, 1),
            ram_total_gb=round(vm.total / 2**30, 1),
            storage_percent=float(du.percent),
            storage_used_gb=round(du.used / 2**30, 1),
            storage_total_gb=round(du.total / 2**30, 1),
            battery=BatteryMetrics(
                percent=batt.percent if batt else None,
                charging=batt.power_plugged if batt else None,
                present=batt is not None,
            ),
            gpu=None,
            temp=None,
            network=NetworkMetrics(
                connected=bool(ifstats and ifstats.isup),
                type="wifi" if (iface or "").startswith(("en0", "en1")) else "ethernet",
                down_mbps=round(down_mbps, 1),
                up_mbps=round(up_mbps, 1),
                latency_ms=None,
                ssid=iface,
            ),
            api_latency_ms=None,
            collected_at=datetime.now(UTC),
        )


def get_metrics_provider() -> MetricsProvider:
    return LocalMetricsProvider()