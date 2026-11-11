"use client";
export function WhatsAppConsent({dark=false,onChange,checked}:{dark?:boolean;checked?:boolean;onChange?:(checked:boolean)=>void}) {
  return <label className={`flex items-start gap-3 text-[13px] leading-relaxed sm:col-span-2 ${dark ? "text-ivory/80" : "text-muted"}`}><input type="checkbox" name="whatsappConsent" value="yes" checked={checked} className="mt-1 h-4 w-4 shrink-0" onChange={e=>onChange?.(e.target.checked)}/><span>Send me WhatsApp updates about this enquiry, my orders and service appointments. Use a phone number with country code (for example +91 98765 43210). Optional; reply STOP to opt out.</span></label>;
}

