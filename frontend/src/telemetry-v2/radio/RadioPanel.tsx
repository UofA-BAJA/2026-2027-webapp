import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { Link } from "react-router-dom";
import { COMMANDS, DEFAULT_DATA_TYPES, ESTOP_HOLD_MS, FREQ_DEFAULT, FREQ_MAX, FREQ_MIN, FREQ_STEP } from "../config/radio";
import { RADIO_PANEL_WIDTH } from "../config/theme";
import { clock, mss } from "../lib/format";
import type { Stream } from "../lib/stream";
import CommandButton from "./CommandButton";
import DataTypePicker from "./DataTypePicker";
import { sendCommand } from "./sendCommand";

type Props = { s: Stream; live: boolean; dbm: string; perSec: number; trigger: RefObject<HTMLButtonElement | null>; open: boolean; onClose: () => void };

// The radio panel hanging from the signal readout. Every send goes through sendCommand() and shows its result.
export default function RadioPanel({ s, live, dbm, perSec, trigger, open, onClose }: Props) {
  const [tenths, setTenths] = useState(Math.round(FREQ_DEFAULT * 10)); // MHz × 10, so 0.1 steps never drift
  const [types, setTypes] = useState<number[]>(DEFAULT_DATA_TYPES);
  const [typesOpen, setTypesOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [holdAt, setHoldAt] = useState<number>();
  const [result, setResult] = useState<{ where: string; text: string }>();
  const [right, setRight] = useState(16);
  const holdTimer = useRef<number>(undefined);
  const panel = useRef<HTMLDivElement>(null);

  const now = Date.now();
  const age = s.lastAt ? now - s.lastAt : Infinity;

  const send = (where: string, label: string, code: number, payload?: number | number[]) => {
    const r = sendCommand(code, payload);
    setResult({ where, text: `${label} (${code}) · ${r.ok ? "sent" : `not sent: ${r.reason}`} · ${clock(Date.now())}` });
  };
  const shown = (where: string) => result?.where === where && <p className="tv2-rp-result" role="status">{result.text}</p>;

  // emergency stop: press and hold; letting go earlier cancels
  const startHold = () => {
    if (!live || holdAt !== undefined) return;
    setHoldAt(Date.now());
    holdTimer.current = window.setTimeout(() => {
      setHoldAt(undefined);
      send("estop", "emergency stop", COMMANDS.EMERGENCY_STOP);
    }, ESTOP_HOLD_MS);
  };
  const cancelHold = () => {
    window.clearTimeout(holdTimer.current);
    setHoldAt(undefined);
  };

  // closing the panel (Esc, click outside) or losing the link mid-hold must cancel the emergency stop
  useEffect(() => {
    if (!open || !live) cancelHold();
  }, [open, live]);

  // right-aligned under the readout, but never off screen; Esc or a click outside closes
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const b = trigger.current!.getBoundingClientRect();
      const w = Math.min(RADIO_PANEL_WIDTH, innerWidth - 32);
      setRight(Math.min(Math.max(16, innerWidth - b.right), innerWidth - 16 - w));
    };
    place();
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !panel.current?.contains(e.target as Node) && !trigger.current?.contains(e.target as Node)) onClose();
    };
    addEventListener("resize", place);
    addEventListener("keydown", close);
    addEventListener("pointerdown", close);
    return () => {
      removeEventListener("resize", place);
      removeEventListener("keydown", close);
      removeEventListener("pointerdown", close);
    };
  }, [open]);

  if (!open) return null;
  const cmd = (label: string, code: number, effect: string, onClick = () => send("cmd", label, code)) => (
    <CommandButton label={label} code={code} effect={effect} disabled={!live} onClick={onClick} />
  );
  const step = (d: number) => setTenths((f) => Math.min(FREQ_MAX * 10, Math.max(FREQ_MIN * 10, f + d * Math.round(FREQ_STEP * 10))));
  const holdS = ESTOP_HOLD_MS / 1000;
  const held = holdAt === undefined ? 0 : Math.min(holdS, (now - holdAt) / 1000);

  return (
    <div ref={panel} className="tv2-radio-panel" role="dialog" aria-label="radio" style={{ right }}>
      <div className="tv2-rp-top">
        <h2>radio</h2>
        <span className={`tv2-link${live ? "" : " silent"}`}>
          <i aria-hidden />
          {live ? "live" : `silent ${mss(now - (s.lastAt || s.startedAt))}`}
        </span>
      </div>
      <div className={`tv2-rp-stats${live ? "" : " silent"}`}>
        <div><b>{live ? dbm : "—"}</b><small>signal dBm</small></div>
        <div><b>{age === Infinity ? "—" : (age / 1000).toFixed(1)}</b><small>last packet s ago</small></div>
        <div><b>{live ? perSec.toFixed(1) : "0.0"}</b><small>frames / s</small></div>
      </div>

      <section>
        <h3>frequency</h3>
        <div className="tv2-rp-row">
          <button className="tv2-rp-btn" onClick={() => step(-1)} aria-label="lower frequency">−</button>
          <output className="tv2-rp-freq" aria-live="polite">{(tenths / 10).toFixed(1)} MHz</output>
          <button className="tv2-rp-btn" onClick={() => step(1)} aria-label="raise frequency">+</button>
          <button className="tv2-rp-btn" onClick={() => send("freq", "set frequency", COMMANDS.RADIO_FREQUENCY_CHANGE, tenths / 10)}>set</button>
        </div>
        <p className="tv2-rp-note">{FREQ_MIN}–{FREQ_MAX} MHz · car and pit must match or the link drops</p>
        {shown("freq")}
      </section>

      <section>
        <h3>data from car</h3>
        <DataTypePicker types={types} setTypes={setTypes} open={typesOpen} setOpen={setTypesOpen} />
        <div className="tv2-rp-row">
          <button className="tv2-rp-btn" onClick={() => send("data", "apply data types", COMMANDS.RADIO_DATA_CHANGE, types)}>apply</button>
        </div>
        {shown("data")}
      </section>

      <section className={live ? "" : "tv2-rp-dim"}>
        <h3>commands</h3>
        {!live && <p className="tv2-rp-note">no link, commands can't reach the car right now</p>}
        <div className="tv2-rp-cmds">
          {cmd("start log", COMMANDS.START_LOG, "record + send live")}
          {cmd("end log", COMMANDS.END_LOG, "stop record + live", () => setConfirmEnd(true))}
          {cmd("retrieve", COMMANDS.RETRIEVE, "logs to pit")}
        </div>
        <div className="tv2-rp-cmds two">
          {cmd("check engine on", COMMANDS.ENABLE_CHECK_ENGINE, "dash light on")}
          {cmd("check engine off", COMMANDS.DISABLE_CHECK_ENGINE, "dash light off")}
        </div>
        <button className="tv2-rp-toggle" aria-expanded={testing} onClick={() => setTesting(!testing)}>testing {testing ? "▾" : "▸"}</button>
        {testing && (
          <div className="tv2-rp-cmds two">
            {cmd("start cam", COMMANDS.START_CAM, "testing")}
            {cmd("acceleration", COMMANDS.ACCELERATION, "testing")}
          </div>
        )}
        {shown("cmd")}
      </section>

      <section className={live ? "" : "tv2-rp-dim"}>
        <button
          className="tv2-rp-estop"
          disabled={!live}
          onPointerDown={startHold}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          onPointerCancel={cancelHold}
          onKeyDown={(e) => (e.key === " " || e.key === "Enter") && !e.repeat && startHold()}
          onKeyUp={(e) => (e.key === " " || e.key === "Enter") && cancelHold()}
        >
          <span>emergency stop</span>
          <small>HOLD {holdS} S · {COMMANDS.EMERGENCY_STOP}</small>
        </button>
        {shown("estop")}
      </section>

      <section>
        <h3>logs</h3>
        <Link className="tv2-rp-btn" to="/convert">export csv ↓</Link>
      </section>

      {confirmEnd && (
        <div className="tv2-rp-band blue" role="alertdialog" aria-label="end log?">
          <h4>end log?</h4>
          <p>The car stops recording and stops sending live data. Every tile freezes until a new log starts.</p>
          <div className="tv2-rp-row">
            <button className="tv2-rp-btn" onClick={() => setConfirmEnd(false)}>cancel</button>
            <button
              className="tv2-rp-btn strong"
              onClick={() => {
                setConfirmEnd(false);
                send("cmd", "end log", COMMANDS.END_LOG);
              }}
            >
              end log
            </button>
          </div>
        </div>
      )}
      {holdAt !== undefined && (
        <div className="tv2-rp-band red" role="status">
          <h4>keep holding…</h4>
          <div className="tv2-rp-progress"><i style={{ animationDuration: `${ESTOP_HOLD_MS}ms` }} /></div>
          <p>{held.toFixed(1)} of {holdS} s · let go to cancel</p>
        </div>
      )}
    </div>
  );
}
