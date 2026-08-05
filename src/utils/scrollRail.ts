// Shared scroll-rail engine — the left-edge HUD rail (year readout on the
// archive page, dossier counter on the projects page).
//
// One engine owns the scroll/resize wiring, runway-progress accumulation, the
// active-item index, the readout text, and the rail visibility toggle. Per-page
// differences are passed in: per-item side effects (projects writes
// --panel-progress/--panel-reveal), readout wording, and the active predicate.
//
// Follows the standard init + astro:after-swap + AbortController pattern: the
// caller owns the AbortController and passes its signal; everything registered
// here is torn down when that signal aborts. Under `prefers-reduced-motion` it
// leaves a static final state via `reducedMotionState`.

export interface ScrollRailOptions {
  /** 容器：IntersectionObserver 观察对象，控制 rail 显隐 */
  root: HTMLElement;
  /** 每个滚动手势单元（archive 的年份 section / projects 的 panel 包裹） */
  items: HTMLElement[];
  rail: HTMLElement | null;
  readout: HTMLElement | null;
  fill: HTMLElement | null;
  /** 归属本 init 的 AbortSignal（换页/卸载时统一拆除） */
  signal: AbortSignal;
  /** 每帧为单个 item 的副作用（projects 写 --panel-progress/--panel-reveal） */
  onItem?: (item: HTMLElement, passed: number, runway: number) => void;
  /** 读数文案：传入当前活跃下标（0-based） */
  formatReadout: (active: number) => string;
  /** 活跃判定：当前正被钉住的 item（默认顶部已越过钉线 0） */
  isActive?: (rect: DOMRect, i: number) => boolean;
  /** reduced-motion 下的静态落点（逐 item 收尾副作用） */
  reducedMotionState?: () => void;
}

export function initScrollRail(opts: ScrollRailOptions): void {
  const {
    root,
    items,
    rail,
    readout,
    fill,
    signal,
    onItem,
    formatReadout,
    // 默认 last-match-wins：最后一个顶部越过钉线的 item 即正被钉住的那个。
    // 不加 `rect.bottom > 0` 子句——已整体滚过视口顶的末尾项会因此「无匹配→回跳第一个」。
    isActive = (rect) => rect.top <= 0,
    reducedMotionState,
  } = opts;

  const total = items.length;
  if (!total) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ticking = false;

  function compute() {
    ticking = false;
    let active = 0;
    let overall = 0;
    let overallMax = 0;

    items.forEach((item, i) => {
      const rect = item.getBoundingClientRect();
      const vh = window.innerHeight;
      const runway = rect.height + vh;
      const passed = Math.min(Math.max(vh - rect.top, 0), runway);
      onItem?.(item, passed, runway);
      overall += passed;
      overallMax += runway;
      // 活跃 = 最后一个通过判定的 item：已整体滚过视口顶的末尾项保持最后一项，不回跳第一个
      if (isActive(rect, i)) active = i;
    });

    if (readout) readout.textContent = formatReadout(active);
    if (fill && overallMax > 0) fill.style.transform = `scaleY(${(overall / overallMax).toFixed(4)})`;
  }

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(compute);
  };

  if (reduceMotion) {
    reducedMotionState?.();
    if (readout) readout.textContent = formatReadout(total - 1);
    if (fill) fill.style.transform = 'scaleY(1)';
  } else {
    window.addEventListener('scroll', onScroll, { passive: true, signal });
    window.addEventListener('resize', onScroll, { passive: true, signal });
    compute();
  }

  // 只要容器在视口内，就显示 rail
  if (rail) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => rail.classList.toggle('is-active', e.isIntersecting));
      },
      { threshold: 0.05 },
    );
    io.observe(root);
    signal.addEventListener('abort', () => io.disconnect());
  }
}
