import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  interpolate,
  staticFile,
  Video,
} from "remotion";
import { EASE_OUT } from "../../design/motion";

/**
 * TestClip — talking head with word-by-word captions and rolling number.
 */

const WORDS: Array<[string, number, number]> = [
  ["This", 0, 400],
  ["is", 450, 700],
  ["my", 750, 1000],
  ["first", 1050, 1400],
  ["test.", 1450, 1900],
  ["The", 2100, 2400],
  ["number", 2450, 2800],
  ["is", 2850, 3100],
  ["42,", 3150, 3600],
  ["and", 3800, 4100],
  ["these", 4150, 4500],
  ["captions", 4550, 5000],
  ["should", 5050, 5400],
  ["match", 5450, 5800],
  ["every", 5850, 6200],
  ["word", 6250, 6600],
  ["I", 6650, 6900],
  ["say.", 6950, 7500],
];

const TOTAL_MS = 7600;

export default function TestClip() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;

  const activeIndex = WORDS.findIndex(([, s, e]) => currentMs >= s && currentMs < e);

  // Rolling "42"
  const fortyTwo = WORDS.find(([w]) => w === "42,")!;
  const rollStart = fortyTwo[1];
  const rollT = Math.min(Math.max((currentMs - rollStart) / 400, 0), 1);
  const rollEased = interpolate(rollT, [0, 1], [0, 1], { easing: EASE_OUT });
  const rollOpacity = rollT > 0 ? Math.min(rollT / 0.4, 1) : 0;
  const rollFade = currentMs > fortyTwo[2] + 3000
    ? Math.max(0, 1 - (currentMs - fortyTwo[2] - 3000) / 600)
    : 1;
  const finalRollOpacity = rollOpacity * rollFade;

  return (
    <AbsoluteFill>
      <Video
        src={staticFile("test-clip.mp4")}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />

      {finalRollOpacity > 0.01 && (
        <div
          style={{
            position: "absolute",
            top: "16%",
            left: "50%",
            transform: `translate(-50%, ${-20 * (1 - rollEased)}px) scale(${0.85 + 0.15 * rollEased})`,
            opacity: finalRollOpacity,
            fontFamily: "'Inter', sans-serif",
            fontSize: 160,
            fontWeight: 700,
            color: "#FF4D2D",
            textShadow: "0 2px 24px rgba(0,0,0,0.6)",
            zIndex: 10,
          }}
        >
          42
        </div>
      )}

      <div
        style={{
          position: "absolute",
          bottom: 120,
          left: 0,
          right: 0,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 10,
          padding: "0 48px",
          zIndex: 10,
        }}
      >
        {WORDS.map(([word, s, e], i) => {
          const isActive = activeIndex === i;
          const isPast = activeIndex > i;
          return (
            <span
              key={i}
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 52,
                fontWeight: isActive ? 700 : 500,
                color: "#FFFFFF",
                opacity: isActive ? 1 : isPast ? 0.75 : 0.45,
                textShadow: isActive
                  ? "0 2px 16px rgba(0,0,0,0.85), 0 0 4px rgba(0,0,0,0.5)"
                  : "0 1px 8px rgba(0,0,0,0.5)",
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
