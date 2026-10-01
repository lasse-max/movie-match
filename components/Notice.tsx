import type { ReactNode } from "react";
import { display, label } from "./palace";

/**
 * A plain notice in the house style (kicker, headline, one line, actions), for the
 * safety-net states with no board of their own: "Nothing's included tonight" and
 * "Nothing watchable tonight", in Round 3 and the tiebreak.
 */
export function Notice({
  kicker,
  title,
  body,
  children,
}: {
  kicker: string;
  title: string;
  body: string;
  /** The actions, stacked. */
  children: ReactNode;
}) {
  return (
    <div className="pp-enter flex min-h-full flex-1 flex-col gap-[26px]">
      <div className="flex flex-1 flex-col justify-center gap-2.5">
        <span className={`${label} text-brass`}>{kicker}</span>
        <h1 className={`${display} text-[46px] leading-[0.88]`}>{title}</h1>
        <p className="text-[15px] leading-[1.5] text-cream/75">{body}</p>
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}
