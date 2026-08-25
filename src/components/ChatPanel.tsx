import React, { useEffect, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  ListFilter,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings,
  Sparkles,
  Terminal,
  Volume2,
  VolumeX,
  Wand2,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { EmotionBallAvatar, EmotionBallAvatarRef } from "../avatar/EmotionBallAvatar";

export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  reasoning?: string;
  emotionId?: string;
  toolCalls?: string[];
  solution?: any;
  timestamp: string;
}

export interface ChatPanelProps {
  open: boolean;
  onToggle: (open: boolean) => void;
  onApplySolution?: (solution: any) => void;
  onScramble?: () => void;
  onReset?: () => void;
  getCubeState?: () => string;
  isSolved?: boolean;
  onWidthChange?: (width: number) => void;
}

export type LLMProvider = "deepseek" | "qwen" | "openrouter" | "openai" | "siliconflow" | "moonshot" | "ollama" | "custom";

export interface ProviderItem {
  name: string;
  baseUrl: string;
  placeholderKey: string;
  defaultModels: string[];
}

const PROVIDER_CONFIGS: Record<LLMProvider, ProviderItem> = {
  deepseek: {
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    placeholderKey: "sk-xxxxxxxxxxxxxxxxxxxxxxxx",
    defaultModels: ["deepseek-chat", "deepseek-reasoner"],
  },
  qwen: {
    name: "通义千问",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    placeholderKey: "sk-xxxxxxxxxxxxxxxxxxxxxxxx",
    defaultModels: ["qwen-turbo", "qwen-plus", "qwen-max", "qwen-long", "qwen2.5-72b-instruct"],
  },
  openrouter: {
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    placeholderKey: "sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxx",
    defaultModels: [
      "deepseek/deepseek-chat",
      "deepseek/deepseek-r1",
      "openai/gpt-4o-mini",
      "openai/gpt-4o",
      "google/gemini-2.0-flash-001",
      "anthropic/claude-3.5-sonnet",
      "meta-llama/llama-3.3-70b-instruct",
      "qwen/qwen-2.5-72b-instruct",
    ],
  },
  openai: {
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    placeholderKey: "sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx",
    defaultModels: ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo", "o1-mini", "o3-mini"],
  },
  siliconflow: {
    name: "硅基流动",
    baseUrl: "https://api.siliconflow.cn/v1",
    placeholderKey: "sk-xxxxxxxxxxxxxxxxxxxxxxxx",
    defaultModels: [
      "deepseek-ai/DeepSeek-V3",
      "deepseek-ai/DeepSeek-R1",
      "Qwen/Qwen2.5-72B-Instruct",
      "Qwen/Qwen2.5-32B-Instruct",
      "THUDM/glm-4-9b-chat",
    ],
  },
  moonshot: {
    name: "Moonshot",
    baseUrl: "https://api.moonshot.cn/v1",
    placeholderKey: "sk-xxxxxxxxxxxxxxxxxxxxxxxx",
    defaultModels: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
  },
  ollama: {
    name: "Ollama",
    baseUrl: "http://localhost:11434/v1",
    placeholderKey: "ollama (可填任意字符)",
    defaultModels: ["qwen2.5:latest", "llama3.2:latest", "deepseek-r1:latest"],
  },
  custom: {
    name: "自定义",
    baseUrl: "",
    placeholderKey: "sk-xxxxxxxxxxxxxxxxxxxxxxxx",
    defaultModels: [],
  },
};

function FormattedMarkdownText({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split("\n");
  return (
    <div className="markdown-body-content">
      {lines.map((line, idx) => {
        if (!line.trim()) {
          return <div key={idx} className="md-spacer" />;
        }
        const isBullet = line.trim().startsWith("- ") || line.trim().startsWith("• ");
        const isNumber = /^\d+[\.、]\s*/.test(line.trim());
        const cleanLine = isBullet ? line.trim().replace(/^[-•]\s*/, "") : line;

        // Split by **bold** and `code`
        const parts = cleanLine.split(/(\*\*.*?\*\*|`.*?`)/g);

        return (
          <div
            key={idx}
            className={`md-line ${isBullet ? "md-bullet" : ""} ${isNumber ? "md-number" : ""}`}
          >
            {isBullet && <span className="bullet-dot">•</span>}
            <span className="line-content">
              {parts.map((p, pIdx) => {
                if (p.startsWith("**") && p.endsWith("**") && p.length >= 4) {
                  return <strong key={pIdx}>{p.slice(2, -2)}</strong>;
                }
                if (p.startsWith("`") && p.endsWith("`") && p.length >= 2) {
                  return (
                    <code key={pIdx} className="inline-code">
                      {p.slice(1, -1)}
                    </code>
                  );
                }
                return <span key={pIdx}>{p}</span>;
              })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function ChatPanel({
  open,
  onToggle,
  onApplySolution,
  onScramble,
  onReset,
  getCubeState,
  isSolved = false,
  onWidthChange,
}: ChatPanelProps) {
  const DEFAULT_PANEL_WIDTH = 380;
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);

  // Reset to default width when reopened
  useEffect(() => {
    if (open) {
      setPanelWidth(DEFAULT_PANEL_WIDTH);
      if (onWidthChange) onWidthChange(DEFAULT_PANEL_WIDTH);
    }
  }, [open]);

  // Left border resize handler
  const isResizingRef = useRef(false);
  const startResizeXRef = useRef(0);
  const startPanelWidthRef = useRef(DEFAULT_PANEL_WIDTH);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    startResizeXRef.current = e.clientX;
    startPanelWidthRef.current = panelWidth;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return;
      const deltaX = startResizeXRef.current - moveEvent.clientX; // Dragging left increases width
      const maxW = Math.min(window.innerWidth * 0.75, 800);
      const newWidth = Math.min(Math.max(300, startPanelWidthRef.current + deltaX), maxW);
      setPanelWidth(newWidth);
      if (onWidthChange) onWidthChange(newWidth);
    };

    const onMouseUp = () => {
      isResizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Right-click in the left/outside area to close the chat panel
  useEffect(() => {
    if (!open) return;
    const handleContextMenu = (e: MouseEvent) => {
      const panelEl = document.querySelector(".chat-panel");
      if (panelEl && !panelEl.contains(e.target as Node)) {
        e.preventDefault();
        onToggle(false);
      }
    };

    window.addEventListener("contextmenu", handleContextMenu);
    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [open, onToggle]);

  const [emotion, setEmotion] = useState("02");
  const [statusText, setStatusText] = useState("待机中");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [method, setMethod] = useState<"beginner" | "cfop" | "kociemba">("beginner");
  const avatarRef = useRef<EmotionBallAvatarRef>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Settings Modal State
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [provider, setProvider] = useState<LLMProvider>("deepseek");
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://api.deepseek.com/v1");
  const [modelName, setModelName] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>(PROVIDER_CONFIGS.deepseek.defaultModels);
  const [detectingModels, setDetectingModels] = useState(false);
  const [testResult, setTestResult] = useState<{ ok?: boolean; msg?: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  // Thought collapsible state (default false / collapsed)
  const [expandedThoughts, setExpandedThoughts] = useState<Record<string, boolean>>({});
  const toggleThought = (msgId: string) => {
    setExpandedThoughts((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  // MCP tool calls collapsible state (default false / collapsed)
  const [expandedMcp, setExpandedMcp] = useState<Record<string, boolean>>({});
  const toggleMcp = (msgId: string) => {
    setExpandedMcp((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  // Vertical position for edge-docked peeking avatar
  const [triggerTop, setTriggerTop] = useState<number>(() => {
    const saved = localStorage.getItem("chat-trigger-top");
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed)) return parsed;
    }
    return typeof window !== "undefined" ? Math.max(80, window.innerHeight / 2 - 30) : 250;
  });

  const isDraggingTriggerRef = useRef(false);
  const dragStartTriggerRef = useRef({ startY: 0, initialTop: 0 });
  const hasMovedTriggerRef = useRef(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "init-1",
      role: "agent",
      content:
        "你好！我是你的 **魔方助手** 🤖\n\n已接入 **MCP 协议** 与三阶魔方求解引擎，为你提供：\n• **新手层先法（LBL）** 分步伴学\n• **CFOP 进阶速拧** 还原指导\n• **Kociemba 最优解** 极速求解\n\n💡 点击右上角 `⚙️ 设置` 可配置或切换您的大模型 API。你可以随时向我提问或点击下方快捷指令开始！",
      emotionId: "10",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  // Fetch initial config from backend
  const loadConfig = async () => {
    try {
      let resp = await fetch("/api/agent/config").catch(() => null);
      if (!resp || !resp.ok) {
        resp = await fetch("http://localhost:8000/api/agent/config").catch(() => null);
      }
      if (resp && resp.ok) {
        const data = await resp.json();
        if (data.llm_api_key) setApiKey(data.llm_api_key);
        if (data.llm_base_url) {
          setBaseUrl(data.llm_base_url);
          const found = (Object.keys(PROVIDER_CONFIGS) as LLMProvider[]).find(
            (k) => k !== "custom" && data.llm_base_url.includes(PROVIDER_CONFIGS[k].baseUrl)
          );
          if (found) {
            setProvider(found);
            setAvailableModels(PROVIDER_CONFIGS[found].defaultModels);
          } else {
            setProvider("custom");
          }
        }
        if (data.llm_model) setModelName(data.llm_model);
      }
    } catch {}
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (open) {
      scrollToBottom();
    }
  }, [messages, open]);

  // When cube reaches solved state, trigger celebration
  useEffect(() => {
    if (isSolved) {
      setEmotion("33");
      setStatusText("复原完成 🎉");
      avatarRef.current?.burst(30);
      avatarRef.current?.spin(3);
    }
  }, [isSolved]);

  const playTTS = async (text: string) => {
    if (!ttsEnabled) return;
    try {
      const resp = await fetch(`/api/tts?text=${encodeURIComponent(text.slice(0, 100))}`);
      if (resp.ok && resp.status === 200) {
        const blob = await resp.blob();
        const audio = new Audio(URL.createObjectURL(blob));
        audio.play().catch(() => {});
      }
    } catch {}
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: "init-" + Date.now(),
        role: "agent",
        content: "对话已重置。请问有什么可以帮助你的吗？随时点击下方快捷指令开始教学！",
        emotionId: "02",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setEmotion("02");
    setStatusText("待机中");
  };

  // Provider change handler
  const handleProviderChange = (newProvider: LLMProvider) => {
    setProvider(newProvider);
    if (newProvider !== "custom") {
      const p = PROVIDER_CONFIGS[newProvider];
      setBaseUrl(p.baseUrl);
      setAvailableModels(p.defaultModels);
    } else {
      setBaseUrl("");
      setAvailableModels([]);
    }
    setTestResult(null);
  };

  // Auto-detect available models from provider with Cherry Studio 3-tier fallback
  const handleDetectModels = async () => {
    setDetectingModels(true);
    setTestResult(null);
    try {
      const body = JSON.stringify({
        llm_base_url: baseUrl,
        llm_api_key: apiKey,
      });

      let resp = await fetch("/api/agent/list_models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      }).catch(() => null);

      if (!resp || !resp.ok) {
        resp = await fetch("http://localhost:8000/api/agent/list_models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        }).catch(() => null);
      }

      if (resp && resp.ok) {
        const data = await resp.json();
        if (data.ok && Array.isArray(data.models) && data.models.length > 0) {
          setAvailableModels(data.models);
          setModelPickerOpen(true);
          return;
        }
      }

      // Fallback to built-in provider model list (Cherry Studio Tier 1)
      const fallbackList = PROVIDER_CONFIGS[provider]?.defaultModels || [];
      if (fallbackList.length > 0) {
        setAvailableModels(fallbackList);
        setModelPickerOpen(true);
      } else {
        setTestResult({
          ok: false,
          msg: "未检测到模型列表，请直接在下方输入框手动填写模型名称",
        });
      }
    } catch {
      const fallbackList = PROVIDER_CONFIGS[provider]?.defaultModels || [];
      if (fallbackList.length > 0) {
        setAvailableModels(fallbackList);
        setModelPickerOpen(true);
      }
    } finally {
      setDetectingModels(false);
    }
  };

  // Live Test LLM Connection
  const handleTestLlm = async () => {
    if (!apiKey.trim()) {
      setTestResult({ ok: false, msg: "请先填写 API Key" });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const body = JSON.stringify({
        llm_base_url: baseUrl,
        llm_api_key: apiKey,
        llm_model: modelName,
      });
      let resp = await fetch("/api/agent/test_llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      }).catch(() => null);

      if (!resp || !resp.ok) {
        resp = await fetch("http://localhost:8000/api/agent/test_llm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        }).catch(() => null);
      }

      if (resp && resp.ok) {
        const data = await resp.json();
        if (data.ok) {
          setTestResult({ ok: true, msg: `连接成功！模型响应: "${data.reply}"` });
        } else {
          setTestResult({ ok: false, msg: `连接失败: ${data.error}` });
        }
      } else {
        setTestResult({ ok: false, msg: `服务响应错误 (${resp?.status || "网络异常"})` });
      }
    } catch (e: any) {
      setTestResult({ ok: false, msg: `请求异常: ${e.message || e}` });
    } finally {
      setTesting(false);
    }
  };

  // Save Config to Backend (.env & memory)
  const handleSaveConfig = async () => {
    setSaving(true);
    setSavedSuccess(false);
    try {
      const body = JSON.stringify({
        llm_base_url: baseUrl,
        llm_api_key: apiKey,
        llm_model: modelName,
      });

      let resp = await fetch("/api/agent/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      }).catch(() => null);

      if (!resp || !resp.ok) {
        resp = await fetch("http://localhost:8000/api/agent/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
      }

      if (resp && resp.ok) {
        setSavedSuccess(true);
        setTimeout(() => {
          setSavedSuccess(false);
          setSettingsOpen(false);
        }, 1200);
      }
    } catch (e: any) {
      alert("保存失败: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async (customMsg?: string) => {
    const userText = (customMsg || input).trim();
    if (!userText || loading) return;

    if (!customMsg) setInput("");

    const userMsgObj: ChatMessage = {
      id: "u-" + Date.now(),
      role: "user",
      content: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const agentMsgId = "a-" + Date.now();
    const initialAgentMsgObj: ChatMessage = {
      id: agentMsgId,
      role: "agent",
      content: "",
      emotionId: "30",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsgObj, initialAgentMsgObj]);
    setLoading(true);
    setEmotion("30"); // 思考中
    setStatusText("AI 思考中...");

    try {
      const facelets = getCubeState ? getCubeState() : undefined;
      const reqBody = JSON.stringify({
        message: userText,
        facelets,
        method,
      });

      let resp = await fetch("/api/agent/stream_chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: reqBody,
      }).catch(() => null);

      if (!resp || !resp.ok) {
        resp = await fetch("http://localhost:8000/api/agent/stream_chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: reqBody,
        });
      }

      if (!resp.ok || !resp.body) {
        throw new Error(`服务响应错误 (${resp?.status || "网络连接异常"})`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let accumulatedText = "";
      let accumulatedReasoning = "";
      let finalEmotion = "02";
      let toolCalls: string[] | undefined = undefined;
      let solution: any = undefined;
      let buffer = "";

      setStatusText("生成中...");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const dataStr = trimmed.slice(6);
          try {
            const data = JSON.parse(dataStr);
            if (data.type === "start") {
              if (data.emotionId) {
                finalEmotion = data.emotionId;
                setEmotion(data.emotionId);
              }
              if (data.tool_calls) {
                toolCalls = data.tool_calls;
              }
              if (data.solution) {
                solution = data.solution;
                if (onApplySolution) {
                  onApplySolution(data.solution);
                }
              }
              if (finalEmotion === "34") {
                setStatusText("教学讲解中 🎓");
              } else if (finalEmotion === "32") {
                setStatusText("状态异常 ⚠️");
              }
            } else if (data.type === "reasoning") {
              accumulatedReasoning += data.chunk;
              setStatusText("深度思考中 💭");
              setEmotion("30");
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentMsgId
                    ? {
                        ...m,
                        content: accumulatedText,
                        reasoning: accumulatedReasoning,
                        emotionId: "30",
                        toolCalls,
                        solution,
                      }
                    : m
                )
              );
            } else if (data.type === "token") {
              accumulatedText += data.chunk;
              setStatusText("生成回答中...");
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentMsgId
                    ? {
                        ...m,
                        content: accumulatedText,
                        reasoning: accumulatedReasoning,
                        emotionId: finalEmotion,
                        toolCalls,
                        solution,
                      }
                    : m
                )
              );
            }
          } catch {}
        }
      }

      setEmotion(finalEmotion);
      setStatusText(finalEmotion === "34" ? "教学讲解中 🎓" : "就绪");

      if (accumulatedText) {
        playTTS(accumulatedText.split("\n")[0]);
      }
    } catch (e: any) {
      setEmotion("32");
      setStatusText("连接错误");
      setMessages((prev) =>
        prev.map((m) =>
          m.id === agentMsgId
            ? {
                ...m,
                content: `抱歉，请求后端 Agent 服务时发生错误：${e.message || e}。请确认 FastAPI 后端已正常运行。`,
                emotionId: "32",
              }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  };

  // Filter models in search modal
  const filteredModels = availableModels.filter((m) =>
    m.toLowerCase().includes(modelSearch.toLowerCase().trim())
  );

  // Vertical dragging along right edge
  const handleTriggerPointerDown = (e: React.PointerEvent) => {
    isDraggingTriggerRef.current = true;
    hasMovedTriggerRef.current = false;
    dragStartTriggerRef.current = {
      startY: e.clientY,
      initialTop: triggerTop,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleTriggerPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingTriggerRef.current) return;
    const dy = e.clientY - dragStartTriggerRef.current.startY;
    if (Math.abs(dy) > 3) {
      hasMovedTriggerRef.current = true;
    }
    const newTop = Math.max(50, Math.min(window.innerHeight - 70, dragStartTriggerRef.current.initialTop + dy));
    setTriggerTop(newTop);
  };

  const handleTriggerPointerUp = (e: React.PointerEvent) => {
    if (isDraggingTriggerRef.current) {
      isDraggingTriggerRef.current = false;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      localStorage.setItem("chat-trigger-top", triggerTop.toString());
      if (!hasMovedTriggerRef.current) {
        onToggle(true);
      }
    }
  };

  return (
    <>
      {/* Edge-Docked Peeking Pet Avatar on the Right Edge (No text, pure avatar) */}
      {!open && (
        <div
          className="chat-edge-avatar-pet"
          style={{
            top: `${triggerTop}px`,
          }}
          onPointerDown={handleTriggerPointerDown}
          onPointerMove={handleTriggerPointerMove}
          onPointerUp={handleTriggerPointerUp}
          title="点击展开魔方助手 (按住可上下滑动)"
        >
          <EmotionBallAvatar emotion={emotion} size={38} interactive={true} staticMode={false} />
        </div>
      )}

      {/* Main PyCharm Style Docked Right Sidebar */}
      <aside
        className={`chat-panel ${open ? "open" : "closed"}`}
        aria-label="魔方助手侧边栏"
        style={{ width: `${panelWidth}px` }}
      >
        {/* Left Border Draggable Resize Handle */}
        <div
          className="chat-panel-resize-handle"
          onMouseDown={handleResizeMouseDown}
          title="按住左侧边框拖拽调整宽度"
        >
          <div className="resize-handle-indicator" />
        </div>

        {/* Header */}
        <header className="chat-header">
          <div className="chat-avatar-wrapper" onClick={() => avatarRef.current?.spin(2)}>
            <EmotionBallAvatar
              ref={avatarRef}
              emotion={emotion}
              size={44}
              interactive={true}
              staticMode={false}
            />
          </div>
          <div className="chat-header-info">
            <div className="chat-title-row">
              <strong>魔方助手</strong>
              <span className={`chat-status-pill ${loading ? "loading" : ""}`}>
                {statusText}
              </span>
            </div>
            <p className="chat-subtitle">基于 MCP 协议 · 三阶智能教学</p>
          </div>
          <div className="chat-header-actions">
            <button
              className="icon-btn"
              title="大模型 API 配置"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings size={16} />
            </button>
            <button
              className={`icon-btn ${ttsEnabled ? "active" : ""}`}
              title={ttsEnabled ? "关闭语音伴读" : "开启语音伴读"}
              onClick={() => setTtsEnabled(!ttsEnabled)}
            >
              {ttsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button
              className="icon-btn"
              title="收起侧边栏"
              onClick={() => onToggle(false)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </header>

        {/* Messages Stream */}
        <div className="chat-messages">
          {messages.map((m, idx) => {
            const isLatestAgent = idx === messages.length - 1;
            return (
              <div key={m.id} className={`chat-bubble-row ${m.role}`}>
                {m.role === "agent" && (
                  <div className="bubble-avatar">
                    <EmotionBallAvatar
                      emotion={m.emotionId || "02"}
                      size={26}
                      interactive={false}
                      staticMode={!isLatestAgent || loading}
                    />
                  </div>
                )}
                <div className="bubble-content">
                  {/* MCP Tool Call Trace (Mainstream Agent Style) */}
                  {m.toolCalls && m.toolCalls.length > 0 && (
                    <div className="mcp-agent-section">
                      <button
                        type="button"
                        className="mcp-agent-toggle"
                        onClick={() => toggleMcp(m.id)}
                      >
                        <span className="mcp-summary-text">已调用 {m.toolCalls.length} 次 MCP</span>
                        <ChevronDown
                          size={13}
                          className={`mcp-arrow ${expandedMcp[m.id] ? "open" : ""}`}
                        />
                      </button>
                      {expandedMcp[m.id] && (
                        <div className="mcp-agent-list">
                          {m.toolCalls.map((t, tIdx) => (
                            <div key={tIdx} className="mcp-agent-item">
                              <Wrench size={13} className="mcp-wrench-icon" />
                              <span className="mcp-item-text">
                                调用 <span className="mcp-path">mcp.cubetutor / {t}</span>
                              </span>
                              <ChevronRight size={12} className="mcp-item-arrow" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* DeepSeek R1 Style Live Thought Process Card (Default Collapsed) */}
                  {m.reasoning && (
                    <div className="thought-card">
                      <button
                        type="button"
                        className="thought-toggle-bar"
                        onClick={() => toggleThought(m.id)}
                      >
                        <Sparkles
                          size={12}
                          className={loading && isLatestAgent && !m.content ? "pulse-anim" : ""}
                        />
                        <span className="thought-label">
                          {loading && isLatestAgent && !m.content ? "正在深度思考..." : "深度思考过程"}
                        </span>
                        <ChevronDown
                          size={13}
                          className={`thought-arrow ${expandedThoughts[m.id] ? "open" : ""}`}
                        />
                      </button>
                      {expandedThoughts[m.id] && (
                        <div className="thought-body">
                          <div className="thought-text">{m.reasoning}</div>
                          {loading && isLatestAgent && !m.content && (
                            <span className="typing-cursor">▌</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Message Content Bubble (Only rendered if text exists, avoids flat empty strip) */}
                  {m.content ? (
                    <div className="bubble-text">
                      <FormattedMarkdownText text={m.content} />
                      {loading && isLatestAgent && <span className="typing-cursor">▌</span>}
                    </div>
                  ) : !m.reasoning ? (
                    <div className="bubble-text">
                      <div className="thinking-dots">
                        <span>AI 思考中</span>
                        <span className="dots">...</span>
                      </div>
                    </div>
                  ) : null}

                  <span className="bubble-time">{m.timestamp}</span>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts Bar */}
        <div className="chat-quick-bar">
          <button onClick={() => handleSend("帮我用新手层先法还原魔方")}>
            <Wand2 size={13} />
            新手教学
          </button>
          <button onClick={() => handleSend("用 CFOP 进阶法求解")}>
            <Sparkles size={13} />
            CFOP速拧
          </button>
          <button onClick={() => handleSend("检查当前魔方状态合法性")}>
            <CheckCircle2 size={13} />
            检查合法性
          </button>
        </div>

        {/* Input Footer */}
        <footer className="chat-footer">
          <input
            type="text"
            placeholder="输入问题或发送还原指令..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button
            className="send-btn"
            disabled={!input.trim() || loading}
            onClick={() => handleSend()}
            title="发送消息"
          >
            <Send size={16} />
          </button>
        </footer>

        {/* API Settings Modal / Drawer */}
        {settingsOpen && (
          <div className="chat-settings-overlay">
            <div className="chat-settings-modal">
              <div className="settings-modal-header">
                <div className="settings-title">
                  <KeyRound size={18} />
                  <strong>大模型 API 配置</strong>
                </div>
                <button className="icon-btn" onClick={() => setSettingsOpen(false)}>
                  <X size={16} />
                </button>
              </div>

              <div className="settings-modal-body">
                {/* Provider Selector Dropdown */}
                <div className="settings-field">
                  <label>大模型提供商 (Provider)：</label>
                  <select
                    className="provider-select"
                    value={provider}
                    onChange={(e) => handleProviderChange(e.target.value as LLMProvider)}
                  >
                    {Object.entries(PROVIDER_CONFIGS).map(([key, item]) => (
                      <option key={key} value={key}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* API Key */}
                <div className="settings-field">
                  <label>API Key (必填)：</label>
                  <div className="input-with-action">
                    <input
                      type={showApiKey ? "text" : "password"}
                      placeholder={PROVIDER_CONFIGS[provider]?.placeholderKey || "sk-xxxxxxxxxxxxxxxxxxxxxxxx"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                    <button
                      type="button"
                      className="icon-sub-btn"
                      onClick={() => setShowApiKey(!showApiKey)}
                      title={showApiKey ? "隐藏 Key" : "显示 Key"}
                    >
                      {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Base URL */}
                <div className="settings-field">
                  <label>Base URL 接口地址：</label>
                  <input
                    type="text"
                    placeholder={
                      provider === "custom"
                        ? "请输入自定义 Base URL (例如 https://api.xxx.com/v1)"
                        : PROVIDER_CONFIGS[provider]?.baseUrl || "https://api.deepseek.com/v1"
                    }
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                  />
                </div>

                {/* Model */}
                <div className="settings-field">
                  <div className="field-label-row">
                    <label>Model 模型名称：</label>
                    <button
                      type="button"
                      className="detect-btn"
                      disabled={detectingModels}
                      onClick={handleDetectModels}
                      title="向大模型服务商查询支持的所有可用模型列表并打开选择弹窗"
                    >
                      <RefreshCw size={11} className={detectingModels ? "spin" : ""} />
                      <span>{detectingModels ? "获取中..." : "获取模型列表"}</span>
                    </button>
                  </div>

                  <input
                    type="text"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                  />
                </div>

                {/* Test / Info Message Banner */}
                {testResult && (
                  <div className={`test-result-banner ${testResult.ok ? "success" : "error"}`}>
                    {testResult.ok ? <Check size={14} /> : <X size={14} />}
                    <span>{testResult.msg}</span>
                  </div>
                )}
              </div>

              <div className="settings-modal-footer">
                <button
                  type="button"
                  className="test-btn"
                  disabled={testing}
                  onClick={handleTestLlm}
                >
                  <Zap size={14} />
                  {testing ? "测试中..." : "测试连接"}
                </button>
                <button
                  type="button"
                  className="save-btn"
                  disabled={saving}
                  onClick={handleSaveConfig}
                >
                  {savedSuccess ? "已写入后端!" : saving ? "保存中..." : "保存写入后端"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 额外独立弹出的模型选择器 (Searchable Model Picker Modal) */}
        {modelPickerOpen && (
          <div className="chat-settings-overlay model-picker-overlay">
            <div className="chat-settings-modal model-picker-modal">
              <div className="settings-modal-header">
                <div className="settings-title">
                  <ListFilter size={18} />
                  <strong>选择模型 ({availableModels.length} 个可用)</strong>
                </div>
                <button className="icon-btn" onClick={() => setModelPickerOpen(false)}>
                  <X size={16} />
                </button>
              </div>

              <div className="model-picker-search-bar">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  placeholder="搜索模型 (如 deepseek, gpt-4o, claude, qwen...)"
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                  autoFocus
                />
                {modelSearch && (
                  <button className="clear-search-btn" onClick={() => setModelSearch("")}>
                    <X size={12} />
                  </button>
                )}
              </div>

              <div className="model-picker-list">
                {filteredModels.length > 0 ? (
                  filteredModels.map((mod) => (
                    <div
                      key={mod}
                      className={`model-picker-item ${modelName === mod ? "selected" : ""}`}
                      onClick={() => {
                        setModelName(mod);
                        setModelPickerOpen(false);
                      }}
                    >
                      <span className="model-picker-name">{mod}</span>
                      {modelName === mod && <Check size={14} className="model-picker-check" />}
                    </div>
                  ))
                ) : (
                  <div className="model-picker-empty">未匹配到包含 “{modelSearch}” 的模型</div>
                )}
              </div>

              <div className="settings-modal-footer">
                <span className="picker-count-hint">
                  共 {filteredModels.length} 个匹配项
                </span>
                <button
                  type="button"
                  className="test-btn"
                  onClick={() => setModelPickerOpen(false)}
                >
                  确定关闭
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
