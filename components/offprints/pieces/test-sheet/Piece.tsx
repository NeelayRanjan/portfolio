import type { Piece } from "@/content/offprints/pieces";
import { testSheet as copy } from "@/content/offprints/test-sheet";
import { Figure } from "@/components/offprints/Figure";
import { PieceFrame } from "@/components/offprints/PieceFrame";

/**
 * No. 0, the fixture (spec §10.1): a draft that never ships, here so the
 * index and the checks have a second entry. It carries one section of its
 * own so the frame's running numbers are exercised (1, then "Why it matters
 * now" as 2). Task 7 adds a live Definition, table and equation here.
 */
export function TestSheetPiece({ piece }: { piece: Piece }) {
  return (
    <PieceFrame
      piece={piece}
      abstract={copy.abstract}
      sections={[{ heading: copy.section.heading, body: <p>{copy.section.body}</p> }]}
      why={<p>{copy.why}</p>}
    >
      <Figure n={1} caption={copy.figure1.caption} tryText={copy.figure1.nudge}>
        <div className="grid h-[120px] place-items-center border border-dashed border-rule text-mut italic">
          {copy.figure1.placeholder}
        </div>
      </Figure>
    </PieceFrame>
  );
}
