import { notFound } from "next/navigation";

// Any URL no portfolio route matches ends here, so the portfolio's own
// not-found.tsx serves it. With two root layouts there is no top-level
// layout to compose a shared 404 from (see not-found.md).
export default function CatchAll() {
  notFound();
}
