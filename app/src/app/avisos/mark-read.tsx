"use client";

import { useEffect } from "react";
import { markAllRead } from "./actions";

/** Clears the bell's count once Avisos is on screen. */
export function MarkRead({ unread }: { unread: boolean }) {
  useEffect(() => {
    delete document.documentElement.dataset.avisos;
    if (unread) void markAllRead();
  }, [unread]);
  return null;
}
