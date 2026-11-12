import Anthropic, { APIError } from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { AutoParseableOutputFormat } from "@anthropic-ai/sdk/lib/parser";
import type { z } from "zod";

/** The one model every Parity AI feature uses. */
export const MODEL = "claude-haiku-5-5";

/**
 * Why a call produced nothing usable:
 * - `refusal`: the model declined (safety classifiers; there's no server-side fallback on Haiku 5.5).
 * - `max_tokens`: the answer was cut off. Thinking counts toward the cap.
 * - `invalid_output`: no text came back, or it didn't match the schema.
 * - `api_error`: the request failed (network, rate limit, missing key, ...).
 */
export type AiFailure = "refusal" | "max_tokens" | "invalid_output" | "api_error";

export type AiResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: AiFailure; detail?: string };

export type Effort = "low" | "medium";

export interface GenerateOptions {
  /** Short name used in logs, e.g. "life-plan-insight". */
  label: string;
  system: string;
  /** The single user message. */
  prompt: string;
  /** How much the model thinks. Thinking stays on; effort is the control. */
  effort: Effort;
  /** Defaults by effort, leaving room for thinking plus the answer. */
  maxTokens?: number;
}

// Thinking counts toward max_tokens, so these leave generous room for it.
const DEFAULT_MAX_TOKENS: Record<Effort, number> = { low: 4096, medium: 8192 };

let client: Anthropic | null = null;

// Created on first use, so importing this module never fails (for example
// when no API key is configured); a missing key surfaces as `api_error`.
function getClient(): Anthropic {
  client ??= new Anthropic();
  return client;
}

/** Generates plain text. */
export async function generateText(options: GenerateOptions): Promise<AiResult<string>> {
  return logFailure(options.label, await request(options, readText));
}

/** Generates JSON that matches `schema`, enforced by structured outputs and validated with zod. */
export async function generateObject<Schema extends z.ZodType>(
  schema: Schema,
  options: GenerateOptions
): Promise<AiResult<z.infer<Schema>>> {
  const format = zodOutputFormat(schema);
  return logFailure(
    options.label,
    await request(options, (message) => readObject(message, format), format)
  );
}

async function request<T>(
  options: GenerateOptions,
  read: (message: Anthropic.Message) => AiResult<T>,
  format?: AutoParseableOutputFormat<unknown>
): Promise<AiResult<T>> {
  let message: Anthropic.Message;
  try {
    // messages.create rather than messages.parse: parse validates every text
    // block as soon as the response arrives and throws on a refusal or a
    // truncated answer, which would hide the stop reason.
    message = await getClient().messages.create({
      model: MODEL,
      max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS[options.effort],
      system: options.system,
      messages: [{ role: "user", content: options.prompt }],
      output_config: format ? { effort: options.effort, format } : { effort: options.effort },
    });
  } catch (error) {
    return { ok: false, reason: "api_error", detail: describeError(error) };
  }
  return read(message);
}

/**
 * Reads the answer from a response. Checks the stop reason first, then joins
 * the text blocks; a Haiku 5.5 response starts with thinking blocks, so blocks
 * are picked by type, never by position.
 */
export function readText(message: Anthropic.Message): AiResult<string> {
  if (message.stop_reason === "refusal") {
    const category = message.stop_details?.category ?? "uncategorized";
    return { ok: false, reason: "refusal", detail: `category: ${category}` };
  }
  if (message.stop_reason === "max_tokens" || message.stop_reason === "model_context_window_exceeded") {
    return { ok: false, reason: "max_tokens", detail: `stop_reason: ${message.stop_reason}` };
  }
  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
  if (!text) {
    return { ok: false, reason: "invalid_output", detail: "no text in the response" };
  }
  return { ok: true, data: text };
}

/** Like readText, then validates the text against the structured-output schema. */
export function readObject<T>(
  message: Anthropic.Message,
  format: AutoParseableOutputFormat<T>
): AiResult<T> {
  const text = readText(message);
  if (!text.ok) return text;
  try {
    return { ok: true, data: format.parse(text.data) };
  } catch (error) {
    return { ok: false, reason: "invalid_output", detail: describeError(error) };
  }
}

function describeError(error: unknown): string {
  if (error instanceof APIError) return `${error.name} (status ${error.status ?? "none"})`;
  if (error instanceof Error) return `${error.name}: ${error.message.split("\n")[0]}`;
  return String(error);
}

// Logs the failure reason, never the prompt (it holds the couple's finances).
function logFailure<T>(label: string, result: AiResult<T>): AiResult<T> {
  if (!result.ok) {
    console.error(`[ai:${label}] ${result.reason}${result.detail ? ` (${result.detail})` : ""}`);
  }
  return result;
}
