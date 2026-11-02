import type { Piece } from "@/content/offprints/pieces";
import { testSheet as copy } from "@/content/offprints/test-sheet";
import { Figure } from "@/components/offprints/Figure";
import { Definition } from "@/components/offprints/Definition";
import { Booktabs } from "@/components/offprints/Booktabs";
import { Equation } from "@/components/offprints/Equation";
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
      sections={[
        {
          heading: copy.section.heading,
          body: (
            <>
              <p>{copy.section.body}</p>
              <Definition n={1} term={copy.definition.term} symbol={copy.definition.symbol} role="ink">
                {copy.definition.body}
              </Definition>
              <Booktabs n={1} caption={copy.table.caption} head={[...copy.table.head]} rows={copy.table.rows.map((r) => [...r])} align={["left", "right"]} />
              <Equation n={1}>
                {copy.equation.lhs.base}<sub>{copy.equation.lhs.sub}</sub> = {copy.equation.rhs.base}<sub>{copy.equation.rhs.sub}</sub> {copy.equation.rhs.tail}
              </Equation>
            </>
          ),
        },
      ]}
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
