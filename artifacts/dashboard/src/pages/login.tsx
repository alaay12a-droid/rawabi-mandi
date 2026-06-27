import { useState } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useDashboardLogin, getDashboardMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  username: z.string().min(1, "اسم المستخدم مطلوب"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

const resetSchema = z.object({
  code: z.string().length(6, "الرمز 6 أرقام"),
  newPassword: z.string().min(6, "كلمة المرور 6 أحرف على الأقل"),
});

type Step = "login" | "otp";

export default function Login() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("login");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [resettingPw, setResettingPw] = useState(false);

  const { mutate: login, isPending } = useDashboardLogin();

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const resetForm = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { code: "", newPassword: "" },
  });

  function onLogin(values: z.infer<typeof loginSchema>) {
    login({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getDashboardMeQueryKey() });
        setLocation("/");
      },
      onError: () => {
        toast({
          title: "فشل تسجيل الدخول",
          description: "تأكد من صحة اسم المستخدم وكلمة المرور",
          variant: "destructive",
        });
      }
    });
  }

  async function handleForgotPassword() {
    setSendingOtp(true);
    try {
      const res = await fetch("/api/dashboard/auth/forgot-password", { method: "POST" });
      if (!res.ok) throw new Error();
      setStep("otp");
      toast({ title: "تم الإرسال", description: "تحقق من بريدك الإلكتروني للحصول على الرمز" });
    } catch {
      toast({ title: "فشل الإرسال", description: "حاول مرة أخرى", variant: "destructive" });
    } finally {
      setSendingOtp(false);
    }
  }

  async function onReset(values: z.infer<typeof resetSchema>) {
    setResettingPw(true);
    try {
      const res = await fetch("/api/dashboard/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "خطأ");
      toast({ title: "تم تغيير كلمة المرور بنجاح" });
      setStep("login");
      resetForm.reset();
    } catch (e: unknown) {
      toast({
        title: "فشل إعادة التعيين",
        description: e instanceof Error ? e.message : "الرمز غير صحيح أو منتهي الصلاحية",
        variant: "destructive",
      });
    } finally {
      setResettingPw(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.15),transparent_40%)]" />
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_bottom_left,hsl(var(--primary)/0.15),transparent_40%)]" />

      <Card className="w-full max-w-md z-10 shadow-2xl border-primary/20">
        <CardHeader className="space-y-3 text-center pt-8">
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="روابي المندي"
            className="mx-auto h-24 w-auto object-contain"
          />
          <CardTitle className="text-2xl font-bold">
            {step === "login" ? "لوحة تحكم المطعم" : "إعادة تعيين كلمة المرور"}
          </CardTitle>
        </CardHeader>

        <CardContent className="pb-8">
          {step === "login" ? (
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-6">
                <FormField
                  control={loginForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>اسم المستخدم</FormLabel>
                      <FormControl>
                        <Input placeholder="أدخل اسم المستخدم" {...field} className="h-12" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>كلمة المرور</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="أدخل كلمة المرور" {...field} className="h-12" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isPending}>
                  {isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "تسجيل الدخول"}
                </Button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={sendingOtp}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                  >
                    {sendingOtp ? "جارٍ الإرسال..." : "نسيت كلمة المرور؟"}
                  </button>
                </div>
              </form>
            </Form>
          ) : (
            <Form {...resetForm}>
              <form onSubmit={resetForm.handleSubmit(onReset)} className="space-y-6">
                <p className="text-sm text-muted-foreground text-center">
                  أُرسل رمز تحقق من 6 أرقام إلى بريدك الإلكتروني — صالح لمدة 10 دقائق
                </p>
                <FormField
                  control={resetForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>رمز التحقق</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="000000"
                          maxLength={6}
                          className="h-12 text-center text-xl tracking-widest"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={resetForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>كلمة المرور الجديدة</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="أدخل كلمة المرور الجديدة" {...field} className="h-12" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={resettingPw}>
                  {resettingPw ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "تغيير كلمة المرور"}
                </Button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setStep("login")}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 mx-auto"
                  >
                    <ArrowRight className="h-4 w-4" />
                    العودة لتسجيل الدخول
                  </button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
