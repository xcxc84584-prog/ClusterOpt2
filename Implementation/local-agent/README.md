# ClusterOpt2 Native PowerShell Local Agent

This directory contains an adapted copy of the older ClusterOpt
loopback ConPTY implementation. The web page cannot spawn native Windows
processes by itself.

Open ClusterOpt2, click the PowerShell button next to Explorer, and
download the setup CMD. Read the CMD before executing it locally.
It downloads the version-compatible installer from the ClusterOpt2
repository, installs Node.js and native terminal dependencies when
required, then starts the loopback agent. The user must copy the
64-character token from the local console into the UI.

No unrelated process is terminated when port 43881 is in use. Choose
another port or cancel. The token must not be shared, committed or
sent through a tunnel. `/status` reports a release version; the
web UI rejects an old or mismatched agent.

After updating ClusterOpt2, download a fresh CMD, reinstall the local
agent, and re-pair. Windows PowerShell execution is outside CI's
Linux-hosted browser test. Native ConPTY and node-pty on real Windows
still require acceptance.
