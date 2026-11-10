import Logo from "./Logo";
import Pivot from "./Pivot";
import Ridges from "./Ridges";
import StatusArea from "./StatusArea";

type Props = React.ComponentProps<typeof StatusArea> & React.ComponentProps<typeof Pivot> & { onLogoHold: () => void };

// The red header: logo, ridges, preset pivot and the status area. Sticky at the top of the page.
export default function Header({ onLogoHold, active, dir, go, ...status }: Props) {
  return (
    <header className="tv2-top">
      <Logo onHold={onLogoHold} />
      <Ridges />
      <Pivot active={active} dir={dir} go={go} />
      <StatusArea {...status} />
    </header>
  );
}
