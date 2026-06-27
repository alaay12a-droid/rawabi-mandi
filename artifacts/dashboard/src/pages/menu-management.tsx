import { useState, useEffect, useCallback } from "react";
import { apiGet, apiPost, apiPut, apiDel } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, RefreshCw, Pencil, Trash2, Search, Loader2, PackageX, Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface MenuItem {
  itemId: string;
  name: string;
  nameAr?: string;
  description?: string;
  price: number;
  category: string;
  imageUrl?: string | null;
  available: boolean;
  stock?: number | null;
}

const CATEGORIES = [
  { id: "chicken",  name: "الدجاج",           icon: "🍗" },
  { id: "meat",     name: "اللحوم",           icon: "🥩" },
  { id: "mains",    name: "الأطباق الرئيسية", icon: "🍽️" },
  { id: "sides",    name: "الإيدامات",        icon: "🥘" },
  { id: "salads",   name: "السلطات",          icon: "🥗" },
  { id: "desserts", name: "الحلويات",         icon: "🍮" },
  { id: "drinks",   name: "المشروبات",        icon: "🥤" },
  { id: "extras",   name: "إضافات",           icon: "✨" },
];

const getCatMeta = (id: string) => CATEGORIES.find(c => c.id === id) ?? { id, name: id, icon: "🍽️" };

interface ItemForm {
  itemId?: string;
  name: string;
  nameAr: string;
  description: string;
  price: string;
  category: string;
  imageUrl: string;
  available: boolean;
  stock: string;
}

const emptyForm = (): ItemForm => ({
  name: "", nameAr: "", description: "", price: "", category: "chicken",
  imageUrl: "", available: true, stock: "",
});

export default function MenuManagement() {
  const { toast } = useToast();
  const [items, setItems]         = useState<MenuItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]       = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");

  const [dialogOpen, setDialogOpen]     = useState(false);
  const [form, setForm]                 = useState<ItemForm>(emptyForm());
  const [saving, setSaving]             = useState(false);
  const [formError, setFormError]       = useState("");

  const [deleteId, setDeleteId]         = useState<string | null>(null);
  const [deleting, setDeleting]         = useState(false);
  const [togglingId, setTogglingId]     = useState<string | null>(null);
  const [stockEditId, setStockEditId]   = useState<string | null>(null);
  const [stockVal, setStockVal]         = useState("");
  const [stockSaving, setStockSaving]   = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const data = await apiGet<MenuItem[]>("/menu");
      setItems(data);
    } catch {
      toast({ title: "تعذّر تحميل القائمة", variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(item => {
    const matchCat = catFilter === "all" || item.category === catFilter;
    const q = search.trim().toLowerCase();
    const matchSearch = !q || item.name.toLowerCase().includes(q) || (item.nameAr ?? "").includes(q);
    return matchCat && matchSearch;
  });

  const openAdd = () => {
    setForm(emptyForm());
    setFormError("");
    setDialogOpen(true);
  };

  const openEdit = (item: MenuItem) => {
    setForm({
      itemId: item.itemId,
      name: item.name,
      nameAr: item.nameAr ?? "",
      description: item.description ?? "",
      price: String(item.price / 100),
      category: item.category,
      imageUrl: item.imageUrl ?? "",
      available: item.available,
      stock: item.stock === null || item.stock === undefined ? "" : String(item.stock),
    });
    setFormError("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError("اسم الصنف مطلوب"); return; }
    if (!form.price.trim() || isNaN(parseFloat(form.price)) || parseFloat(form.price) < 0) {
      setFormError("أدخل سعراً صحيحاً"); return;
    }
    setSaving(true);
    setFormError("");
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        nameAr: form.nameAr.trim() || undefined,
        description: form.description.trim() || undefined,
        price: Math.round(parseFloat(form.price) * 100),
        category: form.category,
        imageUrl: form.imageUrl.trim() || undefined,
        available: form.available,
        stock: form.stock.trim() === "" ? null : parseInt(form.stock),
      };

      if (form.itemId) {
        const updated = await apiPut<MenuItem>(`/menu/${form.itemId}`, body);
        setItems(prev => prev.map(i => i.itemId === form.itemId ? updated : i));
        toast({ title: "تم تحديث الصنف ✓" });
      } else {
        const created = await apiPost<MenuItem>("/menu", body);
        setItems(prev => [...prev, created]);
        toast({ title: "تم إضافة الصنف ✓" });
      }
      setDialogOpen(false);
    } catch (e: unknown) {
      setFormError((e as { message?: string })?.message ?? "تعذّر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await apiDel(`/menu/${deleteId}`);
      setItems(prev => prev.filter(i => i.itemId !== deleteId));
      toast({ title: "تم حذف الصنف" });
    } catch {
      toast({ title: "تعذّر حذف الصنف", variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const toggleAvailable = async (item: MenuItem) => {
    setTogglingId(item.itemId);
    try {
      const updated = await apiPut<MenuItem>(`/menu/${item.itemId}`, { available: !item.available });
      setItems(prev => prev.map(i => i.itemId === item.itemId ? updated : i));
    } catch {
      toast({ title: "تعذّر تحديث الحالة", variant: "destructive" });
    } finally {
      setTogglingId(null);
    }
  };

  const saveStock = async (itemId: string) => {
    const raw = stockVal.trim();
    const stock = raw === "" ? null : parseInt(raw);
    if (raw !== "" && (isNaN(stock!) || stock! < 0)) return;
    setStockSaving(true);
    try {
      const updated = await apiPut<MenuItem>(`/menu/${itemId}`, { stock });
      setItems(prev => prev.map(i => i.itemId === itemId ? updated : i));
      toast({ title: "تم تحديث المخزون ✓" });
    } catch {
      toast({ title: "تعذّر تحديث المخزون", variant: "destructive" });
    } finally {
      setStockSaving(false);
      setStockEditId(null);
    }
  };

  const availableCount   = items.filter(i => i.available).length;
  const unavailableCount = items.filter(i => !i.available).length;
  const outOfStockCount  = items.filter(i => i.stock !== null && i.stock !== undefined && i.stock <= 0).length;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[0,1,2].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        {[0,1,2,3,4].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">إدارة القائمة</h1>
          <p className="text-muted-foreground text-sm mt-0.5">إضافة وتعديل الأصناف، التوفّر، والمخزون</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            إضافة صنف
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <Package className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">متاح</p>
              <p className="text-2xl font-bold">{availableCount}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-500/10">
              <PackageX className="h-5 w-5 text-zinc-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">نافد / غير متاح</p>
              <p className="text-2xl font-bold">{unavailableCount}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
              <PackageX className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">مخزون صفر</p>
              <p className="text-2xl font-bold">{outOfStockCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pr-9"
            placeholder="بحث..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant={catFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setCatFilter("all")}
          >
            الكل ({items.length})
          </Button>
          {CATEGORIES.map(cat => {
            const count = items.filter(i => i.category === cat.id).length;
            if (count === 0) return null;
            return (
              <Button
                key={cat.id}
                variant={catFilter === cat.id ? "default" : "outline"}
                size="sm"
                onClick={() => setCatFilter(cat.id)}
                className="gap-1"
              >
                {cat.icon} {cat.name} ({count})
              </Button>
            );
          })}
        </div>
      </div>

      {/* Items table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <p className="text-4xl mb-3">🍽️</p>
          <p className="text-muted-foreground">لا توجد أصناف مطابقة</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">الصنف</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">التصنيف</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">السعر</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">المخزون</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">التوفّر</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => {
                  const cat = getCatMeta(item.category);
                  return (
                    <tr
                      key={item.itemId}
                      className={cn("border-b last:border-0 hover:bg-muted/20 transition-colors", idx % 2 === 0 ? "" : "bg-muted/5")}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="h-9 w-9 rounded-lg object-cover shrink-0 border"
                            />
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-base shrink-0">
                              {cat.icon}
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{item.nameAr || item.name}</p>
                            {item.nameAr && item.name !== item.nameAr && (
                              <p className="text-xs text-muted-foreground" dir="ltr">{item.name}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-base">{cat.icon}</span>{" "}
                        <span className="text-muted-foreground">{cat.name}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {(item.price / 100).toFixed(2)} ر.س
                      </td>
                      <td className="px-4 py-3">
                        {stockEditId === item.itemId ? (
                          <div className="flex items-center gap-1">
                            <Input
                              className="h-7 w-20 text-center"
                              value={stockVal}
                              onChange={e => setStockVal(e.target.value.replace(/\D/g, ""))}
                              placeholder="∞"
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === "Enter") saveStock(item.itemId);
                                if (e.key === "Escape") setStockEditId(null);
                              }}
                            />
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveStock(item.itemId)} disabled={stockSaving}>
                              {stockSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "✓"}
                            </Button>
                          </div>
                        ) : (
                          <button
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
                            onClick={() => {
                              setStockEditId(item.itemId);
                              setStockVal(item.stock === null || item.stock === undefined ? "" : String(item.stock));
                            }}
                          >
                            {item.stock === null || item.stock === undefined
                              ? <span className="text-green-600">∞</span>
                              : item.stock <= 0
                                ? <span className="text-red-500">نفد ({item.stock})</span>
                                : item.stock}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {togglingId === item.itemId ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : (
                            <Switch
                              checked={item.available}
                              onCheckedChange={() => toggleAvailable(item)}
                              className="scale-90"
                            />
                          )}
                          <Badge
                            variant={item.available ? "default" : "outline"}
                            className={cn(
                              "text-xs",
                              item.available
                                ? "bg-green-500/15 text-green-700 border-green-500/30"
                                : "text-zinc-400"
                            )}
                          >
                            {item.available ? "متاح" : "نافد"}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(item)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(item.itemId)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.itemId ? "تعديل الصنف" : "إضافة صنف جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>الاسم (عربي)</Label>
                <Input
                  value={form.nameAr}
                  onChange={e => setForm(f => ({ ...f, nameAr: e.target.value }))}
                  placeholder="مثال: مندي دجاج"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label>الاسم (إنجليزي / ID) *</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="chicken_mandi"
                  dir="ltr"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>السعر (ريال) *</Label>
                <Input
                  value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  placeholder="0.00"
                  dir="ltr"
                  type="number"
                  min="0"
                  step="0.5"
                />
              </div>
              <div className="space-y-1.5">
                <Label>التصنيف *</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>الوصف (اختياري)</Label>
              <Input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="وصف مختصر للصنف"
              />
            </div>
            <div className="space-y-1.5">
              <Label>رابط الصورة (اختياري)</Label>
              <Input
                value={form.imageUrl}
                onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
                placeholder="https://..."
                dir="ltr"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>المخزون (اتركه فارغاً = غير محدود)</Label>
                <Input
                  value={form.stock}
                  onChange={e => setForm(f => ({ ...f, stock: e.target.value.replace(/\D/g, "") }))}
                  placeholder="غير محدود"
                  dir="ltr"
                />
              </div>
              <div className="flex items-end pb-0.5">
                <div className="flex items-center justify-between rounded-lg border p-3 w-full">
                  <Label className="cursor-pointer">متاح</Label>
                  <Switch
                    checked={form.available}
                    onCheckedChange={v => setForm(f => ({ ...f, available: v }))}
                  />
                </div>
              </div>
            </div>
            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
              {form.itemId ? "حفظ التعديلات" : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الصنف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد؟ سيتم حذف هذا الصنف نهائياً.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
