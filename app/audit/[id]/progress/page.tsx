import { AuditProgress } from "@/components/audit-progress";
export default async function ProgressPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <AuditProgress id={id}/>}

