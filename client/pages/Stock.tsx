import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Package,
  Send,
  Check,
  Clock,
  Filter,
  Plus,
  ArrowRight,
  Warehouse,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Download
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  increment,
  getDocs,
  orderBy
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { StockItem, StockTransfer, StockAddition, Ferme } from '@shared/types';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => void;
    lastAutoTable: { finalY: number };
  }
}

export default function Stock() {
  const { user, isSuperAdmin } = useAuth();
  const { toast } = useToast();

  // State
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [stockAdditions, setStockAdditions] = useState<StockAddition[]>([]);
  const [secteurs, setSecteurs] = useState<Ferme[]>([]);
  const [selectedSecteur, setSelectedSecteur] = useState<string>('all');
  const [selectedArticle, setSelectedArticle] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Transfer filtering state
  const [transferFilters, setTransferFilters] = useState({
    article: '',
    dateFrom: '',
    dateTo: '',
    status: 'all' // 'all', 'pending', 'confirmed'
  });

  // Transfer form state
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [transferForm, setTransferForm] = useState({
    item: '',
    quantity: '',
    unit: 'piece',
    toSecteurId: '',
    fromSecteurId: '' // For super admin use
  });

  // Add stock form state
  const [showAddStockDialog, setShowAddStockDialog] = useState(false);
  const [addStockForm, setAddStockForm] = useState({
    item: '',
    quantity: '',
    unit: 'piece',
    secteurId: isSuperAdmin ? '' : user?.fermeId || ''
  });

  // Confirmation dialog state
  const [confirmingTransfer, setConfirmingTransfer] = useState<StockTransfer | null>(null);
  const [confirmingAddition, setConfirmingAddition] = useState<StockAddition | null>(null);

  // Load secteurs
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'fermes'), (snapshot) => {
      const secteursData = snapshot.docs.map(doc => ({
        id: doc.id,
        nom: doc.data().nom
      }));
      setSecteurs(secteursData);
    });
    return unsubscribe;
  }, []);

  // Load stocks based on user role
  useEffect(() => {
    setLoading(true);
    let stockQuery;

    if (isSuperAdmin) {
      if (selectedSecteur === 'all') {
        stockQuery = query(collection(db, 'stocks'));
      } else {
        stockQuery = query(
          collection(db, 'stocks'),
          where('secteurId', '==', selectedSecteur)
        );
      }
    } else {
      // Admin secteur only sees their own sector
      stockQuery = query(
        collection(db, 'stocks'),
        where('secteurId', '==', user?.fermeId || '')
      );
    }

    const unsubscribe = onSnapshot(stockQuery, (snapshot) => {
      const stocksData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StockItem[];

      // Sort in memory instead of using Firestore orderBy to avoid index issues
      stocksData.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());

      setStocks(stocksData);
      setLoading(false);
    });

    return unsubscribe;
  }, [isSuperAdmin, selectedSecteur, user?.fermeId]);

  // Load transfers based on user role
  useEffect(() => {
    if (!user?.fermeId && !isSuperAdmin) return;

    if (isSuperAdmin) {
      // Super admin sees all transfers
      const transferQuery = query(collection(db, 'stock_transfers'));

      const unsubscribe = onSnapshot(transferQuery, (snapshot) => {
        const transfersData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as StockTransfer[];

        // Sort in memory instead of using Firestore orderBy to avoid index issues
        transfersData.sort((a, b) => {
          if (a.createdAt && b.createdAt) {
            return b.createdAt.toMillis() - a.createdAt.toMillis();
          }
          return 0;
        });

        setTransfers(transfersData);
      });

      return unsubscribe;
    } else {
      // Admin secteur sees transfers involving their sector (both incoming and outgoing)
      // We need two separate queries since Firestore doesn't support OR queries

      // Query for incoming transfers (where user's farm is the recipient)
      const incomingQuery = query(
        collection(db, 'stock_transfers'),
        where('toSecteurId', '==', user?.fermeId || '')
      );

      // Query for outgoing transfers (where user's farm is the sender)
      const outgoingQuery = query(
        collection(db, 'stock_transfers'),
        where('fromSecteurId', '==', user?.fermeId || '')
      );

      let incomingTransfers: StockTransfer[] = [];
      let outgoingTransfers: StockTransfer[] = [];
      let unsubscribeCount = 0;

      const combineAndSetTransfers = () => {
        // Combine and deduplicate transfers
        const allTransfers = [...incomingTransfers, ...outgoingTransfers];
        const uniqueTransfers = allTransfers.filter((transfer, index, self) =>
          index === self.findIndex(t => t.id === transfer.id)
        );

        // Sort in memory
        uniqueTransfers.sort((a, b) => {
          if (a.createdAt && b.createdAt) {
            return b.createdAt.toMillis() - a.createdAt.toMillis();
          }
          return 0;
        });

        setTransfers(uniqueTransfers);
      };

      // Subscribe to incoming transfers
      const unsubscribeIncoming = onSnapshot(incomingQuery, (snapshot) => {
        incomingTransfers = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as StockTransfer[];

        unsubscribeCount++;
        if (unsubscribeCount >= 2) {
          combineAndSetTransfers();
        }
      });

      // Subscribe to outgoing transfers
      const unsubscribeOutgoing = onSnapshot(outgoingQuery, (snapshot) => {
        outgoingTransfers = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as StockTransfer[];

        unsubscribeCount++;
        if (unsubscribeCount >= 2) {
          combineAndSetTransfers();
        }
      });

      return () => {
        unsubscribeIncoming();
        unsubscribeOutgoing();
      };
    }
  }, [isSuperAdmin, user?.fermeId]);

  // Load stock additions based on user role
  useEffect(() => {
    let additionsQuery;

    if (isSuperAdmin) {
      // Super admin sees all their pending additions
      additionsQuery = query(
        collection(db, 'stock_additions'),
        where('addedBy', '==', user?.uid || '')
      );
    } else {
      // Admin secteur sees pending additions for their sector
      additionsQuery = query(
        collection(db, 'stock_additions'),
        where('secteurId', '==', user?.fermeId || ''),
        where('status', '==', 'pending')
      );
    }

    const unsubscribe = onSnapshot(additionsQuery, (snapshot) => {
      const additionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StockAddition[];

      // Sort in memory instead of using Firestore orderBy to avoid index issues
      additionsData.sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          return b.createdAt.toMillis() - a.createdAt.toMillis();
        }
        return 0;
      });

      setStockAdditions(additionsData);
    });

    return unsubscribe;
  }, [isSuperAdmin, user?.fermeId, user?.uid]);

  // Filter stocks by article
  const filteredStocks = useMemo(() => {
    if (selectedArticle === 'all') {
      return stocks;
    }
    return stocks.filter(stock => stock.item === selectedArticle);
  }, [stocks, selectedArticle]);

  // Get unique articles for filter dropdown
  const availableArticles = useMemo(() => {
    const articles = Array.from(new Set(stocks.map(stock => stock.item)));
    return articles.sort();
  }, [stocks]);

  // Calculate total stock summary for super admin
  const totalStockSummary = useMemo(() => {
    if (!isSuperAdmin) return [];

    const itemTotals = filteredStocks.reduce((acc, stock) => {
      const key = `${stock.item}-${stock.unit}`;
      if (!acc[key]) {
        acc[key] = {
          item: stock.item,
          totalQuantity: 0,
          unit: stock.unit
        };
      }
      acc[key].totalQuantity += stock.quantity;
      return acc;
    }, {} as Record<string, { item: string; totalQuantity: number; unit: string }>);

    return Object.values(itemTotals);
  }, [filteredStocks, isSuperAdmin]);

  // Get secteur name by ID
  const getSecteurName = (secteurId: string) => {
    return secteurs.find(s => s.id === secteurId)?.nom || secteurId;
  };

  // Handle add stock form submission
  const handleAddStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!addStockForm.item || !addStockForm.quantity || (!isSuperAdmin && !addStockForm.secteurId)) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs requis",
        variant: "destructive"
      });
      return;
    }

    const quantity = parseInt(addStockForm.quantity);
    if (quantity <= 0) {
      toast({
        title: "Erreur",
        description: "La quantité doit être supérieure à 0",
        variant: "destructive"
      });
      return;
    }

    try {
      if (isSuperAdmin) {
        // Super admin creates pending addition
        await addDoc(collection(db, 'stock_additions'), {
          secteurId: addStockForm.secteurId,
          item: addStockForm.item,
          quantity: quantity,
          unit: addStockForm.unit,
          status: 'pending',
          addedBy: user?.uid,
          createdAt: serverTimestamp(),
          confirmedAt: null
        });

        toast({
          title: "Ajout créé",
          description: "L'ajout de stock a été envoyé et attend confirmation",
          variant: "default"
        });
      } else {
        // Farm admin adds directly to stock
        const existingStockQuery = query(
          collection(db, 'stocks'),
          where('secteurId', '==', user?.fermeId),
          where('item', '==', addStockForm.item)
        );
        const existingSnapshot = await getDocs(existingStockQuery);

        if (existingSnapshot.empty) {
          // Create new stock item
          await addDoc(collection(db, 'stocks'), {
            secteurId: user?.fermeId,
            item: addStockForm.item,
            quantity: quantity,
            unit: addStockForm.unit,
            lastUpdated: new Date().toISOString()
          });
        } else {
          // Update existing stock
          const existingStockDoc = existingSnapshot.docs[0];
          await updateDoc(doc(db, 'stocks', existingStockDoc.id), {
            quantity: increment(quantity),
            lastUpdated: new Date().toISOString()
          });
        }

        toast({
          title: "Stock ajouté",
          description: "Le stock a été ajouté avec succès",
          variant: "default"
        });
      }

      setShowAddStockDialog(false);
      setAddStockForm({
        item: '',
        quantity: '',
        unit: 'piece',
        secteurId: isSuperAdmin ? '' : user?.fermeId || ''
      });
    } catch (error) {
      console.error('Error adding stock:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter le stock",
        variant: "destructive"
      });
    }
  };

  // Handle stock addition confirmation by farm admin
  const handleConfirmAddition = async (addition: StockAddition) => {
    try {
      // Update addition status
      await updateDoc(doc(db, 'stock_additions', addition.id), {
        status: 'confirmed',
        confirmedAt: serverTimestamp()
      });

      // Add to farm's stock
      const existingStockQuery = query(
        collection(db, 'stocks'),
        where('secteurId', '==', addition.secteurId),
        where('item', '==', addition.item)
      );
      const existingSnapshot = await getDocs(existingStockQuery);

      if (existingSnapshot.empty) {
        // Create new stock item
        await addDoc(collection(db, 'stocks'), {
          secteurId: addition.secteurId,
          item: addition.item,
          quantity: addition.quantity,
          unit: addition.unit,
          lastUpdated: new Date().toISOString()
        });
      } else {
        // Update existing stock
        const existingStockDoc = existingSnapshot.docs[0];
        await updateDoc(doc(db, 'stocks', existingStockDoc.id), {
          quantity: increment(addition.quantity),
          lastUpdated: new Date().toISOString()
        });
      }

      toast({
        title: "Ajout confirmé",
        description: "Le stock a été ajouté avec succès",
        variant: "default"
      });

      setConfirmingAddition(null);
    } catch (error) {
      console.error('Error confirming addition:', error);
      toast({
        title: "Erreur",
        description: "Impossible de confirmer l'ajout",
        variant: "destructive"
      });
    }
  };

  // Handle transfer form submission
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation for required fields
    const requiredFields = isSuperAdmin
      ? [transferForm.item, transferForm.quantity, transferForm.toSecteurId, transferForm.fromSecteurId]
      : [transferForm.item, transferForm.quantity, transferForm.toSecteurId];

    if (requiredFields.some(field => !field)) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs requis",
        variant: "destructive"
      });
      return;
    }

    const fromSecteurId = isSuperAdmin ? transferForm.fromSecteurId : user?.fermeId;

    if (transferForm.toSecteurId === fromSecteurId) {
      toast({
        title: "Erreur",
        description: "Vous ne pouvez pas transférer vers le même secteur",
        variant: "destructive"
      });
      return;
    }

    const quantity = parseInt(transferForm.quantity);
    if (quantity <= 0) {
      toast({
        title: "Erreur",
        description: "La quantité doit être supérieure à 0",
        variant: "destructive"
      });
      return;
    }

    // Check if source sector has enough stock
    const currentStock = stocks.find(s =>
      s.secteurId === fromSecteurId &&
      s.item === transferForm.item
    );

    if (!currentStock || currentStock.quantity < quantity) {
      toast({
        title: "Stock insuffisant",
        description: `Stock disponible: ${currentStock?.quantity || 0} ${transferForm.unit}`,
        variant: "destructive"
      });
      return;
    }

    try {
      await addDoc(collection(db, 'stock_transfers'), {
        fromSecteurId: fromSecteurId,
        toSecteurId: transferForm.toSecteurId,
        item: transferForm.item,
        quantity: quantity,
        unit: transferForm.unit,
        status: 'pending',
        createdAt: serverTimestamp(),
        confirmedAt: null
      });

      toast({
        title: "Transfert créé",
        description: "Le transfert a été envoyé et attend confirmation",
        variant: "default"
      });

      setShowTransferDialog(false);
      setTransferForm({
        item: '',
        quantity: '',
        unit: 'piece',
        toSecteurId: '',
        fromSecteurId: ''
      });
    } catch (error) {
      console.error('Error creating transfer:', error);
      toast({
        title: "Erreur",
        description: "Impossible de créer le transfert",
        variant: "destructive"
      });
    }
  };

  // Handle transfer confirmation
  const handleConfirmTransfer = async (transfer: StockTransfer) => {
    try {
      // Update transfer status
      await updateDoc(doc(db, 'stock_transfers', transfer.id), {
        status: 'confirmed',
        confirmedAt: serverTimestamp()
      });

      // Deduct from sender's stock
      const senderStockQuery = query(
        collection(db, 'stocks'),
        where('secteurId', '==', transfer.fromSecteurId),
        where('item', '==', transfer.item)
      );
      const senderSnapshot = await getDocs(senderStockQuery);
      
      if (!senderSnapshot.empty) {
        const senderStockDoc = senderSnapshot.docs[0];
        await updateDoc(doc(db, 'stocks', senderStockDoc.id), {
          quantity: increment(-transfer.quantity),
          lastUpdated: new Date().toISOString()
        });
      }

      // Add to receiver's stock
      const receiverStockQuery = query(
        collection(db, 'stocks'),
        where('secteurId', '==', transfer.toSecteurId),
        where('item', '==', transfer.item)
      );
      const receiverSnapshot = await getDocs(receiverStockQuery);

      if (receiverSnapshot.empty) {
        // Create new stock item
        await addDoc(collection(db, 'stocks'), {
          secteurId: transfer.toSecteurId,
          item: transfer.item,
          quantity: transfer.quantity,
          unit: transfer.unit,
          lastUpdated: new Date().toISOString()
        });
      } else {
        // Update existing stock
        const receiverStockDoc = receiverSnapshot.docs[0];
        await updateDoc(doc(db, 'stocks', receiverStockDoc.id), {
          quantity: increment(transfer.quantity),
          lastUpdated: new Date().toISOString()
        });
      }

      toast({
        title: "Transfert confirmé",
        description: "Le stock a été transféré avec succès",
        variant: "default"
      });

      setConfirmingTransfer(null);
    } catch (error) {
      console.error('Error confirming transfer:', error);
      toast({
        title: "Erreur",
        description: "Impossible de confirmer le transfert",
        variant: "destructive"
      });
    }
  };

  // Get available items for transfer (from current sector's stock or selected source sector for super admin)
  const availableItems = stocks
    .filter(s => {
      const sourceSecteur = isSuperAdmin ? transferForm.fromSecteurId : user?.fermeId;
      return s.secteurId === sourceSecteur && s.quantity > 0;
    })
    .map(s => ({ item: s.item, unit: s.unit, available: s.quantity }));

  // Filter transfers based on search criteria
  const filteredTransfers = useMemo(() => {
    return transfers.filter(transfer => {
      // Filter by article name
      if (transferFilters.article && !transfer.item.toLowerCase().includes(transferFilters.article.toLowerCase())) {
        return false;
      }

      // Filter by status
      if (transferFilters.status !== 'all' && transfer.status !== transferFilters.status) {
        return false;
      }

      // Filter by date range
      if (transferFilters.dateFrom && transfer.createdAt) {
        const transferDate = transfer.createdAt.toDate();
        const fromDate = new Date(transferFilters.dateFrom);
        if (transferDate < fromDate) return false;
      }

      if (transferFilters.dateTo && transfer.createdAt) {
        const transferDate = transfer.createdAt.toDate();
        const toDate = new Date(transferFilters.dateTo);
        toDate.setHours(23, 59, 59, 999); // End of day
        if (transferDate > toDate) return false;
      }

      return true;
    });
  }, [transfers, transferFilters]);

  // Filter pending incoming transfers for current user
  const pendingIncomingTransfers = transfers.filter(t =>
    t.status === 'pending' &&
    t.toSecteurId === user?.fermeId
  );

  // Filter pending stock additions for current user
  const pendingAdditions = stockAdditions.filter(a => a.status === 'pending');
  const totalPendingItems = pendingIncomingTransfers.length + (isSuperAdmin ? 0 : pendingAdditions.length);

  // Generate Excel report
  const generateStockExcelReport = () => {
    try {
      const workbook = XLSX.utils.book_new();
      const today = new Date().toISOString().split('T')[0];

      if (isSuperAdmin) {
        // For Super Admin: Create Resume Total + individual farm sheets

        // 1. Resume Total Sheet (consolidated summary)
        if (totalStockSummary.length > 0) {
          const summaryData = totalStockSummary.map(item => {
            const sectorsWithItem = stocks
              .filter(s => s.item === item.item && s.unit === item.unit)
              .map(s => getSecteurName(s.secteurId))
              .join(', ');
            return {
              'Article': item.item,
              'Quantité Totale': item.totalQuantity,
              'Unité': item.unit,
              'Secteurs Concernés': sectorsWithItem
            };
          });

          const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
          summaryWorksheet['!cols'] = [
            { wch: 25 }, // Article
            { wch: 15 }, // Quantité Totale
            { wch: 12 }, // Unité
            { wch: 40 }  // Secteurs Concernés
          ];
          XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Résumé Total');
        }

        // 2. Individual farm sheets
        secteurs.forEach(ferme => {
          const fermeStocks = stocks.filter(s => s.secteurId === ferme.id);

          if (fermeStocks.length > 0) {
            const fermeData = fermeStocks.map(stock => ({
              'Article': stock.item,
              'Quantité': stock.quantity,
              'Unité': stock.unit,
              'Dernière MAJ': new Date(stock.lastUpdated).toLocaleDateString('fr-FR')
            }));

            const fermeWorksheet = XLSX.utils.json_to_sheet(fermeData);
            fermeWorksheet['!cols'] = [
              { wch: 25 }, // Article
              { wch: 12 }, // Quantité
              { wch: 12 }, // Unité
              { wch: 15 }  // Dernière MAJ
            ];

            // Clean farm name for sheet name (max 31 chars, no special chars)
            const sheetName = ferme.nom.replace(/[[\]\\\/\?\*:]/g, '').substring(0, 31);
            XLSX.utils.book_append_sheet(workbook, fermeWorksheet, sheetName);
          } else {
            // Create empty sheet for farms with no stock
            const emptyData = [
              ['Article', 'Quantité', 'Unité', 'Dernière MAJ'],
              ['Aucun stock disponible', '', '', '']
            ];

            const emptyWorksheet = XLSX.utils.aoa_to_sheet(emptyData);
            emptyWorksheet['!cols'] = [
              { wch: 25 }, // Article
              { wch: 12 }, // Quantité
              { wch: 12 }, // Unité
              { wch: 15 }  // Dernière MAJ
            ];

            const sheetName = ferme.nom.replace(/[[\]\\\/\?\*:]/g, '').substring(0, 31);
            XLSX.utils.book_append_sheet(workbook, emptyWorksheet, sheetName);
          }
        });

        const filename = `inventaire_resume_complet_${today}.xlsx`;
        XLSX.writeFile(workbook, filename);

      } else {
        // For Farm Admin: Only their farm's inventory
        const farmStocks = stocks.filter(s => s.secteurId === user?.fermeId);

        if (farmStocks.length > 0) {
          const stockData = farmStocks.map(stock => ({
            'Article': stock.item,
            'Quantité': stock.quantity,
            'Unité': stock.unit,
            'Dernière MAJ': new Date(stock.lastUpdated).toLocaleDateString('fr-FR')
          }));

          const stockWorksheet = XLSX.utils.json_to_sheet(stockData);
          stockWorksheet['!cols'] = [
            { wch: 25 }, // Article
            { wch: 12 }, // Quantité
            { wch: 12 }, // Unité
            { wch: 15 }  // Dernière MAJ
          ];
          XLSX.utils.book_append_sheet(workbook, stockWorksheet, 'Mon Inventaire');
        } else {
          // Empty sheet if no stock
          const emptyData = [
            ['Article', 'Quantité', 'Unité', 'Dernière MAJ'],
            ['Aucun stock disponible', '', '', '']
          ];

          const emptyWorksheet = XLSX.utils.aoa_to_sheet(emptyData);
          emptyWorksheet['!cols'] = [
            { wch: 25 }, // Article
            { wch: 12 }, // Quantité
            { wch: 12 }, // Unité
            { wch: 15 }  // Dernière MAJ
          ];
          XLSX.utils.book_append_sheet(workbook, emptyWorksheet, 'Mon Inventaire');
        }

        const farmName = getSecteurName(user?.fermeId || '').replace(/\s+/g, '_');
        const filename = `inventaire_${farmName}_${today}.xlsx`;
        XLSX.writeFile(workbook, filename);
      }

      toast({
        title: "Export Excel réussi",
        description: "Le fichier Excel a été téléchargé avec succès",
        variant: "default"
      });

    } catch (error) {
      console.error('Error generating Excel report:', error);
      toast({
        title: "Erreur",
        description: "Impossible de générer le rapport Excel",
        variant: "destructive"
      });
    }
  };

  // Generate comprehensive PDF report
  const generateStockPDFReport = async () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 20;
      let yPosition = margin;

      // Professional Header with gradient effect
      doc.setFillColor(34, 197, 94); // Emerald green background
      doc.rect(0, 0, pageWidth, 40, 'F');
      doc.setFillColor(16, 185, 129); // Lighter emerald gradient
      doc.rect(0, 0, pageWidth, 25, 'F');

      // Header border
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(2);
      doc.line(0, 40, pageWidth, 40);

      // Company/System identifier
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(255, 255, 255);
      doc.text('SYSTEME DE GESTION DE STOCK', margin, 12);

      // Main title
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('RAPPORT COMPLET DE STOCK', pageWidth / 2, 25, { align: 'center' });

      // Report type indicator
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('RAPPORT AVANCE - INVENTAIRE & TRANSFERTS', pageWidth / 2, 35, { align: 'center' });

      yPosition = 50;
      doc.setTextColor(0, 0, 0);

      // Professional date and metadata section
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, 20, 'F');
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.5);
      doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, 20);

      const currentDate = new Date().toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(55, 65, 81);
      doc.text('GENERE LE:', margin + 10, yPosition + 3);
      doc.setFont('helvetica', 'normal');
      doc.text(currentDate, margin + 40, yPosition + 3);

      doc.setFont('helvetica', 'bold');
      doc.text('UTILISATEUR:', margin + 10, yPosition + 10);
      doc.setFont('helvetica', 'normal');
      doc.text(`${user?.nom || 'Utilisateur'} (${isSuperAdmin ? 'Super Admin' : 'Admin Secteur'})`, margin + 45, yPosition + 10);

      yPosition += 30;

      // Executive Summary with visual enhancements
      doc.setFillColor(34, 197, 94);
      doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, 8, 'F');
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('RESUME EXECUTIF', margin + 5, yPosition);
      yPosition += 15;

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      // Calculate summary statistics
      const totalItems = stocks.reduce((sum, stock) => sum + stock.quantity, 0);
      const uniqueItems = new Set(stocks.map(s => s.item)).size;
      const activeSectors = new Set(stocks.map(s => s.secteurId)).size;
      const pendingTransfers = transfers.filter(t => t.status === 'pending').length;
      const completedTransfers = transfers.filter(t => t.status === 'confirmed').length;

      const summaryText = [
        `• ${stocks.length} articles en stock dans le systeme`,
        `• ${totalItems} pieces au total`,
        `• ${uniqueItems} types d'articles differents`,
        `• ${activeSectors} secteurs avec du stock`,
        `• ${pendingTransfers} transferts en attente`,
        `• ${completedTransfers} transferts confirmes`,
        `• ${pendingAdditions.length} ajouts de stock en attente`
      ];

      summaryText.forEach(text => {
        doc.text(text, margin + 5, yPosition);
        yPosition += 7;
      });
      yPosition += 15;

      // Current Stock Inventory Section
      if (yPosition > pageHeight - 80) {
        doc.addPage();
        yPosition = margin;
      }

      doc.setFillColor(59, 130, 246);
      doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, 8, 'F');
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('INVENTAIRE ACTUEL', margin + 5, yPosition);
      yPosition += 15;
      doc.setTextColor(0, 0, 0);

      // Stock table data
      const stockTableData = [
        ['Article', 'Secteur', 'Quantite', 'Unite', 'Derniere MAJ'],
        ...stocks.map(stock => [
          stock.item,
          getSecteurName(stock.secteurId),
          stock.quantity.toString(),
          stock.unit,
          new Date(stock.lastUpdated).toLocaleDateString('fr-FR')
        ])
      ];

      (doc as any).autoTable({
        startY: yPosition,
        head: [stockTableData[0]],
        body: stockTableData.slice(1),
        theme: 'striped',
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: 255,
          fontSize: 10,
          fontStyle: 'bold'
        },
        styles: {
          fontSize: 9,
          cellPadding: 4
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          0: { cellWidth: 35, fontStyle: 'bold' },
          1: { cellWidth: 35 },
          2: { cellWidth: 25, halign: 'center' },
          3: { cellWidth: 25, halign: 'center' },
          4: { cellWidth: 35, halign: 'center' }
        },
        margin: { left: margin, right: margin }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 20;

      // Total Summary by Item (Super Admin only)
      if (isSuperAdmin && totalStockSummary.length > 0) {
        if (yPosition > pageHeight - 80) {
          doc.addPage();
          yPosition = margin;
        }

        doc.setFillColor(139, 69, 19);
        doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, 8, 'F');
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('RESUME TOTAL PAR ARTICLE', margin + 5, yPosition);
        yPosition += 15;
        doc.setTextColor(0, 0, 0);

        const summaryTableData = [
          ['Article', 'Quantite Totale', 'Unite', 'Secteurs Concernes'],
          ...totalStockSummary.map(item => {
            const sectorsWithItem = stocks
              .filter(s => s.item === item.item && s.unit === item.unit)
              .map(s => getSecteurName(s.secteurId))
              .join(', ');
            return [
              item.item,
              item.totalQuantity.toString(),
              item.unit,
              sectorsWithItem
            ];
          })
        ];

        (doc as any).autoTable({
          startY: yPosition,
          head: [summaryTableData[0]],
          body: summaryTableData.slice(1),
          theme: 'grid',
          headStyles: {
            fillColor: [139, 69, 19],
            textColor: 255,
            fontSize: 10,
            fontStyle: 'bold'
          },
          styles: {
            fontSize: 9,
            cellPadding: 4
          },
          columnStyles: {
            0: { cellWidth: 40, fontStyle: 'bold' },
            1: { cellWidth: 30, halign: 'center' },
            2: { cellWidth: 25, halign: 'center' },
            3: { cellWidth: 60 }
          },
          margin: { left: margin, right: margin }
        });

        yPosition = (doc as any).lastAutoTable.finalY + 20;
      }

      // Stock Transfers Section
      if (transfers.length > 0) {
        if (yPosition > pageHeight - 80) {
          doc.addPage();
          yPosition = margin;
        }

        doc.setFillColor(168, 85, 247);
        doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, 8, 'F');
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('HISTORIQUE DES TRANSFERTS', margin + 5, yPosition);
        yPosition += 15;
        doc.setTextColor(0, 0, 0);

        const transfersTableData = [
          ['Article', 'Quantite', 'De', 'Vers', 'Statut', 'Date'],
          ...transfers.slice(0, 20).map(transfer => [
            transfer.item,
            `${transfer.quantity} ${transfer.unit}`,
            getSecteurName(transfer.fromSecteurId),
            getSecteurName(transfer.toSecteurId),
            transfer.status === 'confirmed' ? 'Confirme' : 'En attente',
            transfer.createdAt?.toDate().toLocaleDateString('fr-FR') || 'N/A'
          ])
        ];

        (doc as any).autoTable({
          startY: yPosition,
          head: [transfersTableData[0]],
          body: transfersTableData.slice(1),
          theme: 'striped',
          headStyles: {
            fillColor: [168, 85, 247],
            textColor: 255,
            fontSize: 9,
            fontStyle: 'bold'
          },
          styles: {
            fontSize: 8,
            cellPadding: 3
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252]
          },
          columnStyles: {
            0: { cellWidth: 30 },
            1: { cellWidth: 25, halign: 'center' },
            2: { cellWidth: 30 },
            3: { cellWidth: 30 },
            4: { cellWidth: 25, halign: 'center' },
            5: { cellWidth: 25, halign: 'center' }
          },
          margin: { left: margin, right: margin }
        });

        yPosition = (doc as any).lastAutoTable.finalY + 20;
      }

      // Stock Additions Section (if any)
      if (stockAdditions.length > 0) {
        if (yPosition > pageHeight - 80) {
          doc.addPage();
          yPosition = margin;
        }

        doc.setFillColor(245, 101, 101);
        doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, 8, 'F');
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('HISTORIQUE DES AJOUTS', margin + 5, yPosition);
        yPosition += 15;
        doc.setTextColor(0, 0, 0);

        const additionsTableData = [
          ['Article', 'Quantite', 'Secteur', 'Statut', 'Date Creation'],
          ...stockAdditions.slice(0, 20).map(addition => [
            addition.item,
            `${addition.quantity} ${addition.unit}`,
            getSecteurName(addition.secteurId),
            addition.status === 'confirmed' ? 'Confirme' : 'En attente',
            addition.createdAt?.toDate().toLocaleDateString('fr-FR') || 'N/A'
          ])
        ];

        (doc as any).autoTable({
          startY: yPosition,
          head: [additionsTableData[0]],
          body: additionsTableData.slice(1),
          theme: 'grid',
          headStyles: {
            fillColor: [245, 101, 101],
            textColor: 255,
            fontSize: 10,
            fontStyle: 'bold'
          },
          styles: {
            fontSize: 9,
            cellPadding: 4
          },
          columnStyles: {
            0: { cellWidth: 35 },
            1: { cellWidth: 25, halign: 'center' },
            2: { cellWidth: 35 },
            3: { cellWidth: 25, halign: 'center' },
            4: { cellWidth: 35, halign: 'center' }
          },
          margin: { left: margin, right: margin }
        });

        yPosition = (doc as any).lastAutoTable.finalY + 20;
      }

      // Performance Metrics Section
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = margin;
      }

      doc.setFillColor(34, 139, 34);
      doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, 8, 'F');
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('METRIQUES DE PERFORMANCE', margin + 5, yPosition);
      yPosition += 15;
      doc.setTextColor(0, 0, 0);

      const performanceMetrics = [
        `Efficacite des transferts: ${completedTransfers}/${transfers.length} confirmes (${Math.round((completedTransfers / Math.max(transfers.length, 1)) * 100)}%)`,
        `Diversite du stock: ${uniqueItems} types d'articles differents`,
        `Repartition des secteurs: ${activeSectors} secteurs actifs`,
        `Volume total en circulation: ${totalItems} pieces`,
        `Taux de rotation: ${transfers.length} transferts sur la periode`
      ];

      performanceMetrics.forEach(metric => {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`• ${metric}`, margin + 5, yPosition);
        yPosition += 7;
      });

      // Professional Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);

        // Footer background
        doc.setFillColor(248, 250, 252);
        doc.rect(0, pageHeight - 20, pageWidth, 20, 'F');
        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.5);
        doc.line(0, pageHeight - 20, pageWidth, pageHeight - 20);

        // Footer content
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);

        // Left side - System name
        doc.text('Systeme de Gestion de Stock', margin, pageHeight - 10);

        // Center - Generation date
        doc.text(
          `Rapport genere le ${new Date().toLocaleDateString('fr-FR')}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );

        // Right side - Page number
        doc.text(`Page ${i}/${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });

        // Footer decoration line
        doc.setDrawColor(34, 197, 94);
        doc.setLineWidth(1);
        doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
      }

      // Save the PDF
      const fileName = `rapport_stock_avance_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      toast({
        title: "Rapport généré",
        description: "Le rapport PDF a été téléchargé avec succès",
        variant: "default"
      });

    } catch (error) {
      console.error('Error generating PDF report:', error);
      toast({
        title: "Erreur",
        description: "Impossible de générer le rapport PDF",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Page Header */}
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col space-y-4 lg:space-y-0 lg:flex-row lg:justify-between lg:items-center">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-emerald-600 rounded-lg">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-semibold text-slate-900 tracking-tight">
                Gestion de Stock
              </h1>
              <p className="text-slate-600 mt-1">
                {isSuperAdmin ? "Vue d'ensemble des stocks" : `Stock - ${getSecteurName(user?.fermeId || '')}`}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            {totalPendingItems > 0 && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {totalPendingItems} en attente
              </Badge>
            )}

            {/* Excel Download Button */}
            <Button
              onClick={generateStockExcelReport}
              variant="outline"
              className="border-emerald-600 text-emerald-600 hover:bg-emerald-50"
            >
              <Download className="mr-2 h-4 w-4" />
              Export Excel
            </Button>

            {/* PDF Download Button */}
            <Button
              onClick={generateStockPDFReport}
              variant="outline"
              className="border-slate-600 text-slate-600 hover:bg-slate-50"
            >
              <Download className="mr-2 h-4 w-4" />
              Rapport PDF
            </Button>

            {/* Add Stock Button */}
            <Dialog open={showAddStockDialog} onOpenChange={setShowAddStockDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-emerald-600 text-emerald-600 hover:bg-emerald-50">
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter Stock
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {isSuperAdmin ? "Ajouter Stock (Approbation requise)" : "Ajouter Stock"}
                  </DialogTitle>
                  <DialogDescription>
                    {isSuperAdmin
                      ? "Ajouter du stock à une ferme (nécessite confirmation de l'admin ferme)"
                      : "Ajouter du stock à votre secteur"
                    }
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddStockSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="addItem">Article</Label>
                    <Input
                      id="addItem"
                      value={addStockForm.item}
                      onChange={(e) => setAddStockForm(prev => ({ ...prev, item: e.target.value }))}
                      placeholder="Nom de l'article"
                    />
                  </div>

                  <div>
                    <Label htmlFor="addQuantity">Quantité</Label>
                    <Input
                      id="addQuantity"
                      type="number"
                      min="1"
                      value={addStockForm.quantity}
                      onChange={(e) => setAddStockForm(prev => ({ ...prev, quantity: e.target.value }))}
                      placeholder="Entrer la quantité"
                    />
                  </div>

                  <div>
                    <Label htmlFor="addUnit">Unité</Label>
                    <Input
                      id="addUnit"
                      value={addStockForm.unit}
                      onChange={(e) => setAddStockForm(prev => ({ ...prev, unit: e.target.value }))}
                      placeholder="Ex: piece, kg, litre"
                    />
                  </div>

                  {isSuperAdmin && (
                    <div>
                      <Label htmlFor="addSecteur">Secteur de destination</Label>
                      <Select value={addStockForm.secteurId} onValueChange={(value) =>
                        setAddStockForm(prev => ({ ...prev, secteurId: value }))
                      }>
                        <SelectTrigger>
                          <SelectValue placeholder="S��lectionner le secteur" />
                        </SelectTrigger>
                        <SelectContent>
                          {secteurs.map(secteur => (
                            <SelectItem key={secteur.id} value={secteur.id}>
                              {secteur.nom}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setShowAddStockDialog(false)}>
                      Annuler
                    </Button>
                    <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                      {isSuperAdmin ? "Créer Demande" : "Ajouter Stock"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                  <Send className="mr-2 h-4 w-4" />
                  Transférer Stock
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Créer un Transfert de Stock</DialogTitle>
                  <DialogDescription>
                    {isSuperAdmin
                      ? "Transférer des articles entre secteurs"
                      : "Transférer des articles vers un autre secteur"
                    }
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleTransferSubmit} className="space-y-4">
                  {isSuperAdmin && (
                    <div>
                      <Label htmlFor="fromSecteur">Secteur source</Label>
                      <Select value={transferForm.fromSecteurId || ''} onValueChange={(value) =>
                        setTransferForm(prev => ({ ...prev, fromSecteurId: value }))
                      }>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner le secteur source" />
                        </SelectTrigger>
                        <SelectContent>
                          {secteurs.map(secteur => (
                            <SelectItem key={secteur.id} value={secteur.id}>
                              {secteur.nom}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="item">Article</Label>
                    <Select value={transferForm.item} onValueChange={(value) => {
                      const selectedItem = availableItems.find(i => i.item === value);
                      setTransferForm(prev => ({
                        ...prev,
                        item: value,
                        unit: selectedItem?.unit || 'piece'
                      }));
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un article" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableItems.map((item, index) => (
                          <SelectItem key={index} value={item.item}>
                            {item.item} (Disponible: {item.available} {item.unit})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="quantity">Quantité</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      value={transferForm.quantity}
                      onChange={(e) => setTransferForm(prev => ({ ...prev, quantity: e.target.value }))}
                      placeholder="Entrer la quantité"
                    />
                  </div>

                  <div>
                    <Label htmlFor="unit">Unité</Label>
                    <Input
                      id="unit"
                      value={transferForm.unit}
                      onChange={(e) => setTransferForm(prev => ({ ...prev, unit: e.target.value }))}
                      placeholder="Ex: piece, kg, litre"
                    />
                  </div>

                  <div>
                    <Label htmlFor="toSecteur">Secteur de destination</Label>
                    <Select value={transferForm.toSecteurId} onValueChange={(value) =>
                      setTransferForm(prev => ({ ...prev, toSecteurId: value }))
                    }>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner le secteur" />
                      </SelectTrigger>
                      <SelectContent>
                        {secteurs
                          .filter(s => s.id !== (isSuperAdmin ? transferForm.fromSecteurId : user?.fermeId))
                          .map(secteur => (
                            <SelectItem key={secteur.id} value={secteur.id}>
                              {secteur.nom}
                            </SelectItem>
                          ))
                        }
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setShowTransferDialog(false)}>
                      Annuler
                    </Button>
                    <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                      Créer Transfert
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-4 space-y-6">
        {/* Filters - available to all users */}
        <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center space-x-4">
              <Filter className="h-4 w-4 text-slate-600" />

              {/* Sector filter - only for super admin */}
              {isSuperAdmin && (
                <Select value={selectedSecteur} onValueChange={setSelectedSecteur}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filtrer par secteur" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les secteurs</SelectItem>
                    {secteurs.map(secteur => (
                      <SelectItem key={secteur.id} value={secteur.id}>
                        {secteur.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Article filter - available to all users */}
              <Select value={selectedArticle} onValueChange={setSelectedArticle}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtrer par article" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les articles</SelectItem>
                  {availableArticles.map(article => (
                    <SelectItem key={article} value={article}>
                      {article}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="inventory" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
            <TabsTrigger value="inventory">
              <Package className="mr-2 h-4 w-4" />
              Inventaire
            </TabsTrigger>
            {isSuperAdmin && (
              <TabsTrigger value="summary">
                <TrendingUp className="mr-2 h-4 w-4" />
                Résumé Total
              </TabsTrigger>
            )}
            <TabsTrigger value="transfers">
              <ArrowRight className="mr-2 h-4 w-4" />
              Transferts
            </TabsTrigger>
            {!isSuperAdmin && (
              <TabsTrigger value="incoming">
                <Clock className="mr-2 h-4 w-4" />
                Transferts
              </TabsTrigger>
            )}
            {!isSuperAdmin && pendingAdditions.length > 0 && (
              <TabsTrigger value="additions">
                <Plus className="mr-2 h-4 w-4" />
                Ajouts
              </TabsTrigger>
            )}
          </TabsList>

          {/* Inventory Table */}
          <TabsContent value="inventory">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Warehouse className="mr-2 h-5 w-5" />
                  Inventaire {!isSuperAdmin && `- ${getSecteurName(user?.fermeId || '')}`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center items-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                  </div>
                ) : filteredStocks.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    {selectedArticle !== 'all' ? `Aucun stock trouvé pour "${selectedArticle}"` : 'Aucun stock disponible'}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-4 font-medium">Article</th>
                          <th className="text-center p-4 font-medium">Quantité</th>
                          <th className="text-center p-4 font-medium">Unité</th>
                          {isSuperAdmin && (
                            <th className="text-left p-4 font-medium">Secteur</th>
                          )}
                          <th className="text-center p-4 font-medium">Dernière MAJ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStocks.map((stock) => (
                          <tr key={stock.id} className="border-b hover:bg-slate-50">
                            <td className="p-4 font-medium">{stock.item}</td>
                            <td className="p-4 text-center">
                              <Badge variant={stock.quantity > 0 ? "default" : "destructive"}>
                                {stock.quantity}
                              </Badge>
                            </td>
                            <td className="p-4 text-center">{stock.unit}</td>
                            {isSuperAdmin && (
                              <td className="p-4">{getSecteurName(stock.secteurId)}</td>
                            )}
                            <td className="p-4 text-center text-sm text-slate-500">
                              {new Date(stock.lastUpdated).toLocaleDateString('fr-FR')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Total Summary (Super Admin Only) */}
          {isSuperAdmin && (
            <TabsContent value="summary">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <TrendingUp className="mr-2 h-5 w-5" />
                    Résumé Total par Article
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {totalStockSummary.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      Aucun stock disponible
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-4 font-medium">Article</th>
                            <th className="text-center p-4 font-medium">Quantité Totale</th>
                            <th className="text-center p-4 font-medium">Unité</th>
                          </tr>
                        </thead>
                        <tbody>
                          {totalStockSummary.map((item, index) => (
                            <tr key={index} className="border-b hover:bg-slate-50">
                              <td className="p-4 font-medium">{item.item}</td>
                              <td className="p-4 text-center">
                                <Badge variant={item.totalQuantity > 0 ? "default" : "destructive"}>
                                  {item.totalQuantity}
                                </Badge>
                              </td>
                              <td className="p-4 text-center">{item.unit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Transfers */}
          <TabsContent value="transfers">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <ArrowRight className="mr-2 h-5 w-5" />
                    {isSuperAdmin ? "Tous les Transferts" : "Mes Transferts"}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {filteredTransfers.length} transfert{filteredTransfers.length !== 1 ? 's' : ''}
                  </Badge>
                </CardTitle>

                {/* Transfer Filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 p-4 bg-slate-50 rounded-lg">
                  <div>
                    <Label htmlFor="articleFilter" className="text-xs font-medium">Article</Label>
                    <Input
                      id="articleFilter"
                      placeholder="Filtrer par article..."
                      value={transferFilters.article}
                      onChange={(e) => setTransferFilters(prev => ({ ...prev, article: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>

                  <div>
                    <Label htmlFor="statusFilter" className="text-xs font-medium">Statut</Label>
                    <Select value={transferFilters.status} onValueChange={(value) =>
                      setTransferFilters(prev => ({ ...prev, status: value }))
                    }>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous les statuts</SelectItem>
                        <SelectItem value="pending">En attente</SelectItem>
                        <SelectItem value="confirmed">Confirmé</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="dateFrom" className="text-xs font-medium">Date de début</Label>
                    <Input
                      id="dateFrom"
                      type="date"
                      value={transferFilters.dateFrom}
                      onChange={(e) => setTransferFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>

                  <div>
                    <Label htmlFor="dateTo" className="text-xs font-medium">Date de fin</Label>
                    <Input
                      id="dateTo"
                      type="date"
                      value={transferFilters.dateTo}
                      onChange={(e) => setTransferFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>

                {/* Clear Filters Button */}
                {(transferFilters.article || transferFilters.dateFrom || transferFilters.dateTo || transferFilters.status !== 'all') && (
                  <div className="mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTransferFilters({ article: '', dateFrom: '', dateTo: '', status: 'all' })}
                      className="text-xs"
                    >
                      <XCircle className="mr-1 h-3 w-3" />
                      Effacer filtres
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {filteredTransfers.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    {transfers.length === 0 ? "Aucun transfert trouvé" : "Aucun transfert ne correspond aux filtres"}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-4 font-medium">Article</th>
                          <th className="text-center p-4 font-medium">Quantité</th>
                          <th className="text-left p-4 font-medium">De</th>
                          <th className="text-left p-4 font-medium">Vers</th>
                          <th className="text-center p-4 font-medium">Type</th>
                          <th className="text-center p-4 font-medium">Statut</th>
                          <th className="text-center p-4 font-medium">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTransfers.map((transfer) => {
                          const isOutgoing = transfer.fromSecteurId === user?.fermeId;
                          const isIncoming = transfer.toSecteurId === user?.fermeId;

                          return (
                            <tr key={transfer.id} className="border-b hover:bg-slate-50">
                              <td className="p-4 font-medium">{transfer.item}</td>
                              <td className="p-4 text-center">{transfer.quantity} {transfer.unit}</td>
                              <td className="p-4">{getSecteurName(transfer.fromSecteurId)}</td>
                              <td className="p-4">{getSecteurName(transfer.toSecteurId)}</td>
                              <td className="p-4 text-center">
                                {!isSuperAdmin && (
                                  <Badge variant={isOutgoing ? "outline" : "secondary"} className="text-xs">
                                    {isOutgoing ? (
                                      <>⬆️ Sortant</>
                                    ) : (
                                      <>⬇️ Entrant</>
                                    )}
                                  </Badge>
                                )}
                              </td>
                              <td className="p-4 text-center">
                                <Badge variant={transfer.status === 'confirmed' ? "default" : "secondary"}>
                                  {transfer.status === 'confirmed' ? (
                                    <><CheckCircle className="mr-1 h-3 w-3" /> Confirmé</>
                                  ) : (
                                    <><Clock className="mr-1 h-3 w-3" /> En attente</>
                                  )}
                                </Badge>
                              </td>
                              <td className="p-4 text-center text-sm text-slate-500">
                                {transfer.createdAt?.toDate().toLocaleDateString('fr-FR')}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Incoming Transfers (Admin Secteur Only) */}
          {!isSuperAdmin && (
            <TabsContent value="incoming">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Clock className="mr-2 h-5 w-5 text-orange-500" />
                    Transferts en Attente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pendingIncomingTransfers.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      Aucun transfert en attente
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {pendingIncomingTransfers.map((transfer) => (
                        <div key={transfer.id} className="border rounded-lg p-4 bg-orange-50">
                          <div className="flex justify-between items-start">
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <h3 className="font-medium">{transfer.item}</h3>
                                <Badge variant="outline">{transfer.quantity} {transfer.unit}</Badge>
                              </div>
                              <p className="text-sm text-slate-600">
                                De: <span className="font-medium">{getSecteurName(transfer.fromSecteurId)}</span>
                              </p>
                              <p className="text-xs text-slate-500">
                                Créé le {transfer.createdAt?.toDate().toLocaleDateString('fr-FR')}
                              </p>
                            </div>
                            <Button
                              onClick={() => setConfirmingTransfer(transfer)}
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700"
                            >
                              <Check className="mr-1 h-3 w-3" />
                              Confirmer
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Pending Stock Additions (Admin Secteur Only) */}
          {!isSuperAdmin && (
            <TabsContent value="additions">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Plus className="mr-2 h-5 w-5 text-blue-500" />
                    Ajouts de Stock en Attente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pendingAdditions.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      Aucun ajout en attente
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {pendingAdditions.map((addition) => (
                        <div key={addition.id} className="border rounded-lg p-4 bg-blue-50">
                          <div className="flex justify-between items-start">
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <h3 className="font-medium">{addition.item}</h3>
                                <Badge variant="outline">{addition.quantity} {addition.unit}</Badge>
                              </div>
                              <p className="text-sm text-slate-600">
                                Ajouté par: <span className="font-medium">Super Admin</span>
                              </p>
                              <p className="text-xs text-slate-500">
                                Créé le {addition.createdAt?.toDate().toLocaleDateString('fr-FR')}
                              </p>
                            </div>
                            <Button
                              onClick={() => setConfirmingAddition(addition)}
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              <Check className="mr-1 h-3 w-3" />
                              Confirmer
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Transfer Confirmation Dialog */}
      <AlertDialog open={!!confirmingTransfer} onOpenChange={() => setConfirmingTransfer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer le Transfert</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir confirmer la réception de{' '}
              <strong>{confirmingTransfer?.quantity} {confirmingTransfer?.unit}</strong> de{' '}
              <strong>{confirmingTransfer?.item}</strong> de{' '}
              <strong>{getSecteurName(confirmingTransfer?.fromSecteurId || '')}</strong> ?
              <br />
              <br />
              Cette action ne peut pas être annulée et mettra à jour les stocks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmingTransfer && handleConfirmTransfer(confirmingTransfer)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stock Addition Confirmation Dialog */}
      <AlertDialog open={!!confirmingAddition} onOpenChange={() => setConfirmingAddition(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer l'Ajout de Stock</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir confirmer l'ajout de{' '}
              <strong>{confirmingAddition?.quantity} {confirmingAddition?.unit}</strong> de{' '}
              <strong>{confirmingAddition?.item}</strong> à votre stock ?
              <br />
              <br />
              Cette action ajoutera définitivement ces articles à votre inventaire.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmingAddition && handleConfirmAddition(confirmingAddition)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Confirmer l'Ajout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
