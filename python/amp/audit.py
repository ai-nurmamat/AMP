"""Audit logging for AMP operations."""
import json
import os
import threading
from datetime import datetime
from typing import Optional


class AuditLogger:
    def __init__(self, log_path: Optional[str] = None):
        self.log_path = log_path
        self.enabled = log_path is not None
        self._lock = threading.Lock()

    def log(self, action: str, memory_id: Optional[str] = None,
            user_id: Optional[str] = None, agent_id: Optional[str] = None,
            details: Optional[str] = None) -> None:
        if not self.enabled or not self.log_path:
            return
        entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "action": action,
            "memory_id": memory_id,
            "user_id": user_id,
            "agent_id": agent_id,
            "details": details,
        }
        line = json.dumps(entry) + "\n"
        try:
            with self._lock:
                with open(self.log_path, "a", encoding="utf-8") as f:
                    f.write(line)
        except Exception:
            pass  # never crash data path due to audit failure

    def __bool__(self):
        return self.enabled
