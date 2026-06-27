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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  username: z.string().min(1, "اسم المستخدم مطلوب"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { mutate: login, isPending } = useDashboardLogin();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  function onSubmit(values: z.infer<typeof loginSchema>) {
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
          <CardTitle className="text-2xl font-bold">لوحة تحكم المطعم</CardTitle>
        </CardHeader>
        <CardContent className="pb-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
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
                control={form.control}
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
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
