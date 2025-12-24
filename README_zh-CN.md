# LOLO' Shoebox (简体中文)

一个注重隐私保护的开发者全能工具箱，拥有整洁好看的 UI 设计。它集成了文本、图像、音视频处理等多种工具，绝大部分操作均在浏览器本地完成。

> **说明**: 本项目代码与内容完全由 **Google Gemini** 生成。

[English Documentation](./README.md)

---

## 🌟 功能特性

**LOLO' Shoebox** 坚持 "仅客户端处理 (Client-Side Only)" 的理念。除特定网络工具外，您的数据（图片、密码、文档）永远不会上传到服务器。

### 🛠️ 工具分类

#### 🖼️ 图像 (Image)
*   **图像压缩与转换**: 支持 JPG, PNG, WEBP, GIF 等格式互转。提供 JPG 质量调节以及 PNG 有损压缩（颜色量化），在保持画质的同时大幅减小文件体积。
*   **图像尺寸调整**: 修改图片分辨率，支持像素或百分比缩放，可锁定纵横比，使用高质量 Canvas 重采样算法。
*   **图像裁剪**: 精确的图像裁剪工具，支持坐标控制和快捷对齐。提供可视化的交互界面，轻松选择裁剪区域。
*   **图像切片**: 将大图按行列网格切分为多张小图（如朋友圈九宫格）。自动将切片后的图片打包为 ZIP 文件供下载。
*   **智能抠图**: 基于本地 AI 模型 (`imgly-bg-removal`)。完全在本地 GPU/CPU 上识别并移除背景，无需将敏感图片上传至任何服务器。
*   **画布拼贴**: 轻量级画布编辑器。支持多图拖拽、旋转、缩放以及层级（Z-index）调整，适用于制作社交媒体海报或简单排版。
*   **图片水印**: 在图片上添加平铺文本水印。可自定义颜色、透明度、间距和旋转角度，保护您的证件或文档安全。
*   **Markdown 转图片**: 将 Markdown 文本实时渲染为高质量图片。内置代码块语法高亮，支持自定义样式。
*   **二维码生成**: 生成自定义二维码，支持调节尺寸、前景色和背景色。

#### 🎬 影音媒体 (Media)
*   **音频压缩与转换**: 浏览器内的全功能音频编辑器。支持波形剪辑、音量调节、淡入淡出效果，并利用 `ffmpeg.wasm` 导出为 MP3, M4A, WAV 或 OGG。
*   **视频压缩与转换**: 本地分析视频元数据（码率、轨道信息），可视化生成优化的 FFmpeg 命令。适用于 NAS 归档优化或极限压缩。
*   **音乐标签 (ID3) 编辑**: 修复 MP3 文件的元数据。支持从网易云、QQ 音乐或 iTunes 搜索并自动填充标题、歌手、专辑信息，以及补全封面和歌词。

#### 🔢 文本与数据 (Text & Data)
*   **时间与日期**: 全能时间工具，包含 Unix 时间戳互转、公历/农历转换，以及两个日期之间的精确时长计算。
*   **随机密码生成**: 生成高熵安全密码。可自定义长度和字符类型（大写、小写、数字、符号）。
*   **UUID 生成器**: 批量生成 Version 4（随机）UUID，或基于命名空间的 Version 5 UUID。
*   **MD5 计算器**: 计算纯文本或本地大文件的 MD5 哈希值。采用分块读取技术，处理大文件时浏览器也不会卡死。

#### 👨‍💻 开发者 (Developer)
*   **JSON 格式化**: 不仅仅是美化工具。它支持校验、压缩、Key 按字母排序，并具备“智能修复”功能，可自动纠正常见的 JSON 语法错误。
*   **纹理图集打包 (Texture Packer)**: 游戏开发必备工具。使用 **MaxRects** 算法将多个碎图合并为单张大图。支持导出 Cocos Creator 兼容的 `.plist` 和 PNG。
*   **Bitmap Font 生成器**: 将零散的字符图片打包为专业的位图字体 (.fnt)。支持自动字符推断、ASCII 映射，并提供 Text、XML 或 JSON 三种导出格式。
*   **在线运行代码**: 通过 Piston API 在线执行 50 多种编程语言的代码片段。支持语法高亮及命令行参数配置。
*   **缓动函数可视化**: 交互式展示 CSS/JS 常用缓动曲线（In, Out, InOut）。包含悬停动画演示，直观预览速度变化。

#### 🌐 网络 (Network)
*   **全球网络检测**: 分布式网络诊断。通过 Globalping API 调用全球探针，检测指定目标的 Ping, HTTP, DNS 和 Traceroute 状态。
*   **宽带测速**: 高精度宽带测速工具。检测网络下行、上行速度及延迟抖动，并提供实时图形化展示。

## 🚀 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) (推荐 v18 以上)
- [npm](https://www.npmjs.com/) 或 yarn

### 安装步骤

1.  **克隆仓库**
    ```bash
    git clone https://github.com/lolo1208/shoebox.git
    cd shoebox
    ```

2.  **安装依赖**
    ```bash
    npm install
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
    npm run dev
    ```
    打开 `http://localhost:5173` 即可访问。

## 🛠️ 技术栈

- **框架**: [React 18](https://react.dev/)
- **构建工具**: [Vite](https://vitejs.dev/)
- **样式**: [Tailwind CSS](https://tailwindcss.com/)
- **核心库**:
    - `ffmpeg.wasm`, `mediainfo.js` & `browser-id3-writer` (多媒体处理)
    - `@imgly/background-removal` (AI 视觉)
    - `html2canvas` & `upng-js` (图像处理)
    - `lunar-javascript` (公农历转换)

## 📄 开源协议

本项目采用 GNU General Public License v3.0 协议开源。详情请参阅 [LICENSE](./LICENSE) 文件。