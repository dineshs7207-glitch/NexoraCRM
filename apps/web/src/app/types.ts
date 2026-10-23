export type Stage = 'New' | 'Contacted' | 'Qualified' | 'Proposal' | 'Won' | 'Lost';
export type Priority = 'High' | 'Medium' | 'Low';
export interface Lead {
  id: string; name: string; company: string; email: string; phone: string; stage: Stage;
  source: string; owner: string; lastContact: string; location: string; priority: Priority;
  tags: string[]; nextFollowUp: string; activity: { title: string; detail: string; time: string }[];
}
export interface Deal { id: string; company: string; title: string; amount: number; stage: Stage; owner: string; probability: number; closeDate: string; }
export interface Task { id: string; title: string; priority: Priority; due: string; status: 'In Progress' | 'Pending' | 'Done'; detail: string; related: string; assignee: string; }
export interface CalendarEvent { id: string; title: string; date: string; time: string; duration: number; kind: 'Meeting' | 'Call' | 'Task' | 'Personal'; }
export interface EmailItem { id: string; from: string; email: string; to?: string; leadId?:string; subject: string; preview: string; date: string; body: string; folder: string; unread: boolean; }
export interface TeamUser { id: string; name: string; email: string; role: 'Admin' | 'Manager' | 'Employee' | 'Viewer'; team: string; lastLogin: string; status: 'Active' | 'Invited' | 'Deactivated'; }
export interface AuditEntry { id: string; time: string; occurredAt?:string; user: string; action: string; target: string; type: string; }
export interface Ticket { id:string; ticketNumber:string; leadId:string; title:string; description:string; priority:Priority; status:'Open'|'In Progress'|'Resolved'; dueAt:string; createdAt:string; }
export interface InvoiceLine { description:string; quantity:number; unitPrice:number; }
export interface Invoice { id:string; leadId:string; number:string; companyName:string; customerName:string; customerCompany:string; date:string; taxRate:number; lines:InvoiceLine[]; }
export interface CRMData { leads: Lead[]; deals: Deal[]; tasks: Task[]; events: CalendarEvent[]; emails: EmailItem[]; users: TeamUser[]; audit: AuditEntry[]; tickets:Ticket[]; invoices:Invoice[]; }
