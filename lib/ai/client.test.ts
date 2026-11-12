import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));

// Replace only the client class; keep the SDK's real error classes and helpers.
vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  return {
    ...actual,
    default: class {
      messages = { create };
    },
  };
});

import { MODEL, generateObject, generateText, readObject, readText } from "./client";

const thinking = { type: "thinking", thinking: "", signature: "sig" };
const text = (value: string) => ({ type: "text", text: value, citations: null });

function message(
  content: object[],
  stop_reason: Anthropic.StopReason = "end_turn",
  stop_details: object | null = null
): Anthropic.Message {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: MODEL,
    content,
    stop_reason,
    stop_details,
    stop_sequence: null,
  } as unknown as Anthropic.Message;
}

const Answer = z.object({ answer: z.number() });
const answerFormat = zodOutputFormat(Answer);

describe("readText", () => {
  it("skips thinking blocks and returns the text", () => {
    expect(readText(message([thinking, text("  You both saved more.  ")]))).toEqual({
      ok: true,
      data: "You both saved more.",
    });
  });

  it("reports max_tokens when thinking used up the cap before any text", () => {
    expect(readText(message([thinking], "max_tokens"))).toMatchObject({
      ok: false,
      reason: "max_tokens",
    });
  });

  it("reports a refusal before reading content, with its category", () => {
    const result = readText(message([text("partial")], "refusal", { type: "refusal", category: "cyber" }));
    expect(result).toMatchObject({ ok: false, reason: "refusal" });
    expect(!result.ok && result.detail).toContain("cyber");
  });

  it("reports invalid_output when no text came back", () => {
    expect(readText(message([thinking]))).toMatchObject({ ok: false, reason: "invalid_output" });
  });
});

describe("readObject", () => {
  it("parses text that matches the schema", () => {
    expect(readObject(message([thinking, text('{"answer": 4}')]), answerFormat)).toEqual({
      ok: true,
      data: { answer: 4 },
    });
  });

  it("reports invalid_output when the JSON doesn't match the schema", () => {
    expect(readObject(message([text('{"answer": "four"}')]), answerFormat)).toMatchObject({
      ok: false,
      reason: "invalid_output",
    });
  });

  it("reports invalid_output when the text isn't JSON", () => {
    expect(readObject(message([text("four")]), answerFormat)).toMatchObject({
      ok: false,
      reason: "invalid_output",
    });
  });

  it("keeps a refusal as a refusal rather than a parse failure", () => {
    expect(readObject(message([text("I can't help")], "refusal"), answerFormat)).toMatchObject({
      ok: false,
      reason: "refusal",
    });
  });
});

describe("generateText and generateObject", () => {
  const options = { label: "test", system: "System prompt", prompt: "Question", effort: "low" as const };
  let logged: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    create.mockReset();
    logged = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => logged.mockRestore());

  it("sends the shared model, effort and a single user message", async () => {
    create.mockResolvedValue(message([thinking, text("Hello")]));

    await expect(generateText(options)).resolves.toEqual({ ok: true, data: "Hello" });
    const params = create.mock.calls[0][0];
    expect(params).toMatchObject({
      model: "claude-haiku-5-5",
      system: "System prompt",
      messages: [{ role: "user", content: "Question" }],
      output_config: { effort: "low" },
    });
    expect(params.max_tokens).toBeGreaterThanOrEqual(2048);
    expect(params).not.toHaveProperty("thinking");
    expect(logged).not.toHaveBeenCalled();
  });

  it("returns api_error and logs, instead of throwing, when the request fails", async () => {
    create.mockRejectedValue(new Error("Could not resolve authentication method"));

    await expect(generateText(options)).resolves.toMatchObject({ ok: false, reason: "api_error" });
    expect(logged).toHaveBeenCalledWith(expect.stringContaining("[ai:test] api_error"));
  });

  it("asks for structured output and returns the validated object", async () => {
    create.mockResolvedValue(message([thinking, text('{"answer": 4}')]));

    await expect(generateObject(Answer, { ...options, effort: "medium" })).resolves.toEqual({
      ok: true,
      data: { answer: 4 },
    });
    const params = create.mock.calls[0][0];
    expect(params.output_config).toMatchObject({ effort: "medium", format: { type: "json_schema" } });
  });

  it("logs the reason when the model refuses", async () => {
    create.mockResolvedValue(message([], "refusal", { type: "refusal", category: "bio" }));

    await expect(generateObject(Answer, options)).resolves.toMatchObject({ ok: false, reason: "refusal" });
    expect(logged).toHaveBeenCalledWith(expect.stringContaining("refusal (category: bio)"));
  });
});
