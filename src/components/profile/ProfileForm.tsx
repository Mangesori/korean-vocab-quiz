import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, User, Globe, Target, Sun, Moon, Monitor } from 'lucide-react';
import { ProfileData, ProfileUpdateData } from '@/hooks/useProfile';

const profileSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요').max(50, '이름은 50자 이하로 입력해주세요'),
  bio: z.string().max(200, '자기소개는 200자 이하로 입력해주세요').optional().nullable(),
  preferred_language: z.string().optional().nullable(),
  study_goal: z.string().max(100, '학습 목표는 100자 이하로 입력해주세요').optional().nullable(),
  daily_word_count: z.number().min(1).max(100).optional().nullable(),
  theme_preference: z.enum(['light', 'dark', 'system']).optional().nullable(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface ProfileFormProps {
  profile: ProfileData | null;
  onSubmit: (data: ProfileUpdateData) => void;
  isSubmitting: boolean;
}

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'zh_CN', label: '简体中文' },
  { value: 'zh_TW', label: '繁體中文' },
  { value: 'ja', label: '日本語' },
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'th', label: 'ภาษาไทย' },
  { value: 'id', label: 'Bahasa Indonesia' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'ru', label: 'Русский' },
];

const THEME_OPTIONS = [
  { value: 'system', label: '시스템 설정', icon: Monitor },
  { value: 'light', label: '라이트 모드', icon: Sun },
  { value: 'dark', label: '다크 모드', icon: Moon },
];

export function ProfileForm({ profile, onSubmit, isSubmitting }: ProfileFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: profile?.name || '',
      bio: profile?.bio || '',
      preferred_language: profile?.preferred_language || 'en',
      study_goal: profile?.study_goal || '',
      daily_word_count: profile?.daily_word_count || 10,
      theme_preference: (profile?.theme_preference as 'light' | 'dark' | 'system') || 'system',
    },
  });

  const selectedLanguage = watch('preferred_language');
  const selectedTheme = watch('theme_preference');

  const handleFormSubmit = (data: ProfileFormData) => {
    onSubmit({
      name: data.name,
      bio: data.bio || null,
      preferred_language: data.preferred_language || null,
      study_goal: data.study_goal || null,
      daily_word_count: data.daily_word_count || null,
      theme_preference: data.theme_preference || null,
    });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            기본 정보
          </CardTitle>
          <CardDescription>프로필 기본 정보를 설정합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">이름 *</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="이름을 입력하세요"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">자기소개</Label>
            <Textarea
              id="bio"
              {...register('bio')}
              placeholder="간단한 자기소개를 작성해주세요"
              rows={3}
            />
            {errors.bio && (
              <p className="text-sm text-destructive">{errors.bio.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            학습 설정
          </CardTitle>
          <CardDescription>학습 목표와 선호 설정을 관리합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="study_goal">학습 목표</Label>
            <Input
              id="study_goal"
              {...register('study_goal')}
              placeholder="예: TOPIK 4급 합격, 일상 회화 마스터"
            />
            {errors.study_goal && (
              <p className="text-sm text-destructive">{errors.study_goal.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="daily_word_count">일일 학습 단어 수</Label>
            <Input
              id="daily_word_count"
              type="number"
              min={1}
              max={100}
              {...register('daily_word_count', { valueAsNumber: true })}
            />
            {errors.daily_word_count && (
              <p className="text-sm text-destructive">{errors.daily_word_count.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>번역 언어</Label>
            <Select
              value={selectedLanguage || 'en'}
              onValueChange={(value) => setValue('preferred_language', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="언어 선택" />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            테마 설정
          </CardTitle>
          <CardDescription>앱의 테마를 선택합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {THEME_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isSelected = selectedTheme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setValue('theme_preference', option.value as 'light' | 'dark' | 'system')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Icon className={`h-6 w-6 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className={`text-sm ${isSelected ? 'font-medium' : ''}`}>
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          저장하기
        </Button>
      </div>
    </form>
  );
}
