"use client";

import { useEffect, useMemo, useState } from "react";

import { env } from "@/lib/env";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  thattoolApi,
  type Project,
  type Subtask,
  type Task,
} from "@/lib/thattool-api";

function statusVariant(status: string): "default" | "secondary" | "destructive" {
  if (status === "error") return "destructive";
  if (status === "complete") return "secondary";
  return "default";
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={statusVariant(status)} className="capitalize">
      {status}
    </Badge>
  );
}

type MonitorProps = {
  token: string;
};

export function Monitor({ token }: MonitorProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const [tasks, setTasks] = useState<Task[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);

  const [projectConfigOpen, setProjectConfigOpen] = useState(false);
  const [projectConfigPending, setProjectConfigPending] = useState(false);
  const [projectConfigError, setProjectConfigError] = useState<string | null>(null);
  const [projectConfigDraft, setProjectConfigDraft] = useState<{
    defaultModel: string;
    defaultBaseBranch: string;
    shouldHaveMemories: boolean;
    shouldOverwriteMemories: boolean;
    maxLLMRetries: number;
    maxChainedPRs: number;
    projectSpecification: string;
  } | null>(null);

  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [selectedSubtaskId, setSelectedSubtaskId] = useState<number | null>(null);

   const selectedTask = useMemo(
     () => tasks.find((t) => t.id === selectedTaskId) ?? null,
     [tasks, selectedTaskId],
   );

  async function stopSelectedTask() {
    if (!selectedTask) return;
    await thattoolApi.stopTask(token, selectedTask.id);
  }

  async function deleteSelectedTask() {
    if (!selectedTask) return;
    await thattoolApi.deleteTask(token, selectedTask.id);
    setSelectedTaskId(null);
    setSelectedSubtaskId(null);
    setLogs(defaultLogsMessage);
  }

  async function restartSelectedTask() {
    if (!selectedTask) return;
    await thattoolApi.restartTask(token, selectedTask.id);
  }


   const selectedSubtask = useMemo(
     () => subtasks.find((s) => s.id === selectedSubtaskId) ?? null,
     [subtasks, selectedSubtaskId],
   );

   useEffect(() => {
     // Keep the selection valid when SSE updates replace the list.
     if (!selectedSubtaskId) return;
     if (selectedSubtask) return;
     setSelectedSubtaskId(null);
   }, [selectedSubtaskId, selectedSubtask]);

   const logsTarget = useMemo(() => {
     if (selectedSubtaskId) {
       const subtask = subtasks.find((s) => s.id === selectedSubtaskId) ?? null;
       const taskId = selectedTask?.id ?? subtask?.taskId ?? null;
       return taskId && subtask ? { mode: "subtask" as const, taskId, subtask } : null;
     }

     if (selectedTask) {
       return { mode: "task" as const, taskId: selectedTask.id };
     }

     return null;
   }, [selectedSubtaskId, subtasks, selectedTask]);

   const defaultLogsMessage =
     "Select a task or a running/pending subtask to view logs.";


   const selectedProjectAvailable = Boolean(selectedProject && selectedProject.enabled);

   const [logs, setLogs] = useState<string>(defaultLogsMessage);

  const [manualOpen, setManualOpen] = useState(false);
  const [manualMode, setManualMode] = useState<"new_task" | "existing_task">(
    "new_task",
  );
  const [manualTaskId, setManualTaskId] = useState<number | null>(null);
  const [manualPrompt, setManualPrompt] = useState("");
  const [manualPending, setManualPending] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  async function refreshProjects(keepSelection = false) {
    const res = await thattoolApi.listProjects(token);
    const nextProjects = res.projects ?? [];
    setProjects(nextProjects);

    if (!keepSelection) {
      setSelectedProjectId(null);
      setSelectedTaskId(null);
      setSelectedSubtaskId(null);
      setTasks([]);
      setSubtasks([]);
      setLogs(defaultLogsMessage);
      return;
    }

    setSelectedProjectId((prev) => {
      if (!prev) return prev;
      const stillExists = nextProjects.some((p) => p.id === prev);
      return stillExists ? prev : null;
    });
  }

  async function loadTasks(projectId: number) {
    const res = await thattoolApi.listProjectTasks(token, projectId);
    setTasks((res.tasks ?? []).map((t) => t.task));
  }

  async function loadSubtasks(projectId: number) {
    const res = await thattoolApi.listProjectSubtasks(token, projectId);
    setSubtasks((res.subtasks ?? []).map((s) => s.subtask));
  }

  useEffect(() => {
    refreshProjects().catch(() => {
      setLogs("Failed to load projects. Are you authenticated?");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedProject) {
      setProjectConfigDraft(null);
      setProjectConfigOpen(false);
      setProjectConfigError(null);
      return;
    }

    setProjectConfigDraft({
      defaultModel: selectedProject.defaultModel,
      defaultBaseBranch: selectedProject.defaultBaseBranch,
      shouldHaveMemories: selectedProject.shouldHaveMemories,
      shouldOverwriteMemories: selectedProject.shouldOverwriteMemories,
      maxLLMRetries: selectedProject.maxLLMRetries,
      maxChainedPRs: selectedProject.maxChainedPRs,
      projectSpecification: selectedProject.projectSpecification ?? "",
    });
    setProjectConfigError(null);
  }, [selectedProject]);

  useEffect(() => {
    if (!selectedProjectId) return;
    setSelectedTaskId(null);
    setSelectedSubtaskId(null);
    setLogs(defaultLogsMessage);

    if (!selectedProjectAvailable) {
      setTasks([]);
      setSubtasks([]);
      return;
    }

    loadTasks(selectedProjectId).catch(() => null);
    loadSubtasks(selectedProjectId).catch(() => null);
    setManualTaskId(null);
    setManualPrompt("");
    setManualError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId, selectedProjectAvailable]);

  useEffect(() => {
    if (!selectedProjectId || !selectedProjectAvailable) return;

    const url = thattoolApi.streamProjectEventsUrl(selectedProjectId, token);
    const es = new EventSource(url);

    es.addEventListener("task", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as {
          id: number;
          status: string;
          type: string;
        };
        setTasks((prev) => {
          const next = [...prev];
          const idx = next.findIndex((t) => t.id === data.id);
          if (idx >= 0) next[idx] = { ...next[idx], status: data.status, type: data.type };
          else next.push({ id: data.id, status: data.status, type: data.type });
          return next;
        });
      } catch {
        // ignore
      }
    });

    es.addEventListener("subtask", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as {
          id: number;
          taskId: number;
          status: string;
        };
        setSubtasks((prev) => {
          const next = [...prev];
          const idx = next.findIndex((s) => s.id === data.id);
          if (idx >= 0)
            next[idx] = { ...next[idx], status: data.status, taskId: data.taskId };
          else next.push({ id: data.id, status: data.status, taskId: data.taskId });
          return next;
        });
      } catch {
        // ignore
      }
    });

    es.addEventListener("snapshot", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as {
          tasks: Task[];
          subtasks: Subtask[];
        };
        setTasks(data.tasks);
        setSubtasks(data.subtasks);
      } catch {
        // ignore
      }
    });

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
    };
  }, [selectedProjectId, selectedProjectAvailable, token]);

  useEffect(() => {
    if (!logsTarget || !selectedProject) return;

    if (logsTarget.mode === "subtask") {
      // if (logsTarget.subtask.status !== "running" && logsTarget.subtask.status !== "pending") {
      //   setLogs("Logs available only for running/pending subtasks.");
      //   return;
      // }
    }

    const url =
      logsTarget.mode === "subtask"
        ? thattoolApi.streamTaskLogsUrl(logsTarget.taskId, logsTarget.subtask.id, token)
        : (() => {
            // Task-mode: follow task.currentSubTaskId server-side.
            const base = new URL(`/task/${logsTarget.taskId}/logs/stream`, env.NEXT_PUBLIC_LLM_BASE_URL);
            base.searchParams.set("token", token);
            return base.toString();
          })();

    setLogs("");
    const es = new EventSource(url);
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as {
          logs?: string;
          chunk?: string;
          reset?: boolean;
          success?: boolean;
          error?: string;
        };

        if (data.success === false) {
          setLogs(data.error ?? "Log stream unavailable.");
          return;
        }

        // Backwards compatible with the previous behavior.
        if (typeof data.logs === "string") {
          setLogs(data.logs);
          return;
        }

        if (data.reset) {
          setLogs("");
        }

        if (typeof data.chunk === "string" && data.chunk.length) {
          setLogs((prev) => prev + data.chunk);
        }
      } catch {
        // ignore
      }
    };
    es.onerror = () => {
      setLogs((prev) => prev || "Log stream ended or unavailable.");
      es.close();
    };

    return () => {
      es.close();
    };
  }, [logsTarget, selectedProject, token]);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    window.location.href = "/login";
  }

  async function createManualSubtask() {
    if (!selectedProject) return;
    setManualPending(true);
    setManualError(null);

    try {
      if (manualMode === "new_task") {
        await thattoolApi.createManualSubtask(token, {
          mode: "new_task",
          projectId: selectedProject.id,
          prompt: manualPrompt,
        });
      } else {
        if (!manualTaskId) throw new Error("Pick a task to continue");
        await thattoolApi.createManualSubtask(token, {
          mode: "existing_task",
          taskId: manualTaskId,
          prompt: manualPrompt,
        });
      }

      setManualPrompt("");
      await loadTasks(selectedProject.id);
      await loadSubtasks(selectedProject.id);
    } catch (e) {
      console.error("Failed to create manual subtask:", e);
      setManualError(e instanceof Error ? e.message : "Failed to create subtask");
    } finally {
      setManualPending(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b px-6 py-4">
         <div>
           <h1 className="text-lg font-semibold">ThatTool Monitor</h1>
           <div className="flex flex-wrap items-center gap-2">
             <p className="text-sm text-muted-foreground">
               {selectedProject
                 ? `${selectedProject.projectName} (${selectedProject.owner}/${selectedProject.repo})`
                 : "Select a project"}
             </p>
             {selectedProject ? (
               <Badge variant={selectedProject.enabled ? "secondary" : "outline"}>
                 {selectedProject.enabled ? "Enabled" : "Disabled"}
               </Badge>
             ) : null}
           </div>
         </div>
         <div className="flex flex-wrap gap-2">
            {selectedProject ? (
              <Button
                variant={selectedProject.enabled ? "outline" : "secondary"}
                onClick={async () => {
                  await thattoolApi.updateProject(token, {
                    owner: selectedProject.owner,
                    repo: selectedProject.repo,
                    enabled: !selectedProject.enabled,
                  });
                  await refreshProjects(true);
                }}
              >
                {selectedProject.enabled ? "Disable" : "Enable"}
              </Button>
            ) : null}
            {selectedProject ? (
              <Button
                variant={projectConfigOpen ? "secondary" : "outline"}
                onClick={() => {
                  setProjectConfigOpen((v) => !v);
                  setProjectConfigError(null);
                }}
              >
                {projectConfigOpen ? "Hide config" : "Project config"}
              </Button>
            ) : null}
           <Button variant="secondary" onClick={() => refreshProjects(true)}>
             Refresh
           </Button>
           <Button variant="outline" onClick={() => signOut()}>
             Sign out
           </Button>
         </div>
       </header>

       {selectedProject && projectConfigOpen && projectConfigDraft ? (
         <div className="border-b px-6 py-4">
           <Card>
             <CardHeader>
               <CardTitle>Project configuration</CardTitle>
               <CardDescription>
                 Update defaults for {selectedProject.owner}/{selectedProject.repo}.
               </CardDescription>
             </CardHeader>
             <CardContent className="grid gap-4">
               <div className="grid gap-4 md:grid-cols-2">
                 <div className="grid gap-2">
                   <Label htmlFor="defaultModel">Default model</Label>
                   <Input
                     id="defaultModel"
                     value={projectConfigDraft.defaultModel}
                     onChange={(e) =>
                       setProjectConfigDraft((prev) =>
                         prev ? { ...prev, defaultModel: e.target.value } : prev,
                       )
                     }
                     disabled={projectConfigPending}
                   />
                 </div>

                 <div className="grid gap-2">
                   <Label htmlFor="defaultBaseBranch">Default base branch</Label>
                   <Input
                     id="defaultBaseBranch"
                     value={projectConfigDraft.defaultBaseBranch}
                     onChange={(e) =>
                       setProjectConfigDraft((prev) =>
                         prev ? { ...prev, defaultBaseBranch: e.target.value } : prev,
                       )
                     }
                     disabled={projectConfigPending}
                   />
                 </div>

                 <div className="grid gap-2">
                   <Label htmlFor="maxLLMRetries">Max LLM retries</Label>
                   <Input
                     id="maxLLMRetries"
                     type="number"
                     min={0}
                     max={20}
                     value={String(projectConfigDraft.maxLLMRetries)}
                     onChange={(e) =>
                       setProjectConfigDraft((prev) =>
                         prev
                           ? {
                               ...prev,
                               maxLLMRetries: Number(e.target.value),
                             }
                           : prev,
                       )
                     }
                     disabled={projectConfigPending}
                   />
                 </div>

                 <div className="grid gap-2">
                   <Label htmlFor="maxChainedPRs">Max chained PRs</Label>
                   <Input
                     id="maxChainedPRs"
                     type="number"
                     min={0}
                     max={20}
                     value={String(projectConfigDraft.maxChainedPRs)}
                     onChange={(e) =>
                       setProjectConfigDraft((prev) =>
                         prev
                           ? {
                               ...prev,
                               maxChainedPRs: Number(e.target.value),
                             }
                           : prev,
                       )
                     }
                     disabled={projectConfigPending}
                   />
                 </div>

                 <div className="grid gap-2">
                   <Label>Memories</Label>
                   <div className="flex flex-wrap gap-2">
                     <Toggle
                       pressed={projectConfigDraft.shouldHaveMemories}
                       onPressedChange={(pressed) =>
                         setProjectConfigDraft((prev) =>
                           prev ? { ...prev, shouldHaveMemories: pressed } : prev,
                         )
                       }
                       disabled={projectConfigPending}
                     >
                       shouldHaveMemories
                     </Toggle>
                     <Toggle
                       pressed={projectConfigDraft.shouldOverwriteMemories}
                       onPressedChange={(pressed) =>
                         setProjectConfigDraft((prev) =>
                           prev
                             ? { ...prev, shouldOverwriteMemories: pressed }
                             : prev,
                         )
                       }
                       disabled={projectConfigPending}
                     >
                       shouldOverwriteMemories
                     </Toggle>
                   </div>
                 </div>
               </div>

               <div className="grid gap-2">
                 <Label htmlFor="projectSpecification">Project specification</Label>
                 <Textarea
                   id="projectSpecification"
                   value={projectConfigDraft.projectSpecification}
                   onChange={(e) =>
                     setProjectConfigDraft((prev) =>
                       prev
                         ? { ...prev, projectSpecification: e.target.value }
                         : prev,
                     )
                   }
                   disabled={projectConfigPending}
                   className="min-h-[120px]"
                 />
               </div>

               {projectConfigError ? (
                 <div className="text-sm text-destructive">{projectConfigError}</div>
               ) : null}

               <div className="flex justify-end gap-2">
                 <Button
                   variant="outline"
                   onClick={() => {
                     setProjectConfigOpen(false);
                     setProjectConfigError(null);
                   }}
                   disabled={projectConfigPending}
                 >
                   Cancel
                 </Button>
                 <Button
                   onClick={async () => {
                     if (!projectConfigDraft) return;
                     setProjectConfigPending(true);
                     setProjectConfigError(null);
                     try {
                       await thattoolApi.updateProject(token, {
                         owner: selectedProject.owner,
                         repo: selectedProject.repo,
                         defaultModel: projectConfigDraft.defaultModel,
                         defaultBaseBranch: projectConfigDraft.defaultBaseBranch,
                         shouldHaveMemories: projectConfigDraft.shouldHaveMemories,
                         shouldOverwriteMemories:
                           projectConfigDraft.shouldOverwriteMemories,
                         maxLLMRetries: projectConfigDraft.maxLLMRetries,
                         maxChainedPRs: projectConfigDraft.maxChainedPRs,
                         projectSpecification: projectConfigDraft.projectSpecification,
                       });
                       await refreshProjects(true);
                       setProjectConfigOpen(false);
                     } catch (e) {
                       setProjectConfigError(
                         e instanceof Error ? e.message : "Failed to update project",
                       );
                     } finally {
                       setProjectConfigPending(false);
                     }
                   }}
                   disabled={projectConfigPending}
                 >
                   {projectConfigPending ? "Saving..." : "Save"}
                 </Button>
               </div>
             </CardContent>
           </Card>
         </div>
       ) : null}

        <main className="grid gap-6 p-6 md:grid-cols-[320px_1fr]">
         {projects.length === 0 ? (
           <Card>
             <CardHeader>
               <CardTitle>Projects</CardTitle>
               <CardDescription>No projects found.</CardDescription>
             </CardHeader>
           </Card>
         ) : (
           <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
            <CardDescription>Select a project to inspect tasks.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[560px]">
              <div className="grid gap-2 pr-3">
                {projects.map((p) => {
                  const selected = p.id === selectedProjectId;
                  return (
                     <Button
                       key={p.id}
                       variant={selected ? "default" : "outline"}
                       className="h-auto justify-between py-3"
                       onClick={() => setSelectedProjectId(p.id)}
                     >
                       <div className="grid text-left">
                         <div className="font-medium">{p.projectName}</div>
                         <div className="text-xs opacity-80">
                           {p.owner}/{p.repo}
                         </div>
                       </div>
                       {/* <Badge variant={p.enabled ? "secondary" : "outline"}>
                         {p.enabled ? "Enabled" : "Disabled"}
                       </Badge> */}
                     </Button>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
           </Card>
         )}

         <div className="grid gap-6">
          {!selectedProject ? (
            <Card>
              <CardHeader>
                <CardTitle>Project</CardTitle>
                <CardDescription>Select a project to continue.</CardDescription>
              </CardHeader>
            </Card>
          ) : !selectedProject.enabled ? (
            <Card>
              <CardHeader>
                <CardTitle>Project Disabled</CardTitle>
                <CardDescription>
                  Enable this project to view or schedule work.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>Manual Prompt</CardTitle>
                      <CardDescription>
                        Start a new task or continue an existing one.
                      </CardDescription>
                    </div>
                    <Toggle
                      pressed={manualOpen}
                      onPressedChange={setManualOpen}
                      disabled={!selectedProjectAvailable}
                    >
                      {manualOpen ? "Hide" : "Use"}
                    </Toggle>
                  </div>
                </CardHeader>
                 {manualOpen ? (
                   <CardContent className="grid gap-3">
                     <div className="grid gap-2 md:grid-cols-2">
                  <div className="grid gap-1">
                    <div className="text-sm font-medium">Mode</div>
                    <Select
                      value={manualMode}
                      onValueChange={(v) => {
                        setManualMode(v as "new_task" | "existing_task");
                        setManualError(null);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new_task">New task</SelectItem>
                        <SelectItem value="existing_task">Existing task</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {manualMode === "existing_task" ? (
                    <div className="grid gap-1">
                      <div className="text-sm font-medium">Task</div>
                      <Select
                        value={manualTaskId ? String(manualTaskId) : ""}
                        onValueChange={(v) => setManualTaskId(Number(v))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select task" />
                        </SelectTrigger>
                        <SelectContent>
                          {tasks.map((t) => (
                            <SelectItem key={t.id} value={String(t.id)}>
                              #{t.id} ({t.status})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </div>

                <Textarea
                  value={manualPrompt}
                  onChange={(e) => setManualPrompt(e.target.value)}
                  placeholder={
                    selectedProject
                      ? `Prompt for ${selectedProject.projectName}...`
                      : "Select a project first"
                  }
                  disabled={!selectedProjectAvailable || manualPending}
                  className="min-h-[120px]"
                />

                {manualError ? (
                  <div className="text-sm text-destructive">{manualError}</div>
                ) : null}

                <div className="flex justify-end">
                  <Button
                    onClick={() => createManualSubtask()}
                    disabled={
                      !selectedProjectAvailable ||
                      manualPending ||
                      !manualPrompt.trim() ||
                      (manualMode === "existing_task" && !manualTaskId)
                    }
                  >
                    {manualPending
                      ? "Scheduling..."
                      : manualMode === "new_task"
                        ? "Start task"
                        : "Add subtask"}
                  </Button>
                </div>
                  </CardContent>
                ) : null}
              </Card>

              <Card>
                <CardHeader>
              <CardTitle>Tasks &amp; Subtasks</CardTitle>
              <CardDescription>
                Select a task/subtask and view live logs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">Tasks</div>
                  <div className="flex gap-2">
                     <Button
                       variant="outline"
                       size="sm"
                       disabled={!selectedTask || selectedTask.status !== "running"}
                       onClick={() => stopSelectedTask().catch(() => null)}
                     >
                       Stop
                     </Button>
                     <Button
                       variant="secondary"
                       size="sm"
                       disabled={
                         !selectedTask ||
                         selectedTask.status === "running" ||
                         selectedTask.status === "pending"
                       }
                       onClick={() => restartSelectedTask().catch(() => null)}
                     >
                       Restart
                     </Button>
                     <Button
                       variant="destructive"
                       size="sm"
                       disabled={!selectedTask || selectedTask.status === "running"}
                       onClick={() => deleteSelectedTask().catch(() => null)}
                     >
                       Delete
                     </Button>

                  </div>
                </div>
                <ScrollArea className="h-[240px]">

                    <div className="grid gap-2 pr-3">
                      {tasks.length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                          No tasks yet.
                        </div>
                      ) : null}
                      {tasks.map((t) => {
                        const selected = t.id === selectedTaskId;
                        return (
                          <Button
                            key={t.id}
                            variant={selected ? "default" : "outline"}
                            className="h-auto justify-between py-3"
                            onClick={() => {
                              setSelectedTaskId(t.id);
                              setSelectedSubtaskId(null);
                                setLogs(defaultLogsMessage);
                            }}
                          >
                            <div className="grid text-left">
                              <div className="text-sm font-medium">#{t.id}</div>
                              <div className="text-xs opacity-80">{t.type}</div>
                            </div>
                            <StatusBadge status={t.status} />
                          </Button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>

                <div className="grid gap-2 pt-2">
                  <div className="text-sm font-medium">Subtasks</div>
                  <ScrollArea className="h-[240px]">
                    <div className="grid gap-2 pr-3">
                      {subtasks.length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                          No subtasks yet.
                        </div>
                      ) : null}
                      {subtasks.map((s) => {
                        const selected = s.id === selectedSubtaskId;
                        return (
                          <Button
                            key={s.id}
                            variant={selected ? "default" : "outline"}
                            className="h-auto justify-between py-3"
                            onClick={() => {
                              setSelectedSubtaskId(s.id);
                              if (!selectedTaskId) setSelectedTaskId(s.taskId);
                            }}
                          >
                            <div className="grid text-left">
                              <div className="text-sm font-medium">
                                Subtask #{s.id}
                              </div>
                              <div className="text-xs opacity-80">
                                Task #{s.taskId}
                              </div>
                            </div>
                            <StatusBadge status={s.status} />
                          </Button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="grid gap-2">
                <div className="text-sm font-medium">Logs</div>
                <div className="min-h-[220px] rounded-md border bg-muted/30 p-3 font-mono text-xs whitespace-pre-wrap">
                  {logs}
                </div>
              </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
