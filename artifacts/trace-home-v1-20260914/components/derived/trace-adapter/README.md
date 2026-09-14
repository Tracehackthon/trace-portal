# Scene glass 原生适配器候选

任务 `trace-home-v1-prototype-20260914`。仅写候选资源，未写应用；主 Agent 决定采用和实际验证。

## 放置与调用

应用内可使用 `src/home/scene-glass.js` + `src/vendor/shape-only.mjs`；代码采用可失败的动态相对导入 `../vendor/shape-only.mjs`，导入失败仍保留表层。vendor 来自本包已有 `derived/liquidglassjs/shape-only.mjs`，保留其 MIT LICENSE。**artifact 当前目录没有 vendor 副本，直接打开不会启用复杂折射。**

```js
import { mountSceneGlass } from './scene-glass.js';

const glass = mountSceneGlass({
  host: bubble.querySelector('.bubble-material'), // absolute 空装饰层
  backgroundUrl: new URL('../../public/scene.png', import.meta.url).href,
  scene: document.querySelector('.home-scene'),
  path: () => bubble.dataset.shape, // normalized viewBox: 0 0 1000 300
  width: 440,
  height: 150,
  tone: 'cool', // 'warm' / 'gold' 使用轻暖色
});

// 状态改变、形状 morph 完成、transform 动画结束后：
glass.refresh();
// 销毁页面或实体：
glass.destroy();
```

- `scene` 是完整背景所在 HTMLElement；要求背景 `cover / center`，不含 rotation/skew。通过 scene、host 的 viewport bbox 与原图自然尺寸计算采样；整体缩放可以处理。不是把每个气泡各自设成一张背景的 cover。
- `host` 必须无文字、无 padding/border；定位/宽高/动画均归调用方。文字与可点控件是独立 sibling。适配器自己的层全部 `pointer-events:none`、`aria-hidden`。
- `path` 为字符串或返回字符串的函数；refresh 重新读取。调用方可沿用同一实体并在 morph 后刷新；适配器本身不执行轮廓 morph。
- `width/height` 只为测量不到 client size 时兜底，不会改变 host。
- `host.dataset.glassRefraction = 'off'` 可单独禁用复杂折射；面积大于 260,000 viewport px² 时也保留轻量表层。建议只给活跃小气泡启用，不给全部内容套滤镜。
- `refresh()` 合并为 160 ms 静止后一次重建；host resize 一开始移除复杂滤镜，过渡期间使用可缩放 SVG 表层，避免上游的 ResizeObserver 对 width 动画逐帧重建地图。单纯 transform 不触发 ResizeObserver，动画结束仍需显式 refresh。
- 使用低 `strength=1.8`、`chroma=0`、`shade=0`，没有灰黑阴影和强色散。样片里仍要根据实际白背景调整透明度；这里不是视觉验收值。

## 降级与边界

图片未加载、vendor 缺失、Path2D 不可用、面积超预算或显式关闭时，白/暖金 SVG 填充和轮廓仍显示，不阻断点击。复杂滤镜只作用于有气泡 alpha 的采样 SVG，真实文字不会被滤镜处理。

背景必须与场景使用同一 URL、同一 cover/center 方式；多层背景、独立 object-position、额外裁切、旋转/透视不在当前适配范围。map 内部异步运行不提供 ready Promise，因此 `data-refraction="requested"` 只表示已调用材质接口，不代表浏览器已绘制成功。

已运行 Node 语法检查及纯几何单元测试；未运行浏览器、Electron file://、SVG/滤镜与动画性能验收。待主 Agent 在实际页面验证。
