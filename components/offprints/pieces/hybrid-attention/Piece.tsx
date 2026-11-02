import type { Piece } from "@/content/offprints/pieces";
import { hybridAttention as copy } from "@/content/offprints/hybrid-attention";
import { Figure } from "@/components/offprints/Figure";
import { PieceFrame, withCites } from "@/components/offprints/PieceFrame";

/**
 * No. 1, Hybrid attention. Figure 1 is a placeholder box until Task 10
 * builds the real attention figure; its caption and nudge are already the
 * real copy. The displayed equation is a plain centred line until Task 7's
 * Equation environment exists.
 */
export function HybridAttentionPiece({ piece }: { piece: Piece }) {
  return (
    <PieceFrame
      piece={piece}
      abstract={copy.abstract}
      why={<p>{withCites(copy.why)}</p>}
      words={
        <>
          <p className="my-2.5">{withCites(copy.words.before)}</p>
          <p className="my-5 text-center text-[17px] italic">
            {copy.words.equation.lhs} = {copy.words.equation.rhs}
          </p>
          <p className="my-2.5">{withCites(copy.words.after)}</p>
        </>
      }
    >
      <Figure n={1} caption={copy.figure1.caption} tryText={copy.figure1.nudge}>
        <div className="grid h-[220px] place-items-center border border-dashed border-rule text-mut italic">
          {copy.figure1.placeholder}
        </div>
      </Figure>
    </PieceFrame>
  );
}
