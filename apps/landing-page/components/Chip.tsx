type ChipProps = {
  icon: string;
  label: string;
  tall?: boolean;
  className?: string;
};

export default function Chip({ icon, label, tall = false, className = "" }: ChipProps) {
  return (
    <div className={`chip ${tall ? "chip-tall" : ""} ${className}`}>
      <img src={icon} alt="" width={24} height={24} />
      <span>{label}</span>
    </div>
  );
}
