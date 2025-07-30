import { useState, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { NetworkStatus } from '@/components/NetworkStatus';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFirestore } from '@/hooks/useFirestore';
import { Ferme } from '@shared/types';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Building2,
  Users,
  Home,
  Settings,
  LogOut,
  Menu,
  BedDouble,
  BarChart3,
  Package,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const { user, logout, isSuperAdmin, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { data: fermes } = useFirestore<Ferme>('fermes');

  const getFermeName = (fermeId: string) => {
    if (!fermeId) return '-';
    if (!fermes || fermes.length === 0) return fermeId; // Still loading or no fermes data
    const ferme = fermes.find(f => f.id === fermeId);
    return ferme?.nom || fermeId; // Fallback to ID if ferme not found
  };

  const navigation = [
    {
      name: 'Tableau de bord',
      href: '/',
      icon: Home,
      show: true
    },
    {
      name: 'Fermes',
      href: '/fermes',
      icon: Building2,
      show: isSuperAdmin
    },
    {
      name: 'Ouvriers',
      href: '/ouvriers',
      icon: Users,
      show: true
    },
    {
      name: 'Chambres',
      href: '/chambres',
      icon: BedDouble,
      show: true
    },
    {
      name: 'Stock',
      href: '/stock',
      icon: Package,
      show: true
    },
    {
      name: 'Statistiques',
      href: '/statistiques',
      icon: BarChart3,
      show: true
    },
    {
      name: 'Administration',
      href: '/admin',
      icon: Settings,
      show: isSuperAdmin
    }
  ];

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase();
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'superadmin': return 'Super Administrateur';
      case 'admin': return 'Administrateur';
      case 'user': return 'Utilisateur';
      default: return role;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg">
                  <Building2 className="h-6 w-6 text-white" />
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-xl font-bold text-gray-900">
                    Gestion des Secteurs
                  </h1>
                  {user?.fermeId && (
                    <p className="text-sm text-gray-500">
                      Ferme: {getFermeName(user.fermeId)}
                    </p>
                  )}
                </div>
                <div className="sm:hidden">
                  <h1 className="text-lg font-bold text-gray-900">
                    Secteurs
                  </h1>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Mobile menu button */}
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Toggle menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[280px] sm:w-[300px]">
                  <div className="flex flex-col space-y-4">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg">
                        <Building2 className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-gray-900">
                          Gestion des Secteurs
                        </h2>
                        {user?.fermeId && (
                          <p className="text-sm text-gray-500">
                            Ferme: {getFermeName(user.fermeId)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {navigation
                        .filter(item => item.show)
                        .map((item) => {
                          const isActive = location.pathname === item.href;
                          return (
                            <Link
                              key={item.name}
                              to={item.href}
                              onClick={() => setIsMobileMenuOpen(false)}
                              className={cn(
                                'flex items-center px-3 py-3 text-base font-medium rounded-md transition-colors w-full',
                                isActive
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                              )}
                            >
                              <item.icon className="mr-3 h-5 w-5" />
                              {item.name}
                            </Link>
                          );
                        })}
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm">
                        {getInitials(user?.nom || '')}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user?.nom}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user?.email}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {getRoleLabel(user?.role || '')}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/parametres')}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Paramètres</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Se déconnecter</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Secondary Navigation - Hidden on mobile, shown on desktop */}
        <div className="mb-6 sm:mb-8 hidden md:block">
          <nav className="flex space-x-4 lg:space-x-8 overflow-x-auto">
            {navigation
              .filter(item => item.show)
              .map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap',
                      isActive
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    )}
                  >
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
          </nav>
        </div>

        {/* Network Status */}
        <NetworkStatus />

        {/* Page Content */}
        {children}
      </div>
    </div>
  );
};
