import Link from "next/link";
import { Stethoscope, Building2, ArrowRight } from "lucide-react";
import AuthBrand from "@/components/AuthBrand";

const FACILITY_REGISTRATION_URL = "https://admin.streetdocmd.com/register/facility";

export default function RegisterFork() {
  return (
    <div className="w-full max-w-3xl">
      <AuthBrand subtitle="How are you joining StreetdocMD?" />

      <div className="grid gap-5 sm:grid-cols-2">
        <Link
          href="/register/individual"
          className="group bg-white rounded-2xl shadow-xl p-6 flex flex-col hover:shadow-2xl hover:-translate-y-0.5 transition-all"
        >
          <div className="w-11 h-11 rounded-xl bg-blue-light flex items-center justify-center mb-4">
            <Stethoscope size={22} className="text-blue-brand" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Individual practitioner</h2>
          <p className="text-sm text-gray-500 mt-1.5 flex-1">
            You personally visit patients at home and get bookings sent directly to you.
          </p>
          <ul className="text-xs text-gray-500 mt-4 space-y-1">
            <li>• Medical Doctor — General or Specialist</li>
            <li>• Registered Nurse</li>
            <li>• Physiotherapist</li>
            <li>• Medical Laboratory Scientist</li>
          </ul>
          <span className="btn-primary w-full mt-5 inline-flex items-center justify-center gap-1.5">
            Register as an individual <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
          </span>
        </Link>

        <a
          href={FACILITY_REGISTRATION_URL}
          className="group bg-white rounded-2xl shadow-xl p-6 flex flex-col hover:shadow-2xl hover:-translate-y-0.5 transition-all"
        >
          <div className="w-11 h-11 rounded-xl bg-teal-light flex items-center justify-center mb-4">
            <Building2 size={22} className="text-teal-brand" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Organization</h2>
          <p className="text-sm text-gray-500 mt-1.5 flex-1">
            Your business partners with StreetdocMD — a hospital, laboratory, or pharmacy.
          </p>
          <ul className="text-xs text-gray-500 mt-4 space-y-1">
            <li>• Hospital</li>
            <li>• Medical Laboratory</li>
            <li>• Pharmacy</li>
          </ul>
          <span className="btn-teal w-full mt-5 inline-flex items-center justify-center gap-1.5">
            Register an organization <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
          </span>
        </a>
      </div>

      <p className="text-center text-sm text-blue-200 mt-6">
        Already registered?{" "}
        <Link href="/login" className="text-white font-medium hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
