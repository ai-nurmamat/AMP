import json
import os
import tempfile

import pytest

from amp import AMPCore, MemoryEvent, MemoryTier, MemoryScope, MemoryQuery


@pytest.fixture
def amp_core():
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        tmp_path = f.name
    os.unlink(tmp_path)  # remove empty file so AMP creates fresh
    core = AMPCore(storage_path=tmp_path)
    yield core
    try:
        os.unlink(tmp_path)
    except FileNotFoundError:
        pass


@pytest.fixture
def audit_log_path(tmp_path):
    return str(tmp_path / "audit.log")


@pytest.mark.asyncio
async def test_memory_store_retrieve(amp_core):
    # Store memory
    event = MemoryEvent(
        tier=MemoryTier.WORKING,
        scope=MemoryScope(session_id="s1"),
        content="The user loves apples"
    )
    result = await amp_core.store(event)
    assert result["id"] is not None
    assert result["tier"] == MemoryTier.WORKING.value

    # Retrieve memory
    query = MemoryQuery(query="apples")
    results = await amp_core.retrieve(query)
    assert len(results) > 0
    assert "apples" in results[0].content


@pytest.mark.asyncio
async def test_memory_delete(amp_core):
    event = MemoryEvent(
        tier=MemoryTier.WORKING,
        scope=MemoryScope(session_id="s1"),
        content="To be deleted"
    )
    result = await amp_core.store(event)
    mem_id = result["id"]

    deleted = await amp_core.delete(mem_id)
    assert deleted is True

    # Verify deletion
    deleted_again = await amp_core.delete(mem_id)
    assert deleted_again is False


@pytest.mark.asyncio
async def test_redis_fallback():
    # If no Redis is available, it should fallback to FileStorageProvider
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        tmp_path = f.name
    os.unlink(tmp_path)
    try:
        amp = AMPCore(redis_url="redis://localhost:6379", storage_path=tmp_path)
        event = MemoryEvent(
            tier=MemoryTier.LONG_TERM,
            scope=MemoryScope(user_id="u1"),
            content="Fallback test content"
        )
        result = await amp.store(event)
        assert result["id"] is not None

        query = MemoryQuery(query="Fallback")
        results = await amp.retrieve(query)
        assert len(results) > 0
        assert "Fallback" in results[0].content
    finally:
        try:
            os.unlink(tmp_path)
        except FileNotFoundError:
            pass


@pytest.mark.asyncio
async def test_scope_isolation(amp_core):
    await amp_core.store(MemoryEvent(
        tier=MemoryTier.WORKING,
        scope=MemoryScope(user_id="alice"),
        content="alice secret",
    ))
    await amp_core.store(MemoryEvent(
        tier=MemoryTier.WORKING,
        scope=MemoryScope(user_id="bob"),
        content="bob secret",
    ))
    alice_results = await amp_core.retrieve(
        MemoryQuery(query="secret", scope=MemoryScope(user_id="alice"))
    )
    assert len(alice_results) == 1
    assert alice_results[0].content == "alice secret"
    bob_results = await amp_core.retrieve(
        MemoryQuery(query="secret", scope=MemoryScope(user_id="bob"))
    )
    assert len(bob_results) == 1
    assert bob_results[0].content == "bob secret"


@pytest.mark.asyncio
async def test_id_collision(amp_core):
    event = MemoryEvent(
        id="fixed-id",
        tier=MemoryTier.WORKING,
        scope=MemoryScope(session_id="s1"),
        content="first",
    )
    await amp_core.store(event)
    with pytest.raises(ValueError):
        await amp_core.store(event)


@pytest.mark.asyncio
async def test_audit_log(audit_log_path):
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        tmp_path = f.name
    os.unlink(tmp_path)
    try:
        amp = AMPCore(storage_path=tmp_path, audit_log_path=audit_log_path)
        await amp.store(MemoryEvent(
            tier=MemoryTier.WORKING,
            scope=MemoryScope(user_id="alice"),
            content="audited memory",
        ))
        await amp.retrieve(MemoryQuery(query="audited"))
        # Audit entries should have been written.
        assert os.path.exists(audit_log_path)
        with open(audit_log_path, "r", encoding="utf-8") as f:
            lines = [ln for ln in f.read().splitlines() if ln.strip()]
        assert len(lines) >= 2
        actions = [json.loads(ln)["action"] for ln in lines]
        assert "store" in actions
        assert "retrieve" in actions
    finally:
        try:
            os.unlink(tmp_path)
        except FileNotFoundError:
            pass


def test_get_memory_tools(amp_core):
    tools = amp_core.get_memory_tools()
    assert len(tools) > 0
    assert tools[0]["function"]["name"] == "amp_store_memory"
