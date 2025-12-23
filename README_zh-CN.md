
# LOLO' Shoebox (简体中文)

一个注重隐私保护的开发者全能工具箱，拥有整洁好看的 UI 设计。它集成了文本、图像、音视频处理等多种工具，绝大部分操作均在浏览器本地完成。

> **说明**: 本项目代码与内容完全由 **Google Gemini** 生成。

[English Documentation](./README.md)

---

## 🌟 功能特性

**LOLO' Shoebox** 坚持 "仅客户端处理 (Client-Side Only)" 的理念。除特定网络工具外，您的数据（图片、密码、文档）永远不会上传到服务器。

### 🛠️ 工具分类

*   **图像**:
    *   **转换**: 图像压缩与格式转换 (JPG/PNG)。
    *   **编辑**: 尺寸调整、裁剪、九宫格切片、智能抠图 (本地 AI)、画布拼贴。
    *   **生成**: 图片水印、Markdown 转图片、二维码生成。
*   **影音媒体**:
    *   **音频转换**: 可视化波形剪辑、裁剪、淡入淡出及格式转换。
    *   **视频命令生成**: 本地分析视频元数据（编码、码率等），生成最佳 FFmpeg 压缩命令。
    *   **音乐标签**: 告别播放器乱码。一键修复音乐元数据，支持自动补全封面与歌词。
*   **文本与数据**:
    *   **时间与日期**: 实时时间戳、日期格式转换、公农历互转及时间差计算。
    *   **生成器**: 强密码生成、UUID (v4/v5) 生成、MD5 哈希计算。
*   **开发者**:
    *   **JSON 格式化**: 校验、压缩、美化、自动修复 JSON，支持树状预览。
    *   **纹理图集打包**: 使用高效的 **MaxRects** 算法将多个碎图合并为单张大图。支持导出 **Cocos Creator** 格式 (.plist)，支持自定义内边距、外扩、旋转以及透明区域裁剪。
    *   **在线代码运行**: 支持 50+ 种语言的在线编译与运行。
    *   **缓动函数**: 交互式 CSS/JS 缓动曲线可视化。
*   **网络**:
    *   **全球网络检测**: 利用 Globalping 分布式网络检测全球各地的 Ping/HTTP/DNS/路由 连通性。
    *   **宽带测速**: 网络带宽速度测试。

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
    
    **目录结构示例：**
    ```text
    /shoebox
    ├── public/
    │   └── models/
    │       └── imgly-bg-data/
    │           └── dist/        <-- 包含 .wasm, .onnx, .json 等文件
    ├── src/
    └── package.json
    ```

4.  **启动开发服务器**
    ```bash
    npm run dev
    ```
    在浏览器中打开 `http://localhost:5173` 即可使用。

## 📦 生产环境构建

执行以下命令进行构建：

```bash
npm run build
```

构建完成后，`dist` 文件夹内即为编译好的静态资源。您可以将其部署到任何静态托管服务（GitHub Pages, Vercel, Netlify, Nginx 等）。

## 🛠️ 技术栈

- **框架**: [React 18](https://react.dev/)
- **构建工具**: [Vite](https://vitejs.dev/)
- **样式**: [Tailwind CSS](https://tailwindcss.com/)
- **图标**: [Lucide React](https://lucide.dev/)
- **核心库**:
    - `ffmpeg.wasm`, `mediainfo.js` & `browser-id3-writer` (多媒体处理)
    - `@imgly/background-removal` (AI 视觉)
    - `html2canvas` & `upng-js` (图像处理)
    - `lunar-javascript` (公农历转换)
- **外部 API**:
    - **Piston API** (`https://emkc.org/api/v2/piston`): 用于 **在线代码运行** 工具的安全执行。
    - **Globalping API** (`https://api.globalping.io/v1`): 用于 **全球网络检测** 工具的分布式测试。

## 📄 开源协议

本项目采用 GNU General Public License v3.0 协议开源。详情请参阅 [LICENSE](./LICENSE) 文件。
