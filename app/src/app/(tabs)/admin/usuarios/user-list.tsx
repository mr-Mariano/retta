"use client";

import Link from "next/link";
import { useState } from "react";
import { ROLE_LABELS } from "@/lib/role-labels";

export interface UserRow {
  id: string;
  full_name: string;
  role: string;
}

/** Search + list; tapping a person opens the role sheet (flow B). */
export function UserList({ users }: { users: UserRow[] }) {
  const [query, setQuery] = useState("");
  const needle = normalize(query);
  const shown = needle ? users.filter((user) => normalize(user.full_name).includes(needle)) : users;

  return (
    <>
      <label className="flex h-11 items-center gap-2.5 rounded-[6px] bg-surface px-3.5 text-muted">
        <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar"
          aria-label="Buscar usuarios"
          className="h-full flex-1 bg-transparent text-[15px] text-ink placeholder:text-muted focus:outline-none"
        />
      </label>
      {shown.length === 0 ? (
        <p className="py-8 text-center text-[15px] text-muted">Nadie se llama así.</p>
      ) : (
        <ul className="flex flex-col">
          {shown.map((user) => (
            <li key={user.id}>
              <Link href={`/admin/usuarios?usuario=${user.id}`} scroll={false} className="flex items-center gap-3 border-b border-line py-3">
                <span aria-hidden="true" className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-elevated text-[13px] font-semibold">
                  {initials(user.full_name)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[16px] font-semibold">{user.full_name}</span>
                  <span className="text-[13px] text-muted">{ROLE_LABELS[user.role] ?? user.role}</span>
                </span>
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}
