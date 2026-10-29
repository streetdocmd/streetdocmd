import { redirect } from "next/navigation";

// Lab orders now live on one page for both doctor and self-service orders
export default function LabOrderTrackingPage({ params }: { params: { orderId: string } }) {
  redirect(`/dashboard/investigations/${params.orderId}`);
}
