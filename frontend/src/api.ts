// 后端 API 封装 + 类型定义

export interface ScriptSummary {
  id: number;
  title: string;
  description: string;
  source_file: string;
}

export interface CharacterSummary {
  name: string;
  public_identity: string;
}

export interface Location {
  name: string;
  area: string;
  description: string;
}

export interface ScriptDetail {
  id: number;
  title: string;
  description: string;
  characters: CharacterSummary[];
  locations: Location[];
}

export interface ClueCard {
  id: string;
  category: string;
  content: string;
}

export interface PlayerView {
  name: string;
  public_identity: string;
  secret: string;
  goal: string;
}

export interface StartResponse {
  session_id: string;
  opening: string;
  player_view: PlayerView;
}

export interface AccuseResponse {
  correct: boolean;
  truth_culprit: string;
  replay: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const BASE = "/api";

async function post<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(detail || resp.statusText);
  }
  return resp.json();
}

export async function listScripts(): Promise<ScriptSummary[]> {
  const resp = await fetch(BASE + "/scripts");
  if (!resp.ok) throw new Error("加载剧本列表失败");
  return resp.json();
}

export async function getScript(id: number): Promise<ScriptDetail> {
  const resp = await fetch(`${BASE}/scripts/${id}`);
  if (!resp.ok) throw new Error("加载剧本详情失败");
  return resp.json();
}

export function startGame(scriptId: number, character: string): Promise<StartResponse> {
  return post("/game/start", { script_id: scriptId, character });
}

export async function getClues(sessionId: string): Promise<ClueCard[]> {
  const resp = await fetch(`${BASE}/game/${sessionId}/clues`);
  if (!resp.ok) throw new Error("加载线索失败");
  return resp.json();
}

export function accuse(
  sessionId: string,
  culprit: string,
  method: string,
  motive: string,
): Promise<AccuseResponse> {
  return post("/game/accuse", { session_id: sessionId, culprit, method, motive });
}

// 流式读取后端响应，逐段回调 onChunk，返回完整文本
export async function sendMessage(
  sessionId: string,
  message: string,
  onChunk: (text: string) => void,
): Promise<string> {
  const resp = await fetch(BASE + "/game/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, message }),
  });
  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(detail || "发送失败");
  }
  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    full += text;
    onChunk(text);
  }
  full += decoder.decode(); // flush 残余多字节序列
  return full;
}
