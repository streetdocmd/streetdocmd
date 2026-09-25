type ButtonProps = {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "outline";
  arrow?: boolean;
};

export default function Button({ href, children, variant = "primary", arrow = false }: ButtonProps) {
  return (
    <a href={href} className={`btn btn-${variant}`}>
      {children}
      {arrow && <img src="/images/icon-arrow.svg" alt="" width={16} height={16} />}
    </a>
  );
}
