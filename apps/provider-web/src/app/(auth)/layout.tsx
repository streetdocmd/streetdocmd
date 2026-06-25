export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-800 to-navy-900 flex items-center justify-center p-4">
      {children}
    </div>
  );
}