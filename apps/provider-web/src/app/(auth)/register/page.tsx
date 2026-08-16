import Link from "next/link";

const FACILITY_REGISTRATION_URL = "https://admin.streetdocmd.com/register/facility";

export default function RegisterFork() {
  return (
    <div className="w-full max-w-3xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white">StreetdocMD</h1>
        <p className="text-navy-100 mt-1 text-sm">How are you joining?</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Link
          href="/register/individual"
          className="bg-white rounded-2xl shadow-xl p-6 flex flex-col hover:shadow-2xl hover:-translate-y-0.5 transition-all"
        >
          <span className="text-3xl mb-3">🩺</span>
          <h2 className="text-lg font-bold text-gray-900">Individual practitioner</h2>
          <p className="text-sm text-gray-500 mt-1.5 flex-1">
            You personally visit patients at home and get bookings sent directly to you.
          </p>
          <ul className="text-xs text-gray-400 mt-4 space-y-1">
            <li>• Medical Doctor — General or Specialist</li>
            <li>• Registered Nurse</li>
            <li>• Physiotherapist</li>
            <li>• Medical Laboratory Scientist</li>
          </ul>
          <span className="btn-primary w-full text-center mt-5">Register as an individual →</span>
        </Link>

        <a
          href={FACILITY_REGISTRATION_URL}
          className="bg-white rounded-2xl shadow-xl p-6 flex flex-col hover:shadow-2xl hover:-translate-y-0.5 transition-all"
        >
          <span className="text-3xl mb-3">🏥</span>
          <h2 className="text-lg font-bold text-gray-900">Organization</h2>
          <p className="text-sm text-gray-500 mt-1.5 flex-1">
            Your business partners with StreetdocMD — a hospital, laboratory, or pharmacy.
          </p>
          <ul className="text-xs text-gray-400 mt-4 space-y-1">
            <li>• Hospital</li>
            <li>• Medical Laboratory</li>
            <li>• Pharmacy</li>
          </ul>
          <span className="btn-teal w-full text-center mt-5">Register an organization →</span>
        </a>
      </div>

      <p className="text-center text-sm text-navy-100 mt-6">
        Already registered?{" "}
        <Link href="/login" className="text-white font-medium hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
