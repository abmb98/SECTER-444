import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Upload, 
  FileText, 
  Check, 
  X, 
  AlertCircle, 
  Edit,
  Download,
  Users,
  UserCheck,
  UserX
} from 'lucide-react';
import { Worker, Ferme, Room } from '@shared/types';
import * as XLSX from 'xlsx';

interface ImportedWorker extends Partial<Worker> {
  rowIndex: number;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  isEditing?: boolean;
}

interface WorkerImportProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (workers: Omit<Worker, 'id'>[]) => Promise<void>;
  fermes: Ferme[];
  rooms: Room[];
  userFermeId?: string;
  isSuperAdmin: boolean;
}

export const WorkerImport: React.FC<WorkerImportProps> = ({ 
  isOpen, 
  onClose, 
  onImport, 
  fermes, 
  rooms, 
  userFermeId, 
  isSuperAdmin 
}) => {
  const [importedWorkers, setImportedWorkers] = useState<ImportedWorker[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'upload' | 'preview' | 'confirm'>('upload');
  const [importSummary, setImportSummary] = useState<{
    total: number;
    valid: number;
    invalid: number;
  }>({ total: 0, valid: 0, invalid: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const columnMappings = {
    // French names
    'nom': ['nom', 'name', 'prénom', 'prenom', 'nom complet', 'full name'],
    'cin': ['cin', 'cni', 'carte identité', 'carte_identite', 'id', 'identity'],
    'telephone': ['telephone', 'téléphone', 'phone', 'tel', 'mobile', 'gsm'],
    'sexe': ['sexe', 'gender', 'genre', 'sex'],
    'age': ['age', 'âge', 'years', 'ans'],
    'chambre': ['chambre', 'room', 'numero chambre', 'room number', 'chamber'],
    'ferme': ['ferme', 'farm', 'exploitation', 'site'],
    'dateAcces': ['date accès', 'date_acces', 'dateacces', 'access date', 'date access', 'date d\'accès', 'date dacces']
  };

  const normalizeColumnName = (columnName: string): string => {
    const normalized = columnName.toLowerCase().trim().replace(/[^\w]/g, '');

    // Find matching column
    for (const [standardName, variations] of Object.entries(columnMappings)) {
      if (variations.some(variation =>
        normalized.includes(variation.replace(/[^\w]/g, '')) ||
        variation.replace(/[^\w]/g, '').includes(normalized)
      )) {
        return standardName;
      }
    }
    return normalized;
  };

  const validateWorkerData = (data: any, rowIndex: number): ImportedWorker => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const worker: Partial<Worker> = {};

    console.log(`🔍 Validating row ${rowIndex}:`, data);

    // Validate required fields - handle different data types
    const nom = data.nom ? String(data.nom).trim() : '';
    if (!nom || nom === '') {
      errors.push('Nom requis');
    } else {
      worker.nom = nom;
    }

    const cin = data.cin ? String(data.cin).trim() : '';
    if (!cin || cin === '') {
      errors.push('CIN requis');
    } else {
      worker.cin = cin;
    }

    // Validate gender
    const sexeRaw = data.sexe ? String(data.sexe).toLowerCase().trim() : '';
    const maleVariations = ['homme', 'h', 'm', 'male', 'masculin', '1', 'man'];
    const femaleVariations = ['femme', 'f', 'female', 'féminin', 'feminin', '2', 'woman'];

    if (!sexeRaw || (!maleVariations.includes(sexeRaw) && !femaleVariations.includes(sexeRaw))) {
      errors.push('Sexe invalide (homme/femme)');
      console.log(`❌ Invalid gender: "${sexeRaw}" for row ${rowIndex}`);
    } else {
      worker.sexe = maleVariations.includes(sexeRaw) ? 'homme' : 'femme';
    }

    // Validate age
    let age: number;
    if (typeof data.age === 'number') {
      age = data.age;
    } else if (data.age) {
      age = parseInt(String(data.age).replace(/[^\d]/g, ''));
    } else {
      age = NaN;
    }

    if (isNaN(age) || age < 16 || age > 70) {
      errors.push('Âge invalide (16-70)');
      console.log(`❌ Invalid age: "${data.age}" -> ${age} for row ${rowIndex}`);
    } else {
      worker.age = age;
      worker.yearOfBirth = new Date().getFullYear() - age;
    }

    // Validate phone (optional)
    const telephone = data.telephone ? String(data.telephone).trim() : '';
    if (telephone) {
      // Clean the phone number and validate
      const cleanPhone = telephone.replace(/[^\d+]/g, '');
      if (cleanPhone.length < 8 || cleanPhone.length > 15) {
        errors.push('Format téléphone invalide');
      } else {
        worker.telephone = telephone;
      }
    } else {
      worker.telephone = '';
    }

    // Validate ferme
    const fermeName = data.ferme ? String(data.ferme).trim() : '';
    if (!fermeName) {
      if (!userFermeId) {
        errors.push('Ferme requise');
      } else {
        worker.fermeId = userFermeId;
      }
    } else {
      const ferme = fermes.find(f => 
        f.nom.toLowerCase() === fermeName.toLowerCase() || 
        f.id === fermeName
      );
      if (!ferme) {
        errors.push(`Ferme "${fermeName}" non trouvée`);
      } else {
        worker.fermeId = ferme.id;
      }
    }

    // Validate access date (optional)
    if (data.dateAcces) {
      const dateAccessStr = String(data.dateAcces).trim();

      // Try to parse different date formats
      let parsedDate: Date | null = null;

      // Check if it's already a valid Date object (from Excel)
      if (data.dateAcces instanceof Date) {
        parsedDate = data.dateAcces;
      } else {
        // Try different date formats
        const dateFormats = [
          dateAccessStr, // As is
          dateAccessStr.replace(/[\/\\]/g, '-'), // Replace / or \ with -
          dateAccessStr.replace(/(\d{1,2})[\/\\-](\d{1,2})[\/\\-](\d{4})/, '$3-$2-$1'), // DD/MM/YYYY to YYYY-MM-DD
          dateAccessStr.replace(/(\d{1,2})[\/\\-](\d{1,2})[\/\\-](\d{2})/, '20$3-$2-$1') // DD/MM/YY to YYYY-MM-DD
        ];

        for (const format of dateFormats) {
          const testDate = new Date(format);
          if (!isNaN(testDate.getTime())) {
            parsedDate = testDate;
            break;
          }
        }
      }

      if (parsedDate && !isNaN(parsedDate.getTime())) {
        // Format as YYYY-MM-DD
        worker.dateEntree = parsedDate.toISOString().split('T')[0];
        console.log(`✅ Access date parsed for row ${rowIndex}: ${dateAccessStr} → ${worker.dateEntree}`);
      } else {
        warnings.push(`Format de date d'accès invalide: "${dateAccessStr}" - ignoré`);
        console.log(`⚠️ Invalid access date format for row ${rowIndex}: "${dateAccessStr}"`);
      }
    }

    // Validate chamber (optional)
    if (data.chambre && worker.fermeId && worker.sexe) {
      const chambreNum = String(data.chambre).trim();
      const workerGenderType = worker.sexe === 'homme' ? 'hommes' : 'femmes';

      // First, try to find a room that matches number, ferme, AND gender
      const compatibleRoom = rooms.find(r =>
        r.numero === chambreNum &&
        r.fermeId === worker.fermeId &&
        r.genre === workerGenderType
      );

      if (compatibleRoom) {
        // Perfect match - assign the room
        worker.chambre = chambreNum;
        worker.secteur = worker.sexe === 'homme' ? 'Secteur Hommes' : 'Secteur Femmes';
        console.log(`✅ Perfect room match for row ${rowIndex}: ${worker.sexe} → room ${chambreNum} (${workerGenderType})`);
      } else {
        // Check if room exists but with wrong gender
        const existingRoom = rooms.find(r =>
          r.numero === chambreNum &&
          r.fermeId === worker.fermeId
        );

        if (existingRoom) {
          // Room exists but wrong gender - add warning and clear assignment
          console.log(`⚠️ Gender mismatch for row ${rowIndex}: ${worker.sexe} cannot be assigned to ${existingRoom.genre} room ${chambreNum}. Room assignment cleared.`);
          worker.chambre = '';
          worker.secteur = '';
          warnings.push(`Chambre "${chambreNum}" existe mais est pour ${existingRoom.genre}, pas pour ${workerGenderType} - assignation supprimée`);
        } else {
          // Room doesn't exist at all
          worker.chambre = '';
          worker.secteur = '';
          warnings.push(`Chambre "${chambreNum}" non trouvée dans cette ferme - assignation supprimée`);
        }
      }
    } else {
      worker.chambre = '';
      worker.secteur = '';
    }

    // Set default values
    worker.statut = 'actif';

    // Only set today's date if no date was parsed from Excel
    if (!worker.dateEntree) {
      worker.dateEntree = new Date().toISOString().split('T')[0];
    }

    return {
      ...worker,
      rowIndex,
      isValid: errors.length === 0,
      errors,
      warnings
    };
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        alert('Le fichier Excel est vide ou ne contient pas de données valides.');
        return;
      }

      console.log('📊 Raw Excel data (first row):', jsonData[0]);
      console.log('📊 Available columns:', Object.keys(jsonData[0] || {}));

      // Normalize the data with column mapping
      const normalizedData = jsonData.map((row: any) => {
        const normalizedRow: any = {};

        for (const [originalColumn, value] of Object.entries(row)) {
          const normalizedColumn = normalizeColumnName(originalColumn as string);
          normalizedRow[normalizedColumn] = value;
        }

        return normalizedRow;
      });

      console.log('📊 Normalized data (first row):', normalizedData[0]);
      console.log('📊 Normalized columns:', Object.keys(normalizedData[0] || {}));

      // Validate and process each row
      const processedWorkers = normalizedData.map((row, index) =>
        validateWorkerData(row, index + 1)
      );

      setImportedWorkers(processedWorkers);

      // Calculate summary
      const summary = {
        total: processedWorkers.length,
        valid: processedWorkers.filter(w => w.isValid).length,
        invalid: processedWorkers.filter(w => !w.isValid).length
      };
      setImportSummary(summary);

      setStep('preview');
      console.log('✅ Import preview ready:', summary);

    } catch (error) {
      console.error('❌ Error reading Excel file:', error);
      alert('Erreur lors de la lecture du fichier Excel. Vérifiez que le format est correct.');
    } finally {
      setIsProcessing(false);
    }
  };

  const updateWorker = (index: number, field: keyof Worker, value: any) => {
    setImportedWorkers(prev => {
      const updated = [...prev];
      const worker = { ...updated[index] };
      
      // Update the field
      (worker as any)[field] = value;
      
      // Recalculate dependent fields
      if (field === 'sexe' && worker.chambre && worker.fermeId) {
        // Revalidate chamber
        const room = rooms.find(r => 
          r.numero === worker.chambre && 
          r.fermeId === worker.fermeId &&
          ((value === 'homme' && r.genre === 'hommes') ||
           (value === 'femme' && r.genre === 'femmes'))
        );
        
        if (!room) {
          worker.chambre = '';
          worker.secteur = '';
        } else {
          worker.secteur = value === 'homme' ? 'Secteur Hommes' : 'Secteur Femmes';
        }
      }
      
      if (field === 'age') {
        worker.yearOfBirth = new Date().getFullYear() - value;
      }

      // Revalidate the worker
      const validated = validateWorkerData(worker, worker.rowIndex);
      updated[index] = { ...validated, isEditing: worker.isEditing };
      
      return updated;
    });
  };

  const toggleEdit = (index: number) => {
    setImportedWorkers(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], isEditing: !updated[index].isEditing };
      return updated;
    });
  };

  const handleConfirmImport = async () => {
    const validWorkers = importedWorkers.filter(w => w.isValid);
    
    if (validWorkers.length === 0) {
      alert('Aucun ouvrier valide à importer.');
      return;
    }

    setIsProcessing(true);
    try {
      // Convert to proper Worker format (without id and metadata)
      const workersToImport = validWorkers.map(w => {
        const { rowIndex, isValid, errors, warnings, isEditing, ...worker } = w;
        return worker as Omit<Worker, 'id'>;
      });

      await onImport(workersToImport);
      setStep('confirm');
      
      // Reset after a delay
      setTimeout(() => {
        handleClose();
      }, 2000);

    } catch (error) {
      console.error('❌ Import failed:', error);
      alert('Erreur lors de l\'importation. Veuillez réessayer.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setImportedWorkers([]);
    setStep('upload');
    setImportSummary({ total: 0, valid: 0, invalid: 0 });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const downloadTemplate = () => {
    const template = [
      {
        nom: 'Ahmed Alami',
        cin: 'AA123456',
        telephone: '0612345678',
        sexe: 'homme',
        age: 25,
        'date accès': '2024-01-15',
        chambre: '101',
        ferme: 'Ferme Central'
      },
      {
        nom: 'Fatima Benali',
        cin: 'FB789012',
        telephone: '0687654321',
        sexe: 'femme',
        age: 30,
        'date accès': '2024-01-20',
        chambre: '201',
        ferme: 'Ferme Central'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Modèle Ouvriers');
    XLSX.writeFile(workbook, 'modele_import_ouvriers.xlsx');
  };

  const renderUploadStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Upload className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-lg font-medium">Importer des ouvriers</h3>
        <p className="text-gray-600">
          Téléchargez un fichier Excel avec les données des ouvriers
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label>Fichier Excel</Label>
          <Input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            disabled={isProcessing}
            className="mt-1"
          />
          <p className="text-xs text-gray-500 mt-1">
            Formats acceptés: .xlsx, .xls
          </p>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Colonnes requises:</strong> nom, cin, sexe, age<br />
            <strong>Colonnes optionnelles:</strong> telephone, date accès, chambre, ferme<br />
            <strong>Formats acceptés pour sexe:</strong> homme/femme, h/f, m/f, male/female<br />
            <strong>Format âge:</strong> nombre entre 16 et 70<br />
            <strong>Format date d'accès:</strong> YYYY-MM-DD, DD/MM/YYYY, ou DD-MM-YYYY<br />
            <strong>⚠️ Important:</strong> Les chambres doivent correspondre au genre (hommes → chambres hommes, femmes → chambres femmes)
            <br />
            <Button
              variant="link"
              onClick={downloadTemplate}
              className="p-0 h-auto text-blue-600"
            >
              <Download className="h-4 w-4 mr-1" />
              Télécharger le modèle Excel
            </Button>
          </AlertDescription>
        </Alert>
      </div>

      {isProcessing && (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-2">Traitement du fichier...</p>
        </div>
      )}
    </div>
  );

  const renderPreviewStep = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold">{importSummary.total}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Valides</p>
                <p className="text-2xl font-bold text-green-600">{importSummary.valid}</p>
              </div>
              <UserCheck className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Erreurs</p>
                <p className="text-2xl font-bold text-red-600">{importSummary.invalid}</p>
              </div>
              <UserX className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <div className="border rounded-lg max-h-96 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Ligne</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>CIN</TableHead>
              <TableHead>Sexe</TableHead>
              <TableHead>Âge</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Date d'accès</TableHead>
              <TableHead>Ferme</TableHead>
              <TableHead>Chambre</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {importedWorkers.map((worker, index) => (
              <TableRow key={index} className={
                !worker.isValid ? 'bg-red-50' :
                (worker.warnings && worker.warnings.length > 0) ? 'bg-yellow-50' :
                ''
              }>
                <TableCell>{worker.rowIndex}</TableCell>
                <TableCell>
                  {worker.isValid ? (
                    worker.warnings && worker.warnings.length > 0 ? (
                      <Badge className="bg-yellow-100 text-yellow-800">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Avertissement
                      </Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-800">
                        <Check className="h-3 w-3 mr-1" />
                        Valide
                      </Badge>
                    )
                  ) : (
                    <Badge className="bg-red-100 text-red-800">
                      <X className="h-3 w-3 mr-1" />
                      Erreur
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {worker.isEditing ? (
                    <Input
                      value={worker.nom || ''}
                      onChange={(e) => updateWorker(index, 'nom', e.target.value)}
                      className="w-32"
                    />
                  ) : (
                    worker.nom || '-'
                  )}
                </TableCell>
                <TableCell>
                  {worker.isEditing ? (
                    <Input
                      value={worker.cin || ''}
                      onChange={(e) => updateWorker(index, 'cin', e.target.value)}
                      className="w-24"
                    />
                  ) : (
                    worker.cin || '-'
                  )}
                </TableCell>
                <TableCell>
                  {worker.isEditing ? (
                    <Select
                      value={worker.sexe || ''}
                      onValueChange={(value: 'homme' | 'femme') => updateWorker(index, 'sexe', value)}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="homme">Homme</SelectItem>
                        <SelectItem value="femme">Femme</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    worker.sexe || '-'
                  )}
                </TableCell>
                <TableCell>
                  {worker.isEditing ? (
                    <Input
                      type="number"
                      value={worker.age || ''}
                      onChange={(e) => updateWorker(index, 'age', parseInt(e.target.value))}
                      className="w-16"
                      min="16"
                      max="70"
                    />
                  ) : (
                    worker.age || '-'
                  )}
                </TableCell>
                <TableCell>{worker.telephone || '-'}</TableCell>
                <TableCell>
                  {worker.isEditing ? (
                    <Input
                      type="date"
                      value={worker.dateEntree || ''}
                      onChange={(e) => updateWorker(index, 'dateEntree', e.target.value)}
                      className="w-32"
                    />
                  ) : (
                    worker.dateEntree || '-'
                  )}
                </TableCell>
                <TableCell>
                  {worker.fermeId ?
                    fermes.find(f => f.id === worker.fermeId)?.nom || worker.fermeId :
                    '-'
                  }
                </TableCell>
                <TableCell>{worker.chambre || '-'}</TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleEdit(index)}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Column Information */}
      {importedWorkers.length > 0 && (
        <Alert className="bg-blue-50 border-blue-200">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription>
            <strong className="text-blue-800">Colonnes détectées dans votre fichier:</strong>
            <div className="mt-2 text-sm text-blue-700">
              {Object.keys(importedWorkers[0]).filter(key => !['rowIndex', 'isValid', 'errors', 'warnings', 'isEditing'].includes(key)).join(', ')}
            </div>
            <div className="mt-2 text-xs text-blue-600">
              Si certaines colonnes ne sont pas reconnues, vérifiez l'orthographe ou utilisez le modèle Excel.
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Error Display */}
      {importSummary.invalid > 0 && (
        <Alert className="bg-red-50 border-red-200">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription>
            <strong className="text-red-800">
              {importSummary.invalid} ligne(s) avec erreurs:
            </strong>
            <div className="mt-2 max-h-32 overflow-auto">
              {importedWorkers
                .filter(w => !w.isValid)
                .map(w => (
                  <div key={w.rowIndex} className="text-sm text-red-700">
                    Ligne {w.rowIndex}: {w.errors.join(', ')}
                  </div>
                ))
              }
            </div>
            <div className="mt-2 text-xs text-red-600">
              💡 Conseil: Utilisez le modèle Excel ou vérifiez les noms des colonnes et les formats de données.
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Warning Display */}
      {importedWorkers.some(w => w.warnings && w.warnings.length > 0) && (
        <Alert className="bg-yellow-50 border-yellow-200">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription>
            <strong className="text-yellow-800">
              Avertissements (n'empêchent pas l'importation):
            </strong>
            <div className="mt-2 max-h-32 overflow-auto">
              {importedWorkers
                .filter(w => w.warnings && w.warnings.length > 0)
                .map(w => (
                  <div key={w.rowIndex} className="text-sm text-yellow-700">
                    Ligne {w.rowIndex}: {w.warnings?.join(', ')}
                  </div>
                ))
              }
            </div>
            <div className="mt-2 text-xs text-yellow-600">
              ℹ️ Ces problèmes ont été automatiquement corrigés. Les ouvriers seront importés sans assignation de chambre.
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep('upload')}>
          Retour
        </Button>
        <Button
          onClick={handleConfirmImport}
          disabled={importSummary.valid === 0 || isProcessing}
          className="bg-green-600 hover:bg-green-700"
        >
          {isProcessing ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          ) : (
            <Check className="mr-2 h-4 w-4" />
          )}
          Importer {importSummary.valid} ouvrier(s)
        </Button>
      </div>
    </div>
  );

  const renderConfirmStep = () => (
    <div className="text-center space-y-4">
      <div className="text-green-600">
        <Check className="mx-auto h-16 w-16" />
      </div>
      <h3 className="text-lg font-medium">Import réussi!</h3>
      <p className="text-gray-600">
        {importSummary.valid} ouvrier(s) ont été importés avec succès.
      </p>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            <FileText className="inline h-5 w-5 mr-2" />
            Importer des ouvriers depuis Excel
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Téléchargez un fichier Excel contenant les données des ouvriers'}
            {step === 'preview' && 'Vérifiez et modifiez les données avant l\'importation'}
            {step === 'confirm' && 'Importation terminée avec succès'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {step === 'upload' && renderUploadStep()}
          {step === 'preview' && renderPreviewStep()}
          {step === 'confirm' && renderConfirmStep()}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WorkerImport;
