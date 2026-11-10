'use client'

import { useState, useEffect, useContext, useMemo } from 'react'
import { useQuery, useMutation, useConvex } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { UserContext } from '@/components/dashboard/UserContext'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  Calculator,
  Plus,
  Trash2,
  Copy,
  Eye,
  Download,
  Check,
  X,
  AlertCircle,
  TrendingUp,
  Search,
  Building,
  Calendar,
  User,
  PlusCircle,
  FolderOpen,
  ArrowUp,
  ArrowDown,
  Info,
  DollarSign,
  Briefcase,
  FileText,
  Printer
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
// ExcelJS is dynamically imported in exportExcel to avoid SSR issues
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'

// Project Type list
const PROJECT_TYPES = [
  "Full Home Interior",
  "2BHK Interior",
  "3BHK Interior",
  "Modular Kitchen",
  "Bedroom Wardrobe",
  "Office Interior",
  "False Ceiling Work",
  "Painting Work",
  "Custom Project"
];

// Measurement units
const MEASUREMENT_UNITS = [
  "Sq.ft",
  "R.ft",
  "C.ft",
  "Nos",
  "Pieces",
  "Sheets",
  "Kg",
  "Litres",
  "Meters",
  "Boxes",
  "Days",
  "Hours",
  "Points",
  "Set",
  "Lumpsum"
];

// Categories
const CATEGORIES = [
  "Civil Work",
  "Woodwork / Carpentry",
  "Electrical",
  "Plumbing",
  "False Ceiling",
  "Painting",
  "Flooring",
  "Wall Paneling",
  "Glass Work",
  "Hardware",
  "Lighting",
  "Furniture",
  "Labour",
  "Transport",
  "Cleaning",
  "Miscellaneous"
];

// Custom font loading utility for Rupee character in PDFs
const fetchAndRegisterFont = async (doc: any) => {
  try {
    // 1. Fetch Regular Weight
    const response = await fetch('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf')
    if (!response.ok) throw new Error("Font fetch failed")
    const arrayBuffer = await response.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    let binary = ''
    const len = uint8Array.byteLength
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8Array[i])
    }
    const base64 = window.btoa(binary)
    doc.addFileToVFS('Roboto-Regular.ttf', base64)
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')

    // 2. Fetch Bold/Medium Weight
    try {
      const boldResponse = await fetch('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf')
      if (boldResponse.ok) {
        const boldBuffer = await boldResponse.arrayBuffer()
        const boldUint8 = new Uint8Array(boldBuffer)
        let boldBinary = ''
        const boldLen = boldUint8.byteLength;
        for (let i = 0; i < boldLen; i++) {
          boldBinary += String.fromCharCode(boldUint8[i])
        }
        const boldBase64 = window.btoa(boldBinary)
        doc.addFileToVFS('Roboto-Bold.ttf', boldBase64)
        doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold')
      } else {
        // Fallback bold to regular
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'bold')
      }
    } catch (e) {
      console.warn("Failed to load Roboto-Medium, using regular fallback for bold weight", e)
      doc.addFont('Roboto-Regular.ttf', 'Roboto', 'bold')
    }

    doc.setFont('Roboto', 'normal')
    return true
  } catch (e) {
    console.error("Failed to load custom font, falling back to standard font", e)
    return false
  }
}

// Indian Currency Formatter
const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(val);
};

// Date Formatter to DD/MM/YYYY
const formatDateToDDMMYYYY = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    // parts = [YYYY, MM, DD]
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch (e) {
    // ignore
  }
  return dateStr;
};

export default function EstimationPage() {
  const { user } = useContext(UserContext);
  const userEmail = user?.email || "";

  // Queries
  const sites = useQuery(api.sites.getSites);
  const estimates = useQuery(api.estimation.getEstimates, userEmail ? { requestorEmail: userEmail } : "skip");
  const rateLibrary = useQuery(api.estimation.getRateLibrary, userEmail ? { requestorEmail: userEmail } : "skip");
  const templates = useQuery(api.estimation.getEstimateTemplates, userEmail ? { requestorEmail: userEmail } : "skip");
  const reportData = useQuery(api.estimation.getEstimateReportData, userEmail ? { requestorEmail: userEmail } : "skip");
  
  // Seed mutation
  const seedData = useMutation(api.estimation.seedEstimationData);

  // Auto-run seeding when database is empty
  useEffect(() => {
    if (userEmail && rateLibrary !== undefined && templates !== undefined) {
      if (rateLibrary.length === 0 && templates.length === 0) {
        seedData({ requestorEmail: userEmail })
          .then(() => {
            console.log("Pre-seeded rates & templates database.");
          })
          .catch((err) => console.error(err));
      }
    }
  }, [rateLibrary, templates, userEmail]);

  // Mutations
  const createEstimateMutation = useMutation(api.estimation.createEstimate);
  const updateEstimateMutation = useMutation(api.estimation.updateEstimate);
  const duplicateEstimateMutation = useMutation(api.estimation.duplicateEstimate);
  const archiveEstimateMutation = useMutation(api.estimation.deleteOrArchiveEstimate);
  const markSentMutation = useMutation(api.estimation.markEstimateSent);
  const markApprovedMutation = useMutation(api.estimation.markEstimateApproved);
  const markRejectedMutation = useMutation(api.estimation.markEstimateRejected);
  const convertToBudgetMutation = useMutation(api.estimation.convertEstimateToSiteBudget);

  const createRateItemMutation = useMutation(api.estimation.createRateItem);
  const updateRateItemMutation = useMutation(api.estimation.updateRateItem);
  const archiveRateItemMutation = useMutation(api.estimation.archiveRateItem);

  const createTemplateMutation = useMutation(api.estimation.createEstimateTemplate);

  const convex = useConvex();

  // Active Tab
  const [activeTab, setActiveTab] = useState("list");

  // Create/Edit Estimate State
  const [editingEstimateId, setEditingEstimateId] = useState<string | null>(null);
  const [estimateHeader, setEstimateHeader] = useState({
    siteId: "",
    clientName: "",
    clientPhone: "",
    clientEmail: "",
    projectAddress: "",
    projectType: "Full Home Interior",
    estimateDate: new Date().toISOString().split("T")[0],
    validUntil: "",
    notes: "",
    termsAndConditions: "1. All rates are based on current material and labor costs. Any changes will be charged extra.\n2. Estimate is valid for 30 days from date of issue.\n3. Work will commence only after client signs this estimate and pays the mobilization advance.",
    discountType: "none",
    discountValue: 0,
    bufferType: "none",
    bufferValue: 0,
    gstType: "No GST",
    gstValue: 0
  });

  const [boqItems, setBoqItems] = useState<Array<{
    id: string;
    category: string;
    subcategory: string;
    itemName: string;
    description: string;
    quantity: number;
    unit: string;
    costPerUnit: number;
    notes: string;
    length?: number;
    width?: number;
    height?: number;
  }>>([]);

  // Auto-fill Client Details from Site
  useEffect(() => {
    if (estimateHeader.siteId && sites) {
      const selected = sites.find(s => s._id === estimateHeader.siteId);
      if (selected) {
        setEstimateHeader(prev => ({
          ...prev,
          clientName: selected.clientName || "",
          projectAddress: selected.location || ""
        }));
      }
    }
  }, [estimateHeader.siteId, sites]);

  // Calculations for Current Estimate
  const calculations = useMemo(() => {
    const subtotal = boqItems.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const rate = Number(item.costPerUnit) || 0;
      return sum + (qty * rate);
    }, 0);

    let discountAmount = 0;
    if (estimateHeader.discountType === "Percentage") {
      discountAmount = (subtotal * (Number(estimateHeader.discountValue) || 0)) / 100;
    } else if (estimateHeader.discountType === "Amount") {
      discountAmount = Number(estimateHeader.discountValue) || 0;
    }
    const afterDiscount = Math.max(0, subtotal - discountAmount);

    let bufferAmount = 0;
    if (estimateHeader.bufferType === "Percentage") {
      bufferAmount = (afterDiscount * (Number(estimateHeader.bufferValue) || 0)) / 100;
    } else if (estimateHeader.bufferType === "Amount") {
      bufferAmount = Number(estimateHeader.bufferValue) || 0;
    }
    const afterBuffer = Math.max(0, afterDiscount + bufferAmount);

    let gstAmount = 0;
    if (estimateHeader.gstType === "GST Percentage") {
      gstAmount = (afterBuffer * (Number(estimateHeader.gstValue) || 0)) / 100;
    } else if (estimateHeader.gstType === "GST Amount") {
      gstAmount = Number(estimateHeader.gstValue) || 0;
    }

    const grandTotal = afterBuffer + gstAmount;

    // Category-wise subtotal breakdown
    const categoryBreakdown: Record<string, number> = {};
    boqItems.forEach(item => {
      const cat = item.category || "Miscellaneous";
      const total = (Number(item.quantity) || 0) * (Number(item.costPerUnit) || 0);
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + total;
    });

    return {
      subtotal,
      discountAmount,
      bufferAmount,
      gstAmount,
      grandTotal,
      categoryBreakdown
    };
  }, [boqItems, estimateHeader]);

  // List Filters State
  const [listFilters, setListFilters] = useState({
    search: "",
    status: "all",
    siteId: "all",
    projectType: "all"
  });

  const filteredEstimates = useMemo(() => {
    if (!estimates) return [];
    return estimates.filter(est => {
      if (listFilters.status !== "all" && est.status !== listFilters.status) return false;
      if (listFilters.siteId !== "all" && est.siteId !== listFilters.siteId) return false;
      if (listFilters.projectType !== "all" && est.projectType !== listFilters.projectType) return false;
      if (listFilters.search) {
        const term = listFilters.search.toLowerCase();
        return (
          est.estimateNumber.toLowerCase().includes(term) ||
          est.clientName.toLowerCase().includes(term) ||
          est.siteName.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [estimates, listFilters]);

  // Estimate vs Actual State
  const [evaSiteId, setEvaSiteId] = useState("all");
  const evaData = useQuery(api.estimation.getEstimateVsActual, userEmail ? {
    requestorEmail: userEmail,
    siteId: evaSiteId
  } : "skip");

  // Modal / Operations state
  const [previewEstimate, setPreviewEstimate] = useState<any>(null);
  const [conversionModal, setConversionModal] = useState<{ open: boolean; estimate: any; mode: "replace" | "add" | "version"; versionName: string; notes: string }>({
    open: false,
    estimate: null,
    mode: "version",
    versionName: "",
    notes: ""
  });
  const [rateItemModal, setRateItemModal] = useState<{ open: boolean; item: any }>({
    open: false,
    item: null
  });
  const [templateModal, setTemplateModal] = useState<{ open: boolean; name: string; projectType: string; description: string }>({
    open: false,
    name: "",
    projectType: "Full Home Interior",
    description: ""
  });

  const [isSaving, setIsSaving] = useState(false);

  // BOQ Row Operations
  const handleAddRow = () => {
    setBoqItems(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        category: "Woodwork / Carpentry",
        subcategory: "",
        itemName: "",
        description: "",
        quantity: 1,
        unit: "Sq.ft",
        costPerUnit: 0,
        notes: ""
      }
    ]);
  };

  const handleDuplicateRow = (idx: number) => {
    const row = boqItems[idx];
    const newItems = [...boqItems];
    newItems.splice(idx + 1, 0, {
      ...row,
      id: Math.random().toString(36).substring(2, 9)
    });
    setBoqItems(newItems);
  };

  const handleDeleteRow = (idx: number) => {
    setBoqItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateRow = (idx: number, field: string, val: any) => {
    setBoqItems(prev => prev.map((item, i) => {
      if (i === idx) {
        const updated = { ...item, [field]: val };
        // Auto-fill from Rate Library
        if (field === "itemName" && rateLibrary) {
          const matched = rateLibrary.find(r => r.itemName.toLowerCase() === String(val).toLowerCase());
          if (matched) {
            updated.category = matched.category;
            updated.unit = matched.unit;
            updated.costPerUnit = matched.defaultRate;
          }
        }
        // Auto-calculate quantity based on dimensions and unit
        if (field === "length" || field === "width" || field === "height" || field === "unit") {
          const l = Number(updated.length);
          const w = Number(updated.width);
          const h = Number(updated.height);
          const u = (updated.unit || "").toLowerCase();

          if (!isNaN(l) && l > 0) {
            if (u === "sq.ft" && !isNaN(w) && w > 0) {
              updated.quantity = Math.round(l * w * 100) / 100;
            } else if (u === "c.ft" && !isNaN(w) && w > 0 && !isNaN(h) && h > 0) {
              updated.quantity = Math.round(l * w * h * 100) / 100;
            } else if (u === "r.ft" || u === "meters") {
              updated.quantity = l;
            }
          }
        }
        return updated;
      }
      return item;
    }));
  };

  const handleApplyTemplate = (templateItems: any[]) => {
    const mapped = templateItems.map((item: any) => ({
      id: Math.random().toString(36).substring(2, 9),
      category: item.category || "Woodwork / Carpentry",
      subcategory: item.subcategory || "",
      itemName: item.itemName,
      description: item.description || "",
      quantity: item.quantity || 1,
      unit: item.unit || "Sq.ft",
      costPerUnit: item.costPerUnit || 0,
      notes: item.notes || "",
      length: item.length,
      width: item.width,
      height: item.height,
    }));
    setBoqItems(mapped);
    toast({ title: "Template Applied", description: `Loaded ${templateItems.length} items from template.` });
  };

  // Save Estimate draft or final
  const handleSaveEstimate = async () => {
    if (!estimateHeader.siteId) {
      toast({ title: "Validation Error", variant: "destructive", description: "Please select a Project Site." });
      return;
    }
    if (!estimateHeader.clientName) {
      toast({ title: "Validation Error", variant: "destructive", description: "Please enter Client Name." });
      return;
    }
    if (boqItems.length === 0) {
      toast({ title: "Validation Error", variant: "destructive", description: "Please add at least one item line." });
      return;
    }

    // validate rows
    for (let i = 0; i < boqItems.length; i++) {
      const row = boqItems[i];
      if (!row.itemName) {
        toast({ title: "Validation Error", variant: "destructive", description: `Row ${i + 1}: Item Name is required.` });
        return;
      }
      if (row.quantity <= 0) {
        toast({ title: "Validation Error", variant: "destructive", description: `Row ${i + 1}: Quantity must be greater than 0.` });
        return;
      }
      if (row.costPerUnit < 0) {
        toast({ title: "Validation Error", variant: "destructive", description: `Row ${i + 1}: Unit Cost cannot be negative.` });
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload = {
        requestorEmail: userEmail,
        siteId: estimateHeader.siteId as any,
        clientName: estimateHeader.clientName,
        clientPhone: estimateHeader.clientPhone || undefined,
        clientEmail: estimateHeader.clientEmail || undefined,
        projectAddress: estimateHeader.projectAddress || undefined,
        projectType: estimateHeader.projectType,
        estimateDate: estimateHeader.estimateDate,
        validUntil: estimateHeader.validUntil || undefined,
        discountType: estimateHeader.discountType,
        discountValue: Number(estimateHeader.discountValue) || 0,
        gstType: estimateHeader.gstType,
        gstValue: Number(estimateHeader.gstValue) || 0,
        bufferType: estimateHeader.bufferType,
        bufferValue: Number(estimateHeader.bufferValue) || 0,
        notes: estimateHeader.notes || undefined,
        termsAndConditions: estimateHeader.termsAndConditions || undefined,
        items: boqItems.map(item => ({
          category: item.category,
          subcategory: item.subcategory || undefined,
          itemName: item.itemName,
          description: item.description || undefined,
          quantity: Number(item.quantity) || 1,
          unit: item.unit,
          costPerUnit: Number(item.costPerUnit) || 0,
          notes: item.notes || undefined,
          length: item.length !== undefined ? Number(item.length) : undefined,
          width: item.width !== undefined ? Number(item.width) : undefined,
          height: item.height !== undefined ? Number(item.height) : undefined,
        }))
      };
 
      if (editingEstimateId) {
        await updateEstimateMutation({ id: editingEstimateId as any, ...payload });
        toast({ title: "Success", description: "Estimate updated successfully." });
      } else {
        await createEstimateMutation(payload);
        toast({ title: "Success", description: "New Estimate Draft created successfully." });
      }
 
      setEditingEstimateId(null);
      setBoqItems([]);
      setEstimateHeader({
        siteId: "",
        clientName: "",
        clientPhone: "",
        clientEmail: "",
        projectAddress: "",
        projectType: "Full Home Interior",
        estimateDate: new Date().toISOString().split("T")[0],
        validUntil: "",
        notes: "",
        termsAndConditions: "1. All rates are based on current material and labor costs. Any changes will be charged extra.\n2. Estimate is valid for 30 days from date of issue.\n3. Work will commence only after client signs this estimate and pays the mobilization advance.",
        discountType: "none",
        discountValue: 0,
        bufferType: "none",
        bufferValue: 0,
        gstType: "No GST",
        gstValue: 0
      });
      setActiveTab("list");
    } catch (e: any) {
      toast({ title: "Error Saving", variant: "destructive", description: e.message || "Something went wrong." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditEstimate = async (est: any) => {
    setIsSaving(true);
    try {
      const data = await ctxTriggerGetEstimateItems(est._id);
      setEstimateHeader({
        siteId: est.siteId,
        clientName: est.clientName,
        clientPhone: est.clientPhone || "",
        clientEmail: est.clientEmail || "",
        projectAddress: est.projectAddress || "",
        projectType: est.projectType,
        estimateDate: est.estimateDate,
        validUntil: est.validUntil || "",
        notes: est.notes || "",
        termsAndConditions: est.termsAndConditions || "1. All rates are based on current material and labor costs. Any changes will be charged extra.\n2. Estimate is valid for 30 days from date of issue.\n3. Work will commence only after client signs this estimate and pays the mobilization advance.",
        discountType: est.discountType || "none",
        discountValue: est.discountValue || 0,
        bufferType: est.bufferType || "none",
        bufferValue: est.bufferValue || 0,
        gstType: est.gstType || "No GST",
        gstValue: est.gstValue || 0
      });
      setBoqItems(data.map((item: any) => ({
        id: item._id,
        category: item.category,
        subcategory: item.subcategory || "",
        itemName: item.itemName,
        description: item.description || "",
        quantity: item.quantity,
        unit: item.unit,
        costPerUnit: item.costPerUnit,
        notes: item.notes || "",
        length: item.length,
        width: item.width,
        height: item.height,
      })));
      setEditingEstimateId(est._id);
      setActiveTab("create");
    } catch (e: any) {
      toast({ title: "Load Failed", variant: "destructive", description: "Failed to load estimate lines." });
    } finally {
      setIsSaving(false);
    }
  };

  // Trigger loading estimate items imperatively
  const ctxTriggerGetEstimateItems = async (estId: string) => {
    return await convex.query(api.estimation.getEstimateItems, { estimateId: estId as any, requestorEmail: userEmail });
  };

  const handleDuplicateEstimate = async (id: string) => {
    try {
      await duplicateEstimateMutation({ id: id as any, requestorEmail: userEmail });
      toast({ title: "Duplicated", description: "Estimate draft duplicated successfully." });
    } catch (e: any) {
      toast({ title: "Error", variant: "destructive", description: e.message });
    }
  };

  const handleArchiveEstimate = async (id: string) => {
    if (!confirm("Are you sure you want to archive this estimate?")) return;
    try {
      await archiveEstimateMutation({ id: id as any, requestorEmail: userEmail });
      toast({ title: "Archived", description: "Estimate archived successfully." });
    } catch (e: any) {
      toast({ title: "Error", variant: "destructive", description: e.message });
    }
  };

  // Convert Estimate to Site Budget Mutation Trigger
  const handleConvertToBudget = async () => {
    const { estimate, versionName, mode, notes } = conversionModal;
    if (!versionName) {
      toast({ title: "Validation Error", variant: "destructive", description: "Please enter a Budget Version Name." });
      return;
    }

    try {
      const result = await convertToBudgetMutation({
        requestorEmail: userEmail,
        id: estimate._id,
        versionName,
        notes: notes || undefined,
        mode
      });
      toast({ title: "Success", description: `Converted successfully. Active budget set to ${formatCurrency(result.budgetAmount)}` });
      setConversionModal({ open: false, estimate: null, mode: "version", versionName: "", notes: "" });
    } catch (e: any) {
      toast({ title: "Error", variant: "destructive", description: e.message });
    }
  };

  // PDF Export Trigger
  const exportPDF = async (est: any) => {
    try {
      const items = await ctxTriggerGetEstimateItems(est._id);
      
      // Group items by category for category summary
      const catMap: Record<string, number> = {};
      items.forEach((item: any) => {
        catMap[item.category] = (catMap[item.category] || 0) + item.totalCost;
      });
      const categorySummary = Object.entries(catMap).map(([category, amount]) => ({
        category,
        amount,
      }));

      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      const hasCustomFont = await fetchAndRegisterFont(doc);
      const currencySymbol = hasCustomFont ? '₹' : 'Rs.';
      const fontName = hasCustomFont ? 'Roboto' : 'helvetica';
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Fetch logo base64 dynamically
      let logoBase64 = '';
      let logoAspectRatio = 3.0; // default aspect ratio
      try {
        const logoRes = await fetch('/logo.png');
        if (logoRes.ok) {
          const blob = await logoRes.blob();
          logoBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          
          // Determine logo aspect ratio
          logoAspectRatio = await new Promise<number>((resolve) => {
            const img = new Image();
            img.onload = () => {
              if (img.height > 0) resolve(img.width / img.height);
              else resolve(3.0);
            };
            img.onerror = () => resolve(3.0);
            img.src = logoBase64;
          });
        }
      } catch (e) {
        console.error("Failed to load logo dynamically for PDF", e);
      }

      // 1. TOP COLORED ACCENT BAR
      doc.setFillColor(22, 60, 68); // Brand Primary Green/Teal
      doc.rect(0, 0, pageWidth, 4, 'F');

      // 2. LOGO & BRAND HEADER
      let logoHeight = 12; // default fallback height
      const logoWidth = 45;
      let logoDrawn = false;
      if (logoBase64) {
        try {
          logoHeight = logoWidth / logoAspectRatio;
          doc.addImage(logoBase64, 'PNG', 15, 10, logoWidth, logoHeight);
          logoDrawn = true;
        } catch (err) {
          console.error("Failed to draw logo on PDF", err);
          logoDrawn = false;
        }
      }

      if (!logoDrawn) {
        // Fallback text logo if logo image isn't available
        doc.setFont(fontName, 'bold');
        doc.setFontSize(14);
        doc.setTextColor(22, 60, 68);
        doc.text("ACME INTERIORS", 15, 18);
        logoHeight = 10;
      }

      // 3. DOCUMENT TITLE (Top Right)
      doc.setFont(fontName, 'bold');
      doc.setFontSize(16);
      doc.setTextColor(22, 60, 68); // Brand Primary
      doc.text("ESTIMATE", pageWidth - 15, 18, { align: 'right' });

      doc.setFontSize(8.5);
      doc.setFont(fontName, 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`Number: ${est.estimateNumber}`, pageWidth - 15, 23, { align: 'right' });
      doc.text(`Date: ${formatDateToDDMMYYYY(est.estimateDate)}`, pageWidth - 15, 27, { align: 'right' });
      if (est.validUntil) {
        doc.text(`Valid Until: ${formatDateToDDMMYYYY(est.validUntil)}`, pageWidth - 15, 31, { align: 'right' });
      }

      // 4. COMPANY CONTACT DETAILS (Below Logo - exact match to user request)
      const companyY = Math.max(10 + logoHeight + 4, 24);
      doc.setFont(fontName, 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139); // Slate secondary text
      doc.text("221 Demo Street, Hyderabad - 500001, India", 15, companyY);
      doc.text("email: hello@example.com  |  web: www.example.com  |  phone: +91 90000 00000", 15, companyY + 4);

      // 5. DIVIDER LINE
      const sepY = companyY + 7;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(15, sepY, pageWidth - 15, sepY);

      // 6. CLIENT & PROJECT DETAILS (Background Box)
      const clientBoxY = sepY + 5;
      const textCol1X = 18;
      const textCol2X = pageWidth / 2 + 5;
      const lineSpacing = 4.5;
      
      const projectAddressStr = est.projectAddress || 'N/A';
      const addressLines = doc.splitTextToSize(projectAddressStr, pageWidth - textCol2X - 22);
      const clientBoxHeight = 22 + (addressLines.length > 1 ? (addressLines.length - 1) * lineSpacing : 0);

      // Draw background
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(15, clientBoxY, pageWidth - 30, clientBoxHeight, 1.5, 1.5, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.roundedRect(15, clientBoxY, pageWidth - 30, clientBoxHeight, 1.5, 1.5, 'S');

      // Title header
      doc.setFont(fontName, 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(22, 60, 68);
      doc.text("CLIENT & PROJECT DETAILS", 18, clientBoxY + 5);

      // Client labels/values
      doc.setFontSize(8);
      
      // Row 1
      doc.setFont(fontName, 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text("Client Name:", textCol1X, clientBoxY + 10.5);
      doc.setFont(fontName, 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(String(est.clientName), textCol1X + 20, clientBoxY + 10.5);

      doc.setFont(fontName, 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text("Project Site:", textCol2X, clientBoxY + 10.5);
      doc.setFont(fontName, 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(String(est.siteName), textCol2X + 20, clientBoxY + 10.5);

      // Row 2
      doc.setFont(fontName, 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text("Phone:", textCol1X, clientBoxY + 10.5 + lineSpacing);
      doc.setFont(fontName, 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(String(est.clientPhone || 'N/A'), textCol1X + 20, clientBoxY + 10.5 + lineSpacing);

      doc.setFont(fontName, 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text("Project Type:", textCol2X, clientBoxY + 10.5 + lineSpacing);
      doc.setFont(fontName, 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(String(est.projectType), textCol2X + 20, clientBoxY + 10.5 + lineSpacing);

      // Row 3
      doc.setFont(fontName, 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text("Email:", textCol1X, clientBoxY + 10.5 + lineSpacing * 2);
      doc.setFont(fontName, 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(String(est.clientEmail || 'N/A'), textCol1X + 20, clientBoxY + 10.5 + lineSpacing * 2);

      doc.setFont(fontName, 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text("Address:", textCol2X, clientBoxY + 10.5 + lineSpacing * 2);
      doc.setFont(fontName, 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(addressLines, textCol2X + 20, clientBoxY + 10.5 + lineSpacing * 2);

      // Helper function to print table header
      const printTableHeader = (docObj: any, width: number, headerY: number) => {
        docObj.setFont(fontName, 'bold');
        docObj.setFontSize(8);
        docObj.setFillColor(22, 60, 68); // Brand Primary
        docObj.rect(15, headerY - 5, width - 30, 8, 'F');
        docObj.setTextColor(255, 255, 255); // White text
        docObj.text("S.No", 17, headerY);
        docObj.text("Category", 26, headerY);
        docObj.text("Item & Description", 62, headerY);
        docObj.text("Qty", 132, headerY, { align: 'right' });
        docObj.text("Unit", 138, headerY);
        docObj.text("Rate", 168, headerY, { align: 'right' });
        docObj.text("Total", 195, headerY, { align: 'right' });
      };

      // 7. ESTIMATION ITEMS TABLE
      let tableHeaderY = clientBoxY + clientBoxHeight + 8;
      printTableHeader(doc, pageWidth, tableHeaderY);
      
      let currentBaselineY = tableHeaderY + 7;
      const itemColWidth = 65;

      items.forEach((item: any) => {
        // Calculate multiline details for wrapping
        const itemNameLines = doc.splitTextToSize(item.itemName, itemColWidth);
        const itemDescLines = item.description ? doc.splitTextToSize(`Specs: ${item.description}`, itemColWidth) : [];
        
        const dimParts = [];
        if (item.length !== undefined && item.length !== null && item.length > 0) dimParts.push(`${item.length}`);
        if (item.width !== undefined && item.width !== null && item.width > 0) dimParts.push(`${item.width}`);
        if (item.height !== undefined && item.height !== null && item.height > 0) dimParts.push(`${item.height}`);
        const dimText = dimParts.length > 0 ? `Dim: ${dimParts.join(' × ')} ${item.unit}` : '';
        const itemDimLines = dimText ? doc.splitTextToSize(dimText, itemColWidth) : [];
        const itemNotesLines = item.notes ? doc.splitTextToSize(`Notes: ${item.notes}`, itemColWidth) : [];
        
        const totalDetailLines = itemNameLines.length + itemDescLines.length + itemDimLines.length + itemNotesLines.length;
        const detailHeight = totalDetailLines * 3.6;
        const rowHeight = Math.max(8, detailHeight + 3); // min 8mm row height
        
        const rowStartY = currentBaselineY - 4;
        
        // Page overflow check
        if (rowStartY + rowHeight > pageHeight - 35) {
          doc.addPage();
          const newPageY = 25;
          printTableHeader(doc, pageWidth, newPageY);
          currentBaselineY = newPageY + 7;
        }
        
        const finalRowStartY = currentBaselineY - 4;
        
        // Reset text style to normal for standard columns
        doc.setFont(fontName, 'normal');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);

        // Draw standard columns
        doc.text(String(item.serialNo), 17, currentBaselineY);
        doc.text(item.category.substring(0, 18), 26, currentBaselineY);
        doc.text(String(item.quantity), 132, currentBaselineY, { align: 'right' });
        doc.text(item.unit, 138, currentBaselineY);
        doc.text(`${currencySymbol}${Math.round(item.costPerUnit).toLocaleString('en-IN')}`, 168, currentBaselineY, { align: 'right' });
        doc.text(`${currencySymbol}${Math.round(item.totalCost).toLocaleString('en-IN')}`, 195, currentBaselineY, { align: 'right' });

        // Draw Item details sequentially
        let detailsY = currentBaselineY;
        
        // 1. Item Name (Bold)
        doc.setFont(fontName, 'bold');
        doc.text(itemNameLines, 62, detailsY);
        detailsY += itemNameLines.length * 3.6;

        // 2. Specs (Normal, secondary color)
        if (itemDescLines.length > 0) {
          doc.setFont(fontName, 'normal');
          doc.setTextColor(71, 85, 105);
          doc.text(itemDescLines, 62, detailsY);
          detailsY += itemDescLines.length * 3.6;
        }

        // 3. Dimensions (Normal, accent color)
        if (itemDimLines.length > 0) {
          doc.setFont(fontName, 'normal');
          doc.setTextColor(45, 117, 130);
          doc.text(itemDimLines, 62, detailsY);
          detailsY += itemDimLines.length * 3.6;
        }

        // 4. Remarks/Notes (Normal, muted slate)
        if (itemNotesLines.length > 0) {
          doc.setFont(fontName, 'normal');
          doc.setTextColor(148, 163, 184);
          doc.text(itemNotesLines, 62, detailsY);
          detailsY += itemNotesLines.length * 3.6;
        }

        // Draw row divider line at the bottom of this row
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.15);
        doc.line(15, finalRowStartY + rowHeight, pageWidth - 15, finalRowStartY + rowHeight);

        // Advance baseline for the next row
        currentBaselineY = finalRowStartY + rowHeight + 4;
      });

      // 8. SUMMARY SECTION
      let y = currentBaselineY - 4; // y is the bottom of the last row
      
      // Check if there is enough space left on the page
      if (y > pageHeight - 75) {
        doc.addPage();
        y = 20;
      }

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.line(15, y, pageWidth - 15, y);
      y += 6;

      // Category Summaries (Left Side)
      doc.setFont(fontName, 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(22, 60, 68);
      doc.text("CATEGORY-WISE SUMMARY", 15, y);
      y += 5.5;
      
      doc.setFont(fontName, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      
      let categoryY = y;
      categorySummary.forEach((cat: any) => {
        doc.text(`${cat.category}:`, 15, categoryY);
        doc.text(`${currencySymbol}${Math.round(cat.amount).toLocaleString('en-IN')}`, 80, categoryY, { align: 'right' });
        categoryY += 4.5;
      });

      // Totals (Right Side)
      let totalsY = y - 5.5;
      doc.setFont(fontName, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      
      // Subtotal
      doc.text(`Subtotal:`, 140, totalsY);
      doc.setFont(fontName, 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`${currencySymbol}${Math.round(est.subtotal).toLocaleString('en-IN')}`, 195, totalsY, { align: 'right' });
      totalsY += 4.5;

      // Discount
      if (est.discountAmount > 0) {
        doc.setFont(fontName, 'normal');
        doc.setTextColor(71, 85, 105);
        const discLabel = est.discountType === 'Percentage' ? `Discount (${est.discountValue}%):` : `Discount:`;
        doc.text(discLabel, 140, totalsY);
        doc.setFont(fontName, 'bold');
        doc.setTextColor(220, 38, 38);
        doc.text(`-${currencySymbol}${Math.round(est.discountAmount).toLocaleString('en-IN')}`, 195, totalsY, { align: 'right' });
        totalsY += 4.5;
      }

      // Buffer
      if (est.bufferAmount > 0) {
        doc.setFont(fontName, 'normal');
        doc.setTextColor(71, 85, 105);
        const buffLabel = est.bufferType === 'Percentage' ? `Buffer/Wastage (${est.bufferValue}%):` : `Buffer/Wastage:`;
        doc.text(buffLabel, 140, totalsY);
        doc.setFont(fontName, 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(`+${currencySymbol}${Math.round(est.bufferAmount).toLocaleString('en-IN')}`, 195, totalsY, { align: 'right' });
        totalsY += 4.5;
      }

      // GST
      if (est.gstAmount > 0) {
        doc.setFont(fontName, 'normal');
        doc.setTextColor(71, 85, 105);
        const gstLabel = est.gstType === 'GST Percentage' ? `GST (${est.gstValue}%):` : `GST:`;
        doc.text(gstLabel, 140, totalsY);
        doc.setFont(fontName, 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(`+${currencySymbol}${Math.round(est.gstAmount).toLocaleString('en-IN')}`, 195, totalsY, { align: 'right' });
        totalsY += 4.5;
      }

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(140, totalsY - 1, 195, totalsY - 1);
      
      doc.setFont(fontName, 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(22, 60, 68);
      doc.text(`Grand Total:`, 140, totalsY + 3.5);
      doc.text(`${currencySymbol}${Math.round(est.grandTotal).toLocaleString('en-IN')}`, 195, totalsY + 3.5, { align: 'right' });

      // Align vertical pointer below summaries
      y = Math.max(categoryY, totalsY + 8) + 12;

      // 9. TERMS & CONDITIONS AND SIGNATURES
      if (y > pageHeight - 55) {
        doc.addPage();
        y = 20;
      }

      // Terms on the Left
      doc.setFontSize(8.5);
      doc.setFont(fontName, 'bold');
      doc.setTextColor(22, 60, 68);
      doc.text("Terms & Conditions:", 15, y);
      
      doc.setFont(fontName, 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      
      const termsLines = (est.termsAndConditions || "1. All rates are based on current material and labor costs. Any changes will be charged extra.\n2. Estimate is valid for 30 days from date of issue.\n3. Work will commence only after client signs this estimate and pays the mobilization advance.")
        .split('\n');
      
      let termsY = y + 4.5;
      termsLines.forEach((line: string) => {
        if (!line.trim()) return;
        const wrappedLine = doc.splitTextToSize(line, 110);
        if (termsY + (wrappedLine.length * 3.8) > pageHeight - 15) {
          doc.addPage();
          termsY = 20;
        }
        doc.text(wrappedLine, 15, termsY);
        termsY += wrappedLine.length * 3.8;
      });


      // Prepared By & Signatures on the Right
      const sigX = 140;
      doc.setFontSize(8);
      doc.setFont(fontName, 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text("Prepared By:", sigX, y);
      
      doc.setFont(fontName, 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(est.preparedByName, sigX, y + 4.5);
      
      doc.setFont(fontName, 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(est.preparedBy, sigX, y + 8.5);

      const lineY = y + 25;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(sigX, lineY, 195, lineY);
      
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text("Authorized Signature / Date", sigX, lineY + 3.5);

      // Add footer on all pages (accent bar + page number + company tag)
      const totalPages = doc.getNumberOfPages();
      for (let pg = 1; pg <= totalPages; pg++) {
        doc.setPage(pg);
        // Bottom accent bar
        doc.setFillColor(22, 60, 68);
        doc.rect(0, pageHeight - 4, pageWidth, 4, 'F');
        // Footer text
        doc.setFont(fontName, 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184);
        doc.text('Acme Interiors  |  hello@example.com  |  +91 90000 00000', 15, pageHeight - 6);
        doc.text(`Page ${pg} of ${totalPages}`, pageWidth - 15, pageHeight - 6, { align: 'right' });
      }

      // Open PDF in new tab for printing instead of downloading
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const printWindow = window.open(pdfUrl, '_blank');
      if (printWindow) {
        printWindow.addEventListener('load', () => {
          setTimeout(() => {
            printWindow.print();
          }, 500);
        });
      }
      toast({ title: "Print Ready", description: "Estimate PDF opened for printing." });
    } catch (e: any) {
      console.error("PDF generation error:", e?.message || e, e?.stack || '');
      toast({ title: "Error", variant: "destructive", description: `Failed to generate PDF: ${e?.message || 'Unknown error'}` });
    }
  };

  // Excel Export Trigger (using ExcelJS for professional styling)
  const exportExcel = async (est: any) => {
    try {
      // Dynamic import for browser compatibility
      const ExcelJS = (await import('exceljs')).default;

      const items = await ctxTriggerGetEstimateItems(est._id);

      const catMap: Record<string, number> = {};
      items.forEach((item: any) => {
        catMap[item.category] = (catMap[item.category] || 0) + item.totalCost;
      });
      const categorySummary = Object.entries(catMap).map(([category, amount]) => ({
        category,
        amount,
      }));

      const wb = new ExcelJS.Workbook();
      wb.creator = 'Acme Interiors';
      wb.created = new Date();

      // ── Brand colour palette ──
      const brandPrimary = '163C44';   // teal
      const brandLight  = 'E8F4F6';    // light teal bg
      const headerText  = 'FFFFFF';
      const darkText    = '0F172A';
      const mutedText   = '475569';
      const borderColor = 'CBD5E1';
      const altRowBg    = 'F8FAFC';
      const accentRed   = 'DC2626';
      const accentGreen = '059669';

      // ── Shared style helpers ──
      const thinBorder: any = {
        top:    { style: 'thin', color: { argb: borderColor } },
        left:   { style: 'thin', color: { argb: borderColor } },
        bottom: { style: 'thin', color: { argb: borderColor } },
        right:  { style: 'thin', color: { argb: borderColor } },
      };

      const currencyFmt = '#,##,##0';
      const currencyFmtRupee = '₹ #,##,##0';

      // ─────────────────────────────────────────────────
      // SHEET 1 — ESTIMATE SUMMARY
      // ─────────────────────────────────────────────────
      const ws1 = wb.addWorksheet('Estimate Summary', {
        properties: { defaultColWidth: 22 },
      });
      ws1.columns = [
        { width: 28 },
        { width: 42 },
      ];

      // Row 1: Company name (merged header bar)
      ws1.mergeCells('A1:B1');
      const titleCell = ws1.getCell('A1');
      titleCell.value = 'ACME INTERIORS';
      titleCell.font = { name: 'Calibri', bold: true, size: 14, color: { argb: headerText } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandPrimary } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws1.getRow(1).height = 36;

      // Row 2: Company address (merged)
      ws1.mergeCells('A2:B2');
      const addrCell = ws1.getCell('A2');
      addrCell.value = '221 Demo Street, Hyderabad - 500001, India  |  hello@example.com  |  +91 90000 00000';
      addrCell.font = { name: 'Calibri', size: 9, color: { argb: mutedText } };
      addrCell.alignment = { horizontal: 'center', vertical: 'middle' };
      addrCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandLight } };
      ws1.getRow(2).height = 22;

      // Row 3: Empty spacer
      ws1.getRow(3).height = 8;

      // Row 4: ESTIMATE DETAILS header
      ws1.mergeCells('A4:B4');
      const sectionHeader = ws1.getCell('A4');
      sectionHeader.value = `ESTIMATE — ${est.estimateNumber}`;
      sectionHeader.font = { name: 'Calibri', bold: true, size: 12, color: { argb: brandPrimary } };
      sectionHeader.alignment = { horizontal: 'left', vertical: 'middle' };
      sectionHeader.border = { bottom: { style: 'medium', color: { argb: brandPrimary } } };
      ws1.getRow(4).height = 28;

      // Row 5: Column headers
      const labelHeader = ws1.getCell('A5');
      labelHeader.value = 'Detail';
      labelHeader.font = { name: 'Calibri', bold: true, size: 10, color: { argb: headerText } };
      labelHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandPrimary } };
      labelHeader.border = thinBorder;
      labelHeader.alignment = { horizontal: 'left', vertical: 'middle' };

      const valHeader = ws1.getCell('B5');
      valHeader.value = 'Value';
      valHeader.font = { name: 'Calibri', bold: true, size: 10, color: { argb: headerText } };
      valHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandPrimary } };
      valHeader.border = thinBorder;
      valHeader.alignment = { horizontal: 'left', vertical: 'middle' };
      ws1.getRow(5).height = 24;

      // Summary rows data
      const summaryRows: { label: string; value: string | number; isCurrency?: boolean; isBold?: boolean; isAccent?: 'red' | 'green' }[] = [
        { label: 'Estimate Number', value: est.estimateNumber },
        { label: 'Site Name', value: est.siteName },
        { label: 'Client Name', value: est.clientName },
        { label: 'Client Phone', value: est.clientPhone || 'N/A' },
        { label: 'Client Email', value: est.clientEmail || 'N/A' },
        { label: 'Project Type', value: est.projectType },
        { label: 'Estimate Date', value: formatDateToDDMMYYYY(est.estimateDate) },
        { label: 'Valid Until', value: est.validUntil ? formatDateToDDMMYYYY(est.validUntil) : 'N/A' },
        { label: 'Subtotal', value: Math.round(est.subtotal), isCurrency: true },
        { label: 'Discount Amount', value: Math.round(est.discountAmount), isCurrency: true, isAccent: est.discountAmount > 0 ? 'red' : undefined },
        { label: 'Buffer / Wastage', value: Math.round(est.bufferAmount), isCurrency: true },
        { label: 'GST Amount', value: Math.round(est.gstAmount), isCurrency: true },
        { label: 'Grand Total', value: Math.round(est.grandTotal), isCurrency: true, isBold: true },
        { label: 'Status', value: est.status.toUpperCase(), isBold: true },
        { label: 'Prepared By', value: est.preparedByName },
      ];

      summaryRows.forEach((row, idx) => {
        const rowNum = 6 + idx;
        const r = ws1.getRow(rowNum);
        r.height = 22;

        const cellA = ws1.getCell(`A${rowNum}`);
        cellA.value = row.label;
        cellA.font = { name: 'Calibri', bold: true, size: 10, color: { argb: mutedText } };
        cellA.border = thinBorder;
        cellA.alignment = { vertical: 'middle' };
        if (idx % 2 === 0) cellA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: altRowBg } };

        const cellB = ws1.getCell(`B${rowNum}`);
        cellB.value = row.value;
        cellB.border = thinBorder;
        cellB.alignment = { vertical: 'middle', horizontal: row.isCurrency ? 'right' : 'left' };
        if (idx % 2 === 0) cellB.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: altRowBg } };

        if (row.isCurrency && typeof row.value === 'number') {
          cellB.numFmt = currencyFmtRupee;
        }

        let fontColor = darkText;
        if (row.isAccent === 'red') fontColor = accentRed;
        if (row.isAccent === 'green') fontColor = accentGreen;
        cellB.font = { name: 'Calibri', bold: !!row.isBold, size: row.isBold ? 11 : 10, color: { argb: fontColor } };
      });

      // Grand Total highlight row
      const gtRow = 6 + summaryRows.findIndex(r => r.label === 'Grand Total');
      ws1.getCell(`A${gtRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandLight } };
      ws1.getCell(`B${gtRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandLight } };
      ws1.getCell(`A${gtRow}`).font = { name: 'Calibri', bold: true, size: 11, color: { argb: brandPrimary } };
      ws1.getCell(`B${gtRow}`).font = { name: 'Calibri', bold: true, size: 12, color: { argb: brandPrimary } };

      // ─────────────────────────────────────────────────
      // SHEET 2 — ESTIMATE ITEMS (BOQ)
      // ─────────────────────────────────────────────────
      const ws2 = wb.addWorksheet('Estimate Items', {
        views: [{ state: 'frozen', ySplit: 3 }],
      });

      // Set column widths only (no auto-headers)
      const colCount = 13;
      const colWidths = [7, 22, 18, 32, 30, 8, 8, 8, 9, 10, 14, 16, 24];
      const colHeaders = ['S.No', 'Category', 'Sub-Category', 'Item Name', 'Description', 'L', 'W', 'H', 'Qty', 'Unit', 'Rate (₹)', 'Total (₹)', 'Notes'];
      for (let i = 0; i < colCount; i++) {
        ws2.getColumn(i + 1).width = colWidths[i];
      }

      // Row 1: Title bar (merged)
      ws2.mergeCells(1, 1, 1, colCount);
      const itemsTitleCell = ws2.getCell('A1');
      itemsTitleCell.value = `BOQ — ${est.estimateNumber}  |  ${est.clientName}  |  ${est.siteName}`;
      itemsTitleCell.font = { name: 'Calibri', bold: true, size: 12, color: { argb: headerText } };
      itemsTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandPrimary } };
      itemsTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws2.getRow(1).height = 30;

      // Row 2: Subtitle info (merged)
      ws2.mergeCells(2, 1, 2, colCount);
      const subtitleCell = ws2.getCell('A2');
      subtitleCell.value = `Date: ${formatDateToDDMMYYYY(est.estimateDate)}  |  Project: ${est.projectType}  |  Grand Total: ₹ ${Math.round(est.grandTotal).toLocaleString('en-IN')}`;
      subtitleCell.font = { name: 'Calibri', size: 9, color: { argb: mutedText } };
      subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandLight } };
      subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws2.getRow(2).height = 22;

      // Row 3: Column headers (manually set)
      const hdrRow = ws2.getRow(3);
      hdrRow.height = 24;
      colHeaders.forEach((hdr, i) => {
        const cell = hdrRow.getCell(i + 1);
        cell.value = hdr;
        cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: headerText } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandPrimary } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = thinBorder;
      });

      // Data rows (starting at row 4)
      items.forEach((item: any, idx: number) => {
        const rowNum = 4 + idx;
        const r = ws2.getRow(rowNum);
        r.height = 20;

        const vals = [
          item.serialNo,
          item.category,
          item.subcategory || '',
          item.itemName,
          item.description || '',
          item.length || '',
          item.width || '',
          item.height || '',
          item.quantity,
          item.unit,
          Math.round(item.costPerUnit),
          Math.round(item.totalCost),
          item.notes || '',
        ];

        vals.forEach((val, i) => {
          const cell = r.getCell(i + 1);
          cell.value = val;
          cell.font = { name: 'Calibri', size: 10, color: { argb: darkText } };
          cell.border = thinBorder;
          cell.alignment = { vertical: 'middle', wrapText: (i + 1) === 4 || (i + 1) === 5 || (i + 1) === 13 };

          // Alternating row shading
          if (idx % 2 === 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: altRowBg } };
          }

          // Right-align numeric columns
          if ([1, 6, 7, 8, 9, 11, 12].includes(i + 1)) {
            cell.alignment = { ...cell.alignment, horizontal: 'right' };
          }

          // Currency format for rate & total columns
          if ((i + 1) === 11 || (i + 1) === 12) {
            cell.numFmt = currencyFmt;
          }
        });
      });

      // Grand Total row at the bottom
      const totalRowNum = 4 + items.length;
      ws2.getRow(totalRowNum).height = 26;
      ws2.mergeCells(totalRowNum, 1, totalRowNum, 10);
      const totalLabelCell = ws2.getCell(`A${totalRowNum}`);
      totalLabelCell.value = 'GRAND TOTAL';
      totalLabelCell.font = { name: 'Calibri', bold: true, size: 11, color: { argb: brandPrimary } };
      totalLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };
      totalLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandLight } };
      totalLabelCell.border = { top: { style: 'medium', color: { argb: brandPrimary } }, bottom: { style: 'medium', color: { argb: brandPrimary } } };

      const rateBlank = ws2.getCell(totalRowNum, 11);
      rateBlank.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandLight } };
      rateBlank.border = { top: { style: 'medium', color: { argb: brandPrimary } }, bottom: { style: 'medium', color: { argb: brandPrimary } } };

      const grandTotalCell = ws2.getCell(totalRowNum, 12);
      grandTotalCell.value = Math.round(est.grandTotal);
      grandTotalCell.numFmt = currencyFmtRupee;
      grandTotalCell.font = { name: 'Calibri', bold: true, size: 12, color: { argb: brandPrimary } };
      grandTotalCell.alignment = { horizontal: 'right', vertical: 'middle' };
      grandTotalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandLight } };
      grandTotalCell.border = { top: { style: 'medium', color: { argb: brandPrimary } }, bottom: { style: 'medium', color: { argb: brandPrimary } } };

      const notesBlank = ws2.getCell(totalRowNum, 13);
      notesBlank.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandLight } };
      notesBlank.border = { top: { style: 'medium', color: { argb: brandPrimary } }, bottom: { style: 'medium', color: { argb: brandPrimary } } };

      // ─────────────────────────────────────────────────
      // SHEET 3 — CATEGORY SUMMARY
      // ─────────────────────────────────────────────────
      const ws3 = wb.addWorksheet('Category Summary', {
        views: [{ state: 'frozen', ySplit: 3 }],
      });
      ws3.getColumn(1).width = 32;
      ws3.getColumn(2).width = 22;
      ws3.getColumn(3).width = 14;

      // Row 1: Title bar (merged)
      ws3.mergeCells('A1:C1');
      const catTitle = ws3.getCell('A1');
      catTitle.value = `CATEGORY-WISE SUMMARY — ${est.estimateNumber}`;
      catTitle.font = { name: 'Calibri', bold: true, size: 12, color: { argb: headerText } };
      catTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandPrimary } };
      catTitle.alignment = { horizontal: 'center', vertical: 'middle' };
      ws3.getRow(1).height = 30;

      // Row 2: Subtitle (merged)
      ws3.mergeCells('A2:C2');
      const catSubtitle = ws3.getCell('A2');
      catSubtitle.value = `Grand Total: ₹ ${Math.round(est.grandTotal).toLocaleString('en-IN')}`;
      catSubtitle.font = { name: 'Calibri', size: 10, bold: true, color: { argb: brandPrimary } };
      catSubtitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandLight } };
      catSubtitle.alignment = { horizontal: 'center', vertical: 'middle' };
      ws3.getRow(2).height = 24;

      // Row 3: Column headers (manually set)
      const catHdrRow = ws3.getRow(3);
      catHdrRow.height = 24;
      const catColHeaders = ['Category', 'Amount (₹)', '% of Total'];
      catColHeaders.forEach((hdr, i) => {
        const cell = catHdrRow.getCell(i + 1);
        cell.value = hdr;
        cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: headerText } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandPrimary } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = thinBorder;
      });

      // Data rows (starting at row 4)
      const grandTotalVal = est.grandTotal || 1;
      categorySummary.forEach((cat: any, idx: number) => {
        const pct = ((cat.amount / grandTotalVal) * 100);
        const rowNum = 4 + idx;
        const r = ws3.getRow(rowNum);
        r.height = 22;

        const catVals = [cat.category, Math.round(cat.amount), Math.round(pct * 10) / 10];
        catVals.forEach((val, i) => {
          const cell = r.getCell(i + 1);
          cell.value = val;
          cell.font = { name: 'Calibri', size: 10, color: { argb: darkText } };
          cell.border = thinBorder;
          cell.alignment = { vertical: 'middle', horizontal: (i + 1) >= 2 ? 'right' : 'left' };

          if (idx % 2 === 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: altRowBg } };
          }

          if ((i + 1) === 2) cell.numFmt = currencyFmtRupee;
          if ((i + 1) === 3) cell.numFmt = '0.0"%"';
        });
      });

      // Category total row
      const catTotalRowNum = 4 + categorySummary.length;
      ws3.getRow(catTotalRowNum).height = 26;

      const catTotalLabel = ws3.getCell(`A${catTotalRowNum}`);
      catTotalLabel.value = 'TOTAL';
      catTotalLabel.font = { name: 'Calibri', bold: true, size: 11, color: { argb: brandPrimary } };
      catTotalLabel.alignment = { horizontal: 'left', vertical: 'middle' };
      catTotalLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandLight } };
      catTotalLabel.border = { top: { style: 'medium', color: { argb: brandPrimary } }, bottom: { style: 'medium', color: { argb: brandPrimary } } };

      const catTotalAmount = ws3.getCell(`B${catTotalRowNum}`);
      catTotalAmount.value = Math.round(est.grandTotal);
      catTotalAmount.numFmt = currencyFmtRupee;
      catTotalAmount.font = { name: 'Calibri', bold: true, size: 12, color: { argb: brandPrimary } };
      catTotalAmount.alignment = { horizontal: 'right', vertical: 'middle' };
      catTotalAmount.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandLight } };
      catTotalAmount.border = { top: { style: 'medium', color: { argb: brandPrimary } }, bottom: { style: 'medium', color: { argb: brandPrimary } } };

      const catTotalPct = ws3.getCell(`C${catTotalRowNum}`);
      catTotalPct.value = 100;
      catTotalPct.numFmt = '0.0"%"';
      catTotalPct.font = { name: 'Calibri', bold: true, size: 11, color: { argb: brandPrimary } };
      catTotalPct.alignment = { horizontal: 'right', vertical: 'middle' };
      catTotalPct.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandLight } };
      catTotalPct.border = { top: { style: 'medium', color: { argb: brandPrimary } }, bottom: { style: 'medium', color: { argb: brandPrimary } } };

      // ── Write and download ──
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Estimate_${est.estimateNumber}_${est.clientName.replace(/\s+/g, '_')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'Excel Exported', description: 'Professional estimate spreadsheet downloaded.' });
    } catch (e: any) {
      console.error('Excel export error:', e?.message || e, e?.stack || '');
      toast({ title: 'Error', variant: 'destructive', description: `Failed to generate Excel: ${e?.message || 'Unknown error'}` });
    }
  };

  // Status Badge Helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="outline" className="bg-slate-100 text-slate-700 border-none font-bold">Draft</Badge>;
      case "sent":
        return <Badge variant="outline" className="bg-blue-100 text-blue-700 border-none font-bold">Sent to Client</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-none font-bold">Approved</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-rose-100 text-rose-700 border-none font-bold">Rejected</Badge>;
      case "converted":
        return <Badge variant="outline" className="bg-indigo-100 text-indigo-700 border-none font-bold">Converted to Budget</Badge>;
      case "completed":
        return <Badge variant="outline" className="bg-purple-100 text-purple-700 border-none font-bold">Completed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Rate Library submit
  const handleRateItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    
    const payload = {
      requestorEmail: userEmail,
      itemName: formData.get("itemName") as string,
      category: formData.get("category") as string,
      unit: formData.get("unit") as string,
      defaultRate: Number(formData.get("defaultRate")) || 0,
      notes: (formData.get("notes") as string) || undefined
    };

    try {
      if (rateItemModal.item) {
        await updateRateItemMutation({
          id: rateItemModal.item._id,
          isActive: true,
          ...payload
        });
        toast({ title: "Updated", description: "Item details updated in library." });
      } else {
        await createRateItemMutation(payload);
        toast({ title: "Added", description: "New rate item registered in library." });
      }
      setRateItemModal({ open: false, item: null });
    } catch (err: any) {
      toast({ title: "Error", variant: "destructive", description: err.message });
    }
  };

  // Template submit
  const handleTemplateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (boqItems.length === 0) {
      toast({ title: "Validation Error", variant: "destructive", description: "Please add some items to BOQ table first." });
      return;
    }

    try {
      await createTemplateMutation({
        requestorEmail: userEmail,
        templateName: templateModal.name,
        projectType: templateModal.projectType,
        description: templateModal.description || undefined,
        items: boqItems.map(item => ({
          category: item.category,
          itemName: item.itemName,
          description: item.description || undefined,
          quantity: item.quantity,
          unit: item.unit,
          costPerUnit: item.costPerUnit,
          notes: item.notes || undefined,
          length: item.length !== undefined ? Number(item.length) : undefined,
          width: item.width !== undefined ? Number(item.width) : undefined,
          height: item.height !== undefined ? Number(item.height) : undefined,
        }))
      });

      toast({ title: "Template Created", description: `Saved current estimate configuration as ${templateModal.name}.` });
      setTemplateModal({ open: false, name: "", projectType: "Full Home Interior", description: "" });
    } catch (err: any) {
      toast({ title: "Error Saving", variant: "destructive", description: err.message });
    }
  };

  // Status transitions
  const updateStatus = async (id: string, action: "sent" | "approve" | "reject") => {
    try {
      if (action === "sent") {
        await markSentMutation({ id: id as any, requestorEmail: userEmail });
      } else if (action === "approve") {
        await markApprovedMutation({ id: id as any, requestorEmail: userEmail });
      } else if (action === "reject") {
        await markRejectedMutation({ id: id as any, requestorEmail: userEmail });
      }
      toast({ title: "Status Updated" });
    } catch (e: any) {
      toast({ title: "Action Failed", variant: "destructive", description: e.message });
    }
  };

  return (
    <div className="space-y-8 w-full max-w-full min-w-0 overflow-hidden mx-auto">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 w-full min-w-0">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white uppercase italic tracking-tighter">Site Estimation</h1>
          <p className="text-muted-foreground mt-1 font-medium italic text-xs sm:text-sm md:text-base">Create project estimates, manage estimate items, and convert approved estimates into site budgets.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-100 dark:bg-slate-900/50 p-1.5 h-14 rounded-2xl mb-8 border border-slate-200 dark:border-white/5 flex w-full overflow-x-auto justify-start no-scrollbar">
          <TabsTrigger value="create" className="rounded-xl font-bold h-11 px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-indigo-600 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-white data-[state=active]:shadow-md transition-all whitespace-nowrap">
            {editingEstimateId ? "Edit Estimate" : "Create Estimate"}
          </TabsTrigger>
          <TabsTrigger value="list" className="rounded-xl font-bold h-11 px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-indigo-600 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-white data-[state=active]:shadow-md transition-all whitespace-nowrap">
            Estimate List
          </TabsTrigger>
          <TabsTrigger value="templates" className="rounded-xl font-bold h-11 px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-indigo-600 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-white data-[state=active]:shadow-md transition-all whitespace-nowrap">
            Templates
          </TabsTrigger>
          <TabsTrigger value="library" className="rounded-xl font-bold h-11 px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-indigo-600 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-white data-[state=active]:shadow-md transition-all whitespace-nowrap">
            Rate Library
          </TabsTrigger>
          <TabsTrigger value="eva" className="rounded-xl font-bold h-11 px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-indigo-600 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-white data-[state=active]:shadow-md transition-all whitespace-nowrap">
            Estimate vs Actual
          </TabsTrigger>
          <TabsTrigger value="reports" className="rounded-xl font-bold h-11 px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-indigo-600 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-white data-[state=active]:shadow-md transition-all whitespace-nowrap">
            Reports
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: CREATE ESTIMATE */}
        <TabsContent value="create" className="space-y-6">
          <Card className="border-none shadow-md overflow-hidden bg-white dark:bg-slate-900 border-l-4 border-indigo-500">
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="text-xl font-black uppercase tracking-tight">
                    {editingEstimateId ? "Modify Existing Estimate Details" : "New Estimate Layout Builder"}
                  </CardTitle>
                  <CardDescription className="font-medium italic">Compose dynamic project rates and calculate buffers instantly</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {templates && templates.length > 0 && (
                    <Select onValueChange={(val) => {
                      const temp = templates.find(t => t._id === val);
                      if (temp) handleApplyTemplate(temp.items);
                    }}>
                      <SelectTrigger className="w-48 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold text-xs">
                        <SelectValue placeholder="Apply standard template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map(t => (
                          <SelectItem key={t._id} value={t._id} className="font-bold">{t.templateName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {boqItems.length > 0 && (
                    <Button variant="outline" className="rounded-xl border-slate-200 font-bold" onClick={() => setTemplateModal(p => ({ ...p, open: true }))}>
                      Save as Template
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Header Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Project Site *</Label>
                  <Select
                    value={estimateHeader.siteId}
                    onValueChange={(val) => setEstimateHeader(prev => ({ ...prev, siteId: val }))}
                  >
                    <SelectTrigger className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold">
                      <SelectValue placeholder="Select Project" />
                    </SelectTrigger>
                    <SelectContent>
                      {sites?.map(s => (
                        <SelectItem key={s._id} value={s._id} className="font-bold">{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Client Name *</Label>
                  <Input
                    placeholder="Enter client name"
                    className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold"
                    value={estimateHeader.clientName}
                    onChange={(e) => setEstimateHeader(prev => ({ ...prev, clientName: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Client Phone (Optional)</Label>
                  <Input
                    placeholder="Enter phone number"
                    className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold"
                    value={estimateHeader.clientPhone}
                    onChange={(e) => setEstimateHeader(prev => ({ ...prev, clientPhone: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Client Email (Optional)</Label>
                  <Input
                    type="email"
                    placeholder="Enter email address"
                    className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold"
                    value={estimateHeader.clientEmail}
                    onChange={(e) => setEstimateHeader(prev => ({ ...prev, clientEmail: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Project Type</Label>
                  <Select
                    value={estimateHeader.projectType}
                    onValueChange={(val) => setEstimateHeader(prev => ({ ...prev, projectType: val }))}
                  >
                    <SelectTrigger className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_TYPES.map(type => (
                        <SelectItem key={type} value={type} className="font-bold">{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Project Address</Label>
                  <Input
                    placeholder="Enter project site address"
                    className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold"
                    value={estimateHeader.projectAddress}
                    onChange={(e) => setEstimateHeader(prev => ({ ...prev, projectAddress: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estimate Date</Label>
                  <Input
                    type="date"
                    className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold"
                    value={estimateHeader.estimateDate}
                    onChange={(e) => setEstimateHeader(prev => ({ ...prev, estimateDate: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Valid Until (Optional)</Label>
                  <Input
                    type="date"
                    className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold"
                    value={estimateHeader.validUntil}
                    onChange={(e) => setEstimateHeader(prev => ({ ...prev, validUntil: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Notes / Remarks</Label>
                <Textarea
                  placeholder="Terms, payment cycles, or internal descriptions..."
                  className="rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold"
                  value={estimateHeader.notes}
                  onChange={(e) => setEstimateHeader(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              {/* Estimate Item Table */}
              <div className="pt-4 border-t space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Estimate Items Table</h3>
                  <Button onClick={handleAddRow} className="bg-indigo-600 hover:bg-indigo-700 shadow-md font-bold uppercase tracking-widest text-[9px] h-9 px-4 rounded-xl">
                    <Plus className="h-4 w-4 mr-1.5" /> Add Item Row
                  </Button>
                </div>

                {boqItems.length === 0 ? (
                  <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center">
                    <Calculator className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-bold">Select a site and start adding estimate items.</p>
                  </div>
                ) : (
                  <>
                    {/* Desktop View Table */}
                    <div className="hidden md:block rounded-xl border border-slate-100 dark:border-white/5 overflow-hidden">
                      <div className="overflow-x-auto w-full min-w-0">
                        <table className="w-full border-collapse text-left min-w-[1400px]">
                          <thead>
                            <tr className="bg-slate-50/50 dark:bg-slate-900/50 border-b text-[9px] font-black uppercase tracking-widest text-slate-400">
                              <th className="px-3 py-3 w-12 text-center">S.No</th>
                              <th className="px-3 py-3 w-40">Category</th>
                              <th className="px-3 py-3 w-48">Item Name</th>
                              <th className="px-3 py-3 w-48">Description</th>
                              <th className="px-3 py-3 w-20 text-right">Length</th>
                              <th className="px-3 py-3 w-20 text-right">Width</th>
                              <th className="px-3 py-3 w-20 text-right">Height</th>
                              <th className="px-3 py-3 w-20 text-right">Qty</th>
                              <th className="px-3 py-3 w-24">Unit</th>
                              <th className="px-3 py-3 w-28 text-right">Rate (₹)</th>
                              <th className="px-3 py-3 w-32 text-right">Total (₹)</th>
                              <th className="px-3 py-3 w-48">Remarks/Notes</th>
                              <th className="px-3 py-3 w-24 text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {boqItems.map((item, idx) => (
                              <tr key={item.id} className="hover:bg-slate-50/20 dark:hover:bg-slate-800/10">
                                <td className="px-3 py-2 font-bold text-center text-xs text-slate-400">{idx + 1}</td>
                                <td className="px-3 py-2">
                                  <Select
                                    value={item.category}
                                    onValueChange={(val) => handleUpdateRow(idx, "category", val)}
                                  >
                                    <SelectTrigger className="h-9 border-none bg-slate-50 dark:bg-slate-800 text-xs font-bold px-2">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {CATEGORIES.map(c => (
                                        <SelectItem key={c} value={c} className="font-bold text-xs">{c}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </td>
                                <td className="px-3 py-2">
                                  <Input
                                    placeholder="e.g. Plywood"
                                    className="h-9 border-none bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                                    value={item.itemName}
                                    onChange={(e) => handleUpdateRow(idx, "itemName", e.target.value)}
                                    list={`rates-suggestions-${idx}`}
                                  />
                                  <datalist id={`rates-suggestions-${idx}`}>
                                    {rateLibrary?.map((r, i) => (
                                      <option key={i} value={r.itemName} />
                                    ))}
                                  </datalist>
                                </td>
                                <td className="px-3 py-2">
                                  <Input
                                    placeholder="Specs..."
                                    className="h-9 border-none bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                                    value={item.description}
                                    onChange={(e) => handleUpdateRow(idx, "description", e.target.value)}
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <Input
                                    type="number"
                                    placeholder="L"
                                    min="0"
                                    step="any"
                                    className="h-9 border-none bg-slate-50 dark:bg-slate-800 text-xs text-right font-bold"
                                    value={item.length ?? ""}
                                    onChange={(e) => handleUpdateRow(idx, "length", e.target.value === "" ? undefined : Number(e.target.value))}
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <Input
                                    type="number"
                                    placeholder="W"
                                    min="0"
                                    step="any"
                                    className="h-9 border-none bg-slate-50 dark:bg-slate-800 text-xs text-right font-bold"
                                    value={item.width ?? ""}
                                    onChange={(e) => handleUpdateRow(idx, "width", e.target.value === "" ? undefined : Number(e.target.value))}
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <Input
                                    type="number"
                                    placeholder="H"
                                    min="0"
                                    step="any"
                                    className="h-9 border-none bg-slate-50 dark:bg-slate-800 text-xs text-right font-bold"
                                    value={item.height ?? ""}
                                    onChange={(e) => handleUpdateRow(idx, "height", e.target.value === "" ? undefined : Number(e.target.value))}
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <Input
                                    type="number"
                                    min="0.01"
                                    step="any"
                                    className="h-9 border-none bg-slate-50 dark:bg-slate-800 text-xs text-right font-bold"
                                    value={item.quantity}
                                    onChange={(e) => handleUpdateRow(idx, "quantity", Number(e.target.value))}
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <Select
                                    value={item.unit}
                                    onValueChange={(val) => handleUpdateRow(idx, "unit", val)}
                                  >
                                    <SelectTrigger className="h-9 border-none bg-slate-50 dark:bg-slate-800 text-xs font-bold px-2">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {MEASUREMENT_UNITS.map(u => (
                                        <SelectItem key={u} value={u} className="font-bold text-xs">{u}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </td>
                                <td className="px-3 py-2">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="any"
                                    className="h-9 border-none bg-slate-50 dark:bg-slate-800 text-xs text-right font-bold"
                                    value={item.costPerUnit}
                                    onChange={(e) => handleUpdateRow(idx, "costPerUnit", Number(e.target.value))}
                                  />
                                </td>
                                <td className="px-3 py-2 text-right font-black text-xs text-slate-700 dark:text-slate-200">
                                  {formatCurrency((item.quantity || 0) * (item.costPerUnit || 0))}
                                </td>
                                <td className="px-3 py-2">
                                  <Input
                                    placeholder="Notes..."
                                    className="h-9 border-none bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                                    value={item.notes || ""}
                                    onChange={(e) => handleUpdateRow(idx, "notes", e.target.value)}
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex justify-center items-center gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => handleDuplicateRow(idx)} className="h-7 w-7 text-slate-400 hover:text-slate-900"><Copy className="h-3.5 w-3.5" /></Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteRow(idx)} className="h-7 w-7 text-rose-500 hover:text-rose-700"><Trash2 className="h-3.5 w-3.5" /></Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Mobile View Card List */}
                    <div className="md:hidden space-y-4">
                      {boqItems.map((item, idx) => (
                        <Card key={item.id} className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm space-y-4">
                          <div className="flex justify-between items-center pb-2 border-b">
                            <span className="text-[10px] font-black text-slate-400">ITEM #{idx + 1}</span>
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="icon" onClick={() => handleDuplicateRow(idx)} className="h-7 w-7 text-slate-400 hover:text-slate-900"><Copy className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteRow(idx)} className="h-7 w-7 text-rose-500 hover:text-rose-700"><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs font-bold">
                            <div className="space-y-1 col-span-2">
                              <Label className="text-[9px] font-black uppercase text-slate-400">Category</Label>
                              <Select
                                value={item.category}
                                onValueChange={(val) => handleUpdateRow(idx, "category", val)}
                              >
                                <SelectTrigger className="h-10 bg-slate-50 dark:bg-slate-800 border-none font-bold text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {CATEGORIES.map(c => (
                                    <SelectItem key={c} value={c} className="font-bold text-xs">{c}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1 col-span-2">
                              <Label className="text-[9px] font-black uppercase text-slate-400">Item Name</Label>
                              <Input
                                placeholder="e.g. 18mm Plywood"
                                className="h-10 bg-slate-50 dark:bg-slate-800 border-none font-bold text-xs"
                                value={item.itemName}
                                onChange={(e) => handleUpdateRow(idx, "itemName", e.target.value)}
                              />
                            </div>

                            <div className="space-y-1 col-span-2">
                              <Label className="text-[9px] font-black uppercase text-slate-400">Description</Label>
                              <Input
                                placeholder="Specifications..."
                                className="h-10 bg-slate-50 dark:bg-slate-800 border-none font-bold text-xs"
                                value={item.description}
                                onChange={(e) => handleUpdateRow(idx, "description", e.target.value)}
                              />
                            </div>

                            <div className="grid grid-cols-3 gap-2 col-span-2">
                              <div className="space-y-1">
                                <Label className="text-[9px] font-black uppercase text-slate-400">Length</Label>
                                <Input
                                  type="number"
                                  placeholder="L"
                                  className="h-10 bg-slate-50 dark:bg-slate-800 border-none text-right font-bold text-xs"
                                  value={item.length ?? ""}
                                  onChange={(e) => handleUpdateRow(idx, "length", e.target.value === "" ? undefined : Number(e.target.value))}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[9px] font-black uppercase text-slate-400">Width</Label>
                                <Input
                                  type="number"
                                  placeholder="W"
                                  className="h-10 bg-slate-50 dark:bg-slate-800 border-none text-right font-bold text-xs"
                                  value={item.width ?? ""}
                                  onChange={(e) => handleUpdateRow(idx, "width", e.target.value === "" ? undefined : Number(e.target.value))}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[9px] font-black uppercase text-slate-400">Height</Label>
                                <Input
                                  type="number"
                                  placeholder="H"
                                  className="h-10 bg-slate-50 dark:bg-slate-800 border-none text-right font-bold text-xs"
                                  value={item.height ?? ""}
                                  onChange={(e) => handleUpdateRow(idx, "height", e.target.value === "" ? undefined : Number(e.target.value))}
                                />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-[9px] font-black uppercase text-slate-400">Quantity</Label>
                              <Input
                                type="number"
                                className="h-10 bg-slate-50 dark:bg-slate-800 border-none text-right font-bold text-xs"
                                value={item.quantity}
                                onChange={(e) => handleUpdateRow(idx, "quantity", Number(e.target.value))}
                              />
                            </div>

                            <div className="space-y-1">
                              <Label className="text-[9px] font-black uppercase text-slate-400">Unit</Label>
                              <Select
                                value={item.unit}
                                onValueChange={(val) => handleUpdateRow(idx, "unit", val)}
                              >
                                <SelectTrigger className="h-10 bg-slate-50 dark:bg-slate-800 border-none font-bold text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {MEASUREMENT_UNITS.map(u => (
                                    <SelectItem key={u} value={u} className="font-bold text-xs">{u}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-[9px] font-black uppercase text-slate-400">Cost/Unit (₹)</Label>
                              <Input
                                type="number"
                                className="h-10 bg-slate-50 dark:bg-slate-800 border-none text-right font-bold text-xs"
                                value={item.costPerUnit}
                                onChange={(e) => handleUpdateRow(idx, "costPerUnit", Number(e.target.value))}
                              />
                            </div>

                            <div className="space-y-1">
                              <Label className="text-[9px] font-black uppercase text-slate-400">Total (₹)</Label>
                              <div className="h-10 rounded-xl bg-slate-100 dark:bg-slate-900/50 flex items-center justify-end px-3 font-black text-xs text-slate-700 dark:text-slate-200">
                                {formatCurrency((item.quantity || 0) * (item.costPerUnit || 0))}
                              </div>
                            </div>

                            <div className="space-y-1 col-span-2">
                              <Label className="text-[9px] font-black uppercase text-slate-400">Remarks / Notes</Label>
                              <Input
                                placeholder="Add remarks..."
                                className="h-10 bg-slate-50 dark:bg-slate-800 border-none font-bold text-xs"
                                value={item.notes || ""}
                                onChange={(e) => handleUpdateRow(idx, "notes", e.target.value)}
                              />
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Category-wise Subtotals */}
              {boqItems.length > 0 && (
                <div className="p-5 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-white/5 space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Category Cost Breakdowns</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Object.entries(calculations.categoryBreakdown).map(([cat, total]) => (
                      <div key={cat} className="flex justify-between items-center text-xs p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-100 dark:border-white/5">
                        <span className="font-bold text-slate-500 truncate max-w-[120px]">{cat}:</span>
                        <span className="font-black text-slate-900 dark:text-slate-200">{formatCurrency(total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Totals Calculation Summary */}
              {boqItems.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t">
                  <div className="space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Tax & Adjustment Config</h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      {/* Discount config */}
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Discount Type</Label>
                        <Select
                          value={estimateHeader.discountType}
                          onValueChange={(val) => setEstimateHeader(p => ({ ...p, discountType: val, discountValue: 0 }))}
                        >
                          <SelectTrigger className="h-10 bg-slate-50 dark:bg-slate-800 border-none font-bold text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none" className="text-xs">No Discount</SelectItem>
                            <SelectItem value="Percentage" className="text-xs">Percentage (%)</SelectItem>
                            <SelectItem value="Amount" className="text-xs">Amount (₹)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {estimateHeader.discountType !== "none" && (
                        <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Discount Value</Label>
                          <Input
                            type="number"
                            className="h-10 bg-slate-50 dark:bg-slate-800 border-none font-bold text-xs"
                            value={estimateHeader.discountValue}
                            onChange={(e) => setEstimateHeader(p => ({ ...p, discountValue: Number(e.target.value) }))}
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Buffer config */}
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Buffer/Wastage Type</Label>
                        <Select
                          value={estimateHeader.bufferType}
                          onValueChange={(val) => setEstimateHeader(p => ({ ...p, bufferType: val, bufferValue: 0 }))}
                        >
                          <SelectTrigger className="h-10 bg-slate-50 dark:bg-slate-800 border-none font-bold text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none" className="text-xs">No Buffer</SelectItem>
                            <SelectItem value="Percentage" className="text-xs">Percentage (%)</SelectItem>
                            <SelectItem value="Amount" className="text-xs">Amount (₹)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {estimateHeader.bufferType !== "none" && (
                        <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Buffer Value</Label>
                          <Input
                            type="number"
                            className="h-10 bg-slate-50 dark:bg-slate-800 border-none font-bold text-xs"
                            value={estimateHeader.bufferValue}
                            onChange={(e) => setEstimateHeader(p => ({ ...p, bufferValue: Number(e.target.value) }))}
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* GST config */}
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">GST Type</Label>
                        <Select
                          value={estimateHeader.gstType}
                          onValueChange={(val) => setEstimateHeader(p => ({ ...p, gstType: val, gstValue: 0 }))}
                        >
                          <SelectTrigger className="h-10 bg-slate-50 dark:bg-slate-800 border-none font-bold text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="No GST" className="text-xs">No GST</SelectItem>
                            <SelectItem value="GST Percentage" className="text-xs">GST Percentage (%)</SelectItem>
                            <SelectItem value="GST Amount" className="text-xs">GST Amount (₹)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {estimateHeader.gstType !== "No GST" && (
                        <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">GST Value</Label>
                          <Input
                            type="number"
                            className="h-10 bg-slate-50 dark:bg-slate-800 border-none font-bold text-xs"
                            value={estimateHeader.gstValue}
                            onChange={(e) => setEstimateHeader(p => ({ ...p, gstValue: Number(e.target.value) }))}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pricing summary */}
                  <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-white/5 space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Summary Details</h4>
                    <div className="space-y-3 font-medium text-slate-600 dark:text-slate-300 text-sm">
                      <div className="flex justify-between">
                        <span>Items Subtotal:</span>
                        <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(calculations.subtotal)}</span>
                      </div>
                      {calculations.discountAmount > 0 && (
                        <div className="flex justify-between text-rose-500">
                          <span>Discount Applied:</span>
                          <span className="font-bold">-{formatCurrency(calculations.discountAmount)}</span>
                        </div>
                      )}
                      {calculations.bufferAmount > 0 && (
                        <div className="flex justify-between text-emerald-500">
                          <span>Buffer/Wastage Addition:</span>
                          <span className="font-bold">+{formatCurrency(calculations.bufferAmount)}</span>
                        </div>
                      )}
                      {calculations.gstAmount > 0 && (
                        <div className="flex justify-between text-indigo-500">
                          <span>GST Calculation:</span>
                          <span className="font-bold">+{formatCurrency(calculations.gstAmount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-3 border-t text-base font-black text-slate-900 dark:text-white">
                        <span>Grand Total:</span>
                        <span>{formatCurrency(calculations.grandTotal)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Terms & Conditions Editor */}
              {boqItems.length > 0 && (
                <div className="pt-6 border-t space-y-3 px-6 pb-6">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Terms & Conditions</h4>
                  <Textarea
                    placeholder="Enter terms and conditions, one per line..."
                    className="min-h-[100px] rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold text-xs p-4"
                    value={estimateHeader.termsAndConditions}
                    onChange={(e) => setEstimateHeader(prev => ({ ...prev, termsAndConditions: e.target.value }))}
                  />
                  <p className="text-[10px] text-slate-400 font-medium italic">These terms will be saved and printed on the exported PDF/Excel sheets.</p>
                </div>
              )}
            </CardContent>
            
            {/* Actions Footer */}
            {boqItems.length > 0 && (
              <DialogFooter className="p-6 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-white/5 flex gap-3">
                {editingEstimateId && (
                  <Button variant="outline" className="rounded-xl h-12 px-6 font-bold" onClick={() => {
                    setEditingEstimateId(null);
                    setBoqItems([]);
                    setActiveTab("list");
                  }}>
                    Cancel Editing
                  </Button>
                )}
                <Button onClick={handleSaveEstimate} className="bg-indigo-600 hover:bg-indigo-700 shadow-xl rounded-xl h-12 px-8 font-black uppercase tracking-widest text-xs" disabled={isSaving}>
                  {isSaving ? "Saving..." : editingEstimateId ? "Update Estimate" : "Save Estimate Draft"}
                </Button>
              </DialogFooter>
            )}
          </Card>
        </TabsContent>

        {/* TAB 2: ESTIMATE LIST */}
        <TabsContent value="list" className="space-y-6">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search estimate client or code..."
                className="pl-12 h-11 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold text-xs"
                value={listFilters.search}
                onChange={(e) => setListFilters(prev => ({ ...prev, search: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-3 w-full sm:w-auto">
              <Select value={listFilters.status} onValueChange={(val) => setListFilters(prev => ({ ...prev, status: val }))}>
                <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="font-bold text-xs">All Statuses</SelectItem>
                  <SelectItem value="draft" className="font-bold text-xs">Draft</SelectItem>
                  <SelectItem value="sent" className="font-bold text-xs">Sent</SelectItem>
                  <SelectItem value="approved" className="font-bold text-xs">Approved</SelectItem>
                  <SelectItem value="rejected" className="font-bold text-xs">Rejected</SelectItem>
                  <SelectItem value="converted" className="font-bold text-xs">Converted</SelectItem>
                </SelectContent>
              </Select>

              <Select value={listFilters.siteId} onValueChange={(val) => setListFilters(prev => ({ ...prev, siteId: val }))}>
                <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold text-xs">
                  <SelectValue placeholder="Site" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="font-bold text-xs">All Sites</SelectItem>
                  {sites?.map(s => (
                    <SelectItem key={s._id} value={s._id} className="font-bold text-xs">{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={listFilters.projectType} onValueChange={(val) => setListFilters(prev => ({ ...prev, projectType: val }))}>
                <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold text-xs">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="font-bold text-xs">All Types</SelectItem>
                  {PROJECT_TYPES.map(t => (
                    <SelectItem key={t} value={t} className="font-bold text-xs">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Estimates List Cards */}
          {filteredEstimates.length === 0 ? (
            <div className="text-center py-24 bg-white rounded-3xl border border-dashed flex flex-col items-center justify-center shadow-sm">
              <Calculator className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h4 className="text-lg font-bold">No estimates created yet.</h4>
              <p className="text-slate-400 text-sm italic mt-1">Initialize a project site and create its first budget planning.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEstimates.map((est) => (
                <Card key={est._id} className="border-none shadow-md overflow-hidden bg-white dark:bg-slate-900 group hover:-translate-y-1 transition-all duration-300 relative border-l-4 border-indigo-500/20 hover:border-indigo-500">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2.5 py-1 rounded-md tracking-wider">{est.estimateNumber}</span>
                        <h3 className="text-lg font-black text-slate-900 dark:text-white mt-2 group-hover:text-indigo-600 transition-colors truncate max-w-[180px]">{est.clientName}</h3>
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-1 font-medium"><Building className="h-3.5 w-3.5" />{est.siteName}</p>
                      </div>
                      {getStatusBadge(est.status)}
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl space-y-1 text-xs border border-slate-100 dark:border-white/5">
                      <div className="flex justify-between font-bold">
                        <span className="text-slate-500">Project Type:</span>
                        <span className="text-slate-900 dark:text-slate-200">{est.projectType}</span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span className="text-slate-500">Date:</span>
                        <span className="text-slate-900 dark:text-slate-200">{formatDateToDDMMYYYY(est.estimateDate)}</span>
                      </div>
                      <div className="flex justify-between font-bold pt-1 border-t mt-1">
                        <span className="text-slate-500">Grand Total:</span>
                        <span className="font-black text-indigo-600 text-sm">{formatCurrency(est.grandTotal)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                      <span className="flex items-center gap-1"><User className="h-3.5 w-3.5 text-slate-500" />{est.preparedByName}</span>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t pt-3 mt-3">
                      <div className="flex gap-1.5">
                        <Button variant="ghost" size="icon" onClick={() => exportPDF(est)} title="Print Estimate" className="h-9 w-9 bg-slate-50 dark:bg-slate-800 text-indigo-600 rounded-lg"><Printer className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => exportExcel(est)} title="Export Excel" className="h-9 w-9 bg-slate-50 dark:bg-slate-800 text-emerald-600 rounded-lg"><Download className="h-4 w-4" /></Button>
                      </div>

                      {/* Status Operations */}
                      <div className="flex gap-2">
                        {est.status === "draft" && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => handleEditEstimate(est)} className="h-8 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] px-2.5 rounded-lg uppercase tracking-wider">Edit</Button>
                            <Button variant="ghost" size="sm" onClick={() => updateStatus(est._id, "sent")} className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] px-2.5 rounded-lg uppercase tracking-wider">Send</Button>
                          </>
                        )}
                        {est.status === "sent" && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => updateStatus(est._id, "approve")} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2.5 rounded-lg uppercase tracking-wider">Approve</Button>
                            <Button variant="ghost" size="sm" onClick={() => updateStatus(est._id, "reject")} className="h-8 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] px-2.5 rounded-lg uppercase tracking-wider">Reject</Button>
                          </>
                        )}
                        {est.status === "approved" && (
                          <Button onClick={() => setConversionModal({ open: true, estimate: est, mode: "version", versionName: `${est.estimateNumber} Active`, notes: "" })} className="h-9 bg-indigo-600 hover:bg-indigo-700 font-black text-[9px] uppercase tracking-widest px-3.5 rounded-xl shadow-md">
                            Convert to Budget
                          </Button>
                        )}
                        {est.status === "converted" && (
                          <Button variant="outline" className="h-8 border-indigo-200 text-indigo-600 font-bold text-[9px] uppercase tracking-wider px-3" onClick={() => {
                            setEvaSiteId(est.siteId);
                            setActiveTab("eva");
                          }}>
                            Compare Actual
                          </Button>
                        )}
                        {est.status === "rejected" && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => handleEditEstimate(est)} className="h-8 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] px-2.5 rounded-lg uppercase tracking-wider">Edit</Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDuplicateEstimate(est._id)} className="h-8 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] px-2.5 rounded-lg uppercase tracking-wider">Duplicate</Button>
                            <Button variant="ghost" size="sm" onClick={() => handleArchiveEstimate(est._id)} className="h-8 bg-rose-500/10 text-rose-500 font-bold text-[10px] px-2.5 rounded-lg uppercase tracking-wider">Archive</Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB 3: TEMPLATES */}
        <TabsContent value="templates" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-black uppercase tracking-tight">Standard Estimate Templates</h3>
              <p className="text-sm text-muted-foreground font-medium italic">Standardized structures to speed up estimate building.</p>
            </div>
          </div>

          {!templates ? (
            <div className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div>
          ) : templates.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed flex flex-col items-center justify-center">
              <FolderOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-400 font-bold">No templates created yet.</p>
              <p className="text-xs text-slate-400 mt-1 italic">Compose an estimate and save it as a template from the creator tab.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map((temp) => (
                <Card key={temp._id} className="border-none shadow-md overflow-hidden bg-white dark:bg-slate-900 border-l-4 border-indigo-500">
                  <CardContent className="p-6 space-y-4">
                    <div>
                      <span className="text-[10px] font-black uppercase bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded">{temp.projectType}</span>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white mt-2">{temp.templateName}</h3>
                      <p className="text-xs text-slate-400 font-medium italic mt-1 leading-relaxed">{temp.description || "Reusable template."}</p>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl space-y-2 border border-slate-100 dark:border-white/5">
                      <h4 className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Standard Estimate Lines ({temp.items?.length || 0})</h4>
                      <div className="max-h-36 overflow-y-auto space-y-1.5 pr-2">
                        {temp.items?.map((item: any, i: number) => (
                          <div key={i} className="flex justify-between items-center text-[11px] font-bold">
                            <span className="text-slate-600 dark:text-slate-400 truncate max-w-[160px]">{item.itemName}</span>
                            <span className="text-slate-400 uppercase text-[9px]">{item.quantity} {item.unit}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-3 border-t">
                      <span className="text-[10px] font-bold text-slate-400">By: {temp.createdBy}</span>
                      <Button onClick={() => {
                        handleApplyTemplate(temp.items || []);
                        setActiveTab("create");
                      }} className="bg-indigo-600 hover:bg-indigo-700 shadow-md font-bold text-[10px] uppercase tracking-wider h-8 rounded-lg px-4">
                        Use Template
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB 4: RATE LIBRARY */}
        <TabsContent value="library" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full">
            <div>
              <h3 className="text-lg font-black uppercase tracking-tight">Master Price & Rate Directory</h3>
              <p className="text-sm text-muted-foreground font-medium italic">Standard rates library per category unit for consistent quotation builder.</p>
            </div>
            <Button onClick={() => setRateItemModal({ open: true, item: null })} className="bg-indigo-600 hover:bg-indigo-700 font-black text-xs uppercase tracking-widest h-11 px-6 rounded-xl shadow-lg">
              <Plus className="mr-2 h-4 w-4" /> Add Rate Item
            </Button>
          </div>

          {/* Rate Directory Table */}
          {!rateLibrary ? (
            <div className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div>
          ) : rateLibrary.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed flex flex-col items-center justify-center">
              <Calculator className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400 font-bold">No rate items found.</p>
            </div>
          ) : (
            <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900 rounded-3xl">
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-50/50 dark:bg-slate-900/50 border-b text-[9px] font-black uppercase tracking-widest text-slate-400">
                      <th className="px-6 py-4">Item Name</th>
                      <th className="px-6 py-4">Category</th>
                      <th className="px-6 py-4 w-28">Default Unit</th>
                      <th className="px-6 py-4 w-40 text-right">Default Rate (₹)</th>
                      <th className="px-6 py-4">Notes</th>
                      <th className="px-6 py-4 w-28 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium text-slate-700 dark:text-slate-200 text-xs">
                    {rateLibrary.map((rate) => (
                      <tr key={rate._id} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/10">
                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{rate.itemName}</td>
                        <td className="px-6 py-4">
                          <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-black uppercase text-[9px] text-slate-500">{rate.category}</span>
                        </td>
                        <td className="px-6 py-4 font-bold">{rate.unit}</td>
                        <td className="px-6 py-4 text-right font-black text-slate-900 dark:text-white">{formatCurrency(rate.defaultRate)}</td>
                        <td className="px-6 py-4 italic text-slate-400">{rate.notes || "N/A"}</td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center items-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setRateItemModal({ open: true, item: rate })} className="h-8 text-[10px] font-bold uppercase text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg">Edit</Button>
                            <Button variant="ghost" size="sm" onClick={async () => {
                              if(confirm("Archive rate item?")) {
                                await archiveRateItemMutation({ id: rate._id, requestorEmail: userEmail });
                                toast({ title: "Archived" });
                              }
                            }} className="h-8 text-[10px] font-bold uppercase text-rose-500 bg-rose-500/5 hover:bg-rose-500/10 rounded-lg">Delete</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* TAB 5: ESTIMATE VS ACTUAL */}
        <TabsContent value="eva" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-black uppercase tracking-tight">Estimate vs Actual Expenditure Compare</h3>
              <p className="text-sm text-muted-foreground font-medium italic">Compare estimated cost with actual spending from Transactions.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-slate-400">Select Site:</span>
              <Select value={evaSiteId} onValueChange={setEvaSiteId}>
                <SelectTrigger className="w-56 bg-white dark:bg-slate-900 border-none rounded-xl font-bold text-xs h-10 shadow-sm">
                  <SelectValue placeholder="All Sites" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="font-bold text-xs">All Sites</SelectItem>
                  {sites?.map(s => (
                    <SelectItem key={s._id} value={s._id} className="font-bold text-xs">{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!evaData ? (
            <div className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div>
          ) : evaData.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed flex flex-col items-center justify-center">
              <Info className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400 font-bold">Convert an estimate to site budget to track actual spending.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {evaData.map((data, index) => (
                <Card key={data.siteId || index} className="border-none shadow-md overflow-hidden bg-white dark:bg-slate-900 border-l-4 border-indigo-500">
                  <CardHeader className="bg-slate-50/50 dark:bg-slate-950/20 py-4 border-b">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">{data.siteName}</h3>
                        <p className="text-xs text-slate-400 mt-1 font-bold">Active Estimate: {data.estimateNumber}</p>
                      </div>
                      <Badge className={cn(
                        "font-black text-[9px] uppercase border-none px-3 py-1",
                        data.status === "Under Budget" ? "bg-emerald-500 text-white" :
                        data.status === "On Track" ? "bg-blue-500 text-white" :
                        "bg-rose-500 text-white shadow-lg shadow-rose-500/15 animate-pulse"
                      )}>
                        {data.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    {/* Big Summary Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-white/5 space-y-1">
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Estimated Amount</span>
                        <p className="text-lg font-black text-slate-900 dark:text-white">{formatCurrency(data.estimatedAmount)}</p>
                      </div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-white/5 space-y-1">
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Actual spent</span>
                        <p className="text-lg font-black text-slate-900 dark:text-white">{formatCurrency(data.actualSpent)}</p>
                      </div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-white/5 space-y-1">
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Remaining Budget</span>
                        <p className={cn(
                          "text-lg font-black",
                          data.remainingBudget >= 0 ? "text-emerald-500" : "text-rose-500"
                        )}>{formatCurrency(data.remainingBudget)}</p>
                      </div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-white/5 space-y-1">
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Difference</span>
                        <p className={cn(
                          "text-lg font-black",
                          data.difference > 0 ? "text-rose-500" : "text-emerald-500"
                        )}>{data.difference > 0 ? `+${formatCurrency(data.difference)}` : formatCurrency(data.difference)}</p>
                      </div>
                    </div>

                    {/* Breakdown table */}
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Category Cost comparison</h4>
                      
                      <div className="rounded-xl border border-slate-100 dark:border-white/5 overflow-hidden">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50/50 dark:bg-slate-900/50 border-b text-[9px] font-black uppercase tracking-widest text-slate-400">
                              <th className="px-6 py-3">Category</th>
                              <th className="px-6 py-3 text-right">Estimated Cost (₹)</th>
                              <th className="px-6 py-3 text-right">Actual Cost (₹)</th>
                              <th className="px-6 py-3 text-right">Difference (₹)</th>
                              <th className="px-6 py-3 w-36 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-bold text-slate-700 dark:text-slate-200">
                            {data.categoryComparisons.map((c, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/20 dark:hover:bg-slate-800/10">
                                <td className="px-6 py-3 font-bold">{c.category}</td>
                                <td className="px-6 py-3 text-right font-black">{formatCurrency(c.estimated)}</td>
                                <td className="px-6 py-3 text-right font-black">{formatCurrency(c.actual)}</td>
                                <td className={cn(
                                  "px-6 py-3 text-right font-black",
                                  c.difference > 0 ? "text-rose-500" : "text-emerald-500"
                                )}>
                                  {c.difference > 0 ? `+${formatCurrency(c.difference)}` : formatCurrency(c.difference)}
                                </td>
                                <td className="px-6 py-3 text-center">
                                  <Badge className={cn(
                                    "font-bold text-[8px] uppercase border-none px-2 py-0.5",
                                    c.status === "Under Budget" ? "bg-emerald-500/10 text-emerald-500" :
                                    c.status === "On Track" ? "bg-blue-500/10 text-blue-500" :
                                    "bg-rose-500/10 text-rose-500"
                                  )}>
                                    {c.status}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB 6: REPORTS */}
        <TabsContent value="reports" className="space-y-6">
          {!reportData ? (
            <div className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div>
          ) : (
            <div className="space-y-8">
              {/* Analytics summary row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="border-none shadow-md bg-white dark:bg-slate-900 border-l-4 border-indigo-500">
                  <CardContent className="pt-6">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Volume</p>
                    <h2 className="text-3xl font-black mt-1 text-indigo-600">{formatCurrency(reportData.totalVolume)}</h2>
                    <p className="text-[10px] text-slate-500 mt-2 font-bold italic">Total sum of all estimate values</p>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-md bg-white dark:bg-slate-900 border-l-4 border-emerald-500">
                  <CardContent className="pt-6">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Approved Volume</p>
                    <h2 className="text-3xl font-black mt-1 text-emerald-600">
                      {estimates ? formatCurrency(estimates.filter(e => e.status === "approved" || e.status === "converted").reduce((sum, e) => sum + e.grandTotal, 0)) : "₹0"}
                    </h2>
                    <p className="text-[10px] text-slate-500 mt-2 font-bold italic">Estimated values signed off by client</p>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-md bg-white dark:bg-slate-900 border-l-4 border-blue-500">
                  <CardContent className="pt-6">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Conversion Rate</p>
                    <h2 className="text-3xl font-black mt-1 text-blue-600">
                      {reportData.totalCount > 0 
                        ? `${Math.round(((reportData.countsByStatus.approved + reportData.countsByStatus.converted) / reportData.totalCount) * 100)}%` 
                        : "0%"}
                    </h2>
                    <p className="text-[10px] text-slate-500 mt-2 font-bold italic">Drafts converting to signed-off site budgets</p>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-md bg-white dark:bg-slate-900 border-l-4 border-rose-500 animate-pulse">
                  <CardContent className="pt-6">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Over-Budget Sites</p>
                    <h2 className="text-3xl font-black mt-1 text-rose-500">{reportData.overBudgetSites.length}</h2>
                    <p className="text-[10px] text-slate-500 mt-2 font-bold italic">Active sites exceeding approved budgets</p>
                  </CardContent>
                </Card>
              </div>

              {/* Graphical charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="border-none shadow-sm bg-white dark:bg-slate-900/50">
                  <CardHeader>
                    <CardTitle className="text-base font-black uppercase tracking-tight">Status Distribution</CardTitle>
                  </CardHeader>
                  <CardContent className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={Object.entries(reportData.countsByStatus).map(([status, count]) => ({ status: status.toUpperCase(), count }))}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="status" tick={{ fontSize: 9, fontWeight: 900, fill: "#94a3b8" }} />
                        <YAxis tick={{ fontSize: 9, fontWeight: 900, fill: "#94a3b8" }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={25} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-white dark:bg-slate-900/50">
                  <CardHeader>
                    <CardTitle className="text-base font-black uppercase tracking-tight">Financial Health Status</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col justify-center h-72">
                    {reportData.overBudgetSites.length === 0 ? (
                      <div className="text-center text-slate-400 dark:text-slate-600 font-bold italic uppercase tracking-widest text-[10px]">
                        All projects are operating within budget limits!
                      </div>
                    ) : (
                      <ScrollArea className="h-full">
                        <div className="space-y-3 p-4">
                          {reportData.overBudgetSites.map((site, i) => (
                            <div key={i} className="flex justify-between items-center p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl">
                              <div>
                                <span className="font-black text-xs text-rose-500">{site.siteName}</span>
                                <p className="text-[10px] text-slate-400 font-bold mt-0.5">Budget: {formatCurrency(site.budget)} | Actual: {formatCurrency(site.actual)}</p>
                              </div>
                              <Badge className="bg-rose-500 text-white font-bold border-none text-[9px] uppercase px-2 py-0.5">
                                +{formatCurrency(site.excess)} Over
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* MODAL: CONVERT TO SITE BUDGET */}
      {conversionModal.open && (
        <Dialog open={conversionModal.open} onOpenChange={(val) => setConversionModal(prev => ({ ...prev, open: val }))}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter">Convert Estimate to Site Budget</DialogTitle>
              <DialogDescription className="font-bold text-slate-500 italic mt-1">This will set the selected site budget based on this approved estimate.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 text-xs font-bold text-slate-600 dark:text-slate-300">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-1.5 border">
                <div className="flex justify-between">
                  <span>Site Name:</span>
                  <span className="text-slate-900 dark:text-white font-black">{conversionModal.estimate.siteName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Estimate Number:</span>
                  <span className="text-slate-900 dark:text-white font-mono font-black">{conversionModal.estimate.estimateNumber}</span>
                </div>
                <div className="flex justify-between border-t pt-1.5 mt-1.5">
                  <span>Grand Total:</span>
                  <span className="text-indigo-600 font-black text-sm">{formatCurrency(conversionModal.estimate.grandTotal)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Version Name *</Label>
                <Input
                  placeholder="e.g. Phase 1 Active Budget"
                  value={conversionModal.versionName}
                  onChange={(e) => setConversionModal(p => ({ ...p, versionName: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Conversion Mode</Label>
                <Select
                  value={conversionModal.mode}
                  onValueChange={(val: any) => setConversionModal(p => ({ ...p, mode: val }))}
                >
                  <SelectTrigger className="font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="version" className="font-bold">Create new budget version (Recommended)</SelectItem>
                    <SelectItem value="replace" className="font-bold">Replace existing active budget</SelectItem>
                    <SelectItem value="add" className="font-bold">Add / merge to active budget</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Notes (Optional)</Label>
                <Input
                  placeholder="Additional allocation details..."
                  value={conversionModal.notes}
                  onChange={(e) => setConversionModal(p => ({ ...p, notes: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="rounded-xl font-bold text-xs" onClick={() => setConversionModal(p => ({ ...p, open: false, estimate: null }))}>Cancel</Button>
              <Button onClick={handleConvertToBudget} className="bg-indigo-600 hover:bg-indigo-700 shadow-xl font-black text-xs uppercase tracking-widest h-12 rounded-xl px-6">
                Confirm Conversion
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL: ADD / EDIT RATE ITEM */}
      {rateItemModal.open && (
        <Dialog open={rateItemModal.open} onOpenChange={(val) => setRateItemModal(prev => ({ ...prev, open: val }))}>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleRateItemSubmit} className="space-y-4">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter">
                  {rateItemModal.item ? "Edit Rate Item" : "Register Rate Item"}
                </DialogTitle>
                <DialogDescription className="font-bold text-slate-500 italic mt-1">Configure pricing presets for estimate builder autocompletion.</DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-xs font-bold">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Item Name *</Label>
                  <Input name="itemName" defaultValue={rateItemModal.item?.itemName || ""} required placeholder="e.g. Carpenter Labour" />
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Category *</Label>
                  <Select name="category" defaultValue={rateItemModal.item?.category || "Woodwork / Carpentry"}>
                    <SelectTrigger className="font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => (
                        <SelectItem key={c} value={c} className="font-bold text-xs">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Measurement Unit *</Label>
                    <Select name="unit" defaultValue={rateItemModal.item?.unit || "Sq.ft"}>
                      <SelectTrigger className="font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MEASUREMENT_UNITS.map(u => (
                          <SelectItem key={u} value={u} className="font-bold text-xs">{u}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Unit Price Rate (₹) *</Label>
                    <Input name="defaultRate" type="number" step="any" min="0" defaultValue={rateItemModal.item?.defaultRate || 0} required />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Notes (Optional)</Label>
                  <Input name="notes" defaultValue={rateItemModal.item?.notes || ""} placeholder="Vendor, specifications etc..." />
                </div>
              </div>

              <DialogFooter className="pt-4 border-t border-slate-100 dark:border-white/5">
                <Button type="button" variant="outline" className="rounded-xl font-bold" onClick={() => setRateItemModal({ open: false, item: null })}>Cancel</Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 shadow-xl rounded-xl h-11 px-6 font-black uppercase tracking-widest text-xs">
                  {rateItemModal.item ? "Update Item" : "Register Item"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL: SAVE AS TEMPLATE */}
      {templateModal.open && (
        <Dialog open={templateModal.open} onOpenChange={(val) => setTemplateModal(prev => ({ ...prev, open: val }))}>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleTemplateSubmit} className="space-y-4">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter">Save Current Estimate as Template</DialogTitle>
                <DialogDescription className="font-bold text-slate-500 italic mt-1">Convert current estimate item rows into a reusable project preset.</DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-xs font-bold">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Template Name *</Label>
                  <Input value={templateModal.name} onChange={e => setTemplateModal(p => ({ ...p, name: e.target.value }))} required placeholder="e.g. Standard 2BHK Woodwork Frame" />
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Project Type *</Label>
                  <Select value={templateModal.projectType} onValueChange={(val) => setTemplateModal(p => ({ ...p, projectType: val }))}>
                    <SelectTrigger className="font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_TYPES.map(t => (
                        <SelectItem key={t} value={t} className="font-bold text-xs">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Description (Optional)</Label>
                  <Input value={templateModal.description} onChange={e => setTemplateModal(p => ({ ...p, description: e.target.value }))} placeholder="Brief outline of standard items scope..." />
                </div>
              </div>

              <DialogFooter className="pt-4 border-t border-slate-100 dark:border-white/5">
                <Button type="button" variant="outline" className="rounded-xl font-bold" onClick={() => setTemplateModal({ open: false, name: "", projectType: "Full Home Interior", description: "" })}>Cancel</Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 shadow-xl rounded-xl h-11 px-6 font-black uppercase tracking-widest text-xs">
                  Create Template
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Loader helper
function Loader2({ className }: { className?: string }) {
  return <Calculator className={cn("animate-pulse text-indigo-500", className)} />;
}
