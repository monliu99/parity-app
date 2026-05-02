"use client";

import { useState, useRef, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, SendHorizontal, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { askParityAction } from "./actions";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const EXAMPLE_QUESTIONS = [
  "Are we splitting costs fairly between us?",
  "What's one thing we might be overlooking financially?",
  "What would we need to change to hit our goals sooner?",
  "Can we afford to save more each month?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function sendMessage(question: string) {
    if (!question.trim() || isPending) return;

    const userMessage: Message = { role: "user", content: question };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    startTransition(async () => {
      const answer = await askParityAction(question);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: answer },
      ]);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-6 flex items-start gap-3">
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={() => { setMessages([]); inputRef.current?.focus(); }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-earthy-muted" />
            Ask Parity
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ask questions about your finances in plain English.
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Try asking:</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {EXAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-left text-sm px-4 py-3 rounded-lg bg-secondary/60 hover:bg-secondary transition-colors border border-border hover:border-primary/20"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center mr-2 mt-0.5">
                  <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:mb-1 [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs"
                }`}
              >
                {msg.role === "assistant" ? (
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))
        )}
        {isPending && (
          <div className="flex justify-start">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center mr-2 mt-0.5">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="rounded-2xl bg-secondary px-4 py-3">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 pt-2 border-t">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your finances…"
          disabled={isPending}
          className="flex-1"
        />
        <Button type="submit" disabled={isPending || !input.trim()}>
          <SendHorizontal className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
