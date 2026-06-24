# 《入戏》— 电影胶片质感 · 穿门角色生成 H5

单页移动端 H5（竖屏，375–430px）。打开即玩、无需登录。在轻旁白引路下连穿 **9 道门**（4 道通用分流 + 5 道世界专属）→ 被划入一个世界并定下角色 → 输入名字 + 上传照片 → 铸造加载 → **随世界变化的复古报纸角色卡** → 邀请好友进同一个世界 → 群像页 → 去元宝续写。

> 当前完整跑通的世界：**宫廷权谋**（4 分流门 + 5 专属门，Spec 第十一节样板）。
> 其余世界（赛博都市 / 民国旧梦 / 魔法学院 / 江湖武侠）已铺好**结构一致的占位题**，补全只需替换 `js/worlds.js` 中对应文案。

---

## 一、直接部署（任选其一）

### A. GitHub Pages（最简单，纯静态）
1. 新建一个 GitHub 仓库，把本目录所有文件推上去（包含 `.github/`、`.nojekyll`）。
2. 仓库 **Settings → Pages → Source** 选 **GitHub Actions**。
3. 推送后自动构建，几分钟得到 `https://<用户名>.github.io/<仓库名>/`。
4. ✅ 即可在手机上完整体验（生成走**前端参数化兜底**，每人小传仍不同；照片做旧立绘在本地完成）。

> 纯静态模式下没有后端，因此**图生图与文本真生成不启用**，自动降级。要启用真生成请用下面的 B/C 方案。

### B. Netlify（带后端转发，可接图生图/文本模型）
1. 把本目录推到 Git 仓库，在 Netlify 选 **Import from Git**。
2. Netlify 会自动识别 `netlify.toml`：静态根目录 = `.`，函数目录 = `netlify/functions`。
3. 在 **Site settings → Environment variables** 配置（按需）：
   - `LLM_API_URL`、`LLM_API_KEY`、`LLM_MODEL` — 文本模型（OpenAI 兼容 `chat/completions`）
   - `IMG_API_URL`、`IMG_API_KEY` — 图生图（元宝/混元，按你的接口在 `generate.js` 里对接）
4. 部署后即 HTTPS，照片上传 + 图生图正常工作。

### C. Vercel（带后端转发）
1. Import 仓库，Vercel 自动把 `api/generate.js` 路由为 `/api/generate`。
2. 在 **Settings → Environment Variables** 配置同上变量。
3. 部署完成即可。

> 前端默认请求**同源** `/api/generate`。若后端不在同源，在 `index.html` 里加一行：
> `<script>window.RUXI_API_BASE='https://你的后端域名'</script>`（放在业务脚本之前）。

---

## 二、关键安全点（按 Spec）
- **前端无任何模型 key**：所有生成请求只发给后端 `/api/generate`，由服务端用环境变量里的 key 转发。
- **照片即用即弃**：照片仅随单次请求转发，后端**不落盘、不存储**；前端上传前有明确授权告知。
- **HTTPS**：照片上传与图生图必须 HTTPS（上述三种部署均为 HTTPS）。

## 三、多人玩法（不依赖登录）
- 创世者完成后建房间，邀请链接形如 `…/#/join?w=<房间ID>&k=<世界键>&h=<房主名>`，**世界信息直接编码在链接里**。
- 好友点链接走同样的穿门流程，被引导进入**同一个世界**，但角色由 ta 自己的专属门答出来（平等参与，**不强配关系**）。
- 群像页并列展示全员角色卡。
  - 当前为**同设备/同浏览器**的本地群像（`localStorage` 按房间归档）。
  - 如需**跨设备实时群像**，在后端加 `/api/room`（GET 拉取、POST 提交成员），前端把 `STORE.loadCast/saveMember` 换成接口即可，结构已预留。

## 四、元宝续写钩子
结果页/群像页「去元宝续写」通过 deeplink `tencentyuanbao://chat?msg=…` 唤起元宝并**预填**"继续【XX世界】的故事 + 角色卡/全员名单"；未安装则回退到元宝官网下载页。

## 五、目录结构
```
ruxi/
├─ index.html              # 单页入口
├─ css/style.css           # 胶片质感 + 复古报纸皮肤（随世界切换）
├─ js/
│  ├─ worlds.js            # 题库 + 世界 + 分流引擎（宫廷权谋完整，其余占位）
│  ├─ store.js             # 房间态 + 分享链接编解码 + 本地群像
│  ├─ generator.js         # 生成层：后端转发 + 参数化兜底（每人不同）+ 立绘做旧
│  ├─ app.js               # 主控：穿门/旁白/铸造/报纸/群像/邀请/元宝
│  └─ qrcode.min.js        # 二维码（本地内联，无外网依赖）
├─ api/generate.js         # 后端转发（Vercel）
├─ netlify/functions/generate.js  # 后端转发（Netlify）
├─ netlify.toml / vercel.json     # 部署配置
└─ .github/workflows/deploy-pages.yml  # GitHub Pages 自动部署
```

## 六、本地预览
```bash
cd ruxi
python3 -m http.server 8080
# 打开 http://localhost:8080  （建议用手机模拟/真机扫码）
```

## 七、补全其余世界
打开 `js/worlds.js`：
1. 在 `WORLDS` 加世界（含 `skin` 报纸皮肤、`tone` 氛围色、`roles` 角色池、`artStyle` 画风）。
2. 在 `WORLD_PROFILE` 给分流画像权重，让它可被 4 道分流门命中。
3. 在 `WORLD_QUESTIONS` 把占位的 5 道题换成正式文案（保持 `trait` 标签结构）。
4. 文案兜底在 `js/generator.js` 的 `ROLE_FLAVOR` 里按角色补。
