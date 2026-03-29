'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { sendOtp, verifyOtp } from '@/lib/api/auth';
import { useAuthStore, getRoleRedirectPath } from '@/lib/store/auth';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// ─── 스키마 ────────────────────────────────────────────────────────────────
const emailSchema = z.object({
  email: z.string().email('올바른 이메일을 입력해주세요'),
});

const otpSchema = z.object({
  otp: z.string().length(6, 'OTP는 6자리입니다'),
});

type EmailForm = z.infer<typeof emailSchema>;
type OtpForm = z.infer<typeof otpSchema>;

// ─── 컴포넌트 ──────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const { setTokens, setUser } = useAuthStore();

  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // OTP 6자리 개별 ref
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);

  const emailForm = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  });

  const otpForm = useForm<OtpForm>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: '' },
  });

  // ─── OTP 발송 ───────────────────────────────────────────────────────────
  async function onEmailSubmit(values: EmailForm) {
    setIsLoading(true);
    try {
      await sendOtp(values.email);
      setEmail(values.email);
      setStep('otp');
      toast({
        title: 'OTP 발송 완료',
        description: `${values.email}로 인증 코드를 보냈습니다`,
      });
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch {
      toast({
        variant: 'destructive',
        title: '발송 실패',
        description: '이메일을 확인하거나 잠시 후 다시 시도해주세요',
      });
    } finally {
      setIsLoading(false);
    }
  }

  // ─── OTP 입력 핸들러 (자동 포커스 이동) ──────────────────────────────────
  function handleOtpChange(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);

    // 자동 포커스: 입력 시 다음 칸으로
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    // 6자리 완성 시 자동 제출
    if (next.every((d) => d !== '')) {
      const otp = next.join('');
      otpForm.setValue('otp', otp);
      handleOtpVerify(otp);
    }
  }

  function handleOtpKeyDown(
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) {
    // COD-45: Backspace — 현재 칸 비어있으면 이전 칸으로 이동 + 이전 칸 지우기
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        const next = [...otpDigits];
        next[index - 1] = '';
        setOtpDigits(next);
        otpRefs.current[index - 1]?.focus();
      }
    }

    // 숫자 키 직접 입력 시 현재 칸 교체 후 다음 칸 이동
    if (/^\d$/.test(e.key)) {
      e.preventDefault();
      const next = [...otpDigits];
      next[index] = e.key;
      setOtpDigits(next);
      if (index < 5) otpRefs.current[index + 1]?.focus();
      if (next.every((d) => d !== '')) {
        const otp = next.join('');
        otpForm.setValue('otp', otp);
        handleOtpVerify(otp);
      }
    }
  }

  // COD-45: 붙여넣기 핸들러 — 6자리 숫자 자동 분배
  function handleOtpPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const next = [...otpDigits];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setOtpDigits(next);

    // 포커스: 붙여넣은 마지막 자리 다음 칸 (또는 마지막 칸)
    const focusIdx = Math.min(pasted.length, 5);
    otpRefs.current[focusIdx]?.focus();

    // 6자리 완성 시 자동 제출
    if (next.every((d) => d !== '')) {
      const otp = next.join('');
      otpForm.setValue('otp', otp);
      handleOtpVerify(otp);
    }
  }

  // ─── OTP 검증 ───────────────────────────────────────────────────────────
  async function handleOtpVerify(otp: string) {
    setIsLoading(true);
    try {
      const { accessToken, user } = await verifyOtp(email, otp);
      setTokens(accessToken, ''); // refreshToken은 httpOnly 쿠키로 발급됨
      setUser(user);
      toast({
        title: '로그인 성공',
        description: `${user.name}님, 환영합니다`,
      });
      router.push(getRoleRedirectPath(user.role));
    } catch {
      toast({
        variant: 'destructive',
        title: '인증 실패',
        description: '코드가 올바르지 않거나 만료되었습니다',
      });
      // 초기화
      setOtpDigits(['', '', '', '', '', '']);
      otpForm.setValue('otp', '');
      otpRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  }

  // ─── 렌더 ───────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mb-2 text-3xl font-bold text-primary">EVACYCLE</div>
          <CardTitle className="text-xl">
            {step === 'email' ? '로그인' : 'OTP 인증'}
          </CardTitle>
          <CardDescription>
            {step === 'email'
              ? '이메일을 입력하면 OTP를 보내드립니다'
              : `${email}로 보낸 6자리 코드를 입력하세요`}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {step === 'email' ? (
            /* ─── 이메일 입력 단계 ─── */
            <Form {...emailForm}>
              <form
                onSubmit={emailForm.handleSubmit(onEmailSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={emailForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>이메일</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="example@evacycle.com"
                          type="email"
                          autoFocus
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="button" 
                  className="w-full" 
                  disabled={isLoading}
                  onClick={emailForm.handleSubmit(onEmailSubmit)}
                >
                  {isLoading ? '발송 중...' : 'OTP 받기'}
                </Button>
              </form>
            </Form>
          ) : (
            /* ─── OTP 입력 단계 ─── */
            <div className="space-y-6">
              {/* OTP 6칸 입력 */}
              <div className="flex justify-center gap-2">
                {otpDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      otpRefs.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    onPaste={handleOtpPaste}
                    disabled={isLoading}
                    className="h-12 w-12 rounded-md border border-input bg-background text-center text-lg font-semibold ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
                  />
                ))}
              </div>

              {/* 재발송 */}
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setOtpDigits(['', '', '', '', '', '']);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ← 이메일 변경
                </button>
                <button
                  type="button"
                  onClick={() => onEmailSubmit({ email })}
                  disabled={isLoading}
                  className="text-primary hover:underline disabled:opacity-50"
                >
                  재발송
                </button>
              </div>

              {isLoading && (
                <p className="text-center text-sm text-muted-foreground">
                  인증 중...
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
