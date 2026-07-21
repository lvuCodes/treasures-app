import "./back-link.css";

export const DEFAULT_HREF = "https://lvucodes.github.io";
export const DEFAULT_LABEL = "← lvuCodes";

// Back link to the author's home page. Overlays the shell's top-left corner
// (the shell is the positioned ancestor) so it never displaces the header.
export function BackLink({
  href = DEFAULT_HREF,
  label = DEFAULT_LABEL,
}: {
  href?: string;
  label?: string;
}) {
  return (
    <nav className="back-nav">
      <a className="pill" href={href}>
        {label}
      </a>
    </nav>
  );
}
