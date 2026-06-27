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
import { Plus, RefreshCw, Pencil, Trash2, Phone, Users, TrendingUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Driver {
  id: number;
  name: string;
  phone: string;
  photoUrl: string | null;
  active: boolean;
}

interface DrvSummary {
  driver: Driver;
  ordersCount: number;
  totalCollected: number;
}

interface DriverForm {
  id?: number;
  name: string;
  phone: string;
  pin: string;
  active: boolean;
}

const emptyForm = (): DriverForm => ({ name: "", phone: "", pin: "", active: true });

export default function Drivers() {
  const { toast } = useToast();
  const [drivers, setDrivers]     = useState<Driver[]>([]);
  const [summaries, setSummaries] = useState<DrvSummary[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [dialogOpen, setDialogOpen]   = useState(false);
  const [form, setForm]               = useState<DriverForm>(emptyForm());
  const [saving, setSaving]           = useState(false);
  const [formError, setFormError]     = useState("");

  const [deleteId, setDeleteId]       = useState<number | null>(null);
  const [deleting, setDeleting]       = useState(false);
  const [togglingId, setTogglingId]   = useState<number | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const [drvs, summs] = await Promise.all([
        apiGet<Driver[]>("/drivers"),
        apiGet<DrvSummary[]>("/drivers/daily-summaries").catch(() => []),
      ]);
      setDrivers(drvs);
      setSummaries(summs);
    } catch {
      toast({ title: "تعذّر تحميل بيانات المناديب", variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setForm(emptyForm());
    setFormError("");
    setDialogOpen(true);
  };

  const openEdit = (d: Driver) => {
    setForm({ id: d.id, name: d.name, phone: d.phone, pin: "", active: d.active });
    setFormError("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      setFormError("الاسم ورقم الجوال مطلوبان");
      return;
    }
    if (!form.id && form.pin.trim().length < 4) {
      setFormError("الرقم السري لازم يكون 4 أرقام على الأقل");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        active: form.active,
      };
      if (form.pin.trim()) body.pin = form.pin.trim();

      if (form.id) {
        const updated = await apiPut<Driver>(`/drivers/${form.id}`, body);
        setDrivers(prev => prev.map(d => d.id === form.id ? updated : d));
        toast({ title: "تم تحديث بيانات المندوب ✓" });
      } else {
        const created = await apiPost<Driver>("/drivers", body);
        setDrivers(prev => [...prev, created]);
        toast({ title: "تم إضافة المندوب ✓" });
      }
      setDialogOpen(false);
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? "تعذّر الحفظ";
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await apiDel(`/drivers/${deleteId}`);
      setDrivers(prev => prev.filter(d => d.id !== deleteId));
      toast({ title: "تم حذف المندوب" });
    } catch {
      toast({ title: "تعذّر حذف المندوب", variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const toggleActive = async (driver: Driver) => {
    setTogglingId(driver.id);
    try {
      const updated = await apiPut<Driver>(`/drivers/${driver.id}`, { active: !driver.active });
      setDrivers(prev => prev.map(d => d.id === driver.id ? updated : d));
    } catch {
      toast({ title: "تعذّر تحديث الحالة", variant: "destructive" });
    } finally {
      setTogglingId(null);
    }
  };

  const getSummary = (driverId: number) =>
    summaries.find(s => s.driver.id === driverId);

  const activeCount   = drivers.filter(d => d.active).length;
  const inactiveCount = drivers.filter(d => !d.active).length;
  const totalToday    = summaries.reduce((s, sm) => s + sm.ordersCount, 0);

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
        {[0,1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">إدارة المناديب</h1>
          <p className="text-muted-foreground text-sm mt-0.5">إضافة وتعديل وإدارة حسابات المناديب</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            إضافة مندوب
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">نشطون</p>
              <p className="text-2xl font-bold">{activeCount}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-500/10">
              <Users className="h-5 w-5 text-zinc-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">غير نشطين</p>
              <p className="text-2xl font-bold">{inactiveCount}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">طلبات اليوم (كل المناديب)</p>
              <p className="text-2xl font-bold">{totalToday}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Drivers list */}
      {drivers.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <p className="text-4xl mb-3">🛵</p>
          <p className="text-muted-foreground">لا يوجد مناديب حتى الآن</p>
          <Button onClick={openAdd} className="mt-4 gap-2">
            <Plus className="h-4 w-4" />
            أضف أول مندوب
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">المندوب</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">الجوال</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">الطلبات (اليوم)</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">الحالة</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((driver, idx) => {
                  const summ = getSummary(driver.id);
                  return (
                    <tr
                      key={driver.id}
                      className={cn("border-b last:border-0 hover:bg-muted/20 transition-colors", idx % 2 === 0 ? "" : "bg-muted/5")}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                            {driver.name.charAt(0)}
                          </div>
                          <span className="font-medium">{driver.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={`tel:${driver.phone}`}
                          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {driver.phone}
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold">{summ?.ordersCount ?? 0}</span>
                        {summ && summ.ordersCount > 0 && (
                          <span className="text-xs text-muted-foreground mr-1">
                            ({(summ.totalCollected / 100).toFixed(2)} ر.س)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {togglingId === driver.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : (
                            <Switch
                              checked={driver.active}
                              onCheckedChange={() => toggleActive(driver)}
                              className="scale-90"
                            />
                          )}
                          <Badge variant={driver.active ? "default" : "outline"} className={cn("text-xs", driver.active ? "bg-green-500/15 text-green-700 border-green-500/30" : "text-zinc-400")}>
                            {driver.active ? "نشط" : "غير نشط"}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(driver)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(driver.id)}
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "تعديل بيانات المندوب" : "إضافة مندوب جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>الاسم</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="اسم المندوب"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>رقم الجوال</Label>
              <Input
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="05xxxxxxxx"
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{form.id ? "الرقم السري (اتركه فارغاً للإبقاء على القديم)" : "الرقم السري *"}</Label>
              <Input
                value={form.pin}
                onChange={e => setForm(f => ({ ...f, pin: e.target.value }))}
                type="password"
                placeholder={form.id ? "اتركه فارغاً للإبقاء على القديم" : "4 أرقام على الأقل"}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label className="cursor-pointer">نشط</Label>
              <Switch
                checked={form.active}
                onCheckedChange={v => setForm(f => ({ ...f, active: v }))}
              />
            </div>
            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
              {form.id ? "حفظ التعديلات" : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المندوب</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد؟ سيتم حذف جميع بيانات هذا المندوب ولا يمكن التراجع.
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
