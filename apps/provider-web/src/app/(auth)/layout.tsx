export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] items-start justify-center bg-page px-5 pb-10 pt-10">
      {children}
    </div>
  );
}
