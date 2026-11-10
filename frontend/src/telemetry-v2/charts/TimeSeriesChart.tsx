import * as echarts from "echarts";
import ReactECharts from "echarts-for-react";
import { useRef } from "react";
import { useResize } from "../hooks/useResize";

// time charts share one echarts group: hovering one moves the cursor on all of them
const CURSOR_GROUP = "tv2-time";
echarts.connect(CURSOR_GROUP);

// The only ECharts wrapper. A time chart filling its box: the canvas is absolutely positioned, so it can never push
// the box bigger or keep it small, and it is resized explicitly whenever the box changes.
export default function TimeSeriesChart({ option }: { option: object }) {
  const chart = useRef<ReactECharts>(null);
  const box = useResize(() => chart.current?.getEchartsInstance().resize());
  return (
    <div className="tv2-chart" ref={box} onMouseLeave={() => chart.current?.getEchartsInstance().dispatchAction({ type: "hideTip" })}>
      <ReactECharts ref={chart} option={option} style={{ position: "absolute", inset: 0, height: "auto" }} onChartReady={(c) => { c.group = CURSOR_GROUP; }} />
    </div>
  );
}
