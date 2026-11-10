// The two mountain ridgelines pinned to the bottom of the header, drawn after the logo so they layer on top.
// Inline SVG so the colors are the tokens --ridge-back / --ridge-front (and their darker -low shades) in styles/tokens.css.
// Traced from the team logo; the viewBox is stretched to the header's width.
const BACK = "M0 32 L0 11.4 L16 13.2 L33 12.4 L49 9.8 L66 6.0 L82 5.4 L99 8.2 L115 10.8 L132 11.6 L148 11.0 L165 11.6 L181 8.2 L197 7.4 L214 6.2 L230 4.0 L247 5.2 L263 7.6 L280 10.2 L296 11.0 L313 11.6 L329 12.4 L346 10.0 L362 8.4 L379 10.4 L395 9.4 L411 8.2 L428 5.6 L444 3.0 L461 2.0 L477 4.4 L494 7.4 L510 9.2 L527 10.6 L543 11.8 L560 12.6 L576 13.8 L592 12.0 L609 12.4 L625 10.8 L642 8.8 L658 9.2 L675 10.4 L691 9.4 L708 7.0 L724 4.0 L741 3.0 L757 5.6 L773 10.0 L790 9.2 L806 6.8 L823 8.4 L839 11.2 L856 11.4 L872 11.4 L889 12.4 L905 11.8 L922 10.2 L938 8.6 L955 6.0 L971 6.8 L987 5.2 L1004 5.6 L1020 7.2 L1037 7.6 L1053 9.8 L1070 10.8 L1086 12.4 L1103 14.0 L1119 14.4 L1136 13.6 L1152 12.0 L1168 12.4 L1185 11.4 L1201 11.2 L1218 8.8 L1234 8.0 L1251 6.0 L1267 4.6 L1284 6.6 L1300 8.8 L1317 12.2 L1333 13.2 L1349 12.6 L1366 11.2 L1382 8.4 L1399 7.6 L1415 5.4 L1432 8.4 L1440 8.4 L1440 32 Z";
const FRONT = "M0 32 L0 23.2 L16 21.6 L33 22.8 L49 21.6 L66 20.4 L82 19.2 L99 17.2 L115 17.6 L132 18.0 L148 18.4 L165 19.2 L181 22.0 L197 23.6 L214 24.4 L230 24.4 L247 26.4 L263 24.8 L280 23.6 L296 21.6 L313 21.2 L329 21.2 L346 20.4 L362 19.6 L379 19.6 L395 21.2 L411 23.6 L428 24.4 L444 25.6 L461 24.8 L477 24.0 L494 23.6 L510 22.0 L527 22.8 L543 23.2 L560 24.8 L576 26.0 L592 27.6 L609 29.2 L625 30.4 L642 28.4 L658 27.2 L675 26.4 L691 27.6 L708 27.6 L724 28.4 L741 29.2 L757 30.0 L773 28.8 L790 29.2 L806 29.2 L823 28.4 L839 26.4 L856 23.2 L872 22.8 L889 22.0 L905 20.4 L922 18.4 L938 17.6 L955 15.2 L971 16.4 L987 18.4 L1004 19.6 L1020 20.8 L1037 21.6 L1053 22.0 L1070 21.2 L1086 20.8 L1103 20.8 L1119 21.6 L1136 21.6 L1152 22.8 L1168 25.2 L1185 24.8 L1201 23.6 L1218 24.4 L1234 26.4 L1251 26.8 L1267 27.2 L1284 28.8 L1300 29.2 L1317 29.2 L1333 27.6 L1349 26.4 L1366 25.6 L1382 23.6 L1399 21.2 L1415 20.0 L1432 19.6 L1440 19.6 L1440 32 Z";

export default function Ridges() {
  return (
    <svg className="tv2-ridge" viewBox="0 0 1440 32" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="tv2-ridge-back" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--ridge-back)" }} />
          <stop offset="1" style={{ stopColor: "var(--ridge-back-low)" }} />
        </linearGradient>
        <linearGradient id="tv2-ridge-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--ridge-front)" }} />
          <stop offset="1" style={{ stopColor: "var(--ridge-front-low)" }} />
        </linearGradient>
      </defs>
      <path fill="url(#tv2-ridge-back)" d={BACK} />
      <path fill="url(#tv2-ridge-front)" d={FRONT} />
    </svg>
  );
}
