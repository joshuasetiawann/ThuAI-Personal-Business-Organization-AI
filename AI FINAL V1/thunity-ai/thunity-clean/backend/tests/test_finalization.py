"""Sprint 9 finalization: backup scripts, hardware awareness, model health."""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def _auth(t): return {"Authorization": f"Bearer {t}"}


def test_backup_restore_scripts_exist_and_are_safe():
    for name in ("backup-local.sh", "restore-local.sh"):
        p = os.path.join(ROOT, "scripts", name)
        assert os.path.isfile(p), f"missing {name}"
        assert "--help" in open(p).read()
    b = open(os.path.join(ROOT, "scripts", "backup-local.sh")).read()
    assert ".env.example" in b                 # template only
    assert "/.env\"" not in b and "cp \"$ROOT/.env\"" not in b  # never the real .env


def test_hardware_status_requires_auth(client):
    assert client.get("/api/hardware/status").status_code == 401


def test_hardware_status_is_structured_with_warning(client, founder_token):
    hw = client.get("/api/hardware/status", headers=_auth(founder_token)).json()
    for k in ("cpu", "ram", "disk", "gpu", "gpu_acceleration_confirmed", "ollama"):
        assert k in hw, f"hardware status missing {k}"
    if not hw["gpu_acceleration_confirmed"]:
        assert hw["warning"] and "CPU fallback" in hw["warning"]


def test_models_health_no_cloud_and_reports_missing(client, founder_token):
    mh = client.get("/api/models/health", headers=_auth(founder_token)).json()
    assert "required_models" in mh and "missing_models" in mh
    assert "no cloud fallback" in mh.get("note", "").lower()
