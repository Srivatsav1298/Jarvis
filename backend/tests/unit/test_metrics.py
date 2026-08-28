"""Unit tests for the metrics provider (psutil faked, clock injected)."""
from types import SimpleNamespace

from app.providers.metrics import LocalMetricsProvider


class FakeClock:
    def __init__(self) -> None:
        self.t = 0.0

    def monotonic(self) -> float:
        self.t += 1.0
        return self.t


def fake_psutil(cpu=34.0, ram_pct=58.0, batt=None, recv=10_000_000, sent=2_000_000):
    return SimpleNamespace(
        cpu_percent=lambda interval=None: cpu,
        cpu_count=lambda: 8,
        virtual_memory=lambda: SimpleNamespace(
            percent=ram_pct, used=int(ram_pct * 2**30), total=100 * 2**30
        ),
        disk_usage=lambda _p: SimpleNamespace(
            percent=30.0, used=312 * 2**30, total=1024 * 2**30
        ),
        sensors_battery=lambda: batt,
        net_if_stats=lambda: {"en0": SimpleNamespace(isup=True)},
        net_io_counters=lambda: SimpleNamespace(bytes_recv=recv, bytes_sent=sent),
    )


def provider(psutil, clock) -> LocalMetricsProvider:
    return LocalMetricsProvider(psutil=psutil, monotonic=clock.monotonic)


async def test_cpu_and_ram():
    snap = await provider(fake_psutil(), FakeClock()).snapshot()
    assert snap.cpu_percent == 34.0
    assert snap.cpu_count == 8
    assert snap.ram_percent == 58.0
    assert snap.ram_used_gb == 58.0  # int(58 * 1e7)/2**30 ≈ 58.0


async def test_battery_none_and_placeholders():
    snap_up = await provider(
        fake_psutil(batt=SimpleNamespace(percent=82, power_plugged=True)), FakeClock()
    ).snapshot()
    assert snap_up.battery.percent == 82 and snap_up.battery.charging is True
    assert snap_up.battery.present is True
    snap_down = await provider(fake_psutil(batt=None), FakeClock()).snapshot()
    assert snap_down.battery.present is False and snap_down.battery.percent is None
    assert snap_down.gpu is None and snap_down.temp is None


async def test_network_throughput():
    clock = FakeClock()
    p = provider(fake_psutil(recv=10_000_000, sent=2_000_000), clock=clock)
    first = await p.snapshot()
    second = await p.snapshot()
    assert first.network.down_mbps == second.network.down_mbps  # identical counters
    assert second.network.down_mbps == 0.0


async def test_network_throughput_second_sample():
    clock = FakeClock()
    p = provider(fake_psutil(recv=10_000_000, sent=2_000_000), clock=clock)
    _ = await p.snapshot()
    p._psutil = fake_psutil(recv=18_000_000, sent=6_000_000)
    sample = await p.snapshot()
    assert sample.network.down_mbps == 64.0  # 8_000_000*8/1e6/1.0
    assert sample.network.up_mbps == 32.0  # 4_000_000*8/1e6/1.0
    assert sample.network.ssid == "en0" and sample.network.connected is True