# ClusterOpt2 Local Agent

The PowerShell terminal is a native ConPTY process controlled through
an authenticated loopback socket. The web page cannot execute OS
commands without the user's separate Local Agent.

## Setup
Download the CMD from the ClusterOpt2 PowerShell UI and run it locally.
It verifies the installed Node.js/npm, resolves the current package
manifest, and checks that the node-pty native module can actually load.
If npm skipped node-pty's install script, review and approve that
package's script before rerunning the setup.

When port 43881 is occupied choose P (other port), C (cancel), or
O (explicit, double-confirmed takeover after reviewing the process
identity). Never override a process with unsaved work.

When setup reaches the ready state, it displays the selected port and
a new 64-hex pairing token in the installer. **Copy both before
pressing Enter.** The CMD then closes, and the hidden local Agent
remains running. Paste the token into the browser pairing form.

The token is generated afresh for each launch, is passed only through
the local process environment to the Agent and is never written to a
file or redirected log. The Agent removes the inherited token from
its environment before spawning PowerShell. If the token was lost
before pairing, restart the installer to create a new one.

The agent listens only on loopback and validates the browser Origin
and bearer token. Do not expose it through tunnels or publish token
screenshots. Closing the browser does not stop the Agent; closing a
terminal session only closes that shell.

The GUI uses the original ClusterOpt layout with xterm + FitAddon to
size native rows/columns to its visible editor area. Native Windows
ConPTY and detached-process survivability still need real-machine QA.
