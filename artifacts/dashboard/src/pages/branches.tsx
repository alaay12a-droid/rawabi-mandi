import { useState, useEffect } from "react";
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
import { Plus, RefreshCw, Pencil, Trash2, MapPin, Phone, GitBranch } from "lucide-react";

interface Branch {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  mapsUrl: string | null;
  active: boolean;
  lat: number | null;
  lng: number | null;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  createdAt: string;
}

interface BranchForm {
  id?: number;
  name: string;
  address: string;
  phone: string;
  mapsUrl: string;
  active: boolean;
  lat: string;
  lng: string;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
}

const emptyForm = (): BranchForm => ({
  name: "", address: "", phone: "", mapsUrl: "", active: false, lat: "", lng: "",
  deliveryEnabled: false, pickupEnabled: false,
});

export default function Branches() {
  const { toast } = useToast();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading]   = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm]             = useState<BranchForm>(emptyForm());
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState("");

  const [deleteId, setDeleteId]     = useState<number | null>(null);
  const [deleting, setDeleting]     = useState(false);

  // ── Load ───────────────────────────────────────────────────────────────────
  const load = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const data = await apiGet<Branch[]>("/branches");
      setBranches(data);
    } catch {
      toast({ title: "خطأ", description: "تعذّر تحميل الفروع", variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Open dialog ────────────────────────────────────────────────────────────
  const openAdd  = () => { setForm(emptyForm()); setFormError(""); setDialogOpen(true); };
  const openEdit = (b: Branch) => {
    setForm({
      id: b.id,
      name: b.name,
      address: b.address ?? "",
      phone: b.phone ?? "",
      mapsUrl: b.mapsUrl ?? "",
      active: b.active,
      lat: b.lat != null ? String(b.lat) : "",
      lng: b.lng != null ? String(b.lng) : "",
      deliveryEnabled: b.deliveryEnabled,
      pickupEnabled: b.pickupEnabled,
    });
    setFormError("");
    setDialogOpen(true);
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim()) { setFormError("اسم الفرع مطلوب"); return; }
    const hasLat = form.lat.trim() !== "";
    const hasLng = form.lng.trim() !== "";
    if (hasLat !== hasLng) {
      setFormError("أدخل خط العرض وخط الطول معًا، أو اترك الحقلين فارغين");
      return;
    }
    const latVal = hasLat ? Number(form.lat) : null;
    const lngVal = hasLng ? Number(form.lng) : null;
    if (
      (latVal !== null && (!Number.isFinite(latVal) || latVal < -90 || latVal > 90))
      || (lngVal !== null && (!Number.isFinite(lngVal) || lngVal < -180 || lngVal > 180))
    ) {
      setFormError("تحقق من الإحداثيات: Latitude بين -90 و90 وLongitude بين -180 و180");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name:    form.name.trim(),
        address: form.address.trim() || null,
        phone:   form.phone.trim()   || null,
        mapsUrl: form.mapsUrl.trim() || null,
        active:  form.active,
        lat: latVal,
        lng: lngVal,
        deliveryEnabled: form.deliveryEnabled,
        pickupEnabled: form.pickupEnabled,
      };
      if (form.id) {
        await apiPut(`/branches/${form.id}`, payload);
        toast({ title: "تم التعديل" });
      } else {
        await apiPost("/branches", payload);
        toast({ title: "تمت الإضافة" });
      }
      setDialogOpen(false);
      load(true);
    } catch {
      setFormError("حدث خطأ، حاول مرة أخرى");
    }
    setSaving(false);
  };

  // ── Toggle active ──────────────────────────────────────────────────────────
  const handleToggle = async (b: Branch) => {
    try {
      await apiPut(`/branches/${b.id}`, { active: !b.active });
      setBranches(prev => prev.map(x => x.id === b.id ? { ...x, active: !x.active } : x));
    } catch {
      toast({ title: "خطأ", description: "تعذّر تحديث الحالة", variant: "destructive" });
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await apiDel(`/branches/${deleteId}`);
      toast({ title: "تم الحذف" });
      setDeleteId(null);
      load(true);
    } catch {
      toast({ title: "خطأ", description: "تعذّر حذف الفرع", variant: "destructive" });
    }
    setDeleting(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-teal-600" />
            إدارة الفروع
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            أضف فروع المطعم — سيرى العميل قائمة الفروع عند الاستلام
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => load(true)}>
            <RefreshCw className="w-4 h-4 ml-1" />
            تحديث
          </Button>
          <Button size="sm" onClick={openAdd} className="bg-teal-600 hover:bg-teal-700">
            <Plus className="w-4 h-4 ml-1" />
            إضافة فرع
          </Button>
        </div>
      </div>

      {/* Info banner when only 1 branch */}
      {!loading && branches.length <= 1 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          💡 عندما يكون هناك فرعان أو أكثر، سيظهر للعميل خيار اختيار الفرع عند الضغط على
          <strong> "استلام"</strong> في صفحة الدفع.
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : branches.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">لا توجد فروع مضافة</p>
          <p className="text-sm mt-1">اضغط «إضافة فرع» لإضافة أول فرع</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {branches.map(b => (
            <div
              key={b.id}
              className={`rounded-xl border p-4 space-y-3 transition-opacity ${b.active ? "bg-white border-border" : "bg-muted/40 border-border opacity-60"}`}
            >
              {/* Top row */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base truncate">{b.name}</span>
                    <Badge variant={b.active ? "default" : "secondary"} className="text-xs shrink-0">
                      {b.active ? "نشط" : "موقوف"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <Badge variant={b.deliveryEnabled ? "outline" : "secondary"} className="text-[11px]">
                      التوصيل: {b.deliveryEnabled ? "مفعّل" : "موقوف"}
                    </Badge>
                    <Badge variant={b.pickupEnabled ? "outline" : "secondary"} className="text-[11px]">
                      الاستلام: {b.pickupEnabled ? "مفعّل" : "موقوف"}
                    </Badge>
                  </div>
                  {b.address && (
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      {b.address}
                    </p>
                  )}
                  {b.phone && (
                    <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1 dir-ltr" dir="ltr">
                      <Phone className="w-3 h-3 shrink-0" />
                      {b.phone}
                    </p>
                  )}
                  {b.mapsUrl && (
                    <a
                      href={b.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline mt-0.5 block truncate"
                    >
                      🗺️ رابط الخريطة
                    </a>
                  )}
                </div>
              </div>

              {/* Bottom row */}
              <div className="flex items-center justify-between border-t pt-3">
                <div className="flex items-center gap-2">
                  <Switch
                    id={`active-${b.id}`}
                    checked={b.active}
                    onCheckedChange={() => handleToggle(b)}
                  />
                  <Label htmlFor={`active-${b.id}`} className="text-sm cursor-pointer">
                    {b.active ? "نشط" : "موقوف"}
                  </Label>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(b)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(b.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{form.id ? "تعديل الفرع" : "إضافة فرع جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>اسم الفرع <span className="text-destructive">*</span></Label>
              <Input
                placeholder="مثال: الفرع الرئيسي — الروضة"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>العنوان</Label>
              <Input
                placeholder="مثال: تبوك — حي الروضة، شارع الملك سلمان"
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>رقم الهاتف</Label>
              <Input
                placeholder="مثال: 0501234567"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                dir="ltr"
              />
            </div>
            <div className="space-y-1">
              <Label>رابط الخريطة (Google Maps)</Label>
              <Input
                placeholder="https://maps.app.goo.gl/..."
                value={form.mapsUrl}
                onChange={e => setForm(f => ({ ...f, mapsUrl: e.target.value }))}
                dir="ltr"
              />
            </div>
            {/* Coordinates — needed for map marker and distance sorting */}
            <div className="space-y-1">
              <Label className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                إحداثيات الموقع
                <span className="text-muted-foreground text-xs font-normal mr-1">(اختياري — لعرض الخريطة وترتيب الفروع حسب المسافة)</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                افتح الموقع على Google Maps ← اضغط على النقطة ← انسخ الإحداثيات من الأسفل (مثال: 28.3835, 36.5662)
              </p>
              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">خط العرض (Latitude)</Label>
                  <Input
                    placeholder="مثال: 28.3835"
                    value={form.lat}
                    onChange={e => setForm(f => ({ ...f, lat: e.target.value }))}
                    dir="ltr"
                    type="number"
                    step="any"
                   min="-90"
                   max="90"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">خط الطول (Longitude)</Label>
                  <Input
                    placeholder="مثال: 36.5662"
                    value={form.lng}
                    onChange={e => setForm(f => ({ ...f, lng: e.target.value }))}
                    dir="ltr"
                    type="number"
                    step="any"
                   min="-180"
                   max="180"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="form-active"
                checked={form.active}
                onCheckedChange={v => setForm(f => ({ ...f, active: v }))}
              />
              <Label htmlFor="form-active">نشط (مرئي للعملاء)</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="form-delivery-enabled"
                checked={form.deliveryEnabled}
                onCheckedChange={v => setForm(f => ({ ...f, deliveryEnabled: v }))}
              />
              <Label htmlFor="form-delivery-enabled">التوصيل مفعّل</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="form-pickup-enabled"
                checked={form.pickupEnabled}
                onCheckedChange={v => setForm(f => ({ ...f, pickupEnabled: v }))}
              />
              <Label htmlFor="form-pickup-enabled">الاستلام من الفرع مفعّل</Label>
            </div>
            {formError && <p className="text-destructive text-sm">{formError}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-teal-600 hover:bg-teal-700">
              {saving ? "جارٍ الحفظ…" : form.id ? "حفظ التعديلات" : "إضافة الفرع"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف الفرع نهائياً. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? "جارٍ الحذف…" : "حذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
