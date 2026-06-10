"""Backup/restore safety (Sprint 9). The core promise depends on backups never
leaking secrets."""
import os, subprocess, tarfile, glob

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def test_backup_restore_scripts_exist_and_executable():
    for s in ("backup-local.sh", "restore-local.sh"):
        p = os.path.join(ROOT, "scripts", s)
        assert os.path.exists(p) and os.access(p, os.X_OK), f"{s} missing or not executable"


def test_backup_excludes_real_env(tmp_path):
    envp = os.path.join(ROOT, ".env")
    created = False
    if not os.path.exists(envp):
        open(envp, "w").write("SECRET_KEY=should-never-be-backed-up\n")
        created = True
    try:
        out = str(tmp_path / "bk"); os.makedirs(out, exist_ok=True)
        r = subprocess.run(["bash", "scripts/backup-local.sh"], cwd=ROOT,
                           env={**os.environ, "BACKUP_DIR": out}, capture_output=True, text=True)
        assert r.returncode == 0, r.stderr
        arch = sorted(glob.glob(os.path.join(out, "thunity_backup_*.tgz")))
        assert arch, "no archive produced"
        names = []
        with tarfile.open(arch[-1]) as t:
            names += t.getnames()
            for m in t.getmembers():           # inspect nested data tar too
                if m.name.endswith(".tgz"):
                    f = t.extractfile(m)
                    if f:
                        with tarfile.open(fileobj=f) as inner:
                            names += inner.getnames()
        assert any(n.endswith(".env.example") for n in names), "template missing from backup"
        assert not any(os.path.basename(n) == ".env" for n in names), "real .env leaked into backup!"
    finally:
        if created:
            os.remove(envp)
