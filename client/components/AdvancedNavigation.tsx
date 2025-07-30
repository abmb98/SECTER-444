import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Menu,
  Search,
  Bell,
  Settings,
  Home,
  Building2,
  Users,
  BedDouble,
  BarChart3,
  Shield,
  Star,
  History,
  Bookmark,
  ChevronRight,
  X
} from 'lucide-react';

interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  description?: string;
  keywords: string[];
  favorite?: boolean;
}

const navigationItems: NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Tableau de bord',
    href: '/',
    icon: Home,
    description: 'Vue d\'ensemble et métriques principales',
    keywords: ['dashboard', 'tableau', 'accueil', 'overview', 'home']
  },
  {
    id: 'fermes',
    label: 'Fermes',
    href: '/fermes',
    icon: Building2,
    description: 'Gestion des fermes et sites',
    keywords: ['fermes', 'sites', 'locations', 'farms']
  },
  {
    id: 'workers',
    label: 'Ouvriers',
    href: '/ouvriers',
    icon: Users,
    description: 'Gestion des ouvriers et employés',
    keywords: ['ouvriers', 'workers', 'employees', 'staff', 'personnel']
  },
  {
    id: 'rooms',
    label: 'Chambres',
    href: '/chambres',
    icon: BedDouble,
    description: 'Gestion des chambres et logements',
    keywords: ['chambres', 'rooms', 'accommodation', 'housing']
  },
  {
    id: 'statistics',
    label: 'Statistiques',
    href: '/statistiques',
    icon: BarChart3,
    badge: 'Nouveau',
    description: 'Analytics et rapports détaillés',
    keywords: ['statistics', 'stats', 'analytics', 'reports', 'données']
  },
  {
    id: 'admin',
    label: 'Administration',
    href: '/admin',
    icon: Shield,
    description: 'Outils d\'administration système',
    keywords: ['admin', 'administration', 'settings', 'config']
  }
];

export function AdvancedNavigation() {
  const location = useLocation();
  const { user, isSuperAdmin } = useAuth();
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(['dashboard', 'statistics']);
  const [recentItems, setRecentItems] = useState<string[]>(['statistics', 'workers']);

  // Keyboard shortcut for command palette
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsCommandOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Generate breadcrumbs from current path
  const generateBreadcrumbs = () => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const breadcrumbs = [{ label: 'Accueil', href: '/' }];

    pathSegments.forEach((segment, index) => {
      const href = '/' + pathSegments.slice(0, index + 1).join('/');
      const item = navigationItems.find(item => item.href === href);
      if (item) {
        breadcrumbs.push({ label: item.label, href: item.href });
      }
    });

    return breadcrumbs;
  };

  const toggleFavorite = (itemId: string) => {
    setFavorites(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const addToRecent = (itemId: string) => {
    setRecentItems(prev => [
      itemId,
      ...prev.filter(id => id !== itemId).slice(0, 4)
    ]);
  };

  const filteredNavigationItems = navigationItems.filter(item => {
    if (!isSuperAdmin && item.id === 'admin') return false;
    return true;
  });

  const breadcrumbs = generateBreadcrumbs();

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden lg:block bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Main Navigation Bar */}
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              {/* Logo */}
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-slate-800 rounded-md">
                  <Building2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Gestion des Secteurs</h1>
                </div>
              </div>

              {/* Main Navigation Links */}
              <div className="flex space-x-1">
                {filteredNavigationItems.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.id}
                      to={item.href}
                      onClick={() => addToRecent(item.id)}
                      className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                        isActive
                          ? 'bg-slate-100 text-slate-900 border border-slate-200'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {item.label}
                      {item.badge && (
                        <Badge variant="outline" className="ml-2 text-xs border-emerald-200 text-emerald-700 bg-emerald-50">
                          {item.badge}
                        </Badge>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center space-x-3">
              {/* Search Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCommandOpen(true)}
                className="relative border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                <Search className="h-4 w-4 mr-2" />
                Rechercher
                <kbd className="ml-2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-slate-200 bg-slate-100 px-1.5 font-mono text-[10px] font-medium text-slate-500 opacity-100">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </Button>

              {/* Notifications */}
              <Button variant="ghost" size="sm" className="relative text-slate-600 hover:bg-slate-50">
                <Bell className="h-4 w-4" />
                <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full"></span>
              </Button>

              {/* Settings */}
              <Button variant="ghost" size="sm" className="text-slate-600 hover:bg-slate-50">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Breadcrumbs */}
          <div className="py-3 border-t border-slate-100">
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbs.map((crumb, index) => (
                  <React.Fragment key={crumb.href}>
                    <BreadcrumbItem>
                      {index === breadcrumbs.length - 1 ? (
                        <BreadcrumbPage className="text-slate-600">{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <Link to={crumb.href} className="text-slate-500 hover:text-slate-700">{crumb.label}</Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {index < breadcrumbs.length - 1 && <BreadcrumbSeparator className="text-slate-400" />}
                  </React.Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <nav className="lg:hidden bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="px-4 sm:px-6">
          <div className="flex justify-between items-center h-16">
            {/* Mobile Logo */}
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-slate-800 rounded-md">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-lg font-semibold text-slate-900 tracking-tight">Secteurs</h1>
            </div>

            <div className="flex items-center space-x-2">
              {/* Mobile Search */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCommandOpen(true)}
                className="text-slate-600"
              >
                <Search className="h-5 w-5" />
              </Button>

              {/* Mobile Menu */}
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-slate-600">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                  <SheetHeader>
                    <SheetTitle className="text-slate-900">Navigation</SheetTitle>
                    <SheetDescription className="text-slate-600">
                      Accédez rapidement à toutes les sections
                    </SheetDescription>
                  </SheetHeader>

                  <div className="mt-6 space-y-6">
                    {/* Favorites */}
                    {favorites.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-slate-900 mb-3 flex items-center">
                          <Star className="h-4 w-4 mr-2 text-slate-600" />
                          Favoris
                        </h3>
                        <div className="space-y-1">
                          {favorites.map(favoriteId => {
                            const item = navigationItems.find(i => i.id === favoriteId);
                            if (!item) return null;
                            return (
                              <Link
                                key={item.id}
                                to={item.href}
                                onClick={() => {
                                  addToRecent(item.id);
                                  setIsMobileMenuOpen(false);
                                }}
                                className="flex items-center p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200"
                              >
                                <item.icon className="h-5 w-5 mr-3 text-slate-600" />
                                <div className="flex-1">
                                  <div className="font-medium text-slate-900">{item.label}</div>
                                  <div className="text-sm text-slate-500">{item.description}</div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-slate-400" />
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* All Pages */}
                    <div>
                      <h3 className="text-sm font-medium text-slate-900 mb-3">Toutes les pages</h3>
                      <div className="space-y-1">
                        {filteredNavigationItems.map((item) => {
                          const isActive = location.pathname === item.href;
                          const isFavorite = favorites.includes(item.id);
                          
                          return (
                            <div key={item.id} className="flex items-center">
                              <Link
                                to={item.href}
                                onClick={() => {
                                  addToRecent(item.id);
                                  setIsMobileMenuOpen(false);
                                }}
                                className={`flex-1 flex items-center p-3 rounded-lg transition-colors border ${
                                  isActive 
                                    ? 'bg-slate-50 text-slate-900 border-slate-200' 
                                    : 'hover:bg-slate-50 border-transparent hover:border-slate-200'
                                }`}
                              >
                                <item.icon className={`h-5 w-5 mr-3 ${isActive ? 'text-slate-700' : 'text-slate-600'}`} />
                                <div className="flex-1">
                                  <div className={`font-medium ${isActive ? 'text-slate-900' : 'text-slate-900'}`}>
                                    {item.label}
                                  </div>
                                  <div className="text-sm text-slate-500">{item.description}</div>
                                </div>
                                {item.badge && (
                                  <Badge variant="outline" className="mr-2 text-xs border-emerald-200 text-emerald-700 bg-emerald-50">
                                    {item.badge}
                                  </Badge>
                                )}
                              </Link>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleFavorite(item.id)}
                                className="p-2"
                              >
                                <Star className={`h-4 w-4 ${isFavorite ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          {/* Mobile Breadcrumbs */}
          <div className="pb-3">
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbs.slice(-2).map((crumb, index, arr) => (
                  <React.Fragment key={crumb.href}>
                    <BreadcrumbItem>
                      {index === arr.length - 1 ? (
                        <BreadcrumbPage className="text-sm text-slate-600">{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <Link to={crumb.href} className="text-sm text-slate-500 hover:text-slate-700">{crumb.label}</Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {index < arr.length - 1 && <BreadcrumbSeparator className="text-slate-400" />}
                  </React.Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </div>
      </nav>

      {/* Command Palette */}
      <CommandDialog open={isCommandOpen} onOpenChange={setIsCommandOpen}>
        <CommandInput placeholder="Rechercher des pages, données, actions..." />
        <CommandList>
          <CommandEmpty>Aucun résultat trouvé.</CommandEmpty>
          
          {favorites.length > 0 && (
            <>
              <CommandGroup heading="Favoris">
                {favorites.map(favoriteId => {
                  const item = navigationItems.find(i => i.id === favoriteId);
                  if (!item) return null;
                  return (
                    <CommandItem
                      key={item.id}
                      onSelect={() => {
                        addToRecent(item.id);
                        setIsCommandOpen(false);
                        window.location.href = item.href;
                      }}
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      <span>{item.label}</span>
                      <Star className="ml-auto h-3 w-3 fill-amber-400 text-amber-400" />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {recentItems.length > 0 && (
            <>
              <CommandGroup heading="Récent">
                {recentItems.map(recentId => {
                  const item = navigationItems.find(i => i.id === recentId);
                  if (!item) return null;
                  return (
                    <CommandItem
                      key={item.id}
                      onSelect={() => {
                        setIsCommandOpen(false);
                        window.location.href = item.href;
                      }}
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      <span>{item.label}</span>
                      <History className="ml-auto h-3 w-3 text-slate-400" />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          <CommandGroup heading="Pages">
            {filteredNavigationItems.map((item) => (
              <CommandItem
                key={item.id}
                onSelect={() => {
                  addToRecent(item.id);
                  setIsCommandOpen(false);
                  window.location.href = item.href;
                }}
              >
                <item.icon className="mr-2 h-4 w-4" />
                <span>{item.label}</span>
                {item.badge && (
                  <Badge variant="outline" className="ml-auto text-xs border-emerald-200 text-emergreen-700 bg-emerald-50">
                    {item.badge}
                  </Badge>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
