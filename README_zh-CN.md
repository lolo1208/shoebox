# LOLO' Shoebox (简体中文)

一个注重隐私保护的开发者全能工具箱，拥有整洁好看的 UI 设计。它集成了文本、图像、音视频处理等多种工具，绝大部分操作均在浏览器本地完成。

> **说明**: 本项目代码与内容完全由 **Google Gemini** 生成。

[English Documentation](./README.md)

---

## 🌟 功能特性

**LOLO' Shoebox** 坚持 "仅客户端处理 (Client-Side Only)" 的理念。除特定网络工具外，您的数据（图片、密码、文档）永远不会上传到服务器。

### 🛠️ 工具分类

分类与分类内工具均按预估使用频率排列。

#### 🔢 文本与数据
*   **JSON / YAML 格式化**: JSON 校验、美化、压缩、Key 排序与智能修复，支持 YAML 双向互转、错误行列定位与树状预览。
*   **时间戳转换**: Unix 时间戳与日期互转、公历/农历转换、时差计算。
*   **文本对比**: 逐行/按词/按字符比对，并排与统一视图，行内高亮，可导出标准 `.diff`。
*   **HTTP 状态码**: 收录 1xx–5xx 标准状态码，支持分类筛选与中英文搜索。

#### 🖼️ 图像处理
*   **图片转换与 PDF**: 批量转换 JPG/PNG/WebP（可调质量、颜色深度，多张打包 ZIP），或将多张图片排版导出为多页 PDF（纸张、方向、页边距、适配方式与无损/JPEG 压缩）。
*   **图片尺寸调整**: 像素/百分比缩放，支持锁定纵横比。
*   **图片裁剪**: 可视化自由裁剪，精确坐标与快捷对齐。
*   **图片调色板**: 提取图片主色调生成调色板，支持图片取色、和谐配色，并可导出 CSS / Tailwind / JSON / GIMP / SVG / PNG。
*   **二维码生成**: 自定义尺寸与配色，支持渐变、圆点码点、圆角定位点与中间头像。
*   **AI 智能抠图**: 基于本地 AI 模型移除背景，图片不上传。
*   **图片水印**: 本地生成平铺文字水印，可调颜色、透明度、间距与角度。
*   **图片马赛克**: 框选多个区域，分别设置马赛克、模糊或纯色遮挡。
*   **图片网格切片**: 按行列网格切图并打包 ZIP。
*   **画布拼图**: 多图层拖拽合成，支持旋转、缩放与层级调整。
*   **EXIF 元数据**: 查看并清除 EXIF/GPS/XMP/IPTC/ICC，支持无损重写与批量处理。
*   **Favicon 生成**: 一次生成 Web / iOS / Android 全套图标、PWA 清单与 HTML 引用代码。
*   **Markdown 转图片**: Markdown 实时渲染为长图，内置代码高亮。

#### 🔐 安全与编码
*   **哈希计算**: 一次计算 MD5 / SHA-1 / SHA-256 / SHA-384 / SHA-512 与 HMAC，支持文本与大文件。
*   **Base64 / Base32 / URL 编解码**: 双向互转 Base64（标准 / URL Safe）、Base32（RFC 4648 / Base32hex）与 URL 百分号编码；支持文本 / 文件 / 十六进制输入、填充与折行设置、二进制结果的 Hex 查看，并可把解码结果直接下载为文件。
*   **密码 / 密钥生成**: 一个页面同时生成高强度密码与随机密钥。密码取样使用 Web Crypto 系统熵源 + 拒绝采样（无取模偏差），在「满足约束的合法密码集合」上严格均匀分布，因此熵按 log₂(合法组合数) 精确计算；支持字符类型、长度、常用 / 全 ASCII 标点两套符号集、易混淆字符排除、字符不重复与自定义字符。密钥支持 Hex / Base64 / Base64 URL Safe / Base32 / 可打印 ASCII；实时显示信息熵、强度分级与离线爆破耗时。
*   **UUID / ID 生成**: UUID v4/v5、ULID、NanoID、CUID 一站式生成。
*   **文本加解密**: AES、DES、TripleDES、Rabbit、RC4 加解密。

#### 👨‍💻 开发者
*   **代码运行器**: 通过 Wandbox 在线运行 50+ 种语言，支持语法高亮与编译器选择。
*   **程序员计算器**: HEX / DEC / OCT / BIN 互转，8/16/32/64 位宽、补码与位运算。
*   **缓动曲线**: 交互式展示 CSS/JS 缓动函数曲线与动画。
*   **纹理图集打包**: MaxRects 算法合并碎图，导出 Cocos Creator 兼容的 plist 与 PNG。
*   **位图字体生成**: 将字符图片打包为 .fnt，支持 Text / XML / JSON 导出。

#### 🌐 网络
*   **HTTP 请求调试**: 自定义方法、参数、请求头与请求体，查看响应与 TLS 信息，导出 cURL。
*   **DNS TXT 查询**: 支持阿里云、Google、Cloudflare 等 DoH 服务。
*   **全球网络检测**: 通过 Globalping 全球探针检测 Ping / HTTP / DNS / Traceroute。
*   **WHOIS 查询**: 查询域名、IP 与 AS 号的注册信息，RDAP 优先并自动回退。
*   **网络测速**: 下行/上行速度、延迟与抖动，实时图表展示。
*   **端口工具**: 避开已知端口生成随机端口，并提供常用端口查询。

#### 🎬 影音媒体
*   **媒体信息查看**: 读取容器、编码、码率、声道、字幕与章节等参数。
*   **视频抽帧**: 按等间隔、均分帧数或场景切换逐帧截图，支持 PNG/JPG/WebP、时间码命名与 ZIP 打包下载。
*   **视频转 GIF**: 截取片段并设置帧率、宽度与抖动算法，通过 ffmpeg.wasm 的全局 256 色调色板生成循环动图。
*   **音频转换与剪辑**: 波形剪辑、音量调节、采样率转换，通过 ffmpeg.wasm 导出。
*   **FFmpeg 命令生成**: 本地解析视频参数，可视化生成转码与压缩命令。
*   **音乐标签编辑**: 修复标题、歌手、专辑，补全封面与歌词。

### 📁 项目结构

```text
src/
├── components/        # 通用视图组件（layout / home / tool / ui / brand / media）
├── config/            # 工具注册表：分组、顺序、图标、组件引用
├── contexts/          # 全局上下文（语言）
├── features/tools/    # 按领域拆分的工具实现
│   ├── text/ image/ security/ developer/ network/ media/
├── hooks/             # 通用 hooks（本地存储、剪贴板、工具列表）
├── lib/               # 纯逻辑层（crypto / codec / secret / image / text / http / network / media / math / id）
├── locales/           # 中英文文案
├── styles/            # 全局样式
└── types/             # 类型定义
```

新增工具：在 `src/features/tools/<领域>/` 下创建组件（较复杂的工具可拆为 `index.ts` + 主组件 + `components/` 子目录，如 `security/codec/`），然后在 `src/config/toolCatalog.ts` 按热门程度插入注册，并补充 `src/locales/zh.ts` 与 `en.ts` 文案。

## 🚀 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) 20.19+ 或 22.12+（Vite 8 的要求）
- [pnpm](https://pnpm.io/)（仓库提供 `pnpm-lock.yaml`）

### 隐私与网络访问

大部分文件处理在浏览器本地完成。网络工具和代码运行器会向外部服务发送请求或提交的代码，音乐元数据查询也会访问第三方 API；部分媒体工具还需从 CDN 下载 WebAssembly 资源。提交敏感数据前请确认请求目标，不应假设整个应用均可离线使用。

### 安装步骤

1.  **克隆仓库**
    ```bash
    git clone https://github.com/lolo1208/shoebox.git
    cd shoebox
    ```

2.  **安装依赖**
    ```bash
    pnpm install --frozen-lockfile
    ```

3.  **配置 AI 模型 (重要)**
    **智能抠图** 工具需要本地 AI 模型文件才能离线运行。
    
    1.  从以下地址下载模型包：
        `https://staticimgly.com/@imgly/background-removal-data/1.7.0/package.tgz`
    2.  解压压缩包。
    3.  在项目根目录下创建文件夹 `public/models/imgly-bg-data/`。
    4.  将解压出的 `dist` 文件夹复制到 `public/models/imgly-bg-data/` 中。
    
4.  **启动开发服务器**
    ```bash
    pnpm dev
    ```
    打开 Vite 输出的地址（通常为 `http://localhost:5173`）。

### 构建与预览

```bash
pnpm build
pnpm preview
```

构建产物位于 `dist/`，可部署到静态文件服务器。若需要智能抠图，还需部署上述模型资源；这些文件不纳入 Git。项目也定义了 `pnpm lint`，运行前需提供 ESLint 配置。

## 🛠️ 技术栈

- **框架**: [React 18](https://react.dev/)
- **构建工具**: [Vite](https://vitejs.dev/)
- **样式**: [Tailwind CSS](https://tailwindcss.com/)
- **核心库**:
    - `ffmpeg.wasm`, `mediainfo.js` & `browser-id3-writer` (多媒体处理)
    - `@imgly/background-removal` (AI 视觉)
    - `html2canvas` & `upng-js` (图像处理)
    - 内置 PDF 写入器（图片转 PDF，无第三方依赖）
    - `lunar-javascript` (公农历转换)
    - `js-yaml` (YAML 解析与生成)

## 📄 开源协议

原项目文档注明采用 GPL-3.0，但仓库目前未包含许可证文件；具体许可信息请向项目所有者确认。