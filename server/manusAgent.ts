import { ENV } from "./_core/env";

type AgentMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type AgentEvent = {
  event_type?: string;
  message_type?: string;
  assistant_message?: { content?: string };
  status_update?: {
    agent_status?: string;
    status_detail?: {
      waiting_for_event_id?: string;
      waiting_for_event_type?: string;
      waiting_description?: string;
      confirm_input_schema?: Record<string, unknown>;
    };
  };
  error_message?: { content?: string };
  user_message?: { content?: string };
};
type WaitingDetail = NonNullable<
  NonNullable<AgentEvent["status_update"]>["status_detail"]
>;

const tasks = new Map<number, string>();
const API_URL = "https://api.manus.ai/v2";

function requireKey() {
  if (!ENV.manusApiKey) {
    throw new Error("Manus Agent is not configured on this server");
  }
  return ENV.manusApiKey;
}

async function manusRequest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-manus-api-key": requireKey(),
      ...(init.headers ?? {}),
    },
  });
  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok || data.ok === false) {
    const error = data.error as { message?: string } | undefined;
    throw new Error(error?.message || "Manus Agent request failed");
  }
  return data;
}

function taskPrompt(message: string) {
  return [
    "You are the Goldpos in-app Manus Agent.",
    "The user is asking you to improve the Goldpos repository and its Hostinger VPS deployment.",
    "Work carefully and explain what you changed in Burmese when practical.",
    "For code changes: inspect the repository, test the change, and report the exact files and validation.",
    "NEVER deploy to the VPS automatically after a code change. Before every VPS deployment, pause with a deployAction confirmation so the app can ask the user: 'VPS server မှာ update တင်မလား?'.",
    "Do not expose secrets, SSH private keys, API keys, or passwords in your response.",
    `User request: ${message}`,
  ].join("\n\n");
}

export async function startAgentTask(userId: number, message: string) {
  const result = await manusRequest("/task.create", {
    method: "POST",
    body: JSON.stringify({
      message: { content: taskPrompt(message) },
      title: "Goldpos App Agent",
      interactive_mode: true,
      hide_in_task_list: true,
      share_visibility: "private",
      agent_profile: "manus-1.6",
    }),
  });
  const taskId = String(result.task_id ?? "");
  if (!taskId) throw new Error("Manus Agent did not return a task id");
  tasks.set(userId, taskId);
  return { taskId, taskUrl: result.task_url ?? null };
}

export async function sendAgentMessage(userId: number, message: string) {
  const taskId = tasks.get(userId);
  if (!taskId) return startAgentTask(userId, message);
  await manusRequest("/task.sendMessage", {
    method: "POST",
    body: JSON.stringify({
      task_id: taskId,
      message: { content: message },
    }),
  });
  return { taskId };
}

export async function getAgentMessages(userId: number) {
  const taskId = tasks.get(userId);
  if (!taskId) return { taskId: null, messages: [], status: "idle" };
  const result = await manusRequest(
    `/task.listMessages?task_id=${encodeURIComponent(taskId)}&order=asc&limit=200&verbose=false`
  );
  const events = (result.messages ?? []) as AgentEvent[];
  const messages: AgentMessage[] = [];
  let status = "running";
  let waiting: WaitingDetail | null = null;
  for (const event of events) {
    const assistant = event.assistant_message?.content;
    if (assistant) messages.push({ role: "assistant", content: assistant });
    const user = event.user_message?.content;
    if (user) messages.push({ role: "user", content: user });
    if (event.error_message?.content) {
      messages.push({
        role: "assistant",
        content: `Agent အမှား: ${event.error_message.content}`,
      });
      status = "error";
    }
    if (event.status_update) {
      status = event.status_update.agent_status ?? status;
      if (status === "waiting")
        waiting = event.status_update.status_detail ?? null;
    }
  }
  return { taskId, messages, status, waiting };
}

export async function confirmAgentAction(
  userId: number,
  eventId: string,
  input: Record<string, unknown>
) {
  const taskId = tasks.get(userId);
  if (!taskId) throw new Error("Agent task မရှိသေးပါ");
  await manusRequest("/task.confirmAction", {
    method: "POST",
    body: JSON.stringify({ task_id: taskId, event_id: eventId, input }),
  });
  return { taskId };
}
