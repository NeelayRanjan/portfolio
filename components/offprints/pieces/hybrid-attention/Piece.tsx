import type { Piece } from "@/content/offprints/pieces";
import { hybridAttention as copy } from "@/content/offprints/hybrid-attention";
import { Figure } from "@/components/offprints/Figure";
import { Equation } from "@/components/offprints/Equation";
import { PieceFrame, withCites } from "@/components/offprints/PieceFrame";
import { Figure1Attention } from "./Figure1Attention";
import figure1 from "@/content/offprints/hybrid-attention/figure1.json";

/**
 * No. 1, Hybrid attention. Figure 1 is one attention head of the model
 * reading a sentence, from weights extracted by the derive script (see
 * Figure1Attention). The displayed equation uses the Equation environment.
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
          <Equation n={1}>
            {copy.words.equation.lhs} = {copy.words.equation.rhs}
          </Equation>
          <p className="my-2.5">{withCites(copy.words.after)}</p>
        </>
      }
    >
      <Figure n={1} caption={copy.figure1.caption} tryText={copy.figure1.nudge}>
        <Figure1Attention data={figure1} copy={{ figure1: copy.figure1, definitions: copy.definitions }} />
      </Figure>
    </PieceFrame>
  );
}
