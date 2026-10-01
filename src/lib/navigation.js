import { BarChart3, CalendarDays, ClipboardList, FileText, FolderOpen, LayoutDashboard, Receipt, Settings, Users, WalletCards } from 'lucide-react'

export const navigationItems = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Clients', path: '/clients', icon: Users, description: 'Retrouvez et suivez vos clients.' },
  { label: 'Chantiers', path: '/chantiers', icon: ClipboardList, description: 'Centralisez vos chantiers et interventions.' },
  { label: 'Devis', path: '/devis', icon: FileText, description: 'Préparez vos prochains devis.' },
  { label: 'Factures', path: '/factures', icon: Receipt, description: 'Retrouvez vos documents de facturation.' },
  { label: 'Dépenses', path: '/depenses', icon: Receipt, description: 'Suivez les dépenses liées à votre activité.' },
  { label: 'Caisse', path: '/caisse', icon: WalletCards, description: 'Consultez les entrées, sorties et le solde.' },
  { label: 'Agenda', path: '/agenda', icon: CalendarDays, description: 'Organisez vos rendez-vous et interventions.' },
  { label: 'Documents', path: '/documents', icon: FolderOpen, description: 'Accédez à vos documents professionnels.' },
  { label: 'Rapports', path: '/rapports', icon: BarChart3, description: 'Consultez une synthèse de votre activité.' },
  { label: 'Paramètres', path: '/parametres', icon: Settings, description: 'Configurez votre espace de travail.' },
]