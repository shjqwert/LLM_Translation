# LLM Translator - 本地AI翻译工具

基于 **Ollama + Qwen2.5:7B** 的本地翻译工具，支持网页实时翻译、PDF/文档翻译、中英双向翻译。

## 功能

- ✅ **文本翻译** — 流式SSE逐字显示
- ✅ **文档翻译** — PDF / DOCX / TXT 上传翻译，左右对照
- ✅ **网页翻译** — Chrome扩展，一键翻译整页/选中文本右键翻译
- ✅ **翻译缓存** — SQLite缓存避免重复请求
- ✅ **中英双向** — EN→中 / 中→EN / 自动检测

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

### 3. 启动后端服务
```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. 打开Web翻译界面
浏览器访问 http://localhost:8000

### 5. 安装Chrome扩展
1. 打开 `chrome://extensions/`
2. 开启"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `extension/` 目录

## 项目结构

```
LLM_Translation/
├── backend/                # FastAPI后端
│   ├── main.py             # 应用入口
│   ├── api/
│   │   ├── translate.py    # 翻译API
│   │   └── document.py     # 文档翻译API
│   ├── core/
│   │   ├── ollama_client.py
│   │   ├── translator.py
│   │   ├── cache.py
│   │   └── document_parser.py
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
