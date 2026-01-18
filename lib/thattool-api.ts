import { env } from "@/lib/env";

export type Pagination = {
  limit?: number;
  offset?: number;
};

export type Project = {
  id: number;
  projectName: string;
  owner: string;
  repo: string;
  enabled: boolean;
  defaultModel: string;
  defaultBaseBranch: string;
  projectSpecification?: string | null;
  shouldHaveMemories: boolean;
  shouldOverwriteMemories: boolean;
  maxLLMRetries: number;
  maxChainedPRs: number;
};

export type CreateManualSubtaskRequest =
  | {
      mode: "new_task";
      projectId: string | number;
      prompt: string;
      modelName?: string;
    }
  | {
      mode: "existing_task";
      taskId: number;
      prompt: string;
      modelName?: string;
    };

export type UpdateProjectRequest = {
  owner: string;
  repo: string;
  projectName?: string;
  defaultBaseBranch?: string;
  defaultModel?: string;
  projectSpecification?: string;
  enabled?: boolean;
  shouldHaveMemories?: boolean;
  shouldOverwriteMemories?: boolean;
  maxLLMRetries?: number;
  maxChainedPRs?: number;
};

export type Task = {
  id: number;
  status: string;
  type: string;
};

export type Subtask = {
  id: number;
  taskId: number;
  status: string;
};

type ApiSuccess<T> = T & { success?: boolean };

type FetchOptions = {
  token?: string;
  method?: "GET" | "POST";
  body?: unknown;
};

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const url = new URL(path, env.NEXT_PUBLIC_LLM_BASE_URL);
  console.log(options.body);
  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text}`);
  }

  console.log(res);

  return (await res.json()) as T;
}

export const thattoolApi = {
  updateProject(token: string, body: UpdateProjectRequest) {
    return apiFetch<ApiSuccess<{ success: boolean }>>("/task/update-project", {
      token,
      method: "POST",
      body,
    });
  },

  createManualSubtask(token: string, body: CreateManualSubtaskRequest) {
    console.log("Creating manual subtask with body:", body);
    return apiFetch<ApiSuccess<{ task: unknown; subtask: unknown }>>(
      "/manual/subtask",
      {
        token,
        method: "POST",
        body,
      },
    );
  },

  listProjects(token: string, pagination: Pagination = {}) {
    const query = new URLSearchParams();
    if (pagination.limit != null) query.set("limit", String(pagination.limit));
    if (pagination.offset != null)
      query.set("offset", String(pagination.offset));

    const suffix = query.size ? `?${query.toString()}` : "";
    return apiFetch<ApiSuccess<{ projects: Project[] }>>(
      `/task/projects${suffix}`,
      { token },
    );
  },

  listProjectTasks(
    token: string,
    projectId: number,
    pagination: Pagination = {},
  ) {
    const query = new URLSearchParams();
    if (pagination.limit != null) query.set("limit", String(pagination.limit));
    if (pagination.offset != null)
      query.set("offset", String(pagination.offset));

    const suffix = query.size ? `?${query.toString()}` : "";
    return apiFetch<ApiSuccess<{ tasks: Array<{ task: Task }> }>>(
      `/task/projects/${projectId}/tasks${suffix}`,
      { token },
    );
  },

  listProjectSubtasks(
    token: string,
    projectId: number,
    pagination: Pagination = {},
  ) {
    const query = new URLSearchParams();
    if (pagination.limit != null) query.set("limit", String(pagination.limit));
    if (pagination.offset != null)
      query.set("offset", String(pagination.offset));

    const suffix = query.size ? `?${query.toString()}` : "";
    return apiFetch<ApiSuccess<{ subtasks: Array<{ subtask: Subtask }> }>>(
      `/task/projects/${projectId}/subtasks${suffix}`,
      { token },
    );
  },

  streamTaskLogsUrl(taskId: number, subtaskId: number, token: string) {
    const url = new URL(
      `/task/${taskId}/logs/stream`,
      env.NEXT_PUBLIC_LLM_BASE_URL,
    );
    url.searchParams.set("subtaskId", String(subtaskId));
    url.searchParams.set("token", token);
    return url.toString();
  },

  streamProjectEventsUrl(projectId: number | string, token: string) {
    const url = new URL(`/task/events/stream`, env.NEXT_PUBLIC_LLM_BASE_URL);
    url.searchParams.set("projectId", String(projectId));
    url.searchParams.set("token", token);
    return url.toString();
  },

  stopTask(token: string, taskId: number) {
    return apiFetch<ApiSuccess<{ success: boolean }>>(`/task/stop`, {
      token,
      method: "POST",
      body: { taskId },
    });
  },

  deleteTask(token: string, taskId: number) {
    return apiFetch<ApiSuccess<{ success: boolean }>>(`/task/delete`, {
      token,
      method: "POST",
      body: { taskId },
    });
  },

  restartTask(token: string, taskId: number) {
    return apiFetch<ApiSuccess<{ success: boolean }>>(`/task/restart`, {
      token,
      method: "POST",
      body: { taskId },
    });
  },
};
