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
  History,
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
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import * as THREE from "three";
import "./index.css";
import World from "./cuber/world";
import Cubelet from "./cuber/cubelet";
import { COLORS, FACE } from "./cuber/define";
import { PaletteData, PreferanceData } from "./data";
import { TwistAction, TwistNode } from "./cuber/twister";
import Toucher from "./vue/Viewport/toucher";
import Rubic from "./vue/Playground/rubic";
import Solver, { SolveMethod, SolveResult } from "./solver/Solver";
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
      <Modal title="Cuber 使用帮助" open={helpOpen} onClose={() => setHelpOpen(false)} className="help-modal">
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
      <div className="logo-subtext">CubeTutor · 智能魔方</div>
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
  useEffect(() => {
    viewport.current?.resize(width, Math.max(1, height - viewportHeight));
  }, [height, viewportHeight, width]);
  useAnimation(() => viewport.current?.draw());
  useEffect(() => {
    ctx.preferance.refresh();
    ctx.palette.refresh();
  }, [ctx]);
  return (
    <main className="app-shell">
      <BrandLogo />
      <SettingsPanel ctx={ctx} mode={mode} onOrder={onOrder} lockOrder={lockOrder} />
      <Viewport ref={viewport} ctx={ctx} />
      {children}
    </main>
  );
}

function Playground() {
  const ctx = useAppContext();
  const data = useMemo(() => new PlaygroundData(), []);
  const [, force] = useState(0);
  const [scrambleOpen, setScrambleOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [link, setLink] = useState("");
  const [done, setDone] = useState(false);

  const sync = useCallback(() => {
    data.scene = ctx.world.cube.history.init;
    data.history = ctx.world.cube.history.exp.substring(1);
    if (!data.complete) {
      data.complete = ctx.world.cube.complete;
      if (data.complete) setDone(true);
    }
    data.save();
    force((i) => i + 1);
  }, [ctx.world, data]);

  const scramble = useCallback(() => {
    data.complete = true;
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
    if (!data.complete) {
      if (ctx.world.cube.history.moves === 0) {
        data.start = 0;
        data.now = 0;
      } else {
        if (data.start === 0) data.start = Date.now();
        data.now = Date.now();
      }
      force((i) => i + 1);
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
      <div className="score-pill">{formatScore(data.start, data.now, ctx.world.cube.history.moves)}</div>
      {prefix && <div className="key-pill">{prefix}</div>}
      <div className="bottom-panel">
        <div className="toolbar primary-toolbar">
          <IconButton title="重新打乱" onClick={() => setScrambleOpen(true)}><Shuffle /></IconButton>
          <IconButton title="历史" onClick={() => setHistoryOpen(true)}><History /></IconButton>
          <IconButton title="撤销" disabled={ctx.world.cube.history.length === 0} onClick={() => ctx.world.cube.twister.undo()}><RotateCcw /></IconButton>
          <IconButton title="分享" onClick={share}><Share2 /></IconButton>
        </div>
      </div>
      <Modal title="重新打乱" open={scrambleOpen} onClose={() => setScrambleOpen(false)}>
        <textarea value={data.scrambler} onChange={(e) => { data.scrambler = e.target.value; force((i) => i + 1); }} />
        <div className="modal-actions"><button onClick={() => setScrambleOpen(false)}>取消</button><button className="danger" onClick={() => { setScrambleOpen(false); scramble(); }}>确定</button></div>
      </Modal>
      <Modal title="历史记录" open={historyOpen} onClose={() => setHistoryOpen(false)}>
        <label>打乱<textarea readOnly value={data.scene} /></label>
        <label>复原<textarea readOnly value={data.history} /></label>
        <div className="modal-actions">
          <button disabled={ctx.world.order > 3} onClick={() => { data.history = Rubic.adjust(data.history); data.save(); load(); }}>整理</button>
          <button disabled={ctx.world.order > 3} onClick={() => { const ret = Rubic.niss(data.scene, data.history); data.scene = ret.scene; data.history = ret.history; data.save(); load(); }}>NISS</button>
          <button onClick={share}>分享</button>
        </div>
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
  // 前置摄像头时在绘制阶段水平翻转视频帧（而非 CSS 镜像），
  // 使叠加层文字正常、检测坐标与用户视角一致
  const mirroredRef = useRef(false);
  // 连续两次检测分布一致时，把该分布“锁定”在一旁，
  // 便于手持魔方时松手后再按采集键，无需稳住同时按键
  const [locked, setLocked] = useState<{ grid: FaceKey[]; face: FaceKey } | null>(null);
  const lockedRef = useRef<{ grid: FaceKey[]; face: FaceKey; rawKey: string } | null>(null);
  const prevDetectKeyRef = useRef("");
  // 最近一次后端失败消息（success=false 时的 message），用于在 prompt 中直接显示
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
      // 自动连接后端检测服务，无需手动点击
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

  const drawCellOverlay = (gctx: CanvasRenderingContext2D, region: Region | null, grid: FaceKey[] | null) => {
    if (!region) {
      // 未检测到魔方：显示一个灰色引导框
      gctx.strokeStyle = "rgba(200,200,200,0.35)";
      gctx.lineWidth = 2;
      gctx.setLineDash([8, 6]);
      const gx = canvasRef.current!.width * 0.2;
      const gy = canvasRef.current!.height * 0.2;
      const gw = canvasRef.current!.width * 0.6;
      const gh = canvasRef.current!.height * 0.6;
      gctx.strokeRect(gx, gy, gw, gh);
      gctx.setLineDash([]);
      return;
    }
    // 检测到魔方：绿色轮廓 + 3x3 网格
    gctx.lineWidth = 3;
    gctx.strokeStyle = "rgba(34,197,94,0.95)";
    gctx.strokeRect(region.x, region.y, region.w, region.h);
    if (grid) {
      const n = 3;
      const cw = region.w / n;
      const ch = region.h / n;
      gctx.lineWidth = 1;
      gctx.strokeStyle = "rgba(255,255,255,0.5)";
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const x = region.x + c * cw;
          const y = region.y + r * ch;
          gctx.strokeRect(x, y, cw, ch);
          const letter = grid[r * n + c];
          const fs = Math.max(10, Math.round(Math.min(cw, ch) * 0.35));
          gctx.font = `bold ${fs}px sans-serif`;
          gctx.textAlign = "center";
          gctx.textBaseline = "middle";
          gctx.fillStyle = "rgba(0,0,0,0.65)";
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
    // 进入/重新进入采集阶段时清空旧锁定，避免沿用上一面的结果
    lockedRef.current = null;
    prevDetectKeyRef.current = "";
    setLocked(null);
    let alive = true;
    let raf = 0;
    let sized = false;
    let detecting = false;
    let lastDetectAt = 0;
    const DETECT_INTERVAL = 400;

    // 独立的送检画布：只绘制视频帧，避免叠加层文字污染颜色采样
    const detCanvas = document.createElement("canvas");
    const detCtx = detCanvas.getContext("2d", { willReadFrequently: true });

    // 绘制视频帧：前置摄像头水平翻转，使画面方向与用户动作一致。
    // 预览与送检均使用此函数，后端返回的 bbox/grid 即用户视角坐标，
    // 叠加层文字无需镜像、采集结果可直接放入 2D 展开图
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
              // （锁定的是镜像后可直接存入展开图的 grid，便于松手后按采集键录入）
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
            // 后端返回失败：记录 message，后续在 prompt 中显示
            lastFailMsgRef.current = result.message || "未检测到魔方";
          }
        }
        if (!nextPrompt) {
          liveGridRef.current = [];
          regionRef.current = null;
          // 检测丢失时重置连续计数，但保留已锁定分布：用户可放下魔方后再采集
          prevDetectKeyRef.current = "";
          if (lockedRef.current) {
            nextPrompt = `已锁定 ${lockedRef.current.face} 面分布，可松开魔方后点击"采集锁定"录入`;
          } else if (!backendConnected) {
            nextPrompt = "未连接检测服务，请确认后端已启动后返回重试";
          } else if (lastFailMsgRef.current) {
            // 后端返回失败：直接显示后端的 message，便于排查
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
        // 检测出错时保持上一帧
      } finally {
        detecting = false;
      }
    };

    const loop = () => {
      if (!alive) return;
      if (video.readyState >= 2 && video.videoWidth) {
        if (!sized) {
          const long = Math.max(video.videoWidth, video.videoHeight);
          const scale = long > 480 ? 480 / long : 1;
          canvas.width = Math.round(video.videoWidth * scale);
          canvas.height = Math.round(video.videoHeight * scale);
          detCanvas.width = canvas.width;
          detCanvas.height = canvas.height;
          sized = true;
        }
        drawVideoFrame(gctx, canvas.width, canvas.height);
        // 每帧根据最新检测结果重绘叠加层，检测异步执行且限频，不阻塞渲染
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
        // 前置摄像头（user 或未报告朝向）在绘制阶段水平翻转视频帧，后置保持原始画面
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
    // 优先使用已锁定的分布（已镜像、可直接存入展开图）；
    // 否则取实时检测结果，并按前置摄像头镜像还原魔方真实朝向
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
      : `已录入 ${face} 面（${FACE_COLORS[face]}色面正对镜头，${FACE_COLORS[onTop]}色面朝上，可在展开图中旋转校正）`;
    lastPromptRef.current = msg;
    setPrompt(msg);
    // 录入后重置连续计数，准备下一面；若使用了锁定则一并清除
    prevDetectKeyRef.current = "";
    if (lk) {
      lockedRef.current = null;
      setLocked(null);
    }
    setTarget(null);
  };

  // 主动清除当前锁定（分布陈旧或不想使用时）
  const clearLock = () => {
    lockedRef.current = null;
    prevDetectKeyRef.current = "";
    setLocked(null);
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

  // 手动校正：点击贴纸循环切换颜色（U→R→F→D→L→B）
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

  return (
    <Modal title="摄像头录入魔方状态" open={open} onClose={onClose} className="scanner-modal">
      <video ref={videoRef} className="scanner-video-hidden" playsInline muted />
      {error && <div className="scanner-error">{error}</div>}
      {phase === "intro" && (
        <div className="scanner-intro">
          <p>通过摄像头自动识别魔方颜色并录入到 3D 魔方。请允许浏览器使用摄像头。</p>

          <div className="option-group">
            <strong>检测服务</strong>
            <div className="backend-connect">
              <span className={backendConnected ? "status-ok" : "status-warn"}>
                {backendStatus}
              </span>
            </div>
            <small className="hint">
              打开后自动连接检测服务。若显示"无法连接"，请启动后端服务：
              <code>cd cuber-server && pip install -r requirements.txt && python main.py</code>
            </small>
          </div>

          <ul className="scanner-tips">
            <li>点击"开始录入"后，将魔方一个面正对镜头即可自动识别。</li>
            <li>按提示依次采集 6 个面，光线均匀、背景简洁时识别更稳定。</li>
          </ul>
          <div className="modal-actions">
            <button onClick={onClose}>取消</button>
            <button className="primary" onClick={() => setPhase("capture")}>开始录入</button>
          </div>
        </div>
      )}
      {phase === "capture" && (
        <div className="scanner-capture">
          <div className="scanner-stage">
            <canvas ref={canvasRef} className="scanner-canvas" />
          </div>
          <div className="scanner-prompt">{prompt || "正在启动摄像头…"}</div>
          <div className="scanner-chips">
            {FACE_KEYS.map((k) => (
              <span key={k} className={`scanner-chip ${captured[k] ? "done" : ""}`} style={{ background: captured[k] ? FACE_COLORS[k] : undefined }}>
                {k}
              </span>
            ))}
          </div>
          {locked && (
            <div className="scanner-locked">
              <div className="face-grid">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="face-grid-cell" style={{ background: FACE_COLORS[locked.grid[i]] }} />
                ))}
              </div>
              <div className="scanner-locked-info">
                <span className="scanner-locked-badge">已锁定 {locked.face} 面</span>
                <span className="scanner-locked-hint">分布已保存，可松开魔方后点"采集锁定"录入</span>
                <button type="button" className="scanner-locked-clear" onClick={clearLock}>清除锁定</button>
              </div>
            </div>
          )}
          {target && <div className="scanner-target">目标面：{target}（{FACE_ORIENTATION_HINTS[target]}）</div>}
          <div className="scanner-orientation-rules">
            <div className="scanner-orientation-title">面朝向规则（正对镜头 → 朝上）</div>
            <div className="scanner-orientation-list">
              {FACE_KEYS.map((k) => {
                const onTop = ON_TOP_FACE[k];
                return (
                  <div key={k} className={`scanner-orientation-row ${target === k ? "active" : ""}`}>
                    <span className="face-letter" style={{ background: FACE_COLORS[k], color: contrastColor(FACE_COLORS[k]) }}>{k}</span>
                    <span className="arrow">→</span>
                    <span className="face-letter" style={{ background: FACE_COLORS[onTop], color: contrastColor(FACE_COLORS[onTop]) }}>{onTop}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="modal-actions scanner-actions">
            <button onClick={() => { setTarget(null); setPhase("intro"); }}>返回</button>
            <button disabled={!liveReady && !locked} onClick={capture}>{locked ? "采集锁定" : "采集"}</button>
            <button disabled={doneCount < 6} onClick={() => setPhase("review")}>完成 ({doneCount}/6)</button>
          </div>
        </div>
      )}
      {phase === "review" && (
        <div className="scanner-review">
          <p>下方为识别到的 2D 展开图。点击贴纸可循环切换颜色手动校正；可旋转单面修正朝向，或重新扫描。确认与魔方一致后点击“确定涂色”。</p>
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
            <div className="scanner-warn">{validation.issues.map((s, i) => <div key={i}>· {s}</div>)}</div>
          )}
          <div className="modal-actions">
            <button onClick={() => setPhase("capture")}>继续采集</button>
            <button className="primary" onClick={confirm}>确定涂色</button>
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
  const actions = useMemo(() => new TwistNode(result.raw).parse(), [result.raw]);
  const playingRef = useRef(false);
  const progressRef = useRef(0);
  const actionsRef = useRef(actions);
  playingRef.current = playing;
  progressRef.current = progress;
  actionsRef.current = actions;

  const init = useCallback(() => {
    ctx.world.controller.lock = false;
    playingRef.current = false;
    progressRef.current = 0;
    setPlaying(false);
    setProgress(0);
    const setup = scene.replace("^", `(${result.raw})'`);
    ctx.world.cube.twister.setup(setup);
    if (stickers) {
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
        <div className="toolbar">
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
        </div>
      </div>
    </div>
  );
}

function Helper() {
  const ctx = useAppContext();
  const solver = useMemo(() => new Solver(), []);
  const [color, setColor] = useState("R");
  const [stickers, setStickers] = useState<StickerMap>(() => JSON.parse(localStorage.getItem("helper-stickers") || "{}"));
  const [methodOpen, setMethodOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [result, setResult] = useState<SolveResult | null>(null);
  const [resultScene, setResultScene] = useState("");
  const [errorText, setErrorText] = useState("");
  const [state, setState] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  useEffect(() => {
    ctx.world.order = 3;
    ctx.world.controller.taps.push((index, face) => {
      if (face != null && index >= 0) {
        const cubelet = ctx.world.cube.cubelets[index];
        const initial = cubelet.initial;
        const realFace = cubelet.getFace(face);
        setStickers((value) => {
          const next = { ...value, [FACE[realFace]]: { ...(value[FACE[realFace]] || {}), [initial]: color } };
          localStorage.setItem("helper-stickers", JSON.stringify(next));
          ctx.world.cube.stick(initial, realFace, color);
          setState(ctx.world.cube.serialize());
          return next;
        });
      }
    });
  }, [color, ctx.world]);
  useAnimation(() => solver.init());
  const reset = () => {
    ctx.world.cube.reset();
    // 重置所有贴纸为各面默认颜色：strip({}) 会令每个贴纸 stick(face, "")
    // 恢复为该面默认材质并设为可见
    ctx.world.cube.strip({});
    const next: StickerMap = {};
    for (const face of [FACE.L, FACE.R, FACE.D, FACE.U, FACE.B, FACE.F]) {
      const key = FACE[face];
      const group = ctx.world.cube.table.face(key);
      next[key] = {};
      for (const index of group.indices) next[key]![index] = key;
    }
    setStickers(next);
    localStorage.setItem("helper-stickers", JSON.stringify(next));
    setState(ctx.world.cube.serialize());
  };
  const clear = () => {
    setStickers({});
    localStorage.removeItem("helper-stickers");
    ctx.world.cube.strip({});
    setState(ctx.world.cube.serialize());
  };
  const runSolve = (method: SolveMethod) => {
    const ret = solver.solvePhased(ctx.world.cube.serialize(), method);
    setMethodOpen(false);
    if (ret.error) {
      setErrorText(ret.error);
      setResult(null);
      return;
    }
    setErrorText("");
    setResultScene(ctx.world.cube.history.exp);
    setResult(ret);
  };
  const exitPlayer = () => {
    // 退出播放：恢复录入态（重置动作历史，回到求解前的贴纸状态）
    ctx.world.cube.twister.setup(resultScene);
    if (stickers) {
      for (const face of [FACE.L, FACE.R, FACE.D, FACE.U, FACE.B, FACE.F]) {
        const list = stickers[FACE[face]];
        if (list) for (const sticker in list) ctx.world.cube.stick(Number(sticker), face, list[sticker]);
      }
    }
    setResult(null);
  };
  const applyScan = (faces: Record<FaceKey, FaceKey[]>) => {
    const next: StickerMap = { ...stickers };
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
    setState(ctx.world.cube.serialize());
    setScanOpen(false);
  };
  const counts = [...state].reduce<Record<string, number>>((acc, item) => ({ ...acc, [item]: (acc[item] || 0) + 1 }), {});
  return (
    <SceneShell ctx={ctx} mode="helper" viewportHeight={result ? 360 : 204} lockOrder>
      {result ? (
        <SolutionPlayer
          ctx={ctx}
          result={result}
          scene={resultScene}
          stickers={stickers}
          onClose={exitPlayer}
        />
      ) : (
        <div className="bottom-panel tall">
          <div className="color-grid">
            {["R", "F", "D", "L", "B", "U"].map((item) => (
              <button key={item} className={color === item ? "selected" : ""} style={{ background: COLORS[item] }} onClick={() => setColor(item)}>
                {color === item ? <Wand2 /> : counts[item] || 0}
              </button>
            ))}
            <button onClick={() => setMethodOpen(true)}><Sparkles />求解</button>
            <button onClick={() => setScanOpen(true)}><ScanLine />录入</button>
            <button onClick={reset}><RefreshCw />重置</button>
            <button className="danger" onClick={clear}><Trash2 />清空</button>
            <button onClick={() => setLegendOpen(true)}><Compass />图例</button>
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
  const keyRows = [
    ["1", "2", "3=<", "4=>", "5=M", "6=M", "7=<", "8=>", "9", "0"],
    ["Q=z'", "W=B", "E=L'", "R=Lw'", "T=x", "Y=x", "U=Rw", "I=R", "O=B'", "P=z"],
    ["A=y'", "S=D", "D=L", "F=U'", "G=F'", "H=F", "J=U", "K=R'", "L=D'", ";=y"],
    ["Z=Dw", "X=M'", "C=Uw'", "V=Lw", "B=x'", "N=x'", "M=Rw'", ",=Uw", ".=M'", "/=Dw'"],
    ["←=U", "↑=R", "→=U'", "↓=R'"],
  ];
  const quickStarts = [
    ["练习复原", "进入练习，点重新打乱；拖动贴纸转层，拖空白区域转视角；完成后可看历史或分享复盘。"],
    ["录入求解", "进入求解，先选颜色，再点魔方贴纸填色；颜色数量正确后点求解，可复制公式或直接播放。"],
    ["学习公式", "进入公式，选择 F2L / OLL / PLL 条目；用播放器逐步观察，必要时直接编辑公式文本。"],
    ["制作动画", "进入动画，编辑脚本，播放预览；需要素材时可截图、导出 GIF 或 PNG 序列。"],
  ];
  const modes = [
    ["练习", "自由操作魔方", "适合计时、打乱、复原、撤销、查看历史和分享复盘。"],
    ["求解", "三阶颜色录入", "适合把真实魔方状态录入到页面中，生成复原公式并播放检查。"],
    ["公式", "内置公式库", "适合按分类学习 F2L、OLL、PLL，逐步观察公式如何移动块。"],
    ["动画", "脚本与导出", "适合制作演示、教程素材、GIF 动画、透明 PNG 序列和分享播放链接。"],
    ["播放", "只读复盘", "由分享链接或求解结果打开，专注播放场景和动作，不改动原始脚本。"],
  ];
  return (
    <section className={compact ? "help compact-help" : "help-page"}>
      <h1>Cuber 使用帮助</h1>
      <p className="help-lead">
        Cuber 是一个在浏览器中运行的魔方工具箱。它既可以当作自由练习的虚拟魔方，也能用于三阶求解、公式学习、动画制作、复盘播放和外观配置。
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

      <h2>基础操作</h2>
      <ul>
        <li>在魔方贴纸上拖动可以转动对应层，在空白区域拖动可以旋转整体视角。</li>
        <li>滚轮可以缩放视图；控制台的“镜头”页可以精确调整缩放、透视、水平角和俯仰角。</li>
        <li>练习模式底部工具栏包含重新打乱、历史、撤销和分享。历史会保存初始场景和你的后续转动。</li>
        <li>历史记录会保存当前初始状态和后续转动，复盘会打开独立播放模式，便于逐步查看还原过程。</li>
        <li>重新打乱框中输入 <code>*</code> 会生成随机打乱；也可以输入指定公式作为打乱状态。</li>
      </ul>

      <h2>键盘操作</h2>
      <p>物理键盘会映射为常用转动，适合快速练习和公式输入。页面左上角会显示正在输入的数字前缀。</p>
      <div className="key-table">
        {keyRows.map((row, rowIndex) => (
          <div key={rowIndex} className="key-row">
            {row.map((item) => {
              const [key, action = ""] = item.split("=");
              return (
                <span key={item}>
                  <b>{key}</b>
                  <small>{action}</small>
                </span>
              );
            })}
          </div>
        ))}
      </div>

      <h2>求解模式</h2>
      <ul>
        <li>先在底部选择颜色，再点击魔方上的贴纸录入颜色。三阶魔方每种颜色应各出现 9 次。</li>
        <li>“重置”会恢复一个标准已还原状态；“清空”会移除所有贴纸颜色，适合重新录入。</li>
        <li>求解结果可以复制，也可以直接打开播放模式逐步检查。若返回错误，优先检查中心、棱块和角块颜色是否录入正确。</li>
      </ul>

      <h2>公式与播放</h2>
      <ul>
        <li>公式模式内置 F2L、OLL、PLL。点击左上角公式名称可打开列表并切换条目。</li>
        <li>播放条支持回到开始、上一步、播放/暂停、下一步、跳到结尾；进度滑块可以直接拖到任意步骤。</li>
        <li>公式输入框可以临时编辑。恢复按钮会把当前条目还原为内置公式。</li>
        <li>播放模式通常由分享链接、求解结果或动画分享打开，适合只读复盘和逐步讲解。</li>
      </ul>

      <h2>动画制作</h2>
      <ul>
        <li>“脚本”里有两个字段：场景用于布置初始状态，动作定义后续播放内容。</li>
        <li>“展开”会把组合公式解析成逐步动作，便于检查和导出。</li>
        <li>“截图”导出当前画面；“导出动画”可生成 GIF 或 PNG 序列；“分享”会复制可播放链接。</li>
        <li>输出设置可调整画布像素、导出格式和 GIF 帧延迟。PNG 序列适合继续放进剪辑或设计软件处理。</li>
      </ul>

      <h2>脚本语法</h2>
      <ul>
        <li>基础转动：<code>R U F D L B</code>；整体转动：<code>x y z</code>；宽层转动：<code>Rw Uw</code>。</li>
        <li>后缀 <code>'</code> 表示逆时针，数字表示重复次数，例如 <code>R'</code>、<code>U2</code>、<code>Rw2</code>。</li>
        <li>括号可以组合并重复，例如 <code>(R U R' U')2</code>。</li>
        <li>方括号支持交换子和共轭写法，例如 <code>[A,B]</code>、<code>[A:B]</code>。</li>
        <li><code>^</code> 会把前面的逆操作写入场景，常用于把动画起始状态先摆好；<code>~</code> 表示停顿，<code>;</code> 表示快速分隔，<code>#</code> 表示复位，<code>*</code> 表示随机打乱。</li>
        <li><code>SSE:</code> 前缀可输入 SSE 表达式，动画模式会在播放和展开时转换为标准动作。</li>
        <li><code>//</code> 可以添加行注释，注释内容不会被解析成动作。</li>
      </ul>

      <h2>控制台设置</h2>
      <ul>
        <li>第一排是模式切换，决定当前工作流；第二排是当前应用的设置页签。</li>
        <li>阶数支持 2 到 10 阶。求解和部分公式场景会锁定阶数，以保证算法和贴纸状态有效。</li>
        <li>镜头页调整缩放、透视和视角；控制页调整动画帧数和触控灵敏度。</li>
        <li>显示页切换厚贴纸、镜面、空心、箭头、光影和深色界面；配色页可修改六面颜色及辅助颜色。</li>
        <li>右侧重置按钮会打开重置确认。可以只重置配置，也可以清空本地数据并刷新页面。</li>
      </ul>

      <h2>数据与分享</h2>
      <ul>
        <li>练习数据、偏好设置和配色保存在浏览器本地存储中，不需要账号。</li>
        <li>分享链接会把阶数、场景、动作和必要贴纸状态编码到 URL 中。接收者打开后可直接复盘。</li>
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
