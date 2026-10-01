import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Bot, Check, Loader2, MessageCircle, Send, X } from "lucide-react";
import { useState } from "react";

export function AgentChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const utils = trpc.useUtils();
  const messagesQuery = trpc.agent.messages.useQuery(undefined, {
    enabled: open,
    refetchInterval: open ? 3000 : false,
  });
  const startMutation = trpc.agent.start.useMutation({
    onSuccess: () => void utils.agent.messages.invalidate(),
  });
  const sendMutation = trpc.agent.send.useMutation({
    onSuccess: () => void utils.agent.messages.invalidate(),
  });
  const confirmMutation = trpc.agent.confirm.useMutation({
    onSuccess: () => void utils.agent.messages.invalidate(),
  });
  const busy = startMutation.isPending || sendMutation.isPending;
  const agent = messagesQuery.data;
  const send = () => {
    const message = input.trim();
    if (!message || busy) return;
    setInput("");
    if (agent?.taskId) sendMutation.mutate({ message });
    else startMutation.mutate({ message });
  };
  const waiting = agent?.waiting;
  const eventType = waiting?.waiting_for_event_type;
  const needsDeployConfirmation = eventType === "deployAction";

  return (
    <>
      {open && (
        <section className="fixed bottom-24 right-4 z-[100] flex h-[min(680px,calc(100vh-7rem))] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-[#dfe8e2] bg-white shadow-2xl">
          <header className="flex items-center justify-between bg-[#1f5e3a] px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <div>
                <p className="font-semibold">Goldpos Agent</p>
                <p className="text-[11px] text-[#d5ebdb]">
                  App ပြင်ဆင်ရန် အကူအညီ
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              className="text-white hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto bg-[#f7faf8] p-3">
            {!agent?.messages?.length && (
              <div className="rounded-xl border border-[#dcebe0] bg-white p-3 text-sm text-[#53645b]">
                App ပြင်ဆင်လိုသောအချက်ကို ရေးပါ။ Agent သည် code ပြင်ပြီး test
                ပြီးနောက် VPS update မတင်ခင် သင့်ထံ confirmation တောင်းပါမည်။
              </div>
            )}
            {agent?.messages?.map((message, index) => (
              <div
                key={`${index}-${message.content.slice(0, 20)}`}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${message.role === "user" ? "rounded-br-sm bg-[#276044] text-white" : "rounded-bl-sm border border-[#e1eae3] bg-white text-[#25322b]"}`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-xs text-[#78867e]">
                <Loader2 className="h-4 w-4 animate-spin" /> Agent
                စဉ်းစားနေပါသည်…
              </div>
            )}
            {waiting && (
              <div className="rounded-xl border border-[#ead8b8] bg-[#fffaf0] p-3 text-sm text-[#765a28]">
                <p className="font-semibold">အတည်ပြုချက်လိုအပ်ပါသည်</p>
                <p className="mt-1">
                  {waiting.waiting_description ||
                    "Agent က ဆက်လုပ်ရန် သင့်အတည်ပြုချက်လိုပါသည်။"}
                </p>
                {needsDeployConfirmation && (
                  <p className="mt-2 font-semibold">
                    VPS server မှာ update တင်မလား?
                  </p>
                )}
                {waiting.waiting_for_event_id && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      disabled={confirmMutation.isPending}
                      onClick={() =>
                        confirmMutation.mutate({
                          eventId: waiting.waiting_for_event_id!,
                          input: { accept: true },
                        })
                      }
                      className="bg-[#276044] text-white hover:bg-[#1f5038]"
                    >
                      <Check className="mr-1.5 h-4 w-4" />
                      အတည်ပြုမည်
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={confirmMutation.isPending}
                      onClick={() =>
                        confirmMutation.mutate({
                          eventId: waiting.waiting_for_event_id!,
                          input: { accept: false },
                        })
                      }
                    >
                      မတင်ပါ
                    </Button>
                  </div>
                )}
              </div>
            )}
            {messagesQuery.error && (
              <p className="rounded-lg bg-[#fff0ed] p-2 text-xs text-[#a64639]">
                {messagesQuery.error.message}
              </p>
            )}
          </div>
          <form
            onSubmit={event => {
              event.preventDefault();
              send();
            }}
            className="flex items-end gap-2 border-t border-[#e5ece7] bg-white p-3"
          >
            <Textarea
              value={input}
              onChange={event => setInput(event.target.value)}
              onKeyDown={event => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              disabled={busy}
              rows={2}
              placeholder="Agent ကို ပြင်ဆင်ရန် ပြောပါ…"
              className="min-h-[44px] resize-none"
            />
            <Button
              type="submit"
              size="icon"
              disabled={busy || !input.trim()}
              className="h-11 w-11 shrink-0 bg-[#276044] text-white hover:bg-[#1f5038]"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </section>
      )}
      <Button
        onClick={() => setOpen(value => !value)}
        aria-label="Goldpos Agent ဖွင့်ရန်"
        className="fixed bottom-5 right-5 z-[101] h-14 w-14 rounded-full bg-[#276044] p-0 text-white shadow-lg hover:bg-[#1f5038]"
      >
        {open ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
      </Button>
    </>
  );
}
