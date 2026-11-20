/**
 * ClusterOpt2 isolated Worker SDK: ambient API supplied by the Host.
 * No remote package imports or privileged DOM/PowerShell references.
 * Manifest rpcScopes and live HubUnit ACL determine every Host call.
 */
declare namespace ClusterSDK {
  type SessionState = "ready" | "suspended";
  interface RequestOptions {
    deadlineMs?: number;
    signal?: AbortSignal;
  }
  class RPCError extends Error {
    readonly code: string;
    readonly status: number;
  }
  interface WorkerAPI {
    readonly version: "1.0.0";
    readonly ready: Promise<void>;
    readonly RPCError: typeof RPCError;
    request<T = unknown>(
      target: string,
      action: string,
      payload?: Record<string, unknown>,
      options?: RequestOptions
    ): Promise<T>;
    service<T = unknown>(
      target: string,
      action: string,
      payload?: Record<string, unknown>,
      options?: RequestOptions
    ): Promise<T>;
    handle<T = unknown, R = unknown>(
      declaredAction: string,
      handler: (payload: T) => R | Promise<R>
    ): () => void;
    onSessionChange(
      listener: (state: SessionState) => void
    ): () => void;
  }
}
declare const Cluster: Readonly<ClusterSDK.WorkerAPI>;
