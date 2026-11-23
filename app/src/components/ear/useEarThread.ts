"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ReviewTask } from "@/lib/types";

/*
  The Ear thread is a tiny chat log. Agent messages arrive one after another
  (with a typing indicator in between), the editor's reply is appended as soon
  as they press send, and the payment message lands once the server answers.
  Under reduced motion everything is placed at once with no typing pauses.
*/

export type EarMsg =
  | { id: string; kind: "voice"; task: ReviewTask; delay?: number }
  | { id: string; kind: "question"; task: ReviewTask; delay?: number }
  | { id: string; kind: "fee"; fee: number; delay?: number }
  | {
      id: string;
      kind: "out";
      text: string;
      aiGuess: string;
      confirmedAiRight: boolean;
      status: "sending" | "sent";
      delay?: number;
    }
  | { id: string; kind: "paid"; fee: number; delay?: number }
  | { id: string; kind: "waiting"; fee: number; delay?: number }
  | { id: string; kind: "divider"; label: string; delay?: number }
  | { id: string; kind: "done"; delay?: number };

type OutMsg = Extract<EarMsg, { kind: "out" }>;

interface Step {
  wait: number;
  typing?: boolean;
  run: () => void;
}

let seq = 0;
const uid = (p: string) => `${p}-${++seq}`;

function taskMsgs(task: ReviewTask, stagger: boolean): EarMsg[] {
  return [
    { id: uid("voice"), kind: "voice", task, delay: 0 },
    { id: uid("q"), kind: "question", task, delay: stagger ? 0.07 : 0 },
    { id: uid("fee"), kind: "fee", fee: task.feeTusd8, delay: stagger ? 0.14 : 0 },
  ];
}

export function useEarThread(reduceMotion: boolean) {
  const [log, setLog] = useState<EarMsg[]>([]);
  const [typing, setTyping] = useState(false);
  /* Bumps on every fresh thread so the list remounts instead of animating exits. */
  const [epoch, setEpoch] = useState(0);
  const timers = useRef<number[]>([]);

  const clear = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setTyping(false);
  }, []);

  useEffect(() => clear, [clear]);

  const play = useCallback(
    (steps: Step[]) => {
      if (reduceMotion) {
        steps.forEach((s) => s.run());
        return;
      }
      let at = 0;
      for (const s of steps) {
        if (s.typing) {
          const start = at;
          timers.current.push(window.setTimeout(() => setTyping(true), start));
        }
        at += s.wait;
        const fire = at;
        timers.current.push(
          window.setTimeout(() => {
            if (s.typing) setTyping(false);
            s.run();
          }, fire)
        );
      }
    },
    [reduceMotion]
  );

  const add = useCallback((...msgs: EarMsg[]) => {
    setLog((prev) => [...prev, ...msgs]);
  }, []);

  /* Start a fresh thread for a word. `arrive` plays the messages in like a chat,
     `browse` (prev/next) shows them at once with a small stagger. */
  const seed = useCallback(
    (task: ReviewTask | null, mode: "arrive" | "browse") => {
      clear();
      setEpoch((e) => e + 1);
      if (!task) {
        setLog([]);
        return;
      }
      if (mode === "browse" || reduceMotion) {
        setLog(taskMsgs(task, true));
        return;
      }
      const [voice, question, fee] = taskMsgs(task, false);
      setLog([voice]);
      play([
        { wait: 620, typing: true, run: () => add(question) },
        { wait: 340, run: () => add(fee) },
      ]);
    },
    [add, clear, play, reduceMotion]
  );

  const sendOut = useCallback(
    (m: Omit<OutMsg, "id" | "kind" | "status">) => {
      const id = uid("out");
      add({ id, kind: "out", status: "sending", ...m });
      return id;
    },
    [add]
  );

  const confirmOut = useCallback((id: string) => {
    setLog((prev) =>
      prev.map((m) => (m.id === id && m.kind === "out" ? { ...m, status: "sent" } : m))
    );
  }, []);

  const dropOut = useCallback((id: string) => {
    setLog((prev) => prev.filter((m) => m.id !== id));
  }, []);

  /* After a sent answer: the agent replies, then the next word arrives. */
  const advance = useCallback(
    (result: { paid: boolean; fee: number }, next: ReviewTask | null) => {
      clear();
      const resultMsg: EarMsg = result.paid
        ? { id: uid("paid"), kind: "paid", fee: result.fee }
        : { id: uid("wait"), kind: "waiting", fee: result.fee };

      const steps: Step[] = [{ wait: 720, typing: true, run: () => add(resultMsg) }];

      if (next) {
        const [voice, question, fee] = taskMsgs(next, false);
        steps.push(
          {
            wait: result.paid ? 1300 : 950,
            run: () =>
              setLog((prev) => {
                // Keep only the exchange that just finished, then start the next word.
                const lastDivider = prev.map((m) => m.kind).lastIndexOf("divider");
                const kept = prev
                  .slice(lastDivider + 1)
                  .filter((m) => m.kind !== "fee");
                return [...kept, { id: uid("div"), kind: "divider", label: "Next word" }, voice];
              }),
          },
          { wait: 620, typing: true, run: () => add(question) },
          { wait: 340, run: () => add(fee) }
        );
      } else {
        steps.push({
          wait: 900,
          typing: true,
          run: () => add({ id: uid("done"), kind: "done" }),
        });
      }
      play(steps);
    },
    [add, clear, play]
  );

  return { log, typing, epoch, seed, sendOut, confirmOut, dropOut, advance };
}
