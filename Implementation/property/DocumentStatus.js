/** Shared document-status property: four mutually exclusive states. */
export const DocumentStatus = Object.freeze({
  SYNCED: "green",
  DIRTY: "yellow",
  ERROR: "red",
  LOADING: "blue"
});

export function statusLabel(state) {
  return {
    green: "已與磁碟同步",
    yellow: "尚未儲存",
    red: "操作失敗",
    blue: "操作中"
  }[state] ?? "未知狀態";
}
