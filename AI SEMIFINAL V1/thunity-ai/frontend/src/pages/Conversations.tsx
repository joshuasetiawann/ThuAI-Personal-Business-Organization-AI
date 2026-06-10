import { useState } from "react";
import { api } from "../api/client";
import { PageHeader, Card, DataTable, StatusBadge, DetailDrawer, LoadMore,
  Loading, ErrorState, Empty, Row, usePaged, type Column } from "../components/ui";
import type { ConvBrief, ConvDetail, ConvMessage } from "../types";

export default function Conversations() {
  const { rows, loading, error, done, loadMore } =
    usePaged<ConvBrief>((l, o) => api.conversations(l, o).then((r: any) => r.conversations || []));
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<ConvDetail | null>(null);
  const [dLoading, setDLoading] = useState(false);
  const [dErr, setDErr] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<ConvMessage[] | null>(null);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgErr, setMsgErr] = useState<string | null>(null);

  const openDetail = (c: ConvBrief) => {
    setOpen(true); setSel(null); setDErr(null); setDLoading(true);
    setMsgs(null); setMsgErr(null); setMsgLoading(true);
    api.conversation(c.id).then((x: any) => setSel(x))
      .catch((e) => setDErr(e?.status === 403 ? "You don't have access to this conversation." : (e?.message || "Failed")))
      .finally(() => setDLoading(false));
    api.conversationMessages(c.id).then((r: any) => setMsgs(r.messages || []))
      .catch((e) => setMsgErr(e?.status === 403 ? "No access to this conversation's messages." : (e?.message || "Failed to load messages.")))
      .finally(() => setMsgLoading(false));
  };

  const cols: Column<ConvBrief>[] = [
    { key: "title", label: "Title", render: (r) => <span className="strong">{r.title}</span> },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "created_at", label: "Created", render: (r) => <span className="muted small">{new Date(r.created_at).toLocaleString()}</span> },
  ];

  return (
    <div className="page">
      <PageHeader title="Conversations" subtitle="Read-only list and transcript view. New chats are started from the AI Council." />
      <Card title="Conversations" hint="/api/conversations">
        {loading && !rows.length ? <Loading /> : error ? <ErrorState message={error} />
          : rows.length ? <><DataTable columns={cols} rows={rows} rowKey={(r) => r.id} onRow={openDetail} />
              <LoadMore onClick={loadMore} loading={loading} done={done} /></>
          : <Empty label="No conversations yet." />}
      </Card>

      <DetailDrawer open={open} onClose={() => setOpen(false)} title="Conversation">
        {dLoading ? <Loading /> : dErr ? <ErrorState message={dErr} /> : sel && (
          <div className="kv">
            <Row k="Title" v={sel.title} />
            <Row k="Status" v={<StatusBadge status={sel.status} />} />
            <Row k="Owner" v={sel.user_id ? <code className="mono">{String(sel.user_id).slice(0, 8)}</code> : "—"} />
          </div>
        )}
        <div className="detail-block">
          <b>Messages</b>
          {msgLoading ? <Loading /> : msgErr ? <ErrorState message={msgErr} />
            : msgs && msgs.length ? (
              <div>{msgs.map((m) => (
                <div key={m.id} style={{ marginBottom: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span className="strong">{m.agent_name || m.role}</span>
                    <time className="muted small">{new Date(m.created_at).toLocaleString()}</time>
                  </div>
                  <pre className="raw small">{m.content}</pre>
                </div>
              ))}</div>
            ) : <Empty label="No messages in this conversation." />}
        </div>
      </DetailDrawer>
    </div>
  );
}
