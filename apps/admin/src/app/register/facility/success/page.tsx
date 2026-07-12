import Link from "next/link";

export const metadata = { title: "Application Submitted — StreetdocMD" };

export default function FacilityRegSuccessPage({
  searchParams,
}: {
  searchParams: { email?: string; name?: string };
}) {
  const email = searchParams.email ?? "";
  const name  = searchParams.name  ?? "your facility";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto text-4xl">✓</div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Application Submitted</h1>
          <p className="text-gray-500 mt-2">
            Thank you for applying to join the StreetdocMD partner network.
          </p>
        </div>

        <div className="card p-5 text-left space-y-3">
          <p className="text-sm font-semibold text-gray-700">{name}</p>
          <p className="text-sm text-gray-600">
            Your application is under review. We will contact you at{" "}
            {email ? <strong>{email}</strong> : "the email you provided"} within 48 hours.
          </p>
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs text-gray-500">
              Questions? Contact us on WhatsApp:{" "}
              <a href="https://wa.me/2347063216791" target="_blank" rel="noopener noreferrer"
                className="text-teal-600 font-semibold hover:underline">
                07063216791
              </a>
            </p>
          </div>
        </div>

        <Link href="/" className="inline-block text-sm text-gray-400 hover:text-gray-600 underline">
          Return to home
        </Link>
      </div>
    </div>
  );
}
