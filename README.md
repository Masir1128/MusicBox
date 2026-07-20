# ORBITONE 星轨音乐盒

把钢琴旋律变成 9:16 弹跳音乐动画。音乐会直接在浏览器本地解析，不上传到服务器。

[在线试玩](https://orbitone-music-box.cxyaiyang.chatgpt.site) · [问题反馈](https://github.com/Masir1128/MusicBox/issues)

![ORBITONE 星轨音乐盒](public/og.png)

## 关于这个开源版本

这里保存的是 ORBITONE 的第一个开源快照 `v1.0.0`。在线网站会持续迭代，因此在线功能可能比本仓库更新；后续源码版本只有在项目维护者明确确认后才会发布到 GitHub。

开发者：**科学羊**

项目来源：科学羊原创实验项目

## 主要功能

- 上传 MP3、WAV、M4A、AAC、OGG 或 FLAC，在浏览器本地完成解析。
- 针对钢琴触键的频谱起音检测，并使用 Basic Pitch 做模型复核。
- 支持快速密集钢琴段落、红色模型补点开关和人工落点编辑。
- 9:16 弹跳动画、霓虹光圈、星星、烟花和卡通爆发效果。
- `0.25× / 0.5× / 0.75× / 1×` 慢动作联调。
- `0–60ms` 动画显示延迟补偿。
- 可拖动、可缩放的 9:16 调试预览。
- 8 首原创、谱面精确对齐的测试样本。
- 导出踩点调试 JSON，并支持 9:16 视频录制。

## 适用音乐

推荐使用：

- 钢琴独奏；
- 主旋律和触键清楚；
- 混响较少；
- 单音旋律或层次相对简单的钢琴录音。

暂不建议：

- 人声、鼓、弦乐、笛声大量叠加；
- 复杂齐奏；
- 现场噪声或强混响录音。

自动音乐转录无法保证适配所有音乐。请使用慢动作与算法调试轨道复核结果，必要时手工增加、删除或调整落点。

## 本地运行

环境要求：Node.js `>=22.13.0`。

```bash
git clone https://github.com/Masir1128/MusicBox.git
cd MusicBox
npm install
npm run dev
```

终端会显示本地访问地址。生产构建：

```bash
npm run build
npm start
```

代码检查与测试：

```bash
npm run lint
npm test
```

## 项目结构

```text
app/                     页面、交互和样式
lib/melodyAnalyzer.ts    钢琴频谱起音分析
lib/pianoOnsetAnalyzer.ts Basic Pitch 复核与候选融合
lib/renderMusicBox.ts    9:16 动画渲染器
public/models/           浏览器端 Basic Pitch 模型
public/samples/          原创测试音乐及精准谱面
scripts/                 原创样本生成脚本
tests/                   构建与产品回归测试
```

## 音乐与隐私

- 上传的音乐只在当前浏览器内解析，不会由本项目上传或保存。
- 请仅使用自己创作、已获得授权或依法可以使用的音乐。
- 仓库内测试音频为本项目原创生成样本，仅用于演示和算法验证。

## 开源许可

本项目原创代码使用 [MIT License](LICENSE)。

项目使用 Spotify Basic Pitch 及其模型文件，它们使用 Apache License 2.0。详情见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 与 [licenses/Apache-2.0.txt](licenses/Apache-2.0.txt)。

## 贡献

欢迎提交 Issue 反馈不同钢琴曲的踩点表现。提交问题时，建议附上：

- 音乐类型和大致速度；
- 出问题的时间位置；
- 慢动作下是“识别点不准”还是“动画显示不准”；
- 调试轨道截图或导出的调试 JSON。

在线网站与本仓库采用分离发布：网站会继续更新，但 GitHub 源码不会自动同步。
