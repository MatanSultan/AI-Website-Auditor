"use client";
import { PayPalButtons,PayPalScriptProvider } from "@paypal/react-paypal-js";
import { useRouter } from "next/navigation";
const clientId=process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
export function PayPalPurchase({auditId}:{auditId:string}){const router=useRouter();if(!clientId)return <button className="button disabled-button" disabled>רכישה אינה זמינה במצב הדגמה</button>;return <PayPalScriptProvider options={{clientId,currency:'ILS',intent:'capture'}}><PayPalButtons style={{layout:'vertical',shape:'rect',label:'pay'}} createOrder={async()=>{const response=await fetch('/api/paypal/orders',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({auditId})});if(!response.ok)throw new Error('CREATE_FAILED');return (await response.json() as {id:string}).id}} onApprove={async(data)=>{const response=await fetch(`/api/paypal/orders/${data.orderID}/capture`,{method:'POST',headers:{'Idempotency-Key':`capture-${data.orderID}`}});if(!response.ok)throw new Error('CAPTURE_FAILED');router.push(`/audit/${auditId}/report`)}}/></PayPalScriptProvider>}

