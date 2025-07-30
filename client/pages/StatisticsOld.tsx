import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFirestore } from '@/hooks/useFirestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatsCard } from '@/components/StatsCard';
import { 
  BarChart3, 
  Users, 
  BedDouble, 
  Building2,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  Filter,
  Clock,
  LogOut,
  MapPin,
  AlertTriangle,
  CheckCircle,
  Activity,
  PieChart,
  Target,
  Percent,
  UserCheck,
  UserX,
  Home,
  Zap
} from 'lucide-react';
import { Ferme, Worker, Room } from '@shared/types';
import * as XLSX from 'xlsx';

export default function Statistics() {
  const { user, isSuperAdmin } = useAuth();
  const { data: fermes } = useFirestore<Ferme>('fermes');
  const { data: allWorkers } = useFirestore<Worker>('workers');
  const { data: allRooms } = useFirestore<Room>('rooms');
  
  const [selectedFerme, setSelectedFerme] = useState('all');
  const [timeRange, setTimeRange] = useState('month');

  // Filter data based on user role and selected ferme
  const workers = selectedFerme === 'all' 
    ? (isSuperAdmin ? allWorkers : allWorkers.filter(w => w.fermeId === user?.fermeId))
    : allWorkers.filter(w => w.fermeId === selectedFerme);
  
  const rooms = selectedFerme === 'all'
    ? (isSuperAdmin ? allRooms : allRooms.filter(r => r.fermeId === user?.fermeId))
    : allRooms.filter(r => r.fermeId === selectedFerme);

  // Comprehensive statistics calculation
  const statistics = useMemo(() => {
    const activeWorkers = workers.filter(w => w.statut === 'actif');
    const inactiveWorkers = workers.filter(w => w.statut === 'inactif');
    const exitedWorkers = workers.filter(w => w.statut === 'inactif' && w.dateSortie);
    
    const maleWorkers = activeWorkers.filter(w => w.sexe === 'homme');
    const femaleWorkers = activeWorkers.filter(w => w.sexe === 'femme');
    
    const maleRooms = rooms.filter(r => r.genre === 'hommes');
    const femaleRooms = rooms.filter(r => r.genre === 'femmes');
    
    const occupiedRooms = rooms.filter(r => r.occupantsActuels > 0);
    const fullRooms = rooms.filter(r => r.occupantsActuels >= r.capaciteTotale);
    const emptyRooms = rooms.filter(r => r.occupantsActuels === 0);
    
    const totalCapacity = rooms.reduce((sum, room) => sum + room.capaciteTotale, 0);
    const occupiedPlaces = rooms.reduce((sum, room) => sum + room.occupantsActuels, 0);
    const availablePlaces = totalCapacity - occupiedPlaces;
    
    const occupancyRate = totalCapacity > 0 ? (occupiedPlaces / totalCapacity) * 100 : 0;

    // Time-based analytics
    const now = new Date();
    const getTimeThreshold = (range: string) => {
      const date = new Date();
      switch (range) {
        case 'week': date.setDate(date.getDate() - 7); break;
        case 'month': date.setDate(date.getDate() - 30); break;
        case 'quarter': date.setDate(date.getDate() - 90); break;
        case 'year': date.setFullYear(date.getFullYear() - 1); break;
        default: date.setDate(date.getDate() - 30);
      }
      return date;
    };

    const threshold = getTimeThreshold(timeRange);
    const recentArrivals = workers.filter(w => 
      new Date(w.dateEntree) >= threshold && w.statut === 'actif'
    );
    const recentExits = exitedWorkers.filter(w => 
      w.dateSortie && new Date(w.dateSortie) >= threshold
    );

    // Exit analysis
    const exitReasons = exitedWorkers.reduce((acc, worker) => {
      const reason = worker.motif || 'Non spécifié';
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topExitReason = Object.entries(exitReasons)
      .sort(([,a], [,b]) => b - a)[0];

    // Length of stay analysis
    const staysWithDuration = exitedWorkers
      .filter(w => w.dateEntree && w.dateSortie)
      .map(w => {
        const entryDate = new Date(w.dateEntree);
        const exitDate = new Date(w.dateSortie!);
        return Math.floor((exitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
      });

    const averageStayDuration = staysWithDuration.length > 0
      ? Math.round(staysWithDuration.reduce((sum, days) => sum + days, 0) / staysWithDuration.length)
      : 0;

    // Age analysis
    const ages = activeWorkers.map(w => w.age);
    const averageAge = ages.length > 0 ? Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length) : 0;
    const minAge = ages.length > 0 ? Math.min(...ages) : 0;
    const maxAge = ages.length > 0 ? Math.max(...ages) : 0;

    const ageDistribution = {
      '18-25': activeWorkers.filter(w => w.age >= 18 && w.age <= 25).length,
      '26-35': activeWorkers.filter(w => w.age >= 26 && w.age <= 35).length,
      '36-45': activeWorkers.filter(w => w.age >= 36 && w.age <= 45).length,
      '46+': activeWorkers.filter(w => w.age >= 46).length
    };

    // Efficiency metrics
    const turnoverRate = workers.length > 0 ? (exitedWorkers.length / workers.length) * 100 : 0;
    const retentionRate = 100 - turnoverRate;
    const utilizationRate = occupancyRate;
    
    // Performance indicators
    const isHighOccupancy = occupancyRate > 85;
    const isLowOccupancy = occupancyRate < 50;
    const hasRecentGrowth = recentArrivals.length > recentExits.length;
    const balancedGender = Math.abs(maleWorkers.length - femaleWorkers.length) <= Math.ceil(activeWorkers.length * 0.2);

    return {
      // Basic counts
      totalWorkers: activeWorkers.length,
      totalInactiveWorkers: inactiveWorkers.length,
      maleWorkers: maleWorkers.length,
      femaleWorkers: femaleWorkers.length,
      totalRooms: rooms.length,
      maleRooms: maleRooms.length,
      femaleRooms: femaleRooms.length,
      occupiedRooms: occupiedRooms.length,
      emptyRooms: emptyRooms.length,
      fullRooms: fullRooms.length,
      
      // Capacity metrics
      totalCapacity,
      occupiedPlaces,
      availablePlaces,
      occupancyRate: Math.round(occupancyRate * 100) / 100,
      
      // Time-based metrics
      recentArrivals: recentArrivals.length,
      recentExits: recentExits.length,
      netChange: recentArrivals.length - recentExits.length,
      
      // Age metrics
      averageAge,
      minAge,
      maxAge,
      ageDistribution,
      
      // Stay duration
      averageStayDuration,
      totalExitedWorkers: exitedWorkers.length,
      
      // Exit analysis
      exitReasons,
      topExitReason: topExitReason ? topExitReason[0] : 'Aucune',
      topExitReasonCount: topExitReason ? topExitReason[1] : 0,
      
      // Performance metrics
      turnoverRate: Math.round(turnoverRate * 100) / 100,
      retentionRate: Math.round(retentionRate * 100) / 100,
      utilizationRate: Math.round(utilizationRate * 100) / 100,
      
      // Status indicators
      isHighOccupancy,
      isLowOccupancy,
      hasRecentGrowth,
      balancedGender,
      
      // Trends (mock data - in real app would calculate from historical data)
      occupancyTrend: hasRecentGrowth ? 8.5 : -3.2,
      workersTrend: recentArrivals.length > 0 ? 12.1 : -5.4,
      efficiencyScore: Math.round((retentionRate + utilizationRate) / 2)
    };
  }, [workers, rooms, timeRange]);

  // Ferme-specific statistics for super admin
  const fermeStatistics = useMemo(() => {
    if (!isSuperAdmin) return [];
    
    return fermes.map(ferme => {
      const fermeWorkers = allWorkers.filter(w => w.fermeId === ferme.id && w.statut === 'actif');
      const fermeRooms = allRooms.filter(r => r.fermeId === ferme.id);
      const occupiedRooms = fermeRooms.filter(r => r.occupantsActuels > 0);
      const totalCapacity = fermeRooms.reduce((sum, room) => sum + room.capaciteTotale, 0);
      const occupiedPlaces = fermeRooms.reduce((sum, room) => sum + room.occupantsActuels, 0);
      const occupancyRate = totalCapacity > 0 ? (occupiedPlaces / totalCapacity) * 100 : 0;
      
      return {
        ferme,
        workers: fermeWorkers.length,
        rooms: fermeRooms.length,
        occupiedRooms: occupiedRooms.length,
        capacity: totalCapacity,
        occupied: occupiedPlaces,
        available: totalCapacity - occupiedPlaces,
        occupancyRate: Math.round(occupancyRate * 100) / 100,
        maleWorkers: fermeWorkers.filter(w => w.sexe === 'homme').length,
        femaleWorkers: fermeWorkers.filter(w => w.sexe === 'femme').length,
        averageAge: fermeWorkers.length > 0 ? 
          Math.round(fermeWorkers.reduce((sum, w) => sum + w.age, 0) / fermeWorkers.length) : 0
      };
    });
  }, [fermes, allWorkers, allRooms, isSuperAdmin]);

  // Export functionality
  const handleExport = () => {
    const exportData = {
      'Vue d\'ensemble': [
        ['Métrique', 'Valeur'],
        ['Total ouvriers actifs', statistics.totalWorkers],
        ['Taux d\'occupation', `${statistics.occupancyRate}%`],
        ['Places disponibles', statistics.availablePlaces],
        ['Âge moyen', `${statistics.averageAge} ans`],
        ['Taux de rétention', `${statistics.retentionRate}%`]
      ],
      'Répartition par âge': [
        ['Tranche d\'âge', 'Nombre'],
        ...Object.entries(statistics.ageDistribution)
      ],
      'Motifs de sortie': [
        ['Motif', 'Nombre'],
        ...Object.entries(statistics.exitReasons)
      ]
    };

    if (isSuperAdmin) {
      exportData['Statistiques par ferme'] = [
        ['Ferme', 'Ouvriers', 'Chambres', 'Taux d\'occupation'],
        ...fermeStatistics.map(stat => [
          stat.ferme.nom,
          stat.workers,
          stat.rooms,
          `${stat.occupancyRate}%`
        ])
      ];
    }

    const workbook = XLSX.utils.book_new();
    Object.entries(exportData).forEach(([sheetName, data]) => {
      const worksheet = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    });

    const fileName = `statistiques_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <BarChart3 className="mr-3 h-8 w-8" />
            Statistiques Avancées
          </h1>
          <p className="text-gray-600 mt-2">
            Analyse complète et insights professionnels du système de gestion
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Exporter Excel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {isSuperAdmin && (
              <Select value={selectedFerme} onValueChange={setSelectedFerme}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Toutes les fermes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les fermes</SelectItem>
                  {fermes.map(ferme => (
                    <SelectItem key={ferme.id} value={ferme.id}>
                      {ferme.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">7 jours</SelectItem>
                <SelectItem value="month">30 jours</SelectItem>
                <SelectItem value="quarter">3 mois</SelectItem>
                <SelectItem value="year">1 an</SelectItem>
              </SelectContent>
            </Select>
            {selectedFerme !== 'all' && (
              <Badge variant="outline" className="flex items-center">
                <MapPin className="mr-1 h-3 w-3" />
                {fermes.find(f => f.id === selectedFerme)?.nom || 'Ferme sélectionnée'}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <StatsCard
          title="Ouvriers Actifs"
          value={statistics.totalWorkers}
          icon={Users}
          description="Totaux dans le système"
          trend={{ 
            value: Math.abs(statistics.workersTrend), 
            isPositive: statistics.workersTrend > 0 
          }}
          color="green"
        />
        <StatsCard
          title="Taux d'Occupation"
          value={`${statistics.occupancyRate}%`}
          icon={TrendingUp}
          description={`${statistics.occupiedPlaces}/${statistics.totalCapacity} places`}
          trend={{ 
            value: Math.abs(statistics.occupancyTrend), 
            isPositive: statistics.occupancyTrend > 0 
          }}
          color={statistics.isHighOccupancy ? "red" : statistics.isLowOccupancy ? "orange" : "blue"}
        />
        <StatsCard
          title="Nouveaux Arrivants"
          value={statistics.recentArrivals}
          icon={UserCheck}
          description={`${timeRange === 'week' ? '7' : timeRange === 'month' ? '30' : timeRange === 'quarter' ? '90' : '365'} derniers jours`}
          color="purple"
        />
        <StatsCard
          title="Sorties"
          value={statistics.recentExits}
          icon={UserX}
          description="Même période"
          color="orange"
        />
        <StatsCard
          title="Rétention"
          value={`${statistics.retentionRate}%`}
          icon={Target}
          description="Taux de fidélisation"
          color={statistics.retentionRate > 85 ? "green" : statistics.retentionRate > 70 ? "blue" : "red"}
        />
        <StatsCard
          title="Durée Moyenne"
          value={`${statistics.averageStayDuration}j`}
          icon={Clock}
          description="Séjour moyen"
          color="blue"
        />
      </div>

      {/* Main Analytics Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center">
            <Activity className="mr-2 h-4 w-4" />
            Vue d'ensemble
          </TabsTrigger>
          <TabsTrigger value="demographics" className="flex items-center">
            <Users className="mr-2 h-4 w-4" />
            Démographie
          </TabsTrigger>
          <TabsTrigger value="occupancy" className="flex items-center">
            <Home className="mr-2 h-4 w-4" />
            Occupation
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center">
            <Zap className="mr-2 h-4 w-4" />
            Performance
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {/* Quick Insights */}
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <PieChart className="mr-2 h-5 w-5" />
                  Insights Rapides
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={`p-4 rounded-lg ${statistics.hasRecentGrowth ? 'bg-green-50' : 'bg-red-50'}`}>
                    <div className="flex items-center mb-2">
                      {statistics.hasRecentGrowth ? 
                        <TrendingUp className="h-5 w-5 text-green-600 mr-2" /> :
                        <TrendingDown className="h-5 w-5 text-red-600 mr-2" />
                      }
                      <span className={`font-medium ${statistics.hasRecentGrowth ? 'text-green-900' : 'text-red-900'}`}>
                        {statistics.hasRecentGrowth ? 'Croissance' : 'Décroissance'}
                      </span>
                    </div>
                    <p className={`text-sm ${statistics.hasRecentGrowth ? 'text-green-800' : 'text-red-800'}`}>
                      {statistics.netChange > 0 ? '+' : ''}{statistics.netChange} ouvriers (net) cette période
                    </p>
                  </div>
                  
                  <div className={`p-4 rounded-lg ${statistics.balancedGender ? 'bg-blue-50' : 'bg-yellow-50'}`}>
                    <div className="flex items-center mb-2">
                      <Users className={`h-5 w-5 mr-2 ${statistics.balancedGender ? 'text-blue-600' : 'text-yellow-600'}`} />
                      <span className={`font-medium ${statistics.balancedGender ? 'text-blue-900' : 'text-yellow-900'}`}>
                        Équilibre Genre
                      </span>
                    </div>
                    <p className={`text-sm ${statistics.balancedGender ? 'text-blue-800' : 'text-yellow-800'}`}>
                      {statistics.maleWorkers}H / {statistics.femaleWorkers}F 
                      {statistics.balancedGender ? ' - Équilibré' : ' - Déséquilibré'}
                    </p>
                  </div>
                  
                  <div className={`p-4 rounded-lg ${statistics.isHighOccupancy ? 'bg-red-50' : statistics.isLowOccupancy ? 'bg-yellow-50' : 'bg-green-50'}`}>
                    <div className="flex items-center mb-2">
                      <BedDouble className={`h-5 w-5 mr-2 ${statistics.isHighOccupancy ? 'text-red-600' : statistics.isLowOccupancy ? 'text-yellow-600' : 'text-green-600'}`} />
                      <span className={`font-medium ${statistics.isHighOccupancy ? 'text-red-900' : statistics.isLowOccupancy ? 'text-yellow-900' : 'text-green-900'}`}>
                        Occupation
                      </span>
                    </div>
                    <p className={`text-sm ${statistics.isHighOccupancy ? 'text-red-800' : statistics.isLowOccupancy ? 'text-yellow-800' : 'text-green-800'}`}>
                      {statistics.occupancyRate}% - {statistics.isHighOccupancy ? 'Saturation' : statistics.isLowOccupancy ? 'Sous-utilisé' : 'Optimal'}
                    </p>
                  </div>
                  
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <div className="flex items-center mb-2">
                      <LogOut className="h-5 w-5 text-purple-600 mr-2" />
                      <span className="font-medium text-purple-900">Sortie Principal</span>
                    </div>
                    <p className="text-sm text-purple-800">
                      {statistics.topExitReason} ({statistics.topExitReasonCount} cas)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>


          </div>
        </TabsContent>

        {/* Demographics Tab */}
        <TabsContent value="demographics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gender Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="mr-2 h-5 w-5" />
                  Répartition par Genre
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Hommes</span>
                    <div className="flex items-center space-x-2">
                      <Progress 
                        value={statistics.totalWorkers > 0 ? (statistics.maleWorkers / statistics.totalWorkers) * 100 : 0} 
                        className="w-32"
                      />
                      <span className="text-sm font-semibold text-gray-900 min-w-[4rem]">
                        {statistics.maleWorkers} ({statistics.totalWorkers > 0 ? Math.round((statistics.maleWorkers / statistics.totalWorkers) * 100) : 0}%)
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Femmes</span>
                    <div className="flex items-center space-x-2">
                      <Progress 
                        value={statistics.totalWorkers > 0 ? (statistics.femaleWorkers / statistics.totalWorkers) * 100 : 0} 
                        className="w-32"
                      />
                      <span className="text-sm font-semibold text-gray-900 min-w-[4rem]">
                        {statistics.femaleWorkers} ({statistics.totalWorkers > 0 ? Math.round((statistics.femaleWorkers / statistics.totalWorkers) * 100) : 0}%)
                      </span>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-gray-100 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Âge moyen:</span>
                      <span className="font-semibold">{statistics.averageAge} ans</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Étendue d'âge:</span>
                      <span className="font-semibold">{statistics.minAge} - {statistics.maxAge} ans</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Age Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="mr-2 h-5 w-5" />
                  Distribution par Âge
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(statistics.ageDistribution).map(([range, count]) => (
                    <div key={range} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">{range} ans</span>
                      <div className="flex items-center space-x-2">
                        <Progress 
                          value={statistics.totalWorkers > 0 ? (count / statistics.totalWorkers) * 100 : 0} 
                          className="w-24"
                        />
                        <span className="text-sm font-semibold text-gray-900 min-w-[3rem]">
                          {count} ({statistics.totalWorkers > 0 ? Math.round((count / statistics.totalWorkers) * 100) : 0}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Occupancy Tab */}
        <TabsContent value="occupancy" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Chambres Totales</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900 mb-2">{statistics.totalRooms}</div>
                <div className="text-sm text-gray-600">
                  {statistics.maleRooms} hommes • {statistics.femaleRooms} femmes
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Chambres Occupées</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600 mb-2">{statistics.occupiedRooms}</div>
                <div className="text-sm text-gray-600">
                  {Math.round((statistics.occupiedRooms / statistics.totalRooms) * 100)}% du total
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Chambres Vides</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600 mb-2">{statistics.emptyRooms}</div>
                <div className="text-sm text-gray-600">
                  Disponibles immédiatement
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Chambres Pleines</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600 mb-2">{statistics.fullRooms}</div>
                <div className="text-sm text-gray-600">
                  À capacité maximale
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Analyse de Capacité</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Occupation Globale</span>
                    <span>{statistics.occupancyRate}%</span>
                  </div>
                  <Progress value={statistics.occupancyRate} className="h-3" />
                </div>
                <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{statistics.totalCapacity}</div>
                    <div className="text-sm text-gray-600">Capacité totale</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{statistics.occupiedPlaces}</div>
                    <div className="text-sm text-gray-600">Places occupées</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{statistics.availablePlaces}</div>
                    <div className="text-sm text-gray-600">Places libres</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Retention & Turnover */}
            <Card>
              <CardHeader>
                <CardTitle>Rétention et Rotation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Taux de Rétention</span>
                      <span className="font-semibold">{statistics.retentionRate}%</span>
                    </div>
                    <Progress value={statistics.retentionRate} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Taux de Rotation</span>
                      <span className="font-semibold">{statistics.turnoverRate}%</span>
                    </div>
                    <Progress value={statistics.turnoverRate} className="h-2" />
                  </div>
                  <div className="pt-2 border-t text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Durée moyenne de séjour:</span>
                      <span className="font-semibold">{statistics.averageStayDuration} jours</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total sorties enregistrées:</span>
                      <span className="font-semibold">{statistics.totalExitedWorkers}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Exit Reasons */}
            <Card>
              <CardHeader>
                <CardTitle>Analyse des Sorties</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(statistics.exitReasons)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 5)
                    .map(([reason, count]) => (
                    <div key={reason} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600 capitalize">
                        {reason.replace('_', ' ')}
                      </span>
                      <div className="flex items-center space-x-2">
                        <Progress 
                          value={statistics.totalExitedWorkers > 0 ? (count / statistics.totalExitedWorkers) * 100 : 0} 
                          className="w-20"
                        />
                        <span className="text-sm font-semibold text-gray-900 min-w-[2rem]">
                          {count}
                        </span>
                      </div>
                    </div>
                  ))}
                  {Object.keys(statistics.exitReasons).length === 0 && (
                    <div className="text-center text-gray-500 py-4">
                      Aucune sortie enregistrée
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Ferme Statistics (Super Admin) */}
      {isSuperAdmin && fermeStatistics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Building2 className="mr-2 h-5 w-5" />
              Performance par Ferme
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {fermeStatistics.map((stat) => (
                <div key={stat.ferme.id} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-gray-900">{stat.ferme.nom}</h4>
                      <p className="text-sm text-gray-600">{stat.workers} ouvriers • {stat.rooms} chambres</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant={stat.occupancyRate > 85 ? "destructive" : stat.occupancyRate > 60 ? "default" : "secondary"}
                      >
                        {stat.occupancyRate}% occupé
                      </Badge>
                      {stat.occupancyRate > 90 && <AlertTriangle className="h-4 w-4 text-red-500" />}
                      {stat.occupancyRate > 80 && stat.occupancyRate <= 90 && <CheckCircle className="h-4 w-4 text-green-500" />}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div className="text-center">
                      <p className="font-semibold text-gray-900">{stat.workers}</p>
                      <p className="text-gray-500">Ouvriers</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-gray-900">{stat.occupied}/{stat.capacity}</p>
                      <p className="text-gray-500">Occupation</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-gray-900">{stat.maleWorkers}H/{stat.femaleWorkers}F</p>
                      <p className="text-gray-500">Répartition</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-gray-900">{stat.averageAge} ans</p>
                      <p className="text-gray-500">Âge moyen</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-gray-900">{stat.available}</p>
                      <p className="text-gray-500">Places libres</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Progress value={stat.occupancyRate} className="h-2" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Items & Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Target className="mr-2 h-5 w-5" />
            Recommandations Automatiques
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {statistics.isHighOccupancy && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center mb-2">
                  <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                  <span className="font-medium text-red-900">Occupation Critique</span>
                </div>
                <p className="text-sm text-red-800">
                  Taux d'occupation de {statistics.occupancyRate}%. Considérez l'expansion ou la réallocation.
                </p>
              </div>
            )}
            
            {statistics.isLowOccupancy && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center mb-2">
                  <TrendingDown className="h-5 w-5 text-yellow-600 mr-2" />
                  <span className="font-medium text-yellow-900">Sous-utilisation</span>
                </div>
                <p className="text-sm text-yellow-800">
                  {statistics.availablePlaces} places libres. Opportunité d'optimisation ou de marketing.
                </p>
              </div>
            )}
            
            {!statistics.balancedGender && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center mb-2">
                  <Users className="h-5 w-5 text-blue-600 mr-2" />
                  <span className="font-medium text-blue-900">Déséquilibre Genre</span>
                </div>
                <p className="text-sm text-blue-800">
                  Déséquilibre détecté. Considérez des actions de recrutement ciblées.
                </p>
              </div>
            )}
            
            {statistics.turnoverRate > 20 && (
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-center mb-2">
                  <LogOut className="h-5 w-5 text-purple-600 mr-2" />
                  <span className="font-medium text-purple-900">Rotation Élevée</span>
                </div>
                <p className="text-sm text-purple-800">
                  Taux de rotation de {statistics.turnoverRate}%. Analysez les causes de départ.
                </p>
              </div>
            )}
            
            {statistics.hasRecentGrowth && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center mb-2">
                  <TrendingUp className="h-5 w-5 text-green-600 mr-2" />
                  <span className="font-medium text-green-900">Croissance Positive</span>
                </div>
                <p className="text-sm text-green-800">
                  +{statistics.netChange} ouvriers nets. Excellent momentum à maintenir.
                </p>
              </div>
            )}
            

          </div>
        </CardContent>
      </Card>
    </div>
  );
}
