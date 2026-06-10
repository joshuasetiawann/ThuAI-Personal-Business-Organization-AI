"""Hardware awareness: CPU/RAM/disk + best-effort GPU acceleration detection.
On this RX 6600 XT (gfx1032) Ollama GPU support is uncertain; if we cannot
confirm acceleration we warn that CPU fallback may be in effect."""
from __future__ import annotations
import shutil
import subprocess
from typing import Dict
import psutil
from config import settings

CPU_FALLBACK_WARNING = (
    "GPU acceleration could not be confirmed. Ollama may be running on CPU fallback. "
    "Multi-agent runs may be slow on Ryzen 7 5800X + 16GB RAM."
)


def _detect_gpu() -> Dict:
    # Best effort only — these tools are usually absent inside the backend container.
    for tool, name in (("rocm-smi", "amd-rocm"), ("nvidia-smi", "nvidia")):
        if shutil.which(tool):
            try:
                subprocess.run([tool], capture_output=True, timeout=5)
                return {"acceleration": "detected", "via": name}
            except Exception:
                pass
    return {"acceleration": "unknown", "via": None}


def hardware_status() -> Dict:
    vm = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    gpu = _detect_gpu()
    warning = None if gpu["acceleration"] == "detected" else CPU_FALLBACK_WARNING
    return {
        "cpu": {"name": settings.HW_CPU_NAME, "logical": psutil.cpu_count(),
                "percent": psutil.cpu_percent(interval=0.2)},
        "ram": {"total_gb": round(vm.total / 1024**3, 2), "used_gb": round(vm.used / 1024**3, 2),
                "percent": vm.percent, "profile_gb": settings.HW_RAM_GB},
        "disk": {"total_gb": round(disk.total / 1024**3, 2), "used_gb": round(disk.used / 1024**3, 2),
                 "percent": disk.percent},
        "gpu": {"name": settings.HW_GPU_NAME, "vram_gb": settings.HW_VRAM_GB, **gpu},
        "gpu_acceleration_confirmed": gpu["acceleration"] == "detected",
        "warning": warning,
    }
