import { AuditResults } from "@/components/audit-results";
export default async function ResultsPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <AuditResults id={id}/>}

