import { listAuditLogs } from "../data/staffStore.js";

export async function listSystemAuditLogs(req, res) {
  return res.json({ logs: await listAuditLogs() });
}
