import type { Piece } from "@/content/offprints/pieces";
import { hybridAttention as copy } from "@/content/offprints/hybrid-attention";
import { Figure } from "@/components/offprints/Figure";
import { Equation } from "@/components/offprints/Equation";
import { MathText } from "@/components/offprints/MathText";
import { PieceFrame, withCites } from "@/components/offprints/PieceFrame";
import { Figure1Attention } from "./Figure1Attention";
import figure1 from "@/content/offprints/hybrid-attention/figure1.json";
import { fillCaption } from "@/lib/offprints/figure1";

/**
 * No. 1, Hybrid attention. Figure 1 is one attention head of the model
 * reading a sentence, from weights extracted by the derive script (see
 * Figure1Attention). The displayed equation uses the Equation environment;
 * its maths and the inline symbols are composed by MathText from parts in the
 * content file.
 */
export function HybridAttentionPiece({ piece }: { piece: Piece }) {
  return (
    <PieceFrame
      piece={piece}
      abstract={copy.abstract}
      why={<p>{withCites(copy.why)}</p>}
      words={
        <>
          <p className="my-2.5">
            <MathText parts={copy.words.before} text={withCites} />
          </p>
          <Equation n={1}>
            <MathText parts={copy.words.equation.lhs} /> = <MathText parts={copy.words.equation.rhs} />
          </Equation>
          <p className="my-2.5">
            <MathText parts={copy.words.after} text={withCites} />
          </p>
        </>
      }
    >
      <Figure
        n={1}
        caption={fillCaption(copy.figure1.caption, figure1, copy.figure1.months)}
        tryText={copy.figure1.nudge}
      >
        <Figure1Attention data={figure1} copy={{ figure1: copy.figure1, definitions: copy.definitions }} />
      </Figure>
    </PieceFrame>
  );
}
