执行完整发布流程，步骤如下（按顺序，不要跳过）：

1. **更新 README.md 更新记录**
   - 在 `## 📋 更新记录` 章节的最前面（紧接标题后）插入一个新条目
   - 格式：`### YYYY-MM-DD`（今天的日期），然后是**粗体功能标题**，再是要点列表
   - 内容从本次对话的改动中总结，用中文描述，每个要点一行

2. **git add** 所有本次改动的文件（包括 README.md）

3. **git commit**，commit message 格式：
   - 第一行：`feat/fix/docs: 简短英文描述`
   - 空一行
   - 正文：改动要点（英文）
   - 末尾固定附加：
     ```
     Generated with [Claude Code](https://claude.ai/code)
     via [Happy](https://happy.engineering)

     Co-Authored-By: Claude <noreply@anthropic.com>
     Co-Authored-By: Happy <yesreply@happy.engineering>
     ```

4. **git push** 到当前分支的远端

5. **gh pr create**，要求：
   - 标题：中文，简洁描述本次改动（50 字以内）
   - Body 包含：`## Summary`（3 条以内要点）、`## Changed files`（表格）、`## Test plan`（checklist）
   - 末尾附 Claude Code + Happy 署名

完成后报告 PR 链接。
