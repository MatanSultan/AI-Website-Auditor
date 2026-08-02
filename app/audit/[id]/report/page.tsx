import { FullReport } from "@/components/full-report";
export default async function ReportPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <FullReport id={id}/>}

