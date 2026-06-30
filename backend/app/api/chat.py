"""模块③ 非遗虚拟传承人对话 API (SSE流式)"""

import json
import uuid
import logging
from pathlib import Path
from fastapi import APIRouter, Depends, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc
import asyncio

from app.models.database import get_db
from app.models.user import User
from app.models.chat import ChatSession, ChatMessage
from app.schemas.chat import (
    CreateSessionRequest, ChatSessionResponse, SessionDetailResponse,
    ChatMessageResponse, CharacterInfo,
)
from app.schemas.common import MessageResponse
from app.api.deps import get_current_user
from app.utils.exceptions import AppException
from app.config import IMAGE_DIR
from app.services.ai.workshop_tool_dispatcher import (
    detect_tool_intent, extract_tool_payload,
    execute_tool_inspect, execute_tool_create, execute_tool_connect,
    execute_tool_pattern, execute_tool_story, execute_tool_compare,
    TOOL_DISPLAY, PERSONA_CATEGORY_MAP,
)

logger = logging.getLogger("chat_api")
router = APIRouter()

# 加载角色配置
def _load_characters() -> list[dict]:
    path = Path(__file__).resolve().parent.parent.parent / "config" / "characters.json"
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

CHARACTERS: dict[str, dict] = {c["id"]: c for c in _load_characters()}

# 通用快捷追问模板
DEFAULT_QUICK_QUESTIONS = [
    "能再详细讲讲吗？",
    "这个技法有什么特别之处？",
    "初学者想入门该从哪开始？",
]


# === 角色列表 ===

@router.get("/characters", response_model=list[CharacterInfo])
def list_characters():
    """获取所有传承人角色"""
    return [
        CharacterInfo(
            id=c["id"],
            name=c["name"],
            avatar=c.get("avatar", ""),
            expertise=c.get("expertise", []),
            greeting=c.get("greeting", ""),
            tools=c.get("tools", []),
            quick_questions=c.get("quick_questions", []),
        )
        for c in CHARACTERS.values()
    ]


# === 会话管理 ===

@router.post("/sessions", response_model=ChatSessionResponse)
def create_session(
    req: CreateSessionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """创建新对话会话"""
    # 支持预设角色和自定义传承人
    inheritor_name = req.persona
    if req.persona.startswith("custom:"):
        try:
            inheritor_id = int(req.persona.split(":", 1)[1])
            from app.models.custom_inheritor import CustomInheritor
            ci = db.query(CustomInheritor).filter(CustomInheritor.id == inheritor_id).first()
            if not ci:
                raise AppException(f"传承人不存在: {req.persona}")
            inheritor_name = ci.name
        except (ValueError, IndexError):
            raise AppException(f"无效的传承人ID: {req.persona}")
    else:
        char = CHARACTERS.get(req.persona)
        if not char:
            raise AppException(f"未知角色: {req.persona}")
        inheritor_name = char["name"]

    session = ChatSession(
        user_id=current_user.id,
        persona=req.persona,
        title=f"与{inheritor_name}的对话",
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    # 触发护照印章检查 (fire-and-forget)
    _trigger_stamp_check(current_user.id, "workshop", db)

    # 触发兴趣画像更新 (fire-and-forget)
    from app.services.ai.recommendation import trigger_profile_update
    trigger_profile_update(current_user.id, "chat", {
        "category": session.persona,
    })

    # 奖励修习 XP (fire-and-forget)
    from app.services.cultivation_service import award_xp
    award_xp(current_user.id, "问道", 5)

    ctx = _resolve_inheritor_tools(req.persona, db)
    return ChatSessionResponse(
        id=session.id,
        persona=session.persona,
        title=session.title,
        updated_at=session.updated_at,
        created_at=session.created_at,
        preview="",
        available_tools=ctx.get("available_tools", []),
        inheritor_name=ctx.get("inheritor_name", ""),
        inheritor_avatar=ctx.get("inheritor_avatar", ""),
    )


@router.get("/sessions", response_model=list[ChatSessionResponse])
def list_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取用户所有对话会话"""
    sessions = db.query(ChatSession).filter(
        ChatSession.user_id == current_user.id
    ).order_by(desc(ChatSession.updated_at)).all()

    result = []
    for s in sessions:
        # 取最后一条消息作为预览
        last_msg = db.query(ChatMessage).filter(
            ChatMessage.session_id == s.id
        ).order_by(desc(ChatMessage.created_at)).first()
        preview = last_msg.content[:50] + "..." if last_msg and len(last_msg.content) > 50 else (last_msg.content if last_msg else "")

        ctx = _resolve_inheritor_tools(s.persona, db)
        result.append(ChatSessionResponse(
            id=s.id,
            persona=s.persona,
            title=s.title,
            updated_at=s.updated_at,
            created_at=s.created_at,
            preview=preview,
            available_tools=ctx.get("available_tools", []),
            inheritor_name=ctx.get("inheritor_name", ""),
            inheritor_avatar=ctx.get("inheritor_avatar", ""),
        ))

    return result


@router.get("/sessions/{session_id}", response_model=SessionDetailResponse)
def get_session_detail(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取会话详情(含消息列表)"""
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.user_id == current_user.id,
    ).first()
    if not session:
        raise AppException("会话不存在", code=404)

    messages = db.query(ChatMessage).filter(
        ChatMessage.session_id == session_id
    ).order_by(ChatMessage.created_at).all()

    ctx = _resolve_inheritor_tools(session.persona, db)
    return SessionDetailResponse(
        id=session.id,
        persona=session.persona,
        title=session.title,
        messages=[
            ChatMessageResponse(
                id=m.id,
                role=m.role,
                content=m.content,
                image_url=f"/static/images/{Path(m.image_path).name}" if m.image_path else None,
                voice_url=m.voice_url,
                created_at=m.created_at,
            )
            for m in messages
        ],
        created_at=session.created_at,
        updated_at=session.updated_at,
        available_tools=ctx.get("available_tools", []),
        quick_questions=ctx.get("quick_questions", []),
    )


@router.delete("/sessions/{session_id}", response_model=MessageResponse)
def delete_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """删除对话会话"""
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.user_id == current_user.id,
    ).first()
    if not session:
        raise AppException("会话不存在", code=404)

    db.delete(session)  # cascade deletes messages
    db.commit()
    return MessageResponse(message="已删除")


# === 传承人上下文 ===

@router.get("/inheritor/{persona_id}")
def get_inheritor_context(
    persona_id: str,
    db: Session = Depends(get_db),
):
    """获取传承人完整上下文（预设角色 + 自定义传承人统一接口）"""
    from app.api.inheritor import get_inheritor_context as _get_ctx
    ctx = _get_ctx(persona_id, db)
    if not ctx:
        raise AppException("传承人不存在", code=404)
    return ctx


# === 辅助函数 ===

def _resolve_inheritor_tools(session_persona: str, db: Session) -> dict:
    """解析传承人的工具配置

    Returns:
        {"available_tools": [...], "domain_prompts": {...}, "inheritor_name": "", "inheritor_avatar": "", "quick_questions": [...]}
    """
    if session_persona.startswith("custom:"):
        try:
            inheritor_id = int(session_persona.split(":", 1)[1])
        except (ValueError, IndexError):
            return {"available_tools": [], "domain_prompts": {}, "inheritor_name": "", "inheritor_avatar": "", "quick_questions": []}
        from app.models.custom_inheritor import CustomInheritor
        inheritor = db.query(CustomInheritor).filter(CustomInheritor.id == inheritor_id).first()
        if not inheritor:
            return {"available_tools": [], "domain_prompts": {}, "inheritor_name": "", "inheritor_avatar": "", "quick_questions": []}
        return {
            "available_tools": json.loads(inheritor.tools_json) if inheritor.tools_json else [],
            "domain_prompts": json.loads(inheritor.domain_prompts_json) if inheritor.domain_prompts_json else {},
            "inheritor_name": inheritor.name,
            "inheritor_avatar": inheritor.avatar_url or "",
            "quick_questions": [],
            "style": inheritor.style or "",
        }
    else:
        char = CHARACTERS.get(session_persona, {})
        return {
            "available_tools": char.get("tools", []),
            "domain_prompts": char.get("domain_prompts", {}),
            "inheritor_name": char.get("name", ""),
            "inheritor_avatar": char.get("avatar", ""),
            "quick_questions": char.get("quick_questions", []),
            "style": char.get("style", ""),
        }


def _update_session_timestamp(session_id: int):
    """Fire-and-forget 更新会话时间戳（独立线程 + 独立Session，杜绝跨线程ORM污染）"""
    from app.utils.fire_and_forget import run_in_thread
    from app.models.database import SessionLocal
    from datetime import datetime as dt

    def _run():
        db_local = SessionLocal()
        try:
            db_local.query(ChatSession).filter(
                ChatSession.id == session_id
            ).update({"updated_at": dt.utcnow()}, synchronize_session=False)
            db_local.commit()
        except Exception:
            db_local.rollback()
            raise  # re-raise for logging in run_in_thread
        finally:
            db_local.close()

    run_in_thread(_run, name="update_session_ts")


def _trigger_stamp_check(user_id: int, module: str, db_session: Session):
    """Fire-and-forget 印章检查（含重试）"""
    from app.utils.fire_and_forget import run_in_thread
    from app.models.database import SessionLocal
    from app.services.passport_service import check_and_earn_stamps

    def _earn():
        db = SessionLocal()
        try:
            session_count = db.query(ChatSession).filter(
                ChatSession.user_id == user_id
            ).count()
            message_count = db.query(ChatMessage).join(ChatSession).filter(
                ChatSession.user_id == user_id
            ).count()
            context = {
                "session_count": session_count,
                "message_count": message_count,
                "tools_used": [],
            }
            check_and_earn_stamps(user_id, module, context, db)
        except Exception:
            db.rollback()
            raise  # re-raise for logging + retry in run_in_thread
        finally:
            db.close()

    run_in_thread(_earn, name="stamp_check", retry=True)


# === SSE 流式对话 ===

@router.post("/sessions/{session_id}/send")
async def send_message(
    session_id: int,
    content: str = Form(...),
    image: UploadFile | None = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """发送消息 → SSE流式返回AI回复（支持工具调度）"""
    # 验证会话归属
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.user_id == current_user.id,
    ).first()
    if not session:
        raise AppException("会话不存在", code=404)

    # ⚠️ 必须在 db.commit() 之前提取 ORM 字段到普通变量
    # commit 后 ORM 实例会过期，后续任何属性访问都会触发隐式 refresh 导致报错
    session_persona: str = session.persona

    # 获取传承人完整上下文（支持预设角色和自定义传承人）
    inheritor_ctx = _resolve_inheritor_tools(session_persona, db)
    if not inheritor_ctx.get("available_tools") and not inheritor_ctx.get("inheritor_name"):
        # 既不是预设也不是自定义 → 回退到 CHARACTERS
        char = CHARACTERS.get(session_persona)
        if not char:
            raise AppException("角色配置缺失")
        inheritor_ctx = {
            "available_tools": char.get("tools", []),
            "domain_prompts": char.get("domain_prompts", {}),
            "inheritor_name": char.get("name", ""),
            "inheritor_avatar": char.get("avatar", ""),
            "quick_questions": char.get("quick_questions", []),
            "style": char.get("style", ""),
        }

    # 获取 system_prompt（预设从 CHARACTERS，自定义从 DB）
    if session_persona.startswith("custom:"):
        try:
            inheritor_id = int(session_persona.split(":", 1)[1])
            from app.models.custom_inheritor import CustomInheritor
            ci = db.query(CustomInheritor).filter(CustomInheritor.id == inheritor_id).first()
            system_prompt = ci.persona if ci else "你是一位非遗文化传承人。"
        except Exception:
            system_prompt = "你是一位非遗文化传承人。"
    else:
        char = CHARACTERS.get(session_persona, {})
        system_prompt = char.get("system_prompt", "你是一位非遗文化传承人。")

    available_tools = inheritor_ctx.get("available_tools", [])
    domain_prompts = inheritor_ctx.get("domain_prompts", {})
    inheritor_name = inheritor_ctx.get("inheritor_name", "")

    # 检测工具意图
    tool_id = detect_tool_intent(content, available_tools)

    # 保存用户消息
    image_path = None
    if image and image.filename:
        ext = Path(image.filename).suffix.lower() or ".jpg"
        filename = f"chat_{uuid.uuid4().hex}{ext}"
        IMAGE_DIR.mkdir(parents=True, exist_ok=True)
        file_path = IMAGE_DIR / filename
        with open(file_path, "wb") as f:
            f.write(await image.read())
        image_path = str(file_path)

    user_msg = ChatMessage(
        session_id=session_id,
        role="user",
        content=content,
        image_path=image_path,
    )
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    # 获取历史消息构建上下文（供普通对话使用）
    history = db.query(ChatMessage).filter(
        ChatMessage.session_id == session_id
    ).order_by(ChatMessage.created_at).all()

    messages = [{"role": "system", "content": system_prompt}]
    for m in history[:-1]:
        role = "assistant" if m.role == "assistant" else "user"
        msg: dict = {"role": role}
        if m.image_path:
            msg["content"] = [
                {"type": "text", "text": m.content},
                {"type": "image_url", "image_url": {"url": f"/static/images/{Path(m.image_path).name}"}},
            ]
        else:
            msg["content"] = m.content
        messages.append(msg)

    if image_path:
        messages.append({"role": "user", "content": [
            {"type": "text", "text": content},
            {"type": "image_url", "image_url": {"url": f"/static/images/{Path(image_path).name}"}},
        ]})
    else:
        messages.append({"role": "user", "content": content})

    # 生成快捷追问
    async def _generate_quick_questions(session_content: str) -> list[str]:
        try:
            from app.services.ai.llm import chat as llm_chat
            prompt = f"根据以下对话内容，生成3个用户可能接着问的简短问题（每个问题15字以内，一行一个，不要编号）：\n\n{session_content[-500:]}"
            result = llm_chat([{"role": "user", "content": prompt}])
            lines = [l.strip().lstrip("0123456789.").strip() for l in result.split("\n") if l.strip()]
            return lines[:3] if lines else DEFAULT_QUICK_QUESTIONS[:3]
        except Exception:
            return DEFAULT_QUICK_QUESTIONS[:3]

    # SSE生成器
    async def event_stream():
        full_content = ""
        assistant_msg = None
        try:
            # === 工具调用分支 ===
            if tool_id:
                tool_name = TOOL_DISPLAY.get(tool_id, tool_id)
                yield f"event: tool_start\ndata: {json.dumps({'tool': tool_id, 'message': f'正在使用【{tool_name}】...'}, ensure_ascii=False)}\n\n"

                if tool_id == "inspect":
                    yield f"event: tool_progress\ndata: {json.dumps({'tool': tool_id, 'step': 'recognizing'}, ensure_ascii=False)}\n\n"
                    if not image_path:
                        yield f"event: error\ndata: {json.dumps({'error': '请上传一张非遗作品图片用于品鉴分析'}, ensure_ascii=False)}\n\n"
                        return

                    domain_prompt = domain_prompts.get("inspect", "")
                    inheritor_info = {
                        "name": inheritor_name,
                        "system_prompt": system_prompt,
                        "style": inheritor_ctx.get("style", ""),
                        "domain_prompts": domain_prompts,
                    }

                    loop = asyncio.get_running_loop()
                    result = await loop.run_in_executor(
                        None, lambda: execute_tool_inspect(image_path, domain_prompt, inheritor_info)
                    )

                    # 流式输出评析
                    commentary = result.get("commentary", "")
                    for i in range(0, len(commentary), 3):
                        chunk = commentary[i:i+3]
                        yield f"event: message\ndata: {json.dumps({'token': chunk}, ensure_ascii=False)}\n\n"
                        await asyncio.sleep(0.02)

                    full_content = f"【{tool_name}】\n\n{commentary}"
                    yield f"event: tool_result\ndata: {json.dumps({'tool': tool_id, 'recognition': result.get('recognition', {}), 'commentary': commentary}, ensure_ascii=False)}\n\n"

                elif tool_id == "create":
                    payload = extract_tool_payload(content, tool_id)
                    yield f"event: tool_progress\ndata: {json.dumps({'tool': tool_id, 'step': 'generating'}, ensure_ascii=False)}\n\n"

                    domain_prompt = domain_prompts.get("create", "")
                    inheritor_info = {
                        "name": inheritor_name,
                        "system_prompt": system_prompt,
                        "style": inheritor_ctx.get("style", ""),
                        "domain_prompts": domain_prompts,
                    }

                    loop = asyncio.get_running_loop()
                    result = await loop.run_in_executor(
                        None, lambda: execute_tool_create(payload, domain_prompt, inheritor_info)
                    )

                    images = result.get("images", [])
                    prompt_used = result.get("prompt_used", payload)
                    full_content = f"【{tool_name}】\n\n创作提示：{prompt_used}\n\n已生成 {len(images)} 张作品。"
                    yield f"event: image_batch\ndata: {json.dumps({'tool': tool_id, 'images': images, 'prompt_used': prompt_used}, ensure_ascii=False)}\n\n"

                    # 流式输出文本描述
                    for i in range(0, len(full_content), 3):
                        chunk = full_content[i:i+3]
                        yield f"event: message\ndata: {json.dumps({'token': chunk}, ensure_ascii=False)}\n\n"
                        await asyncio.sleep(0.02)

                elif tool_id == "connect":
                    payload = extract_tool_payload(content, tool_id)
                    yield f"event: tool_progress\ndata: {json.dumps({'tool': tool_id, 'step': 'searching'}, ensure_ascii=False)}\n\n"

                    # 将 persona ID 映射为中文品类名（如 paper_cutter → 剪纸）
                    category = PERSONA_CATEGORY_MAP.get(session_persona, "")
                    inheritor_info = {
                        "name": inheritor_name,
                        "category": category,
                        "system_prompt": system_prompt,
                        "style": inheritor_ctx.get("style", ""),
                        "domain_prompts": domain_prompts,
                    }

                    loop = asyncio.get_running_loop()
                    result = await loop.run_in_executor(
                        None, lambda: execute_tool_connect(payload, inheritor_info)
                    )

                    summary = result.get("summary", "")
                    for i in range(0, len(summary), 3):
                        chunk = summary[i:i+3]
                        yield f"event: message\ndata: {json.dumps({'token': chunk}, ensure_ascii=False)}\n\n"
                        await asyncio.sleep(0.02)

                    full_content = f"【{tool_name}】\n\n{summary}"
                    yield f"event: tool_result\ndata: {json.dumps({'tool': tool_id, 'related_items': result.get('related_items', []), 'summary': summary}, ensure_ascii=False)}\n\n"

                elif tool_id == "pattern":
                    yield f"event: tool_progress\ndata: {json.dumps({'tool': tool_id, 'step': 'recognizing'}, ensure_ascii=False)}\n\n"
                    if not image_path:
                        yield f"event: error\ndata: {json.dumps({'error': '请上传一张纹样图片用于提取分析'}, ensure_ascii=False)}\n\n"
                        return

                    domain_prompt = domain_prompts.get("pattern", domain_prompts.get("inspect", ""))
                    inheritor_info = {
                        "name": inheritor_name,
                        "system_prompt": system_prompt,
                        "style": inheritor_ctx.get("style", ""),
                        "domain_prompts": domain_prompts,
                    }

                    loop = asyncio.get_running_loop()
                    result = await loop.run_in_executor(
                        None, lambda: execute_tool_pattern(image_path, domain_prompt, inheritor_info)
                    )

                    # 流式输出纹样评析
                    commentary = result.get("commentary", "")
                    for i in range(0, len(commentary), 3):
                        chunk = commentary[i:i+3]
                        yield f"event: message\ndata: {json.dumps({'token': chunk}, ensure_ascii=False)}\n\n"
                        await asyncio.sleep(0.02)

                    full_content = f"【{tool_name}】\n\n{commentary}"
                    yield f"event: tool_result\ndata: {json.dumps({'tool': tool_id, 'analysis': result.get('analysis', {}), 'commentary': commentary}, ensure_ascii=False)}\n\n"

                elif tool_id == "story":
                    payload = extract_tool_payload(content, tool_id)
                    yield f"event: tool_progress\ndata: {json.dumps({'tool': tool_id, 'step': 'writing'}, ensure_ascii=False)}\n\n"

                    domain_prompt = domain_prompts.get("story", domain_prompts.get("teach", ""))
                    inheritor_info = {
                        "name": inheritor_name,
                        "system_prompt": system_prompt,
                        "style": inheritor_ctx.get("style", ""),
                        "domain_prompts": domain_prompts,
                    }

                    loop = asyncio.get_running_loop()
                    result = await loop.run_in_executor(
                        None, lambda: execute_tool_story(payload, domain_prompt, inheritor_info)
                    )

                    story_text = result.get("story", "")
                    # 先发送标题
                    title = result.get("title", "")
                    if title:
                        yield f"event: message\ndata: {json.dumps({'token': '📖 ' + title + '\n\n'}, ensure_ascii=False)}\n\n"

                    # 流式输出故事内容
                    for i in range(0, len(story_text), 3):
                        chunk = story_text[i:i+3]
                        yield f"event: message\ndata: {json.dumps({'token': chunk}, ensure_ascii=False)}\n\n"
                        await asyncio.sleep(0.025)

                    full_content = f"【{tool_name}】\n\n📖 {title}\n\n{story_text}"
                    yield f"event: tool_result\ndata: {json.dumps({'tool': tool_id, 'title': title, 'story': story_text, 'tags': result.get('tags', [])}, ensure_ascii=False)}\n\n"

                elif tool_id == "compare":
                    payload = extract_tool_payload(content, tool_id)
                    yield f"event: tool_progress\ndata: {json.dumps({'tool': tool_id, 'step': 'analyzing'}, ensure_ascii=False)}\n\n"

                    domain_prompt = domain_prompts.get("compare", domain_prompts.get("connect", ""))
                    inheritor_info = {
                        "name": inheritor_name,
                        "system_prompt": system_prompt,
                        "style": inheritor_ctx.get("style", ""),
                        "domain_prompts": domain_prompts,
                    }

                    loop = asyncio.get_running_loop()
                    result = await loop.run_in_executor(
                        None, lambda: execute_tool_compare(payload, domain_prompt, inheritor_info)
                    )

                    # 流式输出对比分析
                    summary = result.get("summary", "")
                    for i in range(0, len(summary), 3):
                        chunk = summary[i:i+3]
                        yield f"event: message\ndata: {json.dumps({'token': chunk}, ensure_ascii=False)}\n\n"
                        await asyncio.sleep(0.02)

                    full_content = f"【{tool_name}】\n\n{summary}"
                    yield f"event: tool_result\ndata: {json.dumps({'tool': tool_id, 'item_a': result.get('item_a', ''), 'item_b': result.get('item_b', ''), 'comparison': result.get('comparison', {}), 'common_ground': result.get('common_ground', ''), 'verdict': result.get('verdict', ''), 'summary': summary}, ensure_ascii=False)}\n\n"

                elif tool_id == "teach":
                    payload = extract_tool_payload(content, tool_id)
                    yield f"event: tool_progress\ndata: {json.dumps({'tool': tool_id, 'step': 'curating'}, ensure_ascii=False)}\n\n"

                    domain_prompt = domain_prompts.get("teach", "")
                    inheritor_info = {
                        "name": inheritor_name,
                        "category": session_persona,
                        "system_prompt": system_prompt,
                        "style": inheritor_ctx.get("style", ""),
                        "domain_prompts": domain_prompts,
                    }

                    from app.services.ai.curriculum_builder import build_curriculum_stream

                    loop = asyncio.get_running_loop()

                    # 课程生成在 sync 线程中运行，通过 queue 桥接
                    curriculum_queue: asyncio.Queue = asyncio.Queue()

                    def run_curriculum():
                        try:
                            for event_type, data in build_curriculum_stream(payload, domain_prompt, inheritor_info):
                                try:
                                    curriculum_queue.put_nowait((event_type, data))
                                except asyncio.QueueFull:
                                    pass
                            curriculum_queue.put_nowait(("done", None))
                        except Exception as e:
                            logger.error(f"课程生成失败: {e}")
                            try:
                                curriculum_queue.put_nowait(("error", str(e)))
                            except asyncio.QueueFull:
                                pass

                    import concurrent.futures
                    executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
                    future = loop.run_in_executor(executor, run_curriculum)

                    while True:
                        try:
                            evt_type, evt_data = await asyncio.wait_for(curriculum_queue.get(), timeout=180)
                        except asyncio.TimeoutError:
                            yield f"event: error\ndata: {json.dumps({'error': '课程生成超时，请重试'}, ensure_ascii=False)}\n\n"
                            break

                        if evt_type == "section_start":
                            yield f"event: curriculum_section\ndata: {json.dumps({'action': 'start', **evt_data}, ensure_ascii=False)}\n\n"
                        elif evt_type == "token":
                            full_content += evt_data
                            yield f"event: message\ndata: {json.dumps({'token': evt_data}, ensure_ascii=False)}\n\n"
                        elif evt_type == "section_end":
                            yield f"event: curriculum_section\ndata: {json.dumps({'action': 'end', **evt_data}, ensure_ascii=False)}\n\n"
                        elif evt_type == "curriculum_done":
                            break
                        elif evt_type == "done":
                            break
                        elif evt_type == "error":
                            yield f"event: error\ndata: {json.dumps({'error': evt_data}, ensure_ascii=False)}\n\n"
                            return

                    try:
                        future.result(timeout=1)
                    except Exception:
                        pass
                    executor.shutdown(wait=False)

                # 工具调用完成 — 保存AI回复
                if full_content:
                    assistant_msg = ChatMessage(
                        session_id=session_id,
                        role="assistant",
                        content=full_content,
                    )
                    # 生成TTS（失败不影响）
                    voice_url = None
                    try:
                        from app.services.ai.tts import synthesize
                        voice_url = synthesize(full_content[:500])
                    except Exception as tts_err:
                        logger.warning(f"TTS合成失败: {tts_err}")

                    assistant_msg.voice_url = voice_url
                    db.add(assistant_msg)
                    db.commit()
                    db.refresh(assistant_msg)
                    # 时间戳更新放入独立线程，避免跨线程 ORM 污染
                    _update_session_timestamp(session_id)

                    quick_qs = inheritor_ctx.get("quick_questions", [])
                    if not quick_qs:
                        quick_qs = DEFAULT_QUICK_QUESTIONS[:3]
                    done_data = json.dumps({
                        "message_id": assistant_msg.id,
                        "quick_questions": quick_qs[:3],
                        "voice_url": voice_url,
                        "tool_used": tool_id,
                    }, ensure_ascii=False)
                    yield f"event: done\ndata: {done_data}\n\n"
                else:
                    yield f"event: error\ndata: {json.dumps({'error': '工具执行失败，未生成内容'}, ensure_ascii=False)}\n\n"

                return

            # === 普通对话分支（无工具调用） ===
            from app.services.ai.llm import chat_stream
            loop = asyncio.get_running_loop()

            token_queue: asyncio.Queue = asyncio.Queue()

            def run_llm():
                try:
                    for token in chat_stream(messages):
                        try:
                            token_queue.put_nowait(("token", token))
                        except asyncio.QueueFull:
                            pass
                    token_queue.put_nowait(("done", None))
                except Exception as e:
                    logger.error(f"LLM流式调用失败: {e}")
                    try:
                        token_queue.put_nowait(("error", str(e)))
                    except asyncio.QueueFull:
                        pass

            import concurrent.futures
            executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
            future = loop.run_in_executor(executor, run_llm)

            while True:
                try:
                    event_type, payload = await asyncio.wait_for(token_queue.get(), timeout=120)
                except asyncio.TimeoutError:
                    yield f"event: error\ndata: {json.dumps({'error': '回复超时，请重试'}, ensure_ascii=False)}\n\n"
                    break

                if event_type == "token":
                    full_content += payload
                    yield f"event: message\ndata: {json.dumps({'token': payload}, ensure_ascii=False)}\n\n"
                elif event_type == "done":
                    break
                elif event_type == "error":
                    yield f"event: error\ndata: {json.dumps({'error': payload}, ensure_ascii=False)}\n\n"
                    return

            try:
                future.result(timeout=1)
            except Exception:
                pass
            executor.shutdown(wait=False)

            # 保存AI回复
            if full_content:
                assistant_msg = ChatMessage(
                    session_id=session_id,
                    role="assistant",
                    content=full_content,
                )

                voice_url = None
                try:
                    from app.services.ai.tts import synthesize
                    voice_text = full_content[:500]
                    voice_url = synthesize(voice_text)
                except Exception as tts_err:
                    logger.warning(f"TTS合成失败: {tts_err}")

                assistant_msg.voice_url = voice_url
                db.add(assistant_msg)
                db.commit()
                db.refresh(assistant_msg)
                # 时间戳更新放入独立线程，避免跨线程 ORM 污染
                _update_session_timestamp(session_id)

                quick_qs = await _generate_quick_questions(full_content)
                done_data = json.dumps({
                    "message_id": assistant_msg.id,
                    "quick_questions": quick_qs,
                    "voice_url": voice_url,
                }, ensure_ascii=False)
                yield f"event: done\ndata: {done_data}\n\n"
            else:
                yield f"event: error\ndata: {json.dumps({'error': '未生成回复'}, ensure_ascii=False)}\n\n"

        except Exception as e:
            logger.error(f"SSE生成异常: {e}")
            yield f"event: error\ndata: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
