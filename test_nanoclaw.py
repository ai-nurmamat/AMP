import asyncio
from amp import AMPCore, MemoryEvent, MemoryTier, MemoryScope, MemoryQuery

async def run_nanoclaw_simulation():
    print("========================================")
    print("🤖 [NanoClaw] 正在启动...")
    
    # NanoClaw 初始化记忆底座
    nanoclaw_mem = AMPCore()
    
    # NanoClaw 观察到用户信息并存入记忆
    print("🤖 [NanoClaw] 观察用户行为中...")
    print("🤖 [NanoClaw] 记录：用户在晚上喜欢听爵士乐，并且擅长使用 Python 开发。")
    
    await nanoclaw_mem.store(MemoryEvent(
        tier=MemoryTier.LONG_TERM,
        scope=MemoryScope(agent_id="nanoclaw", user_id="global_user"),
        content="用户在晚上喜欢听爵士乐，并且擅长使用 Python 开发跨 Agent 系统。"
    ))
    print("🤖 [NanoClaw] 记忆已永久写入本地文件 (amp_memory.json)\n")
    print("🤖 [NanoClaw] 关机休眠。")
    print("========================================\n")
    
    # 模拟时间流逝或切换 Agent
    await asyncio.sleep(1)

    print("========================================")
    print("🦅 [Hermes Agent] 正在唤醒...")
    
    # Hermes 初始化同一个记忆底座（由于底层存储打通，这里会自动加载之前 NanoClaw 存下的数据）
    hermes_mem = AMPCore()
    
    # Hermes 试图检索用户偏好
    print("🦅 [Hermes Agent] 让我检索一下这位用户的编程语言偏好和音乐品味...")
    results = await hermes_mem.retrieve(MemoryQuery(
        query="爵士乐 Python", 
        limit=1
    ))
    
    if results:
        print(f"\n🦅 [Hermes Agent] 检索成功！读取到记忆：")
        print(f"   >>> \"{results[0].content}\" (相似度得分: {results[0].score:.2f})")
        print("\n🦅 [Hermes Agent] 明白了！我将在为你生成 Python 代码的同时，为你推荐一份爵士乐歌单！")
    else:
        print("\n🦅 [Hermes Agent] 抱歉，我的记忆里没有关于这个用户的任何信息。")
        
    print("========================================")

if __name__ == "__main__":
    asyncio.run(run_nanoclaw_simulation())
