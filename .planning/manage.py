#!/usr/bin/env python3
"""
AI 工作流规划系统 - 管理工具

用法：
    python .planning/manage.py new "任务名称"        # 创建新任务
    python .planning/manage.py status                 # 查看当前状态
    python .planning/manage.py log "进度内容"         # 添加进度记录
    python .planning/manage.py complete               # 标记当前任务完成
    python .planning/manage.py archive                # 归档当前会话
"""

import sys
import os
import json
from datetime import datetime

PLANNING_DIR = os.path.dirname(os.path.abspath(__file__))
TASK_PLAN = os.path.join(PLANNING_DIR, "task_plan.md")
PROGRESS = os.path.join(PLANNING_DIR, "progress.md")
KNOWLEDGE = os.path.join(PLANNING_DIR, "knowledge.md")


def get_timestamp():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def get_date():
    return datetime.now().strftime("%Y-%m-%d")


def read_file(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def write_file(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def new_task(name):
    """创建新任务，重置 task_plan.md"""
    content = read_file(TASK_PLAN)

    # 更新任务名称和时间
    lines = content.split("\n")
    new_lines = []
    for line in lines:
        if line.startswith("**任务名称：**"):
            new_lines.append(f"**任务名称：** {name}")
        elif line.startswith("**创建时间：**"):
            new_lines.append(f"**创建时间：** {get_timestamp()}")
        elif line.startswith("**状态：**"):
            new_lines.append("**状态：** planning")
        else:
            new_lines.append(line)

    write_file(TASK_PLAN, "\n".join(new_lines))

    # 在 progress.md 中添加新会话记录
    progress = read_file(PROGRESS)
    session_header = f"\n**会话开始：** {get_timestamp()}\n**关联任务：** {name}\n"
    progress = progress.replace(
        "**会话开始：** （自动填写）\n**关联任务：** （对应 task_plan.md 中的任务名）",
        session_header.strip(),
    )
    write_file(PROGRESS, progress)

    print(f"[OK] 新任务已创建: {name}")
    print(f"[OK] 时间: {get_timestamp()}")


def show_status():
    """显示当前任务状态"""
    content = read_file(TASK_PLAN)

    task_name = "未设置"
    status = "未设置"
    priority = "未设置"

    for line in content.split("\n"):
        if line.startswith("**任务名称：**"):
            task_name = line.replace("**任务名称：**", "").strip()
        elif line.startswith("**状态：**"):
            raw = line.replace("**状态：**", "").strip()
            # 取第一个词作为当前状态
            status = raw.split("|")[0].strip() if "|" in raw else raw
        elif line.startswith("**优先级：**"):
            raw = line.replace("**优先级：**", "").strip()
            priority = raw.split("|")[0].strip() if "|" in raw else raw

    print("=" * 50)
    print("  AI 工作流规划系统 - 当前状态")
    print("=" * 50)
    print(f"  任务: {task_name}")
    print(f"  状态: {status}")
    print(f"  优先级: {priority}")
    print("=" * 50)

    # 检查各文件最后修改时间
    for name, path in [
        ("task_plan.md", TASK_PLAN),
        ("progress.md", PROGRESS),
        ("knowledge.md", KNOWLEDGE),
    ]:
        if os.path.exists(path):
            mtime = datetime.fromtimestamp(os.path.getmtime(path))
            print(f"  {name}: 最后更新 {mtime.strftime('%Y-%m-%d %H:%M:%S')}")

    print("=" * 50)


def add_log(message):
    """向 progress.md 添加进度记录"""
    progress = read_file(PROGRESS)

    log_entry = f"""
### [{get_timestamp()}] - {message}

**状态：** in_progress
**做了什么：**
- {message}

**产出物：**
- （待补充）

**遇到的问题：**
- 无

**下一步：**
- （待补充）

---
"""

    # 在 "## 进度记录" 之后插入
    marker = "<!-- 按时间倒序记录，最新的在最上面 -->"
    if marker in progress:
        progress = progress.replace(marker, marker + "\n" + log_entry)
    else:
        progress += "\n" + log_entry

    write_file(PROGRESS, progress)
    print(f"[OK] 进度已记录: {message}")


def complete_task():
    """标记当前任务为完成"""
    content = read_file(TASK_PLAN)

    # 提取任务名
    task_name = "未知任务"
    for line in content.split("\n"):
        if line.startswith("**任务名称：**"):
            task_name = line.replace("**任务名称：**", "").strip()
            break

    # 更新状态
    lines = content.split("\n")
    new_lines = []
    for line in lines:
        if line.startswith("**状态：**"):
            new_lines.append("**状态：** completed")
        else:
            new_lines.append(line)

    # 添加到历史任务
    history_line = f"| {get_date()} | {task_name} | completed | - |"
    new_content = "\n".join(new_lines)
    new_content = new_content.replace(
        "| - | - | - | - |", history_line + "\n| - | - | - | - |"
    )

    write_file(TASK_PLAN, new_content)
    print(f"[OK] 任务已完成: {task_name}")


def archive_session():
    """归档当前会话摘要"""
    progress = read_file(PROGRESS)
    task_content = read_file(TASK_PLAN)

    # 提取任务名
    task_name = "未知任务"
    for line in task_content.split("\n"):
        if line.startswith("**任务名称：**"):
            task_name = line.replace("**任务名称：**", "").strip()
            break

    archive_entry = f"""
## [{get_date()}] 会话摘要
- **任务：** {task_name}
- **完成步骤：** （请手动补充）
- **关键产出：** （请手动补充）
- **遗留问题：** （请手动补充）
- **下次续作点：** （请手动补充）
"""

    # 在会话摘要归档区域添加
    archive_marker = "### 会话归档模板"
    if archive_marker in progress:
        progress = progress.replace(archive_marker, archive_entry + "\n" + archive_marker)

    write_file(PROGRESS, progress)
    print(f"[OK] 会话已归档: {get_date()}")


def print_usage():
    print(__doc__)


def main():
    if len(sys.argv) < 2:
        print_usage()
        return

    command = sys.argv[1]

    if command == "new":
        if len(sys.argv) < 3:
            print("[ERROR] 请提供任务名称: python manage.py new \"任务名称\"")
            return
        new_task(sys.argv[2])
    elif command == "status":
        show_status()
    elif command == "log":
        if len(sys.argv) < 3:
            print("[ERROR] 请提供进度内容: python manage.py log \"进度内容\"")
            return
        add_log(sys.argv[2])
    elif command == "complete":
        complete_task()
    elif command == "archive":
        archive_session()
    else:
        print(f"[ERROR] 未知命令: {command}")
        print_usage()


if __name__ == "__main__":
    main()
