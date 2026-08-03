# GrowthBoard

![GrowthBoard](./public/og.png)

> Your GitHub is your personal growth database.

一个完全由 GitHub 驱动的个人成长记录网站：用 Issue Forms 录入刷题、论文、求职和目标，用 GitHub Actions 自动整理数据并部署到 GitHub Pages。

[在线网站](https://wei1305.github.io/growth-board/) · [添加记录](https://github.com/wei1305/growth-board/issues/new/choose) · [运行记录](https://github.com/wei1305/growth-board/actions)

## 特点

- 单仓库：源代码、配置、Issues、Actions 和 Pages 全部在一个仓库内
- GitHub-only：无服务器、无外部数据库、无需本地电脑持续运行
- 四类记录：刷题、论文、求职、目标；含仪表盘、统计图和统一时间轴
- 模块可选：刷题、论文、求职、目标均可全局启用/关闭，访问者也可在本设备隐藏模块
- 自动更新：Issue 新建、编辑、关闭或标签变化后自动重建网站
- 响应式：桌面、平板和 375px 手机均可使用，支持深色模式
- 安全：浏览器端不保存 GitHub Token；Actions 使用最小权限；Issue 内容按纯文本渲染

## 工作原理

```text
GitHub Issue Forms
        ↓
GitHub Issues（每条 Issue 是一条记录）
        ↓
GitHub Actions + scripts/export_data.py
        ↓
public/data/*.json
        ↓
React + TypeScript + Vite
        ↓
GitHub Pages
```

前端只读取构建时生成的静态 JSON，不调用私有接口，也不会在浏览器中持有 Token。

## 首次启用

仓库已包含完整工作流。首次使用只需：

1. 打开 **Actions → Initialize GrowthBoard labels → Run workflow**，创建所需标签。
2. 打开 **Settings → Pages → Build and deployment**，确认 Source 为 **GitHub Actions**。
3. 打开 **Actions → Build and deploy GrowthBoard → Run workflow**。
4. 等待部署完成，访问 `https://你的用户名.github.io/仓库名/`。

本仓库的默认地址是 <https://wei1305.github.io/growth-board/>。

## 模块开关

全局开关位于 [`config/site.json`](./config/site.json)：

```json
{
  "modules": {
    "leetcode": true,
    "papers": true,
    "jobs": true,
    "goals": true
  }
}
```

将某项改为 `false` 并提交后，该模块会从侧边栏、移动导航、首页统计、全局搜索、快速添加和时间轴中消失；数据导出也会跳过该模块。重新设为 `true` 后，下一次构建会再次从 Issues 读取其数据。

访问者还可在网站的「设置」页隐藏模块。这个偏好只保存在当前浏览器，不会修改仓库配置。

## 站点配置

仍在 [`config/site.json`](./config/site.json) 中修改：

| 字段 | 作用 |
|---|---|
| `siteName` | 网站名称 |
| `ownerName` | 首页问候语中的名字 |
| `tagline` | 首页副标题 |
| `repository` | 必须是 `owner/repository` 格式 |
| `locale` | 日期本地化语言，例如 `zh-CN` |
| `theme` | `light`、`dark` 或 `system` |
| `modules` | 四个模块的全局开关 |
| `profile` | 首页主标题和介绍 |

如果你复制了仓库，请至少修改 `repository`、`ownerName` 和 `profile`。

## 添加和维护记录

点击网站右下角的 `+`，或打开仓库的 [New issue](https://github.com/wei1305/growth-board/issues/new/choose) 页面：

- `leetcode.yml`：题目、难度、语言、算法标签、掌握度和复习日期
- `paper.yml`：论文、Venue、研究方向、阅读进度、评分和总结
- `job.yml`：公司代号、岗位、阶段和下一步日期
- `goal.yml`：周期、目标值、当前值、截止日期和复盘

编辑记录：打开对应 Issue 修改正文。归档记录：关闭 Issue。隐藏记录：添加 `record:hidden` 标签。完全不参与构建：添加 `record:deleted` 标签。

> [!WARNING]
> 这是公开单仓库模式，Issue 对所有人可见。求职记录中不要填写手机号、私人邮箱、身份证、住址、薪资详情、未公开 Offer、面试官评价或公司保密材料。

## 自动化工作流

- `build-and-deploy.yml`：读取 Issues、运行测试、构建前端并部署 Pages
- `initialize.yml`：初始化类型、状态、难度和控制标签
- `validate.yml`：在 Pull Request 中运行类型检查、Python 测试和生产构建

数据导出器会自动分页读取所有 Issues，排除 Pull Requests，容忍可选空字段，并把无效记录写入 `invalid-records.json`，避免单条错误记录阻塞整个网站。

## 本地开发

需要 Node.js 22.13+ 和 Python 3.11+：

```bash
npm ci
npm run dev
```

常用检查：

```bash
npm test
npm run build
```

本地默认使用 `public/data/` 中的演示数据。要用 GitHub Issues 生成数据：

```bash
GITHUB_REPOSITORY=owner/repository GITHUB_TOKEN=your_token python scripts/export_data.py
```

不要把 Token 写入源码、`VITE_*` 环境变量、Issue 或提交记录。

## 目录

```text
growth-board/
├─ .github/
│  ├─ ISSUE_TEMPLATE/       # 四种结构化录入表单
│  └─ workflows/            # 初始化、验证和 Pages 部署
├─ config/site.json         # 网站与模块开关
├─ public/data/             # 构建数据和演示数据
├─ scripts/
│  ├─ export_data.py        # Issues → JSON
│  └─ tests/                # 导出器测试
├─ src/                     # React 网站
├─ tests/                   # 配置和数据契约测试
└─ README.md
```

## 验收范围

- 375px 宽度无横向页面滚动
- 深浅主题、搜索、筛选、移动导航和模块开关可用
- 新建、编辑、关闭和重新打开 Issue 会触发更新
- 无效 Issue 不影响其他记录
- 构建产物不包含 Token
- 至少支持 1000 条记录（GitHub API 分页，每页 100 条）

## License

[MIT](./LICENSE)
