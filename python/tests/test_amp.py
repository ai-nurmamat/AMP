import pytest
import asyncio
from amp import AMPCore, MemoryEvent, MemoryTier, MemoryScope, MemoryQuery

@pytest.fixture
def mem_amp():
    return AMPCore()

@pytest.mark.asyncio
async def test_memory_store_retrieve(mem_amp):
    # Store memory
    event = MemoryEvent(
        tier=MemoryTier.WORKING,
        scope=MemoryScope(session_id="s1"),
        content="The user loves apples"
    )
    result = await mem_amp.store(event)
    assert result["id"] is not None
    assert result["tier"] == MemoryTier.WORKING.value

    # Retrieve memory
    query = MemoryQuery(query="apples")
    results = await mem_amp.retrieve(query)
    assert len(results) > 0
    assert "apples" in results[0].content

@pytest.mark.asyncio
async def test_memory_delete(mem_amp):
    event = MemoryEvent(
        tier=MemoryTier.WORKING,
        scope=MemoryScope(session_id="s1"),
        content="To be deleted"
    )
    result = await mem_amp.store(event)
    mem_id = result["id"]

    deleted = await mem_amp.delete(mem_id)
    assert deleted is True

    # Verify deletion
    deleted_again = await mem_amp.delete(mem_id)
    assert deleted_again is False

@pytest.mark.asyncio
async def test_redis_fallback():
    # If no Redis is available, it should fallback to MemoryStorageProvider
    amp = AMPCore(redis_url="redis://localhost:6379")
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

def test_get_memory_tools(mem_amp):
    tools = mem_amp.get_memory_tools()
    assert len(tools) > 0
    assert tools[0]["function"]["name"] == "amp_store_memory"
