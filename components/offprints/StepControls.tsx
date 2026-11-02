"use client";

export function StepControls({
  position,
  max,
  playing,
  onStep,
  onPlayToggle,
  labels,
}: {
  position: number;
  max: number;
  playing: boolean;
  onStep: (n: number) => void;
  onPlayToggle: () => void;
  labels: { prev: string; play: string; pause: string; next: string; position: string };
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="op-tool" aria-label={labels.prev} onClick={() => onStep(Math.max(0, position - 1))}>
        ◂
      </button>
      <button type="button" className="op-tool op-tool--primary" onClick={onPlayToggle}>
        {playing ? labels.pause : labels.play}
      </button>
      <button type="button" className="op-tool" aria-label={labels.next} onClick={() => onStep(Math.min(max, position + 1))}>
        ▸
      </button>
      <input
        type="range"
        className="op-min min-w-[120px] flex-1"
        aria-label={labels.position}
        min={0}
        max={max}
        value={position}
        onChange={(e) => onStep(Number(e.target.value))}
      />
    </div>
  );
}
