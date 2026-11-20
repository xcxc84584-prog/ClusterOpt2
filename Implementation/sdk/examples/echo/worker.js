// Independent plugin. No first-party ClusterOpt2 imports.
Cluster.handle("echo", payload => ({
  echoed: String(payload.message ?? ""),
  sdkVersion: Cluster.version
}));
