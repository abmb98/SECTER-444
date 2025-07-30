import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Search,
  Filter,
  X,
  Plus,
  Calendar,
  Hash,
  Type,
  ToggleLeft,
  SlidersHorizontal,
  Save,
  Clock,
  Star,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchFilter {
  id: string;
  field: string;
  operator: string;
  value: any;
  label?: string;
}

interface FilterField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'boolean';
  options?: { value: string; label: string; }[];
  placeholder?: string;
}

interface SavedSearch {
  id: string;
  name: string;
  filters: SearchFilter[];
  searchTerm: string;
  createdAt: Date;
  favorite?: boolean;
}

interface AdvancedSearchProps {
  fields: FilterField[];
  onSearch: (searchTerm: string, filters: SearchFilter[]) => void;
  placeholder?: string;
  className?: string;
  showSaveSearch?: boolean;
  savedSearches?: SavedSearch[];
  onSaveSearch?: (search: SavedSearch) => void;
  onDeleteSearch?: (searchId: string) => void;
  onToggleFavorite?: (searchId: string) => void;
}

const operators = {
  text: [
    { value: 'contains', label: 'Contient' },
    { value: 'equals', label: 'Égal à' },
    { value: 'startsWith', label: 'Commence par' },
    { value: 'endsWith', label: 'Se termine par' },
    { value: 'notContains', label: 'Ne contient pas' }
  ],
  number: [
    { value: 'equals', label: 'Égal à' },
    { value: 'notEquals', label: 'Différent de' },
    { value: 'greaterThan', label: 'Supérieur à' },
    { value: 'lessThan', label: 'Inférieur à' },
    { value: 'greaterThanOrEqual', label: 'Supérieur ou égal à' },
    { value: 'lessThanOrEqual', label: 'Inférieur ou égal à' }
  ],
  date: [
    { value: 'equals', label: 'Le' },
    { value: 'after', label: 'Après le' },
    { value: 'before', label: 'Avant le' },
    { value: 'between', label: 'Entre' },
    { value: 'lastDays', label: 'Les X derniers jours' },
    { value: 'thisWeek', label: 'Cette semaine' },
    { value: 'thisMonth', label: 'Ce mois' },
    { value: 'thisYear', label: 'Cette année' }
  ],
  select: [
    { value: 'equals', label: 'Égal à' },
    { value: 'notEquals', label: 'Différent de' },
    { value: 'in', label: 'Parmi' }
  ],
  boolean: [
    { value: 'equals', label: 'Est' }
  ]
};

export function AdvancedSearch({
  fields,
  onSearch,
  placeholder = "Rechercher...",
  className,
  showSaveSearch = false,
  savedSearches = [],
  onSaveSearch,
  onDeleteSearch,
  onToggleFavorite
}: AdvancedSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<SearchFilter[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        searchInputRef.current?.blur();
        setIsCommandOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load recent searches from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('recentSearches');
    if (stored) {
      setRecentSearches(JSON.parse(stored));
    }
  }, []);

  // Save recent searches
  const saveRecentSearch = (term: string) => {
    if (term.trim() && !recentSearches.includes(term)) {
      const newRecent = [term, ...recentSearches.slice(0, 4)];
      setRecentSearches(newRecent);
      localStorage.setItem('recentSearches', JSON.stringify(newRecent));
    }
  };

  // Generate search suggestions
  useEffect(() => {
    if (searchTerm.length > 1) {
      const newSuggestions = [
        ...recentSearches.filter(term => 
          term.toLowerCase().includes(searchTerm.toLowerCase())
        ),
        // Add more intelligent suggestions here based on data
      ].slice(0, 5);
      setSuggestions(newSuggestions);
    } else {
      setSuggestions([]);
    }
  }, [searchTerm, recentSearches]);

  // Handle search execution
  const executeSearch = (term: string = searchTerm, currentFilters: SearchFilter[] = filters) => {
    onSearch(term, currentFilters);
    if (term.trim()) {
      saveRecentSearch(term);
    }
    setIsCommandOpen(false);
  };

  // Add filter
  const addFilter = (field: FilterField) => {
    const newFilter: SearchFilter = {
      id: Math.random().toString(36).substr(2, 9),
      field: field.id,
      operator: operators[field.type][0].value,
      value: '',
      label: field.label
    };
    
    const newFilters = [...filters, newFilter];
    setFilters(newFilters);
    executeSearch(searchTerm, newFilters);
    setIsFilterOpen(false);
  };

  // Update filter
  const updateFilter = (filterId: string, updates: Partial<SearchFilter>) => {
    const newFilters = filters.map(filter =>
      filter.id === filterId ? { ...filter, ...updates } : filter
    );
    setFilters(newFilters);
    executeSearch(searchTerm, newFilters);
  };

  // Remove filter
  const removeFilter = (filterId: string) => {
    const newFilters = filters.filter(filter => filter.id !== filterId);
    setFilters(newFilters);
    executeSearch(searchTerm, newFilters);
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters([]);
    setSearchTerm('');
    executeSearch('', []);
  };

  // Apply saved search
  const applySavedSearch = (savedSearch: SavedSearch) => {
    setSearchTerm(savedSearch.searchTerm);
    setFilters(savedSearch.filters);
    executeSearch(savedSearch.searchTerm, savedSearch.filters);
    setIsCommandOpen(false);
  };

  // Save current search
  const saveCurrentSearch = () => {
    if (saveSearchName.trim() && onSaveSearch) {
      const newSavedSearch: SavedSearch = {
        id: Math.random().toString(36).substr(2, 9),
        name: saveSearchName.trim(),
        filters: [...filters],
        searchTerm,
        createdAt: new Date()
      };
      
      onSaveSearch(newSavedSearch);
      setSaveSearchName('');
      setIsSaveDialogOpen(false);
    }
  };

  // Get filter field
  const getFilterField = (fieldId: string) => {
    return fields.find(field => field.id === fieldId);
  };

  // Get filter operators
  const getFilterOperators = (fieldType: string) => {
    return operators[fieldType as keyof typeof operators] || operators.text;
  };

  // Render filter value input
  const renderFilterValueInput = (filter: SearchFilter) => {
    const field = getFilterField(filter.field);
    if (!field) return null;

    switch (field.type) {
      case 'select':
        return (
          <Select
            value={filter.value}
            onValueChange={(value) => updateFilter(filter.id, { value })}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Sélectionner..." />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      
      case 'boolean':
        return (
          <Select
            value={filter.value}
            onValueChange={(value) => updateFilter(filter.id, { value })}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Choisir..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Vrai</SelectItem>
              <SelectItem value="false">Faux</SelectItem>
            </SelectContent>
          </Select>
        );
      
      case 'date':
        return (
          <Input
            type="date"
            value={filter.value}
            onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
            className="w-40"
          />
        );
      
      case 'number':
        return (
          <Input
            type="number"
            value={filter.value}
            onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
            placeholder="Valeur..."
            className="w-32"
          />
        );
      
      default:
        return (
          <Input
            value={filter.value}
            onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
            placeholder={field.placeholder || "Valeur..."}
            className="w-40"
          />
        );
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Main Search Bar */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            ref={searchInputRef}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                executeSearch();
              } else if (e.key === '/' && e.ctrlKey) {
                e.preventDefault();
                setIsCommandOpen(true);
              }
            }}
            onFocus={() => setIsCommandOpen(true)}
            placeholder={placeholder}
            className="pl-10 pr-24"
          />
          
          {/* Quick Actions */}
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
            <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              <span className="text-xs">⌘</span>K
            </kbd>
            
            <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56" align="end">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Ajouter un filtre</h4>
                  {fields.map((field) => (
                    <Button
                      key={field.id}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => addFilter(field)}
                    >
                      <Plus className="h-3 w-3 mr-2" />
                      {field.label}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Command Palette */}
        {isCommandOpen && (
          <Card className="absolute top-full left-0 right-0 z-50 mt-2 shadow-lg">
            <CardContent className="p-0">
              <Command className="border-0">
                <CommandList className="max-h-96">
                  {/* Search Suggestions */}
                  {suggestions.length > 0 && (
                    <CommandGroup heading="Suggestions">
                      {suggestions.map((suggestion, index) => (
                        <CommandItem
                          key={index}
                          onSelect={() => {
                            setSearchTerm(suggestion);
                            executeSearch(suggestion);
                          }}
                        >
                          <Clock className="h-4 w-4 mr-2" />
                          {suggestion}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}

                  {/* Saved Searches */}
                  {savedSearches.length > 0 && (
                    <CommandGroup heading="Recherches sauvegardées">
                      {savedSearches
                        .sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0))
                        .slice(0, 5)
                        .map((search) => (
                          <CommandItem
                            key={search.id}
                            onSelect={() => applySavedSearch(search)}
                          >
                            {search.favorite ? (
                              <Star className="h-4 w-4 mr-2 fill-yellow-400 text-yellow-400" />
                            ) : (
                              <Save className="h-4 w-4 mr-2" />
                            )}
                            {search.name}
                            <Badge variant="secondary" className="ml-auto">
                              {search.filters.length}
                            </Badge>
                          </CommandItem>
                        ))
                      }
                    </CommandGroup>
                  )}

                  {/* Quick Filters */}
                  <CommandGroup heading="Filtres rapides">
                    {fields.slice(0, 5).map((field) => (
                      <CommandItem
                        key={field.id}
                        onSelect={() => addFilter(field)}
                      >
                        <Filter className="h-4 w-4 mr-2" />
                        Filtrer par {field.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>

                  {searchTerm.trim() === '' && suggestions.length === 0 && savedSearches.length === 0 && (
                    <CommandEmpty>
                      Tapez pour rechercher ou utilisez Cmd+K pour ouvrir les options avancées.
                    </CommandEmpty>
                  )}
                </CommandList>
              </Command>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Active Filters */}
      {filters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-600">Filtres:</span>
          {filters.map((filter) => {
            const field = getFilterField(filter.field);
            const operator = getFilterOperators(field?.type || 'text').find(
              op => op.value === filter.operator
            );
            
            return (
              <div key={filter.id} className="flex items-center space-x-2 bg-blue-50 border border-blue-200 rounded-lg p-2">
                <span className="text-xs font-medium text-blue-900">
                  {filter.label}
                </span>
                
                <Select
                  value={filter.operator}
                  onValueChange={(value) => updateFilter(filter.id, { operator: value })}
                >
                  <SelectTrigger className="h-6 text-xs border-0 bg-transparent p-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getFilterOperators(field?.type || 'text').map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <div className="min-w-0">
                  {renderFilterValueInput(filter)}
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFilter(filter.id)}
                  className="h-6 w-6 p-0 hover:bg-red-100"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
          
          <Button
            variant="outline"
            size="sm"
            onClick={clearFilters}
            className="h-8"
          >
            Effacer tout
          </Button>
          
          {showSaveSearch && (searchTerm.trim() || filters.length > 0) && (
            <Sheet open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  <Save className="h-3 w-3 mr-2" />
                  Sauvegarder
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Sauvegarder la recherche</SheetTitle>
                  <SheetDescription>
                    Donnez un nom à cette recherche pour la retrouver facilement
                  </SheetDescription>
                </SheetHeader>
                
                <div className="space-y-4 mt-6">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Nom de la recherche
                    </label>
                    <Input
                      value={saveSearchName}
                      onChange={(e) => setSaveSearchName(e.target.value)}
                      placeholder="Ex: Ouvriers actifs hommes"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          saveCurrentSearch();
                        }
                      }}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium block">Aperçu</label>
                    <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                      {searchTerm && (
                        <div>Terme: "{searchTerm}"</div>
                      )}
                      {filters.length > 0 && (
                        <div>Filtres: {filters.length}</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      onClick={saveCurrentSearch}
                      disabled={!saveSearchName.trim()}
                      className="flex-1"
                    >
                      Sauvegarder
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setIsSaveDialogOpen(false)}
                    >
                      Annuler
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      )}

      {/* Click outside to close command palette */}
      {isCommandOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsCommandOpen(false)}
        />
      )}
    </div>
  );
}
