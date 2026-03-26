# LLM Translator - 本地AI翻译工具

基于本地/云端LLM的翻译工具，支持 **Ollama / OpenAI / Gemini** 多后端切换，网页实时翻译、PDF/文档翻译、中英双向翻译。

## 功能

- ✅ **文本翻译** — 流式SSE逐字显示
- ✅ **文档翻译** — PDF / DOCX / TXT 上传翻译，左右对照
- ✅ **网页翻译** — Chrome扩展，一键翻译整页/选中文本右键翻译
- ✅ **翻译缓存** — SQLite缓存避免重复请求
- ✅ **中英双向** — EN→中 / 中→EN / 自动检测
- ✅ **多后端支持** — Ollama(本地) / OpenAI兼容API / Google Gemini
- ✅ **API Key安全** — Key存储在`.env`中，不会上传Git

## 快速开始

### 1. 确保Ollama已启动
```bash
ollama serve
ollama pull qwen2.5:7b
```

### 2. 安装后端依赖
```bash
cd backend
pip install -r requirements.txt
```

### 3. 配置翻译后端
```bash
# 复制配置模板
cp backend/.env.example backend/.env
# 编辑 backend/.env，填写API Key（使用Ollama可跳过此步）
```

### 4. 启动后端服务
```bash
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

### 5. 打开Web翻译界面
浏览器访问 http://localhost:8000

### 6. 安装Chrome扩展
1. 打开 `chrome://extensions/`
2. 开启"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `extension/` 目录

## 切换翻译后端/模型

编辑 `backend/.env`，修改后重启服务即可。

### 使用Ollama本地模型
```ini
TRANSLATE_PROVIDER=ollama
OLLAMA_MODEL=qwen2.5:7b       # 可改为 qwen2.5:14b 等
```

### 使用OpenAI / DeepSeek / 通义千问等
```ini
TRANSLATE_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
OPENAI_BASE_URL=https://api.openai.com/v1   # DeepSeek: https://api.deepseek.com/v1
OPENAI_MODEL=gpt-4o-mini                     # DeepSeek: deepseek-chat
```

### 使用Google Gemini
```ini
TRANSLATE_PROVIDER=gemini
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-2.0-flash
```

> ⚠️ `.env` 文件已被 `.gitignore` 排除，API Key不会上传到Git。

## 项目结构

```
LLM_Translation/
├── backend/                # FastAPI后端
│   ├── main.py             # 应用入口
│   ├── api/
│   │   ├── translate.py    # 翻译API
│   │   └── document.py     # 文档翻译API
│   ├── core/
│   │   ├── config.py          # 配置管理(.env加载)
│   │   ├── ollama_client.py
│   │   ├── openai_client.py   # OpenAI兼容API
│   │   ├── gemini_client.py   # Google Gemini
│   │   ├── translator.py      # 多后端路由
│   │   ├── cache.py
│   │   └── document_parser.py
│   ├── .env                   # 配置文件(不上传Git)
│   ├── .env.example           # 配置模板
│   └── static/             # Web UI
├── extension/              # Chrome扩展
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   ├── popup.html/js/css
│   └── icons/
└── README.md
```

## API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/translate` | POST | 单句翻译 |
| `/api/translate/stream` | POST | 流式翻译 (SSE) |
| `/api/translate/batch` | POST | 批量翻译 |
| `/api/document/upload` | POST | 上传文档 |
| `/api/document/translate` | POST | 翻译文档 (SSE) |
| `/api/status` | GET | 查询当前后端状态 |
