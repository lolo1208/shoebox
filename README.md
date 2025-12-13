
# LOLO' Shoebox

A comprehensive, privacy-first developer toolbox designed with a clean UI. It features a wide array of tools for text, image, and audio/video processing, all running entirely in your browser.

[简体中文指南](#简体中文)

---

## 🌟 Features

**LOLO' Shoebox** is built with a "Client-Side Only" philosophy. Your data (images, passwords, code) never leaves your device.

### 🛠️ Tool Categories

*   **Text Tools**:
    *   **Time & Date**: Real-time timestamp, date conversion, solar/lunar calendar conversion, and duration calculator.
    *   **Generators**: Strong Passwords, UUIDs (v4/v5), MD5 Hashes.
*   **Image Tools**:
    *   **Background Remover**: AI-powered background removal running locally (WebAssembly).
    *   **Image Converter**: Convert between JPG/PNG, compress, and adjust quality.
    *   **Image Editor**: Crop, Resize, and Slice images into grids.
    *   **Composition**: Infinite canvas to stitch multiple images together.
    *   **Watermark**: Add customizable tile watermarks.
    *   **Markdown to Image**: Convert Markdown text into beautiful long screenshots.
    *   **QR Code**: Generate custom QR codes.
*   **Audio/Video Tools**:
    *   **Audio Converter**: Visual waveform editing, trimming, fading, and format conversion.
    *   **Video Command Generator**: Analyze video metadata locally and generate FFmpeg compression commands.
*   **Developer Tools**:
    *   **JSON Formatter**: Validate, minify, beautify, and repair JSON with a tree view.
    *   **Easing Visualizer**: Interactive CSS/JS easing function visualization.
    *   **Code Runner**: Run code in 50+ languages online with instant output.
    *   **Check Host**: Global network connectivity check (Ping, HTTP, DNS, MTR) using distributed probes.

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (Version 18+ recommended)
- [npm](https://www.npmjs.com/) or yarn

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/lolo1208/shoebox.git
    cd shoebox
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Setup AI Model (Important)**
    The **Background Remover** tool requires local AI model files to function offline.
    
    1.  Download the model package from:
        `https://staticimgly.com/@imgly/background-removal-data/1.7.0/package.tgz`
    2.  Extract the contents.
    3.  Create a folder named `public/models/imgly-bg-data/` in your project root.
    4.  Copy the `dist` folder from the extracted package into `public/models/imgly-bg-data/`.
    
    **Directory Structure:**
    ```text
    /shoebox
    ├── public/
    │   └── models/
    │       └── imgly-bg-data/
    │           └── dist/        <-- Contains .wasm, .onnx, .json files
    ├── src/
    └── package.json
    ```

4.  **Run Development Server**
    ```bash
    npm run dev
    ```
    Open `http://localhost:5173` (or the port shown in your terminal) to view the app.

## 📦 Building for Production

To create a production-ready build:

```bash
npm run build
```

This will generate a `dist` folder containing the compiled assets. You can deploy this folder to any static hosting service (GitHub Pages, Vercel, Netlify, Nginx, etc.).

**Note**: The AI model files in `public/` will be copied to the build output automatically.

## 🛠️ Technologies

- **Framework**: [React 18](https://react.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Core Libraries**:
    - `ffmpeg.wasm` & `mediainfo.js` (Media processing)
    - `@imgly/background-removal` (AI Vision)
    - `html2canvas` & `upng-js` (Image processing)
    - `lunar-javascript` (Calendar conversion)

## 📄 License

This project is licensed under the MIT License.

---

<a id="简体中文"></a>

# LOLO' Shoebox (简体中文)

一个注重隐私保护的开发者全能工具箱，拥有整洁的 UI 设计。它集成了文本、图像、音视频处理等多种工具，所有操作均在浏览器本地完成。

## 🌟 功能特性

**LOLO' Shoebox** 坚持 "仅客户端处理 (Client-Side Only)" 的理念。您的数据（图片、密码、代码）永远不会上传到服务器。

### 🛠️ 工具分类

*   **文本工具**:
    *   **时间与日期**: 实时时间戳、日期格式转换、公农历互转及时间差计算。
    *   **生成器**: 强密码生成、UUID (v4/v5) 生成、MD5 哈希计算。
*   **图像工具**:
    *   **智能抠图**: 基于 WebAssembly 的本地 AI 自动移除背景。
    *   **图像转换**: JPG/PNG 格式互转、压缩、质量调节。
    *   **图像编辑**: 裁剪、尺寸调整、九宫格切片。
    *   **画布拼贴**: 无限画布，支持多图层拼接合成。
    *   **图片水印**: 添加自定义防盗图水印。
    *   **Markdown 转图片**: 将 Markdown 文本渲染为精美长图。
    *   **二维码生成**: 实时生成自定义二维码。
*   **影音工具**:
    *   **音频转换**: 可视化波形剪辑、裁剪、淡入淡出及格式转换。
    *   **视频命令生成**: 本地分析视频元数据（编码、码率等），生成最佳 FFmpeg 压缩命令。
*   **开发者工具**:
    *   **JSON 格式化**: 校验、压缩、美化、自动修复 JSON，支持树状预览。
    *   **缓动函数**: 交互式 CSS/JS 缓动曲线可视化。
    *   **在线代码运行**: 支持 50+ 种语言的在线编译与运行。
    *   **全球网络检测**: 利用 Globalping 分布式网络检测全球各地的 Ping/HTTP/DNS/路由 连通性。

## 🚀 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) (推荐 v18 以上)
- [npm](https://www.npmjs.com/) 或 yarn

### 安装步骤

1.  **克隆项目**
    ```bash
    git clone https://github.com/lolo1208/shoebox.git
    cd shoebox
    ```

2.  **安装依赖**
    ```bash
    npm install
    ```

3.  **配置 AI 模型 (重要)**
    **智能抠图**功能需要本地模型文件才能离线运行。
    
    1.  请前往以下地址下载模型包：
        `https://staticimgly.com/@imgly/background-removal-data/1.7.0/package.tgz`
    2.  解压下载的文件。
    3.  在项目根目录下创建文件夹路径：`public/models/imgly-bg-data/`。
    4.  将解压后包内的 `dist` 文件夹及其所有内容复制到该目录下。
    
    **文件目录结构应如下所示：**
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

## 📦 打包构建

构建生产环境版本：

```bash
npm run build
```

构建完成后会生成 `dist` 目录。您可以将该目录部署到任何静态网站托管服务（如 GitHub Pages, Vercel, Nginx 等）。

**注意**: `public/` 目录下的 AI 模型文件会自动复制到构建结果中，无需额外操作。

## 🛠️ 技术栈

- **框架**: [React 18](https://react.dev/)
- **构建工具**: [Vite](https://vitejs.dev/)
- **样式**: [Tailwind CSS](https://tailwindcss.com/)
- **图标**: [Lucide React](https://lucide.dev/)
- **核心库**:
    - `ffmpeg.wasm` & `mediainfo.js` (多媒体处理)
    - `@imgly/background-removal` (AI 视觉)
    - `html2canvas` & `upng-js` (图像处理)
    - `lunar-javascript` (日历转换)

## 📄 开源协议

本项目基于 MIT 协议开源。
