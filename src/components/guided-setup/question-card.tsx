"use client";

import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export type QuestionOption = { value: string; label: string };

export type QuestionCardValue = string | string[] | boolean | number;

/**
 * Renders one Guided Setup question by its answer type. Purely a controlled
 * input renderer — all logic (prefill, submit, skip) lives in the flow
 * component and the guided-setup services, per "no business logic in
 * components."
 */
export function QuestionCard({
  answerType,
  options,
  value,
  onChange,
}: {
  answerType: string;
  options: QuestionOption[] | null;
  value: QuestionCardValue;
  onChange: (value: QuestionCardValue) => void;
}) {
  const [localText, setLocalText] = useState(typeof value === "string" ? value : "");

  useEffect(() => {
    setLocalText(typeof value === "string" ? value : "");
  }, [value]);

  if (answerType === "LONG_TEXT") {
    return (
      <Textarea
        rows={4}
        value={localText}
        onChange={(e) => {
          setLocalText(e.target.value);
          onChange(e.target.value);
        }}
        autoFocus
      />
    );
  }

  if (answerType === "SHORT_TEXT" || answerType === "NUMBER" || answerType === "CURRENCY") {
    return (
      <Input
        type={answerType === "NUMBER" || answerType === "CURRENCY" ? "number" : "text"}
        value={localText}
        onChange={(e) => {
          setLocalText(e.target.value);
          onChange(answerType === "NUMBER" || answerType === "CURRENCY" ? Number(e.target.value) : e.target.value);
        }}
        autoFocus
      />
    );
  }

  if (answerType === "BOOLEAN") {
    return (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`flex-1 rounded-md border px-4 py-2 text-sm transition-colors ${value === true ? "border-lime bg-elevated text-foreground" : "border-border text-muted-foreground hover:bg-elevated/50"}`}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`flex-1 rounded-md border px-4 py-2 text-sm transition-colors ${value === false ? "border-lime bg-elevated text-foreground" : "border-border text-muted-foreground hover:bg-elevated/50"}`}
        >
          No
        </button>
      </div>
    );
  }

  if (answerType === "SINGLE_SELECT") {
    return (
      <div className="flex flex-col gap-2">
        {(options ?? []).map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-md border px-4 py-2.5 text-left text-sm transition-colors ${value === option.value ? "border-lime bg-elevated text-foreground" : "border-border text-muted-foreground hover:bg-elevated/50"}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    );
  }

  if (answerType === "MULTI_SELECT") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="flex flex-col gap-2">
        {(options ?? []).map((option) => {
          const checked = selected.includes(option.value);
          return (
            <label
              key={option.value}
              className="flex items-center gap-2.5 rounded-md border border-border px-4 py-2.5 text-sm text-foreground hover:bg-elevated/50"
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(next) => {
                  const nextValue = next ? [...selected, option.value] : selected.filter((v) => v !== option.value);
                  onChange(nextValue);
                }}
              />
              {option.label}
            </label>
          );
        })}
      </div>
    );
  }

  // Fallback for FILE / VOICE_INPUT_PLACEHOLDER / ENTITY_SELECT / AI_SUGGESTION_REVIEW — a plain text capture for now.
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">This input type isn&apos;t fully interactive yet — describe it in words.</Label>
      <Textarea
        rows={3}
        value={localText}
        onChange={(e) => {
          setLocalText(e.target.value);
          onChange(e.target.value);
        }}
      />
    </div>
  );
}
