import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import {
  BookOpen,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Clipboard,
  Code2,
  Compass,
  Layers,
  FastForward,
  HelpCircle,
  Home,
  Info,
  ListChecks,
  Map as MapIcon,
  Menu,
  Palette,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  RotateCw,
  ScanLine,
  Settings,
  Share2,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  Timer,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import * as THREE from "three";
import "./index.css";
import World from "./cuber/world";
import CubeGroup from "./cuber/group";
import Cubelet from "./cuber/cubelet";
import { COLORS, FACE } from "./cuber/define";
import { PaletteData, PreferanceData } from "./data";
import { TwistAction, TwistNode } from "./cuber/twister";
import Toucher from "./vue/Viewport/toucher";
import Solver, { type SolveMethod, type SolveResult, type SolveStep, type SolvePhaseInfo } from "./solver/Solver";
import {
  FACE_COLORS,
  FACE_ENUM,
  FACE_KEYS,
  FACE_ORIENTATION_HINTS,
  FACELET_INDICES,
  FaceKey,
  ON_TOP_FACE,
  Region,
  contrastColor,
  identifyFace,
  mirrorGrid,
  rotateGrid,
  startCamera,
  stopCamera,
  validateState,
} from "./cv/scanner";
import { configureRenderer } from "./cuber/three-compat";
import Util from "./common/util";
import GIF from "./common/gif";
import ZIP from "./common/zip";
import algsJson from "./vue/Algs/algs.json";
import { ChatPanel } from "./components/ChatPanel";

type Mode = "playground" | "helper" | "algs" | "director" | "player" | "help";
type StickerMap = { [face: string]: { [index: number]: string } | undefined };

type AppContext = {
  world: World;
  preferance: PreferanceData;
  palette: PaletteData;
};

const modeLabels: Record<Mode, string> = {
  playground: "练习",
  helper: "求解",
  algs: "公式",
  director: "动画",
  player: "播放",
  help: "帮助",
};

function readMode(): Mode {
  const mode = new URLSearchParams(location.search).get("mode") as Mode | null;
  return mode && modeLabels[mode] ? mode : "playground";
}

function openMode(mode: Mode): void {
  const url = mode === "playground" ? location.pathname : `${location.pathname}?mode=${mode}`;
  window.location.assign(url);
}

function useWindowSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const resize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", resize);
    resize();
    return () => window.removeEventListener("resize", resize);
  }, []);
  return size;
}

function useAppContext(): AppContext {
  return useMemo(() => {
    const world = new World();
    return {
      world,
      preferance: new PreferanceData(world),
      palette: new PaletteData(world),
    };
  }, []);
}

function useAnimation(callback: () => void): void {
  const cb = useRef(callback);
  cb.current = callback;
  useEffect(() => {
    let live = true;
    const loop = () => {
      if (!live) return;
      cb.current();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    return () => {
      live = false;
    };
  }, []);
}

type ViewportHandle = {
  resize: (width: number, height: number) => void;
  draw: () => boolean;
};

const Viewport = forwardRef<ViewportHandle, { ctx: AppContext }>(({ ctx }, ref) => {
  const host = useRef<HTMLDivElement>(null);
  const renderer = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.style.outline = "none";
    const instance = configureRenderer(new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }));
    instance.autoClear = false;
    instance.setClearColor(COLORS.White, 0);
    instance.setPixelRatio(window.devicePixelRatio);
    return instance;
  }, []);
  const toucher = useMemo(() => new Toucher(), []);

  const draw = useCallback(() => {
    if (ctx.world.dirty || ctx.world.cube.dirty) {
      renderer.clear();
      renderer.render(ctx.world.scene, ctx.world.camera);
      ctx.world.dirty = false;
      ctx.world.cube.dirty = false;
      return true;
    }
    return false;
  }, [ctx.world, renderer]);

  useImperativeHandle(ref, () => ({
    resize(width, height) {
      ctx.world.width = width;
      ctx.world.height = Math.max(1, height);
      ctx.world.resize();
      renderer.setSize(width, Math.max(1, height), true);
      ctx.world.dirty = true;
    },
    draw,
  }));

  useEffect(() => {
    host.current?.appendChild(renderer.domElement);
    toucher.init(renderer.domElement, ctx.world.controller.touch);
    const wheel = (e: WheelEvent) => {
      if (e.target !== renderer.domElement) return;
      const next = Math.max(0, Math.min(100, ctx.preferance.scale + (e.deltaY > 0 ? -10 : 10)));
      ctx.preferance.scale = next;
      ctx.preferance.save();
    };
    document.addEventListener("wheel", wheel, false);
    return () => document.removeEventListener("wheel", wheel);
  }, [ctx, renderer, toucher]);

  return <div className="viewport" ref={host} />;
});

function IconButton({
  title,
  onClick,
  disabled = false,
  active = false,
  children,
}: {
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button className={`icon-button ${active ? "active" : ""}`} title={title} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function Modal({
  title,
  open,
  onClose,
  children,
  className = "",
  backdropClassName = "",
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  backdropClassName?: string;
}) {
  if (!open) return null;
  return (
    <div className={`modal-backdrop ${backdropClassName}`} role="dialog" aria-modal="true">
      <div className={`modal ${className}`}>
        <header>
          <strong>{title}</strong>
          <IconButton title="关闭" onClick={onClose}>
            <X />
          </IconButton>
        </header>
        {children}
      </div>
    </div>
  );
}

function SettingsPanel({
  ctx,
  mode,
  onOrder,
  lockOrder = false,
}: {
  ctx: AppContext;
  mode: Mode;
  onOrder?: () => void;
  lockOrder?: boolean;
}) {
  const [, force] = useState(0);
  const [open, setOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [scrubbingCamera, setScrubbingCamera] = useState(false);
  const [tab, setTab] = useState<"order" | "camera" | "control" | "appear" | "palette">("order");
  const update = () => {
    ctx.preferance.save();
    force((i) => i + 1);
  };
  const setPref = (key: keyof PreferanceData, value: number | boolean) => {
    (ctx.preferance as unknown as Record<string, number | boolean>)[key] = value;
    update();
  };
  const setColor = (key: string, value: string) => {
    ctx.palette.color(key, value);
    ctx.palette.save();
    force((i) => i + 1);
  };
  const resetConfig = () => {
    ctx.palette.reset();
    ctx.preferance.reset();
    force((i) => i + 1);
  };
  useEffect(() => {
    if (!scrubbingCamera) return;
    const finish = () => setScrubbingCamera(false);
    window.addEventListener("pointerup", finish);
    window.addEventListener("mouseup", finish);
    window.addEventListener("touchend", finish);
    window.addEventListener("touchcancel", finish);
    window.addEventListener("blur", finish);
    return () => {
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("mouseup", finish);
      window.removeEventListener("touchend", finish);
      window.removeEventListener("touchcancel", finish);
      window.removeEventListener("blur", finish);
    };
  }, [scrubbingCamera]);

  return (
    <>
      <button className="floating-menu" title="菜单" onClick={() => setOpen(true)}>
        <Menu />
      </button>
      <Modal
        title="Cuber 控制台"
        open={open}
        onClose={() => setOpen(false)}
        className={`settings-modal live-preview ${scrubbingCamera ? "scrubbing-preview" : ""}`}
        backdropClassName="preview-backdrop"
      >
        <div className="settings-chrome">
          <nav className="mode-nav">
            {(["playground", "helper", "algs", "director"] as Mode[]).map((item) => (
              <button key={item} className={mode === item ? "selected" : ""} onClick={() => openMode(item)}>
                {modeLabels[item]}
              </button>
            ))}
          </nav>
          <div className="settings-tabs-row">
            <div className="settings-tabs">
              {[
                ["order", "阶数", <Settings key="o" />],
                ["camera", "镜头", <Camera key="c" />],
                ["control", "控制", <SlidersHorizontal key="s" />],
                ["appear", "显示", <Sparkles key="a" />],
                ["palette", "配色", <Palette key="p" />],
                ["help", "帮助", <HelpCircle key="h" />],
              ].map(([key, label, icon]) => (
                <button
                  key={key as string}
                  className={tab === key ? "selected" : ""}
                  onClick={() => {
                    if (key === "help") {
                      setHelpOpen(true);
                    } else {
                      setTab(key as typeof tab);
                    }
                  }}
                >
                  {icon}
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="settings-content">
          {tab === "order" && (
            <div className="button-grid">
              {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((order) => (
                <button
                  key={order}
                  className={ctx.world.order === order ? "selected" : ""}
                  disabled={lockOrder}
                  onClick={() => {
                    ctx.world.order = order;
                    ctx.preferance.refresh();
                    onOrder?.();
                  }}
                >
                  {order} 阶
                </button>
              ))}
            </div>
          )}
          {tab === "camera" && (
            <div className="control-stack">
              <Range label="缩放" value={ctx.preferance.scale} onScrubStart={() => setScrubbingCamera(true)} onScrubEnd={() => setScrubbingCamera(false)} onChange={(v) => setPref("scale", v)} />
              <Range label="透视" value={ctx.preferance.perspective} onScrubStart={() => setScrubbingCamera(true)} onScrubEnd={() => setScrubbingCamera(false)} onChange={(v) => setPref("perspective", v)} />
              <Range label="水平角" value={ctx.preferance.angle} onScrubStart={() => setScrubbingCamera(true)} onScrubEnd={() => setScrubbingCamera(false)} onChange={(v) => setPref("angle", v)} />
              <Range label="俯仰角" value={ctx.preferance.gradient} onScrubStart={() => setScrubbingCamera(true)} onScrubEnd={() => setScrubbingCamera(false)} onChange={(v) => setPref("gradient", v)} />
              <Range label="自发光" value={ctx.preferance.stickerEmission} onScrubStart={() => setScrubbingCamera(true)} onScrubEnd={() => setScrubbingCamera(false)} onChange={(v) => setPref("stickerEmission", v)} />
            </div>
          )}
          {tab === "control" && (
            <div className="control-stack">
              <Range label="动画帧" value={ctx.preferance.frames} min={4} max={60} onChange={(v) => setPref("frames", v)} />
              <Range label="灵敏度" value={ctx.preferance.sensitivity} onChange={(v) => setPref("sensitivity", v)} />
            </div>
          )}
          {tab === "appear" && (
            <div className="toggle-grid">
              {[
                ["thickness", "厚贴纸"],
                ["mirror", "镜面"],
                ["hollow", "空心"],
                ["arrow", "箭头"],
                ["shadow", "光影"],
                ["dark", "深色界面"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={Boolean((ctx.preferance as unknown as Record<string, boolean>)[key]) ? "selected" : ""}
                  onClick={() => setPref(key as keyof PreferanceData, !Boolean((ctx.preferance as unknown as Record<string, boolean>)[key]))}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {tab === "palette" && (
            <div className="palette-grid">
              {["R", "L", "U", "D", "F", "B", "Core", "High", "Gray"].map((key) => (
                <label key={key} className="palette-card">
                  <input type="color" value={COLORS[key]} onChange={(e) => setColor(key, e.target.value)} />
                  <span>{key}</span>
                </label>
              ))}
              <button className="palette-card palette-reset" onClick={() => ctx.palette.reset()}>恢复默认</button>
            </div>
          )}
        </div>
      </Modal>
      <Modal title="CubeTutor 使用帮助" open={helpOpen} onClose={() => setHelpOpen(false)} className="help-modal">
        <div className="help-modal-body">
          <HelpContent compact />
          <div className="danger-zone">
            <button className="settings-reset danger" onClick={() => setResetOpen(true)}>
              <Trash2 />
              <span>重置数据</span>
            </button>
          </div>
        </div>
      </Modal>
      <Modal title="重置数据" open={resetOpen} onClose={() => setResetOpen(false)}>
        <p>选择要重置的范围。</p>
        <div className="modal-actions">
          <button onClick={() => setResetOpen(false)}>取消</button>
          <button onClick={() => { resetConfig(); setResetOpen(false); }}>配置</button>
          <button className="danger" onClick={() => { localStorage.clear(); location.reload(); }}>全部</button>
        </div>
      </Modal>
    </>
  );
}

function Range({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  onScrubStart,
  onScrubEnd,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
}) {
  return (
    <label className="range-row">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onPointerDown={(e) => {
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // Some range implementations do not expose pointer capture reliably.
          }
          onScrubStart?.();
        }}
        onMouseDown={onScrubStart}
        onTouchStart={onScrubStart}
        onPointerUp={onScrubEnd}
        onPointerCancel={onScrubEnd}
        onMouseUp={onScrubEnd}
        onTouchEnd={onScrubEnd}
        onTouchCancel={onScrubEnd}
        onBlur={onScrubEnd}
        onChange={(e) => {
          onScrubStart?.();
          onChange(Number(e.target.value));
        }}
      />
      <b>{value}</b>
    </label>
  );
}

type PlaybarHandle = {
  init: () => void;
  toggle: () => void;
  playing: boolean;
};

const Playbar = forwardRef<
  PlaybarHandle,
  { ctx: AppContext; scene: string; action: string; disabled?: boolean; onSettled?: () => void }
>(({ ctx, scene, action, disabled = false, onSettled }, ref) => {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const actions = useMemo(() => new TwistNode(action).parse(), [action]);
  const playingRef = useRef(false);
  const progressRef = useRef(0);
  const actionsRef = useRef(actions);
  const onSettledRef = useRef(onSettled);
  playingRef.current = playing;
  progressRef.current = progress;
  actionsRef.current = actions;
  onSettledRef.current = onSettled;

  const init = useCallback(() => {
    ctx.world.controller.lock = false;
    playingRef.current = false;
    progressRef.current = 0;
    setPlaying(false);
    setProgress(0);
    const setup = scene.replace("^", `(${action})'`);
    ctx.world.cube.twister.setup(setup);
  }, [action, ctx.world, scene]);

  const finish = () => {
    init();
    for (const item of actions) ctx.world.cube.twister.twist(item, true, true);
    playingRef.current = false;
    progressRef.current = actions.length;
    setProgress(actions.length);
  };

  const forward = () => {
    if (progressRef.current >= actions.length) return;
    if (progressRef.current === 0) init();
    playingRef.current = false;
    setPlaying(false);
    const item = actions[progressRef.current];
    progressRef.current += 1;
    setProgress(progressRef.current);
    ctx.world.cube.twister.twist(item, false, true);
  };

  const backward = () => {
    if (progressRef.current === 0) return;
    playingRef.current = false;
    setPlaying(false);
    const item = actions[progressRef.current - 1];
    progressRef.current -= 1;
    setProgress(progressRef.current);
    ctx.world.cube.twister.twist(new TwistAction(item.sign, !item.reverse, item.times), false, true);
  };

  useEffect(init, [init]);
  useEffect(() => {
    ctx.world.controller.disable = playing;
  }, [ctx.world, playing]);
  useEffect(() => {
    ctx.world.controller.lock = progress > 0;
  }, [ctx.world, progress]);

  const step = useCallback(() => {
    if (!playingRef.current) return;
    const list = actionsRef.current;
    if (progressRef.current === list.length) {
      playingRef.current = false;
      setPlaying(false);
      onSettledRef.current?.();
      return;
    }
    let next = progressRef.current;
    do {
      const item = list[next++];
      const success = ctx.world.cube.twister.twist(item, false, false);
      if (success) {
        progressRef.current = next;
        setProgress(next);
        if (next === list.length) break;
      } else {
        next--;
        break;
      }
    } while (next < list.length);
  }, [ctx.world]);

  useEffect(() => {
    const callback = () => step();
    ctx.world.callbacks.push(callback);
    return () => {
      ctx.world.callbacks = ctx.world.callbacks.filter((item) => item !== callback);
    };
  }, [ctx.world, step]);

  const toggle = useCallback(() => {
    if (playingRef.current) {
      playingRef.current = false;
      setPlaying(false);
      return;
    }
    if (progressRef.current === 0) init();
    playingRef.current = true;
    setPlaying(true);
    step();
  }, [init, step]);

  useImperativeHandle(ref, () => ({
    init,
    toggle,
    get playing() {
      return playingRef.current;
    },
  }), [init, toggle]);

  const chaos = progress === 0 && ctx.world.cube.history.length !== 0;
  return (
    <div className="playbar">
      <input
        type="range"
        min={0}
        max={actions.length}
        value={progress}
        onChange={(e) => {
          init();
          const value = Number(e.target.value);
          for (let i = 0; i < value; i++) ctx.world.cube.twister.twist(actions[i], true, true);
          progressRef.current = value;
          setProgress(value);
        }}
      />
      <div className="toolbar">
        <IconButton title="回到开始" disabled={disabled || (progress === 0 && !chaos)} onClick={init}>
          <SkipBack />
        </IconButton>
        <IconButton title="上一步" disabled={disabled || progress === 0 || chaos} onClick={backward}>
          <ChevronLeft />
        </IconButton>
        <IconButton title={playing ? "暂停" : "播放"} disabled={disabled || progress === actions.length || chaos} onClick={toggle}>
          {playing ? <Pause /> : <Play />}
        </IconButton>
        <IconButton title="下一步" disabled={disabled || progress === actions.length || chaos} onClick={forward}>
          <ChevronRight />
        </IconButton>
        <IconButton title="跳到结尾" disabled={disabled || progress === actions.length || chaos} onClick={finish}>
          <SkipForward />
        </IconButton>
      </div>
    </div>
  );
});

class PlaygroundData {
  private values = { version: "0.5", order: 3, scrambler: "*", history: "", scene: "*", start: 0, now: 0, complete: false };
  constructor() {
    const save = localStorage.getItem("playground");
    if (save) {
      const data = JSON.parse(save);
      if (data.version === this.values.version) this.values = data;
    }
  }
  save() {
    localStorage.setItem("playground", JSON.stringify(this.values));
  }
  get order() { return this.values.order; } set order(v) { this.values.order = v; }
  get scrambler() { return this.values.scrambler; } set scrambler(v) { this.values.scrambler = v; }
  get history() { return this.values.history; } set history(v) { this.values.history = v; }
  get scene() { return this.values.scene; } set scene(v) { this.values.scene = v; }
  get start() { return this.values.start; } set start(v) { this.values.start = v; }
  get now() { return this.values.now; } set now(v) { this.values.now = v; }
  get complete() { return this.values.complete; } set complete(v) { this.values.complete = v; }
}

function formatScore(start: number, now: number, moves: number): string {
  let diff = now - start;
  const minute = Math.floor(diff / 60000);
  diff %= 60000;
  const second = Math.floor(diff / 1000);
  const ms = Math.floor((diff % 1000) / 100);
  return `${minute ? `${String(minute).padStart(2, "0")}:` : ""}${String(second).padStart(2, "0")}.${ms}/${moves}`;
}

function useKeyboard(callback: (exp: string) => void) {
  const [prefix, setPrefix] = useState("");
  useEffect(() => {
    let width = 2;
    const keymap: Record<number, string> = {
      73: "R", 75: "R'", 87: "B", 79: "B'", 83: "D", 76: "D'", 68: "L", 69: "L'",
      74: "U", 70: "U'", 72: "F", 71: "F'", 186: "y", 59: "y", 65: "y'", 85: "r",
      82: "l'", 77: "r'", 86: "l", 84: "x", 89: "x", 78: "x'", 66: "x'", 190: "M'",
      88: "M'", 53: "M", 54: "M", 80: "z", 81: "z'", 90: "d", 191: "d'", 67: "u'",
      188: "u", 37: "U", 38: "R", 39: "U'", 40: "R'",
    };
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const activeEl = document.activeElement as HTMLElement | null;
      if (
        (target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT" ||
            target.isContentEditable ||
            target.closest("input") ||
            target.closest("textarea") ||
            target.closest(".chat-panel") ||
            target.closest(".chat-settings-modal") ||
            target.closest(".model-picker-modal") ||
            target.closest(".modal-card") ||
            target.closest(".modal-wrapper"))) ||
        (activeEl &&
          (activeEl.tagName === "INPUT" ||
            activeEl.tagName === "TEXTAREA" ||
            activeEl.tagName === "SELECT" ||
            activeEl.isContentEditable ||
            activeEl.closest("input") ||
            activeEl.closest("textarea") ||
            activeEl.closest(".chat-panel") ||
            activeEl.closest(".chat-settings-modal") ||
            activeEl.closest(".model-picker-modal") ||
            activeEl.closest(".modal-card") ||
            activeEl.closest(".modal-wrapper")))
      ) {
        return;
      }
      const id = event.keyCode || event.which;
      if (id === 51 || id === 55) {
        width = Math.max(2, width - 1);
        setPrefix(String(width));
      } else if (id === 52 || id === 56) {
        width += 1;
        setPrefix(String(width));
      }
      if (id === 8) callback("^");
      const key = keymap[id];
      if (key) {
        callback(width !== 2 && "lrfbdu".includes(key[0]) ? `${width}${key}` : key);
        setPrefix("");
      }
    };
    document.addEventListener("keydown", keydown, false);
    return () => document.removeEventListener("keydown", keydown);
  }, [callback]);
  return prefix;
}

function BrandLogo() {
  return (
    <div className="brand-logo" title="CubeTutor 智能魔方教学系统" onClick={() => openMode("playground")}>
      <div className="logo-letters">
        <span style={{ color: "#ef4444" }}>R</span>
        <span style={{ color: "#facc15" }}>U</span>
        <span style={{ color: "#3b82f6" }}>B</span>
        <span style={{ color: "#22c55e" }}>I</span>
        <span style={{ color: "#f97316" }}>K</span>
        <span style={{ color: "#3b82f6" }}>'</span>
        <span style={{ color: "#facc15" }}>S</span>
        <span className="logo-cube-word"> CUBE</span>
      </div>
      <div className="logo-subtext">
        <span className="sub-cube">Cube</span>
        <em className="sub-tutor">Tutor</em>
        <span className="sub-divider"> · </span>
        <span className="sub-cn">智能魔方</span>
      </div>
    </div>
  );
}

function SceneShell({
  ctx,
  mode,
  viewportHeight,
  children,
  onOrder,
  lockOrder,
}: {
  ctx: AppContext;
  mode: Mode;
  viewportHeight: number;
  children: React.ReactNode;
  onOrder?: () => void;
  lockOrder?: boolean;
}) {
  const viewport = useRef<ViewportHandle>(null);
  const { width, height } = useWindowSize();
  const [chatOpen, setChatOpen] = useState(true);
  const [chatWidth, setChatWidth] = useState(420);

  useEffect(() => {
    const panelW = chatOpen && width > 960 ? chatWidth : 0;
    viewport.current?.resize(Math.max(1, width - panelW), Math.max(1, height - viewportHeight));
  }, [height, viewportHeight, width, chatOpen, chatWidth]);

  useAnimation(() => viewport.current?.draw());
  useEffect(() => {
    ctx.preferance.refresh();
    ctx.palette.refresh();
  }, [ctx]);

  return (
    <main
      className={`app-shell ${chatOpen ? "chat-open" : ""}`}
      style={{ ["--chat-w" as any]: `${chatWidth}px` }}
    >
      <BrandLogo />
      <SettingsPanel ctx={ctx} mode={mode} onOrder={onOrder} lockOrder={lockOrder} />
      <Viewport ref={viewport} ctx={ctx} />
      {children}
      <ChatPanel
        open={chatOpen}
        onToggle={setChatOpen}
        onWidthChange={setChatWidth}
        getCubeState={() => ctx.world.cube.serialize()}
        isSolved={ctx.world.cube.complete}
      />
    </main>
  );
}

function Playground() {
  const ctx = useAppContext();
  const data = useMemo(() => new PlaygroundData(), []);
  const [, force] = useState(0);
  const [scrambleOpen, setScrambleOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [link, setLink] = useState("");
  const [done, setDone] = useState(false);

  const sync = useCallback(() => {
    data.scene = ctx.world.cube.history.init;
    data.history = ctx.world.cube.history.exp.substring(1);
    const isComplete = ctx.world.cube.complete;
    if (!data.complete && isComplete && ctx.world.cube.history.moves > 0) {
      setDone(true);
    }
    data.complete = isComplete;
    data.save();
    force((i) => i + 1);
  }, [ctx.world, data]);

  const scramble = useCallback(() => {
    if (data.scrambler === "*") ctx.world.cube.twister.twist(new TwistAction("*"), true, true);
    else ctx.world.cube.twister.setup(data.scrambler);
    data.complete = ctx.world.cube.complete;
    data.start = 0;
    data.now = 0;
    sync();
  }, [ctx.world, data, sync]);

  const load = useCallback(() => {
    if (data.scene === "*") {
      scramble();
      return;
    }
    ctx.world.order = data.order;
    ctx.world.cube.twister.setup(data.scene);
    for (const action of new TwistNode(data.history).parse()) ctx.world.cube.twister.twist(action, true, true);
    data.complete = ctx.world.cube.complete;
    sync();
  }, [ctx.world, data, scramble, sync]);

  useEffect(load, [load]);
  useEffect(() => {
    ctx.world.callbacks.push(sync);
    return () => {
      ctx.world.callbacks = ctx.world.callbacks.filter((item) => item !== sync);
    };
  }, [ctx.world, sync]);

  useAnimation(() => {
    if (ctx.world.order < 10) {
      const tick = Math.sin((Date.now() / 2000) * Math.PI);
      ctx.world.cube.position.y = (tick * Cubelet.SIZE) / 64;
      ctx.world.cube.rotation.y = (tick / 768) * Math.PI;
      ctx.world.cube.dirty = true;
      ctx.world.cube.updateMatrix();
    }
    if (!data.complete && ctx.world.cube.history.moves > 0) {
      if (data.start === 0) data.start = Date.now();
      data.now = Date.now();
      force((i) => i + 1);
    } else if (ctx.world.cube.history.moves === 0) {
      if (data.start !== 0 || data.now !== 0) {
        data.start = 0;
        data.now = 0;
        force((i) => i + 1);
      }
    }
  });

  const prefix = useKeyboard((exp) => {
    if (exp === "^") ctx.world.cube.twister.undo();
    else ctx.world.cube.twister.twist(new TwistAction(exp), false, true);
  });

  const share = () => {
    const string = btoa(JSON.stringify({ order: ctx.world.order, drama: { scene: data.scene, action: data.history } }));
    const url = `${location.origin}${location.pathname}?mode=player&data=${string}`;
    setLink(url);
    setShareOpen(true);
  };

  const resetTimer = useCallback(() => {
    data.start = 0;
    data.now = 0;
    ctx.world.cube.history.clear();
    ctx.world.cube.twister.redoList = [];
    sync();
  }, [ctx.world, data, sync]);

  return (
    <SceneShell
      ctx={ctx}
      mode="playground"
      viewportHeight={100}
      onOrder={() => {
        data.order = ctx.world.order;
        data.save();
        scramble();
      }}
    >
      {prefix && <div className="key-pill">{prefix}</div>}
      <div className="bottom-panel">
        <div className="toolbar primary-toolbar playground-toolbar">
          <div
            className="score-pill-inline clickable"
            title="点击重置计时与步数"
            onClick={resetTimer}
          >
            <Timer size={15} style={{ opacity: 0.75, marginRight: 6 }} />
            <span>{formatScore(data.start, data.now, ctx.world.cube.history.moves)}</span>
          </div>
          <div className="toolbar-actions">
            <IconButton title="重新打乱" onClick={() => setScrambleOpen(true)}><Shuffle /></IconButton>
            <IconButton
              title="上一步 (撤销)"
              disabled={ctx.world.cube.history.length === 0}
              onClick={() => {
                ctx.world.cube.twister.undo();
                sync();
              }}
            >
              <RotateCcw />
            </IconButton>
            <IconButton
              title="下一步 (重做)"
              disabled={!ctx.world.cube.twister.canRedo}
              onClick={() => {
                ctx.world.cube.twister.redo();
                sync();
              }}
            >
              <RotateCw />
            </IconButton>
            <IconButton title="分享" onClick={share}><Share2 /></IconButton>
          </div>
          <div className="playground-toolbar-placeholder" />
        </div>
      </div>
      <Modal title="重新打乱" open={scrambleOpen} onClose={() => setScrambleOpen(false)}>
        <textarea value={data.scrambler} onChange={(e) => { data.scrambler = e.target.value; force((i) => i + 1); }} />
        <div className="modal-actions"><button onClick={() => setScrambleOpen(false)}>取消</button><button className="danger" onClick={() => { setScrambleOpen(false); scramble(); }}>确定</button></div>
      </Modal>
      <Modal title="分享链接" open={shareOpen} onClose={() => setShareOpen(false)}>
        <textarea readOnly value={link} />
        <div className="modal-actions"><button onClick={() => navigator.clipboard?.writeText(link)}>复制</button><button onClick={() => window.open(link)}>打开</button></div>
      </Modal>
      <Modal title="复原成功" open={done} onClose={() => setDone(false)}>
        <p>本次还原已经完成，可以查看历史或打开复盘播放。</p>
        <div className="modal-actions"><button onClick={() => setDone(false)}>知道了</button><button onClick={() => { setDone(false); share(); }}>复盘</button></div>
      </Modal>
    </SceneShell>
  );
}

function FaceNet({
  face,
  grid,
  onRotate,
  onRescan,
  onCellClick,
}: {
  face: FaceKey;
  grid?: FaceKey[];
  onRotate: () => void;
  onRescan: () => void;
  onCellClick?: (index: number) => void;
}) {
  return (
    <div className="face-net">
      <div className="face-grid">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="face-grid-cell"
            style={{ background: grid ? FACE_COLORS[grid[i]] : "transparent", cursor: onCellClick && grid ? "pointer" : undefined }}
            title={onCellClick && grid ? "点击切换颜色" : undefined}
            onClick={onCellClick && grid ? () => onCellClick(i) : undefined}
          />
        ))}
      </div>
      <div className="face-net-tools">
        <span>{face}</span>
        <button title="旋转" onClick={onRotate}><RotateCw /></button>
        <button title="重新扫描" onClick={onRescan}><ScanLine /></button>
      </div>
    </div>
  );
}

function capturedCount(rec: Record<FaceKey, FaceKey[] | undefined>): number {
  return FACE_KEYS.reduce((n, k) => n + (rec[k] ? 1 : 0), 0);
}

async function detectViaBackend(
  canvas: HTMLCanvasElement
): Promise<{ success: boolean; bbox?: { x1: number; y1: number; x2: number; y2: number }; grid?: string[]; method?: string; message?: string } | null> {
  try {
    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error("toBlob failed"));
      }, "image/jpeg", 0.8);
    });
    const formData = new FormData();
    formData.append("file", blob, "frame.jpg");
    const resp = await fetch("/detect", { method: "POST", body: formData });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

const FACE_NAMES_CN: Record<FaceKey, string> = {
  U: "顶面",
  R: "右面",
  F: "前面",
  D: "底面",
  L: "左面",
  B: "后面",
};

function ScannerPanel({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (faces: Record<FaceKey, FaceKey[]>) => void;
}) {
  const [phase, setPhase] = useState<"intro" | "capture" | "review">("intro");
  const [captured, setCaptured] = useState<Record<FaceKey, FaceKey[] | undefined>>({} as Record<FaceKey, FaceKey[]>);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<FaceKey | null>(null);
  const [liveReady, setLiveReady] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const [backendStatus, setBackendStatus] = useState<string>("未连接");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const liveGridRef = useRef<FaceKey[]>([]);
  const capturedRef = useRef(captured);
  const targetRef = useRef(target);
  const lastKeyRef = useRef("");
  const lastPromptRef = useRef("");
  const regionRef = useRef<Region | null>(null);
  const mirroredRef = useRef(false);
  const [locked, setLocked] = useState<{ grid: FaceKey[]; face: FaceKey } | null>(null);
  const lockedRef = useRef<{ grid: FaceKey[]; face: FaceKey; rawKey: string } | null>(null);
  const prevDetectKeyRef = useRef("");
  const lastFailMsgRef = useRef<string>("");
  capturedRef.current = captured;
  targetRef.current = target;

  useEffect(() => {
    if (open) {
      setPhase("intro");
      setCaptured({} as Record<FaceKey, FaceKey[]>);
      setTarget(null);
      setError(null);
      setPrompt("");
      setLiveReady(false);
      liveGridRef.current = [];
      regionRef.current = null;
      lastKeyRef.current = "";
      lastPromptRef.current = "";
      mirroredRef.current = false;
      lockedRef.current = null;
      prevDetectKeyRef.current = "";
      lastFailMsgRef.current = "";
      setLocked(null);
      setBackendStatus("正在连接…");
      fetch("/health")
        .then((resp) => {
          if (resp.ok) {
            setBackendConnected(true);
            setBackendStatus("已连接");
          } else {
            setBackendConnected(false);
            setBackendStatus("连接失败");
          }
        })
        .catch(() => {
          setBackendConnected(false);
          setBackendStatus("无法连接");
        });
    }
  }, [open]);

  const doneCount = FACE_KEYS.filter((k) => captured[k]).length;
  const currentTarget: FaceKey = target ?? (FACE_KEYS.find((k) => !captured[k]) ?? "U");

  const drawCellOverlay = (gctx: CanvasRenderingContext2D, region: Region | null, grid: FaceKey[] | null) => {
    if (!region) {
      gctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      gctx.lineWidth = 2;
      gctx.setLineDash([10, 8]);
      const w = canvasRef.current!.width;
      const h = canvasRef.current!.height;
      const side = Math.min(w, h) * 0.65;
      const gx = (w - side) / 2;
      const gy = (h - side) / 2;
      gctx.strokeRect(gx, gy, side, side);
      gctx.setLineDash([]);
      return;
    }
    gctx.lineWidth = 3;
    gctx.strokeStyle = "#22c55e";
    gctx.strokeRect(region.x, region.y, region.w, region.h);
    if (grid) {
      const n = 3;
      const cw = region.w / n;
      const ch = region.h / n;
      gctx.lineWidth = 1.5;
      gctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const x = region.x + c * cw;
          const y = region.y + r * ch;
          gctx.strokeRect(x, y, cw, ch);
          const letter = grid[r * n + c];
          const fs = Math.max(12, Math.round(Math.min(cw, ch) * 0.38));
          gctx.font = `bold ${fs}px sans-serif`;
          gctx.textAlign = "center";
          gctx.textBaseline = "middle";
          gctx.fillStyle = "rgba(0,0,0,0.7)";
          gctx.fillText(letter, x + cw / 2 + 1, y + ch / 2 + 1);
          gctx.fillStyle = "#fff";
          gctx.fillText(letter, x + cw / 2, y + ch / 2);
        }
      }
    }
  };

  useEffect(() => {
    if (!open || phase !== "capture") return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const gctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!gctx) return;
    lockedRef.current = null;
    prevDetectKeyRef.current = "";
    setLocked(null);
    let alive = true;
    let raf = 0;
    let sized = false;
    let detecting = false;
    let lastDetectAt = 0;
    const DETECT_INTERVAL = 350;

    const detCanvas = document.createElement("canvas");
    const detCtx = detCanvas.getContext("2d", { willReadFrequently: true });

    const drawVideoFrame = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      if (mirroredRef.current) {
        ctx.save();
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, w, h);
        ctx.restore();
      } else {
        ctx.drawImage(video, 0, 0, w, h);
      }
    };

    const runDetection = async () => {
      if (!detCtx || !detCanvas.width) return;
      drawVideoFrame(detCtx, detCanvas.width, detCanvas.height);
      detecting = true;
      lastDetectAt = performance.now();
      try {
        let nextPrompt = "";
        if (backendConnected) {
          const result = await detectViaBackend(detCanvas);
          if (!alive) return;
          if (result && result.success && result.bbox) {
            lastFailMsgRef.current = "";
            const region: Region = {
              x: result.bbox.x1,
              y: result.bbox.y1,
              w: result.bbox.x2 - result.bbox.x1,
              h: result.bbox.y2 - result.bbox.y1,
            };
            if (result.grid && result.grid.length === 9) {
              const grid = result.grid as FaceKey[];
              liveGridRef.current = grid;
              regionRef.current = region;
              const face = identifyFace(grid);
              const key = grid.join("");
              // 连续两次检测分布一致 → 锁定该分布在一旁
              if (key === prevDetectKeyRef.current && (!lockedRef.current || lockedRef.current.rawKey !== key)) {
                const displayGrid = mirroredRef.current ? mirrorGrid(grid) : [...grid];
                const lface = targetRef.current ?? face;
                lockedRef.current = { grid: displayGrid, face: lface, rawKey: key };
                setLocked({ grid: displayGrid, face: lface });
              }
              prevDetectKeyRef.current = key;
              if (lockedRef.current) {
                nextPrompt = targetRef.current
                  ? `已锁定 ${targetRef.current} 面分布，可松开魔方后点击"采集锁定"录入`
                  : `已锁定 ${lockedRef.current.face} 面分布，可松开魔方后点击"采集锁定"录入（已完成 ${capturedCount(capturedRef.current)}/6）`;
              } else {
                nextPrompt = targetRef.current
                  ? `目标面 ${targetRef.current}（${FACE_ORIENTATION_HINTS[targetRef.current]}）：当前识别中心为 ${face}。对准后点击采集。`
                  : `检测到魔方面 ${face}（${FACE_ORIENTATION_HINTS[face]}，已完成 ${capturedCount(capturedRef.current)}/6）。对准后点击采集。`;
              }
            }
          } else if (result && !result.success) {
            lastFailMsgRef.current = result.message || "未检测到魔方";
          }
        }
        if (!nextPrompt) {
          liveGridRef.current = [];
          regionRef.current = null;
          prevDetectKeyRef.current = "";
          if (lockedRef.current) {
            nextPrompt = `已锁定 ${lockedRef.current.face} 面分布，可松开魔方后点击"采集锁定"录入`;
          } else if (!backendConnected) {
            nextPrompt = "未连接检测服务，请确认后端已启动后返回重试";
          } else if (lastFailMsgRef.current) {
            nextPrompt = `检测失败：${lastFailMsgRef.current}`;
          } else {
            nextPrompt = "正在搜索魔方…请将魔方一个面朝向镜头";
          }
        }
        const key = liveGridRef.current.join("");
        if (key !== lastKeyRef.current) {
          lastKeyRef.current = key;
          setLiveReady(liveGridRef.current.length === 9);
        }
        if (nextPrompt !== lastPromptRef.current) {
          lastPromptRef.current = nextPrompt;
          setPrompt(nextPrompt);
        }
      } catch {
        // keep last frame
      } finally {
        detecting = false;
      }
    };

    const loop = () => {
      if (!alive) return;
      if (video.readyState >= 2 && video.videoWidth) {
        if (!sized) {
          const long = Math.max(video.videoWidth, video.videoHeight);
          const scale = long > 640 ? 640 / long : 1;
          canvas.width = Math.round(video.videoWidth * scale);
          canvas.height = Math.round(video.videoHeight * scale);
          detCanvas.width = canvas.width;
          detCanvas.height = canvas.height;
          sized = true;
        }
        drawVideoFrame(gctx, canvas.width, canvas.height);
        const region = regionRef.current;
        const grid = liveGridRef.current;
        const hasResult = region && grid.length === 9;
        drawCellOverlay(gctx, hasResult ? region : null, hasResult ? grid : null);
        if (!detecting && performance.now() - lastDetectAt >= DETECT_INTERVAL) {
          void runDetection();
        }
      }
      raf = requestAnimationFrame(loop);
    };

    startCamera(video)
      .then((s) => {
        streamRef.current = s;
        const facing = s.getVideoTracks()[0]?.getSettings?.().facingMode;
        mirroredRef.current = facing !== "environment";
        raf = requestAnimationFrame(loop);
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        let hint = "";
        if (msg.includes("Could not start video source")) {
          hint = "（摄像头可能被其他程序占用，或浏览器未授权。请关闭占用程序后重试。）";
        } else if (msg.includes("NotAllowedError") || msg.includes("Permission")) {
          hint = "（摄像头权限被拒绝。请在浏览器地址栏点击允许，或清除站点权限后重试。）";
        } else if (msg.includes("NotFoundError") || msg.includes("Requested device")) {
          hint = "（未检测到摄像头设备。）";
        } else if (msg.includes("NotReadableError")) {
          hint = "（摄像头被其他程序占用。）";
        }
        setError("无法访问摄像头：" + msg + hint);
      });

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      stopCamera(streamRef.current);
      streamRef.current = null;
      video.srcObject = null;
    };
  }, [open, phase, backendConnected]);

  const capture = () => {
    const lk = lockedRef.current;
    let grid: FaceKey[];
    let face: FaceKey;
    if (lk) {
      grid = [...lk.grid];
      face = lk.face;
    } else {
      grid = liveGridRef.current;
      if (!grid.length) return;
      if (mirroredRef.current) grid = mirrorGrid(grid);
      const identified = identifyFace(grid);
      face = targetRef.current ?? identified;
    }
    const next = { ...capturedRef.current };
    next[face] = grid;
    setCaptured(next);
    const identified = identifyFace(grid);
    const onTop = ON_TOP_FACE[face];
    const msg = targetRef.current && identified !== targetRef.current
      ? `已录入 ${face} 面（中心识别为 ${identified}，请确认朝向）`
      : `已录入 ${face} 面（${FACE_NAMES_CN[face]}正对镜头，${FACE_NAMES_CN[onTop]}朝上，可在展开图中旋转校正）`;
    lastPromptRef.current = msg;
    setPrompt(msg);
    prevDetectKeyRef.current = "";
    if (lk) {
      lockedRef.current = null;
      setLocked(null);
    }
    const nextUnscanned = FACE_KEYS.find((k) => k !== face && !next[k]) ?? null;
    setTarget(nextUnscanned);
  };

  useEffect(() => {
    if (!open || phase !== "capture") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.key !== " ") return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      if (liveGridRef.current.length === 9 || lockedRef.current) {
        capture();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, phase]);

  const clearLock = () => {
    lockedRef.current = null;
    prevDetectKeyRef.current = "";
    setLocked(null);
  };

  const rediscover = () => {
    clearLock();
    liveGridRef.current = [];
    regionRef.current = null;
    lastKeyRef.current = "";
    setLiveReady(false);
    const msg = "正在搜索魔方…请将魔方一个面朝向镜头";
    lastPromptRef.current = msg;
    setPrompt(msg);
  };

  const rotate = (face: FaceKey) => {
    setCaptured((prev) => {
      const g = prev[face];
      if (!g) return prev;
      return { ...prev, [face]: rotateGrid(g) };
    });
  };

  const rescan = (face: FaceKey) => {
    setTarget(face);
    setPhase("capture");
  };

  const editCell = (face: FaceKey, index: number) => {
    setCaptured((prev) => {
      const g = prev[face];
      if (!g) return prev;
      const next = [...g];
      const cur = FACE_KEYS.indexOf(next[index]);
      next[index] = FACE_KEYS[(cur + 1) % FACE_KEYS.length];
      return { ...prev, [face]: next };
    });
  };

  const confirm = () => {
    const result = {} as Record<FaceKey, FaceKey[]>;
    for (const k of FACE_KEYS) {
      const g = captured[k];
      if (g) result[k] = g;
    }
    onConfirm(result);
  };

  if (!open) return null;
  const validation = phase === "review" ? validateState(captured) : null;
  const suggestedFace: FaceKey = target ?? (liveGridRef.current.length === 9 ? identifyFace(liveGridRef.current) : currentTarget);

  return (
    <Modal title="魔方状态录入" open={open} onClose={onClose} className={`scanner-modal phase-${phase}`}>
      <video ref={videoRef} className="scanner-video-hidden" playsInline muted />
      {error && <div className="scanner-error">{error}</div>}

      {phase === "intro" && (
        <div className="scanner-intro">
          <p>
            通过摄像头智能识别实体魔方的 6 面颜色分布，将真实物理魔方状态实时同步至 3D 仿真模型，便于进行 AI 辅助教学与算法求解。
          </p>

          <ul className="scanner-tips">
            <li>点击“开始录入”后，将实体魔方的各个面逐一正对镜头。</li>
            <li>系统将自动识别当前面的 3×3 九格颜色分布，按提示依次完成 6 个面的采集。</li>
            <li>在光线均匀、背景简洁的环境下识别更加稳定准确。</li>
            <li>录入完成后可在 2D 展开图中进行颜色微调与朝向校正，确认无误即可同步至 3D 模型。</li>
          </ul>

          {!backendConnected && (
            <small className="hint scanner-backend-hint" style={{ marginTop: "10px", display: "block", color: "var(--muted)" }}>
              检测服务{backendStatus}。若无法识别，请确保后端服务已启动。
            </small>
          )}

          <div className="modal-actions" style={{ justifyContent: "flex-end", marginTop: "16px" }}>
            <button type="button" onClick={onClose}>取消</button>
            <button type="button" className="btn-capture-main" onClick={() => setPhase("capture")}>
              <Camera size={16} />
              <span>开始录入</span>
            </button>
          </div>
        </div>
      )}

      {phase === "capture" && (
        <div className="scanner-capture">
          {/* 顶部 6 面状态导航与切换卡片 */}
          <div className="scanner-face-tabs">
            {FACE_KEYS.map((k) => {
              const isDone = !!captured[k];
              const isTarget = currentTarget === k;
              const g = captured[k];
              return (
                <button
                  key={k}
                  type="button"
                  className={`scanner-face-card ${isDone ? "done" : ""} ${isTarget ? "active" : ""}`}
                  onClick={() => setTarget(k)}
                  title={`点击切换录入：${k} 面 (${FACE_NAMES_CN[k]})`}
                >
                  <div className="face-card-header">
                    <span
                      className="face-card-tag"
                      style={{ background: FACE_COLORS[k], color: contrastColor(FACE_COLORS[k]) }}
                    >
                      {k}
                    </span>
                    <span className="face-card-name">{FACE_NAMES_CN[k]}</span>
                    {isDone && <Check size={14} className="face-card-check" />}
                  </div>
                  <div className="face-card-mini-grid">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <span
                        key={i}
                        className="mini-grid-dot"
                        style={{ background: g ? FACE_COLORS[g[i]] : "rgba(0,0,0,0.06)" }}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {/* 主摄取与实时预览分栏区域 */}
          <div className="scanner-capture-body">
            <div className="scanner-stage-wrap">
              <div className="scanner-stage">
                <canvas ref={canvasRef} className="scanner-canvas" />
                <div className="hud-corner top-left" />
                <div className="hud-corner top-right" />
                <div className="hud-corner bottom-left" />
                <div className="hud-corner bottom-right" />
              </div>
              <div className="scanner-prompt-bar">
                <Sparkles size={16} className="prompt-icon" />
                <span>{prompt || "正在启动摄像头…"}</span>
              </div>
            </div>

            <div className="scanner-sidebar">
              <div className="scanner-live-card">
                <div className="live-card-title">
                  <span>实时识别采样</span>
                  {liveReady ? <span className="live-badge ok">● 识别正常</span> : <span className="live-badge wait">○ 寻找魔方</span>}
                </div>
                <div className="live-grid-display">
                  {Array.from({ length: 9 }).map((_, i) => {
                    const c = (locked ? locked.grid[i] : (liveGridRef.current.length === 9 ? (mirroredRef.current ? mirrorGrid(liveGridRef.current)[i] : liveGridRef.current[i]) : null));
                    return (
                      <div
                        key={i}
                        className="live-cell"
                        style={{ background: c ? FACE_COLORS[c] : "rgba(0,0,0,0.05)" }}
                      >
                        {c && <span className="cell-letter" style={{ color: contrastColor(FACE_COLORS[c]) }}>{c}</span>}
                      </div>
                    );
                  })}
                </div>
                <div className="live-center-info">
                  <span>中心块：</span>
                  <strong>
                    {liveGridRef.current[4] ? `${liveGridRef.current[4]} 面 (${FACE_NAMES_CN[liveGridRef.current[4]] || ""})` : "未就绪"}
                  </strong>
                </div>
              </div>

              <div className="scanner-quick-tips">
                <div className="tip-item">
                  <span className="tip-key">⚡ 快捷录入：</span>
                  <span>对准稳定后按 <strong>空格键 (Space)</strong> 快速完成采集</span>
                </div>
              </div>

              <div className="scanner-orientation-card">
                <div className="orientation-card-header">
                  <Compass size={14} className="orientation-icon" />
                  <span>朝向指引</span>
                </div>
                <div className="orientation-subtitle">面朝向规则（正对镜头 → 朝上）</div>
                <div className="orientation-grid">
                  {(["U", "R", "F", "D", "L", "B"] as FaceKey[]).map((f) => {
                    const top = ON_TOP_FACE[f];
                    const isActive = suggestedFace === f;
                    return (
                      <div
                        key={f}
                        className={`orientation-chip ${isActive ? "active" : ""}`}
                        onClick={() => setTarget(f)}
                        title={`正对 ${f} 面 (${FACE_NAMES_CN[f]})，${top} 面 (${FACE_NAMES_CN[top]}) 朝上`}
                      >
                        <span
                          className="chip-badge"
                          style={{ background: FACE_COLORS[f], color: contrastColor(FACE_COLORS[f]) }}
                        >
                          {f}
                        </span>
                        <span className="chip-arrow">→</span>
                        <span
                          className="chip-badge"
                          style={{ background: FACE_COLORS[top], color: contrastColor(FACE_COLORS[top]) }}
                        >
                          {top}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* 底部操作栏 */}
          <div className="scanner-modal-footer">
            <button type="button" onClick={() => { setTarget(null); setPhase("intro"); }}>
              返回说明
            </button>
            <div className="actions-right" style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="btn-capture-main"
                disabled={!liveReady && !locked}
                onClick={capture}
              >
                <Camera size={16} />
                <span>{locked ? `采集锁定 (${locked.face} 面)` : `采集此面 (${currentTarget} 面)`}</span>
              </button>
              <button
                type="button"
                className={`btn-review-main ${doneCount === 6 ? "primary" : ""}`}
                disabled={doneCount === 0}
                onClick={() => setPhase("review")}
              >
                <Check size={16} />
                <span>{doneCount === 6 ? "全部采集完成，进入校对 ➔" : `检查展开图 (${doneCount}/6)`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === "review" && (
        <div className="scanner-review-wrap">
          <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)", lineHeight: 1.6 }}>
            下方为 6 面展开图。点击任意贴纸色块可<strong>手动循环切换颜色</strong>；点击<strong>旋转按钮</strong>可修正方向。确认与实体魔方完全一致后点击“同步至 3D 模型”。
          </p>

          {/* 颜色数量统计指示条 */}
          <div className="scanner-color-stats">
            {FACE_KEYS.map((k) => {
              const count = validation?.counts[k] || 0;
              const isValid = count === 9;
              return (
                <div key={k} className={`color-stat-chip ${isValid ? "valid" : "invalid"}`}>
                  <span className="color-dot" style={{ background: FACE_COLORS[k] }} />
                  <span>{FACE_NAMES_CN[k]}: {count}/9</span>
                </div>
              );
            })}
          </div>

          <div className="scanner-net">
            <div className="net-top"><FaceNet face="U" grid={captured.U} onRotate={() => rotate("U")} onRescan={() => rescan("U")} onCellClick={(i) => editCell("U", i)} /></div>
            <div className="net-row">
              {(["L", "F", "R", "B"] as FaceKey[]).map((k) => (
                <FaceNet key={k} face={k} grid={captured[k]} onRotate={() => rotate(k)} onRescan={() => rescan(k)} onCellClick={(i) => editCell(k, i)} />
              ))}
            </div>
            <div className="net-bottom"><FaceNet face="D" grid={captured.D} onRotate={() => rotate("D")} onRescan={() => rescan("D")} onCellClick={(i) => editCell("D", i)} /></div>
          </div>

          {validation && !validation.ok && (
            <div className="scanner-warn">
              <strong style={{ display: "block", marginBottom: "4px" }}>⚠️ 状态校验提示：</strong>
              {validation.issues.map((s, i) => <div key={i}>· {s}</div>)}
            </div>
          )}

          <div className="scanner-modal-footer" style={{ borderTop: "none", padding: "0" }}>
            <button type="button" onClick={() => setPhase("capture")}>
              📸 继续采集 / 补扫
            </button>
            <button type="button" className="btn-capture-main" onClick={confirm}>
              <Check size={16} />
              <span>同步至 3D 模型</span>
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// 单层 / 双层 / 整体旋转图例
const LEGEND_FACES: { face: string; name: string }[] = [
  { face: "R", name: "右面" },
  { face: "U", name: "顶面" },
  { face: "F", name: "前面" },
  { face: "L", name: "左面" },
  { face: "D", name: "底面" },
  { face: "B", name: "后面" },
];

function LegendDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop legend-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <aside className="legend-drawer" onClick={(e) => e.stopPropagation()}>
        <header>
          <strong>
            <Compass />
            操作图例
          </strong>
          <IconButton title="关闭" onClick={onClose}>
            <X />
          </IconButton>
        </header>
        <div className="legend-body">
          <section>
            <h3>
              <Layers />
              单层旋转（大写）
            </h3>
            <p className="legend-hint">从该面外侧看，顺时针 90° 为基本方向；加 ' 表示反向，加 2 表示 180°。</p>
            <div className="legend-grid">
              {LEGEND_FACES.map(({ face, name }) => (
                <div className="legend-row" key={face}>
                  <span className="legend-token">{face}</span>
                  <span className="legend-desc">
                    {name}顺时针 90°
                    <RotateCw className="legend-arrow" />
                  </span>
                </div>
              ))}
              {LEGEND_FACES.map(({ face, name }) => (
                <div className="legend-row" key={`${face}'`}>
                  <span className="legend-token">{face}'</span>
                  <span className="legend-desc">
                    {name}逆时针 90°
                    <RotateCcw className="legend-arrow" />
                  </span>
                </div>
              ))}
              {LEGEND_FACES.map(({ face, name }) => (
                <div className="legend-row" key={`${face}2`}>
                  <span className="legend-token">{face}2</span>
                  <span className="legend-desc">{name}转 180°</span>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h3>
              <Layers />
              双层旋转（小写）
            </h3>
            <p className="legend-hint">小写字母 = 该面 + 相邻中层（两层一起转），方向同大写。</p>
            <div className="legend-grid">
              {LEGEND_FACES.map(({ face, name }) => (
                <div className="legend-row" key={`w${face}`}>
                  <span className="legend-token">{face.toLowerCase()}</span>
                  <span className="legend-desc">
                    {name}+中层顺时针 90°
                    <RotateCw className="legend-arrow" />
                  </span>
                </div>
              ))}
              {LEGEND_FACES.map(({ face, name }) => (
                <div className="legend-row" key={`w${face}'`}>
                  <span className="legend-token">{face.toLowerCase()}'</span>
                  <span className="legend-desc">
                    {name}+中层逆时针 90°
                    <RotateCcw className="legend-arrow" />
                  </span>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h3>
              <Compass />
              整体旋转
            </h3>
            <p className="legend-hint">绕整体坐标轴旋转整个魔方，不改变已涂抹颜色，仅改变观察方向。</p>
            <div className="legend-grid">
              <div className="legend-row">
                <span className="legend-token">x</span>
                <span className="legend-desc">整体绕 R 方向旋转 90°</span>
              </div>
              <div className="legend-row">
                <span className="legend-token">x'</span>
                <span className="legend-desc">整体绕 R 方向反向 90°</span>
              </div>
              <div className="legend-row">
                <span className="legend-token">y</span>
                <span className="legend-desc">整体绕 U 方向旋转 90°</span>
              </div>
              <div className="legend-row">
                <span className="legend-token">y'</span>
                <span className="legend-desc">整体绕 U 方向反向 90°</span>
              </div>
              <div className="legend-row">
                <span className="legend-token">z</span>
                <span className="legend-desc">整体绕 F 方向旋转 90°</span>
              </div>
              <div className="legend-row">
                <span className="legend-token">z'</span>
                <span className="legend-desc">整体绕 F 方向反向 90°</span>
              </div>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

const SOLVE_METHODS: { id: SolveMethod; name: string; desc: string; tag: string }[] = [
  {
    id: "layerfirst",
    name: "层先法",
    desc: "7 阶段入门解法：底十字→底角→中层棱→顶十字→顶角定向→顶角位置→顶棱位置。步骤多但易懂。",
    tag: "推荐新手",
  },
  {
    id: "cfop",
    name: "CFOP",
    desc: "Cross / F2L / OLL / PLL 四阶段速拧框架。阶段更少、动作更紧凑，适合进阶。",
    tag: "进阶",
  },
  {
    id: "kociemba",
    name: "Kociemba",
    desc: "两阶段最优搜索，给出最短单串解，不分 CFOP 阶段。",
    tag: "最优",
  },
];

function MethodSelect({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (m: SolveMethod) => void;
}) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal method-modal">
        <header>
          <strong>
            <Sparkles />
            选择求解方法
          </strong>
          <IconButton title="关闭" onClick={onClose}>
            <X />
          </IconButton>
        </header>
        <div className="method-list">
          {SOLVE_METHODS.map((m) => (
            <button key={m.id} className="method-card" onClick={() => onPick(m.id)}>
              <div className="method-head">
                <strong>{m.name}</strong>
                <span className="method-tag">{m.tag}</span>
              </div>
              <p>{m.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const MOVE_DESC_MAP: Record<string, string> = {
  // 单层基本动作
  U: "顶层 顺时针 90°",
  "U'": "顶层 逆时针 90°",
  U2: "顶层 旋转 180°",
  "U2'": "顶层 旋转 180°",
  D: "底层 顺时针 90°",
  "D'": "底层 逆时针 90°",
  D2: "底层 旋转 180°",
  "D2'": "底层 旋转 180°",
  L: "左层 顺时针 90°",
  "L'": "左层 逆时针 90°",
  L2: "左层 旋转 180°",
  "L2'": "左层 旋转 180°",
  R: "右层 顺时针 90°",
  "R'": "右层 逆时针 90°",
  R2: "右层 旋转 180°",
  "R2'": "右层 旋转 180°",
  F: "前层 顺时针 90°",
  "F'": "前层 逆时针 90°",
  F2: "前层 旋转 180°",
  "F2'": "前层 旋转 180°",
  B: "后层 顺时针 90°",
  "B'": "后层 逆时针 90°",
  B2: "后层 旋转 180°",
  "B2'": "后层 旋转 180°",

  // 双层动作
  u: "顶双层 顺时针 90°",
  "u'": "顶双层 逆时针 90°",
  u2: "顶双层 旋转 180°",
  d: "底双层 顺时针 90°",
  "d'": "底双层 逆时针 90°",
  d2: "底双层 旋转 180°",
  l: "左双层 顺时针 90°",
  "l'": "左双层 逆时针 90°",
  l2: "左双层 旋转 180°",
  r: "右双层 顺时针 90°",
  "r'": "右双层 逆时针 90°",
  r2: "右双层 旋转 180°",
  f: "前双层 顺时针 90°",
  "f'": "前双层 逆时针 90°",
  f2: "前双层 旋转 180°",
  b: "后双层 顺时针 90°",
  "b'": "后双层 逆时针 90°",
  b2: "后双层 旋转 180°",

  // 中层与整体旋转
  M: "中层 顺时针 90°",
  "M'": "中层 逆时针 90°",
  M2: "中层 旋转 180°",
  E: "赤道层 顺时针 90°",
  "E'": "赤道层 逆时针 90°",
  E2: "赤道层 旋转 180°",
  S: "站立层 顺时针 90°",
  "S'": "站立层 逆时针 90°",
  S2: "站立层 旋转 180°",
  x: "整体 绕右面顺时针 90°",
  "x'": "整体 绕右面逆时针 90°",
  x2: "整体 绕右面旋转 180°",
  y: "整体 绕顶面顺时针 90°",
  "y'": "整体 绕顶面逆时针 90°",
  y2: "整体 绕顶面旋转 180°",
  z: "整体 绕前面顺时针 90°",
  "z'": "整体 绕前面逆时针 90°",
  z2: "整体 绕前面旋转 180°",
};

function getMoveDescription(exp: string): string {
  if (!exp) return "";
  if (MOVE_DESC_MAP[exp]) return MOVE_DESC_MAP[exp];

  const base = exp[0];
  const isReverse = exp.includes("'");
  const isDouble = exp.includes("2");

  const faceMap: Record<string, string> = {
    U: "顶层", D: "底层", L: "左层", R: "右层", F: "前层", B: "后层",
    u: "顶双层", d: "底双层", l: "左双层", r: "右双层", f: "前双层", b: "后双层",
    M: "中层", E: "赤道层", S: "站立层",
    x: "整体(X轴)", y: "整体(Y轴)", z: "整体(Z轴)",
  };

  const faceName = faceMap[base] || `${base}层`;
  const action = isDouble ? "旋转 180°" : isReverse ? "逆时针 90°" : "顺时针 90°";
  return `${faceName} ${action}`;
}

// 求解结果播放器：上方显示下一步 + 阶段进度 + 逐步点亮的解串 + Playbar
function SolutionPlayer({
  ctx,
  result,
  scene,
  stickers,
  onClose,
}: {
  ctx: AppContext;
  result: SolveResult;
  scene: string;
  stickers: StickerMap;
  onClose: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const actions = useMemo(() => new TwistNode(result.raw).parse(), [result.raw]);
  const playingRef = useRef(false);
  const progressRef = useRef(0);
  const actionsRef = useRef(actions);
  playingRef.current = playing;
  progressRef.current = progress;
  actionsRef.current = actions;

  useEffect(() => {
    CubeGroup.frames = Math.max(3, Math.round(30 / speed));
    return () => {
      CubeGroup.frames = 30;
    };
  }, [speed]);

  const init = useCallback(() => {
    ctx.world.controller.lock = false;
    playingRef.current = false;
    progressRef.current = 0;
    setPlaying(false);
    setProgress(0);
    const setup = scene
      ? scene.includes("^")
        ? scene.replace("^", `(${result.raw})'`)
        : scene
      : `(${result.raw})'`;
    ctx.world.cube.reset();
    ctx.world.cube.strip({});
    ctx.world.cube.twister.setup(setup);
    if (stickers && Object.keys(stickers).length > 0) {
      for (const face of [FACE.L, FACE.R, FACE.D, FACE.U, FACE.B, FACE.F]) {
        const list = stickers[FACE[face]];
        if (list) for (const sticker in list) ctx.world.cube.stick(Number(sticker), face, list[sticker]);
      }
    }
  }, [ctx.world, scene, result.raw, stickers]);

  const finish = useCallback(() => {
    init();
    for (const item of actionsRef.current) ctx.world.cube.twister.twist(item, true, true);
    progressRef.current = actionsRef.current.length;
    setProgress(actionsRef.current.length);
    setPlaying(false);
    playingRef.current = false;
  }, [ctx.world, init]);

  const forward = useCallback(() => {
    if (progressRef.current >= actionsRef.current.length) return;
    if (progressRef.current === 0) init();
    setPlaying(false);
    playingRef.current = false;
    const item = actionsRef.current[progressRef.current];
    progressRef.current += 1;
    setProgress(progressRef.current);
    ctx.world.cube.twister.twist(item, false, true);
  }, [ctx.world, init]);

  const backward = useCallback(() => {
    if (progressRef.current === 0) return;
    setPlaying(false);
    playingRef.current = false;
    const item = actionsRef.current[progressRef.current - 1];
    progressRef.current -= 1;
    setProgress(progressRef.current);
    ctx.world.cube.twister.twist(new TwistAction(item.sign, !item.reverse, item.times), false, true);
  }, [ctx.world]);

  useEffect(init, [init]);
  useEffect(() => {
    return () => {
      playingRef.current = false;
      ctx.world.cube.twister.finish();
      ctx.world.controller.disable = false;
      ctx.world.controller.lock = false;
    };
  }, [ctx.world]);
  useEffect(() => {
    ctx.world.controller.disable = playing;
    ctx.world.controller.lock = progress > 0;
  }, [ctx.world, playing, progress]);

  const step = useCallback(() => {
    if (!playingRef.current) return;
    const list = actionsRef.current;
    if (progressRef.current === list.length) {
      playingRef.current = false;
      setPlaying(false);
      return;
    }
    let next = progressRef.current;
    do {
      const item = list[next++];
      const success = ctx.world.cube.twister.twist(item, false, false);
      if (success) {
        progressRef.current = next;
        setProgress(next);
        if (next === list.length) break;
      } else {
        next--;
        break;
      }
    } while (next < list.length);
  }, [ctx.world]);

  useEffect(() => {
    const callback = () => step();
    ctx.world.callbacks.push(callback);
    return () => {
      ctx.world.callbacks = ctx.world.callbacks.filter((item) => item !== callback);
    };
  }, [ctx.world, step]);

  const toggle = useCallback(() => {
    if (playingRef.current) {
      playingRef.current = false;
      setPlaying(false);
      return;
    }
    if (progressRef.current === 0) init();
    playingRef.current = true;
    setPlaying(true);
    step();
  }, [init, step]);

  const total = result.steps.length;
  const nextStep = progress < total ? result.steps[progress] : null;
  const currentPhaseIdx = nextStep ? nextStep.phase : result.phases.length - 1;
  const atEnd = progress >= total;

  return (
    <div className="bottom-panel tall solution-player">
      <div className="solution-topbar">
        <div className="solution-phases">
          {result.phases.map((p) => {
            const done = progress >= p.endStep && p.endStep > 0;
            const active = p.startStep <= progress && progress < p.endStep && p.endStep > 0;
            return (
              <div
                key={p.index}
                className={`phase-pill ${done ? "done" : ""} ${active ? "active" : ""} ${p.endStep === 0 ? "empty" : ""}`}
              >
                <span className="phase-index">{p.index + 1}</span>
                <span className="phase-name">{p.label}</span>
              </div>
            );
          })}
        </div>
        <button className="solution-close" title="返回录入" onClick={onClose}>
          <X />
        </button>
      </div>

      <div className="solution-next">
        <span className="next-label">
          <ListChecks />
          下一步
        </span>
        <span className={`next-token ${atEnd ? "done" : ""}`}>{nextStep ? nextStep.exp : "完成"}</span>
        {nextStep && (
          <span className="next-desc">
            {getMoveDescription(nextStep.exp)}
          </span>
        )}
        <span className="next-phase">
          <Info />
          {nextStep ? nextStep.phaseLabel : "已复原"}
        </span>
      </div>

      <div className="solution-string">
        {result.steps.map((s, i) => (
          <span
            key={i}
            className={`step-chip ${i < progress ? "done" : ""} ${i === progress ? "current" : ""}`}
          >
            {s.exp}
          </span>
        ))}
      </div>

      <div className="playbar">
        <input
          type="range"
          min={0}
          max={actions.length}
          value={progress}
          onChange={(e) => {
            init();
            const value = Number(e.target.value);
            for (let i = 0; i < value; i++) ctx.world.cube.twister.twist(actions[i], true, true);
            progressRef.current = value;
            setProgress(value);
          }}
        />
        <div className="toolbar solution-toolbar">
          <IconButton title="回到开始" disabled={progress === 0} onClick={init}>
            <SkipBack />
          </IconButton>
          <IconButton title="上一步" disabled={progress === 0} onClick={backward}>
            <ChevronLeft />
          </IconButton>
          <IconButton title={playing ? "暂停" : "播放"} disabled={atEnd} onClick={toggle}>
            {playing ? <Pause /> : <Play />}
          </IconButton>
          <IconButton title="下一步" disabled={atEnd} onClick={forward}>
            <ChevronRight />
          </IconButton>
          <IconButton title="跳到结尾" disabled={atEnd} onClick={finish}>
            <SkipForward />
          </IconButton>
          <div className="speed-slider-wrap" title={`播放速度：${speed.toFixed(1)}x`}>
            <Zap size={14} className="speed-icon" />
            <input
              type="range"
              min={0.5}
              max={2.5}
              step={0.1}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="speed-slider"
            />
            <span className="speed-label">{speed.toFixed(1)}x</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function convertBackendSolution(
  data: { method?: string; steps?: Array<{ move: string; stage: string; narration_key?: string }> },
  method: SolveMethod
): SolveResult {
  const methodKey = (data.method || method).toLowerCase();
  const backendSteps = data.steps || [];
  const rawMoves = backendSteps.map((s) => s.move).join(" ");

  const isCfop = methodKey === "cfop";
  const isKociemba = methodKey === "kociemba";

  const phaseList = isCfop
    ? ["cross", "f2l", "oll", "pll"]
    : isKociemba
    ? ["kociemba"]
    : [
        "cross",
        "first_layer_corners",
        "second_layer",
        "last_layer_cross",
        "last_layer_corners_orient",
        "last_layer_corners_perm",
        "last_layer_edges",
      ];

  const phaseLabels = isCfop
    ? ["1. Cross 底层十字", "2. F2L 前两层", "3. OLL 顶层朝向", "4. PLL 顶层排列"]
    : isKociemba
    ? ["两阶段最优求解"]
    : [
        "1. 底层十字",
        "2. 底层角块",
        "3. 中层棱块",
        "4. 顶层十字",
        "5. 顶层角定向",
        "6. 顶层角位置",
        "7. 顶层棱位置",
      ];

  const phases: SolvePhaseInfo[] = phaseLabels.map((label, idx) => ({
    index: idx,
    label,
    startStep: -1,
    endStep: 0,
  }));

  const steps: SolveStep[] = [];
  backendSteps.forEach((s, idx) => {
    let pIdx = phaseList.indexOf(s.stage);
    if (pIdx === -1) pIdx = 0;
    const pLabel = phaseLabels[pIdx] || s.stage;

    steps.push({
      exp: s.move,
      moveIndex: idx,
      phase: pIdx,
      phaseLabel: pLabel,
    });

    if (phases[pIdx].startStep === -1) {
      phases[pIdx].startStep = idx;
    }
    phases[pIdx].endStep = idx + 1;
  });

  phases.forEach((p) => {
    if (p.startStep === -1) {
      p.startStep = 0;
      p.endStep = 0;
    }
  });

  return {
    method,
    raw: rawMoves,
    steps,
    phases,
  };
}

function Helper() {
  const ctx = useAppContext();
  const [stickers, setStickers] = useState<StickerMap>(() => JSON.parse(localStorage.getItem("helper-stickers") || "{}"));
  const [methodOpen, setMethodOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [result, setResult] = useState<SolveResult | null>(null);
  const [resultScene, setResultScene] = useState("");
  const [errorText, setErrorText] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [solving, setSolving] = useState(false);

  // 把保存下来的贴纸映射重新写到 cube 上（务必先 reset+strip 回初始态，
  // 否则 cubelet 旋转/位置错乱，stick() 写入的 slot 和 serialize() 读取的
  // 世界方向无法对应，会导致 serialize 出错误颜色 / 错位面。）
  const applyStickerMap = (map: StickerMap) => {
    for (const face of [FACE.L, FACE.R, FACE.D, FACE.U, FACE.B, FACE.F]) {
      const list = map[FACE[face]];
      if (list) {
        for (const sticker in list) {
          ctx.world.cube.stick(Number(sticker), face, list[sticker]);
        }
      }
    }
  };

  useEffect(() => {
    ctx.world.order = 3;
    const savedScene = localStorage.getItem("helper-scene");
    const savedStickersStr = localStorage.getItem("helper-stickers");

    if (savedScene) {
      ctx.world.cube.reset();
      ctx.world.cube.strip({});
      ctx.world.cube.twister.setup(savedScene);
    } else if (savedStickersStr) {
      try {
        const savedStickers: StickerMap = JSON.parse(savedStickersStr);
        if (savedStickers && Object.keys(savedStickers).length > 0) {
          ctx.world.cube.reset();
          ctx.world.cube.strip({});
          applyStickerMap(savedStickers);
        }
      } catch (e) {
        console.error("Failed to parse saved stickers:", e);
      }
    }
  }, [ctx.world]);

  const reset = () => {
    ctx.world.cube.twister.finish();
    ctx.world.cube.reset();
    // 重置所有贴纸为各面默认颜色：strip({}) 会令每个贴纸 stick(face, "")
    // 恢复为该面默认材质并设为可见
    ctx.world.cube.strip({});
    localStorage.removeItem("helper-scene");
    const next: StickerMap = {};
    for (const face of [FACE.L, FACE.R, FACE.D, FACE.U, FACE.B, FACE.F]) {
      const key = FACE[face];
      const group = ctx.world.cube.table.face(key);
      next[key] = {};
      for (const index of group.indices) next[key]![index] = key;
    }
    setStickers(next);
    localStorage.setItem("helper-stickers", JSON.stringify(next));
  };

  const clear = () => {
    ctx.world.cube.twister.finish();
    setStickers({});
    localStorage.removeItem("helper-stickers");
    localStorage.removeItem("helper-scene");
    ctx.world.cube.reset();
    ctx.world.cube.strip({});
  };

  const scramble = () => {
    ctx.world.cube.twister.finish();
    ctx.world.cube.reset();
    ctx.world.cube.strip({});
    setStickers({});
    localStorage.removeItem("helper-stickers");
    const exp = ctx.world.cube.twister.scrambler();
    ctx.world.cube.twister.setup(exp);
    localStorage.setItem("helper-scene", exp);
  };

  const runSolve = async (method: SolveMethod) => {
    const currentState = ctx.world.cube.serialize();
    setMethodOpen(false);
    setSolving(true);
    try {
      // 直接调用后端 Python 三大求解算法接口（/api/solve）
      const resp = await fetch("/api/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          facelets: currentState,
        }),
      });

      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        const detail = errJson.detail || `后端求解错误 (${resp.status})`;
        throw new Error(detail);
      }

      const data = await resp.json();
      const ret = convertBackendSolution(data, method);
      if (ret.steps.length === 0 && currentState !== "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB") {
        throw new Error("后端未返回有效还原步骤，请检查魔方贴纸颜色是否完整合法。");
      }

      setErrorText("");
      const sceneToPlay = ctx.world.cube.history.init || ctx.world.cube.history.exp || `(${ret.raw})'`;
      setResultScene(sceneToPlay);
      setResult(ret);
    } catch (err: any) {
      console.error("调用后端求解服务失败:", err);
      setErrorText(err?.message || "后端求解请求失败，请确保后端服务（FastAPI localhost:8000）已正常启动。");
      setResult(null);
    } finally {
      setSolving(false);
    }
  };

  const exitPlayer = () => {
    // 退出播放：恢复录入态（重置动作历史，回到求解前的打乱/贴纸状态）
    ctx.world.cube.twister.finish();
    ctx.world.cube.reset();
    ctx.world.cube.strip({});
    ctx.world.cube.twister.setup(resultScene);
    if (stickers && Object.keys(stickers).length > 0) {
      applyStickerMap(stickers);
    }
    setResult(null);
  };

  const applyScan = (faces: Record<FaceKey, FaceKey[]>) => {
    localStorage.removeItem("helper-scene");
    // 录入 = 绝对贴纸状态，必须先把 cube 复位到初始位置/朝向，
    // 否则之前的「打乱」会让 cubelet 旋转错位，stick() 写入的 slot
    // 方向和 serialize() 以「世界方向」读取的方向不一致，
    // 造成「识别对了但填进去颜色/面都错」的现象。
    ctx.world.cube.twister.finish();
    ctx.world.cube.reset();
    ctx.world.cube.strip({});

    const next: StickerMap = {};
    for (const fk of FACE_KEYS) {
      const grid = faces[fk];
      if (!grid) continue;
      const indices = FACELET_INDICES[fk];
      const faceEnum = FACE_ENUM[fk];
      const map: { [index: number]: string } = {};
      for (let i = 0; i < 9; i++) {
        const idx = indices[i];
        map[idx] = grid[i];
        ctx.world.cube.stick(idx, faceEnum, grid[i]);
      }
      next[fk] = map;
    }
    setStickers(next);
    localStorage.setItem("helper-stickers", JSON.stringify(next));
    setScanOpen(false);
  };

  return (
    <SceneShell ctx={ctx} mode="helper" viewportHeight={result ? 360 : 140} lockOrder>
      {result ? (
        <SolutionPlayer
          ctx={ctx}
          result={result}
          scene={resultScene}
          stickers={stickers}
          onClose={exitPlayer}
        />
      ) : (
        <div className="bottom-panel">
          <div className="color-grid">
            <button onClick={() => setScanOpen(true)}><ScanLine />录入</button>
            <button disabled={solving} onClick={() => setMethodOpen(true)}><Sparkles />{solving ? "求解中..." : "求解"}</button>
            <button onClick={() => setLegendOpen(true)}><Compass />图例</button>
            <button onClick={scramble}><Shuffle />打乱</button>
            <button onClick={reset}><RefreshCw />重置</button>
            <button className="danger" onClick={clear}><Trash2 />清除涂色</button>
          </div>
        </div>
      )}
      <MethodSelect open={methodOpen} onClose={() => setMethodOpen(false)} onPick={runSolve} />
      <LegendDrawer open={legendOpen} onClose={() => setLegendOpen(false)} />
      <ScannerPanel open={scanOpen} onClose={() => setScanOpen(false)} onConfirm={applyScan} />
      <Modal title="求解失败" open={!!errorText} onClose={() => setErrorText("")}>
        <p className="error-text">{errorText}</p>
        <div className="modal-actions">
          <button className="primary" onClick={() => setErrorText("")}>确定</button>
        </div>
      </Modal>
    </SceneShell>
  );
}

function Player() {
  const ctx = useAppContext();
  const [scene, setScene] = useState("");
  const [action, setAction] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      const raw = new URLSearchParams(location.search).get("data") || "";
      const data = JSON.parse(atob(raw));
      if (data.order) ctx.world.order = data.order;
      if (data.drama) {
        setScene(data.drama.scene || "");
        setAction(data.drama.action || "");
        const stickers = data.drama.stickers as StickerMap | undefined;
        if (stickers) {
          for (const face of [FACE.L, FACE.R, FACE.D, FACE.U, FACE.B, FACE.F]) {
            const list = stickers[FACE[face]];
            if (list) for (const sticker in list) ctx.world.cube.stick(Number(sticker), face, list[sticker]);
          }
        }
      }
    } catch (e) {
      console.log(e);
    }
  }, [ctx.world]);
  return (
    <SceneShell ctx={ctx} mode="player" viewportHeight={100} lockOrder>
      <div className="score-pill clickable" onClick={() => setOpen(true)}><Code2 />脚本</div>
      <div className="bottom-panel"><Playbar ctx={ctx} scene={scene} action={action} /></div>
      <Modal title="播放脚本" open={open} onClose={() => setOpen(false)}>
        <label>场景<textarea readOnly value={scene} /></label>
        <label>动作<textarea readOnly value={action} /></label>
      </Modal>
    </SceneShell>
  );
}

function Algs() {
  const ctx = useAppContext();
  const data = useMemo(() => algsJson as { name: string; strip: { [face: string]: number[] | undefined }; items: { name: string; origin: string; exp?: string; order?: number; scramble?: boolean }[] }[], []);
  const [group, setGroup] = useState(0);
  const [index, setIndex] = useState(0);
  const [list, setList] = useState(false);
  const [action, setAction] = useState("");
  const current = data[group].items[index];
  useEffect(() => {
    const order = current.order || 3;
    if (ctx.world.order !== order) ctx.world.order = order;
    ctx.world.cube.strip(data[group].strip);
    setAction(current.exp || current.origin);
  }, [ctx.world, current, data, group]);
  return (
    <SceneShell ctx={ctx} mode="algs" viewportHeight={158} lockOrder>
      <button className="score-pill clickable" onClick={() => setList(true)}><BookOpen />{current.name}</button>
      <div className="bottom-panel medium">
        <div className="script-row">
          <input value={action} onChange={(e) => setAction(e.target.value)} />
          <IconButton title="恢复默认" disabled={action === current.origin} onClick={() => setAction(current.origin)}><RotateCcw /></IconButton>
        </div>
        <Playbar ctx={ctx} scene={`x2${current.scramble ? "" : "^"}`} action={action} />
      </div>
      <Modal title="公式库" open={list} onClose={() => setList(false)} className="alg-modal">
        <div className="alg-layout">
          <div className="settings-tabs compact">
            {data.map((item, i) => <button key={item.name} className={group === i ? "selected" : ""} onClick={() => setGroup(i)}>{item.name}</button>)}
          </div>
          <div className="alg-grid">
            {data[group].items.map((item, i) => (
              <button key={item.name} onClick={() => { setIndex(i); setList(false); }}>
                <strong>{item.name}</strong>
                <span>{(item.exp || item.origin).slice(0, 70)}</span>
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </SceneShell>
  );
}

function Director() {
  const ctx = useAppContext();
  const playbar = useRef<PlaybarHandle>(null);
  const [scene, setScene] = useState("x2^");
  const [action, setAction] = useState("RUR'U'~");
  const [script, setScript] = useState(false);
  const [output, setOutput] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [recording, setRecording] = useState(false);
  const [pixel, setPixel] = useState(512);
  const [filmt, setFilmt] = useState<"gif" | "pngs">("gif");
  const [delay, setDelay] = useState(2);
  const filmer = useMemo(
    () => configureRenderer(new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true })),
    []
  );
  const gif = useMemo(() => new GIF(COLORS), []);
  const zip = useMemo(() => new ZIP(), []);
  const pixels = useRef<Uint8Array>(new Uint8Array(0));
  const snap = () => {
    const width = ctx.world.width;
    const height = ctx.world.height;
    ctx.world.width = pixel;
    ctx.world.height = pixel;
    ctx.world.resize();
    filmer.setSize(pixel, pixel, true);
    filmer.setClearColor(0xffffff, 0);
    filmer.clear();
    filmer.render(ctx.world.scene, ctx.world.camera);
    ctx.world.width = width;
    ctx.world.height = height;
    ctx.world.resize();
    Util.DOWNLOAD("cuber", "png", filmer.domElement.toDataURL("image/png"));
  };
  const finish = () => {
    setRecording(false);
    if (filmt === "gif") {
      gif.finish();
      const blob = new Blob([gif.out.getData() as BlobPart], { type: "image/gif" });
      Util.DOWNLOAD("cuber", "gif", URL.createObjectURL(blob));
    } else {
      zip.finish();
      const blob = new Blob([zip.out.getData() as BlobPart], { type: "application/zip" });
      Util.DOWNLOAD("cuber", "zip", URL.createObjectURL(blob));
    }
  };
  useAnimation(() => {
    if (!recording) return;
    const width = ctx.world.width;
    const height = ctx.world.height;
    ctx.world.width = pixel;
    ctx.world.height = pixel;
    ctx.world.resize();
    filmer.clear();
    filmer.render(ctx.world.scene, ctx.world.camera);
    if (filmt === "gif") {
      const gl = filmer.getContext();
      gl.readPixels(0, 0, pixel, pixel, gl.RGBA, gl.UNSIGNED_BYTE, pixels.current);
      gif.add(pixels.current);
    } else {
      const raw = atob(filmer.domElement.toDataURL("image/png").split(";base64,")[1]);
      const data = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) data[i] = raw.charCodeAt(i);
      zip.add(`cuber${zip.num}.png`, data);
    }
    ctx.world.width = width;
    ctx.world.height = height;
    ctx.world.resize();
    if (playbar.current && !playbar.current.playing) finish();
  });
  const film = () => {
    if (recording) {
      finish();
      return;
    }
    filmer.setPixelRatio(1);
    filmer.setSize(pixel, pixel, true);
    if (filmt === "gif") {
      pixels.current = new Uint8Array(pixel * pixel * 4);
      gif.start(pixel, pixel, delay);
      filmer.setClearColor(0xffffff, 1);
    } else {
      zip.init();
      filmer.setClearColor(0xffffff, 0);
    }
    playbar.current?.init();
    playbar.current?.toggle();
    setRecording(true);
  };
  const share = () => {
    const data = btoa(JSON.stringify({ order: ctx.world.order, drama: { scene, action } }));
    const url = `${location.origin}${location.pathname}?mode=player&data=${data}`;
    setShareLink(url);
    setShareOpen(true);
    navigator.clipboard?.writeText(url).catch(() => undefined);
  };
  return (
    <SceneShell ctx={ctx} mode="director" viewportHeight={204}>
      <div className="bottom-panel tall">
        <div className="toolbar primary-toolbar">
          <IconButton title="输出设置" disabled={recording} onClick={() => setOutput(true)}><Settings /></IconButton>
          <IconButton title="截图" disabled={recording} onClick={snap}><Camera /></IconButton>
          <IconButton title={recording ? "停止录制" : "导出动画"} onClick={film}>{recording ? <Pause /> : <Clapperboard />}</IconButton>
          <IconButton title="分享" disabled={recording} onClick={share}><Share2 /></IconButton>
          <IconButton title="脚本" disabled={recording} onClick={() => setScript(true)}><Clipboard /></IconButton>
        </div>
        <div className="script-row"><input value={action} onChange={(e) => setAction(e.target.value)} /><IconButton title="展开" onClick={() => setAction(new TwistNode(action.startsWith("SSE:") ? Util.SSE2SIGN(ctx.world.order, action.replace("SSE:", "")) : action).parse().map((item) => item.value).join(" "))}><FastForward /></IconButton></div>
        <Playbar ref={playbar} ctx={ctx} scene={scene} action={action.startsWith("SSE:") ? Util.SSE2SIGN(ctx.world.order, action.replace("SSE:", "")) : action} disabled={recording} />
      </div>
      <Modal title="脚本编辑" open={script} onClose={() => setScript(false)}>
        <label>场景<textarea value={scene} onChange={(e) => setScene(e.target.value)} /></label>
        <label>动作<textarea value={action} onChange={(e) => setAction(e.target.value)} /></label>
      </Modal>
      <Modal title="分享链接" open={shareOpen} onClose={() => setShareOpen(false)}>
        <textarea readOnly value={shareLink} />
        <div className="modal-actions">
          <button onClick={() => navigator.clipboard?.writeText(shareLink)}>复制</button>
          <button onClick={() => window.open(shareLink)}>打开</button>
        </div>
      </Modal>
      <Modal title="输出设置" open={output} onClose={() => setOutput(false)}>
        <div className="option-group">
          <strong>画布尺寸</strong>
          <div className="button-grid">{[128, 256, 512, 1024, 2048].map((item) => <button key={item} className={pixel === item ? "selected" : ""} onClick={() => setPixel(item)}>{item}px</button>)}</div>
        </div>
        <div className="option-group">
          <strong>导出格式</strong>
          <div className="button-grid">{(["gif", "pngs"] as const).map((item) => <button key={item} className={filmt === item ? "selected" : ""} onClick={() => setFilmt(item)}>{item === "gif" ? "GIF 动画" : "PNG 序列"}</button>)}</div>
        </div>
        <div className="option-group">
          <strong>GIF 帧延迟</strong>
          <div className="button-grid">{[2, 3, 4, 5, 6, 10].map((item) => <button key={item} className={delay === item ? "selected" : ""} onClick={() => setDelay(item)}>{item} cs</button>)}</div>
        </div>
      </Modal>
    </SceneShell>
  );
}

function HelpContent({ compact = false }: { compact?: boolean }) {
  const quickStarts = [
    ["AI 智能伴学", "右侧「魔方助手」接入 MCP 协议，随时点击「新手教学」、「CFOP速拧」或「下一步怎么做」，获取结构化动作与语音指导。"],
    ["练习与计时", "3D 拟真舞台自由转动，支持鼠标拖拽旋转。点击左下角时钟可清零重置，打乱转动第 1 步自动起步计时。"],
    ["录入与求解", "在求解模式中填涂真实魔方贴纸颜色，后端求解引擎秒级计算还原路径，并可点击播放条跟随 3D 动画复盘。"],
    ["公式与动画", "在公式模式中按分类学习 F2L/OLL/PLL；在动画模式中编辑动作脚本，一键导出 GIF 动图或 PNG 序列。"],
  ];
  const modes = [
    ["练习", "3D 拟真舞台与计时复盘", "自由操作魔方、毫秒级计时、打乱还原、历史记录及 AI 实时伴学。"],
    ["求解", "实体魔方颜色录入与求解", "录入真实魔方 54 格颜色，由 MCP 求解引擎秒级计算还原步骤并生成分步动画。"],
    ["公式", "全套 CFOP 标准公式库", "涵盖 F2L、OLL、PLL 经典公式，支持逐步拆解播放与自定义编辑验证。"],
    ["动画", "魔方动作脚本与动画制作", "支持自定义场景与动作脚本编写，可导出高清 PNG 序列或 GIF 教学动图。"],
    ["播放", "复原路径推演播放器", "跟随 3D 动画与语音解法，按阶段和步骤逐格观察魔方旋转变化。"],
  ];
  return (
    <section className={compact ? "help compact-help" : "help-page"}>
      <h1>CubeTutor 使用帮助</h1>
      <p className="help-lead">
        CubeTutor 是一个基于 <strong>MCP（Model Context Protocol）协议</strong> 与 3D 拟真舞台的智能魔方教学与求解系统。系统深度融合了 Emotion Ball 灵动 AI 伴学导师、多算法核心求解引擎（新手层先法 / CFOP 进阶速拧 / Kociemba 最优解）、3D 动画推演与语音教学。
      </p>

      <h2>快速开始</h2>
      <div className="help-grid">
        {quickStarts.map(([title, text]) => (
          <article key={title} className="help-card">
            <strong>{title}</strong>
            <p>{text}</p>
          </article>
        ))}
      </div>

      <h2>模式怎么选</h2>
      <div className="help-mode-list">
        {modes.map(([name, title, text]) => (
          <article key={name} className="help-mode-item">
            <b>{name}</b>
            <div>
              <strong>{title}</strong>
              <p>{text}</p>
            </div>
          </article>
        ))}
      </div>

      <h2>AI 智能助手与求解体系</h2>
      <ul>
        <li><strong>新手层先法（LBL · 7 阶段）</strong>：专为初学者打造，按“底十字 ➔ 底角块 ➔ 中层棱 ➔ 顶十字 ➔ 顶角向 ➔ 顶角位 ➔ 顶棱位”分步推进，易学易懂。</li>
        <li><strong>CFOP 进阶速拧（4 阶段）</strong>：竞技速拧主流方案，按“Cross 底十字 ➔ F2L 前两层 ➔ OLL 顶面朝向 ➔ PLL 顶层置换”快速还原。</li>
        <li><strong>Kociemba 最优解</strong>：采用两阶段数学算法，20 步以内极速计算理论最优还原路径。</li>
        <li><strong>大模型 API 配置</strong>：点击右侧面板顶部「⚙️ 设置」可配置 DeepSeek、通义千问、OpenRouter、OpenAI 等大模型服务，获得更具深度的答疑。</li>
      </ul>

      <h2>3D 舞台与基础操作</h2>
      <ul>
        <li>在魔方贴纸上拖动可以转动对应层，在空白区域拖动可以旋转整体 3D 视角。</li>
        <li>鼠标滚轮可缩放视图；控制台的“镜头”页可以精确调整缩放、透视、水平角和俯仰角。</li>
        <li>练习模式底部工具栏包含计时重置、重新打乱、历史、撤销和分享功能。</li>
        <li>点击左下角 <code>⏱️ 00:00.0/0</code> 计时卡片可一键重置当前用时与步数。</li>
        <li>重新打乱框中输入 <code>*</code> 会生成随机打乱；也可以输入指定公式作为初始打乱状态。</li>
      </ul>

      <h2>求解与录入模式</h2>
      <ul>
        <li>先在底部选择颜色，再点击魔方上的贴纸录入颜色。三阶魔方每种颜色应各出现 9 次。</li>
        <li>“重置”会恢复标准已还原状态；“清空”会移除所有贴纸颜色，适合重新录入。</li>
        <li>求解完成后可直接打开播放器逐步跟随 3D 动画与语音解法复盘。若校验未通过，系统会自动提示不合法的具体原因。</li>
      </ul>

      <h2>公式与动画制作</h2>
      <ul>
        <li>公式模式内置完整 F2L、OLL、PLL 公式库，支持按条目逐步拆解观察。</li>
        <li>动画模式支持自定义场景和动作脚本，可一键导出高清透明 PNG 序列或 GIF 动图。</li>
        <li>基础转动语法：<code>R U F D L B</code>；整体转动：<code>x y z</code>；宽层转动：<code>Rw Uw</code>；后缀 <code>'</code> 表示逆时针，数字表示旋转次数（如 <code>U2</code>）。</li>
      </ul>

      <h2>控制台与个性化</h2>
      <ul>
        <li>阶数支持 2 到 10 阶自由调节（求解模式锁定为 3 阶以匹配算法约束）。</li>
        <li>显示页支持厚贴纸、镜面、空心、箭头、光影和深色界面自由切换。</li>
        <li>配色页可自定义六面颜色及辅助高亮颜色，满足个性化视觉需求。</li>
      </ul>

      <h2>数据与分享</h2>
      <ul>
        <li>练习数据、偏好设置和配色保存在浏览器本地存储中，不需要账号。</li>
        <li>分享链接会把阶数、场景、动作和必要贴纸状态编码到 URL 中，接收者打开后可直接复盘。</li>
        <li>如果页面表现异常，可以先尝试控制台重置配置；需要彻底恢复时再选择清空全部本地数据。</li>
      </ul>
    </section>
  );
}

function HelpPage() {
  return (
    <main className="document-shell">
      <button className="floating-menu" title="返回练习" onClick={() => openMode("playground")}><Home /></button>
      <HelpContent />
    </main>
  );
}

function App() {
  const mode = readMode();
  if (mode === "helper") return <Helper />;
  if (mode === "algs") return <Algs />;
  if (mode === "director") return <Director />;
  if (mode === "player") return <Player />;
  if (mode === "help") return <HelpPage />;
  return <Playground />;
}

const root = createRoot(document.getElementById("app")!);
root.render(<App />);
