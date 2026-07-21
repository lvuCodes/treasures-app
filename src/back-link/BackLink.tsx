import "./back-link.css";

// Back link to the author's home page. Overlays the shell's top-left corner
// (the shell is the positioned ancestor) so it never displaces the header.
export function BackLink({
  href = "https://lvucodes.github.io",
  label = "← Home",
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
