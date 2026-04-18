"use client";

import { useState, useRef, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { SendHorizontal, Sparkles } from "lucide-react";
import { askParityAction } from "./actions";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const EXAMPLE_QUESTIONS = [
  "How much did we spend on dining last month?",
  "What's our biggest spending category?",
  "Are we on track for our goals?",
  "What's our combined net worth?",
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-earthy-muted" />
          Ask Parity
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ask questions about your finances in plain English.
        </p>
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
                  className="text-left text-sm px-4 py-3 rounded-lg bg-secondary hover:bg-earthy-light transition-colors border border-border hover:border-earthy-border/40"
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
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-earthy-light flex items-center justify-center mr-2 mt-0.5">
                  <Sparkles className="h-3.5 w-3.5 text-earthy-muted" />
                </div>
              )}
              <Card
                className={`max-w-[80%] border-0 ${
                  msg.role === "user"
                    ? "bg-foreground text-background"
                    : "bg-earthy-light text-earthy-foreground"
                }`}
              >
                <CardContent className="py-3 px-4 text-sm">
                  {msg.content}
                </CardContent>
              </Card>
            </div>
          ))
        )}
        {isPending && (
          <div className="flex justify-start">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-earthy-light flex items-center justify-center mr-2 mt-0.5">
              <Sparkles className="h-3.5 w-3.5 text-earthy-muted" />
            </div>
            <Card className="border-0 bg-earthy-light">
              <CardContent className="py-2.5 px-4">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-earthy-muted rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-earthy-muted rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-earthy-muted rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </CardContent>
            </Card>
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
