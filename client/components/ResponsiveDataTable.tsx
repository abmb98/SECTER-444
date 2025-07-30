import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  Download,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Settings2,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Grid3X3,
  List,
  RefreshCw,
  SlidersHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Column<T> {
  id: keyof T | string;
  header: string;
  accessor?: keyof T | ((item: T) => any);
  cell?: (item: T) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
  minWidth?: string;
  sticky?: boolean;
  align?: 'left' | 'center' | 'right';
  type?: 'text' | 'number' | 'date' | 'badge' | 'custom';
}

interface ResponsiveDataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  title?: string;
  description?: string;
  searchable?: boolean;
  filterable?: boolean;
  selectable?: boolean;
  exportable?: boolean;
  pagination?: boolean;
  pageSize?: number;
  loading?: boolean;
  error?: string;
  onRowClick?: (item: T) => void;
  onSelectionChange?: (selectedItems: T[]) => void;
  onExport?: (selectedItems: T[]) => void;
  onRefresh?: () => void;
  className?: string;
  mobileLayout?: 'card' | 'list';
}

export function ResponsiveDataTable<T extends Record<string, any>>({
  data,
  columns,
  title,
  description,
  searchable = true,
  filterable = true,
  selectable = false,
  exportable = false,
  pagination = true,
  pageSize = 10,
  loading = false,
  error,
  onRowClick,
  onSelectionChange,
  onExport,
  onRefresh,
  className,
  mobileLayout = 'card'
}: ResponsiveDataTableProps<T>) {
  // State management
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItems, setSelectedItems] = useState<T[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    columns.map(col => col.id as string)
  );
  const [columnFilters, setColumnFilters] = useState<Record<string, any>>({});
  const [viewMode, setViewMode] = useState<'table' | 'card' | 'list'>('table');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  // Responsive breakpoint detection
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const checkBreakpoints = () => {
      setIsMobile(window.innerWidth < 768);
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
    };

    checkBreakpoints();
    window.addEventListener('resize', checkBreakpoints);
    return () => window.removeEventListener('resize', checkBreakpoints);
  }, []);

  // Auto switch view mode on mobile
  useEffect(() => {
    if (isMobile) {
      setViewMode(mobileLayout);
    } else {
      setViewMode('table');
    }
  }, [isMobile, mobileLayout]);

  // Data processing
  const processedData = useMemo(() => {
    let filtered = [...data];

    // Apply search filter
    if (searchTerm && searchable) {
      filtered = filtered.filter(item =>
        columns.some(column => {
          const value = column.accessor 
            ? typeof column.accessor === 'function' 
              ? column.accessor(item)
              : item[column.accessor]
            : item[column.id];
          return value != null ? String(value).toLowerCase().includes(searchTerm.toLowerCase()) : false;
        })
      );
    }

    // Apply column filters
    Object.entries(columnFilters).forEach(([columnId, filterValue]) => {
      if (filterValue && filterValue !== '') {
        filtered = filtered.filter(item => {
          const column = columns.find(col => col.id === columnId);
          if (!column) return true;
          
          const value = column.accessor 
            ? typeof column.accessor === 'function' 
              ? column.accessor(item)
              : item[column.accessor]
            : item[column.id];
          
          return value != null ? String(value).toLowerCase().includes(String(filterValue).toLowerCase()) : false;
        });
      }
    });

    // Apply sorting
    if (sortColumn) {
      const column = columns.find(col => col.id === sortColumn);
      if (column) {
        filtered.sort((a, b) => {
          const aValue = column.accessor 
            ? typeof column.accessor === 'function' 
              ? column.accessor(a)
              : a[column.accessor]
            : a[column.id];
          const bValue = column.accessor 
            ? typeof column.accessor === 'function' 
              ? column.accessor(b)
              : b[column.accessor]
            : b[column.id];

          if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
          return 0;
        });
      }
    }

    return filtered;
  }, [data, columns, searchTerm, sortColumn, sortDirection, columnFilters, searchable]);

  // Pagination
  const totalPages = Math.ceil(processedData.length / pageSize);
  const paginatedData = pagination 
    ? processedData.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : processedData;

  // Handlers
  const handleSort = (columnId: string) => {
    if (sortColumn === columnId) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnId);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = () => {
    if (selectedItems.length === paginatedData.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems([...paginatedData]);
    }
  };

  const handleSelectItem = (item: T) => {
    const isSelected = selectedItems.some(selected => 
      JSON.stringify(selected) === JSON.stringify(item)
    );
    
    if (isSelected) {
      setSelectedItems(selectedItems.filter(selected => 
        JSON.stringify(selected) !== JSON.stringify(item)
      ));
    } else {
      setSelectedItems([...selectedItems, item]);
    }
  };

  const handleColumnFilterChange = (columnId: string, value: any) => {
    setColumnFilters(prev => ({
      ...prev,
      [columnId]: value
    }));
  };

  const clearFilters = () => {
    setSearchTerm('');
    setColumnFilters({});
    setSortColumn(null);
    setSortDirection('asc');
  };

  const visibleColumnsData = columns.filter(col => 
    visibleColumns.includes(col.id as string)
  );

  // Mobile Card View
  const MobileCardView = () => (
    <div className="space-y-4">
      {paginatedData.map((item, index) => (
        <Card 
          key={index}
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            onRowClick && "hover:bg-gray-50"
          )}
          onClick={() => onRowClick?.(item)}
        >
          <CardContent className="p-4">
            <div className="space-y-3">
              {selectable && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={selectedItems.some(selected => 
                      JSON.stringify(selected) === JSON.stringify(item)
                    )}
                    onCheckedChange={() => handleSelectItem(item)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="text-sm text-gray-500">Sélectionner</span>
                </div>
              )}
              
              {visibleColumnsData.map((column) => {
                const value = column.accessor 
                  ? typeof column.accessor === 'function' 
                    ? column.accessor(item)
                    : item[column.accessor]
                  : item[column.id];

                return (
                  <div key={column.id as string} className="flex justify-between items-start">
                    <div className="text-sm font-medium text-gray-600 min-w-0 flex-1">
                      {column.header}
                    </div>
                    <div className="text-sm text-gray-900 text-right ml-4">
                      {column.cell ? column.cell(item) : String(value)}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  // Mobile List View
  const MobileListView = () => (
    <div className="space-y-2">
      {paginatedData.map((item, index) => (
        <div 
          key={index}
          className={cn(
            "p-4 border rounded-lg bg-white cursor-pointer transition-all hover:bg-gray-50",
            onRowClick && "hover:shadow-sm"
          )}
          onClick={() => onRowClick?.(item)}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              {/* Primary field (first visible column) */}
              {visibleColumnsData[0] && (
                <div className="font-medium text-gray-900 truncate">
                  {visibleColumnsData[0].cell 
                    ? visibleColumnsData[0].cell(item)
                    : String(visibleColumnsData[0].accessor 
                        ? typeof visibleColumnsData[0].accessor === 'function' 
                          ? visibleColumnsData[0].accessor(item)
                          : item[visibleColumnsData[0].accessor]
                        : item[visibleColumnsData[0].id]
                      )
                  }
                </div>
              )}
              
              {/* Secondary field (second visible column) */}
              {visibleColumnsData[1] && (
                <div className="text-sm text-gray-500 truncate mt-1">
                  {visibleColumnsData[1].cell 
                    ? visibleColumnsData[1].cell(item)
                    : String(visibleColumnsData[1].accessor 
                        ? typeof visibleColumnsData[1].accessor === 'function' 
                          ? visibleColumnsData[1].accessor(item)
                          : item[visibleColumnsData[1].accessor]
                        : item[visibleColumnsData[1].id]
                      )
                  }
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-2 ml-4">
              {selectable && (
                <Checkbox
                  checked={selectedItems.some(selected => 
                    JSON.stringify(selected) === JSON.stringify(item)
                  )}
                  onCheckedChange={() => handleSelectItem(item)}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              
              {/* Tertiary field (third visible column) */}
              {visibleColumnsData[2] && (
                <div className="text-sm text-gray-600">
                  {visibleColumnsData[2].cell 
                    ? visibleColumnsData[2].cell(item)
                    : String(visibleColumnsData[2].accessor 
                        ? typeof visibleColumnsData[2].accessor === 'function' 
                          ? visibleColumnsData[2].accessor(item)
                          : item[visibleColumnsData[2].accessor]
                        : item[visibleColumnsData[2].id]
                      )
                  }
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  // Desktop Table View
  const TableView = () => (
    <div className="overflow-x-auto">
      <div className="min-w-full inline-block align-middle">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {selectable && (
                <th className="w-12 px-4 py-3 text-left">
                  <Checkbox
                    checked={selectedItems.length === paginatedData.length && paginatedData.length > 0}
                    onCheckedChange={handleSelectAll}
                    className="rounded"
                  />
                </th>
              )}
              
              {visibleColumnsData.map((column) => (
                <th
                  key={column.id as string}
                  className={cn(
                    "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                    column.align === 'center' && "text-center",
                    column.align === 'right' && "text-right",
                    column.sortable && "cursor-pointer hover:bg-gray-100 select-none",
                    column.sticky && "sticky left-0 bg-gray-50 z-10"
                  )}
                  style={{
                    width: column.width,
                    minWidth: column.minWidth
                  }}
                  onClick={() => column.sortable && handleSort(column.id as string)}
                >
                  <div className="flex items-center space-x-1">
                    <span>{column.header}</span>
                    {column.sortable && (
                      <div className="flex flex-col">
                        {sortColumn === column.id ? (
                          sortDirection === 'asc' ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3 w-3 opacity-50" />
                        )}
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.map((item, index) => (
              <tr
                key={index}
                className={cn(
                  "hover:bg-gray-50 transition-colors",
                  onRowClick && "cursor-pointer",
                  selectedItems.some(selected => 
                    JSON.stringify(selected) === JSON.stringify(item)
                  ) && "bg-blue-50"
                )}
                onClick={() => onRowClick?.(item)}
              >
                {selectable && (
                  <td className="w-12 px-4 py-4">
                    <Checkbox
                      checked={selectedItems.some(selected => 
                        JSON.stringify(selected) === JSON.stringify(item)
                      )}
                      onCheckedChange={() => handleSelectItem(item)}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded"
                    />
                  </td>
                )}
                
                {visibleColumnsData.map((column) => {
                  const value = column.accessor 
                    ? typeof column.accessor === 'function' 
                      ? column.accessor(item)
                      : item[column.accessor]
                    : item[column.id];

                  return (
                    <td
                      key={column.id as string}
                      className={cn(
                        "px-4 py-4 whitespace-nowrap text-sm text-gray-900",
                        column.align === 'center' && "text-center",
                        column.align === 'right' && "text-right",
                        column.sticky && "sticky left-0 bg-white"
                      )}
                    >
                      {column.cell ? column.cell(item) : String(value)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <Card className={cn("w-full", className)}>
      {/* Header */}
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            {title && <CardTitle className="text-xl font-semibold">{title}</CardTitle>}
            {description && <p className="text-sm text-gray-600 mt-1">{description}</p>}
          </div>
          
          {/* Actions */}
          <div className="flex items-center space-x-2">
            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={loading}
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </Button>
            )}
            
            {!isMobile && (
              <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                  className="h-8 w-8 p-0"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'card' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('card')}
                  className="h-8 w-8 p-0"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            )}
            
            {/* Column Settings */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings2 className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Colonnes visibles</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {columns.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id as string}
                    checked={visibleColumns.includes(column.id as string)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setVisibleColumns([...visibleColumns, column.id as string]);
                      } else {
                        setVisibleColumns(visibleColumns.filter(id => id !== column.id));
                      }
                    }}
                  >
                    {column.header}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            
            {exportable && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onExport?.(selectedItems.length > 0 ? selectedItems : processedData)}
                disabled={processedData.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Exporter
              </Button>
            )}
          </div>
        </div>
        
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          {searchable && (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          )}
          
          {filterable && (
            <div className="flex items-center space-x-2">
              <Sheet open={isFilterPanelOpen} onOpenChange={setIsFilterPanelOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm">
                    <SlidersHorizontal className="h-4 w-4 mr-2" />
                    Filtres
                    {Object.values(columnFilters).some(v => v && v !== '') && (
                      <Badge variant="secondary" className="ml-2">
                        {Object.values(columnFilters).filter(v => v && v !== '').length}
                      </Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Filtres avancés</SheetTitle>
                    <SheetDescription>
                      Filtrez les données par colonne
                    </SheetDescription>
                  </SheetHeader>
                  
                  <div className="space-y-4 mt-6">
                    {columns
                      .filter(col => col.filterable !== false)
                      .map((column) => (
                        <div key={column.id as string}>
                          <label className="text-sm font-medium mb-2 block">
                            {column.header}
                          </label>
                          <Input
                            placeholder={`Filtrer par ${column.header.toLowerCase()}`}
                            value={columnFilters[column.id as string] || ''}
                            onChange={(e) => handleColumnFilterChange(column.id as string, e.target.value)}
                          />
                        </div>
                      ))
                    }
                    
                    <Button
                      variant="outline"
                      onClick={clearFilters}
                      className="w-full"
                    >
                      Effacer tous les filtres
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            <span className="text-gray-600">Chargement...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <div className="text-red-600 mb-2">Erreur de chargement</div>
            <div className="text-sm text-gray-600">{error}</div>
          </div>
        )}

        {/* No Data State */}
        {!loading && !error && processedData.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-600 mb-2">Aucune donnée disponible</div>
            <div className="text-sm text-gray-500">
              {searchTerm || Object.values(columnFilters).some(v => v && v !== '') 
                ? 'Aucun résultat trouvé pour les filtres appliqués'
                : 'Aucune donnée à afficher'
              }
            </div>
          </div>
        )}

        {/* Data Display */}
        {!loading && !error && processedData.length > 0 && (
          <>
            {/* Selection Info */}
            {selectable && selectedItems.length > 0 && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg flex items-center justify-between">
                <span className="text-sm text-blue-900">
                  {selectedItems.length} élément(s) sélectionné(s)
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedItems([])}
                >
                  Désélectionner tout
                </Button>
              </div>
            )}

            {/* Data Views */}
            {viewMode === 'table' && <TableView />}
            {viewMode === 'card' && <MobileCardView />}
            {viewMode === 'list' && <MobileListView />}

            {/* Pagination */}
            {pagination && totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <div className="text-sm text-gray-600">
                  Affichage de {((currentPage - 1) * pageSize) + 1} à{' '}
                  {Math.min(currentPage * pageSize, processedData.length)} sur{' '}
                  {processedData.length} résultat(s)
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const page = currentPage <= 3 
                        ? i + 1
                        : currentPage >= totalPages - 2
                        ? totalPages - 4 + i
                        : currentPage - 2 + i;
                      
                      if (page < 1 || page > totalPages) return null;
                      
                      return (
                        <Button
                          key={page}
                          variant={page === currentPage ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className="w-8 h-8 p-0"
                        >
                          {page}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
